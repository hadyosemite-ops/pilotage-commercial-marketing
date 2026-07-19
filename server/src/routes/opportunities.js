import { Router } from "express";
import { get, all, run } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_STAGES = ["opportunite", "negociation", "gagne", "perdu"];

router.get("/", ah(async (req, res) => {
  const { stage } = req.query;
  let sql = "SELECT o.*, l.name as lead_name, l.company as lead_company FROM opportunities o LEFT JOIN leads l ON l.id = o.lead_id WHERE 1=1";
  const params = [];
  if (stage) { sql += " AND stage = ?"; params.push(stage); }
  sql += " ORDER BY o.created_at DESC";
  res.json(await all(sql, params));
}));

router.post("/", ah(async (req, res) => {
  const { lead_id, title, stage, value_estimate, probability, expected_close_date, notes } = req.body || {};
  if (!title) return res.status(400).json({ error: "title requis" });

  const info = await run(`
    INSERT INTO opportunities (lead_id, title, stage, value_estimate, probability, expected_close_date, notes, owner_id)
    VALUES (?,?,?,?,?,?,?,?) RETURNING id
  `, [lead_id || null, title, ALLOWED_STAGES.includes(stage) ? stage : "opportunite",
    value_estimate || 0, probability ?? 50, expected_close_date || null, notes || null, req.user.id]);

  res.status(201).json(await get("SELECT * FROM opportunities WHERE id = ?", [info.lastInsertRowid]));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM opportunities WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Opportunite introuvable" });

  const merged = { ...existing, ...req.body };
  await run(`
    UPDATE opportunities SET lead_id=?, title=?, stage=?, value_estimate=?, probability=?, expected_close_date=?,
      lost_reason=?, notes=?, updated_at=NOW() WHERE id=?
  `, [merged.lead_id, merged.title, merged.stage, merged.value_estimate, merged.probability,
    merged.expected_close_date, merged.lost_reason, merged.notes, req.params.id]);

  res.json(await get("SELECT * FROM opportunities WHERE id = ?", [req.params.id]));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM opportunities WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

export default router;
