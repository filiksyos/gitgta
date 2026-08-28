import type { Input } from "../core/input";

export function mountTouch(root: HTMLElement, input: Input): void {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) return;
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="joy-base" id="joy"><div class="joy-knob" id="knob"></div></div>
    <button class="btn-touch btn-jump" id="t-jump">JUMP</button>
    <button class="btn-touch btn-sprint" id="t-sprint">RUN</button>
    <button class="btn-touch btn-enter" id="t-enter">E</button>
    <button class="btn-touch btn-punch" id="t-punch">HIT</button>
    <button class="btn-touch btn-fire" id="t-fire">GUN</button>
  `;
  const joy = root.querySelector("#joy") as HTMLElement;
  const knob = root.querySelector("#knob") as HTMLElement;
  let active = false;
  const setJoy = (clientX: number, clientY: number): void => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (clientX - cx) / 52;
    let dy = (clientY - cy) / 52;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    input.joyX = dx;
    input.joyZ = -dy;
    knob.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
  };
  joy.addEventListener("pointerdown", (e) => {
    active = true;
    joy.setPointerCapture(e.pointerId);
    setJoy(e.clientX, e.clientY);
  });
  joy.addEventListener("pointermove", (e) => {
    if (active) setJoy(e.clientX, e.clientY);
  });
  const end = (): void => {
    active = false;
    input.joyX = 0;
    input.joyZ = 0;
    knob.style.transform = "";
  };
  joy.addEventListener("pointerup", end);
  joy.addEventListener("pointercancel", end);

  const hold = (id: string, down: () => void, up?: () => void): void => {
    const el = root.querySelector(id)!;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      down();
    });
    if (up) {
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    }
  };
  hold("#t-jump", () => input.queueJump());
  hold(
    "#t-sprint",
    () => {
      input.touchSprint = true;
    },
    () => {
      input.touchSprint = false;
    },
  );
  hold("#t-enter", () => input.queueInteract());
  hold("#t-punch", () => input.queuePunch());
  hold("#t-fire", () => input.queueShoot());
}
