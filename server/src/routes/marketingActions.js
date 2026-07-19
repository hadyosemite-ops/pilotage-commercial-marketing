import { Router } from "express";
import { get, all, run } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_CHANNELS = ["LinkedIn", "Instagram", "Autre"];
const ALLOWED_STATUS = ["planifie", "publie", "archive"];

router.get("/", ah(async (req, res) => {
  const { channel, status } = req.query;
  let sql = "SELECT * FROM marketing_actions WHERE 1=1";
  const params = [];
  if (channel) { sql += " AND channel = ?"; params.push(channel); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY COALESCE(scheduled_date::timestamptz, created_at) DESC";
  res.json(await all(sql, params));
}));

router.post("/", ah(async (req, res) => {
  const { channel, type, title, status, scheduled_date, published_date, reach, engagement, clicks, notes } = req.body || {};
  if (!channel || !type || !title) return res.status(400).json({ error: "channel, type et title sont requis" });
  if (!ALLOWED_CHANNELS.includes(channel)) return res.status(400).json({ error: "canal invalide" });

  const info = await run(`
    INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, published_date, reach, engagement, clicks, notes, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id
  `, [channel, type, title, ALLOWED_STATUS.includes(status) ? status : "planifie",
    scheduled_date || null, published_date || null, reach || 0, engagement || 0, clicks || 0, notes || null, req.user.id]);

  res.status(201).json(await get("SELECT * FROM marketing_actions WHERE id = ?", [info.lastInsertRowid]));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM marketing_actions WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Action introuvable" });

  const merged = { ...existing, ...req.body };
  await run(`
    UPDATE marketing_actions SET channel=?, type=?, title=?, status=?, scheduled_date=?, published_date=?,
      reach=?, engagement=?, clicks=?, notes=?, updated_at=NOW() WHERE id=?
  `, [merged.channel, merged.type, merged.title, merged.status, merged.scheduled_date, merged.published_date,
    merged.reach, merged.engagement, merged.clicks, merged.notes, req.params.id]);

  res.json(await get("SELECT * FROM marketing_actions WHERE id = ?", [req.params.id]));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM marketing_actions WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

export default router;
