import { clamp } from "../core/math";
import type { WorldAabb } from "../core/types";

export interface Hit {
  nx: number;
  nz: number;
  pen: number;
}

export function circleAabb(cx: number, cz: number, r: number, b: WorldAabb): Hit | null {
  const px = clamp(cx, b.minX, b.maxX);
  const pz = clamp(cz, b.minZ, b.maxZ);
  const dx = cx - px;
  const dz = cz - pz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return null;
  if (d2 < 1e-8) {
    const left = cx - b.minX;
    const right = b.maxX - cx;
    const top = cz - b.minZ;
    const bot = b.maxZ - cz;
    const m = Math.min(left, right, top, bot);
    if (m === left) return { nx: -1, nz: 0, pen: r + left };
    if (m === right) return { nx: 1, nz: 0, pen: r + right };
    if (m === top) return { nx: 0, nz: -1, pen: r + top };
    return { nx: 0, nz: 1, pen: r + bot };
  }
  const d = Math.sqrt(d2);
  return { nx: dx / d, nz: dz / d, pen: r - d };
}

export function resolveCircle(
  x: number,
  z: number,
  r: number,
  boxes: WorldAabb[],
  iterations = 3,
): { x: number; z: number; hit: boolean; nx: number; nz: number } {
  let hit = false;
  let nx = 0;
  let nz = 0;
  for (let i = 0; i < iterations; i++) {
    for (const b of boxes) {
      const h = circleAabb(x, z, r, b);
      if (!h) continue;
      x += h.nx * h.pen;
      z += h.nz * h.pen;
      nx = h.nx;
      nz = h.nz;
      hit = true;
    }
  }
  return { x, z, hit, nx, nz };
}

export function circlesOverlap(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const r = ar + br;
  return dx * dx + dz * dz < r * r;
}

export function losClear(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  boxes: WorldAabb[],
  steps = 8,
): boolean {
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const b of boxes) {
      if (b.kind === "prop") continue;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return false;
    }
  }
  return true;
}
