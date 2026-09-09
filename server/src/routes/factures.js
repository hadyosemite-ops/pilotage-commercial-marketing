import { Router } from "express";
import { get, all, run, withTransaction, nextNumero } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";
import { generateFacturePdf } from "../lib/pdf.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_STATUTS = ["brouillon", "envoyee", "payee", "en_retard", "annulee"];
const ALLOWED_MODES_PAIEMENT = ["virement", "cheque", "especes", "effet"];
const ALLOWED_UNITES = ["forfait", "jh", "jour", "heure"];

// Meme structure que offres.js : la facture a des lignes (designation, unite,
// quantite, prix unitaire) et son montant_ht est calcule a partir d'elles,
// pas saisi directement (parite complete avec le module Offres).
const SELECT_WITH_AFFAIRE = `
  SELECT f.*, a.numero as affaire_numero, a.titre as affaire_titre, a.client_raison_sociale as affaire_client_raison_sociale,
    COALESCE((SELECT SUM(quantite * prix_unitaire_ht) FROM facture_lignes WHERE facture_id = f.id), 0) as montant_ht
  FROM factures f
  LEFT JOIN affaires a ON a.id = f.affaire_id
`;

function withComputed(row) {
  if (!row) return row;
  return { ...row, montant_ttc: Number(row.montant_ht) * (1 + Number(row.taux_tva) / 100) };
}

async function withLignes(facture) {
  if (!facture) return facture;
  const lignes = await all("SELECT * FROM facture_lignes WHERE facture_id = ? ORDER BY ordre ASC, id ASC", [facture.id]);
  const montant_ht = lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0), 0);
  return { ...facture, lignes, montant_ht, montant_ttc: montant_ht * (1 + Number(facture.taux_tva || 0) / 100) };
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

router.get("/:id", ah(async (req, res) => {
  const facture = await get(SELECT_WITH_AFFAIRE + " WHERE f.id = ?", [req.params.id]);
  if (!facture) return res.status(404).json({ error: "Facture introuvable" });
  res.json(await withLignes(facture));
}));

router.post("/", ah(async (req, res) => {
  const { affaire_id, objet, taux_tva, statut, date_emission, date_echeance, acompte_pourcentage, mode_paiement, notes, lignes } = req.body || {};
  if (!affaire_id || !objet) return res.status(400).json({ error: "Affaire et objet requis" });
  if (mode_paiement && !ALLOWED_MODES_PAIEMENT.includes(mode_paiement)) return res.status(400).json({ error: "Mode de paiement invalide" });

  const affaire = await get("SELECT id FROM affaires WHERE id = ?", [affaire_id]);
  if (!affaire) return res.status(400).json({ error: "Affaire introuvable" });

  const numero = await nextNumero("FAC", "factures");
  const result = await withTransaction(async (tx) => {
    const info = await tx.run(`
      INSERT INTO factures (numero, affaire_id, objet, taux_tva, statut, date_emission, date_echeance, acompte_pourcentage, mode_paiement, notes, owner_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id
    `, [numero, affaire_id, objet, taux_tva ?? 20,
      ALLOWED_STATUTS.includes(statut) ? statut : "brouillon", date_emission || null, date_echeance || null,
      acompte_pourcentage || null, mode_paiement || null, notes || null, req.user.id]);

    const factureId = info.lastInsertRowid;
    let ordre = 0;
    for (const l of (lignes || [])) {
      if (!l.designation) continue;
      await tx.run("INSERT INTO facture_lignes (facture_id, designation, unite, quantite, prix_unitaire_ht, ordre) VALUES (?,?,?,?,?,?)",
        [factureId, l.designation, ALLOWED_UNITES.includes(l.unite) ? l.unite : null, l.quantite || 1, l.prix_unitaire_ht || 0, ordre++]);
    }
    return factureId;
  });

  res.status(201).json(await withLignes(await get(SELECT_WITH_AFFAIRE + " WHERE f.id = ?", [result])));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM factures WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Facture introuvable" });

  const { objet, taux_tva, statut, date_emission, date_echeance, date_paiement, acompte_pourcentage, mode_paiement, notes, lignes } = req.body || {};
  if (mode_paiement && !ALLOWED_MODES_PAIEMENT.includes(mode_paiement)) return res.status(400).json({ error: "Mode de paiement invalide" });

  const resolvedStatut = ALLOWED_STATUTS.includes(statut) ? statut : existing.statut;
  const resolvedDatePaiement = resolvedStatut === "payee"
    ? (date_paiement || existing.date_paiement || new Date().toISOString().slice(0, 10))
    : (date_paiement ?? existing.date_paiement);

  await withTransaction(async (tx) => {
    await tx.run(`
      UPDATE factures SET objet=?, taux_tva=?, statut=?, date_emission=?, date_echeance=?, date_paiement=?, acompte_pourcentage=?, mode_paiement=?, notes=?, updated_at=NOW()
      WHERE id=?
    `, [objet ?? existing.objet, taux_tva ?? existing.taux_tva, resolvedStatut,
      date_emission ?? existing.date_emission, date_echeance ?? existing.date_echeance, resolvedDatePaiement,
      acompte_pourcentage ?? existing.acompte_pourcentage, mode_paiement ?? existing.mode_paiement,
      notes ?? existing.notes, req.params.id]);

    if (Array.isArray(lignes)) {
      await tx.run("DELETE FROM facture_lignes WHERE facture_id = ?", [req.params.id]);
      let ordre = 0;
      for (const l of lignes) {
        if (!l.designation) continue;
        await tx.run("INSERT INTO facture_lignes (facture_id, designation, unite, quantite, prix_unitaire_ht, ordre) VALUES (?,?,?,?,?,?)",
          [req.params.id, l.designation, ALLOWED_UNITES.includes(l.unite) ? l.unite : null, l.quantite || 1, l.prix_unitaire_ht || 0, ordre++]);
      }
    }
  });

  res.json(await withLignes(await get(SELECT_WITH_AFFAIRE + " WHERE f.id = ?", [req.params.id])));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM factures WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

router.get("/:id/pdf", ah(async (req, res) => {
  const facture = await withLignes(await get("SELECT * FROM factures WHERE id = ?", [req.params.id]));
  if (!facture) return res.status(404).json({ error: "Facture introuvable" });
  const affaire = await get("SELECT * FROM affaires WHERE id = ?", [facture.affaire_id]);
  const company = await get("SELECT * FROM company_settings WHERE id = 1");
  const buffer = await generateFacturePdf(facture, facture.lignes, affaire, company);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${facture.numero}.pdf"`);
  res.send(buffer);
}));

export default router;
