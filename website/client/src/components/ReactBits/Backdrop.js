import React, { useEffect, useRef } from "react";

/**
 * Page backdrops, after the React Bits background components (Squares, Dot Grid, Waves, Particles,
 * Aurora, Beams, Grid Distortion), kept deliberately quiet and redrawn in Dishky's
 * palette: brand red plus white (on dark pages) or black (on light pages).
 *
 * Pages pick the one that suits their background; patterns may repeat. Canvas patterns pause while
 * off-screen and draw a single still frame under reduced motion.
 */

const RED = "243,55,22";
const ink = (tone) => (tone === "dark" ? "255,255,255" : "0,0,0");
const k = (tone) => (tone === "dark" ? 1 : 0.62); // light pages need slightly softer lines

/** Shared canvas runner: DPR, resize, visibility pause, pointer (read from the window) and reduced motion. */
function useCanvas(setup) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let api = null;
    let raf = 0;
    let visible = true;
    const build = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      api = setup({ ctx, w: r.width, h: r.height });
      api.frame(0);
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (visible && api) api.frame(t);
    };
    if (!reduce) raf = requestAnimationFrame(loop);
    const move = (e) => {
      if (!api?.pointer) return;
      const r = canvas.getBoundingClientRect();
      api.pointer(e.clientX - r.left, e.clientY - r.top);
    };
    // Under reduced motion nothing animates, but hover-driven patterns still redraw on pointer move.
    let moveRaf = 0;
    const moveStill = (e) => {
      if (!api?.pointer || !api.redrawOnPointer) return;
      move(e);
      cancelAnimationFrame(moveRaf);
      moveRaf = requestAnimationFrame(() => api.frame(0));
    };
    window.addEventListener("pointermove", reduce ? moveStill : move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", reduce ? moveStill : move);
      cancelAnimationFrame(moveRaf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

const Cv = ({ r }) => <canvas ref={r} data-keep-color aria-hidden="true" className="absolute inset-0 h-full w-full" />;

function Squares({ tone, sc = 1 }) {
  const ref = useCanvas(({ ctx, w, h }) => {
    const size = 48 * sc;
    let off = 0;
    let hover = null;
    const lit = new Map();
    const cols = Math.ceil(w / size) + 2;
    const rows = Math.ceil(h / size) + 2;
    return {
      pointer(x, y) {
        hover = x < 0 || y < 0 || x > w || y > h ? null : [Math.floor((x + off) / size), Math.floor((y + off) / size)];
      },
      frame() {
        off = (off + 0.25) % size;
        ctx.clearRect(0, 0, w, h);
        if (hover) lit.set(hover.join(","), 1);
        ctx.lineWidth = 1;
        for (let i = -1; i < cols; i += 1) {
          for (let j = -1; j < rows; j += 1) {
            const x = i * size - off;
            const y = j * size - off;
            const a = lit.get(`${i},${j}`);
            if (a) {
              ctx.fillStyle = `rgba(${ink(tone)},${a * 0.1})`;
              ctx.fillRect(x, y, size, size);
              if (a - 0.02 <= 0) lit.delete(`${i},${j}`);
              else lit.set(`${i},${j}`, a - 0.02);
            }
            ctx.strokeStyle = `rgba(${ink(tone)},${0.09 * k(tone)})`;
            ctx.strokeRect(x + 0.5, y + 0.5, size, size);
          }
        }
      },
    };
  });
  return <Cv r={ref} />;
}

function DotGrid({ tone, sc = 1 }) {
  const ref = useCanvas(({ ctx, w, h }) => {
    const gap = 30 * sc;
    let px = -9999;
    let py = -9999;
    return {
      pointer(x, y) {
        px = x;
        py = y;
      },
      frame(t) {
        ctx.clearRect(0, 0, w, h);
        for (let x = gap / 2; x < w; x += gap) {
          for (let y = gap / 2; y < h; y += gap) {
            const d = Math.hypot(x - px, y - py);
            const near = Math.max(0, 1 - d / 170);
            const pulse = 0.5 + 0.5 * Math.sin(t * 0.0012 + x * 0.01 + y * 0.012);
            const rad = 1.3 + near * 3.2 + pulse * 0.4;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.fillStyle = near > 0.05 ? `rgba(${RED},${0.25 + near * 0.6})` : `rgba(${ink(tone)},${0.16 * k(tone)})`;
            ctx.fill();
          }
        }
      },
    };
  });
  return <Cv r={ref} />;
}

function Waves({ tone }) {
  const ref = useCanvas(({ ctx, w, h }) => {
    const lines = 12;
    return {
      frame(t) {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < lines; i += 1) {
          const base = h * (0.16 + (i / lines) * 0.78);
          ctx.beginPath();
          for (let x = 0; x <= w; x += 8) {
            const y = base + Math.sin(x * 0.006 + t * 0.0004 + i * 0.5) * (14 + i * 2.2) + Math.sin(x * 0.013 - t * 0.0006 + i) * 6;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = i % 4 === 0 ? `rgba(${RED},${0.16 + (i / lines) * 0.22})` : `rgba(${ink(tone)},${(0.06 + (i / lines) * 0.14) * k(tone)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      },
    };
  });
  return <Cv r={ref} />;
}

function Particles({ tone }) {
  const ref = useCanvas(({ ctx, w, h }) => {
    const n = Math.min(70, Math.round((w * h) / 16000));
    const ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: 1 + Math.random() * 1.8, red: Math.random() < 0.22 }));
    let px = -9999;
    let py = -9999;
    return {
      pointer(x, y) {
        px = x;
        py = y;
      },
      frame() {
        ctx.clearRect(0, 0, w, h);
        for (const p of ps) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
        for (let i = 0; i < n; i += 1) {
          for (let j = i + 1; j < n; j += 1) {
            const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
            if (d < 120) {
              ctx.strokeStyle = `rgba(${ink(tone)},${(1 - d / 120) * 0.14 * k(tone)})`;
              ctx.beginPath();
              ctx.moveTo(ps[i].x, ps[i].y);
              ctx.lineTo(ps[j].x, ps[j].y);
              ctx.stroke();
            }
          }
          const dp = Math.hypot(ps[i].x - px, ps[i].y - py);
          if (dp < 150) {
            ctx.strokeStyle = `rgba(${RED},${(1 - dp / 150) * 0.5})`;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(px, py);
            ctx.stroke();
          }
        }
        for (const p of ps) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.red ? `rgba(${RED},0.75)` : `rgba(${ink(tone)},${0.4 * k(tone)})`;
          ctx.fill();
        }
      },
    };
  });
  return <Cv r={ref} />;
}

function Aurora({ tone }) {
  const a = tone === "dark" ? 0.2 : 0.16;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <span className="fx-blob absolute -left-[10%] top-[-20%] h-[60vw] max-h-[640px] w-[60vw] max-w-[640px] rounded-full blur-[110px]" style={{ background: `rgba(${ink(tone)},${a * 0.45})` }} />
      <span className="fx-blob absolute right-[-12%] top-[8%] h-[50vw] max-h-[540px] w-[50vw] max-w-[540px] rounded-full blur-[120px] [animation-delay:-7s] [animation-duration:26s]" style={{ background: `rgba(${ink(tone)},${a * 0.35})` }} />
      <span className="fx-blob absolute bottom-[-30%] left-[30%] h-[45vw] max-h-[500px] w-[45vw] max-w-[500px] rounded-full blur-[100px] [animation-delay:-13s] [animation-duration:30s]" style={{ background: `rgba(${ink(tone)},${tone === "dark" ? 0.08 : 0.06})` }} />
    </div>
  );
}

function Beams({ tone }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {[8, 22, 37, 51, 66, 80, 93].map((l, i) => (
        <span
          key={l}
          className="fx-beam absolute top-[-30%] h-[160%] w-px"
          style={{ left: `${l}%`, background: `linear-gradient(to bottom, transparent, rgba(${i % 3 === 0 ? RED : ink(tone)},${i % 3 === 0 ? 0.55 : 0.28 * k(tone)}), transparent)`, animationDelay: `${-i * 1.7}s`, animationDuration: `${9 + (i % 3) * 3}s` }}
        />
      ))}
    </div>
  );
}










function Warp({ tone }) {
  const ref = useCanvas(({ ctx, w, h }) => {
    const g = 40;
    let px = w / 2;
    let py = h / 2;
    const pt = (x, y) => {
      const dx = x - px;
      const dy = y - py;
      const d = Math.hypot(dx, dy) || 1;
      const f = Math.max(0, 1 - d / 220) * 26;
      return [x - (dx / d) * f, y - (dy / d) * f];
    };
    return {
      pointer(x, y) {
        px = x;
        py = y;
      },
      frame() {
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 1;
        for (let x = 0; x <= w + g; x += g) {
          ctx.beginPath();
          for (let y = 0; y <= h + g; y += 10) {
            const [X, Y] = pt(x, y);
            if (y === 0) ctx.moveTo(X, Y);
            else ctx.lineTo(X, Y);
          }
          ctx.strokeStyle = `rgba(${ink(tone)},${0.11 * k(tone)})`;
          ctx.stroke();
        }
        for (let y = 0; y <= h + g; y += g) {
          ctx.beginPath();
          for (let x = 0; x <= w + g; x += 10) {
            const [X, Y] = pt(x, y);
            if (x === 0) ctx.moveTo(X, Y);
            else ctx.lineTo(X, Y);
          }
          ctx.strokeStyle = `rgba(${RED},0.16)`;
          ctx.stroke();
        }
      },
    };
  });
  return <Cv r={ref} />;
}




/** Landing-page dot field: fixed-size dots on a 26px grid; dots under the pointer turn red (size never changes). */
function DotField({ tone }) {
  const ref = useCanvas(({ ctx, w, h }) => {
    const gap = 26;
    const r = 1.1;
    const reach = 150;
    let px = -9999;
    let py = -9999;
    const base = tone === "dark" ? [255, 255, 255, 0.16] : [0, 0, 0, 0.16];
    const red = [243, 55, 22];
    return {
      redrawOnPointer: true,
      pointer(x, y) {
        px = x;
        py = y;
      },
      frame() {
        ctx.clearRect(0, 0, w, h);
        for (let x = gap / 2; x < w; x += gap) {
          for (let y = gap / 2; y < h; y += gap) {
            const near = Math.max(0, 1 - Math.hypot(x - px, y - py) / reach);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = near > 0 ? `rgba(${red[0]},${red[1]},${red[2]},${base[3] + (1 - base[3]) * Math.min(1, near * 1.6)})` : `rgba(${base[0]},${base[1]},${base[2]},${base[3]})`;
            ctx.fill();
          }
        }
      },
    };
  });
  return <Cv r={ref} />;
}

export const PATTERNS = { squares: Squares, dots: DotGrid, dotfield: DotField, waves: Waves, particles: Particles, aurora: Aurora, beams: Beams, warp: Warp };
export const PATTERN_NAMES = Object.keys(PATTERNS);

/**
 * Drop this inside a `relative isolate` section; it fills the top of it (at most one screen tall) and
 * fades out toward the bottom so the content below stays clean. Use `z="z-0"` when the section holds
 * absolutely-positioned artwork that must sit above it.
 */
export default function Backdrop({ name = "squares", tone = "light", variant = 0, z = "-z-10", className = "" }) {
  const Pattern = PATTERNS[name] || Squares;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${z} ${className}`}
      style={{
        height: "min(100%, max(100svh, 640px))",
        WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, #000 55%, transparent 100%)",
      }}
    >
      <div className="absolute inset-0" style={variant % 2 ? { transform: "scaleX(-1)" } : undefined}>
        <Pattern tone={tone} sc={variant ? 1.6 : 1} />
      </div>
    </div>
  );
}
