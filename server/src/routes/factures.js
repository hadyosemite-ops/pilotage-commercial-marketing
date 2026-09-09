import { Router } from "express";
import { get, all, run, nextNumero } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";
import { generateFacturePdf } from "../lib/pdf.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_STATUTS = ["brouillon", "envoyee", "payee", "en_retard", "annulee"];
const ALLOWED_MODES_PAIEMENT = ["virement", "cheque", "especes", "effet"];

const SELECT_WITH_AFFAIRE = `
  SELECT f.*, a.numero as affaire_numero, a.titre as affaire_titre, a.client_raison_sociale as affaire_client_raison_sociale
  FROM factures f
  LEFT JOIN affaires a ON a.id = f.affaire_id
`;

function withComputed(row) {
  if (!row) return row;
  return { ...row, montant_ttc: Number(row.montant_ht) * (1 + Number(row.taux_tva) / 100) };
}

router.get("/", ah(async (req, res) => {
  const { statut, affaire_id } = req.query;
  let sql = SELECT_WITH_AFFAIRE + " WHERE 1=1";
  const params = [];
  if (statut) { sql += " AND f.statut = ?"; params.push(statut); }
  if (affaire_id) { sql += " AND f.affaire_id = ?"; params.push(affaire_id); }
  sql += " ORDER BY f.created_at DESC";
  res.json((await all(sql, params)).map(withComputed));
}));

router.post("/", ah(async (req, res) => {
  const { affaire_id, objet, montant_ht, taux_tva, statut, date_emission, date_echeance, acompte_pourcentage, mode_paiement, notes } = req.body || {};
  if (!affaire_id || !objet) return res.status(400).json({ error: "Affaire et objet requis" });
  if (mode_paiement && !ALLOWED_MODES_PAIEMENT.includes(mode_paiement)) return res.status(400).json({ error: "Mode de paiement invalide" });

  const affaire = await get("SELECT id FROM affaires WHERE id = ?", [affaire_id]);
  if (!affaire) return res.status(400).json({ error: "Affaire introuvable" });

  const numero = await nextNumero("FAC", "factures");
  const info = await run(`
    INSERT INTO factures (numero, affaire_id, objet, montant_ht, taux_tva, statut, date_emission, date_echeance, acompte_pourcentage, mode_paiement, notes, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
  `, [numero, affaire_id, objet, montant_ht || 0, taux_tva ?? 20,
    ALLOWED_STATUTS.includes(statut) ? statut : "brouillon", date_emission || null, date_echeance || null,
    acompte_pourcentage || null, mode_paiement || null, notes || null, req.user.id]);

  res.status(201).json(withComputed(await get(SELECT_WITH_AFFAIRE + " WHERE f.id = ?", [info.lastInsertRowid])));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM factures WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Facture introuvable" });

  const merged = { ...existing, ...req.body };
  const statut = ALLOWED_STATUTS.includes(merged.statut) ? merged.statut : existing.statut;
  const date_paiement = statut === "payee" ? (merged.date_paiement || existing.date_paiement || new Date().toISOString().slice(0, 10)) : (merged.date_paiement ?? existing.date_paiement);
  if (merged.mode_paiement && !ALLOWED_MODES_PAIEMENT.includes(merged.mode_paiement)) return res.status(400).json({ error: "Mode de paiement invalide" });

  await run(`
    UPDATE factures SET objet=?, montant_ht=?, taux_tva=?, statut=?, date_emission=?, date_echeance=?, date_paiement=?, acompte_pourcentage=?, mode_paiement=?, notes=?, updated_at=NOW()
    WHERE id=?
  `, [merged.objet, merged.montant_ht, merged.taux_tva, statut, merged.date_emission, merged.date_echeance, date_paiement,
    merged.acompte_pourcentage, merged.mode_paiement, merged.notes, req.params.id]);

  res.json(withComputed(await get(SELECT_WITH_AFFAIRE + " WHERE f.id = ?", [req.params.id])));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM factures WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

router.get("/:id/pdf", ah(async (req, res) => {
  const facture = await get("SELECT * FROM factures WHERE id = ?", [req.params.id]);
  if (!facture) return res.status(404).json({ error: "Facture introuvable" });
  const affaire = await get("SELECT * FROM affaires WHERE id = ?", [facture.affaire_id]);
  const company = await get("SELECT * FROM company_settings WHERE id = 1");
  const buffer = await generateFacturePdf(facture, affaire, company);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${facture.numero}.pdf"`);
  res.send(buffer);
}));

export default router;
