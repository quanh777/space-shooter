import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SFX_MANIFEST } from '../audio/SoundEngine';
import { PLAYER_BASE } from '../config/constants';
import { ALL_SHOP_ITEM_IDS } from '../config/shopItems';
import { SECTOR_HAZARDS, WEAPON_CATALOG, type PrimaryWeaponCatalogEntry } from '../config/weapons';
import { EventBus } from '../engine/EventBus';
import type { InputSnapshot } from '../engine/InputManager';
import { GameSimulation } from '../game/GameSimulation';
import { spawnFloatingText } from '../game/GameState';
import { generateSectorMap } from '../game/map/SectorMapGenerator';
import { createBoss, hitBoss, hitBossClone, hitBossPylon } from '../game/systems/BossSystem';
import { applyElementalImpact } from '../game/systems/CombatSystem';
import { registerComboKill, updateComboSystem } from '../game/systems/ComboSystem';
import { createEnemy, updateEnemySystem } from '../game/systems/EnemySystem';
import { damagePlayer } from '../game/systems/PlayerSystem';
import { initSectorRaid } from '../game/systems/RaidSystem';
import {
  applyWildMutation,
  enterSectorRoom,
  grantPlayerXp,
  openRoomDoorSelection,
  spawnCombatDrone,
  xpRequiredForLevel,
} from '../game/systems/RoomSystem';
import {
  ROULETTE_PITY_THRESHOLD,
  applyShopUpgrade,
  computeActiveSynergies,
  computeMountedPrimaryStats,
  computePlayerCoolingRate,
  computeWeaponHeatScale,
  getRouletteEpicChance,
  getRouletteSpinCost,
  getShopItemPrice,
  openShop,
  purchaseSelectedShopItems,
  selectNextSectorHazard,
  toggleShopSelection,
} from '../game/systems/ShopSystem';
import {
  ROOM_STORM_CONFIG,
  configureStormRingForRoom,
  configureStormRingForWave,
  startStormTransition,
} from '../game/systems/WaveSystem';
import {
  createArenaDeckMaterial,
  createAtmosphericSmokeMaterial,
  createBlastDomeMaterial,
  createBossCoreMaterial,
  createBossPortalMaterial,
  createDeathRayMaterial,
  createExplosionFireballMaterial,
  createHexShieldMaterial,
  createNebulaDriftMaterial,
  createPlasmaProjectileMaterial,
  createProceduralPlanetMaterial,
  createScrollingPointsMaterial,
  createShockwaveRingMaterial,
  createStormWallMaterial,
  createThrusterPlumeMaterial,
} from '../render/shaders/gameShaders';
import { GLSL3_NOISE } from '../render/shaders/shaderLib';
import {
  computeEffectivePixelRatio,
  evaluateQualityStep,
  type QualityGovernorState,
} from '../render/SceneManager';
import {
  FACTION_LIVERY_PALETTES,
  applyFactionLiveryToMaterials,
  applyPlayerChassisMorph,
  applyWeaponSlotForm,
  resolveDominantFactionLivery,
  type PlayerChassisBuckets,
  type WeaponPartMeta,
} from '../render/AssetLoader';
import { createTacticalPostPass } from '../render/shaders/TacticalPostPass';
import { AchievementService } from '../services/AchievementService';
import {
  buildSameNameUpsertPlan,
  dedupeLeaderboardEntries,
  extractBuildSnapshot,
  LeaderboardService,
  normalizePilotKey,
  sanitizeLeaderboardEntry,
  sortLeaderboardEntries,
} from '../services/LeaderboardService';
import { metaProgression } from '../services/MetaProgressionService';

function idleInput(overrides: Partial<InputSnapshot> = {}): InputSnapshot {
  return {
    moveX: 0,
    moveY: 0,
    shoot: false,
    dash: false,
    bomb: false,
    vent: false,
    chrono: false,
    aimMode: 'auto',
    autoFire: false,
    mouseArenaX: 400,
    mouseArenaY: 300,
    mouseActive: false,
    ...overrides,
  };
}

describe('Core Flight, Combat & Progression Simulation Tests', () => {
  beforeEach(() => {
    metaProgression.resetForTests(0);
  });

  it('resets 100% of game state cleanly between runs with zero state leak', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();

    // Mutate every upgrade and entity collection
    for (const id of ALL_SHOP_ITEM_IDS) {
      sim.state.shop.levels[id] = 2;
      applyShopUpgrade(sim.state, id);
    }
    sim.state.score = 9999;
    sim.state.money = 5000;
    sim.state.wave = 12;
    sim.state.enemies.push(createEnemy(sim.state, 'elite'));
    sim.state.boss = createBoss(sim.state, 0);

    // Start a brand-new game
    sim.startNewGame();
    const s = sim.state;

    expect(s.score).toBe(0);
    expect(s.money).toBe(0);
    expect(s.wave).toBe(1);
    expect(s.runRoomNumber).toBe(1);
    expect(s.roomsTotalPerSector).toBe(5);
    expect(s.currentRoomKind).toBe('armory');
    expect(s.enemies.length).toBeGreaterThanOrEqual(1);
    expect(s.boss).toBeNull();
    expect(s.player.pierceCount).toBe(0);
    expect(s.player.hpRegen).toBe(0);
    expect(s.player.speed).toBe(PLAYER_BASE.speed);
    expect(s.player.bulletDamage).toBe(PLAYER_BASE.bulletDamage);
    expect(s.player.pickupRange).toBe(PLAYER_BASE.pickupRangeBase);
    expect(s.player.moneyBonus).toBe(0);
    expect(s.player.skill.level).toBe(1);
    for (const id of ALL_SHOP_ITEM_IDS) {
      expect(s.shop.levels[id]).toBe(0);
    }
  });

  it('prevents negative money during atomic multi-item shop checkout', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 6;
    openShop(sim.state, bus);

    const [first, second] = sim.state.shop.offers;
    const price1 = getShopItemPrice(sim.state, first);
    const price2 = getShopItemPrice(sim.state, second);

    // Give enough money for each individually, but NOT enough for both together
    sim.state.money = Math.max(price1, price2);

    expect(toggleShopSelection(sim.state, first)).toBe(true);
    expect(toggleShopSelection(sim.state, second)).toBe(true);

    let errorEmitted = false;
    bus.on('SHOP_ERROR', () => {
      errorEmitted = true;
    });

    const ok = purchaseSelectedShopItems(sim.state, bus);
    expect(ok).toBe(false);
    expect(errorEmitted).toBe(true);
    expect(sim.state.money).toBeGreaterThanOrEqual(0);
    expect(sim.state.shop.levels[first]).toBe(0);
    expect(sim.state.shop.levels[second]).toBe(0);
  });

  it('wires Speed Boost, Dash Cooldown, Magnet, and Piercing upgrades directly into simulation', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;

    // 1. Speed Boost really increases movement delta
    const startX1 = sim.state.player.x;
    sim.step(idleInput({ moveX: 1 }), 1 / 60);
    const deltaBase = sim.state.player.x - startX1;

    applyShopUpgrade(sim.state, 'speedBoost');
    applyShopUpgrade(sim.state, 'speedBoost');
    const startX2 = sim.state.player.x;
    sim.step(idleInput({ moveX: 1 }), 1 / 60);
    const deltaUpgraded = sim.state.player.x - startX2;
    expect(deltaUpgraded).toBeGreaterThan(deltaBase);

    // 2. Dash Cooldown lowers cooldown and energy cost
    const origCd = sim.state.player.dashCooldownMs;
    const origCost = sim.state.player.dashCost;
    applyShopUpgrade(sim.state, 'dashCooldown');
    expect(sim.state.player.dashCooldownMs).toBeLessThan(origCd);
    expect(sim.state.player.dashCost).toBeLessThan(origCost);

    // 3. Magnet pulls coins from further away and credits money on collection
    applyShopUpgrade(sim.state, 'magnet');
    expect(sim.state.player.pickupRange).toBeGreaterThan(PLAYER_BASE.pickupRangeBase);
    sim.state.goldPickups.push({
      id: 999,
      x: sim.state.player.x + 110,
      y: sim.state.player.y,
      vx: 0,
      vy: 0,
      value: 42,
      size: 6,
      age: 0,
      homing: false,
    });
    for (let i = 0; i < 60; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(sim.state.money).toBe(42);
  });

  it('does not inflate kill count on boss hits and grants real gold coins when boss dies', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 5;
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;

    let enemyKillEvents = 0;
    let bossDefeatedEvents = 0;
    bus.on('ENEMY_KILLED', () => enemyKillEvents++);
    bus.on('BOSS_DEFEATED', () => bossDefeatedEvents++);

    const boss = createBoss(sim.state, 0);
    boss.entering = false;
    boss.x = 400;
    boss.y = 200;
    boss.hp = 100;
    boss.maxHp = 100;
    sim.state.boss = boss;

    // Non-lethal hits should NOT increment combo kills or ENEMY_KILLED
    hitBoss(sim.state, boss, 30, false, 400, 200, bus);
    hitBoss(sim.state, boss, 30, false, 400, 200, bus);
    expect(enemyKillEvents).toBe(0);
    expect(sim.state.combo.kills).toBe(0);

    // Lethal hit enters death cinematic, then finalizes with real gold coins
    hitBoss(sim.state, boss, 60, true, 400, 200, bus);
    expect(boss.dying).toBe(true);

    for (let i = 0; i < 120; i++) {
      if ((sim.state.phase as string) === 'QUICK_DRAFT') {
        sim.pickQuickDraftByIndex(0);
      }
      sim.step(idleInput(), 1 / 60);
    }

    expect(bossDefeatedEvents).toBe(1);
    expect(sim.state.bossKills).toBe(1);
    expect(sim.state.boss).toBeNull();
    // Resolve any level-up Quick Drafts triggered by Boss XP, then let coins fly home to player
    for (let i = 0; i < 120; i++) {
      if ((sim.state.phase as string) === 'QUICK_DRAFT') {
        sim.pickQuickDraftByIndex(0);
      }
      sim.step(idleInput(), 1 / 60);
    }
    expect(sim.state.money).toBeGreaterThan(0);
    expect(sim.state.score).toBeGreaterThan(0);
  });

  it('separates overlapping enemies without producing NaN coordinates', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();

    const e1 = createEnemy(sim.state, 'small', false, { x: 400, y: 300 });
    const e2 = createEnemy(sim.state, 'small', false, { x: 400, y: 300 });
    sim.state.enemies.push(e1, e2);

    updateEnemySystem(sim.state);

    expect(Number.isFinite(e1.x)).toBe(true);
    expect(Number.isFinite(e1.y)).toBe(true);
    expect(Number.isFinite(e2.x)).toBe(true);
    expect(Number.isFinite(e2.y)).toBe(true);
    expect(Math.hypot(e2.x - e1.x, e2.y - e1.y)).toBeGreaterThan(0);
  });

  it('handles corrupt localStorage safely and emits wave achievement unlock events', () => {
    const fakeStorage = {
      getItem: () => '{invalid-json',
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;

    const bus = new EventBus();
    const ach = new AchievementService(bus, fakeStorage);

    const unlocks: Array<{ id: string; level: number }> = [];
    ach.onUnlock((ev) => unlocks.push(ev));

    bus.emit('WAVE_CLEARED', { wave: 5, bonus: 60 });
    expect(ach.getValue('waves')).toBe(5);
    expect(ach.getLevel('waves')).toBe(1);
    expect(unlocks).toEqual([{ id: 'waves', level: 1 }]);
  });

  it('tracks in-world FCS target lock telemetry on nearest threat and clears on elimination', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;

    const farEnemy = createEnemy(sim.state, 'medium', false, { x: 100, y: 80 });
    const nearEnemy = createEnemy(sim.state, 'elite', true, { x: 400, y: 260 });
    sim.state.enemies.push(farEnemy, nearEnemy);

    sim.step(idleInput({ aimMode: 'auto' }), 1 / 60);

    expect(sim.state.player.lockedTarget).not.toBeNull();
    expect(sim.state.player.lockedTarget?.id).toBe(nearEnemy.id);
    expect(sim.state.player.lockedTarget?.hpRatio).toBeCloseTo(1);
    expect(sim.state.player.lockedTarget?.isBoss).toBe(false);

    // Clear enemies and active Raid objective and verify FCS lock releases
    sim.state.enemies.length = 0;
    sim.state.raid.activeObjective = null;
    sim.step(idleInput({ aimMode: 'auto' }), 1 / 60);
    expect(sim.state.player.lockedTarget).toBeNull();
  });

  it('validates all 13 custom GLSL ES 3.00 shaders and post-processing uniforms', () => {
    const deckMat = createArenaDeckMaterial();
    const planetMat = createProceduralPlanetMaterial(0x1b0b38, 0x3b1c71, 0x0ea5e9, 0x38bdf8);
    const shieldMat = createHexShieldMaterial();
    const bossMat = createBossCoreMaterial(0);
    const nebulaMat = createNebulaDriftMaterial();
    const plasmaMat = createPlasmaProjectileMaterial();
    const thrusterMat = createThrusterPlumeMaterial();
    const deathRayMat = createDeathRayMaterial();
    const fireballMat = createExplosionFireballMaterial();
    const shockwaveMat = createShockwaveRingMaterial();
    const blastDomeMat = createBlastDomeMaterial();
    const portalMat = createBossPortalMaterial();
    const postPass = createTacticalPostPass();

    const materials: THREE.ShaderMaterial[] = [
      deckMat,
      planetMat,
      shieldMat,
      bossMat,
      nebulaMat,
      plasmaMat,
      thrusterMat,
      deathRayMat,
      fireballMat,
      shockwaveMat,
      blastDomeMat,
      portalMat,
      postPass.material,
    ];

    for (const mat of materials) {
      expect(mat.glslVersion).toBe(THREE.GLSL3);
      expect(mat.vertexShader).toContain('void main()');
      expect(mat.fragmentShader).toContain('out vec4 fragColor;');
      expect(mat.fragmentShader).toContain('void main()');
      // Guardrail: keep shaders free of sketchy sin()-based pseudo-hashes
      expect(mat.fragmentShader).not.toMatch(/fract\s*\(\s*sin\s*\(/);
      // Verify brace balance in both vertex and fragment shaders
      const openV = (mat.vertexShader.match(/\{/g) ?? []).length;
      const closeV = (mat.vertexShader.match(/\}/g) ?? []).length;
      expect(openV).toBe(closeV);
      const openF = (mat.fragmentShader.match(/\{/g) ?? []).length;
      const closeF = (mat.fragmentShader.match(/\}/g) ?? []).length;
      expect(openF).toBe(closeF);
    }

    // Verify analytical box-filtered grid, Oklab, blackbody, hex Voronoi, and AgX tonemap inclusion
    expect(deckMat.fragmentShader).toContain('filteredGrid');
    expect(planetMat.fragmentShader).toContain('warpedFbm');
    expect(planetMat.fragmentShader).toContain('mixOklab');
    expect(shieldMat.fragmentShader).toContain('hexGrid');
    expect(shieldMat.fragmentShader).toContain('fresnelSchlick');
    expect(bossMat.fragmentShader).toContain('blackbody');
    expect(bossMat.fragmentShader).toContain('turbulence3');
    expect(fireballMat.fragmentShader).toContain('blackbody');
    expect(fireballMat.fragmentShader).toContain('turbulence3');
    expect(shockwaveMat.fragmentShader).toContain('ridgedFbm');
    expect(blastDomeMat.fragmentShader).toContain('hexGrid');
    expect(portalMat.fragmentShader).toContain('warpedFbm');
    expect(postPass.material.fragmentShader).toContain('tonemapAgXPunchy');
    expect(postPass.material.fragmentShader).toContain('ditherTPDF');

    // Verify shockwave, radar pulse, multi-shockwave array, portal archetype & chromatic aberration uniforms exist
    expect(deckMat.uniforms.uPulseAge).toBeDefined();
    expect(portalMat.uniforms.uArchetype).toBeDefined();
    expect(portalMat.uniforms.uProgress).toBeDefined();
    expect(postPass.uniforms.uShockProgress).toBeDefined();
    expect(postPass.uniforms.uShocks).toBeDefined();
    expect(postPass.uniforms.uChromaStrength).toBeDefined();
    expect(postPass.uniforms.uLowHpPulse).toBeDefined();
    expect(postPass.uniforms.uOverdrive).toBeDefined();
    expect(postPass.uniforms.uOverdriveColor).toBeDefined();
  });

  it('verifies all 25 Blender-exported .glb assets contain valid glTF 2.0 headers, BVH AO COLOR_0, stage buckets, vertex detail, and NLA clips', () => {
    const modelsDir = path.resolve(process.cwd(), 'public', 'assets', 'models');
    const bossClips = ['Idle', 'Charge', 'Attack', 'PhaseShift', 'Rest', 'ShiftToForm2', 'Form2', 'ShiftToForm3', 'Form3'];
    const expectedModels: Array<{
      file: string;
      animations: string[];
      hasReactorCore?: boolean;
      requireStageBuckets?: boolean;
      requireModularPlayer?: boolean;
      requireModularPrimary?: boolean;
      requireShipHullMat?: boolean;
      minVertices?: number;
    }> = [
      {
        file: 'player_vanguard.glb',
        animations: ['Idle', 'Attack', 'Dash', 'Overheat'],
        requireModularPlayer: true,
        requireShipHullMat: true,
        minVertices: 6000,
      },
      { file: 'enemy_small.glb', animations: ['Idle', 'Charge', 'Attack'], requireStageBuckets: true, minVertices: 1800 },
      { file: 'enemy_medium.glb', animations: ['Idle', 'Charge', 'Attack'], requireStageBuckets: true, minVertices: 1800 },
      { file: 'enemy_large.glb', animations: ['Idle', 'Charge', 'Attack'], requireStageBuckets: true, minVertices: 1800 },
      { file: 'enemy_splitter.glb', animations: ['Idle', 'Charge', 'Attack'], minVertices: 1000 },
      { file: 'enemy_elite.glb', animations: ['Idle', 'Charge', 'Attack'], requireStageBuckets: true, minVertices: 1800 },
      { file: 'boss_destroyer.glb', animations: bossClips, hasReactorCore: true, requireStageBuckets: true, minVertices: 4500 },
      { file: 'boss_summoner.glb', animations: bossClips, hasReactorCore: true, requireStageBuckets: true, minVertices: 4500 },
      { file: 'boss_overlord.glb', animations: bossClips, hasReactorCore: true, requireStageBuckets: true, minVertices: 4500 },
      { file: 'boss_leviathan.glb', animations: bossClips, hasReactorCore: true, requireStageBuckets: true, minVertices: 4500 },
      { file: 'boss_gemini.glb', animations: bossClips, hasReactorCore: true, requireStageBuckets: true, minVertices: 4500 },
      { file: 'boss_bastion.glb', animations: bossClips, hasReactorCore: true, requireStageBuckets: true, minVertices: 4500 },
      { file: 'prop_nova_bomb.glb', animations: ['Idle', 'Attack'], minVertices: 800 },
      { file: 'prop_mine_static.glb', animations: ['Idle', 'Attack'], minVertices: 800 },
      { file: 'prop_mine_homing.glb', animations: ['Idle', 'Attack'], minVertices: 800 },
      { file: 'prop_powerup_pod.glb', animations: ['Idle'], minVertices: 800 },
      { file: 'prop_medkit_pod.glb', animations: ['Idle'], minVertices: 800 },
      { file: 'wpn_pulse_blaster.glb', animations: ['Idle', 'Attack'], requireModularPrimary: true, requireShipHullMat: true, minVertices: 1400 },
      { file: 'wpn_scatter_cannon.glb', animations: ['Idle', 'Attack'], requireModularPrimary: true, requireShipHullMat: true, minVertices: 1400 },
      { file: 'wpn_rail_sniper.glb', animations: ['Idle', 'Attack'], requireModularPrimary: true, requireShipHullMat: true, minVertices: 1400 },
      { file: 'wpn_homing_pod.glb', animations: ['Idle', 'Attack'], requireModularPrimary: true, requireShipHullMat: true, minVertices: 1400 },
      { file: 'wpn_skill_salvo.glb', animations: ['Idle', 'Attack'], requireShipHullMat: true, minVertices: 1400 },
      { file: 'wpn_skill_beam.glb', animations: ['Idle', 'Attack'], requireShipHullMat: true, minVertices: 1400 },
      { file: 'wpn_skill_emp.glb', animations: ['Idle', 'Attack'], requireShipHullMat: true, minVertices: 1400 },
      { file: 'wpn_thermal_sink.glb', animations: ['Idle', 'Attack'], requireModularPrimary: true, requireShipHullMat: true, minVertices: 1400 },
    ];

    for (const spec of expectedModels) {
      const fullPath = path.join(modelsDir, spec.file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const buf = fs.readFileSync(fullPath);
      expect(buf.byteLength).toBeGreaterThan(20_000);
      expect(buf.byteLength).toBeLessThan(1_500_000);
      // Validate binary glTF 2.0 header ("glTF", version 2, JSON chunk 0x4E4F534A)
      expect(buf.subarray(0, 4).toString('ascii')).toBe('glTF');
      expect(buf.readUInt32LE(4)).toBe(2);
      const jsonLen = buf.readUInt32LE(12);
      const chunkType = buf.readUInt32LE(16);
      expect(chunkType).toBe(0x4e4f534a);

      const gltfJson = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf-8')) as {
        animations?: Array<{ name?: string }>;
        nodes?: Array<{ name?: string }>;
        materials?: Array<{ name?: string }>;
        meshes?: Array<{ primitives?: Array<{ attributes?: Record<string, number> }> }>;
      };
      const animNames = (gltfJson.animations ?? []).map((a) => a.name);
      for (const reqAnim of spec.animations) {
        expect(animNames).toContain(reqAnim);
      }
      const hasBakedAoColor = (gltfJson.meshes ?? []).some((m) =>
        (m.primitives ?? []).some((p) => 'COLOR_0' in (p.attributes ?? {}))
      );
      expect(hasBakedAoColor).toBe(true);
      if (
        spec.hasReactorCore ||
        spec.requireStageBuckets ||
        spec.requireModularPlayer ||
        spec.requireModularPrimary ||
        spec.requireShipHullMat ||
        spec.minVertices
      ) {
        const nodeNames = (gltfJson.nodes ?? []).map((n) => n.name ?? '');
        const matNames = (gltfJson.materials ?? []).map((m) => m.name ?? '');
        if (spec.hasReactorCore) {
          expect(nodeNames.some((n) => n.includes('ReactorCore'))).toBe(true);
        }
        if (spec.requireStageBuckets) {
          expect(nodeNames.some((n) => n.startsWith('Form1Only_'))).toBe(true);
          expect(nodeNames.some((n) => n.startsWith('Form2Only_') || n.startsWith('Form2_'))).toBe(true);
          expect(nodeNames.some((n) => n.startsWith('Form3_'))).toBe(true);
        }
        if (spec.requireShipHullMat) {
          expect(matNames.some((m) => m.includes('ShipHull_Primary'))).toBe(true);
        }
        if (spec.requireModularPlayer) {
          for (const prefix of [
            'StockNose_',
            'StockWingIn_L_',
            'StockWingIn_R_',
            'StockWingOut_L_',
            'StockWingOut_R_',
            'StockSpine_',
            'StockEngine_',
            'CoreArmor_T1_',
            'CoreArmor_T2_',
            'CoreShield_',
            'CoreEngine_T1_',
            'CoreEngine_T2_',
            'CoreCryo_',
            'CoreSensor_',
          ]) {
            expect(nodeNames.some((n) => n.includes(prefix))).toBe(true);
          }
        }
        if (spec.requireModularPrimary) {
          for (const prefix of [
            'SlotNose_',
            'SlotWingIn_',
            'SlotWingOut_',
            'OuterCap_',
            'Tier2_',
            'Tier3_',
          ]) {
            expect(nodeNames.some((n) => n.includes(prefix))).toBe(true);
          }
        }
        if (spec.minVertices) {
          const accessors = (gltfJson as { accessors?: Array<{ count?: number }> }).accessors ?? [];
          let totalVerts = 0;
          for (const mesh of gltfJson.meshes ?? []) {
            for (const prim of mesh.primitives ?? []) {
              const posIdx = prim.attributes?.POSITION;
              if (typeof posIdx === 'number' && accessors[posIdx]?.count) {
                totalVerts += accessors[posIdx].count ?? 0;
              }
            }
          }
          expect(totalVerts).toBeGreaterThanOrEqual(spec.minVertices);
        }
      }
      expect(buf.byteLength).toBeLessThan(1_500_000);
    }
  });

  it('transitions large enemy through windup before dash and preserves ScheduledBullet visualStyle', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;

    const large = createEnemy(sim.state, 'large', false, {
      x: sim.state.player.x + 120,
      y: sim.state.player.y,
    });
    large.aiState = 'windup';
    large.dashTimer = 2;
    large.dashDirX = -1;
    large.dashDirY = 0;
    sim.state.enemies.push(large);

    updateEnemySystem(sim.state);
    expect(large.aiState).toBe('windup');
    updateEnemySystem(sim.state);
    expect(large.aiState).toBe('dash');
    expect(large.dashTimer).toBe(22);

    // Run through dash duration back to chase
    for (let i = 0; i < 22; i++) {
      updateEnemySystem(sim.state);
    }
    expect(large.aiState).toBe('chase');

    // Verify ScheduledBullet.visualStyle propagates to BulletEntity
    sim.state.scheduledBullets.push({
      x: 400,
      y: 250,
      angle: Math.PI / 2,
      delayMs: 10,
      color: '#ff55ee',
      hex: 0xff55ee,
      damage: 12,
      speed: 4.2,
      visualStyle: 'petal',
    });

    sim.step(idleInput(), 1 / 60);
    const petalBullet = sim.state.bullets.find((b) => b.visualStyle === 'petal');
    expect(petalBullet).toBeDefined();
    expect(petalBullet?.isEnemy).toBe(true);
  });

  it('completes 3-stage boss arrival intro and emits BOSS_ENTRY_IMPACT once for all 6 archetypes', () => {
    for (const archetype of [0, 1, 2, 3, 4, 5] as const) {
      const bus = new EventBus();
      const sim = new GameSimulation(bus);
      sim.startNewGame();
      sim.state.wave = 5;
      sim.state.stormRing.centerX = 400;
      sim.state.stormRing.centerY = 300;
      sim.state.stormRing.targetCenterX = 400;
      sim.state.stormRing.targetCenterY = 300;
      sim.state.stormRing.transitionActive = false;
      sim.state.isResting = false;
      sim.state.waveTransition.active = false;
      sim.state.bossSpawnedForWave = true;

      let impactCount = 0;
      let impactArchetype = -1;
      bus.on('BOSS_ENTRY_IMPACT', (ev) => {
        impactCount++;
        impactArchetype = ev.archetype;
      });

      const boss = createBoss(sim.state, archetype);
      sim.state.boss = boss;
      expect(boss.entering).toBe(true);
      expect(boss.displayHp).toBe(0);

      for (let i = 0; i < 130 && boss.entering; i++) {
        sim.step(idleInput(), 1 / 60);
      }

      expect(impactCount).toBe(1);
      expect(impactArchetype).toBe(archetype);
      expect(boss.entering).toBe(false);
      expect(boss.y).toBe(118);
      expect(boss.displayHp).toBe(boss.maxHp);
    }
  });

  it('emits COMBO_KILL, escalates COMBO_RANK_UP tiers, and banks streak via COMBO_ENDED', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();

    let killEvents = 0;
    const ranks: string[] = [];
    let endedPayload: { rank: string; kills: number; score: number } | null = null;

    bus.on('COMBO_KILL', () => killEvents++);
    bus.on('COMBO_RANK_UP', ({ rank }) => ranks.push(rank));
    bus.on('COMBO_ENDED', (ev) => {
      endedPayload = ev;
    });

    for (let i = 0; i < 6; i++) {
      registerComboKill(sim.state, bus, 50, 'small');
    }

    expect(killEvents).toBe(6);
    expect(ranks).toContain('C');
    expect(ranks).toContain('B');
    expect(sim.state.combo.rank).toBe('B');

    updateComboSystem(sim.state, bus, 3000);
    expect(endedPayload).not.toBeNull();
    expect(endedPayload!.kills).toBe(6);
    expect(endedPayload!.rank).toBe('B');
    expect(sim.state.combo.kills).toBe(0);
  });

  it('spawns enemies organically off-screen beyond camera frustum and prevents offscreen shooting', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 3;
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;
    sim.state.player.x = 400;
    sim.state.player.y = 320;

    for (let i = 0; i < 4; i++) {
      const e = createEnemy(sim.state, 'medium', false, undefined, i, 4);
      e.lastShotMs = -10000;
      sim.state.enemies.push(e);
      expect(e.ingressActive).toBe(true);
      expect(Math.abs(e.x - 400) > 480 || Math.abs(e.y - 300) > 380).toBe(true);
    }

    // First 5 ticks: enemies are gliding from outside screen -> never fire off-screen
    for (let t = 0; t < 5; t++) {
      updateEnemySystem(sim.state);
    }
    expect(sim.state.bullets.length).toBe(0);

    // Finish ingress glide into visible arena
    for (let t = 0; t < 150; t++) {
      updateEnemySystem(sim.state);
    }
    for (const e of sim.state.enemies) {
      const distPlayer = Math.hypot(e.x - sim.state.player.x, e.y - sim.state.player.y);
      const distStorm = Math.hypot(
        e.x - sim.state.stormRing.centerX,
        e.y - sim.state.stormRing.centerY
      );
      expect(distPlayer).toBeLessThanOrEqual(450);
      expect(distStorm).toBeLessThanOrEqual(sim.state.stormRing.radius);
    }
  });

  it('disperses enemies via anti-clump tactical sectors rather than stacking into one ball', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 4;
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;
    sim.state.player.x = 400;
    sim.state.player.y = 300;

    const types: Array<'small' | 'medium' | 'large' | 'elite' | 'medium' | 'small'> = [
      'small',
      'medium',
      'large',
      'elite',
      'medium',
      'small',
    ];
    types.forEach((t, idx) => {
      const e = createEnemy(sim.state, t, false, { x: 400 + idx * 4, y: 150 + idx * 3 }, idx, types.length);
      e.lastShotMs = 1e9;
      sim.state.enemies.push(e);
    });

    for (let i = 0; i < 90; i++) {
      sim.step(idleInput({ moveX: Math.cos(i * 0.08), moveY: Math.sin(i * 0.08) }), 1 / 60);
    }

    let sumDist = 0;
    let pairs = 0;
    for (let i = 0; i < sim.state.enemies.length; i++) {
      const a = sim.state.enemies[i];
      expect(Number.isFinite(a.x)).toBe(true);
      expect(Number.isFinite(a.y)).toBe(true);
      for (let j = i + 1; j < sim.state.enemies.length; j++) {
        const b = sim.state.enemies[j];
        sumDist += Math.hypot(b.x - a.x, b.y - a.y);
        pairs++;
      }
    }
    expect(pairs).toBeGreaterThan(0);
    expect(sumDist / pairs).toBeGreaterThan(90);
  });

  it('executes 3-mode skills (salvo, railbeam, emp) and rewards Phase Graze energy', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 2;
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;
    sim.state.player.x = 200;
    sim.state.player.y = 300;
    sim.state.money = 1200;
    sim.state.wave = 1;
    sim.state.tutorialCircle = null;
    sim.state.arenaObstacles = [];
    sim.state.raid.activeObjective = null;
    expect(sim.state.player.loadout.slots.skill_1).toBeNull();
    expect(sim.mountWeapon('skill_1', 'skill_salvo').ok).toBe(true);
    sim.state.player.health = 999;
    sim.state.player.maxHealth = 999;
    const e1 = createEnemy(sim.state, 'large', false, { x: 420, y: 300 });
    const e2 = createEnemy(sim.state, 'large', false, { x: 520, y: 360 });
    e1.hp = 500;
    e1.maxHp = 500;
    e2.hp = 500;
    e2.maxHp = 500;
    sim.state.enemies.push(e1, e2);

    // 1. Default Skill Core (skill_salvo) ignores cycleSkillMode overrides; LV1 fires 2 missiles and scales on upgrade
    sim.cycleSkillMode('emp');
    expect(sim.state.player.skill.mode).toBe('salvo');
    const baseSkillDmg = sim.state.player.skill.damage;
    sim.step(idleInput({ bomb: true }), 1 / 60);
    expect(sim.state.bombs.length).toBe(2);
    sim.state.bombs.length = 0;

    expect(sim.upgradeWeaponSlot('skill_1', 'damage').ok).toBe(true);
    expect(sim.upgradeWeaponSlot('skill_1', 'damage').ok).toBe(true);
    expect(sim.state.player.skill.damage).toBeGreaterThan(baseSkillDmg);
    sim.state.hitStopMs = 0;
    sim.state.player.skill.lastUseMs = -20000;
    sim.state.player.energy = 100;
    sim.step(idleInput({ bomb: true }), 1 / 60);
    expect(sim.state.bombs.length).toBeGreaterThan(2);
    sim.state.bombs.length = 0;

    // 2. Switching Skill Core in Hangar to skill_beam enables Rail-Lance beam
    expect(sim.mountWeapon('skill_1', 'skill_beam').ok).toBe(true);
    sim.state.hitStopMs = 0;
    sim.state.player.skill.lastUseMs = -20000;
    sim.state.player.energy = 100;
    sim.state.bullets.push({
      id: 9001,
      x: 340,
      y: 300,
      dx: -1,
      dy: 0,
      speed: 2,
      radius: 5,
      damage: 5,
      color: '#ff4444',
      hex: 0xff4444,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
    });
    const prevHp1 = e1.hp;
    sim.step(
      idleInput({ bomb: true, aimMode: 'mouse', mouseActive: true, mouseArenaX: 600, mouseArenaY: 300 }),
      1 / 60
    );
    expect(sim.state.playerBeams.length).toBe(1);
    expect(e1.hp).toBeLessThan(prevHp1);
    expect(sim.state.bullets.some((b) => b.id === 9001)).toBe(false);

    // 3. Switching Skill Core in Hangar to skill_emp enables Chrono EMP chain lightning
    expect(sim.mountWeapon('skill_1', 'skill_emp').ok).toBe(true);
    sim.state.hitStopMs = 0;
    sim.state.player.skill.lastUseMs = -20000;
    sim.state.player.energy = 100;
    sim.state.bullets.push({
      id: 9002,
      x: sim.state.player.x + 80,
      y: sim.state.player.y,
      dx: 0,
      dy: 1,
      speed: 0,
      radius: 5,
      damage: 5,
      color: '#ff4444',
      hex: 0xff4444,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
    });
    sim.step(idleInput({ bomb: true }), 1 / 60);
    expect(sim.state.lightningArcs.length).toBe(1);
    expect(sim.state.bullets.some((b) => b.id === 9002)).toBe(false);

    // 4. Phase Graze refunds +10 energy during dash invulnerability
    let grazedCount = 0;
    bus.on('PLAYER_GRAZE', () => grazedCount++);
    sim.state.hitStopMs = 0;
    sim.state.player.energy = 50;
    sim.state.player.dashActive = true;
    sim.state.player.dashStartMs = sim.state.simTimeMs;
    sim.state.player.dashInvulnUntilMs = sim.state.simTimeMs + 200;
    sim.state.bullets.push({
      id: 9003,
      x: sim.state.player.x + sim.state.player.radius + 14,
      y: sim.state.player.y,
      dx: 0,
      dy: 0,
      speed: 0,
      radius: 5,
      damage: 10,
      color: '#ff4444',
      hex: 0xff4444,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(grazedCount).toBe(1);
    expect(sim.state.player.energy).toBeGreaterThan(50);
  });

  it('discards weapon-bound upgrades on weapon swap while preserving persistent Core upgrades', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.phase = 'SHOP';
    sim.state.money = 2500;

    // Mount rail_sniper on nose and invest weapon-bound upgrades
    const mountRail = sim.mountWeapon('nose', 'rail_sniper');
    expect(mountRail.ok).toBe(true);
    expect(sim.upgradeWeaponSlot('nose', 'damage').ok).toBe(true);
    expect(sim.upgradeWeaponSlot('nose', 'damage').ok).toBe(true);
    expect(sim.upgradeWeaponSlot('nose', 'pierce').ok).toBe(true);

    const railMounted = sim.state.player.loadout.slots.nose!;
    const railStats = computeMountedPrimaryStats(railMounted, sim.state.player);
    expect(railStats.damage).toBeGreaterThan(54);
    expect(railStats.pierce).toBe(3); // 2 base + 1 bound pierce upgrade

    // Invest into persistent Ship Core upgrades
    expect(sim.buyCoreItem('maxHealth').ok).toBe(true);
    expect(sim.buyCoreItem('speedBoost').ok).toBe(true);
    const coreHp = sim.state.player.maxHealth;
    const coreSpeed = sim.state.player.speed;
    expect(coreHp).toBe(125);
    expect(coreSpeed).toBeGreaterThan(2.75);

    // Swap nose weapon to scatter_cannon -> bound upgrades vanish, 35% salvage refunded, Core stays!
    const expectedSalvage = Math.floor(railMounted.investedCredits * 0.35);
    const swapRes = sim.mountWeapon('nose', 'scatter_cannon');
    expect(swapRes.ok).toBe(true);
    expect(swapRes.salvageRefund).toBe(expectedSalvage);

    const swapped = sim.state.player.loadout.slots.nose!;
    expect(swapped.weaponId).toBe('scatter_cannon');
    expect(Object.keys(swapped.upgrades).length).toBe(0);
    expect(computeMountedPrimaryStats(swapped, sim.state.player).pierce).toBe(0);

    // Ship Core upgrades persist unchanged
    expect(sim.state.player.maxHealth).toBe(coreHp);
    expect(sim.state.player.speed).toBe(coreSpeed);
  });

  it('fires mounted hardpoints independently and steers homing_pod projectiles toward enemies', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.tutorialCircle = null;
    sim.state.neededSpawn = false;
    sim.state.waveTransition.active = false;
    sim.state.isResting = false;
    sim.state.enemies = [createEnemy(sim.state, 'small', false, { x: 40, y: 40 })];
    sim.state.money = 1000;

    // Mount homing_pod on nose while keeping default wing pulse_blasters
    expect(sim.mountWeapon('nose', 'homing_pod').ok).toBe(true);

    // Clear initial enemies/obstacles/objectives and place a single off-axis hostile
    const foe = createEnemy(sim.state, 'large', false, { x: 400, y: 180 });
    sim.state.enemies = [foe];
    sim.state.arenaObstacles = [];
    sim.state.raid.activeObjective = null;
    sim.state.player.x = 400;
    sim.state.player.y = 420;
    sim.state.player.facingAngle = 0; // Aim right along +X while enemy sits UP along -Y

    sim.step(
      {
        moveX: 0,
        moveY: 0,
        shoot: true,
        dash: false,
        bomb: false,
        vent: false,
        aimMode: 'mouse',
        autoFire: false,
        mouseArenaX: 600,
        mouseArenaY: 420,
        mouseActive: true,
      },
      1 / 60
    );

    const homingBullets = sim.state.bullets.filter((b) => !b.isEnemy && b.homing);
    const pulseBullets = sim.state.bullets.filter((b) => !b.isEnemy && !b.homing);
    expect(homingBullets.length).toBe(2);
    expect(pulseBullets.length).toBe(1);

    const tracked = homingBullets[0];
    const initialDy = tracked.dy;

    // Advance 8 ticks and verify missile actively steers upward (dy becomes more negative toward enemy at y=180)
    for (let i = 0; i < 8; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(tracked.dy).toBeLessThan(initialDy - 0.15);
  });

  it('ships wpn_thermal_sink.glb (22nd GLB) and all 18 256x256 PNG item icons', () => {
    const modelsDir = path.resolve(process.cwd(), 'public/assets/models');
    const sinkPath = path.join(modelsDir, 'wpn_thermal_sink.glb');
    expect(fs.existsSync(sinkPath)).toBe(true);
    const sinkBuf = fs.readFileSync(sinkPath);
    expect(sinkBuf.subarray(0, 4).toString('ascii')).toBe('glTF');
    expect(sinkBuf.byteLength).toBeGreaterThan(2048);

    const iconsDir = path.resolve(process.cwd(), 'public/assets/icons');
    const expectedIcons = [
      'pulse_blaster.png',
      'scatter_cannon.png',
      'rail_sniper.png',
      'homing_pod.png',
      'thermal_sink.png',
      'skill_salvo.png',
      'skill_beam.png',
      'skill_emp.png',
      'core_dash.png',
      'core_energy.png',
      'core_greed.png',
      'core_health.png',
      'core_luck.png',
      'core_magnet.png',
      'core_max_health.png',
      'core_regen.png',
      'core_shield.png',
      'core_speed.png',
    ];
    for (const file of expectedIcons) {
      const fullPath = path.join(iconsDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const buf = fs.readFileSync(fullPath);
      // PNG magic bytes 89 50 4E 47
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
      expect(buf.byteLength).toBeGreaterThan(1024);
    }
  });

  it('enforces single skill_1 bay, separates rest Inventory from Boss Roulette Shop, and supports 3-in-1 Fusion + Synergies', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.isResting = true;
    sim.state.wave = 1;

    // Between normal waves: only Inventory mode opens (not Boss Shop)
    expect(sim.openInventoryIfAllowed()).toBe(true);
    expect(sim.state.phase).toBe('SHOP');
    expect(sim.state.player.loadout.garageMode).toBe('INVENTORY');
    expect(sim.state.player.loadout.activeArmoryTab).toBe('INVENTORY');
    expect('skill_2' in sim.state.player.loadout.slots).toBe(false);

    // Return to play, defeat boss -> Boss Shop mode with free spin ready & Augment/Hazard choices
    sim.closeShop();
    openShop(sim.state, bus);
    expect(sim.state.player.loadout.garageMode).toBe('SHOP');
    expect(sim.state.player.loadout.activeArmoryTab).toBe('ROULETTE');
    expect(sim.state.player.loadout.roulette.freeSpinAvailable).toBe(true);

    sim.state.money = 2000;
    const spinRes = sim.spinRoulette();
    expect(spinRes.ok).toBe(true);
    expect(sim.state.player.loadout.roulette.offers.length).toBe(3);
    const offer = sim.state.player.loadout.roulette.offers[0];
    const claimRes = sim.claimRouletteOffer(offer.offerId);
    expect(claimRes.ok).toBe(true);
    if (offer.weaponId) {
      expect(sim.state.player.loadout.inventory.some((i) => i.weaponId === offer.weaponId)).toBe(true);
    }

    // 3-in-1 Fusion: 3x tier-1 pulse_blaster -> 1x tier-2 pulse_blaster with higher damage
    sim.state.player.loadout.inventory.push(
      { instanceId: 'f1', weaponId: 'pulse_blaster', tier: 1, upgrades: {}, investedCredits: 90, lastFireMs: -1000, recoil: 0 },
      { instanceId: 'f2', weaponId: 'pulse_blaster', tier: 1, upgrades: {}, investedCredits: 90, lastFireMs: -1000, recoil: 0 },
      { instanceId: 'f3', weaponId: 'pulse_blaster', tier: 1, upgrades: {}, investedCredits: 90, lastFireMs: -1000, recoil: 0 }
    );
    const baseDmg = computeMountedPrimaryStats(
      sim.state.player.loadout.inventory.find((i) => i.instanceId === 'f1')!,
      sim.state.player
    ).damage;
    const fuseRes = sim.fuseWeapons('pulse_blaster', 1);
    expect(fuseRes.ok).toBe(true);
    expect(fuseRes.newTier).toBe(2);
    const fused =
      Object.values(sim.state.player.loadout.slots).find((w) => w?.weaponId === 'pulse_blaster' && w.tier === 2) ??
      sim.state.player.loadout.inventory.find((i) => i.weaponId === 'pulse_blaster' && i.tier === 2);
    expect(fused).toBeDefined();
    expect(computeMountedPrimaryStats(fused!, sim.state.player).damage).toBeGreaterThan(baseDmg);

    // Synergies count mounted equipment by manufacturer (start has 1 NOVACORP pulse_blaster -> mounting wing_r1 triggers Tier 1 Synergy)
    expect(sim.mountWeapon('wing_r1', 'pulse_blaster').ok).toBe(true);
    const synergies = computeActiveSynergies(sim.state.player);
    expect(synergies.counts.NOVACORP).toBeGreaterThanOrEqual(2);
  });

  it('simulates Heat Overload + thermal_sink cooling and floating world module attach', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.tutorialCircle = null;
    sim.state.neededSpawn = false;
    sim.state.waveTransition.active = false;
    sim.state.isResting = false;
    sim.state.enemies = [createEnemy(sim.state, 'small', false, { x: 40, y: 40 })];
    sim.state.money = 1000;

    // Mount wing_r1 shooter so mounting thermal_sink on wing_l1 leaves an active plasma weapon
    expect(sim.mountWeapon('wing_r1', 'pulse_blaster').ok).toBe(true);
    const baseCool = computePlayerCoolingRate(sim.state);
    expect(sim.mountWeapon('wing_l1', 'thermal_sink').ok).toBe(true);
    expect(computePlayerCoolingRate(sim.state)).toBeGreaterThan(baseCool + 15);

    // Heat reaches maxHeat -> triggers isOverloaded (capped at maxHeat + 18)
    sim.state.player.heat = 99;
    sim.step(idleInput({ shoot: true }), 1 / 60);
    expect(sim.state.player.isOverloaded).toBe(true);
    expect(sim.state.player.heat).toBeLessThanOrEqual(sim.state.player.maxHeat + 18);

    sim.state.player.heat = 115;
    sim.state.player.isOverloaded = true;
    const hpBefore = sim.state.player.health;
    for (let i = 0; i < 60; i++) {
      sim.state.player.heat = 115;
      sim.state.player.isOverloaded = true;
      sim.step(idleInput(), 1 / 60);
    }
    expect(sim.state.player.health).toBeLessThan(hpBefore);

    // World Floating Module direct attach
    sim.state.floatingModules.push({
      id: 9991,
      weaponId: 'rail_sniper',
      tier: 2,
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      pulse: 0,
      lifeMs: 5000,
    });
    expect(sim.attachFloatingModuleToSlot(9991, 'nose')).toBe(true);
    expect(sim.state.player.loadout.slots.nose?.weaponId).toBe('rail_sniper');
    expect(sim.state.player.loadout.slots.nose?.tier).toBe(2);
  });

  it('supports unrestricted Open Space flight, dynamic Storm Ring shrinking/burn, and Boss Arena Ring lock', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.tutorialCircle = null;
    sim.state.neededSpawn = false;
    sim.state.waveTransition.active = false;
    sim.state.isResting = false;
    sim.state.enemies = [createEnemy(sim.state, 'small', false, { x: 40, y: 40 })];

    configureStormRingForWave(sim.state, 1);
    const startRadius = sim.state.stormRing.radius;

    // Fly past the old 800x600 screen border - deep space has no imaginary walls anymore
    for (let i = 0; i < 220; i++) {
      sim.step(idleInput({ moveX: 1, moveY: 0 }), 1 / 60);
    }
    expect(sim.state.player.x).toBeGreaterThan(920);
    expect(sim.state.stormRing.radius).toBeLessThan(startRadius);

    // Push player well outside stormRing boundary and verify Storm Burn
    sim.state.player.x = sim.state.stormRing.centerX + sim.state.stormRing.radius + 120;
    const hpBeforeStorm = sim.state.player.health;
    for (let i = 0; i < 30; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(sim.state.stormRing.outsideStorm).toBe(true);
    expect(sim.state.player.health).toBeLessThan(hpBeforeStorm);

    // Wave 5 locks Boss Arena Ring around current flight zone and smoothly shrinks over time (no instant snap)
    configureStormRingForWave(sim.state, 5);
    expect(sim.state.stormRing.bossLocked).toBe(true);
    expect(sim.state.stormRing.phase).toBe('BOSS_LOCK');
    expect(sim.state.stormRing.transitionActive).toBe(true);
    expect(sim.state.stormRing.targetRadius).toBe(620);

    const beforeShrinkR = sim.state.stormRing.radius;
    for (let i = 0; i < 45; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(sim.state.stormRing.radius).toBeLessThan(beforeShrinkR);
    expect(sim.state.stormRing.radius).toBeGreaterThan(620);
  });

  it('generates seeded procedural sector maps per match and smoothly expands Storm Ring between waves', () => {
    const mapA1 = generateSectorMap(424242);
    const mapA2 = generateSectorMap(424242);
    const mapB = generateSectorMap(999111);
    expect(mapA1.biomeId).toBe(mapA2.biomeId);
    expect(mapA1.props.length).toBeGreaterThanOrEqual(30);
    expect(mapA1.props[0].x).toBe(mapA2.props[0].x);
    expect(mapA1.props[0].x).not.toBe(mapB.props[0].x);

    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.tutorialCircle = null;
    sim.state.neededSpawn = false;
    sim.state.waveTransition.active = false;
    sim.state.isResting = false;
    sim.state.enemies = [createEnemy(sim.state, 'small', false, { x: 40, y: 40 })];

    // Compiles GLSL3 Storm Wall shader cleanly
    const stormShader = createStormWallMaterial();
    expect(stormShader.uniforms.uPulse).toBeDefined();

    // Smooth expansion transition eases radius upward smoothly rather than jumping in 1 frame
    sim.state.stormRing.radius = 650;
    startStormTransition(sim.state, sim.state.player.x, sim.state.player.y, 1240, 1200, 'EXPANDING');
    sim.step(idleInput(), 1 / 60);
    expect(sim.state.stormRing.transitionActive).toBe(true);
    expect(sim.state.stormRing.radius).toBeGreaterThan(650);
    expect(sim.state.stormRing.radius).toBeLessThan(1240);
  });

  it('simulates 3-zone Heat mechanics (Redline +18% DMG, Overheat cadence penalty & cooling hysteresis) and Boss Roulette Lock + Pity', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 1;
    sim.state.tutorialCircle = null;
    sim.state.neededSpawn = false;
    sim.state.waveTransition.active = false;
    sim.state.isResting = false;
    sim.state.enemies = [createEnemy(sim.state, 'small', false, { x: 160, y: 0 })];
    sim.state.raid.activeObjective = null;
    sim.state.arenaObstacles = [];

    const mountedLeft = sim.state.player.loadout.slots.wing_l1!;
    expect(mountedLeft).toBeTruthy();

    // Cool vs Redline (60–99%) vs Overheat (>=100%)
    sim.state.player.heat = 0;
    sim.state.player.isOverloaded = false;
    const coolStats = computeMountedPrimaryStats(mountedLeft, sim.state.player, 'wing_l1');

    sim.state.player.heat = 70;
    sim.state.player.isOverloaded = false;
    const redlineStats = computeMountedPrimaryStats(mountedLeft, sim.state.player, 'wing_l1');
    expect(redlineStats.damage).toBe(Math.round(coolStats.damage * 1.18));
    expect(redlineStats.cooldownMs).toBe(coolStats.cooldownMs);

    sim.state.player.heat = 105;
    sim.state.player.isOverloaded = true;
    const overheatStats = computeMountedPrimaryStats(mountedLeft, sim.state.player, 'wing_l1');
    expect(overheatStats.cooldownMs).toBeGreaterThan(Math.round(coolStats.cooldownMs * 1.35));
    expect(overheatStats.damage).toBeGreaterThan(redlineStats.damage);

    // Per-weapon heat hierarchy: pulse_blaster < homing_pod < scatter_cannon < rail_sniper
    const heatOf = (id: 'pulse_blaster' | 'homing_pod' | 'scatter_cannon' | 'rail_sniper') =>
      (WEAPON_CATALOG[id] as PrimaryWeaponCatalogEntry).heatPerShot;
    expect(heatOf('pulse_blaster')).toBeLessThan(heatOf('homing_pod'));
    expect(heatOf('homing_pod')).toBeLessThan(heatOf('scatter_cannon'));
    expect(heatOf('scatter_cannon')).toBeLessThan(heatOf('rail_sniper'));

    // Sustained continuous twin-mount fire for 5 seconds (300 frames) builds heat gradually without instant lockup
    sim.state.money = 1000;
    expect(sim.mountWeapon('wing_r1', 'pulse_blaster').ok).toBe(true);
    sim.state.player.heat = 0;
    sim.state.player.isOverloaded = false;
    for (let i = 0; i < 300; i++) {
      sim.step(idleInput({ shoot: true }), 1 / 60);
    }
    expect(sim.state.player.heat).toBeGreaterThan(15);
    expect(sim.state.player.heat).toBeLessThan(65);
    expect(sim.state.player.isOverloaded).toBe(false);

    // Cryo Coolant Core raises maxHeat (+20) and cooling rate while lowering weapon heat scale
    const baseMaxHeat = sim.state.player.maxHeat;
    const baseCooling = computePlayerCoolingRate(sim.state);
    const baseHeatScale = computeWeaponHeatScale(sim.state);
    sim.state.shop.levels.cryoCooler = (sim.state.shop.levels.cryoCooler ?? 0) + 1;
    applyShopUpgrade(sim.state, 'cryoCooler');
    expect(sim.state.player.maxHeat).toBe(baseMaxHeat + 20);
    expect(computePlayerCoolingRate(sim.state)).toBeGreaterThan(baseCooling);
    expect(computeWeaponHeatScale(sim.state)).toBeLessThan(baseHeatScale);

    // Mounting thermal_sink further raises cooling rate and reduces per-shot heat draw
    const coolingBeforeSink = computePlayerCoolingRate(sim.state);
    const heatScaleBeforeSink = computeWeaponHeatScale(sim.state);
    sim.state.floatingModules.push({
      id: 9992,
      weaponId: 'thermal_sink',
      tier: 1,
      x: sim.state.player.x,
      y: sim.state.player.y,
      vx: 0,
      vy: 0,
      pulse: 0,
      lifeMs: 5000,
    });
    expect(sim.attachFloatingModuleToSlot(9992, 'wing_l2')).toBe(true);
    expect(computePlayerCoolingRate(sim.state)).toBeGreaterThan(coolingBeforeSink);
    expect(computeWeaponHeatScale(sim.state)).toBeLessThan(heatScaleBeforeSink);

    // Releasing trigger vents heat quickly and clears Overload once <= 72%
    sim.state.phase = 'PLAYING';
    sim.state.player.pendingLevelUps = 0;
    sim.state.player.heat = 82;
    sim.state.player.isOverloaded = true;
    sim.state.player.lastShotMs = -2000;
    for (let i = 0; i < 90; i++) {
      if ((sim.state.phase as string) === 'QUICK_DRAFT') {
        sim.pickQuickDraftByIndex(0);
      }
      sim.step(idleInput({ shoot: false }), 1 / 60);
    }
    expect(sim.state.player.heat).toBeLessThanOrEqual(72);
    expect(sim.state.player.isOverloaded).toBe(false);

    // Boss Roulette: discounts, lock preservation (max 2, +$15 fee) & Epic pity
    sim.state.money = 3000;
    openShop(sim.state, bus);
    const firstSpin = sim.spinRoulette();
    expect(firstSpin.ok).toBe(true);
    expect(firstSpin.offers.length).toBe(3);
    for (const o of firstSpin.offers) {
      expect(o.originalPrice).toBeGreaterThanOrEqual(o.price);
    }

    const basePaidCost = getRouletteSpinCost(sim.state);
    expect(sim.toggleRouletteLock(firstSpin.offers[0].offerId)).toEqual({ ok: true, locked: true });
    expect(sim.toggleRouletteLock(firstSpin.offers[1].offerId)).toEqual({ ok: true, locked: true });
    expect(sim.toggleRouletteLock(firstSpin.offers[2].offerId)).toEqual({
      ok: false,
      reason: 'max_locks',
    });
    expect(getRouletteSpinCost(sim.state)).toBe(basePaidCost + 30);

    const lockedOffer0Id = firstSpin.offers[0].offerId;
    const lockedOffer1Id = firstSpin.offers[1].offerId;
    const lockedRespin = sim.spinRoulette();
    expect(lockedRespin.ok).toBe(true);
    expect(lockedRespin.offers[0].offerId).toBe(lockedOffer0Id);
    expect(lockedRespin.offers[1].offerId).toBe(lockedOffer1Id);
    expect(lockedRespin.offers[2].offerId).not.toBe(firstSpin.offers[2].offerId);

    // Unlock and verify rebalanced Epic odds (capped <= 16%), 5-spin pity threshold & max 1 Epic/spin
    sim.toggleRouletteLock(lockedOffer0Id);
    sim.toggleRouletteLock(lockedOffer1Id);
    expect(ROULETTE_PITY_THRESHOLD).toBe(5);
    expect(getRouletteEpicChance(sim.state)).toBeLessThanOrEqual(0.1);
    sim.state.bossKills = 10;
    sim.state.player.dropChanceBonus = 2.0;
    expect(getRouletteEpicChance(sim.state)).toBeLessThanOrEqual(0.16);
    sim.state.bossKills = 0;
    sim.state.player.dropChanceBonus = 0;

    sim.state.player.loadout.roulette.pityCount = ROULETTE_PITY_THRESHOLD;
    const pitySpin = sim.spinRoulette();
    expect(pitySpin.ok).toBe(true);
    const epicOffers = pitySpin.offers.filter((o) => o.rarity === 'epic');
    expect(epicOffers.length).toBe(1);
    expect(sim.state.player.loadout.roulette.pityCount).toBe(0);
    for (const o of epicOffers) {
      expect(o.price).toBeLessThan(o.originalPrice);
      if ((o.kind === 'weapon' || o.kind === 'skill') && o.weaponId) {
        expect(o.price).toBeGreaterThan(WEAPON_CATALOG[o.weaponId].price);
      }
    }
  });

  it('reworks Boss encounters with anti-repeat rotation, procedural mutators, Aegis Pylons, Mirage Clones, Orbital Zones, Gravity Wells & Phase 3 Evolution', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.wave = 5;
    sim.state.tutorialCircle = null;
    sim.state.neededSpawn = false;
    sim.state.waveTransition.active = false;
    sim.state.isResting = false;

    // Anti-repeat rotation & procedural mutation counts per Boss wave
    const b1 = createBoss(sim.state);
    const b2 = createBoss(sim.state);
    expect(b1.archetype).not.toBe(b2.archetype);
    expect(b1.mutations.length).toBe(1);

    sim.state.wave = 10;
    const b3 = createBoss(sim.state);
    expect(b3.archetype).not.toBe(b2.archetype);
    expect(b3.mutations.length).toBe(2);

    // Shield Pylons (-65% DR) -> Shield Break Stagger (1.75x vulnerability)
    sim.state.wave = 5;
    const boss = createBoss(sim.state, 0, ['AEGIS_PYLONS']);
    boss.entering = false;
    boss.hp = 2000;
    boss.maxHp = 2000;
    boss.displayHp = 2000;
    sim.state.boss = boss;
    boss.pylons.push({
      id: 9001,
      x: boss.x + 80,
      y: boss.y,
      hp: 100,
      maxHp: 100,
      radius: 21,
      angle: 0,
      orbitRadius: 80,
      hitFlash: 0,
      fireTimerMs: 1000,
      hex: 0x34d399,
    });
    sim.state.player.heat = 60;
    sim.state.player.energy = 50;

    hitBoss(sim.state, boss, 100, false, boss.x, boss.y, bus);
    expect(boss.hp).toBe(2000 - 35); // -65% shield reduction

    expect(hitBossPylon(sim.state, boss, boss.pylons[0], 120, true, bus)).toBe(true);
    expect(boss.pylons.length).toBe(0);
    expect(boss.staggerTimerMs).toBeGreaterThan(2500);
    expect(sim.state.player.heat).toBe(25); // vented -35 heat
    expect(sim.state.player.energy).toBe(75); // +25 energy

    const hpPreStagger = boss.hp;
    hitBoss(sim.state, boss, 100, false, boss.x, boss.y, bus);
    expect(boss.hp).toBe(hpPreStagger - 135); // 1.35x stagger bonus

    // Mirage Clone destroy grants energy & cools heat
    boss.staggerTimerMs = 0;
    boss.clones.push({
      id: 9002,
      x: boss.x - 120,
      y: boss.y,
      hp: 80,
      maxHp: 80,
      radius: 30,
      angle: Math.PI,
      lifeMs: 5000,
      maxLifeMs: 5000,
      fireTimerMs: 1000,
      hitFlash: 0,
      hex: 0x22d3ee,
    });
    sim.state.player.energy = 40;
    expect(hitBossClone(sim.state, boss, boss.clones[0], 90, false, bus)).toBe(true);
    expect(boss.clones.length).toBe(0);
    expect(sim.state.player.energy).toBe(60);

    // Orbital Hazard Zone detonation & Gravity Well pull
    sim.state.hitStopMs = 0;
    sim.state.player.x = 400;
    sim.state.player.y = 400;
    sim.state.player.shieldCooldownMs = 5000;
    sim.state.player.shieldActive = false;
    const hpPreHazard = sim.state.player.health;
    boss.hazardZones.push({
      id: 9003,
      x: 400,
      y: 400,
      radius: 80,
      warningMs: 10,
      maxWarningMs: 1000,
      detonateFlashMs: 0,
      damage: 15,
      hex: 0xfb7185,
      detonated: false,
    });
    boss.gravityWells.push({
      id: 9004,
      x: 500,
      y: 400,
      radius: 260,
      pullStrength: 3.0,
      lifeMs: 2000,
      maxLifeMs: 2000,
      pulse: 0,
      hex: 0xa855f7,
    });
    sim.step(idleInput(), 1 / 60);
    expect(sim.state.player.health).toBeLessThan(hpPreHazard);
    expect(sim.state.player.x).toBeGreaterThan(400);

    // Multi-beam Laser Carousel spin while active, then Phase 3 Mid-Fight Mutation Evolution cleanly cancels active weapons
    boss.laserFiring = true;
    boss.laserBeamCount = 3;
    boss.laserSpinSpeed = 0.02;
    boss.laserTimerMs = 1000;
    const angleBefore = boss.laserAngle;
    sim.step(idleInput(), 1 / 60);
    expect(boss.laserAngle).toBeGreaterThan(angleBefore);

    boss.hp = Math.floor(boss.maxHp * 0.25); // triggers Phase 3 Enrage + evolves 2nd mutation
    sim.step(idleInput(), 1 / 60);
    expect(boss.phase).toBe(3);
    expect(boss.enraged).toBe(true);
    expect(boss.transitioning).toBe(true);
    expect(boss.laserFiring).toBe(false);
    expect(boss.mutations.length).toBe(2);
    expect(boss.mutations[1]).not.toBe(boss.mutations[0]);
  });

  it('supports v11.0 Boss species (Leviathan IK, Gemini Twin & Tether, Bastion Shatter Armor) and 3-Stage Boss/Bot Evolution', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.isResting = false;
    sim.state.waveTransition.active = false;
    sim.state.bossSpawnedForWave = true;

    // 1. Enemy Bot 3-Stage Evolution across Waves 1 / 6 / 11
    sim.state.wave = 1;
    const e1 = createEnemy(sim.state, 'medium', false, { x: 400, y: 200 });
    sim.state.wave = 6;
    const e2 = createEnemy(sim.state, 'medium', false, { x: 400, y: 200 });
    sim.state.wave = 11;
    const e3 = createEnemy(sim.state, 'medium', false, { x: 400, y: 200 });
    expect(e1.evolutionTier).toBe(1);
    expect(e2.evolutionTier).toBe(2);
    expect(e3.evolutionTier).toBe(3);
    expect(e2.speed).toBeGreaterThan(e1.speed);
    expect(e3.speed).toBeGreaterThan(e2.speed);

    // 2. Leviathan Hydra (3): 6-segment trailing IK spine follows moving head
    sim.state.wave = 5;
    const levi = createBoss(sim.state, 3, ['AEGIS_PYLONS']);
    levi.entering = false;
    levi.displayHp = levi.maxHp;
    sim.state.boss = levi;
    expect(levi.segments.length).toBe(6);
    const oldSegX = levi.segments[0].x;
    levi.x += 90;
    sim.step(idleInput(), 1 / 60);
    expect(Math.abs(levi.segments[0].x - oldSegX)).toBeGreaterThan(10);
    for (const seg of levi.segments) {
      expect(Number.isFinite(seg.x) && Number.isFinite(seg.y)).toBe(true);
    }

    // 3. Gemini Twin Cores (4): Omega shares Boss HP & active Plasma Tether slices player
    const gem = createBoss(sim.state, 4, ['MIRAGE_PROTOCOL']);
    gem.entering = false;
    gem.hp = 2000;
    gem.maxHp = 2000;
    gem.displayHp = 2000;
    gem.x = 300;
    gem.y = 300;
    expect(gem.twin).not.toBeNull();
    gem.twin!.x = 500;
    gem.twin!.y = 300;
    sim.state.boss = gem;
    sim.state.bullets.push({
      id: 99101,
      x: gem.twin!.x,
      y: gem.twin!.y,
      dx: 1,
      dy: 0,
      speed: 0,
      radius: 8,
      damage: 100,
      color: '#38e8ff',
      hex: 0x38e8ff,
      isEnemy: false,
      pierceLeft: 0,
      hitIds: new Set(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
    });
    sim.state.player.x = 400;
    sim.state.player.y = 300; // right on the Alpha <-> Omega tether line
    sim.state.player.shieldCooldownMs = 5000;
    sim.state.player.shieldActive = false;
    const hpBeforeTether = sim.state.player.health;
    gem.twin!.tetherActiveMs = 1500;
    sim.step(idleInput(), 1 / 60);
    expect(gem.hp).toBeLessThan(2000);
    expect(sim.state.player.health).toBeLessThan(hpBeforeTether);

    // 4. Bastion Colossus (5): 4->2->0 Shatter Armor DR/Exposure + 3-Stage Boss transformStage/transformBlend
    const bast = createBoss(sim.state, 5, ['ORBITAL_ARTILLERY']);
    bast.entering = false;
    bast.hp = 2000;
    bast.maxHp = 2000;
    bast.displayHp = 2000;
    sim.state.boss = bast;
    expect(bast.armorPlates).toBe(4);
    expect(bast.transformStage).toBe(1);

    hitBoss(sim.state, bast, 100, false, bast.x, bast.y, bus);
    expect(bast.hp).toBe(2000 - 65); // 0.65x armored DR

    const phaseEvents: Array<{ archetype: number; phase: 2 | 3; x: number; y: number; hex: number }> = [];
    const unsubPhase = bus.on('BOSS_PHASE_CHANGED', (ev) => phaseEvents.push(ev));

    // Drop below 60% -> Form II + 2 armor plates shattered (0.85x DR)
    bast.hp = Math.floor(bast.maxHp * 0.55);
    sim.step(idleInput(), 1 / 60);
    expect(bast.transformStage).toBe(2);
    expect(bast.transformBlend).toBeGreaterThan(0);
    expect(bast.armorPlates).toBe(2);
    expect(bast.transitioning).toBe(true);
    expect(phaseEvents[0]).toEqual({
      archetype: 5,
      phase: 2,
      x: expect.any(Number),
      y: expect.any(Number),
      hex: bast.hex,
    });
    const hpStage2 = bast.hp;
    hitBoss(sim.state, bast, 100, false, bast.x, bast.y, bus);
    expect(bast.hp).toBe(hpStage2 - 85);

    // Drop below 30% -> Form III Apex Overdrive + 0 armor plates (1.20x exposed core!)
    bast.hp = Math.floor(bast.maxHp * 0.25);
    sim.step(idleInput(), 1 / 60);
    expect(bast.transformStage).toBe(3);
    expect(bast.armorPlates).toBe(0);
    expect(bast.transitioning).toBe(true);
    expect(phaseEvents[1]).toEqual({
      archetype: 5,
      phase: 3,
      x: expect.any(Number),
      y: expect.any(Number),
      hex: bast.hex,
    });
    unsubPhase();
    const hpStage3 = bast.hp;
    hitBoss(sim.state, bast, 100, false, bast.x, bast.y, bus);
    expect(bast.hp).toBe(hpStage3 - 120);
  });

  it('replaces stock Vanguard airframe structures, unlocks progressive Core hardware, switches weapon slot forms, and unifies Faction Livery', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();

    const makeBuckets = (): PlayerChassisBuckets => ({
      stockHullShell: [new THREE.Object3D()],
      stockNose: [new THREE.Object3D()],
      stockWingInL: [new THREE.Object3D()],
      stockWingInR: [new THREE.Object3D()],
      stockWingOutL: [new THREE.Object3D()],
      stockWingOutR: [new THREE.Object3D()],
      stockSpine: [new THREE.Object3D()],
      stockEngine: [new THREE.Object3D()],
      coreArmorT1: [new THREE.Object3D()],
      coreArmorT2: [new THREE.Object3D()],
      coreShield: [new THREE.Object3D()],
      coreEngineT1: [new THREE.Object3D()],
      coreEngineT2: [new THREE.Object3D()],
      coreCryo: [new THREE.Object3D()],
      coreSensor: [new THREE.Object3D()],
    });

    const buckets = makeBuckets();
    // Starter Bare Scrap Tug has only wing_l1 pulse_blaster mounted (skill_1 & armorTier are empty)
    applyPlayerChassisMorph(buckets, sim.state);
    expect(buckets.stockHullShell[0].visible).toBe(true);
    expect(buckets.stockNose[0].visible).toBe(true);
    expect(buckets.stockWingInL[0].visible).toBe(false);
    expect(buckets.stockWingOutL[0].visible).toBe(false);
    expect(buckets.stockSpine[0].visible).toBe(true);
    expect(buckets.stockEngine[0].visible).toBe(true);
    expect(buckets.coreArmorT1[0].visible).toBe(false);

    // Unmounting wing_l1 & skill_1 reveals StockWingIn_L + StockWingOut_L + StockSpine; mounting wing_l2 replaces StockWingOut_L
    sim.state.player.loadout.slots.wing_l1 = null;
    sim.state.player.loadout.slots.skill_1 = null;
    applyPlayerChassisMorph(buckets, sim.state);
    expect(buckets.stockWingInL[0].visible).toBe(true);
    expect(buckets.stockWingOutL[0].visible).toBe(true);
    expect(buckets.stockSpine[0].visible).toBe(true);

    sim.state.player.loadout.slots.wing_l2 = {
      instanceId: 'test-l2',
      weaponId: 'rail_sniper',
      tier: 1,
      upgrades: {},
      investedCredits: 0,
      lastFireMs: 0,
      recoil: 0,
    };
    sim.state.player.loadout.slots.nose = {
      instanceId: 'test-nose',
      weaponId: 'scatter_cannon',
      tier: 2,
      upgrades: {},
      investedCredits: 0,
      lastFireMs: 0,
      recoil: 0,
    };
    sim.state.player.loadout.slots.skill_1 = {
      instanceId: 'test-skill',
      weaponId: 'skill_salvo',
      tier: 1,
      upgrades: {},
      investedCredits: 0,
      lastFireMs: 0,
      recoil: 0,
    };
    applyPlayerChassisMorph(buckets, sim.state);
    expect(buckets.stockNose[0].visible).toBe(false);
    expect(buckets.stockWingOutL[0].visible).toBe(false);
    expect(buckets.stockSpine[0].visible).toBe(false);

    // Progressive Core hardware unlocks at exact Shop levels
    sim.state.shop.levels.maxHealth = 1;
    sim.state.shop.levels.shield = 1;
    sim.state.shop.levels.speedBoost = 1;
    sim.state.shop.levels.cryoCooler = 1;
    sim.state.shop.levels.magnet = 1;
    let morphRes = applyPlayerChassisMorph(buckets, sim.state);
    expect(morphRes.armorTier).toBe(1);
    expect(morphRes.engineTier).toBe(1);
    expect(buckets.stockEngine[0].visible).toBe(false);
    expect(buckets.stockHullShell[0].visible).toBe(false);
    expect(buckets.coreArmorT1[0].visible).toBe(true);
    expect(buckets.coreArmorT2[0].visible).toBe(false);
    expect(buckets.coreShield[0].visible).toBe(true);
    expect(buckets.coreEngineT1[0].visible).toBe(true);
    expect(buckets.coreEngineT2[0].visible).toBe(false);
    expect(buckets.coreCryo[0].visible).toBe(true);
    expect(buckets.coreSensor[0].visible).toBe(true);

    sim.state.shop.levels.regen = 3;
    sim.state.shop.levels.dashCooldown = 2;
    morphRes = applyPlayerChassisMorph(buckets, sim.state);
    expect(morphRes.armorTier).toBe(2);
    expect(morphRes.engineTier).toBe(2);
    expect(buckets.coreArmorT2[0].visible).toBe(true);
    expect(buckets.coreEngineT1[0].visible).toBe(false);
    expect(buckets.coreEngineT2[0].visible).toBe(true);

    // Weapon slot form switching + OuterCap + Fusion Tier visibility
    const wParts: WeaponPartMeta[] = [
      { obj: new THREE.Object3D(), slotForm: 'nose', isOuterCap: false, minTier: 1 },
      { obj: new THREE.Object3D(), slotForm: 'wing_in', isOuterCap: false, minTier: 1 },
      { obj: new THREE.Object3D(), slotForm: 'wing_in', isOuterCap: true, minTier: 1 },
      { obj: new THREE.Object3D(), slotForm: 'wing_in', isOuterCap: false, minTier: 2 },
      { obj: new THREE.Object3D(), slotForm: 'wing_out', isOuterCap: false, minTier: 1 },
      { obj: new THREE.Object3D(), slotForm: 'wing_out', isOuterCap: false, minTier: 3 },
    ];
    applyWeaponSlotForm(wParts, 'nose', false, 1);
    expect(wParts.map((p) => p.obj.visible)).toEqual([true, false, false, false, false, false]);

    applyWeaponSlotForm(wParts, 'wing_l1', false, 2);
    expect(wParts.map((p) => p.obj.visible)).toEqual([false, true, true, true, false, false]);

    applyWeaponSlotForm(wParts, 'wing_l1', true, 2);
    expect(wParts.map((p) => p.obj.visible)).toEqual([false, true, false, true, false, false]);

    applyWeaponSlotForm(wParts, 'wing_l2', false, 3);
    expect(wParts.map((p) => p.obj.visible)).toEqual([false, false, false, false, true, true]);

    // Dominant Faction Livery selection & ShipHull_* material repainting (preserving WeaponSig & Canopy)
    sim.state.player.loadout.slots = {
      nose: null,
      wing_l1: { instanceId: 'i1', weaponId: 'scatter_cannon', tier: 1, upgrades: {}, investedCredits: 0, lastFireMs: 0, recoil: 0 },
      wing_r1: { instanceId: 'i2', weaponId: 'scatter_cannon', tier: 1, upgrades: {}, investedCredits: 0, lastFireMs: 0, recoil: 0 },
      wing_l2: null,
      wing_r2: null,
      skill_1: null,
    };
    expect(resolveDominantFactionLivery(sim.state)).toBe('IRONFORGE');

    sim.state.player.loadout.slots.wing_l1!.weaponId = 'rail_sniper';
    sim.state.player.loadout.slots.wing_r1!.weaponId = 'rail_sniper';
    expect(resolveDominantFactionLivery(sim.state)).toBe('AETHER');

    sim.state.player.loadout.slots.wing_l1!.weaponId = 'homing_pod';
    sim.state.player.loadout.slots.wing_r1!.weaponId = 'homing_pod';
    expect(resolveDominantFactionLivery(sim.state)).toBe('VOIDTECH');

    sim.state.player.loadout.slots.wing_l1!.weaponId = 'pulse_blaster';
    sim.state.player.loadout.slots.wing_r1!.weaponId = 'pulse_blaster';
    expect(resolveDominantFactionLivery(sim.state)).toBe('NOVACORP');

    const mPrim = new THREE.MeshStandardMaterial({ name: 'ShipHull_Primary', color: 0xffffff });
    const mSec = new THREE.MeshStandardMaterial({ name: 'ShipHull_Secondary', color: 0x000000 });
    const mAcc = new THREE.MeshStandardMaterial({ name: 'ShipHull_Accent', color: 0x000000 });
    const mFrm = new THREE.MeshStandardMaterial({ name: 'ShipHull_Frame', color: 0x000000 });
    const mGlw = new THREE.MeshStandardMaterial({ name: 'ShipHull_Glow', color: 0x000000, emissive: 0x000000 });
    const mSig = new THREE.MeshStandardMaterial({ name: 'WeaponSigCyan', color: 0x22eeff, emissive: 0x11ccff });
    const mCan = new THREE.MeshStandardMaterial({ name: 'ShipHull_Canopy', color: 0x051018 });

    applyFactionLiveryToMaterials([mPrim, mSec, mAcc, mFrm, mGlw, mSig, mCan], 'AETHER');
    const aether = FACTION_LIVERY_PALETTES.AETHER;
    expect(mPrim.color.getHex()).toBe(aether.primary.colorHex);
    expect(mSec.color.getHex()).toBe(aether.secondary.colorHex);
    expect(mAcc.color.getHex()).toBe(aether.accent.colorHex);
    expect(mAcc.metalness).toBe(aether.accent.metalness);
    expect(mFrm.color.getHex()).toBe(aether.frame.colorHex);
    expect(mGlw.emissive.getHex()).toBe(aether.glowHex);
    expect(mGlw.userData.baseEmissiveHex).toBe(aether.glowHex);
    expect(mSig.color.getHex()).toBe(0x22eeff);
    expect(mCan.color.getHex()).toBe(0x051018);

    // Verify player_vanguard.glb contains StockHullShell_ and bare scrap parts
    const vanguardPath = path.resolve(process.cwd(), 'public/assets/models/player_vanguard.glb');
    const glbBuf = fs.readFileSync(vanguardPath);
    const jsonLen = glbBuf.readUInt32LE(12);
    const gltf = JSON.parse(glbBuf.toString('utf8', 20, 20 + jsonLen)) as {
      nodes?: Array<{ name?: string }>;
    };
    const nodeNames = (gltf.nodes ?? []).map((n) => n.name ?? '');
    expect(nodeNames.some((nm) => nm.includes('StockHullShell_'))).toBe(true);
    expect(nodeNames.some((nm) => nm.includes('CoreArmor_T1_'))).toBe(true);
  });

  it('enforces Zero-Emoji UI compliance and provides 4 panoramic sector route banners', () => {
    const rootDir = process.cwd();
    const badGlyphRe =
      /[^\x00-\x7F\u00C0-\u024F\u1E00-\u1EFF\u00B7\u2014\u2013\u2026\u00B0\u00D7]/;
    const filesToCheck: string[] = [path.join(rootDir, 'index.html')];
    const walkTs = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walkTs(full);
        else if (ent.isFile() && ent.name.endsWith('.ts')) filesToCheck.push(full);
      }
    };
    walkTs(path.join(rootDir, 'src'));

    const offending: string[] = [];
    for (const fp of filesToCheck) {
      const txt = fs.readFileSync(fp, 'utf8');
      if (badGlyphRe.test(txt)) offending.push(path.relative(rootDir, fp));
    }
    expect(offending).toEqual([]);

    for (const def of Object.values(SECTOR_HAZARDS)) {
      expect(def.bannerUrl).toMatch(/^\.\/assets\/sectors\/sector_[a-z_]+\.jpg$/);
      const diskPath = path.join(rootDir, 'public', def.bannerUrl.replace(/^\.\//, ''));
      expect(fs.existsSync(diskPath)).toBe(true);
      expect(fs.statSync(diskPath).size).toBeGreaterThan(50_000);
    }
  });

  it('generates dense multi-strata sector maps, regenerates on route switch, and builds GLSL3 atmospheric smoke', () => {
    const expectedKinds: Record<string, string> = {
      normal: 'dust',
      solar_storm: 'ember',
      radiation_zone: 'ash',
      magnetic_nebula: 'ion',
    };

    for (const hazardId of ['normal', 'solar_storm', 'radiation_zone', 'magnetic_nebula'] as const) {
      const m1 = generateSectorMap(551234, hazardId);
      const m2 = generateSectorMap(551234, hazardId);
      expect(m1.props.length).toBeGreaterThanOrEqual(55);
      expect(m1.biomeId).toBe(m2.biomeId);
      expect(m1.atmosphere.particleKind).toBe(expectedKinds[hazardId]);
      expect(m1.props.some((p) => p.stratum === 'near')).toBe(true);
      expect(m1.props.some((p) => p.stratum === 'mid')).toBe(true);
      expect(m1.props.some((p) => p.stratum === 'deep')).toBe(true);
      expect(m1.props.some((p) => p.kind === 'derelict_hulk' || p.kind === 'debris_cluster')).toBe(
        true
      );
      for (const prop of m1.props) {
        expect(Math.hypot(prop.x - 400, prop.y - 300)).toBeGreaterThanOrEqual(259);
      }
    }

    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    const initialSeed = sim.state.sectorMap.seed;
    sim.state.player.loadout.pendingHazardChoices = ['solar_storm', 'magnetic_nebula'];
    expect(selectNextSectorHazard(sim.state, 'solar_storm')).toBe(true);
    expect(sim.state.sectorHazard).toBe('solar_storm');
    expect(sim.state.sectorMap.seed).not.toBe(initialSeed);
    expect(sim.state.sectorMap.hazardId).toBe('solar_storm');
    expect(sim.state.sectorMap.atmosphere.particleKind).toBe('ember');

    const smokeMat = createAtmosphericSmokeMaterial();
    expect(smokeMat.glslVersion).toBe(THREE.GLSL3);
    expect(smokeMat.uniforms.uTime).toBeDefined();
    expect(smokeMat.uniforms.uColorPrimary).toBeDefined();
    expect(smokeMat.uniforms.uColorSecondary).toBeDefined();
    expect(smokeMat.uniforms.uOpacity).toBeDefined();
    expect(smokeMat.uniforms.uDrift).toBeDefined();
    expect(smokeMat.uniforms.uScale).toBeDefined();
    smokeMat.dispose();
  });

  it('ships valid v16.0 interactive 3D raid GLB assets with COLOR_0 and Idle animation', () => {
    const modelsDir = path.resolve(process.cwd(), 'public/assets/models');
    const files = [
      'obj_asteroid_ore.glb',
      'obj_plasma_barrel.glb',
      'obj_raid_reactor.glb',
      'obj_raid_vault.glb',
      'obj_raid_convoy.glb',
    ];
    for (const file of files) {
      const fullPath = path.join(modelsDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const buf = fs.readFileSync(fullPath);
      expect(buf.byteLength).toBeGreaterThan(20_000);
      expect(buf.byteLength).toBeLessThan(1_500_000);
      expect(buf.toString('utf8', 0, 4)).toBe('glTF');
      const chunkLen = buf.readUInt32LE(12);
      const jsonStr = buf.toString('utf8', 20, 20 + chunkLen);
      expect(jsonStr).toContain('"COLOR_0"');
      expect(jsonStr).toContain('"Idle"');
    }
  });

  it('starts as a bare scrap tug inside Sector 1 Raid with destructible asteroids and barrels', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    const s = sim.state;

    // Bare Scrap Tug starter: only wing_l1 pulse_blaster mounted, zero skills/inventory
    expect(s.player.loadout.slots.wing_l1?.weaponId).toBe('pulse_blaster');
    expect(s.player.loadout.slots.wing_r1).toBeNull();
    expect(s.player.loadout.slots.nose).toBeNull();
    expect(s.player.loadout.slots.wing_l2).toBeNull();
    expect(s.player.loadout.slots.wing_r2).toBeNull();
    expect(s.player.loadout.slots.skill_1).toBeNull();
    expect(s.player.loadout.inventory.length).toBe(0);

    // Sector 1 Room 1 starts cleanly in Armory chamber with destructible asteroids & barrels
    expect(s.wave).toBe(1);
    expect(s.raid.sectorNumber).toBe(1);
    expect(s.runRoomNumber).toBe(1);
    expect(s.currentRoomKind).toBe('armory');
    expect(s.arenaObstacles.some((o) => o.kind === 'ore_asteroid')).toBe(true);
    expect(s.arenaObstacles.some((o) => o.kind === 'plasma_barrel')).toBe(true);
  });

  it('absorbs enemy bullets with asteroid cover and triggers barrel chain-explosion AoE', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();

    let asteroidShatters = 0;
    let barrelBlasts = 0;
    bus.on('ASTEROID_SHATTERED', () => asteroidShatters++);
    bus.on('BARREL_EXPLODED', () => barrelBlasts++);

    // 1. Asteroid absorbs enemy shot cleanly and shatters into gold when destroyed
    const astId = 98001;
    sim.state.arenaObstacles = [
      {
        id: astId,
        kind: 'ore_asteroid',
        x: 500,
        y: 300,
        radius: 28,
        hp: 20,
        maxHp: 20,
        rotAngle: 0,
        rotSpeed: 0,
        flash: 0,
        hex: 0x67e8f9,
      },
    ];
    sim.state.bullets.push({
      id: 98002,
      x: 500,
      y: 300,
      dx: 1,
      dy: 0,
      speed: 0,
      radius: 5,
      damage: 10,
      color: '#ff4444',
      hex: 0xff4444,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
      homing: false,
    });
    const goldBefore = sim.state.goldPickups.length;
    sim.step(idleInput(), 1 / 60);
    // Enemy bullet blocked by asteroid
    expect(sim.state.bullets.some((b) => b.id === 98002)).toBe(false);

    // Player high-damage bullet shatters asteroid & spawns gold
    sim.state.bullets.push({
      id: 98003,
      x: 500,
      y: 300,
      dx: 1,
      dy: 0,
      speed: 0,
      radius: 5,
      damage: 45,
      color: '#38e8ff',
      hex: 0x38e8ff,
      isEnemy: false,
      pierceLeft: 99,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
      homing: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(asteroidShatters).toBe(1);
    expect(sim.state.goldPickups.length).toBeGreaterThan(goldBefore);

    // 2. Plasma barrel chain detonation damages nearby barrels & ignites enemies
    const foe = createEnemy(sim.state, 'large', false, { x: 560, y: 300 });
    foe.hp = 500;
    foe.maxHp = 500;
    sim.state.enemies = [foe];
    sim.state.arenaObstacles = [
      {
        id: 98010,
        kind: 'plasma_barrel',
        x: 500,
        y: 300,
        radius: 20,
        hp: 10,
        maxHp: 10,
        rotAngle: 0,
        rotSpeed: 0,
        flash: 0,
        hex: 0xff5a1f,
      },
      {
        id: 98011,
        kind: 'plasma_barrel',
        x: 545,
        y: 300,
        radius: 20,
        hp: 10,
        maxHp: 10,
        rotAngle: 0,
        rotSpeed: 0,
        flash: 0,
        hex: 0xff5a1f,
      },
    ];
    sim.state.bullets.push({
      id: 98012,
      x: 500,
      y: 300,
      dx: 1,
      dy: 0,
      speed: 0,
      radius: 5,
      damage: 30,
      color: '#38e8ff',
      hex: 0x38e8ff,
      isEnemy: false,
      pierceLeft: 99,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
      homing: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(barrelBlasts).toBe(2);
    expect(sim.state.arenaObstacles.length).toBe(0);
    expect(foe.hp).toBeLessThan(500);
    expect(foe.burnMs ?? 0).toBeGreaterThan(0);
  });

  it('executes Active Thermal Purge [R], Perfect Dash Parry, Dash Execute, and Elemental Combos', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    sim.state.arenaObstacles = [];
    sim.state.raid.activeObjective = null;
    sim.state.player.x = 400;
    sim.state.player.y = 300;
    sim.state.player.health = 200;
    sim.state.player.maxHealth = 200;

    // 1. Active Thermal Purge [R] requires heat >= 60 and clears heat + ignites nearby foes
    let purgeEvents = 0;
    bus.on('THERMAL_PURGE', () => purgeEvents++);
    sim.state.player.heat = 40;
    expect(sim.triggerThermalPurge()).toBe(false);

    const nearby = createEnemy(sim.state, 'large', false, { x: 460, y: 300 });
    nearby.hp = 400;
    nearby.maxHp = 400;
    sim.state.enemies = [nearby];
    sim.state.player.heat = 82;
    sim.step(idleInput({ vent: true }), 1 / 60);
    expect(purgeEvents).toBe(1);
    expect(sim.state.player.heat).toBe(0);
    expect(sim.state.player.thermalPurgeCooldownMs).toBeGreaterThan(0);
    expect(nearby.hp).toBeLessThan(400);
    expect(nearby.burnMs ?? 0).toBeGreaterThan(0);

    // 2. Perfect Dash Parry reflects enemy projectile as >= 2.8x parried bolt & resets dash
    let parryEvents = 0;
    bus.on('PLAYER_PARRY', () => parryEvents++);
    sim.state.hitStopMs = 0;
    sim.state.player.energy = 100;
    sim.state.player.lastDashEndMs = -10000;
    sim.state.enemies = [];
    sim.state.bullets.push({
      id: 98101,
      x: 410,
      y: 300,
      dx: -1,
      dy: 0,
      speed: 4,
      radius: 6,
      damage: 20,
      color: '#ff3355',
      hex: 0xff3355,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
      homing: false,
    });
    sim.step(idleInput({ dash: true, moveX: 1 }), 1 / 60);
    expect(parryEvents).toBe(1);
    const reflected = sim.state.bullets.find((b) => b.id === 98101);
    expect(reflected).toBeDefined();
    expect(reflected?.isEnemy).toBe(false);
    expect(reflected?.element).toBe('parried');
    expect(reflected?.damage).toBeGreaterThanOrEqual(56);

    // 3. Dash Execute finishes wounded non-minion enemies <= 25% HP & refunds energy/heat
    let executeEvents = 0;
    bus.on('PLAYER_EXECUTE', () => executeEvents++);
    const wounded = createEnemy(sim.state, 'medium', false, {
      x: sim.state.player.x + 8,
      y: sim.state.player.y,
    });
    wounded.maxHp = 200;
    wounded.hp = 40;
    sim.state.bullets = [];
    sim.state.enemies = [wounded];
    sim.state.hitStopMs = 0;
    sim.state.player.energy = 40;
    sim.state.player.heat = 50;
    sim.state.player.lastDashEndMs = -10000;
    sim.step(idleInput({ dash: true, moveX: 1 }), 1 / 60);
    expect(executeEvents).toBe(1);
    expect(sim.state.enemies.length).toBe(0);
    expect(sim.state.player.energy).toBeGreaterThan(40);
    expect(sim.state.player.heat).toBeLessThan(50);

    // 4. Elemental Combos: Burn+Kinetic=Shatter, Ion+Ion=Arc Chain, Burn+Ion=Overload
    const combos: string[] = [];
    bus.on('ELEMENTAL_COMBO', ({ kind }) => combos.push(kind));

    const targetA = createEnemy(sim.state, 'large', false, { x: 200, y: 200 });
    const targetB = createEnemy(sim.state, 'medium', false, { x: 260, y: 200 });
    targetA.hp = 800;
    targetA.maxHp = 800;
    targetB.hp = 500;
    targetB.maxHp = 500;
    sim.state.enemies = [targetA, targetB];

    applyElementalImpact(sim.state, targetA, 40, 'burn', bus);
    expect(targetA.burnMs ?? 0).toBeGreaterThan(0);
    applyElementalImpact(sim.state, targetA, 40, 'kinetic', bus);
    expect(combos).toContain('shatter');

    applyElementalImpact(sim.state, targetA, 40, 'ion', bus);
    expect(targetA.ionizedMs ?? 0).toBeGreaterThan(0);
    applyElementalImpact(sim.state, targetA, 40, 'ion', bus);
    expect(combos).toContain('arc_chain');
    expect(targetB.hp).toBeLessThan(500);

    applyElementalImpact(sim.state, targetA, 40, 'ion', bus);
    applyElementalImpact(sim.state, targetA, 40, 'burn', bus);
    expect(combos).toContain('overload');
  });

  it('progresses through all 3 Sector Raid objectives -> Quick Draft -> Capital Boss spawn', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame();
    const s = sim.state;
    // Initialize legacy Sector Raid 3-objective progression explicitly
    s.roomsTotalPerSector = 3;
    s.enemies = [];
    initSectorRaid(s, 1, bus);

    // Objective 1: Destroy Sector Reactor -> QUICK_DRAFT
    expect(s.raid.activeObjective?.kind).toBe('reactor');
    const reactor = s.raid.activeObjective!;
    s.bullets.push({
      id: 98201,
      x: reactor.x,
      y: reactor.y,
      dx: 1,
      dy: 0,
      speed: 0,
      radius: 10,
      damage: reactor.hp + 50,
      color: '#38e8ff',
      hex: 0x38e8ff,
      isEnemy: false,
      pierceLeft: 99,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
      homing: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(s.phase).toBe('QUICK_DRAFT');
    expect(s.raid.completedCount).toBe(1);
    expect(s.raid.pendingQuickDraft.length).toBe(3);

    // Pick card 0 -> spawns Objective 2 (vault) and resumes PLAYING
    expect(sim.pickQuickDraftByIndex(0)).toBe(true);
    expect(s.phase).toBe('PLAYING');
    expect(s.raid.activeObjective?.kind).toBe('vault');

    // Objective 2: Hold inside vault ring until decrypted -> QUICK_DRAFT
    const vault = s.raid.activeObjective!;
    s.player.x = vault.x;
    s.player.y = vault.y;
    s.player.vx = 0;
    s.player.vy = 0;
    s.player.health = 9999;
    s.player.maxHealth = 9999;
    s.player.shieldActive = true;
    for (let i = 0; i < 320 && s.phase === 'PLAYING'; i++) {
      s.player.x = vault.x;
      s.player.y = vault.y;
      sim.step(idleInput(), 1 / 60);
    }
    expect(s.phase).toBe('QUICK_DRAFT');
    expect(s.raid.completedCount).toBe(2);

    // Pick card 1 (Core hardware upgrade) -> spawns Objective 3 (convoy)
    expect(sim.pickQuickDraftByIndex(1)).toBe(true);
    expect(s.phase).toBe('PLAYING');
    expect(s.raid.activeObjective?.kind).toBe('convoy');

    // Objective 3: Destroy Gold-Ore Convoy -> QUICK_DRAFT -> Boss Spawn!
    const convoy = s.raid.activeObjective!;
    s.bullets.push({
      id: 98202,
      x: convoy.x,
      y: convoy.y,
      dx: 1,
      dy: 0,
      radius: 10,
      speed: 0,
      damage: convoy.hp + 50,
      color: '#fbbf24',
      hex: 0xfbbf24,
      isEnemy: false,
      pierceLeft: 99,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
      homing: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(s.phase).toBe('QUICK_DRAFT');
    expect(s.raid.completedCount).toBe(3);

    // Pick card 2 -> immediately triggers Capital Boss!
    expect(sim.pickQuickDraftByIndex(2)).toBe(true);
    expect(s.phase).toBe('PLAYING');
    expect(s.wave).toBe(5);
    expect(s.boss).not.toBeNull();
  });
});

describe('Hades-Style Room Progression, Hulls & Synergy Tests', () => {
  beforeEach(() => {
    metaProgression.resetForTests(0);
  });

  it('tracks Twin-Stick 3D cursor aim world coordinates continuously in mouse mode', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const p = sim.state.player;
    const targetX = p.x + 220;
    const targetY = p.y - 40;

    for (let i = 0; i < 16; i++) {
      sim.step(
        idleInput({
          aimMode: 'mouse',
          mouseActive: true,
          mouseArenaX: targetX,
          mouseArenaY: targetY,
          shoot: false,
        }),
        1 / 60
      );
    }

    expect(sim.state.aimWorldActive).toBe(true);
    expect(sim.state.aimWorldX).toBe(targetX);
    expect(sim.state.aimWorldY).toBe(targetY);
    expect(Math.abs(p.targetAngle - Math.atan2(-40, 220))).toBeLessThan(0.01);
    expect(Math.abs(p.facingAngle - p.targetAngle)).toBeLessThan(0.2);
  });

  it('supports distinct 4 Hull Classes (Carrier drones, Juggernaut RigidContact2D ramming, Chrono Sniper)', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    metaProgression.grantShards(1000);
    expect(metaProgression.unlockHull('carrier')).toBe(true);
    expect(metaProgression.unlockHull('juggernaut')).toBe(true);
    expect(metaProgression.unlockHull('sniper')).toBe(true);

    // 1. Carrier starts with 1 autonomous scout drone & basic pulse_blaster Mk.I
    sim.startNewGame('carrier');
    expect(sim.state.drones.length).toBe(1);
    expect(sim.state.player.loadout.slots.wing_l1?.weaponId).toBe('pulse_blaster');
    expect(sim.state.player.loadout.slots.skill_1).toBeNull();
    let droneShots = 0;
    bus.on('DRONE_SHOT', () => droneShots++);
    sim.state.enemies = [createEnemy(sim.state, 'small', false, { x: sim.state.player.x + 160, y: sim.state.player.y })];
    for (let i = 0; i < 90; i++) sim.step(idleInput(), 1 / 60);
    expect(droneShots).toBeGreaterThanOrEqual(1);

    // 2. Juggernaut starts with +30 HP (130), basic pulse_blaster Mk.I, and knocks & damages hostiles on dash ram
    sim.startNewGame('juggernaut');
    expect(sim.state.player.maxHealth).toBe(130);
    expect(sim.state.player.loadout.slots.wing_l1?.weaponId).toBe('pulse_blaster');
    const ramTarget = createEnemy(sim.state, 'medium', false, {
      x: sim.state.player.x + 22,
      y: sim.state.player.y,
    });
    ramTarget.hp = 500;
    ramTarget.maxHp = 500;
    const initX = ramTarget.x;
    sim.state.enemies = [ramTarget];
    sim.step(idleInput({ moveX: 1, moveY: 0, dash: true }), 1 / 60);
    expect(ramTarget.hp).toBeLessThan(500);
    expect(ramTarget.x).toBeGreaterThan(initX);

    // 3. Sniper starts with innatePierce (+1) on ultra-basic pulse_blaster & +35% damage during Chrono Overdrive
    sim.startNewGame('sniper');
    const wingWeapon = sim.state.player.loadout.slots.wing_l1!;
    expect(wingWeapon.weaponId).toBe('pulse_blaster');
    expect(sim.state.player.innatePierce).toBe(1);
    const normalDmg = computeMountedPrimaryStats(wingWeapon, sim.state.player, 'wing_l1').damage;
    sim.state.player.chronoCharge = 100;
    expect(sim.triggerChronoOverdrive()).toBe(true);
    const chronoDmg = computeMountedPrimaryStats(wingWeapon, sim.state.player, 'wing_l1').damage;
    expect(chronoDmg).toBeGreaterThan(normalDmg);
    expect(chronoDmg).toBeGreaterThanOrEqual(Math.round(normalDmg * 1.3));
  });

  it('runs the full 5-Room Hades branching loop -> Quick Draft Reroll -> Room 5 Boss -> Sector 2', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    // Clear Room 1 wave 1 + wave 2 (grant earned combat XP toward Lv.2 threshold of 145)
    grantPlayerXp(s, 125, bus);
    while (s.phase === 'PLAYING') {
      s.enemies = [];
      sim.step(idleInput(), 1 / 60);
    }
    expect(s.phase).toBe('QUICK_DRAFT');
    expect(s.roomsClearedTotal).toBe(1);
    const beforeReroll = s.raid.pendingQuickDraft.map((o) => o.titleEn).join('|');
    expect(s.player.rerollsLeft).toBe(1);
    expect(sim.rerollQuickDraft()).toBe(true);
    expect(s.player.rerollsLeft).toBe(0);
    const afterReroll = s.raid.pendingQuickDraft.map((o) => o.titleEn).join('|');
    expect(afterReroll).not.toBe(beforeReroll);

    // Pick card -> opens ROOM_SELECT Warp Doors
    expect(sim.pickQuickDraftByIndex(0)).toBe(true);
    expect(s.phase).toBe('ROOM_SELECT');
    expect(s.pendingRoomDoors.length).toBeGreaterThanOrEqual(2);

    // Enter Room 2 (force elite double-reward door check) -> completes lightspeed warp then clears Room 2
    s.pendingRoomDoors[0].kind = 'elite';
    s.pendingRoomDoors[0].doubleReward = true;
    expect(sim.selectRoomDoor(0)).toBe(true);
    expect(s.phase).toBe('PLAYING');
    expect(s.warpTransition.active).toBe(true);
    expect(s.runRoomNumber).toBe(2);
    expect(s.roomRewardDouble).toBe(true);

    // Clear Room 2 (Elite grants 1 guaranteed bonus Quick Draft even without mid-room level-up)
    while ((s.phase as string) === 'PLAYING') {
      if (!s.warpTransition.active) s.enemies = [];
      sim.step(idleInput(), 1 / 60);
    }
    expect(s.phase).toBe('QUICK_DRAFT');
    expect(s.roomDraftsPending).toBe(0);
    expect(sim.pickQuickDraftByIndex(0)).toBe(true);
    expect(s.phase).toBe('ROOM_SELECT');

    // Advance straight to Room 4 clear -> Room 5 Capital Boss Warp Door
    s.runRoomNumber = 4;
    openRoomDoorSelection(s, bus);
    expect(s.pendingRoomDoors.some((d) => d.kind === 'boss')).toBe(true);
    expect(sim.selectRoomDoor(0)).toBe(true);
    expect(s.phase).toBe('PLAYING');
    expect(s.runRoomNumber).toBe(5);
    expect(s.currentRoomKind).toBe('boss');
    expect(s.boss).not.toBeNull();

    // Finish Boss Warp Jump, defeat Capital Boss -> Boss XP Draft(s) -> WaveSystem opens Boss Shop -> Sector 2
    while (s.warpTransition.active) {
      sim.step(idleInput(), 1 / 60);
    }
    s.boss!.entering = false;
    s.boss!.pylons = [];
    hitBoss(s, s.boss!, s.boss!.hp + 9999, true, s.boss!.x, s.boss!.y, bus);
    s.enemies = [];
    for (let i = 0; i < 800 && (s.phase as string) !== 'SHOP'; i++) {
      if ((s.phase as string) === 'QUICK_DRAFT') {
        sim.pickQuickDraftByIndex(0);
      } else {
        sim.step(idleInput(), 1 / 60);
      }
    }
    expect(s.phase).toBe('SHOP');
    sim.closeShop();
    expect(s.phase).toBe('PLAYING');
    expect(s.warpTransition.active).toBe(true);
    expect(s.raid.sectorNumber).toBe(2);
    expect(s.runRoomNumber).toBe(1);
  });

  it('activates Wild Mutations (Singularity vortex, Ricochet Prism, Shrapnel, Tether & Sawblades)', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    // 1. Dash Singularity pulls hostiles inward & detonates
    applyWildMutation(s, 'dash_singularity', bus);
    const farEnemy = createEnemy(s, 'small', false, { x: s.player.x + 120, y: s.player.y });
    farEnemy.speed = 0;
    s.enemies = [farEnemy];
    let dets = 0;
    bus.on('SINGULARITY_DETONATED', () => dets++);
    sim.step(idleInput({ moveX: 1, moveY: 0, dash: true }), 1 / 60);
    expect(s.singularities.length).toBe(1);
    const sgX = s.singularities[0].x;
    for (let i = 0; i < 180 && dets === 0; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(farEnemy.x).toBeLessThan(s.player.x + 120);
    expect(Math.hypot(farEnemy.x - sgX, farEnemy.y - s.player.y)).toBeLessThan(120);
    expect(dets).toBe(1);

    // 2. Ricochet Prism redirects single-hit bullet toward second nearby hostile instead of vanishing
    applyWildMutation(s, 'ricochet_prism', bus);
    const enemyA = createEnemy(s, 'small', false, { x: 400, y: 400 });
    const enemyB = createEnemy(s, 'small', false, { x: 400, y: 520 });
    enemyA.hp = 500;
    enemyB.hp = 500;
    s.enemies = [enemyA, enemyB];
    s.bullets.push({
      id: 99101,
      x: 400,
      y: 400,
      dx: 1,
      dy: 0,
      speed: 8,
      radius: 6,
      damage: 25,
      color: '#f472b6',
      hex: 0xf472b6,
      isEnemy: false,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 2,
      isCritVisual: false,
      homing: false,
    });
    for (let i = 0; i < 20; i++) sim.step(idleInput(), 1 / 60);
    expect(enemyA.hp).toBeLessThan(500);
    expect(enemyB.hp).toBeLessThan(500);

    // 3. Drone Electro-Tether & Orbital Sawblades slice nearby hostiles
    applyWildMutation(s, 'drone_wingman', bus);
    applyWildMutation(s, 'drone_tether', bus);
    applyWildMutation(s, 'orbital_sawblades', bus);
    const victim = createEnemy(s, 'medium', false, { x: s.player.x + 78, y: s.player.y });
    victim.hp = 600;
    s.enemies = [victim];
    for (let i = 0; i < 40; i++) sim.step(idleInput(), 1 / 60);
    expect(victim.hp).toBeLessThan(600);
  });

  it('runs Tactical Enemy Squad behaviors (Sniper telegraph, Shielder flanking, Bomber chain, Medic heal)', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    // 1. Shielder blocks front 110-deg cone (0.35x) vs rear flank (1.25x)
    const shielder = createEnemy(s, 'medium', false, { x: 500, y: 500 }, undefined, undefined, 'shielder');
    shielder.faceAngle = Math.PI; // Facing left (-X)
    shielder.hp = 1000;
    shielder.maxHp = 1000;
    const shielderRear = createEnemy(s, 'medium', false, { x: 700, y: 500 }, undefined, undefined, 'shielder');
    shielderRear.faceAngle = Math.PI;
    shielderRear.hp = 1000;
    shielderRear.maxHp = 1000;
    s.enemies = [shielder, shielderRear];
    s.bullets.push(
      {
        id: 99201,
        x: 495,
        y: 500,
        dx: 1,
        dy: 0,
        speed: 0,
        radius: 6,
        damage: 100,
        color: '#fff',
        hex: 0xffffff,
        isEnemy: false,
        pierceLeft: 0,
        hitIds: new Set<number>(),
        age: 0,
        bounces: 0,
        isCritVisual: false,
        homing: false,
      },
      {
        id: 99202,
        x: 705,
        y: 500,
        dx: -1,
        dy: 0,
        speed: 0,
        radius: 6,
        damage: 100,
        color: '#fff',
        hex: 0xffffff,
        isEnemy: false,
        pierceLeft: 0,
        hitIds: new Set<number>(),
        age: 0,
        bounces: 0,
        isCritVisual: false,
        homing: false,
      }
    );
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      sim.step(idleInput(), 1 / 60);
    } finally {
      randSpy.mockRestore();
    }
    const dmgFront = 1000 - shielder.hp;
    const dmgRear = 1000 - shielderRear.hp;
    expect(dmgRear).toBeGreaterThan(dmgFront * 2);

    // 2. Sniper laser telegraph -> fires fast needle projectile
    const sniper = createEnemy(s, 'small', false, { x: s.player.x + 250, y: s.player.y }, undefined, undefined, 'sniper');
    s.enemies = [sniper];
    s.bullets = [];
    let sniperLocks = 0;
    bus.on('SNIPER_LOCK', () => sniperLocks++);
    for (let i = 0; i < 240; i++) {
      s.simTimeMs += 1000 / 60;
      updateEnemySystem(s, 1000 / 60, bus);
    }
    expect(sniperLocks).toBeGreaterThanOrEqual(1);
    expect(s.bullets.some((b) => b.isEnemy && b.visualStyle === 'needle')).toBe(true);

    // 3. Bomber early kill explodes into adjacent enemies; Medic heals hurt allies
    s.arenaObstacles = [];
    const bomber = createEnemy(s, 'small', false, { x: 420, y: 300 }, undefined, undefined, 'bomber');
    bomber.hp = 10;
    const neighbor = createEnemy(s, 'medium', false, { x: 475, y: 300 });
    neighbor.hp = 500;
    neighbor.maxHp = 500;
    const medic = createEnemy(s, 'small', false, { x: 660, y: 300 }, undefined, undefined, 'medic');
    s.enemies = [bomber, neighbor, medic];
    s.bullets = [
      {
        id: 99203,
        x: 420,
        y: 300,
        dx: 1,
        dy: 0,
        speed: 0,
        radius: 10,
        damage: 50,
        color: '#fff',
        hex: 0xffffff,
        isEnemy: false,
        pierceLeft: 0,
        hitIds: new Set<number>(),
        age: 0,
        bounces: 0,
        isCritVisual: false,
        homing: false,
      },
    ];
    sim.step(idleInput(), 1 / 60);
    expect(neighbor.hp).toBeLessThan(500);
    const hpAfterBlast = neighbor.hp;
    for (let i = 0; i < 90; i++) updateEnemySystem(s, 1000 / 60, bus);
    expect(medic.healTargetId).toBe(neighbor.id);
    expect(neighbor.hp).toBeGreaterThan(hpAfterBlast);
  });

  it('charges Chrono via non-dash Graze and activates Bullet-Time (timeScale = 0.30)', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;
    s.enemies = [createEnemy(s, 'small', false, { x: s.player.x + 300, y: s.player.y })];
    s.player.chronoCharge = 0;

    // Non-dash close skim near enemy bullet grants Graze + Chrono charge
    s.bullets.push({
      id: 99301,
      x: s.player.x + s.player.radius + 14,
      y: s.player.y,
      dx: 0,
      dy: 1,
      speed: 2,
      radius: 4,
      damage: 10,
      color: '#ff4466',
      hex: 0xff4466,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(s.player.grazeCount).toBe(1);
    expect(s.player.chronoCharge).toBeGreaterThan(0);

    // Fill to 100% and trigger Chrono Overdrive via [F]
    s.player.chronoCharge = 100;
    const slowedBullet = {
      id: 99302,
      x: 500,
      y: 200,
      dx: 1,
      dy: 0,
      speed: 10,
      radius: 5,
      damage: 10,
      color: '#ff4466',
      hex: 0xff4466,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
    };
    s.bullets.push(slowedBullet);
    sim.step(idleInput({ chrono: true }), 1 / 60);

    expect(s.player.chronoActiveMs).toBeGreaterThan(0);
    expect(s.timeScale).toBeCloseTo(0.30, 2);
    expect(slowedBullet.x).toBeCloseTo(503, 1);

    // Run until Chrono expires cleanly back to 1.0
    for (let i = 0; i < 240 && s.player.chronoActiveMs > 0; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(s.player.chronoActiveMs).toBe(0);
    expect(s.timeScale).toBe(1.0);
  });

  it('persists Scrap Shards, upgrades, and Hull unlocks via MetaProgressionService across runs', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    metaProgression.grantShards(500);
    expect(metaProgression.unlockHull('juggernaut')).toBe(true);
    expect(metaProgression.buyUpgrade('hull_plating')).toBe(true);
    expect(metaProgression.buyUpgrade('overclock_core')).toBe(true);

    const bonuses = metaProgression.computeMetaBonuses();
    expect(bonuses.bonusHp).toBe(20);
    expect(bonuses.dmgMult).toBeCloseTo(1.08, 2);

    sim.startNewGame('juggernaut');
    expect(sim.state.player.maxHealth).toBe(100 + 20 + 30);

    // Verify GAMEOVER awards Scrap Shards based on rooms cleared
    sim.state.roomsClearedTotal = 3;
    const beforeShards = metaProgression.getProfile().shards;
    sim.state.player.health = 1;
    sim.state.player.shieldActive = false;
    sim.state.player.shieldCooldownMs = 9999;
    sim.state.bullets.push({
      id: 99401,
      x: sim.state.player.x,
      y: sim.state.player.y,
      dx: 1,
      dy: 0,
      speed: 0,
      radius: 10,
      damage: 50,
      color: '#ff2244',
      hex: 0xff2244,
      isEnemy: true,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      age: 0,
      bounces: 0,
      isCritVisual: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(sim.state.phase).toBe('GAMEOVER');
    expect(sim.state.shardsEarnedLastRun).toBeGreaterThan(0);
    expect(metaProgression.getProfile().shards).toBe(beforeShards + sim.state.shardsEarnedLastRun);
  });
});

describe('Level-Up Mid-Room Draft & Hyperspace Warp Tests', () => {
  beforeEach(() => {
    metaProgression.resetForTests(0);
  });

  it('triggers mid-room XP Level-Up Draft upon filling XP bar and resumes combat seamlessly', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    const leveledLevels: number[] = [];
    bus.on('LEVEL_UP', ({ level }) => leveledLevels.push(level));

    expect(s.player.level).toBe(1);
    expect(s.player.xpToNext).toBe(xpRequiredForLevel(1));

    // Filling XP mid-room triggers LEVEL_UP and opens QUICK_DRAFT at next step
    expect(grantPlayerXp(s, xpRequiredForLevel(1), bus)).toBe(true);
    expect(s.player.level).toBe(2);
    expect(leveledLevels).toEqual([2]);
    expect(s.player.pendingLevelUps).toBe(1);

    sim.step(idleInput(), 1 / 60);
    expect(s.phase).toBe('QUICK_DRAFT');
    expect(s.pendingRoomDoors.length).toBe(0);

    // Picking the Level-Up Draft returns cleanly to PLAYING without leaving current room
    expect(sim.pickQuickDraftByIndex(0)).toBe(true);
    expect(s.phase).toBe('PLAYING');
    expect(s.runRoomNumber).toBe(1);
  });

  it('scales Storm Ring radius per room type and populates door banners & zone tags', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    configureStormRingForRoom(s, 'supply');
    expect(s.stormRing.targetRadius).toBe(ROOM_STORM_CONFIG.supply.targetRadius);
    expect(s.stormRing.targetRadius).toBe(500);

    configureStormRingForRoom(s, 'elite');
    expect(s.stormRing.targetRadius).toBe(ROOM_STORM_CONFIG.elite.targetRadius);
    expect(s.stormRing.targetRadius).toBe(860);

    openRoomDoorSelection(s, bus);
    expect(s.phase).toBe('ROOM_SELECT');
    for (const door of s.pendingRoomDoors) {
      expect(door.bannerUrl.startsWith('./assets/chambers/door_')).toBe(true);
      expect(door.arenaRadius).toBeGreaterThan(0);
      expect(door.zoneTagVi.length).toBeGreaterThan(0);
    }
  });

  it('executes Lightspeed Warp Jump transition when selecting a chamber door and enforces ultra-basic starter gear', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    metaProgression.grantShards(1000);
    metaProgression.unlockHull('sniper');

    sim.startNewGame('sniper');
    const s = sim.state;
    // Ultra-basic starter loadout across hulls
    expect(s.player.loadout.slots.wing_l1?.weaponId).toBe('pulse_blaster');
    expect(s.player.loadout.slots.nose).toBeNull();
    expect(s.player.loadout.slots.wing_r1).toBeNull();
    expect(s.player.loadout.slots.skill_1).toBeNull();

    let warpEvents = 0;
    bus.on('WARP_JUMP_STARTED', () => warpEvents++);
    openRoomDoorSelection(s, bus);
    expect(sim.selectRoomDoor(0)).toBe(true);

    expect(warpEvents).toBe(1);
    expect(s.warpTransition.active).toBe(true);
    expect(s.warpTransition.durationMs).toBeGreaterThanOrEqual(1250);

    // Stepping during warp advances warp elapsedMs until exiting back to room combat
    for (let i = 0; i < 95 && s.warpTransition.active; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(s.warpTransition.active).toBe(false);
    expect(s.phase).toBe('PLAYING');
  });

  it('ships all 14 hull, chamber, mutation, and sector artworks in public/assets/', () => {
    const assetsDir = path.resolve(process.cwd(), 'public', 'assets');
    const requiredArtworks = [
      'hulls/hull_interceptor.jpg',
      'hulls/hull_carrier.jpg',
      'hulls/hull_juggernaut.jpg',
      'hulls/hull_sniper.jpg',
      'chambers/door_armory.jpg',
      'chambers/door_mutation.jpg',
      'chambers/door_elite.jpg',
      'chambers/door_supply.jpg',
      'chambers/door_reactor.jpg',
      'chambers/door_boss.jpg',
      'icons/mut_vortex.jpg',
      'icons/mut_solar.jpg',
      'icons/mut_swarm.jpg',
      'icons/mut_chrono.jpg',
    ];
    for (const rel of requiredArtworks) {
      const fullPath = path.join(assetsDir, rel);
      expect(fs.existsSync(fullPath), `Missing artwork: ${rel}`).toBe(true);
      expect(fs.statSync(fullPath).size).toBeGreaterThan(50_000);
    }
  });
});

describe('Combat Balance, Spatial Warp & Anti-IDM Sound Bank Tests', () => {
  beforeEach(() => {
    metaProgression.resetForTests(0);
  });

  it('enforces slower tactical movement, harder XP curve, zero coin XP, nerfed drones, tough boss, and no free post-hit shield', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('carrier');
    const s = sim.state;

    // 1. Slower movement & steeper XP curve
    expect(PLAYER_BASE.speed).toBe(3.45);
    expect(xpRequiredForLevel(1)).toBe(145);
    expect(s.player.xpToNext).toBe(145);

    // 2. Picking up gold coins increases credits without granting free XP
    const moneyBefore = s.money;
    s.goldPickups.push({
      id: 99801,
      x: s.player.x,
      y: s.player.y,
      vx: 0,
      vy: 0,
      value: 18,
      size: 7,
      age: 0,
      homing: false,
    });
    sim.step(idleInput(), 1 / 60);
    expect(s.money).toBe(moneyBefore + 18);
    expect(s.player.xp).toBe(0);

    // 3. Drone cap <= 3 & lower drone damage
    for (let i = 0; i < 6; i++) spawnCombatDrone(s, bus);
    expect(s.drones.length).toBeLessThanOrEqual(3);
    s.bullets = [];
    s.enemies = [createEnemy(s, 'medium', false, { x: s.player.x + 140, y: s.player.y })];
    let droneShotCount = 0;
    bus.on('DRONE_SHOT', () => droneShotCount++);
    for (let i = 0; i < 90; i++) sim.step(idleInput(), 1 / 60);
    expect(droneShotCount).toBeGreaterThanOrEqual(1);
    const droneBullet = s.bullets.find((b) => !b.isEnemy && b.element === 'ion');
    if (droneBullet) {
      expect(droneBullet.damage).toBeLessThanOrEqual(12);
    }

    // 4. Capital Boss 1 durability >= 3200 HP
    s.wave = 5;
    const boss = createBoss(s, 0);
    expect(boss.maxHp).toBeGreaterThanOrEqual(3200);

    // 5. Unshielded damage grants brief dashInvulnUntilMs i-frame instead of free full Shield
    s.player.shieldActive = false;
    s.player.shieldCooldownMs = 9999;
    s.player.dashInvulnUntilMs = 0;
    damagePlayer(s, bus, 12);
    expect(s.player.shieldActive).toBe(false);
    expect(s.player.dashInvulnUntilMs).toBeGreaterThan(s.simTimeMs);
  });

  it('emits WARP_ARRIVED, REINFORCEMENTS_SPAWNED, and STORM_BURN_TICK audio events', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    let reinforcements = 0;
    let warpArrived = 0;
    let stormBurns = 0;
    bus.on('REINFORCEMENTS_SPAWNED', ({ count }) => {
      if (count > 0) reinforcements++;
    });
    bus.on('WARP_ARRIVED', () => warpArrived++);
    bus.on('STORM_BURN_TICK', () => stormBurns++);

    // Clearing wave 1 spawns wave 2 reinforcements and emits REINFORCEMENTS_SPAWNED
    expect(s.roomWavePending).toBe(1);
    s.enemies = [];
    sim.step(idleInput(), 1 / 60);
    expect(reinforcements).toBe(1);

    // Stepping outside storm radius emits STORM_BURN_TICK
    s.simTimeMs = 1000;
    s.player.x = s.stormRing.centerX + s.stormRing.radius + 95;
    s.player.y = s.stormRing.centerY;
    sim.step(idleInput(), 1 / 60);
    expect(stormBurns).toBeGreaterThanOrEqual(1);

    // Completing a warp jump emits WARP_ARRIVED
    openRoomDoorSelection(s, bus);
    expect(sim.selectRoomDoor(0)).toBe(true);
    for (let i = 0; i < 95 && s.warpTransition.active; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(s.warpTransition.active).toBe(false);
    expect(warpArrived).toBe(1);
  });

  it('packs all 56 procedural SFX clips into public/assets/sfx-bank.json without loose .wav files and keeps valid WAVs in sfx/rendered/', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    const bankPath = path.join(publicDir, 'assets', 'sfx-bank.json');
    expect(fs.existsSync(bankPath), 'Missing public/assets/sfx-bank.json').toBe(true);

    // Guardrail: zero loose .wav/.mp3/.ogg files under public/ so IDM stops trying to download our pew-pew sounds
    const walkFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkFiles(full));
        else out.push(full);
      }
      return out;
    };
    const publicAudioFiles = walkFiles(publicDir).filter((f) => /\.(wav|mp3|ogg)$/i.test(f));
    expect(publicAudioFiles).toEqual([]);

    const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8')) as {
      version: string;
      sampleRate: number;
      clips: Record<string, string[]>;
    };
    expect(bank.sampleRate).toBe(44100);

    const manifestEntries = Object.entries(SFX_MANIFEST);
    expect(manifestEntries.length).toBe(44);
    let totalClips = 0;
    for (const [key, files] of manifestEntries) {
      const encoded = bank.clips[key];
      expect(Array.isArray(encoded), `Missing JSON soundbank key: ${key}`).toBe(true);
      expect(encoded.length).toBe(files.length);
      for (const b64 of encoded) {
        const pcmBytes = Buffer.from(b64, 'base64');
        expect(pcmBytes.length % 2).toBe(0);
        expect(pcmBytes.length).toBeGreaterThan(100);
        totalClips++;
      }
    }
    expect(totalClips).toBe(56);

    // Verify all 56 doctor-checked WAV sources exist cleanly inside sfx/rendered/
    const renderedDir = path.resolve(process.cwd(), 'sfx', 'rendered');
    const allFiles = Object.values(SFX_MANIFEST).flat();
    expect(allFiles.length).toBe(56);
    for (const filename of allFiles) {
      const fullPath = path.join(renderedDir, filename);
      expect(fs.existsSync(fullPath), `Missing rendered WAV: ${filename}`).toBe(true);
      const buf = fs.readFileSync(fullPath);
      expect(buf.length).toBeGreaterThan(44);
      expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');
    }
  });

  it('does not ignite enemies into lethal burn DoT on starter pulse_blaster shots until Solar synergy unlocks', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    const target = createEnemy(s, 'large', false, { x: s.player.x + 120, y: s.player.y });
    target.speed = 0;
    target.hp = 400;
    target.maxHp = 400;
    s.enemies = [target];
    s.arenaObstacles = [];

    // Aim & fire one starter pulse_blaster volley at target
    const shootInput = idleInput({
      shoot: true,
      aimMode: 'mouse',
      mouseActive: true,
      mouseArenaX: target.x,
      mouseArenaY: target.y,
    });
    sim.step(shootInput, 1 / 60);
    for (let i = 0; i < 20; i++) {
      sim.step(idleInput(), 1 / 60);
    }

    const hpAfterDirectHit = target.hp;
    expect(hpAfterDirectHit).toBeLessThan(400);
    expect(target.burnMs ?? 0).toBe(0);

    // Waiting 2 full seconds without firing should deal zero passive burn DoT
    for (let i = 0; i < 120; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(target.hp).toBe(hpAfterDirectHit);

    // Unlocking >= 2 Solar mutations imbues starter plasma shots with burn
    applyWildMutation(s, 'chain_detonation', bus);
    applyWildMutation(s, 'barrel_alchemist', bus);
    s.player.loadout.slots.wing_l1!.lastFireMs = -1000;
    sim.step(shootInput, 1 / 60);
    for (let i = 0; i < 25 && (target.burnMs ?? 0) === 0; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(target.burnMs ?? 0).toBeGreaterThan(0);
  });
});

describe('VFX Pools, Active Skills & Tactile Feel Tests', () => {
  it('ships standalone SFX synth tools and core 3D render/post-processing modules', () => {
    const projectFiles = [
      'sfx/build_sfx.py',
      'sfx/tools/synth.py',
      'sfx/tools/qa.py',
      'src/render/VFXSystem.ts',
      'src/render/SceneManager.ts',
      'src/render/shaders/TacticalPostPass.ts',
      'src/render/shaders/gameShaders.ts',
      'src/ui/UIManager.ts',
    ];
    for (const rel of projectFiles) {
      const fullPath = path.resolve(process.cwd(), rel);
      expect(fs.existsSync(fullPath), `Missing project file: ${rel}`).toBe(true);
      expect(fs.statSync(fullPath).size).toBeGreaterThan(500);
    }
  });

  it('emits normalized impact reflection vectors on ENEMY_HIT and calibrated crit hit-stop without burn bleed', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    const target = createEnemy(s, 'large', false, { x: s.player.x + 120, y: s.player.y });
    target.speed = 0;
    target.hp = 600;
    target.maxHp = 600;
    s.enemies = [target];
    s.arenaObstacles = [];

    const hits: Array<{ nx?: number; ny?: number; isCrit: boolean }> = [];
    bus.on('ENEMY_HIT', (ev) => {
      hits.push({ nx: ev.nx, ny: ev.ny, isCrit: ev.isCrit });
    });

    const rngSpy = vi.spyOn(Math, 'random').mockReturnValue(0.001);
    try {
      const shootInput = idleInput({
        shoot: true,
        aimMode: 'mouse',
        mouseActive: true,
        mouseArenaX: target.x,
        mouseArenaY: target.y,
      });
      sim.step(shootInput, 1 / 60);
      for (let i = 0; i < 20 && hits.length === 0; i++) {
        sim.step(idleInput(), 1 / 60);
      }
    } finally {
      rngSpy.mockRestore();
    }

    expect(hits.length).toBeGreaterThan(0);
    const first = hits[0];
    expect(first.isCrit).toBe(true);
    expect(first.nx).toBeDefined();
    expect(first.ny).toBeDefined();
    expect(Math.hypot(first.nx!, first.ny!)).toBeCloseTo(1, 2);
    expect(first.nx!).toBeLessThan(0);
    expect(s.hitStopMs).toBeLessThanOrEqual(20);
    expect(s.screenShake).toBeGreaterThan(0);
    expect(target.burnMs ?? 0).toBe(0);
  });

  it('gives floating damage numbers ballistic fan-out velocity and decays cleanly over parabolic arc', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;
    s.enemies = [];

    const startX = s.player.x + 80;
    const startY = s.player.y;
    s.floatingTexts = [];
    spawnFloatingText(s, startX, startY, '142!', '#ffee44', 1.25, 18);

    expect(s.floatingTexts.length).toBe(1);
    const ft = s.floatingTexts[0];
    const trackedId = ft.id;
    expect(ft.isCrit).toBe(true);
    expect(typeof ft.vx).toBe('number');
    expect(ft.vy).toBeLessThan(0);
    expect(ft.gravity).toBeGreaterThan(0);

    sim.step(idleInput(), 1 / 60);
    const moved = s.floatingTexts.find((item) => item.id === trackedId);
    expect(moved).toBeDefined();
    expect(moved!.y).toBeLessThan(startY);

    for (let i = 0; i < 20; i++) {
      sim.step(idleInput(), 1 / 60);
    }
    expect(s.floatingTexts.some((item) => item.id === trackedId)).toBe(false);
  });

  it('exposes uHitPulse uniform on TacticalPostPass for impact micro-contrast snap', () => {
    const pass = createTacticalPostPass();
    expect(pass.uniforms.uHitPulse).toBeDefined();
    expect(pass.uniforms.uHitPulse.value).toBe(0);
    expect((pass.material as THREE.ShaderMaterial).fragmentShader).toContain('uHitPulse');
  });
});

describe('Off-Screen Ingress Spawns & Progressive Wave Scaling Tests', () => {
  beforeEach(() => {
    metaProgression.resetForTests(0);
  });

  it('spawns Room Wave 1 and Wave 2 reinforcements strictly off-screen and glides them into combat range', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;
    s.player.health = 9999;
    s.player.maxHealth = 9999;

    expect(s.enemies.length).toBeGreaterThanOrEqual(4);
    for (const e of s.enemies) {
      expect(e.ingressActive).toBe(true);
      const dx = e.x - s.player.x;
      const dy = e.y - s.player.y;
      expect(Math.hypot(dx / 820, dy / 580)).toBeGreaterThanOrEqual(0.98);
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(580);
    }

    // Clearing Wave 1 triggers Wave 2 reinforcements strictly off-screen as well
    s.enemies = [];
    sim.step(idleInput(), 1 / 60);
    expect(s.roomWavePending).toBe(0);
    expect(s.enemies.length).toBeGreaterThanOrEqual(4);
    for (const e of s.enemies) {
      expect(e.ingressActive).toBe(true);
      const dx = e.x - s.player.x;
      const dy = e.y - s.player.y;
      expect(Math.hypot(dx / 820, dy / 580)).toBeGreaterThanOrEqual(0.98);
    }

    // Gliding ~2.3s (140 ticks) brings every squad member inside stormRing and visible combat range
    for (let t = 0; t < 140; t++) {
      sim.step(idleInput(), 1 / 60);
    }
    for (const e of s.enemies) {
      expect(e.ingressActive).toBe(false);
      expect(Math.hypot(e.x - s.player.x, e.y - s.player.y)).toBeLessThanOrEqual(430);
      expect(Math.hypot(e.x - s.stormRing.centerX, e.y - s.stormRing.centerY)).toBeLessThanOrEqual(
        s.stormRing.radius
      );
    }
  });

  it('keeps Room 1 Wave 1 crisp and fair with zero large/elite/shielder sponges and escalates cleanly per room & sector', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    sim.startNewGame('interceptor');
    const s = sim.state;

    // Room 1 Wave 1: lightweight scouts & artillery sized for Pulse Blaster Mk.I
    const room1Wave1Hp = s.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    for (const e of s.enemies) {
      expect(e.type).not.toBe('large');
      expect(e.type).not.toBe('elite');
      expect(e.specialKind).not.toBe('shielder');
      expect(e.maxHp).toBeLessThanOrEqual(80);
    }

    // Room 1 Wave 2 reinforcements also exclude tanky large/elite/shielder hulls
    s.enemies = [];
    sim.step(idleInput(), 1 / 60);
    for (const e of s.enemies) {
      expect(e.type).not.toBe('large');
      expect(e.type).not.toBe('elite');
      expect(e.specialKind).not.toBe('shielder');
      expect(e.maxHp).toBeLessThanOrEqual(80);
    }

    // Room 2 escalates into higher HP / sniper & shielder tactical mix
    enterSectorRoom(s, 2, 'mutation', bus, 0, false);
    const room2Wave1Hp = s.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    expect(room2Wave1Hp).toBeGreaterThan(room1Wave1Hp);

    // Room 3 unlocks large Juggernauts and escalates HP further
    enterSectorRoom(s, 3, 'armory', bus, 0, false);
    const room3Wave1Hp = s.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    expect(s.enemies.some((e) => e.type === 'large')).toBe(true);
    expect(room3Wave1Hp).toBeGreaterThan(room2Wave1Hp);

    // Sector 2 Room 1 shifts pressure even higher
    s.raid.sectorNumber = 2;
    enterSectorRoom(s, 1, 'armory', bus, 0, false);
    const sector2Room1Hp = s.enemies.reduce((sum, e) => sum + e.maxHp, 0);
    expect(sector2Room1Hp).toBeGreaterThan(room3Wave1Hp);
  });
});

describe('Firebase Leaderboard Loadout Snapshot & Sanitization Tests', () => {
  beforeEach(() => {
    metaProgression.resetForTests(500);
  });

  it('extracts ship hull, 6-hardpoint weapons, augments, mutations and core upgrades into leaderboard build snapshot', () => {
    const bus = new EventBus();
    const sim = new GameSimulation(bus);
    metaProgression.unlockHull('carrier');
    sim.startNewGame('carrier');
    const s = sim.state;

    s.raid.sectorNumber = 2;
    s.roomsClearedTotal = 6;
    s.bossKills = 1;
    s.combo.maxCombo = 42;
    s.player.level = 5;
    s.player.loadout.slots.nose = {
      instanceId: 'test-nose',
      weaponId: 'rail_sniper',
      tier: 3,
      upgrades: { damage: 3, fireRate: 2 },
      investedCredits: 400,
      lastFireMs: -1000,
      recoil: 0,
    };
    s.player.loadout.slots.skill_1 = {
      instanceId: 'test-skill',
      weaponId: 'skill_emp',
      tier: 2,
      upgrades: { radius: 2 },
      investedCredits: 220,
      lastFireMs: -1000,
      recoil: 0,
    };
    s.player.loadout.activeAugments = ['hellfire_reactor', 'kinetic_aegis'];
    applyWildMutation(s, 'ricochet_prism', bus);
    applyWildMutation(s, 'ricochet_prism', bus);
    s.shop.levels.healthUpgrade = 1;
    s.shop.levels.bulletDamage = 2;
    applyShopUpgrade(s, 'healthUpgrade');
    applyShopUpgrade(s, 'bulletDamage');
    applyShopUpgrade(s, 'bulletDamage');

    const build = extractBuildSnapshot(s);
    expect(build.hullId).toBe('carrier');
    expect(build.sector).toBe(2);
    expect(build.rooms).toBe(6);
    expect(build.bossKills).toBe(1);
    expect(build.maxCombo).toBe(42);
    expect(build.level).toBe(5);
    expect(build.drones).toBeGreaterThanOrEqual(1);

    const noseSlot = build.slots.find((slot) => slot.slot === 'nose');
    expect(noseSlot).toEqual({
      slot: 'nose',
      weaponId: 'rail_sniper',
      tier: 3,
      upgTotal: 5,
    });
    const skillSlot = build.slots.find((slot) => slot.slot === 'skill_1');
    expect(skillSlot).toEqual({
      slot: 'skill_1',
      weaponId: 'skill_emp',
      tier: 2,
      upgTotal: 2,
    });
    expect(build.augments).toEqual(['hellfire_reactor', 'kinetic_aegis']);
    expect(build.mutations).toEqual(['ricochet_prism', 'ricochet_prism']);
    expect(build.coreLevels.bulletDamage).toBe(2);
    expect(build.coreLevels.healthUpgrade).toBeUndefined();
  });

  it('sanitizes legacy and loaded entries, strips unknown catalog IDs, and sorts accurately', () => {
    const legacy = sanitizeLeaderboardEntry('legacy-key', {
      name: '  PilotZero\n\t  ',
      score: 2132,
      wave: 5,
      timestamp: 1700000000000,
    });
    expect(legacy).not.toBeNull();
    expect(legacy!.name).toBe('PilotZero');
    expect(legacy!.hullId).toBeNull();
    expect(legacy!.build).toBeNull();

    const full = sanitizeLeaderboardEntry('full-key', {
      name: 'Ace',
      score: 9450,
      wave: 8,
      timestamp: 1700001000000,
      hullId: 'sniper',
      build: {
        hullId: 'sniper',
        level: 6,
        sector: 2,
        rooms: 7,
        bossKills: 2,
        maxCombo: 55,
        drones: 1,
        slots: [
          { slot: 'wing_l1', weaponId: 'pulse_blaster', tier: 2, upgTotal: 3 },
          { slot: 'invalid_slot', weaponId: 'pulse_blaster', tier: 1, upgTotal: 1 },
          { slot: 'nose', weaponId: 'fake_gun', tier: 1, upgTotal: 1 },
        ],
        augments: ['prism_splitter', '__proto__'],
        mutations: ['split_shrapnel', 'split_shrapnel', 'split_shrapnel', 'nonexistent_mut'],
        coreLevels: { speedBoost: 3, healthUpgrade: 4, bogusKey: 9 },
      },
    });
    expect(full).not.toBeNull();
    expect(full!.hullId).toBe('sniper');
    expect(full!.build).not.toBeNull();
    expect(full!.build!.slots).toEqual([
      { slot: 'wing_l1', weaponId: 'pulse_blaster', tier: 2, upgTotal: 3 },
    ]);
    expect(full!.build!.augments).toEqual(['prism_splitter']);
    expect(full!.build!.mutations).toEqual(['split_shrapnel', 'split_shrapnel']);
    expect(full!.build!.coreLevels).toEqual({ speedBoost: 3 });

    const invalid = sanitizeLeaderboardEntry('bad', { name: 'Hacker', score: -50, wave: 1 });
    expect(invalid).toBeNull();

    const sorted = sortLeaderboardEntries([legacy!, full!]);
    expect(sorted[0].key).toBe('full-key');
    expect(sorted[1].key).toBe('legacy-key');
  });

  it('normalizes duplicate names, builds atomic delete-and-upsert plan, and auto-saves pilot callsign', () => {
    expect(normalizePilotKey('  Quang   Anh  Ngu ')).toBe('quang anh ngu');

    const olderHigh = sanitizeLeaderboardEntry('old-high', {
      name: 'quang anh ngu',
      score: 3302,
      wave: 9,
      timestamp: 1000,
    })!;
    const newerLow = sanitizeLeaderboardEntry('new-low', {
      name: 'Quang   Anh Ngu',
      score: 2132,
      wave: 7,
      timestamp: 2000,
      hullId: 'sniper',
      build: {
        hullId: 'sniper',
        level: 5,
        sector: 2,
        rooms: 6,
        bossKills: 1,
        maxCombo: 40,
        drones: 1,
        slots: [{ slot: 'wing_l1', weaponId: 'pulse_blaster', tier: 2, upgTotal: 3 }],
        augments: ['prism_splitter'],
        mutations: ['split_shrapnel'],
        coreLevels: { speedBoost: 2 },
      },
    })!;
    const otherPilot = sanitizeLeaderboardEntry('other-1', {
      name: 'AcePilot',
      score: 5000,
      wave: 12,
      timestamp: 1500,
    })!;

    const deduped = dedupeLeaderboardEntries([olderHigh, newerLow, otherPilot]);
    expect(deduped.length).toBe(2);
    expect(deduped[0].name).toBe('AcePilot');
    expect(deduped[1].name).toBe('Quang Anh Ngu');
    expect(deduped[1].score).toBe(3302);
    expect(deduped[1].wave).toBe(9);
    expect(deduped[1].hullId).toBe('sniper');

    const buildV2 = {
      hullId: 'juggernaut' as const,
      level: 8,
      sector: 3,
      rooms: 12,
      bossKills: 3,
      maxCombo: 90,
      drones: 2,
      slots: [{ slot: 'wing_l1' as const, weaponId: 'pulse_blaster' as const, tier: 3 as const, upgTotal: 5 }],
      augments: ['prism_splitter' as const],
      mutations: ['split_shrapnel' as const],
      coreLevels: { bulletDamage: 3 },
    };

    const planLowerScore = buildSameNameUpsertPlan(
      'Quang Anh Ngu',
      1500,
      5,
      buildV2,
      3000,
      [olderHigh, newerLow, otherPilot],
      'fresh-key-1'
    );
    expect(planLowerScore.keysToDelete).toEqual(['old-high', 'new-low']);
    expect(planLowerScore.previousBestScore).toBe(3302);
    expect(planLowerScore.isNewRecord).toBe(false);
    expect(planLowerScore.entry.score).toBe(3302);
    expect(planLowerScore.entry.name).toBe('Quang Anh Ngu');
    expect(planLowerScore.entry.hullId).toBe('juggernaut');
    expect(planLowerScore.patch['old-high']).toBeNull();
    expect(planLowerScore.patch['new-low']).toBeNull();
    expect(planLowerScore.patch['other-1']).toBeUndefined();
    expect(planLowerScore.patch['fresh-key-1']).toBeTruthy();

    const planRecordBroken = buildSameNameUpsertPlan(
      'Quang Anh Ngu v2',
      4500,
      14,
      buildV2,
      4000,
      [olderHigh, newerLow, otherPilot],
      'fresh-key-2'
    );
    expect(planRecordBroken.keysToDelete).toEqual([]);
    expect(planRecordBroken.isNewRecord).toBe(true);
    expect(planRecordBroken.entry.score).toBe(4500);
    expect(planRecordBroken.entry.wave).toBe(14);
    expect(Object.keys(planRecordBroken.patch)).toEqual(['fresh-key-2']);

    const planUpdateBreakBest = buildSameNameUpsertPlan(
      'QUANG ANH NGU',
      6200,
      18,
      buildV2,
      5000,
      [olderHigh, newerLow, otherPilot],
      'fresh-key-3'
    );
    expect(planUpdateBreakBest.keysToDelete).toEqual(['old-high', 'new-low']);
    expect(planUpdateBreakBest.isNewRecord).toBe(true);
    expect(planUpdateBreakBest.entry.score).toBe(6200);
    expect(planUpdateBreakBest.patch['old-high']).toBeNull();
    expect(planUpdateBreakBest.patch['new-low']).toBeNull();
    expect((planUpdateBreakBest.patch['fresh-key-3'] as { name: string; score: number }).name).toBe(
      'QUANG ANH NGU'
    );

    const store = new Map<string, string>();
    const prevDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => {
          store.clear();
        },
      },
    });
    try {
      const svc = new LeaderboardService();
      expect(svc.getSavedPilotName()).toBe('');
      expect(svc.savePilotName('   Ace   Vanguard  ')).toBe('Ace Vanguard');
      expect(svc.getSavedPilotName()).toBe('Ace Vanguard');
      const found = svc.findPilotEntry([olderHigh, otherPilot], 'acepilot');
      expect(found?.rank).toBe(2);
      expect(found?.entry.name).toBe('AcePilot');
    } finally {
      if (prevDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', prevDescriptor);
      } else {
        delete (globalThis as { localStorage?: unknown }).localStorage;
      }
    }
  });
});

describe('Graphics Optimization & Adaptive Quality Governor Tests', () => {
  it('validates GPU scrolling starfield shader, sin/cos-free latticeGradient, and tiered TacticalPostPass uniforms', () => {
    const pointsNoMap = createScrollingPointsMaterial(0.45, 0.85, true);
    const pointsWithMap = createScrollingPointsMaterial(0.62, 0.66, true, new THREE.Texture());
    expect(pointsNoMap.fragmentShader).not.toContain('sampler2D');
    expect(pointsWithMap.fragmentShader).toContain('sampler2D uMap');

    for (const pointsMat of [pointsNoMap, pointsWithMap]) {
      expect(pointsMat.glslVersion).toBe(THREE.GLSL3);
      expect(pointsMat.vertexShader).toContain('void main()');
      expect(pointsMat.fragmentShader).toContain('out vec4 fragColor;');
      expect(pointsMat.fragmentShader).not.toMatch(/fract\s*\(\s*sin\s*\(/);
      expect((pointsMat.vertexShader.match(/\{/g) ?? []).length).toBe(
        (pointsMat.vertexShader.match(/\}/g) ?? []).length
      );
      expect((pointsMat.fragmentShader.match(/\{/g) ?? []).length).toBe(
        (pointsMat.fragmentShader.match(/\}/g) ?? []).length
      );
    }

    const latticeMatch = GLSL3_NOISE.match(/vec2 latticeGradient\(vec2 cell\)[\s\S]*?\n\}/);
    expect(latticeMatch).not.toBeNull();
    expect(latticeMatch![0]).not.toMatch(/\b(sin|cos)\s*\(/);

    const postPass = createTacticalPostPass();
    expect(postPass.uniforms.uQualityTier.value).toBe(2);
    expect(postPass.uniforms.uEmissiveGlowBoost.value).toBe(0);
    expect((postPass.material as THREE.ShaderMaterial).fragmentShader).toContain('uQualityTier');
    expect((postPass.material as THREE.ShaderMaterial).fragmentShader).toContain('uEmissiveGlowBoost');
  });

  it('caps pixel ratios by pixel budget and steps Adaptive Quality Governor smoothly without skipping medium', () => {
    // HiDPI 1080p laptop with 2x OS scaling stays within pixel budgets instead of 4x oversampling
    const hiDpr = computeEffectivePixelRatio('high', 1920, 1080, 2);
    const medDpr = computeEffectivePixelRatio('medium', 1920, 1080, 2);
    const lowDpr = computeEffectivePixelRatio('low', 1920, 1080, 2);
    expect(hiDpr).toBeLessThanOrEqual(1.5);
    expect(hiDpr).toBeGreaterThan(medDpr);
    expect(medDpr).toBeGreaterThanOrEqual(lowDpr);
    expect(computeEffectivePixelRatio('low', 3840, 2160, 2)).toBeGreaterThanOrEqual(0.78);

    let gov: QualityGovernorState = {
      quality: 'high',
      manualLock: false,
      playWarmupSec: 0,
      lowFpsAccumSec: 0,
      highFpsAccumSec: 0,
      cooldownSec: 0,
      emaFps: 60,
      autoPromotedOnce: false,
    };

    // Never downgrade during initial 4.5s shader/asset warmup even at 20 FPS
    for (let i = 0; i < 40; i++) {
      const res = evaluateQualityStep(gov, 20, 0.1, true);
      gov = res.state;
      expect(res.changedTo).toBeNull();
      expect(gov.quality).toBe('high');
    }

    // Prolonged FPS below 42 steps down cleanly high -> medium (never skipping directly to low)
    let transitionedToMedium = false;
    for (let i = 0; i < 80; i++) {
      const res = evaluateQualityStep(gov, 32, 0.1, true);
      gov = res.state;
      if (res.changedTo !== null) {
        expect(res.changedTo).toBe('medium');
        transitionedToMedium = true;
        break;
      }
    }
    expect(transitionedToMedium).toBe(true);
    expect(gov.cooldownSec).toBeCloseTo(7.0, 2);

    // Cooldown protects against cascading drops before 7.0s elapse
    for (let i = 0; i < 50; i++) {
      const res = evaluateQualityStep(gov, 18, 0.1, true);
      gov = res.state;
      expect(res.changedTo).toBeNull();
    }

    // Only after cooldown and sustained sub-30 FPS does it step medium -> low
    let transitionedToLow = false;
    for (let i = 0; i < 120; i++) {
      const res = evaluateQualityStep(gov, 22, 0.1, true);
      gov = res.state;
      if (res.changedTo !== null) {
        expect(res.changedTo).toBe('low');
        transitionedToLow = true;
        break;
      }
    }
    expect(transitionedToLow).toBe(true);

    // Sustained 60 FPS cooldown + 14s stability promotes back from low -> medium once
    for (let i = 0; i < 120; i++) {
      const res = evaluateQualityStep(gov, 60, 0.1, true);
      gov = res.state;
      expect(res.changedTo).toBeNull();
    }
    let promotedToMedium = false;
    for (let i = 0; i < 170; i++) {
      const res = evaluateQualityStep(gov, 60, 0.1, true);
      gov = res.state;
      if (res.changedTo !== null) {
        expect(res.changedTo).toBe('medium');
        promotedToMedium = true;
        break;
      }
    }
    expect(promotedToMedium).toBe(true);
    expect(gov.autoPromotedOnce).toBe(true);

    // Manual lock prevents automatic quality switches regardless of FPS
    const locked: QualityGovernorState = {
      ...gov,
      quality: 'high',
      manualLock: true,
      playWarmupSec: 20,
      cooldownSec: 0,
      emaFps: 15,
    };
    const lockedStep = evaluateQualityStep(locked, 15, 2.0, true);
    expect(lockedStep.changedTo).toBeNull();
    expect(lockedStep.state.quality).toBe('high');
  });
});
