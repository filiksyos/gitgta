export type GamePhase =
  | "title"
  | "playing"
  | "won"
  | "lost";

export type MissionBeat =
  | "reach"
  | "steal"
  | "getaway"
  | "return";

export type AnimName =
  | "Idle_Loop"
  | "Walk_Loop"
  | "Jog_Fwd_Loop"
  | "Sprint_Loop"
  | "Jump_Start"
  | "Jump_Loop"
  | "Jump_Land"
  | "Punch_Jab"
  | "Punch_Cross"
  | "Pistol_Shoot"
  | "Pistol_Idle_Loop"
  | "Driving_Loop"
  | "Death01";

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vy: number;
  vz: number;
  health: number;
  maxHealth: number;
  grounded: boolean;
  sprinting: boolean;
  inVehicle: number;
  anim: AnimName;
  punchCd: number;
  shootCd: number;
  ammo: number;
  maxAmmo: number;
  jumpPhase: number;
  dead: boolean;
  invuln: number;
}

export interface VehicleState {
  id: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  vx: number;
  vz: number;
  health: number;
  maxHealth: number;
  hero: boolean;
  cop: boolean;
  occupied: boolean;
  skid: number;
  stalled: number;
  steer: number;
  yawRate: number;
}

export interface PedState {
  id: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  waypointX: number;
  waypointZ: number;
  fleeing: boolean;
  kind: "civ" | "cop";
  health: number;
  shootCd: number;
  vehicleId: number;
  stunned: number;
}

export interface BulletState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  fromPlayer: boolean;
}

export interface MarkerState {
  x: number;
  z: number;
  visible: boolean;
  color: number;
}

export interface MissionState {
  beat: MissionBeat;
  stolen: boolean;
  escaped: boolean;
  delivered: boolean;
  objective: string;
  hint: string;
  loseReason: string;
  winReason: string;
  chaseTime: number;
  threeStarTime: number;
}

export interface WantedState {
  stars: number;
  heat: number;
  unseen: number;
}

export interface CameraState {
  yaw: number;
  pitch: number;
  dist: number;
  height: number;
  fov: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  orbitYaw: number;
  orbitPitch: number;
  lookIdle: number;
}

export interface WorldAabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  kind: "building" | "prop" | "wall";
}

export interface GameState {
  phase: GamePhase;
  time: number;
  player: PlayerState;
  vehicles: VehicleState[];
  peds: PedState[];
  bullets: BulletState[];
  wanted: WantedState;
  mission: MissionState;
  camera: CameraState;
  marker: MarkerState;
  safe: { x: number; z: number; r: number };
  prompt: string;
  speedKmh: number;
  shake: number;
  lastHit: number;
  seed: number;
}

export interface InputIntent {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
  interact: boolean;
  punch: boolean;
  shoot: boolean;
  lookDx: number;
  lookDy: number;
  pause: boolean;
}

export function emptyIntent(): InputIntent {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
    interact: false,
    punch: false,
    shoot: false,
    lookDx: 0,
    lookDy: 0,
    pause: false,
  };
}
