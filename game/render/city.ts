import * as THREE from "three";
import type { District } from "../world/district";
import { ROAD_HALF } from "../world/district";
import { asphaltTexture, commitFacadeTexture, dirtTexture, facadeTexture, sidewalkTexture } from "./textures";

export function buildCity(scene: THREE.Scene, district: District, quality: "high" | "low"): THREE.Group {
  const root = new THREE.Group();
  const asphalt = asphaltTexture();
  asphalt.repeat.set(18, 18);
  const walk = sidewalkTexture();
  walk.repeat.set(20, 20);
  const dirt = dirtTexture();
  dirt.repeat.set(14, 14);

  const spanX = district.worldMaxX - district.worldMinX;
  const spanZ = district.worldMaxZ - district.worldMinZ;
  const midX = (district.worldMinX + district.worldMaxX) / 2;
  const midZ = (district.worldMinZ + district.worldMaxZ) / 2;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(spanX + 40, spanZ + 40),
    new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, color: 0x161b22 }),
  );
  ground.position.set(midX, 0, midZ);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  root.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, color: 0x888888 });
  const walkMat = new THREE.MeshStandardMaterial({ map: walk, roughness: 0.95, color: 0x999084 });

  for (const sx of district.streetsX) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2, 0.06, spanZ), roadMat);
    road.position.set(sx, 0.03, midZ);
    road.receiveShadow = true;
    root.add(road);
  }
  for (const sz of district.streetsZ) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.06, ROAD_HALF * 2), roadMat);
    road.position.set(midX, 0.03, sz);
    road.receiveShadow = true;
    root.add(road);
  }

  for (const s of district.sidewalks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.12, s.d), walkMat);
    mesh.position.set(s.x, 0.06, s.z);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  for (const a of district.alleys) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(a.w, 0.05, a.d),
      new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 1 }),
    );
    mesh.position.set(a.x, 0.04, a.z);
    root.add(mesh);
  }

  for (const b of district.buildings) {
    const tex =
      b.commitLevel != null ? commitFacadeTexture(b.commitLevel, b.windows) : facadeTexture(b.hue, true);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.86,
      color: 0xdddddd,
      emissive: b.commitLevel != null ? 0x0e4429 : 0x000000,
      emissiveIntensity: b.commitLevel != null ? 0.22 + (b.commitLevel ?? 0) * 0.08 : 0,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = quality === "high";
    mesh.receiveShadow = true;
    root.add(mesh);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.3, 0.25, b.d + 0.3),
      new THREE.MeshStandardMaterial({
        color: b.commitLevel != null ? 0x052e16 : 0x3a2a22,
        roughness: 1,
      }),
    );
    roof.position.set(b.x, b.h + 0.1, b.z);
    root.add(roof);
    if (b.label) {
      const sign = makeSign(b.label);
      sign.position.set(b.x, b.h + 1.4, b.z);
      root.add(sign);
    }
  }

  for (const p of district.props) {
    root.add(makeProp(p.x, p.z, p.yaw, p.kind, quality));
  }

  addSkyline(root, district);
  addBounds(root, district);
  scene.add(root);
  return root;
}

function makeSign(text: string): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#120c10";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#f0c14a";
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = "#f6ead2";
  ctx.font = "bold 42px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 22), 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(10, 1.1 * text.length), 2.2),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }),
  );
}

function makeProp(x: number, z: number, yaw: number, kind: string, quality: "high" | "low"): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  if (kind === "lamp") {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 5.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.4, roughness: 0.5 }),
    );
    pole.position.y = 2.7;
    pole.castShadow = quality === "high";
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xf2d38a, emissive: 0xffcc66, emissiveIntensity: 1.2 }),
    );
    head.position.set(0, 5.35, 0.2);
    g.add(pole, head);
  } else if (kind === "palm") {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 4.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }),
    );
    trunk.position.y = 2.1;
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x2f6a38, roughness: 0.9 }),
    );
    leaves.position.y = 4.4;
    leaves.scale.set(1.2, 0.45, 1.2);
    g.add(trunk, leaves);
  } else if (kind === "dumpster") {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.1, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x2d6b3a, roughness: 0.7, metalness: 0.2 }),
    );
    box.position.y = 0.55;
    box.castShadow = true;
    g.add(box);
  } else if (kind === "hydrant") {
    const h = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }),
    );
    h.position.y = 0.35;
    g.add(h);
  } else if (kind === "fence") {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.2, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7a7a7a, metalness: 0.3, roughness: 0.5 }),
    );
    f.position.y = 0.6;
    g.add(f);
  } else {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x8a6230, roughness: 1 }),
    );
    c.position.y = 0.35;
    g.add(c);
  }
  return g;
}

function addSkyline(root: THREE.Group, district: District): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x0e4429, roughness: 1, emissive: 0x052e16, emissiveIntensity: 0.35 });
  const midX = (district.worldMinX + district.worldMaxX) / 2;
  const midZ = (district.worldMinZ + district.worldMaxZ) / 2;
  const r = Math.max(district.worldMaxX - district.worldMinX, district.worldMaxZ - district.worldMinZ) / 2 + 36;
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const h = 12 + (i % 5) * 9;
    const m = new THREE.Mesh(new THREE.BoxGeometry(12, h, 12), mat);
    m.position.set(midX + Math.sin(ang) * r, h / 2, midZ + Math.cos(ang) * r);
    root.add(m);
  }
}

function addBounds(root: THREE.Group, district: District): void {
  const wall = new THREE.MeshStandardMaterial({ color: 0x4a3a58, roughness: 1 });
  const spanX = district.worldMaxX - district.worldMinX + 8;
  const spanZ = district.worldMaxZ - district.worldMinZ + 8;
  const midX = (district.worldMinX + district.worldMaxX) / 2;
  const midZ = (district.worldMinZ + district.worldMaxZ) / 2;
  const north = new THREE.Mesh(new THREE.BoxGeometry(spanX, 6, 2), wall);
  north.position.set(midX, 3, district.worldMaxZ + 2);
  const south = north.clone();
  south.position.z = district.worldMinZ - 2;
  const east = new THREE.Mesh(new THREE.BoxGeometry(2, 6, spanZ), wall);
  east.position.set(district.worldMaxX + 2, 3, midZ);
  const west = east.clone();
  west.position.x = district.worldMinX - 2;
  root.add(north, south, east, west);
}

export function makeMarker(): THREE.Group {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 0.16, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffd23a,
      emissive: 0xffc107,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.88,
    }),
  );
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.45, 6.5, 12),
    new THREE.MeshStandardMaterial({
      color: 0xffd23a,
      emissive: 0xffcc33,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.45,
    }),
  );
  beam.position.y = 3.3;
  pad.position.y = 0.08;
  g.add(pad, beam);
  return g;
}

export function makePedPrimitive(kind: "civ" | "cop"): THREE.Group {
  const g = new THREE.Group();
  const shirt = kind === "cop" ? 0x1d4e89 : [0x8b3a3a, 0x3d5a80, 0x6b5a3a, 0x2f4f3a][Math.floor(Math.random() * 4)];
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7 }),
  );
  body.position.y = 0.95;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: 0.6 }),
  );
  head.position.y = 1.55;
  g.add(body, head);
  if (kind === "cop") {
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a2744 }),
    );
    hat.position.y = 1.74;
    g.add(hat);
  }
  return g;
}

export function makeTrafficCar(cop: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 4.2),
    new THREE.MeshStandardMaterial({
      color: cop ? 0xf2f2f2 : [0x7a1f1f, 0x2a3a5a, 0x3a3a3a, 0x8a7a3a][Math.floor(Math.random() * 4)],
      roughness: 0.45,
      metalness: 0.25,
    }),
  );
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 2.1),
    new THREE.MeshStandardMaterial({ color: cop ? 0x1a2744 : 0x223044, roughness: 0.3, metalness: 0.2 }),
  );
  cabin.position.set(0, 1.05, -0.2);
  g.add(body, cabin);
  if (cop) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 1.6 }),
    );
    bar.position.set(0, 1.4, 0);
    g.add(bar);
  }
  return g;
}
