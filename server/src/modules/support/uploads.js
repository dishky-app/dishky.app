/**
 * support/uploads.js — validation for ticket screenshots / diagnostic files.
 *
 * Files arrive as base64 data URLs (the same convention documents.js uses).
 * Binary types go through validation.js (allow-list + magic-byte check). Plain
 * text diagnostics (.txt / .log / .json) are accepted too, but are scanned for
 * credentials because the spec forbids secrets in diagnostic uploads.
 */
const { validateDataUrlFile, sanitizeFilename } = require("../../core/validation");
const { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_REQUEST } = require("./constants");

const TEXT_TYPES = new Set(["text/plain", "application/json", "text/x-log"]);
const TEXT_RE = /^data:(text\/plain|application\/json|text\/x-log)(?:;charset=[\w-]+)?;base64,([A-Za-z0-9+/=]+)$/;

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["']?[^\s"',;]{6,}/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /\bmongodb(\+srv)?:\/\/[^\s:]+:[^\s@]+@/i,
  /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,7}\b/, // card-like number (grouped)
];

/** → { ok:true, name, mime, size, buffer } | { ok:false, error } */
function parseUpload(file) {
  if (!file || typeof file !== "object") return { ok: false, error: "Invalid file." };
  const name = sanitizeFilename(String(file.name || "attachment")).slice(0, 120);
  const dataUrl = file.dataUrl;
  if (typeof dataUrl !== "string") return { ok: false, error: "File data is missing." };

  const t = TEXT_RE.exec(dataUrl);
  if (t) {
    const buffer = Buffer.from(t[2], "base64");
    if (buffer.length > MAX_ATTACHMENT_BYTES) return { ok: false, error: `"${name}" is too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB).` };
    if (buffer.includes(0)) return { ok: false, error: `"${name}" is not a text file.` };
    const text = buffer.toString("utf8");
    if (SECRET_PATTERNS.some((re) => re.test(text))) {
      return { ok: false, error: `"${name}" appears to contain credentials, tokens or card/customer data. Remove them and upload again.` };
    }
    return { ok: true, name, mime: t[1], size: buffer.length, buffer };
  }

  const v = validateDataUrlFile(dataUrl);
  if (!v.ok) return { ok: false, error: `"${name}": ${v.error}` };
  if (v.byteLength > MAX_ATTACHMENT_BYTES) return { ok: false, error: `"${name}" is too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB).` };
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { ok: true, name, mime: v.mimeType, size: v.byteLength, buffer: Buffer.from(b64, "base64") };
}

function parseUploads(files) {
  if (files === undefined || files === null) return { ok: true, files: [] };
  if (!Array.isArray(files)) return { ok: false, error: "attachments must be a list." };
  if (files.length > MAX_ATTACHMENTS_PER_REQUEST) return { ok: false, error: `Attach at most ${MAX_ATTACHMENTS_PER_REQUEST} files at a time.` };
  const out = [];
  for (const f of files) {
    const r = parseUpload(f);
    if (!r.ok) return r;
    out.push(r);
  }
  return { ok: true, files: out };
}

module.exports = { parseUpload, parseUploads, SECRET_PATTERNS };
