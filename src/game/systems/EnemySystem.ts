import type { EventBus } from '../../engine/EventBus';
import {
  addScreenShake,
  clampPointToStorm,
  nextId,
  randomPointInStorm,
  spawnParticleBurst,
  spawnShockwave,
} from '../GameState';
import type {
  BotEvolutionTier,
  EnemyEntity,
  EnemySpecialKind,
  EnemyTacticalRole,
  EnemyType,
  GameState,
} from '../types';
import { resolveCircleContactImpulse } from './RigidContact2D';

const ROLE_BY_TYPE: Record<Exclude<EnemyType, 'boss'>, EnemyTacticalRole> = {
  small: 'flanker',
  medium: 'artillery',
  large: 'interceptor',
  elite: 'sniper',
};

const BASE_HP: Record<Exclude<EnemyType, 'boss'>, number> = {
  small: 36,
  medium: 72,
  large: 135,
  elite: 225,
};

const BASE_DMG: Record<Exclude<EnemyType, 'boss'>, number> = {
  small: 11,
  medium: 17,
  large: 26,
  elite: 34,
};

const BASE_SCORE: Record<Exclude<EnemyType, 'boss'>, number> = {
  small: 10,
  medium: 20,
  large: 35,
  elite: 55,
};

const BASE_SPEED: Record<Exclude<EnemyType, 'boss'>, number> = {
  small: 1.52,
  medium: 1.30,
  large: 1.14,
  elite: 1.26,
};

const MONEY_RANGES: Record<Exclude<EnemyType, 'boss'>, [number, number]> = {
  small: [3, 6],
  medium: [8, 13],
  large: [15, 24],
  elite: [28, 42],
};

function isEnemyCombatReady(e: EnemyEntity, state: GameState): boolean {
  const distPlayer = Math.hypot(e.x - state.player.x, e.y - state.player.y);
  const distRing = Math.hypot(e.x - state.stormRing.centerX, e.y - state.stormRing.centerY);
  return distPlayer < 520 && distRing <= state.stormRing.radius + 55;
}

// Picks a coordinate well outside any sane viewport so foes never pop into existence on your nose.
export function computeOffscreenSpawnPoint(
  state: GameState,
  angleRad: number,
  extraMargin = 0
): { x: number; y: number } {
  const rx = 830 + extraMargin + Math.random() * 90;
  const ry = 590 + extraMargin + Math.random() * 80;
  return {
    x: state.player.x + Math.cos(angleRad) * rx,
    y: state.player.y + Math.sin(angleRad) * ry,
  };
}

function predictAimAngle(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
  vx: number,
  vy: number,
  projSpeed: number,
  leadFactor = 0.72
): number {
  const dist = Math.hypot(targetX - fromX, targetY - fromY);
  const t = Math.min(36, dist / Math.max(1, projSpeed)) * leadFactor;
  return Math.atan2(targetY + vy * t - fromY, targetX + vx * t - fromX);
}

export function createEnemy(
  state: GameState,
  type: Exclude<EnemyType, 'boss'>,
  isMinion = false,
  overridePos?: { x: number; y: number },
  slotIndex = 0,
  batchSize = 1,
  specialKind: EnemySpecialKind = 'none'
): EnemyEntity {
  const size = isMinion
    ? 24
    : type === 'elite'
      ? 44
      : type === 'large'
        ? 48
        : type === 'medium'
          ? 38
          : 28;

  const id = nextId(state);
  const goldenOffset = (id * 2.3999632) % (Math.PI * 2);
  const slotSpread = batchSize > 1 ? (slotIndex / batchSize) * Math.PI * 2 : 0;
  const sectorAngle = (goldenOffset + slotSpread) % (Math.PI * 2);
  const flankSign: 1 | -1 = (slotIndex + id) % 2 === 0 ? 1 : -1;

  let x = 0;
  let y = 0;
  let ingressActive = false;
  let ingressTargetX = state.player.x;
  let ingressTargetY = state.player.y;

  if (overridePos) {
    x = overridePos.x;
    y = overridePos.y;
    ingressTargetX = overridePos.x;
    ingressTargetY = overridePos.y;
  } else {
    // Throw mobs off-screen around the 360-degree perimeter and let them commute in
    const spawnAngle = sectorAngle + (Math.random() - 0.5) * 0.32;
    const rawSpawn = computeOffscreenSpawnPoint(state, spawnAngle);
    x = rawSpawn.x;
    y = rawSpawn.y;

    const targetDist = 245 + Math.random() * 85;
    const clampedTarget = clampPointToStorm(
      state.player.x + Math.cos(spawnAngle) * targetDist,
      state.player.y + Math.sin(spawnAngle) * targetDist,
      state.stormRing,
      65
    );
    ingressTargetX = clampedTarget.x;
    ingressTargetY = clampedTarget.y;
    ingressActive = true;
  }

  const evolutionTier: BotEvolutionTier = state.wave >= 11 ? 3 : state.wave >= 6 ? 2 : 1;
  const tierSpeedScale = evolutionTier === 3 ? 1.22 : evolutionTier === 2 ? 1.12 : 1.0;

  const w = Math.max(0, state.wave - 1);
  const waveScale = 1 + w * 0.16 + Math.max(0, w - 3) * 0.09;
  const contactWaveScale = 1 + w * 0.12;
  const hp = Math.floor(
    BASE_HP[type] * waveScale * (isMinion ? 0.85 : 1) * (specialKind === 'shielder' ? 1.1 : 1)
  );
  const [minM, maxM] = MONEY_RANGES[type];
  const rawMoney = minM + Math.random() * (maxM - minM);
  const specialSpeedMult = specialKind === 'bomber' ? 1.28 : specialKind === 'shielder' ? 0.85 : 1.0;

  return {
    id,
    type,
    isMinion,
    x,
    y,
    w: size,
    h: size,
    radius: size * 0.48,
    hp,
    maxHp: hp,
    contactDamage: Math.floor(BASE_DMG[type] * contactWaveScale * (isMinion ? 0.55 : 1)),
    scoreValue: Math.floor(BASE_SCORE[type] * (1 + state.wave * 0.08)),
    moneyValue: Math.floor(rawMoney * (1 + state.wave * 0.1) * (isMinion ? 0.35 : 1.0)),
    speed: BASE_SPEED[type] * (isMinion ? 1.3 : 1) * tierSpeedScale * specialSpeedMult,
    canDrop: !isMinion && (type === 'small' ? Math.random() < 0.55 : true),
    flash: 0,
    anim: Math.random() * Math.PI * 2,
    aiTimer: 0,
    aiState: 'chase',
    orbitAngle: sectorAngle,
    zigzagDir: flankSign,
    dashCooldown: 60,
    dashTimer: 0,
    dashDirX: 0,
    dashDirY: 1,
    lastShotMs: state.simTimeMs - Math.random() * 1200,
    teleportCooldown: 90,
    warpWarmupTimer: 0,
    warpLineTimer: 0,
    warpStartX: x,
    warpStartY: y,
    faceAngle: Math.atan2(ingressTargetY - y, ingressTargetX - x),
    vx: 0,
    vy: 0,
    tacticalRole: ROLE_BY_TYPE[type],
    flankSign,
    sectorAngle,
    strafeTimer: 0,
    ingressActive,
    ingressTargetX,
    ingressTargetY,
    ingressTicks: 0,
    evolutionTier,
    specialKind,
    telegraphTimerMs: 0,
    telegraphMaxMs: specialKind === 'sniper' ? 950 : specialKind === 'bomber' ? 750 : 0,
    telegraphAngle: Math.atan2(ingressTargetY - y, ingressTargetX - x),
    telegraphTargetX: state.player.x,
    telegraphTargetY: state.player.y,
    shieldArcRad: specialKind === 'shielder' ? 1.92 : 0,
    healTargetId: null,
  };
}

export function getEnemyAccentColor(enemy: EnemyEntity): { css: string; hex: number } {
  if (enemy.isMinion) return { css: '#bb55ff', hex: 0xbb55ff };
  if (enemy.specialKind === 'bomber') return { css: '#ff5a1f', hex: 0xff5a1f };
  if (enemy.specialKind === 'medic') return { css: '#34d399', hex: 0x34d399 };
  if (enemy.specialKind === 'shielder') return { css: '#818cf8', hex: 0x818cf8 };
  if (enemy.specialKind === 'sniper') return { css: '#ff2255', hex: 0xff2255 };
  if (enemy.canDrop) return { css: '#ffd744', hex: 0xffd744 };
  switch (enemy.type) {
    case 'small':
      return { css: '#ff4444', hex: 0xff4444 };
    case 'medium':
      return { css: '#ff8833', hex: 0xff8833 };
    case 'large':
      return { css: '#dd44ee', hex: 0xdd44ee };
    case 'elite':
      return { css: '#44ddff', hex: 0x44ddff };
  }
}

export function updateEnemySystem(
  state: GameState,
  dtMs = 16.667,
  bus?: EventBus,
  onPlayerHurt?: (damage: number) => void
): void {
  const px = state.player.x;
  const py = state.player.y;
  const pvx = state.player.vx;
  const pvy = state.player.vy;
  const now = state.simTimeMs;
  const timeScale = state.timeScale ?? 1.0;
  const scaledDtMs = dtMs * timeScale;
  const stepScale = scaledDtMs / 16.667;

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const prevX = e.x;
    const prevY = e.y;
    const dx = px - e.x;
    const dy = py - e.y;
    const dist = Math.hypot(dx, dy);
    const dirX = dist > 0.001 ? dx / dist : 0;
    const dirY = dist > 0.001 ? dy / dist : 1;

    e.aiTimer += stepScale;
    e.anim += 0.1 * stepScale;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - 0.08);
    if (e.warpLineTimer > 0) e.warpLineTimer = Math.max(0, e.warpLineTimer - stepScale);

    // Fly in from off-screen first — nobody is allowed to snipe from outside the monitor
    if (e.ingressActive) {
      e.ingressTicks++;
      const tx = e.ingressTargetX - e.x;
      const ty = e.ingressTargetY - e.y;
      const td = Math.hypot(tx, ty);
      const stepSpeed = (td > 150 ? Math.max(5.4, e.speed * 3.8) : Math.max(2.6, e.speed * 2.0)) * stepScale;
      if (td > 1) {
        e.x += (tx / td) * Math.min(td, stepSpeed);
        e.y += (ty / td) * Math.min(td, stepSpeed);
        e.faceAngle = Math.atan2(ty, tx);
      }
      if (e.ingressTicks % 5 === 0) {
        spawnParticleBurst(state, e.x, e.y, getEnemyAccentColor(e).hex, 1, 0.8, 2.0, 10);
      }
      if (td <= 28 || (e.ingressTicks >= 95 && isEnemyCombatReady(e, state))) {
        e.ingressActive = false;
        e.lastShotMs = Math.max(e.lastShotMs, now - Math.random() * 650);
      }
      e.vx = e.x - prevX;
      e.vy = e.y - prevY;
      continue;
    }

    const desiredFace = Math.atan2(dy, dx);
    if (e.specialKind === 'shielder') {
      // Cap the Shielder's turn speed so actually circling behind it feels rewarding instead of pointless
      let diff = desiredFace - e.faceAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = 2.4 * (scaledDtMs / 1000);
      e.faceAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
    } else if (e.specialKind !== 'sniper' || e.telegraphTimerMs <= 0) {
      e.faceAngle = desiredFace;
    }

    const inBounds = isEnemyCombatReady(e, state);
    const cdMult = e.evolutionTier === 3 ? 0.74 : e.evolutionTier === 2 ? 0.86 : 1.0;

    // Telegraph special toys: Bomber wind-up rings, Sniper laser sights, and Medic green healing tethers
    if (e.specialKind === 'bomber') {
      if (e.telegraphTimerMs > 0 || (inBounds && dist <= 95)) {
        const prevT = e.telegraphTimerMs;
        e.telegraphMaxMs = 750;
        e.telegraphTimerMs += scaledDtMs;
        if (prevT === 0) {
          spawnShockwave(state, e.x, e.y, 44, 0xff5a1f, 12);
        }
        if (e.telegraphTimerMs >= 750) {
          e.hp = 0;
          const blastR = 105;
          spawnShockwave(state, e.x, e.y, blastR, 0xff4422, 22);
          spawnParticleBurst(state, e.x, e.y, 0xff5a1f, 26, 4.8, 4.2, 24);
          addScreenShake(state, 10);
          if (dist <= blastR + state.player.radius) {
            onPlayerHurt?.(24 + state.raid.sectorNumber * 4);
          }
          continue;
        }
        e.vx = 0;
        e.vy = 0;
        continue;
      }
      // Subtle hint on what the Bomber wants to hug
      e.x += dirX * e.speed * 1.22 * stepScale;
      e.y += dirY * e.speed * 1.22 * stepScale;
      e.vx = e.x - prevX;
      e.vy = e.y - prevY;
      continue;
    }

    if (e.specialKind === 'medic') {
      let bestAlly: EnemyEntity | null = null;
      let lowestRatio = 0.99;
      for (const ally of state.enemies) {
        if (ally.id === e.id || ally.hp <= 0) continue;
        if (Math.hypot(ally.x - e.x, ally.y - e.y) > 360) continue;
        const r = ally.hp / Math.max(1, ally.maxHp);
        if (r < lowestRatio) {
          lowestRatio = r;
          bestAlly = ally;
        }
      }
      e.healTargetId = bestAlly ? bestAlly.id : null;
      if (bestAlly) {
        bestAlly.hp = Math.min(
          bestAlly.maxHp,
          bestAlly.hp + (6 + state.wave * 1.4) * (scaledDtMs / 1000)
        );
        e.telegraphTargetX = bestAlly.x;
        e.telegraphTargetY = bestAlly.y;
      }
    } else {
      e.healTargetId = null;
    }

    if (e.specialKind === 'sniper') {
      e.telegraphMaxMs = 950;
      if (e.telegraphTimerMs > 0) {
        e.telegraphTimerMs += scaledDtMs;
        // Track slightly for the first 700ms, then freeze the beam for 250ms so dodging is actually fair
        if (e.telegraphTimerMs < 700) {
          const lead = predictAimAngle(e.x, e.y, px, py, pvx, pvy, 7.8, 0.45);
          let diff = lead - e.telegraphAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          e.telegraphAngle += Math.sign(diff) * Math.min(Math.abs(diff), 0.08 * stepScale);
        }
        e.faceAngle = e.telegraphAngle;
        if (e.telegraphTimerMs >= 950) {
          e.telegraphTimerMs = 0;
          e.lastShotMs = now;
          state.bullets.push({
            id: nextId(state),
            x: e.x + Math.cos(e.telegraphAngle) * (e.radius + 6),
            y: e.y + Math.sin(e.telegraphAngle) * (e.radius + 6),
            dx: Math.cos(e.telegraphAngle),
            dy: Math.sin(e.telegraphAngle),
            speed: 7.8,
            radius: 5.5,
            damage: Math.floor(28 * (1 + state.wave * 0.08)),
            color: '#ff2255',
            hex: 0xff2255,
            isEnemy: true,
            pierceLeft: 0,
            hitIds: new Set<number>(),
            age: 0,
            bounces: 0,
            isCritVisual: true,
            visualStyle: 'needle',
          });
          spawnParticleBurst(state, e.x, e.y, 0xff2255, 8, 2.8, 3.0, 14);
        }
        e.vx = 0;
        e.vy = 0;
        continue;
      }
      if (inBounds && now - e.lastShotMs > 2500 * cdMult && dist < 560) {
        e.telegraphTimerMs = 1;
        e.telegraphAngle = predictAimAngle(e.x, e.y, px, py, pvx, pvy, 7.8, 0.55);
        e.faceAngle = e.telegraphAngle;
        bus?.emit('SNIPER_LOCK', { x: e.x, y: e.y });
        e.vx = 0;
        e.vy = 0;
        continue;
      }
    }

    // Role-based steering so squads flank instead of forming a sad conga line
    if (e.isMinion) {
      e.sectorAngle += 0.015 * e.flankSign * stepScale;
      const desiredRadius = Math.max(46, Math.min(140, dist * 0.78));
      const anchor = clampPointToStorm(
        px + Math.cos(e.sectorAngle) * desiredRadius,
        py + Math.sin(e.sectorAngle) * desiredRadius,
        state.stormRing,
        32
      );
      const adx = anchor.x - e.x;
      const ady = anchor.y - e.y;
      const ad = Math.hypot(adx, ady) || 1;
      e.x += (adx / ad) * e.speed * 1.18;
      e.y += (ady / ad) * e.speed * 1.18;
    } else if (e.type === 'small') {
      // Scouts lead your velocity for a cheap flank shot, then peel away before bumping noses
      if (e.strafeTimer > 0) {
        e.strafeTimer--;
        const awayAng = Math.atan2(-dy, -dx) + e.flankSign * 0.95;
        e.x += Math.cos(awayAng) * e.speed * 1.28;
        e.y += Math.sin(awayAng) * e.speed * 1.28;
      } else {
        const perpX = -dirY * e.flankSign;
        const perpY = dirX * e.flankSign;
        const lead = clampPointToStorm(
          px + pvx * 24 + perpX * 82,
          py + pvy * 24 + perpY * 82,
          state.stormRing,
          36
        );
        const ldx = lead.x - e.x;
        const ldy = lead.y - e.y;
        const ld = Math.hypot(ldx, ldy) || 1;
        e.x += (ldx / ld) * e.speed * 1.12;
        e.y += (ldy / ld) * e.speed * 1.12;

        if (dist < 76) {
          e.strafeTimer = 44;
          e.flankSign = e.flankSign === 1 ? -1 : 1;
          if (e.specialKind !== 'sniper' && state.wave >= 1 && inBounds && now - e.lastShotMs > 2100 * cdMult) {
            e.lastShotMs = now;
            const projSpd = e.evolutionTier === 3 ? 3.7 : 3.3;
            const aim = predictAimAngle(e.x, e.y, px, py, pvx, pvy, projSpd, 0.55);
            const fan =
              e.evolutionTier === 3 ? [-0.2, 0, 0.2] : e.evolutionTier === 2 ? [-0.12, 0.12] : [0];
            for (const offset of fan) {
              state.bullets.push({
                id: nextId(state),
                x: e.x,
                y: e.y,
                dx: Math.cos(aim + offset),
                dy: Math.sin(aim + offset),
                speed: projSpd,
                radius: 5.0,
                damage: Math.floor(13 * (1 + state.wave * 0.06)),
                color: e.evolutionTier === 3 ? '#ff77aa' : '#ff5555',
                hex: e.evolutionTier === 3 ? 0xff77aa : 0xff5555,
                isEnemy: true,
                pierceLeft: 0,
                hitIds: new Set<number>(),
                age: 0,
                bounces: 0,
                isCritVisual: false,
                visualStyle: 'bolt',
              });
            }
          }
        }
      }
    } else if (e.type === 'medium') {
      // Artillery campers park on a ring around you and lob annoying lead fans
      e.sectorAngle += 0.008 * e.flankSign;
      const targetR = 232 + Math.sin(e.aiTimer * 0.03 + e.id) * 24;
      const anchor = clampPointToStorm(
        px + Math.cos(e.sectorAngle) * targetR,
        py + Math.sin(e.sectorAngle) * targetR,
        state.stormRing,
        46
      );
      const adx = anchor.x - e.x;
      const ady = anchor.y - e.y;
      const ad = Math.hypot(adx, ady);
      if (ad > 10) {
        e.x += (adx / ad) * Math.min(ad, e.speed * 1.05);
        e.y += (ady / ad) * Math.min(ad, e.speed * 1.05);
      }

      if (e.specialKind !== 'sniper' && inBounds && now - e.lastShotMs > 1850 * cdMult && dist < 440 && dist > 65) {
        e.lastShotMs = now;
        const projSpd = e.evolutionTier === 3 ? 3.9 : 3.6;
        const leadAng = predictAimAngle(e.x, e.y, px, py, pvx, pvy, projSpd, 0.78);
        e.faceAngle = leadAng;
        const fan =
          e.evolutionTier === 3
            ? [-0.22, 0, 0.22]
            : e.evolutionTier === 2
              ? [-0.18, 0, 0.18]
              : [-0.14, 0.14];
        for (const offset of fan) {
          const isTier3Center = e.evolutionTier === 3 && offset === 0;
          state.bullets.push({
            id: nextId(state),
            x: e.x,
            y: e.y,
            dx: Math.cos(leadAng + offset),
            dy: Math.sin(leadAng + offset),
            speed: isTier3Center ? projSpd + 0.3 : projSpd,
            radius: 5.5,
            damage: Math.floor(15 * (1 + state.wave * 0.06)),
            color: isTier3Center ? '#ffdd55' : '#ffaa33',
            hex: isTier3Center ? 0xffdd55 : 0xffaa33,
            isEnemy: true,
            pierceLeft: 0,
            hitIds: new Set<number>(),
            age: 0,
            bounces: isTier3Center ? 1 : 0,
            isCritVisual: false,
            visualStyle: isTier3Center ? 'needle' : 'bolt',
          });
        }
      }
    } else if (e.type === 'large') {
      // Heavy brutes: stalk -> rev engines -> ram into the arena and throw a parting nova
      if (e.dashCooldown > 0) e.dashCooldown--;
      if (e.aiState === 'chase') {
        const intercept = clampPointToStorm(
          px + pvx * 26 + Math.cos(e.sectorAngle) * 58,
          py + pvy * 26 + Math.sin(e.sectorAngle) * 58,
          state.stormRing,
          48
        );
        const idx = intercept.x - e.x;
        const idy = intercept.y - e.y;
        const idist = Math.hypot(idx, idy) || 1;
        e.x += (idx / idist) * e.speed * 0.78;
        e.y += (idy / idist) * e.speed * 0.78;
        if (inBounds && dist < 225 && dist > 72 && e.dashCooldown <= 0 && Math.random() < 0.032) {
          e.aiState = 'windup';
          const leadAng = predictAimAngle(e.x, e.y, px, py, pvx, pvy, e.speed * 4.1, 0.45);
          e.dashDirX = Math.cos(leadAng);
          e.dashDirY = Math.sin(leadAng);
          e.dashTimer = 28;
        }
      } else if (e.aiState === 'windup') {
        if (e.dashTimer > 12) {
          const leadAng = predictAimAngle(e.x, e.y, px, py, pvx, pvy, e.speed * 4.1, 0.48);
          e.dashDirX = Math.cos(leadAng);
          e.dashDirY = Math.sin(leadAng);
        }
        e.faceAngle = Math.atan2(e.dashDirY, e.dashDirX);
        e.dashTimer--;
        if (e.dashTimer % 4 === 0) {
          spawnParticleBurst(
            state,
            e.x + e.dashDirX * e.radius,
            e.y + e.dashDirY * e.radius,
            0xff55ff,
            2,
            1.0,
            2.6,
            11
          );
        }
        if (e.dashTimer <= 0) {
          e.aiState = 'dash';
          e.dashTimer = 22;
        }
      } else {
        e.x += e.dashDirX * e.speed * 4.1;
        e.y += e.dashDirY * e.speed * 4.1;
        e.faceAngle = Math.atan2(e.dashDirY, e.dashDirX);
        e.dashTimer--;
        if (e.dashTimer % 3 === 0) {
          spawnParticleBurst(state, e.x, e.y, 0xff55ff, 2, 1.2, 3.2, 14);
        }
        if (e.dashTimer <= 0) {
          // Cough up a ring of bolts whenever the brute slams on the brakes
          if (isEnemyCombatReady(e, state)) {
            const baseRot = e.faceAngle;
            const ringCount = e.evolutionTier === 3 ? 10 : e.evolutionTier === 2 ? 8 : 6;
            for (let i = 0; i < ringCount; i++) {
              const ang = baseRot + (i / ringCount) * Math.PI * 2;
              state.bullets.push({
                id: nextId(state),
                x: e.x,
                y: e.y,
                dx: Math.cos(ang),
                dy: Math.sin(ang),
                speed: 3.1 + (e.evolutionTier - 1) * 0.25,
                radius: 5.5,
                damage: Math.floor(10 * (1 + state.wave * 0.05)),
                color: '#ee55ff',
                hex: 0xee55ff,
                isEnemy: true,
                pierceLeft: 0,
                hitIds: new Set<number>(),
                age: 0,
                bounces: e.evolutionTier === 3 && i % 2 === 0 ? 1 : 0,
                isCritVisual: false,
                visualStyle: 'orb',
              });
            }
          }
          e.aiState = 'chase';
          e.dashCooldown = Math.round(115 * cdMult);
        }
      }
    } else if (e.type === 'elite') {
      // Elites kite at long range and panic-blink away once they dip under 45% HP
      if (e.teleportCooldown > 0) e.teleportCooldown--;
      if (e.warpWarmupTimer > 0) {
        e.warpWarmupTimer--;
        if (e.warpWarmupTimer <= 0) {
          e.warpStartX = e.x;
          e.warpStartY = e.y;
          e.warpLineTimer = 32;

          const fallback = randomPointInStorm(state.stormRing, px, py, 190, 320, 65);
          let bestX = fallback.x;
          let bestY = fallback.y;
          let bestScore = -Infinity;
          for (let c = 0; c < 6; c++) {
            const cand = randomPointInStorm(state.stormRing, px, py, 175, 360, 65);
            const pd = Math.hypot(cand.x - px, cand.y - py);
            let minPeer = 999;
            for (const other of state.enemies) {
              if (other.id !== e.id) {
                minPeer = Math.min(minPeer, Math.hypot(cand.x - other.x, cand.y - other.y));
              }
            }
            const score = minPeer + Math.abs(pd - 260) * -0.4;
            if (score > bestScore) {
              bestScore = score;
              bestX = cand.x;
              bestY = cand.y;
            }
          }

          e.x = bestX;
          e.y = bestY;
          e.sectorAngle = Math.atan2(bestY - py, bestX - px);
          e.teleportCooldown = 180;
          spawnParticleBurst(state, e.x, e.y, 0x00ffff, 18, 3.2, 4, 22);
        }
      } else {
        if (inBounds && e.hp / e.maxHp < 0.45 && e.teleportCooldown <= 0 && Math.random() < 0.03) {
          e.warpWarmupTimer = 28;
        } else {
          e.sectorAngle += 0.006 * e.flankSign;
          const idealR = 270;
          const anchor = clampPointToStorm(
            px + Math.cos(e.sectorAngle) * idealR,
            py + Math.sin(e.sectorAngle) * idealR,
            state.stormRing,
            52
          );
          const adx = anchor.x - e.x;
          const ady = anchor.y - e.y;
          const ad = Math.hypot(adx, ady);
          if (ad > 10) {
            e.x += (adx / ad) * Math.min(ad, e.speed * 1.15);
            e.y += (ady / ad) * Math.min(ad, e.speed * 1.15);
          }

          if (inBounds && now - e.lastShotMs > 1850 * cdMult && dist < 480) {
            e.lastShotMs = now;
            const speedBonus = e.evolutionTier >= 2 ? 0.35 : 0;
            const leadAngle = predictAimAngle(e.x, e.y, px, py, pvx, pvy, 4.0 + speedBonus, 0.82);
            e.faceAngle = leadAngle;
            const fan =
              e.evolutionTier === 3 ? [-0.32, -0.16, 0, 0.16, 0.32] : [-0.22, 0, 0.22];
            for (const offset of fan) {
              const shouldBounce =
                offset === 0 ||
                (e.evolutionTier === 2 && Math.abs(offset) > 0.1) ||
                (e.evolutionTier === 3 && Math.abs(offset) <= 0.17);
              state.bullets.push({
                id: nextId(state),
                x: e.x,
                y: e.y,
                dx: Math.cos(leadAngle + offset),
                dy: Math.sin(leadAngle + offset),
                speed: (offset === 0 ? 4.1 : 3.7) + speedBonus,
                radius: 5.5,
                damage: Math.floor(12 * (1 + state.wave * 0.05)),
                color: e.evolutionTier === 3 ? '#ffee66' : '#ffdd44',
                hex: e.evolutionTier === 3 ? 0xffee66 : 0xffdd44,
                isEnemy: true,
                pierceLeft: 0,
                hitIds: new Set<number>(),
                age: 0,
                bounces: shouldBounce ? 1 : 0,
                isCritVisual: false,
                visualStyle: 'needle',
              });
            }
            addScreenShake(state, 2.5);
          }
        }
      }
    }

    // Slow movement by Chrono bullet-time and Ion stun without touching their off-screen commute
    if (!e.ingressActive) {
      let dispScale = stepScale;
      if ((e.ionizedMs ?? 0) > 0) dispScale *= 0.78;
      e.x = prevX + (e.x - prevX) * dispScale;
      e.y = prevY + (e.y - prevY) * dispScale;

      const tethered = clampPointToStorm(e.x, e.y, state.stormRing, -160);
      e.x = tethered.x;
      e.y = tethered.y;
    }

    e.vx = e.x - prevX;
    e.vy = e.y - prevY;

    if (e.canDrop && Math.random() < 0.04) {
      spawnParticleBurst(state, e.x, e.y, 0xffdd33, 1, 0.7, 2.2, 16);
    }
  }

  // Sweep up Bombers that already went out in a blaze of glory this tick
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // Push ships apart cleanly so they don't stack 10-deep into one mega-hitbox
  const count = state.enemies.length;
  for (let i = 0; i < count; i++) {
    const a = state.enemies[i];
    for (let j = i + 1; j < count; j++) {
      const b = state.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;

      const hardSep = (a.radius + b.radius) * 1.45;
      const bothInArena = !a.ingressActive && !b.ingressActive;
      const sameRanged =
        (a.type === 'medium' || a.type === 'elite') && (b.type === 'medium' || b.type === 'elite');
      const softSep = bothInArena ? (sameRanged ? 150 : 95) : hardSep;

      if (d2 < softSep * softSep) {
        const d = Math.sqrt(d2);
        const nx = d > 0.001 ? dx / d : Math.cos(i * 2.1 + j);
        const ny = d > 0.001 ? dy / d : Math.sin(i * 2.1 + j);

        if (d < hardSep) {
          const bodyA = {
            x: a.x,
            y: a.y,
            vx: a.vx,
            vy: a.vy,
            radius: a.radius * 1.45,
            invMass: 1 / Math.max(8, a.radius),
          };
          const bodyB = {
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            radius: b.radius * 1.45,
            invMass: 1 / Math.max(8, b.radius),
          };
          resolveCircleContactImpulse(bodyA, bodyB, 0.45, 0.2);
          a.x = bodyA.x;
          a.y = bodyA.y;
          a.vx = bodyA.vx;
          a.vy = bodyA.vy;
          b.x = bodyB.x;
          b.y = bodyB.y;
          b.vx = bodyB.vx;
          b.vy = bodyB.vy;
        } else if (bothInArena) {
          const softPush = ((softSep - d) / softSep) * 0.72;
          a.x -= nx * softPush;
          a.y -= ny * softPush;
          b.x += nx * softPush;
          b.y += ny * softPush;

          // Nudge overlapping buddies into different lanes around the player
          const angDiff = Math.atan2(
            Math.sin(b.sectorAngle - a.sectorAngle),
            Math.cos(b.sectorAngle - a.sectorAngle)
          );
          if (Math.abs(angDiff) < 0.6) {
            const sign = angDiff >= 0 ? 1 : -1;
            a.sectorAngle -= 0.03 * sign;
            b.sectorAngle += 0.03 * sign;
          }
        }
      }
    }
  }
}
