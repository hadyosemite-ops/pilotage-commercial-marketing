import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const EMC_APEX_API_KEY = process.env.EMC_APEX_API_KEY || "";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Identification reactivee (2026-07-25) : l'acces libre a ete une mesure temporaire,
// hussein a demande de reprotoger le lien web (email + mot de passe).
//
// Cle d'acces dediee a EMC APEX (l'app desktop de hussein) : elle n'utilise pas de
// login web, elle envoie un en-tete "X-Apex-Key" avec un secret statique partage
// (EMC_APEX_API_KEY, configure a la fois cote serveur et cote EMC APEX). Le lien web,
// lui, reste protege normalement par mot de passe (voir routes/auth.js /login).
export function requireAuth(req, res, next) {
  const apexKey = req.headers["x-apex-key"];
  if (EMC_APEX_API_KEY && apexKey && apexKey === EMC_APEX_API_KEY) {
    req.user = { id: null, email: "emc-apex@local", name: "EMC APEX", role: "admin" };
    return next();
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Non authentifie" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session invalide, reconnecte-toi" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Reserve aux administrateurs" });
  }
  next();
}
