import { Router } from "express";
import { get, all, run } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_STATUS = ["a_faire", "en_cours", "fait"];

router.get("/", ah(async (req, res) => {
  const { status, pilote_id } = req.query;
  let sql = `
    SELECT ap.*, u.name as pilote_name
    FROM action_plan ap
    LEFT JOIN users u ON u.id = ap.pilote_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += " AND ap.status = ?"; params.push(status); }
  if (pilote_id) { sql += " AND ap.pilote_id = ?"; params.push(pilote_id); }
  sql += " ORDER BY COALESCE(ap.deadline::date, ap.action_date::date, ap.created_at::date) ASC NULLS LAST, ap.created_at DESC";
  res.json(await all(sql, params));
}));

router.post("/", ah(async (req, res) => {
  const { action, pilote_id, action_date, deadline, status, notes } = req.body || {};
  if (!action) return res.status(400).json({ error: "La description de l'action est requise" });

  const info = await run(`
    INSERT INTO action_plan (action, pilote_id, action_date, deadline, status, notes)
    VALUES (?,?,?,?,?,?) RETURNING id
  `, [action, pilote_id || null, action_date || null, deadline || null,
    ALLOWED_STATUS.includes(status) ? status : "a_faire", notes || null]);

  res.status(201).json(await get(`
    SELECT ap.*, u.name as pilote_name FROM action_plan ap
    LEFT JOIN users u ON u.id = ap.pilote_id WHERE ap.id = ?
  `, [info.lastInsertRowid]));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM action_plan WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Action introuvable" });

  const merged = { ...existing, ...req.body };
  await run(`
    UPDATE action_plan SET action=?, pilote_id=?, action_date=?, deadline=?, status=?, notes=?, updated_at=NOW()
    WHERE id=?
  `, [merged.action, merged.pilote_id || null, merged.action_date || null, merged.deadline || null,
    ALLOWED_STATUS.includes(merged.status) ? merged.status : "a_faire", merged.notes || null, req.params.id]);

  res.json(await get(`
    SELECT ap.*, u.name as pilote_name FROM action_plan ap
    LEFT JOIN users u ON u.id = ap.pilote_id WHERE ap.id = ?
  `, [req.params.id]));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM action_plan WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

export default router;
