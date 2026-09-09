import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Download, CheckCircle2 } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const STATUTS = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "expire", label: "Expiré" },
];

const emptyLigne = () => ({ designation: "", quantite: 1, prix_unitaire_ht: 0 });
const emptyForm = {
  client_nom: "", client_societe: "", objet: "", opportunity_id: "", statut: "brouillon",
  date_emission: "", date_validite: "", taux_tva: 20, notes: "", lignes: [emptyLigne()],
};

function formatMAD(v) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Offres() {
  const [offres, setOffres] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/offres");
    setOffres(data);
  }

  useEffect(() => {
    load();
    api.get("/opportunities").then(({ data }) => setOpportunities(data));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(o) {
    setEditing(o);
    setForm({
      ...emptyForm,
      ...o,
      opportunity_id: o.opportunity_id || "",
      lignes: o.lignes?.length ? o.lignes.map((l) => ({ designation: l.designation, quantite: l.quantite, prix_unitaire_ht: l.prix_unitaire_ht })) : [emptyLigne()],
    });
    setModalOpen(true);
  }

  function updateLigne(i, patch) {
    const lignes = form.lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    setForm({ ...form, lignes });
  }

  function addLigne() {
    setForm({ ...form, lignes: [...form.lignes, emptyLigne()] });
  }

  function removeLigne(i) {
    setForm({ ...form, lignes: form.lignes.filter((_, idx) => idx !== i) });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, opportunity_id: form.opportunity_id || null, lignes: form.lignes.filter((l) => l.designation) };
      if (editing) await api.put(`/offres/${editing.id}`, payload);
      else await api.post("/offres", payload);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette offre ?")) return;
    await api.delete(`/offres/${id}`);
    await load();
  }

  async function handleAccepter(o) {
    if (!confirm(`Marquer l'offre ${o.numero} comme acceptée ? Une Affaire sera créée automatiquement.`)) return;
    const { data: affaire } = await api.post(`/offres/${o.id}/accepter`);
    await load();
    alert(`Affaire ${affaire.numero} créée dans le module Affaires.`);
  }

  async function handlePdf(o) {
    const { data } = await api.get(`/offres/${o.id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    window.open(url, "_blank");
  }

  const totalLignesHt = form.lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
  const totalTtc = totalLignesHt * (1 + (Number(form.taux_tva) || 0) / 100);

  return (
    <div>
      <PageHeader
        title="Offres"
        subtitle="Devis envoyés aux clients, avant transformation en affaire"
        action={<Button onClick={openCreate}><Plus size={16} /> Nouvelle offre</Button>}
      />

      <Card>
        {offres.length === 0 ? (
          <EmptyState text="Aucune offre pour le moment." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-medium">N°</th>
                <th className="py-3 px-4 font-medium">Client</th>
                <th className="py-3 px-4 font-medium">Objet</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Montant TTC</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Statut</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {offres.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{o.numero}</td>
                  <td className="py-3 px-4 text-slate-700">
                    {o.client_nom}
                    {o.client_societe && <span className="text-slate-400"> · {o.client_societe}</span>}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{o.objet}</td>
                  <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">{formatMAD(o.montant_ttc)}</td>
                  <td className="py-3 px-4 whitespace-nowrap"><Badge value={o.statut} label={STATUTS.find((s) => s.value === o.statut)?.label} /></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      {!o.affaire_id && (
                        <button onClick={() => handleAccepter(o)} title="Marquer acceptée" className="text-slate-400 hover:text-emerald-600"><CheckCircle2 size={16} /></button>
                      )}
                      <button onClick={() => handlePdf(o)} title="Télécharger PDF" className="text-slate-400 hover:text-accent"><Download size={16} /></button>
                      <button onClick={() => openEdit(o)} className="text-slate-400 hover:text-accent"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(o.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modalOpen && (
        <Modal title={editing ? "Modifier l'offre" : "Nouvelle offre"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Client" required value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} />
              <Input label="Société (optionnel)" value={form.client_societe || ""} onChange={(e) => setForm({ ...form, client_societe: e.target.value })} />
            </div>
            <Input label="Objet du devis" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />

            <div className="grid grid-cols-3 gap-4">
              <Select label="Opportunité liée" value={form.opportunity_id || ""} onChange={(e) => setForm({ ...form, opportunity_id: e.target.value })}>
                <option value="">— Aucune —</option>
                {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </Select>
              <Select label="Statut" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Input label="TVA (%)" type="number" min="0" value={form.taux_tva} onChange={(e) => setForm({ ...form, taux_tva: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date d'émission" type="date" value={form.date_emission || ""} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} />
              <Input label="Valide jusqu'au" type="date" value={form.date_validite || ""} onChange={(e) => setForm({ ...form, date_validite: e.target.value })} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Lignes du devis</span>
                <Button type="button" variant="secondary" onClick={addLigne}><Plus size={14} /> Ligne</Button>
              </div>
              <div className="space-y-2">
                {form.lignes.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Désignation"
                      value={l.designation}
                      onChange={(e) => updateLigne(i, { designation: e.target.value })}
                    />
                    <input
                      type="number" min="0" step="0.5"
                      className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      placeholder="Qté"
                      value={l.quantite}
                      onChange={(e) => updateLigne(i, { quantite: Number(e.target.value) })}
                    />
                    <input
                      type="number" min="0"
                      className="w-32 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      placeholder="Prix HT"
                      value={l.prix_unitaire_ht}
                      onChange={(e) => updateLigne(i, { prix_unitaire_ht: Number(e.target.value) })}
                    />
                    <button type="button" onClick={() => removeLigne(i)} className="text-slate-300 hover:text-rose-600 p-2"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="text-right text-sm text-slate-600 mt-2">
                Total HT : <span className="font-semibold text-slate-800">{formatMAD(totalLignesHt)}</span>
                {" · "}Total TTC : <span className="font-semibold text-slate-800">{formatMAD(totalTtc)}</span>
              </div>
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
