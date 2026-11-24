import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPON_CATALOG, type ManufacturerId, type ShipSlotId } from '../config/weapons';
import { computeActiveSynergies } from '../game/systems/ShopSystem';
import type { GameState } from '../game/types';

export type BlenderModelId =
  | 'player_vanguard'
  | 'enemy_small'
  | 'enemy_medium'
  | 'enemy_large'
  | 'enemy_splitter'
  | 'enemy_elite'
  | 'boss_destroyer'
  | 'boss_summoner'
  | 'boss_overlord'
  | 'boss_leviathan'
  | 'boss_gemini'
  | 'boss_bastion'
  | 'prop_nova_bomb'
  | 'prop_mine_static'
  | 'prop_mine_homing'
  | 'prop_powerup_pod'
  | 'prop_medkit_pod'
  | 'wpn_pulse_blaster'
  | 'wpn_scatter_cannon'
  | 'wpn_rail_sniper'
  | 'wpn_homing_pod'
  | 'wpn_thermal_sink'
  | 'wpn_skill_salvo'
  | 'wpn_skill_beam'
  | 'wpn_skill_emp'
  | 'obj_asteroid_ore'
  | 'obj_plasma_barrel'
  | 'obj_raid_reactor'
  | 'obj_raid_vault'
  | 'obj_raid_convoy'
  | 'prop_combat_drone'
  | 'obj_room_portal';

export type AnimationClipName =
  | 'Idle'
  | 'Charge'
  | 'Attack'
  | 'Dash'
  | 'Overheat'
  | 'PhaseShift'
  | 'ShiftToForm2'
  | 'ShiftToForm3'
  | 'Rest'
  | 'Form2'
  | 'Form3';

export const BLENDER_MODEL_URLS: Record<BlenderModelId, string> = {
  player_vanguard: '/assets/models/player_vanguard.glb',
  enemy_small: '/assets/models/enemy_small.glb',
  enemy_medium: '/assets/models/enemy_medium.glb',
  enemy_large: '/assets/models/enemy_large.glb',
  enemy_splitter: '/assets/models/enemy_splitter.glb',
  enemy_elite: '/assets/models/enemy_elite.glb',
  boss_destroyer: '/assets/models/boss_destroyer.glb',
  boss_summoner: '/assets/models/boss_summoner.glb',
  boss_overlord: '/assets/models/boss_overlord.glb',
  boss_leviathan: '/assets/models/boss_leviathan.glb',
  boss_gemini: '/assets/models/boss_gemini.glb',
  boss_bastion: '/assets/models/boss_bastion.glb',
  prop_nova_bomb: '/assets/models/prop_nova_bomb.glb',
  prop_mine_static: '/assets/models/prop_mine_static.glb',
  prop_mine_homing: '/assets/models/prop_mine_homing.glb',
  prop_powerup_pod: '/assets/models/prop_powerup_pod.glb',
  prop_medkit_pod: '/assets/models/prop_medkit_pod.glb',
  wpn_pulse_blaster: '/assets/models/wpn_pulse_blaster.glb',
  wpn_scatter_cannon: '/assets/models/wpn_scatter_cannon.glb',
  wpn_rail_sniper: '/assets/models/wpn_rail_sniper.glb',
  wpn_homing_pod: '/assets/models/wpn_homing_pod.glb',
  wpn_thermal_sink: '/assets/models/wpn_thermal_sink.glb',
  wpn_skill_salvo: '/assets/models/wpn_skill_salvo.glb',
  wpn_skill_beam: '/assets/models/wpn_skill_beam.glb',
  wpn_skill_emp: '/assets/models/wpn_skill_emp.glb',
  obj_asteroid_ore: '/assets/models/obj_asteroid_ore.glb',
  obj_plasma_barrel: '/assets/models/obj_plasma_barrel.glb',
  obj_raid_reactor: '/assets/models/obj_raid_reactor.glb',
  obj_raid_vault: '/assets/models/obj_raid_vault.glb',
  obj_raid_convoy: '/assets/models/obj_raid_convoy.glb',
  prop_combat_drone: '/assets/models/prop_combat_drone.glb',
  obj_room_portal: '/assets/models/obj_room_portal.glb',
};

export interface StageMorphParts {
  form1OnlyParts?: THREE.Object3D[];
  form12Parts?: THREE.Object3D[];
  form2OnlyParts?: THREE.Object3D[];
  form2Parts?: THREE.Object3D[];
  form3Parts?: THREE.Object3D[];
}

export function applyStageVisibility(
  parts: StageMorphParts,
  stage: 1 | 2 | 3,
  showForms = true
): void {
  const eff = showForms ? stage : 1;
  if (parts.form1OnlyParts) for (const p of parts.form1OnlyParts) p.visible = eff === 1;
  if (parts.form12Parts) for (const p of parts.form12Parts) p.visible = eff <= 2;
  if (parts.form2OnlyParts) for (const p of parts.form2OnlyParts) p.visible = showForms && stage === 2;
  if (parts.form2Parts) for (const p of parts.form2Parts) p.visible = showForms && stage >= 2;
  if (parts.form3Parts) for (const p of parts.form3Parts) p.visible = showForms && stage >= 3;
}

export interface PlayerChassisBuckets {
  stockHullShell: THREE.Object3D[];
  stockNose: THREE.Object3D[];
  stockWingInL: THREE.Object3D[];
  stockWingInR: THREE.Object3D[];
  stockWingOutL: THREE.Object3D[];
  stockWingOutR: THREE.Object3D[];
  stockSpine: THREE.Object3D[];
  stockEngine: THREE.Object3D[];
  coreArmorT1: THREE.Object3D[];
  coreArmorT2: THREE.Object3D[];
  coreShield: THREE.Object3D[];
  coreEngineT1: THREE.Object3D[];
  coreEngineT2: THREE.Object3D[];
  coreCryo: THREE.Object3D[];
  coreSensor: THREE.Object3D[];
}

export interface WeaponPartMeta {
  obj: THREE.Object3D;
  slotForm: 'nose' | 'wing_in' | 'wing_out' | 'any';
  isOuterCap: boolean;
  minTier: 1 | 2 | 3;
}

export interface FactionMaterialSpec {
  colorHex: number;
  metalness: number;
  roughness: number;
}

export interface FactionLiveryPalette {
  primary: FactionMaterialSpec;
  secondary: FactionMaterialSpec;
  accent: FactionMaterialSpec;
  frame: FactionMaterialSpec;
  glowHex: number;
  glowIntensity: number;
}

export const FACTION_LIVERY_PALETTES: Record<ManufacturerId, FactionLiveryPalette> = {
  NOVACORP: {
    primary: { colorHex: 0xdde7f7, metalness: 0.22, roughness: 0.22 },
    secondary: { colorHex: 0x182438, metalness: 0.45, roughness: 0.30 },
    accent: { colorHex: 0xfa700f, metalness: 0.28, roughness: 0.22 },
    frame: { colorHex: 0x283040, metalness: 0.86, roughness: 0.32 },
    glowHex: 0x38e8ff,
    glowIntensity: 3.8,
  },
  IRONFORGE: {
    primary: { colorHex: 0x48505c, metalness: 0.62, roughness: 0.30 },
    secondary: { colorHex: 0x232730, metalness: 0.68, roughness: 0.34 },
    accent: { colorHex: 0xf58f1a, metalness: 0.38, roughness: 0.24 },
    frame: { colorHex: 0x191c22, metalness: 0.88, roughness: 0.30 },
    glowHex: 0xff9424,
    glowIntensity: 4.0,
  },
  AETHER: {
    primary: { colorHex: 0xedf0e6, metalness: 0.20, roughness: 0.18 },
    secondary: { colorHex: 0x1e3d7a, metalness: 0.48, roughness: 0.24 },
    accent: { colorHex: 0xe6b33d, metalness: 0.88, roughness: 0.18 },
    frame: { colorHex: 0x334057, metalness: 0.84, roughness: 0.26 },
    glowHex: 0x94f5ff,
    glowIntensity: 4.0,
  },
  VOIDTECH: {
    primary: { colorHex: 0x1f1a33, metalness: 0.56, roughness: 0.22 },
    secondary: { colorHex: 0x0d0a1a, metalness: 0.70, roughness: 0.26 },
    accent: { colorHex: 0xeb387a, metalness: 0.34, roughness: 0.22 },
    frame: { colorHex: 0x26213d, metalness: 0.86, roughness: 0.28 },
    glowHex: 0xc75cff,
    glowIntensity: 4.2,
  },
};

export function resolveDominantFactionLivery(state: GameState): ManufacturerId {
  const { counts } = computeActiveSynergies(state.player);
  const factions: readonly ManufacturerId[] = ['NOVACORP', 'IRONFORGE', 'AETHER', 'VOIDTECH'];
  let bestCount = 0;
  for (const f of factions) {
    if (counts[f] > bestCount) bestCount = counts[f];
  }
  if (bestCount >= 2) {
    const leaders = factions.filter((f) => counts[f] === bestCount);
    if (leaders.length === 1) return leaders[0];
  }

  const slots = state.player.loadout.slots;
  for (const sid of ['nose', 'skill_1', 'wing_l1'] as const) {
    const m = slots[sid];
    if (m) return WEAPON_CATALOG[m.weaponId].manufacturer;
  }
  return 'NOVACORP';
}

export function applyPlayerChassisMorph(
  buckets: PlayerChassisBuckets,
  state: GameState
): {
  armorTier: 0 | 1 | 2;
  engineTier: 0 | 1 | 2;
  hasShield: boolean;
  hasCryo: boolean;
  hasSensor: boolean;
} {
  const slots = state.player.loadout.slots;
  const lv = state.shop.levels;

  const hasNose = Boolean(slots.nose);
  const hasL1 = Boolean(slots.wing_l1);
  const hasR1 = Boolean(slots.wing_r1);
  const hasL2 = Boolean(slots.wing_l2);
  const hasR2 = Boolean(slots.wing_r2);
  const hasSkill = Boolean(slots.skill_1);

  const armorScore = (lv.maxHealth ?? 0) + (lv.regen ?? 0);
  const armorTier: 0 | 1 | 2 =
    armorScore >= 4 || (lv.maxHealth ?? 0) >= 3 || (lv.regen ?? 0) >= 2
      ? 2
      : armorScore >= 1
        ? 1
        : 0;

  const engineScore = (lv.energyUpgrade ?? 0) + (lv.speedBoost ?? 0) + (lv.dashCooldown ?? 0);
  const engineTier: 0 | 1 | 2 =
    engineScore >= 4 || (lv.dashCooldown ?? 0) >= 2 || (lv.speedBoost ?? 0) >= 3
      ? 2
      : engineScore >= 1
        ? 1
        : 0;

  const hasShield = (lv.shield ?? 0) >= 1;
  const hasCryo = (lv.cryoCooler ?? 0) >= 1;
  const hasSensor = (lv.luck ?? 0) + (lv.magnet ?? 0) + (lv.greed ?? 0) >= 1;

  const setGroupVis = (list: THREE.Object3D[], visible: boolean) => {
    for (const obj of list) obj.visible = visible;
  };

  setGroupVis(buckets.stockHullShell, armorTier === 0);
  setGroupVis(buckets.stockNose, !hasNose);
  setGroupVis(buckets.stockWingInL, !hasL1);
  setGroupVis(buckets.stockWingInR, !hasR1);
  setGroupVis(buckets.stockWingOutL, !hasL1 && !hasL2);
  setGroupVis(buckets.stockWingOutR, !hasR1 && !hasR2);
  setGroupVis(buckets.stockSpine, !hasSkill);
  setGroupVis(buckets.stockEngine, engineTier === 0);

  setGroupVis(buckets.coreArmorT1, armorTier >= 1);
  setGroupVis(buckets.coreArmorT2, armorTier >= 2);
  setGroupVis(buckets.coreShield, hasShield);
  setGroupVis(buckets.coreEngineT1, engineTier === 1);
  setGroupVis(buckets.coreEngineT2, engineTier >= 2);
  setGroupVis(buckets.coreCryo, hasCryo);
  setGroupVis(buckets.coreSensor, hasSensor);

  return { armorTier, engineTier, hasShield, hasCryo, hasSensor };
}

export function applyWeaponSlotForm(
  parts: WeaponPartMeta[],
  slotId: ShipSlotId,
  hasOuterNeighbor: boolean,
  tier: 1 | 2 | 3
): void {
  const targetForm: 'nose' | 'wing_in' | 'wing_out' | 'any' =
    slotId === 'nose'
      ? 'nose'
      : slotId === 'wing_l1' || slotId === 'wing_r1'
        ? 'wing_in'
        : slotId === 'wing_l2' || slotId === 'wing_r2'
          ? 'wing_out'
          : 'any';

  for (const part of parts) {
    const formOk = targetForm === 'any' ? part.slotForm === 'any' : part.slotForm === targetForm;
    const capOk = !(part.isOuterCap && hasOuterNeighbor);
    const tierOk = tier >= part.minTier;
    part.obj.visible = formOk && capOk && tierOk;
  }
}

export function applyFactionLiveryToMaterials(
  materials: THREE.MeshStandardMaterial[],
  faction: ManufacturerId
): void {
  const pal = FACTION_LIVERY_PALETTES[faction];
  const applySpec = (mat: THREE.MeshStandardMaterial, spec: FactionMaterialSpec) => {
    mat.color.setHex(spec.colorHex);
    mat.metalness = spec.metalness;
    mat.roughness = spec.roughness;
  };

  for (const mat of materials) {
    const nm = mat.name;
    if (nm.includes('ShipHull_Primary')) {
      applySpec(mat, pal.primary);
    } else if (nm.includes('ShipHull_Secondary')) {
      applySpec(mat, pal.secondary);
    } else if (nm.includes('ShipHull_Accent')) {
      applySpec(mat, pal.accent);
    } else if (nm.includes('ShipHull_Frame')) {
      applySpec(mat, pal.frame);
    } else if (nm.includes('ShipHull_Glow')) {
      mat.color.setHex(pal.glowHex);
      mat.emissive.setHex(pal.glowHex);
      mat.emissiveIntensity = pal.glowIntensity;
      mat.userData.baseEmissiveHex = pal.glowHex;
      mat.userData.baseEmissiveIntensity = pal.glowIntensity;
    }
  }
}

export interface ClonedBlenderAsset extends StageMorphParts {
  scene: THREE.Group;
  animator: EntityAnimator;
  standardMaterials: THREE.MeshStandardMaterial[];
  reactorCoreMesh: THREE.Mesh | null;
  phasePlates: THREE.Object3D[];
  playerChassisBuckets: PlayerChassisBuckets;
  weaponParts: WeaponPartMeta[];
  form1OnlyParts: THREE.Object3D[];
  form12Parts: THREE.Object3D[];
  form2OnlyParts: THREE.Object3D[];
  form2Parts: THREE.Object3D[];
  form3Parts: THREE.Object3D[];
}

// Wraps Three's AnimationMixer so boss/enemy state changes trigger smooth NLA blends.
export class EntityAnimator {
  public readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentClip: string | null = null;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    }
    this.play('Idle');
  }

  hasClip(name: AnimationClipName): boolean {
    return this.actions.has(name);
  }

  play(
    name: AnimationClipName,
    timeScale = 1.0,
    loop: 'repeat' | 'once' = 'repeat',
    forceRestart = false
  ): void {
    const next = this.actions.get(name) ?? this.actions.get('Idle');
    if (!next) return;
    const resolvedName = this.actions.has(name) ? name : 'Idle';
    next.timeScale = timeScale;

    if (this.currentClip === resolvedName && !forceRestart) {
      return;
    }

    const prev = this.currentClip ? this.actions.get(this.currentClip) : undefined;
    next.reset();
    if (loop === 'once') {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    next.play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, 0.14, false);
    }
    this.currentClip = resolvedName;
  }

  update(dtSec: number): void {
    this.mixer.update(dtSec);
  }
}

const modelCache = new Map<BlenderModelId, GLTF>();
const readyCallbacks = new Map<BlenderModelId, Array<(gltf: GLTF) => void>>();
let preloadStarted = false;

// Fires off background fetches for every Blender .glb model (safe even in Node unit tests).
export function preloadBlenderModels(): void {
  if (preloadStarted) return;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  preloadStarted = true;

  const loader = new GLTFLoader();
  const ids = Object.keys(BLENDER_MODEL_URLS) as BlenderModelId[];

  for (const id of ids) {
    const url = BLENDER_MODEL_URLS[id];
    loader.load(
      url,
      (gltf) => {
        modelCache.set(id, gltf);
        const listeners = readyCallbacks.get(id);
        if (listeners) {
          readyCallbacks.delete(id);
          for (const cb of listeners) {
            cb(gltf);
          }
        }
      },
      undefined,
      () => {
        // Offline or missing .glb? No panic, MeshFactory still keeps boxy procedural stand-ins ready
      }
    );
  }
}

function createEmptyChassisBuckets(): PlayerChassisBuckets {
  return {
    stockHullShell: [],
    stockNose: [],
    stockWingInL: [],
    stockWingInR: [],
    stockWingOutL: [],
    stockWingOutR: [],
    stockSpine: [],
    stockEngine: [],
    coreArmorT1: [],
    coreArmorT2: [],
    coreShield: [],
    coreEngineT1: [],
    coreEngineT2: [],
    coreCryo: [],
    coreSensor: [],
  };
}

function cloneGltfAsset(gltf: GLTF): ClonedBlenderAsset {
  const clonedScene = gltf.scene.clone(true);
  const standardMaterials: THREE.MeshStandardMaterial[] = [];
  const phasePlates: THREE.Object3D[] = [];
  const playerChassisBuckets = createEmptyChassisBuckets();
  const weaponParts: WeaponPartMeta[] = [];
  const form1OnlyParts: THREE.Object3D[] = [];
  const form12Parts: THREE.Object3D[] = [];
  const form2OnlyParts: THREE.Object3D[] = [];
  const form2Parts: THREE.Object3D[] = [];
  const form3Parts: THREE.Object3D[] = [];
  let reactorCoreMesh: THREE.Mesh | null = null;

  clonedScene.traverse((node) => {
    if (node.name.includes('Plate_')) {
      phasePlates.push(node);
    }
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      const nm = mesh.name;

      // Morph buckets: toggle these based on which boss stage is currently pissed off
      if (nm.includes('Form1Only_')) {
        form1OnlyParts.push(mesh);
      } else if (nm.includes('Form12_')) {
        form12Parts.push(mesh);
      } else if (nm.includes('Form2Only_')) {
        form2OnlyParts.push(mesh);
      } else if (nm.includes('Form2_')) {
        form2Parts.push(mesh);
      } else if (nm.includes('Form3_')) {
        form3Parts.push(mesh);
      }

      // Hull cladding buckets so upgrading armor visibly chunks up your 3D ship
      if (nm.includes('StockHullShell_')) playerChassisBuckets.stockHullShell.push(mesh);
      else if (nm.includes('StockNose_')) playerChassisBuckets.stockNose.push(mesh);
      else if (nm.includes('StockWingIn_L_')) playerChassisBuckets.stockWingInL.push(mesh);
      else if (nm.includes('StockWingIn_R_')) playerChassisBuckets.stockWingInR.push(mesh);
      else if (nm.includes('StockWingOut_L_')) playerChassisBuckets.stockWingOutL.push(mesh);
      else if (nm.includes('StockWingOut_R_')) playerChassisBuckets.stockWingOutR.push(mesh);
      else if (nm.includes('StockSpine_')) playerChassisBuckets.stockSpine.push(mesh);
      else if (nm.includes('StockEngine_')) playerChassisBuckets.stockEngine.push(mesh);
      else if (nm.includes('CoreArmor_T1_')) playerChassisBuckets.coreArmorT1.push(mesh);
      else if (nm.includes('CoreArmor_T2_')) playerChassisBuckets.coreArmorT2.push(mesh);
      else if (nm.includes('CoreShield_')) playerChassisBuckets.coreShield.push(mesh);
      else if (nm.includes('CoreEngine_T1_')) playerChassisBuckets.coreEngineT1.push(mesh);
      else if (nm.includes('CoreEngine_T2_')) playerChassisBuckets.coreEngineT2.push(mesh);
      else if (nm.includes('CoreCryo_')) playerChassisBuckets.coreCryo.push(mesh);
      else if (nm.includes('CoreSensor_')) playerChassisBuckets.coreSensor.push(mesh);

      // Weapon pod slot variants & fusion tiers baked right inside the GLB mesh names
      const slotForm: WeaponPartMeta['slotForm'] = nm.includes('SlotNose_')
        ? 'nose'
        : nm.includes('SlotWingIn_')
          ? 'wing_in'
          : nm.includes('SlotWingOut_')
            ? 'wing_out'
            : 'any';
      const minTier: WeaponPartMeta['minTier'] = nm.includes('Tier3_')
        ? 3
        : nm.includes('Tier2_')
          ? 2
          : 1;
      weaponParts.push({
        obj: mesh,
        slotForm,
        isOuterCap: nm.includes('OuterCap_'),
        minTier,
      });

      if (
        mesh.name.includes('ReactorCore') ||
        (mesh.parent && mesh.parent.name.includes('ReactorCore'))
      ) {
        reactorCoreMesh = mesh;
      }
      if (mesh.material) {
        const prepareMat = (src: THREE.Material): THREE.Material => {
          const c = src.clone();
          if ((c as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const std = c as THREE.MeshStandardMaterial;
            std.envMapIntensity = 1.35;
            std.userData.baseEmissiveHex = std.emissive.getHex();
            std.userData.baseEmissiveIntensity = std.emissiveIntensity;
            standardMaterials.push(std);
          }
          return c;
        };
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(prepareMat);
        } else {
          mesh.material = prepareMat(mesh.material);
        }
      }
    }
  });

  const animator = new EntityAnimator(clonedScene, gltf.animations);
  return {
    scene: clonedScene,
    animator,
    standardMaterials,
    reactorCoreMesh,
    phasePlates,
    playerChassisBuckets,
    weaponParts,
    form1OnlyParts,
    form12Parts,
    form2OnlyParts,
    form2Parts,
    form3Parts,
  };
}

// Clones a cached Blender GLB when ready (fires immediately if already loaded).
export function whenBlenderModelReady(
  id: BlenderModelId,
  onReady: (asset: ClonedBlenderAsset) => void
): void {
  preloadBlenderModels();
  const cached = modelCache.get(id);
  if (cached) {
    onReady(cloneGltfAsset(cached));
    return;
  }
  const list = readyCallbacks.get(id) ?? [];
  list.push((gltf) => {
    onReady(cloneGltfAsset(gltf));
  });
  readyCallbacks.set(id, list);
}
