import * as THREE from "three";

/**
 * Builds a burger out of real 3D geometry (not stacked flat discs):
 *  - buns: LatheGeometry — a 2D profile curve revolved around the Y axis,
 *    which is how a domed bun is actually modelled
 *  - patty: a thick lathe with a slightly rounded, bumpy edge
 *  - cheese: a square slab draping over the patty with drooping corners
 *  - lettuce: a ring with a wavy, ruffled edge (vertex displacement)
 *  - tomato: two thin red discs
 *  - sesame seeds: small squashed ellipsoids scattered on the dome
 * Units: burger radius ~1.
 */

const mat = {
  bun: () =>
    new THREE.MeshStandardMaterial({ color: 0xd9903a, roughness: 0.55, metalness: 0.02 }),
  bunBottom: () =>
    new THREE.MeshStandardMaterial({ color: 0xe0a04f, roughness: 0.6, metalness: 0.02 }),
  patty: () =>
    new THREE.MeshStandardMaterial({ color: 0x4a2a17, roughness: 0.85, metalness: 0.0 }),
  cheese: () =>
    new THREE.MeshStandardMaterial({ color: 0xffc72c, roughness: 0.4, metalness: 0.0 }),
  lettuce: () =>
    new THREE.MeshStandardMaterial({
      color: 0x6fbf3a,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  tomato: () =>
    new THREE.MeshStandardMaterial({ color: 0xd8342c, roughness: 0.35 }),
  seed: () => new THREE.MeshStandardMaterial({ color: 0xfff1cf, roughness: 0.5 }),
};

// Deterministic pseudo-random so the burger looks identical on every load.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function latheFromPoints(points, segments = 64) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments
  );
}

function makeTopBun() {
  // Profile: from the flat underside at the center out to the rim,
  // then up and over the dome back to the top center.
  const pts = [
    [0.0, 0.0],
    [0.94, 0.0],
    [1.08, 0.04],
    [1.13, 0.13],
    [1.12, 0.25],
    [1.05, 0.4],
    [0.9, 0.53],
    [0.68, 0.63],
    [0.4, 0.69],
    [0.14, 0.715],
    [0.0, 0.72],
  ];
  const geo = latheFromPoints(pts, 96);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat.bun());

  // Sesame seeds sitting on the dome surface.
  const group = new THREE.Group();
  group.add(mesh);
  const rand = rng(7);
  const seedGeo = new THREE.SphereGeometry(0.035, 10, 8);
  seedGeo.scale(1, 0.45, 0.55);
  for (let i = 0; i < 46; i++) {
    // Sample the dome in polar coordinates, rejecting the rim.
    const theta = rand() * Math.PI * 2;
    const r = 0.12 + rand() * 0.68;
    // Height of the dome at radius r, interpolated from the profile.
    let y = 0.72;
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[k + 1];
      if (r <= x0 && r >= x1) {
        const t = (x0 - r) / (x0 - x1 || 1);
        y = y0 + (y1 - y0) * t;
        break;
      }
    }
    const seed = new THREE.Mesh(seedGeo, mat.seed());
    seed.position.set(Math.cos(theta) * r, y + 0.008, Math.sin(theta) * r);
    // Tilt the seed to lie along the surface.
    seed.rotation.y = -theta + (rand() - 0.5) * 0.8;
    seed.rotation.z = (r / 0.8) * 0.5;
    group.add(seed);
  }
  return group;
}

function makeBottomBun() {
  const pts = [
    [0.0, 0.0],
    [0.9, 0.0],
    [1.04, 0.04],
    [1.1, 0.14],
    [1.1, 0.27],
    [1.04, 0.36],
    [0.9, 0.4],
    [0.0, 0.4],
  ];
  const geo = latheFromPoints(pts, 96);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat.bunBottom());
}

function makePatty() {
  const pts = [
    [0.0, 0.0],
    [0.98, 0.0],
    [1.04, 0.06],
    [1.06, 0.15],
    [1.03, 0.25],
    [0.96, 0.29],
    [0.0, 0.29],
  ];
  const geo = latheFromPoints(pts, 72);
  // Roughen the surface a little so it reads as a grilled patty.
  const rand = rng(21);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const n = (rand() - 0.5) * 0.018;
    const len = Math.hypot(x, z) || 1;
    p.setX(i, x + (x / len) * n);
    p.setZ(i, z + (z / len) * n);
    p.setY(i, y + n * 0.6);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat.patty());
}

function makeCheese() {
  // Melted cheese: a lathe disc (flat on top of the patty) whose outer rim
  // droops over the patty edge in a few uneven "drips". Being a solid of
  // revolution with a displaced rim, it hugs the patty instead of forming
  // a flat sheet that sticks out.
  const pts = [
    [0.0, 0.0],
    [0.95, 0.0],
    [1.14, -0.02],
    [1.22, -0.08],
    [1.23, -0.15],
    [1.19, -0.2],
    [0.0, -0.2],
  ];
  const geo = latheFromPoints(pts, 96);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const r = Math.hypot(x, z);
    if (r > 1.0) {
      const a = Math.atan2(z, x);
      // Uneven drips: a few long tongues around the rim.
      const drip = Math.max(0, Math.sin(a * 3 + 0.6)) * 0.16
                 + Math.max(0, Math.sin(a * 5 + 2.1)) * 0.06;
      const k = (r - 1.0) / 0.23; // 0 at start of rim -> 1 at outer edge
      p.setY(i, y - drip * Math.min(1, k));
      // Slight radial wobble so the silhouette isn't a perfect circle.
      const rr = r + Math.sin(a * 7) * 0.012 * k;
      p.setX(i, Math.cos(a) * rr);
      p.setZ(i, Math.sin(a) * rr);
    }
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat.cheese());
}

function makeLettuce() {
  // A flat ring whose outer edge is ruffled with a few octaves of sine waves.
  const inner = 0.6;
  const outer = 1.2;
  const geo = new THREE.RingGeometry(inner, outer, 96, 8);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const edge = (r - inner) / (outer - inner); // 0 inner -> 1 outer
    const ruffle =
      Math.sin(a * 11) * 0.06 + Math.sin(a * 17 + 1.3) * 0.035 + Math.sin(a * 5) * 0.05;
    p.setY(i, ruffle * edge * edge * 0.6 + Math.sin(a * 9 + edge * 4) * 0.01);
    // Push the radius in and out a little so the silhouette is irregular.
    const rr = r + Math.sin(a * 13) * 0.035 * edge;
    p.setX(i, Math.cos(a) * rr);
    p.setZ(i, Math.sin(a) * rr);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat.lettuce());
}

function makeTomato() {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.82, 0.82, 0.07, 48);
  for (let i = 0; i < 2; i++) {
    const slice = new THREE.Mesh(geo, mat.tomato());
    slice.position.set(i === 0 ? -0.06 : 0.06, i * 0.075, i === 0 ? 0.03 : -0.03);
    group.add(slice);
  }
  return group;
}

export function buildBurger() {
  const burger = new THREE.Group();
  let y = 0;

  const bottom = makeBottomBun();
  bottom.position.y = y;
  burger.add(bottom);
  y += 0.4; // top of bottom bun

  const lettuce = makeLettuce();
  lettuce.position.y = y + 0.05;
  burger.add(lettuce);
  y += 0.06; // lettuce is thin; patty rests just above the bun

  const patty = makePatty();
  patty.position.y = y;
  burger.add(patty);
  y += 0.29; // top of patty

  const cheese = makeCheese();
  cheese.position.y = y + 0.02; // top face flush with patty; rim drapes down
  burger.add(cheese);
  y += 0.03;

  const tomato = makeTomato();
  tomato.position.y = y;
  burger.add(tomato);
  y += 0.15;

  const top = makeTopBun();
  top.position.y = y;
  burger.add(top);
  y += 0.72;

  // Centre the whole stack on its own middle so rotation pivots sensibly.
  burger.position.y = -y / 2;
  const holder = new THREE.Group();
  holder.add(burger);
  return holder;
}
