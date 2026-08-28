import { hashSeed, mulberry32 } from "../core/math";
import type { WorldAabb } from "../core/types";
import type { CityPayload, CityRepo, ContributionDay } from "@/lib/city-from-github";

export const ROAD_HALF = 6.6;
export const WALK_W = 2.7;

const COLS = 4;
const ROWS = 3;
const BLOCK = 36;
const CELL = BLOCK + ROAD_HALF * 2;

export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  hue: number;
  windows: boolean;
  kind: "house" | "shop" | "warehouse" | "garage";
  label?: string;
  commitLevel?: number;
}

export interface PropSpec {
  x: number;
  z: number;
  yaw: number;
  kind: "lamp" | "dumpster" | "fence" | "palm" | "hydrant" | "crate";
}

export interface District {
  streetsX: number[];
  streetsZ: number[];
  worldMinX: number;
  worldMaxX: number;
  worldMinZ: number;
  worldMaxZ: number;
  buildings: BuildingSpec[];
  colliders: WorldAabb[];
  props: PropSpec[];
  garage: { x: number; z: number; yaw: number };
  steal: { x: number; z: number; yaw: number };
  sidewalks: { x: number; z: number; w: number; d: number }[];
  alleys: { x: number; z: number; w: number; d: number }[];
  target: { x: number; z: number; label: string };
  meta: { login: string; displayName: string; quiet: boolean };
}

function aabb(
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  kind: WorldAabb["kind"],
): WorldAabb {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    minY: 0,
    maxY: h,
    kind,
  };
}

function blockCenter(col: number, row: number): { x: number; z: number } {
  return {
    x: (col - (COLS - 1) / 2) * CELL,
    z: (row - (ROWS - 1) / 2) * CELL,
  };
}

function heightFromCount(count: number): number {
  if (count <= 0) return 0;
  return Math.min(56, 3.2 + Math.log2(1 + count) * 6.2);
}

function heightFromRepo(repo: CityRepo): number {
  const weight = repo.commitCount * 2 + repo.stargazerCount;
  return Math.min(62, 10 + Math.log2(1 + weight) * 7);
}

function commitLevel(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function commitHue(level: number): number {
  return 0.33 + level * 0.012;
}

export function onRoad(district: Pick<District, "streetsX" | "streetsZ">, x: number, z: number): boolean {
  for (const sx of district.streetsX) if (Math.abs(x - sx) < ROAD_HALF + WALK_W) return true;
  for (const sz of district.streetsZ) if (Math.abs(z - sz) < ROAD_HALF + WALK_W) return true;
  return false;
}

function pushBound(
  colliders: WorldAabb[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): void {
  colliders.push({ minX, maxX, minZ, maxZ, minY: 0, maxY: 14, kind: "wall" });
}

function groupMonths(days: ContributionDay[]): { key: string; days: ContributionDay[] }[] {
  const map = new Map<string, ContributionDay[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const list = map.get(key);
    if (list) list.push(day);
    else map.set(key, [day]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, monthDays]) => ({ key, days: monthDays }));
}

export function buildDistrictFromGitHub(payload: CityPayload, focusRepo?: string): District {
  const rng = mulberry32(hashSeed(payload.login.toLowerCase()));
  const buildings: BuildingSpec[] = [];
  const colliders: WorldAabb[] = [];
  const props: PropSpec[] = [];
  const sidewalks: District["sidewalks"] = [];
  const alleys: District["alleys"] = [];

  const streetsX: number[] = [];
  const streetsZ: number[] = [];
  for (let i = 0; i <= COLS; i++) streetsX.push((i - COLS / 2) * CELL);
  for (let i = 0; i <= ROWS; i++) streetsZ.push((i - ROWS / 2) * CELL);

  const worldMinX = streetsX[0] - ROAD_HALF - 8;
  const worldMaxX = streetsX[streetsX.length - 1] + ROAD_HALF + 8;
  const worldMinZ = streetsZ[0] - ROAD_HALF - 8;
  const worldMaxZ = streetsZ[streetsZ.length - 1] + ROAD_HALF + 8;

  const spanX = worldMaxX - worldMinX;
  const spanZ = worldMaxZ - worldMinZ;
  const midX = (worldMinX + worldMaxX) / 2;
  const midZ = (worldMinZ + worldMaxZ) / 2;

  const newest = blockCenter(COLS - 1, ROWS - 1);
  const garage = { x: newest.x - 2, z: newest.z + 4, yaw: 0 };
  const steal = { x: newest.x, z: newest.z + 16, yaw: 0 };

  const months = groupMonths(payload.days);
  let tallest: { x: number; z: number; h: number; label: string } | null = null;

  for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const center = blockCenter(col, row);
    const month = months[i];
    const isPlaza = col === COLS - 1 && row === ROWS - 1;

    if (month) {
      for (const day of month.days) {
        if (day.count <= 0) continue;
        const date = new Date(`${day.date}T12:00:00Z`);
        const weekday = date.getUTCDay();
        const week = Math.min(4, Math.floor((date.getUTCDate() - 1) / 7));
        const x = center.x + (weekday - 3) * 4.7;
        const z = center.z + (week - 2) * 5.4;
        if (isPlaza && Math.abs(x - garage.x) < 10 && Math.abs(z - garage.z) < 10) continue;
        if (Math.abs(x - steal.x) < 8 && Math.abs(z - steal.z) < 8) continue;
        const h = heightFromCount(day.count);
        const level = commitLevel(day.count);
        const kind: BuildingSpec["kind"] = h > 28 ? "warehouse" : h > 12 ? "shop" : "house";
        buildings.push({
          x,
          z,
          w: 4.1,
          d: 4.1,
          h,
          hue: commitHue(level),
          windows: day.count > 2,
          kind,
          label: day.count >= 12 ? day.date.slice(5) : undefined,
          commitLevel: level,
        });
        colliders.push(aabb(x, z, 4.1, 4.1, h, "building"));
        if (!tallest || h > tallest.h) {
          tallest = { x, z, h, label: `${day.date} · ${day.count} commits` };
        }
      }
    } else if (payload.repos[i]) {
      const repo = payload.repos[i];
      const h = Math.max(6, heightFromRepo(repo) * 0.45);
      buildings.push({
        x: center.x,
        z: center.z,
        w: 10,
        d: 10,
        h,
        hue: commitHue(3),
        windows: true,
        kind: h > 14 ? "warehouse" : "shop",
        label: repo.name,
        commitLevel: 3,
      });
      colliders.push(aabb(center.x, center.z, 10, 10, h, "building"));
    } else {
      alleys.push({ x: center.x, z: center.z, w: 16, d: 16 });
    }
  }

  const landmarkSpots = [
    { x: 18, z: 18 },
    { x: -18, z: 18 },
    { x: 18, z: -18 },
    { x: -18, z: -18 },
    { x: 40, z: 18 },
    { x: -40, z: 18 },
    { x: 18, z: 40 },
    { x: -18, z: 40 },
  ];

  const ranked = [...payload.repos]
    .sort((a, b) => b.commitCount + b.stargazerCount - (a.commitCount + a.stargazerCount))
    .slice(0, landmarkSpots.length);

  const repoMarks: { repo: CityRepo; x: number; z: number }[] = [];
  ranked.forEach((repo, i) => {
    const spot = landmarkSpots[i];
    if (!spot) return;
    if (onRoad({ streetsX, streetsZ }, spot.x, spot.z)) return;
    const h = heightFromRepo(repo);
    buildings.push({
      x: spot.x,
      z: spot.z,
      w: 7.4,
      d: 7.4,
      h,
      hue: commitHue(4),
      windows: true,
      kind: "warehouse",
      label: repo.name,
      commitLevel: 4,
    });
    colliders.push(aabb(spot.x, spot.z, 7.4, 7.4, h, "building"));
    repoMarks.push({ repo, x: spot.x, z: spot.z });
  });

  buildings.push({
    x: garage.x,
    z: garage.z - 5,
    w: 12,
    d: 8,
    h: 5.4,
    hue: commitHue(2),
    windows: false,
    kind: "garage",
    label: payload.login,
    commitLevel: 2,
  });
  colliders.push(aabb(garage.x, garage.z - 5, 12, 8, 5.4, "building"));
  colliders.push(aabb(garage.x - 7, garage.z + 1, 1.2, 10, 4.2, "wall"));
  colliders.push(aabb(garage.x + 7, garage.z + 1, 1.2, 10, 4.2, "wall"));

  for (const sx of streetsX) {
    sidewalks.push({ x: sx - ROAD_HALF - WALK_W / 2, z: midZ, w: WALK_W, d: spanZ });
    sidewalks.push({ x: sx + ROAD_HALF + WALK_W / 2, z: midZ, w: WALK_W, d: spanZ });
  }
  for (const sz of streetsZ) {
    sidewalks.push({ x: midX, z: sz - ROAD_HALF - WALK_W / 2, w: spanX, d: WALK_W });
    sidewalks.push({ x: midX, z: sz + ROAD_HALF + WALK_W / 2, w: spanX, d: WALK_W });
  }

  for (const sx of streetsX) {
    for (let z = worldMinZ + 10; z < worldMaxZ; z += 18) {
      if (streetsZ.some((sz) => Math.abs(z - sz) < ROAD_HALF + 3)) continue;
      props.push({ x: sx - ROAD_HALF - 1.1, z, yaw: 0, kind: "lamp" });
      props.push({ x: sx + ROAD_HALF + 1.1, z, yaw: 0, kind: "lamp" });
    }
  }

  const stub = { streetsX, streetsZ };
  for (let i = 0; i < 28; i++) {
    const x = worldMinX + 10 + rng() * (spanX - 20);
    const z = worldMinZ + 10 + rng() * (spanZ - 20);
    if (onRoad(stub, x, z)) continue;
    const kinds: PropSpec["kind"][] = ["palm", "dumpster", "crate", "hydrant", "fence"];
    props.push({ x, z, yaw: rng() * Math.PI * 2, kind: kinds[Math.floor(rng() * kinds.length)] });
    if (rng() > 0.45) colliders.push(aabb(x, z, 1.1, 1.1, 1.4, "prop"));
  }

  pushBound(colliders, worldMinX - 4, worldMinX, worldMinZ, worldMaxZ);
  pushBound(colliders, worldMaxX, worldMaxX + 4, worldMinZ, worldMaxZ);
  pushBound(colliders, worldMinX, worldMaxX, worldMinZ - 4, worldMinZ);
  pushBound(colliders, worldMinX, worldMaxX, worldMaxZ, worldMaxZ + 4);

  const focus = focusRepo?.toLowerCase();
  const focused = focus
    ? repoMarks.find(
        (mark) =>
          mark.repo.name.toLowerCase() === focus ||
          mark.repo.nameWithOwner.toLowerCase() === focus ||
          mark.repo.nameWithOwner.toLowerCase().endsWith(`/${focus}`),
      )
    : undefined;

  const target = focused
    ? { x: focused.x, z: focused.z, label: focused.repo.name }
    : tallest
      ? { x: tallest.x, z: tallest.z, label: tallest.label }
      : repoMarks[0]
        ? { x: repoMarks[0].x, z: repoMarks[0].z, label: repoMarks[0].repo.name }
        : { x: steal.x, z: steal.z, label: "the parked ride" };

  return {
    streetsX,
    streetsZ,
    worldMinX,
    worldMaxX,
    worldMinZ,
    worldMaxZ,
    buildings,
    colliders,
    props,
    garage,
    steal,
    sidewalks,
    alleys,
    target,
    meta: {
      login: payload.login,
      displayName: payload.displayName,
      quiet: payload.totalContributions < 8 && payload.repos.length < 2,
    },
  };
}

export function nearestLane(
  district: District,
  x: number,
  z: number,
): { x: number; z: number; alongX: boolean } {
  let bestX = district.streetsX[0] ?? 0;
  let dx = Math.abs(x - bestX);
  for (const sx of district.streetsX) {
    const d = Math.abs(x - sx);
    if (d < dx) {
      dx = d;
      bestX = sx;
    }
  }
  let bestZ = district.streetsZ[0] ?? 0;
  let dz = Math.abs(z - bestZ);
  for (const sz of district.streetsZ) {
    const d = Math.abs(z - sz);
    if (d < dz) {
      dz = d;
      bestZ = sz;
    }
  }
  if (dx < dz) return { x: bestX, z, alongX: false };
  return { x, z: bestZ, alongX: true };
}

export function sidewalkPoint(district: District, i: number, t: number): { x: number; z: number } {
  const sx = district.streetsX[i % Math.max(1, district.streetsX.length)] ?? 0;
  const sz = district.streetsZ[Math.floor(i / 3) % Math.max(1, district.streetsZ.length)] ?? 0;
  const side = i % 2 === 0 ? 1 : -1;
  const spanZ = district.worldMaxZ - district.worldMinZ - 20;
  const spanX = district.worldMaxX - district.worldMinX - 20;
  if (i % 2 === 0) {
    return {
      x: sx + (ROAD_HALF + 1.6) * side,
      z: district.worldMinZ + 10 + ((t * 37) % Math.max(1, spanZ)),
    };
  }
  return {
    x: district.worldMinX + 10 + ((t * 41) % Math.max(1, spanX)),
    z: sz + (ROAD_HALF + 1.6) * side,
  };
}
