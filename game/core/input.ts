import { clamp } from "./math";
import { emptyIntent, type InputIntent } from "./types";

export class Input {
  readonly intent: InputIntent = emptyIntent();
  private keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private punchQueued = false;
  private shootQueued = false;
  private interactQueued = false;
  private jumpQueued = false;
  private prevInteract = false;
  private pointerLocked = false;
  joyX = 0;
  joyZ = 0;
  touchSprint = false;

  private canvas: HTMLCanvasElement | null = null;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("pointerlockchange", this.onPointerLock);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    if (this.canvas) {
      this.canvas.removeEventListener("mousedown", this.onMouseDown);
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    }
    this.canvas = null;
  }

  consume(): InputIntent {
    const k = this.keys;
    let x = 0;
    let z = 0;
    if (k.has("keyw") || k.has("arrowup")) z += 1;
    if (k.has("keys") || k.has("arrowdown")) z -= 1;
    if (k.has("keya") || k.has("arrowleft")) x -= 1;
    if (k.has("keyd") || k.has("arrowright")) x += 1;
    x += this.joyX;
    z += this.joyZ;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }

    this.intent.moveX = clamp(x, -1, 1);
    this.intent.moveZ = clamp(z, -1, 1);
    this.intent.sprint = k.has("shiftleft") || k.has("shiftright") || this.touchSprint;
    this.intent.jump = this.jumpQueued || k.has("space");
    const interactDown = this.interactQueued || k.has("keye");
    this.intent.interact = interactDown && !this.prevInteract;
    this.prevInteract = interactDown;
    this.intent.punch = this.punchQueued || k.has("keyf");
    this.intent.shoot = this.shootQueued || k.has("keyr") || k.has("controlleft");
    this.intent.lookDx = this.lookX;
    this.intent.lookDy = this.lookY;

    this.lookX = 0;
    this.lookY = 0;
    this.punchQueued = false;
    this.shootQueued = false;
    this.interactQueued = false;
    this.jumpQueued = false;
    return this.intent;
  }

  queuePunch(): void {
    this.punchQueued = true;
  }

  queueShoot(): void {
    this.shootQueued = true;
  }

  queueInteract(): void {
    this.interactQueued = true;
  }

  queueJump(): void {
    this.jumpQueued = true;
  }

  requestLock(canvas: HTMLCanvasElement): void {
    if (!this.pointerLocked) canvas.requestPointerLock();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code.toLowerCase());
    if (e.code === "Space") {
      e.preventDefault();
      this.jumpQueued = true;
    }
    if (e.code === "KeyE") this.interactQueued = true;
    if (e.code === "KeyF") this.punchQueued = true;
    if (e.code === "KeyR") this.shootQueued = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code.toLowerCase());
  };

  private onMouseDown = (e: MouseEvent): void => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    this.requestLock(canvas);
    if (e.button === 0) this.punchQueued = true;
    if (e.button === 2) this.shootQueued = true;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onPointerLock = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private onMouseUp = (): void => {};

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
  };
}
