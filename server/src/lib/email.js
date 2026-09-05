// Envoi d'email transactionnel via Resend (https://resend.com), en appel HTTP direct
// (pas de dependance npm supplementaire : fetch natif de Node >= 18).
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function sendPasswordResetEmail(to, resetUrl) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY manquant : impossible d'envoyer l'email de reinitialisation");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to,
      subject: "Reinitialisation de votre mot de passe — Pilotage Commercial & Marketing",
      html: `
        <p>Bonjour,</p>
        <p>Une demande de reinitialisation de mot de passe a ete faite pour votre compte sur
        l'outil Pilotage Commercial &amp; Marketing.</p>
        <p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
        <p>Ce lien expire dans 1 heure. Si vous n'etes pas a l'origine de cette demande,
        vous pouvez ignorer cet email sans risque.</p>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Echec de l'envoi de l'email (Resend ${response.status}) : ${body}`);
  }
}
