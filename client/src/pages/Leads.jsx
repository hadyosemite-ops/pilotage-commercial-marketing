import { useEffect, useRef, useState } from "react";
import { Plus, Upload, Pencil, Trash2, ArrowRightCircle } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const SOURCES = ["LinkedIn", "Instagram", "Site", "Recommandation", "Autre"];
const STATUSES = [
  { value: "nouveau", label: "Nouveau" },
  { value: "contacte", label: "Contacté" },
  { value: "qualifie", label: "Qualifié" },
  { value: "disqualifie", label: "Disqualifié" },
];

const emptyForm = { name: "", company: "", job_title: "", source_channel: "LinkedIn", email: "", phone: "", linkedin_url: "", status: "nouveau", fit_score: 0, intent_score: 0, notes: "" };

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [convertModal, setConvertModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const fileInput = useRef(null);

  async function load() {
    const params = {};
    if (status) params.status = status;
    if (q) params.q = q;
    const { data } = await api.get("/leads", { params });
    setLeads(data);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(lead) {
    setEditing(lead);
    setForm({ ...emptyForm, ...lead });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/leads/${editing.id}`, form);
      else await api.post("/leads", form);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ce lead ?")) return;
    await api.delete(`/leads/${id}`);
    await load();
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/leads/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setImportMsg(`${data.created}/${data.total} leads importés${data.errors.length ? " — " + data.errors.length + " ligne(s) en erreur" : ""}.`);
    fileInput.current.value = "";
    await load();
  }

  async function handleConvert(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post(`/leads/${convertModal.id}/convert`, {
      title: fd.get("title"),
      value_estimate: Number(fd.get("value_estimate")),
      probability: Number(fd.get("probability")),
      expected_close_date: fd.get("expected_close_date"),
    });
    setConvertModal(null);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Capture et qualification des contacts (LinkedIn, Instagram, import manuel)"
        action={
          <div className="flex gap-2">
            <input ref={fileInput} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="secondary" onClick={() => fileInput.current.click()}><Upload size={16} /> Importer CSV</Button>
            <Button onClick={openCreate}><Plus size={16} /> Nouveau lead</Button>
          </div>
        }
      />

      {importMsg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">{importMsg}</p>}

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <button onClick={() => setStatus("")} className={`px-3 py-1.5 rounded-full text-sm font-medium ${status === "" ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Tous</button>
        {STATUSES.map((s) => (
          <button key={s.value} onClick={() => setStatus(s.value)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${status === s.value ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{s.label}</button>
        ))}
        <input placeholder="Rechercher nom ou entreprise..." value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-accent/40" />
      </div>

      <Card>
        {leads.length === 0 ? (
          <EmptyState text="Aucun lead pour ces filtres. Importe un CSV Sales Navigator ou ajoute un lead manuellement." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-medium">Nom</th>
                <th className="py-3 px-4 font-medium">Entreprise</th>
                <th className="py-3 px-4 font-medium">Canal</th>
                <th className="py-3 px-4 font-medium">Statut</th>
                <th className="py-3 px-4 font-medium">Score (fit / intérêt)</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-700">{l.name}</p>
                    <p className="text-xs text-slate-400">{l.job_title}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{l.company || "—"}</td>
                  <td className="py-3 px-4"><Badge value={l.source_channel} /></td>
                  <td className="py-3 px-4"><Badge value={l.status} label={STATUSES.find(s => s.value === l.status)?.label} /></td>
                  <td className="py-3 px-4 text-slate-600">{l.fit_score} / {l.intent_score}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      <button title="Convertir en opportunité" onClick={() => setConvertModal(l)} className="text-slate-400 hover:text-emerald-600"><ArrowRightCircle size={16} /></button>
                      <button onClick={() => openEdit(l)} className="text-slate-400 hover:text-accent"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(l.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modalOpen && (
        <Modal title={editing ? "Modifier le lead" : "Nouveau lead"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Entreprise" value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Poste" value={form.job_title || ""} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              <Select label="Canal source" value={form.source_channel} onChange={(e) => setForm({ ...form, source_channel: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Téléphone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <Input label="URL LinkedIn" value={form.linkedin_url || ""} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
            <div className="grid grid-cols-3 gap-4">
              <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Input label="Score fit (0-50)" type="number" min="0" max="50" value={form.fit_score} onChange={(e) => setForm({ ...form, fit_score: Number(e.target.value) })} />
              <Input label="Score intérêt (0-50)" type="number" min="0" max="50" value={form.intent_score} onChange={(e) => setForm({ ...form, intent_score: Number(e.target.value) })} />
            </div>
            <Textarea label="Notes" rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {convertModal && (
        <Modal title={`Convertir "${convertModal.name}" en opportunité`} onClose={() => setConvertModal(null)}>
          <form onSubmit={handleConvert} className="space-y-4">
            <Input name="title" label="Titre de l'opportunité" defaultValue={`Opportunité - ${convertModal.name}`} required />
            <Input name="value_estimate" label="Valeur estimée (€)" type="number" min="0" defaultValue={0} />
            <Input name="probability" label="Probabilité (%)" type="number" min="0" max="100" defaultValue={50} />
            <Input name="expected_close_date" label="Date de clôture prévue" type="date" />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setConvertModal(null)}>Annuler</Button>
              <Button type="submit">Convertir</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
