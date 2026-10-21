import { DRIVERS } from "./core.mjs";
import { Color3, Mesh, MeshBuilder, DynamicTexture } from "./graphics.js";
export function makeKart(tools, index = 0, paint = null, model = 0) {
  const { scene, material: mat, box, ball, cyl, torus, node } = tools;
  tools.setStatic(false);
  const root = node("kart " + index),
    visual = node("suspension", 0, 0, 0, root),
    bodyColor = paint || DRIVERS[index].color;
  const body = mat("kart paint " + index, bodyColor),
    dark = mat("tire", "#273a3c"),
    seat = mat("seat", "#3d524e"),
    cream = mat("kart ivory", "#fff1d6"),
    steel = mat("steel", "#8caaa7"),
    skin = mat("face", "#f0cb9f"),
    visor = mat("visor", "#254853"),
    shine = mat("visor shine", "#b8e9df"),
    exhaust = mat("exhaust", "#526363"),
    trim = mat("trim " + index, bodyColor, { glow: 0.1 });
  box("floor pan", 2.8, 0.35, 4.2, 0, 0.65, 0, dark, visual);
  box("rounded hull", 3.05, 0.7, 3.7, 0, 1.05, 0, body, visual);
  const nose = ball("curved fairing", 3.1, 0, 1.08, 1.35, body, visual);
  nose.scaling.set(1, 0.45, 0.75);
  box("bonnet stripe", 0.5, 0.035, 1.6, 0, 1.59, 1.38, cream, visual);
  box("front bumper", 3.5, 0.25, 0.35, 0, 0.7, 2.55, cream, visual);
  for (const x of [-1.45, 1.45]) {
    const side = ball("sidepod", 1.4, x, 1, -0.3, body, visual);
    side.scaling.set(0.55, 0.52, 1.8);
    box(
      "side stripe",
      0.06,
      0.1,
      1.6,
      x + Math.sign(x) * 0.35,
      1.1,
      -0.3,
      cream,
      visual,
    );
  }
  body.specularColor = new Color3(0.35, 0.35, 0.3);
  body.specularPower = 64;
  box("front grille", 1.4, 0.25, 0.14, 0, 1, 2.48, dark, visual);
  const headlamp = mat("headlight", "#fff3cf", { glow: 0.35 });
  for (const side of [-1, 1]) {
    const bezel = ball(
      "headlight bezel",
      0.72,
      side * 1.03,
      1.32,
      2.34,
      dark,
      visual,
    );
    bezel.scaling.set(1, 0.43, 0.32);
    const lamp = ball(
      "headlight",
      0.59,
      side * 1.03,
      1.34,
      2.48,
      headlamp,
      visual,
    );
    lamp.scaling.set(1, 0.4, 0.22);
    box(
      "tail light",
      0.62,
      0.19,
      0.12,
      side * 0.99,
      1.16,
      -2.16,
      mat("tail lamp", "#df604c", { glow: 0.25 }),
      visual,
    );
  }
  const numberTexture = new DynamicTexture(
    "number " + index,
    { width: 128, height: 128 },
    scene,
    false,
  );
  const nc = numberTexture.getContext();
  nc.fillStyle = "#fff0d0";
  nc.beginPath();
  nc.arc(64, 64, 53, 0, Math.PI * 2);
  nc.fill();
  nc.font = "900 65px sans-serif";
  nc.textAlign = "center";
  nc.textBaseline = "middle";
  nc.fillStyle = "#304f44";
  nc.fillText(String(index + 1).padStart(2, "0"), 64, 67);
  numberTexture.update();
  const numberMat = mat("racing number " + index, "#ffffff");
  numberMat.diffuseTexture = numberTexture;
  numberMat.diffuseTexture.hasAlpha = true;
  numberMat.useAlphaFromDiffuseTexture = true;
  numberMat.backFaceCulling = false;
  const number = MeshBuilder.CreatePlane(
    "hood number",
    { width: 0.95, height: 0.95 },
    scene,
  );
  number.material = numberMat;
  number.parent = visual;
  number.position.set(0, 1.82, 1.37);
  number.rotation.x = Math.PI / 2;
  const wheels = [];
  for (const x of [-1.65, 1.65])
    for (const z of [-1.45, 1.45]) {
      const pivot = node("wheel pivot", x, 0.68, z, visual);
      const wheel = cyl("slick tire", 1.24, 0.62, 0, 0, 0, dark, pivot);
      wheel.rotation.z = Math.PI / 2;
      const rim = cyl("rim", 0.69, 0.65, 0, 0, 0, steel, pivot);
      rim.rotation.z = Math.PI / 2;
      const hub = cyl("hub", 0.29, 0.68, 0, 0, 0, cream, pivot);
      hub.rotation.z = Math.PI / 2;
      for (const spoke of [-1, 1]) {
        const a = box(
          "spoke",
          0.69,
          0.09,
          0.07,
          x > 0 ? 0.34 : -0.34,
          0,
          0,
          cream,
          pivot,
        );
        a.rotation.x = (spoke * Math.PI) / 4;
        a.rotation.z = Math.PI / 2;
      } // Bake wheel colours into vertices so five parts share one draw call.
      const parts = pivot.getChildMeshes(),
        wheelMaterial = mat("wheel palette", "#ffffff");
      wheelMaterial.specularColor = new Color3(0.15, 0.15, 0.15);
      const saved = pivot.position.clone();
      pivot.position.set(0, 0, 0);
      for (const part of parts) {
        const c = part.material.diffuseColor,
          colors = new Float32Array(part.getTotalVertices() * 4);
        for (let i = 0; i < colors.length; i += 4) {
          colors[i] = c.r;
          colors[i + 1] = c.g;
          colors[i + 2] = c.b;
          colors[i + 3] = 1;
        }
        part.setVerticesData("color", colors);
        part.material = wheelMaterial;
        part.computeWorldMatrix(true);
      }
      const combined = Mesh.MergeMeshes(
        parts,
        true,
        true,
        undefined,
        false,
        false,
      );
      combined.parent = pivot;
      combined.position.set(0, 0, 0);
      pivot.position.copyFrom(saved);
      wheels.push({ pivot, wheel: combined, front: z > 0 });
    }
  box("bucket seat", 1.4, 1.3, 0.65, 0, 1.55, -0.9, seat, visual);
  const back = box("seat trim", 1.5, 0.2, 0.68, 0, 2.18, -0.9, cream, visual);
  back.rotation.x = -0.1;
  for (const x of [-0.8, 0.8]) {
    box("spoiler support", 0.15, 0.7, 0.18, x, 1.6, -2.04, exhaust, visual);
    const pipe = cyl("exhaust pipe", 0.35, 0.8, x, 0.85, -2.05, steel, visual);
    pipe.rotation.x = Math.PI / 2;
    const hole = cyl(
      "exhaust opening",
      0.24,
      0.02,
      x,
      0.85,
      -2.47,
      dark,
      visual,
    );
    hole.rotation.x = Math.PI / 2;
  }
  const wing = box("rear wing", 3.9, 0.18, 0.8, 0, 1.98, -2.08, body, visual);
  wing.rotation.x = -0.1;
  for (const x of [-1.9, 1.9]) {
    const end = ball("wing endplate", 1, x, 2, -2.08, cream, visual);
    end.scaling.set(0.12, 0.55, 0.95);
  }
  if (model === 1) {
    for (const x of [-1.2, 1.2]) {
      const f = ball("cloud fender", 1.4, x, 1.3, 0.2, cream, visual);
      f.scaling.set(0.65, 0.35, 1.6);
    }
  }
  if (model === 2) {
    box("racing splitter", 3.9, 0.12, 1, 0, 0.55, 2.1, dark, visual);
    for (const x of [-1.3, 1.3])
      box("aero fin", 0.12, 0.7, 1.2, x, 1.2, -1.2, trim, visual);
  }
  const driver = node("driver", 0, 0, 0, visual);
  const torso = ball("suit", 1.3, 0, 2, -0.3, body, driver);
  torso.scaling.set(0.85, 1, 0.8);
  ball("helmet", 1.85, 0, 2.95, -0.35, body, driver, 18);
  const face = ball("face", 1.44, 0, 2.89, 0.18, skin, driver, 16);
  face.scaling.z = 0.75;
  const goggles = ball("goggles", 1.4, 0, 3.1, 0.68, visor, driver, 16);
  goggles.scaling.set(1, 0.38, 0.22);
  const reflection = box(
    "visor highlight",
    0.5,
    0.07,
    0.025,
    -0.25,
    3.2,
    0.87,
    shine,
    driver,
  );
  reflection.rotation.z = -0.12;
  torus("helmet rim", 1.62, 0.09, 0, 2.64, -0.35, cream, driver);
  for (const x of [-0.2, 0.2]) {
    const stripe = torus(
      "helmet racing stripe",
      1.82,
      0.065,
      x,
      2.95,
      -0.35,
      cream,
      driver,
    );
    stripe.rotation.z = Math.PI / 2;
  }
  const helmetBadge = ball(
    "helmet badge",
    0.32,
    -0.72,
    3.04,
    -0.24,
    cream,
    driver,
  );
  helmetBadge.scaling.x = 0.25;
  box("smile", 0.28, 0.045, 0.035, 0, 2.6, 0.72, seat, driver);
  for (const x of [-0.56, 0.56]) {
    ball("glove", 0.38, x, 2.05, 0.7, cream, driver);
    const arm = cyl("sleeve", 0.37, 0.8, x, 2.05, 0.2, body, driver);
    arm.rotation.x = Math.PI / 2;
  }
  const steering = torus(
    "steering wheel",
    0.95,
    0.12,
    0,
    2.02,
    0.85,
    dark,
    visual,
  );
  steering.rotation.x = 0.6;
  const column = cyl("column", 0.12, 0.75, 0, 1.7, 0.95, steel, visual);
  column.rotation.x = -0.5;
  // Keep the model's silhouette while reducing it to a few draw calls.
  const byMat = new Map();
  for (const m of visual.getChildMeshes()) {
    if (m.parent?.name === "wheel pivot") continue;
    const key = m.material.uniqueId;
    if (!byMat.has(key)) byMat.set(key, []);
    byMat.get(key).push(m);
  }
  for (const meshes of byMat.values()) {
    if (meshes.length > 1) {
      for (const m of meshes) m.computeWorldMatrix(true);
      const merged = Mesh.MergeMeshes(
        meshes,
        true,
        true,
        undefined,
        false,
        false,
      );
      if (merged) {
        merged.parent = visual;
        merged.position.set(0, 0, 0);
      }
    }
  }
  const labelTexture = new DynamicTexture(
      "racer name " + index,
      { width: 256, height: 64 },
      scene,
      false,
    ),
    lc = labelTexture.getContext();
  lc.fillStyle = "#173c34b8";
  lc.beginPath();
  if (lc.roundRect) lc.roundRect(0, 0, 256, 64, 25);
  else lc.rect(0, 0, 256, 64);
  lc.fill();
  lc.font = "800 32px sans-serif";
  lc.textAlign = "center";
  lc.textBaseline = "middle";
  lc.fillStyle = "#fff5d8";
  lc.fillText(DRIVERS[index].name, 128, 34);
  labelTexture.update();
  const labelMaterial = mat("racer name " + index, "#ffffff", { unlit: true });
  labelMaterial.diffuseTexture = labelTexture;
  labelMaterial.emissiveTexture = labelTexture;
  labelTexture.hasAlpha = true;
  labelMaterial.useAlphaFromDiffuseTexture = true;
  const label = MeshBuilder.CreatePlane(
    "racer name",
    { width: 3, height: 0.75 },
    scene,
  );
  label.parent = root;
  label.position.y = 5;
  label.material = labelMaterial;
  label.billboardMode = Mesh.BILLBOARDMODE_ALL;
  label.isPickable = false;
  label.setEnabled(index !== 0);
  const glow = mat("turbo glow", "#a6f2f1", { glow: true, alpha: 0.85 }),
    fire = mat("turbo core", "#fff1b1", { glow: true });
  glow.disableLighting = true;
  fire.disableLighting = true;
  const flames = [];
  for (const x of [-0.8, 0.8]) {
    const f = cyl("turbo plume", 0.7, 1.6, x, 0.85, -3.25, glow, visual, 0);
    f.rotation.x = -Math.PI / 2;
    const c = cyl("turbo core", 0.36, 1.1, x, 0.85, -2.95, fire, visual, 0);
    c.rotation.x = -Math.PI / 2;
    flames.push(f, c);
  }
  const shieldMat = mat("shield " + index, "#9cf0ed", {
    glow: 0.4,
    alpha: 0.17,
  });
  shieldMat.specularColor = new Color3(0.6, 0.8, 0.8);
  const shield = ball("shield", 6.2, 0, 2, 0, shieldMat, root, 20);
  const shieldRing = torus(
    "shield ring",
    5.4,
    0.05,
    0,
    1,
    0,
    mat("shield edge", "#b8f8e7", { glow: true, alpha: 0.5 }),
    root,
  );
  const bubble = ball(
    "water bubble",
    5.4,
    0,
    2,
    0,
    mat("bubble", "#91dbf4", { alpha: 0.35, glow: 0.12 }),
    root,
    20,
  );
  const shadow = cyl(
    "contact shadow",
    4.8,
    0.012,
    0,
    0.045,
    0,
    mat("contact shadow", "#163c31", { alpha: 0.22 }),
    root,
  );
  shadow.scaling.z = 1.32;
  const sparkMat = mat("drift sparks", "#ffa455", { glow: true }),
    sparks = [];
  for (let i = 0; i < 8; i++) {
    const a = i
      ? sparks[0].createInstance("drift spark")
      : ball("drift spark", 0.15, 0, 0, 0, sparkMat, root, 4);
    a.parent = root;
    a.isPickable = false;
    sparks.push(a);
  }
  for (const m of [shield, shieldRing, bubble, ...flames, ...sparks])
    m.setEnabled(false);
  return {
    root,
    visual,
    wheels,
    shield,
    shieldRing,
    bubble,
    flames,
    sparks,
    shadow,
    driver,
    meshes: visual.getChildMeshes(),
    update(r, time, dt) {
      root.position.set(r.x, r.y || 0, r.z);
      const camera = scene.activeCamera;
      const labelDistance = camera
        ? Math.hypot(
            r.x - camera.position.x,
            (r.y || 0) + 5 - camera.position.y,
            r.z - camera.position.z,
          )
        : 30;
      label.setEnabled(
        index !== 0 && r.speed > 1 && labelDistance > 8 && labelDistance < 115,
      );
      label.scaling.setAll(Math.min(1, labelDistance / 35));
      label.visibility = Math.min(
        1,
        Math.max(0, (labelDistance - 8) / 8),
        Math.max(0, (115 - labelDistance) / 25),
      );
      visual.rotation.x = -(r.pitch || 0);
      root.rotation.y =
        r.angle +
        (r.stun > 0 && r.bubble === 0
          ? Math.sin(time * 16) * Math.min(0.45, r.stun)
          : 0);
      visual.rotation.z +=
        (-r.steer * 0.06 +
          (r.drifting ? -r.driftSide * 0.08 : 0) -
          visual.rotation.z) *
        Math.min(1, dt * 12);
      visual.position.y =
        Math.sin(time * 12 + r.id) * 0.025 * Math.min(1, r.speed / 20);
      for (const w of wheels) {
        w.pivot.rotation.y = w.front ? (r.steer || 0) * 0.4 : 0;
        w.wheel.rotation.x += r.speed * dt * 1.5;
      }
      shield.setEnabled(r.shield > 0);
      shieldRing.setEnabled(r.shield > 0);
      shieldRing.rotation.z = Math.sin(time * 3) * 0.08;
      shield.material.alpha =
        r.shield < 1 ? 0.1 + Math.sin(time * 20) * 0.07 : 0.17;
      bubble.setEnabled(r.bubble > 0);
      bubble.position.y = 2 + Math.sin(time * 4) * 0.2;
      flames.forEach((f, i) => {
        f.setEnabled(r.boost > 0);
        f.scaling.y = 1 + Math.sin(time * 45 + i) * 0.22;
      });
      sparks.forEach((s, i) => {
        s.setEnabled(r.drifting);
        const side = i % 2 ? 1 : -1,
          age = (time * 3 + i * 0.11) % 1;
        s.position.set(
          side * (1.65 + age * 0.7),
          0.22 + Math.sin(age * Math.PI) * 0.5,
          -1.5 - age * 3,
        );
        s.scaling.setAll((1 - age) * 1.7);
      });
    },
  };
}
