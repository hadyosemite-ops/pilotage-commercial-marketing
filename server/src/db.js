import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

// Base Postgres hebergee (Supabase). DATABASE_URL doit pointer vers la meme base
// en local et en production (une seule source de verite pour toute l'equipe).
// Supabase fournit cette chaine dans Project Settings > Database > Connection string.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

// Convertit les "?" positionnels (style SQLite) en "$1, $2..." (style Postgres)
// pour garder des requetes lisibles et un seul point de conversion.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function run(sql, args = []) {
  const res = await pool.query(toPgSql(sql), args);
  return { lastInsertRowid: res.rows[0]?.id ?? null, changes: res.rowCount };
}

export async function get(sql, args = []) {
  const res = await pool.query(toPgSql(sql), args);
  return res.rows[0] ?? null;
}

export async function all(sql, args = []) {
  const res = await pool.query(toPgSql(sql), args);
  return res.rows;
}

// Genere un numero sequentiel par annee et par module (ex: DEV-2026-0001).
// Le prefixe/table viennent d'une liste fixe cote code (jamais de l'utilisateur),
// donc l'interpolation directe du nom de table dans le SQL est sans risque.
export async function nextNumero(prefix, table) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = await get(`SELECT numero FROM ${table} WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`, [like]);
  let seq = 1;
  if (row?.numero) {
    const last = parseInt(row.numero.split("-")[2], 10);
    if (Number.isFinite(last)) seq = last + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

// Transaction manuelle (utilisee pour l'import CSV de leads) : un client dedie
// avec BEGIN/COMMIT/ROLLBACK explicites.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn({
      run: async (sql, args = []) => {
        const res = await client.query(toPgSql(sql), args);
        return { lastInsertRowid: res.rows[0]?.id ?? null, changes: res.rowCount };
      },
    });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', -- admin | member
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS marketing_actions (
      id SERIAL PRIMARY KEY,
      channel TEXT NOT NULL,          -- LinkedIn | Instagram | Autre
      type TEXT NOT NULL,             -- Post | Campagne | Message | Article ...
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planifie', -- planifie | publie | archive
      scheduled_date TEXT,
      published_date TEXT,
      reach INTEGER DEFAULT 0,
      engagement INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT,
      job_title TEXT,
      source_channel TEXT NOT NULL DEFAULT 'LinkedIn',
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      status TEXT NOT NULL DEFAULT 'nouveau', -- nouveau | contacte | qualifie | disqualifie
      fit_score INTEGER DEFAULT 0,
      intent_score INTEGER DEFAULT 0,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'opportunite', -- opportunite | negociation | gagne | perdu
      value_estimate REAL DEFAULT 0,
      probability INTEGER DEFAULT 50,
      expected_close_date TEXT,
      lost_reason TEXT,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS action_plan (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      pilote_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action_date TEXT,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'a_faire', -- a_faire | en_cours | fait
      origine_type TEXT NOT NULL DEFAULT 'general', -- lead | opportunite | marketing | general
      origine_id INTEGER, -- id dans leads/opportunities/marketing_actions selon origine_type (pas de FK : cible variable)
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Base clients : identite officielle utilisee pour la facturation (ICE/IF/RC).
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      raison_sociale TEXT NOT NULL,
      adresse TEXT,
      ice TEXT,
      identifiant_fiscal TEXT,
      rc TEXT,
      contact_nom TEXT,
      contact_email TEXT,
      contact_telephone TEXT,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Offres (devis) : peuvent naitre d'une opportunite gagnee, contiennent des lignes,
    -- et donnent naissance a une Affaire une fois acceptees. Les champs client_* sont
    -- une "photo" de l'identite du client au moment du devis (l'edition ulterieure de
    -- la fiche client ne doit pas modifier retroactivement un devis deja emis).
    CREATE TABLE IF NOT EXISTS offres (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
      affaire_id INTEGER,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_raison_sociale TEXT NOT NULL,
      client_adresse TEXT,
      client_ice TEXT,
      client_identifiant_fiscal TEXT,
      client_rc TEXT,
      objet TEXT NOT NULL,
      statut TEXT NOT NULL DEFAULT 'brouillon', -- brouillon | envoye | accepte | refuse | expire
      date_emission TEXT,
      date_validite TEXT,
      taux_tva REAL NOT NULL DEFAULT 20,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS offre_lignes (
      id SERIAL PRIMARY KEY,
      offre_id INTEGER NOT NULL REFERENCES offres(id) ON DELETE CASCADE,
      designation TEXT NOT NULL,
      quantite REAL NOT NULL DEFAULT 1,
      prix_unitaire_ht REAL NOT NULL DEFAULT 0,
      ordre INTEGER NOT NULL DEFAULT 0
    );

    -- Affaires : le projet/contrat en cours de realisation, une fois le devis accepte.
    -- Peut aussi etre creee manuellement (sans offre prealable).
    CREATE TABLE IF NOT EXISTS affaires (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      offre_id INTEGER REFERENCES offres(id) ON DELETE SET NULL,
      opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
      titre TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_raison_sociale TEXT NOT NULL,
      client_adresse TEXT,
      client_ice TEXT,
      client_identifiant_fiscal TEXT,
      client_rc TEXT,
      montant_ht REAL NOT NULL DEFAULT 0,
      taux_tva REAL NOT NULL DEFAULT 20,
      statut TEXT NOT NULL DEFAULT 'en_cours', -- en_cours | terminee | annulee
      date_debut TEXT,
      date_fin_prevue TEXT,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Factures : une affaire peut avoir plusieurs factures (acompte, tranches, solde).
    CREATE TABLE IF NOT EXISTS factures (
      id SERIAL PRIMARY KEY,
      numero TEXT NOT NULL UNIQUE,
      affaire_id INTEGER NOT NULL REFERENCES affaires(id) ON DELETE CASCADE,
      objet TEXT NOT NULL, -- ex: "Acompte 30%", "Solde"
      montant_ht REAL NOT NULL DEFAULT 0,
      taux_tva REAL NOT NULL DEFAULT 20,
      statut TEXT NOT NULL DEFAULT 'brouillon', -- brouillon | envoyee | payee | en_retard | annulee
      date_emission TEXT,
      date_echeance TEXT,
      date_paiement TEXT,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Informations de l'entreprise emettrice (identite officielle sur les devis/factures).
    -- Ligne unique (id = 1) : GET cree la ligne par defaut si elle n'existe pas encore.
    -- Logo/cachet/signature stockes en base64 (data URI) directement en base, pas de
    -- stockage fichier externe a configurer (coherent avec l'architecture "tout Postgres").
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      raison_sociale TEXT NOT NULL DEFAULT 'Smart Industry',
      adresse TEXT,
      ice TEXT,
      identifiant_fiscal TEXT,
      rc TEXT,
      telephone TEXT,
      email TEXT,
      logo_data TEXT,
      cachet_data TEXT,
      signature_data TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT company_settings_singleton CHECK (id = 1)
    );

    -- Migrations douces pour les bases deja creees avant ces ajouts :
    ALTER TABLE action_plan ADD COLUMN IF NOT EXISTS origine_type TEXT NOT NULL DEFAULT 'general';
    ALTER TABLE action_plan ADD COLUMN IF NOT EXISTS origine_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
    ALTER TABLE offres ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
    ALTER TABLE offres ADD COLUMN IF NOT EXISTS client_raison_sociale TEXT;
    ALTER TABLE offres ADD COLUMN IF NOT EXISTS client_adresse TEXT;
    ALTER TABLE offres ADD COLUMN IF NOT EXISTS client_ice TEXT;
    ALTER TABLE offres ADD COLUMN IF NOT EXISTS client_identifiant_fiscal TEXT;
    ALTER TABLE offres ADD COLUMN IF NOT EXISTS client_rc TEXT;
    ALTER TABLE affaires ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
    ALTER TABLE affaires ADD COLUMN IF NOT EXISTS client_raison_sociale TEXT;
    ALTER TABLE affaires ADD COLUMN IF NOT EXISTS client_adresse TEXT;
    ALTER TABLE affaires ADD COLUMN IF NOT EXISTS client_ice TEXT;
    ALTER TABLE affaires ADD COLUMN IF NOT EXISTS client_identifiant_fiscal TEXT;
    ALTER TABLE affaires ADD COLUMN IF NOT EXISTS client_rc TEXT;

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_clients_raison_sociale ON clients(raison_sociale);
    CREATE INDEX IF NOT EXISTS idx_offres_client ON offres(client_id);
    CREATE INDEX IF NOT EXISTS idx_affaires_client ON affaires(client_id);
    CREATE INDEX IF NOT EXISTS idx_opps_stage ON opportunities(stage);
    CREATE INDEX IF NOT EXISTS idx_actions_channel ON marketing_actions(channel);
    CREATE INDEX IF NOT EXISTS idx_action_plan_status ON action_plan(status);
    CREATE INDEX IF NOT EXISTS idx_action_plan_pilote ON action_plan(pilote_id);
    CREATE INDEX IF NOT EXISTS idx_action_plan_origine ON action_plan(origine_type, origine_id);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
    CREATE INDEX IF NOT EXISTS idx_offres_statut ON offres(statut);
    CREATE INDEX IF NOT EXISTS idx_offres_opportunity ON offres(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_offre_lignes_offre ON offre_lignes(offre_id);
    CREATE INDEX IF NOT EXISTS idx_affaires_statut ON affaires(statut);
    CREATE INDEX IF NOT EXISTS idx_affaires_offre ON affaires(offre_id);
    CREATE INDEX IF NOT EXISTS idx_factures_affaire ON factures(affaire_id);
    CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
  `);
}
