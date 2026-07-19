import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import api from "../api.js";
import { PageHeader, Card, StatCard, Badge, EmptyState } from "../components/ui.jsx";

const STAGE_LABELS = { opportunite: "Opportunité", negociation: "Négociation", gagne: "Gagné", perdu: "Perdu" };
const CHANNEL_COLORS = { LinkedIn: "#2563EB", Instagram: "#DB2777", Autre: "#64748B" };
const STATUS_LABELS = { nouveau: "Nouveau", contacte: "Contacté", qualifie: "Qualifié", disqualifie: "Disqualifié" };

function formatEUR(v) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/dashboard/summary")
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error("Erreur dashboard/summary:", err);
        setError(err.response?.data?.error || err.message || "Erreur inconnue");
      });
  }, []);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm">
        Impossible de charger le tableau de bord : {error}
      </div>
    );
  }

  if (!data) return <p className="text-slate-400">Chargement...</p>;

  const pipelineOpenValue = data.pipeline.open.v;
  const stageChartData = data.pipeline.byStage.map((s) => ({ name: STAGE_LABELS[s.stage] || s.stage, valeur: s.v, count: s.c }));
  const channelChartData = data.actionsByChannel.map((c) => ({ name: c.channel, reach: c.reach, engagement: c.engagement, clicks: c.clicks }));
  const leadsChannelPie = data.leadsByChannel.map((c) => ({ name: c.source_channel, value: c.c }));

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de l'activité commerciale et marketing" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pipeline en cours" value={formatEUR(pipelineOpenValue)} sub={`${data.pipeline.open.c} opportunité(s) ouverte(s)`} highlight />
        <StatCard label="Leads au total" value={data.leadsTotal} sub="tous canaux confondus" />
        <StatCard label="Taux de conversion" value={`${data.conversionRate}%`} sub="leads → qualifiés" />
        <StatCard label="Taux de gain" value={`${data.winRate}%`} sub="opportunités closes" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 xl:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">Valeur du pipeline par étape</h3>
          {stageChartData.length === 0 ? (
            <EmptyState text="Aucune opportunité pour le moment" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatEUR(v)} />
                <Bar dataKey="valeur" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Leads par canal</h3>
          {leadsChannelPie.length === 0 ? (
            <EmptyState text="Aucun lead enregistré" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={leadsChannelPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {leadsChannelPie.map((entry, i) => (
                    <Cell key={i} fill={CHANNEL_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {leadsChannelPie.map((c) => (
              <span key={c.name} className="text-xs flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: CHANNEL_COLORS[c.name] || "#94a3b8" }} />
                {c.name} ({c.value})
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 xl:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-4">Portée &amp; engagement marketing par canal</h3>
          {channelChartData.length === 0 ? (
            <EmptyState text="Aucune action marketing enregistrée" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={channelChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="reach" name="Portée" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="engagement" name="Engagement" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" name="Clics" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Statut des leads</h3>
          <div className="space-y-3">
            {data.leadsByStatus.length === 0 && <EmptyState text="Aucun lead" />}
            {data.leadsByStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <Badge value={s.status} label={STATUS_LABELS[s.status]} />
                <span className="text-sm font-semibold text-slate-700">{s.c}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-6">
        <h3 className="font-semibold text-slate-800 mb-4">Actions marketing récentes</h3>
        {data.actionsRecent.length === 0 ? (
          <EmptyState text="Aucune action pour le moment" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="pb-2 font-medium">Titre</th>
                <th className="pb-2 font-medium">Canal</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.actionsRecent.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 text-slate-700">{a.title}</td>
                  <td className="py-2.5"><Badge value={a.channel} /></td>
                  <td className="py-2.5"><Badge value={a.status} /></td>
                  <td className="py-2.5 text-slate-500">{a.scheduled_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
