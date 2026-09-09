import { Router } from "express";
import { get, all } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get("/summary", ah(async (req, res) => {
  const leadsTotal = (await get("SELECT COUNT(*) c FROM leads")).c;
  const leadsByStatus = await all("SELECT status, COUNT(*) c FROM leads GROUP BY status");
  const leadsByChannel = await all("SELECT source_channel, COUNT(*) c FROM leads GROUP BY source_channel");

  const oppsOpenPipeline = await get(
    "SELECT COALESCE(SUM(value_estimate),0) v, COUNT(*) c FROM opportunities WHERE stage IN ('opportunite','negociation')"
  );
  const oppsWon = await get(
    "SELECT COALESCE(SUM(value_estimate),0) v, COUNT(*) c FROM opportunities WHERE stage = 'gagne'"
  );
  const oppsLost = await get(
    "SELECT COALESCE(SUM(value_estimate),0) v, COUNT(*) c FROM opportunities WHERE stage = 'perdu'"
  );
  const oppsByStage = await all(
    "SELECT stage, COUNT(*) c, COALESCE(SUM(value_estimate),0) v FROM opportunities GROUP BY stage"
  );

  const qualified = leadsByStatus.find(s => s.status === "qualifie")?.c || 0;
  const conversionRate = leadsTotal > 0 ? Math.round((qualified / leadsTotal) * 1000) / 10 : 0;

  const closedTotal = (oppsWon.c || 0) + (oppsLost.c || 0);
  const winRate = closedTotal > 0 ? Math.round(((oppsWon.c || 0) / closedTotal) * 1000) / 10 : 0;

  const actionsByChannel = await all(
    "SELECT channel, COUNT(*) c, COALESCE(SUM(reach),0) reach, COALESCE(SUM(engagement),0) engagement, COALESCE(SUM(clicks),0) clicks FROM marketing_actions GROUP BY channel"
  );
  const actionsRecent = await all(
    "SELECT * FROM marketing_actions ORDER BY COALESCE(scheduled_date::timestamptz, created_at) DESC LIMIT 5"
  );

  const leadsLast30 = await all(
    "SELECT DATE(created_at) d, COUNT(*) c FROM leads WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY d"
  );

  // Offres / Affaires / Facturation : montants HT convertis en TTC en SQL (taux_tva stocke par ligne).
  const offresEnAttente = await get(
    "SELECT COUNT(*) c, COALESCE(SUM((SELECT COALESCE(SUM(quantite * prix_unitaire_ht),0) FROM offre_lignes WHERE offre_lignes.offre_id = offres.id) * (1 + taux_tva / 100.0)),0) v FROM offres WHERE statut = 'envoye'"
  );
  const affairesEnCours = await get(
    "SELECT COUNT(*) c, COALESCE(SUM(montant_ht * (1 + taux_tva / 100.0)),0) v FROM affaires WHERE statut = 'en_cours'"
  );
  const caFacture = await get(
    "SELECT COALESCE(SUM(montant_ht * (1 + taux_tva / 100.0)),0) v FROM factures WHERE statut = 'payee'"
  );
  const facturesEnRetard = await get(
    "SELECT COUNT(*) c, COALESCE(SUM(montant_ht * (1 + taux_tva / 100.0)),0) v FROM factures WHERE statut IN ('envoyee','en_retard') AND date_echeance IS NOT NULL AND date_echeance < TO_CHAR(NOW(), 'YYYY-MM-DD')"
  );

  res.json({
    leadsTotal,
    leadsByStatus,
    leadsByChannel,
    conversionRate,
    winRate,
    pipeline: { open: oppsOpenPipeline, won: oppsWon, lost: oppsLost, byStage: oppsByStage },
    actionsByChannel,
    actionsRecent,
    leadsLast30,
    ventes: { offresEnAttente, affairesEnCours, caFacture, facturesEnRetard },
  });
}));

export default router;
