import bcrypt from "bcryptjs";
import { get, run, initSchema } from "./db.js";

async function main() {
  await initSchema();

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@monentreprise.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMoi123!";

  const existing = await get("SELECT id FROM users WHERE email = ?", [adminEmail]);
  if (existing) {
    console.log(`Un compte existe deja pour ${adminEmail}, seed ignore.`);
    return;
  }

  const hash = bcrypt.hashSync(adminPassword, 10);
  const info = await run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin') RETURNING id",
    ["Administrateur", adminEmail, hash]
  );
  const ownerId = info.lastInsertRowid;

  await run(`INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, reach, engagement, clicks, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
    ["LinkedIn", "Post", "Lancement application digitale industrie 4.0", "publie", "2026-07-10", 1450, 87, 32, ownerId]);
  await run(`INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, reach, engagement, clicks, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
    ["Instagram", "Post", "Coulisses developpement produit", "publie", "2026-07-14", 620, 45, 10, ownerId]);
  await run(`INSERT INTO marketing_actions (channel, type, title, status, scheduled_date, reach, engagement, clicks, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
    ["LinkedIn", "Campagne", "Campagne Lead Gen Forms - salon industrie", "planifie", "2026-08-01", 0, 0, 0, ownerId]);

  const l1 = await run(`INSERT INTO leads (name, company, job_title, source_channel, email, linkedin_url, status, fit_score, intent_score, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`,
    ["Claire Dubois", "Industrie Alpha", "Directrice des operations", "LinkedIn", "claire.dubois@example.com", "https://linkedin.com/in/example1", "qualifie", 40, 35, ownerId]);
  const l2 = await run(`INSERT INTO leads (name, company, job_title, source_channel, email, linkedin_url, status, fit_score, intent_score, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`,
    ["Marc Perrin", "Usine Nova", "Responsable digitalisation", "LinkedIn", "marc.perrin@example.com", "https://linkedin.com/in/example2", "contacte", 30, 20, ownerId]);
  await run(`INSERT INTO leads (name, company, job_title, source_channel, status, fit_score, intent_score, owner_id)
    VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
    ["Sophie Martin", "Groupe Meca", "CTO", "Instagram", "nouveau", 15, 10, ownerId]);

  await run(`INSERT INTO opportunities (lead_id, title, stage, value_estimate, probability, expected_close_date, owner_id)
    VALUES (?,?,?,?,?,?,?) RETURNING id`,
    [l1.lastInsertRowid, "Application maintenance predictive - Industrie Alpha", "negociation", 18000, 60, "2026-08-20", ownerId]);
  await run(`INSERT INTO opportunities (lead_id, title, stage, value_estimate, probability, expected_close_date, owner_id)
    VALUES (?,?,?,?,?,?,?) RETURNING id`,
    [l2.lastInsertRowid, "App suivi de production - Usine Nova", "opportunite", 9500, 40, "2026-09-05", ownerId]);

  console.log("Seed termine.");
  console.log(`Connecte-toi avec : ${adminEmail} / ${adminPassword}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
