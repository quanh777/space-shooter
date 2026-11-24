import * as THREE from 'three';
import { WORLD_SCALE, arenaToWorldX, arenaToWorldZ } from '../config/constants';
import type { BossArchetype, GameState } from '../game/types';
import {
  createBlastDomeMaterial,
  createBossPortalMaterial,
  createDeathRayMaterial,
  createExplosionFireballMaterial,
  createPlasmaProjectileMaterial,
  createShockwaveRingMaterial,
} from './shaders/gameShaders';

const MAX_PARTICLES = 800;
const MAX_PLAYER_BULLETS = 320;
const MAX_ENEMY_CLASS_BULLETS = 360;
const MAX_CHARGE_ORBS = 64;
const MAX_COINS = 220;
const MAX_SHOCKWAVES = 40;
const MAX_AFTERIMAGES = 32;
const MAX_ENEMY_TELEGRAPHS = 10;
const MAX_MISSILE_TRAILS = 12;
const MAX_FIREBALLS = 22;
const MAX_BLAST_DOMES = 10;
const MAX_SPARKS = 420;
const MAX_DEBRIS = 180;
const MAX_LIGHTNING_ARCS = 4;
const MAX_LIGHTNING_VERTS = 64;
const MAX_EDGE_CHEVRONS = 12;
const MAX_BOSS_BEAMS = 4;
const MAX_BOSS_PYLONS = 4;
const MAX_BOSS_CLONES = 3;
const MAX_BOSS_HAZARDS = 12;
const MAX_BOSS_WELLS = 3;

export type ExplosionTier = 'small' | 'medium' | 'heavy' | 'boss';

interface FireballSlot {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  active: boolean;
  delay: number;
  age: number;
  duration: number;
  startScale: number;
  maxScale: number;
  riseSpeed: number;
  rotSpeedX: number;
  rotSpeedY: number;
}

interface BlastDomeSlot {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  active: boolean;
  age: number;
  duration: number;
  maxScale: number;
}

interface SparkSlot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  duration: number;
  thickness: number;
  colorHex: number;
}

interface DebrisSlot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  scale: number;
  age: number;
  duration: number;
  colorHex: number;
}

interface ExtraShockwaveSlot {
  x: number;
  z: number;
  maxRadius: number;
  age: number;
  duration: number;
  colorHex: number;
}

class DynamicRibbonTrail {
  public readonly mesh: THREE.Mesh;
  private readonly points: THREE.Vector3[] = [];
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly color = new THREE.Color(0x2be4ff);

  constructor(private readonly maxPoints: number) {
    const vertCount = maxPoints * 2;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const indices: number[] = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.colAttr = new THREE.BufferAttribute(colors, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setIndex(indices);

    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  reset(): void {
    this.points.length = 0;
    this.mesh.visible = false;
  }

  update(
    x: number,
    y: number,
    z: number,
    halfWidth: number,
    colorHex: number,
    fadeStrength = 1.0
  ): void {
    if (this.points.length > 0) {
      const head = this.points[0];
      const jumpSq = (head.x - x) ** 2 + (head.y - y) ** 2 + (head.z - z) ** 2;
      if (jumpSq > 144) {
        this.points.length = 0;
      }
    }

    if (this.points.length === 0) {
      for (let i = 0; i < 3; i++) {
        this.points.push(new THREE.Vector3(x, y, z));
      }
    } else {
      const head = this.points[0];
      const dSq = (head.x - x) ** 2 + (head.z - z) ** 2;
      if (dSq > 0.08) {
        this.points.unshift(new THREE.Vector3(x, y, z));
        if (this.points.length > this.maxPoints) {
          this.points.pop();
        }
      } else {
        head.set(x, y, z);
      }
    }

    const count = this.points.length;
    if (count < 2) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    this.color.setHex(colorHex);
    const pos = this.posAttr.array as Float32Array;
    const col = this.colAttr.array as Float32Array;

    for (let i = 0; i < this.maxPoints; i++) {
      const idx = Math.min(i, count - 1);
      const curr = this.points[idx];
      const next = this.points[Math.min(idx + 1, count - 1)];
      const prev = this.points[Math.max(idx - 1, 0)];

      let tx = prev.x - next.x;
      let tz = prev.z - next.z;
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;

      const t = i / Math.max(1, count - 1);
      const w = halfWidth * Math.max(0, 1 - t);
      const alpha = (i >= count ? 0 : (1 - t) ** 1.7) * fadeStrength;

      const px = -tz * w;
      const pz = tx * w;

      const v0 = i * 6;
      const v1 = v0 + 3;

      pos[v0] = curr.x + px;
      pos[v0 + 1] = curr.y;
      pos[v0 + 2] = curr.z + pz;

      pos[v1] = curr.x - px;
      pos[v1 + 1] = curr.y;
      pos[v1 + 2] = curr.z - pz;

      col[v0] = this.color.r * alpha;
      col[v0 + 1] = this.color.g * alpha;
      col[v0 + 2] = this.color.b * alpha;

      col[v1] = this.color.r * alpha;
      col[v1 + 1] = this.color.g * alpha;
      col[v1 + 2] = this.color.b * alpha;
    }

    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }
}

function createRailDartGeometry(length: number, radius: number): THREE.BufferGeometry {
  // Asymmetric diamond-dart oriented forward along +X
  const geo = new THREE.OctahedronGeometry(radius, 0);
  geo.scale(length / (radius * 2), 0.58, 0.88);
  return geo;
}

function createFinnedBoltGeometry(length: number, width: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(length * 0.62, 0);
  shape.lineTo(0.05, width * 0.55);
  shape.lineTo(-length * 0.45, width * 0.35);
  shape.lineTo(-length * 0.3, 0);
  shape.lineTo(-length * 0.45, -width * 0.35);
  shape.lineTo(0.05, -width * 0.55);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: height * 0.25,
    bevelSize: width * 0.08,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, height * 0.5, 0);
  return geo;
}

function createPetalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.68, 0);
  shape.lineTo(0.08, 0.38);
  shape.lineTo(-0.55, 0.12);
  shape.lineTo(-0.72, 0);
  shape.lineTo(-0.55, -0.12);
  shape.lineTo(0.08, -0.38);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.07, 0);
  return geo;
}

function createHexCreditChipGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r = 0.54;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.08);
  return geo;
}

function createDebrisPlateGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.42, 0.0);
  shape.lineTo(0.08, 0.34);
  shape.lineTo(-0.38, 0.16);
  shape.lineTo(-0.24, -0.28);
  shape.lineTo(0.18, -0.22);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.045, 0);
  return geo;
}

function createSparkNeedleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(0.14, 0);
  geo.scale(3.2, 0.45, 0.45);
  return geo;
}

export class VFXSystem {
  public readonly group = new THREE.Group();

  private particleInst: THREE.InstancedMesh;

  // Dual-layer player rail-darts (bright core + glowing energy jacket)
  private playerBulletCoreInst: THREE.InstancedMesh;
  private playerBulletGlowInst: THREE.InstancedMesh;

  // 4 distinct enemy bullet families so you can read danger from shapes alone
  private enemyBoltCoreInst: THREE.InstancedMesh;
  private enemyBoltShellInst: THREE.InstancedMesh;
  private enemyNeedleCoreInst: THREE.InstancedMesh;
  private enemyNeedleShellInst: THREE.InstancedMesh;
  private enemyOrbCoreInst: THREE.InstancedMesh;
  private enemyOrbShellInst: THREE.InstancedMesh;
  private enemyPetalInst: THREE.InstancedMesh;

  // Muzzle charge glows + shiny hex credit coins waiting to drop
  private chargeOrbInst: THREE.InstancedMesh;
  private coinInst: THREE.InstancedMesh;

  // Live 3D wingtip contrails, missile ribbons, muzzle starbursts & active shader uniforms
  private plasmaMaterials: THREE.ShaderMaterial[] = [];
  private deathRayMat: THREE.ShaderMaterial;
  private wingTrailL = new DynamicRibbonTrail(22);
  private wingTrailR = new DynamicRibbonTrail(22);
  private missileTrailPool: DynamicRibbonTrail[] = [];
  private missileTrailMap = new Map<number, DynamicRibbonTrail>();
  private muzzleFlashL: THREE.Group;
  private muzzleFlashR: THREE.Group;
  private readonly afterimageCyan = new THREE.Color(0x55ffff);
  private readonly afterimageViolet = new THREE.Color(0xa855f7);

  private shockwavePool: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial }> = [];
  private fireballPool: FireballSlot[] = [];
  private blastDomePool: BlastDomeSlot[] = [];
  private extraShockwaves: ExtraShockwaveSlot[] = [];
  private sparks: SparkSlot[] = [];
  private debris: DebrisSlot[] = [];
  private sparkInst: THREE.InstancedMesh;
  private debrisInst: THREE.InstancedMesh;

  private afterimagePool: THREE.Mesh[] = [];
  private largeDashCorridors: THREE.Mesh[] = [];
  private eliteWarpBeams: THREE.Mesh[] = [];

  // Boss kit props: multi-beams, black-hole charges, sniper lasers, stun rings & phase toys
  private laserBeamMeshes: THREE.Mesh[] = [];
  private laserCoreMeshes: THREE.Mesh[] = [];
  private laserHelixRings: THREE.Mesh[] = [];
  private laserWarningRibbons: THREE.Mesh[] = [];
  private laserChargeSphere: THREE.Mesh;
  private laserChargeRing: THREE.Mesh;
  private chargeCorridorMesh: THREE.Mesh;
  private sniperRibbon: THREE.Mesh;
  private bossSkillChargeRing: THREE.Mesh;
  private bossRestRing: THREE.Mesh;
  private bossAegisDome: THREE.Mesh;
  private bossBlinkRibbon: THREE.Mesh;
  private bossPylonPool: Array<{
    group: THREE.Group;
    crystal: THREE.Mesh;
    ring: THREE.Mesh;
    tether: THREE.Mesh;
  }> = [];
  private bossClonePool: Array<{
    group: THREE.Group;
    hull: THREE.Mesh;
    ring: THREE.Mesh;
  }> = [];
  private bossHazardPool: Array<{
    outerRing: THREE.Mesh;
    fillDisc: THREE.Mesh;
    strikePillar: THREE.Mesh;
  }> = [];
  private bossWellPool: Array<{
    group: THREE.Group;
    core: THREE.Mesh;
    innerRing: THREE.Mesh;
    outerRing: THREE.Mesh;
  }> = [];
  // The awkward glowing plasma leash connecting Gemini's two grumpy cores
  private geminiTetherWarn: THREE.Mesh;
  private geminiTetherBeam: THREE.Mesh;
  private geminiTetherCore: THREE.Mesh;

  // Dramatic boss warp-in kit: GLSL portal seal, orbital sky beam & snapping rings
  private bossPortalMat: THREE.ShaderMaterial;
  private bossPortalMesh: THREE.Mesh;
  private bossSkyBeamMesh: THREE.Mesh;
  private bossConvergeRings: THREE.Mesh[] = [];

  // Pre-warmed boss evolution fireworks (per-archetype 3-stage phase swaps)
  private bossTransformPillar: THREE.Mesh;
  private bossTransformRings: THREE.Mesh[] = [];
  private bossTransformBeams: THREE.Mesh[] = [];
  private bossTransformDebris: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; vrx: number; vry: number }> = [];
  private bossTransformState: {
    active: boolean;
    archetype: BossArchetype;
    phase: 2 | 3;
    age: number;
    duration: number;
    ax: number;
    ay: number;
    hex: number;
    hasTwin: boolean;
    twinX: number;
    twinY: number;
    segments: Array<{ x: number; y: number }>;
    leviathanWaveIdx: number;
    summonerBursted: boolean;
  } | null = null;

  // Player 3-stance active skill visuals + off-screen edge chevrons
  private railBeamOuterMesh!: THREE.Mesh;
  private railBeamCoreMesh!: THREE.Mesh;
  private railBeamMat!: THREE.ShaderMaterial;
  private railBeamRings: THREE.Mesh[] = [];
  private lightningLines: Array<{ line: THREE.Line; posAttr: THREE.BufferAttribute; mat: THREE.LineBasicMaterial }> = [];
  private edgeChevrons: THREE.Mesh[] = [];

  private dummy = new THREE.Object3D();
  private tempColor = new THREE.Color();

  constructor() {
    // 1. Instanced particle fireworks
    this.particleInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_PARTICLES
    );
    this.particleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleInst.frustumCulled = false;
    this.group.add(this.particleInst);

    const makePlasmaMat = (opacity: number, coreMix: number, boost: number) => {
      const m = createPlasmaProjectileMaterial(opacity, coreMix, boost);
      this.plasmaMaterials.push(m);
      return m;
    };

    // 2. Player dual-layer rail-darts (GLSL3 plasma sheath)
    this.playerBulletCoreInst = new THREE.InstancedMesh(
      createRailDartGeometry(1.5, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX_PLAYER_BULLETS
    );
    this.playerBulletCoreInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.playerBulletCoreInst.frustumCulled = false;

    this.playerBulletGlowInst = new THREE.InstancedMesh(
      createFinnedBoltGeometry(1.95, 0.56, 0.18),
      makePlasmaMat(0.92, 0.78, 1.75),
      MAX_PLAYER_BULLETS
    );
    this.playerBulletGlowInst.setColorAt(0, new THREE.Color(0xffffff));
    this.playerBulletGlowInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.playerBulletGlowInst.frustumCulled = false;
    this.group.add(this.playerBulletGlowInst, this.playerBulletCoreInst);

    // 3a. Enemy 'bolt': angry finned plasma dart
    this.enemyBoltCoreInst = new THREE.InstancedMesh(
      createRailDartGeometry(1.05, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX_ENEMY_CLASS_BULLETS
    );
    this.enemyBoltCoreInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyBoltCoreInst.frustumCulled = false;

    this.enemyBoltShellInst = new THREE.InstancedMesh(
      createFinnedBoltGeometry(1.5, 0.58, 0.22),
      makePlasmaMat(0.92, 0.72, 1.68),
      MAX_ENEMY_CLASS_BULLETS
    );
    this.enemyBoltShellInst.setColorAt(0, new THREE.Color(0xffffff));
    this.enemyBoltShellInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyBoltShellInst.frustumCulled = false;
    this.group.add(this.enemyBoltShellInst, this.enemyBoltCoreInst);

    // 3b. Enemy 'needle': fast piercing rail spear (Sniper / Elite / GridLock)
    this.enemyNeedleCoreInst = new THREE.InstancedMesh(
      createRailDartGeometry(1.85, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX_ENEMY_CLASS_BULLETS
    );
    this.enemyNeedleCoreInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyNeedleCoreInst.frustumCulled = false;

    this.enemyNeedleShellInst = new THREE.InstancedMesh(
      createRailDartGeometry(2.4, 0.36),
      makePlasmaMat(0.86, 0.68, 1.8),
      MAX_ENEMY_CLASS_BULLETS
    );
    this.enemyNeedleShellInst.setColorAt(0, new THREE.Color(0xffffff));
    this.enemyNeedleShellInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyNeedleShellInst.frustumCulled = false;
    this.group.add(this.enemyNeedleShellInst, this.enemyNeedleCoreInst);

    // 3c. Enemy 'orb': chunky spinning bullet-hell octahedron
    this.enemyOrbCoreInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX_ENEMY_CLASS_BULLETS
    );
    this.enemyOrbCoreInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyOrbCoreInst.frustumCulled = false;

    this.enemyOrbShellInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.64, 0),
      makePlasmaMat(0.88, 0.65, 1.65),
      MAX_ENEMY_CLASS_BULLETS
    );
    this.enemyOrbShellInst.setColorAt(0, new THREE.Color(0xffffff));
    this.enemyOrbShellInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyOrbShellInst.frustumCulled = false;
    this.group.add(this.enemyOrbShellInst, this.enemyOrbCoreInst);

    // 3d. Enemy 'petal': deceptive crystal blossom blade (Summoner signature)
    this.enemyPetalInst = new THREE.InstancedMesh(
      createPetalGeometry(),
      makePlasmaMat(0.95, 0.72, 1.72),
      MAX_ENEMY_CLASS_BULLETS
    );
    this.enemyPetalInst.setColorAt(0, new THREE.Color(0xffffff));
    this.enemyPetalInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyPetalInst.frustumCulled = false;
    this.group.add(this.enemyPetalInst);

    // Dynamic wingtip contrails, missile ribbons, and muzzle starburst flashes
    this.group.add(this.wingTrailL.mesh, this.wingTrailR.mesh);
    for (let i = 0; i < MAX_MISSILE_TRAILS; i++) {
      const tr = new DynamicRibbonTrail(18);
      this.group.add(tr.mesh);
      this.missileTrailPool.push(tr);
    }

    const muzzleGeo = new THREE.OctahedronGeometry(0.44, 0);
    muzzleGeo.scale(2.05, 0.68, 0.68);
    const muzzleCoreGeo = new THREE.OctahedronGeometry(0.24, 0);
    muzzleCoreGeo.scale(1.6, 0.65, 0.65);
    const muzzleMat = new THREE.MeshBasicMaterial({
      color: 0x8cf4ff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const muzzleCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const buildMuzzleStar = (): THREE.Group => {
      const grp = new THREE.Group();
      const finA = new THREE.Mesh(muzzleGeo, muzzleMat);
      const finB = new THREE.Mesh(muzzleGeo, muzzleMat);
      finB.rotation.x = Math.PI * 0.5;
      const core = new THREE.Mesh(muzzleCoreGeo, muzzleCoreMat);
      grp.add(finA, finB, core);
      grp.visible = false;
      return grp;
    };
    this.muzzleFlashL = buildMuzzleStar();
    this.muzzleFlashR = buildMuzzleStar();
    this.group.add(this.muzzleFlashL, this.muzzleFlashR);

    // 4. Muzzle charge bulbs (the enemy's loud "I'm about to shoot" glow)
    this.chargeOrbInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.65, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_CHARGE_ORBS
    );
    this.chargeOrbInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chargeOrbInst.frustumCulled = false;
    this.group.add(this.chargeOrbInst);

    // 5. Shiny beveled hex credits (space capitalism at its finest)
    this.coinInst = new THREE.InstancedMesh(
      createHexCreditChipGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffd744,
        emissive: 0xffaa00,
        emissiveIntensity: 1.25,
        metalness: 0.9,
        roughness: 0.16,
      }),
      MAX_COINS
    );
    this.coinInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinInst.frustumCulled = false;
    this.group.add(this.coinInst);

    // 6. Pooled GLSL3 shockwave rings (mach ripple + swirling wake)
    const swGeo = new THREE.PlaneGeometry(2.0, 2.0);
    swGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const mat = createShockwaveRingMaterial();
      const m = new THREE.Mesh(swGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.shockwavePool.push({ mesh: m, mat });
    }

    // 6b. Pooled 3D displaced fireballs (FBM turbulence + cooling blackbody ember curve)
    const fireballGeo = new THREE.IcosahedronGeometry(1.0, 3);
    for (let i = 0; i < MAX_FIREBALLS; i++) {
      const mat = createExplosionFireballMaterial();
      const mesh = new THREE.Mesh(fireballGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.fireballPool.push({
        mesh,
        mat,
        active: false,
        delay: 0,
        age: 0,
        duration: 0.6,
        startScale: 0.4,
        maxScale: 3.0,
        riseSpeed: 1.5,
        rotSpeedX: 0.8,
        rotSpeedY: 1.1,
      });
    }

    // 6c. Pooled half-sphere blast domes with hex energy shimmer
    const domeGeo = new THREE.SphereGeometry(1.0, 24, 14);
    for (let i = 0; i < MAX_BLAST_DOMES; i++) {
      const mat = createBlastDomeMaterial();
      const mesh = new THREE.Mesh(domeGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.blastDomePool.push({
        mesh,
        mat,
        active: false,
        age: 0,
        duration: 0.45,
        maxScale: 6.0,
      });
    }

    // 6d. Velocity-stretched hot sparks + spinning chunks of armor scrap
    this.sparkInst = new THREE.InstancedMesh(
      createSparkNeedleGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_SPARKS
    );
    this.sparkInst.setColorAt(0, new THREE.Color(0xffffff));
    this.sparkInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkInst.frustumCulled = false;
    this.group.add(this.sparkInst);

    this.debrisInst = new THREE.InstancedMesh(
      createDebrisPlateGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.86,
        roughness: 0.24,
        emissive: 0x331206,
        emissiveIntensity: 0.48,
      }),
      MAX_DEBRIS
    );
    this.debrisInst.setColorAt(0, new THREE.Color(0x8899aa));
    this.debrisInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisInst.frustumCulled = false;
    this.group.add(this.debrisInst);

    // 7. Ghostly afterimage silhouettes left behind when you spam Spacebar dash
    const ghostGeo = new THREE.ConeGeometry(1.15, 3.2, 4);
    ghostGeo.rotateZ(-Math.PI / 2);
    for (let i = 0; i < MAX_AFTERIMAGES; i++) {
      const m = new THREE.Mesh(
        ghostGeo,
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      m.visible = false;
      this.group.add(m);
      this.afterimagePool.push(m);
    }

    // 8. Enemy charge lane warnings + elite warp streak trails
    const dashLaneGeo = new THREE.PlaneGeometry(24, 3.6);
    dashLaneGeo.rotateX(-Math.PI / 2);
    dashLaneGeo.translate(12, 0, 0);

    const warpGeo = new THREE.PlaneGeometry(1, 0.9);
    warpGeo.rotateX(-Math.PI / 2);
    warpGeo.translate(0.5, 0, 0);

    for (let i = 0; i < MAX_ENEMY_TELEGRAPHS; i++) {
      const lane = new THREE.Mesh(
        dashLaneGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff33aa,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      lane.visible = false;
      this.group.add(lane);
      this.largeDashCorridors.push(lane);

      const warp = new THREE.Mesh(
        warpGeo,
        new THREE.MeshBasicMaterial({
          color: 0x22ffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      warp.visible = false;
      this.group.add(warp);
      this.eliteWarpBeams.push(warp);
    }

    // 9. Boss volumetric death ray + corkscrew plasma rings (do not stand in this)
    const beamLen = 130;
    const outerBeamGeo = new THREE.CylinderGeometry(1.55, 1.55, beamLen, 16, 1, true);
    outerBeamGeo.rotateZ(-Math.PI / 2);
    outerBeamGeo.translate(beamLen / 2, 0, 0);
    this.deathRayMat = createDeathRayMaterial();

    const coreBeamGeo = new THREE.CylinderGeometry(0.55, 0.55, beamLen, 10, 1, true);
    coreBeamGeo.rotateZ(-Math.PI / 2);
    coreBeamGeo.translate(beamLen / 2, 0, 0);
    const coreBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffffee,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const warnGeo = new THREE.PlaneGeometry(beamLen, 1.35);
    warnGeo.rotateX(-Math.PI / 2);
    warnGeo.translate(beamLen / 2, 0, 0);
    const warnMat = new THREE.MeshBasicMaterial({
      color: 0xff9f1c,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < MAX_BOSS_BEAMS; i++) {
      const outer = new THREE.Mesh(outerBeamGeo, this.deathRayMat);
      outer.visible = false;
      const core = new THREE.Mesh(coreBeamGeo, coreBeamMat);
      core.visible = false;
      const warn = new THREE.Mesh(warnGeo, warnMat);
      warn.visible = false;
      this.group.add(outer, core, warn);
      this.laserBeamMeshes.push(outer);
      this.laserCoreMeshes.push(core);
      this.laserWarningRibbons.push(warn);
    }

    const helixGeo = new THREE.TorusGeometry(2.0, 0.14, 8, 20);
    helixGeo.rotateY(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        helixGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffaa33,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.visible = false;
      this.group.add(ring);
      this.laserHelixRings.push(ring);
    }

    // 10. Boss overcharge core orb & gather ring

    this.laserChargeSphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffeeaa,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.laserChargeSphere.visible = false;

    const chargeRingGeo = new THREE.TorusGeometry(2.4, 0.12, 8, 24);
    chargeRingGeo.rotateX(Math.PI / 2);
    this.laserChargeRing = new THREE.Mesh(
      chargeRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff6622,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.laserChargeRing.visible = false;
    this.group.add(this.laserChargeSphere, this.laserChargeRing);

    // 11. Bright red "please step aside" boss rush corridor
    const corridorGeo = new THREE.PlaneGeometry(130, 8.8);
    corridorGeo.rotateX(-Math.PI / 2);
    corridorGeo.translate(65, 0, 0);
    this.chargeCorridorMesh = new THREE.Mesh(
      corridorGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff2222,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.chargeCorridorMesh.visible = false;
    this.group.add(this.chargeCorridorMesh);

    // 12. Boss hairline sniper sight beam
    const sniperGeo = new THREE.PlaneGeometry(1, 0.55);
    sniperGeo.rotateX(-Math.PI / 2);
    sniperGeo.translate(0.5, 0, 0);
    this.sniperRibbon = new THREE.Mesh(
      sniperGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffea55,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.sniperRibbon.visible = false;
    this.group.add(this.sniperRibbon);

    // 13. Boss windup converge halo & "shoot me now, I'm dizzy" overheat ring
    const skillRingGeo = new THREE.RingGeometry(0.88, 1.0, 28);
    skillRingGeo.rotateX(-Math.PI / 2);
    this.bossSkillChargeRing = new THREE.Mesh(
      skillRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.bossSkillChargeRing.visible = false;

    const restGeo = new THREE.RingGeometry(0.92, 1.04, 12);
    restGeo.rotateX(-Math.PI / 2);
    this.bossRestRing = new THREE.Mesh(
      restGeo,
      new THREE.MeshBasicMaterial({
        color: 0x33ff99,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.bossRestRing.visible = false;
    this.group.add(this.bossSkillChargeRing, this.bossRestRing);

    // 13b. Boss mutator props (shield pylons, holo decoys, orbital strikes, gravity wells, blink traces)
    this.bossAegisDome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        wireframe: true,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.bossAegisDome.visible = false;
    this.group.add(this.bossAegisDome);

    const blinkGeo = new THREE.PlaneGeometry(1, 0.85);
    blinkGeo.rotateX(-Math.PI / 2);
    blinkGeo.translate(0.5, 0, 0);
    this.bossBlinkRibbon = new THREE.Mesh(
      blinkGeo,
      new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.bossBlinkRibbon.visible = false;
    this.group.add(this.bossBlinkRibbon);

    // Gemini's neon plasma leash (warn ribbon -> outer flare -> white-hot beam)
    const tetherWarnGeo = new THREE.PlaneGeometry(1, 0.7);
    tetherWarnGeo.rotateX(-Math.PI / 2);
    tetherWarnGeo.translate(0.5, 0, 0);
    this.geminiTetherWarn = new THREE.Mesh(
      tetherWarnGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff44aa,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.geminiTetherWarn.visible = false;

    const tetherBeamGeo = new THREE.CylinderGeometry(0.62, 0.62, 1, 10, 1, true);
    tetherBeamGeo.rotateZ(-Math.PI / 2);
    tetherBeamGeo.translate(0.5, 0, 0);
    this.geminiTetherBeam = new THREE.Mesh(
      tetherBeamGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff2e88,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.geminiTetherBeam.visible = false;

    const tetherCoreGeo = new THREE.CylinderGeometry(0.24, 0.24, 1, 8, 1, true);
    tetherCoreGeo.rotateZ(-Math.PI / 2);
    tetherCoreGeo.translate(0.5, 0, 0);
    this.geminiTetherCore = new THREE.Mesh(
      tetherCoreGeo,
      new THREE.MeshBasicMaterial({
        color: 0xe0ffff,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.geminiTetherCore.visible = false;
    this.group.add(this.geminiTetherWarn, this.geminiTetherBeam, this.geminiTetherCore);

    const pylonCrystalGeo = new THREE.OctahedronGeometry(0.9, 0);
    const pylonRingGeo = new THREE.TorusGeometry(1.45, 0.09, 8, 22);
    pylonRingGeo.rotateX(Math.PI / 2);
    const tetherGeo = new THREE.CylinderGeometry(0.14, 0.14, 1, 8, 1, true);
    tetherGeo.rotateZ(-Math.PI / 2);
    tetherGeo.translate(0.5, 0, 0);

    for (let i = 0; i < MAX_BOSS_PYLONS; i++) {
      const group = new THREE.Group();
      const crystal = new THREE.Mesh(
        pylonCrystalGeo,
        new THREE.MeshBasicMaterial({
          color: 0x34d399,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const ring = new THREE.Mesh(
        pylonRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0x6ee7b7,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      group.add(crystal, ring);
      group.visible = false;

      const tether = new THREE.Mesh(
        tetherGeo,
        new THREE.MeshBasicMaterial({
          color: 0x34d399,
          transparent: true,
          opacity: 0.52,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      tether.visible = false;
      this.group.add(group, tether);
      this.bossPylonPool.push({ group, crystal, ring, tether });
    }

    const cloneHullGeo = new THREE.OctahedronGeometry(1, 0);
    cloneHullGeo.scale(2.1, 0.65, 1.5);
    const cloneRingGeo = new THREE.RingGeometry(1.45, 1.68, 20);
    cloneRingGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_BOSS_CLONES; i++) {
      const group = new THREE.Group();
      const hull = new THREE.Mesh(
        cloneHullGeo,
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          wireframe: true,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const ring = new THREE.Mesh(
        cloneRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      ring.position.y = -0.4;
      group.add(hull, ring);
      group.visible = false;
      this.group.add(group);
      this.bossClonePool.push({ group, hull, ring });
    }

    const hzOuterGeo = new THREE.RingGeometry(0.92, 1.0, 32);
    hzOuterGeo.rotateX(-Math.PI / 2);
    const hzFillGeo = new THREE.CircleGeometry(1, 32);
    hzFillGeo.rotateX(-Math.PI / 2);
    const hzPillarGeo = new THREE.CylinderGeometry(0.42, 0.68, 34, 16, 1, true);
    hzPillarGeo.translate(0, 17, 0);
    for (let i = 0; i < MAX_BOSS_HAZARDS; i++) {
      const outerRing = new THREE.Mesh(
        hzOuterGeo,
        new THREE.MeshBasicMaterial({
          color: 0xfb7185,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      outerRing.visible = false;
      const fillDisc = new THREE.Mesh(
        hzFillGeo,
        new THREE.MeshBasicMaterial({
          color: 0xfb7185,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      fillDisc.visible = false;
      const strikePillar = new THREE.Mesh(
        hzPillarGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffd1dc,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      strikePillar.visible = false;
      this.group.add(outerRing, fillDisc, strikePillar);
      this.bossHazardPool.push({ outerRing, fillDisc, strikePillar });
    }

    const wellCoreGeo = new THREE.IcosahedronGeometry(1.15, 1);
    const wellRingGeo = new THREE.RingGeometry(0.94, 1.0, 36);
    wellRingGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_BOSS_WELLS; i++) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        wellCoreGeo,
        new THREE.MeshBasicMaterial({
          color: 0x7e22ce,
          wireframe: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const innerRing = new THREE.Mesh(
        wellRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0xe879f9,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      const outerRing = new THREE.Mesh(
        wellRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          transparent: true,
          opacity: 0.36,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      group.add(core, innerRing, outerRing);
      group.visible = false;
      this.group.add(group);
      this.bossWellPool.push({ group, core, innerRing, outerRing });
    }

    // 14. Boss grand entrance rig (GLSL portal seal, sky pillar & closing focus rings)
    this.bossPortalMat = createBossPortalMaterial();
    const portalGeo = new THREE.PlaneGeometry(26, 26);
    portalGeo.rotateX(-Math.PI / 2);
    this.bossPortalMesh = new THREE.Mesh(portalGeo, this.bossPortalMat);
    this.bossPortalMesh.visible = false;
    this.bossPortalMesh.frustumCulled = false;

    const skyBeamGeo = new THREE.CylinderGeometry(1.1, 2.6, 56, 24, 1, true);
    this.bossSkyBeamMesh = new THREE.Mesh(
      skyBeamGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.bossSkyBeamMesh.visible = false;
    this.bossSkyBeamMesh.frustumCulled = false;

    const convergeGeo = new THREE.TorusGeometry(1.0, 0.085, 8, 36);
    convergeGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        convergeGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.visible = false;
      ring.frustumCulled = false;
      this.group.add(ring);
      this.bossConvergeRings.push(ring);
    }
    this.group.add(this.bossPortalMesh, this.bossSkyBeamMesh);

    // 14b. Pre-built boss transformation fireworks across all 3 phases
    const txPillarGeo = new THREE.CylinderGeometry(1.1, 2.6, 48, 20, 1, true);
    this.bossTransformPillar = new THREE.Mesh(
      txPillarGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffdd55,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.bossTransformPillar.visible = false;
    this.bossTransformPillar.frustumCulled = false;
    this.group.add(this.bossTransformPillar);

    const txRingGeo = new THREE.TorusGeometry(1.0, 0.095, 8, 36);
    txRingGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        txRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.visible = false;
      ring.frustumCulled = false;
      this.group.add(ring);
      this.bossTransformRings.push(ring);
    }

    const txBeamGeo = new THREE.PlaneGeometry(1.0, 1.35);
    txBeamGeo.rotateX(-Math.PI / 2);
    txBeamGeo.translate(0.5, 0, 0);
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(
        txBeamGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff5533,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      beam.visible = false;
      beam.frustumCulled = false;
      this.group.add(beam);
      this.bossTransformBeams.push(beam);
    }

    const txDebrisGeo = createDebrisPlateGeometry();
    for (let i = 0; i < 8; i++) {
      const shard = new THREE.Mesh(
        txDebrisGeo,
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xd9dee6 : 0xff9f1c,
          emissive: 0xff6611,
          emissiveIntensity: 0.85,
          metalness: 0.75,
          roughness: 0.25,
        })
      );
      shard.visible = false;
      shard.frustumCulled = false;
      this.group.add(shard);
      this.bossTransformDebris.push({ mesh: shard, vx: 0, vy: 0, vz: 0, vrx: 0, vry: 0 });
    }

    // 15. Player Rail-Lance cannon beam, EMP arc bolts & off-screen warning chevrons
    this.railBeamMat = createDeathRayMaterial();
    const rBeamOuterGeo = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 16, 1, true);
    rBeamOuterGeo.rotateZ(-Math.PI / 2);
    rBeamOuterGeo.translate(0.5, 0, 0);
    this.railBeamOuterMesh = new THREE.Mesh(rBeamOuterGeo, this.railBeamMat);
    this.railBeamOuterMesh.visible = false;
    this.railBeamOuterMesh.frustumCulled = false;

    const rBeamCoreGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.0, 12, 1, false);
    rBeamCoreGeo.rotateZ(-Math.PI / 2);
    rBeamCoreGeo.translate(0.5, 0, 0);
    this.railBeamCoreMesh = new THREE.Mesh(
      rBeamCoreGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.railBeamCoreMesh.visible = false;
    this.railBeamCoreMesh.frustumCulled = false;
    this.group.add(this.railBeamOuterMesh, this.railBeamCoreMesh);

    const railRingGeo = new THREE.TorusGeometry(1.2, 0.12, 8, 24);
    railRingGeo.rotateY(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const rr = new THREE.Mesh(
        railRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0x66f4ff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      rr.visible = false;
      rr.frustumCulled = false;
      this.group.add(rr);
      this.railBeamRings.push(rr);
    }

    for (let i = 0; i < MAX_LIGHTNING_ARCS; i++) {
      const posArr = new Float32Array(MAX_LIGHTNING_VERTS * 3);
      const posAttr = new THREE.BufferAttribute(posArr, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', posAttr);
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: 0x88f4ff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.group.add(line);
      this.lightningLines.push({ line, posAttr, mat });
    }

    const chevShape = new THREE.Shape();
    chevShape.moveTo(0.85, 0);
    chevShape.lineTo(-0.55, 0.72);
    chevShape.lineTo(-0.22, 0);
    chevShape.lineTo(-0.55, -0.72);
    chevShape.closePath();
    const chevGeo = new THREE.ShapeGeometry(chevShape);
    chevGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_EDGE_CHEVRONS; i++) {
      const m = new THREE.Mesh(
        chevGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff4455,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.edgeChevrons.push(m);
    }
  }

  private commitInstanced(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor && count > 0) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  private allocFireball(
    wx: number,
    wy: number,
    wz: number,
    startScale: number,
    maxScale: number,
    duration: number,
    delay: number,
    colorHex: number,
    riseSpeed: number
  ): void {
    let slot = this.fireballPool.find((f) => !f.active);
    if (!slot) {
      slot = this.fireballPool.reduce((oldest, cur) =>
        cur.age / cur.duration > oldest.age / oldest.duration ? cur : oldest
      );
    }
    slot.active = true;
    slot.delay = delay;
    slot.age = 0;
    slot.duration = duration;
    slot.startScale = startScale;
    slot.maxScale = maxScale;
    slot.riseSpeed = riseSpeed;
    slot.rotSpeedX = (Math.random() - 0.5) * 3.2;
    slot.rotSpeedY = (Math.random() - 0.5) * 3.6;
    slot.mesh.position.set(wx, wy, wz);
    slot.mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    slot.mesh.visible = delay <= 0;
    slot.mat.uniforms.uSeed.value = Math.random() * 100;
    slot.mat.uniforms.uProgress.value = 0;
    slot.mat.uniforms.uTint.value.setHex(colorHex);
  }

  private allocBlastDome(wx: number, wz: number, maxScale: number, duration: number, colorHex: number): void {
    let slot = this.blastDomePool.find((d) => !d.active);
    if (!slot) {
      slot = this.blastDomePool.reduce((oldest, cur) =>
        cur.age / cur.duration > oldest.age / oldest.duration ? cur : oldest
      );
    }
    slot.active = true;
    slot.age = 0;
    slot.duration = duration;
    slot.maxScale = maxScale;
    slot.mesh.position.set(wx, 0.15, wz);
    slot.mesh.visible = true;
    slot.mat.uniforms.uProgress.value = 0;
    slot.mat.uniforms.uColor.value.setHex(colorHex);
  }

  public spawnMuzzleBurst(
    arenaX: number,
    arenaY: number,
    angleRad: number,
    colorHex: number,
    heavy: boolean
  ): void {
    const wx = arenaToWorldX(arenaX);
    const wz = arenaToWorldZ(arenaY);
    const count = heavy ? 6 : 3;
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      const ang = angleRad + (Math.random() - 0.5) * 0.48;
      const spd = (heavy ? 28 : 22) + Math.random() * 12;
      this.sparks.push({
        x: wx,
        y: 0.36 + (Math.random() - 0.5) * 0.14,
        z: wz,
        vx: Math.cos(ang) * spd,
        vy: (Math.random() - 0.5) * 2.2,
        vz: Math.sin(ang) * spd,
        age: 0,
        duration: 0.07 + Math.random() * 0.05,
        thickness: heavy ? 0.92 : 0.62,
        colorHex: i === 0 ? 0xffffff : colorHex,
      });
    }
  }

  public spawnPickupPop(arenaX: number, arenaY: number, colorHex: number, isMajor: boolean): void {
    const wx = arenaToWorldX(arenaX);
    const wz = arenaToWorldZ(arenaY);
    if (this.extraShockwaves.length < 32) {
      this.extraShockwaves.push({
        x: wx,
        z: wz,
        maxRadius: isMajor ? 5.2 : 2.1,
        age: 0,
        duration: isMajor ? 0.28 : 0.15,
        colorHex,
      });
    }
    const count = isMajor ? 16 : 6;
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const spd = (isMajor ? 15 : 9) * (0.55 + Math.random() * 0.7);
      this.sparks.push({
        x: wx,
        y: 0.55,
        z: wz,
        vx: Math.cos(ang) * spd,
        vy: 5.0 + Math.random() * 6.0,
        vz: Math.sin(ang) * spd,
        age: 0,
        duration: isMajor ? 0.28 + Math.random() * 0.12 : 0.16 + Math.random() * 0.08,
        thickness: isMajor ? 1.05 : 0.7,
        colorHex: i % 3 === 0 ? 0xffffff : colorHex,
      });
    }
  }

  public spawnHitSparks(
    arenaX: number,
    arenaY: number,
    colorHex: number,
    isCrit: boolean,
    nx?: number,
    ny?: number
  ): void {
    const wx = arenaToWorldX(arenaX);
    const wz = arenaToWorldZ(arenaY);
    const count = isCrit ? 14 : 6;
    const hasNormal = nx !== undefined && ny !== undefined && nx * nx + ny * ny > 0.001;
    const coneCenter = hasNormal ? Math.atan2(ny!, nx!) : 0;

    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      const useCone = hasNormal && i < Math.ceil(count * 0.75);
      const ang = useCone
        ? coneCenter + (Math.random() - 0.5) * 1.15
        : Math.random() * Math.PI * 2;
      const baseSpd = isCrit ? (useCone ? 32 : 22) : useCone ? 22 : 14;
      const spd = baseSpd * (0.65 + Math.random() * 0.65);
      this.sparks.push({
        x: wx,
        y: 0.6 + Math.random() * 0.38,
        z: wz,
        vx: Math.cos(ang) * spd,
        vy: (Math.random() - 0.1) * spd * 0.42,
        vz: Math.sin(ang) * spd,
        age: 0,
        duration: isCrit ? 0.22 + Math.random() * 0.13 : 0.13 + Math.random() * 0.09,
        thickness: isCrit ? 1.2 : 0.78,
        colorHex: i % 3 === 0 ? 0xffffff : colorHex,
      });
    }

    if (isCrit) {
      this.extraShockwaves.push({
        x: wx,
        z: wz,
        maxRadius: 3.6,
        age: 0,
        duration: 0.21,
        colorHex: 0xffe866,
      });
    } else if (this.extraShockwaves.length < 28) {
      this.extraShockwaves.push({
        x: wx,
        z: wz,
        maxRadius: 1.75,
        age: 0,
        duration: 0.13,
        colorHex,
      });
    }
  }

  public spawnExplosion(arenaX: number, arenaY: number, tier: ExplosionTier, colorHex: number): void {
    const wx = arenaToWorldX(arenaX);
    const wz = arenaToWorldZ(arenaY);

    if (tier === 'small') {
      this.allocFireball(wx, 0.55, wz, 0.45, 2.25, 0.44, 0, colorHex, 1.4);
    } else if (tier === 'medium') {
      this.allocFireball(wx, 0.65, wz, 0.65, 3.6, 0.58, 0, colorHex, 1.7);
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const off = 0.7 + Math.random() * 0.8;
        this.allocFireball(
          wx + Math.cos(a) * off,
          0.5 + i * 0.2,
          wz + Math.sin(a) * off,
          0.4,
          2.1,
          0.48,
          0.05 + i * 0.06,
          colorHex,
          2.0
        );
      }
      this.allocBlastDome(wx, wz, 5.4, 0.36, colorHex);
    } else if (tier === 'heavy') {
      this.allocFireball(wx, 0.85, wz, 0.9, 5.8, 0.76, 0, colorHex, 1.9);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random() * 0.6;
        const off = 1.2 + Math.random() * 1.4;
        this.allocFireball(
          wx + Math.cos(a) * off,
          0.6 + Math.random() * 0.6,
          wz + Math.sin(a) * off,
          0.6,
          3.4,
          0.62,
          0.06 + i * 0.07,
          colorHex,
          2.3
        );
      }
      this.allocBlastDome(wx, wz, 11.2, 0.48, colorHex);
      this.extraShockwaves.push({ x: wx, z: wz, maxRadius: 14.5, age: 0, duration: 0.46, colorHex });
    } else {
      // 'boss': staged chain-explosion finale
      this.allocFireball(wx, 1.1, wz, 1.4, 9.8, 1.15, 0, colorHex, 2.1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
        const off = 2.0 + Math.random() * 2.8;
        this.allocFireball(
          wx + Math.cos(a) * off,
          0.7 + Math.random() * 1.1,
          wz + Math.sin(a) * off,
          0.9,
          5.6,
          0.92,
          0.07 + i * 0.08,
          i % 2 === 0 ? colorHex : 0xffcc44,
          2.5
        );
      }
      this.allocBlastDome(wx, wz, 19.5, 0.68, colorHex);
      this.extraShockwaves.push({ x: wx, z: wz, maxRadius: 24.0, age: 0, duration: 0.62, colorHex });
      this.extraShockwaves.push({
        x: wx,
        z: wz,
        maxRadius: 16.0,
        age: -0.1,
        duration: 0.5,
        colorHex: 0xfff2cc,
      });
    }

    const sparkCount = tier === 'small' ? 14 : tier === 'medium' ? 26 : tier === 'heavy' ? 48 : 84;
    const sparkSpeed = tier === 'small' ? 16 : tier === 'medium' ? 22 : tier === 'heavy' ? 30 : 40;
    for (let i = 0; i < sparkCount; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = sparkSpeed * (0.45 + Math.random() * 0.85);
      this.sparks.push({
        x: wx + (Math.random() - 0.5) * 0.8,
        y: 0.6 + Math.random() * 0.5,
        z: wz + (Math.random() - 0.5) * 0.8,
        vx: Math.cos(ang) * spd,
        vy: 1.5 + Math.random() * spd * 0.42,
        vz: Math.sin(ang) * spd,
        age: 0,
        duration: (tier === 'boss' ? 0.58 : 0.34) * (0.7 + Math.random() * 0.6),
        thickness: tier === 'boss' ? 1.55 : tier === 'heavy' ? 1.25 : 0.95,
        colorHex: i % 4 === 0 ? 0xffffff : colorHex,
      });
    }

    const debrisCount = tier === 'small' ? 6 : tier === 'medium' ? 12 : tier === 'heavy' ? 20 : 34;
    const debrisSpeed = tier === 'small' ? 9 : tier === 'medium' ? 13 : tier === 'heavy' ? 18 : 24;
    for (let i = 0; i < debrisCount; i++) {
      if (this.debris.length >= MAX_DEBRIS) this.debris.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = debrisSpeed * (0.4 + Math.random() * 0.9);
      this.debris.push({
        x: wx + (Math.random() - 0.5) * 1.1,
        y: 0.7 + Math.random() * 0.6,
        z: wz + (Math.random() - 0.5) * 1.1,
        vx: Math.cos(ang) * spd,
        vy: 3.5 + Math.random() * 6.5,
        vz: Math.sin(ang) * spd,
        rx: Math.random() * 6,
        ry: Math.random() * 6,
        rz: Math.random() * 6,
        vrx: (Math.random() - 0.5) * 14,
        vry: (Math.random() - 0.5) * 14,
        vrz: (Math.random() - 0.5) * 14,
        scale: (tier === 'boss' ? 1.5 : tier === 'heavy' ? 1.2 : 0.82) * (0.65 + Math.random() * 0.75),
        age: 0,
        duration: (tier === 'boss' ? 1.35 : 0.85) * (0.75 + Math.random() * 0.5),
        colorHex: i % 3 === 0 ? colorHex : 0x556275,
      });
    }
  }

  private resetExplosions(): void {
    for (const f of this.fireballPool) {
      f.active = false;
      f.mesh.visible = false;
    }
    for (const d of this.blastDomePool) {
      d.active = false;
      d.mesh.visible = false;
    }
    this.extraShockwaves.length = 0;
    this.sparks.length = 0;
    this.debris.length = 0;
    this.bossTransformState = null;
    this.bossTransformPillar.visible = false;
    for (const r of this.bossTransformRings) r.visible = false;
    for (const b of this.bossTransformBeams) b.visible = false;
    for (const d of this.bossTransformDebris) d.mesh.visible = false;
  }

  triggerBossTransformVfx(
    archetype: BossArchetype,
    phase: 2 | 3,
    ax: number,
    ay: number,
    hex: number,
    twinPos?: { x: number; y: number } | null,
    segments?: ReadonlyArray<{ x: number; y: number }>
  ): void {
    const duration = phase === 3 ? 1.65 : 1.45;
    this.bossTransformState = {
      active: true,
      archetype,
      phase,
      age: 0,
      duration,
      ax,
      ay,
      hex,
      hasTwin: Boolean(twinPos),
      twinX: twinPos ? twinPos.x : ax,
      twinY: twinPos ? twinPos.y : ay,
      segments: segments ? segments.map((s) => ({ x: s.x, y: s.y })) : [],
      leviathanWaveIdx: 0,
      summonerBursted: false,
    };

    const wx = arenaToWorldX(ax);
    const wz = arenaToWorldZ(ay);

    // Fling spinning armor chunks outward when Bastion sheds plates or hits Stage 3
    this.bossTransformDebris.forEach((slot, idx) => {
      const ang = (idx / this.bossTransformDebris.length) * Math.PI * 2 + Math.random() * 0.35;
      const spd = archetype === 5 ? 16.5 + Math.random() * 8 : 11 + Math.random() * 5;
      slot.mesh.position.set(wx, 1.1, wz);
      slot.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      slot.vx = Math.cos(ang) * spd;
      slot.vy = 6.5 + Math.random() * 6.5;
      slot.vz = Math.sin(ang) * spd;
      slot.vrx = (Math.random() - 0.5) * 14;
      slot.vry = (Math.random() - 0.5) * 14;
      const dMat = slot.mesh.material as THREE.MeshStandardMaterial;
      dMat.color.setHex(archetype === 5 ? (idx % 2 === 0 ? 0xe6edf5 : 0xff9f1c) : hex);
      dMat.emissive.setHex(archetype === 5 ? 0xff7711 : hex);
      slot.mesh.visible = archetype === 5 || phase === 3;
    });

    if (archetype === 0) {
      // Destroyer: chunky thermal blast + hot sparks
      this.spawnExplosion(ax, ay, 'heavy', 0xff4422);
      this.spawnHitSparks(ax, ay, 0xffaa33, true);
    } else if (archetype === 2) {
      // Overlord: blinding solar detonation flare
      this.spawnExplosion(ax, ay, 'heavy', 0xffdd55);
    } else if (archetype === 4 && twinPos) {
      // Gemini: double explosions going off in sync on both twins
      this.spawnExplosion(ax, ay, 'medium', 0x38e8ff);
      this.spawnExplosion(twinPos.x, twinPos.y, 'medium', 0xff2e88);
    } else if (archetype === 5) {
      // Bastion: heavy shrapnel pop as armor plates blow off
      this.spawnExplosion(ax, ay, 'heavy', 0xff9f1c);
      this.spawnHitSparks(ax, ay, 0xffdd66, true);
    }
  }

  private updateBossTransformVfx(state: GameState, elapsedSec: number, dt: number): void {
    const tx = this.bossTransformState;
    if (!tx || !tx.active) {
      this.bossTransformPillar.visible = false;
      for (const r of this.bossTransformRings) r.visible = false;
      for (const b of this.bossTransformBeams) b.visible = false;
      for (const d of this.bossTransformDebris) d.mesh.visible = false;
      return;
    }

    tx.age += dt;
    const t = Math.min(1, tx.age / tx.duration);
    if (tx.age >= tx.duration) {
      tx.active = false;
      this.bossTransformPillar.visible = false;
      for (const r of this.bossTransformRings) r.visible = false;
      for (const b of this.bossTransformBeams) b.visible = false;
      for (const d of this.bossTransformDebris) d.mesh.visible = false;
      return;
    }

    // Keep transformation rings glued to the boss while it's still flying around
    if (state.boss) {
      tx.ax = state.boss.x;
      tx.ay = state.boss.y;
      if (state.boss.twin) {
        tx.hasTwin = true;
        tx.twinX = state.boss.twin.x;
        tx.twinY = state.boss.twin.y;
      }
      if (state.boss.segments.length > 0) {
        tx.segments = state.boss.segments.map((s) => ({ x: s.x, y: s.y }));
      }
    }

    const bx = arenaToWorldX(tx.ax);
    const bz = arenaToWorldZ(tx.ay);
    const arch = tx.archetype;

    // 1. Overlord (2): dramatic golden sky pillar slamming down onto the boss
    if (arch === 2) {
      this.bossTransformPillar.visible = true;
      const pFade = Math.sin(t * Math.PI);
      const widen = 0.65 + (1 - t) * 0.95 + (tx.phase === 3 ? 0.45 : 0);
      this.bossTransformPillar.position.set(bx, 22, bz);
      this.bossTransformPillar.scale.set(widen, 1, widen);
      const pMat = this.bossTransformPillar.material as THREE.MeshBasicMaterial;
      pMat.color.setHex(tx.phase === 3 ? 0xffe484 : 0xffcc22);
      pMat.opacity = pFade * 0.68;
    } else {
      this.bossTransformPillar.visible = false;
    }

    // 2. Phase-transition shock rings tailored to each boss's vibe
    if (arch === 1) {
      // Summoner: suck everything inward (t < 0.34), then erupt into a rift nova (t >= 0.34)
      if (t >= 0.34 && !tx.summonerBursted) {
        tx.summonerBursted = true;
        this.spawnExplosion(tx.ax, tx.ay, 'boss', 0xc026d3);
      }
      for (let i = 0; i < this.bossTransformRings.length; i++) {
        const ring = this.bossTransformRings[i];
        ring.visible = true;
        const rMat = ring.material as THREE.MeshBasicMaterial;
        rMat.color.setHex(i === 1 ? 0x22d3ee : 0xd946ef);
        if (t < 0.34) {
          const imp = t / 0.34;
          const r = (13.0 - i * 2.4) * (1 - imp) + 1.0;
          ring.position.set(bx, 0.8 + imp * 1.4, bz);
          ring.scale.setScalar(Math.max(0.4, r));
          rMat.opacity = 0.78 * imp;
        } else {
          const exp = (t - 0.34) / 0.66;
          const r = 1.5 + exp * (13.5 + i * 3.0);
          ring.position.set(bx, 1.0, bz);
          ring.scale.setScalar(r);
          rMat.opacity = 0.88 * (1 - exp);
        }
      }
    } else if (arch === 4 && tx.hasTwin) {
      // Gemini: Cyan ring on Alpha, hot pink on Omega, and a midpoint clash ring
      const ptX = arenaToWorldX(tx.twinX);
      const ptZ = arenaToWorldZ(tx.twinY);
      const pts: Array<[number, number, number]> = [
        [bx, bz, 0x38e8ff],
        [ptX, ptZ, 0xff2e88],
        [(bx + ptX) * 0.5, (bz + ptZ) * 0.5, 0xffffff],
      ];
      for (let i = 0; i < this.bossTransformRings.length; i++) {
        const ring = this.bossTransformRings[i];
        const [rx, rz, rcol] = pts[i];
        const lt = Math.max(0, Math.min(1, t * 1.35 - i * 0.12));
        ring.visible = lt > 0 && lt < 1;
        ring.position.set(rx, 0.85, rz);
        ring.scale.setScalar(1.8 + lt * (i === 2 ? 12.5 : 10.5));
        const rMat = ring.material as THREE.MeshBasicMaterial;
        rMat.color.setHex(rcol);
        rMat.opacity = (1 - lt) * 0.85;
      }
    } else {
      // Expanding shock rings matched to the boss's signature palette
      for (let i = 0; i < this.bossTransformRings.length; i++) {
        const ring = this.bossTransformRings[i];
        const lt = Math.max(0, Math.min(1, t * 1.4 - i * 0.16));
        ring.visible = lt > 0 && lt < 1;
        ring.position.set(bx, 0.7 + lt * 0.9, bz);
        ring.scale.setScalar(2.0 + lt * (11.5 + i * 2.8));
        const rMat = ring.material as THREE.MeshBasicMaterial;
        rMat.color.setHex(i === 2 ? 0xffffff : tx.hex);
        rMat.opacity = (1 - lt) * 0.88;
      }
    }

    // 3. Leviathan (3): staggered plasma ripples cascading down all 6 spine joints
    if (arch === 3 && tx.segments.length > 0) {
      const targetIdx = Math.min(tx.segments.length, Math.floor(tx.age / 0.11));
      while (tx.leviathanWaveIdx < targetIdx) {
        const seg = tx.segments[tx.leviathanWaveIdx];
        if (seg) {
          this.spawnExplosion(seg.x, seg.y, 'small', 0x10f5a8);
          this.spawnHitSparks(seg.x, seg.y, 0x34f5c5, true);
        }
        tx.leviathanWaveIdx++;
      }
    }

    // 4. Evolution beams: Destroyer 4-way thruster flare (0) & Gemini twin tether surge (4)
    if (arch === 0) {
      const beamLen = (1 - t * 0.4) * (14.5 + tx.phase * 3.5);
      for (let i = 0; i < this.bossTransformBeams.length; i++) {
        const beam = this.bossTransformBeams[i];
        beam.visible = true;
        beam.position.set(bx, 0.9, bz);
        beam.rotation.y = elapsedSec * 2.8 + (i * Math.PI) / 2;
        beam.scale.set(beamLen, 1, (1 - t) * 2.2);
        const bMat = beam.material as THREE.MeshBasicMaterial;
        bMat.color.setHex(i % 2 === 0 ? 0xff4422 : 0xffbb33);
        bMat.opacity = (1 - t) * 0.88;
      }
    } else if (arch === 4 && tx.hasTwin) {
      const ptX = arenaToWorldX(tx.twinX);
      const ptZ = arenaToWorldZ(tx.twinY);
      const dx = ptX - bx;
      const dz = ptZ - bz;
      const dist = Math.max(0.2, Math.hypot(dx, dz));
      const syncBeam = this.bossTransformBeams[0];
      syncBeam.visible = true;
      syncBeam.position.set(bx, 0.95, bz);
      syncBeam.rotation.y = -Math.atan2(dz, dx);
      syncBeam.scale.set(dist, 1, (1 - t) * (2.6 + Math.sin(elapsedSec * 42) * 0.8));
      const sMat = syncBeam.material as THREE.MeshBasicMaterial;
      sMat.color.setHex(Math.sin(elapsedSec * 28) > 0 ? 0x38e8ff : 0xff2e88);
      sMat.opacity = (1 - t) * 0.92;
      for (let i = 1; i < this.bossTransformBeams.length; i++) {
        this.bossTransformBeams[i].visible = false;
      }
    } else {
      for (const b of this.bossTransformBeams) b.visible = false;
    }

    // 5. Flying armor shrapnel for Bastion plate breaks & Stage 3 apex bursts
    if (arch === 5 || tx.phase === 3) {
      for (const slot of this.bossTransformDebris) {
        if (!slot.mesh.visible) continue;
        slot.mesh.position.x += slot.vx * dt;
        slot.mesh.position.y = Math.max(0.15, slot.mesh.position.y + slot.vy * dt);
        slot.mesh.position.z += slot.vz * dt;
        slot.vy -= 14.0 * dt;
        slot.mesh.rotation.x += slot.vrx * dt;
        slot.mesh.rotation.y += slot.vry * dt;
        const sScale = Math.max(0.05, (1 - t) * (arch === 5 ? 1.85 : 1.15));
        slot.mesh.scale.setScalar(sScale);
      }
    }
  }

  update(state: GameState, elapsedSec: number, frameDt = 1 / 60): void {
    const dt = Math.min(0.05, Math.max(0.001, frameDt));
    const now = state.simTimeMs;

    if (state.phase === 'MENU') {
      this.resetExplosions();
    }

    for (const mat of this.plasmaMaterials) {
      mat.uniforms.uTime.value = elapsedSec;
    }
    this.deathRayMat.uniforms.uTime.value = elapsedSec;
    this.updateBossTransformVfx(state, elapsedSec, dt);

    // 0. Player wingtip contrails, muzzle flashes & homing missile ribbons
    if (state.phase === 'PLAYING' || state.phase === 'PAUSED' || state.phase === 'SHOP') {
      const p = state.player;
      const px = arenaToWorldX(p.x);
      const pz = arenaToWorldZ(p.y);
      const cosF = Math.cos(p.facingAngle);
      const sinF = Math.sin(p.facingAngle);

      const wingX = p.dashActive ? -1.48 : -1.24;
      const wingSpan = p.dashActive ? 1.88 : 2.46;
      const trailCol = p.dashActive ? 0x66ffff : 0x22ccff;
      const trailW = p.dashActive ? 0.34 : p.moving ? 0.19 : 0.10;

      // Map Blender +Y wingtips into Three.js -/+Z (left & right wing edges)
      const lx = px + wingX * cosF + wingSpan * sinF;
      const lz = pz + wingX * sinF - wingSpan * cosF;
      const rx = px + wingX * cosF - wingSpan * sinF;
      const rz = pz + wingX * sinF + wingSpan * cosF;

      this.wingTrailL.update(lx, 0.52, lz, trailW, trailCol, p.dashActive ? 1.1 : 0.72);
      this.wingTrailR.update(rx, 0.52, rz, trailW, trailCol, p.dashActive ? 1.1 : 0.72);

      if (p.shotRecoil > 0.42) {
        const gunX = 1.52;
        const gunZ = 1.15;
        this.muzzleFlashL.visible = true;
        this.muzzleFlashR.visible = true;
        this.muzzleFlashL.position.set(px + gunX * cosF + gunZ * sinF, 0.25, pz + gunX * sinF - gunZ * cosF);
        this.muzzleFlashR.position.set(px + gunX * cosF - gunZ * sinF, 0.25, pz + gunX * sinF + gunZ * cosF);
        this.muzzleFlashL.rotation.set(elapsedSec * 25, -p.facingAngle, 0);
        this.muzzleFlashR.rotation.set(-elapsedSec * 25, -p.facingAngle, 0);
        const mScale = 0.45 + p.shotRecoil * 0.95;
        this.muzzleFlashL.scale.setScalar(mScale);
        this.muzzleFlashR.scale.setScalar(mScale);
      } else {
        this.muzzleFlashL.visible = false;
        this.muzzleFlashR.visible = false;
      }
    } else {
      this.wingTrailL.reset();
      this.wingTrailR.reset();
      this.muzzleFlashL.visible = false;
      this.muzzleFlashR.visible = false;
    }

    // Nova missile contrails
    const activeBombs = new Set<number>();
    for (const b of state.bombs) {
      activeBombs.add(b.id);
      let tr = this.missileTrailMap.get(b.id);
      if (!tr) {
        const free = this.missileTrailPool.find((poolItem) => {
          for (const v of this.missileTrailMap.values()) {
            if (v === poolItem) return false;
          }
          return true;
        });
        if (free) {
          free.reset();
          this.missileTrailMap.set(b.id, free);
          tr = free;
        }
      }
      if (tr) {
        const tailX = arenaToWorldX(b.x) - Math.cos(b.angle) * 0.9;
        const tailZ = arenaToWorldZ(b.y) - Math.sin(b.angle) * 0.9;
        tr.update(tailX, 0.72, tailZ, 0.28, 0x38e8ff, 0.95);
      }
    }
    for (const [id, tr] of this.missileTrailMap.entries()) {
      if (!activeBombs.has(id)) {
        tr.reset();
        this.missileTrailMap.delete(id);
      }
    }

    // 1. All spark & dust particles
    const pCount = Math.min(state.particles.length, MAX_PARTICLES);
    for (let i = 0; i < pCount; i++) {
      const pt = state.particles[i];
      this.dummy.position.set(arenaToWorldX(pt.x), 0.3 + pt.z * 0.25, arenaToWorldZ(pt.y));
      const s = Math.max(0.05, pt.size * 0.42);
      this.dummy.scale.set(s, s, s);
      this.dummy.rotation.set(elapsedSec * 4 + i, elapsedSec * 3 + i, 0);
      this.dummy.updateMatrix();
      this.particleInst.setMatrixAt(i, this.dummy.matrix);
      this.tempColor.setHex(pt.hex);
      this.particleInst.setColorAt(i, this.tempColor);
    }
    this.commitInstanced(this.particleInst, pCount);

    // 2. Dual-layer player & enemy projectiles
    let pCountB = 0;
    let boltCount = 0;
    let needleCount = 0;
    let orbCount = 0;
    let petalCount = 0;

    for (const b of state.bullets) {
      const wx = arenaToWorldX(b.x);
      const wz = arenaToWorldZ(b.y);
      const angleY = -Math.atan2(b.dy, b.dx);

      if (!b.isEnemy) {
        if (pCountB >= MAX_PLAYER_BULLETS) continue;
        const lenMult = b.visualStyle === 'needle' || b.isCritVisual ? 1.38 : 1.0;
        const thickMult = b.isCritVisual ? 1.25 : 1.0;

        this.dummy.position.set(wx, 0.38, wz);
        this.dummy.rotation.set(0, angleY, 0);
        this.dummy.scale.set(lenMult, thickMult, thickMult);
        this.dummy.updateMatrix();

        this.playerBulletCoreInst.setMatrixAt(pCountB, this.dummy.matrix);
        this.playerBulletGlowInst.setMatrixAt(pCountB, this.dummy.matrix);
        this.tempColor.setHex(b.hex);
        this.playerBulletGlowInst.setColorAt(pCountB, this.tempColor);
        pCountB++;
      } else {
        const style = b.visualStyle ?? 'orb';
        const baseScale = (b.radius / 5.5) * (b.isCritVisual ? 1.35 : 1.0);
        this.tempColor.setHex(b.hex);

        if (style === 'bolt') {
          if (boltCount >= MAX_ENEMY_CLASS_BULLETS) continue;
          this.dummy.position.set(wx, 0.45, wz);
          this.dummy.rotation.set(0, angleY, 0);
          this.dummy.scale.setScalar(baseScale);
          this.dummy.updateMatrix();
          this.enemyBoltCoreInst.setMatrixAt(boltCount, this.dummy.matrix);
          this.enemyBoltShellInst.setMatrixAt(boltCount, this.dummy.matrix);
          this.enemyBoltShellInst.setColorAt(boltCount, this.tempColor);
          boltCount++;
        } else if (style === 'needle') {
          if (needleCount >= MAX_ENEMY_CLASS_BULLETS) continue;
          this.dummy.position.set(wx, 0.48, wz);
          this.dummy.rotation.set(0, angleY, 0);
          this.dummy.scale.setScalar(baseScale);
          this.dummy.updateMatrix();
          this.enemyNeedleCoreInst.setMatrixAt(needleCount, this.dummy.matrix);
          this.enemyNeedleShellInst.setMatrixAt(needleCount, this.dummy.matrix);
          this.enemyNeedleShellInst.setColorAt(needleCount, this.tempColor);
          needleCount++;
        } else if (style === 'petal') {
          if (petalCount >= MAX_ENEMY_CLASS_BULLETS) continue;
          this.dummy.position.set(wx, 0.5, wz);
          this.dummy.rotation.set(
            Math.sin(elapsedSec * 5 + b.id) * 0.4,
            angleY + elapsedSec * 3.5,
            Math.cos(elapsedSec * 4 + b.id) * 0.3
          );
          this.dummy.scale.setScalar(baseScale * 1.15);
          this.dummy.updateMatrix();
          this.enemyPetalInst.setMatrixAt(petalCount, this.dummy.matrix);
          this.enemyPetalInst.setColorAt(petalCount, this.tempColor);
          petalCount++;
        } else {
          if (orbCount >= MAX_ENEMY_CLASS_BULLETS) continue;
          this.dummy.position.set(wx, 0.46, wz);
          this.dummy.rotation.set(elapsedSec * 4 + b.id, elapsedSec * 5 + b.id, 0);
          this.dummy.scale.setScalar(baseScale);
          this.dummy.updateMatrix();
          this.enemyOrbCoreInst.setMatrixAt(orbCount, this.dummy.matrix);
          this.enemyOrbShellInst.setMatrixAt(orbCount, this.dummy.matrix);
          this.enemyOrbShellInst.setColorAt(orbCount, this.tempColor);
          orbCount++;
        }
      }
    }

    this.commitInstanced(this.playerBulletCoreInst, pCountB);
    this.commitInstanced(this.playerBulletGlowInst, pCountB);
    this.commitInstanced(this.enemyBoltCoreInst, boltCount);
    this.commitInstanced(this.enemyBoltShellInst, boltCount);
    this.commitInstanced(this.enemyNeedleCoreInst, needleCount);
    this.commitInstanced(this.enemyNeedleShellInst, needleCount);
    this.commitInstanced(this.enemyOrbCoreInst, orbCount);
    this.commitInstanced(this.enemyOrbShellInst, orbCount);
    this.commitInstanced(this.enemyPetalInst, petalCount);

    // 3. Enemy windup orbs + dash lane banners + elite warp streaks
    let chargeCount = 0;
    let dashLaneIdx = 0;
    let warpBeamIdx = 0;

    for (const e of state.enemies) {
      if (e.type === 'medium') {
        const since = now - e.lastShotMs;
        if (since > 1700 && since < 2400 && chargeCount < MAX_CHARGE_ORBS) {
          const prog = (since - 1700) / 700;
          const mx = e.x + Math.cos(e.faceAngle) * e.radius;
          const my = e.y + Math.sin(e.faceAngle) * e.radius;
          this.dummy.position.set(arenaToWorldX(mx), 0.52, arenaToWorldZ(my));
          this.dummy.rotation.set(elapsedSec * 8, elapsedSec * 6, 0);
          this.dummy.scale.setScalar(0.35 + prog * 0.95);
          this.dummy.updateMatrix();
          this.chargeOrbInst.setMatrixAt(chargeCount, this.dummy.matrix);
          this.tempColor.setHex(0x00eeff);
          this.chargeOrbInst.setColorAt(chargeCount, this.tempColor);
          chargeCount++;
        }
      } else if (e.type === 'large') {
        if (e.aiState === 'windup') {
          if (chargeCount < MAX_CHARGE_ORBS) {
            const prog = 1 - Math.max(0, e.dashTimer) / 28;
            const mx = e.x + e.dashDirX * e.radius;
            const my = e.y + e.dashDirY * e.radius;
            this.dummy.position.set(arenaToWorldX(mx), 0.55, arenaToWorldZ(my));
            this.dummy.rotation.set(elapsedSec * 10, elapsedSec * 8, 0);
            this.dummy.scale.setScalar(0.5 + prog * 1.25);
            this.dummy.updateMatrix();
            this.chargeOrbInst.setMatrixAt(chargeCount, this.dummy.matrix);
            this.tempColor.setHex(0xff33cc);
            this.chargeOrbInst.setColorAt(chargeCount, this.tempColor);
            chargeCount++;
          }
          if (dashLaneIdx < MAX_ENEMY_TELEGRAPHS) {
            const lane = this.largeDashCorridors[dashLaneIdx++];
            lane.visible = true;
            lane.position.set(arenaToWorldX(e.x), 0.08, arenaToWorldZ(e.y));
            lane.rotation.y = -Math.atan2(e.dashDirY, e.dashDirX);
            (lane.material as THREE.MeshBasicMaterial).opacity =
              0.22 + Math.sin(elapsedSec * 30) * 0.12;
          }
        }
      } else if (e.type === 'elite') {
        const since = now - e.lastShotMs;
        if (e.warpWarmupTimer > 0 && chargeCount < MAX_CHARGE_ORBS) {
          const prog = 1 - e.warpWarmupTimer / 28;
          this.dummy.position.set(arenaToWorldX(e.x), 0.65, arenaToWorldZ(e.y));
          this.dummy.rotation.set(elapsedSec * 12, -elapsedSec * 9, 0);
          this.dummy.scale.setScalar(0.6 + prog * 1.4);
          this.dummy.updateMatrix();
          this.chargeOrbInst.setMatrixAt(chargeCount, this.dummy.matrix);
          this.tempColor.setHex(0x22ffff);
          this.chargeOrbInst.setColorAt(chargeCount, this.tempColor);
          chargeCount++;
        } else if (since > 1300 && since < 1850 && chargeCount < MAX_CHARGE_ORBS) {
          const prog = (since - 1300) / 550;
          const mx = e.x + Math.cos(e.faceAngle) * e.radius;
          const my = e.y + Math.sin(e.faceAngle) * e.radius;
          this.dummy.position.set(arenaToWorldX(mx), 0.58, arenaToWorldZ(my));
          this.dummy.rotation.set(elapsedSec * 9, elapsedSec * 7, 0);
          this.dummy.scale.setScalar(0.4 + prog * 0.9);
          this.dummy.updateMatrix();
          this.chargeOrbInst.setMatrixAt(chargeCount, this.dummy.matrix);
          this.tempColor.setHex(0xffdd44);
          this.chargeOrbInst.setColorAt(chargeCount, this.tempColor);
          chargeCount++;
        }

        if (e.warpLineTimer > 0 && warpBeamIdx < MAX_ENEMY_TELEGRAPHS) {
          const beam = this.eliteWarpBeams[warpBeamIdx++];
          const sx = arenaToWorldX(e.warpStartX);
          const sz = arenaToWorldZ(e.warpStartY);
          const ex = arenaToWorldX(e.x);
          const ez = arenaToWorldZ(e.y);
          const dx = ex - sx;
          const dz = ez - sz;
          const len = Math.max(0.1, Math.hypot(dx, dz));
          beam.visible = true;
          beam.position.set(sx, 0.5, sz);
          beam.rotation.y = -Math.atan2(dz, dx);
          const ratio = e.warpLineTimer / 32;
          beam.scale.set(len, 1, 0.5 + ratio * 1.2);
          (beam.material as THREE.MeshBasicMaterial).opacity = ratio * 0.85;
        }
      }
    }

    this.commitInstanced(this.chargeOrbInst, chargeCount);
    for (let i = dashLaneIdx; i < MAX_ENEMY_TELEGRAPHS; i++) {
      this.largeDashCorridors[i].visible = false;
    }
    for (let i = warpBeamIdx; i < MAX_ENEMY_TELEGRAPHS; i++) {
      this.eliteWarpBeams[i].visible = false;
    }

    // 4. Spinning 3D hex credit drops
    const cCount = Math.min(state.goldPickups.length, MAX_COINS);
    for (let i = 0; i < cCount; i++) {
      const g = state.goldPickups[i];
      this.dummy.position.set(
        arenaToWorldX(g.x),
        0.55 + Math.sin(elapsedSec * 7 + i) * 0.25,
        arenaToWorldZ(g.y)
      );
      const sc = Math.max(0.68, g.size * 0.14);
      this.dummy.scale.set(sc, sc, sc);
      this.dummy.rotation.set(0.35, elapsedSec * 5 + i * 0.7, 0);
      this.dummy.updateMatrix();
      this.coinInst.setMatrixAt(i, this.dummy.matrix);
    }
    this.coinInst.count = cCount;
    this.coinInst.instanceMatrix.needsUpdate = true;

    // 5. GLSL3 SDF shockwave rings (sim + extra chain-explosion booms)
    let swIdx = 0;
    for (let i = 0; i < state.shockwaves.length && swIdx < MAX_SHOCKWAVES; i++) {
      const sw = state.shockwaves[i];
      const slot = this.shockwavePool[swIdx++];
      slot.mesh.visible = true;
      slot.mesh.position.set(arenaToWorldX(sw.x), 0.12, arenaToWorldZ(sw.y));
      const r = Math.max(0.1, sw.radius * WORLD_SCALE);
      slot.mesh.scale.set(r, r, r);
      const t = 1 - Math.max(0, sw.life / Math.max(1, sw.maxLife));
      slot.mat.uniforms.uTime.value = elapsedSec;
      slot.mat.uniforms.uProgress.value = t;
      slot.mat.uniforms.uColor.value.setHex(sw.hex);
    }

    for (let i = this.extraShockwaves.length - 1; i >= 0; i--) {
      const es = this.extraShockwaves[i];
      es.age += dt;
      if (es.age >= es.duration) {
        this.extraShockwaves.splice(i, 1);
        continue;
      }
      if (es.age < 0 || swIdx >= MAX_SHOCKWAVES) continue;
      const t = es.age / es.duration;
      const easeOut = 1 - (1 - t) ** 3;
      const r = Math.max(0.2, easeOut * es.maxRadius);
      const slot = this.shockwavePool[swIdx++];
      slot.mesh.visible = true;
      slot.mesh.position.set(es.x, 0.16, es.z);
      slot.mesh.scale.set(r, r, r);
      slot.mat.uniforms.uTime.value = elapsedSec;
      slot.mat.uniforms.uProgress.value = t;
      slot.mat.uniforms.uColor.value.setHex(es.colorHex);
    }
    for (let i = swIdx; i < MAX_SHOCKWAVES; i++) {
      this.shockwavePool[i].mesh.visible = false;
    }

    // 5b. 3D displaced noise fireballs
    for (const fb of this.fireballPool) {
      if (!fb.active) continue;
      if (fb.delay > 0) {
        fb.delay -= dt;
        continue;
      }
      fb.age += dt;
      if (fb.age >= fb.duration) {
        fb.active = false;
        fb.mesh.visible = false;
        continue;
      }
      const t = fb.age / fb.duration;
      const easeOut = 1 - (1 - t) ** 2.4;
      const sc = fb.startScale + (fb.maxScale - fb.startScale) * easeOut;
      fb.mesh.visible = true;
      fb.mesh.scale.setScalar(sc);
      fb.mesh.position.y += fb.riseSpeed * dt;
      fb.mesh.rotation.x += fb.rotSpeedX * dt;
      fb.mesh.rotation.y += fb.rotSpeedY * dt;
      fb.mat.uniforms.uTime.value = elapsedSec;
      fb.mat.uniforms.uProgress.value = t;
    }

    // 5c. Expanding hemispherical blast domes
    for (const dm of this.blastDomePool) {
      if (!dm.active) continue;
      dm.age += dt;
      if (dm.age >= dm.duration) {
        dm.active = false;
        dm.mesh.visible = false;
        continue;
      }
      const t = dm.age / dm.duration;
      const easeOut = 1 - (1 - t) ** 3;
      const sc = Math.max(0.25, easeOut * dm.maxScale);
      dm.mesh.visible = true;
      dm.mesh.scale.set(sc, sc * 0.72, sc);
      dm.mat.uniforms.uTime.value = elapsedSec;
      dm.mat.uniforms.uProgress.value = t;
    }

    // 5d. Velocity-stretched hot metal sparks
    let spCount = 0;
    const sparkDrag = Math.exp(-3.6 * dt);
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.age += dt;
      if (sp.age >= sp.duration) {
        this.sparks.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.z += sp.vz * dt;
      sp.vx *= sparkDrag;
      sp.vy -= 9.0 * dt;
      sp.vz *= sparkDrag;

      const t = sp.age / sp.duration;
      const spd = Math.hypot(sp.vx, sp.vz);
      const yaw = -Math.atan2(sp.vz, sp.vx);
      const lenScale = Math.max(0.35, (0.45 + spd * 0.085) * (1 - t * 0.6));
      const thick = sp.thickness * (1 - t * 0.75);

      this.dummy.position.set(sp.x, sp.y, sp.z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.set(lenScale, thick, thick);
      this.dummy.updateMatrix();
      this.sparkInst.setMatrixAt(spCount, this.dummy.matrix);
      this.tempColor.setHex(sp.colorHex).multiplyScalar(1.3 - t * 0.9);
      this.sparkInst.setColorAt(spCount, this.tempColor);
      spCount++;
    }
    this.commitInstanced(this.sparkInst, spCount);

    // 5e. Spinning hull scrap plates
    let dbCount = 0;
    const debrisDrag = Math.exp(-1.4 * dt);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const db = this.debris[i];
      db.age += dt;
      if (db.age >= db.duration) {
        this.debris.splice(i, 1);
        continue;
      }
      db.x += db.vx * dt;
      db.y += db.vy * dt;
      db.z += db.vz * dt;
      db.vx *= debrisDrag;
      db.vz *= debrisDrag;
      db.vy -= 14.0 * dt;
      db.rx += db.vrx * dt;
      db.ry += db.vry * dt;
      db.rz += db.vrz * dt;

      const t = db.age / db.duration;
      const sc = db.scale * (1 - Math.max(0, (t - 0.55) / 0.45));
      this.dummy.position.set(db.x, db.y, db.z);
      this.dummy.rotation.set(db.rx, db.ry, db.rz);
      this.dummy.scale.setScalar(Math.max(0.02, sc));
      this.dummy.updateMatrix();
      this.debrisInst.setMatrixAt(dbCount, this.dummy.matrix);
      this.tempColor.setHex(db.colorHex);
      this.debrisInst.setColorAt(dbCount, this.tempColor);
      dbCount++;
    }
    this.commitInstanced(this.debrisInst, dbCount);

    // 6. Dash ghost silhouettes fading cyan-to-violet
    for (let i = 0; i < MAX_AFTERIMAGES; i++) {
      const mesh = this.afterimagePool[i];
      const ai = state.afterimages[i];
      if (!ai) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(arenaToWorldX(ai.x), 0.25, arenaToWorldZ(ai.y));
      mesh.rotation.set(0, -ai.angle, 0);
      const ratio = ai.life / Math.max(1, ai.maxLife);
      mesh.scale.set(1.0 + (1 - ratio) * 0.45, 0.4, 0.92);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(this.afterimageCyan).lerp(this.afterimageViolet, 1 - ratio);
      mat.opacity = ratio * 0.52;
    }

    // 7. Boss hardware show: death rays, shield pylons, decoys, orbital strikes & gravity wells
    const boss = state.boss;
    if (boss && !boss.dying) {
      const bx = arenaToWorldX(boss.x);
      const bz = arenaToWorldZ(boss.y);
      const beamCount = Math.min(MAX_BOSS_BEAMS, Math.max(1, boss.laserBeamCount || 1));

      if (boss.laserFiring) {
        this.deathRayMat.uniforms.uTint.value.setHex(boss.hex);
        const pulse = 0.85 + Math.sin(elapsedSec * 40) * 0.25;
        for (let k = 0; k < MAX_BOSS_BEAMS; k++) {
          const active = k < beamCount;
          const outer = this.laserBeamMeshes[k];
          const core = this.laserCoreMeshes[k];
          outer.visible = active;
          core.visible = active;
          if (active) {
            const ang = boss.laserAngle + (k * Math.PI * 2) / beamCount;
            outer.position.set(bx, 0.65, bz);
            core.position.set(bx, 0.65, bz);
            outer.rotation.y = -ang;
            core.rotation.y = -ang;
            outer.scale.set(1, pulse, pulse);
          }
        }

        for (let i = 0; i < this.laserHelixRings.length; i++) {
          const ring = this.laserHelixRings[i];
          const bAng = boss.laserAngle + ((i % beamCount) * Math.PI * 2) / beamCount;
          ring.visible = true;
          const travel = (elapsedSec * 48 + i * 16) % 72;
          ring.position.set(bx + Math.cos(bAng) * travel, 0.65, bz + Math.sin(bAng) * travel);
          ring.rotation.set(elapsedSec * 8, -bAng, 0);
        }
      } else {
        for (let k = 0; k < MAX_BOSS_BEAMS; k++) {
          this.laserBeamMeshes[k].visible = false;
          this.laserCoreMeshes[k].visible = false;
        }
        for (const ring of this.laserHelixRings) ring.visible = false;
      }

      if (boss.laserCharging) {
        const portDist = boss.radius * WORLD_SCALE * 0.85;
        const sx = bx + Math.cos(boss.laserAngle) * portDist;
        const sz = bz + Math.sin(boss.laserAngle) * portDist;
        const flicker = 0.3 + Math.abs(Math.sin(elapsedSec * 28)) * 0.45;

        for (let k = 0; k < MAX_BOSS_BEAMS; k++) {
          const warn = this.laserWarningRibbons[k];
          const active = k < beamCount;
          warn.visible = active;
          if (active) {
            const ang = boss.laserAngle + (k * Math.PI * 2) / beamCount;
            warn.position.set(bx, 0.45, bz);
            warn.rotation.y = -ang;
            (warn.material as THREE.MeshBasicMaterial).opacity = flicker;
          }
        }

        this.laserChargeSphere.visible = true;
        this.laserChargeSphere.position.set(sx, 0.75, sz);
        const chargeProg = 1 - Math.max(0, Math.min(1, boss.laserTimerMs / 950));
        this.laserChargeSphere.scale.setScalar(0.45 + chargeProg * 1.15);

        this.laserChargeRing.visible = true;
        this.laserChargeRing.position.set(sx, 0.75, sz);
        this.laserChargeRing.rotation.z = elapsedSec * 7;
        this.laserChargeRing.scale.setScalar(Math.max(0.2, 1.35 - chargeProg * 0.95));
      } else {
        for (const warn of this.laserWarningRibbons) warn.visible = false;
        this.laserChargeSphere.visible = false;
        this.laserChargeRing.visible = false;
      }

      if (boss.preChargeTimer > 0) {
        this.chargeCorridorMesh.visible = true;
        this.chargeCorridorMesh.position.set(bx, 0.08, bz);
        this.chargeCorridorMesh.rotation.y = -Math.atan2(boss.chargeDirY, boss.chargeDirX);
        const chargeRatio = 1 - boss.preChargeTimer / 60;
        (this.chargeCorridorMesh.material as THREE.MeshBasicMaterial).opacity =
          0.14 + chargeRatio * 0.34 + Math.sin(elapsedSec * 25) * 0.06;
      } else {
        this.chargeCorridorMesh.visible = false;
      }

      if (boss.sniperActive) {
        const px = arenaToWorldX(state.player.x);
        const pz = arenaToWorldZ(state.player.y);
        const dx = px - bx;
        const dz = pz - bz;
        const dist = Math.max(1, Math.hypot(dx, dz));
        this.sniperRibbon.visible = true;
        this.sniperRibbon.position.set(bx, 0.6, bz);
        this.sniperRibbon.rotation.y = -Math.atan2(dz, dx);
        const lockProgress = 1 - Math.max(0, Math.min(1, boss.sniperTimerMs / 340));
        this.sniperRibbon.scale.set(dist, 1, 0.35 + (1 - lockProgress) * 1.35);
        (this.sniperRibbon.material as THREE.MeshBasicMaterial).opacity =
          0.38 + lockProgress * 0.55;
      } else {
        this.sniperRibbon.visible = false;
      }

      if (boss.skillChargeTimerMs > 0) {
        const ratio = boss.skillChargeTimerMs / 450;
        this.bossSkillChargeRing.visible = true;
        this.bossSkillChargeRing.position.set(bx, 0.25, bz);
        const r = boss.radius * WORLD_SCALE * (0.65 + ratio * 1.25);
        this.bossSkillChargeRing.scale.set(r, r, r);
        (this.bossSkillChargeRing.material as THREE.MeshBasicMaterial).color.setHex(boss.hex);
        (this.bossSkillChargeRing.material as THREE.MeshBasicMaterial).opacity =
          (1 - ratio) * 0.85;
      } else {
        this.bossSkillChargeRing.visible = false;
      }

      if (boss.state === 'RESTING' || boss.staggerTimerMs > 0) {
        this.bossRestRing.visible = true;
        this.bossRestRing.position.set(bx, 0.14, bz);
        const r = boss.radius * WORLD_SCALE * (1.28 + Math.sin(elapsedSec * 6) * 0.06);
        this.bossRestRing.scale.set(r, r, r);
        this.bossRestRing.rotation.y = elapsedSec * 2.2;
        (this.bossRestRing.material as THREE.MeshBasicMaterial).color.setHex(
          boss.staggerTimerMs > 0 ? 0x34d399 : 0x5eead4
        );
      } else {
        this.bossRestRing.visible = false;
      }

      // Aegis shield pylons & protective bubble
      if (boss.pylons.length > 0) {
        this.bossAegisDome.visible = true;
        this.bossAegisDome.position.set(bx, 0.85, bz);
        this.bossAegisDome.scale.setScalar(boss.radius * WORLD_SCALE * 1.45);
        this.bossAegisDome.rotation.y = elapsedSec * 0.9;
        this.bossAegisDome.rotation.x = elapsedSec * 0.45;
      } else {
        this.bossAegisDome.visible = false;
      }
      for (let i = 0; i < MAX_BOSS_PYLONS; i++) {
        const slot = this.bossPylonPool[i];
        const py = boss.pylons[i];
        if (py) {
          const px = arenaToWorldX(py.x);
          const pz = arenaToWorldZ(py.y);
          slot.group.visible = true;
          slot.group.position.set(px, 0.85, pz);
          slot.crystal.rotation.y = elapsedSec * 3.5;
          slot.crystal.rotation.x = Math.sin(elapsedSec * 2.2 + i) * 0.25;
          slot.ring.rotation.z = elapsedSec * 2.4;
          (slot.crystal.material as THREE.MeshBasicMaterial).color.setHex(
            py.hitFlash > 0.2 ? 0xffffff : 0x34d399
          );
          const dx = bx - px;
          const dz = bz - pz;
          const dist = Math.max(0.1, Math.hypot(dx, dz));
          slot.tether.visible = true;
          slot.tether.position.set(px, 0.8, pz);
          slot.tether.rotation.y = -Math.atan2(dz, dx);
          slot.tether.scale.set(dist, 1, 1);
        } else {
          slot.group.visible = false;
          slot.tether.visible = false;
        }
      }

      // Holo-mirage decoy projections
      for (let i = 0; i < MAX_BOSS_CLONES; i++) {
        const slot = this.bossClonePool[i];
        const cl = boss.clones[i];
        if (cl) {
          const cx = arenaToWorldX(cl.x);
          const cz = arenaToWorldZ(cl.y);
          slot.group.visible = true;
          slot.group.position.set(cx, 0.9 + Math.sin(elapsedSec * 5 + i) * 0.22, cz);
          const clScale = cl.radius * WORLD_SCALE * 0.72;
          slot.hull.scale.setScalar(clScale);
          slot.ring.scale.setScalar(clScale * 0.85);
          slot.hull.rotation.y = -Math.atan2(state.player.y - cl.y, state.player.x - cl.x);
          (slot.hull.material as THREE.MeshBasicMaterial).color.setHex(
            cl.hitFlash > 0.2 ? 0xffffff : 0x22d3ee
          );
          (slot.hull.material as THREE.MeshBasicMaterial).opacity =
            0.55 + Math.sin(elapsedSec * 14 + i) * 0.2;
        } else {
          slot.group.visible = false;
        }
      }

      // Orbital strike target zones + sky-beam drop pillars
      for (let i = 0; i < MAX_BOSS_HAZARDS; i++) {
        const slot = this.bossHazardPool[i];
        const hz = boss.hazardZones[i];
        if (hz) {
          const hx = arenaToWorldX(hz.x);
          const hzZ = arenaToWorldZ(hz.y);
          const rWorld = hz.radius * WORLD_SCALE;
          if (!hz.detonated) {
            const prog = 1 - Math.max(0, Math.min(1, hz.warningMs / Math.max(1, hz.maxWarningMs)));
            slot.outerRing.visible = true;
            slot.outerRing.position.set(hx, 0.1, hzZ);
            slot.outerRing.scale.setScalar(rWorld);
            (slot.outerRing.material as THREE.MeshBasicMaterial).opacity =
              0.55 + Math.abs(Math.sin(elapsedSec * 16)) * 0.35;

            slot.fillDisc.visible = true;
            slot.fillDisc.position.set(hx, 0.08, hzZ);
            slot.fillDisc.scale.setScalar(rWorld * (0.08 + prog * 0.92));
            (slot.fillDisc.material as THREE.MeshBasicMaterial).opacity = 0.16 + prog * 0.34;
            slot.strikePillar.visible = false;
          } else {
            const flashProg = Math.max(0, Math.min(1, hz.detonateFlashMs / 380));
            slot.outerRing.visible = false;
            slot.fillDisc.visible = true;
            slot.fillDisc.position.set(hx, 0.12, hzZ);
            slot.fillDisc.scale.setScalar(rWorld * (1 + (1 - flashProg) * 0.18));
            (slot.fillDisc.material as THREE.MeshBasicMaterial).opacity = flashProg * 0.65;

            slot.strikePillar.visible = true;
            slot.strikePillar.position.set(hx, 0.1, hzZ);
            slot.strikePillar.scale.set(rWorld * 0.55 * flashProg, 1, rWorld * 0.55 * flashProg);
            (slot.strikePillar.material as THREE.MeshBasicMaterial).opacity = flashProg * 0.92;
          }
        } else {
          slot.outerRing.visible = false;
          slot.fillDisc.visible = false;
          slot.strikePillar.visible = false;
        }
      }

      // Gravity black-hole vortices
      for (let i = 0; i < MAX_BOSS_WELLS; i++) {
        const slot = this.bossWellPool[i];
        const well = boss.gravityWells[i];
        if (well) {
          const gx = arenaToWorldX(well.x);
          const gz = arenaToWorldZ(well.y);
          const rWorld = well.radius * WORLD_SCALE;
          slot.group.visible = true;
          slot.group.position.set(gx, 0.45, gz);
          slot.core.rotation.y = elapsedSec * 4.2;
          slot.core.rotation.z = elapsedSec * 2.8;
          slot.core.scale.setScalar(1.1 + Math.sin(well.pulse * 2) * 0.16);
          const pullPhase = (elapsedSec * 0.85) % 1;
          slot.innerRing.scale.setScalar(rWorld * (1 - pullPhase * 0.72));
          slot.outerRing.scale.setScalar(rWorld);
          (slot.innerRing.material as THREE.MeshBasicMaterial).opacity = (1 - pullPhase) * 0.72;
        } else {
          slot.group.visible = false;
        }
      }

      // Gemini's neon plasma leash pulsing between Alpha and Omega
      if (boss.twin && (boss.twin.tetherChargingMs > 0 || boss.twin.tetherActiveMs > 0)) {
        const tx = arenaToWorldX(boss.twin.x);
        const tz = arenaToWorldZ(boss.twin.y);
        const dx = tx - bx;
        const dz = tz - bz;
        const dist = Math.max(0.1, Math.hypot(dx, dz));
        const ang = -Math.atan2(dz, dx);

        if (boss.twin.tetherChargingMs > 0) {
          this.geminiTetherWarn.visible = true;
          this.geminiTetherWarn.position.set(bx, 0.72, bz);
          this.geminiTetherWarn.rotation.y = ang;
          this.geminiTetherWarn.scale.set(dist, 1, 0.55 + Math.abs(Math.sin(elapsedSec * 24)) * 0.9);
          (this.geminiTetherWarn.material as THREE.MeshBasicMaterial).opacity =
            0.35 + Math.abs(Math.sin(elapsedSec * 26)) * 0.48;
          this.geminiTetherBeam.visible = false;
          this.geminiTetherCore.visible = false;
        } else {
          this.geminiTetherWarn.visible = false;
          const pulse = 1.0 + Math.sin(elapsedSec * 38) * 0.26;
          this.geminiTetherBeam.visible = true;
          this.geminiTetherBeam.position.set(bx, 0.78, bz);
          this.geminiTetherBeam.rotation.y = ang;
          this.geminiTetherBeam.scale.set(dist, pulse, pulse);
          (this.geminiTetherBeam.material as THREE.MeshBasicMaterial).color.setHex(
            Math.sin(elapsedSec * 22) > 0 ? 0xff2e88 : 0x38e8ff
          );
          this.geminiTetherCore.visible = true;
          this.geminiTetherCore.position.set(bx, 0.78, bz);
          this.geminiTetherCore.rotation.y = ang;
          this.geminiTetherCore.scale.set(dist, pulse * 0.85, pulse * 0.85);
        }
      } else {
        this.geminiTetherWarn.visible = false;
        this.geminiTetherBeam.visible = false;
        this.geminiTetherCore.visible = false;
      }

      // Chrono blink-slash warp streak
      if (boss.blinkSlashTimerMs > 0) {
        const ox = arenaToWorldX(boss.blinkOriginX);
        const oz = arenaToWorldZ(boss.blinkOriginY);
        const tx = arenaToWorldX(boss.teleportTarget ? boss.teleportTarget.x : boss.x);
        const tz = arenaToWorldZ(boss.teleportTarget ? boss.teleportTarget.y : boss.y);
        const dx = tx - ox;
        const dz = tz - oz;
        const dist = Math.max(0.1, Math.hypot(dx, dz));
        this.bossBlinkRibbon.visible = true;
        this.bossBlinkRibbon.position.set(ox, 0.55, oz);
        this.bossBlinkRibbon.rotation.y = -Math.atan2(dz, dx);
        this.bossBlinkRibbon.scale.set(dist, 1, 1);
        (this.bossBlinkRibbon.material as THREE.MeshBasicMaterial).opacity = Math.min(
          0.85,
          boss.blinkSlashTimerMs / 460
        );
      } else {
        this.bossBlinkRibbon.visible = false;
      }
    } else {
      for (let k = 0; k < MAX_BOSS_BEAMS; k++) {
        this.laserBeamMeshes[k].visible = false;
        this.laserCoreMeshes[k].visible = false;
        this.laserWarningRibbons[k].visible = false;
      }
      for (const ring of this.laserHelixRings) ring.visible = false;
      this.laserChargeSphere.visible = false;
      this.laserChargeRing.visible = false;
      this.chargeCorridorMesh.visible = false;
      this.sniperRibbon.visible = false;
      this.bossSkillChargeRing.visible = false;
      this.bossRestRing.visible = false;
      this.bossAegisDome.visible = false;
      this.bossBlinkRibbon.visible = false;
      this.geminiTetherWarn.visible = false;
      this.geminiTetherBeam.visible = false;
      this.geminiTetherCore.visible = false;
      for (const s of this.bossPylonPool) {
        s.group.visible = false;
        s.tether.visible = false;
      }
      for (const s of this.bossClonePool) s.group.visible = false;
      for (const s of this.bossHazardPool) {
        s.outerRing.visible = false;
        s.fillDisc.visible = false;
        s.strikePillar.visible = false;
      }
      for (const s of this.bossWellPool) s.group.visible = false;
    }

    // 8. Boss entrance portal & drop-beam rig
    if (boss && boss.entering && !boss.dying) {
      const ax = arenaToWorldX(boss.x);
      const az = arenaToWorldZ(state.stormRing.centerY - 182);

      let portalStrength = 0;
      if (boss.entryState === 0) {
        portalStrength = Math.min(1, boss.entryTimer / 34);
      } else if (boss.entryState === 1) {
        portalStrength = 1.0;
      } else {
        portalStrength = Math.max(0, 1 - boss.entryTimer / 30);
      }

      if (portalStrength > 0.01) {
        this.bossPortalMesh.visible = true;
        this.bossPortalMesh.position.set(ax, 0.14, az);
        const burst = boss.entryState === 2 ? Math.max(0, 1 - boss.entryTimer / 18) * 0.25 : 0;
        const pScale = 0.35 + portalStrength * 0.85 + burst;
        this.bossPortalMesh.scale.setScalar(pScale);
        this.bossPortalMat.uniforms.uTime.value = elapsedSec;
        this.bossPortalMat.uniforms.uProgress.value = portalStrength;
        this.bossPortalMat.uniforms.uColor.value.setHex(boss.hex);
        const archStyle = boss.archetype % 3;
        this.bossPortalMat.uniforms.uArchetype.value = archStyle;
      } else {
        this.bossPortalMesh.visible = false;
      }

      if (boss.entryState <= 1) {
        const archStyle = boss.archetype % 3;
        this.bossSkyBeamMesh.visible = true;
        this.bossSkyBeamMesh.position.set(ax, 28, az);
        const beamMat = this.bossSkyBeamMesh.material as THREE.MeshBasicMaterial;
        beamMat.color.setHex(boss.archetype === 2 ? 0xffe899 : boss.hex);

        if (boss.entryState === 0) {
          const lockP = boss.entryTimer / 42;
          const thin = 0.14 + lockP * 0.28;
          this.bossSkyBeamMesh.scale.set(thin, 1, thin);
          beamMat.opacity = 0.18 + lockP * 0.26 + Math.sin(elapsedSec * 26) * 0.05;
        } else {
          const stage1P = Math.min(1, boss.entryTimer / 30);
          if (archStyle === 1) {
            const shaft = 0.72 * (1 - stage1P * 0.35);
            this.bossSkyBeamMesh.scale.set(shaft, 1, shaft);
            beamMat.opacity = 0.35 + stage1P * 0.25;
          } else {
            const pillar = (archStyle === 2 ? 1.45 : 1.1) * (0.65 + stage1P * 0.55);
            this.bossSkyBeamMesh.scale.set(pillar, 1, pillar);
            beamMat.opacity = 0.42 + stage1P * 0.32;
          }
        }

        for (let i = 0; i < this.bossConvergeRings.length; i++) {
          const ring = this.bossConvergeRings[i];
          ring.visible = true;
          const rMat = ring.material as THREE.MeshBasicMaterial;
          rMat.color.setHex(boss.archetype === 2 ? 0xffefaa : boss.hex);
          const cyc = (elapsedSec * 1.45 + i / 3) % 1.0;

          if (archStyle === 1) {
            // Crunch rings pulling inward toward the portal horizon
            const r = 12.0 * (1 - cyc) + 1.2;
            ring.position.set(ax, 0.35 + cyc * 1.8, az);
            ring.scale.set(r, r, r);
          } else {
            // Staggered orbital beams slamming onto the portal seal
            const alt = 36.0 * (1 - cyc) + 0.5;
            const r = archStyle === 2 ? 3.5 + cyc * 5.0 : 2.8 + (1 - cyc) * 4.5;
            ring.position.set(ax, alt, az);
            ring.scale.set(r, r, r);
          }
          rMat.opacity = Math.sin(cyc * Math.PI) * 0.82;
        }
      } else {
        this.bossSkyBeamMesh.visible = false;
        for (const ring of this.bossConvergeRings) ring.visible = false;
      }
    } else {
      this.bossPortalMesh.visible = false;
      this.bossSkyBeamMesh.visible = false;
      for (const ring of this.bossConvergeRings) ring.visible = false;
    }

    // 9. Player Rail-Lance beam cannon
    if (state.playerBeams.length > 0) {
      const beam = state.playerBeams[state.playerBeams.length - 1];
      const lifeRatio = Math.max(0, beam.life / Math.max(1, beam.maxLife));
      const bx = arenaToWorldX(beam.x);
      const bz = arenaToWorldZ(beam.y);
      const beamLenWorld = beam.length * WORLD_SCALE;
      const beamRad = Math.max(0.25, beam.width * WORLD_SCALE * 0.45 * lifeRatio);

      this.railBeamMat.uniforms.uTime.value = elapsedSec;
      this.railBeamMat.uniforms.uTint.value.setHex(beam.hex);

      this.railBeamOuterMesh.visible = true;
      this.railBeamOuterMesh.position.set(bx, 0.75, bz);
      this.railBeamOuterMesh.rotation.y = -beam.angle;
      this.railBeamOuterMesh.scale.set(beamLenWorld, beamRad * 1.45, beamRad * 1.45);

      this.railBeamCoreMesh.visible = true;
      this.railBeamCoreMesh.position.set(bx, 0.75, bz);
      this.railBeamCoreMesh.rotation.y = -beam.angle;
      this.railBeamCoreMesh.scale.set(beamLenWorld, beamRad * 0.9, beamRad * 0.9);
      (this.railBeamCoreMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, lifeRatio * 1.4);

      const dirX = Math.cos(beam.angle);
      const dirZ = Math.sin(beam.angle);
      const prog = 1 - lifeRatio;
      for (let i = 0; i < this.railBeamRings.length; i++) {
        const ring = this.railBeamRings[i];
        ring.visible = true;
        const distWorld = (prog * 35 + i * 11) % beamLenWorld;
        ring.position.set(bx + dirX * distWorld, 0.75, bz + dirZ * distWorld);
        ring.rotation.set(0, -beam.angle, 0);
        ring.scale.setScalar((beamRad * 1.6 + 0.45) * (1 + prog * 0.4));
        (ring.material as THREE.MeshBasicMaterial).opacity = lifeRatio * 0.85;
      }
    } else {
      this.railBeamOuterMesh.visible = false;
      this.railBeamCoreMesh.visible = false;
      for (const ring of this.railBeamRings) ring.visible = false;
    }

    // 10. Jagged EMP lightning arcs bouncing between targets
    let arcIdx = 0;
    for (let a = 0; a < state.lightningArcs.length && arcIdx < MAX_LIGHTNING_ARCS; a++) {
      const arc = state.lightningArcs[a];
      if (arc.points.length < 2) continue;
      const slot = this.lightningLines[arcIdx++];
      const arr = slot.posAttr.array as Float32Array;
      let vIdx = 0;
      const lifeRatio = Math.max(0, arc.life / Math.max(1, arc.maxLife));
      const subSegs = 4;

      for (let i = 0; i < arc.points.length - 1; i++) {
        const p0 = arc.points[i];
        const p1 = arc.points[i + 1];
        const w0x = arenaToWorldX(p0.x);
        const w0z = arenaToWorldZ(p0.y);
        const w1x = arenaToWorldX(p1.x);
        const w1z = arenaToWorldZ(p1.y);
        const segDx = w1x - w0x;
        const segDz = w1z - w0z;
        const segLen = Math.hypot(segDx, segDz) || 1;
        const perpX = -segDz / segLen;
        const perpZ = segDx / segLen;

        for (let s = 0; s <= subSegs; s++) {
          if (i > 0 && s === 0) continue;
          if (vIdx >= MAX_LIGHTNING_VERTS) break;
          const t = s / subSegs;
          const isEndpoint = s === 0 || s === subSegs;
          const jitter = isEndpoint ? 0 : (Math.random() - 0.5) * 2.4 * lifeRatio;
          const vy = isEndpoint ? 0.75 : 0.75 + Math.random() * 1.1;
          arr[vIdx * 3] = w0x + segDx * t + perpX * jitter;
          arr[vIdx * 3 + 1] = vy;
          arr[vIdx * 3 + 2] = w0z + segDz * t + perpZ * jitter;
          vIdx++;
        }
      }

      slot.line.visible = vIdx >= 2;
      slot.line.geometry.setDrawRange(0, vIdx);
      slot.posAttr.needsUpdate = true;
      slot.mat.color.setHex(arc.hex);
      slot.mat.opacity = Math.min(1, lifeRatio * 1.25);
    }
    for (let i = arcIdx; i < MAX_LIGHTNING_ARCS; i++) {
      this.lightningLines[i].line.visible = false;
    }

    // 11. Perimeter warning chevrons pointing toward enemies entering from off-screen
    let chevIdx = 0;
    const px = state.player.x;
    const py = state.player.y;
    for (const e of state.enemies) {
      if (chevIdx >= MAX_EDGE_CHEVRONS) break;
      if (!e.ingressActive) continue;
      const dist = Math.hypot(e.x - px, e.y - py);
      if (dist < 380) continue;

      const chev = this.edgeChevrons[chevIdx++];
      const ang = Math.atan2(e.y - py, e.x - px);
      const cx = px + Math.cos(ang) * 320;
      const cy = py + Math.sin(ang) * 260;
      const inAngle = ang + Math.PI;
      const pulse = 0.85 + Math.sin(elapsedSec * 18 + e.id) * 0.25;

      chev.visible = true;
      chev.position.set(arenaToWorldX(cx), 0.7, arenaToWorldZ(cy));
      chev.rotation.set(0, -inAngle, 0);
      chev.scale.setScalar(pulse * (e.type === 'elite' || e.type === 'large' ? 1.4 : 1.05));
      const chevMat = chev.material as THREE.MeshBasicMaterial;
      chevMat.color.setHex(e.type === 'elite' ? 0x44ddff : e.type === 'large' ? 0xee55ff : 0xff4455);
      chevMat.opacity = 0.55 + Math.abs(Math.sin(elapsedSec * 14 + e.id)) * 0.42;
    }
    for (let i = chevIdx; i < MAX_EDGE_CHEVRONS; i++) {
      this.edgeChevrons[i].visible = false;
    }
  }
}
