import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";
import { Input, Button } from "../components/ui.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Une erreur est survenue. Réessaie plus tard.");
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
          <h1 className="text-2xl font-bold text-white">Mot de passe oublié</h1>
          <p className="text-sm text-slate-400 mt-1">Reçois un lien pour choisir un nouveau mot de passe</p>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6 space-y-4">
          {sent ? (
            <p className="text-sm text-slate-700">
              Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.
              Vérifie ta boîte mail (et les spams) — le lien expire dans 1 heure.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Envoi..." : "Envoyer le lien de réinitialisation"}
              </Button>
            </form>
          )}
          <p className="text-sm text-center">
            <Link to="/login" className="text-accent hover:underline">Retour à la connexion</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
