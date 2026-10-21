import { GlowLayer } from "@babylonjs/core/Layers/glowLayer.js";
import "@babylonjs/core/Layers/effectLayerSceneComponent.js";
import {
  Scene,
  FreeCamera,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Mesh,
  MeshBuilder,
  VertexData,
  DynamicTexture,
  makeTools,
} from "./graphics.js";
import { sample, project, seeded, DRIVERS } from "./core.mjs";
import { makeKart } from "./vehicle.js";
export function createWorld(engine, tr, options = {}) {
  const scene = new Scene(engine),
    night = tr.theme === "night",
    desert = tr.theme === "desert",
    rng = seeded(117 + tr.count),
    T = makeTools(scene),
    { material: mat, box, ball, cyl, torus, node, sign } = T;
  scene.clearColor = Color4.FromHexString(tr.sky + "ff");
  scene.fogMode = 3;
  scene.fogColor = Color3.FromHexString(tr.fog);
  scene.fogStart = 130;
  scene.fogEnd = 620;
  scene.ambientColor = new Color3(0.03, 0.03, 0.03);
  const camera = new FreeCamera("chase camera", new Vector3(0, 20, -40), scene);
  camera.minZ = 0.3;
  camera.maxZ = 1500;
  camera.fov = 0.78;
  camera.inputs.clear();
  const hemi = new HemisphericLight("sky light", new Vector3(0, 1, 0), scene);
  hemi.intensity = night ? 0.72 : 0.72;
  hemi.diffuse = Color3.FromHexString(night ? "#b7d0e7" : "#fff2dc");
  hemi.groundColor = Color3.FromHexString(night ? "#33495a" : "#758164");
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.4), scene);
  sun.intensity = night ? 0.3 : 0.4;
  sun.diffuse = Color3.FromHexString(
    desert ? "#ffcaa6" : night ? "#a9ccea" : "#fff1db",
  );
  sun.position.set(150, 240, -160);
  const shadows = new ShadowGenerator(options.mobile ? 512 : 1024, sun);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 16;
  shadows.darkness = 0.23;
  shadows.bias = 0.001;
  sun.shadowFrustumSize = 150;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 550;
  const grass = mat("ground", tr.grass),
    asphalt = mat("asphalt", tr.road),
    cream = mat("cream", tr.edge, { glow: night ? 0.3 : 0 }),
    accent = mat("accent", tr.accent, { glow: night ? 0.4 : 0 }),
    wood = mat("wood", tr.trunk),
    leaf = mat("foliage", tr.leaf),
    leaf2 = mat(
      "light foliage",
      night ? "#659994" : desert ? "#91a778" : "#78a16b",
    ),
    hill = mat("hill", tr.hill),
    ivory = mat("ivory", "#ffefd5"),
    dark = mat("dark", "#465c55"),
    water = mat("water", night ? "#2e7182" : desert ? "#689e9b" : "#6aafb1", {
      glow: night ? 0.1 : 0,
    }),
    rock = mat("stone", desert ? "#bd8564" : "#9aab8e"),
    gold = mat("gold", "#ebbb66");
  const ground = box("ground", 1800, 0.5, 1800, 70, -0.5, -20, grass);
  ground.receiveShadows = true;
  const groundTex = new DynamicTexture(
      "ground texture",
      { width: 256, height: 256 },
      scene,
      false,
    ),
    gc = groundTex.getContext();
  gc.fillStyle = tr.grass;
  gc.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1700; i++) {
    gc.fillStyle = rng() > 0.5 ? "#ffffff09" : "#18352806";
    const size = 1 + rng() * 6;
    gc.fillRect(rng() * 256, rng() * 256, size, size * 0.5);
  }
  groundTex.update();
  groundTex.uScale = groundTex.vScale = 75;
  grass.diffuseTexture = groundTex;
  grass.diffuseColor = new Color3(1, 1, 1);
  if (night && !options.mobile) {
    const glow = new GlowLayer("harbor glow", scene, {
      mainTextureRatio: 0.3,
      blurKernelSize: 16,
    });
    glow.intensity = 0.24;
  }

  // A sky dome made with a local gradient, so the game works without image downloads.
  const skyTex = new DynamicTexture(
      "sky gradient",
      { width: 32, height: 512 },
      scene,
      false,
    ),
    ctx = skyTex.getContext(),
    gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, night ? "#0c1732" : desert ? "#cf8f82" : "#75b9cc");
  gradient.addColorStop(0.55, tr.sky);
  gradient.addColorStop(1, tr.fog);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 512);
  skyTex.update();
  const skyM = mat("sky", "#ffffff", { unlit: true });
  skyM.emissiveTexture = skyTex;
  skyM.diffuseTexture = skyTex;
  skyM.backFaceCulling = false;
  const sky = ball("sky", 1400, 80, 0, -20, skyM, undefined, 24);
  sky.infiniteDistance = true;
  sky.applyFog = false;
  sky.receiveShadows = false;
  function ribbon(name, inner, outer, m, y = 0.02, segments = tr.count) {
    const pos = [],
      idx = [],
      uv = [];
    for (let i = 0; i <= segments; i++) {
      for (const l of [inner, outer]) {
        const v = sample(tr, (i / segments) * tr.length, l);
        pos.push(v.x, v.y + y, v.z);
        uv.push(l === inner ? 0 : 1, ((i / segments) * tr.length) / 16);
      }
      if (i < segments) {
        const n = i * 2;
        idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const mesh = new Mesh(name, scene),
      data = new VertexData();
    data.positions = pos;
    data.indices = idx;
    data.uvs = uv;
    data.normals = [];
    for (let i = 0; i < pos.length / 3; i++) data.normals.push(0, 1, 0);
    data.applyToMesh(mesh);
    mesh.material = m;
    m.backFaceCulling = false;
    mesh.receiveShadows = true;
    T.staticMeshes.push(mesh);
    return mesh;
  }
  ribbon(
    "road shoulder",
    -tr.width - 3,
    tr.width + 3,
    mat("shoulder", desert ? "#b68f6a" : night ? "#365761" : "#b6bb8d"),
    0.005,
  );
  ribbon("asphalt", -tr.width, tr.width, asphalt, 0.04);
  ribbon("outer edge", tr.width - 0.8, tr.width - 0.5, cream, 0.06);
  ribbon("inner edge", -tr.width + 0.5, -tr.width + 0.8, cream, 0.06);
  // Raised sections have a visible deck, retaining walls, and proper supports.
  if (desert || night) {
    const positions = [],
      indices = [],
      uvs = [],
      wall = mat("road structure", night ? "#7a8c91" : "#b48c6b");
    for (const side of [-1, 1])
      for (let s = 0; s < tr.length; s += 4) {
        const a = sample(tr, s, side * (tr.width + 3)),
          b = sample(tr, s + 4, side * (tr.width + 3));
        if (Math.max(a.y, b.y) < 0.02) continue;
        const lowA = night ? Math.max(-0.24, a.y - 0.8) : -0.24,
          lowB = night ? Math.max(-0.24, b.y - 0.8) : -0.24,
          n = positions.length / 3;
        positions.push(
          a.x,
          lowA,
          a.z,
          a.x,
          a.y,
          a.z,
          b.x,
          b.y,
          b.z,
          b.x,
          lowB,
          b.z,
        );
        uvs.push(0, lowA / 6, 0, a.y / 6, 1, b.y / 6, 1, lowB / 6);
        indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
      }
    const mesh = new Mesh("road retaining walls", scene),
      data = new VertexData();
    data.positions = positions;
    data.uvs = uvs;
    data.indices = indices;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    data.applyToMesh(mesh);
    mesh.material = wall;
    if (desert) {
      const strata = new DynamicTexture(
          "retaining sandstone",
          { width: 64, height: 128 },
          scene,
          false,
        ),
        ctx = strata.getContext();
      const bands = [
        "#b18666",
        "#bd9471",
        "#c59c78",
        "#b88e6b",
        "#a97c5d",
        "#c39b75",
      ];
      for (let row = 0; row < 128; row++) {
        ctx.fillStyle = bands[Math.floor(row / 22) % bands.length];
        ctx.fillRect(0, row, 64, 1);
      }
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = "#754e3710";
        ctx.fillRect(rng() * 64, rng() * 128, 1 + rng() * 8, 1);
      }
      strata.update();
      wall.diffuseTexture = strata;
      wall.diffuseColor = new Color3(1, 1, 1);
    }
    wall.backFaceCulling = false;
    T.staticMeshes.push(mesh);
    if (night) {
      for (let s = tr.length * 0.25; s < tr.length * 0.46; s += 24) {
        const p = sample(tr, s);
        if (p.y < 1) continue;
        for (const side of [-1, 1]) {
          const q = sample(tr, s, side * (tr.width - 2)),
            support = box(
              "bridge pier",
              1.8,
              p.y,
              2.8,
              q.x,
              p.y / 2 - 0.1,
              q.z,
              wall,
            );
          support.rotation.y = q.angle;
        }
        const beam = box(
          "bridge beam",
          tr.width * 2 + 6,
          0.7,
          1.3,
          p.x,
          p.y - 0.8,
          p.z,
          wall,
        );
        beam.rotation.y = p.angle;
      }
      const p = sample(tr, tr.length * 0.34),
        river = cyl("bridge channel", 120, 0.08, p.x, -0.12, p.z, water);
      river.scaling.z = 1.35;
      for (const side of [-1, 1]) {
        const p = sample(tr, tr.length * 0.355, side * (tr.width + 4)),
          tower = node("bridge pylon", p.x, p.y, p.z);
        tower.rotation.y = p.angle;
        box("bridge pylon", 1.8, 21, 1.8, 0, 10.5, 0, cream, tower);
        box("pylon neon", 0.12, 18, 2, side * 0.95, 11, 0, accent, tower);
      }
      const crown = sample(tr, tr.length * 0.355),
        header = box(
          "bridge crown",
          tr.width * 2 + 10,
          1.2,
          2,
          crown.x,
          crown.y + 21,
          crown.z,
          cream,
        );
      header.rotation.y = crown.angle;
      for (const side of [-1, 1]) {
        const top = sample(tr, tr.length * 0.355, side * (tr.width + 4));
        for (const offset of [-70, -40, 40, 70]) {
          const end = sample(
              tr,
              tr.length * 0.355 + offset,
              side * (tr.width + 2),
            ),
            cable = MeshBuilder.CreateLines(
              "bridge suspension cable",
              {
                points: [
                  new Vector3(top.x, top.y + 20, top.z),
                  new Vector3(end.x, end.y + 1.6, end.z),
                ],
              },
              scene,
            );
          cable.color = Color3.FromHexString("#b9dcce");
        }
      }
    }
  }
  // Subtle asphalt grain, painted lane dashes and red/cream kerbstones.
  const texture = new DynamicTexture(
      "asphalt grain",
      { width: 128, height: 128 },
      scene,
      false,
    ),
    tc = texture.getContext();
  tc.fillStyle = tr.road;
  tc.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1200; i++) {
    tc.fillStyle = rng() > 0.5 ? "#ffffff0a" : "#0000000a";
    tc.fillRect(rng() * 128, rng() * 128, 1, 1);
  }
  texture.update();
  texture.uScale = 2;
  asphalt.diffuseTexture = texture;
  asphalt.diffuseColor = new Color3(1, 1, 1);
  for (let s = 0; s < tr.length; s += 6) {
    for (const side of [-1, 1]) {
      const p = sample(tr, s, side * (tr.width + 0.55));
      const a = box(
        "kerb",
        1.1,
        0.16,
        6,
        p.x,
        p.y + 0.1,
        p.z,
        Math.floor(s / 6) % 2 ? cream : accent,
      );
      a.rotation.y = p.angle;
      a.rotation.x = -Math.atan2(sample(tr, s + 3).y - sample(tr, s - 3).y, 6);
    }
  }
  for (let s = 14; s < tr.length; s += 17) {
    const p = sample(tr, s, 0);
    const a = box(
      "center dash",
      0.16,
      0.02,
      4,
      p.x,
      p.y + 0.075,
      p.z,
      mat("lane paint", night ? "#81aaa9" : "#d2d5bb"),
    );
    a.rotation.y = p.angle;
    a.rotation.x = -Math.atan2(sample(tr, s + 2).y - sample(tr, s - 2).y, 4);
  }
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 12; col++) {
      const p = sample(tr, row * 1.8, (col - 5.5) * ((tr.width * 2) / 12)),
        a = box(
          "finish squares",
          (tr.width * 2) / 12,
          0.03,
          1.8,
          p.x,
          0.09,
          p.z,
          (row + col) % 2 ? ivory : dark,
        );
      a.rotation.y = p.angle;
    }
  for (let s = 0; s < tr.length; s += 28) {
    for (const side of [-1, 1]) {
      const p = sample(tr, s, side * (tr.width + 4));
      if (
        (s > tr.length * 0.23 && s < tr.length * 0.36) ||
        night ||
        p.y > 0.8
      ) {
        cyl("barrier post", 0.32, 1.7, p.x, p.y + 0.85, p.z, ivory);
      }
    }
  }
  // Continuous rails follow both bends and grades without gaps at the joints.
  {
    const positions = [],
      indices = [];
    for (const side of [-1, 1])
      for (let s = 0; s < tr.length; s += 4) {
        const a = sample(tr, s, side * (tr.width + 4)),
          b = sample(tr, s + 4, side * (tr.width + 4));
        if (
          !night &&
          a.y <= 0.8 &&
          !(s > tr.length * 0.23 && s < tr.length * 0.36)
        )
          continue;
        const start = positions.length / 3;
        for (const p of [a, b])
          for (const [l, h] of [
            [-0.14, 0.9],
            [0.14, 0.9],
            [0.14, 1.3],
            [-0.14, 1.3],
          ])
            positions.push(p.x + p.nx * l, p.y + h, p.z + p.nz * l);
        for (let j = 0; j < 4; j++) {
          const k = (j + 1) % 4;
          indices.push(
            start + j,
            start + k,
            start + 4 + k,
            start + j,
            start + 4 + k,
            start + 4 + j,
          );
        }
      }
    const mesh = new Mesh("continuous guard rail", scene),
      data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    data.applyToMesh(mesh);
    mesh.material = night ? cream : wood;
    T.staticMeshes.push(mesh);
  }
  // Chevrons show the direction through the tightest corners.
  for (let s = 55; s < tr.length; s += 80) {
    const a = sample(tr, s - 8),
      b = sample(tr, s + 8),
      turn = Math.atan2(
        Math.sin(b.angle - a.angle),
        Math.cos(b.angle - a.angle),
      );
    if (Math.abs(turn) > 0.19) {
      const p = sample(tr, s, -Math.sign(turn) * (tr.width + 5)),
        r = node("chevron", p.x, p.y, p.z);
      r.rotation.y = p.angle;
      box("chevron post", 0.3, 3, 0.3, 0, 1.5, 0, wood, r);
      sign(
        turn > 0 ? "› › ›" : "‹ ‹ ‹",
        5.4,
        2,
        0,
        3,
        0,
        0,
        tr.edge,
        tr.accent,
        r,
      );
    }
  }
  const gate = node("starting arch"),
    sp = sample(tr, 0);
  gate.position.set(sp.x, 0, sp.z);
  gate.rotation.y = sp.angle;
  for (const side of [-1, 1]) {
    box("arch column", 1.5, 12, 1.5, side * (tr.width + 2), 6, 0, accent, gate);
    box("arch base", 3.4, 0.6, 3.4, side * (tr.width + 2), 0.3, 0, cream, gate);
  }
  box("arch header", tr.width * 2 + 6, 3.6, 1.1, 0, 12, 0, cream, gate);
  sign(
    "POCKET GRAND PRIX",
    tr.width * 2 + 1,
    2.5,
    0,
    12,
    -0.6,
    0,
    "#fff1d6",
    "#315847",
    gate,
  );
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const r = cyl(
      "start light housing",
      1.3,
      0.5,
      (i - 1) * 2.2,
      9.3,
      0,
      dark,
      gate,
    );
    r.rotation.x = Math.PI / 2;
    const l = ball(
      "start light",
      0.85,
      (i - 1) * 2.2,
      9.3,
      -0.33,
      mat("start light" + i, "#e0775b", { glow: true }),
      gate,
    );
    lights.push(l);
  }
  const moving = [];
  function safe(x, z, minimum = tr.width + 8) {
    if (night) {
      const channel = sample(tr, tr.length * 0.34);
      if (((x - channel.x) / 64) ** 2 + ((z - channel.z) / 84) ** 2 < 1)
        return false;
      if (x > 46 && x < 184 && z > 43 && z < 157) return false;
    }
    if (
      tr.theme === "forest" &&
      ((x - 115) / 56) ** 2 + ((z - 100) / 44) ** 2 < 1
    )
      return false;
    return project(tr, x, z).distance > minimum;
  }
  function tree(x, z, h = 10) {
    const ao = cyl(
      "tree contact shadow",
      h * 0.95,
      0.012,
      x + 0.7,
      0.016,
      z - 0.7,
      mat("tree shadow", "#375637", { alpha: 0.12 }),
    );
    ao.scaling.z = 0.65;
    cyl("tree trunk", 0.9, h * 0.45, x, h * 0.225, z, wood);
    if (desert) {
      for (const side of [-1, 1]) {
        cyl(
          "cactus arm",
          h * 0.13,
          h * 0.3,
          x + side * h * 0.24,
          h * 0.45,
          z,
          leaf,
        );
        box(
          "cactus joint",
          h * 0.3,
          h * 0.13,
          h * 0.13,
          x + side * h * 0.13,
          h * 0.3,
          z,
          leaf,
        );
      }
      cyl("cactus", h * 0.2, h, x, h / 2, z, leaf);
      ball("cactus crown", h * 0.2, x, h, z, leaf);
    } else if (rng() > 0.45) {
      for (let j = 0; j < 3; j++) {
        const cone = cyl(
          "fir",
          h * (0.68 - j * 0.12),
          h * 0.55,
          x,
          h * (0.6 + j * 0.25),
          z,
          j % 2 ? leaf2 : leaf,
          undefined,
          0,
        );
        cone.rotation.y = rng() * 6;
      }
    } else {
      const crown = ball("round canopy", h * 0.75, x, h * 0.85, z, leaf);
      crown.scaling.y = 1.12;
      ball(
        "round canopy",
        h * 0.53,
        x + h * 0.22,
        h * 0.86,
        z + h * 0.14,
        leaf2,
      );
    }
  }
  function rockCluster(x, z, h = 6) {
    for (let j = 0; j < 3; j++) {
      const a = ball(
        "boulder",
        h * (0.7 + j * 0.14),
        x + j * h * 0.3,
        h * 0.28,
        z + j * 0.8,
        rock,
        undefined,
        5,
      );
      a.scaling.set(1, 0.8 + rng() * 0.5, 0.85);
      a.rotation.y = rng() * 6;
    }
  }
  function cottage(x, z, angle = 0, scale = 1) {
    const r = node("cottage", x, 0, z);
    r.rotation.y = angle;
    r.scaling.setAll(scale);
    box("house", 12, 8, 10, 0, 4, 0, ivory, r);
    const roof = cyl("roof", 18, 6, 0, 10, 0, accent, r, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scaling.z = 0.8;
    box("door", 2.2, 4, 0.15, 0, 2, -5.1, wood, r);
    for (const x of [-3.6, 3.6]) {
      box("window trim", 2.6, 2.6, 0.2, x, 4.7, -5.1, wood, r);
      box(
        "window",
        2.1,
        2.1,
        0.25,
        x,
        4.7,
        -5.2,
        mat("window", night ? "#ffd48e" : "#8fbcb6", { glow: night ? 0.5 : 0 }),
        r,
      );
      box("mullion", 0.15, 2.2, 0.3, x, 4.7, -5.25, ivory, r);
    }
    box("chimney", 1.6, 5, 1.6, 3, 11, 1, rock, r);
    return r;
  }
  // Plant props deterministically and keep the drivable ribbon clear.
  for (let i = 0; i < 190; i++) {
    const s = rng() * tr.length,
      side = i % 2 ? 1 : -1,
      l = side * (tr.width + 12 + rng() * 65),
      p = sample(tr, s, l);
    if (!safe(p.x, p.z)) continue;
    if (desert && i % 3 === 0) rockCluster(p.x, p.z, 5 + rng() * 12);
    else if (!night || i % 3 === 0) tree(p.x, p.z, 6 + rng() * 9);
  }
  if (!desert) {
    for (let i = 0; i < 210; i++) {
      const p = sample(
        tr,
        rng() * tr.length,
        (i % 2 ? 1 : -1) * (tr.width + 4 + rng() * 6),
      );
      if (!safe(p.x, p.z, tr.width + 2)) continue;
      const m = i % 4 === 0 ? gold : i % 3 === 0 ? accent : ivory;
      cyl("flower stem", 0.045, 0.5, p.x, 0.25, p.z, leaf);
      for (let petal = 0; petal < 4; petal++) {
        const a = (petal * Math.PI) / 2,
          b = ball(
            "flower petal",
            0.24,
            p.x + Math.sin(a) * 0.13,
            0.52,
            p.z + Math.cos(a) * 0.13,
            m,
            undefined,
            4,
          );
        b.scaling.y = 0.35;
      }
      ball("flower center", 0.12, p.x, 0.55, p.z, gold, undefined, 4);
    }
  }
  for (let i = 0; i < 38; i++) {
    const a = (i / 38) * Math.PI * 2,
      d = 490 + rng() * 160,
      h = 25 + rng() * 90;
    const b = ball(
      "hills",
      1,
      80 + Math.sin(a) * d,
      h * 0.12,
      -20 + Math.cos(a) * d,
      hill,
      undefined,
      desert ? 6 : 14,
    );
    b.scaling.set(140 + rng() * 100, h * 0.65, 120 + rng() * 90);
    b.position.y = -h * 0.12;
    b.rotation.y = rng() * 3;
  }
  if (!night) {
    const cloudMat = mat("cloud", "#fff1df", { unlit: true });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2,
        cloud = node(
          "cloud",
          80 + Math.sin(a) * 440,
          75 + rng() * 65,
          -20 + Math.cos(a) * 440,
        );
      for (let j = 0; j < 4; j++) {
        const c = ball(
          "cloud puff",
          13 + j * 3.5,
          j * 10,
          Math.sin(j) * 2,
          0,
          cloudMat,
          cloud,
        );
        c.scaling.y = 0.6;
      }
      moving.push({ type: "cloud", root: cloud, speed: 0.2 + rng() * 0.25 });
    }
  } else {
    const starMat = mat("stars", "#e1eee2", { unlit: true });
    for (let i = 0; i < 100; i++) {
      const a = rng() * Math.PI * 2,
        elev = 0.25 + rng() * 0.9,
        d = 550;
      ball(
        "star",
        0.4 + rng() * 0.7,
        80 + Math.cos(a) * Math.cos(elev) * d,
        Math.sin(elev) * d,
        -20 + Math.sin(a) * Math.cos(elev) * d,
        starMat,
        undefined,
        4,
      );
    }
    ball(
      "moon",
      22,
      -175,
      170,
      300,
      mat("moon", "#fff0c1", { unlit: true }),
      undefined,
      24,
    );
  }
  if (tr.theme === "forest") {
    // A shaded garden arch gives the outer section a recognizable landmark.
    const gardenPoint = sample(tr, tr.length * 0.6),
      garden = node("garden tunnel", gardenPoint.x, 0, gardenPoint.z);
    garden.rotation.y = gardenPoint.angle;
    const tunnelStone = mat("garden stone", "#aeb599");
    for (let j = 0; j < 18; j++) {
      const a = ((j + 0.5) / 18) * Math.PI,
        r = tr.width + 4,
        block = box(
          "tunnel voussoir",
          (r * Math.PI) / 18 + 0.1,
          2,
          26,
          Math.cos(a) * r,
          Math.sin(a) * r,
          0,
          tunnelStone,
          garden,
        );
      block.rotation.z = a + Math.PI / 2;
    }
    for (const side of [-1, 1]) {
      box("tunnel foot", 3, 2, 30, side * (tr.width + 4), 1, 0, rock, garden);
      for (const z of [-9, 0, 9]) {
        const shrub = ball(
          "ivy",
          3.7,
          side * (tr.width + 5),
          3.3,
          z,
          leaf2,
          garden,
          8,
        );
        shrub.scaling.y = 0.65;
      }
    }
    // Lake, its small dock, and an island create a recognizable inner landscape.
    const lake = cyl("lake", 105, 0.08, 115, -0.11, 100, water);
    lake.scaling.z = 0.75;
    const shore = torus(
      "lake shore",
      105,
      3.5,
      115,
      -0.15,
      100,
      mat("shore", "#bec19b"),
    );
    shore.scaling.z = 0.75;
    for (let i = 0; i < 24; i++) {
      const x = 80 + rng() * 70,
        z = 72 + rng() * 50;
      const glint = box(
        "lake glint",
        2 + rng() * 5,
        0.02,
        0.1,
        x,
        0.025,
        z,
        mat("lake glints", "#acd2c3", { alpha: 0.4 }),
      );
      moving.push({ type: "water", root: glint });
    }
    const ripple = torus(
      "water ring",
      17,
      0.1,
      108,
      0.02,
      92,
      mat("water glint", "#a3d0c4", { alpha: 0.7 }),
    );
    moving.push({ type: "ripple", root: ripple });
    const dock = node("dock", 85, 0, 61);
    dock.rotation.y = -0.3;
    for (let j = 0; j < 9; j++)
      box("dock plank", 9, 0.3, 1.1, 0, 0.25, j * 1.2, wood, dock);
    for (const x of [-4, 4])
      for (const z of [0, 10]) cyl("dock pile", 0.6, 3, x, 0.4, z, wood, dock);
    const mill = node("windmill", 90, 0, -43);
    cyl("mill tower", 7, 19, 0, 9.5, 0, ivory, mill, 5);
    cyl("mill roof", 9, 5, 0, 21.5, 0, accent, mill, 0);
    const sails = node("sails", 0, 17, -4, mill);
    for (let j = 0; j < 4; j++) {
      const sail = node("sail", 0, 0, 0, sails);
      sail.rotation.z = (j * Math.PI) / 2;
      box("blade spar", 0.3, 13, 0.3, 0, 5, 0, wood, sail);
      box("cloth", 2.7, 8, 0.12, 1.2, 7, -0.15, cream, sail);
    }
    ball("hub", 1.3, 0, 0, -0.4, gold, sails);
    moving.push({ type: "mill", root: sails });
    for (const [x, z, a] of [
      [-150, 30, 0.5],
      [-163, -10, 0.5],
      [-158, -55, 0.5],
      [320, 55, -1.4],
    ])
      if (safe(x, z, 22)) cottage(x, z, a, 0.9);
    const balloon = node("balloon", -75, 65, 120);
    const b = ball("balloon canopy", 16, 0, 0, 0, accent, balloon, 20);
    b.scaling.y = 1.25;
    for (const side of [-1, 1]) {
      const rope = cyl(
        "balloon rope",
        0.1,
        9,
        side * 3,
        -13,
        0,
        ivory,
        balloon,
      );
      rope.rotation.z = side * 0.13;
    }
    box("basket", 5, 3.5, 4, 0, -18, 0, wood, balloon);
    moving.push({ type: "balloon", root: balloon });
  } else if (desert) {
    for (const [x, z, h] of [
      [90, 100, 35],
      [160, 150, 45],
      [350, 20, 38],
      [-170, -150, 55],
      [125, -160, 26],
    ])
      if (safe(x, z, 30)) {
        const mesa = node("mesa", x, 0, z);
        cyl("mesa base", 55, h, 0, h / 2, 0, hill, mesa, 40);
        cyl(
          "mesa strata",
          48,
          4,
          0,
          h * 0.65,
          0,
          mat("strata", "#d6a17b"),
          mesa,
          46,
        );
        cyl("mesa cap", 43, 5, 0, h, 0, rock, mesa, 46);
      }
    for (const f of [0.32, 0.71]) {
      const p = sample(tr, tr.length * f),
        arch = node("sandstone arch", p.x, 0, p.z);
      arch.rotation.y = p.angle;
      for (const side of [-1, 1]) {
        const foot = box(
          "arch cliff",
          8,
          20,
          8,
          side * (tr.width + 8),
          10,
          0,
          rock,
          arch,
        );
        foot.rotation.z = -side * 0.1;
        ball("arch shoulder", 10, side * (tr.width + 6), 19, 0, rock, arch, 6);
      }
      const top = box(
        "arch lintel",
        tr.width * 2 + 20,
        7,
        9,
        0,
        22,
        0,
        rock,
        arch,
      );
      top.rotation.z = 0.03;
    }
    node("desert camp", 70, 0, -175);
    cottage(70, -175, 0.8, 0.8);
    for (let i = 0; i < 4; i++)
      box(
        "supply crate",
        3,
        3,
        3,
        92 + (i % 2) * 4,
        1.5 + Math.floor(i / 2) * 3,
        -175,
        wood,
      );
  } else {
    box("harbor water", 130, 0.1, 105, 115, -0.12, 100, water);
    for (let i = 0; i < 12; i++) {
      const m = box(
        "water streak",
        8 + rng() * 12,
        0.02,
        0.12,
        65 + rng() * 100,
        0.01,
        60 + rng() * 70,
        mat("reflection", "#73a7a4", { glow: 0.2, alpha: 0.5 }),
      );
      moving.push({ type: "water", root: m });
    }
    const windowM = mat("city window", "#f1c991", { glow: 0.7 }),
      blueWindow = mat("city cyan", "#91d3d5", { glow: 0.6 });
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2,
        d = 350 + rng() * 80,
        x = 80 + Math.sin(a) * d,
        z = -20 + Math.cos(a) * d,
        h = 15 + rng() * 65,
        w = 10 + rng() * 20;
      if (!safe(x, z, 35)) continue;
      box(
        "building",
        w,
        h,
        w,
        x,
        h / 2,
        z,
        mat("building " + (i % 3), ["#3f5868", "#4e6271", "#576876"][i % 3]),
      );
      box("roof", w + 1, 1, w + 1, x, h + 0.3, z, ivory);
      for (let face = 0; face < 4; face++)
        for (let row = 0; row < Math.min(8, Math.floor(h / 6)); row++)
          for (let col = 0; col < 3; col++)
            if (rng() > 0.25) {
              const angle = (face * Math.PI) / 2,
                lx = (col - 1) * w * 0.25,
                lz = -w / 2 - 0.06,
                window = box(
                  "city window",
                  2.1,
                  2.8,
                  0.08,
                  x + lx * Math.cos(angle) + lz * Math.sin(angle),
                  4 + row * 6,
                  z - lx * Math.sin(angle) + lz * Math.cos(angle),
                  (row + col) % 3 ? windowM : blueWindow,
                );
              window.rotation.y = angle;
            }
      if (i % 4 === 0) {
        box("lit rooftop", w + 1.4, 0.18, w + 1.4, x, h + 1, z, accent);
        cyl("antenna", 0.15, 5, x, h + 3, z, dark);
        ball(
          "antenna beacon",
          0.5,
          x,
          h + 5.5,
          z,
          mat("beacon", "#f0a5a0", { glow: true }),
          undefined,
          6,
        );
      }
    }
    const crane = node("harbor crane", 175, 0, 105);
    box("crane mast", 2.3, 40, 2.3, 0, 20, 0, gold, crane);
    box("crane arm", 62, 2.5, 2.5, -12, 39, 0, gold, crane);
    for (let i = 0; i < 6; i++) {
      const diagonal = box(
        "crane brace",
        0.4,
        10,
        0.4,
        -35 + i * 8,
        43,
        0,
        ivory,
        crane,
      );
      diagonal.rotation.z = (i % 2 ? 1 : -1) * 0.9;
    }
    cyl("crane cable", 0.12, 24, -35, 26, 0, dark, crane);
    box("shipping container", 11, 6, 5, -35, 12, 0, accent, crane);
    for (let s = 30; s < tr.length; s += 70) {
      const side = Math.floor(s / 70) % 2 ? 1 : -1,
        p = sample(tr, s, side * (tr.width + 6)),
        lamp = node("street lamp", p.x, p.y, p.z);
      lamp.rotation.y = p.angle;
      box("lamp post", 0.35, 9, 0.35, 0, 4.5, 0, dark, lamp);
      box("lamp arm", 4, 0.25, 0.25, -side * 2, 9, 0, dark, lamp);
      box("lamp", 2, 0.12, 1, -side * 3.3, 8.8, 0, cream, lamp);
      cyl(
        "street light glow",
        9,
        0.015,
        p.x - side * p.nx * 3,
        p.y + 0.09,
        p.z - side * p.nz * 3,
        mat("lamp pool", "#a7d1c0", { alpha: 0.12, glow: 0.3 }),
      );
    }
    const p = sample(tr, tr.length * 0.55, tr.width + 7);
    sign(
      "MIDNIGHT RUN",
      24,
      5,
      p.x,
      12,
      p.z,
      p.angle + Math.PI,
      "#374759",
      "#b4e6d8",
    );
  }
  // Confetti pennants, pit stalls and course banners at the start.
  for (const side of [-1, 1]) {
    const p = sample(tr, 30, side * (tr.width + 13)),
      pit = node("pit stall", p.x, 0, p.z);
    pit.rotation.y = p.angle;
    for (const x of [-4, 4])
      for (const z of [-3, 3])
        box("tent post", 0.22, 4, 0.22, x, 2, z, ivory, pit);
    box("tent canopy", 10, 0.5, 8, 0, 4, 0, side > 0 ? accent : cream, pit);
    box("pit counter", 7, 1.8, 1.6, 0, 0.9, 2, wood, pit);
    for (let i = 0; i < 3; i++)
      ball(
        "spectator head",
        1.1,
        (i - 1) * 2,
        2.4,
        0,
        [leaf2, gold, accent][i],
        pit,
      );
  }
  const staticMeshes = T.merge();
  const karts = Array.from({ length: 6 }, (_, i) =>
    makeKart(
      T,
      i,
      i === 0 ? DRIVERS[options.color || 0].color : null,
      i === 0 ? options.kart || 0 : 0,
    ),
  );
  for (const kart of karts)
    for (const mesh of kart.meshes) shadows.addShadowCaster(mesh);
  const itemboxes = [],
    boxMat = mat("item box", "#efbd59", { glow: 0.12 }),
    ribbonMat = mat("box ribbon", "#fff0bb", { glow: 0.2 });
  for (let j = 0; j < tr.boxes.length; j++)
    for (const lane of [-6, 0, 6]) {
      const p = sample(tr, tr.boxes[j], lane),
        root = node("item box", p.x, p.y + 2.2, p.z);
      box("gold gift", 2.2, 2.2, 2.2, 0, 0, 0, boxMat, root);
      box("gift ribbon", 0.4, 2.3, 2.3, 0, 0, 0, ribbonMat, root);
      box("gift ribbon", 2.3, 0.4, 2.3, 0, 0, 0, ribbonMat, root);
      const ring = torus("box halo", 3, 0.05, 0, -1.9, 0, ribbonMat, root);
      itemboxes.push({ root, index: j, ring, baseY: p.y });
    }
  return {
    scene,
    camera,
    tools: T,
    karts,
    itemboxes,
    moving,
    lights,
    shadows,
    staticMeshes,
    update(time, g, dt) {
      for (const b of itemboxes) {
        b.root.rotation.y = time * 0.7;
        b.root.position.y =
          b.baseY + 2.25 + Math.sin(time * 2 + b.index) * 0.25;
        b.root.setEnabled(
          g?.options.mode !== "speed" && !(g?.boxCooldown[b.index + ":0"] > 0),
        );
      }
      for (const m of moving) {
        if (m.type === "mill") m.root.rotation.z = time * 0.3;
        if (m.type === "balloon")
          m.root.position.y = 65 + Math.sin(time * 0.25) * 3;
        if (m.type === "cloud") {
          m.root.position.x += m.speed * dt;
          if (m.root.position.x > 650) m.root.position.x = -650;
        }
        if (m.type === "ripple")
          m.root.scaling.x = m.root.scaling.z = 1 + Math.sin(time * 0.6) * 0.04;
        if (m.type === "water")
          m.root.scaling.x = 1 + Math.sin(time * 0.6 + m.root.position.x) * 0.2;
      }
      for (let i = 0; i < lights.length; i++) {
        const active = g?.mode === "countdown" && g.countdown < 3 - i;
        lights[i].material.emissiveColor = Color3.FromHexString(
          g?.mode === "racing" && g.time < 1
            ? "#9ad18d"
            : active
              ? "#e98263"
              : "#5d7260",
        ).scale(active ? 1 : 0.35);
      }
      if (g) {
        sun.position.set(g.racers[0].x + 150, 240, g.racers[0].z - 160);
        for (let i = 0; i < 6; i++) karts[i].update(g.racers[i], time, dt);
      }
    },
  };
}
