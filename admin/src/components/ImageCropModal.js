/**
 * ImageCropModal — crop / move / resize an image before it is used, with Confirm and Cancel.
 * Opened for every image chosen through a file picker in the admin panel (see formEnhancers.js).
 *
 *   <ImageCropModal file={File} onConfirm={(croppedFile) => …} onCancel={() => …} />
 *
 * Drag inside the box to move it, drag a handle to resize it, pick an aspect ratio (or Free) and rotate the picture.
 * The result is cut from the original-resolution pixels, so quality is not lost.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Button3D from "./Button3D";
import "./ImageCropModal.css";

const RATIOS = [["Free", 0], ["1 : 1", 1], ["4 : 3", 4 / 3], ["3 : 4", 3 / 4], ["16 : 9", 16 / 9]];
const MIN = 24;
const MAX_OUT = 2400;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export default function ImageCropModal({ file, onConfirm, onCancel }) {
  const [src, setSrc] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 }); // display pixels
  const [ratio, setRatio] = useState(0);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => { const url = URL.createObjectURL(file); setSrc(url); return () => URL.revokeObjectURL(url); }, [file]);

  // display size of the image: fit inside the stage
  const fit = useCallback(() => {
    const maxW = Math.min(620, window.innerWidth - 80), maxH = Math.min(420, window.innerHeight - 300);
    const s = Math.min(maxW / nat.w, maxH / nat.h, 1);
    return { s, dw: Math.round(nat.w * s), dh: Math.round(nat.h * s) };
  }, [nat]);
  const { s, dw, dh } = nat.w ? fit() : { s: 1, dw: 0, dh: 0 };

  const onLoad = (e) => { setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight }); };
  useEffect(() => { if (nat.w) setBox({ x: 0, y: 0, w: dw, h: dh }); /* eslint-disable-next-line */ }, [nat.w, nat.h]);

  const clampBox = useCallback((b) => {
    const w = Math.max(MIN, Math.min(b.w, dw)), h = Math.max(MIN, Math.min(b.h, dh));
    return { w, h, x: Math.max(0, Math.min(b.x, dw - w)), y: Math.max(0, Math.min(b.y, dh - h)) };
  }, [dw, dh]);

  const pickRatio = (r) => {
    setRatio(r);
    if (!r) return;
    setBox((b) => {
      let w = b.w, h = w / r;
      if (h > dh) { h = dh; w = h * r; }
      if (w > dw) { w = dw; h = w / r; }
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      return clampBox({ x: cx - w / 2, y: cy - h / 2, w, h });
    });
  };

  const down = (mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: box };
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy, b = d.start;
    if (d.mode === "move") { setBox(clampBox({ ...b, x: b.x + dx, y: b.y + dy })); return; }
    let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
    if (d.mode.includes("w")) x1 = Math.min(x1 + dx, x2 - MIN);
    if (d.mode.includes("e")) x2 = Math.max(x2 + dx, x1 + MIN);
    if (d.mode.includes("n")) y1 = Math.min(y1 + dy, y2 - MIN);
    if (d.mode.includes("s")) y2 = Math.max(y2 + dy, y1 + MIN);
    x1 = Math.max(0, x1); y1 = Math.max(0, y1); x2 = Math.min(dw, x2); y2 = Math.min(dh, y2);
    let w = x2 - x1, h = y2 - y1;
    if (ratio) { // keep the ratio, anchored on the opposite corner / edge centre
      if (d.mode.length === 2 || d.mode === "e" || d.mode === "w") h = w / ratio; else w = h * ratio;
      if (d.mode.includes("n")) y1 = y2 - h; else if (d.mode.includes("s") || d.mode === "e" || d.mode === "w") y2 = y1 + h;
      if (d.mode === "n" || d.mode === "s") { x2 = x1 + w; }
      if (y1 < 0) { y1 = 0; h = y2 - y1; w = h * ratio; if (d.mode.includes("w")) x1 = x2 - w; else x2 = x1 + w; }
      if (y2 > dh) { y2 = dh; h = y2 - y1; w = h * ratio; if (d.mode.includes("w")) x1 = x2 - w; else x2 = x1 + w; }
      if (x2 > dw) { x2 = dw; w = x2 - x1; h = w / ratio; if (d.mode.includes("n")) y1 = y2 - h; else y2 = y1 + h; }
      if (x1 < 0) { x1 = 0; w = x2 - x1; h = w / ratio; if (d.mode.includes("n")) y1 = y2 - h; else y2 = y1 + h; }
    }
    setBox(clampBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }));
  };
  const up = () => { drag.current = null; };

  const rotate = async () => {
    const img = imgRef.current; if (!img) return;
    const c = document.createElement("canvas"); c.width = nat.h; c.height = nat.w;
    const g = c.getContext("2d"); g.translate(c.width, 0); g.rotate(Math.PI / 2); g.drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    setNat({ w: 0, h: 0 }); setSrc((old) => { URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
  };

  const confirm = async () => {
    const img = imgRef.current; if (!img) return;
    setBusy(true);
    try {
      const sx = box.x / s, sy = box.y / s, sw = box.w / s, sh = box.h / s;
      const k = Math.min(1, MAX_OUT / Math.max(sw, sh));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const type = /png|webp/.test(file.type) ? file.type : "image/jpeg";
      const blob = await new Promise((r) => c.toBlob(r, type, 0.92));
      const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
      const base = (file.name || "image").replace(/\.[^.]+$/, "");
      onConfirm(new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() }));
    } finally { setBusy(false); }
  };

  useEffect(() => { const k = (e) => e.key === "Escape" && onCancel(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onCancel]);

  return (
    <div className="confirm-overlay crop-overlay" onPointerMove={move} onPointerUp={up}>
      <div className="confirm-card crop-card" role="dialog" aria-modal="true" aria-label="Crop image">
        <div className="confirm-card-header"><h4>Crop image</h4></div>
        <div className="crop-body">
          <div className="crop-toolbar">
            {RATIOS.map(([label, r]) => <button type="button" key={label} className={`filter-pill${ratio === r ? " active" : ""}`} onClick={() => pickRatio(r)}>{label}</button>)}
            <button type="button" className="filter-pill" onClick={rotate}>⟳ Rotate</button>
          </div>
          <div className="crop-stage" style={{ width: dw || undefined, height: dh || undefined }}>
            <img ref={imgRef} src={src} alt="" onLoad={onLoad} draggable={false} style={{ width: dw || "auto", height: dh || "auto" }} />
            {dw > 0 && (
              <div className="crop-box" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} onPointerDown={down("move")}>
                {HANDLES.filter((h) => !ratio || h.length === 2).map((h) => <span key={h} className={`crop-handle crop-handle-${h}`} onPointerDown={down(h)} />)}
              </div>
            )}
          </div>
          <div className="inv-hint crop-size">{dw > 0 ? `${Math.round(box.w / s)} × ${Math.round(box.h / s)} px` : "Loading…"} — drag the box to move it, drag a handle to resize.</div>
        </div>
        <div className="confirm-card-footer confirm-actions">
          <Button3D variant="cancel" onClick={onCancel}>Cancel</Button3D>
          <Button3D onClick={confirm} disabled={busy || !dw}>Confirm</Button3D>
        </div>
      </div>
    </div>
  );
}
