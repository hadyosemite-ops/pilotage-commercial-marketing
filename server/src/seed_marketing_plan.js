// Importe les actions du "Plan d'action - Marketing Digital LinkedIn" (HSE365 / Smart Industry,
// mis a jour le 22 juin 2026) dans la table marketing_actions.
// Idempotent : une action deja presente (meme titre) n'est pas recreee, donc ce script
// peut etre relance sans creer de doublons.
import { get, run, initSchema } from "./db.js";

const actions = [
  // --- Fait (phase organique S1-S2, confirme termine dans le plan) ---
  {
    channel: "LinkedIn", type: "Page", title: "Page LinkedIn Smart Industry créée et configurée",
    status: "publie", scheduled_date: "2026-06-10", published_date: "2026-06-10",
    notes: "Logo, bannière, tagline, overview, 20 tags spécialités — tout finalisé.",
  },
  {
    channel: "LinkedIn", type: "Post", title: "Post de lancement — Douleur HSE manager",
    status: "publie", scheduled_date: "2026-06-12", published_date: "2026-06-12",
    reach: 79, engagement: 5, notes: "Série des 5 posts de lancement (12–18 juin 2026).",
  },
  {
    channel: "LinkedIn", type: "Post", title: "Post de lancement — Loi 27-23",
    status: "publie", scheduled_date: "2026-06-14", published_date: "2026-06-14",
    reach: 79, engagement: 5, notes: "Série des 5 posts de lancement (12–18 juin 2026).",
  },
  {
    channel: "LinkedIn", type: "Post", title: "Post de lancement — Inspections papier vs digital",
    status: "publie", scheduled_date: "2026-06-15", published_date: "2026-06-15",
    reach: 79, engagement: 5, notes: "Série des 5 posts de lancement (12–18 juin 2026).",
  },
  {
    channel: "LinkedIn", type: "Post", title: "Post de lancement — ISO 45001",
    status: "publie", scheduled_date: "2026-06-17", published_date: "2026-06-17",
    reach: 79, engagement: 5, notes: "Série des 5 posts de lancement (12–18 juin 2026).",
  },
  {
    channel: "LinkedIn", type: "Post", title: "Post de lancement — Mise à jour de la page",
    status: "publie", scheduled_date: "2026-06-18", published_date: "2026-06-18",
    reach: 79, engagement: 5, notes: "Série des 5 posts de lancement (12–18 juin 2026).",
  },
  {
    channel: "LinkedIn", type: "Jalon", title: "150 abonnés LinkedIn atteints — objectif S1-S2 dépassé",
    status: "publie", scheduled_date: "2026-06-18", published_date: "2026-06-18",
    reach: 150, notes: "Objectif initial : 50–100 abonnés avant lancement Ads. Taux d'engagement moyen mesuré : 6 %.",
  },
  {
    channel: "LinkedIn", type: "Asset", title: 'Guide PDF "La Digitalisation du Métier HSE" finalisé',
    status: "publie", scheduled_date: "2026-06-19", published_date: "2026-06-19",
    notes: "6 pages. Encadré Maroc (Loi 27-23, CNSS). Page CTA HSE365 ajoutée.",
  },
  {
    channel: "LinkedIn", type: "Post", title: 'Post LinkedIn "DSI + Guide" avec guide PDF joint',
    status: "publie", scheduled_date: "2026-06-22", published_date: "2026-06-22",
    notes: "Rédigé et validé en amont (angle gap EHS/DSI, stats EY) ; publié dimanche 22 juin entre 18h et 20h, guide en document natif LinkedIn + hashtags.",
  },

  // --- Cette semaine du plan (23-27 juin 2026) — pending dans le plan source ---
  {
    channel: "LinkedIn", type: "Campagne", title: "Lancer LinkedIn Ads — Vertical HSE",
    status: "planifie", scheduled_date: "2026-06-23",
    notes: "Booster le post du guide. Audience : QHSE Manager, DRH, DSI · Industrie/BTP/Mines · Maroc. Budget 1 500–2 000 MAD/mois, CPL cible < 200 MAD.",
  },
  {
    channel: "Autre", type: "Outil", title: "Configurer un CRM simple",
    status: "planifie", scheduled_date: "2026-06-24",
    notes: "HubSpot Free ou Pipedrive. Pipeline : Lead → Démo planifiée → Proposition → Projet signé.",
  },
  {
    channel: "LinkedIn", type: "Message", title: "Répondre aux commentaires / DMs sur le post du guide",
    status: "planifie", scheduled_date: "2026-06-24",
    notes: "Qualifier chaque contact, saisir dans le CRM, proposer une démo de 30 min.",
  },
  {
    channel: "LinkedIn", type: "Post", title: "2e post de la semaine — ROI / cas client chiffré",
    status: "planifie", scheduled_date: "2026-06-25",
    notes: "Angle : \"Un accident grave coûte 4-8x le salaire annuel\" → solution HSE365.",
  },

  // --- Mois 1 - Juillet 2026 — dates indicatives (non precisees dans le plan source) ---
  {
    channel: "LinkedIn", type: "Contenu vidéo", title: "Vidéo démo d'un module (60–90s, LinkedIn native)",
    status: "planifie", scheduled_date: "2026-07-07",
    notes: "Module Incidents ou Inspections. Enregistrement écran + voix, format vertical ou 16:9. Date indicative (période : juillet 2026).",
  },
  {
    channel: "LinkedIn", type: "Campagne", title: "Activer Ads vertical Smart Logistique",
    status: "planifie", scheduled_date: "2026-07-03",
    notes: "Budget 3 000–4 500 MAD/mois. Audience : Directeurs Logistique, Supply Chain, Maroc. Date indicative (période : juillet 2026).",
  },
  {
    channel: "Autre", type: "Séquence email", title: "Mettre en place la séquence email post-guide",
    status: "planifie", scheduled_date: "2026-07-05",
    notes: "J+0 bienvenue · J+3 checklist DSI · J+7 démo vidéo · J+12 cas client ROI · J+18 webinaire · J+25 offre Starter. Date indicative (période : juillet 2026).",
  },
  {
    channel: "LinkedIn", type: "Webinaire", title: "1er webinaire démo live — HSE sur Microsoft 365",
    status: "planifie", scheduled_date: "2026-07-14",
    notes: "45 min, DSI + HSE présents. Annoncer via LinkedIn + email. Viser 10-15 inscrits. Date indicative (période : juillet 2026).",
  },
  {
    channel: "Autre", type: "Partenariat", title: "Contacter 2-3 partenaires Microsoft Maroc",
    status: "planifie", scheduled_date: "2026-07-10",
    notes: "Intégrateurs Gold/Silver Power Platform. Proposer un accord de distribution / co-vente. Date indicative (période : juillet 2026).",
  },
];

async function main() {
  await initSchema();

  let created = 0, skipped = 0;
  for (const a of actions) {
    const exists = await get("SELECT id FROM marketing_actions WHERE title = ?", [a.title]);
    if (exists) { skipped++; continue; }
    await run(`
      INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, published_date, reach, engagement, clicks, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id
    `, [
      a.channel, a.type, a.title, a.status,
      a.scheduled_date || null, a.published_date || null,
      a.reach || 0, a.engagement || 0, a.clicks || 0,
      a.notes || null,
    ]);
    created++;
  }

  console.log(`Import du plan d'action marketing termine : ${created} action(s) créée(s), ${skipped} déjà présente(s) (ignorée(s)).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
