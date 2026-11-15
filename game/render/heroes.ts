import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type { AnimName } from "../core/types";

const LOOP = new Set<string>([
  "Idle_Loop",
  "Walk_Loop",
  "Jog_Fwd_Loop",
  "Sprint_Loop",
  "Jump_Loop",
  "Driving_Loop",
  "Pistol_Idle_Loop",
  "Talk_Loop",
  "Idle",
  "Walk",
  "Run",
]);

export class HeroClips {
  readonly root: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  current = "";
  private fading: { action: THREE.AnimationAction; remaining: number }[] = [];

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      if (LOOP.has(clip.name)) action.setLoop(THREE.LoopRepeat, Infinity);
      else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(clip.name, action);
      // Keep the original asset's authored clips intact; expose game-state aliases.
      const aliases: Record<string, string[]> = {
        Idle: ["Idle_Loop"], Walk: ["Walk_Loop"], Run: ["Jog_Fwd_Loop", "Sprint_Loop"],
      };
      for (const alias of aliases[clip.name] ?? []) this.actions.set(alias, action);
    }
    this.play("Idle_Loop", 0);
  }

  play(name: AnimName | string, fade = 0.16): void {
    const resolved = this.actions.has(name) ? name : "Idle_Loop";
    if (resolved === this.current) return;
    const next = this.actions.get(resolved);
    if (!next) return;
    this.fading = this.fading.filter((entry) => entry.action !== next);
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    const prev = this.actions.get(this.current);
    if (prev && prev !== next) {
      if (fade > 0) { prev.crossFadeTo(next, fade, false); this.fading.push({ action: prev, remaining: fade }); }
      else prev.stop();
    }
    this.current = resolved;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    this.fading = this.fading.filter((entry) => {
      entry.remaining -= dt;
      if (entry.remaining > 0) return true;
      entry.action.stop();
      return false;
    });
  }

  setSpeed(rate: number): void {
    this.actions.get(this.current)?.setEffectiveTimeScale(THREE.MathUtils.clamp(rate, 0.1, 2.5));
  }

  setTalking(amount: number): void {
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const index = mesh.morphTargetDictionary?.speech;
      if (index !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = amount;
    });
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }
}

export interface LoadedHeroes {
  player: THREE.Object3D;
  playerClips: HeroClips;
  copProto: THREE.Object3D;
  copClips: THREE.AnimationClip[];
  civilians: { root: THREE.Object3D; clips: THREE.AnimationClip[] }[];
  car: THREE.Object3D;
  copCar: THREE.Object3D;
  trafficPool: THREE.Object3D[];
}

// Only individually reviewed characters belong in the ambient pool.
export const CIVILIAN_NAMES = ["nightlife", "floral", "weathered"] as const;

const HERO_CAR_URL = "/models/cars/sedan-sports.glb";
const COP_CAR_URL = "/models/cars/police.glb";
const TRAFFIC_CAR_URLS = [
  "/models/cars/sedan.glb",
  "/models/cars/suv.glb",
  "/models/cars/taxi.glb",
  "/models/cars/hatchback-sports.glb",
  "/models/cars/van.glb",
  "/models/cars/delivery.glb",
  "/models/cars/truck.glb",
];
const CAR_LENGTH = 4.7;

function groundAndScale(obj: THREE.Object3D, targetHeight: number): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(size.y, 0.001);
  obj.scale.multiplyScalar(targetHeight / h);
  obj.updateMatrixWorld(true);
  box.setFromObject(obj);
  obj.position.y -= box.min.y;
}

function centerXz(obj: THREE.Object3D): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
}

function tintCop(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((m) => {
      const mat = (m as THREE.MeshStandardMaterial).clone();
      if ("color" in mat && mat.color) {
        const hsl = { h: 0, s: 0, l: 0 };
        mat.color.getHSL(hsl);
        if (hsl.l > 0.18 && hsl.l < 0.85) mat.color.setHSL(0.6, 0.45, Math.min(0.42, hsl.l));
      }
      return mat;
    });
  });
}

function enableShadows(root: THREE.Object3D): void {
  root.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function prepareKenneyCar(obj: THREE.Object3D, targetLength = CAR_LENGTH): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.z, 0.001);
  obj.scale.multiplyScalar(targetLength / longest);
  obj.updateMatrixWorld(true);
  box.setFromObject(obj);
  obj.position.y -= box.min.y;
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  enableShadows(obj);
  obj.traverse((ch) => {
    const m = ch as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.map) sm.map.colorSpace = THREE.SRGBColorSpace;
      sm.metalness = Math.min(0.35, sm.metalness ?? 0);
      sm.roughness = Math.min(0.78, Math.max(0.35, sm.roughness ?? 0.55));
    }
  });
}

export async function loadHeroes(): Promise<LoadedHeroes> {
  const loader = new GLTFLoader();
  const [playerGltf, heroCarGltf, copCarGltf, ...rest] = await Promise.all([
    loader.loadAsync("/models/characters/tommy-original-rig.glb"),
    loader.loadAsync(HERO_CAR_URL),
    loader.loadAsync(COP_CAR_URL),
    ...TRAFFIC_CAR_URLS.map((url) => loader.loadAsync(url)),
    ...CIVILIAN_NAMES.map((name) => loader.loadAsync(`/models/characters/${name}.glb`)),
  ]);
  const trafficGltfs = rest.slice(0, TRAFFIC_CAR_URLS.length);
  const civilianGltfs = rest.slice(TRAFFIC_CAR_URLS.length);


  const player = playerGltf.scene;
  player.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.frustumCulled = false;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm.map) sm.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });
  groundAndScale(player, 1.82);
  centerXz(player);
  enableShadows(player);
  const playerClips = new HeroClips(player, playerGltf.animations);

  const copProto = cloneSkinned(civilianGltfs[civilianGltfs.length - 1].scene);
  groundAndScale(copProto, 1.82);
  centerXz(copProto);
  tintCop(copProto);
  enableShadows(copProto);

  const car = heroCarGltf.scene;
  prepareKenneyCar(car);
  const copCar = copCarGltf.scene;
  prepareKenneyCar(copCar);
  const trafficPool = trafficGltfs.map((gltf) => {
    prepareKenneyCar(gltf.scene);
    return gltf.scene;
  });

  return {
    player,
    playerClips,
    copProto,
    copClips: civilianGltfs[civilianGltfs.length - 1].animations,
    civilians: civilianGltfs.map((gltf) => { enableShadows(gltf.scene); return { root: gltf.scene, clips: gltf.animations }; }),
    car,
    copCar,
    trafficPool,
  };
}
