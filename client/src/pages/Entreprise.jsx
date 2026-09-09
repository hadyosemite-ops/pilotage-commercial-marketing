import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import api from "../api.js";
import { PageHeader, Card, Button, Input } from "../components/ui.jsx";

const emptyForm = { raison_sociale: "", adresse: "", ice: "", identifiant_fiscal: "", tp: "", telephone: "", email: "" };

export default function Entreprise() {
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState("");

  async function load() {
    const { data } = await api.get("/company-settings");
    setCompany(data);
    setForm({
      raison_sociale: data.raison_sociale || "",
      adresse: data.adresse || "",
      ice: data.ice || "",
      identifiant_fiscal: data.identifiant_fiscal || "",
      tp: data.tp || "",
      telephone: data.telephone || "",
      email: data.email || "",
    });
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await api.put("/company-settings", form);
      setCompany(data);
    } catch (err) {
      setError(err.response?.data?.error || "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(field, file) {
    if (!file) return;
    setError("");
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/company-settings/${field}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setCompany(data);
    } catch (err) {
      setError(err.response?.data?.error || "Envoi impossible");
    } finally {
      setUploading("");
    }
  }

  if (!company) return <p className="text-slate-400">Chargement...</p>;

  return (
    <div>
      <PageHeader
        title="Mon entreprise"
        subtitle="Identité officielle utilisée sur les devis et factures : logo, cachet, signature, ICE/IF/RC"
      />

      {error && <p className="text-sm text-rose-600 mb-4">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-5 xl:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">Informations légales</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Raison sociale" required value={form.raison_sociale} onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })} />
            <Input label="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            <div className="grid grid-cols-3 gap-4">
              <Input label="ICE" value={form.ice} onChange={(e) => setForm({ ...form, ice: e.target.value })} />
              <Input label="IF" value={form.identifiant_fiscal} onChange={(e) => setForm({ ...form, identifiant_fiscal: e.target.value })} />
              <Input label="TP" value={form.tp} onChange={(e) => setForm({ ...form, tp: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <ImageUploadCard
            label="Logo"
            hint="Affiché en haut des devis/factures (PNG ou JPEG, 3 Mo max)"
            dataUri={company.logo_data}
            uploading={uploading === "logo"}
            onUpload={(f) => handleUpload("logo", f)}
          />
          <ImageUploadCard
            label="Cachet"
            hint="Affiché en bas des documents, à côté de la signature"
            dataUri={company.cachet_data}
            uploading={uploading === "cachet"}
            onUpload={(f) => handleUpload("cachet", f)}
          />
          <ImageUploadCard
            label="Signature"
            hint="Affichée en bas des documents, à côté du cachet"
            dataUri={company.signature_data}
            uploading={uploading === "signature"}
            onUpload={(f) => handleUpload("signature", f)}
          />
        </div>
      </div>
    </div>
  );
}

function ImageUploadCard({ label, hint, dataUri, uploading, onUpload }) {
  const inputRef = useRef(null);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800">{label}</h3>
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload size={14} /> {uploading ? "Envoi..." : "Changer"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
      {dataUri ? (
        <img src={dataUri} alt={label} className="max-h-24 mx-auto object-contain" />
      ) : (
        <p className="text-xs text-slate-400 text-center py-6">Aucun {label.toLowerCase()} pour le moment</p>
      )}
      <p className="text-xs text-slate-400 mt-2">{hint}</p>
    </Card>
  );
}
