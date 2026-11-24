import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  POWER_UP_CONFIG,
  WORLD_SCALE,
  arenaToWorldX,
  arenaToWorldZ,
  worldToArenaX,
  worldToArenaY,
} from '../config/constants';
import { HULL_CATALOG } from '../config/hulls';
import { countMutationStacks } from '../config/mutations';
import {
  SHIP_GRID_SLOTS,
  SHIP_SLOT_MAP,
  WEAPON_CATALOG,
  type ShipSlotId,
  type SkillWeaponCatalogEntry,
} from '../config/weapons';
import type { EventBus } from '../engine/EventBus';
import type { BossArchetype, GameState, GraphicsQuality } from '../game/types';
import {
  FACTION_LIVERY_PALETTES,
  applyFactionLiveryToMaterials,
  applyPlayerChassisMorph,
  applyStageVisibility,
  applyWeaponSlotForm,
  preloadBlenderModels,
  resolveDominantFactionLivery,
} from './AssetLoader';
import { BackdropSystem } from './BackdropSystem';
import {
  createArenaObstacleVisual,
  createBombVisual,
  createBossVisual,
  createCombatDroneVisual,
  createEnemyVisual,
  createHealthPickupVisual,
  createLeviathanSegmentVisual,
  createMineVisual,
  createPlayerVisual,
  createPowerUpVisual,
  createRaidObjectiveVisual,
  createRoomPortalVisual,
  createWeaponModuleVisual,
  type BossVisualRefs,
  type EnemyVisualRefs,
  type PlayerVisualRefs,
  type PropVisualRefs,
} from './MeshFactory';
import { createStormWallMaterial } from './shaders/gameShaders';
import { createTacticalPostPass } from './shaders/TacticalPostPass';
import { VFXSystem } from './VFXSystem';
import { metaProgression } from '../services/MetaProgressionService';

function createSpaceStudioEnvScene(): { scene: THREE.Scene; dispose: () => void } {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x050814);
  const disposables: Array<{ dispose: () => void }> = [];

  const addPanel = (
    colorHex: number,
    intensity: number,
    size: [number, number],
    pos: [number, number, number],
    lookAt: [number, number, number]
  ) => {
    const col = new THREE.Color(colorHex).multiplyScalar(intensity);
    const geo = new THREE.PlaneGeometry(size[0], size[1]);
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    env.add(mesh);
  };

  // Giant overhead softboxes so our glossy ceramic paint looks straight out of a flagship showroom
  addPanel(0xeef6ff, 3.4, [32, 8], [-12, 24, 6], [0, 0, 0]);
  addPanel(0xd8eeff, 3.0, [30, 8], [14, 22, -6], [0, 0, 0]);
  // Cyan space rim vs warm amber counter-rim — classic hero movie lighting cheat
  addPanel(0x2be4ff, 2.8, [26, 12], [-26, 6, -12], [0, 0, 0]);
  addPanel(0xff8c28, 2.5, [26, 12], [26, 5, 14], [0, 0, 0]);
  // Subtle dark-blue floor bounce so ship bellies don't vanish into total void
  addPanel(0x0c1428, 0.8, [40, 40], [0, -22, 0], [0, 0, 0]);

  return {
    scene: env,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

export class SceneManager {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly lastCameraShake = { x: 0, y: 0, z: 0 };
  public readonly lastCameraMotion = { vx: 0, vz: 0 };

  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private postPass: ShaderPass;
  private quality: GraphicsQuality = 'high';

  private backdrop: BackdropSystem;
  private vfx: VFXSystem;
  private playerVisual: PlayerVisualRefs;
  private hangarGridGroup: THREE.Group;
  private hangarSelectMarker: THREE.Mesh;
  private stormRingGroup: THREE.Group;
  private stormFloorMesh: THREE.Mesh;
  private stormWallMesh: THREE.Mesh;
  private stormWallMat!: THREE.ShaderMaterial;
  private stormTargetLine: THREE.LineLoop;
  private floatingModuleMeshes = new Map<number, THREE.Group>();
  private projVec = new THREE.Vector3();
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private fog: THREE.FogExp2;
  private lastAtmoSeed = -1;
  private playerLight: THREE.PointLight;
  private bossLight: THREE.PointLight;

  private enemyMeshes = new Map<number, EnemyVisualRefs>();
  private bombMeshes = new Map<number, PropVisualRefs>();
  private mineMeshes = new Map<number, PropVisualRefs>();
  private powerUpMeshes = new Map<number, PropVisualRefs>();
  private obstacleMeshes = new Map<number, PropVisualRefs>();
  private raidObjectiveVisual: { id: number; refs: PropVisualRefs } | null = null;
  private healthPickupMesh: PropVisualRefs;
  private bossVisual: { id: number; refs: BossVisualRefs } | null = null;
  private leviathanSegMeshes: THREE.Group[] = [];
  private geminiTwinVisual: { bossId: number; refs: BossVisualRefs } | null = null;
  private pendingBossTransform: {
    archetype: BossArchetype;
    phase: 2 | 3;
    x: number;
    y: number;
    hex: number;
  } | null = null;
  private bossYawRad = Math.PI * 0.5;
  private bossDeathBurstAccumSec = 0;

  // Pooled explosion lights so big blasts actually illuminate nearby hull plating
  private explosionLights: Array<{
    light: THREE.PointLight;
    age: number;
    peak: number;
  }> = [];

  private bulletTimeBlend = 0;
  private dronePool: PropVisualRefs[] = [];
  private droneTetherLines: THREE.Line[] = [];
  private roomPortalVisual: PropVisualRefs | null = null;
  private singularityPool: Array<{
    group: THREE.Group;
    ring: THREE.Mesh;
    core: THREE.Mesh;
  }> = [];
  private sawbladePool: THREE.Mesh[] = [];
  private sniperLaserPool: THREE.Line[] = [];
  private bomberRingPool: Array<{
    group: THREE.Group;
    fillDisc: THREE.Mesh;
  }> = [];
  private shielderArcPool: THREE.Mesh[] = [];
  private medicBeamPool: THREE.Line[] = [];
  private aimReticleGroup!: THREE.Group;
  private aimReticleRing!: THREE.Mesh;
  private aimSightLine!: THREE.Line;
  private warpTunnelGroup!: THREE.Group;
  private warpStreakMat!: THREE.MeshBasicMaterial;
  private warpStreaks: Array<{
    mesh: THREE.Mesh;
    angle: number;
    radius: number;
    z: number;
    speed: number;
  }> = [];

  // Ring buffer of screen-space shockwaves piped straight into TacticalPostPass uShocks[3]
  private shockSlots: THREE.Vector4[] = [
    new THREE.Vector4(0.5, 0.5, 1.0, 0.0),
    new THREE.Vector4(0.5, 0.5, 1.0, 0.0),
    new THREE.Vector4(0.5, 0.5, 1.0, 0.0),
  ];

  private raycaster = new THREE.Raycaster();
  private arenaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private rayHitPoint = new THREE.Vector3();
  private tempNdc = new THREE.Vector2();
  private tempProj = new THREE.Vector3();

  private camBasePos = new THREE.Vector3(0, 68, 20);
  private camLookTarget = new THREE.Vector3(0, 0, 2);
  private camPosSmooth = new THREE.Vector3(0, 68, 20);
  private camLookSmooth = new THREE.Vector3(0, 0, 2);
  private camLeadSmooth = new THREE.Vector2(0, 0);
  private camSpeedZoom = 0;
  private camInitialized = false;
  private camIntroFocus = 0;
  private elapsedSec = 0;
  private frameCounter = 0;
  private lowFpsAccumSec = 0;

  // Camera shake trauma & post-FX kick state - explosions deserve proper screen violence
  private chromaImpulse = 0;
  private damageFlash = 0;
  private hitPulse = 0;
  private shockProgress = 1.0;
  private overdriveLevel = 0;
  private overdriveColor = new THREE.Color(0xffb833);
  private tempOverdriveColor = new THREE.Color(0xffb833);
  private pendingRankUpPulse = false;

  private camTrauma = 0;
  private camKickX = 0;
  private camKickZ = 0;
  private camRollRad = 0;
  private aimReticlePulse = 0;
  private aimReticleCrit = false;
  private readonly aimIdleColor = new THREE.Color(0x38e8ff);
  private readonly aimHitColor = new THREE.Color(0xffffff);
  private readonly aimCritColor = new THREE.Color(0xffe044);
  private enemyHitPunch = new Map<number, number>();
  private lastPlayerPose = {
    x: 0,
    y: 0,
    facingAngle: 0,
    dashDirX: 1,
    dashDirY: 0,
  };

  constructor(private readonly container: HTMLElement, bus?: EventBus) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(48, width / height, 1, 560);
    this.camera.position.copy(this.camBasePos);
    this.camera.lookAt(this.camLookTarget);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // AgX tonemapping + sRGB encoding run once inside TacticalPostPass - never double-bake colors
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.renderer.domElement.id = 'gameWebGLCanvas';
    container.appendChild(this.renderer.domElement);

    // Baked high-contrast space-studio reflections so white ceramic and gold trim actually pop
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envStudio = createSpaceStudioEnvScene();
    this.scene.environment = pmrem.fromScene(envStudio.scene, 0.03).texture;
    this.scene.environmentIntensity = 1.05;
    envStudio.dispose();
    pmrem.dispose();

    // Studio 3-point rig plus sector mood fog (enough haze for depth, never space soup)
    this.fog = new THREE.FogExp2(0x040814, 0.0017);
    this.scene.fog = this.fog;

    this.hemiLight = new THREE.HemisphereLight(0xaad4ff, 0x0c1020, 1.15);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xf6f9ff, 1.65);
    this.keyLight.position.set(18, 52, 24);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xff8c2a, 0.68);
    this.rimLight.position.set(-34, 22, -26);
    this.scene.add(this.rimLight);

    this.playerLight = new THREE.PointLight(0x38e0ff, 1.65, 22, 1.6);
    this.playerLight.position.set(0, 3, 0);
    this.scene.add(this.playerLight);

    this.bossLight = new THREE.PointLight(0xff3344, 0, 44, 1.4);
    this.scene.add(this.bossLight);

    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xff7722, 0, 34, 1.6);
      this.scene.add(pl);
      this.explosionLights.push({ light: pl, age: 10, peak: 0 });
    }

    // Post-FX chain: RenderPass -> Bloom -> TacticalPostPass (AgX, shockwaves, CA, grain, dither)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.4, 0.65);
    this.composer.addPass(this.bloomPass);

    this.postPass = createTacticalPostPass();
    this.postPass.uniforms.uResolution.value.set(width, height);
    this.composer.addPass(this.postPass);

    // Spin up the backdrop, arena deck, and particle fireworks
    preloadBlenderModels();
    this.backdrop = new BackdropSystem();
    this.scene.add(this.backdrop.group);

    this.vfx = new VFXSystem();
    this.scene.add(this.vfx.group);

    this.playerVisual = createPlayerVisual();
    this.scene.add(this.playerVisual.root);

    this.hangarGridGroup = this.createHangarDockGroup();
    this.hangarGridGroup.visible = false;
    this.scene.add(this.hangarGridGroup);

    this.hangarSelectMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.045, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.92 })
    );
    this.hangarSelectMarker.rotation.x = Math.PI / 2;
    this.hangarSelectMarker.visible = false;
    this.playerVisual.weaponMountGroup.add(this.hangarSelectMarker);

    const stormBuilt = this.createStormRingGroup();
    this.stormRingGroup = stormBuilt.group;
    this.stormFloorMesh = stormBuilt.floor;
    this.stormWallMesh = stormBuilt.wall;
    this.stormTargetLine = stormBuilt.targetLine;
    this.stormRingGroup.visible = false;
    this.scene.add(this.stormRingGroup);

    this.healthPickupMesh = createHealthPickupVisual();
    this.healthPickupMesh.root.visible = false;
    this.scene.add(this.healthPickupMesh.root);

    this.initTacticalPools();

    if (bus) {
      bus.on('PLAYER_SHOOT', ({ piercing }) => {
        const { x, y, facingAngle } = this.lastPlayerPose;
        const dirX = Math.cos(facingAngle);
        const dirY = Math.sin(facingAngle);
        this.addCameraKick(-dirX, -dirY, piercing ? 0.28 : 0.09);
        this.addTrauma(piercing ? 0.14 : 0.045);
        this.vfx.spawnMuzzleBurst(
          x + dirX * 22,
          y + dirY * 22,
          facingAngle,
          piercing ? 0xffe066 : 0x48f0ff,
          piercing
        );
      });
      bus.on('ENEMY_HIT', ({ x, y, isCrit, nx, ny }) => {
        this.vfx.spawnHitSparks(x, y, isCrit ? 0xffee44 : 0x48e8ff, isCrit, nx, ny);
        this.aimReticlePulse = isCrit ? 1.0 : Math.max(this.aimReticlePulse, 0.55);
        if (isCrit) {
          this.aimReticleCrit = true;
          this.addTrauma(0.18);
          this.hitPulse = Math.max(this.hitPulse, 0.55);
          this.spawnExplosionLight(x, y, 0xffe455, 8.5);
        } else if (this.aimReticlePulse <= 0.6) {
          this.aimReticleCrit = false;
        }
      });
      bus.on('ENEMY_KILLED', ({ x, y, type, isMinion, color }) => {
        this.aimReticlePulse = 1.0;
        const hex = new THREE.Color(color).getHex();
        if (isMinion || type === 'small') {
          this.vfx.spawnExplosion(x, y, 'small', hex);
          this.spawnExplosionLight(x, y, hex, 7.5);
          this.hitPulse = Math.max(this.hitPulse, 0.38);
          this.addTrauma(0.14);
        } else if (type === 'medium') {
          this.vfx.spawnExplosion(x, y, 'medium', hex);
          this.spawnExplosionLight(x, y, hex, 12.0);
          this.hitPulse = Math.max(this.hitPulse, 0.38);
          this.addTrauma(0.24);
        } else {
          this.vfx.spawnExplosion(x, y, 'heavy', hex);
          this.spawnExplosionLight(x, y, hex, 17.0);
          this.triggerShockwaveRipple(x, y, 0.48);
          this.backdrop.triggerFloorPulse(x, y);
          this.hitPulse = Math.max(this.hitPulse, 0.85);
          this.addTrauma(0.44);
        }
      });
      bus.on('BOMB_EXPLODED', ({ x, y }) => {
        this.vfx.spawnExplosion(x, y, 'heavy', 0x2be4ff);
        this.spawnExplosionLight(x, y, 0x2be4ff, 22.0);
        this.triggerShockwaveRipple(x, y, 1.05);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.85);
        this.hitPulse = Math.max(this.hitPulse, 0.68);
        this.addTrauma(0.38);
      });
      bus.on('BOSS_DEFEATED', ({ archetype, x, y }) => {
        const bossColors = [0xff4422, 0xd946ef, 0xffcc22, 0x10f5a8, 0x38e8ff, 0xff8c1a];
        const bossHex = bossColors[archetype] ?? 0xffcc22;
        this.vfx.spawnExplosion(x, y, 'boss', bossHex);
        this.spawnExplosionLight(x, y, bossHex, 30.0);
        this.triggerShockwaveRipple(x, y, 1.35);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = 1.0;
        this.hitPulse = 1.0;
        this.addTrauma(0.88);
      });
      bus.on('BOSS_ENTRY_IMPACT', ({ x, y, hex }) => {
        this.vfx.spawnExplosion(x, y, 'heavy', hex);
        this.spawnExplosionLight(x, y, hex, 32.0);
        this.triggerShockwaveRipple(x, y, 1.25);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.95);
        this.hitPulse = Math.max(this.hitPulse, 0.8);
        this.addTrauma(0.75);
        if (this.bossVisual) {
          this.bossVisual.refs.phaseShiftTimerSec = 0.95;
        }
      });
      bus.on('BOSS_PHASE_CHANGED', ({ archetype, phase, x, y, hex }) => {
        const bossHex = hex || this.bossLight.color.getHex() || 0xff6633;
        this.vfx.spawnExplosion(x, y, 'heavy', bossHex);
        this.spawnExplosionLight(x, y, bossHex, phase === 3 ? 28.0 : 22.0);
        this.triggerShockwaveRipple(x, y, phase === 3 ? 1.15 : 0.9);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = Math.max(this.chromaImpulse, phase === 3 ? 0.85 : 0.68);
        this.addTrauma(0.6);
        this.pendingBossTransform = { archetype, phase, x, y, hex: bossHex };
        const shiftClip: 'ShiftToForm2' | 'ShiftToForm3' =
          phase === 3 ? 'ShiftToForm3' : 'ShiftToForm2';
        const durSec = phase === 3 ? 2.0 : 1.75;
        if (this.bossVisual) {
          this.bossVisual.refs.phaseShiftTimerSec = durSec;
          this.bossVisual.refs.activeShiftClip = shiftClip;
          this.bossVisual.refs.forceShiftRestart = true;
        }
        if (this.geminiTwinVisual) {
          this.geminiTwinVisual.refs.phaseShiftTimerSec = durSec;
          this.geminiTwinVisual.refs.activeShiftClip = shiftClip;
          this.geminiTwinVisual.refs.forceShiftRestart = true;
        }
      });
      bus.on('PLAYER_HIT', ({ shielded }) => {
        this.chromaImpulse = Math.max(this.chromaImpulse, shielded ? 0.4 : 0.95);
        this.addTrauma(shielded ? 0.3 : 0.68);
        if (!shielded) {
          this.damageFlash = 1.0;
        }
      });
      bus.on('PLAYER_DASH', ({ x, y }) => {
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.32);
        this.addTrauma(0.16);
        this.addCameraKick(-this.lastPlayerPose.dashDirX, -this.lastPlayerPose.dashDirY, 0.48);
        this.vfx.spawnPickupPop(x, y, 0x38f8ff, false);
      });
      bus.on('SKILL_RAILBEAM', ({ x, y }) => {
        this.spawnExplosionLight(x, y, 0x38f0ff, 26.0);
        this.triggerShockwaveRipple(x, y, 0.85);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.72);
        this.hitPulse = Math.max(this.hitPulse, 0.72);
        this.addTrauma(0.45);
      });
      bus.on('SKILL_EMP', ({ x, y }) => {
        this.vfx.spawnExplosion(x, y, 'heavy', 0x44f0ff);
        this.spawnExplosionLight(x, y, 0x44f0ff, 26.0);
        this.triggerShockwaveRipple(x, y, 1.15);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.8);
        this.hitPulse = Math.max(this.hitPulse, 0.78);
        this.addTrauma(0.48);
      });
      bus.on('PLAYER_GRAZE', ({ x, y }) => {
        this.vfx.spawnHitSparks(x, y, 0x55ffff, true);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.25);
      });
      bus.on('COMBO_RANK_UP', ({ rank }) => {
        this.chromaImpulse = Math.max(
          this.chromaImpulse,
          rank === 'SSS' || rank === 'SS' ? 0.55 : 0.34
        );
        this.pendingRankUpPulse = true;
      });
      bus.on('WAVE_CLEARED', () => {
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.28);
      });
      bus.on('BARREL_EXPLODED', ({ x, y }) => {
        this.vfx.spawnExplosion(x, y, 'heavy', 0xff6b2b);
        this.spawnExplosionLight(x, y, 0xff6b2b, 24.0);
        this.triggerShockwaveRipple(x, y, 0.95);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.65);
        this.hitPulse = Math.max(this.hitPulse, 0.72);
        this.addTrauma(0.5);
      });
      bus.on('ASTEROID_SHATTERED', ({ x, y }) => {
        this.vfx.spawnExplosion(x, y, 'medium', 0x67e8f9);
        this.spawnExplosionLight(x, y, 0x67e8f9, 12.0);
        this.addTrauma(0.2);
      });
      bus.on('PLAYER_PARRY', ({ x, y }) => {
        this.vfx.spawnExplosion(x, y, 'medium', 0x38f8ff);
        this.vfx.spawnHitSparks(x, y, 0x38e8ff, true);
        this.spawnExplosionLight(x, y, 0x38e8ff, 20.0);
        this.triggerShockwaveRipple(x, y, 0.72);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.55);
        this.hitPulse = 1.0;
        this.addTrauma(0.46);
      });
      bus.on('PLAYER_EXECUTE', ({ x, y }) => {
        this.vfx.spawnExplosion(x, y, 'medium', 0xfbbf24);
        this.spawnExplosionLight(x, y, 0xfbbf24, 18.0);
        this.triggerShockwaveRipple(x, y, 0.55);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.45);
        this.hitPulse = Math.max(this.hitPulse, 0.7);
        this.addTrauma(0.38);
      });
      bus.on('THERMAL_PURGE', ({ x, y }) => {
        this.vfx.spawnExplosion(x, y, 'heavy', 0xff8c2a);
        this.spawnExplosionLight(x, y, 0xff8c2a, 24.0);
        this.triggerShockwaveRipple(x, y, 0.9);
        this.backdrop.triggerFloorPulse(x, y);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.6);
        this.hitPulse = Math.max(this.hitPulse, 0.75);
        this.addTrauma(0.45);
      });
      bus.on('ELEMENTAL_COMBO', ({ kind, x, y }) => {
        const hex = kind === 'shatter' ? 0xff7b29 : kind === 'arc_chain' ? 0x38e8ff : 0xd946ef;
        this.vfx.spawnExplosion(x, y, 'medium', hex);
        this.spawnExplosionLight(x, y, hex, 18.0);
        this.triggerShockwaveRipple(x, y, 0.65);
        this.hitPulse = Math.max(this.hitPulse, 0.52);
        this.addTrauma(0.32);
      });
      bus.on('GOLD_COLLECTED', ({ x, y }) => {
        this.vfx.spawnPickupPop(x, y, 0xffd744, false);
      });
      bus.on('POWERUP_COLLECTED', ({ x, y }) => {
        this.vfx.spawnPickupPop(x, y, 0x38f288, true);
        this.hitPulse = Math.max(this.hitPulse, 0.45);
      });
      bus.on('MODULE_COLLECTED', ({ x, y }) => {
        this.vfx.spawnPickupPop(x, y, 0x38f288, true);
        this.hitPulse = Math.max(this.hitPulse, 0.45);
      });
      bus.on('LEVEL_UP', () => {
        const { x, y } = this.lastPlayerPose;
        this.vfx.spawnPickupPop(x, y, 0xfbbf24, true);
        this.spawnExplosionLight(x, y, 0xfbbf24, 22.0);
        this.triggerShockwaveRipple(x, y, 0.62);
        this.hitPulse = 0.85;
      });
      bus.on('RAID_OBJECTIVE_COMPLETED', () => {
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.52);
        this.hitPulse = Math.max(this.hitPulse, 0.65);
      });
    }

    this.updateCameraFraming(width, height);
    window.addEventListener('resize', this.handleResize);
  }

  private addTrauma(amount: number): void {
    this.camTrauma = Math.min(1.0, this.camTrauma + amount);
  }

  private addCameraKick(arenaDirX: number, arenaDirY: number, strength: number): void {
    const nextX = this.camKickX + arenaDirX * strength;
    const nextZ = this.camKickZ + arenaDirY * strength;
    const mag = Math.hypot(nextX, nextZ);
    const maxKick = 1.35;
    if (mag > maxKick) {
      const scale = maxKick / mag;
      this.camKickX = nextX * scale;
      this.camKickZ = nextZ * scale;
    } else {
      this.camKickX = nextX;
      this.camKickZ = nextZ;
    }
  }

  private spawnExplosionLight(arenaX: number, arenaY: number, hex: number, peak: number): void {
    let target = this.explosionLights.find((e) => e.light.intensity <= 0.05);
    if (!target) {
      target = this.explosionLights.reduce((dim, cur) =>
        cur.light.intensity < dim.light.intensity ? cur : dim
      );
    }
    target.light.position.set(arenaToWorldX(arenaX), 3.4, arenaToWorldZ(arenaY));
    target.light.color.setHex(hex);
    target.light.intensity = peak;
    target.peak = peak;
    target.age = 0;
  }

  private triggerShockwaveRipple(arenaX: number, arenaY: number, strength = 1.0): void {
    this.tempProj.set(arenaToWorldX(arenaX), 0.5, arenaToWorldZ(arenaY));
    this.tempProj.project(this.camera);
    const u = Math.max(0.05, Math.min(0.95, this.tempProj.x * 0.5 + 0.5));
    const v = Math.max(0.05, Math.min(0.95, this.tempProj.y * 0.5 + 0.5));
    this.postPass.uniforms.uShockOriginUv.value.set(u, v);
    this.shockProgress = 0.0;

    let slot = this.shockSlots.find((s) => s.z >= 0.99);
    if (!slot) {
      slot = this.shockSlots.reduce((oldest, cur) => (cur.z > oldest.z ? cur : oldest));
    }
    slot.set(u, v, 0.0, strength);
  }

  getQuality(): GraphicsQuality {
    return this.quality;
  }

  setQuality(q: GraphicsQuality): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    if (q === 'high') {
      this.renderer.setPixelRatio(Math.min(dpr, 2));
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.5;
    } else if (q === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.4));
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.bloomPass.enabled = false;
    } else {
      this.renderer.setPixelRatio(1);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.bloomPass.enabled = false;
    }
    this.handleResize();
  }

  screenToArena(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.tempNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.tempNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.tempNdc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.arenaPlane, this.rayHitPoint);
    if (!hit) return null;
    return {
      x: worldToArenaX(this.rayHitPoint.x),
      y: worldToArenaY(this.rayHitPoint.z),
    };
  }

  projectToScreen(
    arenaX: number,
    arenaY: number,
    yOffset = 1.6
  ): { x: number; y: number; visible: boolean } {
    this.tempProj.set(arenaToWorldX(arenaX), yOffset, arenaToWorldZ(arenaY));
    this.tempProj.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (this.tempProj.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-this.tempProj.y * 0.5 + 0.5) * rect.height + rect.top,
      visible: this.tempProj.z >= -1 && this.tempProj.z <= 1,
    };
  }

  render(state: GameState, frameDt: number, currentFps: number): void {
    this.elapsedSec += frameDt;
    this.frameCounter++;

    if (state.phase === 'PLAYING' && this.quality === 'high') {
      if (currentFps > 0 && currentFps < 36) {
        this.lowFpsAccumSec += frameDt;
        if (this.lowFpsAccumSec > 3.5) {
          this.setQuality('low');
          this.lowFpsAccumSec = 0;
        }
      } else {
        this.lowFpsAccumSec = Math.max(0, this.lowFpsAccumSec - frameDt);
      }
    }

    // Bleed off post-FX trauma, active shockwave rings, and fading blast lights
    this.chromaImpulse = Math.max(0, this.chromaImpulse - frameDt * 2.8);
    this.damageFlash = Math.max(0, this.damageFlash - frameDt * 3.2);
    this.hitPulse = Math.max(0, this.hitPulse - frameDt * 8.5);
    this.aimReticlePulse = Math.max(0, this.aimReticlePulse - frameDt * 7.5);
    if (this.shockProgress < 1.0) {
      this.shockProgress = Math.min(1.0, this.shockProgress + frameDt * 1.9);
    }
    for (const s of this.shockSlots) {
      if (s.z < 1.0) {
        s.z = Math.min(1.0, s.z + frameDt * 1.75);
      }
    }
    for (const el of this.explosionLights) {
      if (el.light.intensity > 0.02) {
        el.age += frameDt;
        el.light.intensity = el.peak * Math.exp(-el.age * 7.8);
      } else {
        el.light.intensity = 0;
      }
    }

    if (this.pendingRankUpPulse) {
      this.pendingRankUpPulse = false;
      this.backdrop.triggerFloorPulse(state.player.x, state.player.y);
      this.vfx.spawnHitSparks(state.player.x, state.player.y, 0xffee55, true);
    }

    let targetOverdrive = 0;
    let targetOverdriveHex = 0xffb833;
    if (state.phase === 'PLAYING') {
      const k = state.combo.kills;
      if (k >= 25) {
        targetOverdrive = 1.0;
        targetOverdriveHex = 0xff4477;
      } else if (k >= 18) {
        targetOverdrive = 0.78;
        targetOverdriveHex = 0x66f0ff;
      } else if (k >= 13) {
        targetOverdrive = 0.58;
        targetOverdriveHex = 0xffdd44;
      } else if (k >= 9) {
        targetOverdrive = 0.34;
        targetOverdriveHex = 0xff8833;
      }
    }
    this.overdriveLevel += (targetOverdrive - this.overdriveLevel) * Math.min(1, frameDt * 5.5);
    this.tempOverdriveColor.setHex(targetOverdriveHex);
    this.overdriveColor.lerp(this.tempOverdriveColor, Math.min(1, frameDt * 6.0));
    const targetBulletTime =
      state.phase === 'PLAYING' && state.player.chronoActiveMs > 0 ? 1.0 : 0.0;
    this.bulletTimeBlend +=
      (targetBulletTime - this.bulletTimeBlend) * Math.min(1, frameDt * 12.0);

    if (state.sectorMap.seed !== this.lastAtmoSeed) {
      this.lastAtmoSeed = state.sectorMap.seed;
      const atmo = state.sectorMap.atmosphere;
      this.fog.color.setHex(atmo.fogHex);
      this.fog.density = atmo.fogDensity;
      this.hemiLight.color.setHex(atmo.hemiSkyHex);
      this.rimLight.color.setHex(atmo.rimLightHex);
    }

    this.backdrop.update(state, this.elapsedSec, frameDt);
    this.syncPlayer(state, frameDt);
    this.syncEnemies(state, frameDt);
    this.syncBoss(state, frameDt);
    this.syncBombs(state, frameDt);
    this.syncMines(state, frameDt);
    this.syncPickups(state, frameDt);
    this.syncRaidWorldObjects(state, frameDt);
    this.syncV19WorldObjects(state, frameDt);
    const warpBell = state.warpTransition.active
      ? Math.sin(
          Math.PI *
            Math.min(1, state.warpTransition.elapsedMs / Math.max(1, state.warpTransition.durationMs))
        )
      : 0;
    this.updateWarpTunnel(state, warpBell, frameDt);
    this.vfx.update(state, this.elapsedSec, frameDt);
    this.updateDynamicCamera(state, frameDt);

    if (this.quality === 'low') {
      this.renderer.render(this.scene, this.camera);
    } else {
      const hpRatio = state.player.health / Math.max(1, state.player.maxHealth);
      const lowHpPulse =
        state.phase === 'PLAYING' && hpRatio <= 0.3
          ? 0.55 + Math.sin(this.elapsedSec * 9.5) * 0.45
          : 0;

      this.postPass.uniforms.uFrame.value = this.frameCounter;
      this.postPass.uniforms.uTime.value = this.elapsedSec;
      this.postPass.uniforms.uChromaStrength.value =
        this.chromaImpulse + Math.min(0.45, state.screenShake * 0.02);
      this.postPass.uniforms.uDamageFlash.value = this.damageFlash;
      this.postPass.uniforms.uHitPulse.value = this.hitPulse;
      this.postPass.uniforms.uLowHpPulse.value = lowHpPulse;
      this.postPass.uniforms.uOverdrive.value = this.overdriveLevel;
      (this.postPass.uniforms.uOverdriveColor.value as THREE.Color).copy(this.overdriveColor);
      this.postPass.uniforms.uBulletTime.value = this.bulletTimeBlend;
      this.postPass.uniforms.uWarpSpeed.value = warpBell;
      this.postPass.uniforms.uShockProgress.value = this.shockProgress;
      this.postPass.uniforms.uShocks.value = this.shockSlots;

      this.composer.render();
    }
  }

  private createHangarDockGroup(): THREE.Group {
    const g = new THREE.Group();
    g.position.set(0, -0.45, 0);

    const grid = new THREE.GridHelper(12, 12, 0x38e8ff, 0x102848);
    const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const m of mats) {
      m.transparent = true;
      m.opacity = 0.28;
    }
    g.add(grid);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(4.65, 4.92, 48),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.02;
    g.add(outerRing);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(2.85, 2.98, 36),
      new THREE.MeshBasicMaterial({
        color: 0xff8c2a,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.04;
    g.add(innerRing);

    return g;
  }

  private createStormRingGroup(): {
    group: THREE.Group;
    floor: THREE.Mesh;
    wall: THREE.Mesh;
    targetLine: THREE.LineLoop;
  } {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1.015, 96),
      new THREE.MeshBasicMaterial({
        color: 0x38e8ff,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.08;

    this.stormWallMat = createStormWallMaterial();
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 7.0, 96, 1, true),
      this.stormWallMat
    );
    wall.position.y = 3.2;

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), 0.15, Math.sin(a)));
    }
    const targetLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
      })
    );

    g.add(floor, wall, targetLine);
    return { group: g, floor, wall, targetLine };
  }

  /** Maps each ship hardpoint from 3D world space to screen pixels for drag-and-drop UI sockets. */
  projectShipHardpoints(
    _state: GameState
  ): Array<{ id: ShipSlotId | 'CORE'; x: number; y: number }> {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const out: Array<{ id: ShipSlotId | 'CORE'; x: number; y: number }> = [];
    this.playerVisual.weaponMountGroup.updateWorldMatrix(true, false);

    const projectLocal = (id: ShipSlotId | 'CORE', lx: number, ly: number, lz: number) => {
      this.projVec.set(lx, ly, lz);
      this.playerVisual.weaponMountGroup.localToWorld(this.projVec);
      this.projVec.project(this.camera);
      out.push({
        id,
        x: rect.left + (this.projVec.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-this.projVec.y * 0.5 + 0.5) * rect.height,
      });
    };

    for (const slot of SHIP_GRID_SLOTS) {
      projectLocal(slot.id, slot.socketUiOffset.x, slot.socketUiOffset.y, slot.socketUiOffset.z);
    }
    return out;
  }

  projectArenaPointToViewport(ax: number, ay: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.projVec.set(arenaToWorldX(ax), 0.75, arenaToWorldZ(ay));
    this.projVec.project(this.camera);
    return {
      x: rect.left + (this.projVec.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-this.projVec.y * 0.5 + 0.5) * rect.height,
    };
  }

  private syncPlayerWeaponModules(state: GameState, frameDt: number): void {
    const p = state.player;
    const isHangar = state.phase === 'SHOP';
    const mountedCount = Object.values(p.loadout.slots).filter(Boolean).length;
    const dominantFaction =
      mountedCount <= 1
        ? (HULL_CATALOG[p.hullId]?.livery ?? resolveDominantFactionLivery(state))
        : resolveDominantFactionLivery(state);
    const slots = p.loadout.slots;
    const hasOuterL = Boolean(slots.wing_l2);
    const hasOuterR = Boolean(slots.wing_r2);
    const lv = state.shop.levels;

    const chassisKey = [
      slots.nose ? 1 : 0,
      slots.wing_l1 ? 1 : 0,
      slots.wing_r1 ? 1 : 0,
      hasOuterL ? 1 : 0,
      hasOuterR ? 1 : 0,
      slots.skill_1 ? 1 : 0,
      (lv.maxHealth ?? 0) + (lv.regen ?? 0),
      lv.maxHealth ?? 0,
      lv.regen ?? 0,
      (lv.energyUpgrade ?? 0) + (lv.speedBoost ?? 0) + (lv.dashCooldown ?? 0),
      lv.dashCooldown ?? 0,
      lv.speedBoost ?? 0,
      lv.shield ?? 0,
      lv.cryoCooler ?? 0,
      (lv.luck ?? 0) + (lv.magnet ?? 0) + (lv.greed ?? 0),
    ].join('|');

    if (this.playerVisual.chassisBuckets && this.playerVisual.lastChassisKey !== chassisKey) {
      if (this.playerVisual.lastChassisKey !== undefined) {
        this.playerVisual.hullAssemblyPop = 1.0;
      }
      const res = applyPlayerChassisMorph(this.playerVisual.chassisBuckets, state);
      this.playerVisual.activeEngineTier = res.engineTier;
      this.playerVisual.lastChassisKey = chassisKey;
    }

    if (this.playerVisual.standardMaterials.length > 0 && this.playerVisual.lastLivery !== dominantFaction) {
      applyFactionLiveryToMaterials(this.playerVisual.standardMaterials, dominantFaction);
      if (this.playerVisual.lastLivery !== undefined) {
        this.playerVisual.hullAssemblyPop = 1.0;
      }
      this.playerVisual.lastLivery = dominantFaction;
    }
    this.playerVisual.hullAssemblyPop = Math.max(0, this.playerVisual.hullAssemblyPop - frameDt * 5.2);

    for (const slotDef of SHIP_GRID_SLOTS) {
      const mounted = p.loadout.slots[slotDef.id];
      const existing = this.playerVisual.mountedMeshes[slotDef.id];

      if (!mounted) {
        if (existing) {
          existing.group.userData.disposed = true;
          this.playerVisual.weaponMountGroup.remove(existing.group);
          existing.fallbackMesh.geometry.dispose();
          (existing.fallbackMesh.material as THREE.Material).dispose();
          delete this.playerVisual.mountedMeshes[slotDef.id];
        }
        continue;
      }

      const hasOuter =
        (slotDef.id === 'wing_l1' && hasOuterL) || (slotDef.id === 'wing_r1' && hasOuterR);

      let visual = existing;
      if (!visual || visual.instanceId !== mounted.instanceId) {
        if (existing) {
          existing.group.userData.disposed = true;
          this.playerVisual.weaponMountGroup.remove(existing.group);
          existing.fallbackMesh.geometry.dispose();
          (existing.fallbackMesh.material as THREE.Material).dispose();
        }
        visual = createWeaponModuleVisual(
          slotDef.id,
          mounted.instanceId,
          mounted.weaponId,
          mounted.tier,
          hasOuter,
          dominantFaction
        );
        this.playerVisual.mountedMeshes[slotDef.id] = visual;
        this.playerVisual.weaponMountGroup.add(visual.group);
      }

      if (visual.weaponParts && (visual.lastTier !== mounted.tier || visual.lastHasOuter !== hasOuter)) {
        applyWeaponSlotForm(visual.weaponParts, slotDef.id, hasOuter, mounted.tier);
        if (visual.lastTier !== mounted.tier) {
          visual.assemblyPop = 1.0;
        }
      }
      visual.lastTier = mounted.tier;
      visual.lastHasOuter = hasOuter;

      if (visual.standardMaterials.length > 0 && visual.lastLivery !== dominantFaction) {
        applyFactionLiveryToMaterials(visual.standardMaterials, dominantFaction);
      }
      visual.lastLivery = dominantFaction;

      visual.assemblyPop = Math.max(0, visual.assemblyPop - frameDt * 5.2);
      const popScale = 1 + visual.assemblyPop * 0.14;
      visual.group.scale.setScalar(popScale);

      // Bolt weapons tight to the bulkhead (0.025 max recoil kick so barrels don't fly off mid-fight)
      const recoilJitter = slotDef.kind === 'primary' ? mounted.recoil * 0.025 : 0;
      visual.group.position.set(
        slotDef.mountOffset.x - recoilJitter,
        slotDef.mountOffset.y,
        slotDef.mountOffset.z
      );

      if (visual.animator) {
        let shouldAttack = mounted.recoil > 0.16;
        let animRate = 2.2;
        if (mounted.weaponId === 'thermal_sink') {
          const heatRatio = p.maxHeat > 0 ? p.heat / p.maxHeat : 0;
          shouldAttack =
            p.isOverloaded || heatRatio >= 0.45 || (isHangar && p.loadout.selectedSlot === slotDef.id);
          animRate = p.isOverloaded ? 2.4 : isHangar ? 1.4 : 1.75;
        } else if (slotDef.kind === 'skill') {
          const entry = WEAPON_CATALOG[mounted.weaponId] as SkillWeaponCatalogEntry;
          shouldAttack =
            p.skill.mode === entry.skillMode && state.simTimeMs - p.skill.lastUseMs < 750;
          if (isHangar && p.loadout.selectedSlot === slotDef.id) {
            shouldAttack = true;
            animRate = 1.4;
          }
        } else if (isHangar && p.loadout.selectedSlot === slotDef.id) {
          shouldAttack = true;
          animRate = 1.35;
        }
        visual.animator.play(shouldAttack ? 'Attack' : 'Idle', shouldAttack ? animRate : 1.0);
        visual.animator.update(frameDt);
      }
    }
  }

  private syncPlayer(state: GameState, frameDt: number): void {
    const p = state.player;
    this.lastPlayerPose.x = p.x;
    this.lastPlayerPose.y = p.y;
    this.lastPlayerPose.facingAngle = p.facingAngle;
    this.lastPlayerPose.dashDirX = p.dashDirX;
    this.lastPlayerPose.dashDirY = p.dashDirY;
    if (state.phase === 'MENU') {
      const selectedHull = metaProgression.getProfile().selectedHull;
      p.hullId = selectedHull;
      this.playerVisual.root.visible = true;
      this.playerLight.visible = true;
      this.syncPlayerWeaponModules(state, frameDt);

      const menuHex = HULL_CATALOG[selectedHull]?.accentHex ?? 0x38e8ff;
      this.hangarGridGroup.visible = true;
      this.hangarGridGroup.position.set(0, -0.35, 0);
      this.hangarGridGroup.rotation.y = this.elapsedSec * 0.22;
      this.hangarSelectMarker.visible = false;
      this.playerVisual.shieldMesh.visible = false;

      this.playerVisual.root.position.set(0, 0.72 + Math.sin(this.elapsedSec * 1.9) * 0.14, 0);
      this.playerVisual.root.rotation.y = Math.PI * 0.28 + this.elapsedSec * 0.36;
      this.playerVisual.shipTilt.rotation.x = Math.sin(this.elapsedSec * 1.1) * 0.08;
      this.playerVisual.shipTilt.scale.setScalar(1.18);

      if (this.playerVisual.animator) {
        this.playerVisual.animator.play('Idle', 1.0);
        this.playerVisual.animator.update(frameDt);
      }

      const flicker = 0.88 + Math.sin(this.elapsedSec * 42) * 0.12;
      this.playerVisual.thrusterLeft.scale.set(0.55 * flicker, 0.86, 0.86);
      this.playerVisual.thrusterRight.scale.set(0.55 * flicker, 0.86, 0.86);
      this.playerVisual.thrusterMat.uniforms.uTime.value = this.elapsedSec;
      this.playerVisual.thrusterMat.uniforms.uDash.value = 0.0;
      this.playerVisual.coreMat.emissive.setHex(menuHex);
      this.playerVisual.coreMat.emissiveIntensity = 1.5 + Math.sin(this.elapsedSec * 4.5) * 0.35;
      this.playerLight.position.set(0, 4.6, 2.4);
      this.playerLight.color.setHex(menuHex);
      return;
    }

    this.playerVisual.root.visible = true;
    this.playerLight.visible = true;
    const wx = arenaToWorldX(p.x);
    const wz = arenaToWorldZ(p.y);
    this.syncPlayerWeaponModules(state, frameDt);

    const mountedCount = Object.values(p.loadout.slots).filter(Boolean).length;
    const dominantFaction =
      mountedCount <= 1
        ? (HULL_CATALOG[p.hullId]?.livery ?? resolveDominantFactionLivery(state))
        : resolveDominantFactionLivery(state);
    const factionGlowHex =
      mountedCount <= 1
        ? (HULL_CATALOG[p.hullId]?.accentHex ?? FACTION_LIVERY_PALETTES[dominantFaction].glowHex)
        : FACTION_LIVERY_PALETTES[dominantFaction].glowHex;
    const engineTier = this.playerVisual.activeEngineTier ?? 0;
    const engineWidthBoost = engineTier === 0 ? 0.68 : 1 + engineTier * 0.16;
    const engineLenBoost = engineTier === 0 ? 0.64 : 1 + engineTier * 0.12;
    const hullPop = 1 + this.playerVisual.hullAssemblyPop * 0.06;

    if (state.phase === 'SHOP') {
      this.hangarGridGroup.visible = true;
      this.hangarGridGroup.position.set(wx, 0, wz);
      this.hangarGridGroup.rotation.y = this.elapsedSec * 0.16;

      this.playerVisual.root.position.set(wx, 0.55 + Math.sin(this.elapsedSec * 2.2) * 0.10, wz);
      this.playerVisual.root.rotation.y = Math.PI * 0.5 + Math.sin(this.elapsedSec * 0.38) * 0.08;
      this.playerVisual.shipTilt.rotation.x = Math.sin(this.elapsedSec * 0.75) * 0.05;
      this.playerVisual.shipTilt.scale.set(hullPop, hullPop, hullPop);
      this.playerVisual.shieldMesh.visible = false;

      if (this.playerVisual.animator) {
        this.playerVisual.animator.play('Idle', 1.0);
        this.playerVisual.animator.update(frameDt);
      }

      const flicker = 0.88 + Math.sin(this.elapsedSec * 40) * 0.12;
      this.playerVisual.thrusterLeft.scale.set(0.45 * flicker * engineLenBoost, 0.82 * engineWidthBoost, 0.82 * engineWidthBoost);
      this.playerVisual.thrusterRight.scale.set(0.45 * flicker * engineLenBoost, 0.82 * engineWidthBoost, 0.82 * engineWidthBoost);
      this.playerVisual.thrusterMat.uniforms.uTime.value = this.elapsedSec;
      this.playerVisual.thrusterMat.uniforms.uDash.value = 0.0;

      // Hologram reticle tracks whichever hardpoint the pilot is poking at in the Hangar
      this.hangarSelectMarker.visible = true;
      const sel = p.loadout.selectedSlot;
      const markerMat = this.hangarSelectMarker.material as THREE.MeshBasicMaterial;
      if (sel === 'CORE') {
        this.hangarSelectMarker.position.set(0, 0.55, 0);
        markerMat.color.setHex(0xffb833);
      } else {
        const sDef = SHIP_SLOT_MAP[sel];
        this.hangarSelectMarker.position.set(
          sDef.socketUiOffset.x,
          sDef.socketUiOffset.y,
          sDef.socketUiOffset.z
        );
        markerMat.color.setHex(sDef.kind === 'skill' ? 0xc084fc : 0x38e8ff);
      }
      const pulse = 0.92 + Math.sin(this.elapsedSec * 6.5) * 0.16;
      this.hangarSelectMarker.scale.setScalar(pulse);
      this.hangarSelectMarker.rotation.z = this.elapsedSec * 1.4;

      this.playerLight.position.set(wx, 5.4, wz + 2.2);
      this.playerLight.color.setHex(factionGlowHex);
      return;
    }

    this.hangarGridGroup.visible = false;
    this.hangarSelectMarker.visible = false;

    const warpBell = state.warpTransition.active
      ? Math.sin(
          Math.PI *
            Math.min(1, state.warpTransition.elapsedMs / Math.max(1, state.warpTransition.durationMs))
        )
      : 0;
    const warpVibY = warpBell > 0.01 ? Math.sin(this.elapsedSec * 92) * 0.09 * warpBell : 0;

    this.playerVisual.root.position.set(wx, 0.35 + Math.sin(this.elapsedSec * 5) * 0.14 + warpVibY, wz);
    this.playerVisual.root.rotation.y = -p.facingAngle;

    this.playerVisual.shipTilt.rotation.x = p.bankAngle;
    this.playerVisual.shipTilt.rotation.z = warpBell > 0.01 ? -0.18 * warpBell : 0;
    this.playerVisual.shipTilt.scale.set(
      (p.dashActive ? 1.25 : 1.0) * hullPop,
      hullPop,
      (p.dashActive ? 0.78 : 1.0) * hullPop
    );

    if (!this.playerVisual.usingBlenderGltf) {
      const recoilOffset = p.shotRecoil * 0.42;
      this.playerVisual.gunLeft.position.x = 0.45 - recoilOffset;
      this.playerVisual.gunRight.position.x = 0.45 - recoilOffset;
    } else if (this.playerVisual.animator) {
      if (p.dashActive) {
        this.playerVisual.animator.play('Dash', 1.5);
      } else if (p.isOverloaded && this.playerVisual.animator.hasClip('Overheat')) {
        this.playerVisual.animator.play('Overheat', 1.65);
      } else if (p.shotRecoil > 0.12) {
        this.playerVisual.animator.play('Attack', 2.4);
      } else {
        this.playerVisual.animator.play('Idle', 1.0);
      }
      this.playerVisual.animator.update(frameDt);
    }

    const flicker = 0.88 + Math.sin(this.elapsedSec * 62) * 0.12;
    const thrustLen =
      (p.dashActive ? 2.15 * flicker : p.moving ? 1.18 * flicker : 0.48 * flicker) *
      engineLenBoost *
      (1 + warpBell * 3.1);
    const thrustW = (p.dashActive ? 1.15 : 0.9) * engineWidthBoost * (1 + warpBell * 0.45);
    this.playerVisual.thrusterLeft.scale.set(thrustLen, thrustW, thrustW);
    this.playerVisual.thrusterRight.scale.set(thrustLen, thrustW, thrustW);
    this.playerVisual.thrusterMat.uniforms.uTime.value = this.elapsedSec;
    this.playerVisual.thrusterMat.uniforms.uDash.value = p.dashActive ? 1.0 : 0.0;

    const skillReady =
      state.simTimeMs - p.skill.lastUseMs >= p.skill.cooldownMs && p.energy >= p.skill.cost;
    this.playerVisual.coreMat.emissive.setHex(skillReady ? factionGlowHex : 0xff6622);
    this.playerVisual.coreMat.emissiveIntensity = skillReady
      ? 1.4 + Math.sin(this.elapsedSec * 7) * 0.45
      : 0.65;

    // Hex-cell Voronoi energy shield (GLSL ES 3.00)
    if (p.shieldActive) {
      const rem = p.shieldDurationMs - (state.simTimeMs - p.shieldStartMs);
      const fade = Math.max(0.15, Math.min(1, rem / 650));
      this.playerVisual.shieldMesh.visible = true;
      this.playerVisual.shieldMesh.rotation.y = this.elapsedSec * 1.1;
      this.playerVisual.shieldMesh.rotation.z = this.elapsedSec * 0.65;
      this.playerVisual.shieldMat.uniforms.uTime.value = this.elapsedSec;
      this.playerVisual.shieldMat.uniforms.uOpacity.value = fade;
    } else {
      this.playerVisual.shieldMesh.visible = false;
    }

    this.playerLight.position.set(wx, 3.5, wz);
    this.playerLight.color.setHex(
      p.isOverloaded ? 0xff4418 : p.dashActive ? 0x55ffff : factionGlowHex
    );
    if (p.isOverloaded) {
      this.damageFlash = Math.max(this.damageFlash, 0.14 + Math.sin(this.elapsedSec * 12) * 0.08);
    }
  }

  private isHyperspaceTraveling(state: GameState): boolean {
    if (!state.warpTransition.active) return false;
    return state.warpTransition.elapsedMs / Math.max(1, state.warpTransition.durationMs) < 0.76;
  }

  private syncEnemies(state: GameState, frameDt: number): void {
    const aliveIds = new Set<number>();
    const hideForWarp = this.isHyperspaceTraveling(state);

    for (const e of state.enemies) {
      aliveIds.add(e.id);
      let vis = this.enemyMeshes.get(e.id);
      if (!vis) {
        vis = createEnemyVisual(e);
        this.scene.add(vis.root);
        this.enemyMeshes.set(e.id, vis);
      }
      if (hideForWarp) {
        vis.root.visible = false;
        continue;
      }
      vis.root.visible = true;

      const wx = arenaToWorldX(e.x);
      const wz = arenaToWorldZ(e.y);
      vis.root.position.set(wx, 0.4 + Math.sin(e.anim * 0.8) * 0.16, wz);

      if (e.isMinion) {
        vis.bodyGroup.rotation.y = e.anim * 0.7;
        if (vis.orbitGroup) vis.orbitGroup.rotation.y = -e.anim * 1.4;
      } else {
        // Every proper warship (yes, including the sniper) points its +X nose straight at you
        vis.bodyGroup.rotation.y = -e.faceAngle;
      }

      if (vis.animator) {
        const sinceShot = state.simTimeMs - e.lastShotMs;
        if (e.type === 'large') {
          if (e.aiState === 'windup') {
            vis.animator.play('Charge', 1.4);
          } else if (e.aiState === 'dash') {
            vis.animator.play('Attack', 2.0);
          } else {
            vis.animator.play('Idle', 1.0);
          }
        } else if (e.type === 'medium') {
          if (sinceShot > 1700 && sinceShot < 2400) {
            vis.animator.play('Charge', 1.6);
          } else if (sinceShot < 350) {
            vis.animator.play('Attack', 2.0);
          } else {
            vis.animator.play('Idle', 1.0);
          }
        } else if (e.type === 'elite') {
          if (e.warpWarmupTimer > 0 || (sinceShot > 1300 && sinceShot < 1850)) {
            vis.animator.play('Charge', 1.8);
          } else if (sinceShot < 350) {
            vis.animator.play('Attack', 2.0);
          } else {
            vis.animator.play('Idle', 1.0);
          }
        } else {
          const distToPlayer = Math.hypot(state.player.x - e.x, state.player.y - e.y);
          if (distToPlayer < 125) {
            vis.animator.play('Attack', 1.9);
          } else if (distToPlayer < 220 && vis.animator.hasClip('Charge')) {
            vis.animator.play('Charge', 1.4);
          } else {
            vis.animator.play('Idle', 1.1);
          }
        }
        vis.animator.update(frameDt);
      }

      let punch = this.enemyHitPunch.get(e.id) ?? 0;
      if (e.flash > 0.72) {
        punch = 1.0;
      } else if (punch > 0) {
        punch = Math.max(0, punch - frameDt * 9.5);
      }
      if (punch > 0) {
        this.enemyHitPunch.set(e.id, punch);
      } else {
        this.enemyHitPunch.delete(e.id);
      }

      vis.bodyGroup.scale.set(1, 1, 1);
      if (vis.usingBlenderGltf) {
        applyStageVisibility(vis, e.evolutionTier, true);
      } else {
        if (e.type === 'small' && vis.wingLeft && vis.wingRight) {
          const flap = Math.sin(e.anim * 2.2) * 0.35;
          vis.wingLeft.rotation.x = flap;
          vis.wingRight.rotation.x = -flap;
        } else if (e.type === 'medium' && vis.wingLeft && vis.wingRight) {
          const charge = Math.max(
            0,
            1 - Math.max(0, 2400 - (state.simTimeMs - e.lastShotMs)) / 900
          );
          vis.wingLeft.position.z = -1.15 - charge * 0.5;
          vis.wingRight.position.z = 1.15 + charge * 0.5;
        } else if (e.type === 'large') {
          const dashing = e.aiState === 'dash';
          vis.bodyGroup.scale.set(dashing ? 1.35 : 1, 1, dashing ? 0.78 : 1);
        }
      }
      if (punch > 0.001) {
        vis.bodyGroup.scale.x *= 1 + punch * 0.13;
        vis.bodyGroup.scale.y *= 1 - punch * 0.06;
        vis.bodyGroup.scale.z *= 1 + punch * 0.13;
      }

      // Fallback spinning halos when a procedurally built mob levels up across forms
      if (vis.evolutionHalo) {
        const useHaloFallback =
          !vis.usingBlenderGltf || (vis.form2Parts.length === 0 && vis.form2OnlyParts.length === 0);
        if (useHaloFallback && e.evolutionTier >= 2 && !e.isMinion) {
          vis.evolutionHalo.visible = true;
          const haloMat = vis.evolutionHalo.material as THREE.MeshBasicMaterial;
          if (e.evolutionTier === 3) {
            haloMat.color.setHex(Math.sin(this.elapsedSec * 9 + e.id) > 0 ? 0xffdd55 : 0xd946ef);
            vis.evolutionHalo.rotation.z = -this.elapsedSec * 4.2;
            vis.evolutionHalo.scale.setScalar(1.16 + Math.sin(this.elapsedSec * 7 + e.id) * 0.08);
          } else {
            haloMat.color.setHex(0x38e8ff);
            vis.evolutionHalo.rotation.z = this.elapsedSec * 2.4;
            vis.evolutionHalo.scale.setScalar(1.0 + Math.sin(this.elapsedSec * 4 + e.id) * 0.05);
          }
        } else {
          vis.evolutionHalo.visible = false;
        }
      }

      const tierGlowBonus = e.evolutionTier === 3 ? 0.55 : e.evolutionTier === 2 ? 0.22 : 0;
      for (const mat of vis.flashMaterials) {
        if (mat.userData.baseEmissiveHex === undefined) {
          mat.userData.baseEmissiveHex = mat.emissive.getHex();
          mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
        }
        const baseHex = mat.userData.baseEmissiveHex as number;
        const baseIntensity = mat.userData.baseEmissiveIntensity as number;
        if (e.flash > 0.04) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = baseIntensity + e.flash * 2.4;
        } else if ((e.burnMs ?? 0) > 0) {
          mat.emissive.setHex(0xff6622);
          mat.emissiveIntensity = baseIntensity + 0.24;
        } else if ((e.ionizedMs ?? 0) > 0) {
          mat.emissive.setHex(0x22d3ee);
          mat.emissiveIntensity = baseIntensity + 0.65;
        } else {
          mat.emissive.setHex(baseHex);
          mat.emissiveIntensity = baseIntensity + tierGlowBonus;
        }
      }

      if (e.hp < e.maxHp) {
        vis.hpBarGroup.visible = true;
        const ratio = Math.max(0.01, e.hp / e.maxHp);
        vis.hpFill.scale.x = ratio;
        (vis.hpFill.material as THREE.MeshBasicMaterial).color.setHex(
          ratio > 0.5 ? 0x38f288 : ratio > 0.25 ? 0xff9f1c : 0xff2a42
        );
      } else {
        vis.hpBarGroup.visible = false;
      }
    }

    for (const [id, vis] of this.enemyMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.scene.remove(vis.root);
        this.enemyMeshes.delete(id);
        this.enemyHitPunch.delete(id);
      }
    }
  }

  private syncBoss(state: GameState, frameDt: number): void {
    const boss = state.boss;
    if (!boss) {
      if (this.bossVisual) {
        this.scene.remove(this.bossVisual.refs.root);
        this.bossVisual = null;
      }
      if (this.geminiTwinVisual) {
        this.scene.remove(this.geminiTwinVisual.refs.root);
        this.geminiTwinVisual = null;
      }
      for (const segMesh of this.leviathanSegMeshes) segMesh.visible = false;
      this.bossLight.intensity = 0;
      return;
    }

    if (!this.bossVisual || this.bossVisual.id !== boss.id) {
      if (this.bossVisual) {
        this.scene.remove(this.bossVisual.refs.root);
      }
      if (this.geminiTwinVisual) {
        this.scene.remove(this.geminiTwinVisual.refs.root);
        this.geminiTwinVisual = null;
      }
      const refs = createBossVisual(boss.archetype, boss.radius * WORLD_SCALE);
      this.scene.add(refs.root);
      this.bossVisual = { id: boss.id, refs };
      this.bossYawRad = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
    }

    const refs = this.bossVisual.refs;
    const wx = arenaToWorldX(boss.x);
    const wz = arenaToWorldZ(boss.y);

    const breatheScale = 1 + Math.sin(boss.breathe) * 0.04;
    let introLightIntensity = 2.5;
    let introYawSpin = 0;

    refs.bodyGroup.rotation.x = 0;
    refs.bodyGroup.rotation.z = 0;

    if (boss.dying) {
      refs.root.visible = !(boss.teleporting && boss.teleportTimerMs < 260);
      refs.root.position.set(wx, 0.9 + Math.sin(boss.breathe) * 0.3, wz);
      const shake = (Math.random() - 0.5) * 0.9;
      refs.root.position.x += shake;
      refs.root.position.z += shake;
      const deathScale =
        boss.deathState === 0
          ? 1 + boss.deathTimer * 0.004
          : Math.max(0.05, 1 - boss.deathTimer / 20);
      refs.bodyGroup.scale.setScalar(deathScale);

      // Chain-reaction firecrackers walking across the boss hull right before the final boom
      this.bossDeathBurstAccumSec += frameDt;
      if (this.bossDeathBurstAccumSec >= 0.11) {
        this.bossDeathBurstAccumSec = 0;
        const ox = (Math.random() - 0.5) * boss.radius * 1.4;
        const oy = (Math.random() - 0.5) * boss.radius * 1.4;
        this.vfx.spawnExplosion(boss.x + ox, boss.y + oy, 'medium', boss.hex);
        this.spawnExplosionLight(boss.x + ox, boss.y + oy, boss.hex, 16.0);
        this.chromaImpulse = Math.max(this.chromaImpulse, 0.45);
      }
    } else if (boss.entering) {
      this.bossDeathBurstAccumSec = 0.08;
      if (boss.entryState === 0) {
        if (boss.archetype === 2 || boss.archetype === 5) {
          refs.root.visible = true;
          refs.root.position.set(wx, 44.0, wz);
          refs.bodyGroup.scale.setScalar(0.55 + (boss.entryTimer / 42) * 0.25);
        } else {
          refs.root.visible = false;
        }
        introLightIntensity = 4.0 + (boss.entryTimer / 42) * 5.0;
      } else if (boss.entryState === 1) {
        refs.root.visible = true;
        const p = Math.min(1, boss.entryTimer / 30);
        if (boss.archetype === 0 || boss.archetype === 3) {
          const ease = Math.pow(p, 2.2);
          const alt = 46.0 * (1 - ease) + 0.9;
          refs.root.position.set(wx, alt, wz);
          refs.bodyGroup.scale.setScalar(1.0);
          refs.bodyGroup.rotation.x = (1 - p) * 0.65;
        } else if (boss.archetype === 1 || boss.archetype === 4) {
          const easeOut = 1 - Math.pow(1 - p, 3);
          const alt = -7.0 * (1 - easeOut) + 0.9;
          const sc = Math.max(0.05, easeOut * 1.06);
          refs.root.position.set(wx, alt, wz);
          refs.bodyGroup.scale.setScalar(sc);
          refs.bodyGroup.rotation.z = (1 - p) * 0.48;
          introYawSpin = (1 - p) * Math.PI * 1.5;
        } else {
          const easeOut = 1 - Math.pow(1 - p, 2.4);
          const alt = 44.0 * (1 - easeOut) + 0.9;
          refs.root.position.set(wx, alt, wz);
          refs.bodyGroup.scale.setScalar(0.8 + 0.2 * easeOut);
        }
        introLightIntensity = 15.0;
      } else {
        refs.root.visible = true;
        const p = Math.min(1, boss.entryTimer / 48);
        refs.root.position.set(wx, 0.9 + Math.sin(boss.breathe) * 0.3, wz);
        refs.bodyGroup.rotation.x = -Math.sin(p * Math.PI) * 0.16 * (1 - p);
        refs.bodyGroup.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.08);
        introLightIntensity = 12.0 * (1 - p) + 4.5;
      }
    } else {
      this.bossDeathBurstAccumSec = 0.08;
      refs.root.visible = !(boss.teleporting && boss.teleportTimerMs < 260);
      refs.root.position.set(wx, 0.9 + Math.sin(boss.breathe) * 0.3, wz);
      refs.bodyGroup.scale.setScalar(breatheScale);
    }

    if (this.pendingBossTransform) {
      const tx = this.pendingBossTransform;
      this.pendingBossTransform = null;
      this.vfx.triggerBossTransformVfx(
        tx.archetype,
        tx.phase,
        tx.x,
        tx.y,
        tx.hex,
        boss.twin,
        boss.segments
      );
    }

    if (refs.phaseShiftTimerSec && refs.phaseShiftTimerSec > 0) {
      refs.phaseShiftTimerSec = Math.max(0, refs.phaseShiftTimerSec - frameDt);
    }

    if (refs.animator) {
      const charging =
        boss.laserCharging ||
        boss.preChargeTimer > 0 ||
        boss.skillChargeTimerMs > 0 ||
        (boss.sniperActive && boss.sniperTimerMs > 160) ||
        (boss.twin !== null && boss.twin.tetherChargingMs > 0);
      const attacking =
        boss.laserFiring ||
        boss.isCharging ||
        boss.machineGunActive ||
        boss.sniperActive ||
        boss.attackFlash > 0.15 ||
        (boss.twin !== null && boss.twin.tetherActiveMs > 0) ||
        state.scheduledBullets.length > 0;

      if (refs.phaseShiftTimerSec && refs.phaseShiftTimerSec > 0) {
        const shiftClip = refs.activeShiftClip ?? 'PhaseShift';
        const targetClip = refs.animator.hasClip(shiftClip) ? shiftClip : 'PhaseShift';
        const restart = Boolean(refs.forceShiftRestart);
        refs.forceShiftRestart = false;
        refs.animator.play(targetClip, 1.05, 'once', restart);
      } else if (
        boss.entering &&
        (boss.entryState === 2 || ((boss.archetype === 2 || boss.archetype === 5) && boss.entryState === 1))
      ) {
        refs.animator.play('PhaseShift', 1.45, 'repeat');
      } else if (boss.state === 'RESTING' || boss.staggerTimerMs > 0) {
        refs.animator.play('Rest', boss.staggerTimerMs > 0 ? 1.5 : 1.0, 'repeat');
      } else if (charging) {
        refs.animator.play('Charge', 1.6, 'repeat');
      } else if (attacking) {
        refs.animator.play('Attack', 1.65, 'repeat');
      } else if (boss.transformStage === 3 && refs.animator.hasClip('Form3')) {
        refs.animator.play('Form3', 1.35, 'repeat');
      } else if (boss.transformStage === 2 && refs.animator.hasClip('Form2')) {
        refs.animator.play('Form2', 1.15, 'repeat');
      } else {
        refs.animator.play('Idle', boss.enraged ? 1.45 : 1.0, 'repeat');
      }
      refs.animator.update(frameDt);
    }

    // Keep the boss prow aimed cleanly at whatever it's about to wreck:
    const angleToPlayer = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
    let desiredYaw = angleToPlayer;
    if (boss.laserCharging || boss.laserFiring) {
      desiredYaw = boss.laserAngle;
    } else if (boss.preChargeTimer > 0 || boss.isCharging) {
      desiredYaw = Math.atan2(boss.chargeDirY, boss.chargeDirX);
    }
    const diff = Math.atan2(Math.sin(desiredYaw - this.bossYawRad), Math.cos(desiredYaw - this.bossYawRad));
    const yawRate = boss.laserCharging || boss.preChargeTimer > 0 || boss.isCharging ? 10.0 : 3.4;
    this.bossYawRad += diff * Math.min(1, frameDt * yawRate);

    if (refs.usingBlenderGltf) {
      refs.bodyGroup.rotation.y = -this.bossYawRad + introYawSpin;
    } else {
      refs.outerRing.rotation.y = boss.rotation + introYawSpin;
    }
    refs.orbitShards.visible = boss.phase >= 2;
    refs.orbitShards.rotation.y = -boss.rotation * 1.8;

    // Swap out sculpted Blender armor bits as the boss evolves through all 3 phases
    const showForms = !boss.entering && !boss.dying;
    applyStageVisibility(refs, boss.transformStage, showForms);

    // Fallback phase rings for bosses running without multi-form GLTF geometry
    const blend = boss.transformBlend;
    const useProceduralMorphFallback =
      !refs.usingBlenderGltf || (refs.form2Parts.length === 0 && refs.form2OnlyParts.length === 0);
    if (useProceduralMorphFallback && showForms && blend > 0.04) {
      const p2t = Math.min(1, blend);
      refs.phase2Ring.visible = true;
      refs.phase2Ring.scale.setScalar(0.12 + p2t * 0.88);
      refs.phase2Ring.rotation.y = this.elapsedSec * (1.8 + blend * 0.9);
    } else {
      refs.phase2Ring.visible = false;
    }
    if (useProceduralMorphFallback && showForms && blend > 1.04) {
      const p3t = Math.min(1, blend - 1.0);
      refs.phase3Crown.visible = true;
      refs.phase3Crown.scale.setScalar(0.12 + p3t * (0.9 + Math.sin(this.elapsedSec * 7) * 0.06));
      refs.phase3Crown.rotation.y = -this.elapsedSec * 2.6;
    } else {
      refs.phase3Crown.visible = false;
    }

    // Bastion loses its outer armor plates for real as you peel them off (4 -> 2 -> 0)
    if (boss.archetype === 5 && refs.phasePlates.length > 0) {
      refs.phasePlates.forEach((plate, idx) => {
        const hasExplicitIndex = /Plate_[0-3]/i.test(plate.name);
        const isFirstPair = hasExplicitIndex ? /Plate_[01]/i.test(plate.name) : idx < 2;
        if (boss.armorPlates <= 0) {
          plate.visible = false;
        } else if (boss.armorPlates <= 2) {
          plate.visible = !isFirstPair;
        } else {
          plate.visible = true;
        }
      });
    }

    if (!refs.usingBlenderGltf) {
      const baseDist = boss.radius * WORLD_SCALE * 0.95;
      const offset = boss.attackWindup * 0.85 - boss.restProgress * 0.75;
      for (const part of refs.spikesOrArms) {
        part.position.x = baseDist + offset;
      }
    }

    // Drive the boiling reactor heart shader inside the boss chest (heat, pulse, flash)
    refs.coreMat.uniforms.uTime.value = this.elapsedSec;
    refs.coreMat.uniforms.uEnergy.value = boss.coreEnergy;
    refs.coreMat.uniforms.uHitFlash.value = boss.hitFlash;
    if (refs.coreMat.uniforms.uPhase) {
      refs.coreMat.uniforms.uPhase.value = blend;
    }
    const baseCoreScale = refs.coreMesh.userData.baseCoreScale as THREE.Vector3 | undefined;
    const coreSwell = 1 + blend * 0.16;
    if (baseCoreScale) {
      refs.coreMesh.scale.copy(baseCoreScale).multiplyScalar(coreSwell);
    } else {
      refs.coreMesh.scale.setScalar(coreSwell);
    }

    for (const mat of refs.flashMaterials) {
      if (mat.userData.baseEmissiveHex === undefined) {
        mat.userData.baseEmissiveHex = mat.emissive.getHex();
        mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
      }
      const baseHex = mat.userData.baseEmissiveHex as number;
      const baseIntensity = mat.userData.baseEmissiveIntensity as number;
      const stageBoost = blend * 0.34 + (boss.enraged ? 0.25 : 0);
      if (boss.hitFlash > 0.04) {
        mat.emissive.setHex(0xffffff);
        mat.emissiveIntensity = baseIntensity + boss.hitFlash * 2.4 + stageBoost;
      } else {
        mat.emissive.setHex(baseHex);
        mat.emissiveIntensity = baseIntensity + stageBoost;
      }
    }

    // Update Leviathan's 6-segment cyber-serpent spine trailing behind its head
    if (boss.archetype === 3 && boss.segments.length > 0 && !boss.dying) {
      while (this.leviathanSegMeshes.length < boss.segments.length) {
        const segVis = createLeviathanSegmentVisual(boss.radius * WORLD_SCALE * 0.62);
        this.scene.add(segVis);
        this.leviathanSegMeshes.push(segVis);
      }
      for (let i = 0; i < this.leviathanSegMeshes.length; i++) {
        const segMesh = this.leviathanSegMeshes[i];
        const seg = boss.segments[i];
        if (seg && (!boss.entering || boss.entryState >= 1)) {
          segMesh.visible = true;
          const taper = Math.max(0.45, 1.0 - i * 0.085);
          segMesh.scale.setScalar(taper * (1 + blend * 0.08));
          segMesh.position.set(
            arenaToWorldX(seg.x),
            0.72 + Math.sin(this.elapsedSec * 6.5 + i * 0.75) * 0.22,
            arenaToWorldZ(seg.y)
          );
          segMesh.rotation.y = -seg.angle;
        } else {
          segMesh.visible = false;
        }
      }
    } else {
      for (const segMesh of this.leviathanSegMeshes) segMesh.visible = false;
    }

    // Sync Omega, the hot-pink twin that insists on flanking you from across the arena
    if (boss.archetype === 4 && boss.twin && !boss.dying) {
      if (!this.geminiTwinVisual || this.geminiTwinVisual.bossId !== boss.id) {
        if (this.geminiTwinVisual) {
          this.scene.remove(this.geminiTwinVisual.refs.root);
        }
        const twinRefs = createBossVisual(4, boss.twin.radius * WORLD_SCALE, 0xff2e88);
        this.scene.add(twinRefs.root);
        this.geminiTwinVisual = { bossId: boss.id, refs: twinRefs };
      }
      const twin = boss.twin;
      const tRefs = this.geminiTwinVisual.refs;
      tRefs.root.visible = !boss.entering || boss.entryState >= 1;
      tRefs.root.position.set(
        arenaToWorldX(twin.x),
        0.9 + Math.sin(boss.breathe + Math.PI) * 0.3,
        arenaToWorldZ(twin.y)
      );
      tRefs.bodyGroup.scale.setScalar(breatheScale);
      tRefs.bodyGroup.rotation.y = -twin.angle;
      tRefs.coreMat.uniforms.uTime.value = this.elapsedSec;
      tRefs.coreMat.uniforms.uEnergy.value = boss.coreEnergy;
      tRefs.coreMat.uniforms.uHitFlash.value = twin.hitFlash;
      if (tRefs.coreMat.uniforms.uPhase) {
        tRefs.coreMat.uniforms.uPhase.value = blend;
      }
      applyStageVisibility(tRefs, boss.transformStage, showForms);
      const twinProceduralFallback =
        !tRefs.usingBlenderGltf || (tRefs.form2Parts.length === 0 && tRefs.form2OnlyParts.length === 0);
      if (twinProceduralFallback && showForms && blend > 0.04) {
        tRefs.phase2Ring.visible = true;
        tRefs.phase2Ring.scale.setScalar(0.12 + Math.min(1, blend) * 0.88);
        tRefs.phase2Ring.rotation.y = -this.elapsedSec * (1.8 + blend * 0.9);
      } else {
        tRefs.phase2Ring.visible = false;
      }
      if (twinProceduralFallback && showForms && blend > 1.04) {
        tRefs.phase3Crown.visible = true;
        tRefs.phase3Crown.scale.setScalar(0.12 + Math.min(1, blend - 1.0) * 0.9);
        tRefs.phase3Crown.rotation.y = this.elapsedSec * 2.6;
      } else {
        tRefs.phase3Crown.visible = false;
      }
      if (tRefs.phaseShiftTimerSec && tRefs.phaseShiftTimerSec > 0) {
        tRefs.phaseShiftTimerSec = Math.max(0, tRefs.phaseShiftTimerSec - frameDt);
      }
      if (tRefs.animator) {
        if (tRefs.phaseShiftTimerSec && tRefs.phaseShiftTimerSec > 0) {
          const shiftClip = tRefs.activeShiftClip ?? 'PhaseShift';
          const targetClip = tRefs.animator.hasClip(shiftClip) ? shiftClip : 'PhaseShift';
          const restart = Boolean(tRefs.forceShiftRestart);
          tRefs.forceShiftRestart = false;
          tRefs.animator.play(targetClip, 1.05, 'once', restart);
        } else if (twin.tetherChargingMs > 0) {
          tRefs.animator.play('Charge', 1.6, 'repeat');
        } else if (twin.tetherActiveMs > 0) {
          tRefs.animator.play('Attack', 1.65, 'repeat');
        } else if (boss.transformStage === 3 && tRefs.animator.hasClip('Form3')) {
          tRefs.animator.play('Form3', 1.35, 'repeat');
        } else if (boss.transformStage === 2 && tRefs.animator.hasClip('Form2')) {
          tRefs.animator.play('Form2', 1.15, 'repeat');
        } else {
          tRefs.animator.play('Idle', boss.enraged ? 1.45 : 1.0, 'repeat');
        }
        tRefs.animator.update(frameDt);
      }
      for (const mat of tRefs.flashMaterials) {
        if (mat.userData.baseEmissiveHex === undefined) {
          mat.userData.baseEmissiveHex = mat.emissive.getHex();
          mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
        }
        const baseHex = mat.userData.baseEmissiveHex as number;
        const baseIntensity = mat.userData.baseEmissiveIntensity as number;
        if (twin.hitFlash > 0.04) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = baseIntensity + twin.hitFlash * 2.4;
        } else {
          mat.emissive.setHex(baseHex);
          mat.emissiveIntensity = baseIntensity + blend * 0.34;
        }
      }
    } else if (this.geminiTwinVisual) {
      this.scene.remove(this.geminiTwinVisual.refs.root);
      this.geminiTwinVisual = null;
    }

    if (this.isHyperspaceTraveling(state)) {
      refs.root.visible = false;
      if (this.geminiTwinVisual) this.geminiTwinVisual.refs.root.visible = false;
      for (const segMesh of this.leviathanSegMeshes) segMesh.visible = false;
      this.bossLight.intensity = 0;
      return;
    }

    if (boss.entering && boss.entryState === 0) {
      this.bossLight.position.set(
        arenaToWorldX(state.stormRing.centerX),
        6.0,
        arenaToWorldZ(state.stormRing.centerY - 182)
      );
    } else {
      this.bossLight.position.set(wx, 5.0, wz);
    }
    this.bossLight.color.setHex(
      boss.staggerTimerMs > 0 ? 0x34d399 : boss.pylons.length > 0 ? 0x2dd4bf : boss.hex
    );
    this.bossLight.intensity = boss.entering ? introLightIntensity : 4.2 + boss.coreEnergy * 2.5 + blend * 0.9;
  }

  private syncBombs(state: GameState, frameDt: number): void {
    const alive = new Set<number>();
    for (const b of state.bombs) {
      alive.add(b.id);
      let prop = this.bombMeshes.get(b.id);
      if (!prop) {
        prop = createBombVisual();
        this.scene.add(prop.root);
        this.bombMeshes.set(b.id, prop);
      }
      prop.root.position.set(arenaToWorldX(b.x), 0.75, arenaToWorldZ(b.y));
      prop.root.rotation.y = -b.angle;
      prop.root.rotation.x = Math.sin(this.elapsedSec * 7 + b.id) * 0.12;
      prop.animator?.play('Idle', 2.4);
      prop.animator?.update(frameDt);
    }
    for (const [id, prop] of this.bombMeshes.entries()) {
      if (!alive.has(id)) {
        this.scene.remove(prop.root);
        this.bombMeshes.delete(id);
      }
    }
  }

  private syncMines(state: GameState, frameDt: number): void {
    const alive = new Set<number>();
    const mines = state.boss ? state.boss.mines : [];
    for (const m of mines) {
      alive.add(m.id);
      let prop = this.mineMeshes.get(m.id);
      if (!prop) {
        prop = createMineVisual(m.hex, m.homing);
        this.scene.add(prop.root);
        this.mineMeshes.set(m.id, prop);
      }
      const danger = m.timerMs < 1100;
      const sc = 1 + Math.sin(m.pulse * (danger ? 5 : 1.5)) * (danger ? 0.22 : 0.08);
      prop.root.position.set(arenaToWorldX(m.x), 0.55, arenaToWorldZ(m.y));
      prop.root.rotation.y = this.elapsedSec * (danger ? 5 : 1.8);
      prop.root.scale.setScalar(sc);
      prop.animator?.play(danger ? 'Attack' : 'Idle', danger ? 2.2 : 1.0);
      prop.animator?.update(frameDt);
      if (prop.dangerRing) {
        const ringMat = prop.dangerRing.material as THREE.MeshBasicMaterial;
        ringMat.color.setHex(danger ? 0xff2a42 : m.hex);
        ringMat.opacity = danger ? 0.55 + Math.abs(Math.sin(this.elapsedSec * 18)) * 0.45 : 0.48;
      }
    }
    for (const [id, prop] of this.mineMeshes.entries()) {
      if (!alive.has(id)) {
        this.scene.remove(prop.root);
        this.mineMeshes.delete(id);
      }
    }
  }

  private syncPickups(state: GameState, frameDt: number): void {
    const hideForWarp = this.isHyperspaceTraveling(state);
    const alive = new Set<number>();
    for (const pu of state.powerUps) {
      alive.add(pu.id);
      let prop = this.powerUpMeshes.get(pu.id);
      if (!prop) {
        prop = createPowerUpVisual(POWER_UP_CONFIG[pu.type].hex);
        this.scene.add(prop.root);
        this.powerUpMeshes.set(pu.id, prop);
      }
      prop.root.visible = !hideForWarp;
      prop.root.position.set(
        arenaToWorldX(pu.x),
        0.8 + Math.sin(pu.pulse) * 0.35,
        arenaToWorldZ(pu.y)
      );
      prop.root.rotation.y = this.elapsedSec * 1.6;
      prop.animator?.play('Idle', 1.2);
      prop.animator?.update(frameDt);
    }
    for (const [id, prop] of this.powerUpMeshes.entries()) {
      if (!alive.has(id)) {
        this.scene.remove(prop.root);
        this.powerUpMeshes.delete(id);
      }
    }

    if (state.healthPickup && state.isResting && !hideForWarp) {
      this.healthPickupMesh.root.visible = true;
      this.healthPickupMesh.root.position.set(
        arenaToWorldX(state.healthPickup.x),
        0.8 + Math.sin(this.elapsedSec * 4) * 0.3,
        arenaToWorldZ(state.healthPickup.y)
      );
      this.healthPickupMesh.root.rotation.y = this.elapsedSec * 1.4;
      this.healthPickupMesh.animator?.play('Idle', 1.15);
      this.healthPickupMesh.animator?.update(frameDt);
    } else {
      this.healthPickupMesh.root.visible = false;
    }

    // Bobbing loot crates begging to be vacuumed up
    const aliveMods = new Set<number>();
    for (const fm of state.floatingModules) {
      aliveMods.add(fm.id);
      let g = this.floatingModuleMeshes.get(fm.id);
      if (!g) {
        const accentHex = parseInt(WEAPON_CATALOG[fm.weaponId].accent.replace('#', ''), 16) || 0x38e8ff;
        g = new THREE.Group();
        const modVisual = createWeaponModuleVisual('nose', `drop-${fm.id}`, fm.weaponId);
        modVisual.group.position.set(0, 0.3, 0);
        modVisual.group.scale.setScalar(0.9);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.15, 1.42, 24),
          new THREE.MeshBasicMaterial({
            color: accentHex,
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        g.add(modVisual.group, ring);
        this.scene.add(g);
        this.floatingModuleMeshes.set(fm.id, g);
      }
      g.visible = !hideForWarp;
      g.position.set(arenaToWorldX(fm.x), 0.7 + Math.sin(fm.pulse) * 0.25, arenaToWorldZ(fm.y));
      g.rotation.y = this.elapsedSec * 1.8;
    }
    for (const [id, g] of this.floatingModuleMeshes.entries()) {
      if (!aliveMods.has(id)) {
        this.scene.remove(g);
        this.floatingModuleMeshes.delete(id);
      }
    }

    // Closing laser perimeter ring - touch the fence and eat the burn
    if (!hideForWarp && (state.phase === 'PLAYING' || state.phase === 'QUICK_DRAFT')) {
      const ring = state.stormRing;
      const rWorld = Math.max(4, ring.radius * WORLD_SCALE);
      const tWorld = Math.max(4, ring.targetRadius * WORLD_SCALE);
      this.stormRingGroup.visible = true;
      this.stormRingGroup.position.set(arenaToWorldX(ring.centerX), 0, arenaToWorldZ(ring.centerY));
      this.stormFloorMesh.scale.set(rWorld, rWorld, 1);
      this.stormWallMesh.scale.set(rWorld, 1, rWorld);
      this.stormTargetLine.scale.set(tWorld, 1, tWorld);
      this.stormTargetLine.position.set(
        arenaToWorldX(ring.targetCenterX) - arenaToWorldX(ring.centerX),
        0,
        arenaToWorldZ(ring.targetCenterY) - arenaToWorldZ(ring.centerY)
      );

      const floorMat = this.stormFloorMesh.material as THREE.MeshBasicMaterial;
      const hex = ring.outsideStorm
        ? 0xff2244
        : ring.bossLocked
          ? 0xff5533
          : ring.phase === 'EXPANDING'
            ? 0x34d399
            : state.sectorHazard === 'radiation_zone'
              ? 0xf59e0b
              : state.sectorMap.palette.gridHex;
      floorMat.color.setHex(hex);
      floorMat.opacity = ring.transitionActive ? 0.88 : 0.72;

      this.stormWallMat.uniforms.uTime.value = this.elapsedSec;
      (this.stormWallMat.uniforms.uColor.value as THREE.Color).setHex(hex);
      this.stormWallMat.uniforms.uPulse.value = ring.pulseFlash;
      this.stormWallMat.uniforms.uOpacity.value = ring.outsideStorm
        ? 0.44 + Math.sin(this.elapsedSec * 12) * 0.14
        : ring.transitionActive
          ? 0.38
          : 0.24;

      if (ring.outsideStorm) {
        this.damageFlash = Math.max(this.damageFlash, 0.22 + Math.sin(this.elapsedSec * 12) * 0.1);
      }
    } else {
      this.stormRingGroup.visible = false;
    }
  }

  private syncRaidWorldObjects(state: GameState, frameDt: number): void {
    const showWorld =
      !this.isHyperspaceTraveling(state) &&
      (state.phase === 'PLAYING' || state.phase === 'QUICK_DRAFT' || state.phase === 'PAUSED');

    const aliveObs = new Set<number>();
    if (showWorld) {
      for (const ob of state.arenaObstacles) {
        aliveObs.add(ob.id);
        let prop = this.obstacleMeshes.get(ob.id);
        if (!prop) {
          prop = createArenaObstacleVisual(ob.kind, ob.radius);
          this.scene.add(prop.root);
          this.obstacleMeshes.set(ob.id, prop);
        }
        prop.root.position.set(arenaToWorldX(ob.x), 0.65, arenaToWorldZ(ob.y));
        prop.root.rotation.y = ob.rotAngle;
        prop.animator?.play('Idle', ob.kind === 'plasma_barrel' ? 1.5 : 0.7);
        prop.animator?.update(frameDt);

        if (prop.dangerRing) {
          const mat = prop.dangerRing.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.42 + Math.abs(Math.sin(this.elapsedSec * 6 + ob.id)) * 0.36;
          prop.dangerRing.scale.setScalar(1 + Math.sin(this.elapsedSec * 5 + ob.id) * 0.08);
        }

        if (prop.flashMaterials) {
          for (const mat of prop.flashMaterials) {
            if (mat.userData.baseEmissiveHex === undefined) {
              mat.userData.baseEmissiveHex = mat.emissive.getHex();
              mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
            }
            const baseHex = mat.userData.baseEmissiveHex as number;
            const baseInt = mat.userData.baseEmissiveIntensity as number;
            if (ob.flash > 0.04) {
              mat.emissive.setHex(0xffffff);
              mat.emissiveIntensity = baseInt + ob.flash * 2.2;
            } else {
              mat.emissive.setHex(baseHex);
              mat.emissiveIntensity = baseInt;
            }
          }
        }

        if (prop.hpBarGroup && prop.hpFill) {
          if (ob.hp < ob.maxHp) {
            prop.hpBarGroup.visible = true;
            const ratio = Math.max(0.02, ob.hp / ob.maxHp);
            prop.hpFill.scale.x = ratio;
            (prop.hpFill.material as THREE.MeshBasicMaterial).color.setHex(
              ob.kind === 'plasma_barrel'
                ? 0xff7b29
                : ratio > 0.5
                  ? 0x38e8ff
                  : ratio > 0.25
                    ? 0xfbbf24
                    : 0xff3355
            );
          } else {
            prop.hpBarGroup.visible = false;
          }
        }
      }
    }

    for (const [id, prop] of this.obstacleMeshes.entries()) {
      if (!aliveObs.has(id)) {
        this.scene.remove(prop.root);
        this.obstacleMeshes.delete(id);
      }
    }

    const obj =
      showWorld && state.boss === null && state.raid?.activeObjective && !state.raid.activeObjective.completed
        ? state.raid.activeObjective
        : null;

    if (!obj) {
      if (this.raidObjectiveVisual) {
        this.scene.remove(this.raidObjectiveVisual.refs.root);
        this.raidObjectiveVisual = null;
      }
      return;
    }

    if (!this.raidObjectiveVisual || this.raidObjectiveVisual.id !== obj.id) {
      if (this.raidObjectiveVisual) {
        this.scene.remove(this.raidObjectiveVisual.refs.root);
      }
      const refs = createRaidObjectiveVisual(obj.kind, obj.radius, obj.accentHex);
      this.scene.add(refs.root);
      this.raidObjectiveVisual = { id: obj.id, refs };
    }

    const refs = this.raidObjectiveVisual.refs;
    refs.root.position.set(arenaToWorldX(obj.x), 0.9, arenaToWorldZ(obj.y));
    if (obj.kind === 'convoy') {
      refs.root.rotation.y = -obj.angle;
    } else {
      refs.root.rotation.y = this.elapsedSec * (obj.kind === 'vault' ? 0.55 : 0.35);
    }
    refs.animator?.play('Idle', obj.kind === 'convoy' ? 1.8 : 1.15);
    refs.animator?.update(frameDt);

    if (refs.beaconRing) {
      refs.beaconRing.scale.setScalar(1 + Math.sin(this.elapsedSec * 4.5) * 0.08);
    }

    if (obj.kind === 'vault') {
      const capR = 150 * WORLD_SCALE;
      const baseR = Math.max(1.8, obj.radius * WORLD_SCALE) * 1.35;
      const ratio = Math.min(1, obj.progressMs / Math.max(1, obj.maxProgressMs));
      if (refs.dangerRing) {
        const mat = refs.dangerRing.material as THREE.MeshBasicMaterial;
        mat.color.setHex(ratio > 0 ? 0x34d399 : 0x38e8ff);
        mat.opacity = 0.38 + Math.sin(this.elapsedSec * 5) * 0.14;
      }
      if (refs.progressRing) {
        refs.progressRing.scale.setScalar(baseR + (capR - baseR) * ratio);
        (refs.progressRing.material as THREE.MeshBasicMaterial).opacity =
          ratio > 0 ? 0.36 + ratio * 0.42 : 0.15;
      }
    } else if (refs.hpBarGroup && refs.hpFill) {
      refs.hpBarGroup.rotation.y = -refs.root.rotation.y;
      const ratio = Math.max(0.02, obj.hp / Math.max(1, obj.maxHp));
      refs.hpFill.scale.x = ratio;
      (refs.hpFill.material as THREE.MeshBasicMaterial).color.setHex(
        obj.kind === 'convoy'
          ? 0xfbbf24
          : ratio > 0.5
            ? 0xff5a36
            : ratio > 0.25
              ? 0xff9f1c
              : 0xffe066
      );
    }

    if (refs.flashMaterials) {
      for (const mat of refs.flashMaterials) {
        if (mat.userData.baseEmissiveHex === undefined) {
          mat.userData.baseEmissiveHex = mat.emissive.getHex();
          mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
        }
        const baseHex = mat.userData.baseEmissiveHex as number;
        const baseInt = mat.userData.baseEmissiveIntensity as number;
        if (obj.flash > 0.04) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = baseInt + obj.flash * 2.2;
        } else {
          mat.emissive.setHex(baseHex);
          mat.emissiveIntensity = baseInt;
        }
      }
    }
  }

  private createZeroGcLine(hex: number, opacity: number): THREE.Line {
    const pos = new Float32Array(6);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: hex,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const line = new THREE.Line(geom, mat);
    line.visible = false;
    line.frustumCulled = false;
    this.scene.add(line);
    return line;
  }

  private setLinePoints(
    line: THREE.Line,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
  ): void {
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.setXYZ(0, x1, y1, z1);
    attr.setXYZ(1, x2, y2, z2);
    attr.needsUpdate = true;
  }

  private initTacticalPools(): void {
    for (let i = 0; i < 8; i++) {
      const drone = createCombatDroneVisual(0x2dd4bf);
      drone.root.visible = false;
      drone.root.scale.setScalar(0.9);
      this.scene.add(drone.root);
      this.dronePool.push(drone);
      this.droneTetherLines.push(this.createZeroGcLine(0x2dd4bf, 0.78));
    }

    const portal = createRoomPortalVisual(0x38e8ff);
    portal.root.visible = false;
    this.scene.add(portal.root);
    this.roomPortalVisual = portal;

    for (let i = 0; i < 4; i++) {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.0, 0.075, 8, 32),
        new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
        })
      );
      ring.rotation.x = Math.PI / 2;
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0x3b0764,
          transparent: true,
          opacity: 0.92,
        })
      );
      group.add(ring, core);
      group.visible = false;
      this.scene.add(group);
      this.singularityPool.push({ group, ring, core });
    }

    for (let i = 0; i < 6; i++) {
      const saw = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.78, 8),
        new THREE.MeshBasicMaterial({
          color: 0xfb923c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        })
      );
      saw.rotation.x = Math.PI / 2;
      saw.visible = false;
      this.scene.add(saw);
      this.sawbladePool.push(saw);
    }

    for (let i = 0; i < 8; i++) {
      this.sniperLaserPool.push(this.createZeroGcLine(0xff2255, 0.85));

      const bombGrp = new THREE.Group();
      const outer = new THREE.Mesh(
        new THREE.RingGeometry(0.93, 1.0, 32),
        new THREE.MeshBasicMaterial({
          color: 0xfb923c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
        })
      );
      outer.rotation.x = Math.PI / 2;
      const fillDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.93, 32),
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        })
      );
      fillDisc.rotation.x = Math.PI / 2;
      bombGrp.add(outer, fillDisc);
      bombGrp.visible = false;
      this.scene.add(bombGrp);
      this.bomberRingPool.push({ group: bombGrp, fillDisc });

      const shieldArc = new THREE.Mesh(
        new THREE.RingGeometry(0.88, 1.12, 20, 1, -0.96, 1.92),
        new THREE.MeshBasicMaterial({
          color: 0x38e8ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        })
      );
      shieldArc.rotation.x = Math.PI / 2;
      shieldArc.visible = false;
      this.scene.add(shieldArc);
      this.shielderArcPool.push(shieldArc);
    }

    for (let i = 0; i < 6; i++) {
      this.medicBeamPool.push(this.createZeroGcLine(0x34d399, 0.82));
    }

    this.aimReticleGroup = new THREE.Group();
    this.aimReticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.94, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38e8ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    this.aimReticleRing.rotation.x = Math.PI / 2;
    const innerDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 14),
      new THREE.MeshBasicMaterial({
        color: 0xffee55,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    innerDot.rotation.x = Math.PI / 2;
    this.aimReticleGroup.add(this.aimReticleRing, innerDot);
    this.aimReticleGroup.visible = false;
    this.scene.add(this.aimReticleGroup);
    this.aimSightLine = this.createZeroGcLine(0x38e8ff, 0.34);

    // Pre-baked 84 hyperspace streaks so room warps never hitch on allocation
    this.warpTunnelGroup = new THREE.Group();
    const streakGeo = new THREE.BoxGeometry(0.055, 0.055, 5.8);
    this.warpStreakMat = new THREE.MeshBasicMaterial({
      color: 0x8cf4ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 84; i++) {
      const angle = (i / 84) * Math.PI * 2 + (i % 7) * 0.19;
      const radius = 5.4 + (i % 9) * 1.35;
      const z = ((i * 7.3) % 52) - 26;
      const mesh = new THREE.Mesh(streakGeo, this.warpStreakMat);
      mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.55, z);
      this.warpTunnelGroup.add(mesh);
      this.warpStreaks.push({
        mesh,
        angle,
        radius,
        z,
        speed: 68 + (i % 5) * 16,
      });
    }
    this.warpTunnelGroup.visible = false;
    this.scene.add(this.warpTunnelGroup);
  }

  private updateWarpTunnel(state: GameState, warpBell: number, frameDt: number): void {
    if (warpBell <= 0.01) {
      this.warpTunnelGroup.visible = false;
      return;
    }
    this.warpTunnelGroup.visible = true;
    const pwx = arenaToWorldX(state.player.x);
    const pwz = arenaToWorldZ(state.player.y);
    this.warpTunnelGroup.position.set(pwx, 2.2, pwz);
    this.warpTunnelGroup.rotation.y = -state.player.facingAngle + Math.PI * 0.5;
    this.warpStreakMat.color.setHex(state.warpTransition.accentHex).lerp(new THREE.Color(0xeefcff), 0.55);
    this.warpStreakMat.opacity = Math.min(0.95, warpBell * 0.94);
    const lenScale = 1.0 + warpBell * 3.4;
    const radExpand = 1 + warpBell * 0.48;
    for (const s of this.warpStreaks) {
      s.z += s.speed * frameDt * (1.2 + warpBell * 2.8);
      if (s.z > 28) s.z -= 56;
      s.mesh.position.set(
        Math.cos(s.angle) * s.radius * radExpand,
        Math.sin(s.angle) * s.radius * 0.55 * radExpand,
        s.z
      );
      s.mesh.scale.set(1, 1, lenScale);
    }
  }

  private syncV19WorldObjects(state: GameState, frameDt: number): void {
    if (state.phase === 'MENU') {
      const selectedHull = metaProgression.getProfile().selectedHull;
      for (let i = 0; i < this.dronePool.length; i++) {
        const visual = this.dronePool[i];
        this.droneTetherLines[i].visible = false;
        if (i === 0 && selectedHull === 'carrier') {
          const ang = this.elapsedSec * 1.4;
          visual.root.visible = true;
          visual.root.position.set(Math.cos(ang) * 2.4, 1.15 + Math.sin(this.elapsedSec * 3) * 0.12, Math.sin(ang) * 2.4);
          visual.root.rotation.y = -ang + Math.PI * 0.5;
          visual.animator?.play('Idle', 1.4);
          visual.animator?.update(frameDt);
        } else {
          visual.root.visible = false;
        }
      }
      if (this.roomPortalVisual) this.roomPortalVisual.root.visible = false;
      for (const s of this.singularityPool) s.group.visible = false;
      for (const b of this.sawbladePool) b.visible = false;
      for (const l of this.sniperLaserPool) l.visible = false;
      for (const br of this.bomberRingPool) br.group.visible = false;
      for (const ar of this.shielderArcPool) ar.visible = false;
      for (const mb of this.medicBeamPool) mb.visible = false;
      this.aimReticleGroup.visible = false;
      this.aimSightLine.visible = false;
      return;
    }

    const showWorld =
      state.phase === 'PLAYING' ||
      state.phase === 'QUICK_DRAFT' ||
      state.phase === 'ROOM_SELECT' ||
      state.phase === 'PAUSED';

    const p = state.player;
    const pwx = arenaToWorldX(p.x);
    const pwz = arenaToWorldZ(p.y);
    const hasTether = countMutationStacks(p.activeMutations, 'drone_tether') > 0;

    // 1. Friendly combat drones + zap tether lines when linked
    for (let i = 0; i < this.dronePool.length; i++) {
      const visual = this.dronePool[i];
      const tether = this.droneTetherLines[i];
      const d = showWorld ? state.drones[i] : undefined;
      if (!d) {
        visual.root.visible = false;
        tether.visible = false;
        continue;
      }
      visual.root.visible = true;
      const dwx = arenaToWorldX(d.x);
      const dwz = arenaToWorldZ(d.y);
      visual.root.position.set(dwx, 0.72 + Math.sin(this.elapsedSec * 4.5 + i) * 0.14, dwz);
      visual.root.rotation.y = -d.angle;
      visual.animator?.play('Idle', 1.4);
      visual.animator?.update(frameDt);
      if (visual.dangerRing) {
        visual.dangerRing.rotation.z = this.elapsedSec * 4 + i;
      }
      if (hasTether && state.phase === 'PLAYING') {
        tether.visible = true;
        this.setLinePoints(tether, pwx, 0.55, pwz, dwx, 0.72, dwz);
        (tether.material as THREE.LineBasicMaterial).opacity =
          0.55 + Math.sin(this.elapsedSec * 18 + i) * 0.28;
      } else {
        tether.visible = false;
      }
    }

    // 2. End-of-room warp gate waiting for survivors
    if (this.roomPortalVisual) {
      if (showWorld && state.roomPortal) {
        const rp = state.roomPortal;
        this.roomPortalVisual.root.visible = true;
        this.roomPortalVisual.root.position.set(
          arenaToWorldX(rp.x),
          0.75 + Math.sin(this.elapsedSec * 3.0) * 0.15,
          arenaToWorldZ(rp.y)
        );
        this.roomPortalVisual.root.rotation.y = this.elapsedSec * 0.9;
        this.roomPortalVisual.animator?.play('Idle', 1.2);
        this.roomPortalVisual.animator?.update(frameDt);
        if (this.roomPortalVisual.beaconRing) {
          this.roomPortalVisual.beaconRing.scale.setScalar(1 + Math.sin(this.elapsedSec * 5) * 0.12);
        }
      } else {
        this.roomPortalVisual.root.visible = false;
      }
    }

    // 3. Gravity wells sucking projectiles and careless pilots inward
    for (let i = 0; i < this.singularityPool.length; i++) {
      const slot = this.singularityPool[i];
      const sg = showWorld ? state.singularities[i] : undefined;
      if (!sg) {
        slot.group.visible = false;
        continue;
      }
      slot.group.visible = true;
      slot.group.position.set(arenaToWorldX(sg.x), 0.42, arenaToWorldZ(sg.y));
      const worldR = sg.radius * WORLD_SCALE * (0.75 + 0.25 * (sg.lifeMs / Math.max(1, sg.maxLifeMs)));
      slot.ring.scale.set(worldR, worldR, 1);
      slot.ring.rotation.z = this.elapsedSec * 5.2;
      const corePulse = 0.8 + Math.sin(this.elapsedSec * 14) * 0.2;
      slot.core.scale.setScalar(worldR * 0.38 * corePulse);
    }

    // 4. Spinning orbital sawblades (OSHA still hasn't reached this sector)
    const bladeStacks = showWorld ? countMutationStacks(p.activeMutations, 'orbital_sawblades') : 0;
    const activeBlades = bladeStacks > 0 ? Math.min(this.sawbladePool.length, bladeStacks * 2) : 0;
    for (let i = 0; i < this.sawbladePool.length; i++) {
      const blade = this.sawbladePool[i];
      if (i >= activeBlades) {
        blade.visible = false;
        continue;
      }
      blade.visible = true;
      const ang = p.orbitalBladeAngle + (i / activeBlades) * Math.PI * 2;
      const bx = p.x + Math.cos(ang) * 78;
      const bz = p.y + Math.sin(ang) * 78;
      blade.position.set(arenaToWorldX(bx), 0.45, arenaToWorldZ(bz));
      blade.rotation.z = this.elapsedSec * 14;
    }

    // 5. Threat telegraphs: sniper laser sights, bomber blast rings, shield arcs, and healer tethers
    let sniperIdx = 0;
    let bomberIdx = 0;
    let shielderIdx = 0;
    let medicIdx = 0;

    if (showWorld) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const ex = arenaToWorldX(e.x);
        const ez = arenaToWorldZ(e.y);

        if (e.specialKind === 'sniper' && e.telegraphTimerMs > 0 && sniperIdx < this.sniperLaserPool.length) {
          const laser = this.sniperLaserPool[sniperIdx++];
          laser.visible = true;
          const len = 30;
          const endX = ex + Math.cos(e.telegraphAngle) * len;
          const endZ = ez + Math.sin(e.telegraphAngle) * len;
          this.setLinePoints(laser, ex, 0.65, ez, endX, 0.65, endZ);
          const pct = 1 - e.telegraphTimerMs / Math.max(1, e.telegraphMaxMs);
          (laser.material as THREE.LineBasicMaterial).opacity = 0.38 + pct * 0.62;
        } else if (
          e.specialKind === 'bomber' &&
          e.telegraphTimerMs > 0 &&
          bomberIdx < this.bomberRingPool.length
        ) {
          const entry = this.bomberRingPool[bomberIdx++];
          entry.group.visible = true;
          entry.group.position.set(ex, 0.25, ez);
          const worldBlastR = 138 * WORLD_SCALE;
          entry.group.scale.setScalar(worldBlastR);
          const prog = 1 - e.telegraphTimerMs / Math.max(1, e.telegraphMaxMs);
          entry.fillDisc.scale.setScalar(Math.max(0.08, prog));
        } else if (e.specialKind === 'shielder' && shielderIdx < this.shielderArcPool.length) {
          const arc = this.shielderArcPool[shielderIdx++];
          arc.visible = true;
          arc.position.set(ex, 0.52, ez);
          arc.scale.setScalar(Math.max(1.25, e.radius * WORLD_SCALE * 1.25));
          arc.rotation.y = -e.faceAngle;
        } else if (
          e.specialKind === 'medic' &&
          e.healTargetId !== null &&
          medicIdx < this.medicBeamPool.length
        ) {
          const target = state.enemies.find((cand) => cand.id === e.healTargetId && cand.hp > 0);
          if (target) {
            const beam = this.medicBeamPool[medicIdx++];
            beam.visible = true;
            this.setLinePoints(beam, ex, 0.72, ez, arenaToWorldX(target.x), 0.72, arenaToWorldZ(target.y));
            (beam.material as THREE.LineBasicMaterial).opacity =
              0.52 + Math.sin(this.elapsedSec * 12) * 0.28;
          }
        }
      }
    }

    for (let i = sniperIdx; i < this.sniperLaserPool.length; i++) this.sniperLaserPool[i].visible = false;
    for (let i = bomberIdx; i < this.bomberRingPool.length; i++) this.bomberRingPool[i].group.visible = false;
    for (let i = shielderIdx; i < this.shielderArcPool.length; i++) this.shielderArcPool[i].visible = false;
    for (let i = medicIdx; i < this.medicBeamPool.length; i++) this.medicBeamPool[i].visible = false;

    // 6. Crisp 3D floor reticle & aim beam so you actually know where shots land
    if (state.phase === 'PLAYING' && state.aimWorldActive) {
      const ax = arenaToWorldX(state.aimWorldX);
      const az = arenaToWorldZ(state.aimWorldY);
      this.aimReticleGroup.visible = true;
      this.aimReticleGroup.position.set(ax, 0.42, az);
      this.aimReticleRing.rotation.z = this.elapsedSec * 2.6;
      const pulse = 1 + Math.sin(this.elapsedSec * 8) * 0.08;
      this.aimReticleGroup.scale.setScalar(pulse * (1 + this.aimReticlePulse * 0.34));
      const ringMat = this.aimReticleRing.material as THREE.MeshBasicMaterial;
      if (this.aimReticlePulse > 0.05) {
        const targetCol = this.aimReticleCrit ? this.aimCritColor : this.aimHitColor;
        ringMat.color.copy(this.aimIdleColor).lerp(targetCol, Math.min(1, this.aimReticlePulse));
      } else {
        ringMat.color.copy(this.aimIdleColor);
      }
      this.aimSightLine.visible = true;
      this.setLinePoints(this.aimSightLine, pwx, 0.42, pwz, ax, 0.42, az);
    } else {
      this.aimReticleGroup.visible = false;
      this.aimSightLine.visible = false;
    }
  }

  private updateDynamicCamera(state: GameState, dtSec: number): void {
    const dt = Math.min(0.1, Math.max(0.001, dtSec));
    const damp = (lambda: number) => 1 - Math.exp(-lambda * dt);

    const warpBell =
      state.warpTransition.active && state.phase === 'PLAYING'
        ? Math.sin(
            Math.PI *
              Math.min(1, state.warpTransition.elapsedMs / Math.max(1, state.warpTransition.durationMs))
          )
        : 0;
    const targetFov = 48 + warpBell * 10;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * damp(9.0);
      this.camera.updateProjectionMatrix();
    }

    if (state.phase === 'MENU') {
      const k = damp(6.5);
      this.camInitialized = false;
      this.camLeadSmooth.set(0, 0);
      this.camSpeedZoom = 0;
      this.camPosSmooth.lerp(new THREE.Vector3(0, 5.5, 9.8), k);
      this.camLookSmooth.lerp(new THREE.Vector3(0, 0.15, 1.45), k);
      this.camera.position.copy(this.camPosSmooth);
      this.camera.lookAt(this.camLookSmooth);
      this.lastCameraShake.x = this.lastCameraShake.y = this.lastCameraShake.z = 0;
      this.lastCameraMotion.vx = this.lastCameraMotion.vz = 0;
      return;
    }

    if (state.phase === 'SHOP') {
      const k = damp(8.5);
      const wx = arenaToWorldX(state.player.x);
      const wz = arenaToWorldZ(state.player.y);
      this.camPosSmooth.lerp(new THREE.Vector3(wx, 12.2, wz + 7.6), k);
      this.camLookSmooth.lerp(new THREE.Vector3(wx, 0.25, wz + 0.1), k);
      this.camera.position.copy(this.camPosSmooth);
      this.camera.lookAt(this.camLookSmooth);
      this.lastCameraShake.x = this.lastCameraShake.y = this.lastCameraShake.z = 0;
      this.lastCameraMotion.vx = this.lastCameraMotion.vz = 0;
      return;
    }

    if (state.phase === 'PAUSED') {
      if (!this.camInitialized) {
        const wx = arenaToWorldX(state.player.x);
        const wz = arenaToWorldZ(state.player.y);
        this.camPosSmooth.set(wx + this.camBasePos.x, this.camBasePos.y, wz + this.camBasePos.z + 1.5);
        this.camLookSmooth.set(wx, 0, wz + 1.5);
        this.camInitialized = true;
      }
      this.camera.position.copy(this.camPosSmooth);
      this.camLookTarget.copy(this.camLookSmooth);
      this.camera.lookAt(this.camLookTarget);
      this.lastCameraShake.x = this.lastCameraShake.y = this.lastCameraShake.z = 0;
      this.lastCameraMotion.vx = this.lastCameraMotion.vz = 0;
      return;
    }

    let targetFocus = 0;
    if (state.phase === 'PLAYING' && state.boss?.entering) {
      const b = state.boss;
      if (b.entryState === 0) targetFocus = 0.55;
      else if (b.entryState === 1) targetFocus = 1.0;
      else targetFocus = b.entryTimer < 30 ? 0.95 : Math.max(0, 1 - (b.entryTimer - 30) / 18) * 0.95;
    }
    this.camIntroFocus += (targetFocus - this.camIntroFocus) * damp(5.5);

    const p = state.player;
    const speedMag = Math.hypot(p.vx, p.vy);
    const targetLeadX =
      state.phase === 'PLAYING' ? Math.max(-7.5, Math.min(7.5, p.vx * 1.4)) : 0;
    const targetLeadZ =
      state.phase === 'PLAYING' ? Math.max(-7.5, Math.min(7.5, p.vy * 1.4)) : 0;
    this.camLeadSmooth.x += (targetLeadX - this.camLeadSmooth.x) * damp(4.2);
    this.camLeadSmooth.y += (targetLeadZ - this.camLeadSmooth.y) * damp(4.2);

    const targetSpeedZoom =
      state.phase === 'PLAYING' ? (p.dashActive ? 4.4 : Math.min(2.6, speedMag * 0.55)) : 0;
    this.camSpeedZoom += (targetSpeedZoom - this.camSpeedZoom) * damp(3.6);

    const px = arenaToWorldX(p.x);
    const pz = arenaToWorldZ(p.y);

    const bossAnchorWX = state.boss ? arenaToWorldX(state.stormRing.centerX) : px;
    const bossAnchorWZ = state.boss ? arenaToWorldZ(state.stormRing.centerY - 140) : pz;

    const lookX = THREE.MathUtils.lerp(px + this.camLeadSmooth.x, bossAnchorWX, this.camIntroFocus * 0.72);
    const lookZ = THREE.MathUtils.lerp(
      pz + this.camLeadSmooth.y + 1.5,
      bossAnchorWZ,
      this.camIntroFocus * 0.72
    );

    const introScaleY = 1 - 0.18 * this.camIntroFocus;
    const desiredPos = new THREE.Vector3(
      lookX + this.camBasePos.x,
      (this.camBasePos.y + this.camSpeedZoom) * introScaleY - warpBell * 5.5,
      lookZ + this.camBasePos.z - 7.5 * this.camIntroFocus + warpBell * 3.5
    );
    const desiredLook = new THREE.Vector3(lookX, 0, lookZ);

    const prevCamX = this.camPosSmooth.x;
    const prevCamZ = this.camPosSmooth.z;

    if (!this.camInitialized && state.phase === 'PLAYING') {
      this.camPosSmooth.copy(desiredPos);
      this.camLookSmooth.copy(desiredLook);
      this.camInitialized = true;
    } else {
      this.camPosSmooth.lerp(desiredPos, damp(5.8));
      this.camLookSmooth.lerp(desiredLook, damp(7.2));
    }

    this.lastCameraMotion.vx = state.phase === 'PLAYING' ? (this.camPosSmooth.x - prevCamX) / dt : 0;
    this.lastCameraMotion.vz = state.phase === 'PLAYING' ? (this.camPosSmooth.z - prevCamZ) / dt : 0;

    // Stack quadratic trauma shake + kick AFTER camera smoothing so hits feel punchy, not floaty
    this.camTrauma = Math.max(0, this.camTrauma - dt * 1.85);
    const kickDecay = Math.exp(-15 * dt);
    this.camKickX *= kickDecay;
    this.camKickZ *= kickDecay;

    const effTrauma =
      state.phase === 'PLAYING'
        ? Math.max(this.camTrauma, Math.min(1, state.screenShake / 24))
        : 0;
    const sq = effTrauma * effTrauma;
    const t = this.elapsedSec;
    const nx = 0.6 * Math.sin(t * 31.0 + 1.3) + 0.4 * Math.sin(t * 57.0 + 4.1);
    const ny = 0.6 * Math.sin(t * 27.0 + 2.7) + 0.4 * Math.sin(t * 51.0 + 0.9);
    const nz = 0.6 * Math.sin(t * 33.0 + 5.2) + 0.4 * Math.sin(t * 61.0 + 2.4);
    const nRoll = 0.65 * Math.sin(t * 23.0 + 0.7) + 0.35 * Math.sin(t * 43.0 + 3.3);

    const shakeX = state.phase === 'PLAYING' ? nx * sq * 1.65 + this.camKickX : 0;
    const shakeY = state.phase === 'PLAYING' ? ny * sq * 0.75 : 0;
    const shakeZ = state.phase === 'PLAYING' ? nz * sq * 1.65 + this.camKickZ : 0;
    this.camRollRad = state.phase === 'PLAYING' ? sq * nRoll * 0.026 : 0;

    if (state.phase === 'PLAYING') {
      this.lastCameraShake.x = shakeX;
      this.lastCameraShake.y = shakeY;
      this.lastCameraShake.z = shakeZ;
    } else {
      this.camTrauma = 0;
      this.camKickX = 0;
      this.camKickZ = 0;
      this.lastCameraShake.x = this.lastCameraShake.y = this.lastCameraShake.z = 0;
    }

    this.camera.position.set(
      this.camPosSmooth.x + shakeX,
      this.camPosSmooth.y + shakeY,
      this.camPosSmooth.z + shakeZ
    );
    this.camLookTarget.copy(this.camLookSmooth);
    this.camera.lookAt(this.camLookTarget);
    if (Math.abs(this.camRollRad) > 0.0001) {
      this.camera.rotateZ(this.camRollRad);
    }
  }

  private updateCameraFraming(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;

    const targetHalfW = 45;
    const targetHalfH = 36;
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const distForH = targetHalfH / Math.tan(fovRad / 2);
    const distForW = targetHalfW / (Math.tan(fovRad / 2) * aspect);
    const dist = Math.max(distForH, distForW);

    this.camBasePos.set(0, dist * 0.94, dist * 0.28);
    this.camera.updateProjectionMatrix();
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.postPass.uniforms.uResolution.value.set(width, height);
    this.updateCameraFraming(width, height);
  };

  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    if (this.scene.environment) {
      this.scene.environment.dispose();
      this.scene.environment = null;
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
