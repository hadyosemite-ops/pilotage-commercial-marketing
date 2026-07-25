import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Marketing from "./pages/Marketing.jsx";
import Leads from "./pages/Leads.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Team from "./pages/Team.jsx";

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
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
