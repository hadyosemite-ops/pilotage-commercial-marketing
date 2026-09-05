import nodemailer from "nodemailer";

// Envoi d'email transactionnel (mot de passe oublie) via Gmail SMTP, avec un compte
// Gmail existant + un "mot de passe d'application" genere par Google (pas le mot de
// passe habituel du compte). Voir server/.env.example pour la marche a suivre.
const SMTP_USER = process.env.SMTP_USER;
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD;

let transporter = null;

function getTransporter() {
  if (!SMTP_USER || !SMTP_APP_PASSWORD) {
    throw new Error("SMTP_USER / SMTP_APP_PASSWORD manquant : impossible d'envoyer l'email de reinitialisation");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(to, resetUrl) {
  await getTransporter().sendMail({
    from: `"Pilotage Commercial & Marketing" <${SMTP_USER}>`,
    to,
    subject: "Réinitialisation de votre mot de passe — Pilotage Commercial & Marketing",
    html: `
      <p>Bonjour,</p>
      <p>Une demande de réinitialisation de mot de passe a été faite pour votre compte sur
      l'outil Pilotage Commercial &amp; Marketing.</p>
      <p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande,
      vous pouvez ignorer cet email sans risque.</p>
    `,
  });
}
