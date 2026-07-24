import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Identification desactivee temporairement (a la demande de l'utilisateur, qui assume le
// risque d'un acces non restreint). Pour la reactiver, restaurer la verification du token
// ci-dessous (voir historique git) : chaque requete est pour l'instant traitee comme un
// utilisateur admin par defaut, sans verifier de jeton.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      // jeton invalide : on ignore et on continue en mode "acces libre"
    }
  }
  req.user = { id: null, email: "equipe@local", name: "Equipe", role: "admin" };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Reserve aux administrateurs" });
  }
  next();
}
