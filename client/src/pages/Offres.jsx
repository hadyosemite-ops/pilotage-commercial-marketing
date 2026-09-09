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

const MODES_PAIEMENT = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
  { value: "effet", label: "Effet" },
];

const UNITES = [
  { value: "forfait", label: "Forfait" },
  { value: "jh", label: "JH" },
  { value: "jour", label: "Jour" },
  { value: "heure", label: "Heure" },
];

const emptyLigne = () => ({ designation: "", unite: "forfait", quantite: 1, prix_unitaire_ht: 0 });
const emptyForm = {
  client_id: "", objet: "", opportunity_id: "", statut: "brouillon",
  date_emission: "", date_validite: "", taux_tva: 20, acompte_pourcentage: "", mode_paiement: "", notes: "", lignes: [emptyLigne()],
};

function formatMAD(v) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Offres() {
  const [offres, setOffres] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [clients, setClients] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/offres");
    setOffres(data);
  }

  useEffect(() => {
    load();
    api.get("/opportunities").then(({ data }) => setOpportunities(data));
    api.get("/clients").then(({ data }) => setClients(data));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  async function openEdit(o) {
    setEditing(o);
    setError("");
    // La liste ne contient pas les lignes : on recharge le detail complet
    // pour ne pas perdre les lignes existantes en ouvrant la modale.
    const { data } = await api.get(`/offres/${o.id}`);
    setForm({
      ...emptyForm,
      ...data,
      client_id: data.client_id || "",
      opportunity_id: data.opportunity_id || "",
      acompte_pourcentage: data.acompte_pourcentage ?? "",
      mode_paiement: data.mode_paiement || "",
      lignes: data.lignes?.length
        ? data.lignes.map((l) => ({ designation: l.designation, unite: l.unite || "forfait", quantite: l.quantite, prix_unitaire_ht: l.prix_unitaire_ht }))
        : [emptyLigne()],
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
    if (!form.client_id) return;
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        opportunity_id: form.opportunity_id || null,
        acompte_pourcentage: form.acompte_pourcentage === "" ? null : form.acompte_pourcentage,
        mode_paiement: form.mode_paiement || null,
        lignes: form.lignes.filter((l) => l.designation),
      };
      if (editing) await api.put(`/offres/${editing.id}`, payload);
      else await api.post("/offres", payload);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Impossible d'enregistrer cette offre.");
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
                  <td className="py-3 px-4 text-slate-700">{o.client_raison_sociale}</td>
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
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Select label="Client" required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">— Choisir un client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
            </Select>
            {clients.length === 0 && (
              <p className="text-xs text-amber-600">Aucun client enregistré. Ajoute d'abord un client dans le module Clients.</p>
            )}
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
            <div className="grid grid-cols-2 gap-4">
              <Input label="Acompte (%)" type="number" min="0" max="100" value={form.acompte_pourcentage} onChange={(e) => setForm({ ...form, acompte_pourcentage: e.target.value === "" ? "" : Number(e.target.value) })} />
              <Select label="Mode de paiement" value={form.mode_paiement || ""} onChange={(e) => setForm({ ...form, mode_paiement: e.target.value })}>
                <option value="">— Non précisé —</option>
                {MODES_PAIEMENT.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
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
                    <select
                      className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      value={l.unite || "forfait"}
                      onChange={(e) => updateLigne(i, { unite: e.target.value })}
                    >
                      {UNITES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
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
