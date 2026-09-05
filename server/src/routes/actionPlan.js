import { Router } from "express";
import { get, all, run } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_STATUS = ["a_faire", "en_cours", "fait"];
const ALLOWED_ORIGINE = ["lead", "opportunite", "marketing", "general"];

// Selectionne l'action_plan avec pilote resolu et le libelle de l'element d'origine
// (lead / opportunite / action marketing), via des LEFT JOIN conditionnels : un seul
// des trois peut matcher selon origine_type, les autres restent NULL.
const SELECT_WITH_JOINS = `
  SELECT ap.*, u.name as pilote_name,
    CASE ap.origine_type
      WHEN 'lead' THEN l.name
      WHEN 'opportunite' THEN o.title
      WHEN 'marketing' THEN ma.title
      ELSE NULL
    END as origine_label
  FROM action_plan ap
  LEFT JOIN users u ON u.id = ap.pilote_id
  LEFT JOIN leads l ON ap.origine_type = 'lead' AND l.id = ap.origine_id
  LEFT JOIN opportunities o ON ap.origine_type = 'opportunite' AND o.id = ap.origine_id
  LEFT JOIN marketing_actions ma ON ap.origine_type = 'marketing' AND ma.id = ap.origine_id
`;

router.get("/", ah(async (req, res) => {
  const { status, pilote_id, origine_type } = req.query;
  let sql = SELECT_WITH_JOINS + " WHERE 1=1";
  const params = [];
  if (status) { sql += " AND ap.status = ?"; params.push(status); }
  if (pilote_id) { sql += " AND ap.pilote_id = ?"; params.push(pilote_id); }
  if (origine_type) { sql += " AND ap.origine_type = ?"; params.push(origine_type); }
  sql += " ORDER BY COALESCE(ap.deadline::date, ap.action_date::date, ap.created_at::date) ASC NULLS LAST, ap.created_at DESC";
  res.json(await all(sql, params));
}));

router.post("/", ah(async (req, res) => {
  const { action, pilote_id, action_date, deadline, status, origine_type, origine_id, notes } = req.body || {};
  if (!action) return res.status(400).json({ error: "La description de l'action est requise" });

  const finalOrigineType = ALLOWED_ORIGINE.includes(origine_type) ? origine_type : "general";
  const finalOrigineId = finalOrigineType === "general" ? null : (origine_id || null);

  const info = await run(`
    INSERT INTO action_plan (action, pilote_id, action_date, deadline, status, origine_type, origine_id, notes)
    VALUES (?,?,?,?,?,?,?,?) RETURNING id
  `, [action, pilote_id || null, action_date || null, deadline || null,
    ALLOWED_STATUS.includes(status) ? status : "a_faire", finalOrigineType, finalOrigineId, notes || null]);

  res.status(201).json(await get(SELECT_WITH_JOINS + " WHERE ap.id = ?", [info.lastInsertRowid]));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM action_plan WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Action introuvable" });

  const merged = { ...existing, ...req.body };
  const finalOrigineType = ALLOWED_ORIGINE.includes(merged.origine_type) ? merged.origine_type : "general";
  const finalOrigineId = finalOrigineType === "general" ? null : (merged.origine_id || null);

  await run(`
    UPDATE action_plan SET action=?, pilote_id=?, action_date=?, deadline=?, status=?, origine_type=?, origine_id=?, notes=?, updated_at=NOW()
    WHERE id=?
  `, [merged.action, merged.pilote_id || null, merged.action_date || null, merged.deadline || null,
    ALLOWED_STATUS.includes(merged.status) ? merged.status : "a_faire",
    finalOrigineType, finalOrigineId, merged.notes || null, req.params.id]);

  res.json(await get(SELECT_WITH_JOINS + " WHERE ap.id = ?", [req.params.id]));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM action_plan WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

export default router;
