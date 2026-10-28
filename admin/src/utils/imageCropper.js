/**
 * imageCropper - crop / move / resize step for every image picked with a file input.
 *
 * Installed once at start-up. When a file input's selection contains an image, the browser's
 * `change` event is held back and a modal opens with the picture and a crop box:
 *   - drag the box to move it, drag its handles to resize it
 *   - optional aspect presets (Free, 1:1, 4:3, 3:4, 16:9)
 *   - Confirm swaps the picked file for the cropped one (untouched if the box still covers
 *     the whole picture); Cancel drops the picture
 * then the original `change` event is re-fired, so every page's own handler keeps working
 * unchanged. Several images in one selection are cropped one after another. GIF / SVG files
 * pass through untouched, and an input marked data-no-crop is skipped.
 */
import closeIcon from "../icon/close-icon.png";

const MAX_SIDE = 1600;
const MIN_BOX = 24;
const RATIOS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];

const CSS = `
.modal-overlay.dk-crop-overlay { z-index: 2147483000; }
.admin-modal { width: min(940px, 96vw); min-height: 85vh; max-height: 85vh; }
.admin-modal .admin-modal-body { gap: 12px; }
.dk-crop-hint { font-size: 12.5px; color: #6b7280; }
.dk-crop-stage { position: relative; flex: 0 0 auto; width: 100%; min-height: 475px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 10px; background: #f3f4f6; border-radius: 12px; overflow: hidden; }
.dk-crop-frame { position: relative; flex: 0 0 auto; line-height: 0; overflow: hidden; touch-action: none; }
.dk-crop-frame img { display: block; width: 100%; height: 100%; max-width: none; pointer-events: none; -webkit-user-drag: none; }
.dk-crop-box { position: absolute; box-sizing: border-box; border: 2px solid #fff; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55); cursor: move; touch-action: none;
  background-image: linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px);
  background-size: 33.333% 33.333%; }
.dk-crop-h { position: absolute; width: 14px; height: 14px; box-sizing: border-box; background: #fff; border: 2px solid #2563eb; border-radius: 3px; touch-action: none; }
.dk-crop-h[data-h="nw"] { left: -8px; top: -8px; cursor: nwse-resize; }
.dk-crop-h[data-h="ne"] { right: -8px; top: -8px; cursor: nesw-resize; }
.dk-crop-h[data-h="sw"] { left: -8px; bottom: -8px; cursor: nesw-resize; }
.dk-crop-h[data-h="se"] { right: -8px; bottom: -8px; cursor: nwse-resize; }
.dk-crop-h[data-h="n"] { left: calc(50% - 7px); top: -8px; cursor: ns-resize; }
.dk-crop-h[data-h="s"] { left: calc(50% - 7px); bottom: -8px; cursor: ns-resize; }
.dk-crop-h[data-h="w"] { top: calc(50% - 7px); left: -8px; cursor: ew-resize; }
.dk-crop-h[data-h="e"] { top: calc(50% - 7px); right: -8px; cursor: ew-resize; }
.dk-crop-box.dk-locked .dk-crop-h[data-h="n"], .dk-crop-box.dk-locked .dk-crop-h[data-h="s"],
.dk-crop-box.dk-locked .dk-crop-h[data-h="e"], .dk-crop-box.dk-locked .dk-crop-h[data-h="w"] { display: none; }
.dk-crop-ratios { display: flex; flex-wrap: wrap; gap: 6px; }
.dk-crop-ratio { padding: 5px 12px; font-size: 12.5px; font-weight: 600; color: #374151; background: #fff; border: 1px solid #d1d5db; border-radius: 999px; cursor: pointer; }
.dk-crop-ratio.active { color: #fff; background: #2563eb; border-color: #2563eb; }
`;

let styleReady = false;
function injectStyle() {
  if (styleReady) return;
  styleReady = true;
  const s = document.createElement("style");
  s.setAttribute("data-dishky", "image-cropper");
  s.textContent = CSS;
  document.head.appendChild(s);
}

const EXIT_MS = 220; // same as the admin modals (MODAL_EXIT_DURATION)

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export const isCroppable = (file) => !!file && /^image\/(png|jpe?g|webp|bmp)$/i.test(file.type || "");

/** Opens the crop modal for one image. Resolves with the file to use, or null when cancelled. */
export function cropImageFile(file) {
  injectStyle();
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); }; // can't be decoded here: use it as picked
    img.onload = () => openModal(img, url);
    img.src = url;

    function openModal(image, objectUrl) {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay modal-anim-in";
      overlay.innerHTML = `
        <div class="admin-modal modal-anim-in" role="dialog" aria-modal="true" aria-label="Crop image">
          <div class="admin-modal-header">
            <h3>Crop Image</h3>
            <button type="button" class="modal-cancel-btn dk-crop-x" title="Close" aria-label="Close">
              <span class="shadow"></span><span class="edge"></span>
              <span class="front close-padding"><img src="${closeIcon}" alt="Close" draggable="false" /></span>
            </button>
          </div>
          <div class="admin-modal-body">
            <div class="dk-crop-hint">Drag the box to move it, drag its handles to resize it.</div>
            <div class="dk-crop-stage"><div class="dk-crop-frame"></div></div>
            <div class="dk-crop-ratios"></div>
          </div>
          <div class="admin-modal-footer">
            <button type="button" class="modal-cancel-btn dk-crop-cancel"><span class="shadow"></span><span class="edge"></span><span class="front">Cancel</span></button>
            <button type="button" class="modal-save-btn dk-crop-confirm"><span class="shadow"></span><span class="edge"></span><span class="front">Confirm</span></button>
          </div>
        </div>`;
      const modalEl = overlay.querySelector(".admin-modal");
      const stage = overlay.querySelector(".dk-crop-stage");
      const frame = overlay.querySelector(".dk-crop-frame");
      const view = document.createElement("img");
      view.src = objectUrl;
      view.alt = "";
      view.draggable = false;
      frame.appendChild(view);

      const box = document.createElement("div");
      box.className = "dk-crop-box";
      ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((h) => {
        const d = document.createElement("div");
        d.className = "dk-crop-h";
        d.dataset.h = h;
        box.appendChild(d);
      });
      frame.appendChild(box);

      // Crop rectangle as fractions of the shown image, so it survives a window resize.
      let rect = { x: 0, y: 0, w: 1, h: 1 };
      let ratio = null;
      // Fit (and zoom, when small) the picture into the stage; the crop box follows.
      const fit = () => {
        const aw = Math.max(1, stage.clientWidth - 20);
        const ah = Math.max(1, stage.clientHeight - 20);
        const k = Math.min(aw / image.naturalWidth, ah / image.naturalHeight);
        frame.style.width = `${Math.max(1, Math.floor(image.naturalWidth * k))}px`;
        frame.style.height = `${Math.max(1, Math.floor(image.naturalHeight * k))}px`;
      };
      const size = () => ({ W: view.clientWidth || 1, H: view.clientHeight || 1 });
      const paint = () => {
        const { W, H } = size();
        box.style.left = `${rect.x * W}px`;
        box.style.top = `${rect.y * H}px`;
        box.style.width = `${rect.w * W}px`;
        box.style.height = `${rect.h * H}px`;
        box.classList.toggle("dk-locked", ratio !== null);
      };

      const ratiosEl = overlay.querySelector(".dk-crop-ratios");
      const chips = RATIOS.map((r) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dk-crop-ratio" + (r.value === null ? " active" : "");
        b.textContent = r.label;
        b.addEventListener("click", () => {
          ratio = r.value;
          chips.forEach((c) => c.classList.toggle("active", c === b));
          if (ratio !== null) {
            const { W, H } = size();
            // largest box of this shape that fits, centred where the current box is
            let w = Math.min(W, H * ratio);
            let h = w / ratio;
            const cx = (rect.x + rect.w / 2) * W;
            const cy = (rect.y + rect.h / 2) * H;
            const x = clamp(cx - w / 2, 0, W - w);
            const y = clamp(cy - h / 2, 0, H - h);
            rect = { x: x / W, y: y / H, w: w / W, h: h / H };
          }
          paint();
        });
        ratiosEl.appendChild(b);
        return b;
      });

      // ── drag / resize ───────────────────────────────────────────────
      let drag = null;
      box.addEventListener("pointerdown", (e) => {
        const handle = e.target.dataset && e.target.dataset.h ? e.target.dataset.h : null;
        const { W, H } = size();
        drag = {
          handle,
          sx: e.clientX,
          sy: e.clientY,
          x: rect.x * W, y: rect.y * H, w: rect.w * W, h: rect.h * H,
        };
        try { box.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        e.preventDefault();
      });
      box.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const { W, H } = size();
        const dx = e.clientX - drag.sx;
        const dy = e.clientY - drag.sy;
        let { x, y, w, h } = drag;

        if (!drag.handle) {
          x = clamp(drag.x + dx, 0, W - w);
          y = clamp(drag.y + dy, 0, H - h);
        } else if (ratio === null) {
          let left = drag.x, top = drag.y, right = drag.x + drag.w, bottom = drag.y + drag.h;
          if (drag.handle.includes("w")) left = clamp(drag.x + dx, 0, right - MIN_BOX);
          if (drag.handle.includes("e")) right = clamp(drag.x + drag.w + dx, left + MIN_BOX, W);
          if (drag.handle.includes("n")) top = clamp(drag.y + dy, 0, bottom - MIN_BOX);
          if (drag.handle.includes("s")) bottom = clamp(drag.y + drag.h + dy, top + MIN_BOX, H);
          x = left; y = top; w = right - left; h = bottom - top;
        } else {
          // fixed shape: corners only, the opposite corner stays put
          const east = drag.handle.includes("e");
          const south = drag.handle.includes("s");
          const ax = east ? drag.x : drag.x + drag.w;
          const ay = south ? drag.y : drag.y + drag.h;
          const frameRect = frame.getBoundingClientRect();
          const px = e.clientX - frameRect.left;
          const maxW = east ? W - ax : ax;
          const maxH = south ? H - ay : ay;
          let nw = clamp(east ? px - ax : ax - px, MIN_BOX, maxW);
          let nh = nw / ratio;
          if (nh > maxH) { nh = maxH; nw = nh * ratio; }
          w = nw; h = nh;
          x = east ? ax : ax - w;
          y = south ? ay : ay - h;
        }
        rect = { x: x / W, y: y / H, w: w / W, h: h / H };
        paint();
      });
      const endDrag = () => { drag = null; };
      box.addEventListener("pointerup", endDrag);
      box.addEventListener("pointercancel", endDrag);

      // ── finish ──────────────────────────────────────────────────────
      let finished = false;
      const onResize = () => { fit(); paint(); };
      const close = (result) => {
        if (finished) return;
        finished = true;
        window.removeEventListener("resize", onResize);
        document.removeEventListener("keydown", onKey, true);
        overlay.classList.replace("modal-anim-in", "modal-anim-out");
        modalEl.classList.replace("modal-anim-in", "modal-anim-out");
        setTimeout(() => { overlay.remove(); URL.revokeObjectURL(objectUrl); }, EXIT_MS);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(null); }
      };
      window.addEventListener("resize", onResize);
      document.addEventListener("keydown", onKey, true);

      overlay.querySelector(".dk-crop-cancel").addEventListener("click", () => close(null));
      overlay.querySelector(".dk-crop-x").addEventListener("click", () => close(null));
      overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(null); });
      overlay.querySelector(".dk-crop-confirm").addEventListener("click", () => {
        const { W, H } = size();
        const untouched = rect.x * W <= 1 && rect.y * H <= 1 && rect.w * W >= W - 1 && rect.h * H >= H - 1;
        if (untouched) return close(file);

        const sx = Math.round(rect.x * image.naturalWidth);
        const sy = Math.round(rect.y * image.naturalHeight);
        const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.round(rect.w * image.naturalWidth)));
        const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.round(rect.h * image.naturalHeight)));
        const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sw * scale));
        canvas.height = Math.max(1, Math.round(sh * scale));
        canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        const type = /png/i.test(file.type) ? "image/png" : /webp/i.test(file.type) ? "image/webp" : "image/jpeg";
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        canvas.toBlob(
          (blob) => {
            if (!blob) return close(file);
            const base = (file.name || "image").replace(/\.[^.]+$/, "");
            close(new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() }));
          },
          type,
          0.92
        );
      });

      document.body.appendChild(overlay);
      // the box can only be sized once the picture has been laid out
      fit();
      paint();
      requestAnimationFrame(() => { fit(); paint(); });
    }
  });
}

export function installImageCropper() {
  if (typeof document === "undefined" || window.__dishkyImageCropper) return;
  window.__dishkyImageCropper = true;

  document.addEventListener(
    "change",
    async (e) => {
      const input = e.target;
      if (!input || input.tagName !== "INPUT" || input.type !== "file") return;
      if (input.__dkCropped) { input.__dkCropped = false; return; } // our own re-fired event
      if (input.hasAttribute("data-no-crop")) return;
      const files = Array.from(input.files || []);
      if (!files.some(isCroppable)) return;

      e.stopImmediatePropagation();
      e.stopPropagation();

      const out = [];
      for (const f of files) {
        if (isCroppable(f)) {
          const r = await cropImageFile(f);
          if (r) out.push(r);
        } else {
          out.push(f);
        }
      }
      if (!out.length) { input.value = ""; return; }

      const dt = new DataTransfer();
      out.forEach((f) => dt.items.add(f));
      input.files = dt.files;
      input.__dkCropped = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    true
  );
}

export default installImageCropper;
