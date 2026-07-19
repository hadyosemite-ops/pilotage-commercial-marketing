import { X } from "lucide-react";

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, highlight = false }) {
  return (
    <Card className={`p-5 ${highlight ? "ring-1 ring-accent/30" : ""}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 font-bold ${highlight ? "text-3xl text-accent" : "text-2xl text-slate-800"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </Card>
  );
}

const badgeStyles = {
  nouveau: "bg-slate-100 text-slate-700",
  contacte: "bg-amber-100 text-amber-800",
  qualifie: "bg-emerald-100 text-emerald-800",
  disqualifie: "bg-rose-100 text-rose-700",
  opportunite: "bg-blue-100 text-blue-800",
  negociation: "bg-amber-100 text-amber-800",
  gagne: "bg-emerald-100 text-emerald-800",
  perdu: "bg-rose-100 text-rose-700",
  planifie: "bg-slate-100 text-slate-700",
  publie: "bg-emerald-100 text-emerald-800",
  archive: "bg-slate-100 text-slate-500",
  LinkedIn: "bg-blue-100 text-blue-800",
  Instagram: "bg-pink-100 text-pink-800",
  Autre: "bg-slate-100 text-slate-700",
};

export function Badge({ value, label }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badgeStyles[value] || "bg-slate-100 text-slate-700"}`}>
      {label || value}
    </span>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-accent text-white hover:bg-blue-700",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ label, className = "", ...props }) {
  return (
    <label className="block text-sm">
      {label && <span className="block mb-1 font-medium text-slate-700">{label}</span>}
      <input
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent ${className}`}
        {...props}
      />
    </label>
  );
}

export function Select({ label, children, className = "", ...props }) {
  return (
    <label className="block text-sm">
      {label && <span className="block mb-1 font-medium text-slate-700">{label}</span>}
      <select
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent bg-white ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({ label, className = "", ...props }) {
  return (
    <label className="block text-sm">
      {label && <span className="block mb-1 font-medium text-slate-700">{label}</span>}
      <textarea
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent ${className}`}
        {...props}
      />
    </label>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ text }) {
  return <p className="text-sm text-slate-400 text-center py-10">{text}</p>;
}
