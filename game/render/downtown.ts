import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { ROAD_HALF, WALK_W, type BuildingSpec, type District } from "../world/district";

const files = {
  house: "Building_Small_1",
  shop: "Building_Medium_2_001",
  tower: "Building_Large_2",
  street: "Street_2Lane_noSidewalk",
  asphalt: "Street_Asphalt_6x6",
  curb: "Sidewalk_Straight_3m",
  crosswalk: "Decal_Crosswalk",
  centerline: "Decal_DoubleYellow_Straight",
  bollard: "Prop_Bollard",
  planter: "Prop_Planter_Single",
  utility: "Prop_ACUnit",
  manhole: "Prop_ManholeCover",
} as const;

type ModelName = keyof typeof files;
type Part = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type Model = { bounds: THREE.Box3; parts: Part[] };
export type DowntownKit = Record<ModelName, Model>;
type Placement = { matrix: THREE.Matrix4; tint?: THREE.Color };

let kitPromise: Promise<DowntownKit> | undefined;

export function loadDowntown(): Promise<DowntownKit> {
  if (!kitPromise) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    kitPromise = Promise.all(Object.entries(files).map(async ([name, file]) => {
      const { scene } = await loader.loadAsync(`/models/downtown/${file}.gltf`);
      scene.updateMatrixWorld(true);
      const parts: Part[] = [];
      scene.traverse((object) => {
        const mesh = object as Part;
        if (mesh.isMesh) parts.push(mesh);
      });
      return [name, { bounds: new THREE.Box3().setFromObject(scene), parts }];
    })).then((models) => Object.fromEntries(models) as DowntownKit).catch((error) => {
      kitPromise = undefined;
      throw error;
    });
  }
  return kitPromise;
}

export function buildDowntown(root: THREE.Group, district: District, kit: DowntownKit, shadows: boolean): void {
  const batches = new Map<string, { name: ModelName; placements: Placement[] }>();
  const transform = new THREE.Object3D();
  const roadWidth = ROAD_HALF * 2;

  function place(name: ModelName, x: number, y: number, z: number, yaw: number,
    w: number, d: number, h?: number, tint?: THREE.Color): void {
    const { bounds } = kit[name];
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const heightScale = h === undefined ? 1 : h / size.y;
    transform.position.set(x, y, z);
    transform.rotation.set(0, yaw, 0);
    transform.scale.set(w / size.x, heightScale, d / size.z);
    transform.updateMatrix();
    const matrix = transform.matrix.clone().multiply(
      new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z),
    );
    // Keep each group small enough for the renderer to cull whole blocks.
    const key = `${name}:${Math.floor(x / 49)}:${Math.floor(z / 49)}`;
    const batch = batches.get(key) ?? { name, placements: [] };
    batch.placements.push({ matrix, tint });
    batches.set(key, batch);
  }

  function building(b: Pick<BuildingSpec, "x" | "z" | "w" | "d" | "h" | "kind" | "commitLevel">, yaw: number): void {
    const name = b.kind === "warehouse" ? "tower" : b.kind === "shop" ? "shop" : "house";
    const tint = new THREE.Color(0xffffff).lerp(new THREE.Color(0x58bd83), (b.commitLevel ?? 0) * 0.045);
    const sideways = Math.abs(yaw) === Math.PI / 2;
    place(name, b.x, 0, b.z, yaw, sideways ? b.d : b.w, sideways ? b.w : b.d, b.h, tint);
  }

  for (const b of district.buildings) {
    const streetX = district.streetsX.reduce((a, x) => Math.abs(a - b.x) < Math.abs(x - b.x) ? a : x);
    const streetZ = district.streetsZ.reduce((a, z) => Math.abs(a - b.z) < Math.abs(z - b.z) ? a : z);
    let yaw = streetZ >= b.z ? 0 : Math.PI;
    if (b.kind === "garage") yaw = 0;
    else if (Math.abs(streetX - b.x) < Math.abs(streetZ - b.z)) yaw = streetX >= b.x ? Math.PI / 2 : -Math.PI / 2;
    building(b, yaw);
  }

  function skyline(x: number, z: number, yaw: number, index: number): void {
    building({ x, z, w: 15, d: 12, h: 12 + (index % 5) * 7, kind: index % 2 === 0 ? "warehouse" : "shop" }, yaw);
  }

  for (let x = district.worldMinX + 14, i = 0; x < district.worldMaxX; x += 25, i++) {
    skyline(x, district.worldMinZ - 14, 0, i);
    skyline(x, district.worldMaxZ + 14, Math.PI, i + 2);
  }
  for (let z = district.worldMinZ + 14, i = 0; z < district.worldMaxZ; z += 25, i++) {
    skyline(district.worldMinX - 14, z, Math.PI / 2, i);
    skyline(district.worldMaxX + 14, z, -Math.PI / 2, i + 3);
  }

  function segments(streets: number[], min: number, max: number, margin = 0): [number, number][] {
    return [
      [min, streets[0] - ROAD_HALF - margin],
      ...streets.slice(1).map((street, i): [number, number] => [streets[i] + ROAD_HALF + margin, street - ROAD_HALF - margin]),
      [streets[streets.length - 1] + ROAD_HALF + margin, max],
    ];
  }

  function tile(start: number, end: number, nominalLength: number, draw: (center: number, length: number) => void): void {
    const count = Math.ceil((end - start) / nominalLength);
    const length = (end - start) / count;
    for (let i = 0; i < count; i++) draw(start + (i + 0.5) * length, length);
  }

  const xSegments = segments(district.streetsX, district.worldMinX, district.worldMaxX);
  const zSegments = segments(district.streetsZ, district.worldMinZ, district.worldMaxZ);
  const zBetweenSidewalks = segments(district.streetsZ, district.worldMinZ, district.worldMaxZ, WALK_W);

  function street(x: number, z: number, yaw: number, length: number): void {
    place("street", x, 0.06, z, yaw, length, roadWidth);
    place("centerline", x, 0.066, z, yaw, length, 0.4);
  }

  for (const z of district.streetsZ) {
    for (const [start, end] of xSegments) {
      tile(start, end, 8, (x, length) => street(x, z, 0, length));
      for (const side of [-1, 1]) {
        tile(start, end, 4, (x, length) =>
          place("curb", x, 0, z + side * (ROAD_HALF + WALK_W / 2), side > 0 ? Math.PI : 0, length, WALK_W, 0.15));
      }
    }
  }
  for (const x of district.streetsX) {
    for (const [start, end] of zSegments) {
      tile(start, end, 8, (z, length) => street(x, z, Math.PI / 2, length));
    }
    for (const [start, end] of zBetweenSidewalks) {
      for (const side of [-1, 1]) {
        tile(start, end, 4, (z, length) =>
          place("curb", x + side * (ROAD_HALF + WALK_W / 2), 0, z, -side * Math.PI / 2, length, WALK_W, 0.15));
      }
    }
    for (const z of district.streetsZ) {
      place("asphalt", x, 0.06, z, 0, roadWidth, roadWidth);
      for (const side of [-1, 1]) {
        const offset = side * (ROAD_HALF - 1.05);
        place("crosswalk", x, 0.066, z + offset, 0, roadWidth - 4.1, 1.7);
        place("crosswalk", x + offset, 0.066, z, Math.PI / 2, roadWidth - 4.1, 1.7);
      }
      place("manhole", x + 1.5, 0.06, z - 1.5, 0, 0.92, 0.92);
    }
  }

  const plazaEnd = district.streetsZ[district.streetsZ.length - 1] - ROAD_HALF - WALK_W;
  tile(district.garage.x - 9, district.garage.x + 9, 6, (x, w) =>
    tile(district.garage.z - 9, plazaEnd, 6, (z, d) => place("asphalt", x, 0.035, z, 0, w, d)));

  for (const alley of district.alleys) {
    tile(alley.x - alley.w / 2, alley.x + alley.w / 2, 6, (x, w) =>
      tile(alley.z - alley.d / 2, alley.z + alley.d / 2, 6, (z, d) => place("asphalt", x, 0.045, z, 0, w, d)));
  }

  for (const prop of district.props) {
    const { x, z, yaw, kind } = prop;
    if (kind === "hydrant") place("bollard", x, 0, z, yaw, 0.24, 0.24);
    if (kind === "dumpster") place("planter", x, 0, z, yaw, 1.1, 1.1);
    if (kind === "crate") place("utility", x, 0, z, yaw, 0.85, 0.55);
  }

  const matrix = new THREE.Matrix4();
  for (const { name, placements } of batches.values()) {
    for (const part of kit[name].parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
      mesh.name = `Downtown/${name}`;
      mesh.castShadow = shadows && (name === "house" || name === "shop" || name === "tower");
      mesh.receiveShadow = name !== "crosswalk" && name !== "centerline";
      // Camera obstruction uses the district's simple building volumes.
      mesh.raycast = () => {};
      placements.forEach(({ matrix: placement, tint }, i) => {
        mesh.setMatrixAt(i, matrix.multiplyMatrices(placement, part.matrixWorld));
        if (tint) mesh.setColorAt(i, tint);
      });
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
  }
}
