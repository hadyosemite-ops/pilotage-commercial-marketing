import { Router } from "express";
import bcrypt from "bcryptjs";
import { get, all, run } from "../db.js";
import { signToken, requireAuth, requireAdmin } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();

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

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Seul un admin peut créer de nouveaux comptes (équipe interne de 2 à 5 personnes)
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

router.get("/users", requireAuth, ah(async (req, res) => {
  const users = await all("SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC");
  res.json(users);
}));

export default router;
