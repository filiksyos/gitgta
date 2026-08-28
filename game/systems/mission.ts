import { dist2 } from "../core/math";
import type { GameState } from "../core/types";
import type { District } from "../world/district";
import { raiseWanted } from "./combat";

export function updateMission(state: GameState, district: District, dt: number): void {
  const m = state.mission;
  const p = state.player;
  const hero = state.vehicles.find((v) => v.hero);
  const label = district.target.label;
  const who = district.meta.displayName;

  if (p.health <= 0 && !p.dead) {
    p.dead = true;
    p.health = 0;
    p.anim = "Death01";
    m.loseReason = "Wasted";
    state.phase = "lost";
    return;
  }

  if (hero && hero.health <= 0 && m.stolen) {
    m.loseReason = "The ride is totaled";
    state.phase = "lost";
    return;
  }

  if (m.threeStarTime > 42) {
    m.loseReason = "Busted — heat got too heavy";
    state.phase = "lost";
    return;
  }

  if (hero && hero.stalled > 14 && m.stolen && Math.abs(hero.speed) < 0.4) {
    m.loseReason = "Stranded too long";
    state.phase = "lost";
    return;
  }

  const nearCar = hero ? dist2(p.x, p.z, hero.x, hero.z) < 3.4 : false;
  const atTarget = dist2(p.x, p.z, district.target.x, district.target.z) < 8;
  const carAtTarget = hero
    ? dist2(hero.x, hero.z, district.target.x, district.target.z) < 10
    : false;

  if (m.beat === "reach") {
    m.objective = "Get to the parked ride";
    m.hint = `Yellow marker — ${who}'s block`;
    state.marker.x = district.steal.x;
    state.marker.z = district.steal.z;
    state.marker.visible = true;
    if (nearCar) m.beat = "steal";
  }

  if (m.beat === "steal") {
    m.objective = "Jack the car";
    m.hint = "Press E next to the vehicle";
    state.marker.x = district.steal.x;
    state.marker.z = district.steal.z;
    state.marker.visible = true;
    if (hero && p.inVehicle === hero.id) {
      m.stolen = true;
      m.beat = "getaway";
      raiseWanted(state, 1);
    }
  }

  if (m.beat === "getaway") {
    m.objective = "Lose the cops";
    m.hint = "Stay out of sight until the stars drop";
    state.marker.x = district.target.x;
    state.marker.z = district.target.z;
    state.marker.visible = true;
    if (state.wanted.stars === 0 && m.stolen) {
      m.escaped = true;
      m.beat = "return";
    }
  }

  if (m.beat === "return") {
    m.objective = `Hit the tower — ${label}`;
    m.hint = "Drive to the yellow marker. That's the skyline you built.";
    state.marker.x = district.target.x;
    state.marker.z = district.target.z;
    state.marker.visible = true;
    if (m.stolen && carAtTarget && (p.inVehicle === hero?.id || atTarget)) {
      m.delivered = true;
      m.winReason = `${who}'s city is yours. You found ${label}.`;
      state.phase = "won";
      state.wanted.stars = 0;
    }
  }

  void dt;
}
