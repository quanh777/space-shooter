import * as THREE from 'three';
import { WORLD_SCALE } from '../config/constants';
import {
  SHIP_SLOT_MAP,
  WEAPON_CATALOG,
  type ManufacturerId,
  type ShipSlotId,
  type WeaponId,
} from '../config/weapons';
import type {
  ArenaObstacleKind,
  BossArchetype,
  EnemyEntity,
  RaidObjectiveKind,
} from '../game/types';
import {
  applyFactionLiveryToMaterials,
  applyStageVisibility,
  applyWeaponSlotForm,
  whenBlenderModelReady,
  type BlenderModelId,
  type EntityAnimator,
  type PlayerChassisBuckets,
  type WeaponPartMeta,
} from './AssetLoader';
import {
  createBossCoreMaterial,
  createHexShieldMaterial,
  createThrusterPlumeMaterial,
} from './shaders/gameShaders';

export interface MountedWeaponVisual {
  slotId: ShipSlotId;
  instanceId: string;
  weaponId: WeaponId;
  group: THREE.Group;
  fallbackMesh: THREE.Mesh;
  animator?: EntityAnimator;
  weaponParts?: WeaponPartMeta[];
  standardMaterials: THREE.MeshStandardMaterial[];
  assemblyPop: number;
  lastTier: 1 | 2 | 3;
  lastHasOuter: boolean;
  lastLivery?: ManufacturerId;
}

export interface PlayerVisualRefs {
  root: THREE.Group;
  shipTilt: THREE.Group;
  weaponMountGroup: THREE.Group;
  mountedMeshes: Partial<Record<ShipSlotId, MountedWeaponVisual>>;
  gunLeft: THREE.Mesh;
  gunRight: THREE.Mesh;
  thrusterLeft: THREE.Mesh;
  thrusterRight: THREE.Mesh;
  thrusterMat: THREE.ShaderMaterial;
  shieldMesh: THREE.Mesh;
  shieldMat: THREE.ShaderMaterial;
  coreMat: THREE.MeshStandardMaterial;
  animator?: EntityAnimator;
  usingBlenderGltf?: boolean;
  chassisBuckets?: PlayerChassisBuckets;
  standardMaterials: THREE.MeshStandardMaterial[];
  lastChassisKey?: string;
  lastLivery?: ManufacturerId;
  activeEngineTier?: 0 | 1 | 2;
  hullAssemblyPop: number;
}

export interface EnemyVisualRefs {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wingLeft?: THREE.Object3D;
  wingRight?: THREE.Object3D;
  orbitGroup?: THREE.Group;
  evolutionHalo?: THREE.Mesh;
  baseHaloRadius?: number;
  form1OnlyParts: THREE.Object3D[];
  form12Parts: THREE.Object3D[];
  form2OnlyParts: THREE.Object3D[];
  form2Parts: THREE.Object3D[];
  form3Parts: THREE.Object3D[];
  flashMaterials: THREE.MeshStandardMaterial[];
  hpBarGroup: THREE.Group;
  hpBarWidthWrap?: THREE.Object3D;
  hpFill: THREE.Mesh;
  animator?: EntityAnimator;
  usingBlenderGltf?: boolean;
  poolKey?: string;
  disposed?: boolean;
}

export interface BossVisualRefs {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  outerRing: THREE.Group;
  coreMesh: THREE.Mesh;
  coreMat: THREE.ShaderMaterial;
  spikesOrArms: THREE.Object3D[];
  orbitShards: THREE.Group;
  phase2Ring: THREE.Group;
  phase3Crown: THREE.Group;
  phasePlates: THREE.Object3D[];
  form1OnlyParts: THREE.Object3D[];
  form12Parts: THREE.Object3D[];
  form2OnlyParts: THREE.Object3D[];
  form2Parts: THREE.Object3D[];
  form3Parts: THREE.Object3D[];
  flashMaterials: THREE.MeshStandardMaterial[];
  animator?: EntityAnimator;
  usingBlenderGltf?: boolean;
  phaseShiftTimerSec?: number;
  activeShiftClip?: 'ShiftToForm2' | 'ShiftToForm3' | 'PhaseShift';
  forceShiftRestart?: boolean;
  disposed?: boolean;
}

export interface PropVisualRefs {
  root: THREE.Group;
  animator?: EntityAnimator;
  dangerRing?: THREE.Mesh;
  progressRing?: THREE.Mesh;
  beaconRing?: THREE.Mesh;
  hpBarGroup?: THREE.Group;
  hpFill?: THREE.Mesh;
  tintMaterials: Array<THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>;
  flashMaterials?: THREE.MeshStandardMaterial[];
  poolKey?: string;
  disposed?: boolean;
}

export function createPlayerVisual(): PlayerVisualRefs {
  const root = new THREE.Group();
  const shipTilt = new THREE.Group();
  root.add(shipTilt);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xd8e8ff,
    metalness: 0.72,
    roughness: 0.25,
  });

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x335070,
    metalness: 0.68,
    roughness: 0.35,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1a2838,
    metalness: 0.8,
    roughness: 0.3,
  });

  const cockpitMat = new THREE.MeshStandardMaterial({
    color: 0x00eeff,
    emissive: 0x00bbee,
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.1,
  });

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 1.6,
    roughness: 0.15,
  });

  // Nose points along +X in local ship space so rotation.y = -facingAngle behaves like sane trig
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.8, 6), hullMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(1.2, 0.15, 0);
  shipTilt.add(nose);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 1.35), hullMat);
  torso.position.set(-0.4, 0.1, 0);
  shipTilt.add(torso);

  // Delta wings (-Z port, +Z starboard)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.8, 0.5);
  wingShape.lineTo(-1.1, 2.55);
  wingShape.lineTo(-1.6, 2.3);
  wingShape.lineTo(-1.1, 0.5);
  wingShape.closePath();

  const extrudeSettings = { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(0, 0.05, 0);
  shipTilt.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.z = -1;
  shipTilt.add(leftWing);

  // Mandatory sci-fi wingtip navigation strips
  const tipMat = new THREE.MeshBasicMaterial({ color: 0x22eeff });
  const tipGeo = new THREE.BoxGeometry(0.65, 0.1, 0.12);
  const tipL = new THREE.Mesh(tipGeo, tipMat);
  tipL.position.set(-1.15, 0.05, -2.35);
  const tipR = new THREE.Mesh(tipGeo, tipMat);
  tipR.position.set(-1.15, 0.05, 2.35);
  shipTilt.add(tipL, tipR);

  // Glass canopy (purely ornamental, pilot is invisible and fearless)
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), cockpitMat);
  cockpit.scale.set(1.65, 0.65, 0.8);
  cockpit.position.set(0.35, 0.48, 0);
  shipTilt.add(cockpit);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 16), coreMat);
  core.position.set(-0.75, 0.42, 0);
  shipTilt.add(core);

  const gunGeo = new THREE.CylinderGeometry(0.11, 0.14, 1.35, 8);
  gunGeo.rotateZ(Math.PI / 2);
  const gunLeft = new THREE.Mesh(gunGeo, trimMat);
  gunLeft.position.set(0.45, 0.0, -1.35);
  const gunRight = new THREE.Mesh(gunGeo, trimMat);
  gunRight.position.set(0.45, 0.0, 1.35);
  shipTilt.add(gunLeft, gunRight);

  const nozzleGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.5, 10);
  nozzleGeo.rotateZ(Math.PI / 2);
  const nozL = new THREE.Mesh(nozzleGeo, trimMat);
  nozL.position.set(-1.55, 0.05, -0.58);
  const nozR = new THREE.Mesh(nozzleGeo, trimMat);
  nozR.position.set(-1.55, 0.05, 0.58);
  shipTilt.add(nozL, nozR);

  const flameGeo = new THREE.ConeGeometry(0.26, 1.8, 12, 1, true);
  flameGeo.rotateZ(Math.PI / 2);
  flameGeo.translate(-0.9, 0, 0);
  const thrusterMat = createThrusterPlumeMaterial();
  const thrusterLeft = new THREE.Mesh(flameGeo, thrusterMat);
  thrusterLeft.position.set(-1.82, -0.02, -0.36);
  const thrusterRight = new THREE.Mesh(flameGeo, thrusterMat);
  thrusterRight.position.set(-1.82, -0.02, 0.36);
  shipTilt.add(thrusterLeft, thrusterRight);

  // Hexagonal Aegis bubble when passive shield triggers
  const shieldMat = createHexShieldMaterial();
  const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(3.25, 28, 20), shieldMat);
  shieldMesh.visible = false;
  root.add(shieldMesh);

  const fallbackMeshes: THREE.Object3D[] = [
    nose,
    torso,
    rightWing,
    leftWing,
    tipL,
    tipR,
    cockpit,
    core,
    gunLeft,
    gunRight,
    nozL,
    nozR,
  ];

  const weaponMountGroup = new THREE.Group();
  shipTilt.add(weaponMountGroup);

  const refs: PlayerVisualRefs = {
    root,
    shipTilt,
    weaponMountGroup,
    mountedMeshes: {},
    gunLeft,
    gunRight,
    thrusterLeft,
    thrusterRight,
    thrusterMat,
    shieldMesh,
    shieldMat,
    coreMat,
    usingBlenderGltf: false,
    standardMaterials: [],
    hullAssemblyPop: 0,
  };

  whenBlenderModelReady('player_vanguard', (asset) => {
    for (const part of fallbackMeshes) {
      part.visible = false;
    }
    shipTilt.add(asset.scene);
    refs.animator = asset.animator;
    refs.usingBlenderGltf = true;
    refs.chassisBuckets = asset.playerChassisBuckets;
    refs.standardMaterials = asset.standardMaterials;
    refs.lastChassisKey = undefined;
    refs.lastLivery = undefined;
  });

  return refs;
}

const SHARED_ENTITY_HP_BG_GEO = new THREE.PlaneGeometry(1, 0.32);
const SHARED_ENTITY_HP_FILL_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 0.24);
  g.translate(0.5, 0, 0);
  return g;
})();
const SHARED_WORLD_HP_BG_GEO = new THREE.PlaneGeometry(1, 0.36);
const SHARED_WORLD_HP_FILL_GEO = new THREE.PlaneGeometry(1, 0.2);

function createEntityHpBar(width: number): {
  group: THREE.Group;
  fill: THREE.Mesh;
  widthWrap: THREE.Group;
} {
  const group = new THREE.Group();
  const widthWrap = new THREE.Group();
  widthWrap.scale.x = width;
  group.add(widthWrap);

  const bg = new THREE.Mesh(
    SHARED_ENTITY_HP_BG_GEO,
    new THREE.MeshBasicMaterial({ color: 0x111122, transparent: true, opacity: 0.75, depthWrite: false })
  );
  bg.userData.sharedGeo = true;
  bg.rotation.x = -Math.PI / 2;
  widthWrap.add(bg);

  const fill = new THREE.Mesh(
    SHARED_ENTITY_HP_FILL_GEO,
    new THREE.MeshBasicMaterial({ color: 0x44ee66, depthWrite: false })
  );
  fill.userData.sharedGeo = true;
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(-0.5, 0.02, 0);
  widthWrap.add(fill);
  group.visible = false;
  return { group, fill, widthWrap };
}

export function createEnemyVisual(enemy: EnemyEntity): EnemyVisualRefs {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const flashMaterials: THREE.MeshStandardMaterial[] = [];

  const isGold = enemy.canDrop;
  let wingLeft: THREE.Object3D | undefined;
  let wingRight: THREE.Object3D | undefined;
  let orbitGroup: THREE.Group | undefined;

  if (enemy.isMinion) {
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xcc66ff,
      emissive: 0x9922ee,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    flashMaterials.push(coreMat);
    bodyGroup.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), coreMat));

    orbitGroup = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xff88ff,
      emissive: 0xaa33ff,
      emissiveIntensity: 1.0,
    });
    flashMaterials.push(bladeMat);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.22), bladeMat);
      blade.position.set(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4);
      blade.rotation.y = -a;
      orbitGroup.add(blade);
    }
    bodyGroup.add(orbitGroup);
  } else if (enemy.type === 'small') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffcc22 : 0xff3b30,
      emissive: isGold ? 0xaa6600 : 0x881111,
      emissiveIntensity: 0.9,
      metalness: 0.55,
      roughness: 0.3,
    });
    flashMaterials.push(bodyMat);

    const dart = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.5, 5), bodyMat);
    dart.rotation.z = -Math.PI / 2;
    bodyGroup.add(dart);

    const wMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffee88 : 0xff6655,
      emissive: isGold ? 0x995500 : 0x661111,
      emissiveIntensity: 0.7,
    });
    flashMaterials.push(wMat);

    const wGeo = new THREE.BoxGeometry(0.9, 0.14, 1.3);
    wingLeft = new THREE.Mesh(wGeo, wMat);
    wingLeft.position.set(-0.3, 0, -1.0);
    wingRight = new THREE.Mesh(wGeo, wMat);
    wingRight.position.set(-0.3, 0, 1.0);
    bodyGroup.add(wingLeft, wingRight);
  } else if (enemy.type === 'medium') {
    const hullMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffcc22 : 0xff7722,
      emissive: isGold ? 0x885500 : 0x662200,
      emissiveIntensity: 0.8,
      metalness: 0.65,
      roughness: 0.28,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffee66 : 0x00eeff,
      emissive: isGold ? 0xffaa00 : 0x00ccff,
      emissiveIntensity: 1.5,
    });
    flashMaterials.push(hullMat, coreMat);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), coreMat);
    bodyGroup.add(core);

    const plateGeo = new THREE.BoxGeometry(2.1, 0.6, 0.95);
    wingLeft = new THREE.Mesh(plateGeo, hullMat);
    wingLeft.position.set(0.1, 0, -1.15);
    wingRight = new THREE.Mesh(plateGeo, hullMat);
    wingRight.position.set(0.1, 0, 1.15);
    bodyGroup.add(wingLeft, wingRight);
  } else if (enemy.type === 'large') {
    const armorMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffbb22 : 0xaa22cc,
      emissive: isGold ? 0x664400 : 0x440066,
      emissiveIntensity: 0.75,
      metalness: 0.65,
      roughness: 0.35,
    });
    const hornMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffee99 : 0xff66ff,
      emissive: isGold ? 0xaa6600 : 0xcc22cc,
      emissiveIntensity: 1.2,
    });
    flashMaterials.push(armorMat, hornMat);

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2.0, 1.1, 6), armorMat);
    bodyGroup.add(hull);

    const hornGeo = new THREE.ConeGeometry(0.42, 1.8, 5);
    hornGeo.rotateZ(-Math.PI / 2);
    const hornL = new THREE.Mesh(hornGeo, hornMat);
    hornL.position.set(1.9, 0.1, -0.85);
    const hornR = new THREE.Mesh(hornGeo, hornMat);
    hornR.position.set(1.9, 0.1, 0.85);
    bodyGroup.add(hornL, hornR);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), hornMat);
    eye.position.set(0.7, 0.55, 0);
    bodyGroup.add(eye);
  } else {
    // Elite Void Prism
    const prismMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffdd33 : 0x33eeff,
      emissive: isGold ? 0xaa6600 : 0x0088cc,
      emissiveIntensity: 1.5,
      metalness: 0.4,
      roughness: 0.15,
    });
    flashMaterials.push(prismMat);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.45, 0), prismMat);
    crystal.scale.set(1, 1.4, 1);
    bodyGroup.add(crystal);

    orbitGroup = new THREE.Group();
    const shardMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xffee88 : 0xaa88ff,
      emissive: isGold ? 0xffaa00 : 0x5533ff,
      emissiveIntensity: 1.3,
    });
    flashMaterials.push(shardMat);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), shardMat);
      shard.position.set(Math.cos(a) * 2.25, 0.2, Math.sin(a) * 2.25);
      orbitGroup.add(shard);
    }
    bodyGroup.add(orbitGroup);
  }

  const hpBar = createEntityHpBar(Math.max(2.6, enemy.w * 0.1));
  hpBar.group.position.set(0, 1.9, -enemy.radius * 0.1 - 1.2);
  root.add(hpBar.group);

  // 3-Stage Bot Evolution Halo (Tier 1 hidden, Tier 2 tactical cyan-amber, Tier 3 overdrive violet-gold)
  const haloRadius = Math.max(1.35, enemy.radius * 0.125);
  const evolutionHalo = new THREE.Mesh(
    new THREE.TorusGeometry(haloRadius, 0.085, 8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38e8ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  evolutionHalo.rotation.x = Math.PI / 2;
  evolutionHalo.position.y = -0.12;
  evolutionHalo.visible = false;
  root.add(evolutionHalo);

  const fallbackChildren = [...bodyGroup.children];
  const refs: EnemyVisualRefs = {
    root,
    bodyGroup,
    wingLeft,
    wingRight,
    orbitGroup,
    evolutionHalo,
    baseHaloRadius: haloRadius,
    form1OnlyParts: [],
    form12Parts: [],
    form2OnlyParts: [],
    form2Parts: [],
    form3Parts: [],
    flashMaterials,
    hpBarGroup: hpBar.group,
    hpBarWidthWrap: hpBar.widthWrap,
    hpFill: hpBar.fill,
    usingBlenderGltf: false,
  };

  const modelId: BlenderModelId = enemy.isMinion
    ? 'enemy_splitter'
    : enemy.type === 'small'
      ? 'enemy_small'
      : enemy.type === 'medium'
        ? 'enemy_medium'
        : enemy.type === 'large'
          ? 'enemy_large'
          : 'enemy_elite';

  whenBlenderModelReady(modelId, (asset) => {
    if (refs.disposed) return;
    for (const child of fallbackChildren) {
      child.visible = false;
    }
    if (isGold) {
      for (const mat of asset.standardMaterials) {
        const isPreservePart =
          /(?:Frame|Dark|Titanium|Obsidian|Cage|Gunmetal|Optic|Glow|Eye|Canopy|Core|Plasma|Bone|Chrono|Steel)/i.test(
            mat.name
          );
        if (!isPreservePart) {
          mat.color.setHex(0xffc824);
          mat.emissive.setHex(0xaa6600);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.55);
          mat.userData.baseEmissiveHex = 0xaa6600;
          mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
        }
      }
    }
    bodyGroup.add(asset.scene);
    refs.form1OnlyParts = asset.form1OnlyParts;
    refs.form12Parts = asset.form12Parts;
    refs.form2OnlyParts = asset.form2OnlyParts;
    refs.form2Parts = asset.form2Parts;
    refs.form3Parts = asset.form3Parts;
    applyStageVisibility(refs, enemy.evolutionTier, true);
    refs.flashMaterials = asset.standardMaterials;
    refs.animator = asset.animator;
    refs.usingBlenderGltf = true;
  });

  return refs;
}

export function createLeviathanSegmentVisual(radiusWorld: number): THREE.Group {
  const segGroup = new THREE.Group();

  const scaleMat = new THREE.MeshStandardMaterial({
    color: 0x0b2a22,
    emissive: 0x064e3b,
    emissiveIntensity: 0.45,
    metalness: 0.76,
    roughness: 0.28,
  });
  const venomMat = new THREE.MeshStandardMaterial({
    color: 0x10f5a8,
    emissive: 0x10f5a8,
    emissiveIntensity: 1.5,
    metalness: 0.3,
    roughness: 0.2,
  });

  const vertebra = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusWorld * 0.84, radiusWorld * 0.92, radiusWorld * 0.65, 6),
    scaleMat
  );
  vertebra.rotation.z = Math.PI / 2;
  segGroup.add(vertebra);

  const dorsalFin = new THREE.Mesh(
    new THREE.ConeGeometry(radiusWorld * 0.28, radiusWorld * 0.95, 4),
    venomMat
  );
  dorsalFin.position.set(-radiusWorld * 0.12, radiusWorld * 0.56, 0);
  dorsalFin.rotation.z = 0.35;
  segGroup.add(dorsalFin);

  for (const side of [-1, 1]) {
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(radiusWorld * 0.48, radiusWorld * 0.18, radiusWorld * 0.26),
      venomMat
    );
    vent.position.set(0, 0.08, side * radiusWorld * 0.88);
    segGroup.add(vent);
  }

  return segGroup;
}

const BOSS_THEME_HEX: Record<BossArchetype, number> = {
  0: 0xff3344,
  1: 0xaa44ff,
  2: 0xffcc22,
  3: 0x10f5a8,
  4: 0x38e8ff,
  5: 0xff8c1a,
};

const BOSS_DARK_HEX: Record<BossArchetype, number> = {
  0: 0x3b1014,
  1: 0x260c3d,
  2: 0x3f2d0a,
  3: 0x0b3629,
  4: 0x0d2840,
  5: 0x3b220a,
};

const BOSS_MODEL_IDS: Record<BossArchetype, BlenderModelId> = {
  0: 'boss_destroyer',
  1: 'boss_summoner',
  2: 'boss_overlord',
  3: 'boss_leviathan',
  4: 'boss_gemini',
  5: 'boss_bastion',
};

export function createBossVisual(
  archetype: BossArchetype,
  radiusWorld: number,
  tintOverrideHex?: number
): BossVisualRefs {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const outerRing = new THREE.Group();
  const orbitShards = new THREE.Group();
  root.add(bodyGroup);
  bodyGroup.add(outerRing, orbitShards);

  const spikesOrArms: THREE.Object3D[] = [];
  const flashMaterials: THREE.MeshStandardMaterial[] = [];
  const fallbackPhasePlates: THREE.Object3D[] = [];

  const themeHex = tintOverrideHex ?? BOSS_THEME_HEX[archetype];
  const darkHex = BOSS_DARK_HEX[archetype];

  const hullMat = new THREE.MeshStandardMaterial({
    color: darkHex,
    emissive: themeHex,
    emissiveIntensity: 0.35,
    metalness: 0.78,
    roughness: 0.28,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: themeHex,
    emissive: themeHex,
    emissiveIntensity: 1.2,
    metalness: 0.5,
    roughness: 0.2,
  });
  // Procedural standby silhouettes in case a boss .glb hasn't finished streaming
  const coreMat = createBossCoreMaterial(archetype);
  flashMaterials.push(hullMat, accentMat);

  if (archetype === 0) {
    // Destroyer: flying buzzsaw octagon
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusWorld * 0.85, radiusWorld * 0.96, 1.8, 8),
      hullMat
    );
    bodyGroup.add(hull);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radiusWorld * 0.72, 0.24, 10, 8),
      accentMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.9;
    outerRing.add(rim);

    const bladeGeo = new THREE.ConeGeometry(0.65, radiusWorld * 0.65, 4);
    bladeGeo.rotateZ(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.y = -a;
      const blade = new THREE.Mesh(bladeGeo, accentMat);
      blade.position.set(radiusWorld * 1.0, 0, 0);
      pivot.add(blade);
      outerRing.add(pivot);
      spikesOrArms.push(blade);
    }
  } else if (archetype === 1) {
    // Summoner: floating void crystal with creepy crab arms
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(radiusWorld * 0.85, 0), hullMat);
    crystal.scale.set(1, 1.35, 1);
    bodyGroup.add(crystal);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(radiusWorld * 0.95, 0.16, 8, 32),
      accentMat
    );
    halo.rotation.x = Math.PI / 2;
    outerRing.add(halo);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.y = -a;
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(radiusWorld * 0.9, 0.45, 0.55),
        accentMat
      );
      arm.position.set(radiusWorld * 0.88, 0, 0);
      pivot.add(arm);
      outerRing.add(pivot);
      spikesOrArms.push(arm);
    }

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), accentMat);
      shard.position.set(Math.cos(a) * radiusWorld * 1.35, 0.6, Math.sin(a) * radiusWorld * 1.35);
      orbitShards.add(shard);
    }
  } else if (archetype === 2) {
    // Overlord: golden sun-gear boss that definitely compensates for something
    const gear = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusWorld * 0.9, radiusWorld * 0.9, 1.6, 12),
      hullMat
    );
    bodyGroup.add(gear);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radiusWorld * 0.65, 0.22, 10, 24),
      accentMat
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.85;
    outerRing.add(innerRing);

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.7), accentMat);
      tooth.position.set(Math.cos(a) * radiusWorld * 0.95, 0, Math.sin(a) * radiusWorld * 0.95);
      tooth.rotation.y = -a;
      outerRing.add(tooth);
    }

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pivot = new THREE.Group();
      pivot.rotation.y = -a;
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.45, radiusWorld * 0.95, 8),
        accentMat
      );
      arm.rotation.z = Math.PI / 2;
      arm.position.set(radiusWorld * 1.05, 0.2, 0);
      pivot.add(arm);
      outerRing.add(pivot);
      spikesOrArms.push(arm);
    }
  } else if (archetype === 3) {
    // Leviathan: cyber-snake head (segments get stitched on by SceneManager)
    const skull = new THREE.Mesh(new THREE.ConeGeometry(radiusWorld * 0.88, radiusWorld * 1.65, 6), hullMat);
    skull.rotation.z = -Math.PI / 2;
    bodyGroup.add(skull);

    for (const side of [-1, 1]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.42, radiusWorld * 1.05, 4), accentMat);
      fang.rotation.z = -Math.PI / 2 + side * 0.16;
      fang.position.set(radiusWorld * 0.85, 0.08, side * radiusWorld * 0.56);
      outerRing.add(fang);
      spikesOrArms.push(fang);
    }
  } else if (archetype === 4) {
    // Gemini: Alpha crescent claw (Omega twin gets cloned separately)
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(radiusWorld * 0.88, 0.22, 10, 28),
      accentMat
    );
    halo.rotation.x = Math.PI / 2;
    outerRing.add(halo);

    for (const side of [-1, 1]) {
      const prong = new THREE.Mesh(
        new THREE.BoxGeometry(radiusWorld * 1.25, 0.55, radiusWorld * 0.44),
        hullMat
      );
      prong.position.set(radiusWorld * 0.2, 0, side * radiusWorld * 0.62);
      outerRing.add(prong);
      spikesOrArms.push(prong);
    }
  } else {
    // Bastion: walking fortress wearing 4 pop-off armor plates
    const bastionCore = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusWorld * 0.82, radiusWorld * 0.88, 1.75, 8),
      hullMat
    );
    bodyGroup.add(bastionCore);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(radiusWorld * 0.52, 1.35, radiusWorld * 1.08),
        accentMat
      );
      plate.name = `Plate_${i}`;
      plate.position.set(Math.cos(a) * radiusWorld * 1.02, 0.1, Math.sin(a) * radiusWorld * 1.02);
      plate.rotation.y = -a;
      bodyGroup.add(plate);
      fallbackPhasePlates.push(plate);
    }
  }

  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(radiusWorld * 0.38, 18, 14), coreMat);
  coreMesh.position.y = 0.75;
  bodyGroup.add(coreMesh);

  // Snapshot fallback meshes BEFORE bolting on the Form II/III transformation halos
  const fallbackChildren = [...bodyGroup.children].filter((c) => c !== orbitShards);

  // Form II ring pops out at 60% HP if Blender mesh isn't swapped in
  const phase2Ring = new THREE.Group();
  const p2Mat = new THREE.MeshBasicMaterial({
    color: themeHex,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const p2Halo = new THREE.Mesh(new THREE.TorusGeometry(radiusWorld * 1.24, 0.14, 8, 32), p2Mat);
  p2Halo.rotation.x = Math.PI / 2;
  phase2Ring.add(p2Halo);
  const p2BladeGeo = new THREE.ConeGeometry(0.45, radiusWorld * 0.62, 4);
  p2BladeGeo.rotateZ(-Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const blade = new THREE.Mesh(p2BladeGeo, p2Mat);
    blade.position.set(Math.cos(a) * radiusWorld * 1.48, 0.15, Math.sin(a) * radiusWorld * 1.48);
    blade.rotation.y = -a;
    phase2Ring.add(blade);
  }
  phase2Ring.visible = false;
  phase2Ring.scale.setScalar(0.01);
  bodyGroup.add(phase2Ring);

  // Form III fiery halo ignites at 30% HP (now the boss is really mad)
  const phase3Crown = new THREE.Group();
  const p3WingMat = new THREE.MeshBasicMaterial({
    color: 0xffdd55,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const p3Ring = new THREE.Mesh(
    new THREE.TorusGeometry(radiusWorld * 1.56, 0.16, 8, 36),
    new THREE.MeshBasicMaterial({
      color: themeHex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  p3Ring.rotation.x = Math.PI / 2;
  p3Ring.position.y = 0.45;
  phase3Crown.add(p3Ring);
  const wingGeo = new THREE.ConeGeometry(radiusWorld * 0.34, radiusWorld * 1.45, 3);
  wingGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    for (let w = 0; w < 2; w++) {
      const wing = new THREE.Mesh(wingGeo, p3WingMat);
      wing.position.set(
        -radiusWorld * (0.35 + w * 0.32),
        0.55 + w * 0.22,
        side * radiusWorld * (1.28 + w * 0.25)
      );
      wing.rotation.y = side * (0.42 + w * 0.24);
      phase3Crown.add(wing);
    }
  }
  phase3Crown.visible = false;
  phase3Crown.scale.setScalar(0.01);
  bodyGroup.add(phase3Crown);

  const refs: BossVisualRefs = {
    root,
    bodyGroup,
    outerRing,
    coreMesh,
    coreMat,
    spikesOrArms,
    orbitShards,
    phase2Ring,
    phase3Crown,
    phasePlates: fallbackPhasePlates,
    form1OnlyParts: [],
    form12Parts: [],
    form2OnlyParts: [],
    form2Parts: [],
    form3Parts: [],
    flashMaterials,
    usingBlenderGltf: false,
    phaseShiftTimerSec: 0,
  };

  const bossModelId = BOSS_MODEL_IDS[archetype];

  whenBlenderModelReady(bossModelId, (asset) => {
    if (refs.disposed) return;
    for (const child of fallbackChildren) {
      child.visible = false;
    }
    asset.scene.scale.setScalar(radiusWorld * 1.08);
    if (asset.reactorCoreMesh) {
      asset.reactorCoreMesh.material = coreMat;
      asset.reactorCoreMesh.userData.baseCoreScale = asset.reactorCoreMesh.scale.clone();
      refs.coreMesh = asset.reactorCoreMesh;
    }
    if (tintOverrideHex !== undefined) {
      for (const mat of asset.standardMaterials) {
        if (/(?:Glow|Energy|Cyan|Halo|Plasma|Blade|Accent|Trim|Rim)/i.test(mat.name) || mat.emissiveIntensity > 0.6) {
          mat.color.setHex(tintOverrideHex);
          mat.emissive.setHex(tintOverrideHex);
          mat.userData.baseEmissiveHex = tintOverrideHex;
        }
      }
    }
    bodyGroup.add(asset.scene);
    refs.phasePlates = asset.phasePlates;
    refs.form1OnlyParts = asset.form1OnlyParts;
    refs.form12Parts = asset.form12Parts;
    refs.form2OnlyParts = asset.form2OnlyParts;
    refs.form2Parts = asset.form2Parts;
    refs.form3Parts = asset.form3Parts;
    applyStageVisibility(refs, 1, false);
    refs.flashMaterials = asset.standardMaterials;
    refs.animator = asset.animator;
    refs.usingBlenderGltf = true;
  });

  return refs;
}

export function createBombVisual(): PropVisualRefs {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xddeeff,
    emissive: 0x00ccff,
    emissiveIntensity: 1.1,
    metalness: 0.7,
    roughness: 0.2,
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 8), bodyMat);
  body.rotation.z = -Math.PI / 2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.08, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  ring.rotation.y = Math.PI / 2;
  root.add(body, ring);

  const refs: PropVisualRefs = { root, tintMaterials: [] };
  whenBlenderModelReady('prop_nova_bomb', (asset) => {
    if (refs.disposed) return;
    body.visible = false;
    ring.visible = false;
    asset.scene.scale.setScalar(0.95);
    root.add(asset.scene);
    refs.animator = asset.animator;
  });
  return refs;
}

export function createMineVisual(hex: number, homing: boolean): PropVisualRefs {
  const root = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.DodecahedronGeometry(homing ? 1.15 : 0.95, 0),
    new THREE.MeshStandardMaterial({
      color: 0x222230,
      metalness: 0.8,
      roughness: 0.3,
    })
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 12, 10),
    new THREE.MeshBasicMaterial({ color: hex })
  );
  const dangerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.45, 1.75, 28),
    new THREE.MeshBasicMaterial({
      color: hex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  dangerRing.rotation.x = -Math.PI / 2;
  root.add(shell, core, dangerRing);

  const refs: PropVisualRefs = { root, dangerRing, tintMaterials: [core.material] };
  whenBlenderModelReady(homing ? 'prop_mine_homing' : 'prop_mine_static', (asset) => {
    if (refs.disposed) return;
    shell.visible = false;
    core.visible = false;
    asset.scene.scale.setScalar(homing ? 1.15 : 1.08);
    root.add(asset.scene);
    refs.animator = asset.animator;
  });
  return refs;
}

export function createPowerUpVisual(hex: number): PropVisualRefs {
  const root = new THREE.Group();
  const gemMat = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: 1.7,
    metalness: 0.2,
    roughness: 0.1,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.05, 0), gemMat);
  const ringMat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.75 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 24), ringMat);
  ring.rotation.x = Math.PI / 2;
  root.add(gem, ring);

  const refs: PropVisualRefs = { root, tintMaterials: [gemMat, ringMat] };
  whenBlenderModelReady('prop_powerup_pod', (asset) => {
    if (refs.disposed) return;
    gem.visible = false;
    ring.visible = false;
    for (const mat of asset.standardMaterials) {
      if (mat.name.includes('EnergyCrystal')) {
        mat.color.setHex(hex);
        mat.emissive.setHex(hex);
        mat.emissiveIntensity = 2.6;
        mat.userData.baseEmissiveHex = hex;
        mat.userData.baseEmissiveIntensity = 2.6;
        refs.tintMaterials.push(mat);
      }
    }
    asset.scene.scale.setScalar(1.05);
    root.add(asset.scene);
    refs.animator = asset.animator;
  });
  return refs;
}

export function createHealthPickupVisual(): PropVisualRefs {
  const root = new THREE.Group();
  const capsuleMat = new THREE.MeshStandardMaterial({
    color: 0x33ff88,
    emissive: 0x22cc66,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const bar1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.55), capsuleMat);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.8), capsuleMat);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.08, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = Math.PI / 2;
  root.add(bar1, bar2, ring);

  const refs: PropVisualRefs = { root, tintMaterials: [] };
  whenBlenderModelReady('prop_medkit_pod', (asset) => {
    bar1.visible = false;
    bar2.visible = false;
    ring.visible = false;
    asset.scene.scale.setScalar(1.15);
    root.add(asset.scene);
    refs.animator = asset.animator;
  });
  return refs;
}

function buildCompactWorldHpBar(width: number, heightY: number): {
  hpBarGroup: THREE.Group;
  hpFill: THREE.Mesh;
} {
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.set(0, heightY, -0.4);
  hpBarGroup.rotation.x = -Math.PI * 0.35;
  hpBarGroup.visible = false;

  const bg = new THREE.Mesh(
    SHARED_WORLD_HP_BG_GEO,
    new THREE.MeshBasicMaterial({
      color: 0x091322,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  bg.userData.sharedGeo = true;
  bg.scale.x = width + 0.24;

  const fillWrap = new THREE.Group();
  fillWrap.scale.x = width;
  fillWrap.position.z = 0.02;

  const hpFill = new THREE.Mesh(
    SHARED_WORLD_HP_FILL_GEO,
    new THREE.MeshBasicMaterial({
      color: 0x38f288,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  hpFill.userData.sharedGeo = true;
  fillWrap.add(hpFill);
  hpBarGroup.add(bg, fillWrap);
  return { hpBarGroup, hpFill };
}

export function createArenaObstacleVisual(
  kind: ArenaObstacleKind,
  arenaRadius: number
): PropVisualRefs {
  const root = new THREE.Group();
  const worldR = Math.max(1.0, arenaRadius * WORLD_SCALE);
  const isBarrel = kind === 'plasma_barrel';

  const fallbackMat = new THREE.MeshStandardMaterial({
    color: isBarrel ? 0x322228 : 0x2b3648,
    emissive: isBarrel ? 0xff5a1f : 0x22d3ee,
    emissiveIntensity: isBarrel ? 0.85 : 0.14,
    metalness: isBarrel ? 0.72 : 0.45,
    roughness: isBarrel ? 0.28 : 0.65,
  });
  const fallbackMesh = new THREE.Mesh(
    isBarrel
      ? new THREE.CylinderGeometry(worldR * 0.65, worldR * 0.72, worldR * 1.45, 10)
      : new THREE.DodecahedronGeometry(worldR * 0.9, 0),
    fallbackMat
  );
  root.add(fallbackMesh);

  let dangerRing: THREE.Mesh | undefined;
  if (isBarrel) {
    dangerRing = new THREE.Mesh(
      new THREE.RingGeometry(worldR * 1.05, worldR * 1.24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff6a2a,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    dangerRing.rotation.x = -Math.PI / 2;
    dangerRing.position.y = -0.35;
    root.add(dangerRing);
  }

  const { hpBarGroup, hpFill } = buildCompactWorldHpBar(worldR * 1.9, worldR + 1.25);
  root.add(hpBarGroup);

  const refs: PropVisualRefs = {
    root,
    dangerRing,
    hpBarGroup,
    hpFill,
    tintMaterials: [],
    flashMaterials: [fallbackMat],
  };

  whenBlenderModelReady(isBarrel ? 'obj_plasma_barrel' : 'obj_asteroid_ore', (asset) => {
    if (refs.disposed) return;
    fallbackMesh.visible = false;
    asset.scene.scale.setScalar(worldR * 1.04);
    root.add(asset.scene);
    refs.animator = asset.animator;
    refs.flashMaterials?.push(...asset.standardMaterials);
  });

  return refs;
}

export function createRaidObjectiveVisual(
  kind: RaidObjectiveKind,
  arenaRadius: number,
  accentHex: number
): PropVisualRefs {
  const root = new THREE.Group();
  const worldR = Math.max(1.8, arenaRadius * WORLD_SCALE);

  const fallbackMat = new THREE.MeshStandardMaterial({
    color: 0x263246,
    emissive: accentHex,
    emissiveIntensity: 0.75,
    metalness: 0.7,
    roughness: 0.25,
  });
  const fallbackGeo =
    kind === 'vault'
      ? new THREE.OctahedronGeometry(worldR * 0.85, 0)
      : kind === 'convoy'
        ? new THREE.BoxGeometry(worldR * 1.8, worldR * 0.85, worldR * 1.0)
        : new THREE.CylinderGeometry(worldR * 0.75, worldR * 0.92, worldR * 1.35, 8);
  const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
  root.add(fallbackMesh);

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(worldR * 1.18, worldR * 1.38, 40),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = -0.45;
  root.add(beaconRing);

  let dangerRing: THREE.Mesh | undefined;
  let progressRing: THREE.Mesh | undefined;
  let hpBarGroup: THREE.Group | undefined;
  let hpFill: THREE.Mesh | undefined;

  if (kind === 'vault') {
    const capR = 150 * WORLD_SCALE;
    dangerRing = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(1.5, capR - 0.28), capR, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38e8ff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    dangerRing.rotation.x = -Math.PI / 2;
    dangerRing.position.y = -0.42;

    progressRing = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    progressRing.rotation.x = -Math.PI / 2;
    progressRing.position.y = -0.4;
    progressRing.scale.setScalar(worldR * 1.4);
    root.add(dangerRing, progressRing);
  } else {
    const bar = buildCompactWorldHpBar(worldR * 2.2, worldR + 2.4);
    hpBarGroup = bar.hpBarGroup;
    hpFill = bar.hpFill;
    hpBarGroup.visible = true;
    root.add(hpBarGroup);
  }

  const refs: PropVisualRefs = {
    root,
    beaconRing,
    dangerRing,
    progressRing,
    hpBarGroup,
    hpFill,
    tintMaterials: [],
    flashMaterials: [fallbackMat],
  };

  const modelId: BlenderModelId =
    kind === 'vault'
      ? 'obj_raid_vault'
      : kind === 'convoy'
        ? 'obj_raid_convoy'
        : 'obj_raid_reactor';
  whenBlenderModelReady(modelId, (asset) => {
    fallbackMesh.visible = false;
    asset.scene.scale.setScalar(worldR * 1.05);
    root.add(asset.scene);
    refs.animator = asset.animator;
    refs.flashMaterials?.push(...asset.standardMaterials);
  });

  return refs;
}

export function createWeaponModuleVisual(
  slotId: ShipSlotId,
  instanceId: string,
  weaponId: WeaponId,
  tier: 1 | 2 | 3 = 1,
  hasOuterNeighbor = false,
  faction: ManufacturerId = 'NOVACORP'
): MountedWeaponVisual {
  const slotDef = SHIP_SLOT_MAP[slotId];
  const entry = WEAPON_CATALOG[weaponId];
  const accentHex = parseInt(entry.accent.replace('#', ''), 16) || 0x38e8ff;

  const group = new THREE.Group();
  group.position.set(slotDef.mountOffset.x, slotDef.mountOffset.y, slotDef.mountOffset.z);

  const fallbackGeo =
    entry.kind === 'skill'
      ? new THREE.CylinderGeometry(0.24, 0.28, 0.34, 8)
      : new THREE.BoxGeometry(0.75, 0.22, 0.26);
  const fallbackMat = new THREE.MeshStandardMaterial({
    color: 0xd9e4f2,
    emissive: accentHex,
    emissiveIntensity: 0.45,
    metalness: 0.55,
    roughness: 0.25,
  });
  const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
  group.add(fallbackMesh);

  const visual: MountedWeaponVisual = {
    slotId,
    instanceId,
    weaponId,
    group,
    fallbackMesh,
    standardMaterials: [],
    assemblyPop: 1.0,
    lastTier: tier,
    lastHasOuter: hasOuterNeighbor,
    lastLivery: faction,
  };

  whenBlenderModelReady(entry.modelId, (asset) => {
    if (group.userData.disposed) return;
    fallbackMesh.visible = false;
    const isRight = slotId === 'wing_r1' || slotId === 'wing_r2';
    const sc = slotDef.modelScale;
    asset.scene.scale.set(sc, sc, isRight ? -sc : sc);
    applyWeaponSlotForm(asset.weaponParts, slotId, visual.lastHasOuter, visual.lastTier);
    applyFactionLiveryToMaterials(asset.standardMaterials, visual.lastLivery ?? faction);
    visual.weaponParts = asset.weaponParts;
    visual.standardMaterials = asset.standardMaterials;
    group.add(asset.scene);
    visual.animator = asset.animator;
  });

  return visual;
}

export function createCombatDroneVisual(accentHex = 0x38e8ff): PropVisualRefs {
  const root = new THREE.Group();
  const fallbackMat = new THREE.MeshStandardMaterial({
    color: 0xd9e4f2,
    emissive: accentHex,
    emissiveIntensity: 0.9,
    metalness: 0.45,
    roughness: 0.22,
  });
  const fallbackMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), fallbackMat);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.66, 0.82, 20),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  root.add(fallbackMesh, ring);

  const refs: PropVisualRefs = {
    root,
    beaconRing: ring,
    tintMaterials: [],
    flashMaterials: [fallbackMat],
  };

  whenBlenderModelReady('prop_combat_drone', (asset) => {
    fallbackMesh.visible = false;
    asset.scene.scale.setScalar(1.05);
    root.add(asset.scene);
    refs.animator = asset.animator;
    refs.flashMaterials?.push(...asset.standardMaterials);
  });

  return refs;
}

export function createRoomPortalVisual(accentHex = 0x38e8ff): PropVisualRefs {
  const root = new THREE.Group();
  const fallbackMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: accentHex,
    emissiveIntensity: 1.15,
    metalness: 0.72,
    roughness: 0.25,
  });
  const fallbackMesh = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.24, 8, 24), fallbackMat);
  fallbackMesh.rotation.x = Math.PI / 2;

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(2.55, 2.9, 40),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  root.add(fallbackMesh, beaconRing);

  const refs: PropVisualRefs = {
    root,
    beaconRing,
    tintMaterials: [],
    flashMaterials: [fallbackMat],
  };

  whenBlenderModelReady('obj_room_portal', (asset) => {
    fallbackMesh.visible = false;
    asset.scene.scale.setScalar(2.4);
    for (const mat of asset.standardMaterials) {
      if (mat.emissiveIntensity > 0.5 || /(?:Cyan|Warp|Glow)/i.test(mat.name)) {
        mat.color.setHex(accentHex);
        mat.emissive.setHex(accentHex);
      }
    }
    root.add(asset.scene);
    refs.animator = asset.animator;
  });

  return refs;
}
