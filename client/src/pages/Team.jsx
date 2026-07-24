import { PageHeader, Card } from "../components/ui.jsx";

export default function Team() {
  return (
    <div>
      <PageHeader
        title="Équipe"
        subtitle="Gestion des accès (2 à 5 personnes recommandé pour cet outil)"
      />

      <Card className="p-4 mb-6 bg-amber-50 border-amber-100">
        <p className="text-sm text-slate-700">
          L'identification est <strong>désactivée pour le moment</strong> : l'application est accessible librement à
          toute personne ayant le lien, sans connexion. C'est un choix temporaire assumé — pense à réactiver une
          identification (Google, code d'accès, etc.) avant de partager le lien plus largement ou d'y stocker des
          données sensibles.
        </p>
      </Card>
    </div>
  );
}
