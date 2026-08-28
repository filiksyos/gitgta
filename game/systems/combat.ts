import { dist2 } from "../core/math";
import type { GameState, InputIntent, PedState } from "../core/types";
import { losClear } from "./collision";
import type { District } from "../world/district";

export function updateCombat(
  state: GameState,
  input: InputIntent,
  dt: number,
): void {
  const p = state.player;
  if (p.dead) return;

  if (p.inVehicle < 0 && input.punch && p.punchCd <= 0 && p.grounded) {
    p.punchCd = 0.42;
    p.anim = Math.random() > 0.5 ? "Punch_Jab" : "Punch_Cross";
    hitMelee(state);
  }

  if (input.shoot && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = 0.28;
    p.ammo -= 1;
    if (p.inVehicle < 0 && p.grounded) p.anim = "Pistol_Shoot";
    fire(state, true);
  }

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    if (b.life <= 0) {
      state.bullets.splice(i, 1);
      continue;
    }
    if (b.fromPlayer) {
      for (const ped of state.peds) {
        if (ped.health <= 0) continue;
        if (dist2(b.x, b.z, ped.x, ped.z) < 0.9) {
          damagePed(state, ped, 34);
          state.bullets.splice(i, 1);
          break;
        }
      }
    } else if (p.invuln <= 0) {
      const tx = p.inVehicle >= 0 ? p.x : p.x;
      const tz = p.z;
      if (dist2(b.x, b.z, tx, tz) < 1.1) {
        p.health -= 8;
        p.invuln = 0.35;
        state.shake = 0.28;
        state.lastHit = 1;
        state.bullets.splice(i, 1);
      }
    }
  }

  if (p.anim === "Pistol_Shoot" && p.shootCd < 0.08 && p.inVehicle < 0) {
    p.anim = "Idle_Loop";
  }
  if ((p.anim === "Punch_Jab" || p.anim === "Punch_Cross") && p.punchCd < 0.08) {
    p.anim = "Idle_Loop";
  }
}

function hitMelee(state: GameState): void {
  const p = state.player;
  const reachX = p.x + Math.sin(p.yaw) * 1.5;
  const reachZ = p.z + Math.cos(p.yaw) * 1.5;
  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    if (dist2(reachX, reachZ, ped.x, ped.z) < 1.35) {
      damagePed(state, ped, 28);
      raiseWanted(state, ped.kind === "cop" ? 2 : 1);
    }
  }
}

function fire(state: GameState, fromPlayer: boolean): void {
  const p = state.player;
  const yaw = fromPlayer ? (p.inVehicle >= 0 ? p.yaw : p.yaw) : 0;
  const x = p.x + Math.sin(yaw) * 1.2;
  const z = p.z + Math.cos(yaw) * 1.2;
  state.bullets.push({
    x,
    y: 1.2,
    z,
    vx: Math.sin(yaw) * 62,
    vz: Math.cos(yaw) * 62,
    life: 0.7,
    fromPlayer,
  });
  if (fromPlayer) raiseWanted(state, 1);
}

export function copFire(state: GameState, cop: PedState, district: District): void {
  if (cop.shootCd > 0 || cop.health <= 0) return;
  if (!losClear(cop.x, cop.z, state.player.x, state.player.z, district.colliders)) return;
  cop.shootCd = 0.7;
  const yaw = Math.atan2(state.player.x - cop.x, state.player.z - cop.z);
  state.bullets.push({
    x: cop.x + Math.sin(yaw) * 1.1,
    y: 1.2,
    z: cop.z + Math.cos(yaw) * 1.1,
    vx: Math.sin(yaw) * 48,
    vz: Math.cos(yaw) * 48,
    life: 0.8,
    fromPlayer: false,
  });
}

function damagePed(state: GameState, ped: PedState, amount: number): void {
  ped.health -= amount;
  ped.stunned = 0.4;
  if (ped.kind === "civ") ped.fleeing = true;
  if (ped.health <= 0) {
    ped.health = 0;
    if (ped.vehicleId >= 0) {
      const v = state.vehicles.find((c) => c.id === ped.vehicleId);
      if (v) v.occupied = false;
      ped.vehicleId = -1;
    }
  }
}

export function raiseWanted(state: GameState, stars: number): void {
  state.wanted.stars = Math.min(3, Math.max(state.wanted.stars, stars));
  state.wanted.heat = Math.max(state.wanted.heat, 6);
  state.wanted.unseen = 0;
}
