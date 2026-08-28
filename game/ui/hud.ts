import type { GameState } from "../core/types";
import type { District } from "../world/district";

const COMMIT_FILL = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

export class Hud {
  private root: HTMLElement;
  private health!: HTMLElement;
  private ammo!: HTMLElement;
  private stars!: HTMLElement;
  private objective!: HTMLElement;
  private prompt!: HTMLElement;
  private speedo!: HTMLElement;
  private cross!: HTMLElement;
  private radar!: HTMLCanvasElement;
  private radarCtx!: CanvasRenderingContext2D;
  private district: District | null = null;

  constructor(el: HTMLElement) {
    this.root = el;
    el.innerHTML = `
      <div class="hud-top">
        <div class="wanted" id="hud-stars"></div>
        <div class="health-wrap"><div class="health-fill" id="hud-health"></div></div>
        <div class="ammo" id="hud-ammo"></div>
      </div>
      <div class="objective" id="hud-obj"></div>
      <div class="radar-wrap">
        <canvas id="hud-radar" width="256" height="256"></canvas>
        <div class="radar-label">COMMIT GRAPH</div>
      </div>
      <div class="prompt hidden" id="hud-prompt"></div>
      <div class="speedo hidden" id="hud-speed"></div>
      <div class="crosshair" id="hud-cross"></div>
    `;
    this.health = el.querySelector("#hud-health")!;
    this.ammo = el.querySelector("#hud-ammo")!;
    this.stars = el.querySelector("#hud-stars")!;
    this.objective = el.querySelector("#hud-obj")!;
    this.prompt = el.querySelector("#hud-prompt")!;
    this.speedo = el.querySelector("#hud-speed")!;
    this.cross = el.querySelector("#hud-cross")!;
    this.radar = el.querySelector("#hud-radar")!;
    this.radarCtx = this.radar.getContext("2d")!;
  }

  setDistrict(district: District): void {
    this.district = district;
  }

  show(on: boolean): void {
    this.root.classList.toggle("hidden", !on);
  }

  draw(state: GameState): void {
    const hp = Math.max(0, state.player.health / state.player.maxHealth);
    this.health.style.width = `${hp * 100}%`;
    this.ammo.textContent = `9MM  ${state.player.ammo} / ${state.player.maxAmmo}`;
    this.stars.innerHTML = [0, 1, 2]
      .map((i) => `<span class="star ${i < state.wanted.stars ? "on" : ""}">★</span>`)
      .join("");
    this.objective.innerHTML = `${state.mission.objective}<small>${state.mission.hint}</small>`;
    if (state.prompt) {
      this.prompt.textContent = state.prompt;
      this.prompt.classList.remove("hidden");
    } else {
      this.prompt.classList.add("hidden");
    }
    const driving = state.player.inVehicle >= 0;
    this.speedo.classList.toggle("hidden", !driving);
    if (driving) this.speedo.innerHTML = `${Math.round(state.speedKmh)} <span>KM/H</span>`;
    this.cross.style.opacity = driving ? "0" : "0.5";
    this.root.style.boxShadow = state.lastHit > 0 ? "inset 0 0 80px #c81e1e88" : "none";
    this.drawRadar(state);
  }

  private drawRadar(state: GameState): void {
    const district = this.district;
    const ctx = this.radarCtx;
    const size = this.radar.width;
    const cx = size / 2;
    const cy = size / 2;
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = "#010409";
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 8, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, size, size);

    if (district) {
      const p = state.player;
      const scale = 1.55;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(p.yaw);

      ctx.strokeStyle = "#21262d";
      ctx.lineWidth = 3;
      for (const sx of district.streetsX) {
        ctx.beginPath();
        ctx.moveTo((sx - p.x) * scale, -((district.worldMinZ - p.z) * scale));
        ctx.lineTo((sx - p.x) * scale, -((district.worldMaxZ - p.z) * scale));
        ctx.stroke();
      }
      for (const sz of district.streetsZ) {
        ctx.beginPath();
        ctx.moveTo((district.worldMinX - p.x) * scale, -((sz - p.z) * scale));
        ctx.lineTo((district.worldMaxX - p.x) * scale, -((sz - p.z) * scale));
        ctx.stroke();
      }

      for (const b of district.buildings) {
        const level = b.commitLevel ?? 0;
        ctx.fillStyle = COMMIT_FILL[Math.max(0, Math.min(4, level))] ?? COMMIT_FILL[1];
        const w = Math.max(3, b.w * scale);
        const d = Math.max(3, b.d * scale);
        ctx.fillRect((b.x - p.x) * scale - w / 2, -((b.z - p.z) * scale) - d / 2, w, d);
      }

      ctx.fillStyle = "#ffd23a";
      ctx.beginPath();
      ctx.arc((state.marker.x - p.x) * scale, -((state.marker.z - p.z) * scale), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    ctx.strokeStyle = "#39d353";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#f0c14a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#f6ead2";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx - 7, cy + 8);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx + 7, cy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
