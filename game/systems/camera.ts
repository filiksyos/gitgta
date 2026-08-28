import { damp, lerp } from "../core/math";
import type { GameState } from "../core/types";

export function updateCamera(state: GameState, dt: number): void {
  const p = state.player;
  const driving = p.inVehicle >= 0;
  const speed = Math.hypot(p.vx, p.vz);
  const lookX = Math.sin(state.camera.yaw);
  const lookZ = Math.cos(state.camera.yaw);

  const distTarget = driving ? 9.4 : 4.6;
  const heightTarget = driving ? 3.2 : 1.55;
  const fovTarget = driving ? 56 + Math.min(16, speed * 0.45) : 54;
  state.camera.dist = damp(state.camera.dist, distTarget, 4.2, dt);
  state.camera.height = damp(state.camera.height, heightTarget, 4.2, dt);
  state.camera.fov = damp(state.camera.fov, fovTarget, 3.2, dt);

  const shoulder = driving ? 0 : 0.72;
  const ahead = driving ? 4.5 : 1.1;
  const tx = p.x + lookZ * shoulder + Math.sin(p.yaw) * ahead * 0.15;
  const tz = p.z - lookX * shoulder + Math.cos(p.yaw) * ahead * 0.15;
  const ty = p.y + (driving ? 1.1 : 1.35);

  state.camera.tx = damp(state.camera.tx, tx, 7, dt);
  state.camera.ty = damp(state.camera.ty, ty, 7, dt);
  state.camera.tz = damp(state.camera.tz, tz, 7, dt);

  const pitch = state.camera.pitch;
  const back = state.camera.dist;
  const desiredX = state.camera.tx - lookX * back * Math.cos(pitch);
  const desiredZ = state.camera.tz - lookZ * back * Math.cos(pitch);
  const desiredY = state.camera.ty + state.camera.height + Math.sin(pitch) * back;

  state.camera.x = damp(state.camera.x, desiredX, 8.5, dt);
  state.camera.y = damp(state.camera.y, Math.max(1.4, desiredY), 8.5, dt);
  state.camera.z = damp(state.camera.z, desiredZ, 8.5, dt);

  state.shake = lerp(state.shake, 0, 1 - Math.exp(-6 * dt));
  state.lastHit = Math.max(0, state.lastHit - dt);
}
