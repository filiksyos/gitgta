export class Screens {
  constructor(private root: HTMLElement) {}

  loading(): void {
    this.root.classList.remove("hidden");
    this.root.innerHTML = `
      <div class="panel">
        <div class="tag">Entering Vice City</div>
        <h1>GTA VI For Devs</h1>
        <p>Getting your ride ready...</p>
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
