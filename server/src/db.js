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

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_opps_stage ON opportunities(stage);
    CREATE INDEX IF NOT EXISTS idx_actions_channel ON marketing_actions(channel);
  `);
}
