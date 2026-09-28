import type { Input } from "../core/input";

const DEAD = 0.16;

export function isTouchLayout(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    window.matchMedia("(max-width: 900px)").matches
  );
}

/** Map a finger position to a stick vector. `z` is positive when the finger is above the origin. */
export function mapStick(
  clientX: number,
  clientY: number,
  originX: number,
  originY: number,
  radius: number,
): { x: number; z: number; knobX: number; knobY: number } {
  const dx = clientX - originX;
  const dy = clientY - originY;
  const len = Math.hypot(dx, dy);
  const span = Math.max(radius, 1);
  const clamped = Math.min(1, len / span);
  const mag = clamped <= DEAD ? 0 : (clamped - DEAD) / (1 - DEAD);
  const ux = len > 0.0001 ? dx / len : 0;
  const uy = len > 0.0001 ? dy / len : 0;
  const travel = span * 0.62;
  return {
    x: ux * mag,
    z: -uy * mag,
    knobX: ux * clamped * travel,
    knobY: uy * clamped * travel,
  };
}

export function mountTouch(root: HTMLElement, input: Input): () => void {
  const gameRoot = root.parentElement;
  const abort = new AbortController();
  const signal = abort.signal;
  let built = false;

  const applyMode = (): void => {
    const on = isTouchLayout();
    root.classList.toggle("hidden", !on);
    root.classList.toggle("touch-on", on);
    gameRoot?.classList.toggle("touch-mode", on);
    if (on && !built) build();
  };

  const build = (): void => {
    built = true;
    root.innerHTML = `
      <div class="look-zone" id="look"></div>
      <div class="move-zone" id="move-zone"></div>
      <div class="joy-base" id="joy"><div class="joy-knob" id="knob"></div></div>
      <div class="touch-actions">
        <button type="button" class="btn-touch" id="t-fire" aria-label="Fire">FIRE</button>
        <button type="button" class="btn-touch" id="t-jump" aria-label="Jump or handbrake">JUMP</button>
        <button type="button" class="btn-touch" id="t-punch" aria-label="Punch">HIT</button>
        <button type="button" class="btn-touch" id="t-sprint" aria-label="Sprint">RUN</button>
        <button type="button" class="btn-touch btn-use" id="t-enter" aria-label="Enter or exit vehicle">USE</button>
      </div>
    `;

    const joy = root.querySelector("#joy") as HTMLElement;
    const knob = root.querySelector("#knob") as HTMLElement;
    const moveZone = root.querySelector("#move-zone") as HTMLElement;
    const look = root.querySelector("#look") as HTMLElement;
    let stickPointer: number | null = null;
    let originX = 0;
    let originY = 0;

    const resetStick = (): void => {
      stickPointer = null;
      input.joyX = 0;
      input.joyZ = 0;
      joy.classList.remove("is-active");
      joy.style.left = "";
      joy.style.top = "";
      joy.style.bottom = "";
      knob.style.transform = "translate(-50%, -50%)";
    };

    const placeStick = (clientX: number, clientY: number): void => {
      const bounds = root.getBoundingClientRect();
      const size = joy.offsetWidth || 120;
      const margin = 8;
      let left = clientX - bounds.left - size / 2;
      let top = clientY - bounds.top - size / 2;
      left = Math.min(bounds.width - size - margin, Math.max(margin, left));
      top = Math.min(bounds.height - size - margin, Math.max(margin, top));
      joy.style.left = `${left}px`;
      joy.style.top = `${top}px`;
      joy.style.bottom = "auto";
      originX = bounds.left + left + size / 2;
      originY = bounds.top + top + size / 2;
    };

    const updateStick = (clientX: number, clientY: number): void => {
      const radius = (joy.offsetWidth || 120) * 0.46;
      const mapped = mapStick(clientX, clientY, originX, originY, radius);
      input.joyX = mapped.x;
      input.joyZ = mapped.z;
      knob.style.transform = `translate(calc(-50% + ${mapped.knobX}px), calc(-50% + ${mapped.knobY}px))`;
    };

    moveZone.addEventListener(
      "pointerdown",
      (event) => {
        if (stickPointer !== null) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        stickPointer = event.pointerId;
        moveZone.setPointerCapture(event.pointerId);
        joy.classList.add("is-active");
        placeStick(event.clientX, event.clientY);
        input.joyX = 0;
        input.joyZ = 0;
        knob.style.transform = "translate(-50%, -50%)";
      },
      { signal },
    );
    moveZone.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== stickPointer) return;
        updateStick(event.clientX, event.clientY);
      },
      { signal },
    );
    const endStick = (event: PointerEvent): void => {
      if (event.pointerId !== stickPointer) return;
      resetStick();
    };
    moveZone.addEventListener("pointerup", endStick, { signal });
    moveZone.addEventListener("pointercancel", endStick, { signal });

    const lookPointers = new Map<number, { x: number; y: number }>();
    look.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        look.setPointerCapture(event.pointerId);
        lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      },
      { signal },
    );
    look.addEventListener(
      "pointermove",
      (event) => {
        const prev = lookPointers.get(event.pointerId);
        if (!prev) return;
        const dx = event.clientX - prev.x;
        const dy = event.clientY - prev.y;
        prev.x = event.clientX;
        prev.y = event.clientY;
        // Touch swipes are shorter than a mouse sweep, so scale them up.
        input.addLook(dx * 3.6, dy * 2.4);
      },
      { signal },
    );
    const endLook = (event: PointerEvent): void => {
      lookPointers.delete(event.pointerId);
    };
    look.addEventListener("pointerup", endLook, { signal });
    look.addEventListener("pointercancel", endLook, { signal });

    const hold = (id: string, down: () => void, up?: () => void): void => {
      const el = root.querySelector(id) as HTMLElement;
      el.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          el.setPointerCapture(event.pointerId);
          el.classList.add("is-down");
          down();
        },
        { signal },
      );
      const release = (): void => {
        el.classList.remove("is-down");
        up?.();
      };
      el.addEventListener("pointerup", release, { signal });
      el.addEventListener("pointercancel", release, { signal });
      el.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
    };

    hold("#t-jump", () => {
      input.touchJump = true;
      input.queueJump();
    }, () => {
      input.touchJump = false;
    });
    hold("#t-sprint", () => {
      input.touchSprint = true;
    }, () => {
      input.touchSprint = false;
    });
    hold("#t-enter", () => input.queueInteract());
    hold("#t-punch", () => input.queuePunch());
    hold("#t-fire", () => input.queueShoot());
  };

  const onTouchMove = (event: TouchEvent): void => {
    const overlay = document.getElementById("overlay");
    if (overlay && !overlay.classList.contains("hidden") && overlay.contains(event.target as Node)) return;
    if (!root.classList.contains("touch-on")) return;
    event.preventDefault();
  };
  root.addEventListener("touchmove", onTouchMove, { passive: false, signal });

  const medias = [
    window.matchMedia("(pointer: coarse)"),
    window.matchMedia("(hover: none)"),
    window.matchMedia("(max-width: 900px)"),
  ];
  for (const media of medias) media.addEventListener("change", applyMode, { signal });
  applyMode();

  return () => {
    abort.abort();
    input.joyX = 0;
    input.joyZ = 0;
    input.touchSprint = false;
    input.touchJump = false;
    root.classList.add("hidden");
    root.classList.remove("touch-on");
    root.innerHTML = "";
    gameRoot?.classList.remove("touch-mode");
  };
}
