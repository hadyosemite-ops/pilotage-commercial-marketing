import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const CHANNELS = ["LinkedIn", "Instagram", "Autre"];
const TYPES = ["Post", "Campagne", "Message", "Article"];
const STATUSES = [
  { value: "planifie", label: "Planifié" },
  { value: "publie", label: "Publié" },
  { value: "archive", label: "Archivé" },
];

const emptyForm = { channel: "LinkedIn", type: "Post", title: "", status: "planifie", scheduled_date: "", reach: 0, engagement: 0, clicks: 0, notes: "" };

export default function Marketing() {
  const [actions, setActions] = useState([]);
  const [filterChannel, setFilterChannel] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/marketing-actions", { params: filterChannel ? { channel: filterChannel } : {} });
    setActions(data);
  }

  useEffect(() => { load(); }, [filterChannel]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(action) {
    setEditing(action);
    setForm({ ...action, scheduled_date: action.scheduled_date || "" });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/marketing-actions/${editing.id}`, form);
      } else {
        await api.post("/marketing-actions", form);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette action marketing ?")) return;
    await api.delete(`/marketing-actions/${id}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Marketing multicanal"
        subtitle="Suivi des publications et campagnes LinkedIn / Instagram"
        action={<Button onClick={openCreate}><Plus size={16} /> Nouvelle action</Button>}
      />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilterChannel("")} className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterChannel === "" ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Tous</button>
        {CHANNELS.map((c) => (
          <button key={c} onClick={() => setFilterChannel(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterChannel === c ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{c}</button>
        ))}
      </div>

      <Card>
        {actions.length === 0 ? (
          <EmptyState text="Aucune action marketing. Ajoutes-en une pour commencer le suivi." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-medium">Titre</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Canal</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Type</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Statut</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Date</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap text-right">Portée</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap text-right">Engagement</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap text-right">Clics</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700 font-medium max-w-xs truncate" title={a.title}>{a.title}</td>
                  <td className="py-3 px-4 whitespace-nowrap"><Badge value={a.channel} /></td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{a.type}</td>
                  <td className="py-3 px-4 whitespace-nowrap"><Badge value={a.status} label={STATUSES.find(s => s.value === a.status)?.label} /></td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{a.scheduled_date || "—"}</td>
                  <td className="py-3 px-4 text-slate-600 text-right whitespace-nowrap">{a.reach}</td>
                  <td className="py-3 px-4 text-slate-600 text-right whitespace-nowrap">{a.engagement}</td>
                  <td className="py-3 px-4 text-slate-600 text-right whitespace-nowrap">{a.clicks}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-accent"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(a.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modalOpen && (
        <Modal title={editing ? "Modifier l'action" : "Nouvelle action marketing"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Canal" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Input label="Date prévue/publication" type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Portée" type="number" min="0" value={form.reach} onChange={(e) => setForm({ ...form, reach: Number(e.target.value) })} />
              <Input label="Engagement" type="number" min="0" value={form.engagement} onChange={(e) => setForm({ ...form, engagement: Number(e.target.value) })} />
              <Input label="Clics" type="number" min="0" value={form.clicks} onChange={(e) => setForm({ ...form, clicks: Number(e.target.value) })} />
            </div>
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
