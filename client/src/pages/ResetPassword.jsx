import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../api.js";
import { Input, Button } from "../components/ui.jsx";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Impossible de réinitialiser le mot de passe");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Smart Industry" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
          <p className="text-xs font-semibold tracking-wider text-mint uppercase">Smart Industry</p>
          <h1 className="text-2xl font-bold text-white">Nouveau mot de passe</h1>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6 space-y-4">
          {!token ? (
            <p className="text-sm text-rose-600">
              Lien invalide ou incomplet. <Link to="/forgot-password" className="text-accent hover:underline">Refaire une demande</Link>
            </p>
          ) : done ? (
            <p className="text-sm text-emerald-700">Mot de passe mis à jour. Redirection vers la connexion...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Nouveau mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
              <Input label="Confirmer le mot de passe" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enregistrement..." : "Réinitialiser le mot de passe"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
