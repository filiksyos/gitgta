import { isTouchLayout } from "./touch";

export class Screens {
  constructor(private root: HTMLElement) {}

  title(
    onStart: () => void,
    opts?: { tag?: string; title?: string; blurb?: string; quiet?: boolean },
  ): void {
    this.root.classList.remove("hidden");
    const tag = opts?.tag ?? "GitHub · Open world";
    const title = opts?.title ?? "GitGTA";
    const blurb =
      opts?.blurb ??
      "Jack a ride, shake the heat, and drive to the tower your commits built.";
    const quiet = opts?.quiet
      ? `<p class="quiet">Quiet town — not much skyline yet. Cruise it anyway.</p>`
      : "";
    const controls = isTouchLayout()
      ? `<div class="controls">
          <div><b>Stick</b> up walks · sideways turns · full tilt sprints</div>
          <div><b>Drag</b> the right side to look around</div>
          <div><b>RUN</b> sprint / boost · <b>JUMP</b> jump / handbrake</div>
          <div><b>USE</b> enter / exit · <b>HIT</b> punch · <b>FIRE</b> pistol</div>
        </div>`
      : `<div class="controls">
          <div><b>WASD</b> walk / drive · <b>Shift</b> sprint / boost</div>
          <div><b>Space</b> jump / handbrake · <b>E</b> enter / exit</div>
          <div><b>Mouse</b> look · <b>LMB</b> punch · <b>RMB</b> pistol</div>
        </div>`;
    this.root.innerHTML = `
      <div class="panel">
        <div class="tag">${tag}</div>
        <h1>${title}</h1>
        <p>${blurb}</p>
        ${quiet}
        ${controls}
        <button type="button" id="btn-start">Start exploring</button>
      </div>
    `;
    this.root.querySelector("#btn-start")!.addEventListener("click", onStart);
  }

  loading(name?: string): void {
    this.root.classList.remove("hidden");
    this.root.innerHTML = `
      <div class="panel">
        <div class="tag">Loading city</div>
        <h1>GitGTA</h1>
        <p>${name ? `Raising ${name}'s skyline…` : "Pulling the commit graph and the block…"}</p>
      </div>
    `;
  }

  error(text: string, href = "/"): void {
    this.root.classList.remove("hidden");
    this.root.innerHTML = `
      <div class="panel">
        <div class="tag">Mission failed</div>
        <h1>No city</h1>
        <p>${text}</p>
        <a class="panel-link" href="${href}">Back to the map</a>
      </div>
    `;
  }

  win(text: string, onRestart: () => void): void {
    this.root.classList.remove("hidden");
    this.root.innerHTML = `
      <div class="panel">
        <div class="tag">Mission passed</div>
        <h1>Respect</h1>
        <p>${text}</p>
        <button type="button" id="btn-again">Run it back</button>
      </div>
    `;
    this.root.querySelector("#btn-again")!.addEventListener("click", onRestart);
  }

  lose(text: string, onRestart: () => void): void {
    this.root.classList.remove("hidden");
    this.root.innerHTML = `
      <div class="panel">
        <div class="tag">Mission failed</div>
        <h1>${text === "Wasted" ? "Wasted" : "Busted"}</h1>
        <p>${text}</p>
        <button type="button" id="btn-again">Restart</button>
      </div>
    `;
    this.root.querySelector("#btn-again")!.addEventListener("click", onRestart);
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.root.innerHTML = "";
  }
}
