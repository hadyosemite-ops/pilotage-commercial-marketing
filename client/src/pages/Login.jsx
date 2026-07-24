import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError("VITE_GOOGLE_CLIENT_ID n'est pas configuré (fichier client/.env).");
      return;
    }

    async function handleCredentialResponse(response) {
      setError("");
      try {
        await googleLogin(response.credential);
        navigate("/");
      } catch (err) {
        setError(err.response?.data?.error || "Connexion impossible");
      }
    }

    function renderButton() {
      if (!window.google?.accounts?.id) {
        // Le script Google Identity Services n'est pas encore chargé, on réessaie.
        setTimeout(renderButton, 200);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "signin_with",
        locale: "fr",
      });
    }

    renderButton();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-wider text-blue-300 uppercase">Pilotage</p>
          <h1 className="text-2xl font-bold text-white">Commercial &amp; Marketing</h1>
          <p className="text-sm text-slate-400 mt-1">Outil interne de suivi leads, opportunités &amp; actions marketing</p>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-6 flex flex-col items-center gap-4">
          <p className="text-sm text-slate-600 text-center">Connecte-toi avec ton compte Google autorisé.</p>
          <div ref={buttonRef} />
          {error && <p className="text-sm text-rose-600 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
