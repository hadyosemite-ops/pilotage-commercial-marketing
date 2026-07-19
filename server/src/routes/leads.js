import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { get, all, run, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage() });

const ALLOWED_STATUS = ["nouveau", "contacte", "qualifie", "disqualifie"];

router.get("/", ah(async (req, res) => {
  const { status, source_channel, q } = req.query;
  let sql = "SELECT * FROM leads WHERE 1=1";
  const params = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (source_channel) { sql += " AND source_channel = ?"; params.push(source_channel); }
  if (q) { sql += " AND (name LIKE ? OR company LIKE ?)"; params.push(`%${q}%`, `%${q}%`); }
  sql += " ORDER BY created_at DESC";
  res.json(await all(sql, params));
}));

router.get("/:id", ah(async (req, res) => {
  const lead = await get("SELECT * FROM leads WHERE id = ?", [req.params.id]);
  if (!lead) return res.status(404).json({ error: "Lead introuvable" });
  const opportunities = await all("SELECT * FROM opportunities WHERE lead_id = ? ORDER BY created_at DESC", [req.params.id]);
  res.json({ ...lead, opportunities });
}));

router.post("/", ah(async (req, res) => {
  const { name, company, job_title, source_channel, email, phone, linkedin_url, status, fit_score, intent_score, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: "Le nom est requis" });

  const info = await run(`
    INSERT INTO leads (name, company, job_title, source_channel, email, phone, linkedin_url, status, fit_score, intent_score, notes, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
  `, [name, company || null, job_title || null, source_channel || "LinkedIn", email || null, phone || null,
    linkedin_url || null, ALLOWED_STATUS.includes(status) ? status : "nouveau", fit_score || 0, intent_score || 0,
    notes || null, req.user.id]);

  res.status(201).json(await get("SELECT * FROM leads WHERE id = ?", [info.lastInsertRowid]));
}));

// Import CSV structuré : colonnes attendues -> name,company,job_title,source_channel,email,phone,linkedin_url,notes
router.post("/import", upload.single("file"), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu (champ 'file')" });

  let records;
  try {
    records = parse(req.file.buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: "CSV illisible : " + e.message });
  }

  let created = 0;
  const errors = [];

  try {
    await withTransaction(async (tx) => {
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const name = row.name || row.Name || row.nom;
        if (!name) { errors.push(`Ligne ${i + 2}: colonne 'name' manquante`); continue; }
        await tx.run(
          `INSERT INTO leads (name, company, job_title, source_channel, email, phone, linkedin_url, status, notes, owner_id)
           VALUES (?,?,?,?,?,?,?, 'nouveau', ?, ?)`,
          [
            name,
            row.company || row.Company || row.entreprise || null,
            row.job_title || row.title || row.poste || null,
            row.source_channel || row.source || "LinkedIn",
            row.email || null,
            row.phone || row.telephone || null,
            row.linkedin_url || row.linkedin || null,
            row.notes || null,
            req.user.id,
          ]
        );
        created++;
      }
    });
  } catch (e) {
    return res.status(500).json({ error: "Import annule : " + e.message });
  }

  res.json({ created, total: records.length, errors });
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM leads WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Lead introuvable" });

  const merged = { ...existing, ...req.body };
  await run(`
    UPDATE leads SET name=?, company=?, job_title=?, source_channel=?, email=?, phone=?, linkedin_url=?,
      status=?, fit_score=?, intent_score=?, notes=?, updated_at=NOW() WHERE id=?
  `, [merged.name, merged.company, merged.job_title, merged.source_channel, merged.email, merged.phone,
    merged.linkedin_url, merged.status, merged.fit_score, merged.intent_score, merged.notes, req.params.id]);

  res.json(await get("SELECT * FROM leads WHERE id = ?", [req.params.id]));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM leads WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

// Conversion d'un lead qualifié en opportunité
router.post("/:id/convert", ah(async (req, res) => {
  const lead = await get("SELECT * FROM leads WHERE id = ?", [req.params.id]);
  if (!lead) return res.status(404).json({ error: "Lead introuvable" });

  const { title, value_estimate, probability, expected_close_date } = req.body || {};
  const info = await run(`
    INSERT INTO opportunities (lead_id, title, stage, value_estimate, probability, expected_close_date, owner_id)
    VALUES (?, ?, 'opportunite', ?, ?, ?, ?) RETURNING id
  `, [lead.id, title || `Opportunite - ${lead.name}`, value_estimate || 0, probability || 50,
    expected_close_date || null, req.user.id]);

  await run("UPDATE leads SET status = 'qualifie', updated_at = NOW() WHERE id = ?", [lead.id]);

  res.status(201).json(await get("SELECT * FROM opportunities WHERE id = ?", [info.lastInsertRowid]));
}));

export default router;
