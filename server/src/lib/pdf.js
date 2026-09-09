import PDFDocument from "pdfkit";

// Genere un PDF (Buffer) a partir d'un PDFDocument pdfkit : on capture les
// chunks emis par le stream et on les concatene une fois le document termine.
function renderToBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      build(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Formatage manuel (espace ASCII normal comme separateur de milliers) plutot que
// toLocaleString("fr-FR") : cette derniere insere une espace fine insecable
// (U+202F) que la police Helvetica standard des PDF ne sait pas afficher
// correctement (elle apparaissait comme un "/" dans le PDF genere).
function formatMAD(v) {
  const n = Number(v) || 0;
  const [intPart, decPart] = n.toFixed(2).split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces},${decPart} MAD`;
}

const NAVY = "#0D1B2A";
const ACCENT = "#0F7173";
const SLATE = "#475569";

// Convertit une data URI ("data:image/png;base64,...") en Buffer utilisable par
// pdfkit. Retourne null si absente/invalide (l'appelant ignore alors l'image).
function dataUriToBuffer(dataUri) {
  if (!dataUri) return null;
  const idx = dataUri.indexOf("base64,");
  if (idx === -1) return null;
  try {
    return Buffer.from(dataUri.slice(idx + 7), "base64");
  } catch {
    return null;
  }
}

// Quand un logo est renseigne, il remplace le nom en texte (le logo porte
// deja le nom de l'entreprise visuellement) : on l'affiche plus grand, et
// ICE/IF/TP + adresse passent dessous plutot qu'a cote du (petit) logo.
function drawHeader(doc, { docTitle, numero, statutLabel, company }) {
  const name = company?.raison_sociale || "Smart Industry";
  const logoBuffer = dataUriToBuffer(company?.logo_data);
  let hasLogo = false;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 44, { fit: [160, 40] });
      hasLogo = true;
    } catch {
      // image corrompue/non supportee : on continue sans logo plutot que de faire echouer le PDF
    }
  }
  const textWidth = 300;
  let idY = 70;
  let addresseY = 82;
  if (hasLogo) {
    idY = 92;
    addresseY = 104;
  } else {
    doc.fillColor(NAVY).fontSize(17).font("Helvetica-Bold").text(name, 50, 48, { width: textWidth });
  }

  const idLine = [company?.ice && `ICE: ${company.ice}`, company?.identifiant_fiscal && `IF: ${company.identifiant_fiscal}`, company?.tp && `TP: ${company.tp}`]
    .filter(Boolean).join("   ");
  doc.fillColor(SLATE).fontSize(8).font("Helvetica").text(idLine || "Pilotage Commercial & Marketing", 50, idY, { width: textWidth });
  if (company?.adresse) {
    doc.fillColor(SLATE).fontSize(8).font("Helvetica").text(company.adresse, 50, addresseY, { width: textWidth });
  }

  doc.fillColor(ACCENT).fontSize(16).font("Helvetica-Bold").text(docTitle, 300, 50, { width: 245, align: "right" });
  doc.fillColor(SLATE).fontSize(10).font("Helvetica").text(numero, 300, 72, { width: 245, align: "right" });
  if (statutLabel) {
    doc.fillColor(SLATE).fontSize(9).text(statutLabel, 300, 88, { width: 245, align: "right" });
  }

  doc.moveTo(50, 118).lineTo(545, 118).strokeColor("#e2e8f0").lineWidth(1).stroke();
}

// Bloc cachet + signature, position fixe en bas de page (comme drawFooter) :
// coherent avec le fait que ces documents restent sur une seule page.
function drawSignatureBlock(doc, company) {
  const x = 350, y = 635, w = 195, h = 85;
  doc.fillColor(SLATE).fontSize(8).font("Helvetica-Bold").text("CACHET & SIGNATURE", x, y - 14);
  doc.roundedRect(x, y, w, h, 4).strokeColor("#e2e8f0").lineWidth(1).stroke();

  const cachetBuffer = dataUriToBuffer(company?.cachet_data);
  const signatureBuffer = dataUriToBuffer(company?.signature_data);
  try {
    if (cachetBuffer) doc.image(cachetBuffer, x + 8, y + 8, { fit: [85, h - 16] });
  } catch {
    // image cachet illisible : on laisse la case vide plutot que de bloquer le PDF
  }
  try {
    if (signatureBuffer) doc.image(signatureBuffer, x + 100, y + 8, { fit: [87, h - 16] });
  } catch {
    // idem pour la signature
  }
}

// Hauteur/position calculees dynamiquement (plutot que des decalages fixes) :
// une adresse client qui passe sur 2 lignes ne doit pas chevaucher la ligne
// ICE/IF/RC juste en dessous, ni le contenu qui suit le bloc (objet/lignes).
function drawClientBlock(doc, y, { raisonSociale, adresse, ice, identifiantFiscal, rc, dateEmission, dateAutre, dateAutreLabel }) {
  const colWidth = 270;
  doc.fillColor(SLATE).fontSize(9).font("Helvetica-Bold").text("CLIENT", 50, y);
  doc.fillColor(NAVY).fontSize(11).font("Helvetica-Bold").text(raisonSociale || "—", 50, y + 14);
  let localY = y + 32;
  if (adresse) {
    doc.fillColor(SLATE).fontSize(9).font("Helvetica");
    const addrHeight = doc.heightOfString(adresse, { width: colWidth });
    doc.text(adresse, 50, localY, { width: colWidth });
    localY += addrHeight + 4;
  }
  const idParts = [ice && `ICE : ${ice}`, identifiantFiscal && `IF : ${identifiantFiscal}`, rc && `RC : ${rc}`].filter(Boolean);
  let idHeight = 0;
  if (idParts.length) {
    doc.fillColor(SLATE).fontSize(9).font("Helvetica");
    idHeight = doc.heightOfString(idParts.join("   "), { width: colWidth });
    doc.text(idParts.join("   "), 50, localY, { width: colWidth });
  }
  const leftBottom = localY + idHeight;

  doc.fillColor(SLATE).fontSize(9).font("Helvetica-Bold").text("DATE D'EMISSION", 350, y, { width: 195, align: "right" });
  doc.fillColor(NAVY).fontSize(10).font("Helvetica").text(dateEmission || "—", 350, y + 14, { width: 195, align: "right" });
  let rightBottom = y + 30;
  if (dateAutreLabel) {
    doc.fillColor(SLATE).fontSize(9).font("Helvetica-Bold").text(dateAutreLabel, 350, y + 34, { width: 195, align: "right" });
    doc.fillColor(NAVY).fontSize(10).font("Helvetica").text(dateAutre || "—", 350, y + 48, { width: 195, align: "right" });
    rightBottom = y + 64;
  }

  return Math.max(leftBottom, rightBottom) + 24;
}

function drawTotals(doc, y, { montantHt, tauxTva, montantTva, montantTtc }) {
  const x = 335;
  const w = 210;
  doc.fontSize(10).font("Helvetica").fillColor(SLATE);
  doc.text("Total HT", x, y, { width: 110 });
  doc.text(formatMAD(montantHt), x + 110, y, { width: 100, align: "right" });
  doc.text(`TVA (${tauxTva}%)`, x, y + 18, { width: 110 });
  doc.text(formatMAD(montantTva), x + 110, y + 18, { width: 100, align: "right" });
  doc.moveTo(x, y + 36).lineTo(x + w, y + 36).strokeColor("#e2e8f0").stroke();
  doc.font("Helvetica-Bold").fillColor(NAVY).fontSize(12);
  doc.text("Total TTC", x, y + 44, { width: 110 });
  doc.text(formatMAD(montantTtc), x + 110, y + 44, { width: 100, align: "right" });
  return y + 75;
}

function drawFooter(doc, notes) {
  doc.fontSize(8).fillColor("#94a3b8").font("Helvetica")
    .text("Document genere par Pilotage Commercial & Marketing — Smart Industry", 50, 760, { width: 495, align: "center" });
  if (notes) {
    // Largeur limitee a la colonne de gauche pour ne pas passer sous le bloc cachet/signature.
    doc.fontSize(9).fillColor(SLATE).font("Helvetica-Bold").text("Notes", 50, 635);
    doc.fontSize(9).fillColor(SLATE).font("Helvetica").text(notes, 50, 649, { width: 280 });
  }
}

const OFFRE_STATUT_LABELS = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

export async function generateOffrePdf(offre, lignes, company) {
  const montantHt = lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0), 0);
  const tauxTva = Number(offre.taux_tva) || 0;
  const montantTva = montantHt * (tauxTva / 100);
  const montantTtc = montantHt + montantTva;

  return renderToBuffer((doc) => {
    drawHeader(doc, { docTitle: "OFFRE", numero: offre.numero, statutLabel: OFFRE_STATUT_LABELS[offre.statut], company });
    let y = drawClientBlock(doc, 130, {
      raisonSociale: offre.client_raison_sociale,
      adresse: offre.client_adresse,
      ice: offre.client_ice,
      identifiantFiscal: offre.client_identifiant_fiscal,
      rc: offre.client_rc,
      dateEmission: offre.date_emission,
      dateAutre: offre.date_validite,
      dateAutreLabel: "VALIDE JUSQU'AU",
    });

    doc.fillColor(NAVY).fontSize(11).font("Helvetica-Bold").text(offre.objet || "", 50, y);
    y += 25;

    // Entete du tableau des lignes
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#fff");
    doc.rect(50, y, 495, 22).fill(NAVY);
    doc.fillColor("#fff").text("Désignation", 58, y + 6, { width: 250 });
    doc.text("Qté", 315, y + 6, { width: 50, align: "right" });
    doc.text("Prix unit. HT", 370, y + 6, { width: 80, align: "right" });
    doc.text("Total HT", 460, y + 6, { width: 78, align: "right" });
    y += 22;

    doc.font("Helvetica").fontSize(9.5);
    lignes.forEach((l, i) => {
      const totalLigne = Number(l.quantite || 0) * Number(l.prix_unitaire_ht || 0);
      const designation = l.designation || "";
      // Hauteur dynamique : une designation longue passe sur plusieurs lignes et
      // ne doit pas chevaucher la ligne suivante ou le total juste en dessous.
      const designationHeight = doc.heightOfString(designation, { width: 250 });
      const rowH = Math.max(20, designationHeight + 10);
      if (i % 2 === 1) doc.rect(50, y, 495, rowH).fill("#f8fafc");
      doc.fillColor(NAVY).text(designation, 58, y + 5, { width: 250 });
      doc.text(String(l.quantite ?? ""), 315, y + 5, { width: 50, align: "right" });
      doc.text(formatMAD(l.prix_unitaire_ht), 370, y + 5, { width: 80, align: "right" });
      doc.text(formatMAD(totalLigne), 460, y + 5, { width: 78, align: "right" });
      y += rowH;
    });
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e2e8f0").stroke();
    y += 20;

    drawTotals(doc, y, { montantHt, tauxTva, montantTva, montantTtc });
    drawSignatureBlock(doc, company);
    drawFooter(doc, offre.notes);
  });
}

const FACTURE_STATUT_LABELS = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

export async function generateFacturePdf(facture, affaire, company) {
  const montantHt = Number(facture.montant_ht) || 0;
  const tauxTva = Number(facture.taux_tva) || 0;
  const montantTva = montantHt * (tauxTva / 100);
  const montantTtc = montantHt + montantTva;

  return renderToBuffer((doc) => {
    drawHeader(doc, { docTitle: "FACTURE", numero: facture.numero, statutLabel: FACTURE_STATUT_LABELS[facture.statut], company });
    let y = drawClientBlock(doc, 130, {
      raisonSociale: affaire?.client_raison_sociale,
      adresse: affaire?.client_adresse,
      ice: affaire?.client_ice,
      identifiantFiscal: affaire?.client_identifiant_fiscal,
      rc: affaire?.client_rc,
      dateEmission: facture.date_emission,
      dateAutre: facture.date_echeance,
      dateAutreLabel: "ECHEANCE",
    });

    doc.fillColor(SLATE).fontSize(9).font("Helvetica-Bold").text("AFFAIRE", 50, y);
    doc.fillColor(NAVY).fontSize(10).font("Helvetica").text(`${affaire?.numero || ""} — ${affaire?.titre || ""}`, 50, y + 14);
    y += 40;

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#fff");
    doc.rect(50, y, 495, 22).fill(NAVY);
    doc.fillColor("#fff").text("Désignation", 58, y + 6, { width: 380 });
    doc.text("Montant HT", 460, y + 6, { width: 78, align: "right" });
    y += 22;

    doc.font("Helvetica").fontSize(9.5).fillColor(NAVY);
    doc.text(facture.objet || "", 58, y + 5, { width: 380 });
    doc.text(formatMAD(montantHt), 460, y + 5, { width: 78, align: "right" });
    y += 26;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#e2e8f0").stroke();
    y += 20;

    drawTotals(doc, y, { montantHt, tauxTva, montantTva, montantTtc });
    drawSignatureBlock(doc, company);
    drawFooter(doc, facture.notes);
  });
}
