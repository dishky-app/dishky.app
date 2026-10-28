import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildBurger } from "./buildBurger.js";
import { ScrollTrigger } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

// Horizontal stops (as a fraction of viewport width, of the burger's
// centre) it zigzags between as the page scrolls top to bottom.
// Zigzag between the free margins either side of the content column. Values
// are fractions of the *margin* (0 = outer viewport edge, 1 = inner edge of
// the content column), so the burger swings side to side without crossing
// the centred content.
const SIDES = [1, -1, 1, -1, 1, -1, 1]; // 1 = right margin, -1 = left margin

const CANVAS_SIZE = 210; // px, square

/**
 * A real Three.js burger (lathe-modelled buns/patty, ruffled lettuce,
 * draped cheese, sesame seeds) rendered on a small transparent WebGL
 * canvas that is fixed to the viewport. Its position, spin and tumble
 * are all driven by overall page scroll progress:
 *   - vertical: top -> bottom across the page
 *   - horizontal: zigzags between the left and right edges (see SIDES)
 *   - rotation: revolves around Y (two full turns), tumbles on X,
 *     wobbles on Z, and bobs slightly
 * Desktop only; skipped under prefers-reduced-motion.
 */
export default function Burger3D() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // Skip on narrow screens; the burger would collide with content.
    const mq = window.matchMedia("(min-width: 1024px)");
    if (!mq.matches) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      // WebGL unavailable: fail silently, the page works without it.
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.6, 6.2);
    camera.lookAt(0, 0, 0);

    // Lighting: warm key, cool fill, and a rim so the silhouette pops
    // against both light and dark sections.
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b4a2b, 0.9));
    const key = new THREE.DirectionalLight(0xfff0d6, 2.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbcd4ff, 0.7);
    fill.position.set(-4, 1, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.4);
    rim.position.set(-2, 3, -5);
    scene.add(rim);

    const burger = buildBurger();
    burger.scale.setScalar(1.05);
    scene.add(burger);

    let progress = 0;
    let smoothed = 0;
    let lastCx = 0;
    let lastCy = 0;
    let opacity = 1;
    let frame = 0;
    let raf = 0;
    let running = true;

    const trigger = ScrollTrigger.create({
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        progress = self.progress;
      },
    });

    const lerp = (a, b, t) => a + (b - a) * t;

    const place = (p, timeSec) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Zigzag: interpolate smoothly between consecutive stops.
      const segs = SIDES.length - 1;
      const scaled = Math.min(p, 0.9999) * segs;
      const i = Math.floor(scaled);
      const f = scaled - i;
      // Ease each leg so it swings rather than moves linearly.
      const e = f * f * (3 - 2 * f);
      // Zigzag between the two sides of the viewport. Each stop sits over the
      // free margin when there is room; the burger is small enough that the
      // overlap-fade below handles the rest.
      const edge = Math.max(CANVAS_SIZE * 0.3, Math.min(vw * 0.08, 110));
      const rightC = vw - edge;
      const leftC = edge;
      const a = SIDES[i] === 1 ? rightC : leftC;
      const bx = SIDES[i + 1] === 1 ? rightC : leftC;
      const cx = lerp(a, bx, e);
      const cy = (0.16 + p * 0.68) * vh + Math.sin(timeSec * 1.6) * 6;

      wrap.style.transform = `translate3d(${cx - CANVAS_SIZE / 2}px, ${cy - CANVAS_SIZE / 2}px, 0)`;
      lastCx = cx;
      lastCy = cy;

      burger.rotation.y = p * Math.PI * 4; // two full revolutions
      burger.rotation.x = 0.35 + Math.sin(p * Math.PI * 6) * 0.45;
      burger.rotation.z = Math.sin(p * Math.PI * 3) * 0.2;
    };

    // Elements that count as "readable content" the burger must not sit on.
    const CONTENT = "h1,h2,h3,h4,p,li,button,a,input,textarea,label,th,td,img,svg,canvas,[data-content]";
    const isContent = (el) => {
      if (!el || el === document.body || el === document.documentElement) return false;
      if (wrap.contains(el)) return false;
      if (el.closest("header")) return false; // navbar is handled separately
      return Boolean(el.closest(CONTENT));
    };
    const contentCoverage = (cx, cy) => {
      const R = CANVAS_SIZE * 0.34;
      const pts = [];
      for (let gx = -1; gx <= 1; gx++) {
        for (let gy = -1; gy <= 1; gy++) pts.push([cx + gx * R, cy + gy * R * 0.8]);
      }
      let hit = 0;
      let counted = 0;
      const prev = wrap.style.visibility;
      wrap.style.visibility = "hidden"; // probe what is *under* the burger
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        counted++;
        if (isContent(document.elementFromPoint(x, y))) hit++;
      }
      wrap.style.visibility = prev;
      return counted ? hit / counted : 0;
    };

    const clock = new THREE.Clock();
    const tick = () => {
      if (!running) return;
      smoothed = lerp(smoothed, progress, 0.12); // ease toward scroll target
      place(smoothed, clock.getElapsedTime());

      // Probe every 2nd frame. Fade OUT fast (the moment it lands on
      // content) but fade back IN slowly, so it never lingers over text.
      if (frame++ % 2 === 0) {
        const cov = contentCoverage(lastCx, lastCy);
        const target = cov > 0.2 ? 0.0 : 1 - cov * 3;
        const rate = target < opacity ? 0.6 : 0.12;
        opacity += (target - opacity) * rate;
        if (opacity < 0.02) opacity = 0;
        wrap.style.opacity = opacity.toFixed(3);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      trigger.kill();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          const m = obj.material;
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30 hidden lg:block"
      style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, willChange: "transform, opacity" }}
    >
      <canvas ref={canvasRef} style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }} />
    </div>
  );
}
