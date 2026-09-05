import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { get, all, run } from "../db.js";
import { signToken, requireAuth, requireAdmin } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";
import { sendPasswordResetEmail } from "../lib/email.js";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// URL de base du frontend deploye, pour construire le lien de reinitialisation envoye
// par email (ex: https://mon-app.vercel.app). A defaut, on retombe sur le serveur
// de dev Vite local.
const APP_URL = (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

// Liste blanche des emails autorises a se connecter (outil interne, donnees commerciales
// sensibles -> pas d'inscription libre). Format : "a@x.com,b@y.com" dans ALLOWED_EMAILS.
function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// L'email liste en premier dans ALLOWED_EMAILS devient automatiquement admin
// a sa premiere connexion (les suivants sont "member").
function isFirstAllowedEmail(email) {
  const list = getAllowedEmails();
  return list[0] === email.toLowerCase().trim();
}

router.post("/login", ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

  const user = await get("SELECT * FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: "Identifiants incorrects" });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Identifiants incorrects" });

  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.post("/google", ah(async (req, res) => {
  if (!googleClient) {
    return res.status(500).json({ error: "Connexion Google non configuree (GOOGLE_CLIENT_ID manquant)" });
  }

  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Jeton Google manquant" });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Jeton Google invalide" });
  }

  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: "Email Google non verifie" });
  }

  const email = payload.email.toLowerCase().trim();
  const allowedEmails = getAllowedEmails();
  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    return res.status(403).json({ error: "Cet email n'est pas autorise a acceder a cet outil. Contacte un administrateur." });
  }

  let user = await get("SELECT * FROM users WHERE email = ?", [email]);

  if (!user) {
    // Cree automatiquement le compte a la premiere connexion Google reussie.
    const placeholderHash = bcrypt.hashSync(`google-oauth-${Date.now()}-${Math.random()}`, 10);
    const role = isFirstAllowedEmail(email) ? "admin" : "member";
    const info = await run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id",
      [payload.name || email, email, placeholderHash, role]
    );
    user = await get("SELECT * FROM users WHERE id = ?", [info.lastInsertRowid]);
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

// Demande de reinitialisation de mot de passe : genere un jeton a duree limitee (1h),
// envoye par email via Resend. Reponse volontairement identique que l'email existe ou
// non, pour ne pas reveler quels comptes existent (enumeration).
router.post("/forgot-password", ah(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email requis" });

  const genericMessage = { message: "Si un compte existe avec cet email, un lien de reinitialisation vient d'etre envoye." };

  const normalizedEmail = email.toLowerCase().trim();
  const user = await get("SELECT * FROM users WHERE email = ?", [normalizedEmail]);
  if (!user) return res.json(genericMessage);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await run("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?", [
    tokenHash, expiresAt.toISOString(), user.id,
  ]);

  const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error("Erreur envoi email de reinitialisation:", err);
    return res.status(500).json({ error: "Impossible d'envoyer l'email pour le moment. Reessaie plus tard ou contacte un administrateur." });
  }

  res.json(genericMessage);
}));

// Finalise la reinitialisation : verifie le jeton (hash compare, non expire), met a
// jour le mot de passe et invalide le jeton (usage unique).
router.post("/reset-password", ah(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "Jeton et nouveau mot de passe requis" });
  if (password.length < 8) return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caracteres" });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await get("SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()", [tokenHash]);

  if (!user) return res.status(400).json({ error: "Lien invalide ou expire. Refais une demande de reinitialisation." });

  const hash = bcrypt.hashSync(password, 10);
  await run("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?", [hash, user.id]);

  res.json({ ok: true });
}));

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get("/users", requireAuth, ah(async (req, res) => {
  const users = await all("SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC");
  res.json(users);
}));

// Seul un admin peut creer de nouveaux comptes email/mot de passe (equipe interne de 2 a 5 personnes).
router.post("/users", requireAuth, requireAdmin, ah(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Champs manquants" });

  const existing = await get("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (existing) return res.status(409).json({ error: "Cet email existe deja" });

  const hash = bcrypt.hashSync(password, 10);
  const info = await run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id",
    [name, email.toLowerCase().trim(), hash, role === "admin" ? "admin" : "member"]
  );

  res.status(201).json({ id: info.lastInsertRowid, name, email, role: role || "member" });
}));

// Modifie un membre existant : nom, email, role, et mot de passe optionnel (reinitialisation).
// Reserve aux admins. Empeche de retirer le role admin du dernier administrateur restant.
router.put("/users/:id", requireAuth, requireAdmin, ah(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body || {};

  const target = await get("SELECT * FROM users WHERE id = ?", [id]);
  if (!target) return res.status(404).json({ error: "Membre introuvable" });

  if (role && !["admin", "member"].includes(role)) {
    return res.status(400).json({ error: "Role invalide" });
  }

  if (role === "member" && target.role === "admin") {
    const admins = await all("SELECT id FROM users WHERE role = 'admin'");
    if (admins.length <= 1) {
      return res.status(400).json({ error: "Impossible de retirer le role du dernier administrateur" });
    }
  }

  let normalizedEmail = target.email;
  if (email) {
    normalizedEmail = email.toLowerCase().trim();
    const existing = await get("SELECT id FROM users WHERE email = ? AND id != ?", [normalizedEmail, id]);
    if (existing) return res.status(409).json({ error: "Cet email est deja utilise par un autre compte" });
  }

  const fields = ["name = ?", "email = ?", "role = ?"];
  const args = [name || target.name, normalizedEmail, role || target.role];

  if (password) {
    fields.push("password_hash = ?");
    args.push(bcrypt.hashSync(password, 10));
  }

  args.push(id);
  await run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, args);

  res.json(await get("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [id]));
}));

// Supprime un membre. Reserve aux admins. Un admin ne peut pas supprimer son propre
// compte, ni supprimer le dernier administrateur restant (l'equipe se retrouverait
// sans acces admin).
router.delete("/users/:id", requireAuth, requireAdmin, ah(async (req, res) => {
  const { id } = req.params;
  const target = await get("SELECT * FROM users WHERE id = ?", [id]);
  if (!target) return res.status(404).json({ error: "Membre introuvable" });

  if (req.user?.id != null && String(req.user.id) === String(id)) {
    return res.status(400).json({ error: "Impossible de supprimer votre propre compte" });
  }

  if (target.role === "admin") {
    const admins = await all("SELECT id FROM users WHERE role = 'admin'");
    if (admins.length <= 1) {
      return res.status(400).json({ error: "Impossible de supprimer le dernier administrateur" });
    }
  }

  await run("DELETE FROM users WHERE id = ?", [id]);
  res.json({ ok: true });
}));

export default router;
