/**
 * docExtract.js — shared helpers for "upload the real invoice / receipt and fill the form from it" (Goods Receipts and
 * Supplier Invoices). The file is read on the server (POST /purchase-extract); these helpers upload it, then match what
 * was read against the suppliers, purchase orders and inventory items that already exist. Anything that does not match
 * (a new product, an unknown supplier) is NOT invented: it is reported back so it can be entered by hand.
 */
import React, { useRef, useState } from "react";
import api from "../../api";
import { Btn, errText } from "./InvUi";

const MAX_BYTES = 4.5 * 1024 * 1024;

const toDataUrl = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });

/** Phone photos are often > 5 MB: shrink images to at most 2000 px (JPEG) before upload. PDFs are sent as they are. */
async function prepare(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BYTES) throw new Error("That PDF is larger than 4.5 MB. Upload a smaller file or a photo.");
    return toDataUrl(file);
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Upload a photo (JPG / PNG / WEBP) or a PDF.");
  const url = await toDataUrl(file);
  if (file.size <= 1.5 * 1024 * 1024) return url;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

export async function extractDocument(file, kind) {
  const fileData = await prepare(file);
  return (await api.post("/purchase-extract", { kind, fileData }, { timeout: 90000 })).data;
}

/* ── matching ─────────────────────────────────────────────────────── */
const STOP = new Set(["and", "the", "of", "pvt", "ltd", "limited", "private", "co", "company", "traders", "trading", "enterprises", "stores", "agencies", "pack", "fresh"]);
const tokens = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t));
/** 0..1 similarity of two names: shared words (a name that contains the other counts fully). */
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  const sb = new Set(B);
  const shared = A.filter((t) => sb.has(t)).length;
  return shared / Math.min(A.length, B.length) * 0.6 + shared / Math.max(A.length, B.length) * 0.4;
}
/** Best entry of `list` for `name` (score ≥ min), or null. */
export function bestMatch(name, list, getName, min = 0.6) {
  let best = null, score = 0;
  (list || []).forEach((x) => { const s = similarity(name, getName(x)); if (s > score) { best = x; score = s; } });
  return score >= min ? best : null;
}
const sameUnit = (a, b) => String(a || "").toLowerCase().replace(/s$/, "") === String(b || "").toLowerCase().replace(/s$/, "");
export const pickUnit = (docUnit, allowed, fallback) => (allowed || []).find((u) => sameUnit(u, docUnit)) || fallback;
export const numStr = (v) => (v === null || v === undefined ? "" : String(v));

/* ── upload control ───────────────────────────────────────────────── */
export function DocAutofill({ kind, onExtracted, toast, disabled }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setName(file.name);
    try {
      const data = await extractDocument(file, kind);
      if (!data.lines.length && !data.invoiceNo && !data.supplierName) { toast.error("Nothing could be read from that file. Try a clearer photo or PDF."); return; }
      await onExtracted(data);
    } catch (err) { toast.error(errText(err, "Could not read that document")); }
    finally { setBusy(false); }
  };
  return (
    <div className="inv-card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={pick} />
      <Btn type="button" kind="plain" disabled={busy || disabled} onClick={() => ref.current && ref.current.click()}>{busy ? "Reading document…" : `Upload ${kind === "invoice" ? "invoice" : "receipt"} to fill the form`}</Btn>
      <span className="inv-muted">{busy ? `Reading ${name}…` : "Photo or PDF. Details are filled in for you to check — new products must be added by hand."}</span>
    </div>
  );
}
