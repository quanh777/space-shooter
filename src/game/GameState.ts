import {
  ARENA_H,
  ARENA_W,
  PLAYER_BASE,
  POWER_UP_CONFIG,
  SKILL_BASE,
  type PowerUpType,
} from '../config/constants';
import { ALL_SHOP_ITEM_IDS, type ShopItemId } from '../config/shopItems';
import type { ShipSlotId, WeaponId } from '../config/weapons';
import type { EventBus } from '../engine/EventBus';
import { generateSectorMap } from './map/SectorMapGenerator';
import type {
  GameState,
  MountedWeapon,
  PlayerState,
  SectorRaidState,
  ShipLoadoutState,
  ShopState,
  StormRingState,
} from './types';

function createMountedStarterWeapon(
  instanceId: string,
  weaponId: WeaponId,
  tier: 1 | 2 | 3 = 1
): MountedWeapon {
  return {
    instanceId,
    weaponId,
    tier,
    upgrades: {},
    investedCredits: 0,
    lastFireMs: -10000,
    recoil: 0,
  };
}

export function createInitialLoadout(): ShipLoadoutState {
  // Humble starter loadout: one lonely Mk.I blaster on the left wing and 5 empty sockets waiting for greed
  const slots: Record<ShipSlotId, MountedWeapon | null> = {
    nose: null,
    wing_l1: createMountedStarterWeapon('wpn-init-l1', 'pulse_blaster', 1),
    wing_r1: null,
    wing_l2: null,
    wing_r2: null,
    skill_1: null,
  };

  const inventory: MountedWeapon[] = [];

  return {
    slots,
    selectedSlot: 'wing_l1',
    garageMode: 'INVENTORY',
    activeArmoryTab: 'INVENTORY',
    inventory,
    roulette: {
      spinCount: 0,
      freeSpinAvailable: true,
      offers: [],
      lastSpinSeed: 0,
      pityCount: 0,
    },
    activeAugments: [],
    pendingAugmentChoices: [],
    pendingHazardChoices: [],
  };
}

function createInitialShopLevels(): Record<ShopItemId, number> {
  const levels = {} as Record<ShopItemId, number>;
  for (const id of ALL_SHOP_ITEM_IDS) {
    levels[id] = 0;
  }
  return levels;
}

export function createInitialPlayer(): PlayerState {
  return {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    vx: 0,
    vy: 0,
    width: PLAYER_BASE.width,
    height: PLAYER_BASE.height,
    radius: PLAYER_BASE.radius,
    facingAngle: -Math.PI / 2,
    targetAngle: -Math.PI / 2,
    bankAngle: 0,
    moving: false,

    health: PLAYER_BASE.maxHealth,
    maxHealth: PLAYER_BASE.maxHealth,
    hpRegen: 0,
    energy: PLAYER_BASE.energyMax,
    maxEnergy: PLAYER_BASE.energyMax,
    energyRegen: PLAYER_BASE.energyRegen,

    heat: 0,
    maxHeat: 100,
    coolingRate: 22,
    isOverloaded: false,
    ventCooldownMs: 0,
    thermalPurgeCooldownMs: 0,

    speed: PLAYER_BASE.speed,
    dashSpeed: PLAYER_BASE.dashSpeed,
    dashCost: PLAYER_BASE.dashCost,
    dashCooldownMs: PLAYER_BASE.dashCooldownBaseMs,
    dashActive: false,
    dashStartMs: -10000,
    dashDirX: 0,
    dashDirY: -1,
    lastDashEndMs: -10000,
    dashParryUntilMs: -10000,

    shieldActive: false,
    shieldStartMs: -10000,
    shieldDurationMs: PLAYER_BASE.shieldDurationBaseMs,
    shieldCooldownMs: 0,
    shieldCooldownMaxMs: PLAYER_BASE.shieldCooldownBaseMs,
    dashInvulnUntilMs: -10000,

    bulletSpeed: PLAYER_BASE.bulletSpeed,
    bulletCooldownMs: PLAYER_BASE.bulletCooldownMs,
    bulletDamage: PLAYER_BASE.bulletDamage,
    lastShotMs: -10000,
    shotRecoil: 0,
    doubleShotCount: 0,
    tripleShotCount: 0,
    pierceCount: 0,

    dropChanceBonus: 0,
    pickupRange: PLAYER_BASE.pickupRangeBase,
    moneyBonus: 0,
    hullId: 'interceptor',
    level: 1,
    xp: 0,
    xpToNext: xpRequiredForLevel(1),
    pendingLevelUps: 0,
    innatePierce: 0,
    chronoCharge: 0,
    chronoActiveMs: 0,
    chronoMaxMs: 3500,
    grazeCount: 0,
    activeMutations: [],
    rerollsLeft: 1,
    shotCounter: 0,
    orbitalBladeAngle: 0,
    overclockBuffMs: 0,
    ramShieldMs: 0,
    lockedTarget: null,
    loadout: createInitialLoadout(),

    skill: {
      mode: 'salvo',
      level: SKILL_BASE.level,
      maxLevel: SKILL_BASE.maxLevel,
      cooldownMs: SKILL_BASE.cooldownMs,
      lastUseMs: -SKILL_BASE.cooldownMs,
      radius: SKILL_BASE.radius,
      damage: SKILL_BASE.damage,
      cost: SKILL_BASE.cost,
    },
  };
}

export function createInitialRaidState(sectorNumber = 1): SectorRaidState {
  return {
    sectorNumber,
    completedCount: 0,
    totalRequired: 3,
    activeObjective: null,
    pendingQuickDraft: [],
    patrolTimerMs: 0,
    bossTriggered: false,
  };
}

export function createInitialShopState(): ShopState {
  return {
    levels: createInitialShopLevels(),
    offers: [],
    selected: [],
    refreshCount: 0,
    skillUpBoughtThisShop: false,
    visitedForWave: -1,
  };
}

export function createInitialGameState(): GameState {
  const initialState: GameState = {
    phase: 'MENU',
    simTimeMs: 0,
    hitStopMs: 0,
    screenShake: 0,
    nextEntityId: 1,

    score: 0,
    money: 0,
    wave: 0,
    bossKills: 0,

    isResting: false,
    restStartMs: 0,
    bossSpawnedForWave: false,
    neededSpawn: false,
    waveStartMs: 0,

    tutorialCircle: null,
    waveTransition: {
      active: false,
      elapsedMs: 0,
      durationMs: 1450,
      wave: 0,
      isBoss: false,
    },

    spawnQueue: [],
    spawnTimerMs: 0,
    spawnIntervalMs: 3600,

    player: createInitialPlayer(),
    enemies: [],
    boss: null,
    bullets: [],
    scheduledBullets: [],
    bombs: [],
    goldPickups: [],
    powerUps: [],
    healthPickup: null,
    floatingModules: [],
    arenaObstacles: [],
    drones: [],
    singularities: [],
    timeScale: 1.0,
    runRoomNumber: 1,
    roomsTotalPerSector: 5,
    roomsClearedTotal: 0,
    elitesKilledRun: 0,
    currentRoomKind: 'armory',
    currentRoomTitleVi: 'PHÒNG KHỞI ĐỘNG HỎA LỰC',
    currentRoomTitleEn: 'ARMORY SKIRMISH',
    currentRoomZoneVi: 'BO GỌN · 720m',
    currentRoomZoneEn: 'COMPACT · 720m',
    roomRewardDouble: false,
    roomWavePending: 0,
    roomDraftsPending: 0,
    pendingRoomDoors: [],
    roomPortal: null,
    warpTransition: {
      active: false,
      elapsedMs: 0,
      durationMs: 1000,
      accentHex: 0x38e8ff,
      titleVi: '',
      titleEn: '',
      zoneLabelVi: '',
      zoneLabelEn: '',
    },
    shardsEarnedLastRun: 0,
    metaBonuses: {
      bonusHp: 0,
      chronoMult: 1,
      rerolls: 1,
      startCredits: 0,
      shardMult: 1,
      pickupBonus: 0,
      dmgMult: 1,
    },
    aimWorldX: ARENA_W / 2,
    aimWorldY: ARENA_H / 2 - 140,
    aimWorldActive: false,
    raid: createInitialRaidState(1),
    stormRing: {
      centerX: ARENA_W / 2,
      centerY: ARENA_H / 2,
      targetCenterX: ARENA_W / 2,
      targetCenterY: ARENA_H / 2,
      radius: 1220,
      targetRadius: 1220,
      shrinkRate: 0,
      bossLocked: false,
      damagePerSec: 12,
      outsideStorm: false,
      phase: 'IDLE',
      transitionActive: false,
      transitionFromRadius: 1220,
      transitionFromX: ARENA_W / 2,
      transitionFromY: ARENA_H / 2,
      transitionToRadius: 1220,
      transitionToX: ARENA_W / 2,
      transitionToY: ARENA_H / 2,
      transitionElapsedMs: 0,
      transitionDurationMs: 1200,
      pulseFlash: 0,
    },
    sectorMap: generateSectorMap(),
    sectorHazard: 'normal',
    radiationMargin: 0,

    particles: [],
    shockwaves: [],
    afterimages: [],
    floatingTexts: [],
    playerBeams: [],
    lightningArcs: [],

    activeBuffs: {},

    combo: {
      kills: 0,
      timerMs: 0,
      maxCombo: 0,
      multiplier: 1,
      rank: 'D',
      color: '#55bbff',
      scoreBanked: 0,
      breakdown: { small: 0, medium: 0, large: 0, elite: 0, boss: 0 },
      endBanner: null,
    },

    shop: createInitialShopState(),
  };
  return initialState;
}

export function nextId(state: GameState): number {
  return state.nextEntityId++;
}

export function hasBuff(state: GameState, type: PowerUpType): boolean {
  const expiresAt = state.activeBuffs[type];
  return expiresAt !== undefined && expiresAt > state.simTimeMs;
}

export function activateBuff(state: GameState, type: PowerUpType): void {
  state.activeBuffs[type] = state.simTimeMs + POWER_UP_CONFIG[type].durationMs;
}

export function addScreenShake(state: GameState, amount: number): void {
  state.screenShake = Math.min(28, Math.max(state.screenShake, amount));
}

export function triggerHitStop(state: GameState, durationMs: number): void {
  state.hitStopMs = Math.max(state.hitStopMs, durationMs);
}

const MAX_PARTICLES = 750;

export function spawnParticleBurst(
  state: GameState,
  x: number,
  y: number,
  hex: number,
  count: number,
  speed = 2.8,
  size = 3.5,
  life = 28,
  zSpread = 1.6
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const mag = (0.3 + Math.random() * 0.9) * speed;
    const sz = size * (0.65 + Math.random() * 0.65);
    const lt = Math.max(8, Math.floor(life * (0.7 + Math.random() * 0.55)));
    state.particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * zSpread,
      vx: Math.cos(angle) * mag,
      vy: Math.sin(angle) * mag,
      vz: (Math.random() - 0.35) * speed * 0.45,
      hex,
      size: sz,
      maxSize: sz,
      life: lt,
      maxLife: lt,
    });
  }
  if (state.particles.length > MAX_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }
}

export function spawnShockwave(
  state: GameState,
  x: number,
  y: number,
  maxRadius: number,
  hex: number,
  life = 24
): void {
  state.shockwaves.push({
    x,
    y,
    radius: 4,
    maxRadius,
    hex,
    life,
    maxLife: life,
  });
}

export function spawnFloatingText(
  state: GameState,
  x: number,
  y: number,
  text: string,
  color: string,
  scale = 1,
  life = 36
): void {
  if (state.floatingTexts.length > 48) {
    state.floatingTexts.shift();
  }
  const isCrit = text.endsWith('!');
  const vx = (Math.random() - 0.5) * (isCrit ? 2.6 : 1.85);
  const vy = isCrit ? -2.55 - Math.random() * 0.55 : -1.8 - Math.random() * 0.45;
  const gravity = isCrit ? 0.092 : 0.068;
  state.floatingTexts.push({
    id: nextId(state),
    x,
    y,
    vx,
    vy,
    gravity,
    isCrit,
    text,
    color,
    scale,
    life,
    maxLife: life,
  });
}

export function isPlayerInvulnerable(state: GameState): boolean {
  return state.player.shieldActive || state.simTimeMs < state.player.dashInvulnUntilMs;
}

export function clampPointToStorm(
  x: number,
  y: number,
  ring: StormRingState,
  margin = 40
): { x: number; y: number } {
  const maxR = Math.max(80, ring.radius - margin);
  const dx = x - ring.centerX;
  const dy = y - ring.centerY;
  const d = Math.hypot(dx, dy);
  if (d <= maxR || d < 0.0001) {
    return { x, y };
  }
  return {
    x: ring.centerX + (dx / d) * maxR,
    y: ring.centerY + (dy / d) * maxR,
  };
}

export function randomPointInStorm(
  ring: StormRingState,
  nearX: number,
  nearY: number,
  minDist: number,
  maxDist: number,
  margin = 55
): { x: number; y: number } {
  const ang = Math.random() * Math.PI * 2;
  const dist = minDist + Math.random() * Math.max(10, maxDist - minDist);
  return clampPointToStorm(
    nearX + Math.cos(ang) * dist,
    nearY + Math.sin(ang) * dist,
    ring,
    margin
  );
}

export function xpRequiredForLevel(level: number): number {
  return Math.round(145 + Math.pow(Math.max(0, level - 1), 1.6) * 115);
}

export function grantPlayerXp(state: GameState, amount: number, bus?: EventBus): boolean {
  if (amount <= 0) return false;
  const p = state.player;
  p.xp += amount;
  let leveledUp = false;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = xpRequiredForLevel(p.level);
    p.pendingLevelUps++;
    leveledUp = true;
    spawnShockwave(state, p.x, p.y, 125, 0x38e8ff, 20);
    spawnFloatingText(state, p.x, p.y - 34, `LEVEL UP // LV.${p.level}`, '#38e8ff', 1.35, 52);
    bus?.emit('LEVEL_UP', { level: p.level });
  }
  return leveledUp;
}
