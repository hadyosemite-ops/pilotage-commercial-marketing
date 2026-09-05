import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const STATUSES = [
  { value: "a_faire", label: "À faire" },
  { value: "en_cours", label: "En cours" },
  { value: "fait", label: "Fait" },
];

const ORIGINES = [
  { value: "general", label: "Général" },
  { value: "lead", label: "Lead" },
  { value: "opportunite", label: "Opportunité" },
  { value: "marketing", label: "Marketing" },
];

const emptyForm = { action: "", pilote_id: "", action_date: "", deadline: "", status: "a_faire", origine_type: "general", origine_id: "", notes: "" };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ActionPlan() {
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [marketingActions, setMarketingActions] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOrigine, setFilterOrigine] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterOrigine) params.origine_type = filterOrigine;
    const { data } = await api.get("/action-plan", { params });
    setItems(data);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterStatus, filterOrigine]);
  useEffect(() => {
    api.get("/auth/users").then(({ data }) => setMembers(data));
    api.get("/leads").then(({ data }) => setLeads(data));
    api.get("/opportunities").then(({ data }) => setOpportunities(data));
    api.get("/marketing-actions").then(({ data }) => setMarketingActions(data));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      action: item.action,
      pilote_id: item.pilote_id || "",
      action_date: item.action_date || "",
      deadline: item.deadline || "",
      status: item.status,
      origine_type: item.origine_type || "general",
      origine_id: item.origine_id || "",
      notes: item.notes || "",
    });
    setModalOpen(true);
  }

  function handleOrigineTypeChange(value) {
    setForm({ ...form, origine_type: value, origine_id: "" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, pilote_id: form.pilote_id || null, origine_id: form.origine_id || null };
      if (editing) await api.put(`/action-plan/${editing.id}`, payload);
      else await api.post("/action-plan", payload);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette action du plan d'action ?")) return;
    await api.delete(`/action-plan/${id}`);
    await load();
  }

  function origineOptionsFor(type) {
    if (type === "lead") return leads.map((l) => ({ id: l.id, label: `${l.name}${l.company ? ` · ${l.company}` : ""}` }));
    if (type === "opportunite") return opportunities.map((o) => ({ id: o.id, label: o.title }));
    if (type === "marketing") return marketingActions.map((m) => ({ id: m.id, label: m.title }));
    return [];
  }

  const today = todayISO();

  return (
    <div>
      <PageHeader
        title="Plan d'action"
        subtitle="Suivi général des actions liées aux leads, opportunités et actions marketing"
        action={<Button onClick={openCreate}><Plus size={16} /> Nouvelle action</Button>}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 uppercase mr-1">Statut</span>
          <button onClick={() => setFilterStatus("")} className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterStatus === "" ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Tous</button>
          {STATUSES.map((s) => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterStatus === s.value ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{s.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 uppercase mr-1">Origine</span>
          <button onClick={() => setFilterOrigine("")} className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterOrigine === "" ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Toutes</button>
          {ORIGINES.map((o) => (
            <button key={o.value} onClick={() => setFilterOrigine(o.value)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterOrigine === o.value ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{o.label}</button>
          ))}
        </div>
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState text="Aucune action planifiée. Ajoutes-en une pour démarrer le suivi." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-medium">Action</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Origine</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Pilote</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Date de l'action</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Deadline</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Statut</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const isLate = a.status !== "fait" && a.deadline && a.deadline < today;
                return (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-700 font-medium max-w-sm">{a.action}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <Badge value={a.origine_type} label={ORIGINES.find(o => o.value === a.origine_type)?.label} />
                        {a.origine_label && <span className="text-xs text-slate-400 max-w-[10rem] truncate" title={a.origine_label}>{a.origine_label}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{a.pilote_name || "—"}</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{a.action_date || "—"}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isLate ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                          <AlertTriangle size={14} /> {a.deadline}
                        </span>
                      ) : (
                        <span className="text-slate-500">{a.deadline || "—"}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap"><Badge value={a.status} label={STATUSES.find(s => s.value === a.status)?.label} /></td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-accent"><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(a.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {modalOpen && (
        <Modal title={editing ? "Modifier l'action" : "Nouvelle action"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea label="Action" rows={2} required value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />

            <div className="grid grid-cols-2 gap-4">
              <Select label="Origine" value={form.origine_type} onChange={(e) => handleOrigineTypeChange(e.target.value)}>
                {ORIGINES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {form.origine_type !== "general" && (
                <Select label="Élément lié" value={form.origine_id} onChange={(e) => setForm({ ...form, origine_id: e.target.value })}>
                  <option value="">— Non spécifié —</option>
                  {origineOptionsFor(form.origine_type).map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select label="Pilote" value={form.pilote_id} onChange={(e) => setForm({ ...form, pilote_id: e.target.value })}>
                <option value="">— Non assigné —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
              <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date de l'action" type="date" value={form.action_date} onChange={(e) => setForm({ ...form, action_date: e.target.value })} />
              <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
            <Textarea label="Commentaire / note" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
