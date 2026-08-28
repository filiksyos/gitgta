import { dist2 } from "../core/math";
import type { GameState } from "../core/types";
import { losClear } from "./collision";
import type { District } from "../world/district";

export function updateWanted(state: GameState, district: District, dt: number): void {
  const w = state.wanted;
  if (w.stars <= 0) {
    w.unseen = 0;
    w.heat = Math.max(0, w.heat - dt);
    return;
  }

  const seen = state.peds.some(
    (ped) =>
      ped.kind === "cop" &&
      ped.health > 0 &&
      dist2(ped.x, ped.z, state.player.x, state.player.z) < 26 &&
      losClear(ped.x, ped.z, state.player.x, state.player.z, district.colliders),
  );
  const copCarNear = state.vehicles.some(
    (v) => v.cop && v.health > 0 && dist2(v.x, v.z, state.player.x, state.player.z) < 22,
  );

  const inSafe = dist2(state.player.x, state.player.z, state.safe.x, state.safe.z) < state.safe.r + 2;

  if ((seen || copCarNear) && !inSafe) {
    w.unseen = 0;
    w.heat = Math.min(12, w.heat + dt);
  } else {
    w.unseen += inSafe ? dt * 2.6 : dt;
    if (w.unseen > 7) {
      w.stars -= 1;
      w.unseen = 0;
      if (w.stars <= 0) {
        w.stars = 0;
        state.mission.escaped = true;
      }
    }
  }

  if (w.stars >= 3) state.mission.threeStarTime += dt;
  else state.mission.threeStarTime = Math.max(0, state.mission.threeStarTime - dt * 0.5);

  if (state.wanted.stars > 0) state.mission.chaseTime += dt;
}
