import { dist2, lerpAngle } from "../core/math";
import type { GameState, PedState, VehicleState } from "../core/types";
import { copFire, raiseWanted } from "./combat";
import { losClear, resolveCircle } from "./collision";
import { nearestLane, sidewalkPoint, type District } from "../world/district";

export function spawnAmbient(state: GameState, district: District): void {
  let id = 1;
  for (let i = 0; i < 14; i++) {
    const p = sidewalkPoint(district, i, i * 13.7);
    state.peds.push({
      id: id++,
      x: p.x,
      z: p.z,
      yaw: i * 0.7,
      speed: 1.4 + (i % 3) * 0.25,
      waypointX: p.x,
      waypointZ: p.z + 8,
      fleeing: false,
      kind: "civ",
      health: 40,
      shootCd: 0,
      vehicleId: -1,
      stunned: 0,
    });
  }

  const lanes: { x: number; z: number; yaw: number }[] = [];
  district.streetsX.forEach((sx, i) => {
    const z = i % 2 === 0 ? district.worldMinZ + 22 : district.worldMaxZ - 22;
    lanes.push({ x: sx, z, yaw: i % 2 === 0 ? 0 : Math.PI });
  });
  district.streetsZ.forEach((sz, i) => {
    const x = i % 2 === 0 ? district.worldMinX + 22 : district.worldMaxX - 22;
    lanes.push({ x, z: sz, yaw: i % 2 === 0 ? Math.PI * 0.5 : -Math.PI * 0.5 });
  });
  const traffic = lanes.slice(0, 6);
  for (const lane of traffic) {
    state.vehicles.push({
      id: id++,
      x: lane.x,
      z: lane.z,
      yaw: lane.yaw,
      speed: 11,
      vx: Math.sin(lane.yaw) * 11,
      vz: Math.cos(lane.yaw) * 11,
      health: 80,
      maxHealth: 80,
      hero: false,
      cop: false,
      occupied: false,
      skid: 0,
      stalled: 0,
      steer: 0,
      yawRate: 0,
    });
  }
}

export function updateNpcs(state: GameState, district: District, dt: number): void {
  const p = state.player;
  for (const ped of state.peds) {
    ped.shootCd = Math.max(0, ped.shootCd - dt);
    ped.stunned = Math.max(0, ped.stunned - dt);
    if (ped.health <= 0) continue;
    if (ped.vehicleId >= 0) {
      const v = state.vehicles.find((c) => c.id === ped.vehicleId);
      if (v) {
        ped.x = v.x;
        ped.z = v.z;
        ped.yaw = v.yaw;
      }
      continue;
    }

    if (ped.kind === "cop") {
      updateCop(state, ped, district, dt);
      continue;
    }

    const crime = state.wanted.stars > 0 || Math.hypot(p.vx, p.vz) > 12;
    if (crime && dist2(ped.x, ped.z, p.x, p.z) < 18) ped.fleeing = true;

    if (ped.stunned > 0) continue;

    if (ped.fleeing) {
      const dx = ped.x - p.x;
      const dz = ped.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      ped.x += (dx / l) * 5.2 * dt;
      ped.z += (dz / l) * 5.2 * dt;
      ped.yaw = Math.atan2(dx, dz);
    } else {
      const dx = ped.waypointX - ped.x;
      const dz = ped.waypointZ - ped.z;
      if (Math.hypot(dx, dz) < 1.2) {
        const n = sidewalkPoint(district, ped.id, state.time * 0.2 + ped.id);
        ped.waypointX = n.x;
        ped.waypointZ = n.z;
      } else {
        const l = Math.hypot(dx, dz);
        ped.x += (dx / l) * ped.speed * dt;
        ped.z += (dz / l) * ped.speed * dt;
        ped.yaw = lerpAngle(ped.yaw, Math.atan2(dx, dz), 8 * dt);
      }
    }

    const hit = resolveCircle(ped.x, ped.z, 0.35, district.colliders, 1);
    ped.x = hit.x;
    ped.z = hit.z;

    if (
      !ped.fleeing &&
      dist2(ped.x, ped.z, p.x, p.z) < 16 &&
      state.mission.stolen &&
      losClear(ped.x, ped.z, p.x, p.z, district.colliders)
    ) {
      raiseWanted(state, 1);
    }
  }

  maintainCops(state, district);
}

function updateCop(state: GameState, cop: PedState, district: District, dt: number): void {
  const p = state.player;
  const dx = p.x - cop.x;
  const dz = p.z - cop.z;
  const d = Math.hypot(dx, dz);
  cop.yaw = lerpAngle(cop.yaw, Math.atan2(dx, dz), 8 * dt);
  if (d > 3.2) {
    cop.x += (dx / d) * 6.1 * dt;
    cop.z += (dz / d) * 6.1 * dt;
  }
  const hit = resolveCircle(cop.x, cop.z, 0.38, district.colliders, 1);
  cop.x = hit.x;
  cop.z = hit.z;
  if (d < 18 && d > 4) copFire(state, cop, district);
  if (d < 1.6 && p.inVehicle < 0 && p.invuln <= 0) {
    p.health -= 14 * dt;
    state.lastHit = 1;
  }
}

function maintainCops(state: GameState, district: District): void {
  const cops = state.peds.filter((p) => p.kind === "cop" && p.health > 0);
  const copCars = state.vehicles.filter((v) => v.cop && v.health > 0);
  const wantFoot = state.wanted.stars >= 2 ? 2 : 0;
  const wantCars = state.wanted.stars >= 3 ? 2 : state.wanted.stars >= 1 ? 1 : 0;

  while (copCars.length < wantCars) {
    const spawn = copSpawn(state, district);
    const v: VehicleState = {
      id: 800 + state.vehicles.length,
      x: spawn.x,
      z: spawn.z,
      yaw: spawn.yaw,
      speed: 18,
      vx: 0,
      vz: 0,
      health: 90,
      maxHealth: 90,
      hero: false,
      cop: true,
      occupied: true,
      skid: 0,
      stalled: 0,
      steer: 0,
      yawRate: 0,
    };
    state.vehicles.push(v);
    copCars.push(v);
    const cop: PedState = {
      id: 900 + state.peds.length,
      x: v.x,
      z: v.z,
      yaw: v.yaw,
      speed: 5.5,
      waypointX: v.x,
      waypointZ: v.z,
      fleeing: false,
      kind: "cop",
      health: 70,
      shootCd: 0.4,
      vehicleId: v.id,
      stunned: 0,
    };
    state.peds.push(cop);
  }

  while (cops.filter((c) => c.vehicleId < 0).length < wantFoot && state.wanted.stars > 0) {
    const spawn = copSpawn(state, district);
    state.peds.push({
      id: 700 + state.peds.length,
      x: spawn.x,
      z: spawn.z,
      yaw: spawn.yaw,
      speed: 5.8,
      waypointX: state.player.x,
      waypointZ: state.player.z,
      fleeing: false,
      kind: "cop",
      health: 70,
      shootCd: 0.2,
      vehicleId: -1,
      stunned: 0,
    });
    break;
  }

  if (state.wanted.stars === 0) {
    for (const cop of state.peds) {
      if (cop.kind !== "cop") continue;
      if (dist2(cop.x, cop.z, state.player.x, state.player.z) > 40) cop.health = 0;
    }
  }
}

function copSpawn(state: GameState, district: District): { x: number; z: number; yaw: number } {
  const lane = nearestLane(district, state.player.x, state.player.z);
  const yaw = Math.atan2(state.player.x - lane.x, state.player.z - lane.z);
  const x = lane.alongX ? state.player.x - Math.sign(Math.sin(yaw) || 1) * 40 : lane.x;
  const z = lane.alongX ? lane.z : state.player.z - Math.sign(Math.cos(yaw) || 1) * 40;
  return { x, z, yaw: Math.atan2(state.player.x - x, state.player.z - z) };
}
