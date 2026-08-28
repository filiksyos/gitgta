import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type { GameState, PedState, VehicleState } from "../core/types";
import type { District } from "../world/district";
import { buildCity, makeMarker, makePedPrimitive } from "./city";
import { HeroClips, loadHeroes, type LoadedHeroes } from "./heroes";

export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 520);
  readonly quality: "high" | "low";
  private heroes!: LoadedHeroes;
  private playerWrap = new THREE.Group();
  private carWraps = new Map<number, THREE.Object3D>();
  private pedWraps = new Map<number, { obj: THREE.Object3D; clips?: HeroClips; cop: boolean }>();
  private marker = makeMarker();
  private sun!: THREE.DirectionalLight;
  private lamps: THREE.PointLight[] = [];
  private muzzle = new THREE.PointLight(0xffee88, 0, 8);
  private clockShake = new THREE.Vector3();
  private ready = false;
  private cityRoot: THREE.Object3D | null = null;
  private camRay = new THREE.Raycaster();
  private camFrom = new THREE.Vector3();
  private camDir = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820;
    this.quality = coarse ? "low" : "high";
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.25 : 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = !coarse;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x6a5478);
    this.scene.fog = new THREE.FogExp2(0x6a5478, 0.0058);

    const hemi = new THREE.HemisphereLight(0xffd0c8, 0x2a1838, 1.12);
    this.scene.add(hemi);
    const fill = new THREE.AmbientLight(0x6a4a68, 0.38);
    this.scene.add(fill);
    this.sun = new THREE.DirectionalLight(0xff8a64, 1.65);
    this.sun.position.set(-40, 28, 18);
    this.sun.castShadow = !coarse;
    this.sun.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 140;
    this.sun.shadow.camera.left = -50;
    this.sun.shadow.camera.right = 50;
    this.sun.shadow.camera.top = 50;
    this.sun.shadow.camera.bottom = -50;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.muzzle);
    this.scene.add(this.marker);
    this.scene.add(this.playerWrap);

    const lampCount = coarse ? 2 : 5;
    for (let i = 0; i < lampCount; i++) {
      const l = new THREE.PointLight(0xffcc77, 0, 16);
      this.lamps.push(l);
      this.scene.add(l);
    }

    window.addEventListener("resize", this.onResize);
  }

  async boot(district: District): Promise<void> {
    this.cityRoot = buildCity(this.scene, district, this.quality);
    this.heroes = await loadHeroes();
    this.playerWrap.add(this.heroes.player);
    this.ready = true;
  }

  get isReady(): boolean {
    return this.ready;
  }

  resetDynamics(): void {
    for (const obj of this.carWraps.values()) this.scene.remove(obj);
    for (const ped of this.pedWraps.values()) this.scene.remove(ped.obj);
    this.carWraps.clear();
    this.pedWraps.clear();
  }

  sync(state: GameState, dt: number): void {
    if (!this.ready) return;
    const p = state.player;
    this.playerWrap.position.set(p.x, p.y, p.z);
    this.playerWrap.rotation.y = p.yaw + Math.PI;
    this.playerWrap.visible = p.inVehicle < 0;
    this.heroes.playerClips.play(p.anim, p.anim.startsWith("Jump") || p.anim.startsWith("Punch") || p.anim === "Pistol_Shoot" ? 0.08 : 0.18);
    this.heroes.playerClips.update(dt);

    this.syncVehicles(state);
    this.syncPeds(state, dt);
    this.syncMarker(state);
    this.syncCamera(state);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.position.set(p.x - 40, 28, p.z + 18);

    if (state.player.shootCd > 0.2) {
      this.muzzle.intensity = 4;
      this.muzzle.position.set(p.x + Math.sin(p.yaw) * 1.3, 1.3, p.z + Math.cos(p.yaw) * 1.3);
    } else {
      this.muzzle.intensity *= 0.7;
    }

    const lampPos = [
      [p.x + 8, p.z],
      [p.x - 8, p.z],
      [p.x, p.z + 10],
      [p.x + 14, p.z - 6],
      [p.x - 12, p.z + 8],
    ];
    this.lamps.forEach((l, i) => {
      const [lx, lz] = lampPos[i] ?? lampPos[0];
      l.position.set(lx, 5.2, lz);
      l.intensity = 2.4;
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
  }

  private syncVehicles(state: GameState): void {
    for (const v of state.vehicles) {
      let obj = this.carWraps.get(v.id);
      if (!obj) {
        obj = this.makeCar(v);
        this.carWraps.set(v.id, obj);
        this.scene.add(obj);
      }
      obj.position.set(v.x, 0, v.z);
      obj.rotation.y = v.yaw;
      obj.visible = v.health > 0 || v.stalled < 8;
      if (v.health <= 0) obj.rotation.z = 0.4;
    }
  }

  private makeCar(v: VehicleState): THREE.Object3D {
    const wrap = new THREE.Group();
    if (v.hero) {
      wrap.add(this.heroes.car);
      const glow = new THREE.PointLight(0xffcc66, 2.2, 9);
      glow.position.set(0, 1.4, 0);
      wrap.add(glow);
      return wrap;
    }
    if (v.cop) {
      wrap.add(this.heroes.copCar.clone(true));
      const glow = new THREE.PointLight(0xff2244, 1.8, 8);
      glow.position.set(0, 1.45, 0);
      wrap.add(glow);
      return wrap;
    }
    const pool = this.heroes.trafficPool;
    wrap.add(pool[Math.abs(v.id) % pool.length].clone(true));
    return wrap;
  }

  private syncPeds(state: GameState, dt: number): void {
    for (const ped of state.peds) {
      let wrap = this.pedWraps.get(ped.id);
      if (!wrap) {
        wrap = this.makePed(ped);
        this.pedWraps.set(ped.id, wrap);
        this.scene.add(wrap.obj);
      }
      wrap.obj.position.set(ped.x, 0, ped.z);
      wrap.obj.rotation.y = ped.yaw + Math.PI;
      wrap.obj.visible = ped.health > 0 && ped.vehicleId < 0;
      if (wrap.clips) {
        const moving = ped.kind === "cop" ? "Sprint_Loop" : "Walk_Loop";
        wrap.clips.play(ped.health <= 0 ? "Death01" : moving, 0.2);
        wrap.clips.update(dt);
      }
    }
  }

  private makePed(ped: PedState): { obj: THREE.Object3D; clips?: HeroClips; cop: boolean } {
    if (ped.kind === "cop") {
      const root = cloneSkinned(this.heroes.copProto);
      const clips = new HeroClips(root, this.heroes.copClips);
      return { obj: root, clips, cop: true };
    }
    return { obj: makePedPrimitive("civ"), cop: false };
  }

  private syncMarker(state: GameState): void {
    this.marker.visible = state.marker.visible && state.phase === "playing";
    this.marker.position.set(state.marker.x, 0.02, state.marker.z);
    this.marker.rotation.y = state.time * 0.6;
  }

  private syncCamera(state: GameState): void {
    const c = state.camera;
    this.camera.fov = c.fov;
    this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.updateProjectionMatrix();
    const s = state.shake;
    this.clockShake.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.4, (Math.random() - 0.5) * s);
    this.camera.position.set(c.x + this.clockShake.x, c.y + this.clockShake.y, c.z + this.clockShake.z);
    this.camFrom.set(c.tx, c.ty + 0.4, c.tz);
    this.camDir.copy(this.camera.position).sub(this.camFrom);
    const dist = this.camDir.length();
    if (dist > 0.2 && this.cityRoot) {
      this.camDir.multiplyScalar(1 / dist);
      this.camRay.set(this.camFrom, this.camDir);
      this.camRay.far = dist;
      const hits = this.camRay.intersectObject(this.cityRoot, true);
      const hit = hits.find((h) => {
        if (h.distance <= 0.4) return false;
        if (h.object.name === "ground") return false;
        const ny = h.normal?.y ?? 0;
        return Math.abs(ny) < 0.72;
      });
      if (hit && hit.distance < dist - 0.35) {
        this.camera.position.copy(this.camFrom).addScaledVector(this.camDir, Math.max(1.2, hit.distance - 0.45));
      }
    }
    this.camera.lookAt(c.tx, c.ty, c.tz);
  }

  private onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.updateProjectionMatrix();
  };
}
