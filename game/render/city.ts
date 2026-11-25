import * as THREE from "three";
import type { District } from "../world/district";
import { buildDowntown, type DowntownKit } from "./downtown";
import { dirtTexture } from "./textures";

export function buildCity(scene: THREE.Scene, district: District, quality: "high" | "low", kit: DowntownKit): THREE.Group {
  const root = new THREE.Group();
  const dirt = dirtTexture();
  dirt.repeat.set(14, 14);

  const spanX = district.worldMaxX - district.worldMinX;
  const spanZ = district.worldMaxZ - district.worldMinZ;
  const midX = (district.worldMinX + district.worldMaxX) / 2;
  const midZ = (district.worldMinZ + district.worldMaxZ) / 2;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(spanX + 40, spanZ + 40),
    new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, color: 0x99928b }),
  );
  ground.position.set(midX, 0, midZ);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  root.add(ground);

  buildDowntown(root, district, kit, quality === "high");
  const cameraBox = new THREE.BoxGeometry(1, 1, 1);
  const cameraBoxMaterial = new THREE.MeshBasicMaterial();
  for (const b of district.buildings) {
    const obstruction = new THREE.Mesh(cameraBox, cameraBoxMaterial);
    obstruction.position.set(b.x, b.h / 2, b.z);
    obstruction.scale.set(b.w, b.h, b.d);
    obstruction.visible = false;
    root.add(obstruction);

    if (b.label) {
      const sign = makeSign(b.label);
      sign.position.set(b.x, b.h + 1.4, b.z);
      root.add(sign);
    }
  }

  for (const p of district.props) {
    if (p.kind === "lamp" || p.kind === "palm" || p.kind === "fence") {
      root.add(makeProp(p.x, p.z, p.yaw, p.kind, quality));
    }
  }

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
  } else {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.2, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7a7a7a, metalness: 0.3, roughness: 0.5 }),
    );
    f.position.y = 0.6;
    g.add(f);
  }
  return g;
}

function addBounds(root: THREE.Group, district: District): void {
  const wall = new THREE.MeshStandardMaterial({ color: 0x887977, roughness: 1 });
  const spanX = district.worldMaxX - district.worldMinX + 8;
  const spanZ = district.worldMaxZ - district.worldMinZ + 8;
  const midX = (district.worldMinX + district.worldMaxX) / 2;
  const midZ = (district.worldMinZ + district.worldMaxZ) / 2;
  const north = new THREE.Mesh(new THREE.BoxGeometry(spanX, 1.2, 2), wall);
  north.position.set(midX, 0.6, district.worldMaxZ + 2);
  const south = north.clone();
  south.position.z = district.worldMinZ - 2;
  const east = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, spanZ), wall);
  east.position.set(district.worldMaxX + 2, 0.6, midZ);
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
