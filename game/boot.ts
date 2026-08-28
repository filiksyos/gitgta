import { Input } from "./core/input";
import { createLoop } from "./core/loop";
import { AudioFx } from "./audio/audio";
import { GameView } from "./render/view";
import { createGame, resetGame, seedFromLogin, stepSim } from "./systems/sim";
import { Hud } from "./ui/hud";
import { Screens } from "./ui/screens";
import { mountTouch } from "./ui/touch";
import type { District } from "./world/district";
import type { GameState } from "./core/types";

export type StartGameOptions = {
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  overlay: HTMLElement;
  touch: HTMLElement;
  district: District;
};

export function startGame(opts: StartGameOptions): () => void {
  const { canvas, hud: hudEl, overlay: overlayEl, touch: touchEl, district: world } = opts;
  const seed = seedFromLogin(world.meta.login);

  const input = new Input();
  input.attach(canvas);
  const audio = new AudioFx();
  const hud = new Hud(hudEl);
  hud.setDistrict(world);
  const screens = new Screens(overlayEl);
  const view = new GameView(canvas);
  mountTouch(touchEl, input);

  const pack = createGame(world, seed);
  let state: GameState = pack.state;
  let district: District = pack.district;
  let prevStars = 0;
  let prevAnim = state.player.anim;
  let prevDriving = false;
  let ended = false;

  function beginPlay(): void {
    audio.resume();
    view.resetDynamics();
    const next = resetGame(world, seed);
    state = next.state;
    district = next.district;
    ended = false;
    prevStars = 0;
    screens.hide();
    hud.show(true);
    input.requestLock(canvas);
  }

  screens.loading(world.meta.displayName);

  view.boot(district).then(() => {
    screens.title(beginPlay, {
      tag: `${world.meta.login} · commit skyline`,
      title: "GitGTA",
      blurb: `Jack a ride through ${world.meta.displayName}'s city. The taller the tower, the harder they shipped.`,
      quiet: world.meta.quiet,
    });
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Could not boot the district.";
    screens.error(message);
  });

  const loop = createLoop(
    (dt) => {
      const intent = input.consume();
      stepSim(state, district, intent, dt);

      if (state.player.anim !== prevAnim) {
        if (state.player.anim.startsWith("Punch")) audio.punch();
        if (state.player.anim === "Pistol_Shoot") audio.gun();
        prevAnim = state.player.anim;
      }
      if (state.wanted.stars !== prevStars) {
        audio.setSiren(state.wanted.stars > 0);
        audio.setPursuit(state.wanted.stars > 0);
        prevStars = state.wanted.stars;
      }
      const driving = state.player.inVehicle >= 0;
      const v = state.vehicles.find((c) => c.id === state.player.inVehicle);
      audio.setEngine(v?.speed ?? 0, driving);
      if (driving && (v?.skid ?? 0) > 4) audio.skid();
      if (driving !== prevDriving) {
        prevDriving = driving;
      }
      if (state.shake > 0.22) audio.impact();

      if (!ended && state.phase === "won") {
        ended = true;
        hud.show(false);
        audio.win();
        screens.win(state.mission.winReason, beginPlay);
      }
      if (!ended && state.phase === "lost") {
        ended = true;
        hud.show(false);
        audio.fail();
        screens.lose(state.mission.loseReason, beginPlay);
      }
    },
    (_alpha, dt) => {
      if (view.isReady) view.sync(state, dt);
      if (state.phase === "playing") hud.draw(state);
      view.render();
    },
  );

  loop.start();

  return () => {
    loop.stop();
    input.detach();
    view.dispose();
  };
}
