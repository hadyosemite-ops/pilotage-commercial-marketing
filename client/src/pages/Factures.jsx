import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Download, CheckCircle2, X } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Badge, Button, Input, Select, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const STATUTS = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoyee", label: "Envoyée" },
  { value: "payee", label: "Payée" },
  { value: "en_retard", label: "En retard" },
  { value: "annulee", label: "Annulée" },
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

// Memes lignes (designation/unite/qte/prix) que le module Offres : parite
// complete entre devis et facturation.
const emptyLigne = () => ({ designation: "", unite: "forfait", quantite: 1, prix_unitaire_ht: 0 });
const emptyForm = {
  affaire_id: "", objet: "", taux_tva: 20, statut: "brouillon",
  date_emission: "", date_echeance: "", acompte_pourcentage: "", mode_paiement: "", notes: "", lignes: [emptyLigne()],
};

function formatMAD(v) {
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Factures() {
  const [searchParams, setSearchParams] = useSearchParams();
  const affaireFilter = searchParams.get("affaire_id") || "";

  const [factures, setFactures] = useState([]);
  const [affaires, setAffaires] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const params = {};
    if (affaireFilter) params.affaire_id = affaireFilter;
    const { data } = await api.get("/factures", { params });
    setFactures(data);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [affaireFilter]);
  useEffect(() => { api.get("/affaires").then(({ data }) => setAffaires(data)); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, affaire_id: affaireFilter || "" });
    setError("");
    setModalOpen(true);
  }

  async function openEdit(f) {
    setEditing(f);
    setError("");
    // La liste ne contient pas les lignes : on recharge le detail complet
    // pour ne pas perdre les lignes existantes en ouvrant la modale.
    const { data } = await api.get(`/factures/${f.id}`);
    setForm({
      ...emptyForm,
      ...data,
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
    if (!form.affaire_id) return;
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        acompte_pourcentage: form.acompte_pourcentage === "" ? null : form.acompte_pourcentage,
        mode_paiement: form.mode_paiement || null,
        lignes: form.lignes.filter((l) => l.designation),
      };
      if (editing) await api.put(`/factures/${editing.id}`, payload);
      else await api.post("/factures", payload);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Impossible d'enregistrer cette facture.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cette facture ?")) return;
    await api.delete(`/factures/${id}`);
    await load();
  }

  async function handleMarkPaid(f) {
    await api.put(`/factures/${f.id}`, { statut: "payee" });
    await load();
  }

  async function handlePdf(f) {
    const { data } = await api.get(`/factures/${f.id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    window.open(url, "_blank");
  }

  const affaireActive = affaires.find((a) => String(a.id) === String(affaireFilter));
  const totalTtc = factures.reduce((s, f) => s + (f.montant_ttc || 0), 0);
  const totalPaye = factures.filter((f) => f.statut === "payee").reduce((s, f) => s + (f.montant_ttc || 0), 0);

  const totalLignesHt = form.lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
  const totalTtcForm = totalLignesHt * (1 + (Number(form.taux_tva) || 0) / 100);

  return (
    <div>
      <PageHeader
        title="Facturation"
        subtitle={affaireActive ? `Factures de l'affaire ${affaireActive.numero} — ${affaireActive.titre}` : `${factures.length} facture(s) · ${formatMAD(totalTtc)} au total · ${formatMAD(totalPaye)} payé`}
        action={<Button onClick={openCreate}><Plus size={16} /> Nouvelle facture</Button>}
      />

      {affaireFilter && (
        <button
          onClick={() => setSearchParams({})}
          className="inline-flex items-center gap-1.5 mb-4 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50"
        >
          <X size={13} /> Retirer le filtre affaire
        </button>
      )}

      <Card>
        {factures.length === 0 ? (
          <EmptyState text="Aucune facture pour le moment." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-medium">N°</th>
                <th className="py-3 px-4 font-medium">Affaire</th>
                <th className="py-3 px-4 font-medium">Objet</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Montant TTC</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Échéance</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">Statut</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{f.numero}</td>
                  <td className="py-3 px-4">
                    <p className="text-slate-700">{f.affaire_numero}</p>
                    <p className="text-xs text-slate-400">{f.affaire_client_raison_sociale}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{f.objet}</td>
                  <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">{formatMAD(f.montant_ttc)}</td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500">{f.date_echeance || "—"}</td>
                  <td className="py-3 px-4 whitespace-nowrap"><Badge value={f.statut} label={STATUTS.find((s) => s.value === f.statut)?.label} /></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      {f.statut !== "payee" && (
                        <button onClick={() => handleMarkPaid(f)} title="Marquer payée" className="text-slate-400 hover:text-emerald-600"><CheckCircle2 size={16} /></button>
                      )}
                      <button onClick={() => handlePdf(f)} title="Télécharger PDF" className="text-slate-400 hover:text-accent"><Download size={16} /></button>
                      <button onClick={() => openEdit(f)} className="text-slate-400 hover:text-accent"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(f.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modalOpen && (
        <Modal title={editing ? "Modifier la facture" : "Nouvelle facture"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Select label="Affaire" required value={form.affaire_id} onChange={(e) => setForm({ ...form, affaire_id: e.target.value })}>
              <option value="">— Choisir une affaire —</option>
              {affaires.map((a) => <option key={a.id} value={a.id}>{a.numero} — {a.titre}</option>)}
            </Select>
            <Input label="Objet (ex: Acompte 30%, Solde)" required value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="TVA (%)" type="number" min="0" value={form.taux_tva} onChange={(e) => setForm({ ...form, taux_tva: Number(e.target.value) })} />
              <Select label="Statut" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date d'émission" type="date" value={form.date_emission || ""} onChange={(e) => setForm({ ...form, date_emission: e.target.value })} />
              <Input label="Date d'échéance" type="date" value={form.date_echeance || ""} onChange={(e) => setForm({ ...form, date_echeance: e.target.value })} />
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
                <span className="text-sm font-medium text-slate-700">Lignes de la facture</span>
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
                {" · "}Total TTC : <span className="font-semibold text-slate-800">{formatMAD(totalTtcForm)}</span>
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
