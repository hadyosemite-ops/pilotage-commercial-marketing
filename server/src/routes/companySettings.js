import { Router } from "express";
import multer from "multer";
import { get, run } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

// Memoire uniquement (pas de disque) : coherent avec l'import CSV des leads.
// 3 Mo max par image, largement suffisant pour un logo/cachet/signature.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
// PNG/JPEG uniquement : ce sont les seuls formats que pdfkit sait dessiner
// nativement sur les PDF de devis/facture (pas de SVG/WEBP sans lib de conversion).
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg"];

async function ensureRow() {
  const existing = await get("SELECT * FROM company_settings WHERE id = 1");
  if (existing) return existing;
  await run("INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
  return get("SELECT * FROM company_settings WHERE id = 1");
}

router.get("/", ah(async (req, res) => {
  res.json(await ensureRow());
}));

router.put("/", requireAdmin, ah(async (req, res) => {
  const { raison_sociale, adresse, ice, identifiant_fiscal, tp, telephone, email } = req.body || {};
  if (!raison_sociale) return res.status(400).json({ error: "Raison sociale requise" });

  await ensureRow();
  await run(`
    UPDATE company_settings SET raison_sociale=?, adresse=?, ice=?, identifiant_fiscal=?, tp=?, telephone=?, email=?, updated_at=NOW()
    WHERE id = 1
  `, [raison_sociale, adresse || null, ice || null, identifiant_fiscal || null, tp || null, telephone || null, email || null]);

  res.json(await get("SELECT * FROM company_settings WHERE id = 1"));
}));

function uploadField(field, column) {
  return [
    requireAdmin,
    upload.single("file"),
    ah(async (req, res) => {
      if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu (champ 'file')" });
      if (!ALLOWED_MIME.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Format non supporté (PNG ou JPEG uniquement)" });
      }
      await ensureRow();
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      await run(`UPDATE company_settings SET ${column} = ?, updated_at = NOW() WHERE id = 1`, [dataUri]);
      res.json(await get("SELECT * FROM company_settings WHERE id = 1"));
    }),
  ];
}

router.post("/logo", ...uploadField("logo", "logo_data"));
router.post("/cachet", ...uploadField("cachet", "cachet_data"));
router.post("/signature", ...uploadField("signature", "signature_data"));

export default router;
