import {
  MANUAL_AIM_CRIT_BONUS,
  PLAYER_BASE,
  type PowerUpType,
} from '../../config/constants';
import { HULL_CATALOG } from '../../config/hulls';
import { computeMutationArchetypeCounts, countMutationStacks } from '../../config/mutations';
import {
  PRIMARY_WEAPON_IDS,
  SKILL_WEAPON_IDS,
} from '../../config/weapons';
import type { EventBus } from '../../engine/EventBus';
import {
  addScreenShake,
  clampPointToStorm,
  collectFloatingModuleItem,
  collectGoldPickupItem,
  collectPowerUpItem,
  grantPlayerXp,
  hasBuff,
  nextId,
  randomPointInStorm,
  spawnFloatingText,
  spawnParticleBurst,
  spawnShockwave,
  triggerHitStop,
} from '../GameState';
import type { ArenaObstacle, BombProjectile, EnemyEntity, GameState } from '../types';
import { hitBoss, hitBossClone, hitBossPylon } from './BossSystem';
import { registerComboKill } from './ComboSystem';
import { getEnemyAccentColor } from './EnemySystem';
import { damagePlayer } from './PlayerSystem';
import { damageRaidObjective } from './RaidSystem';
import { applyRamImpulse, applySingularityPull } from './RigidContact2D';
import { computeActiveSynergies } from './ShopSystem';

const POWER_UP_TYPES: PowerUpType[] = ['speed', 'rapid', 'damage', 'magnet'];

function spawnLootForEnemy(state: GameState, enemy: EnemyEntity): void {
  const dropChance = enemy.canDrop ? 1.0 : state.player.dropChanceBonus;
  if (Math.random() < dropChance) {
    const totalMoney = Math.floor(enemy.moneyValue * (1 + state.player.moneyBonus));
    const coins = Math.max(1, Math.min(6, Math.ceil(totalMoney / 22)));
    const perCoin = Math.max(1, Math.ceil(totalMoney / coins));

    for (let i = 0; i < coins; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 3.8;
      state.goldPickups.push({
        id: nextId(state),
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        value: perCoin,
        size: totalMoney >= 150 ? 6.5 : 5,
        age: 0,
        homing: false,
      });
    }
  }

  const powerUpChance = (enemy.type === 'elite' ? 0.34 : enemy.type === 'large' ? 0.22 : 0.04) +
    state.player.dropChanceBonus * 0.35;
  if (!enemy.isMinion && Math.random() < powerUpChance) {
    const type = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
    state.powerUps.push({
      id: nextId(state),
      x: enemy.x,
      y: enemy.y,
      type,
      pulse: 0,
      lifeTicks: 380,
    });
  }
}

function handleEnemyKilled(
  state: GameState,
  enemy: EnemyEntity,
  bus: EventBus,
  isCrit: boolean,
  chainDepth = 0
): void {
  const earned = registerComboKill(state, bus, enemy.scoreValue, enemy.type);
  const accent = getEnemyAccentColor(enemy);
  const p = state.player;
  if (enemy.type === 'elite') {
    state.elitesKilledRun++;
  }
  const hullChronoMult = HULL_CATALOG[p.hullId]?.chronoGainMult ?? 1.0;
  p.chronoCharge = Math.min(100, p.chronoCharge + (enemy.type === 'elite' ? 12 : 4) * hullChronoMult);

  spawnLootForEnemy(state, enemy);
  const enemyXp = enemy.isMinion
    ? 2
    : enemy.type === 'elite'
      ? 34
      : enemy.type === 'large'
        ? 20
        : enemy.type === 'medium'
          ? 12
          : 6;
  grantPlayerXp(state, enemyXp, bus);

  // Occasional free weapon drops + VoidTech set venting on kill
  const syn = computeActiveSynergies(state.player);
  if (syn.tiers.VOIDTECH >= 3) {
    state.player.heat = Math.max(0, state.player.heat - 3.5);
    state.player.isOverloaded = state.player.heat >= state.player.maxHeat;
  }

  const modDropBonus =
    (state.sectorHazard === 'solar_storm' ? 0.12 : 0) +
    (syn.tiers.VOIDTECH >= 2 ? 0.12 : 0) +
    state.player.dropChanceBonus * 0.25;
  const modChance =
    enemy.type === 'elite'
      ? 0.30 + modDropBonus
      : enemy.type === 'large'
        ? 0.22 + modDropBonus
        : enemy.type === 'medium'
          ? 0.08 + modDropBonus * 0.5
          : 0;
  if (!enemy.isMinion && modChance > 0 && Math.random() < modChance) {
    const pool = [...PRIMARY_WEAPON_IDS, ...SKILL_WEAPON_IDS];
    const wId = pool[Math.floor(Math.random() * pool.length)];
    const a = Math.random() * Math.PI * 2;
    state.floatingModules.push({
      id: nextId(state),
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(a) * 1.6,
      vy: Math.sin(a) * 1.6,
      weaponId: wId,
      tier: 1,
      pulse: 0,
      lifeMs: 22000,
    });
    bus.emit('MODULE_DROPPED', { weaponId: wId, x: enemy.x, y: enemy.y });
  }

  spawnShockwave(state, enemy.x, enemy.y, enemy.w * 1.45, accent.hex, 18);
  spawnParticleBurst(state, enemy.x, enemy.y, accent.hex, enemy.type === 'elite' ? 28 : 16, 3.8, 4.2, 28);
  spawnFloatingText(state, enemy.x, enemy.y - 16, `+${earned}`, '#88eeff', 1.0, 32);

  if (enemy.type === 'elite' || (isCrit && enemy.type === 'large')) {
    triggerHitStop(state, 32);
    addScreenShake(state, 9);
  }

  bus.emit('ENEMY_KILLED', {
    x: enemy.x,
    y: enemy.y,
    type: enemy.type,
    isMinion: enemy.isMinion,
    scoreEarned: earned,
    color: accent.css,
  });

  // Pop a Bomber before it hugs you and it takes its friends with it
  if (enemy.specialKind === 'bomber' && chainDepth < 2) {
    const bomberRad = 165;
    const bomberDmg = 55 + state.wave * 6;
    state.bullets = state.bullets.filter(
      (b) => !b.isEnemy || Math.hypot(b.x - enemy.x, b.y - enemy.y) > bomberRad * 0.72
    );
    triggerBlastAoe(state, enemy.x, enemy.y, bomberRad, bomberDmg, 0xfb923c, '#fb923c', bus, enemy.id);
    spawnFloatingText(state, enemy.x, enemy.y - 24, 'BOMBER CHAIN!', '#fb923c', 1.15, 32);
    bus.emit('BARREL_EXPLODED', { x: enemy.x, y: enemy.y, radius: bomberRad });
  }

  // Split Shrapnel turns dead ships into tiny flying problems for their buddies
  const shrapnelStacks = countMutationStacks(p.activeMutations, 'split_shrapnel');
  if (shrapnelStacks > 0 && !enemy.isMinion && state.bullets.length < 280) {
    const count = 3 * shrapnelStacks;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + enemy.faceAngle;
      state.bullets.push({
        id: nextId(state),
        x: enemy.x,
        y: enemy.y,
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        speed: 9.2,
        radius: 4.5,
        damage: Math.round(16 * (state.metaBonuses?.dmgMult ?? 1)),
        color: '#fbbf24',
        hex: 0xfbbf24,
        isEnemy: false,
        pierceLeft: 0,
        hitIds: new Set<number>([enemy.id]),
        age: 0,
        bounces: 0,
        isCritVisual: false,
        visualStyle: 'needle',
        element: 'kinetic',
      });
    }
  }

  // Chain Detonation: chainDepth guard keeps infinite firework loops from melting the frame budget
  const chainStacks = countMutationStacks(p.activeMutations, 'chain_detonation');
  if (chainStacks > 0 && chainDepth < 2 && state.shockwaves.length < 36) {
    const chainRad = 115 + chainStacks * 25;
    const chainDmg = Math.round((28 + chainStacks * 18) * (state.metaBonuses?.dmgMult ?? 1));
    triggerBlastAoe(state, enemy.x, enemy.y, chainRad, chainDmg, 0xfb923c, '#fb923c', bus, enemy.id);
  }
}

export function applyDirectEnemyDamage(
  state: GameState,
  enemy: EnemyEntity,
  dmg: number,
  isCrit: boolean,
  bus: EventBus,
  colorCss = '#44ffff',
  colorHex = 0x44ffff
): boolean {
  if (enemy.hp <= 0) return false;
  enemy.hp -= dmg;
  enemy.flash = 1.0;
  spawnParticleBurst(state, enemy.x, enemy.y, colorHex, 6, 2.2, 3.0, 16);
  spawnFloatingText(
    state,
    enemy.x + (Math.random() - 0.5) * 14,
    enemy.y - 12,
    isCrit ? `${dmg}!` : `${dmg}`,
    colorCss,
    isCrit ? 1.25 : 1.05,
    28
  );
  const hitDx = enemy.x - state.player.x;
  const hitDy = enemy.y - state.player.y;
  const hitLen = Math.hypot(hitDx, hitDy) || 1;
  bus.emit('ENEMY_HIT', {
    x: enemy.x,
    y: enemy.y,
    damage: dmg,
    isCrit,
    isBoss: false,
    nx: -hitDx / hitLen,
    ny: -hitDy / hitLen,
  });
  if (enemy.hp <= 0) {
    handleEnemyKilled(state, enemy, bus, isCrit);
    return true;
  }
  return false;
}

function triggerBlastAoe(
  state: GameState,
  cx: number,
  cy: number,
  radius: number,
  damage: number,
  colorHex: number,
  colorCss: string,
  bus: EventBus,
  skipEnemyId = -1
): void {
  spawnShockwave(state, cx, cy, radius, colorHex, 20);
  spawnParticleBurst(state, cx, cy, colorHex, 20, 4.4, 3.8, 22);
  for (const other of state.enemies) {
    if (other.hp <= 0 || other.id === skipEnemyId) continue;
    if (Math.hypot(other.x - cx, other.y - cy) <= radius + other.radius) {
      applyDirectEnemyDamage(state, other, damage, false, bus, colorCss, colorHex);
    }
  }
  const obj = state.raid?.activeObjective;
  if (obj && !obj.completed && obj.kind !== 'vault') {
    if (Math.hypot(obj.x - cx, obj.y - cy) <= radius + obj.radius) {
      damageRaidObjective(state, damage, cx, cy, bus, false);
    }
  }

  if (state.boss && !state.boss.entering && !state.boss.dying) {
    if (Math.hypot(state.boss.x - cx, state.boss.y - cy) <= radius + state.boss.radius) {
      hitBoss(state, state.boss, damage, false, cx, cy, bus);
    }
  }
}

export function applyElementalImpact(
  state: GameState,
  enemy: EnemyEntity,
  baseDamage: number,
  element: 'kinetic' | 'burn' | 'ion' | 'parried',
  bus: EventBus
): void {
  if (enemy.hp <= 0 || element === 'parried') return;

  if (element === 'kinetic') {
    if ((enemy.burnMs ?? 0) > 0) {
      enemy.burnMs = 0;
      const shatterDmg = 45 + Math.round(baseDamage * 0.75);
      spawnFloatingText(state, enemy.x, enemy.y - 20, 'SHATTER!', '#ff7b29', 1.2, 32);
      triggerBlastAoe(state, enemy.x, enemy.y, 115, shatterDmg, 0xff7b29, '#ff7b29', bus, enemy.id);
      applyDirectEnemyDamage(state, enemy, Math.round(shatterDmg * 0.55), true, bus, '#ff7b29', 0xff7b29);
      bus.emit('ELEMENTAL_COMBO', { kind: 'shatter', x: enemy.x, y: enemy.y });
    }
    return;
  }

  if (element === 'burn') {
    if ((enemy.ionizedMs ?? 0) > 0) {
      enemy.ionizedMs = 0;
      enemy.burnMs = 0;
      const ovDmg = 85 + state.wave * 6;
      spawnFloatingText(state, enemy.x, enemy.y - 22, 'OVERLOAD!', '#c084fc', 1.25, 34);
      triggerBlastAoe(state, enemy.x, enemy.y, 130, ovDmg, 0xc084fc, '#c084fc', bus, enemy.id);
      applyDirectEnemyDamage(state, enemy, Math.round(ovDmg * 0.65), true, bus, '#c084fc', 0xc084fc);
      bus.emit('ELEMENTAL_COMBO', { kind: 'overload', x: enemy.x, y: enemy.y });
    } else {
      enemy.burnMs = 2600;
    }
    return;
  }

  // 'ion'
  if ((enemy.burnMs ?? 0) > 0) {
    enemy.burnMs = 0;
    enemy.ionizedMs = 0;
    const ovDmg = 85 + state.wave * 6;
    spawnFloatingText(state, enemy.x, enemy.y - 22, 'OVERLOAD!', '#c084fc', 1.25, 34);
    triggerBlastAoe(state, enemy.x, enemy.y, 130, ovDmg, 0xc084fc, '#c084fc', bus, enemy.id);
    applyDirectEnemyDamage(state, enemy, Math.round(ovDmg * 0.65), true, bus, '#c084fc', 0xc084fc);
    bus.emit('ELEMENTAL_COMBO', { kind: 'overload', x: enemy.x, y: enemy.y });
  } else if ((enemy.ionizedMs ?? 0) > 0) {
    enemy.ionizedMs = 2400;
    const arcDmg = 42 + Math.round(baseDamage * 0.5);
    const pts: Array<{ x: number; y: number }> = [{ x: enemy.x, y: enemy.y }];
    let curX = enemy.x;
    let curY = enemy.y;
    const hitIds = new Set<number>([enemy.id]);
    for (let step = 0; step < 3; step++) {
      let best: EnemyEntity | null = null;
      let bestDist = 215;
      for (const other of state.enemies) {
        if (other.hp <= 0 || hitIds.has(other.id)) continue;
        const d = Math.hypot(other.x - curX, other.y - curY);
        if (d < bestDist) {
          bestDist = d;
          best = other;
        }
      }
      if (!best) break;
      hitIds.add(best.id);
      pts.push({ x: best.x, y: best.y });
      applyDirectEnemyDamage(state, best, arcDmg, false, bus, '#38e8ff', 0x38e8ff);
      curX = best.x;
      curY = best.y;
    }
    if (pts.length >= 2) {
      state.lightningArcs.push({ id: nextId(state), points: pts, life: 20, maxLife: 20, hex: 0x38e8ff });
      spawnFloatingText(state, enemy.x, enemy.y - 20, 'ARC CHAIN!', '#38e8ff', 1.15, 28);
      bus.emit('ELEMENTAL_COMBO', { kind: 'arc_chain', x: enemy.x, y: enemy.y });
    }
  } else {
    enemy.ionizedMs = 4500;
  }
}

export function damageArenaObstacle(
  state: GameState,
  ob: ArenaObstacle,
  damage: number,
  bus: EventBus,
  chainDepth = 0
): boolean {
  if (ob.hp <= 0) return false;
  ob.hp = Math.max(0, ob.hp - damage);
  ob.flash = 1.0;
  spawnParticleBurst(state, ob.x, ob.y, ob.hex, 4, 2.0, 2.8, 12);
  if (ob.hp > 0) return false;

  const idx = state.arenaObstacles.findIndex((x) => x.id === ob.id);
  if (idx !== -1) state.arenaObstacles.splice(idx, 1);

  if (ob.kind === 'ore_asteroid') {
    spawnShockwave(state, ob.x, ob.y, 88, 0x67e8f9, 18);
    spawnParticleBurst(state, ob.x, ob.y, 0x67e8f9, 20, 4.0, 3.6, 22);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + ob.rotAngle;
      state.bullets.push({
        id: nextId(state),
        x: ob.x,
        y: ob.y,
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        speed: 9.2,
        radius: 6,
        damage: 34,
        color: '#67e8f9',
        hex: 0x67e8f9,
        isEnemy: false,
        pierceLeft: 1,
        hitIds: new Set<number>(),
        age: 0,
        bounces: 0,
        isCritVisual: false,
        visualStyle: 'needle',
        element: 'kinetic',
      });
    }
    const coinVal = 6 + state.raid.sectorNumber * 3;
    for (let c = 0; c < 2; c++) {
      const a = Math.random() * Math.PI * 2;
      state.goldPickups.push({
        id: nextId(state),
        x: ob.x,
        y: ob.y,
        vx: Math.cos(a) * 2.8,
        vy: Math.sin(a) * 2.8,
        value: coinVal,
        size: 5,
        age: 0,
        homing: false,
      });
    }
    grantPlayerXp(state, 3, bus);
    bus.emit('ASTEROID_SHATTERED', { x: ob.x, y: ob.y });
  } else {
    const alchStacks = countMutationStacks(state.player.activeMutations, 'barrel_alchemist');
    const radius = 175 + alchStacks * 55;
    const blastDmg = Math.round(
      (115 + state.raid.sectorNumber * 25) * (1 + alchStacks * 0.45)
    );
    addScreenShake(state, 16);
    triggerHitStop(state, 34);
    spawnShockwave(state, ob.x, ob.y, radius, 0xff5a1f, 24);
    spawnShockwave(state, ob.x, ob.y, radius * 0.65, 0xffdd55, 18);
    spawnParticleBurst(state, ob.x, ob.y, 0xff5a1f, 34, 6.2, 4.8, 28);
    spawnFloatingText(state, ob.x, ob.y - 18, 'PLASMA BLAST!', '#ff7b29', 1.2, 34);
    bus.emit('BARREL_EXPLODED', { x: ob.x, y: ob.y, radius });

    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - ob.x, e.y - ob.y) <= radius + e.radius) {
        applyElementalImpact(state, e, blastDmg, 'burn', bus);
        applyDirectEnemyDamage(state, e, blastDmg, true, bus, '#ff7b29', 0xff5a1f);
      }
    }
    const obj = state.raid?.activeObjective;
    if (obj && !obj.completed && obj.kind !== 'vault') {
      if (Math.hypot(obj.x - ob.x, obj.y - ob.y) <= radius + obj.radius) {
        damageRaidObjective(state, blastDmg, ob.x, ob.y, bus, true);
      }
    }

    if (state.boss && !state.boss.entering && !state.boss.dying) {
      if (Math.hypot(state.boss.x - ob.x, state.boss.y - ob.y) <= radius + state.boss.radius) {
        state.boss.burnMs = Math.max(state.boss.burnMs ?? 0, 4000);
        hitBoss(state, state.boss, blastDmg, true, ob.x, ob.y, bus);
      }
    }
    if (chainDepth < 4) {
      for (const other of [...state.arenaObstacles]) {
        if (Math.hypot(other.x - ob.x, other.y - ob.y) <= radius + other.radius) {
          damageArenaObstacle(state, other, blastDmg, bus, chainDepth + 1);
        }
      }
    }
  }
  return true;
}

function explodeBomb(state: GameState, bomb: BombProjectile, bus: EventBus): void {
  const salvoCount = Math.max(1, state.bombs.length);
  const radius =
    salvoCount > 1 ? Math.max(75, state.player.skill.radius * 0.72) : state.player.skill.radius;
  const maxDamage =
    salvoCount > 1
      ? Math.floor(state.player.skill.damage * 0.58)
      : state.player.skill.damage;

  addScreenShake(state, salvoCount > 1 ? 14 : 22);
  triggerHitStop(state, salvoCount > 1 ? 22 : 40);
  spawnShockwave(state, bomb.x, bomb.y, radius, 0x00ffff, 26);
  spawnShockwave(state, bomb.x, bomb.y, radius * 0.65, 0xffffff, 18);
  spawnParticleBurst(state, bomb.x, bomb.y, 0x00ffff, 36, 6.8, 5.0, 32);
  spawnParticleBurst(state, bomb.x, bomb.y, 0xffffff, 18, 4.6, 5.4, 20);

  bus.emit('BOMB_EXPLODED', { x: bomb.x, y: bomb.y, radius });

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = Math.hypot(enemy.x - bomb.x, enemy.y - bomb.y);
    if (d <= radius + enemy.radius) {
      const falloff = 1 - (d / (radius + enemy.radius)) * 0.45;
      const dmg = Math.floor(maxDamage * falloff);
      applyDirectEnemyDamage(state, enemy, dmg, false, bus, '#44ffff', 0x44ffff);
    }
  }

  if (state.raid?.activeObjective && !state.raid.activeObjective.completed && state.raid.activeObjective.kind !== 'vault') {
    const obj = state.raid.activeObjective;
    const dObj = Math.hypot(obj.x - bomb.x, obj.y - bomb.y);
    if (dObj <= radius + obj.radius) {
      const dmg = Math.floor(maxDamage * (1 - (dObj / (radius + obj.radius)) * 0.35));
      damageRaidObjective(state, dmg, bomb.x, bomb.y, bus, false);
    }
  }

  for (const ob of [...state.arenaObstacles]) {
    const dob = Math.hypot(ob.x - bomb.x, ob.y - bomb.y);
    if (dob <= radius + ob.radius) {
      damageArenaObstacle(state, ob, maxDamage, bus);
    }
  }

  if (state.boss && !state.boss.entering && !state.boss.dying) {
    const boss = state.boss;
    const d = Math.hypot(boss.x - bomb.x, boss.y - bomb.y);
    if (d <= radius + boss.radius) {
      const falloff = 1 - (d / (radius + boss.radius)) * 0.4;
      const dmg = Math.floor(maxDamage * falloff);
      hitBoss(state, boss, dmg, false, bomb.x, bomb.y, bus);
    }
    if (boss.twin && !boss.dying) {
      const dt = Math.hypot(boss.twin.x - bomb.x, boss.twin.y - bomb.y);
      if (dt <= radius + boss.twin.radius) {
        const falloff = 1 - (dt / (radius + boss.twin.radius)) * 0.4;
        const dmg = Math.floor(maxDamage * falloff);
        boss.twin.hitFlash = 1.0;
        hitBoss(state, boss, dmg, false, boss.twin.x, boss.twin.y, bus);
      }
    }
    for (const py of [...boss.pylons]) {
      const dp = Math.hypot(py.x - bomb.x, py.y - bomb.y);
      if (dp <= radius + py.radius) {
        const dmg = Math.floor(maxDamage * (1 - (dp / (radius + py.radius)) * 0.35));
        hitBossPylon(state, boss, py, dmg, false, bus);
      }
    }
    for (const cl of [...boss.clones]) {
      const dc = Math.hypot(cl.x - bomb.x, cl.y - bomb.y);
      if (dc <= radius + cl.radius) {
        const dmg = Math.floor(maxDamage * (1 - (dc / (radius + cl.radius)) * 0.35));
        hitBossClone(state, boss, cl, dmg, false, bus);
      }
    }
  }
}

export function updateCombatSystem(
  state: GameState,
  bus: EventBus,
  dtMs: number,
  triggerGameOver: () => void
): void {
  const p = state.player;

  // Tick burn DoT and ion slow timers before bullets fly
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    if ((e.ionizedMs ?? 0) > 0) {
      e.ionizedMs = Math.max(0, e.ionizedMs! - dtMs);
    }
    if ((e.burnMs ?? 0) > 0) {
      e.burnMs = Math.max(0, e.burnMs! - dtMs);
      e.burnTickMs = (e.burnTickMs ?? 0) + dtMs;
      if (e.burnTickMs >= 550) {
        e.burnTickMs -= 550;
        const dot = 6 + state.wave * 2;
        applyDirectEnemyDamage(state, e, dot, false, bus, '#ff8833', 0xff7b29);
      }
    }
  }
  if (state.boss && !state.boss.dying) {
    const b = state.boss;
    if ((b.ionizedMs ?? 0) > 0) b.ionizedMs = Math.max(0, b.ionizedMs! - dtMs);
    if ((b.burnMs ?? 0) > 0) {
      b.burnMs = Math.max(0, b.burnMs! - dtMs);
      b.burnTickMs = (b.burnTickMs ?? 0) + dtMs;
      if (b.burnTickMs >= 450) {
        b.burnTickMs -= 450;
        hitBoss(state, b, 16 + state.wave * 3, false, b.x, b.y, bus);
      }
    }
  }

  // Release delayed boss volley bullets once their countdown expires
  if (state.scheduledBullets.length > 0) {
    const pending: typeof state.scheduledBullets = [];
    for (const sb of state.scheduledBullets) {
      sb.delayMs -= dtMs;
      if (sb.delayMs <= 0) {
        state.bullets.push({
          id: nextId(state),
          x: sb.x,
          y: sb.y,
          dx: Math.cos(sb.angle),
          dy: Math.sin(sb.angle),
          speed: sb.speed,
          radius: 5.5,
          damage: sb.damage,
          color: sb.color,
          hex: sb.hex,
          isEnemy: true,
          pierceLeft: 0,
          hitIds: new Set<number>(),
          age: 0,
          bounces: sb.bounces ?? 0,
          isCritVisual: false,
          visualStyle: sb.visualStyle ?? 'orb',
        });
      } else {
        pending.push(sb);
      }
    }
    state.scheduledBullets = pending;
  }

  // Move bullets and check everything they might ruin
  const activeBullets: typeof state.bullets = [];
  const dmgBuff = hasBuff(state, 'damage') ? 1.5 : 1.0;

  const synCombat = computeActiveSynergies(p);
  const effectiveCritChance = PLAYER_BASE.critChance + (synCombat.tiers.AETHER >= 2 ? 0.1 : 0);
  const archCounts = computeMutationArchetypeCounts(p.activeMutations);
  const hullDef = HULL_CATALOG[p.hullId];
  const gravBulletStacks = countMutationStacks(p.activeMutations, 'gravity_bullets');
  const parryOverStacks = countMutationStacks(p.activeMutations, 'parry_overload');
  const grazeZapStacks = countMutationStacks(p.activeMutations, 'graze_lightning');
  const timeScale = state.timeScale ?? 1.0;

  for (const b of state.bullets) {
    const moveScale = b.isEnemy ? timeScale : 1.0;
    b.age += moveScale;
    if (!b.isEnemy && b.homing) {
      let bestTx = 0;
      let bestTy = 0;
      let bestDist = 440;
      let hasTarget = false;
      for (const e of state.enemies) {
        if (e.hp <= 0 || b.hitIds.has(e.id)) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < bestDist) {
          bestDist = d;
          bestTx = e.x;
          bestTy = e.y;
          hasTarget = true;
        }
      }
      if (state.boss && !state.boss.entering && !state.boss.dying && state.boss.hp > 0) {
        for (const py of state.boss.pylons) {
          if (py.hp <= 0 || b.hitIds.has(py.id)) continue;
          const dp = Math.hypot(py.x - b.x, py.y - b.y);
          if (dp < bestDist) {
            bestDist = dp;
            bestTx = py.x;
            bestTy = py.y;
            hasTarget = true;
          }
        }
        for (const cl of state.boss.clones) {
          if (cl.hp <= 0 || b.hitIds.has(cl.id)) continue;
          const dc = Math.hypot(cl.x - b.x, cl.y - b.y);
          if (dc < bestDist) {
            bestDist = dc;
            bestTx = cl.x;
            bestTy = cl.y;
            hasTarget = true;
          }
        }
        const dBoss = Math.hypot(state.boss.x - b.x, state.boss.y - b.y);
        if (dBoss < bestDist) {
          bestDist = dBoss;
          bestTx = state.boss.x;
          bestTy = state.boss.y;
          hasTarget = true;
        }
        if (state.boss.twin) {
          const dTwin = Math.hypot(state.boss.twin.x - b.x, state.boss.twin.y - b.y);
          if (dTwin < bestDist) {
            bestDist = dTwin;
            bestTx = state.boss.twin.x;
            bestTy = state.boss.twin.y;
            hasTarget = true;
          }
        }
      }
      if (hasTarget) {
        const desired = Math.atan2(bestTy - b.y, bestTx - b.x);
        const cur = Math.atan2(b.dy, b.dx);
        let diff = desired - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = 0.085;
        const nextAngle = cur + Math.max(-maxTurn, Math.min(maxTurn, diff));
        b.dx = Math.cos(nextAngle);
        b.dy = Math.sin(nextAngle);
      }
    }
    b.x += b.dx * b.speed * moveScale;
    b.y += b.dy * b.speed * moveScale;

    if (b.bounces > 0) {
      const ring = state.stormRing;
      const rdx = b.x - ring.centerX;
      const rdy = b.y - ring.centerY;
      const rd = Math.hypot(rdx, rdy);
      if (rd >= ring.radius && rd > 0.001) {
        const nx = rdx / rd;
        const ny = rdy / rd;
        const dot = b.dx * nx + b.dy * ny;
        if (dot > 0) {
          b.dx -= 2 * dot * nx;
          b.dy -= 2 * dot * ny;
        }
        b.x = ring.centerX + nx * ring.radius;
        b.y = ring.centerY + ny * ring.radius;
        b.bounces--;
      }
    }

    const distPlayer = Math.hypot(b.x - p.x, b.y - p.y);
    const distStorm = Math.hypot(b.x - state.stormRing.centerX, b.y - state.stormRing.centerY);
    if (distPlayer > 1280 || distStorm > state.stormRing.radius + 520 || b.age > 340) {
      continue;
    }

    if (b.isEnemy) {
      const dPlayer = Math.hypot(b.x - p.x, b.y - p.y);
      const hitDist = p.radius * 0.78 + b.radius;
      const isParryWindow = state.simTimeMs <= p.dashParryUntilMs;
      const isDashing = p.dashActive || state.simTimeMs < p.dashInvulnUntilMs;

      // Clutch Dash Parry: bat enemy bullets right back into their teeth as golden super-bolts
      if (isParryWindow && dPlayer <= p.radius + b.radius + 26) {
        let tx = p.x - b.dx * 120;
        let ty = p.y - b.dy * 120;
        let bestD = Infinity;
        for (const e of state.enemies) {
          if (e.hp <= 0) continue;
          const de = Math.hypot(e.x - b.x, e.y - b.y);
          if (de < bestD) {
            bestD = de;
            tx = e.x;
            ty = e.y;
          }
        }
        if (state.boss && !state.boss.entering && !state.boss.dying) {
          const db = Math.hypot(state.boss.x - b.x, state.boss.y - b.y);
          if (db < bestD) {
            bestD = db;
            tx = state.boss.x;
            ty = state.boss.y;
          }
        }
        const aimAng = Math.atan2(ty - b.y, tx - b.x);
        b.isEnemy = false;
        b.element = 'parried';
        b.dx = Math.cos(aimAng);
        b.dy = Math.sin(aimAng);
        b.speed = Math.max(11.5, b.speed * 2.1);
        b.damage = Math.max(55, Math.round(b.damage * 4.5));
        b.radius = Math.max(7, b.radius + 1.5);
        b.pierceLeft = 1;
        b.hitIds.clear();
        b.hex = 0xffee55;
        b.color = '#ffee55';
        b.visualStyle = 'needle';
        p.energy = Math.min(p.maxEnergy, p.energy + 15);
        p.chronoCharge = Math.min(
          100,
          p.chronoCharge + (12 + parryOverStacks * 8) * (hullDef?.chronoGainMult ?? 1)
        );
        if (parryOverStacks > 0) {
          b.damage = Math.round(b.damage * (1 + parryOverStacks * 0.5));
          triggerBlastAoe(
            state,
            b.x,
            b.y,
            135,
            34 * parryOverStacks,
            0xffee55,
            '#ffee55',
            bus
          );
        }
        state.score += 65;
        triggerHitStop(state, 36);
        addScreenShake(state, 10);
        spawnShockwave(state, b.x, b.y, 70, 0xffee55, 18);
        spawnParticleBurst(state, b.x, b.y, 0xffee55, 12, 3.0, 3.6, 16);
        spawnFloatingText(state, p.x, p.y - 26, 'PARRY!', '#ffee55', 1.25, 32);
        bus.emit('PLAYER_PARRY', { x: b.x, y: b.y });
        activeBullets.push(b);
        continue;
      }

      // Space rocks aren't just scenery — hide behind an ore boulder to eat enemy fire
      let blockedByCover = false;
      for (const ob of [...state.arenaObstacles]) {
        if (ob.hp <= 0) continue;
        if (Math.hypot(b.x - ob.x, b.y - ob.y) <= ob.radius + b.radius) {
          if (ob.kind === 'ore_asteroid') {
            damageArenaObstacle(state, ob, Math.max(4, Math.round(b.damage * 0.5)), bus);
            blockedByCover = true;
            break;
          }
        }
      }
      if (blockedByCover) continue;

      if (!isDashing && dPlayer <= hitDist) {
        damagePlayer(state, bus, b.damage, true, triggerGameOver);
        continue;
      }
      // Graze: reward players who live dangerously close to enemy shots with Chrono & Energy
      const grazeDist = p.radius + b.radius + (isDashing ? 28 : 22);
      if (!b.grazed && dPlayer <= grazeDist) {
        b.grazed = true;
        p.grazeCount++;
        const chronoGain =
          (isDashing ? 12 : 9) *
          (hullDef?.chronoGainMult ?? 1) *
          (archCounts.chrono >= 2 ? 1.3 : 1.0);
        p.chronoCharge = Math.min(100, p.chronoCharge + chronoGain);
        const enGain = isDashing ? 10 : 6;
        p.energy = Math.min(p.maxEnergy, p.energy + enGain);
        p.skill.lastUseMs -= isDashing ? 800 : 400;
        state.score += isDashing ? 25 : 15;
        spawnParticleBurst(state, b.x, b.y, 0x55ffff, 7, 2.2, 3.0, 14);
        spawnFloatingText(
          state,
          p.x,
          p.y - 24,
          isDashing ? 'GRAZE! +EN +CHRONO' : 'GRAZE! +CHRONO',
          '#55ffff',
          0.95,
          24
        );
        if (grazeZapStacks > 0) {
          let bestTarget: EnemyEntity | null = null;
          let bestDist = 330;
          for (const e of state.enemies) {
            if (e.hp <= 0) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < bestDist) {
              bestDist = d;
              bestTarget = e;
            }
          }
          if (bestTarget) {
            state.lightningArcs.push({
              id: nextId(state),
              points: [
                { x: p.x, y: p.y },
                {
                  x: (p.x + bestTarget.x) * 0.5 + (Math.random() - 0.5) * 26,
                  y: (p.y + bestTarget.y) * 0.5 + (Math.random() - 0.5) * 26,
                },
                { x: bestTarget.x, y: bestTarget.y },
              ],
              life: 10,
              maxLife: 10,
              hex: 0x38e8ff,
            });
            const zapDmg = Math.round(24 * grazeZapStacks * (state.metaBonuses?.dmgMult ?? 1));
            applyElementalImpact(state, bestTarget, zapDmg, 'ion', bus);
            applyDirectEnemyDamage(state, bestTarget, zapDmg, false, bus, '#38e8ff', 0x38e8ff);
            bus.emit('LIGHTNING_ARC', { x: p.x, y: p.y, intensity: 'zap' });
          }
        }
        bus.emit('PLAYER_GRAZE', { x: b.x, y: b.y });
      }
      activeBullets.push(b);
      continue;
    }

    // Player bullets vs hostiles
    const bulletCritChance = effectiveCritChance + (b.manualAim ? MANUAL_AIM_CRIT_BONUS : 0);
    let consumed = false;
    for (const e of state.enemies) {
      if (e.hp <= 0 || b.hitIds.has(e.id)) continue;
      const hitDist = e.radius + b.radius;
      if (Math.hypot(b.x - e.x, b.y - e.y) <= hitDist) {
        b.hitIds.add(e.id);
        const isCrit = Math.random() < bulletCritChance;
        let shieldMult = 1.0;
        let blockedFront = false;
        if (e.specialKind === 'shielder' && b.element !== 'parried') {
          const impactAng = Math.atan2(b.y - e.y, b.x - e.x);
          let diff = impactAng - e.faceAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const halfArc = (e.shieldArcRad || 1.92) * 0.5;
          if (Math.abs(diff) <= halfArc) {
            shieldMult = 0.45;
            blockedFront = true;
            bus.emit('ARMOR_DEFLECTED', { x: b.x, y: b.y });
          } else if (Math.abs(diff) >= Math.PI * 0.65) {
            shieldMult = 1.25;
          }
        }
        const dmg = Math.max(
          1,
          Math.floor(b.damage * dmgBuff * shieldMult * (isCrit ? PLAYER_BASE.critMultiplier : 1))
        );
        e.hp -= dmg;
        e.flash = 1.0;

        if (gravBulletStacks > 0) {
          for (const near of state.enemies) {
            if (near.hp <= 0 || near.id === e.id) continue;
            applySingularityPull(near, b.x, b.y, 125, 46 * gravBulletStacks, 0.08, 0.25);
          }
        }

        spawnParticleBurst(
          state,
          b.x,
          b.y,
          blockedFront ? 0x67e8f9 : isCrit ? 0xffee44 : b.hex,
          isCrit ? 7 : 3,
          2.4,
          3,
          14
        );
        spawnFloatingText(
          state,
          e.x + (Math.random() - 0.5) * 14,
          e.y - 10,
          blockedFront ? `${dmg} [SHIELD]` : isCrit ? `${dmg}!` : `${dmg}`,
          blockedFront ? '#67e8f9' : isCrit ? '#ffee44' : '#e6f6ff',
          isCrit ? 1.25 : 0.88,
          24
        );

        bus.emit('ENEMY_HIT', {
          x: b.x,
          y: b.y,
          damage: dmg,
          isCrit,
          isBoss: false,
          nx: -b.dx,
          ny: -b.dy,
        });

        if (e.hp <= 0) {
          handleEnemyKilled(state, e, bus, isCrit);
        } else {
          if (isCrit) {
            triggerHitStop(state, 16);
            addScreenShake(state, 2.8);
          }
          if (b.element) {
            applyElementalImpact(state, e, dmg, b.element, bus);
          }
        }

        if (b.pierceLeft > 0) {
          b.pierceLeft--;
        } else if (b.bounces > 0) {
          let nextTarget: EnemyEntity | null = null;
          let bestDist = 380;
          for (const cand of state.enemies) {
            if (cand.hp <= 0 || b.hitIds.has(cand.id)) continue;
            const dc = Math.hypot(cand.x - b.x, cand.y - b.y);
            if (dc < bestDist) {
              bestDist = dc;
              nextTarget = cand;
            }
          }
          if (nextTarget) {
            const leadT = Math.min(28, bestDist / Math.max(1, b.speed));
            const predX = nextTarget.x + nextTarget.vx * leadT;
            const predY = nextTarget.y + nextTarget.vy * leadT;
            const ang = Math.atan2(predY - b.y, predX - b.x);
            b.dx = Math.cos(ang);
            b.dy = Math.sin(ang);
            b.bounces--;
            b.hex = 0xf472b6;
            b.color = '#f472b6';
            break;
          } else {
            consumed = true;
            break;
          }
        } else {
          consumed = true;
          break;
        }
      }
    }

    // Player bullets vs space rocks, plasma barrels, and raid targets
    if (!consumed) {
      for (const ob of [...state.arenaObstacles]) {
        if (ob.hp <= 0 || b.hitIds.has(ob.id)) continue;
        if (Math.hypot(b.x - ob.x, b.y - ob.y) <= ob.radius + b.radius) {
          b.hitIds.add(ob.id);
          const isCrit = Math.random() < bulletCritChance;
          const dmg = Math.floor(b.damage * dmgBuff * (isCrit ? PLAYER_BASE.critMultiplier : 1));
          damageArenaObstacle(state, ob, dmg, bus);
          if (b.pierceLeft > 0) b.pierceLeft--;
          else {
            consumed = true;
            break;
          }
        }
      }
    }

    if (
      !consumed &&
      state.raid?.activeObjective &&
      !state.raid.activeObjective.completed &&
      state.raid.activeObjective.kind !== 'vault' &&
      !b.hitIds.has(state.raid.activeObjective.id)
    ) {
      const obj = state.raid.activeObjective;
      if (Math.hypot(b.x - obj.x, b.y - obj.y) <= obj.radius + b.radius) {
        b.hitIds.add(obj.id);
        const isCrit = Math.random() < bulletCritChance;
        const dmg = Math.floor(b.damage * dmgBuff * (isCrit ? PLAYER_BASE.critMultiplier : 1));
        damageRaidObjective(state, dmg, b.x, b.y, bus, isCrit);
        if (b.pierceLeft > 0) b.pierceLeft--;
        else consumed = true;
      }
    }

    // Player bullets vs boss pylons, mirage fakes, and the big boss itself
    if (!consumed && state.boss && !state.boss.entering && !state.boss.dying) {
      const boss = state.boss;
      for (const py of [...boss.pylons]) {
        if (py.hp <= 0 || b.hitIds.has(py.id)) continue;
        if (Math.hypot(b.x - py.x, b.y - py.y) <= py.radius + b.radius) {
          b.hitIds.add(py.id);
          const isCrit = Math.random() < bulletCritChance;
          const dmg = Math.floor(
            b.damage * dmgBuff * (isCrit ? PLAYER_BASE.critMultiplier : 1)
          );
          hitBossPylon(state, boss, py, dmg, isCrit, bus);
          if (b.pierceLeft > 0) {
            b.pierceLeft--;
          } else {
            consumed = true;
            break;
          }
        }
      }
      if (!consumed) {
        for (const cl of [...boss.clones]) {
          if (cl.hp <= 0 || b.hitIds.has(cl.id)) continue;
          if (Math.hypot(b.x - cl.x, b.y - cl.y) <= cl.radius + b.radius) {
            b.hitIds.add(cl.id);
            const isCrit = Math.random() < bulletCritChance;
            const dmg = Math.floor(
              b.damage * dmgBuff * (isCrit ? PLAYER_BASE.critMultiplier : 1)
            );
            hitBossClone(state, boss, cl, dmg, isCrit, bus);
            if (b.pierceLeft > 0) {
              b.pierceLeft--;
            } else {
              consumed = true;
              break;
            }
          }
        }
      }
      if (!consumed && !b.hitIds.has(boss.id)) {
        const hitDist = boss.radius + b.radius;
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= hitDist) {
          b.hitIds.add(boss.id);
          const isCrit = Math.random() < bulletCritChance;
          const dmg = Math.floor(
            b.damage * dmgBuff * (isCrit ? PLAYER_BASE.critMultiplier : 1)
          );
          hitBoss(state, boss, dmg, isCrit, b.x, b.y, bus);

          if (b.pierceLeft > 0) {
            b.pierceLeft--;
          } else {
            consumed = true;
          }
        }
      }
      // Gemini Omega borrows health directly from Alpha's bar — shoot whichever twin is closer
      const twinHitKey = -(boss.id * 10 + 7);
      if (!consumed && boss.twin && !boss.dying && !b.hitIds.has(twinHitKey)) {
        const hitDist = boss.twin.radius + b.radius;
        if (Math.hypot(b.x - boss.twin.x, b.y - boss.twin.y) <= hitDist) {
          b.hitIds.add(twinHitKey);
          const isCrit = Math.random() < bulletCritChance;
          const dmg = Math.floor(
            b.damage * dmgBuff * (isCrit ? PLAYER_BASE.critMultiplier : 1)
          );
          boss.twin.hitFlash = 1.0;
          hitBoss(state, boss, dmg, isCrit, b.x, b.y, bus);

          if (b.pierceLeft > 0) {
            b.pierceLeft--;
          } else {
            consumed = true;
          }
        }
      }
    }

    if (!consumed) {
      activeBullets.push(b);
    }
  }
  state.bullets = activeBullets;

  // Hull collisions: Dash-Execute finishers for low-HP mobs, Juggernaut battering ram, or ouch
  const vampStacks = countMutationStacks(p.activeMutations, 'vampiric_execute');
  const execThreshold = vampStacks > 0 ? 0.40 : 0.35;
  const canRam =
    p.hullId === 'juggernaut' ||
    p.ramShieldMs > 0 ||
    (p.dashActive && countMutationStacks(p.activeMutations, 'comet_overheat') > 0);
  const isActivelyRamming = canRam && (p.dashActive || p.ramShieldMs > 0 || Math.hypot(p.vx, p.vy) > p.speed * 0.72);

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + p.radius * 0.85) {
      if (p.dashActive && (e.isMinion || e.hp <= Math.max(45 + vampStacks * 15, e.maxHp * execThreshold))) {
        applyDirectEnemyDamage(state, e, Math.max(e.hp + 10, 120), true, bus, '#38e8ff', 0x38e8ff);
        p.dashStartMs = -10000;
        p.energy = Math.min(p.maxEnergy, p.energy + 18);
        p.heat = Math.max(0, p.heat - 30);
        p.isOverloaded = false;
        if (vampStacks > 0) {
          const heal = 8 * vampStacks;
          p.health = Math.min(p.maxHealth, p.health + heal);
          spawnFloatingText(state, p.x, p.y - 34, `+${heal} HP`, '#34d399', 1.0, 28);
        }
        triggerHitStop(state, 38);
        addScreenShake(state, 11);
        spawnShockwave(state, e.x, e.y, 84, 0x38e8ff, 20);
        spawnFloatingText(state, e.x, e.y - 20, 'EXECUTE!', '#38e8ff', 1.25, 34);
        bus.emit('PLAYER_EXECUTE', { x: e.x, y: e.y, enemyType: e.type });
        continue;
      }
      if (isActivelyRamming) {
        applyRamImpulse(p.x, p.y, p.vx, p.vy, e, 1.35);
        const ramDmg = Math.round(
          (42 + (p.hullId === 'juggernaut' ? 28 : 0)) * (state.metaBonuses?.dmgMult ?? 1)
        );
        applyDirectEnemyDamage(state, e, ramDmg, true, bus, '#f59e0b', 0xf59e0b);
        p.dashInvulnUntilMs = Math.max(p.dashInvulnUntilMs, state.simTimeMs + 140);
        spawnShockwave(state, e.x, e.y, 58, 0xf59e0b, 14);
        bus.emit('ARMOR_DEFLECTED', { x: e.x, y: e.y });
        continue;
      }
      damagePlayer(state, bus, e.contactDamage, e.contactDamage > 10, triggerGameOver);
    }
  }

  // Slide ships cleanly off boulders and reactors instead of snagging corners
  const solidColliders: Array<{ x: number; y: number; r: number }> = state.arenaObstacles.map(
    (ob) => ({ x: ob.x, y: ob.y, r: ob.radius })
  );
  if (
    state.raid?.activeObjective &&
    !state.raid.activeObjective.completed &&
    state.raid.activeObjective.kind === 'reactor'
  ) {
    solidColliders.push({
      x: state.raid.activeObjective.x,
      y: state.raid.activeObjective.y,
      r: state.raid.activeObjective.radius,
    });
  }
  for (const col of solidColliders) {
    const pdx = p.x - col.x;
    const pdy = p.y - col.y;
    const pd = Math.hypot(pdx, pdy);
    const minP = p.radius + col.r;
    if (pd < minP && pd > 0.001) {
      p.x = col.x + (pdx / pd) * minP;
      p.y = col.y + (pdy / pd) * minP;
    }
    for (const e of state.enemies) {
      if (e.hp <= 0 || e.ingressActive) continue;
      const edx = e.x - col.x;
      const edy = e.y - col.y;
      const ed = Math.hypot(edx, edy);
      const minE = e.radius + col.r;
      if (ed < minE && ed > 0.001) {
        e.x = col.x + (edx / ed) * minE;
        e.y = col.y + (edy / ed) * minE;
      }
    }
  }

  if (state.boss && !state.boss.entering && !state.boss.dying && !state.boss.isCharging) {
    const boss = state.boss;
    if (Math.hypot(boss.x - p.x, boss.y - p.y) <= boss.radius + p.radius * 0.85) {
      damagePlayer(state, bus, Math.floor(26 * boss.damageMultiplier), true, triggerGameOver);
    }
  }

  // Sweep up corpses before missiles pick targets
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // Homing salvo missiles
  const activeBombs: BombProjectile[] = [];
  for (const bomb of state.bombs) {
    bomb.lifeTicks--;
    if (bomb.lifeTicks <= 0) {
      explodeBomb(state, bomb, bus);
      continue;
    }

    // Track our assigned victim (or pick a new one if it already blew up)
    let targetPos: { x: number; y: number } | null = null;
    if (bomb.targetId !== null) {
      if (state.boss && state.boss.id === bomb.targetId && !state.boss.dying) {
        targetPos = { x: state.boss.x, y: state.boss.y };
      } else {
        const found = state.enemies.find((e) => e.id === bomb.targetId && e.hp > 0);
        if (found) targetPos = { x: found.x, y: found.y };
      }
    }

    if (!targetPos) {
      let bestDist = Infinity;
      for (const e of state.enemies) {
        const d = Math.hypot(e.x - bomb.x, e.y - bomb.y);
        if (d < bestDist) {
          bestDist = d;
          bomb.targetId = e.id;
          targetPos = { x: e.x, y: e.y };
        }
      }
      if (state.raid?.activeObjective && !state.raid.activeObjective.completed && state.raid.activeObjective.kind !== 'vault') {
        const obj = state.raid.activeObjective;
        const d = Math.hypot(obj.x - bomb.x, obj.y - bomb.y);
        if (d < bestDist) {
          bestDist = d;
          bomb.targetId = obj.id;
          targetPos = { x: obj.x, y: obj.y };
        }
      }
      if (state.boss && !state.boss.entering && !state.boss.dying) {
        const d = Math.hypot(state.boss.x - bomb.x, state.boss.y - bomb.y);
        if (d < bestDist) {
          bomb.targetId = state.boss.id;
          targetPos = { x: state.boss.x, y: state.boss.y };
        }
      }
    }

    if (targetPos) {
      const desired = Math.atan2(targetPos.y - bomb.y, targetPos.x - bomb.x);
      let diff = desired - bomb.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bomb.angle += Math.sign(diff) * Math.min(Math.abs(diff), bomb.turnSpeed);
    }

    bomb.x += Math.cos(bomb.angle) * bomb.speed;
    bomb.y += Math.sin(bomb.angle) * bomb.speed;

    if (bomb.lifeTicks % 2 === 0) {
      spawnParticleBurst(state, bomb.x, bomb.y, 0x22eeff, 2, 0.8, 3, 12);
    }

    if (Math.hypot(bomb.x - p.x, bomb.y - p.y) > 1400) {
      continue;
    }

    let detonated = false;
    for (const e of state.enemies) {
      if (Math.hypot(e.x - bomb.x, e.y - bomb.y) <= bomb.radius + e.radius) {
        explodeBomb(state, bomb, bus);
        detonated = true;
        break;
      }
    }
    if (
      !detonated &&
      state.raid?.activeObjective &&
      !state.raid.activeObjective.completed &&
      state.raid.activeObjective.kind !== 'vault'
    ) {
      const obj = state.raid.activeObjective;
      if (Math.hypot(obj.x - bomb.x, obj.y - bomb.y) <= bomb.radius + obj.radius) {
        explodeBomb(state, bomb, bus);
        detonated = true;
      }
    }
    if (!detonated && state.boss && !state.boss.entering && !state.boss.dying) {
      if (Math.hypot(state.boss.x - bomb.x, state.boss.y - bomb.y) <= bomb.radius + state.boss.radius) {
        explodeBomb(state, bomb, bus);
        detonated = true;
      } else if (
        state.boss.twin &&
        Math.hypot(state.boss.twin.x - bomb.x, state.boss.twin.y - bomb.y) <=
          bomb.radius + state.boss.twin.radius
      ) {
        explodeBomb(state, bomb, bus);
        detonated = true;
      }
    }

    if (!detonated) activeBombs.push(bomb);
  }
  state.bombs = activeBombs;
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // Vacuum up coins (magnet upgrades + field buffs both feed the tractor radius)
  const effectiveMagnetRange = p.pickupRange + (hasBuff(state, 'magnet') ? 260 : 0);
  const remainingGold: typeof state.goldPickups = [];
  for (const g of state.goldPickups) {
    g.age++;
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const dist = Math.hypot(dx, dy);

    if (g.homing || dist <= effectiveMagnetRange || g.age > 240) {
      g.homing = true;
      const pull = 0.75 + Math.min(1.8, g.age * 0.015);
      if (dist > 0.5) {
        g.vx = g.vx * 0.88 + (dx / dist) * pull * 2.2;
        g.vy = g.vy * 0.88 + (dy / dist) * pull * 2.2;
      }
    } else {
      g.vx *= 0.93;
      g.vy *= 0.93;
    }

    const nextGold = clampPointToStorm(g.x + g.vx, g.y + g.vy, state.stormRing, -160);
    g.x = nextGold.x;
    g.y = nextGold.y;

    if (dist <= p.radius + 14) {
      collectGoldPickupItem(state, g, bus);
    } else if (g.age < 1200) {
      remainingGold.push(g);
    }
  }
  state.goldPickups = remainingGold;

  // Floating power-up orbs
  const remainingPowerUps: typeof state.powerUps = [];
  for (const pu of state.powerUps) {
    pu.pulse += 0.14;
    pu.lifeTicks--;
    const dx = p.x - pu.x;
    const dy = p.y - pu.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= effectiveMagnetRange && dist > 1) {
      const pullSpeed = hasBuff(state, 'magnet') ? 4.8 : 2.6;
      pu.x += (dx / dist) * pullSpeed;
      pu.y += (dy / dist) * pullSpeed;
    }

    if (dist <= p.radius + 16) {
      collectPowerUpItem(state, pu, bus);
    } else if (pu.lifeTicks > 0) {
      remainingPowerUps.push(pu);
    }
  }
  state.powerUps = remainingPowerUps;

  // Green breather-room medkit
  if (state.healthPickup && state.isResting) {
    state.healthPickup.pulse += 0.1;
    const hp = state.healthPickup;
    if (Math.hypot(p.x - hp.x, p.y - hp.y) <= p.radius + hp.radius + 4) {
      const healAmount = 30;
      p.health = Math.min(p.maxHealth, p.health + healAmount);
      spawnShockwave(state, hp.x, hp.y, 52, 0x33ff88, 18);
      spawnParticleBurst(state, hp.x, hp.y, 0x33ff88, 14, 2.5, 3.5, 22);
      spawnFloatingText(state, hp.x, hp.y - 16, `+${healAmount} HP`, '#44ff88', 1.15, 36);
      bus.emit('PLAYER_HEAL', { amount: healAmount });
      // Drop another medkit nearby while resting so nobody has to commute across the sector
      const nextHeal = randomPointInStorm(state.stormRing, p.x, p.y, 90, 175, 60);
      state.healthPickup = {
        x: nextHeal.x,
        y: nextHeal.y,
        radius: 14,
        pulse: 0,
      };
    }
  }

  // Dropped weapon crates heading straight to your inventory
  const remainingModules: typeof state.floatingModules = [];
  for (const mod of state.floatingModules) {
    mod.pulse += 0.12;
    mod.lifeMs -= dtMs;
    mod.vx *= 0.94;
    mod.vy *= 0.94;
    const nextMod = clampPointToStorm(mod.x + mod.vx, mod.y + mod.vy, state.stormRing, -120);
    mod.x = nextMod.x;
    mod.y = nextMod.y;

    const dx = p.x - mod.x;
    const dy = p.y - mod.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= effectiveMagnetRange + 28 && dist > 1) {
      mod.x += (dx / dist) * 3.4;
      mod.y += (dy / dist) * 3.4;
    }

    if (dist <= p.radius + 18) {
      collectFloatingModuleItem(state, mod, bus);
    } else if (mod.lifeMs > 0) {
      remainingModules.push(mod);
    }
  }
  state.floatingModules = remainingModules;

  // Eye candy timers: sparks, rings, dash ghosts, beams, and floating numbers
  let pWrite = 0;
  for (let i = 0; i < state.particles.length; i++) {
    const pt = state.particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.z += pt.vz;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.vz *= 0.95;
    pt.life--;
    pt.size = Math.max(0.1, pt.maxSize * (pt.life / pt.maxLife));
    if (pt.life > 0) {
      state.particles[pWrite++] = pt;
    }
  }
  state.particles.length = pWrite;

  state.shockwaves = state.shockwaves.filter((sw) => {
    sw.life--;
    const t = 1 - sw.life / sw.maxLife;
    sw.radius = 4 + (sw.maxRadius - 4) * (1 - Math.pow(1 - t, 3));
    return sw.life > 0;
  });

  state.afterimages = state.afterimages.filter((ai) => {
    ai.life--;
    return ai.life > 0;
  });

  state.floatingTexts = state.floatingTexts.filter((ft) => {
    ft.life--;
    ft.x += ft.vx ?? 0;
    ft.y += ft.vy ?? -0.75;
    if (ft.vx !== undefined) ft.vx *= 0.94;
    if (ft.vy !== undefined && ft.gravity !== undefined) {
      ft.vy = Math.min(0.6, ft.vy + ft.gravity);
    }
    return ft.life > 0;
  });

  state.playerBeams = state.playerBeams.filter((beam) => {
    beam.life--;
    return beam.life > 0;
  });

  state.lightningArcs = state.lightningArcs.filter((arc) => {
    arc.life--;
    return arc.life > 0;
  });

  // Black holes, wingman drones, and spinning plasma sawblades
  updateSingularities(state, bus, dtMs);
  updateDrones(state, bus, dtMs);
  updateOrbitalSawblades(state, bus, dtMs);
}

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function updateSingularities(state: GameState, bus: EventBus, dtMs: number): void {
  if (state.singularities.length === 0) return;
  const p = state.player;
  const archCounts = computeMutationArchetypeCounts(p.activeMutations);
  const vortexSynergy = archCounts.vortex >= 2;
  const dtSec = dtMs / 1000;
  const surviving: typeof state.singularities = [];

  for (const s of state.singularities) {
    const prevBucket = Math.floor(s.lifeMs / 500);
    s.lifeMs -= dtMs;
    const nextBucket = Math.floor(Math.max(0, s.lifeMs) / 500);
    const radius = s.radius * (vortexSynergy ? 1.22 : 1.0);
    const dmgScale = (vortexSynergy ? 1.3 : 1.0) * (state.metaBonuses?.dmgMult ?? 1);

    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      applySingularityPull(e, s.x, s.y, radius, 165, dtSec, 0.55);
      if (prevBucket !== nextBucket && Math.hypot(e.x - s.x, e.y - s.y) <= radius * 0.72) {
        applyElementalImpact(state, e, s.damage * dmgScale, 'ion', bus);
        applyDirectEnemyDamage(state, e, Math.round(s.damage * dmgScale), false, bus, '#a855f7', 0xa855f7);
      }
    }

    if (s.lifeMs > 0) {
      surviving.push(s);
    } else {
      const blastDmg = Math.round(s.damage * 2.1 * dmgScale);
      triggerBlastAoe(state, s.x, s.y, radius * 0.85, blastDmg, s.hex, '#c084fc', bus);
      bus.emit('SINGULARITY_DETONATED', { x: s.x, y: s.y, radius });
    }
  }
  state.singularities = surviving;
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}

function updateDrones(state: GameState, bus: EventBus, dtMs: number): void {
  if (state.drones.length === 0) return;
  const p = state.player;
  const archCounts = computeMutationArchetypeCounts(p.activeMutations);
  const overdriveStacks = countMutationStacks(p.activeMutations, 'drone_wingman');
  const tetherStacks = countMutationStacks(p.activeMutations, 'drone_tether');
  const dtSec = dtMs / 1000;
  const orbitRate = 1.85 + (archCounts.swarm >= 2 ? 0.4 : 0);
  const fireCooldownMs = Math.max(650, 1180 - overdriveStacks * 140 - (archCounts.swarm >= 2 ? 90 : 0));
  const droneCount = state.drones.length;

  for (let i = 0; i < droneCount; i++) {
    const d = state.drones[i];
    d.orbitPhase = (d.orbitPhase + dtSec * orbitRate) % (Math.PI * 2);
    const spreadAng = d.orbitPhase + (i / droneCount) * Math.PI * 2;
    const orbitR = 58 + (droneCount > 4 ? 14 : 0);
    d.x = p.x + Math.cos(spreadAng) * orbitR;
    d.y = p.y + Math.sin(spreadAng) * orbitR;
    d.fireFlash = Math.max(0, d.fireFlash - dtSec * 4);

    // Drones politely shoot at the closest thing trying to kill you
    let tx = d.x + Math.cos(spreadAng) * 100;
    let ty = d.y + Math.sin(spreadAng) * 100;
    let bestDist = 340;
    let foundHostile = false;

    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const dist = Math.hypot(e.x - d.x, e.y - d.y);
      if (dist < bestDist) {
        bestDist = dist;
        tx = e.x;
        ty = e.y;
        foundHostile = true;
      }
    }
    if (state.boss && !state.boss.entering && !state.boss.dying && state.boss.hp > 0) {
      const distBoss = Math.hypot(state.boss.x - d.x, state.boss.y - d.y);
      if (distBoss < bestDist) {
        bestDist = distBoss;
        tx = state.boss.x;
        ty = state.boss.y;
        foundHostile = true;
      }
    }

    d.angle = Math.atan2(ty - d.y, tx - d.x);

    if (foundHostile && state.simTimeMs - d.lastFireMs >= fireCooldownMs && state.bullets.length < 290) {
      d.lastFireMs = state.simTimeMs;
      d.fireFlash = 1.0;
      const dmg = Math.round(
        (5 + overdriveStacks * 4 + (p.hullId === 'carrier' ? 2 : 0)) * (state.metaBonuses?.dmgMult ?? 1)
      );
      state.bullets.push({
        id: nextId(state),
        x: d.x,
        y: d.y,
        dx: Math.cos(d.angle),
        dy: Math.sin(d.angle),
        speed: 8.0,
        radius: 4.5,
        damage: dmg,
        color: '#2dd4bf',
        hex: 0x2dd4bf,
        isEnemy: false,
        pierceLeft: 0,
        hitIds: new Set<number>(),
        age: 0,
        bounces: 0,
        isCritVisual: false,
        visualStyle: 'bolt',
        element: 'ion',
      });
      bus.emit('DRONE_SHOT', { x: d.x, y: d.y });
    }

    // Electrified leash connecting each drone back to the ship (flying clotheslines of doom)
    if (tetherStacks > 0) {
      const tetherDmg = Math.max(1, Math.round(3 * tetherStacks * (state.metaBonuses?.dmgMult ?? 1)));
      for (const e of state.enemies) {
        if (e.hp <= 0 || e.flash > 0.05) continue;
        if (pointToSegmentDist(e.x, e.y, p.x, p.y, d.x, d.y) <= e.radius + 14) {
          applyElementalImpact(state, e, tetherDmg, 'ion', bus);
          applyDirectEnemyDamage(state, e, tetherDmg, false, bus, '#2dd4bf', 0x2dd4bf);
          bus.emit('LIGHTNING_ARC', { x: d.x, y: d.y, intensity: 'zap' });
        }
      }
    }
  }
}

function updateOrbitalSawblades(state: GameState, bus: EventBus, dtMs: number): void {
  const p = state.player;
  const bladeStacks = countMutationStacks(p.activeMutations, 'orbital_sawblades');
  if (bladeStacks <= 0) return;

  const dtSec = dtMs / 1000;
  p.orbitalBladeAngle = (p.orbitalBladeAngle + dtSec * 2.7) % (Math.PI * 2);
  const count = Math.min(4, bladeStacks + 1);
  const orbitR = 78;
  const bladeDmg = Math.round((9 + bladeStacks * 5) * (state.metaBonuses?.dmgMult ?? 1));

  for (let i = 0; i < count; i++) {
    const ang = p.orbitalBladeAngle + (i / count) * Math.PI * 2;
    const bx = p.x + Math.cos(ang) * orbitR;
    const by = p.y + Math.sin(ang) * orbitR;
    for (const e of state.enemies) {
      if (e.hp <= 0 || e.flash > 0.05) continue;
      if (Math.hypot(e.x - bx, e.y - by) <= e.radius + 22) {
        applyElementalImpact(state, e, bladeDmg, 'burn', bus);
        applyDirectEnemyDamage(state, e, bladeDmg, false, bus, '#fb923c', 0xfb923c);
      }
    }
  }
}
