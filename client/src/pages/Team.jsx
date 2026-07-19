import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Badge, Button, Input, Select, Modal } from "../components/ui.jsx";

const emptyForm = { name: "", email: "", password: "", role: "member" };

export default function Team() {
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/auth/users");
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/auth/users", form);
      setModalOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Impossible de créer le compte");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Équipe"
        subtitle="Gestion des accès (2 à 5 personnes recommandé pour cet outil)"
        action={<Button onClick={() => setModalOpen(true)}><Plus size={16} /> Ajouter un membre</Button>}
      />

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-medium">Nom</th>
              <th className="py-3 px-4 font-medium">Email</th>
              <th className="py-3 px-4 font-medium">Rôle</th>
              <th className="py-3 px-4 font-medium">Membre depuis</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 px-4 text-slate-700 font-medium">{u.name}</td>
                <td className="py-3 px-4 text-slate-500">{u.email}</td>
                <td className="py-3 px-4"><Badge value={u.role === "admin" ? "gagne" : "nouveau"} label={u.role === "admin" ? "Admin" : "Membre"} /></td>
                <td className="py-3 px-4 text-slate-400">{u.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modalOpen && (
        <Modal title="Ajouter un membre de l'équipe" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Mot de passe temporaire" type="text" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Select label="Rôle" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">Membre</option>
              <option value="admin">Administrateur</option>
            </Select>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? "Création..." : "Créer le compte"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
