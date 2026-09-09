import { Router } from "express";
import { get, all, run } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get("/", ah(async (req, res) => {
  res.json(await all("SELECT * FROM clients ORDER BY raison_sociale ASC"));
}));

router.get("/:id", ah(async (req, res) => {
  const client = await get("SELECT * FROM clients WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client introuvable" });
  res.json(client);
}));

router.post("/", ah(async (req, res) => {
  const { raison_sociale, adresse, ice, identifiant_fiscal, rc, contact_nom, contact_email, contact_telephone, notes } = req.body || {};
  if (!raison_sociale) return res.status(400).json({ error: "Raison sociale requise" });

  const info = await run(`
    INSERT INTO clients (raison_sociale, adresse, ice, identifiant_fiscal, rc, contact_nom, contact_email, contact_telephone, notes, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id
  `, [raison_sociale, adresse || null, ice || null, identifiant_fiscal || null, rc || null,
    contact_nom || null, contact_email || null, contact_telephone || null, notes || null, req.user.id]);

  res.status(201).json(await get("SELECT * FROM clients WHERE id = ?", [info.lastInsertRowid]));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM clients WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Client introuvable" });

  const merged = { ...existing, ...req.body };
  if (!merged.raison_sociale) return res.status(400).json({ error: "Raison sociale requise" });

  await run(`
    UPDATE clients SET raison_sociale=?, adresse=?, ice=?, identifiant_fiscal=?, rc=?, contact_nom=?, contact_email=?, contact_telephone=?, notes=?, updated_at=NOW()
    WHERE id=?
  `, [merged.raison_sociale, merged.adresse, merged.ice, merged.identifiant_fiscal, merged.rc,
    merged.contact_nom, merged.contact_email, merged.contact_telephone, merged.notes, req.params.id]);

  res.json(await get("SELECT * FROM clients WHERE id = ?", [req.params.id]));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM clients WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

export default router;
