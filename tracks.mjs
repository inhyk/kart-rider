const TAU = Math.PI * 2;
export const TRACKS = [
  {
    id: "clover",
    name: "클로버 파크",
    subtitle: "바람이 부는 숲의 서킷",
    emoji: "🌳",
    difficulty: 1,
    laps: 3,
    width: 12,
    theme: "forest",
    sky: "#b7dfe4",
    fog: "#d7e7db",
    grass: "#8ab36c",
    road: "#6e7c75",
    edge: "#fff1d6",
    accent: "#df775f",
    leaf: "#4c8560",
    trunk: "#806147",
    hill: "#729367",
    points: [
      [0, 60],
      [0, 120],
      [65, 210],
      [185, 230],
      [265, 180],
      [280, 65],
      [210, 5],
      [185, -90],
      [230, -175],
      [160, -250],
      [35, -255],
      [-45, -190],
      [-100, -120],
      [-105, -35],
      [-60, 5],
      [0, 0],
      [0, 30],
    ],
    landmarks: ["windmill", "lake", "village"],
    boxFractions: [0.08, 0.25, 0.43, 0.61, 0.8, 0.94],
  },
  {
    id: "canyon",
    name: "선셋 캐니언",
    subtitle: "붉은 절벽과 모래바람",
    emoji: "🏜️",
    difficulty: 2,
    laps: 3,
    width: 11,
    theme: "desert",
    sky: "#f0bd99",
    fog: "#eec3a5",
    grass: "#cb9c69",
    road: "#997b68",
    edge: "#f7dbaa",
    accent: "#bc6351",
    leaf: "#77966b",
    trunk: "#a16d50",
    hill: "#bb8265",
    points: [
      [5, 65],
      [10, 135],
      [100, 230],
      [230, 220],
      [295, 140],
      [255, 60],
      [145, 65],
      [100, 0],
      [155, -70],
      [280, -80],
      [320, -170],
      [240, -260],
      [100, -280],
      [-25, -220],
      [-110, -130],
      [-90, -25],
      [-35, -15],
      [0, 0],
      [2, 30],
    ],
    landmarks: ["arch", "cactus", "mine"],
    boxFractions: [0.07, 0.23, 0.4, 0.55, 0.73, 0.91],
  },
  {
    id: "neon",
    name: "네온 하버",
    subtitle: "빛나는 항구의 한밤 레이스",
    emoji: "🌃",
    difficulty: 3,
    laps: 3,
    width: 11.5,
    theme: "night",
    sky: "#182b45",
    fog: "#233954",
    grass: "#304b54",
    road: "#425362",
    edge: "#75d8d0",
    accent: "#cd88ce",
    leaf: "#518b85",
    trunk: "#536875",
    hill: "#2b435a",
    points: [
      [0, 60],
      [0, 145],
      [70, 220],
      [180, 220],
      [230, 150],
      [220, 30],
      [130, 0],
      [120, -80],
      [240, -140],
      [240, -240],
      [135, -280],
      [35, -240],
      [-55, -265],
      [-140, -185],
      [-140, -60],
      [-70, -5],
      [0, 0],
      [0, 30],
    ],
    landmarks: ["harbor", "tower", "bridge"],
    boxFractions: [0.08, 0.24, 0.41, 0.57, 0.74, 0.9],
  },
];
export const mod = (v, n) => ((v % n) + n) % n;
export const wrapAngle = (a) => mod(a + Math.PI, TAU) - Math.PI;
const mix = (a, b, t) => a + (b - a) * t;
function catmull(a, b, c, d, t) {
  const t2 = t * t,
    t3 = t2 * t;
  return (
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3)
  );
}
export function buildTrack(def) {
  const pts = def.points,
    raw = [],
    N = pts.length * 100;
  let length = 0;
  for (let i = 0; i <= N; i++) {
    const f = (i / N) * pts.length,
      k = Math.floor(f) % pts.length,
      t = f - Math.floor(f);
    const a = pts[mod(k - 1, pts.length)],
      b = pts[k],
      c = pts[(k + 1) % pts.length],
      d = pts[(k + 2) % pts.length];
    const p = {
      x: catmull(a[0], b[0], c[0], d[0], t),
      z: catmull(a[1], b[1], c[1], d[1], t),
    };
    if (i) length += Math.hypot(p.x - raw[i - 1].x, p.z - raw[i - 1].z);
    raw.push({ ...p, s: length });
  }
  const samples = [],
    count = Math.ceil(length / 2),
    spacing = length / count;
  let j = 0;
  for (let i = 0; i <= count; i++) {
    const s = i * spacing;
    while (j < raw.length - 2 && raw[j + 1].s < s) j++;
    const a = raw[j],
      b = raw[j + 1],
      t = (s - a.s) / (b.s - a.s || 1);
    samples.push({ x: mix(a.x, b.x, t), z: mix(a.z, b.z, t), s });
  }
  const tr = { ...def, length, samples, spacing, count };
  tr.boxes = def.boxFractions.map((t) => t * length);
  return tr;
}
export const COURSES = TRACKS.map(buildTrack);
export function elevation(track, s) {
  const f = mod(s, track.length) / track.length;
  const smooth = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  const plateau = (start, end, ramp, height) =>
    height * smooth((f - start) / ramp) * smooth((end - f) / ramp);
  if (track.theme === "desert")
    return plateau(0.12, 0.4, 0.11, 12) + plateau(0.57, 0.82, 0.1, 8);
  if (track.theme === "night") return plateau(0.25, 0.46, 0.065, 10);
  return 0;
}
export function sample(track, s, lane = 0) {
  const f = mod(s, track.length) / track.spacing,
    i = Math.floor(f),
    t = f - i,
    a = track.samples[i],
    b = track.samples[i + 1];
  const dx = b.x - a.x,
    dz = b.z - a.z,
    len = Math.hypot(dx, dz) || 1;
  const angle = Math.atan2(dx, dz);
  return {
    x: mix(a.x, b.x, t) + (dz / len) * lane,
    z: mix(a.z, b.z, t) - (dx / len) * lane,
    y: elevation(track, s),
    angle,
    nx: dz / len,
    nz: -dx / len,
  };
}
export function project(track, x, z, hint = null) {
  let best = Infinity,
    out = null;
  const nearest =
    hint === null ? null : Math.floor(mod(hint, track.length) / track.spacing);
  const radius = nearest === null ? track.count : 32;
  for (
    let k = nearest === null ? 0 : -radius;
    k < (nearest === null ? track.count : radius + 1);
    k++
  ) {
    const i = nearest === null ? k : mod(nearest + k, track.count),
      a = track.samples[i],
      b = track.samples[i + 1],
      dx = b.x - a.x,
      dz = b.z - a.z,
      ls = dx * dx + dz * dz,
      t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (ls || 1)),
      ),
      px = a.x + t * dx,
      pz = a.z + t * dz,
      dist = (x - px) ** 2 + (z - pz) ** 2;
    if (dist < best) {
      best = dist;
      const len = Math.sqrt(ls) || 1;
      out = {
        s: (i + t) * track.spacing,
        lane: ((x - px) * dz) / len - ((z - pz) * dx) / len,
        distance: Math.sqrt(dist),
        x: px,
        z: pz,
        angle: Math.atan2(dx, dz),
        nx: dz / len,
        nz: -dx / len,
      };
    }
  }
  return out;
}
export function curvature(track, s) {
  return (
    wrapAngle(sample(track, s + 10).angle - sample(track, s - 10).angle) / 20
  );
}
