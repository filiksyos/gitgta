import { clamp, dist2 } from "../core/math";
import type { GameState, InputIntent, VehicleState } from "../core/types";
import { resolveCircle } from "./collision";
import type { District } from "../world/district";

const ACCEL = 22;
const BOOST = 9;
const BRAKE = 34;
const REVERSE = 16;
const MAX = 31;
const MAX_BOOST = 38;
const STEER = 2.35;
const DRAG = 1.15;
const LATERAL = 7.2;
const RADIUS = 1.85;

export function updateVehicles(state: GameState, input: InputIntent, district: District, dt: number): void {
  for (const v of state.vehicles) {
    if (v.health <= 0) {
      v.speed *= 0.9;
      v.vx *= 0.9;
      v.vz *= 0.9;
      v.stalled += dt;
      continue;
    }

    const driven = state.player.inVehicle === v.id && !state.player.dead;
    if (driven) {
      drivePlayer(v, input, dt);
    } else if (v.cop) {
      driveChase(v, state, dt);
    } else if (!v.hero) {
      driveTraffic(v, dt);
    } else {
      v.vx *= 0.85;
      v.vz *= 0.85;
      v.speed *= 0.85;
    }

    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    v.x += v.vx * dt;
    v.z += v.vz * dt;

    const hit = resolveCircle(v.x, v.z, RADIUS, district.colliders, 2);
    if (hit.hit) {
      v.x = hit.x;
      v.z = hit.z;
      const impact = Math.abs(hit.nx * v.vx + hit.nz * v.vz);
      v.vx += hit.nx * impact * 1.4;
      v.vz += hit.nz * impact * 1.4;
      v.speed *= 0.62;
      if (impact > 10) {
        v.health -= (impact - 8) * 0.55;
        state.shake = Math.max(state.shake, Math.min(0.45, impact * 0.02));
        if (driven) {
          state.player.health -= (impact - 8) * 0.08;
          state.lastHit = 1;
        }
      }
    }

    for (const other of state.vehicles) {
      if (other.id === v.id) continue;
      const d = dist2(v.x, v.z, other.x, other.z);
      if (d < 3.6) {
        const nx = (v.x - other.x) / Math.max(d, 0.01);
        const nz = (v.z - other.z) / Math.max(d, 0.01);
        const push = (3.6 - d) * 0.5;
        v.x += nx * push;
        v.z += nz * push;
        const rel = (v.vx - other.vx) * nx + (v.vz - other.vz) * nz;
        if (rel < 0) {
          v.vx -= nx * rel * 0.8;
          v.vz -= nz * rel * 0.8;
          const dmg = Math.min(10, Math.abs(rel) * 0.45);
          v.health -= dmg * 0.2;
          other.health -= dmg * 0.2;
        }
      }
    }

    v.speed = fwdX * v.vx + fwdZ * v.vz;
    if (v.health < 0) v.health = 0;
  }

  const driven = state.vehicles.find((c) => c.id === state.player.inVehicle);
  state.speedKmh = driven ? Math.abs(driven.speed) * 3.6 : 0;
}

function drivePlayer(v: VehicleState, input: InputIntent, dt: number): void {
  const throttle = input.moveZ;
  const steer = input.moveX;
  const boost = input.sprint ? BOOST : 0;
  const handbrake = input.jump;

  const fwdX = Math.sin(v.yaw);
  const fwdZ = Math.cos(v.yaw);
  const rightX = fwdZ;
  const rightZ = -fwdX;

  if (throttle > 0.05) {
    const cap = MAX + boost;
    v.speed = clamp(v.speed + (ACCEL + boost) * throttle * dt, -REVERSE, cap);
  } else if (throttle < -0.05) {
    if (v.speed > 0.4) v.speed = Math.max(-REVERSE, v.speed - BRAKE * dt);
    else v.speed = clamp(v.speed + REVERSE * throttle * dt, -REVERSE, MAX_BOOST);
  } else {
    v.speed *= 1 - DRAG * dt;
  }

  const grip = handbrake ? 0.35 : 1;
  const steerScale = 1 / (1 + Math.abs(v.speed) * 0.045);
  v.yaw += steer * STEER * steerScale * Math.sign(v.speed || throttle) * dt * (handbrake ? 1.65 : 1);

  const targetVx = fwdX * v.speed;
  const targetVz = fwdZ * v.speed;
  v.vx += (targetVx - v.vx) * Math.min(1, LATERAL * grip * dt);
  v.vz += (targetVz - v.vz) * Math.min(1, LATERAL * grip * dt);

  const lat = v.vx * rightX + v.vz * rightZ;
  v.skid = Math.abs(lat) * (handbrake ? 1.8 : 1);
  if (handbrake) {
    v.vx -= fwdX * v.speed * 0.55 * dt;
    v.vz -= fwdZ * v.speed * 0.55 * dt;
  }
}

function driveChase(v: VehicleState, state: GameState, dt: number): void {
  const tx = state.player.x;
  const tz = state.player.z;
  const dx = tx - v.x;
  const dz = tz - v.z;
  const desired = Math.atan2(dx, dz);
  let diff = desired - v.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  v.yaw += clamp(diff, -2.4 * dt, 2.4 * dt);
  const d = Math.hypot(dx, dz);
  const want = d > 8 ? 24 : 11;
  v.speed += (want - v.speed) * 1.8 * dt;
  const fwdX = Math.sin(v.yaw);
  const fwdZ = Math.cos(v.yaw);
  v.vx = fwdX * v.speed;
  v.vz = fwdZ * v.speed;
}

function driveTraffic(v: VehicleState, dt: number): void {
  const fwdX = Math.sin(v.yaw);
  const fwdZ = Math.cos(v.yaw);
  v.speed += (12 - v.speed) * 1.2 * dt;
  v.vx = fwdX * v.speed;
  v.vz = fwdZ * v.speed;
  if (v.x < -88 || v.x > 88 || v.z < -88 || v.z > 88) {
    v.yaw += Math.PI;
    v.x = clamp(v.x, -84, 84);
    v.z = clamp(v.z, -84, 84);
  }
}
