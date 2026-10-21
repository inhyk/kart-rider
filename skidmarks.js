import { Mesh, VertexData, StandardMaterial, Color3 } from "./graphics.js";

// One reusable vertex buffer keeps long tyre trails cheap, even on phones.
export function createSkidmarks(scene) {
  const capacity = 768,
    positions = new Float32Array(capacity * 12),
    colors = new Float32Array(capacity * 16),
    indices = [],
    normals = new Float32Array(capacity * 12),
    born = new Float32Array(capacity).fill(-100),
    previous = new Map();
  for (let i = 0; i < capacity; i++) {
    const n = i * 4;
    indices.push(n, n + 2, n + 1, n, n + 3, n + 2);
    for (let j = 0; j < 4; j++) {
      normals[i * 12 + j * 3 + 1] = 1;
      colors[i * 16 + j * 4] = 0.12;
      colors[i * 16 + j * 4 + 1] = 0.15;
      colors[i * 16 + j * 4 + 2] = 0.14;
    }
  }
  const mesh = new Mesh("persistent tyre marks", scene),
    data = new VertexData();
  Object.assign(data, { positions, colors, indices, normals });
  data.applyToMesh(mesh, true);
  mesh.hasVertexAlpha = true;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  const material = new StandardMaterial("rubber trails", scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(1, 1, 1);
  material.backFaceCulling = false;
  material.zOffset = -1;
  mesh.material = material;
  let cursor = 0,
    fadeAt = 0,
    dirty = false;
  function segment(a, b, time) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz);
    if (len < 0.3 || len > 6) return;
    const nx = (dz / len) * 0.18,
      nz = (-dx / len) * 0.18,
      n = cursor * 12;
    positions.set(
      [
        a.x + nx,
        a.y + 0.085,
        a.z + nz,
        b.x + nx,
        b.y + 0.085,
        b.z + nz,
        b.x - nx,
        b.y + 0.085,
        b.z - nz,
        a.x - nx,
        a.y + 0.085,
        a.z - nz,
      ],
      n,
    );
    born[cursor] = time;
    cursor = (cursor + 1) % capacity;
    dirty = true;
  }
  return {
    update(g, time) {
      if (!g) return;
      const player = g.racers[0];
      for (const r of g.racers) {
        if (
          !r.drifting ||
          r.speed < 14 ||
          Math.hypot(r.x - player.x, r.z - player.z) > 100
        ) {
          previous.delete(r.id);
          continue;
        }
        const a = r.angle,
          s = Math.sin(a),
          c = Math.cos(a),
          pair = [-1, 1].map((side) => ({
            y: r.groundY || 0,
            x: r.x - s * 1.7 + c * side * 1.2,
            z: r.z - c * 1.7 - s * side * 1.2,
          })),
          old = previous.get(r.id);
        if (
          !old ||
          Math.hypot(pair[0].x - old[0].x, pair[0].z - old[0].z) > 0.45
        ) {
          if (old) for (let i = 0; i < 2; i++) segment(old[i], pair[i], time);
          previous.set(r.id, pair);
        }
      }
      if (dirty || time - fadeAt > 0.12) {
        for (let i = 0; i < capacity; i++) {
          const alpha = Math.max(
            0,
            Math.min(0.43, (22 - (time - born[i])) * 0.055),
          );
          for (let j = 0; j < 4; j++) colors[i * 16 + j * 4 + 3] = alpha;
        }
        if (dirty) mesh.updateVerticesData("position", positions, false, false);
        mesh.updateVerticesData("color", colors, false, false);
        dirty = false;
        fadeAt = time;
      }
    },
    clear() {
      born.fill(-100);
      for (let i = 0; i < capacity; i++)
        for (let j = 0; j < 4; j++) colors[i * 16 + j * 4 + 3] = 0;
      mesh.updateVerticesData("color", colors, false, false);
      previous.clear();
      cursor = 0;
    },
    dispose() {
      mesh.dispose();
      material.dispose();
    },
  };
}
