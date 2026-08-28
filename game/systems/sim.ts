import type { GameState, InputIntent } from "../core/types";
import { hashSeed } from "../core/math";
import type { District } from "../world/district";
import { updatePlayer, tryEnterExit } from "./player";
import { updateVehicles } from "./vehicle";
import { updateCombat } from "./combat";
import { spawnAmbient, updateNpcs } from "./npcs";
import { updateWanted } from "./wanted";
import { updateMission } from "./mission";
import { updateCamera } from "./camera";

export function createGame(district: District, seed = 1992): { state: GameState; district: District } {
  const state: GameState = {
    phase: "title",
    time: 0,
    player: {
      x: district.garage.x,
      y: 0,
      z: district.garage.z + 6,
      yaw: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 100,
      maxHealth: 100,
      grounded: true,
      sprinting: false,
      inVehicle: -1,
      anim: "Idle_Loop",
      punchCd: 0,
      shootCd: 0,
      ammo: 18,
      maxAmmo: 18,
      jumpPhase: 0,
      dead: false,
      invuln: 0,
    },
    vehicles: [
      {
        id: 1,
        x: district.steal.x,
        z: district.steal.z,
        yaw: district.steal.yaw,
        speed: 0,
        vx: 0,
        vz: 0,
        health: 160,
        maxHealth: 160,
        hero: true,
        cop: false,
        occupied: false,
        skid: 0,
        stalled: 0,
      },
    ],
    peds: [],
    bullets: [],
    wanted: { stars: 0, heat: 0, unseen: 0 },
    mission: {
      beat: "reach",
      stolen: false,
      escaped: false,
      delivered: false,
      objective: "Get to the parked ride",
      hint: "Yellow marker — just up the block",
      loseReason: "",
      winReason: "",
      chaseTime: 0,
      threeStarTime: 0,
    },
    camera: {
      yaw: 0,
      pitch: -0.12,
      dist: 5.4,
      height: 1.85,
      fov: 54,
      x: district.garage.x,
      y: 4,
      z: district.garage.z - 8,
      tx: district.garage.x,
      ty: 1.4,
      tz: district.garage.z + 6,
    },
    marker: { x: district.steal.x, z: district.steal.z, visible: true, color: 0xffd23a },
    safe: { x: district.target.x, z: district.target.z, r: 8 },
    prompt: "",
    speedKmh: 0,
    shake: 0,
    lastHit: 0,
    seed,
  };
  spawnAmbient(state, district);
  return { state, district };
}

export function stepSim(state: GameState, district: District, input: InputIntent, dt: number): void {
  if (state.phase !== "playing") return;
  state.time += dt;
  state.prompt = "";
  tryEnterExit(state, input);
  updatePlayer(state, input, district, dt);
  updateVehicles(state, input, district, dt);
  updateCombat(state, input, dt);
  updateNpcs(state, district, dt);
  updateWanted(state, district, dt);
  updateMission(state, district, dt);
  updateCamera(state, dt);
}

export function resetGame(district: District, seed = 1992): { state: GameState; district: District } {
  const next = createGame(district, seed);
  next.state.phase = "playing";
  return next;
}

export function seedFromLogin(login: string): number {
  return hashSeed(login.toLowerCase());
}
