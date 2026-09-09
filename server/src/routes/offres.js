import { Router } from "express";
import { get, all, run, withTransaction, nextNumero } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";
import { generateOffrePdf } from "../lib/pdf.js";

const router = Router();
router.use(requireAuth);

const ALLOWED_STATUTS = ["brouillon", "envoye", "accepte", "refuse", "expire"];

async function withLignes(offre) {
  if (!offre) return offre;
  const lignes = await all("SELECT * FROM offre_lignes WHERE offre_id = ? ORDER BY ordre ASC, id ASC", [offre.id]);
  const montant_ht = lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0), 0);
  return { ...offre, lignes, montant_ht, montant_ttc: montant_ht * (1 + Number(offre.taux_tva || 0) / 100) };
}

router.get("/", ah(async (req, res) => {
  const { statut } = req.query;
  let sql = `
    SELECT of.*, o.title as opportunity_title,
      COALESCE((SELECT SUM(quantite * prix_unitaire_ht) FROM offre_lignes WHERE offre_id = of.id), 0) as montant_ht
    FROM offres of
    LEFT JOIN opportunities o ON o.id = of.opportunity_id
    WHERE 1=1`;
  const params = [];
  if (statut) { sql += " AND of.statut = ?"; params.push(statut); }
  sql += " ORDER BY of.created_at DESC";
  const rows = await all(sql, params);
  res.json(rows.map((r) => ({ ...r, montant_ttc: Number(r.montant_ht) * (1 + Number(r.taux_tva) / 100) })));
}));

router.get("/:id", ah(async (req, res) => {
  const offre = await get("SELECT * FROM offres WHERE id = ?", [req.params.id]);
  if (!offre) return res.status(404).json({ error: "Offre introuvable" });
  res.json(await withLignes(offre));
}));

router.post("/", ah(async (req, res) => {
  const { opportunity_id, client_id, objet, statut, date_emission, date_validite, taux_tva, notes, lignes } = req.body || {};
  if (!client_id || !objet) return res.status(400).json({ error: "Client et objet requis" });

  const client = await get("SELECT * FROM clients WHERE id = ?", [client_id]);
  if (!client) return res.status(400).json({ error: "Client introuvable" });

  const numero = await nextNumero("DEV", "offres");
  const result = await withTransaction(async (tx) => {
    const info = await tx.run(`
      INSERT INTO offres (numero, opportunity_id, client_id, client_raison_sociale, client_adresse, client_ice, client_identifiant_fiscal, client_rc,
        objet, statut, date_emission, date_validite, taux_tva, notes, owner_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
    `, [numero, opportunity_id || null, client.id, client.raison_sociale, client.adresse, client.ice, client.identifiant_fiscal, client.rc,
      objet, ALLOWED_STATUTS.includes(statut) ? statut : "brouillon",
      date_emission || null, date_validite || null, taux_tva ?? 20, notes || null, req.user.id]);

    const offreId = info.lastInsertRowid;
    let ordre = 0;
    for (const l of (lignes || [])) {
      if (!l.designation) continue;
      await tx.run("INSERT INTO offre_lignes (offre_id, designation, quantite, prix_unitaire_ht, ordre) VALUES (?,?,?,?,?)",
        [offreId, l.designation, l.quantite || 1, l.prix_unitaire_ht || 0, ordre++]);
    }
    return offreId;
  });

  res.status(201).json(await withLignes(await get("SELECT * FROM offres WHERE id = ?", [result])));
}));

router.put("/:id", ah(async (req, res) => {
  const existing = await get("SELECT * FROM offres WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Offre introuvable" });

  const { opportunity_id, client_id, objet, statut, date_emission, date_validite, taux_tva, notes, lignes } = req.body || {};

  let clientSnapshot = {
    client_id: existing.client_id, client_raison_sociale: existing.client_raison_sociale,
    client_adresse: existing.client_adresse, client_ice: existing.client_ice,
    client_identifiant_fiscal: existing.client_identifiant_fiscal, client_rc: existing.client_rc,
  };
  if (client_id && String(client_id) !== String(existing.client_id)) {
    const client = await get("SELECT * FROM clients WHERE id = ?", [client_id]);
    if (!client) return res.status(400).json({ error: "Client introuvable" });
    clientSnapshot = {
      client_id: client.id, client_raison_sociale: client.raison_sociale, client_adresse: client.adresse,
      client_ice: client.ice, client_identifiant_fiscal: client.identifiant_fiscal, client_rc: client.rc,
    };
  }

  await withTransaction(async (tx) => {
    await tx.run(`
      UPDATE offres SET opportunity_id=?, client_id=?, client_raison_sociale=?, client_adresse=?, client_ice=?, client_identifiant_fiscal=?, client_rc=?,
        objet=?, statut=?, date_emission=?, date_validite=?, taux_tva=?, notes=?, updated_at=NOW() WHERE id=?
    `, [opportunity_id ?? existing.opportunity_id, clientSnapshot.client_id, clientSnapshot.client_raison_sociale,
      clientSnapshot.client_adresse, clientSnapshot.client_ice, clientSnapshot.client_identifiant_fiscal, clientSnapshot.client_rc,
      objet ?? existing.objet, ALLOWED_STATUTS.includes(statut) ? statut : existing.statut,
      date_emission ?? existing.date_emission, date_validite ?? existing.date_validite,
      taux_tva ?? existing.taux_tva, notes ?? existing.notes, req.params.id]);

    if (Array.isArray(lignes)) {
      await tx.run("DELETE FROM offre_lignes WHERE offre_id = ?", [req.params.id]);
      let ordre = 0;
      for (const l of lignes) {
        if (!l.designation) continue;
        await tx.run("INSERT INTO offre_lignes (offre_id, designation, quantite, prix_unitaire_ht, ordre) VALUES (?,?,?,?,?)",
          [req.params.id, l.designation, l.quantite || 1, l.prix_unitaire_ht || 0, ordre++]);
      }
    }
  });

  res.json(await withLignes(await get("SELECT * FROM offres WHERE id = ?", [req.params.id])));
}));

router.delete("/:id", ah(async (req, res) => {
  await run("DELETE FROM offres WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

// Accepter une offre : cree l'Affaire correspondante (une seule fois) et bascule l'offre en "accepte".
router.post("/:id/accepter", ah(async (req, res) => {
  const offre = await withLignes(await get("SELECT * FROM offres WHERE id = ?", [req.params.id]));
  if (!offre) return res.status(404).json({ error: "Offre introuvable" });
  if (offre.affaire_id) return res.status(400).json({ error: "Cette offre a déjà une affaire liée" });

  const numero = await nextNumero("AFF", "affaires");
  const affaireId = await withTransaction(async (tx) => {
    const info = await tx.run(`
      INSERT INTO affaires (numero, offre_id, opportunity_id, titre, client_id, client_raison_sociale, client_adresse, client_ice, client_identifiant_fiscal, client_rc,
        montant_ht, taux_tva, statut, owner_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
    `, [numero, offre.id, offre.opportunity_id, offre.objet, offre.client_id, offre.client_raison_sociale, offre.client_adresse,
      offre.client_ice, offre.client_identifiant_fiscal, offre.client_rc, offre.montant_ht, offre.taux_tva, "en_cours", req.user.id]);
    await tx.run("UPDATE offres SET statut='accepte', affaire_id=?, updated_at=NOW() WHERE id=?", [info.lastInsertRowid, offre.id]);
    return info.lastInsertRowid;
  });

  res.status(201).json(await get("SELECT * FROM affaires WHERE id = ?", [affaireId]));
}));

router.get("/:id/pdf", ah(async (req, res) => {
  const offre = await withLignes(await get("SELECT * FROM offres WHERE id = ?", [req.params.id]));
  if (!offre) return res.status(404).json({ error: "Offre introuvable" });
  const buffer = await generateOffrePdf(offre, offre.lignes);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${offre.numero}.pdf"`);
  res.send(buffer);
}));

export default router;
