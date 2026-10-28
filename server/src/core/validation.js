/**
 * validation.js — Dishky Server
 * ─────────────────────────────────────────────────────────────────────────
 * Small, dependency-free, reusable server-side validation helpers.
 *
 * Context: most of this API's write routes operate on schemaless/generic
 * Mongoose models (see ARRAY_COLLECTIONS in server.js) so there's no
 * central schema layer validating request bodies before they reach the
 * database. These helpers are the centralized place for the checks that
 * DO apply regardless of collection — string length/type, enum
 * membership, and (most importantly) base64 file-upload validation —
 * so routes can opt into them without duplicating ad-hoc checks.
 *
 * These are deliberately narrow and explicit rather than a generic
 * schema-validation library: the existing collections don't have fixed
 * shapes, so "validate everything against a schema" isn't available
 * without a larger migration. What's here targets the specific
 * high-risk input types (untrusted file uploads, free-text fields,
 * identifiers used to build filenames) rather than attempting to
 * whitelist every field of every collection.
 */

/* ─────────────────────────────────────────
   FILE UPLOADS (base64 data URLs)
   Used wherever a file is accepted as a `data:<mime>;base64,...` string
   — staff idProof/bonafide/training[].certificate (server.js), documents
   (documents.js), and any future field following the same pattern.
───────────────────────────────────────── */

// Allow-list: images, PDFs, and Word docs cover every legitimate use in
// this app (ID proofs, bonafide certificates, training certificates,
// general documents). Deliberately excludes SVG (can carry embedded
// script and is rendered inline by browsers — an SVG "image" is not a
// safe image), executables, and any script-capable type.
const ALLOWED_FILE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword", // legacy .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — generous for ID proofs/certificates, not for video/large media

const DATA_URL_RE = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/;

/**
 * FILE_SIGNATURES — known magic-byte prefixes for every MIME type in
 * ALLOWED_FILE_MIME_TYPES. This is the actual "never trust the
 * client-declared MIME type" check: validateDataUrlFile previously only
 * checked the `data:<mime>;` string the CLIENT chose to put in the data
 * URL — nothing stopped a renamed executable or arbitrary bytes from
 * being uploaded with a lying `data:image/png;base64,` prefix, since
 * that prefix is just a string the browser/attacker supplies, not
 * something the server had independently verified against the actual
 * bytes. Checking the decoded buffer's real leading bytes against the
 * format's known signature closes that gap for every allow-listed type.
 *
 * .docx is technically a ZIP container (signature "PK\x03\x04", shared
 * with plain ZIP and legacy .xlsx/.pptx) — there's no stronger
 * container-level signature to distinguish "a real docx" from "some
 * other zip" without actually parsing its internal manifest, which is
 * out of scope here; the ZIP signature check still correctly rejects
 * anything that isn't ZIP-shaped at all (e.g. an executable, a plain
 * text file, an image renamed to claim to be a .docx).
 */
const FILE_SIGNATURES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  // WEBP: "RIFF" .... "WEBP" — bytes 8-11 are a file-size field that
  // varies per file, so the check below matches bytes 0-3 and 8-11
  // separately rather than as one contiguous prefix.
  "image/webp": "RIFF....WEBP",
  "application/pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]], // "%PDF-"
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // legacy OLE Compound File
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    [0x50, 0x4b, 0x03, 0x04], // ZIP local-file-header signature ("PK\x03\x04")
    [0x50, 0x4b, 0x05, 0x06], // ZIP empty-archive signature (rare, but valid)
  ],
};

/** True if `buffer` starts with the exact byte sequence `sig`. */
function bufferStartsWith(buffer, sig) {
  if (buffer.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buffer[i] !== sig[i]) return false;
  }
  return true;
}

/**
 * matchesFileSignature(mimeType, buffer) — true if the decoded file
 * content's actual leading bytes match what `mimeType` claims to be.
 */
function matchesFileSignature(mimeType, buffer) {
  const spec = FILE_SIGNATURES[mimeType];
  if (!spec) return true; // no signature defined for this type — nothing to check against
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.slice(0, 4).toString("ascii") === "RIFF" &&
      buffer.slice(8, 12).toString("ascii") === "WEBP"
    );
  }
  return spec.some((sig) => bufferStartsWith(buffer, sig));
}

/**
 * validateDataUrlFile(dataUrl) — checks a `data:<mime>;base64,<data>`
 * string against the MIME allow-list and a max size, WITHOUT trusting
 * the client-declared MIME type alone: the declared type must appear
 * in the allow-list AND the decoded byte length must be under the cap.
 * (Deep content-sniffing / magic-byte verification is not done here —
 * that would need a dependency this project doesn't have — but this
 * closes the two cheapest attack paths: disallowed types, e.g. SVG/
 * HTML/executables, and unbounded upload size.)
 *
 * Returns { ok: true, mimeType, byteLength } or { ok: false, error }.
 * Callers should reject the write (400) when ok is false.
 */
function validateDataUrlFile(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl) {
    return { ok: false, error: "File data is missing or not a string" };
  }
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) {
    return { ok: false, error: "File must be a valid base64 data URL" };
  }
  const [, mimeType, base64Data] = match;
  if (!ALLOWED_FILE_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: `File type "${mimeType}" is not allowed. Allowed types: images, PDF, Word documents.` };
  }
  // Decoded size ≈ base64 length * 3/4 (minus padding) — close enough
  // for a size cap without actually allocating a Buffer for every check.
  const paddingLength = (base64Data.match(/=+$/) || [""])[0].length;
  const byteLength = Math.floor((base64Data.length * 3) / 4) - paddingLength;
  if (byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: `File is too large (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB)` };
  }
  // Real content check: decode just the leading bytes (well under the
  // full file) and verify they actually match what mimeType claims —
  // the client-declared `data:<mime>;` prefix alone is not proof of
  // content, only of what the uploader's browser/script chose to say.
  // 16 base64 chars decode to 12 bytes, comfortably covering every
  // signature in FILE_SIGNATURES (WEBP's is the longest check, at 12).
  const headBytes = Buffer.from(base64Data.slice(0, 24), "base64");
  if (!matchesFileSignature(mimeType, headBytes)) {
    return {
      ok: false,
      error: `File content does not match the declared type "${mimeType}" (failed signature check)`,
    };
  }
  return { ok: true, mimeType, byteLength };
}

/**
 * validateOptionalDataUrlFile(dataUrl) — same as validateDataUrlFile but
 * treats "" / null / undefined as valid (field simply not set), for the
 * common case of an optional attachment field.
 */
function validateOptionalDataUrlFile(dataUrl) {
  if (dataUrl === undefined || dataUrl === null || dataUrl === "") {
    return { ok: true, mimeType: null, byteLength: 0 };
  }
  return validateDataUrlFile(dataUrl);
}

/* ─────────────────────────────────────────
   PRIMITIVE FIELD VALIDATORS
───────────────────────────────────────── */

/** isNonEmptyString(v, { maxLength }) */
function isNonEmptyString(value, { maxLength = 1000 } = {}) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/** isValidEnum(v, allowedValues) */
function isValidEnum(value, allowedValues) {
  return allowedValues.includes(value);
}

/** isSafeId(v) — the app's own generated ids (e.g. "staff_..._abc123",
 * "training_...") are always plain ASCII word characters + underscores/
 * hyphens. Used to sanity-check any id taken from a request body before
 * it's used to build a filename or matched against another record,
 * rejecting anything containing path-traversal or injection-style
 * characters ("../", null bytes, etc). Does not enforce a specific
 * prefix — just a safe character set and reasonable length. */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
function isSafeId(value) {
  return typeof value === "string" && SAFE_ID_RE.test(value);
}

/**
 * sanitizeFilename(name) — strips path separators and traversal
 * sequences from a client-supplied filename before it's ever used to
 * build a path or a Content-Disposition header. Never returns "" for a
 * non-empty input — falls back to "file" so callers always get a safe,
 * non-empty name.
 */
function sanitizeFilename(name) {
  if (typeof name !== "string" || !name.trim()) return "file";
  const base = name
    .replace(/[/\\]/g, "_")      // path separators
    .replace(/\.\./g, "_")        // traversal sequences
    .replace(/[\u0000-\u001f]/g, "") // control characters
    .trim();
  return base.slice(0, 200) || "file";
}

/**
 * asPlainString(v) — returns v if it's a plain string, otherwise "".
 * Use this on any value taken from req.query/req.body BEFORE putting it
 * into a MongoDB filter object. Express's query-string parser (qs)
 * turns bracket syntax like `?venueId[$ne]=null` into a nested object
 * ({ venueId: { $ne: "null" } }) — if that object is dropped straight
 * into a Mongoose filter as `{ venueId: req.query.venueId }`, the
 * caller has just injected a MongoDB query operator, potentially
 * bypassing scoping (e.g. venue isolation) or matching unintended
 * documents. Numbers/booleans are also rejected here (not just
 * objects) since a filter value should be the exact expected type,
 * not "whatever coerces".
 */
function asPlainString(value) {
  return typeof value === "string" ? value : "";
}

/**
 * checkPayloadShape(value, { maxStringLength, maxDepth, maxArrayLength })
 * — walks an already-parsed JSON body and rejects it if any string field
 * is absurdly long, any array is absurdly large, or the object nesting
 * is absurdly deep. This is NOT a substitute for real per-field
 * validation (it doesn't know that "role" should be an enum, or that
 * "email" should look like an email) — it's a cheap, centralized safety
 * net for the ~28 generic/schemaless collections in server.js that have
 * no per-field schema at all, so a client can't wedge a multi-megabyte
 * string into an arbitrary field (a resource-exhaustion / stored-junk
 * risk) just because nothing was there to stop it. File-upload fields
 * (base64 data URLs) are validated separately and more precisely by
 * validateDataUrlFile — this generic cap intentionally allows a longer
 * string length so it doesn't collide with legitimate file fields;
 * routes that accept files should still call validateDataUrlFile too.
 *
 * Returns null if the value is within limits, or a short string
 * describing the first violation found (path + reason) if not.
 */
// Field names that legitimately hold base64 file data and can therefore
// be far longer than any ordinary text field — these are validated
// separately (and far more precisely, via MIME allow-list + byte size)
// by validateDataUrlFile at their actual write sites, so the generic
// string-length cap here would otherwise reject legitimate uploads
// before ever reaching that real check.
const FILE_DATA_FIELD_NAMES = new Set([
  "idProof", "bonafide", "certificate", "fileData",
  "thumbnailData", "idProofThumbnail", "bonafideThumbnail", "certificateThumbnail",
  "photo", "image",
  "images", // event images (array of compressed data URLs); the 10 MB request-body limit still caps the total
  "dataUrl", // support-ticket attachments; real size/type limits are enforced in support/uploads.js
]);

function checkPayloadShape(value, {
  maxStringLength = 20000,   // generous — long notes/descriptions are legitimate; base64 files are far larger and are exempted by field name (see FILE_DATA_FIELD_NAMES) and checked separately
  maxDepth = 8,
  maxArrayLength = 1000,
  path = "body",
  depth = 0,
  fieldName = null,
} = {}) {
  if (depth > maxDepth) return `${path}: object nesting exceeds ${maxDepth} levels`;
  if (typeof value === "string") {
    const isFileField = fieldName && FILE_DATA_FIELD_NAMES.has(fieldName);
    const effectiveLimit = isFileField ? MAX_FILE_BYTES * 2 : maxStringLength; // *2: base64 encoding overhead over raw byte size
    if (value.length > effectiveLimit) {
      return `${path}: string exceeds ${effectiveLimit} characters`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > maxArrayLength) {
      return `${path}: array exceeds ${maxArrayLength} items`;
    }
    for (let i = 0; i < value.length; i++) {
      const err = checkPayloadShape(value[i], { maxStringLength, maxDepth, maxArrayLength, path: `${path}[${i}]`, depth: depth + 1, fieldName });
      if (err) return err;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      // Reject keys that could be interpreted as Mongo operators or
      // prototype-pollution vectors if this object is later merged into
      // a query or a plain JS object elsewhere in the codebase.
      if (key.startsWith("$") || key === "__proto__" || key === "constructor" || key === "prototype") {
        return `${path}.${key}: field names may not start with "$" or target object internals`;
      }
      const err = checkPayloadShape(value[key], { maxStringLength, maxDepth, maxArrayLength, path: `${path}.${key}`, depth: depth + 1, fieldName: key });
      if (err) return err;
    }
    return null;
  }
  return null; // numbers, booleans, null, undefined — nothing to check
}

/**
 * payloadShapeGuard — Express middleware wrapping checkPayloadShape.
 * Mount once, globally, after express.json(). Skips GET/DELETE (no
 * meaningful body) and lets multipart/other content types pass through
 * untouched (this only inspects req.body once express.json() has
 * already parsed it into an object).
 */
function payloadShapeGuard(req, res, next) {
  if (!req.body || typeof req.body !== "object" || (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH")) {
    return next();
  }
  const err = checkPayloadShape(req.body);
  if (err) {
    return res.status(400).json({ error: `Request rejected: ${err}` });
  }
  next();
}

/**
 * safeErrorMessage(err) — the message text safe to send in an API error
 * response, vs. what should only ever go to console.error/logs.
 *
 * Context: this codebase's routes overwhelmingly do
 *   catch (err) { console.error(...); res.status(500).json({ error: err.message }) }
 * across every module. For an *expected*, deliberately-thrown error
 * (e.g. `new Error("orderId and a positive amount are required")`)
 * that's fine — the message IS the intended user-facing text. But for
 * an *unexpected* error surfacing from the database driver/ORM layer
 * (a Mongoose ValidationError, CastError, duplicate-key error, a
 * connection failure, etc.), `err.message` routinely contains internal
 * schema field names, collection/model names, and validator internals
 * — e.g. `Test validation failed: age: Cast to Number failed for value
 * "x" (type string) at path "age"` or a duplicate-key error naming the
 * exact index. None of that should reach a client; it's exactly the
 * kind of internal detail a database-security review calls out.
 *
 * This can't perfectly distinguish "a route deliberately threw this
 * message for the user" from "the database layer threw this at us" —
 * there's no such flag on a bare `Error`. What it CAN safely do is
 * recognize the specific error shapes that come from Mongoose/MongoDB
 * itself (by `name`/`code`, not by guessing from message content) and
 * replace ONLY those with a generic, safe message — every other error
 * (including routes' own `new Error("...")` validation messages, which
 * carry no such name/code) passes through unchanged, so no legitimate
 * user-facing message anywhere in the app is affected by this change.
 */
function safeErrorMessage(err) {
  if (!err) return "An unexpected error occurred";
  // Mongoose/MongoDB-shaped errors — never forward these verbatim.
  const DB_ERROR_NAMES = new Set([
    "ValidationError",   // schema validation failure — names fields/paths
    "CastError",         // type coercion failure — names the field/path
    "MongoServerError",  // driver-level errors, incl. duplicate key (code 11000)
    "MongooseError",
    "MongoError",
    "VersionError",
    "StrictModeError",
    "DocumentNotFoundError",
  ]);
  if (DB_ERROR_NAMES.has(err.name) || typeof err.code === "number") {
    if (err.code === 11000 || /duplicate key/i.test(err.message || "")) {
      return "A record with these details already exists";
    }
    return "A database error occurred while processing this request";
  }
  return err.message || "An unexpected error occurred";
}

module.exports = {
  ALLOWED_FILE_MIME_TYPES,
  MAX_FILE_BYTES,
  validateDataUrlFile,
  validateOptionalDataUrlFile,
  isNonEmptyString,
  isValidEnum,
  isSafeId,
  sanitizeFilename,
  asPlainString,
  checkPayloadShape,
  payloadShapeGuard,
  safeErrorMessage,
  matchesFileSignature,
};
