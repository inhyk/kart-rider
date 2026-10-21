import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder.js";
import { CreateLines } from "@babylonjs/core/Meshes/Builders/linesBuilder.js";
const MeshBuilder = {
  CreateBox,
  CreateSphere,
  CreateCylinder,
  CreateTorus,
  CreatePlane,
  CreateLines,
};
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import "@babylonjs/core/Rendering/edgesRenderer.js";
import "@babylonjs/core/Meshes/instancedMesh.js";
export {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  Mesh,
  VertexData,
  TransformNode,
  StandardMaterial,
  DynamicTexture,
  HemisphericLight,
  DirectionalLight,
  FreeCamera,
  ShadowGenerator,
};
export function makeTools(scene) {
  const cache = new Map(),
    staticMeshes = [];
  let register = true;
  function material(name, hex, opts = {}) {
    const key = name + hex;
    if (cache.has(key)) return cache.get(key);
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    if (opts.glow)
      m.emissiveColor = Color3.FromHexString(hex).scale(
        opts.glow === true ? 0.7 : opts.glow,
      );
    if (opts.alpha !== undefined) m.alpha = opts.alpha;
    if (opts.unlit) {
      m.disableLighting = true;
      m.emissiveColor = Color3.FromHexString(hex);
    }
    cache.set(key, m);
    return m;
  }
  function setup(mesh, x, y, z, mat, parent) {
    mesh.position.set(x, y, z);
    mesh.material = mat;
    if (parent) mesh.parent = parent;
    else if (register) staticMeshes.push(mesh);
    mesh.isPickable = false;
    return mesh;
  }
  function box(name, w, h, d, x, y, z, m, parent) {
    return setup(
      MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene),
      x,
      y,
      z,
      m,
      parent,
    );
  }
  function ball(name, d, x, y, z, m, parent, segments = 12) {
    return setup(
      MeshBuilder.CreateSphere(name, { diameter: d, segments }, scene),
      x,
      y,
      z,
      m,
      parent,
    );
  }
  function cyl(name, d, h, x, y, z, m, parent, top) {
    return setup(
      MeshBuilder.CreateCylinder(
        name,
        {
          diameter: d,
          height: h,
          tessellation: 12,
          ...(top !== undefined ? { diameterTop: top, diameterBottom: d } : {}),
        },
        scene,
      ),
      x,
      y,
      z,
      m,
      parent,
    );
  }
  function torus(name, d, t, x, y, z, m, parent) {
    return setup(
      MeshBuilder.CreateTorus(
        name,
        { diameter: d, thickness: t, tessellation: 20 },
        scene,
      ),
      x,
      y,
      z,
      m,
      parent,
    );
  }
  function node(name, x = 0, y = 0, z = 0, parent) {
    const n = new TransformNode(name, scene);
    n.position.set(x, y, z);
    if (parent) n.parent = parent;
    return n;
  }
  function sign(
    text,
    w,
    h,
    x,
    y,
    z,
    angle = 0,
    bg = "#fff5dd",
    ink = "#244a3c",
    parent,
  ) {
    const texture = new DynamicTexture(
      "sign " + text,
      { width: 1024, height: 256 },
      scene,
      false,
    );
    const ctx = texture.getContext();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.font = "900 " + Math.min(130, 1500 / text.length) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.fillText(text, 512, 134);
    texture.update();
    const m = material("sign " + text, bg);
    m.diffuseTexture = texture;
    m.emissiveColor = new Color3(0.13, 0.13, 0.13);
    m.backFaceCulling = false;
    const p = setup(
      MeshBuilder.CreatePlane("sign " + text, { width: w, height: h }, scene),
      x,
      y,
      z,
      m,
      parent,
    );
    p.rotation.y = angle;
    return p;
  }
  function merge() {
    const groups = new Map();
    for (const mesh of staticMeshes) {
      if (mesh.isDisposed() || mesh.parent || mesh.getTotalVertices() === 0)
        continue;
      const key =
        mesh.material?.uniqueId +
        ":" +
        mesh.getVerticesDataKinds().sort().join(",");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(mesh);
    }
    const merged = [];
    for (const meshes of groups.values()) {
      if (meshes.length > 1) {
        const m = Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
        if (m) {
          m.receiveShadows = true;
          m.freezeWorldMatrix();
          merged.push(m);
        }
      } else if (meshes[0]) {
        meshes[0].receiveShadows = true;
        meshes[0].freezeWorldMatrix();
        merged.push(meshes[0]);
      }
    }
    register = false;
    return merged;
  }
  return {
    scene,
    material,
    box,
    ball,
    cyl,
    torus,
    node,
    sign,
    merge,
    staticMeshes,
    setStatic: (v) => (register = v),
  };
}
