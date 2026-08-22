import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PageHeader, Card, Badge, Button, Input, Select, Modal } from "../components/ui.jsx";

const emptyForm = { name: "", email: "", password: "", role: "member" };

export default function Team() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await api.get("/auth/users");
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  function openAddModal() {
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(u) {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingUser) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/users/${editingUser.id}`, payload);
      } else {
        await api.post("/auth/users", form);
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditingUser(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Impossible d'enregistrer ce membre");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Supprimer ${u.name} (${u.email}) ? Cette action est irréversible.`)) return;
    try {
      await api.delete(`/auth/users/${u.id}`);
      await load();
    } catch (err) {
      alert(err.response?.data?.error || "Impossible de supprimer ce membre");
    }
  }

  return (
    <div>
      <PageHeader
        title="Équipe"
        subtitle="Gestion des accès (2 à 5 personnes recommandé pour cet outil)"
        action={<Button onClick={openAddModal}><Plus size={16} /> Ajouter un membre</Button>}
      />

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-medium">Nom</th>
              <th className="py-3 px-4 font-medium">Email</th>
              <th className="py-3 px-4 font-medium">Rôle</th>
              <th className="py-3 px-4 font-medium">Membre depuis</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 px-4 text-slate-700 font-medium">{u.name}</td>
                <td className="py-3 px-4 text-slate-500">{u.email}</td>
                <td className="py-3 px-4"><Badge value={u.role === "admin" ? "gagne" : "nouveau"} label={u.role === "admin" ? "Admin" : "Membre"} /></td>
                <td className="py-3 px-4 text-slate-400">{u.created_at}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEditModal(u)} className="text-slate-400 hover:text-accent" title="Modifier">
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={u.id === currentUser?.id}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={u.id === currentUser?.id ? "Vous ne pouvez pas supprimer votre propre compte" : "Supprimer"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modalOpen && (
        <Modal title={editingUser ? "Modifier le membre" : "Ajouter un membre de l'équipe"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input
              label={editingUser ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe temporaire"}
              type="text"
              required={!editingUser}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Select label="Rôle" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">Membre</option>
              <option value="admin">Administrateur</option>
            </Select>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingUser ? "Enregistrer" : "Créer le compte"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
