import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Marketing from "./pages/Marketing.jsx";
import Leads from "./pages/Leads.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Team from "./pages/Team.jsx";

// Identification desactivee temporairement (acces libre a l'app, sans connexion).
// Pour la reactiver plus tard : voir server/src/middleware/auth.js et l'historique git
// de ce fichier pour restaurer la redirection vers /login.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="leads" element={<Leads />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="equipe" element={<Team />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
