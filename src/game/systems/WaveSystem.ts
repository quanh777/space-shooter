import {
  TUTORIAL_AUTO_START_MS,
  TUTORIAL_HOLD_MS,
  WAVE_REST_MS,
  WAVE_TRANSITION_MS,
} from '../../config/constants';
import type { EventBus } from '../../engine/EventBus';
import {
  clampPointToStorm,
  randomPointInStorm,
  spawnFloatingText,
  spawnParticleBurst,
  spawnShockwave,
} from '../GameState';
import type { EnemyType, GameState, RoomDoorKind, StormRingPhase } from '../types';
import { createBoss } from './BossSystem';
import { createEnemy } from './EnemySystem';
import { openShop } from './ShopSystem';

export function startStormTransition(
  state: GameState,
  toX: number,
  toY: number,
  toRadius: number,
  durationMs: number,
  phase: StormRingPhase
): void {
  const ring = state.stormRing;
  ring.transitionFromX = ring.centerX;
  ring.transitionFromY = ring.centerY;
  ring.transitionFromRadius = ring.radius;
  ring.transitionToX = toX;
  ring.transitionToY = toY;
  ring.transitionToRadius = toRadius;
  ring.targetCenterX = toX;
  ring.targetCenterY = toY;
  ring.transitionElapsedMs = 0;
  ring.transitionDurationMs = Math.max(120, durationMs);
  ring.transitionActive = true;
  ring.phase = phase;
  ring.pulseFlash = 1.0;
}

export const ROOM_STORM_CONFIG: Record<
  RoomDoorKind,
  { startRadius: number; targetRadius: number; shrinkRate: number; tagVi: string; tagEn: string }
> = {
  supply: { startRadius: 620, targetRadius: 500, shrinkRate: 9, tagVi: 'BO HẸP · 620m', tagEn: 'TIGHT · 620m' },
  armory: { startRadius: 720, targetRadius: 560, shrinkRate: 10, tagVi: 'BO GỌN · 720m', tagEn: 'COMPACT · 720m' },
  mutation: { startRadius: 860, targetRadius: 660, shrinkRate: 11, tagVi: 'BO VỪA · 860m', tagEn: 'MEDIUM · 860m' },
  reactor: { startRadius: 980, targetRadius: 740, shrinkRate: 12, tagVi: 'BO LỚN · 980m', tagEn: 'WIDE · 980m' },
  elite: { startRadius: 1180, targetRadius: 860, shrinkRate: 14, tagVi: 'BO RỘNG · 1180m', tagEn: 'VAST · 1180m' },
  boss: { startRadius: 780, targetRadius: 620, shrinkRate: 95, tagVi: 'ĐẤU TRƯỜNG · 620m', tagEn: 'BOSS ARENA · 620m' },
};

export function configureStormRingForRoom(state: GameState, kind: RoomDoorKind): void {
  const ring = state.stormRing;
  const p = state.player;
  const cfg = ROOM_STORM_CONFIG[kind];
  const radMult = state.sectorHazard === 'radiation_zone' ? 0.86 : 1.0;
  const startR = Math.max(440, Math.round(cfg.startRadius * radMult));
  const targetR = Math.max(400, Math.round(cfg.targetRadius * radMult));

  ring.shrinkRate = state.sectorHazard === 'radiation_zone' ? cfg.shrinkRate + 4 : cfg.shrinkRate;
  ring.damagePerSec = state.sectorHazard === 'radiation_zone' || kind === 'boss' ? 18 : 12;

  if (kind === 'boss') {
    ring.bossLocked = true;
    ring.targetRadius = targetR;
    startStormTransition(state, p.x, p.y - 40, targetR, 1250, 'BOSS_LOCK');
  } else {
    ring.bossLocked = false;
    ring.targetRadius = targetR;
    startStormTransition(state, p.x, p.y, startR, 680, 'EXPANDING');
  }
}

export function configureStormRingForWave(state: GameState, waveNum: number): void {
  const ring = state.stormRing;
  const p = state.player;
  const isBossWave = waveNum > 0 && waveNum % 5 === 0;
  if (isBossWave) {
    ring.bossLocked = true;
    ring.targetRadius = 620;
    ring.shrinkRate = 115;
    ring.damagePerSec = 18;
    startStormTransition(state, p.x, p.y - 40, 620, 1650, 'BOSS_LOCK');
  } else {
    ring.bossLocked = false;
    const shiftAng = Math.random() * Math.PI * 2;
    const shiftDist = 110 + Math.random() * 140;
    const nextX = p.x + Math.cos(shiftAng) * shiftDist;
    const nextY = p.y + Math.sin(shiftAng) * shiftDist;
    ring.targetRadius = state.sectorHazard === 'radiation_zone' ? 560 : 740;
    ring.shrinkRate = state.sectorHazard === 'radiation_zone' ? 18 : 11;
    ring.damagePerSec = state.sectorHazard === 'radiation_zone' ? 18 : 12;
    const startR = Math.max(ring.radius, 1140);
    startStormTransition(state, nextX, nextY, startR, WAVE_TRANSITION_MS, 'EXPANDING');
  }
}

export function updateStormRing(state: GameState, dtSec: number): void {
  const ring = state.stormRing;
  ring.pulseFlash = Math.max(0, ring.pulseFlash - dtSec * 1.35);

  if (ring.transitionActive) {
    ring.transitionElapsedMs += dtSec * 1000;
    const t = Math.min(1, ring.transitionElapsedMs / Math.max(1, ring.transitionDurationMs));
    const ease =
      ring.phase === 'EXPANDING'
        ? 1 - Math.pow(1 - t, 3)
        : t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;

    ring.centerX = ring.transitionFromX + (ring.transitionToX - ring.transitionFromX) * ease;
    ring.centerY = ring.transitionFromY + (ring.transitionToY - ring.transitionFromY) * ease;
    ring.radius =
      ring.transitionFromRadius + (ring.transitionToRadius - ring.transitionFromRadius) * ease;

    if (t >= 1) {
      ring.transitionActive = false;
      ring.centerX = ring.transitionToX;
      ring.centerY = ring.transitionToY;
      ring.radius = ring.transitionToRadius;
      ring.phase = ring.bossLocked ? 'BOSS_LOCK' : state.isResting ? 'IDLE' : 'SHRINKING';
    }
    return;
  }

  const centerRate = ring.bossLocked ? 6.5 : 1.2;
  const alpha = Math.min(1, dtSec * centerRate);
  ring.centerX += (ring.targetCenterX - ring.centerX) * alpha;
  ring.centerY += (ring.targetCenterY - ring.centerY) * alpha;

  if (state.isResting || state.waveTransition.active) return;

  const diff = ring.radius - ring.targetRadius;
  if (diff > 0.1) {
    const smoothSpeed = ring.shrinkRate * (0.45 + 0.55 * Math.min(1, diff / 85));
    ring.radius = Math.max(ring.targetRadius, ring.radius - smoothSpeed * dtSec);
    if (!ring.bossLocked) ring.phase = 'SHRINKING';
  } else if (diff < -0.1) {
    const expandSpeed = Math.max(160, ring.shrinkRate) * (0.45 + 0.55 * Math.min(1, -diff / 85));
    ring.radius = Math.min(ring.targetRadius, ring.radius + expandSpeed * dtSec);
  }
}

export function startWaveTransition(state: GameState, waveNum: number, bus: EventBus): void {
  const isBoss = waveNum > 0 && waveNum % 5 === 0;
  state.waveTransition = {
    active: true,
    elapsedMs: 0,
    durationMs: WAVE_TRANSITION_MS,
    wave: waveNum,
    isBoss,
  };
  bus.emit('WAVE_TRANSITION', { wave: waveNum, isBoss });
}

function buildEnemySpawnQueue(wave: number): Array<Array<Exclude<EnemyType, 'boss'>>> {
  const totalEnemies = Math.max(4, Math.floor(wave * 1.45 + 2.5) + Math.floor(Math.random() * 2));
  const eliteChance = wave >= 4 ? Math.min(0.2, (wave - 3) * 0.03) : 0;
  const largeChance = wave >= 3 ? Math.min(0.26, (wave - 2) * 0.04) : 0;
  const mediumChance = wave >= 2 ? Math.min(0.42, 0.22 + wave * 0.015) : 0.22;

  const queue: Array<Array<Exclude<EnemyType, 'boss'>>> = [];
  let remaining = totalEnemies;

  while (remaining > 0) {
    const batch: Array<Exclude<EnemyType, 'boss'>> = [];
    if (Math.random() < 0.35) {
      const roll = Math.random();
      const singleType: Exclude<EnemyType, 'boss'> =
        wave < 2
          ? 'small'
          : wave < 3
            ? roll < 0.65
              ? 'small'
              : 'medium'
            : roll < 0.5
              ? 'small'
              : roll < 0.8
                ? 'medium'
                : 'large';
      const limit = singleType === 'small' ? 5 : singleType === 'medium' ? 4 : 3;
      const count = Math.min(remaining, Math.max(2, Math.floor(Math.random() * limit) + 2));
      for (let i = 0; i < count; i++) batch.push(singleType);
    } else {
      const count = Math.min(remaining, 3 + Math.floor(Math.random() * 2));
      let elites = 0;
      let larges = 0;
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        let t: Exclude<EnemyType, 'boss'> = 'small';
        if (r < eliteChance && elites < 2) {
          t = 'elite';
          elites++;
        } else if (r < eliteChance + largeChance && larges < 3) {
          t = 'large';
          larges++;
        } else if (r < eliteChance + largeChance + mediumChance) {
          t = 'medium';
        }
        batch.push(t);
      }
    }
    queue.push(batch);
    remaining -= batch.length;
  }

  if (wave >= 4 && wave % 3 === 0 && wave % 5 !== 0) {
    queue.push(['elite']);
  }

  return queue;
}

function calculateFastClearBonus(clearMs: number): number {
  if (clearMs < 11000) return 120;
  if (clearMs < 20000) return 60;
  if (clearMs < 30000) return 30;
  return 0;
}

export function updateWaveSystem(state: GameState, bus: EventBus, dtMs: number): void {
  const now = state.simTimeMs;
  updateStormRing(state, dtMs / 1000);

  // Slide the big wave banner along until it finishes
  if (state.waveTransition.active) {
    state.waveTransition.elapsedMs += dtMs;
    if (state.waveTransition.elapsedMs >= state.waveTransition.durationMs) {
      state.waveTransition.active = false;
    }
    return;
  }

  // Wave 0 warmup: stand in the green ring for a second to prove you found WASD
  if (state.wave === 0 && !state.isResting) {
    state.isResting = true;
    state.restStartMs = now;
    const tutAng = (Math.random() - 0.5) * Math.PI * 1.4 - Math.PI * 0.5;
    const tutDist = 175 + Math.random() * 45;
    const tutPt = clampPointToStorm(
      state.player.x + Math.cos(tutAng) * tutDist,
      state.player.y + Math.sin(tutAng) * tutDist,
      state.stormRing,
      70
    );
    state.tutorialCircle = {
      x: tutPt.x,
      y: tutPt.y,
      radius: 58,
      progressMs: 0,
      pulse: 0,
    };
  }

  if (state.wave === 0 && state.tutorialCircle) {
    const tc = state.tutorialCircle;
    tc.pulse += 0.08;
    const dist = Math.hypot(state.player.x - tc.x, state.player.y - tc.y);
    if (dist < tc.radius) {
      tc.progressMs += dtMs;
      if (tc.progressMs >= TUTORIAL_HOLD_MS) {
        spawnShockwave(state, tc.x, tc.y, 140, 0x44ff88, 24);
        spawnParticleBurst(state, tc.x, tc.y, 0x44ff88, 24, 3.8, 4, 24);
        state.isResting = false;
        state.wave = 1;
        state.tutorialCircle = null;
        state.neededSpawn = true;
        configureStormRingForWave(state, 1);
        startWaveTransition(state, 1, bus);
        return;
      }
    } else {
      tc.progressMs = Math.max(0, tc.progressMs - dtMs * 1.8);
    }
  }

  if (
    state.roomsTotalPerSector >= 5 &&
    state.currentRoomKind !== 'boss' &&
    !state.isResting &&
    !state.neededSpawn
  ) {
    return;
  }

  // Wave done once the arena, boss, and spawn queue are all empty
  if (
    state.wave > 0 &&
    !state.isResting &&
    !state.neededSpawn &&
    !state.raid?.activeObjective &&
    state.enemies.length === 0 &&
    state.boss === null &&
    state.spawnQueue.length === 0
  ) {
    state.isResting = true;
    state.restStartMs = now;
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 20);

    const bonus = calculateFastClearBonus(now - state.waveStartMs);
    if (bonus > 0) {
      state.score += bonus;
      spawnFloatingText(
        state,
        state.player.x,
        state.player.y - 45,
        `FAST CLEAR +${bonus}`,
        '#44ffff',
        1.45,
        55
      );
    }

    bus.emit('WAVE_CLEARED', { wave: state.wave, bonus });

    if (!state.stormRing.bossLocked) {
      startStormTransition(
        state,
        state.player.x,
        state.player.y,
        Math.max(state.stormRing.radius, 1220),
        1300,
        'EXPANDING'
      );
    }

    const healPt = randomPointInStorm(
      state.stormRing,
      state.player.x,
      state.player.y,
      90,
      175,
      60
    );
    state.healthPickup = {
      x: healPt.x,
      y: healPt.y,
      radius: 14,
      pulse: 0,
    };
  }

  // Breather timer expired — kick off the next wave (or Boss shop every 5th clear)
  const restDuration = state.wave === 0 ? TUTORIAL_AUTO_START_MS : WAVE_REST_MS;
  if (state.isResting && now - state.restStartMs >= restDuration) {
    state.isResting = false;
    state.tutorialCircle = null;
    state.healthPickup = null;
    state.wave++;
    state.bossSpawnedForWave = false;
    state.neededSpawn = true;

    // Only pop the Boss Black Market right after a Boss sector
    const shouldOpenShopFirst = state.wave > 1 && state.wave % 5 === 1;
    if (!shouldOpenShopFirst && !state.raid?.activeObjective) {
      if (state.roomsTotalPerSector < 5) {
        configureStormRingForWave(state, state.wave);
      }
      startWaveTransition(state, state.wave, bus);
    }
  }

  // Spawn next wave or open the post-boss shopping spree
  if (state.neededSpawn && !state.waveTransition.active) {
    if (state.wave > 1 && state.wave % 5 === 1 && state.shop.visitedForWave !== state.wave) {
      openShop(state, bus);
      return;
    }

    if (state.raid?.activeObjective && !state.raid.bossTriggered) {
      state.neededSpawn = false;
      return;
    }

    if (state.wave > 1 && state.wave % 5 === 1 && state.roomsTotalPerSector < 5) {
      configureStormRingForWave(state, state.wave);
    }

    state.neededSpawn = false;
    state.waveStartMs = now;

    if (state.wave % 5 === 0 && !state.bossSpawnedForWave) {
      state.spawnQueue = [];
      const boss = createBoss(state);
      state.boss = boss;
      state.bossSpawnedForWave = true;
      bus.emit('BOSS_SPAWNED', {
        archetype: boss.archetype,
        name: boss.displayName,
        wave: state.wave,
      });
    } else {
      state.spawnQueue = buildEnemySpawnQueue(state.wave);
      state.spawnIntervalMs = Math.max(2400, 3800 - state.wave * 55);
      state.spawnTimerMs = 0;

      const firstBatch = state.spawnQueue.shift();
      if (firstBatch) {
        for (let idx = 0; idx < firstBatch.length; idx++) {
          state.enemies.push(createEnemy(state, firstBatch[idx], false, undefined, idx, firstBatch.length));
        }
      }
    }
  }

  // Drip-feed leftover enemy batches instead of dumping them all on frame 1
  if (state.spawnQueue.length > 0 && !state.isResting && !state.waveTransition.active) {
    state.spawnTimerMs += dtMs;
    if (state.spawnTimerMs >= state.spawnIntervalMs) {
      state.spawnTimerMs = 0;
      const batch = state.spawnQueue.shift();
      if (batch) {
        for (let idx = 0; idx < batch.length; idx++) {
          state.enemies.push(createEnemy(state, batch[idx], false, undefined, idx, batch.length));
        }
      }
    }
  }
}
