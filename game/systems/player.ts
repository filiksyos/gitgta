import { clamp, damp, dist2, lerpAngle } from "../core/math";
import type { GameState, InputIntent } from "../core/types";
import { resolveCircle } from "./collision";
import type { District } from "../world/district";

const WALK = 3.4;
const JOG = 5.6;
const SPRINT = 8.4;
const ACCEL = 38;
const FRICTION = 14;
const GRAVITY = 26;
const JUMP = 8.2;
const RADIUS = 0.42;

export function updatePlayer(state: GameState, input: InputIntent, district: District, dt: number): void {
  const p = state.player;
  if (p.dead) {
    p.anim = "Death01";
    p.vx = 0;
    p.vz = 0;
    return;
  }

  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  if (p.inVehicle >= 0) {
    const v = state.vehicles.find((c) => c.id === p.inVehicle);
    if (v) {
      p.x = v.x;
      p.z = v.z;
      p.y = 0.15;
      p.yaw = v.yaw;
      p.vx = v.vx;
      p.vz = v.vz;
      p.anim = "Driving_Loop";
      p.grounded = true;
    }
    return;
  }

  state.camera.yaw -= input.lookDx * 0.0024;
  state.camera.pitch = clamp(state.camera.pitch - input.lookDy * 0.002, -0.55, 0.42);

  const cy = Math.sin(state.camera.yaw);
  const cz = Math.cos(state.camera.yaw);
  const rx = cz;
  const rz = -cy;
  const wishX = rx * input.moveX + cy * input.moveZ;
  const wishZ = rz * input.moveX + cz * input.moveZ;
  const wishLen = Math.hypot(wishX, wishZ);

  p.sprinting = input.sprint && wishLen > 0.2 && p.grounded;
  const max = !p.grounded ? JOG : p.sprinting ? SPRINT : wishLen > 0.85 ? JOG : WALK;
  const tx = wishLen > 0.05 ? (wishX / Math.max(wishLen, 1)) * max : 0;
  const tz = wishLen > 0.05 ? (wishZ / Math.max(wishLen, 1)) * max : 0;

  p.vx += (tx - p.vx) * Math.min(1, ACCEL * dt / 12);
  p.vz += (tz - p.vz) * Math.min(1, ACCEL * dt / 12);
  if (wishLen < 0.05 && p.grounded) {
    p.vx = damp(p.vx, 0, FRICTION, dt);
    p.vz = damp(p.vz, 0, FRICTION, dt);
  }

  if (input.jump && p.grounded && p.punchCd <= 0) {
    p.vy = JUMP;
    p.grounded = false;
    p.jumpPhase = 0.01;
    p.anim = "Jump_Start";
  }

  p.vy -= GRAVITY * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) {
    if (!p.grounded && p.jumpPhase > 0) {
      p.anim = "Jump_Land";
      p.jumpPhase = 0.18;
    }
    p.y = 0;
    p.vy = 0;
    p.grounded = true;
  }

  p.x += p.vx * dt;
  p.z += p.vz * dt;

  const resolved = resolveCircle(p.x, p.z, RADIUS, district.colliders);
  p.x = resolved.x;
  p.z = resolved.z;
  if (resolved.hit) {
    const push = resolved.nx * p.vx + resolved.nz * p.vz;
    if (push < 0) {
      p.vx -= resolved.nx * push;
      p.vz -= resolved.nz * push;
    }
  }

  if (wishLen > 0.12 && p.grounded) {
    p.yaw = lerpAngle(p.yaw, Math.atan2(wishX, wishZ), 1 - Math.exp(-12 * dt));
  }

  const spd = Math.hypot(p.vx, p.vz);
  if (p.jumpPhase > 0 && !p.grounded) {
    p.jumpPhase += dt;
    p.anim = p.jumpPhase < 0.12 ? "Jump_Start" : "Jump_Loop";
  } else if (p.anim === "Jump_Land" && p.jumpPhase > 0) {
    p.jumpPhase -= dt;
    if (p.jumpPhase <= 0) p.anim = "Idle_Loop";
  } else if (p.anim === "Punch_Jab" || p.anim === "Punch_Cross" || p.anim === "Pistol_Shoot") {
    // held by combat timers
  } else if (spd < 0.35) {
    p.anim = "Idle_Loop";
  } else if (p.sprinting) {
    p.anim = "Sprint_Loop";
  } else if (spd > 4.6) {
    p.anim = "Jog_Fwd_Loop";
  } else {
    p.anim = "Walk_Loop";
  }

  for (const v of state.vehicles) {
    if (v.occupied) continue;
    if (dist2(p.x, p.z, v.x, v.z) < 4.2) {
      state.prompt = v.hero ? "E  Steal ride" : "E  Enter vehicle";
    }
  }
}

export function tryEnterExit(state: GameState, input: InputIntent): boolean {
  const p = state.player;
  if (!input.interact || p.dead) return false;
  if (p.inVehicle >= 0) {
    const v = state.vehicles.find((c) => c.id === p.inVehicle);
    if (v) {
      v.occupied = false;
      p.inVehicle = -1;
      p.x = v.x + Math.cos(v.yaw) * 2.4;
      p.z = v.z - Math.sin(v.yaw) * 2.4;
      p.y = 0;
      p.anim = "Idle_Loop";
    }
    return true;
  }
  let best = -1;
  let bestD = 4.2;
  for (const v of state.vehicles) {
    if (v.occupied) continue;
    const d = dist2(p.x, p.z, v.x, v.z);
    if (d < bestD) {
      bestD = d;
      best = v.id;
    }
  }
  if (best >= 0) {
    const v = state.vehicles.find((c) => c.id === best)!;
    v.occupied = true;
    p.inVehicle = v.id;
    p.anim = "Driving_Loop";
    return true;
  }
  return false;
}
