const loadingTimers = new WeakMap<HTMLElement, ReturnType<typeof setInterval>>();
const loadingMessages = ["Getting your ride ready...", "Turning contributions into city blocks...", "Lighting up Vice City...", "Finding you a parking spot...", "Tuning the radio..."];

export class Screens {
  dispose(): void {
    const timer = loadingTimers.get(this.root);
    if (timer) clearInterval(timer);
    loadingTimers.delete(this.root);
  }
  constructor(private root: HTMLElement) {}

  loading(): void {
    this.dispose();
    this.root.classList.remove("hidden");
    this.root.innerHTML = `
      <div class="panel">
        <div class="tag">Entering Vice City</div>
        <h1>GTA VI For Devs</h1>
        <p data-loading-message>Getting your ride ready...</p>
      </div>
    `;
    let index = 0;
    loadingTimers.set(this.root, setInterval(() => {
      const message = this.root.querySelector("[data-loading-message]");
      if (message) message.textContent = loadingMessages[++index % loadingMessages.length];
      else this.dispose();
    }, 2600));
  }

  error(text: string, href = "/"): void {
    this.dispose();
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
    this.dispose();
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
    this.dispose();
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
    this.dispose();
    this.root.classList.add("hidden");
    this.root.innerHTML = "";
  }
}
