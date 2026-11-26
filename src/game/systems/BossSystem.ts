import { BOSS_MUTATIONS, BOSS_MUTATION_IDS, type BossMutationId } from '../../config/bossMutations';
import {
  PRIMARY_WEAPON_IDS,
  SKILL_WEAPON_IDS,
  WEAPON_CATALOG,
} from '../../config/weapons';
import type { EventBus } from '../../engine/EventBus';
import {
  addScreenShake,
  clampPointToStorm,
  grantPlayerXp,
  nextId,
  spawnFloatingText,
  spawnParticleBurst,
  spawnShockwave,
  triggerHitStop,
} from '../GameState';
import type {
  BossArchetype,
  BossClone,
  BossEntity,
  BossGravityWell,
  BossHazardZone,
  BossPylon,
  GameState,
} from '../types';
import { registerComboKill } from './ComboSystem';
import { computeOffscreenSpawnPoint, computePerimeterBandPoint, createEnemy } from './EnemySystem';
import { damagePlayer } from './PlayerSystem';
import { startStormTransition } from './WaveSystem';

const LAST_BOSS_ARCH_STORAGE_KEY = 'spaceshooter_last_boss_arch';

const BOSS_NAMES = [
  'IRON VALKYRIE EX',
  'NYX-EMPRESS',
  'AURELIAN SERAPHIM EX',
  'LEVIATHAN HYDRA',
  'GEMINI TWIN CORES',
  'BASTION COLOSSUS',
] as const;
const BOSS_COLORS = [
  { css: '#ff3344', hex: 0xff3344 },
  { css: '#aa44ff', hex: 0xaa44ff },
  { css: '#ffcc22', hex: 0xffcc22 },
  { css: '#10f5a8', hex: 0x10f5a8 },
  { css: '#38e8ff', hex: 0x38e8ff },
  { css: '#ff8c1a', hex: 0xff8c1a },
] as const;

const ATTACK_POOLS: Record<BossArchetype, string[]> = {
  0: ['machineGun', 'shotgunBlast', 'charge', 'novaRing', 'crossBurst', 'vlsBarrage'],
  1: ['minionSwarm', 'lotusSpiral', 'homingOrbs', 'flowerPetals', 'waveAttack'],
  2: ['strategicMines', 'deathRay', 'gridLock', 'sniperShot', 'matrixRings'],
  3: ['serpentWhip', 'venomCoil', 'fangStrike', 'novaRing'],
  4: ['tetherSlice', 'twinPincer', 'twinScissorDash', 'crossBurst'],
  5: ['fortressMortar', 'quadRailCross', 'shatterNova', 'charge'],
};

let lastSpawnedArchetype: BossArchetype | null = null;

function readStoredArchetype(): BossArchetype | null {
  if (lastSpawnedArchetype !== null) return lastSpawnedArchetype;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LAST_BOSS_ARCH_STORAGE_KEY);
    if (raw === '0' || raw === '1' || raw === '2' || raw === '3' || raw === '4' || raw === '5') {
      lastSpawnedArchetype = Number(raw) as BossArchetype;
      return lastSpawnedArchetype;
    }
  } catch {
    // Headless tests don't have localStorage, carry on
  }
  return null;
}

function saveLastArchetype(arch: BossArchetype): void {
  lastSpawnedArchetype = arch;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_BOSS_ARCH_STORAGE_KEY, String(arch));
  } catch {
    // Ignore restricted/private storage failures
  }
}

function shuffleCopy<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rollBossMutations(count: number, exclude: readonly BossMutationId[] = []): BossMutationId[] {
  const available = shuffleCopy(BOSS_MUTATION_IDS.filter((m) => !exclude.includes(m)));
  return available.slice(0, Math.min(count, available.length));
}

function buildAttackPool(archetype: BossArchetype, mutations: readonly BossMutationId[]): string[] {
  const basePicks = shuffleCopy(ATTACK_POOLS[archetype]).slice(0, 3);
  const pool = new Set<string>(basePicks);
  for (const mut of mutations) {
    pool.add(BOSS_MUTATIONS[mut].signatureAttack);
    if (mut === 'SOLAR_OVERCLOCK') {
      pool.add('ricochetSalvo');
    }
  }
  return [...pool];
}

function buildBossDisplayName(
  archetype: BossArchetype,
  bossNumber: number,
  mutations: readonly BossMutationId[]
): string {
  const suffixes = ['', ` MK-${bossNumber}`, ' PRIME', ' OMEGA', ' APEX'];
  const suffix = bossNumber > 1 ? suffixes[Math.min(bossNumber - 1, suffixes.length - 1)] : '';
  const prefix = mutations.length > 0 ? `${BOSS_MUTATIONS[mutations[0]].titlePrefix} ` : '';
  return `${prefix}${BOSS_NAMES[archetype]}${suffix}`;
}

function drawNextBossAttack(boss: BossEntity): string {
  if (boss.attackDeck.length === 0) {
    boss.attackDeck = shuffleCopy(boss.attackPool);
  }
  // Stop the Boss from spamming the exact same signature attack three times in a row
  if (boss.attackDeck.length > 1 && boss.attackDeck[boss.attackDeck.length - 1] === boss.lastAttack) {
    const swapIdx = boss.attackDeck.findIndex((atk) => atk !== boss.lastAttack);
    if (swapIdx !== -1) {
      const top = boss.attackDeck.length - 1;
      [boss.attackDeck[swapIdx], boss.attackDeck[top]] = [
        boss.attackDeck[top],
        boss.attackDeck[swapIdx],
      ];
    }
  }
  const next = boss.attackDeck.pop() ?? boss.attackPool[0] ?? 'novaRing';
  boss.lastAttack = next;
  return next;
}

function clearBossWeaponStates(boss: BossEntity, state: GameState): void {
  boss.laserCharging = false;
  boss.laserFiring = false;
  boss.laserBeamCount = 1;
  boss.laserSpinSpeed = 0;
  boss.machineGunActive = false;
  boss.sniperActive = false;
  boss.isCharging = false;
  boss.preChargeTimer = 0;
  boss.skillChargeTimerMs = 0;
  boss.teleporting = false;
  boss.teleportTarget = null;
  if (boss.twin) {
    boss.twin.tetherChargingMs = 0;
    boss.twin.tetherActiveMs = 0;
  }
  state.scheduledBullets = [];
}

export function createBoss(
  state: GameState,
  forcedArchetype?: BossArchetype,
  forcedMutations?: BossMutationId[]
): BossEntity {
  const bossNumber = Math.max(1, Math.floor(state.wave / 5));
  const difficultyMult = bossNumber === 1 ? 1 : 1 + (bossNumber - 1) * 0.38;

  let archetype: BossArchetype;
  if (forcedArchetype !== undefined) {
    archetype = forcedArchetype;
  } else {
    const prevArch = readStoredArchetype();
    const choices = ([0, 1, 2, 3, 4, 5] as const).filter((a) => a !== prevArch);
    archetype = choices[Math.floor(Math.random() * choices.length)];
  }
  saveLastArchetype(archetype);

  const mutationCount = bossNumber >= 2 ? 2 : 1;
  const mutations =
    forcedMutations && forcedMutations.length > 0
      ? [...forcedMutations]
      : rollBossMutations(mutationCount);

  const attackPool = buildAttackPool(archetype, mutations);

  const baseHp =
    bossNumber === 1
      ? 3200 + Math.random() * 600
      : 4800 + bossNumber * 2100 + Math.random() * 900;
  const hp = Math.floor(baseHp * difficultyMult * (1 + bossNumber * 0.18));
  const size = Math.min(130, 86 + bossNumber * 5);

  const theme = BOSS_COLORS[archetype];
  const cx = state.stormRing.targetCenterX;
  const anchorY = state.stormRing.targetCenterY - 182;
  const startY = archetype === 0 || archetype === 3 ? anchorY - 255 : anchorY;
  const bossRadius = size * 0.46;

  // Leviathan gets 6 slithering spine joints trailing behind its skull
  const segments =
    archetype === 3
      ? Array.from({ length: 6 }, (_, i) => ({
          x: cx,
          y: startY - (i + 1) * bossRadius * 0.78,
          angle: Math.PI / 2,
          radius: bossRadius * Math.max(0.32, 0.7 - i * 0.055),
        }))
      : [];

  // Gemini spawns a synchronized twin because one giant boss apparently wasn't stressful enough
  const twin =
    archetype === 4
      ? {
          x: cx + 180,
          y: anchorY,
          angle: Math.PI / 2,
          radius: size * 0.4,
          hitFlash: 0,
          tetherChargingMs: 0,
          tetherActiveMs: 0,
        }
      : null;

  return {
    id: nextId(state),
    archetype,
    displayName: buildBossDisplayName(archetype, bossNumber, mutations),
    color: theme.css,
    hex: theme.hex,
    x: cx,
    y: startY,
    w: size,
    h: size,
    radius: bossRadius,
    hp,
    maxHp: hp,
    displayHp: 0,
    speed: 1.15 + bossNumber * 0.1,
    damageMultiplier: 1.22 + (bossNumber - 1) * 0.24,
    phase: 1,
    enraged: false,
    state: 'IDLE',

    transformStage: 1,
    transformBlend: 0,
    segments,
    twin,
    armorPlates: archetype === 5 ? 4 : 0,

    mutations,
    attackDeck: shuffleCopy(attackPool),
    lastAttack: '',
    staggerTimerMs: 0,
    laserBeamCount: 1,
    laserSpinSpeed: 0,
    blinkSlashTimerMs: 0,
    blinkOriginX: cx,
    blinkOriginY: anchorY,

    entering: true,
    entryTimer: 0,
    entryState: 0,
    dying: false,
    deathTimer: 0,
    deathState: 0,
    deadFinalized: false,

    consecutiveAttacks: 0,
    maxConsecutiveAttacks: 4,
    attackCooldownMs: 520,
    restTimerMs: 0,
    attackPool,

    rotation: 0,
    breathe: 0,
    attackFlash: 0,
    hitFlash: 0,
    bodyRecoil: 0,
    coreEnergy: 0.35,
    attackWindup: 0,
    restProgress: 0,
    currentPhaseLevel: 0,
    faceAngle: Math.PI / 2,

    transitioning: false,
    transitionTimer: 0,
    skillChargeTimerMs: 0,

    laserCharging: false,
    laserFiring: false,
    laserAngle: Math.PI / 2,
    laserTimerMs: 0,
    laserDamageTimerMs: 0,

    teleporting: false,
    teleportTimerMs: 0,
    teleportTarget: null,

    machineGunActive: false,
    machineGunTimerMs: 0,
    machineGunShotsFired: 0,
    machineGunMaxShots: 0,

    sniperActive: false,
    sniperTimerMs: 0,
    sniperShotsFired: 0,
    sniperMaxShots: 0,

    isCharging: false,
    preChargeTimer: 0,
    chargeDirX: 0,
    chargeDirY: 1,
    chargeProgress: 0,
    chargeCount: 0,

    mines: [],
    pylons: [],
    clones: [],
    hazardZones: [],
    gravityWells: [],
  };
}

export function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function hitBoss(
  state: GameState,
  boss: BossEntity,
  damage: number,
  isCrit: boolean,
  hitX: number,
  hitY: number,
  bus: EventBus
): void {
  if (boss.entering || boss.dying) return;

  let finalDmg = damage;
  const shielded = boss.pylons.length > 0;
  const staggered = !shielded && boss.staggerTimerMs > 0;
  const bastionArmored = !shielded && !staggered && boss.archetype === 5 && boss.armorPlates > 0;
  const bastionExposed = !shielded && !staggered && boss.archetype === 5 && boss.armorPlates === 0;

  if (shielded) {
    finalDmg = Math.max(1, Math.floor(damage * 0.35));
    spawnParticleBurst(state, hitX, hitY, 0x34d399, 3, 2.0, 2.5, 12);
    bus.emit('ARMOR_DEFLECTED', { x: hitX, y: hitY });
  } else if (staggered) {
    finalDmg = Math.floor(damage * 1.35);
    spawnParticleBurst(state, hitX, hitY, 0x34d399, 6, 2.8, 3.4, 16);
  } else if (boss.state === 'RESTING') {
    finalDmg = Math.floor(damage * 1.15);
    spawnParticleBurst(state, hitX, hitY, 0x33ff99, 4, 2.2, 3, 14);
  } else if (bastionArmored) {
    const mult = boss.armorPlates >= 3 ? 0.65 : 0.85;
    finalDmg = Math.max(1, Math.floor(damage * mult));
    spawnParticleBurst(state, hitX, hitY, 0xffaa44, 4, 2.2, 2.6, 12);
    if (boss.armorPlates >= 3) {
      bus.emit('ARMOR_DEFLECTED', { x: hitX, y: hitY });
    }
  } else if (bastionExposed) {
    finalDmg = Math.floor(damage * 1.2);
    spawnParticleBurst(state, hitX, hitY, 0xffdd55, 5, 2.6, 3.2, 16);
  }

  boss.hp -= finalDmg;
  boss.hitFlash = 1.0;

  spawnParticleBurst(state, hitX, hitY, isCrit ? 0xffee44 : boss.hex, isCrit ? 7 : 4, 2.4, 3.2, 18);
  const dmgText = shielded
    ? `${finalDmg} [SHIELD]`
    : bastionArmored && boss.armorPlates >= 3
      ? `${finalDmg} [ARMOR]`
      : staggered || bastionExposed || isCrit
        ? `${finalDmg}!`
        : `${finalDmg}`;
  const dmgColor = shielded
    ? '#6ee7b7'
    : staggered
      ? '#34d399'
      : bastionArmored
        ? '#fdba74'
        : bastionExposed
          ? '#ffd166'
          : isCrit
            ? '#ffee44'
            : '#ffffff';
  spawnFloatingText(
    state,
    hitX + (Math.random() - 0.5) * 20,
    hitY - 10,
    dmgText,
    dmgColor,
    staggered || bastionExposed || isCrit ? 1.25 : 0.9,
    28
  );

  const bDx = hitX - boss.x;
  const bDy = hitY - boss.y;
  const bLen = Math.hypot(bDx, bDy);
  const nx = bLen > 0.001 ? bDx / bLen : (state.player.x - hitX) / (Math.hypot(state.player.x - hitX, state.player.y - hitY) || 1);
  const ny = bLen > 0.001 ? bDy / bLen : (state.player.y - hitY) / (Math.hypot(state.player.x - hitX, state.player.y - hitY) || 1);
  bus.emit('ENEMY_HIT', { x: hitX, y: hitY, damage: finalDmg, isCrit, isBoss: true, nx, ny });

  if (boss.hp <= 0 && !boss.dying) {
    boss.hp = 0;
    boss.dying = true;
    boss.deathTimer = 0;
    boss.deathState = 0;
    boss.mines = [];
    boss.pylons = [];
    boss.clones = [];
    boss.hazardZones = [];
    boss.gravityWells = [];
    boss.segments = [];
    boss.twin = null;
    boss.armorPlates = 0;
    boss.staggerTimerMs = 0;
    clearBossWeaponStates(boss, state);
    triggerHitStop(state, 55);
  }
}

export function hitBossPylon(
  state: GameState,
  boss: BossEntity,
  pylon: BossPylon,
  damage: number,
  isCrit: boolean,
  bus: EventBus
): boolean {
  if (boss.entering || boss.dying || pylon.hp <= 0) return false;
  pylon.hp -= damage;
  pylon.hitFlash = 1.0;

  spawnParticleBurst(state, pylon.x, pylon.y, pylon.hex, 4, 2.2, 3.0, 14);
  spawnFloatingText(
    state,
    pylon.x + (Math.random() - 0.5) * 12,
    pylon.y - 10,
    isCrit ? `${damage}!` : `${damage}`,
    isCrit ? '#ffee44' : '#6ee7b7',
    isCrit ? 1.15 : 0.85,
    22
  );
  const pDx = state.player.x - pylon.x;
  const pDy = state.player.y - pylon.y;
  const pLen = Math.hypot(pDx, pDy) || 1;
  bus.emit('ENEMY_HIT', {
    x: pylon.x,
    y: pylon.y,
    damage,
    isCrit,
    isBoss: false,
    nx: pDx / pLen,
    ny: pDy / pLen,
  });

  if (pylon.hp <= 0) {
    boss.pylons = boss.pylons.filter((p) => p.id !== pylon.id);
    addScreenShake(state, 10);
    spawnShockwave(state, pylon.x, pylon.y, 110, 0x34d399, 22);
    spawnParticleBurst(state, pylon.x, pylon.y, 0x34d399, 26, 4.5, 4.5, 24);
    bus.emit('SHIELD_BROKEN', { x: pylon.x, y: pylon.y, major: boss.pylons.length === 0 });

    if (boss.pylons.length === 0) {
      // Smash all 3 emerald pylons and the Boss drops its shield into a juicy stun window
      boss.staggerTimerMs = 3200;
      clearBossWeaponStates(boss, state);
      boss.state = 'IDLE';
      addScreenShake(state, 20);
      triggerHitStop(state, 45);
      spawnShockwave(state, boss.x, boss.y, 240, 0x34d399, 32);
      spawnParticleBurst(state, boss.x, boss.y, 0x34d399, 36, 5.5, 5.0, 32);
      state.player.heat = Math.max(0, state.player.heat - 35);
      state.player.isOverloaded = state.player.heat >= state.player.maxHeat;
      state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 25);
      spawnFloatingText(state, boss.x, boss.y - 36, 'SHIELD BREAK! 1.75x', '#34d399', 1.45, 52);
    }
    return true;
  }
  return false;
}

export function hitBossClone(
  state: GameState,
  boss: BossEntity,
  clone: BossClone,
  damage: number,
  isCrit: boolean,
  bus: EventBus
): boolean {
  if (boss.entering || boss.dying || clone.hp <= 0) return false;
  clone.hp -= damage;
  clone.hitFlash = 1.0;

  spawnParticleBurst(state, clone.x, clone.y, clone.hex, 4, 2.0, 2.8, 14);
  spawnFloatingText(
    state,
    clone.x + (Math.random() - 0.5) * 12,
    clone.y - 10,
    isCrit ? `${damage}!` : `${damage}`,
    isCrit ? '#ffee44' : '#67e8f9',
    isCrit ? 1.15 : 0.85,
    22
  );
  const cDx = state.player.x - clone.x;
  const cDy = state.player.y - clone.y;
  const cLen = Math.hypot(cDx, cDy) || 1;
  bus.emit('ENEMY_HIT', {
    x: clone.x,
    y: clone.y,
    damage,
    isCrit,
    isBoss: false,
    nx: cDx / cLen,
    ny: cDy / cLen,
  });

  if (clone.hp <= 0) {
    boss.clones = boss.clones.filter((c) => c.id !== clone.id);
    addScreenShake(state, 7);
    spawnShockwave(state, clone.x, clone.y, 95, 0x22d3ee, 18);
    spawnParticleBurst(state, clone.x, clone.y, 0x22d3ee, 22, 4.0, 4.0, 22);
    bus.emit('SHIELD_BROKEN', { x: clone.x, y: clone.y, major: false });
    state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 20);
    state.player.heat = Math.max(0, state.player.heat - 20);
    state.player.isOverloaded = state.player.heat >= state.player.maxHeat;
    spawnFloatingText(state, clone.x, clone.y - 24, 'MIRAGE SHATTERED +20 EN', '#22d3ee', 1.05, 36);
    return true;
  }
  return false;
}

function updateBossEntry(state: GameState, boss: BossEntity, bus: EventBus): void {
  boss.entryTimer++;
  const cx = state.stormRing.centerX;
  const anchorY = state.stormRing.centerY - 182;
  boss.x = cx;

  if (boss.entryState === 0) {
    boss.displayHp = 0;
    boss.coreEnergy = 0.2 + (boss.entryTimer / 42) * 0.65;
    if (boss.entryTimer % 4 === 0) addScreenShake(state, 1.8);
    if (boss.entryTimer % 6 === 0) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 48 + Math.random() * 26;
      spawnParticleBurst(
        state,
        boss.x + Math.cos(ang) * dist,
        anchorY + Math.sin(ang) * dist,
        boss.hex,
        4,
        1.8,
        3.2,
        18
      );
    }
    if (boss.entryTimer >= 42) {
      boss.entryState = 1;
      boss.entryTimer = 0;
    }
  } else if (boss.entryState === 1) {
    const p = Math.min(1, boss.entryTimer / 30);
    boss.coreEnergy = 0.85 + p * 0.15;

    if (boss.archetype === 0 || boss.archetype === 3) {
      const startY = anchorY - 255;
      boss.y = startY + (anchorY - startY) * Math.pow(p, 2.2);
      if (boss.entryTimer % 2 === 0) {
        spawnParticleBurst(state, boss.x, boss.y - boss.radius * 0.6, boss.hex, 5, 3.2, 4.5, 22);
      }
    } else if (boss.archetype === 1 || boss.archetype === 4) {
      boss.y = anchorY;
      if (boss.twin) {
        boss.twin.x = boss.x + 180 * p;
        boss.twin.y = anchorY;
      }
      if (boss.entryTimer % 4 === 0) {
        spawnParticleBurst(state, boss.x, boss.y, boss.hex, 7, 3.8, 4.2, 24);
      }
    } else {
      boss.y = anchorY;
      if (boss.entryTimer % 4 === 0) {
        spawnParticleBurst(state, boss.x, boss.y, 0xffee88, 6, 3.6, 4.0, 24);
      }
    }

    // Keep Leviathan's tail neatly coiled behind its head while dramatic entry music plays
    if (boss.segments.length > 0) {
      let prevX = boss.x;
      let prevY = boss.y;
      for (let i = 0; i < boss.segments.length; i++) {
        const seg = boss.segments[i];
        const spacing = boss.radius * (i === 0 ? 0.78 : 0.72);
        seg.x = prevX + Math.sin(boss.entryTimer * 0.25 + i * 0.8) * 14 * (1 - p);
        seg.y = prevY - spacing;
        seg.angle = Math.atan2(prevY - seg.y, prevX - seg.x);
        prevX = seg.x;
        prevY = seg.y;
      }
    }

    if (boss.entryTimer >= 30) {
      boss.y = anchorY;
      boss.entryState = 2;
      boss.entryTimer = 0;
      boss.coreEnergy = 1.0;
      boss.attackFlash = 1.0;
      addScreenShake(state, 24);
      triggerHitStop(state, 42);
      spawnShockwave(state, boss.x, boss.y, 240, boss.hex, 36);
      spawnShockwave(state, boss.x, boss.y, 145, 0xffffff, 22);
      spawnParticleBurst(state, boss.x, boss.y, boss.hex, 44, 6.2, 5.5, 38);
      bus.emit('BOSS_ENTRY_IMPACT', {
        archetype: boss.archetype,
        x: boss.x,
        y: boss.y,
        hex: boss.hex,
        name: boss.displayName,
      });
    }
  } else {
    const p = Math.min(1, boss.entryTimer / 48);
    const easeOut = 1 - Math.pow(1 - p, 3);
    boss.y = anchorY - Math.sin(boss.entryTimer * 0.22) * Math.max(0, 15 * (1 - p));
    boss.displayHp = boss.maxHp * easeOut;
    boss.attackFlash *= 0.92;
    boss.breathe += 0.04;
    if (boss.entryTimer >= 48) {
      boss.y = anchorY;
      boss.displayHp = boss.maxHp;
      boss.entering = false;
    }
  }
}

function finalizeBossDeath(state: GameState, boss: BossEntity, bus: EventBus): void {
  if (boss.deadFinalized) return;
  boss.deadFinalized = true;
  state.bossKills++;

  const earnedScore = registerComboKill(state, bus, 250, 'boss');
  spawnFloatingText(state, boss.x, boss.y - 24, `+${earnedScore}`, '#ffdd55', 1.6, 55);

  const bossNumber = Math.max(1, Math.floor(state.wave / 5));
  const totalReward = Math.floor(
    (140 + bossNumber * 45 + Math.random() * (40 + bossNumber * 15)) * (1 + state.player.moneyBonus)
  );
  const coinCount = 16;
  const perCoin = Math.max(4, Math.ceil(totalReward / coinCount));
  grantPlayerXp(state, 180, bus);

  for (let i = 0; i < coinCount; i++) {
    const ang = (i / coinCount) * Math.PI * 2 + Math.random() * 0.2;
    const spd = 3.2 + Math.random() * 5.2;
    state.goldPickups.push({
      id: nextId(state),
      x: boss.x,
      y: boss.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      value: perCoin,
      size: 7.5,
      age: 0,
      homing: true,
    });
  }

  addScreenShake(state, 28);
  triggerHitStop(state, 70);
  spawnShockwave(state, boss.x, boss.y, 320, 0xffffff, 36);
  spawnShockwave(state, boss.x, boss.y, 240, boss.hex, 30);
  spawnParticleBurst(state, boss.x, boss.y, 0xffffff, 65, 8, 6, 48);
  spawnParticleBurst(state, boss.x, boss.y, boss.hex, 85, 6.5, 5.5, 55);

  bus.emit('BOSS_DEFEATED', {
    archetype: boss.archetype,
    x: boss.x,
    y: boss.y,
    reward: totalReward,
  });

  const dropPool = [...PRIMARY_WEAPON_IDS, ...SKILL_WEAPON_IDS];
  for (let dIdx = 0; dIdx < 2; dIdx++) {
    const wId = dropPool[Math.floor(Math.random() * dropPool.length)];
    const a = (dIdx === 0 ? -0.6 : 0.6) + Math.PI * 0.5;
    const dropPt = clampPointToStorm(
      boss.x + Math.cos(a) * 32,
      boss.y + Math.sin(a) * 32,
      state.stormRing,
      45
    );
    state.floatingModules.push({
      id: nextId(state),
      x: dropPt.x,
      y: dropPt.y,
      vx: Math.cos(a) * 2.2,
      vy: Math.sin(a) * 2.2,
      weaponId: wId,
      tier: 1,
      pulse: dIdx * 1.4,
      lifeMs: 28000,
    });
    spawnFloatingText(
      state,
      boss.x + (dIdx === 0 ? -28 : 28),
      boss.y - 24,
      WEAPON_CATALOG[wId].nameEn,
      WEAPON_CATALOG[wId].accent,
      0.95,
      50
    );
    bus.emit('MODULE_DROPPED', { weaponId: wId, x: boss.x, y: boss.y });
  }

  state.stormRing.bossLocked = false;
  state.stormRing.targetRadius = 1240;
  state.stormRing.shrinkRate = 210;
  startStormTransition(state, state.player.x, state.player.y, 1240, 1450, 'EXPANDING');

  state.boss = null;
}

function updateBossDeath(state: GameState, boss: BossEntity, bus: EventBus): void {
  boss.deathTimer++;
  if (boss.deathState === 0) {
    addScreenShake(state, 10);
    if (boss.deathTimer % 6 === 0) {
      const ex = boss.x + (Math.random() - 0.5) * boss.w;
      const ey = boss.y + (Math.random() - 0.5) * boss.h;
      spawnParticleBurst(state, ex, ey, boss.hex, 12, 4.2, 4.5, 24);
      spawnShockwave(state, ex, ey, 65, 0xffaa44, 14);
    }
    if (boss.deathTimer >= 72) {
      boss.deathState = 1;
      boss.deathTimer = 0;
    }
  } else {
    addScreenShake(state, 20);
    if (boss.deathTimer >= 20) {
      finalizeBossDeath(state, boss, bus);
    }
  }
}

function getBossDamage(boss: BossEntity, base: number): number {
  return Math.floor(base * boss.damageMultiplier);
}

// Interactive boss attacks and sub-phase shenanigans

function deployAegisPylons(state: GameState, boss: BossEntity): void {
  if (boss.pylons.length >= 3) {
    fireRicochetSalvo(state, boss);
    return;
  }
  boss.skillChargeTimerMs = 420;
  const needed = Math.min(3 - boss.pylons.length, boss.phase >= 3 ? 3 : 2);
  const pylonHp = Math.max(85, Math.round(boss.maxHp * 0.11));
  const orbitR = boss.radius + 78;
  const startAngle = boss.rotation + Math.random() * Math.PI * 0.6;
  for (let i = 0; i < needed; i++) {
    const ang = startAngle + (i / needed) * Math.PI * 2;
    const px = boss.x + Math.cos(ang) * orbitR;
    const py = boss.y + Math.sin(ang) * orbitR;
    boss.pylons.push({
      id: nextId(state),
      x: px,
      y: py,
      hp: pylonHp,
      maxHp: pylonHp,
      radius: 21,
      angle: ang,
      orbitRadius: orbitR,
      hitFlash: 0,
      fireTimerMs: 1100 + i * 350,
      hex: 0x34d399,
    });
    spawnShockwave(state, px, py, 65, 0x34d399, 16);
  }
  spawnFloatingText(state, boss.x, boss.y - 38, 'AEGIS PYLONS!', '#34d399', 1.1, 40);
}

function deployMirageClones(state: GameState, boss: BossEntity): void {
  boss.skillChargeTimerMs = 380;
  if (boss.clones.length >= 3) {
    fireRicochetSalvo(state, boss);
    return;
  }
  const desired = boss.phase >= 3 ? 3 : 2;
  const count = Math.min(3 - boss.clones.length, desired);
  const cloneHp = Math.max(70, Math.round(boss.maxHp * 0.08));
  for (let i = 0; i < count; i++) {
    const ang = boss.faceAngle + (i === 0 ? -1.4 : i === 1 ? 1.4 : Math.PI);
    const pt = clampPointToStorm(
      boss.x + Math.cos(ang) * 185,
      boss.y + Math.sin(ang) * 185,
      state.stormRing,
      boss.radius + 24
    );
    boss.clones.push({
      id: nextId(state),
      x: pt.x,
      y: pt.y,
      hp: cloneHp,
      maxHp: cloneHp,
      radius: boss.radius * 0.72,
      angle: ang,
      lifeMs: 9500,
      maxLifeMs: 9500,
      fireTimerMs: 650 + i * 260,
      hitFlash: 0,
      hex: 0x22d3ee,
    });
    spawnShockwave(state, pt.x, pt.y, 90, 0x22d3ee, 18);
    spawnParticleBurst(state, pt.x, pt.y, 0x22d3ee, 16, 3.4, 3.8, 20);
  }
}

function spawnOrbitalBarrage(state: GameState, boss: BossEntity): void {
  boss.skillChargeTimerMs = 420;
  const p = state.player;
  const zoneCount = 3 + boss.phase;
  const dmg = getBossDamage(boss, 18);
  const zoneRadius = 76 + boss.phase * 8;

  for (let i = 0; i < zoneCount; i++) {
    const spreadAng = (i / Math.max(1, zoneCount - 1)) * Math.PI * 2;
    const offsetX = i === 0 ? p.vx * 26 : Math.cos(spreadAng) * (105 + boss.phase * 14);
    const offsetY = i === 0 ? p.vy * 26 : Math.sin(spreadAng) * (105 + boss.phase * 14);
    const pt = clampPointToStorm(p.x + offsetX, p.y + offsetY, state.stormRing, zoneRadius * 0.6);
    boss.hazardZones.push({
      id: nextId(state),
      x: pt.x,
      y: pt.y,
      radius: zoneRadius,
      warningMs: 1120 + i * 160,
      maxWarningMs: 1120 + i * 160,
      detonateFlashMs: 0,
      damage: dmg,
      hex: 0xfb7185,
      detonated: false,
    });
  }
}

function startLaserCarousel(state: GameState, boss: BossEntity, baseAngle: number): void {
  boss.laserCharging = true;
  boss.laserAngle = baseAngle + Math.PI / 4;
  boss.laserBeamCount = Math.min(4, 1 + boss.phase);
  boss.laserSpinSpeed = (Math.random() < 0.5 ? 1 : -1) * (0.011 + boss.phase * 0.003);
  boss.laserTimerMs = Math.max(760, 1100 - boss.phase * 110);
  spawnShockwave(state, boss.x, boss.y, 130, 0xfbbf24, 20);
}

function spawnGravityVortex(state: GameState, boss: BossEntity): void {
  boss.skillChargeTimerMs = 400;
  const midX = (state.player.x + boss.x) * 0.5 + (Math.random() - 0.5) * 90;
  const midY = (state.player.y + boss.y) * 0.5 + (Math.random() - 0.5) * 90;
  const pt = clampPointToStorm(midX, midY, state.stormRing, 85);

  if (boss.gravityWells.length >= 2) boss.gravityWells.shift();
  boss.gravityWells.push({
    id: nextId(state),
    x: pt.x,
    y: pt.y,
    radius: 255,
    pullStrength: 2.3 + boss.phase * 0.35,
    lifeMs: 5200,
    maxLifeMs: 5200,
    pulse: 0,
    hex: 0xa855f7,
  });

  // Toss slow spiral orbs around the well so sitting still isn't an option
  const count = 10 + boss.phase * 2;
  for (let i = 0; i < count; i++) {
    state.scheduledBullets.push({
      x: pt.x,
      y: pt.y,
      angle: (Math.PI * 2 * i) / count,
      delayMs: 280 + i * 35,
      color: '#c084fc',
      hex: 0xc084fc,
      damage: getBossDamage(boss, 11),
      speed: 3.4,
      visualStyle: 'orb',
    });
  }
}

function startChronoAmbush(state: GameState, boss: BossEntity): void {
  const p = state.player;
  const flankAng = p.facingAngle + Math.PI + (Math.random() < 0.5 ? -0.65 : 0.65);
  const tp = clampPointToStorm(
    p.x + Math.cos(flankAng) * 205,
    p.y + Math.sin(flankAng) * 205,
    state.stormRing,
    boss.radius + 32
  );
  boss.blinkOriginX = boss.x;
  boss.blinkOriginY = boss.y;
  boss.blinkSlashTimerMs = 460;
  boss.teleporting = true;
  boss.teleportTimerMs = 460;
  boss.teleportTarget = tp;
  spawnParticleBurst(state, boss.x, boss.y, 0xc084fc, 20, 3.4, 4.2, 22);
}

function fireRicochetSalvo(state: GameState, boss: BossEntity): void {
  boss.skillChargeTimerMs = 340;
  const baseAngle = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
  const armCount = 4 + boss.phase;
  const dmg = getBossDamage(boss, 12);
  for (let i = 0; i < armCount; i++) {
    const offset = (i - (armCount - 1) / 2) * 0.42;
    for (let wave = 0; wave < 2; wave++) {
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle: baseAngle + offset,
        delayMs: 120 + wave * 180,
        color: '#fbbf24',
        hex: 0xfbbf24,
        damage: dmg,
        speed: 4.5 + wave * 0.4,
        visualStyle: 'bolt',
        bounces: 1,
      });
    }
  }
}

function executeBossSkill(state: GameState, boss: BossEntity, bus: EventBus, forcedAttack?: string): void {
  const attack = forcedAttack ?? drawNextBossAttack(boss);
  const baseAngle = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
  const dmg = (n: number) => getBossDamage(boss, n);
  const hasOverclockBounce = boss.mutations.includes('SOLAR_OVERCLOCK') ? 1 : 0;

  const pDist = Math.hypot(state.player.x - boss.x, state.player.y - boss.y);
  const leadTime = Math.min(28, pDist / 4.5) * 0.65;
  const leadAngle = Math.atan2(
    state.player.y + state.player.vy * leadTime - boss.y,
    state.player.x + state.player.vx * leadTime - boss.x
  );

  if (attack === 'orbitalBarrage') {
    spawnOrbitalBarrage(state, boss);
  } else if (attack === 'laserCarousel') {
    startLaserCarousel(state, boss, baseAngle);
  } else if (attack === 'aegisPylons') {
    deployAegisPylons(state, boss);
  } else if (attack === 'mirageSplit') {
    deployMirageClones(state, boss);
  } else if (attack === 'gravityVortex') {
    spawnGravityVortex(state, boss);
  } else if (attack === 'chronoAmbush') {
    startChronoAmbush(state, boss);
  } else if (attack === 'ricochetSalvo') {
    fireRicochetSalvo(state, boss);
  } else if (attack === 'machineGun') {
    boss.machineGunMaxShots = 10 + boss.phase * 5;
    boss.machineGunShotsFired = 0;
    boss.machineGunTimerMs = 0;
    boss.machineGunActive = true;
  } else if (attack === 'shotgunBlast') {
    for (let w = 0; w < boss.phase; w++) {
      const aimOffset = w % 2 === 0 ? baseAngle : leadAngle;
      for (let i = -3; i <= 3; i++) {
        state.scheduledBullets.push({
          x: boss.x,
          y: boss.y,
          angle: aimOffset + i * 0.145,
          delayMs: w * 320,
          color: w % 2 === 0 ? '#ff3344' : '#ff9933',
          hex: w % 2 === 0 ? 0xff3344 : 0xff9933,
          damage: dmg(14),
          speed: 4.5 + w * 0.25,
          visualStyle: 'bolt',
          bounces: hasOverclockBounce,
        });
      }
    }
  } else if (attack === 'vlsBarrage') {
    boss.skillChargeTimerMs = 380;
    const salvos = 3 + boss.phase;
    for (const side of [-1, 1]) {
      const launchX = boss.x + side * 34;
      const launchY = boss.y + 8;
      for (let i = 0; i < salvos; i++) {
        const arcAngle = leadAngle + side * (0.48 - i * 0.11);
        state.scheduledBullets.push({
          x: launchX,
          y: launchY,
          angle: arcAngle,
          delayMs: 120 + i * 85,
          color: '#ff6622',
          hex: 0xff6622,
          damage: dmg(12),
          speed: 4.4,
          visualStyle: 'needle',
        });
      }
    }
  } else if (attack === 'charge') {
    boss.preChargeTimer = 60;
    boss.chargeProgress = 0;
    boss.chargeCount = boss.phase;
    boss.chargeDirX = Math.cos(baseAngle);
    boss.chargeDirY = Math.sin(baseAngle);
    bus.emit('BOSS_CHARGE_START', { x: boss.x, y: boss.y });
  } else if (attack === 'novaRing') {
    boss.skillChargeTimerMs = 420;
    const count = 18 + boss.phase * 4;
    const gap = Math.floor(Math.random() * count);
    for (let i = 0; i < count; i++) {
      if (i === gap || i === (gap + 1) % count || i === (gap - 1 + count) % count) continue;
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle: (Math.PI * 2 * i) / count,
        delayMs: 280,
        color: '#ff8888',
        hex: 0xff8888,
        damage: dmg(12),
        speed: 4.0,
        visualStyle: 'orb',
      });
    }
  } else if (attack === 'crossBurst') {
    const waves = boss.phase === 3 ? 3 : 2;
    for (let ring = 0; ring < waves; ring++) {
      for (let arm = 0; arm < 4; arm++) {
        for (let i = 0; i < 4; i++) {
          state.scheduledBullets.push({
            x: boss.x,
            y: boss.y,
            angle: baseAngle + (arm * Math.PI) / 2 + ring * 0.25,
            delayMs: ring * 260 + i * 35,
            color: '#ff8822',
            hex: 0xff8822,
            damage: dmg(11),
            speed: 4.2,
            visualStyle: 'bolt',
            bounces: hasOverclockBounce,
          });
        }
      }
    }
  } else if (attack === 'minionSwarm') {
    boss.skillChargeTimerMs = 420;
    const count = 2 + boss.phase;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const off = computeOffscreenSpawnPoint(state, ang, (i % 2) * 45);
      const targetPt = computePerimeterBandPoint(state, ang, 0.88 + (i % 2) * 0.08);
      const minion = createEnemy(state, 'small', true, { x: off.x, y: off.y }, i, count);
      minion.ingressActive = true;
      minion.ingressTargetX = targetPt.x;
      minion.ingressTargetY = targetPt.y;
      minion.sectorAngle = targetPt.angle;
      minion.faceAngle = Math.atan2(targetPt.y - minion.y, targetPt.x - minion.x);
      minion.maxHp = 180 + boss.phase * 90;
      minion.hp = minion.maxHp;
      state.enemies.push(minion);
      spawnParticleBurst(state, boss.x, boss.y, 0xaa44ff, 8, 2.2, 3.2, 16);
    }
  } else if (attack === 'lotusSpiral') {
    const count = 14 + boss.phase * 6;
    for (let i = 0; i < count; i++) {
      const spinA = (Math.PI * 4 * i) / count;
      const spinB = -(Math.PI * 4 * i) / count + Math.PI / 4;
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle: spinA,
        delayMs: i * 40,
        color: '#ee66ff',
        hex: 0xee66ff,
        damage: dmg(11),
        speed: 4.1,
        visualStyle: 'orb',
      });
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle: spinB,
        delayMs: i * 40,
        color: '#44eeff',
        hex: 0x44eeff,
        damage: dmg(10),
        speed: 3.7,
        visualStyle: 'petal',
      });
    }
  } else if (attack === 'homingOrbs') {
    boss.skillChargeTimerMs = 420;
    const count = boss.phase === 3 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const orbPt = clampPointToStorm(
        boss.x + (Math.random() - 0.5) * 120,
        boss.y + (Math.random() - 0.5) * 120,
        state.stormRing,
        50
      );
      boss.mines.push({
        id: nextId(state),
        x: orbPt.x,
        y: orbPt.y,
        timerMs: 4200,
        maxTimerMs: 4200,
        pulse: 0,
        homing: true,
        color: '#cc44ff',
        hex: 0xcc44ff,
      });
    }
  } else if (attack === 'flowerPetals') {
    const count = 12 + boss.phase * 8;
    const span = Math.min(540, state.stormRing.radius * 0.72);
    for (let i = 0; i < count; i++) {
      state.scheduledBullets.push({
        x: state.player.x + (Math.random() - 0.5) * 2 * span,
        y: state.player.y - 340,
        angle: Math.PI / 2 + (Math.random() - 0.5) * 0.2,
        delayMs: i * 58,
        color: '#ff55ee',
        hex: 0xff55ee,
        damage: dmg(12),
        speed: 4.2,
        visualStyle: 'petal',
      });
    }
  } else if (attack === 'waveAttack') {
    const half = 4 + boss.phase * 2;
    const waves = boss.phase >= 2 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      for (let i = -half; i <= half; i++) {
        state.scheduledBullets.push({
          x: boss.x,
          y: boss.y,
          angle: baseAngle + i * 0.1,
          delayMs: Math.abs(i) * 42 + w * 360,
          color: '#33eeff',
          hex: 0x33eeff,
          damage: dmg(11),
          speed: 4.3,
          visualStyle: 'orb',
        });
      }
    }
  } else if (attack === 'strategicMines') {
    boss.skillChargeTimerMs = 420;
    const count = 3 + boss.phase * 2;
    for (let i = 0; i < count; i++) {
      const mPt = clampPointToStorm(
        state.player.x + (Math.random() - 0.5) * 360,
        state.player.y + (Math.random() - 0.5) * 320,
        state.stormRing,
        60
      );
      boss.mines.push({
        id: nextId(state),
        x: mPt.x,
        y: mPt.y,
        timerMs: 4800,
        maxTimerMs: 4800,
        pulse: 0,
        homing: false,
        color: '#ffcc22',
        hex: 0xffcc22,
      });
    }
  } else if (attack === 'deathRay') {
    boss.laserCharging = true;
    boss.laserBeamCount = 1;
    boss.laserSpinSpeed = 0;
    boss.laserAngle = baseAngle;
    boss.laserTimerMs = Math.max(650, 1050 - boss.phase * 140);
  } else if (attack === 'gridLock') {
    const lines = boss.phase >= 2 ? 2 : 1;
    for (let l = -lines; l <= lines; l++) {
      const offY = l * 110;
      const offX = l * 140;
      for (let i = 0; i < 8; i++) {
        state.scheduledBullets.push({
          x: boss.x,
          y: boss.y + offY,
          angle: 0,
          delayMs: i * 42,
          color: '#ffee22',
          hex: 0xffee22,
          damage: dmg(12),
          speed: 4.2,
          visualStyle: 'needle',
        });
        state.scheduledBullets.push({
          x: boss.x,
          y: boss.y + offY,
          angle: Math.PI,
          delayMs: i * 42,
          color: '#ffee22',
          hex: 0xffee22,
          damage: dmg(12),
          speed: 4.2,
          visualStyle: 'needle',
        });
        state.scheduledBullets.push({
          x: boss.x + offX,
          y: boss.y,
          angle: Math.PI / 2,
          delayMs: i * 42,
          color: '#ffcc22',
          hex: 0xffcc22,
          damage: dmg(12),
          speed: 4.2,
          visualStyle: 'needle',
        });
        state.scheduledBullets.push({
          x: boss.x + offX,
          y: boss.y,
          angle: -Math.PI / 2,
          delayMs: i * 42,
          color: '#ffcc22',
          hex: 0xffcc22,
          damage: dmg(12),
          speed: 4.2,
          visualStyle: 'needle',
        });
      }
    }
  } else if (attack === 'sniperShot') {
    boss.sniperMaxShots = 1 + boss.phase;
    boss.sniperShotsFired = 0;
    boss.sniperTimerMs = 420;
    boss.sniperActive = true;
  } else if (attack === 'matrixRings') {
    boss.skillChargeTimerMs = 420;
    for (let r = 0; r < boss.phase; r++) {
      const count = 16 + boss.phase * 4;
      const gap = Math.floor(Math.random() * count);
      const isAlt = r % 2 === 1;
      for (let i = 0; i < count; i++) {
        if (i === gap || i === (gap + 1) % count || i === (gap - 1 + count) % count) continue;
        state.scheduledBullets.push({
          x: boss.x,
          y: boss.y,
          angle: (Math.PI * 2 * i) / count + (isAlt ? Math.PI / count : 0),
          delayMs: r * 420 + 200,
          color: isAlt ? '#44eeff' : '#ffee33',
          hex: isAlt ? 0x44eeff : 0xffee33,
          damage: dmg(11),
          speed: isAlt ? 3.7 : 4.4,
          visualStyle: isAlt ? 'orb' : 'needle',
        });
      }
    }
  } else if (attack === 'serpentWhip') {
    // Leviathan: lunge across the room while every spine segment vents plasma sideways
    boss.preChargeTimer = 38;
    boss.chargeProgress = 0;
    boss.chargeCount = Math.min(2, boss.phase);
    boss.chargeDirX = Math.cos(leadAngle);
    boss.chargeDirY = Math.sin(leadAngle);
    bus.emit('BOSS_CHARGE_START', { x: boss.x, y: boss.y });
    boss.segments.forEach((seg, idx) => {
      for (const side of [-1, 1]) {
        state.scheduledBullets.push({
          x: seg.x,
          y: seg.y,
          angle: seg.angle + (side * Math.PI) / 2,
          delayMs: 140 + idx * 75,
          color: '#10f5a8',
          hex: 0x10f5a8,
          damage: dmg(11),
          speed: 3.9,
          visualStyle: 'orb',
        });
      }
    });
  } else if (attack === 'venomCoil') {
    // Leviathan: cascade volley firing tail-to-head so the aim sweeps across your lane
    boss.skillChargeTimerMs = 380;
    const sources = [...[...boss.segments].reverse(), { x: boss.x, y: boss.y, angle: boss.faceAngle, radius: boss.radius }];
    sources.forEach((src, idx) => {
      const aim = Math.atan2(state.player.y - src.y, state.player.x - src.x);
      for (const spread of [-0.18, 0, 0.18]) {
        state.scheduledBullets.push({
          x: src.x,
          y: src.y,
          angle: aim + spread,
          delayMs: idx * 70,
          color: spread === 0 ? '#34f5c5' : '#10f5a8',
          hex: spread === 0 ? 0x34f5c5 : 0x10f5a8,
          damage: dmg(10),
          speed: 4.1 + idx * 0.08,
          visualStyle: spread === 0 ? 'needle' : 'orb',
          bounces: hasOverclockBounce,
        });
      }
    });
  } else if (attack === 'fangStrike') {
    // Leviathan: twin converging acid fangs trying to pincer you
    boss.skillChargeTimerMs = 340;
    const volleys = 1 + boss.phase;
    for (let v = 0; v < volleys; v++) {
      for (const side of [-1, 1]) {
        const perp = leadAngle + (side * Math.PI) / 2;
        const fx = boss.x + Math.cos(perp) * 26;
        const fy = boss.y + Math.sin(perp) * 26;
        for (const offset of [-0.1, 0, 0.1]) {
          state.scheduledBullets.push({
            x: fx,
            y: fy,
            angle: leadAngle - side * 0.08 + offset,
            delayMs: v * 260 + 90,
            color: '#2ef5b2',
            hex: 0x2ef5b2,
            damage: dmg(12),
            speed: 5.0 + v * 0.25,
            visualStyle: 'needle',
          });
        }
      }
    }
  } else if (attack === 'tetherSlice') {
    // Gemini: stretch a clothesline beam of plasma between Alpha and Omega
    if (boss.twin) {
      boss.twin.tetherChargingMs = Math.max(620, 920 - boss.phase * 90);
      boss.twin.tetherActiveMs = 0;
      boss.skillChargeTimerMs = 560;
      spawnShockwave(state, boss.x, boss.y, 120, 0x38e8ff, 18);
      spawnShockwave(state, boss.twin.x, boss.twin.y, 120, 0xff2e88, 18);
      spawnFloatingText(state, (boss.x + boss.twin.x) * 0.5, (boss.y + boss.twin.y) * 0.5 - 24, 'PLASMA TETHER!', '#ff55cc', 1.25, 42);
    } else {
      fireRicochetSalvo(state, boss);
    }
  } else if (attack === 'twinPincer') {
    // Gemini: cyan + magenta crossfire from opposite sides of the arena
    boss.skillChargeTimerMs = 360;
    const waves = boss.phase >= 2 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      for (let i = -2; i <= 2; i++) {
        state.scheduledBullets.push({
          x: boss.x,
          y: boss.y,
          angle: leadAngle + i * 0.16,
          delayMs: w * 310 + Math.abs(i) * 35,
          color: '#38e8ff',
          hex: 0x38e8ff,
          damage: dmg(11),
          speed: 4.5,
          visualStyle: 'bolt',
          bounces: hasOverclockBounce,
        });
      }
      if (boss.twin) {
        const twinAim = Math.atan2(state.player.y - boss.twin.y, state.player.x - boss.twin.x);
        for (let i = -2; i <= 2; i++) {
          state.scheduledBullets.push({
            x: boss.twin.x,
            y: boss.twin.y,
            angle: twinAim + i * 0.16,
            delayMs: w * 310 + 90 + Math.abs(i) * 35,
            color: '#ff2e88',
            hex: 0xff2e88,
            damage: dmg(11),
            speed: 4.5,
            visualStyle: 'bolt',
            bounces: hasOverclockBounce,
          });
        }
      }
    }
  } else if (attack === 'twinScissorDash') {
    // Gemini: Alpha charges straight at your cockpit while Omega snipes from across the room
    boss.preChargeTimer = 44;
    boss.chargeProgress = 0;
    boss.chargeCount = 1;
    boss.chargeDirX = Math.cos(baseAngle);
    boss.chargeDirY = Math.sin(baseAngle);
    bus.emit('BOSS_CHARGE_START', { x: boss.x, y: boss.y });
    if (boss.twin) {
      const twinAim = Math.atan2(state.player.y - boss.twin.y, state.player.x - boss.twin.x);
      for (const offset of [-0.25, 0, 0.25]) {
        state.scheduledBullets.push({
          x: boss.twin.x,
          y: boss.twin.y,
          angle: twinAim + offset,
          delayMs: 260,
          color: '#ff2e88',
          hex: 0xff2e88,
          damage: dmg(12),
          speed: 4.8,
          visualStyle: 'needle',
        });
      }
    }
  } else if (attack === 'fortressMortar') {
    // Bastion: paint glowing artillery warnings under you plus a slow ring so you keep moving
    boss.skillChargeTimerMs = 420;
    const p = state.player;
    const zoneCount = 2 + boss.phase;
    const zoneRadius = 78 + boss.phase * 8;
    for (let i = 0; i < zoneCount; i++) {
      const spreadAng = (i / Math.max(1, zoneCount)) * Math.PI * 2 + boss.rotation;
      const ox = i === 0 ? p.vx * 24 : Math.cos(spreadAng) * 125;
      const oy = i === 0 ? p.vy * 24 : Math.sin(spreadAng) * 125;
      const pt = clampPointToStorm(p.x + ox, p.y + oy, state.stormRing, zoneRadius * 0.6);
      boss.hazardZones.push({
        id: nextId(state),
        x: pt.x,
        y: pt.y,
        radius: zoneRadius,
        warningMs: 1080 + i * 150,
        maxWarningMs: 1080 + i * 150,
        detonateFlashMs: 0,
        damage: dmg(19),
        hex: 0xff8c1a,
        detonated: false,
      });
    }
    const ringCount = 8 + boss.phase * 2;
    for (let i = 0; i < ringCount; i++) {
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle: (i / ringCount) * Math.PI * 2 + boss.rotation,
        delayMs: 220,
        color: '#ffaa33',
        hex: 0xffaa33,
        damage: dmg(11),
        speed: 3.7,
        visualStyle: 'orb',
      });
    }
  } else if (attack === 'quadRailCross') {
    // Bastion: 4 rotating rail-cannons sweeping the compass axes
    boss.skillChargeTimerMs = 360;
    const burstLen = 4 + boss.phase;
    for (let arm = 0; arm < 4; arm++) {
      const ang = boss.rotation + (arm * Math.PI) / 2;
      for (let s = 0; s < burstLen; s++) {
        state.scheduledBullets.push({
          x: boss.x + Math.cos(ang) * 28,
          y: boss.y + Math.sin(ang) * 28,
          angle: ang,
          delayMs: 100 + s * 65,
          color: '#ffaa33',
          hex: 0xffaa33,
          damage: dmg(12),
          speed: 5.1,
          visualStyle: 'needle',
          bounces: hasOverclockBounce,
        });
      }
    }
  } else if (attack === 'shatterNova') {
    // Bastion: slow orb ring + fast needle ring, always leaving an honest 3-gap escape lane
    boss.skillChargeTimerMs = 420;
    const count = 16 + boss.phase * 4;
    const gap = Math.floor(Math.random() * count);
    for (let i = 0; i < count; i++) {
      if (i === gap || i === (gap + 1) % count || i === (gap - 1 + count) % count) continue;
      const ang = (Math.PI * 2 * i) / count;
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle: ang,
        delayMs: 220,
        color: '#ff8c1a',
        hex: 0xff8c1a,
        damage: dmg(12),
        speed: 3.6,
        visualStyle: 'orb',
      });
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle: ang + Math.PI / count,
        delayMs: 440,
        color: '#ffdd44',
        hex: 0xffdd44,
        damage: dmg(11),
        speed: 4.7,
        visualStyle: 'needle',
      });
    }
  }
}

// Sub-entity updates: pylons, mirage clones, mortar zones, wells, tail segments, and Gemini twin

function updateBossPylons(state: GameState, boss: BossEntity, dtMs: number): void {
  const dtSec = dtMs / 1000;
  for (const py of boss.pylons) {
    py.angle += dtSec * (0.95 + boss.phase * 0.22);
    py.x = boss.x + Math.cos(py.angle) * py.orbitRadius;
    py.y = boss.y + Math.sin(py.angle) * py.orbitRadius;
    py.hitFlash = Math.max(0, py.hitFlash - dtSec * 4.5);
    py.fireTimerMs -= dtMs;
    if (py.fireTimerMs <= 0) {
      py.fireTimerMs = Math.max(1150, 1900 - boss.phase * 220);
      const ang = Math.atan2(state.player.y - py.y, state.player.x - py.x);
      state.scheduledBullets.push({
        x: py.x,
        y: py.y,
        angle: ang,
        delayMs: 0,
        color: '#34d399',
        hex: 0x34d399,
        damage: getBossDamage(boss, 9),
        speed: 4.1,
        visualStyle: 'orb',
      });
    }
  }
}

function updateBossClones(state: GameState, boss: BossEntity, dtMs: number): void {
  const dtSec = dtMs / 1000;
  const alive: BossClone[] = [];
  for (const cl of boss.clones) {
    cl.lifeMs -= dtMs;
    if (cl.lifeMs <= 0) continue;
    cl.angle += dtSec * 0.65;
    const orbit = 175;
    const targetPt = clampPointToStorm(
      boss.x + Math.cos(cl.angle) * orbit,
      boss.y + Math.sin(cl.angle) * orbit,
      state.stormRing,
      cl.radius + 16
    );
    cl.x += (targetPt.x - cl.x) * Math.min(1, dtSec * 3.5);
    cl.y += (targetPt.y - cl.y) * Math.min(1, dtSec * 3.5);
    cl.hitFlash = Math.max(0, cl.hitFlash - dtSec * 4.5);
    cl.fireTimerMs -= dtMs;
    if (cl.fireTimerMs <= 0) {
      cl.fireTimerMs = 1150;
      const aim = Math.atan2(state.player.y - cl.y, state.player.x - cl.x);
      state.scheduledBullets.push({
        x: cl.x,
        y: cl.y,
        angle: aim,
        delayMs: 0,
        color: '#22d3ee',
        hex: 0x22d3ee,
        damage: getBossDamage(boss, 10),
        speed: 4.4,
        visualStyle: 'bolt',
      });
    }
    alive.push(cl);
  }
  boss.clones = alive;
}

function updateBossHazardZones(
  state: GameState,
  boss: BossEntity,
  bus: EventBus,
  dtMs: number,
  triggerGameOver: () => void
): void {
  const nextZones: BossHazardZone[] = [];
  const p = state.player;
  const isDashing = p.dashActive || state.simTimeMs < p.dashInvulnUntilMs;

  for (const z of boss.hazardZones) {
    if (!z.detonated) {
      z.warningMs -= dtMs;
      if (z.warningMs <= 0) {
        z.detonated = true;
        z.detonateFlashMs = 380;
        addScreenShake(state, 11);
        spawnShockwave(state, z.x, z.y, z.radius * 1.15, z.hex, 22);
        spawnParticleBurst(state, z.x, z.y, z.hex, 24, 5.2, 4.4, 24);
        bus.emit('HAZARD_EXPLODED', { x: z.x, y: z.y, radius: z.radius });
        const dist = Math.hypot(p.x - z.x, p.y - z.y);
        if (!isDashing && dist <= z.radius + p.radius * 0.5) {
          damagePlayer(state, bus, z.damage, true, triggerGameOver);
        }
        // Eject 6 sparks outward along ground perimeter
        for (let i = 0; i < 6; i++) {
          state.scheduledBullets.push({
            x: z.x,
            y: z.y,
            angle: (i / 6) * Math.PI * 2,
            delayMs: 0,
            color: '#fb7185',
            hex: 0xfb7185,
            damage: getBossDamage(boss, 9),
            speed: 3.6,
            visualStyle: 'needle',
          });
        }
      }
      nextZones.push(z);
    } else {
      z.detonateFlashMs -= dtMs;
      if (z.detonateFlashMs > 0) {
        nextZones.push(z);
      }
    }
  }
  boss.hazardZones = nextZones;
}

function updateBossGravityWells(state: GameState, boss: BossEntity, dtMs: number): void {
  const p = state.player;
  const frameScale = dtMs / 16.667;
  const nextWells: BossGravityWell[] = [];

  for (const well of boss.gravityWells) {
    well.lifeMs -= dtMs;
    if (well.lifeMs <= 0) continue;
    well.pulse += 0.08 * frameScale;

    if (!p.dashActive) {
      const dx = well.x - p.x;
      const dy = well.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14 && dist <= well.radius) {
        const pull = well.pullStrength * (1 - dist / well.radius) * frameScale;
        const clamped = clampPointToStorm(
          p.x + (dx / dist) * pull,
          p.y + (dy / dist) * pull,
          state.stormRing,
          -460
        );
        p.x = clamped.x;
        p.y = clamped.y;
      }
    }
    nextWells.push(well);
  }
  boss.gravityWells = nextWells;
}

function updateBossSegments(
  state: GameState,
  boss: BossEntity,
  bus: EventBus,
  triggerGameOver: () => void
): void {
  if (boss.archetype !== 3 || boss.segments.length === 0) return;
  const p = state.player;
  const t = state.simTimeMs * 0.004;
  let leaderX = boss.x;
  let leaderY = boss.y;

  for (let i = 0; i < boss.segments.length; i++) {
    const seg = boss.segments[i];
    const spacing = boss.radius * (i === 0 ? 0.78 : 0.72);
    const dx = leaderX - seg.x;
    const dy = leaderY - seg.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.001) {
      const ang = Math.atan2(dy, dx);
      seg.angle = ang;
      const slither = Math.sin(t + i * 0.85) * (boss.isCharging ? 1.8 : 0.75);
      const perpX = -Math.sin(ang) * slither;
      const perpY = Math.cos(ang) * slither;
      seg.x = leaderX - Math.cos(ang) * spacing + perpX;
      seg.y = leaderY - Math.sin(ang) * spacing + perpY;
    }

    if (Math.hypot(seg.x - p.x, seg.y - p.y) <= seg.radius + p.radius * 0.8) {
      damagePlayer(state, bus, getBossDamage(boss, 16), true, triggerGameOver);
    }

    if (boss.isCharging && boss.chargeProgress % 12 === 0) {
      const side = (i + Math.floor(boss.chargeProgress / 12)) % 2 === 0 ? 1 : -1;
      state.scheduledBullets.push({
        x: seg.x,
        y: seg.y,
        angle: seg.angle + (side * Math.PI) / 2,
        delayMs: 0,
        color: '#10f5a8',
        hex: 0x10f5a8,
        damage: getBossDamage(boss, 10),
        speed: 3.8,
        visualStyle: 'orb',
      });
    }

    leaderX = seg.x;
    leaderY = seg.y;
  }
}

function updateBossTwin(
  state: GameState,
  boss: BossEntity,
  bus: EventBus,
  dtMs: number,
  triggerGameOver: () => void
): void {
  if (boss.archetype !== 4 || !boss.twin) return;
  const twin = boss.twin;
  const p = state.player;
  const ring = state.stormRing;
  const dtSec = dtMs / 1000;

  twin.hitFlash = Math.max(0, twin.hitFlash - dtSec * 4.5);

  let targetX: number;
  let targetY: number;
  if (boss.isCharging) {
    // Mirror across the player so both twins close like a pair of scissors
    const mirrored = clampPointToStorm(
      2 * p.x - boss.x,
      2 * p.y - boss.y,
      ring,
      twin.radius + 16
    );
    targetX = mirrored.x;
    targetY = mirrored.y;
  } else {
    const alphaAng = Math.atan2(boss.y - ring.centerY, boss.x - ring.centerX);
    const sweep =
      twin.tetherActiveMs > 0
        ? Math.PI + Math.sin(state.simTimeMs * 0.0024) * 0.65
        : Math.PI + Math.sin(state.simTimeMs * 0.001) * 0.25;
    const orbitDist = Math.min(260, ring.radius * 0.5);
    const desired = clampPointToStorm(
      ring.centerX + Math.cos(alphaAng + sweep) * orbitDist,
      ring.centerY + Math.sin(alphaAng + sweep) * orbitDist,
      ring,
      twin.radius + 16
    );
    targetX = desired.x;
    targetY = desired.y;
  }

  const followLerp = boss.isCharging ? Math.min(1, dtSec * 9.0) : Math.min(1, dtSec * 3.8);
  twin.x += (targetX - twin.x) * followLerp;
  twin.y += (targetY - twin.y) * followLerp;
  twin.angle = Math.atan2(p.y - twin.y, p.x - twin.x);

  // Bump damage if you try to hug the Omega twin
  if (Math.hypot(twin.x - p.x, twin.y - p.y) <= twin.radius + p.radius * 0.85) {
    damagePlayer(state, bus, getBossDamage(boss, 20), true, triggerGameOver);
  }

  // Charge and fire the twin-hull plasma tether beam
  if (twin.tetherChargingMs > 0) {
    twin.tetherChargingMs = Math.max(0, twin.tetherChargingMs - dtMs);
    if (twin.tetherChargingMs <= 0) {
      twin.tetherActiveMs = 2100 + boss.phase * 280;
      addScreenShake(state, 14);
      bus.emit('BOSS_LASER_FIRE', { x: (boss.x + twin.x) * 0.5, y: (boss.y + twin.y) * 0.5 });
    }
  } else if (twin.tetherActiveMs > 0) {
    twin.tetherActiveMs = Math.max(0, twin.tetherActiveMs - dtMs);
    boss.laserDamageTimerMs = Math.max(0, boss.laserDamageTimerMs - dtMs);
    const isDashing = p.dashActive || state.simTimeMs < p.dashInvulnUntilMs;
    const beamDist = distToSegment(p.x, p.y, boss.x, boss.y, twin.x, twin.y);
    if (!isDashing && beamDist < 26 && boss.laserDamageTimerMs <= 0) {
      boss.laserDamageTimerMs = 340;
      damagePlayer(state, bus, getBossDamage(boss, 12 + boss.phase * 3), true, triggerGameOver);
    }
  }
}

function moveBossWithPersonality(state: GameState, boss: BossEntity): void {
  let stageSpeedScale = boss.transformStage === 3 ? 1.38 : boss.transformStage === 2 ? 1.18 : 1.0;
  if (boss.archetype === 5) {
    // Bastion gets faster and angrier every time you pop off an armor plate
    stageSpeedScale = boss.armorPlates >= 3 ? 0.78 : boss.armorPlates === 2 ? 1.4 : 1.85;
  }
  const finalSpd = (boss.state === 'RESTING' ? boss.speed * 0.35 : boss.speed) * stageSpeedScale;
  const t = state.simTimeMs * 0.0006;
  const ring = state.stormRing;
  const awayAng = Math.atan2(ring.centerY - state.player.y, ring.centerX - state.player.x);

  let orbitDist = Math.min(260, ring.radius * 0.48);
  let targetAngle = awayAng + Math.sin(t) * 0.85;
  if (boss.archetype === 0) {
    // Destroyer bullies closer into mid-range
    orbitDist = Math.min(210, ring.radius * 0.38);
    targetAngle = awayAng + Math.sin(t * 1.45) * 1.15;
  } else if (boss.archetype === 1) {
    // Summoner lazily orbits the perimeter while throwing minions at the problem
    orbitDist = Math.min(290, ring.radius * 0.54);
    targetAngle = t * 0.75 + Math.cos(t * 1.2) * 0.55;
  } else if (boss.archetype === 3) {
    // Leviathan weaves figure-eights so its segmented tail stays busy
    orbitDist = Math.min(235, ring.radius * 0.44);
    targetAngle = t * 1.12 + Math.sin(t * 2.1) * 0.9;
  } else if (boss.archetype === 4) {
    // Gemini Alpha plays foil on the far side of Omega
    orbitDist = Math.min(255, ring.radius * 0.48);
    targetAngle = awayAng + Math.sin(t * 0.95) * 1.25;
  } else if (boss.archetype === 5) {
    // Bastion squats mid-ring behind its armor, then goes berserk once stripped naked
    orbitDist = boss.armorPlates === 0 ? Math.min(220, ring.radius * 0.42) : Math.min(165, ring.radius * 0.3);
    targetAngle = boss.armorPlates === 0 ? t * 1.35 + Math.sin(t * 2.0) * 0.8 : awayAng + Math.sin(t * 0.7) * 0.6;
  }

  const targetX = ring.centerX + Math.cos(targetAngle) * orbitDist;
  const targetY = ring.centerY + Math.sin(targetAngle) * orbitDist;
  const tx = targetX - boss.x;
  const ty = targetY - boss.y;
  const tDist = Math.hypot(tx, ty);
  if (tDist > 10) {
    boss.x += (tx / tDist) * finalSpd * 1.45;
    boss.y += (ty / tDist) * finalSpd * 1.45;
  }

  const pdx = state.player.x - boss.x;
  const pdy = state.player.y - boss.y;
  const pDist = Math.hypot(pdx, pdy);
  const keepBack = boss.archetype === 0 || (boss.archetype === 5 && boss.armorPlates === 0) ? 175 : 225;
  if (pDist < keepBack && pDist > 1) {
    boss.x -= (pdx / pDist) * finalSpd * 2.1;
    boss.y -= (pdy / pDist) * finalSpd * 2.1;
  }

  const bounded = clampPointToStorm(boss.x, boss.y, ring, boss.radius + 16);
  boss.x = bounded.x;
  boss.y = bounded.y;
}

export function updateBossSystem(
  state: GameState,
  bus: EventBus,
  dtMs: number,
  triggerGameOver: () => void
): void {
  const boss = state.boss;
  if (!boss) return;

  if (boss.entering) {
    updateBossEntry(state, boss, bus);
    return;
  }

  if (boss.dying) {
    updateBossDeath(state, boss, bus);
    return;
  }

  boss.displayHp += (boss.hp - boss.displayHp) * 0.08;
  boss.restProgress +=
    ((boss.state === 'RESTING' || boss.staggerTimerMs > 0 ? 1 : 0) - boss.restProgress) * 0.08;
  boss.currentPhaseLevel += (boss.phase - 1 - boss.currentPhaseLevel) * 0.02;
  boss.breathe += 0.035;
  boss.attackFlash *= 0.86;
  boss.hitFlash *= 0.88;
  boss.bodyRecoil *= 0.88;
  boss.skillChargeTimerMs = Math.max(0, boss.skillChargeTimerMs - dtMs);
  boss.blinkSlashTimerMs = Math.max(0, boss.blinkSlashTimerMs - dtMs);
  boss.faceAngle = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);

  const coreTarget = boss.laserFiring
    ? 1.0
    : boss.laserCharging || boss.preChargeTimer > 0 || boss.skillChargeTimerMs > 0
      ? 0.85
      : boss.machineGunActive || boss.sniperActive
        ? 0.75
        : boss.state === 'RESTING' || boss.staggerTimerMs > 0
          ? 0.15
          : 0.4;
  boss.coreEnergy += (coreTarget - boss.coreEnergy) * 0.08;

  const windupTarget =
    boss.machineGunActive || boss.sniperActive || boss.laserFiring
      ? 1
      : boss.laserCharging || boss.preChargeTimer > 0 || boss.skillChargeTimerMs > 0
        ? 0.65
        : 0;
  boss.attackWindup += (windupTarget - boss.attackWindup) * 0.1;

  // 3-stage Boss glow-up: 60% HP -> Form II, 30% HP -> Form III (no one escapes free)
  const hpPct = boss.hp / boss.maxHp;
  const targetPhase: 1 | 2 | 3 = hpPct <= 0.3 ? 3 : hpPct <= 0.6 ? 2 : 1;
  if (targetPhase > boss.phase) {
    boss.phase = targetPhase;
    boss.transformStage = targetPhase;
    boss.transitioning = true;
    boss.transitionTimer = targetPhase === 3 ? 96 : 84;
    clearBossWeaponStates(boss, state);
    boss.maxConsecutiveAttacks = 2 + boss.phase;

    if (boss.phase === 2) {
      const bonusMove =
        boss.archetype === 0 || boss.archetype === 5
          ? 'orbitalBarrage'
          : boss.archetype === 4
            ? 'tetherSlice'
            : boss.archetype === 3
              ? 'serpentWhip'
              : 'laserCarousel';
      if (!boss.attackPool.includes(bonusMove)) {
        boss.attackPool.push(bonusMove);
      }
      const sig = BOSS_MUTATIONS[boss.mutations[0]]?.signatureAttack;
      if (sig) boss.attackDeck.push(sig);
      spawnFloatingText(state, boss.x, boss.y - 34, 'FORM II · UNLEASHED!', boss.color, 1.3, 52);

      // Bastion blows off two outer shields at 60% HP so you know it took that personally
      if (boss.archetype === 5 && boss.armorPlates > 2) {
        boss.armorPlates = 2;
        spawnShockwave(state, boss.x, boss.y, 230, 0xff9922, 26);
        spawnFloatingText(state, boss.x, boss.y - 58, 'PLATES SHATTERED! [2/4]', '#ffaa33', 1.35, 56);
        bus.emit('SHIELD_BROKEN', { x: boss.x, y: boss.y, major: true });
        for (let i = 0; i < 12; i++) {
          state.scheduledBullets.push({
            x: boss.x,
            y: boss.y,
            angle: (i / 12) * Math.PI * 2,
            delayMs: 80,
            color: '#ff9922',
            hex: 0xff9922,
            damage: getBossDamage(boss, 11),
            speed: 4.3,
            visualStyle: 'bolt',
          });
        }
      }
    }

    if (boss.phase === 3) {
      boss.enraged = true;
      spawnFloatingText(state, boss.x, boss.y - 34, 'FORM III · APEX OVERDRIVE!', '#ffdd55', 1.4, 58);

      // Bastion drops the rest of its heavy armor at 30% HP to chase you down naked and glowing
      if (boss.archetype === 5 && boss.armorPlates > 0) {
        boss.armorPlates = 0;
        spawnShockwave(state, boss.x, boss.y, 270, 0xffdd44, 30);
        spawnFloatingText(state, boss.x, boss.y - 62, 'CORE EXPOSED! +20% DMG', '#ffdd55', 1.4, 62);
        bus.emit('SHIELD_BROKEN', { x: boss.x, y: boss.y, major: true });
        for (let i = 0; i < 18; i++) {
          state.scheduledBullets.push({
            x: boss.x,
            y: boss.y,
            angle: (i / 18) * Math.PI * 2,
            delayMs: 60,
            color: '#ffcc33',
            hex: 0xffcc33,
            damage: getBossDamage(boss, 12),
            speed: 4.8,
            visualStyle: 'needle',
          });
        }
      }

      // Surprise! Phase 3 bolts on a second boss mutator mid-fight
      if (boss.mutations.length < 2) {
        const evolved = rollBossMutations(1, boss.mutations);
        if (evolved.length > 0) {
          const mutId = evolved[0];
          boss.mutations.push(mutId);
          const sigAtk = BOSS_MUTATIONS[mutId].signatureAttack;
          if (!boss.attackPool.includes(sigAtk)) boss.attackPool.push(sigAtk);
          if (mutId === 'SOLAR_OVERCLOCK' && !boss.attackPool.includes('ricochetSalvo')) {
            boss.attackPool.push('ricochetSalvo');
          }
          boss.attackDeck.push(sigAtk);
          spawnFloatingText(
            state,
            boss.x,
            boss.y - 84,
            `EVOLVED: ${BOSS_MUTATIONS[mutId].shortEn}!`,
            BOSS_MUTATIONS[mutId].accent,
            1.35,
            60
          );
        }
      }
    }

    // Leviathan ripples shockwaves all the way down its tail when evolving
    if (boss.archetype === 3 && boss.segments.length > 0) {
      boss.segments.forEach((seg, idx) => {
        spawnShockwave(state, seg.x, seg.y, 70 + idx * 8, boss.hex, 18);
        spawnParticleBurst(state, seg.x, seg.y, 0x10f5a8, 7, 3.0, 3.6, 20);
      });
    }

    addScreenShake(state, 14 + boss.phase * 3);
    spawnShockwave(state, boss.x, boss.y, 200, boss.hex, 26);
    spawnParticleBurst(state, boss.x, boss.y, boss.hex, 30, 5, 4.5, 30);
    bus.emit('BOSS_PHASE_CHANGED', {
      archetype: boss.archetype,
      phase: boss.phase as 2 | 3,
      x: boss.x,
      y: boss.y,
      hex: boss.hex,
    });
  }
  if (boss.transitioning) {
    boss.transitionTimer--;
    if (boss.transitionTimer <= 0) boss.transitioning = false;
  }

  // Kick off the smooth 3D mesh transformation right away
  boss.transformStage = boss.phase;
  boss.transformBlend += (boss.phase - 1 - boss.transformBlend) * 0.06;

  // Sub-entities never get to take a coffee break
  updateBossPylons(state, boss, dtMs);
  updateBossClones(state, boss, dtMs);
  updateBossHazardZones(state, boss, bus, dtMs, triggerGameOver);
  updateBossGravityWells(state, boss, dtMs);
  updateBossSegments(state, boss, bus, triggerGameOver);
  updateBossTwin(state, boss, bus, dtMs, triggerGameOver);

  // Stagger pauses main boss weapons for 3s so breaking pylons pays off properly
  if (boss.staggerTimerMs > 0) {
    boss.staggerTimerMs = Math.max(0, boss.staggerTimerMs - dtMs);
    boss.rotation += 0.004;
    return;
  }

  // Rapid minigun spray
  if (boss.machineGunActive) {
    boss.machineGunTimerMs -= dtMs;
    if (boss.machineGunTimerMs <= 0) {
      boss.machineGunTimerMs = 85;
      const angle = boss.faceAngle + (Math.random() - 0.5) * 0.22;
      state.scheduledBullets.push({
        x: boss.x,
        y: boss.y,
        angle,
        delayMs: 0,
        color: '#ff3344',
        hex: 0xff3344,
        damage: getBossDamage(boss, 10),
        speed: 4.8,
        visualStyle: 'bolt',
      });
      boss.attackFlash = 1;
      boss.bodyRecoil = 0.5;
      boss.machineGunShotsFired++;
      if (boss.machineGunShotsFired >= boss.machineGunMaxShots) {
        boss.machineGunActive = false;
      }
    }
  }

  // High-velocity sniper poke
  if (boss.sniperActive) {
    boss.sniperTimerMs -= dtMs;
    if (boss.sniperTimerMs <= 0) {
      boss.sniperTimerMs = 340;
      const angle = boss.faceAngle + (Math.random() - 0.5) * 0.04;
      state.bullets.push({
        id: nextId(state),
        x: boss.x,
        y: boss.y,
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        speed: 9.5 + boss.phase * 1.4,
        radius: 6.5,
        damage: getBossDamage(boss, 22),
        color: '#ffffff',
        hex: 0xffffff,
        isEnemy: true,
        pierceLeft: 0,
        hitIds: new Set<number>(),
        age: 0,
        bounces: 0,
        isCritVisual: true,
        visualStyle: 'needle',
      });
      addScreenShake(state, 10);
      boss.attackFlash = 1;
      boss.bodyRecoil = 1;
      boss.sniperShotsFired++;
      bus.emit('SNIPER_FIRED', { x: boss.x, y: boss.y, isBoss: true });
      if (boss.sniperShotsFired >= boss.sniperMaxShots) {
        boss.sniperActive = false;
      }
    }
  }

  // Freight-train bull rush
  if (boss.preChargeTimer > 0) {
    boss.preChargeTimer--;
    const dx = state.player.x - boss.x;
    const dy = state.player.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      boss.chargeDirX = dx / d;
      boss.chargeDirY = dy / d;
    }
    if (boss.preChargeTimer % 6 === 0) {
      spawnParticleBurst(state, boss.x, boss.y, 0xff2222, 4, 2.5, 4, 16);
    }
    if (boss.preChargeTimer <= 0) {
      boss.isCharging = true;
      addScreenShake(state, 12);
    }
  } else if (boss.isCharging) {
    boss.chargeProgress++;
    if (boss.chargeProgress <= 32) {
      const dashSpd = 15 + boss.phase * 2.2;
      boss.x += boss.chargeDirX * dashSpd;
      boss.y += boss.chargeDirY * dashSpd;

      const ring = state.stormRing;
      const maxR = Math.max(90, ring.radius - boss.radius);
      const rdx = boss.x - ring.centerX;
      const rdy = boss.y - ring.centerY;
      const rDist = Math.hypot(rdx, rdy);
      if (rDist >= maxR && rDist > 0.001) {
        const nx = rdx / rDist;
        const ny = rdy / rDist;
        const dot = boss.chargeDirX * nx + boss.chargeDirY * ny;
        if (dot > 0) {
          boss.chargeDirX -= 2 * dot * nx;
          boss.chargeDirY -= 2 * dot * ny;
        }
        boss.x = ring.centerX + nx * maxR;
        boss.y = ring.centerY + ny * maxR;
        addScreenShake(state, 8);
      }

      if (boss.chargeProgress % 2 === 0) {
        spawnParticleBurst(state, boss.x, boss.y, boss.hex, 3, 1.5, 4, 14);
      }

      const d = Math.hypot(boss.x - state.player.x, boss.y - state.player.y);
      if (d < boss.radius + state.player.radius * 0.9) {
        damagePlayer(state, bus, getBossDamage(boss, 24), true, triggerGameOver);
      }
    } else {
      boss.chargeCount--;
      if (boss.chargeCount > 0) {
        boss.chargeProgress = 0;
        boss.preChargeTimer = 46;
        boss.isCharging = false;
      } else {
        boss.isCharging = false;
        boss.chargeProgress = 0;
      }
    }
  }

  // Patrol around inside the locked arena ring
  if (!boss.isCharging && !boss.teleporting) {
    moveBossWithPersonality(state, boss);
  }

  boss.rotation += boss.state === 'RESTING' ? 0.008 : boss.enraged ? 0.055 : 0.022;

  // Laser beam sweep or multi-arm carousel
  if (boss.laserCharging) {
    boss.laserTimerMs -= dtMs;
    if (boss.laserBeamCount <= 1 && boss.laserTimerMs > 340) {
      let diff = boss.faceAngle - boss.laserAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      boss.laserAngle += diff * 0.16;
    }
    if (boss.laserTimerMs <= 0) {
      boss.laserCharging = false;
      boss.laserFiring = true;
      boss.laserTimerMs = boss.laserBeamCount > 1 ? 2600 : 2200;
      addScreenShake(state, 16);
      bus.emit('BOSS_LASER_FIRE', { x: boss.x, y: boss.y });
    }
  } else if (boss.laserFiring) {
    boss.laserTimerMs -= dtMs;
    boss.laserDamageTimerMs = Math.max(0, boss.laserDamageTimerMs - dtMs);

    if (boss.laserSpinSpeed !== 0) {
      boss.laserAngle += boss.laserSpinSpeed * (dtMs / 16.667);
    } else {
      let diff = boss.faceAngle - boss.laserAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const sweepSpeed = 0.004 + boss.phase * 0.0045;
      boss.laserAngle += Math.sign(diff) * Math.min(Math.abs(diff), sweepSpeed);
    }

    const beams = Math.max(1, boss.laserBeamCount);
    let minBeamDist = Infinity;
    for (let k = 0; k < beams; k++) {
      const ang = boss.laserAngle + (k * Math.PI * 2) / beams;
      const lx = boss.x + Math.cos(ang) * 1200;
      const ly = boss.y + Math.sin(ang) * 1200;
      const d = distToSegment(state.player.x, state.player.y, boss.x, boss.y, lx, ly);
      if (d < minBeamDist) minBeamDist = d;
    }
    if (minBeamDist < 28 && boss.laserDamageTimerMs <= 0) {
      boss.laserDamageTimerMs = 360;
      damagePlayer(state, bus, getBossDamage(boss, 8 + boss.phase * 3), true, triggerGameOver);
    }

    if (boss.laserTimerMs <= 0) {
      boss.laserFiring = false;
      boss.laserBeamCount = 1;
      boss.laserSpinSpeed = 0;
    }
  }

  // Floating mines & homing void orbs
  const nextMines: typeof boss.mines = [];
  for (const m of boss.mines) {
    m.timerMs -= dtMs;
    m.pulse += 0.12;
    if (m.homing) {
      const dx = state.player.x - m.x;
      const dy = state.player.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d > 10) {
        m.x += (dx / d) * 1.65;
        m.y += (dy / d) * 1.65;
      }
    }

    const pDist = Math.hypot(state.player.x - m.x, state.player.y - m.y);
    if (m.timerMs <= 0 || pDist < 28) {
      spawnShockwave(state, m.x, m.y, 92, m.hex, 20);
      spawnParticleBurst(state, m.x, m.y, m.hex, 20, 4, 4, 24);
      addScreenShake(state, 9);
      bus.emit('HAZARD_EXPLODED', { x: m.x, y: m.y, radius: 92 });
      if (pDist < 88) {
        damagePlayer(state, bus, getBossDamage(boss, 14), true, triggerGameOver);
      }
      for (let i = 0; i < 8; i++) {
        state.scheduledBullets.push({
          x: m.x,
          y: m.y,
          angle: (i / 8) * Math.PI * 2,
          delayMs: 0,
          color: m.color,
          hex: m.hex,
          damage: getBossDamage(boss, 10),
          speed: 3.8,
        });
      }
    } else {
      nextMines.push(m);
    }
  }
  boss.mines = nextMines;

  // Resolve teleport ambush slash
  if (boss.teleporting) {
    boss.teleportTimerMs -= dtMs;
    if (boss.teleportTimerMs <= 0 && boss.teleportTarget) {
      const isChronoSlash = boss.mutations.includes('CHRONO_STALKER') || boss.blinkSlashTimerMs > 0;
      boss.x = boss.teleportTarget.x;
      boss.y = boss.teleportTarget.y;
      boss.teleportTarget = null;
      boss.teleporting = false;
      addScreenShake(state, 12);
      spawnShockwave(state, boss.x, boss.y, 125, isChronoSlash ? 0xc084fc : boss.hex, 22);
      spawnParticleBurst(state, boss.x, boss.y, isChronoSlash ? 0xc084fc : boss.hex, 28, 4.2, 4.4, 24);
      bus.emit('ENTITY_TELEPORTED', { x: boss.x, y: boss.y, isBoss: true });

      if (isChronoSlash) {
        const aim = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
        for (let i = -3; i <= 3; i++) {
          state.scheduledBullets.push({
            x: boss.x,
            y: boss.y,
            angle: aim + i * 0.16,
            delayMs: Math.abs(i) * 28,
            color: '#c084fc',
            hex: 0xc084fc,
            damage: getBossDamage(boss, 12),
            speed: 5.1,
            visualStyle: 'needle',
          });
        }
      }
    }
  }

  // Keep the attack cadence brisk instead of waiting for every stray bullet to despawn
  const busy =
    boss.transitioning ||
    boss.preChargeTimer > 0 ||
    boss.isCharging ||
    boss.machineGunActive ||
    boss.sniperActive ||
    boss.laserCharging ||
    boss.laserFiring ||
    boss.teleporting ||
    (boss.twin !== null && (boss.twin.tetherChargingMs > 0 || boss.twin.tetherActiveMs > 0));

  const hasChrono = boss.mutations.includes('CHRONO_STALKER');
  const tempoScale = hasChrono ? 0.78 : 1.0;

  if (boss.state === 'IDLE' && !busy) {
    boss.attackCooldownMs -= dtMs;
    if (boss.attackCooldownMs <= 0) {
      if (boss.consecutiveAttacks < boss.maxConsecutiveAttacks) {
        boss.state = 'ATTACKING';
        executeBossSkill(state, boss, bus);
        boss.consecutiveAttacks++;
      } else {
        boss.state = 'WAITING_CLEAR_REST';
      }
    }
  } else if (boss.state === 'ATTACKING') {
    if (!busy) {
      boss.state = 'IDLE';
      boss.attackCooldownMs = Math.round(
        Math.max(260, 680 - boss.phase * 120) * tempoScale
      );
    }
  } else if (boss.state === 'WAITING_CLEAR_SKILL') {
    if (!busy) {
      boss.state = 'IDLE';
      boss.attackCooldownMs = Math.round(
        Math.max(260, 680 - boss.phase * 120) * tempoScale
      );
    }
  } else if (boss.state === 'WAITING_CLEAR_REST') {
    if (!busy) {
      boss.state = 'RESTING';
      boss.restTimerMs = Math.round((950 + Math.random() * 400) * tempoScale);
    }
  } else if (boss.state === 'RESTING') {
    boss.restTimerMs -= dtMs;
    if (boss.restTimerMs <= 0) {
      boss.state = 'IDLE';
      boss.consecutiveAttacks = 0;
      boss.maxConsecutiveAttacks = 3 + boss.phase;
      boss.attackCooldownMs = Math.round(300 * tempoScale);
    }
  }
}
