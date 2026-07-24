# Pilotage Commercial & Marketing

Outil interne pour piloter l'activité commerciale et marketing d'une activité de développement/commercialisation d'applications digitales pour l'industrie : suivi des actions marketing (LinkedIn, Instagram), gestion des leads (avec import manuel/CSV), pipeline d'opportunités, et tableau de bord.

Application web complète : backend Node.js/Express + base Postgres (Supabase), frontend React + Tailwind. Pensée pour une petite équipe (2 à 5 personnes), et hébergement 100% gratuit sur Vercel + Supabase.

> **⚠️ Identification désactivée pour le moment.** L'application est actuellement accessible **sans connexion**, à quiconque a l'URL. C'est un choix temporaire assumé pour simplifier la mise en route — voir la section "Sécurité" plus bas pour la réactiver quand tu seras prêt.

## Prérequis

- Node.js 18 ou supérieur
- Un compte [Supabase](https://supabase.com) (gratuit) — pour la base de données Postgres, avec une vraie persistance des données.
- Un compte [Vercel](https://vercel.com) (gratuit) — pour héberger l'application en ligne, accessible par toute l'équipe.
- Un compte GitHub, pour connecter le dépôt à Vercel.

## 1. Créer la base de données (Supabase)

1. Sur [supabase.com](https://supabase.com), crée un nouveau projet (choisis une région proche, ex. Europe).
2. Une fois le projet créé, va dans **Connect** (bouton en haut du tableau de bord) → onglet **Transaction pooler** (port 6543, recommandé pour un usage serverless comme Vercel).
3. Copie la chaîne de connexion, de la forme :
   `postgres://postgres.xxxx:[MOT_DE_PASSE]@xxxx.pooler.supabase.com:6543/postgres`
4. Remplace `[MOT_DE_PASSE]` par le mot de passe de la base (défini à la création du projet, ou récupérable/réinitialisable dans **Project Settings → Database**).

Cette même chaîne de connexion (`DATABASE_URL`) est utilisée en local et en production — une seule base de données partagée par toute l'équipe.

## 2. Installation locale

```bash
cd server
npm install
cp .env.example .env      # colle ta DATABASE_URL Supabase
npm run seed               # crée le schéma de la base + quelques données d'exemple

cd ../client
npm install
```

L'application s'ouvre directement sur le tableau de bord, sans écran de connexion.

## Importer le plan d'action marketing existant

`server/src/seed_marketing_plan.js` importe les actions du "Plan d'action — Marketing Digital LinkedIn" (HSE365 / Smart Industry, mis à jour le 22/06/2026) dans la table `marketing_actions` : création de la page LinkedIn, les 5 posts de lancement, le jalon des 150 abonnés, le guide PDF, la campagne Ads, la config CRM, le webinaire, etc. Le script est **idempotent** (relancer ne crée pas de doublons, identifiés par titre).

```bash
cd server
node src/seed_marketing_plan.js
```

Le statut de chaque action reflète fidèlement le plan source : `publie` pour ce qui était coché "Fait", `planifie` pour le reste (Ads, CRM, contenus à venir) — même si certaines dates sont aujourd'hui dans le passé, car le plan ne confirmait pas leur exécution réelle. Les dates du "Mois 1 — Juillet 2026" sont indicatives (le plan source ne donnait pas de jour précis), signalé dans les notes de chaque action.

Les 3 actions et 3 leads d'exemple créés par `npm run seed` restent en base à titre de démo — libre à toi de les supprimer depuis l'interface une fois le plan réel importé.

## 3. Lancer en développement local

Deux terminaux :

```bash
# Terminal 1
cd server
npm run dev          # API sur http://localhost:4000

# Terminal 2
cd client
npm run dev          # interface sur http://localhost:5173 (proxy vers l'API)
```

Ouvre http://localhost:5173.

## 4. Déployer en ligne (Vercel + Supabase) — gratuit

Cette structure de projet est prête pour Vercel : `vercel.json` à la racine construit le frontend (`client/dist`) et route `/api/*` vers `api/index.js`, une fonction serverless qui réutilise l'app Express de `server/` telle quelle.

1. **Pousse le projet sur GitHub** (nouveau dépôt, `git init` puis `git add . && git commit -m "Initial commit"` et push vers un dépôt créé sur github.com).
2. Sur [vercel.com](https://vercel.com), **New Project** → importe ce dépôt GitHub.
3. Dans **Environment Variables**, ajoute (Production, et Preview si tu veux tester des branches) :
   - `DATABASE_URL` → la chaîne de connexion Supabase (identique à celle de `server/.env`)
   - `JWT_SECRET` → une chaîne longue et aléatoire (garde la même qu'en local pour éviter de déconnecter tout le monde à chaque déploiement)
4. Clique **Deploy**. Vercel construit le frontend et déploie la fonction API automatiquement.

Chaque membre de l'équipe accède ensuite directement à l'URL fournie par Vercel (ex. `https://ton-projet.vercel.app`), sans connexion.

## Sécurité — réactiver une identification

L'identification a été désactivée à la demande, pour aller plus vite (voir avertissement en haut de ce document). Concrètement : `server/src/middleware/auth.js` ne vérifie plus le jeton et traite toutes les requêtes comme un utilisateur admin par défaut ; côté frontend, `App.jsx` ne redirige plus vers un écran de connexion.

Tant que c'est le cas, **n'importe qui avec le lien peut voir et modifier toutes les données** (leads, opportunités, etc.). Tant que l'usage reste interne et le lien non partagé publiquement, le risque est limité, mais à réactiver avant toute diffusion plus large. Options possibles plus tard : remettre en place la vérification du jeton dans `auth.js` (restaurer depuis l'historique git), ou repartir sur un système plus simple type code d'accès partagé.

## Import de leads (CSV)

Page **Leads → Importer CSV**. Colonnes reconnues (voir `exemple_import_leads.csv` à la racine) :

`name, company, job_title, source_channel, email, phone, linkedin_url, notes`

Seule la colonne `name` est obligatoire. Usage typique : exporter tes contacts depuis LinkedIn Sales Navigator, remettre les colonnes dans cet ordre/nom, puis importer.

## À propos de la connexion LinkedIn

Cette v1 volontairement **n'automatise pas** l'extraction de profils LinkedIn : le scraping et les extensions d'automatisation (type Waalaxy, Expandi, PhantomBuster) violent les conditions d'utilisation de LinkedIn et exposent le compte à une restriction ou un bannissement. L'app fonctionne donc avec :
- l'import manuel/CSV depuis Sales Navigator (décrit ci-dessus) ;
- une évolution possible plus tard vers l'API officielle LinkedIn Lead Gen Forms, si tu fais de la publicité LinkedIn (nécessite un compte LinkedIn Ads, une validation d'entreprise et un délai d'approbation).

## Structure du projet

```
crm-tool/
  vercel.json             config de déploiement Vercel (build frontend + routage API)
  package.json            dépendances de la fonction serverless api/index.js
  api/
    index.js              point d'entrée serverless Vercel (réutilise server/src/app.js)
  server/                 API Node.js/Express + Postgres (Supabase)
    src/
      app.js               construction de l'app Express (routes, sans écoute de port)
      index.js             lancement local (npm start / npm run dev) : app.js + fichiers statiques
      db.js                connexion Postgres + schéma (users, marketing_actions, leads, opportunities)
      routes/              auth, marketing-actions, leads, opportunities, dashboard
      seed.js               crée le schéma + le premier admin + données d'exemple
      seed_marketing_plan.js  importe le plan d'action marketing réel
    .env.example
  client/                 Frontend React + Vite + Tailwind
    src/
      pages/               Dashboard, Marketing, Leads, Pipeline, Team
      components/          Layout (navigation), composants UI réutilisables
  exemple_import_leads.csv
```

## Modèle de données résumé

- **Leads** : statuts `nouveau → contacté → qualifié` (ou `disqualifié`), avec un score fit (adéquation profil/entreprise) et un score intérêt (intensité d'engagement), sur 0 à 50 chacun.
- **Opportunités** : créées par conversion d'un lead qualifié (ou manuellement), statuts `opportunité → négociation → gagné/perdu`, avec valeur estimée et probabilité.
- **Actions marketing** : publications/campagnes par canal (LinkedIn, Instagram, Autre), avec portée, engagement et clics.

## Prochaines évolutions possibles

- Intégration API officielle LinkedIn Lead Gen Forms (si budget pub LinkedIn).
- Lead scoring semi-automatique (règles pondérées sur les champs existants).
- Notifications/rappels de relance pour les leads sans activité récente.
- Export CSV du pipeline pour reporting externe.
