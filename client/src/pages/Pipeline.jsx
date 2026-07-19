import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Button, Input, Select, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const STAGES = [
  { value: "opportunite", label: "Opportunité", color: "border-t-blue-500" },
  { value: "negociation", label: "Négociation", color: "border-t-amber-500" },
  { value: "gagne", label: "Gagné", color: "border-t-emerald-500" },
  { value: "perdu", label: "Perdu", color: "border-t-rose-500" },
];

const emptyForm = { title: "", stage: "opportunite", value_estimate: 0, probability: 50, expected_close_date: "", lost_reason: "", notes: "" };

function formatEUR(v) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Pipeline() {
  const [opps, setOpps] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/opportunities");
    setOpps(data);
  }

  useEffect(() => { load(); }, []);

  function openCreate(stage) {
    setEditing(null);
    setForm({ ...emptyForm, stage: stage || "opportunite" });
    setModalOpen(true);
  }

  function openEdit(o) {
    setEditing(o);
    setForm({ ...emptyForm, ...o, expected_close_date: o.expected_close_date || "" });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/opportunities/${editing.id}`, form);
      else await api.post("/opportunities", form);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette opportunité ?")) return;
    await api.delete(`/opportunities/${id}`);
    await load();
  }

  async function moveStage(o, stage) {
    await api.put(`/opportunities/${o.id}`, { ...o, stage });
    await load();
  }

  const totalOpen = opps.filter(o => ["opportunite", "negociation"].includes(o.stage)).reduce((s, o) => s + (o.value_estimate || 0), 0);

  return (
    <div>
      <PageHeader
        title="Pipeline des opportunités"
        subtitle={`${opps.length} opportunité(s) · ${formatEUR(totalOpen)} en cours`}
        action={<Button onClick={() => openCreate()}><Plus size={16} /> Nouvelle opportunité</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGES.map((stage) => {
          const items = opps.filter((o) => o.stage === stage.value);
          const stageTotal = items.reduce((s, o) => s + (o.value_estimate || 0), 0);
          return (
            <div key={stage.value} className={`bg-white rounded-xl border border-slate-200 border-t-4 ${stage.color} flex flex-col`}>
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-semibold text-slate-700 text-sm">{stage.label} <span className="text-slate-400 font-normal">({items.length})</span></p>
                <p className="text-xs text-slate-400">{formatEUR(stageTotal)}</p>
              </div>
              <div className="kanban-col flex-1 p-3 space-y-3 overflow-y-auto max-h-[65vh]">
                {items.length === 0 && <p className="text-xs text-slate-300 text-center py-6">Aucune opportunité</p>}
                {items.map((o) => (
                  <Card key={o.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-slate-800">{o.title}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(o)} className="text-slate-300 hover:text-accent"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(o.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {o.lead_name && <p className="text-xs text-slate-400 mt-0.5">{o.lead_name}{o.lead_company ? ` · ${o.lead_company}` : ""}</p>}
                    <p className="text-sm font-semibold text-slate-700 mt-2">{formatEUR(o.value_estimate)}</p>
                    <p className="text-xs text-slate-400">Probabilité : {o.probability}%{o.expected_close_date ? ` · clôture ${o.expected_close_date}` : ""}</p>
                    <select
                      value={o.stage}
                      onChange={(e) => moveStage(o, e.target.value)}
                      className="mt-2 w-full text-xs rounded-md border border-slate-200 px-2 py-1 bg-slate-50"
                    >
                      {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Modifier l'opportunité" : "Nouvelle opportunité"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-3 gap-4">
              <Select label="Étape" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Input label="Valeur estimée (€)" type="number" min="0" value={form.value_estimate} onChange={(e) => setForm({ ...form, value_estimate: Number(e.target.value) })} />
              <Input label="Probabilité (%)" type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} />
            </div>
            <Input label="Date de clôture prévue" type="date" value={form.expected_close_date || ""} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} />
            {form.stage === "perdu" && (
              <Input label="Motif de perte" value={form.lost_reason || ""} onChange={(e) => setForm({ ...form, lost_reason: e.target.value })} />
            )}
            <Textarea label="Notes" rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
