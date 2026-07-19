// Point d'entree serverless pour Vercel : toute requete /api/* est reecrite
// vers cette fonction (voir vercel.json), qui reutilise l'app Express du dossier
// server/ telle quelle (memes routes qu'en local).
import { createApp } from "../server/src/app.js";
import { initSchema } from "../server/src/db.js";

const app = createApp();

// initSchema() est idempotent (CREATE TABLE IF NOT EXISTS) : on l'attend une
// seule fois par instance "chaude" de la fonction, pas a chaque requete.
let schemaReady = null;

export default async function handler(req, res) {
  if (!schemaReady) schemaReady = initSchema();
  await schemaReady;
  return app(req, res);
}
