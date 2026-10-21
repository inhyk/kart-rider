import { Vector3, Color3, MeshBuilder } from "./graphics.js";
import { createSkidmarks } from "./skidmarks.js";
export function createEffects(world, audio) {
  const T = world.tools,
    { material: mat, ball, cyl, torus, box, node } = T,
    particles = [],
    rings = [],
    bolts = [],
    projectileMeshes = new Map(),
    trapMeshes = new Map();
  let seen = 0;
  const skidmarks = createSkidmarks(world.scene);
  const particleMats = [
    "#ffe7aa",
    "#ed9d6d",
    "#93dfdc",
    "#a6c78a",
    "#fff8df",
    "#d8b0df",
  ].map((c, i) => mat("particle" + i, c, { glow: 0.25 }));
  function burst(x, z, count = 12, color = 0, y = 1) {
    for (let i = 0; i < count; i++) {
      const a = ball(
        "burst",
        0.13 + Math.random() * 0.18,
        x,
        y,
        z,
        particleMats[(color + (i % 2)) % particleMats.length],
        undefined,
        4,
      );
      particles.push({
        mesh: a,
        age: 0,
        life: 0.5 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 9,
        vy: 3 + Math.random() * 7,
        vz: (Math.random() - 0.5) * 9,
      });
    }
  }
  function ring(x, z, color = 2, radius = 8, life = 0.7, y = 0) {
    const a = torus("shock ring", 1, 0.08, x, y + 0.18, z, particleMats[color]);
    rings.push({ mesh: a, age: 0, life, radius });
  }
  function lightning(r) {
    const points = [];
    for (let j = 0; j < 9; j++)
      points.push(
        new Vector3(
          r.x + (j % 2 ? 1.5 : -1.5) * (j > 0 && j < 8 ? 1 : 0),
          (r.y || 0) + 20 - j * 2.3,
          r.z + (Math.random() - 0.5) * 1.5,
        ),
      );
    const a = MeshBuilder.CreateLines("lightning", { points }, world.scene);
    a.color = Color3.FromHexString("#fceab0");
    bolts.push({ mesh: a, age: 0, life: 0.4 });
  }
  function projectile(p) {
    const root = node(p.type);
    if (p.type === "rocket") {
      const body = cyl(
        "missile",
        0.9,
        2.8,
        0,
        0,
        0,
        mat("missile", "#f8e5c3"),
        root,
        0,
      );
      body.rotation.x = Math.PI / 2;
      for (const x of [-0.6, 0.6])
        box(
          "missile fin",
          0.75,
          0.12,
          0.8,
          x,
          0,
          -0.8,
          mat("missile fin", "#df7961"),
          root,
        );
      const flame = ball(
        "missile fire",
        0.8,
        0,
        0,
        -1.7,
        mat("missile fire", "#ffd77b", { glow: true }),
        root,
      );
      flame.scaling.z = 2;
    } else {
      ball(
        "water balloon",
        2.7,
        0,
        0,
        0,
        mat("water balloon", "#81d1ec", { glow: 0.15, alpha: 0.82 }),
        root,
        16,
      );
      ball(
        "water highlight",
        0.55,
        -0.5,
        0.6,
        -0.95,
        mat("water highlight", "#e4f4e7"),
        root,
      );
      const landing = torus(
        "water landing warning",
        26,
        0.14,
        0,
        0,
        0,
        mat("water warning", "#92e5f6", { glow: 0.5, alpha: 0.55 }),
        root,
      );
      root.metadata = { landing };
    }
    return root;
  }
  function trap(t) {
    const root = node("banana trap", t.x, (t.y || 0) + 0.4, t.z),
      yellow = mat("banana peel", "#f5cf58");
    for (let j = 0; j < 3; j++) {
      const peel = ball("peel", 1.3, 0, 0.1, 0, yellow, root, 8);
      peel.scaling.set(0.35, 0.28, 1.3);
      peel.rotation.y = (j * Math.PI * 2) / 3;
      peel.position.x = Math.sin(peel.rotation.y) * 0.8;
      peel.position.z = Math.cos(peel.rotation.y) * 0.8;
    }
    cyl("banana stem", 0.4, 0.7, 0, 0.35, 0, yellow, root);
    return root;
  }
  return {
    update(g, time, dt) {
      if (!g) return;
      skidmarks.update(g, time);
      for (const e of g.events) {
        if (e.id <= seen) continue;
        if (
          e.target === 0 ||
          e.type === "start" ||
          (e.type === "lightning" &&
            Math.hypot(e.x - g.racers[0].x, e.z - g.racers[0].z) < 40)
        )
          audio.effect(e.type);
        if (["impact", "wall", "bump", "drop"].includes(e.type))
          burst(e.x, e.z, e.type === "impact" ? 20 : 7, 0, (e.y || 0) + 1);
        if (["pickup", "boost", "driftBoost", "block"].includes(e.type)) {
          burst(e.x, e.z, 12, e.type === "block" ? 2 : 0, (e.y || 0) + 1);
          ring(e.x, e.z, e.type === "block" ? 2 : 0, 5, 0.7, e.y || 0);
        }
        if (e.type === "splash") {
          burst(e.x, e.z, 24, 2, (e.y || 0) + 3);
          ring(e.x, e.z, 2, e.radius || 8, 1, e.y || 0);
        }
        if (e.type === "lightning") lightning(g.racers[e.target]);
        if (e.type === "finish" && e.target === 0)
          burst(e.x, e.z, 50, 0, (e.y || 0) + 7);
      }
      if (g.events.length) seen = Math.max(seen, ...g.events.map((e) => e.id));
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        p.vy -= 12 * dt;
        p.mesh.position.addInPlaceFromFloats(p.vx * dt, p.vy * dt, p.vz * dt);
        p.mesh.scaling.setAll(Math.max(0.01, 1 - p.age / p.life));
        if (p.age > p.life) {
          p.mesh.dispose();
          particles.splice(i, 1);
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const p = rings[i];
        p.age += dt;
        p.mesh.scaling.setAll(1 + (p.radius * p.age) / p.life);
        p.mesh.visibility = 1 - p.age / p.life;
        if (p.age > p.life) {
          p.mesh.dispose();
          rings.splice(i, 1);
        }
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const p = bolts[i];
        p.age += dt;
        p.mesh.visibility = Math.sin(time * 70) > 0.2 ? 1 : 0.1;
        if (p.age > p.life) {
          p.mesh.dispose();
          bolts.splice(i, 1);
        }
      }
      for (const p of g.projectiles) {
        if (!projectileMeshes.has(p)) projectileMeshes.set(p, projectile(p));
        const m = projectileMeshes.get(p);
        m.position.set(p.x, p.y, p.z);
        m.rotation.y = p.angle || 0;
        if (m.metadata?.landing) {
          const warning = m.metadata.landing;
          warning.position.set(
            p.targetX - p.x,
            p.targetY + 0.18 - p.y,
            p.targetZ - p.z,
          );
          warning.visibility = 0.5 + Math.sin(p.age * 18) * 0.25;
          warning.scaling.x = warning.scaling.z =
            0.85 + 0.15 * Math.min(1, p.age / 0.85);
        }
        if (p.type === "rocket" && Math.random() < dt * 30)
          burst(p.x, p.z, 1, 1, p.y);
      }
      for (const [p, m] of projectileMeshes)
        if (!g.projectiles.includes(p)) {
          m.dispose();
          projectileMeshes.delete(p);
        }
      for (const t of g.traps)
        if (!trapMeshes.has(t.id)) trapMeshes.set(t.id, trap(t));
      for (const [id, m] of trapMeshes)
        if (!g.traps.some((t) => t.id === id)) {
          m.dispose();
          trapMeshes.delete(id);
        }
      const r = g.racers[0];
      if (
        r.magnet > 0 &&
        r.magnetTarget !== null &&
        Math.floor(time * 8) % 2 === 0
      ) {
        const target = g.racers[r.magnetTarget];
        const line = MeshBuilder.CreateLines(
          "magnet tether",
          {
            points: [
              new Vector3(r.x, r.y + 2, r.z),
              new Vector3(target.x, target.y + 2, target.z),
            ],
          },
          world.scene,
        );
        line.color = Color3.FromHexString("#f2afe3");
        bolts.push({ mesh: line, age: 0, life: 0.08 });
      }
    },
    clear() {
      skidmarks.clear();
      for (const p of particles) p.mesh.dispose();
      particles.length = 0;
      for (const p of rings) p.mesh.dispose();
      rings.length = 0;
      for (const p of bolts) p.mesh.dispose();
      bolts.length = 0;
      for (const m of projectileMeshes.values()) m.dispose();
      projectileMeshes.clear();
      for (const m of trapMeshes.values()) m.dispose();
      trapMeshes.clear();
      seen = 0;
    },
  };
}
