import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { PageHeader, Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const STATUTS = [
  { value: "en_cours", label: "En cours" },
  { value: "terminee", label: "Terminée" },
  { value: "annulee", label: "Annulée" },
];

const emptyForm = {
  titre: "", client_nom: "", client_societe: "", montant_ht: 0, taux_tva: 20,
  statut: "en_cours", date_debut: "", date_fin_prevue: "", notes: "",
};

function formatMAD(v) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Affaires() {
  const navigate = useNavigate();
  const [affaires, setAffaires] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/affaires");
    setAffaires(data);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({ ...emptyForm, ...a });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/affaires/${editing.id}`, form);
      else await api.post("/affaires", form);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette affaire ? Les factures liées seront également supprimées.")) return;
    await api.delete(`/affaires/${id}`);
    await load();
  }

  const totalEnCours = affaires.filter((a) => a.statut === "en_cours").reduce((s, a) => s + (a.montant_ttc || 0), 0);
  const totalRestant = affaires.reduce((s, a) => s + (a.montant_restant || 0), 0);

  return (
    <div>
      <PageHeader
        title="Affaires"
        subtitle={`${affaires.length} affaire(s) · ${formatMAD(totalEnCours)} en cours · ${formatMAD(totalRestant)} restant à facturer`}
        action={<Button onClick={openCreate}><Plus size={16} /> Nouvelle affaire</Button>}
      />

      <Card>
        {affaires.length === 0 ? (
          <EmptyState text="Aucune affaire pour le moment. Une affaire est créée automatiquement quand une offre est acceptée." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-medium">N°</th>
                <th className="py-3 px-4 font-medium">Titre / Client</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Montant TTC</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Facturé</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Restant</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Statut</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {affaires.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{a.numero}</td>
                  <td className="py-3 px-4">
                    <p className="text-slate-700 font-medium">{a.titre}</p>
                    <p className="text-xs text-slate-400">{a.client_nom}{a.client_societe ? ` · ${a.client_societe}` : ""}</p>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">{formatMAD(a.montant_ttc)}</td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500">{formatMAD(a.montant_facture)}</td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500">{formatMAD(a.montant_restant)}</td>
                  <td className="py-3 px-4 whitespace-nowrap"><Badge value={a.statut} label={STATUTS.find((s) => s.value === a.statut)?.label} /></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => navigate(`/factures?affaire_id=${a.id}`)} title="Voir les factures" className="text-slate-400 hover:text-accent"><Receipt size={16} /></button>
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
        <Modal title={editing ? "Modifier l'affaire" : "Nouvelle affaire"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Titre" required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Client" required value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} />
              <Input label="Société (optionnel)" value={form.client_societe || ""} onChange={(e) => setForm({ ...form, client_societe: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Montant HT (MAD)" type="number" min="0" value={form.montant_ht} onChange={(e) => setForm({ ...form, montant_ht: Number(e.target.value) })} />
              <Input label="TVA (%)" type="number" min="0" value={form.taux_tva} onChange={(e) => setForm({ ...form, taux_tva: Number(e.target.value) })} />
              <Select label="Statut" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date de début" type="date" value={form.date_debut || ""} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
              <Input label="Date de fin prévue" type="date" value={form.date_fin_prevue || ""} onChange={(e) => setForm({ ...form, date_fin_prevue: e.target.value })} />
            </div>
            <Textarea label="Notes" rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
