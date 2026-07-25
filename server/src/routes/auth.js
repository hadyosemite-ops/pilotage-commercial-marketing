import { Router } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { get, all, run } from "../db.js";
import { signToken, requireAuth, requireAdmin } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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

// Change le role d'un membre existant (admin/member) — reserve aux admins.
router.put("/users/:id/role", requireAuth, requireAdmin, ah(async (req, res) => {
  const { role } = req.body || {};
  if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Role invalide" });
  await run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
  res.json(await get("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [req.params.id]));
}));

export default router;
