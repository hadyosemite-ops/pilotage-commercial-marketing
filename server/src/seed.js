// Initialise le schema de la base et quelques donnees d'exemple.
// Les comptes utilisateurs ne sont plus crees ici : ils se creent automatiquement
// a la premiere connexion Google (voir routes/auth.js), pour l'email autorise
// dans ALLOWED_EMAILS.
import { get, run, initSchema } from "./db.js";

async function main() {
  await initSchema();

  const already = await get("SELECT id FROM marketing_actions LIMIT 1");
  if (already) {
    console.log("Des donnees existent deja, seed de demo ignore.");
    return;
  }

  await run(`INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, reach, engagement, clicks)
    VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
    ["LinkedIn", "Post", "Lancement application digitale industrie 4.0", "publie", "2026-07-10", 1450, 87, 32]);
  await run(`INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, reach, engagement, clicks)
    VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
    ["Instagram", "Post", "Coulisses developpement produit", "publie", "2026-07-14", 620, 45, 10]);
  await run(`INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, reach, engagement, clicks)
    VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
    ["LinkedIn", "Campagne", "Campagne Lead Gen Forms - salon industrie", "planifie", "2026-08-01", 0, 0, 0]);

  const l1 = await run(`INSERT INTO leads (name, company, job_title, source_channel, email, linkedin_url, status, fit_score, intent_score)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
    ["Claire Dubois", "Industrie Alpha", "Directrice des operations", "LinkedIn", "claire.dubois@example.com", "https://linkedin.com/in/example1", "qualifie", 40, 35]);
  const l2 = await run(`INSERT INTO leads (name, company, job_title, source_channel, email, linkedin_url, status, fit_score, intent_score)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
    ["Marc Perrin", "Usine Nova", "Responsable digitalisation", "LinkedIn", "marc.perrin@example.com", "https://linkedin.com/in/example2", "contacte", 30, 20]);
  await run(`INSERT INTO leads (name, company, job_title, source_channel, status, fit_score, intent_score)
    VALUES (?,?,?,?,?,?,?) RETURNING id`,
    ["Sophie Martin", "Groupe Meca", "CTO", "Instagram", "nouveau", 15, 10]);

  await run(`INSERT INTO opportunities (lead_id, title, stage, value_estimate, probability, expected_close_date)
    VALUES (?,?,?,?,?,?) RETURNING id`,
    [l1.lastInsertRowid, "Application maintenance predictive - Industrie Alpha", "negociation", 18000, 60, "2026-08-20"]);
  await run(`INSERT INTO opportunities (lead_id, title, stage, value_estimate, probability, expected_close_date)
    VALUES (?,?,?,?,?,?) RETURNING id`,
    [l2.lastInsertRowid, "App suivi de production - Usine Nova", "opportunite", 9500, 40, "2026-09-05"]);

  console.log("Schema initialise + donnees de demo creees.");
  console.log("Connecte-toi avec le bouton Google, en utilisant un email present dans ALLOWED_EMAILS.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
