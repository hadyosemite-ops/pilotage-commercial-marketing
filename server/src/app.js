import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import marketingActionsRoutes from "./routes/marketingActions.js";
import leadsRoutes from "./routes/leads.js";
import opportunitiesRoutes from "./routes/opportunities.js";
import dashboardRoutes from "./routes/dashboard.js";

// Construit l'app Express (routes API uniquement, pas de fichiers statiques,
// pas d'ecoute de port) : reutilisable telle quelle en local (index.js) et
// en fonction serverless Vercel (api/index.js a la racine du projet).
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/marketing-actions", marketingActionsRoutes);
  app.use("/api/leads", leadsRoutes);
  app.use("/api/opportunities", opportunitiesRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  });

  return app;
}
