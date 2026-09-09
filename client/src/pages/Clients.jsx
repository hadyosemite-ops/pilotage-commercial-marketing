import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Button, Input, Textarea, Modal, EmptyState } from "../components/ui.jsx";

const emptyForm = {
  raison_sociale: "", adresse: "", ice: "", identifiant_fiscal: "", rc: "",
  contact_nom: "", contact_email: "", contact_telephone: "", notes: "",
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/clients");
    setClients(data);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({ ...emptyForm, ...c });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing) await api.put(`/clients/${editing.id}`, form);
      else await api.post("/clients", form);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Impossible d'enregistrer ce client.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer ce client ? Les devis/affaires déjà émis conservent son identité (photo au moment de l'émission).")) return;
    await api.delete(`/clients/${id}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Base clients utilisée pour la facturation officielle (ICE, IF, RC)"
        action={<Button onClick={openCreate}><Plus size={16} /> Nouveau client</Button>}
      />

      <Card>
        {clients.length === 0 ? (
          <EmptyState text="Aucun client pour le moment. Ajoutes-en un pour pouvoir créer des offres et affaires." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-medium">Raison sociale</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">ICE</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">IF</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">RC</th>
                <th className="py-3 px-4 font-medium">Contact</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="text-slate-700 font-medium">{c.raison_sociale}</p>
                    {c.adresse && <p className="text-xs text-slate-400 max-w-xs truncate">{c.adresse}</p>}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500">{c.ice || "—"}</td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500">{c.identifiant_fiscal || "—"}</td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-500">{c.rc || "—"}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {c.contact_nom || "—"}
                    {c.contact_telephone && <span className="text-xs text-slate-400 block">{c.contact_telephone}</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-accent"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {modalOpen && (
        <Modal title={editing ? "Modifier le client" : "Nouveau client"} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Input label="Raison sociale" required value={form.raison_sociale} onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })} />
            <Input label="Adresse" value={form.adresse || ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            <div className="grid grid-cols-3 gap-4">
              <Input label="ICE" value={form.ice || ""} onChange={(e) => setForm({ ...form, ice: e.target.value })} />
              <Input label="IF" value={form.identifiant_fiscal || ""} onChange={(e) => setForm({ ...form, identifiant_fiscal: e.target.value })} />
              <Input label="RC" value={form.rc || ""} onChange={(e) => setForm({ ...form, rc: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Contact (nom)" value={form.contact_nom || ""} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} />
              <Input label="Email" type="email" value={form.contact_email || ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              <Input label="Téléphone" value={form.contact_telephone || ""} onChange={(e) => setForm({ ...form, contact_telephone: e.target.value })} />
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
