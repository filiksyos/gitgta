import { clamp, damp, dampAngle, lerp } from "../core/math";
import type { GameState, InputIntent } from "../core/types";

export function updateCamera(state: GameState, input: InputIntent, dt: number): void {
  const p = state.player;
  const cam = state.camera;
  const driving = p.inVehicle >= 0;
  const heading = p.yaw;
  const driven = driving ? state.vehicles.find((v) => v.id === p.inVehicle) : undefined;
  const speed = driven ? driven.speed : Math.hypot(p.vx, p.vz);

  if (Math.abs(input.lookDx) > 0.01 || Math.abs(input.lookDy) > 0.01) {
    cam.lookIdle = 0;
    if (driving) cam.orbitYaw -= input.lookDx * 0.0022;
    cam.orbitPitch = clamp(cam.orbitPitch - input.lookDy * 0.0016, -0.35, 0.45);
  } else {
    cam.lookIdle += dt;
  }
  if (cam.lookIdle > 1.35) {
    const rate = driving ? 2.4 : 1.4;
    cam.orbitYaw += -cam.orbitYaw * Math.min(1, rate * dt);
    cam.orbitPitch += -cam.orbitPitch * Math.min(1, rate * dt * 0.65);
  }

  const desiredYaw = heading + (driving ? cam.orbitYaw : 0);
  cam.yaw = dampAngle(cam.yaw, desiredYaw, driving ? 6.5 : 14, dt);
  cam.pitch = damp(cam.pitch, 0.16 + cam.orbitPitch, 8, dt);

  const speedAbs = Math.abs(speed);
  const desiredDist = (driving ? 9.4 : 6.5) + speedAbs * (driving ? 0.11 : 0.04);
  cam.dist = damp(cam.dist, desiredDist, 4.2, dt);
  const height = driving ? 3.8 + speedAbs * 0.02 : 2.85;
  cam.height = damp(cam.height, height, 8, dt);

  const horiz = Math.max(Math.cos(cam.pitch), driving ? 0.5 : 0.72);
  const wantX = p.x - Math.sin(cam.yaw) * cam.dist * horiz;
  const wantZ = p.z - Math.cos(cam.yaw) * cam.dist * horiz;
  const wantY = height + Math.sin(cam.pitch) * cam.dist;
  cam.x = damp(cam.x, wantX, 7.5, dt);
  cam.y = damp(cam.y, wantY, 8, dt);
  cam.z = damp(cam.z, wantZ, 7.5, dt);

  const lookAhead = driving ? 6 + speedAbs * 0.12 : 1.6;
  cam.tx = damp(cam.tx, p.x + Math.sin(heading) * lookAhead * 0.15, 10, dt);
  cam.ty = damp(cam.ty, driving ? 1.05 : 1.35, 8, dt);
  cam.tz = damp(cam.tz, p.z + Math.cos(heading) * lookAhead * 0.15, 10, dt);
  cam.fov = damp(cam.fov, clamp(50 + speedAbs * 0.28, 50, 64), 3.5, dt);

  state.shake = lerp(state.shake, 0, 1 - Math.exp(-6 * dt));
  state.lastHit = Math.max(0, state.lastHit - dt);
}
