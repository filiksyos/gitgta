import type { GameState } from "../core/types";

export class Hud {
  private root: HTMLElement;
  private health!: HTMLElement;
  private ammo!: HTMLElement;
  private stars!: HTMLElement;
  private objective!: HTMLElement;
  private prompt!: HTMLElement;
  private speedo!: HTMLElement;
  private cross!: HTMLElement;

  constructor(el: HTMLElement) {
    this.root = el;
    el.innerHTML = `
      <div class="hud-top">
        <div class="wanted" id="hud-stars"></div>
        <div class="health-wrap"><div class="health-fill" id="hud-health"></div></div>
        <div class="ammo" id="hud-ammo"></div>
      </div>
      <div class="objective" id="hud-obj"></div>
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
  }
}
