/**
 * documentExtract.js — reads an uploaded supplier invoice / delivery receipt (photo or PDF) and returns its details as
 * structured JSON, so the Goods Receipt and Supplier Invoice forms can be pre-filled. Mounted at /purchase-extract.
 *
 *   POST /   { kind: "invoice" | "receipt", fileData: "data:<mime>;base64,..." }  →  { supplierName, invoiceNo, lines: [...] ... }
 *
 * The reading is done by the Claude API (vision / PDF). It needs ANTHROPIC_API_KEY in the server environment; without it the
 * route answers 503 and the forms simply stay manual. NOTHING is saved here — the user reviews the pre-filled form first.
 */
const express = require("express");
const { validateDataUrlFile, safeErrorMessage } = require("../../core/validation");

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_EXTRACT_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const WINDOW_MS = 60 * 1000, MAX_PER_WINDOW = 8;
const hits = new Map(); // userId → [timestamps]

const PROMPT = (kind) => `You are reading a ${kind === "invoice" ? "supplier tax invoice / bill" : "supplier delivery note / goods receipt / bill"} for a restaurant's purchasing system.
Return ONLY one JSON object, no prose, no markdown fences, with exactly these keys:
{
  "supplierName": string|null,
  "supplierGstin": string|null,
  "invoiceNo": string|null,
  "deliveryNoteNo": string|null,
  "poNo": string|null,
  "date": "YYYY-MM-DD"|null,
  "dueDate": "YYYY-MM-DD"|null,
  "vehicleNo": string|null,
  "freight": number|null,
  "otherCharges": number|null,
  "totalAmount": number|null,
  "lines": [ { "description": string, "qty": number, "unit": string|null, "unitPrice": number|null, "discountPct": number|null, "gstRate": number|null, "batchNo": string|null, "expiryDate": "YYYY-MM-DD"|null } ]
}
Rules: copy values exactly as printed; never guess or invent a value — use null when it is not on the document. Numbers are plain numbers (no currency symbols or thousands separators). "unitPrice" is the rate per unit before GST. "gstRate" is the percentage (e.g. 5, 12, 18). Include every item row, in order. Dates must be converted to YYYY-MM-DD (Indian documents are day-first).`;

function toNum(v) { const n = typeof v === "string" ? Number(v.replace(/[, ₹]/g, "")) : Number(v); return Number.isFinite(n) ? n : null; }
function toDate(v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
const toStr = (v, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function normalize(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const lines = (Array.isArray(o.lines) ? o.lines : []).slice(0, 200).map((l) => ({
    description: toStr(l && l.description, 200) || "",
    qty: toNum(l && l.qty),
    unit: toStr(l && l.unit, 20),
    unitPrice: toNum(l && l.unitPrice),
    discountPct: toNum(l && l.discountPct),
    gstRate: toNum(l && l.gstRate),
    batchNo: toStr(l && l.batchNo, 60),
    expiryDate: toDate(l && l.expiryDate),
  })).filter((l) => l.description);
  return {
    supplierName: toStr(o.supplierName, 150), supplierGstin: toStr(o.supplierGstin, 20), invoiceNo: toStr(o.invoiceNo, 60),
    deliveryNoteNo: toStr(o.deliveryNoteNo, 60), poNo: toStr(o.poNo, 60), date: toDate(o.date), dueDate: toDate(o.dueDate),
    vehicleNo: toStr(o.vehicleNo, 30), freight: toNum(o.freight), otherCharges: toNum(o.otherCharges), totalAmount: toNum(o.totalAmount), lines,
  };
}

function parseJson(text) {
  const t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* ignore */ } }
  return null;
}

function buildExtractRouter({ requireAuth, requirePerm }) {
  const router = express.Router();
  router.use(requireAuth);

  // the permission needed depends on what is being read: receipts need receiving rights, invoices need invoice rights
  const gate = (req, res, next) => requirePerm(req.body && req.body.kind === "receipt" ? "purchaseReceiving" : "purchaseInvoices", "write")(req, res, next);

  router.post("/", gate, async (req, res) => {
    try {
      const kind = req.body && req.body.kind === "receipt" ? "receipt" : "invoice";

      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(503).json({ error: "Reading documents is not set up on this server (ANTHROPIC_API_KEY is missing). Fill the form by hand.", code: "EXTRACT_NOT_CONFIGURED" });

      const uid = String((req.admin && req.admin.id) || req.ip);
      const now = Date.now();
      const recent = (hits.get(uid) || []).filter((t) => now - t < WINDOW_MS);
      if (recent.length >= MAX_PER_WINDOW) return res.status(429).json({ error: "Too many documents read in a minute. Please wait and try again." });
      hits.set(uid, [...recent, now]);

      const check = validateDataUrlFile(req.body && req.body.fileData);
      if (!check.ok) return res.status(400).json({ error: check.error });
      const isPdf = check.mimeType === "application/pdf";
      if (!isPdf && !IMAGE_TYPES.has(check.mimeType)) return res.status(400).json({ error: "Upload a photo (JPG / PNG / WEBP) or a PDF." });
      const data = req.body.fileData.slice(req.body.fileData.indexOf(",") + 1);

      const r = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL, max_tokens: 4096,
          messages: [{ role: "user", content: [
            { type: isPdf ? "document" : "image", source: { type: "base64", media_type: check.mimeType, data } },
            { type: "text", text: PROMPT(kind) },
          ] }],
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) {
        console.error("[extract] model API", r.status, (await r.text().catch(() => "")).slice(0, 300));
        return res.status(502).json({ error: "The document could not be read right now. Please fill the form by hand or try again." });
      }
      const body = await r.json();
      const text = (body.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      const parsed = parseJson(text);
      if (!parsed) return res.status(422).json({ error: "Could not find any details in that file. Try a clearer photo or PDF." });
      res.json(normalize(parsed));
    } catch (err) {
      console.error("[extract] failed:", err && err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });
  return router;
}

module.exports = { buildExtractRouter, normalize, parseJson };
