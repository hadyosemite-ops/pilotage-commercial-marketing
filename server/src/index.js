import "dotenv/config";
import path from "path";
import fs from "fs";
import express from "express";
import { fileURLToPath } from "url";
import { initSchema } from "./db.js";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await initSchema();

  const app = createApp();

  // Sert le frontend build (client/dist) s'il existe, pour n'avoir qu'un seul
  // processus a lancer en local (npm start). En dev, utiliser `npm run dev` cote client.
  // (Cette partie n'est pas utilisee sur Vercel : le frontend y est servi separement.)
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`API demarree sur http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error("Echec du demarrage :", err);
  process.exit(1);
});
