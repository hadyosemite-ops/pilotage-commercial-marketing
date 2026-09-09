import { Router } from "express";
import { get, all, run, nextNumero } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_STATUTS = ["en_cours", "terminee", "annulee"];

// f.montant_ht n'est plus alimente directement (les factures ont des lignes,
// comme les offres) : le montant de chaque facture se calcule desormais a
// partir de facture_lignes, pas de la colonne factures.montant_ht.
const SELECT_WITH_TOTALS = `
  SELECT a.*,
    COALESCE((
      SELECT SUM(
        COALESCE((SELECT SUM(fl.quantite * fl.prix_unitaire_ht) FROM facture_lignes fl WHERE fl.facture_id = f.id), 0) * (1 + f.taux_tva / 100.0)
      )
      FROM factures f WHERE f.affaire_id = a.id AND f.statut != 'annulee'
    ), 0) as montant_facture
  FROM affaires a
`;

function withComputed(row) {
  if (!row) return row;
  const montant_ttc = Number(row.montant_ht) * (1 + Number(row.taux_tva) / 100);
  const montant_facture = Number(row.montant_facture) || 0;
  return { ...row, montant_ttc, montant_facture, montant_restant: Math.max(0, montant_ttc - montant_facture) };
}

router.get("/", ah(async (req, res) => {
  const { statut } = req.query;
  let sql = SELECT_WITH_TOTALS + " WHERE 1=1";
  const params = [];
  if (statut) { sql += " AND a.statut = ?"; params.push(statut); }
  sql += " ORDER BY a.created_at DESC";
  res.json((await all(sql, params)).map(withComputed));
}));

router.get("/:id", ah(async (req, res) => {
  const row = await get(SELECT_WITH_TOTALS + " WHERE a.id = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Affaire introuvable" });
  res.json(withComputed(row));
}));

router.post("/", ah(async (req, res) => {
  const { opportunity_id, titre, client_id, montant_ht, taux_tva, statut, date_debut, date_fin_prevue, notes } = req.body || {};
  if (!titre || !client_id) return res.status(400).json({ error: "Titre et client requis" });

  const client = await get("SELECT * FROM clients WHERE id = ?", [client_id]);
  if (!client) return res.status(400).json({ error: "Client introuvable" });

  const numero = await nextNumero("AFF", "affaires");
  const info = await run(`
    INSERT INTO affaires (numero, opportunity_id, titre, client_id, client_raison_sociale, client_adresse, client_ice, client_identifiant_fiscal, client_rc,
      montant_ht, taux_tva, statut, date_debut, date_fin_prevue, notes, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
  `, [numero, opportunity_id || null, titre, client.id, client.raison_sociale, client.adresse, client.ice, client.identifiant_fiscal, client.rc,
    montant_ht || 0, taux_tva ?? 20, ALLOWED_STATUTS.includes(statut) ? statut : "en_cours",
    date_debut || null, date_fin_prevue || null, notes || null, req.user.id]);

  res.status(201).json(withComputed(await get(SELECT_WITH_TOTALS + " WHERE a.id = ?", [info.lastInsertRowid])));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM affaires WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Affaire introuvable" });

  const merged = { ...existing, ...req.body };

  let clientSnapshot = {
    client_id: existing.client_id, client_raison_sociale: existing.client_raison_sociale,
    client_adresse: existing.client_adresse, client_ice: existing.client_ice,
    client_identifiant_fiscal: existing.client_identifiant_fiscal, client_rc: existing.client_rc,
  };
  if (req.body?.client_id && String(req.body.client_id) !== String(existing.client_id)) {
    const client = await get("SELECT * FROM clients WHERE id = ?", [req.body.client_id]);
    if (!client) return res.status(400).json({ error: "Client introuvable" });
    clientSnapshot = {
      client_id: client.id, client_raison_sociale: client.raison_sociale, client_adresse: client.adresse,
      client_ice: client.ice, client_identifiant_fiscal: client.identifiant_fiscal, client_rc: client.rc,
    };
  }

  await run(`
    UPDATE affaires SET titre=?, client_id=?, client_raison_sociale=?, client_adresse=?, client_ice=?, client_identifiant_fiscal=?, client_rc=?,
      montant_ht=?, taux_tva=?, statut=?, date_debut=?, date_fin_prevue=?, notes=?, updated_at=NOW() WHERE id=?
  `, [merged.titre, clientSnapshot.client_id, clientSnapshot.client_raison_sociale, clientSnapshot.client_adresse,
    clientSnapshot.client_ice, clientSnapshot.client_identifiant_fiscal, clientSnapshot.client_rc,
    merged.montant_ht, merged.taux_tva, ALLOWED_STATUTS.includes(merged.statut) ? merged.statut : existing.statut,
    merged.date_debut, merged.date_fin_prevue, merged.notes, req.params.id]);

  res.json(withComputed(await get(SELECT_WITH_TOTALS + " WHERE a.id = ?", [req.params.id])));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM affaires WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

export default router;
