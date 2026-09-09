import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Megaphone, Users, GitBranch, ListChecks, LogOut, Settings2,
  FileText, Briefcase, Receipt,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// La sidebar est organisee en sections pour rester lisible avec les modules
// Offres / Affaires / Facturation en plus de la prospection.
const navSections = [
  {
    label: "Pilotage",
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
      { to: "/plan-action", label: "Plan d'action", icon: ListChecks },
    ],
  },
  {
    label: "Prospection",
    items: [
      { to: "/marketing", label: "Marketing", icon: Megaphone },
      { to: "/leads", label: "Leads", icon: Users },
      { to: "/pipeline", label: "Pipeline", icon: GitBranch },
    ],
  },
  {
    label: "Ventes",
    items: [
      { to: "/offres", label: "Offres", icon: FileText },
      { to: "/affaires", label: "Affaires", icon: Briefcase },
      { to: "/factures", label: "Facturation", icon: Receipt },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-navy text-slate-100 flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
          <img src="/logo.png" alt="Smart Industry" className="w-10 h-10 rounded-lg shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-mint uppercase truncate">Smart Industry</p>
            <p className="text-base font-bold leading-tight">Pilotage Commercial &amp; Marketing</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{section.label}</p>
              <div className="space-y-1">
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? "bg-accent text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <Icon size={18} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          {user?.role === "admin" && (
            <div>
              <p className="px-3 mb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Administration</p>
              <NavLink
                to="/equipe"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-accent text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Settings2 size={18} />
                Equipe
              </NavLink>
            </div>
          )}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-sm font-semibold truncate">{user?.name}</p>
          <p className="text-xs text-slate-400 truncate mb-3">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <LogOut size={16} /> Se deconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
