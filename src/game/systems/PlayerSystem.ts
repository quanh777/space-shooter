import { PLAYER_BASE } from '../../config/constants';
import { HULL_CATALOG } from '../../config/hulls';
import { computeMutationArchetypeCounts, countMutationStacks } from '../../config/mutations';
import {
  SHIP_SLOT_MAP,
  WEAPON_CATALOG,
  type ShipSlotId,
  type SkillWeaponCatalogEntry,
} from '../../config/weapons';
import type { EventBus } from '../../engine/EventBus';
import type { InputSnapshot } from '../../engine/InputManager';
import {
  addScreenShake,
  clampPointToStorm,
  hasBuff,
  nextId,
  spawnFloatingText,
  spawnParticleBurst,
  spawnShockwave,
  triggerHitStop,
} from '../GameState';
import type {
  BossClone,
  BossPylon,
  BulletVisualStyle,
  GameState,
  PlayerState,
  SkillMode,
  Vec2,
} from '../types';
import { hitBoss, hitBossClone, hitBossPylon } from './BossSystem';
import {
  applyDirectEnemyDamage,
  applyElementalImpact,
  damageArenaObstacle,
} from './CombatSystem';
import { damageRaidObjective } from './RaidSystem';
import {
  computeActiveSynergies,
  computeMountedPrimaryStats,
  computePlayerCoolingRate,
  computeWeaponHeatScale,
  syncSkillStatsFromLoadout,
} from './ShopSystem';
import type { PrimaryWeaponCatalogEntry } from '../../config/weapons';

function syncOverloadState(player: PlayerState): void {
  if (player.heat >= player.maxHeat) {
    player.isOverloaded = true;
  } else if (player.isOverloaded && player.heat <= player.maxHeat * 0.72) {
    // Hysteresis keeps the overheat alarm from strobing right on the 100% line
    player.isOverloaded = false;
  }
}

function findNearestTarget(
  state: GameState
): { x: number; y: number; id: number; hpRatio: number; isBoss: boolean } | null {
  const p = state.player;
  let minDistSq = Infinity;
  let best: { x: number; y: number; id: number; hpRatio: number; isBoss: boolean } | null = null;

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDistSq) {
      minDistSq = d2;
      best = { x: e.x, y: e.y, id: e.id, hpRatio: Math.max(0, e.hp / e.maxHp), isBoss: false };
    }
  }

  if (state.boss && !state.boss.entering && !state.boss.dying && state.boss.hp > 0) {
    const boss = state.boss;
    // Shoot down the Boss's emerald shield pylons before wasting ammo on its barrier
    for (const py of boss.pylons) {
      if (py.hp <= 0) continue;
      const d2 = (py.x - p.x) ** 2 + (py.y - p.y) ** 2;
      if (d2 < minDistSq) {
        minDistSq = d2;
        best = {
          x: py.x,
          y: py.y,
          id: py.id,
          hpRatio: Math.max(0, py.hp / py.maxHp),
          isBoss: false,
        };
      }
    }
    for (const cl of boss.clones) {
      if (cl.hp <= 0) continue;
      const d2 = (cl.x - p.x) ** 2 + (cl.y - p.y) ** 2;
      if (d2 < minDistSq) {
        minDistSq = d2;
        best = {
          x: cl.x,
          y: cl.y,
          id: cl.id,
          hpRatio: Math.max(0, cl.hp / cl.maxHp),
          isBoss: false,
        };
      }
    }
    if (boss.pylons.length === 0) {
      const dx = boss.x - p.x;
      const dy = boss.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDistSq) {
        minDistSq = d2;
        best = {
          x: boss.x,
          y: boss.y,
          id: boss.id,
          hpRatio: Math.max(0, boss.hp / boss.maxHp),
          isBoss: true,
        };
      }
      if (boss.twin) {
        const tdx = boss.twin.x - p.x;
        const tdy = boss.twin.y - p.y;
        const td2 = tdx * tdx + tdy * tdy;
        if (td2 < minDistSq) {
          minDistSq = td2;
          best = {
            x: boss.twin.x,
            y: boss.twin.y,
            id: boss.id,
            hpRatio: Math.max(0, boss.hp / boss.maxHp),
            isBoss: true,
          };
        }
      }
    }
  }

  const raidObj = state.raid?.activeObjective;
  if (!best && raidObj && !raidObj.completed && raidObj.kind !== 'vault') {
    const dx = raidObj.x - p.x;
    const dy = raidObj.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDistSq) {
      minDistSq = d2;
      best = {
        x: raidObj.x,
        y: raidObj.y,
        id: raidObj.id,
        hpRatio: Math.max(0, raidObj.hp / Math.max(1, raidObj.maxHp)),
        isBoss: true,
      };
    }
  }

  return best;
}

function getAimVector(state: GameState, input: InputSnapshot): { x: number; y: number; angle: number } {
  const p = state.player;

  if (input.aimMode === 'mouse' && input.mouseActive) {
    const dx = input.mouseArenaX - p.x;
    const dy = input.mouseArenaY - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      return { x: dx / d, y: dy / d, angle: Math.atan2(dy, dx) };
    }
  } else {
    const target = findNearestTarget(state);
    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) {
        return { x: dx / d, y: dy / d, angle: Math.atan2(dy, dx) };
      }
    }
  }

  if (Math.hypot(input.moveX, input.moveY) > 0.1) {
    const angle = Math.atan2(input.moveY, input.moveX);
    return { x: Math.cos(angle), y: Math.sin(angle), angle };
  }

  return {
    x: Math.cos(p.facingAngle),
    y: Math.sin(p.facingAngle),
    angle: p.facingAngle,
  };
}

const PRIMARY_SLOT_ORDER: readonly ShipSlotId[] = [
  'nose',
  'wing_l1',
  'wing_r1',
  'wing_l2',
  'wing_r2',
];

function weaponElementFor(
  weaponId: string,
  solarStacks: number
): 'kinetic' | 'burn' | 'ion' | undefined {
  if (weaponId === 'rail_sniper') return 'kinetic';
  if (weaponId === 'homing_pod') return 'ion';
  if (weaponId === 'scatter_cannon') return solarStacks >= 2 ? 'burn' : 'kinetic';
  return solarStacks >= 2 ? 'burn' : undefined;
}

function mapBulletVisualStyle(
  style: 'player_pulse' | 'player_scatter' | 'player_rail' | 'player_missile'
): BulletVisualStyle {
  switch (style) {
    case 'player_rail':
      return 'needle';
    case 'player_scatter':
      return 'orb';
    case 'player_missile':
      return 'petal';
    case 'player_pulse':
    default:
      return 'bolt';
  }
}

function firePlayerWeapons(state: GameState, input: InputSnapshot, bus: EventBus): void {
  const p = state.player;
  const now = state.simTimeMs;
  const aim = getAimVector(state, input);
  p.targetAngle = aim.angle;

  const cosF = Math.cos(p.facingAngle);
  const sinF = Math.sin(p.facingAngle);
  const archCounts = computeMutationArchetypeCounts(p.activeMutations);
  const ricochetStacks = countMutationStacks(p.activeMutations, 'ricochet_prism');
  const railOverStacks = countMutationStacks(p.activeMutations, 'rail_overcharge');
  const homingBarrageStacks = countMutationStacks(p.activeMutations, 'homing_barrage');
  const glassCannon = countMutationStacks(p.activeMutations, 'glass_cannon') > 0;
  const chronoSpdBonus = p.chronoActiveMs > 0 && archCounts.chrono >= 4 ? 1.6 : 1.0;
  const chronoPierceBonus = p.chronoActiveMs > 0 && archCounts.chrono >= 4 ? 1 : 0;

  let rapidMult = hasBuff(state, 'rapid') ? 0.5 : 1.0;
  if (p.overclockBuffMs > 0) rapidMult *= 0.78;
  if (glassCannon) rapidMult *= 0.8;

  let totalBulletsSpawned = 0;
  let anyPiercing = false;
  let weaponsFired = 0;
  let totalHeatAdded = 0;
  const heatScale = computeWeaponHeatScale(state);

  for (const slotId of PRIMARY_SLOT_ORDER) {
    const mounted = p.loadout.slots[slotId];
    if (!mounted || mounted.weaponId === 'thermal_sink') continue;
    const stats = computeMountedPrimaryStats(mounted, p, slotId, state.metaBonuses?.dmgMult ?? 1.0);
    if (stats.projectiles <= 0) continue;
    const slotCooldown = stats.cooldownMs * rapidMult;
    if (now - mounted.lastFireMs < slotCooldown) continue;

    mounted.lastFireMs = now;
    mounted.recoil = 1.0;
    weaponsFired++;
    const effectivePierce =
      stats.pierce + (p.innatePierce ?? 0) + railOverStacks + chronoPierceBonus;
    if (effectivePierce > 0) anyPiercing = true;
    const entry = WEAPON_CATALOG[mounted.weaponId] as PrimaryWeaponCatalogEntry;
    totalHeatAdded += entry.heatPerShot * heatScale;

    const slotDef = SHIP_SLOT_MAP[slotId];
    const mx = p.x + slotDef.fireOffset.x * cosF - slotDef.fireOffset.z * sinF;
    const my = p.y + slotDef.fireOffset.x * sinF + slotDef.fireOffset.z * cosF;

    const count = Math.max(1, stats.projectiles);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const offsetAngle = t * stats.spreadRad;
      const fireAngle = aim.angle + offsetAngle;
      const dx = Math.cos(fireAngle);
      const dy = Math.sin(fireAngle);

      state.bullets.push({
        id: nextId(state),
        x: mx,
        y: my,
        dx,
        dy,
        speed: stats.bulletSpeed * chronoSpdBonus,
        radius: stats.bulletRadius,
        damage: stats.damage,
        color: `#${stats.hex.toString(16).padStart(6, '0')}`,
        hex: stats.hex,
        isEnemy: false,
        pierceLeft: effectivePierce,
        hitIds: new Set<number>(),
        age: 0,
        bounces: ricochetStacks * 2,
        isCritVisual: false,
        visualStyle: mapBulletVisualStyle(stats.bulletStyle),
        homing: stats.homing,
        element: weaponElementFor(mounted.weaponId, archCounts.solar),
      });
      totalBulletsSpawned++;
    }

    spawnParticleBurst(state, mx, my, stats.hex, 2, 1.6, 2.2, 8, 0.45);
  }

  if (weaponsFired > 0) {
    p.shotCounter++;
    // Swarm bonus: spit free seeker micro-missiles every 4th trigger pull
    if (homingBarrageStacks > 0 && p.shotCounter % 4 === 0) {
      const mCount = 2 * homingBarrageStacks;
      for (let m = 0; m < mCount; m++) {
        const ang = aim.angle + ((m / Math.max(1, mCount - 1)) - 0.5) * 0.7;
        state.bullets.push({
          id: nextId(state),
          x: p.x,
          y: p.y,
          dx: Math.cos(ang),
          dy: Math.sin(ang),
          speed: 8.4,
          radius: 5.5,
          damage: Math.round(24 * (state.metaBonuses?.dmgMult ?? 1)),
          color: '#2dd4bf',
          hex: 0x2dd4bf,
          isEnemy: false,
          pierceLeft: 0,
          hitIds: new Set<number>(),
          age: 0,
          bounces: ricochetStacks > 0 ? 1 : 0,
          isCritVisual: false,
          visualStyle: 'petal',
          homing: true,
          element: 'ion',
        });
      }
    }
    p.lastShotMs = now;
    p.shotRecoil = 1.0;
    const wasOverloaded = p.isOverloaded;
    p.heat = Math.min(p.maxHeat + 18, p.heat + totalHeatAdded);
    syncOverloadState(p);
    if (p.isOverloaded && !wasOverloaded) {
      bus.emit('OVERLOAD_STARTED');
      if (p.loadout.activeAugments.includes('vent_salvo') && p.ventCooldownMs <= 0) {
        p.ventCooldownMs = 3500;
        p.heat = Math.max(0, p.heat - 35);
        syncOverloadState(p);
        activateSalvoSkill(state, input, bus);
      }
    }
    if (p.isOverloaded) {
      spawnParticleBurst(state, p.x, p.y, 0xff3355, 3, 2.2, 2.8, 12, 0.5);
    } else if (p.heat >= p.maxHeat * 0.6) {
      spawnParticleBurst(state, p.x, p.y, 0xffaa22, 1, 1.4, 1.8, 10, 0.4);
    }
    bus.emit('PLAYER_SHOOT', {
      multishot: totalBulletsSpawned,
      piercing: anyPiercing,
    });
  }
}

export function cyclePlayerSkillMode(
  state: GameState,
  bus: EventBus,
  _forcedMode?: SkillMode
): void {
  const mountedSkill = state.player.loadout.slots.skill_1;
  if (!mountedSkill || WEAPON_CATALOG[mountedSkill.weaponId].kind !== 'skill') {
    return;
  }
  const actualMode = (WEAPON_CATALOG[mountedSkill.weaponId] as SkillWeaponCatalogEntry).skillMode;
  const changed = state.player.skill.mode !== actualMode;
  state.player.skill.mode = actualMode;
  syncSkillStatsFromLoadout(state);
  if (changed) {
    bus.emit('SKILL_MODE_CHANGED', { mode: actualMode });
  }
}

function gatherSortedTargets(
  state: GameState
): Array<{ id: number; x: number; y: number; dist: number; isBoss: boolean }> {
  const p = state.player;
  const targets: Array<{ id: number; x: number; y: number; dist: number; isBoss: boolean }> = [];
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    targets.push({
      id: e.id,
      x: e.x,
      y: e.y,
      dist: Math.hypot(e.x - p.x, e.y - p.y),
      isBoss: false,
    });
  }
  if (state.boss && !state.boss.entering && !state.boss.dying && state.boss.hp > 0) {
    targets.push({
      id: state.boss.id,
      x: state.boss.x,
      y: state.boss.y,
      dist: Math.hypot(state.boss.x - p.x, state.boss.y - p.y),
      isBoss: true,
    });
  }
  targets.sort((a, b) => a.dist - b.dist);
  return targets;
}

function activateSalvoSkill(state: GameState, input: InputSnapshot, bus: EventBus): void {
  const p = state.player;
  const aim = getAimVector(state, input);
  const targets = gatherSortedTargets(state);
  const missileCount = Math.min(8, 2 + Math.max(0, p.skill.level - 1));

  for (let i = 0; i < missileCount; i++) {
    const tgt = targets.length > 0 ? targets[i % targets.length] : null;
    const fanSpread = missileCount > 1 ? ((i / (missileCount - 1)) - 0.5) * 1.45 : 0;
    const launchAngle = aim.angle + fanSpread;
    state.bombs.push({
      id: nextId(state),
      x: p.x + Math.cos(launchAngle) * 12,
      y: p.y + Math.sin(launchAngle) * 12,
      angle: launchAngle,
      speed: 9.2,
      turnSpeed: 0.145,
      targetId: tgt ? tgt.id : null,
      lifeTicks: 155,
      radius: 13,
    });
  }

  spawnParticleBurst(state, p.x, p.y, 0xff8833, 20, 3.2, 4.2, 18);
  addScreenShake(state, 7);
  bus.emit('BOMB_LAUNCHED', { x: p.x, y: p.y });
}

function activateRailBeamSkill(state: GameState, input: InputSnapshot, bus: EventBus): void {
  const p = state.player;
  const s = p.skill;
  const aim = getAimVector(state, input);
  p.targetAngle = aim.angle;
  p.facingAngle = aim.angle;

  const length = 980;
  const width = 28 + s.level * 5;
  const dmgMult = hasBuff(state, 'damage') ? 1.5 : 1.0;
  const beamDamage = Math.floor(s.damage * 1.15 * dmgMult);

  state.playerBeams.push({
    id: nextId(state),
    x: p.x,
    y: p.y,
    angle: aim.angle,
    length,
    width,
    life: 24,
    maxLife: 24,
    hex: 0x38f0ff,
  });

  const dx = Math.cos(aim.angle);
  const dy = Math.sin(aim.angle);
  let hits = 0;
  let bulletsCleared = 0;

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const relX = e.x - p.x;
    const relY = e.y - p.y;
    const proj = relX * dx + relY * dy;
    if (proj < -16 || proj > length) continue;
    const perp = Math.abs(relX * -dy + relY * dx);
    if (perp <= width * 0.6 + e.radius) {
      hits++;
      applyElementalImpact(state, e, beamDamage, 'kinetic', bus);
      applyDirectEnemyDamage(state, e, beamDamage, true, bus, '#44f0ff', 0x44f0ff);
    }
  }

  const raidObj = state.raid?.activeObjective;
  if (raidObj && !raidObj.completed && raidObj.kind !== 'vault') {
    const relX = raidObj.x - p.x;
    const relY = raidObj.y - p.y;
    const proj = relX * dx + relY * dy;
    const perp = Math.abs(relX * -dy + relY * dx);
    if (proj >= -16 && proj <= length && perp <= width * 0.6 + raidObj.radius) {
      hits++;
      damageRaidObjective(state, beamDamage, raidObj.x, raidObj.y, bus, true);
    }
  }

  if (state.boss && !state.boss.entering && !state.boss.dying) {
    const boss = state.boss;
    const checkLine = (tx: number, ty: number, r: number): boolean => {
      const relX = tx - p.x;
      const relY = ty - p.y;
      const proj = relX * dx + relY * dy;
      const perp = Math.abs(relX * -dy + relY * dx);
      return proj >= -16 && proj <= length && perp <= width * 0.6 + r;
    };
    for (const py of [...boss.pylons]) {
      if (checkLine(py.x, py.y, py.radius)) {
        hits++;
        hitBossPylon(state, boss, py, beamDamage, true, bus);
      }
    }
    for (const cl of [...boss.clones]) {
      if (checkLine(cl.x, cl.y, cl.radius)) {
        hits++;
        hitBossClone(state, boss, cl, beamDamage, true, bus);
      }
    }
    if (checkLine(boss.x, boss.y, boss.radius)) {
      hits++;
      hitBoss(state, boss, beamDamage, true, boss.x, boss.y, bus);
    }
    if (boss.twin && !boss.dying && checkLine(boss.twin.x, boss.twin.y, boss.twin.radius)) {
      hits++;
      boss.twin.hitFlash = 1.0;
      hitBoss(state, boss, beamDamage, true, boss.twin.x, boss.twin.y, bus);
    }
  }

  state.bullets = state.bullets.filter((b) => {
    if (!b.isEnemy) return true;
    const relX = b.x - p.x;
    const relY = b.y - p.y;
    const proj = relX * dx + relY * dy;
    const perp = Math.abs(relX * -dy + relY * dx);
    if (proj >= -12 && proj <= length && perp <= width * 0.72 + b.radius) {
      bulletsCleared++;
      spawnParticleBurst(state, b.x, b.y, 0x66ffff, 3, 1.5, 2.2, 10);
      return false;
    }
    return true;
  });

  const clampedBack = clampPointToStorm(p.x - dx * 8, p.y - dy * 8, state.stormRing, -260);
  p.x = clampedBack.x;
  p.y = clampedBack.y;
  addScreenShake(state, 18);
  triggerHitStop(state, 38);
  spawnShockwave(state, p.x + dx * 26, p.y + dy * 26, 72, 0x38f0ff, 18);
  spawnParticleBurst(state, p.x + dx * 22, p.y + dy * 22, 0x88ffff, 24, 4.5, 4.2, 20);
  bus.emit('SKILL_RAILBEAM', { x: p.x, y: p.y, angle: aim.angle, hits, bulletsCleared });
}

function activateEmpSkill(state: GameState, bus: EventBus): void {
  const p = state.player;
  const s = p.skill;
  const empRadius = Math.max(115, s.radius * 1.25);
  const dmgMult = hasBuff(state, 'damage') ? 1.5 : 1.0;
  const baseDmg = Math.floor(s.damage * 1.0 * dmgMult);

  let bulletsCleared = 0;
  state.bullets = state.bullets.filter((b) => {
    if (!b.isEnemy) return true;
    if (Math.hypot(b.x - p.x, b.y - p.y) <= empRadius) {
      bulletsCleared++;
      spawnParticleBurst(state, b.x, b.y, 0x88ffff, 3, 1.4, 2.0, 10);
      return false;
    }
    return true;
  });

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= empRadius) {
      const nx = d > 0.001 ? dx / d : Math.cos(e.sectorAngle);
      const ny = d > 0.001 ? dy / d : Math.sin(e.sectorAngle);
      const pushed = clampPointToStorm(e.x + nx * 45, e.y + ny * 45, state.stormRing, -120);
      e.x = pushed.x;
      e.y = pushed.y;
      e.strafeTimer = Math.max(e.strafeTimer, 20);
    }
  }

  // Arc chain lightning across the nearest cluster of bad guys
  const maxJumps = Math.min(10, 2 + s.level);
  const maxHopDist = 290;
  const hitIds = new Set<number>();
  const points: Vec2[] = [{ x: p.x, y: p.y }];
  let curX = p.x;
  let curY = p.y;
  let chains = 0;

  for (let step = 0; step < maxJumps; step++) {
    let bestEnemy: (typeof state.enemies)[number] | null = null;
    let bestDist = step === 0 ? Math.max(empRadius, 320) : maxHopDist;
    let bossCandidateDist = Infinity;
    let bossCandidateIsTwin = false;

    for (const e of state.enemies) {
      if (e.hp <= 0 || hitIds.has(e.id)) continue;
      const d = Math.hypot(e.x - curX, e.y - curY);
      if (d < bestDist) {
        bestDist = d;
        bestEnemy = e;
      }
    }

    if (
      state.boss &&
      !state.boss.entering &&
      !state.boss.dying &&
      !hitIds.has(state.boss.id)
    ) {
      const d = Math.hypot(state.boss.x - curX, state.boss.y - curY);
      if (d < bestDist) {
        bossCandidateDist = d;
        bossCandidateIsTwin = false;
      }
    }
    if (
      state.boss &&
      state.boss.twin &&
      !state.boss.entering &&
      !state.boss.dying &&
      !hitIds.has(-(state.boss.id * 10 + 1))
    ) {
      const d = Math.hypot(state.boss.twin.x - curX, state.boss.twin.y - curY);
      if (d < bestDist && d < bossCandidateDist) {
        bossCandidateDist = d;
        bossCandidateIsTwin = true;
      }
    }

    let subCandidateDist = Infinity;
    let bestPylon: BossPylon | null = null;
    let bestClone: BossClone | null = null;
    if (state.boss && !state.boss.entering && !state.boss.dying) {
      for (const py of state.boss.pylons) {
        if (py.hp <= 0 || hitIds.has(py.id)) continue;
        const d = Math.hypot(py.x - curX, py.y - curY);
        if (d < bestDist && d < subCandidateDist) {
          subCandidateDist = d;
          bestPylon = py;
          bestClone = null;
        }
      }
      for (const cl of state.boss.clones) {
        if (cl.hp <= 0 || hitIds.has(cl.id)) continue;
        const d = Math.hypot(cl.x - curX, cl.y - curY);
        if (d < bestDist && d < subCandidateDist) {
          subCandidateDist = d;
          bestClone = cl;
          bestPylon = null;
        }
      }
    }

    const stepDamage = Math.floor(baseDmg * Math.max(0.6, 1 - step * 0.08));

    if ((bestPylon || bestClone) && subCandidateDist <= bossCandidateDist && state.boss) {
      const boss = state.boss;
      if (bestPylon) {
        hitIds.add(bestPylon.id);
        chains++;
        points.push({ x: bestPylon.x, y: bestPylon.y });
        curX = bestPylon.x;
        curY = bestPylon.y;
        hitBossPylon(state, boss, bestPylon, stepDamage, false, bus);
      } else if (bestClone) {
        hitIds.add(bestClone.id);
        chains++;
        points.push({ x: bestClone.x, y: bestClone.y });
        curX = bestClone.x;
        curY = bestClone.y;
        hitBossClone(state, boss, bestClone, stepDamage, false, bus);
      }
    } else if (bossCandidateDist < bestDist && state.boss) {
      const boss = state.boss;
      if (bossCandidateIsTwin && boss.twin) {
        hitIds.add(-(boss.id * 10 + 1));
        chains++;
        points.push({ x: boss.twin.x, y: boss.twin.y });
        boss.twin.hitFlash = 1.0;
        const tx = boss.twin.x;
        const ty = boss.twin.y;
        hitBoss(state, boss, stepDamage, false, tx, ty, bus);
        curX = tx;
        curY = ty;
      } else {
        hitIds.add(boss.id);
        chains++;
        points.push({ x: boss.x, y: boss.y });
        hitBoss(state, boss, stepDamage, false, boss.x, boss.y, bus);
        curX = boss.x;
        curY = boss.y;
      }
    } else if (bestEnemy) {
      hitIds.add(bestEnemy.id);
      chains++;
      points.push({ x: bestEnemy.x, y: bestEnemy.y });
      applyElementalImpact(state, bestEnemy, stepDamage, 'ion', bus);
      applyDirectEnemyDamage(state, bestEnemy, stepDamage, step === 0, bus, '#77eeff', 0x77eeff);
      curX = bestEnemy.x;
      curY = bestEnemy.y;
    } else {
      break;
    }
  }

  if (points.length >= 2) {
    state.lightningArcs.push({
      id: nextId(state),
      points,
      life: 26,
      maxLife: 26,
      hex: 0x66f0ff,
    });
  }

  addScreenShake(state, 16);
  triggerHitStop(state, 32);
  spawnShockwave(state, p.x, p.y, empRadius, 0x44f0ff, 26);
  spawnShockwave(state, p.x, p.y, empRadius * 0.65, 0xaa66ff, 18);
  spawnParticleBurst(state, p.x, p.y, 0x66f0ff, 34, 5.8, 4.6, 26);
  bus.emit('SKILL_EMP', { x: p.x, y: p.y, radius: empRadius, chains, bulletsCleared });
}

function activatePlayerSkill(state: GameState, input: InputSnapshot, bus: EventBus): void {
  const p = state.player;
  const s = p.skill;
  const mounted = p.loadout.slots.skill_1;
  if (!mounted) return;

  const skEntry = WEAPON_CATALOG[mounted.weaponId];
  if (skEntry.kind !== 'skill') return;
  // What's bolted onto the spine slot IS your skill — no sneaky juggling
  s.mode = (skEntry as SkillWeaponCatalogEntry).skillMode;

  if (state.simTimeMs - s.lastUseMs < s.cooldownMs || p.energy < s.cost) return;

  p.energy -= s.cost;
  s.lastUseMs = state.simTimeMs;

  p.heat = Math.max(0, Math.min(p.maxHeat + 18, p.heat + (skEntry.heatPerCast ?? 10)));
  syncOverloadState(p);

  if (s.mode === 'railbeam') {
    activateRailBeamSkill(state, input, bus);
  } else if (s.mode === 'emp') {
    activateEmpSkill(state, bus);
  } else {
    activateSalvoSkill(state, input, bus);
  }
}

function triggerShieldNovaBlast(state: GameState, bus: EventBus, stacks: number): void {
  const p = state.player;
  const radius = 155 + stacks * 28;
  const dmg = 34 + stacks * 24;
  state.bullets = state.bullets.filter((b) => {
    if (!b.isEnemy) return true;
    if (Math.hypot(b.x - p.x, b.y - p.y) <= radius * 0.72) {
      spawnParticleBurst(state, b.x, b.y, 0x38e8ff, 3, 1.8, 2.5, 10);
      return false;
    }
    return true;
  });
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= radius + e.radius) {
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      const pushed = clampPointToStorm(e.x + nx * 38, e.y + ny * 38, state.stormRing, -120);
      e.x = pushed.x;
      e.y = pushed.y;
      applyElementalImpact(state, e, dmg, 'ion', bus);
      applyDirectEnemyDamage(state, e, dmg, false, bus, '#38e8ff', 0x38e8ff);
    }
  }
  spawnShockwave(state, p.x, p.y, radius, 0x38e8ff, 18);
}

export function activateChronoOverdrive(state: GameState, bus: EventBus): boolean {
  const p = state.player;
  if (p.chronoActiveMs > 0 || p.chronoCharge < 100) return false;
  const archCounts = computeMutationArchetypeCounts(p.activeMutations);
  const archDurationMult = archCounts.chrono >= 2 ? 1.25 : 1.0;
  const durationMs = Math.round(p.chronoMaxMs * archDurationMult);

  p.chronoCharge = 0;
  p.chronoActiveMs = durationMs;
  state.timeScale = 0.30;

  addScreenShake(state, 10);
  triggerHitStop(state, 28);
  spawnShockwave(state, p.x, p.y, 240, 0x38e8ff, 26);
  spawnShockwave(state, p.x, p.y, 150, 0x818cf8, 20);
  spawnParticleBurst(state, p.x, p.y, 0x38e8ff, 28, 5.2, 4.2, 24);
  spawnFloatingText(state, p.x, p.y - 32, 'CHRONO OVERDRIVE!', '#38e8ff', 1.3, 44);
  bus.emit('CHRONO_STARTED', { durationMs });
  return true;
}

export function activateThermalPurge(state: GameState, bus: EventBus): boolean {
  const p = state.player;
  if (p.heat < p.maxHeat * 0.6 || p.thermalPurgeCooldownMs > 0) return false;

  const supernovaStacks = countMutationStacks(p.activeMutations, 'thermal_supernova');
  const archCounts = computeMutationArchetypeCounts(p.activeMutations);
  const heatUsed = p.heat;
  p.heat = 0;
  p.isOverloaded = false;
  p.thermalPurgeCooldownMs = archCounts.solar >= 2 ? 2400 : 3000;

  const purgeRadius = 195 + supernovaStacks * 65 + (archCounts.solar >= 2 ? 35 : 0);
  const dmgMult = 1 + supernovaStacks * 0.45 + (archCounts.solar >= 2 ? 0.25 : 0);
  const purgeDmg = Math.round((65 + Math.round(heatUsed * 1.1)) * dmgMult);

  state.bullets = state.bullets.filter((b) => {
    if (!b.isEnemy) return true;
    if (Math.hypot(b.x - p.x, b.y - p.y) <= purgeRadius) {
      spawnParticleBurst(state, b.x, b.y, 0xffaa33, 3, 1.8, 2.5, 10);
      return false;
    }
    return true;
  });

  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= purgeRadius + e.radius) {
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      const pushed = clampPointToStorm(e.x + nx * 46, e.y + ny * 46, state.stormRing, -120);
      e.x = pushed.x;
      e.y = pushed.y;
      applyElementalImpact(state, e, purgeDmg, 'burn', bus);
      applyDirectEnemyDamage(state, e, purgeDmg, true, bus, '#ff8833', 0xff7722);
    }
  }

  for (const ob of [...state.arenaObstacles]) {
    if (Math.hypot(ob.x - p.x, ob.y - p.y) <= purgeRadius + ob.radius) {
      damageArenaObstacle(state, ob, purgeDmg, bus);
    }
  }

  const raidObj = state.raid?.activeObjective;
  if (raidObj && !raidObj.completed && raidObj.kind !== 'vault') {
    if (Math.hypot(raidObj.x - p.x, raidObj.y - p.y) <= purgeRadius + raidObj.radius) {
      damageRaidObjective(state, purgeDmg, raidObj.x, raidObj.y, bus, true);
    }
  }

  if (state.boss && !state.boss.entering && !state.boss.dying) {
    const boss = state.boss;
    if (Math.hypot(boss.x - p.x, boss.y - p.y) <= purgeRadius + boss.radius) {
      boss.burnMs = Math.max(boss.burnMs ?? 0, 4000);
      hitBoss(state, boss, purgeDmg, true, boss.x, boss.y, bus);
    }
  }

  addScreenShake(state, 15);
  triggerHitStop(state, 32);
  spawnShockwave(state, p.x, p.y, purgeRadius, 0xff7b29, 24);
  spawnShockwave(state, p.x, p.y, purgeRadius * 0.65, 0x38e8ff, 18);
  spawnParticleBurst(state, p.x, p.y, 0xff8833, 34, 6.2, 4.6, 26);
  spawnFloatingText(state, p.x, p.y - 28, 'THERMAL PURGE!', '#ff9f1c', 1.25, 38);
  bus.emit('THERMAL_PURGE', { x: p.x, y: p.y, radius: purgeRadius });
  return true;
}

export function damagePlayer(
  state: GameState,
  bus: EventBus,
  damage: number,
  allowShieldBlock = true,
  triggerGameOver?: () => void
): void {
  const p = state.player;
  if (p.shieldActive || state.simTimeMs < p.dashInvulnUntilMs) return;

  if (allowShieldBlock && p.shieldCooldownMs <= 0) {
    p.shieldActive = true;
    p.shieldStartMs = state.simTimeMs;
    p.shieldCooldownMs = p.shieldCooldownMaxMs;
    addScreenShake(state, 10);
    spawnShockwave(state, p.x, p.y, 68, 0x00ffdd, 20);
    spawnParticleBurst(state, p.x, p.y, 0x00ffdd, 22, 3.4, 4, 24);
    const shieldNovaStacks = countMutationStacks(p.activeMutations, 'shield_nova');
    if (shieldNovaStacks > 0) {
      triggerShieldNovaBlast(state, bus, shieldNovaStacks);
    }
    bus.emit('SHIELD_TRIGGERED', { x: p.x, y: p.y });
    bus.emit('PLAYER_HIT', { damage: 0, shielded: true });
    return;
  }

  p.health = Math.max(0, p.health - damage);
  p.dashInvulnUntilMs = Math.max(p.dashInvulnUntilMs, state.simTimeMs + 520);
  addScreenShake(state, 14);
  spawnParticleBurst(state, p.x, p.y, 0xff3344, 14, 3.2, 4, 22);
  bus.emit('PLAYER_HIT', { damage, shielded: false });

  if (p.health <= 0) {
    triggerGameOver?.();
  }
}

let lastStormBurnEmitMs = -9999;

export function updatePlayerSystem(
  state: GameState,
  input: InputSnapshot,
  bus: EventBus,
  dtSec: number,
  dtMs: number,
  triggerGameOver?: () => void
): void {
  const p = state.player;
  const now = state.simTimeMs;

  if (p.shieldActive && now - p.shieldStartMs >= p.shieldDurationMs) {
    p.shieldActive = false;
  }

  if (p.shieldCooldownMs > 0 && !p.shieldActive) {
    p.shieldCooldownMs = Math.max(0, p.shieldCooldownMs - dtMs);
  }

  const syn = computeActiveSynergies(p);
  const energyMult =
    (state.sectorHazard === 'magnetic_nebula' ? 1.4 : 1.0) * (syn.tiers.NOVACORP >= 3 ? 1.25 : 1.0);

  if (p.energy < p.maxEnergy && now - p.lastDashEndMs >= PLAYER_BASE.energyDelayAfterDashMs) {
    p.energy = Math.min(p.maxEnergy, p.energy + p.energyRegen * energyMult * dtSec);
  }

  // Cooling & overload burn: Cryo-Sinks let you hold fire way longer before roasting your own hull
  p.coolingRate = computePlayerCoolingRate(state);
  if (p.ventCooldownMs > 0) p.ventCooldownMs = Math.max(0, p.ventCooldownMs - dtMs);
  if (p.thermalPurgeCooldownMs > 0) {
    p.thermalPurgeCooldownMs = Math.max(0, p.thermalPurgeCooldownMs - dtMs);
  }
  const hasThermalSink = Object.values(p.loadout.slots).some((m) => m?.weaponId === 'thermal_sink');
  const coolDelayMs = hasThermalSink ? 180 : 340;
  const isActivelyFiring = p.lastShotMs > 0 && now - p.lastShotMs < coolDelayMs;
  const effectiveCooling = isActivelyFiring
    ? p.coolingRate * (hasThermalSink ? 0.78 : 0.42)
    : p.isOverloaded
      ? p.coolingRate * 1.45
      : p.coolingRate;

  if (p.heat > 0) {
    p.heat = Math.max(0, p.heat - effectiveCooling * dtSec);
  }
  syncOverloadState(p);
  if (p.isOverloaded && !state.isResting && p.health > 0) {
    const burnRate = syn.tiers.IRONFORGE >= 3 ? 0.008 : 0.018;
    p.health = Math.max(1, p.health - p.maxHealth * burnRate * dtSec);
  }

  // Step outside the shrinking storm ring and your hull pays rent every second
  const ring = state.stormRing;
  const distFromCenter = Math.hypot(p.x - ring.centerX, p.y - ring.centerY);
  ring.outsideStorm = !state.isResting && !state.waveTransition.active && distFromCenter > ring.radius;
  state.radiationMargin = 0;
  if (ring.outsideStorm && p.health > 0) {
    p.health = Math.max(0, p.health - ring.damagePerSec * dtSec);
    if (state.simTimeMs < lastStormBurnEmitMs || state.simTimeMs - lastStormBurnEmitMs >= 420) {
      lastStormBurnEmitMs = state.simTimeMs;
      bus.emit('STORM_BURN_TICK', { x: p.x, y: p.y });
    }
    if (p.health <= 0) {
      triggerGameOver?.();
      return;
    }
  }

  if (p.hpRegen > 0 && p.health > 0 && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + p.hpRegen * dtSec);
  }

  if (p.overclockBuffMs > 0) {
    p.overclockBuffMs = Math.max(0, p.overclockBuffMs - dtMs);
  }
  if (p.ramShieldMs > 0) {
    p.ramShieldMs = Math.max(0, p.ramShieldMs - dtMs);
  }
  if (p.chronoActiveMs > 0) {
    p.chronoActiveMs = Math.max(0, p.chronoActiveMs - dtMs);
    state.timeScale = p.chronoActiveMs > 0 ? 0.30 : 1.0;
    if (p.chronoActiveMs <= 0) {
      bus.emit('CHRONO_ENDED');
    }
  } else if (state.timeScale !== 1.0) {
    state.timeScale = 1.0;
  }

  p.shotRecoil = Math.max(0, p.shotRecoil - dtSec * 8);

  const hasMoveInput = Math.hypot(input.moveX, input.moveY) > 0.08;

  // Hit Shift to dash through trouble (and open a short parry window on impact)
  if (
    input.dash &&
    !p.dashActive &&
    hasMoveInput &&
    p.energy >= p.dashCost &&
    now - p.dashStartMs >= p.dashCooldownMs
  ) {
    const mag = Math.hypot(input.moveX, input.moveY);
    p.dashDirX = input.moveX / mag;
    p.dashDirY = input.moveY / mag;
    p.dashActive = true;
    p.dashStartMs = now;
    p.dashInvulnUntilMs = now + PLAYER_BASE.dashInvulnMs;
    const parryBonusMs =
      (p.hullId === 'interceptor' ? 55 : 0) +
      countMutationStacks(p.activeMutations, 'parry_overload') * 45;
    p.dashParryUntilMs = now + 135 + parryBonusMs;
    p.energy -= p.dashCost;
    if (p.loadout.activeAugments.includes('kinetic_aegis')) {
      p.heat = Math.max(0, p.heat - 18);
      syncOverloadState(p);
      p.skill.lastUseMs -= 1000;
    }
    if (p.hullId === 'juggernaut' || countMutationStacks(p.activeMutations, 'comet_overheat') > 0) {
      p.ramShieldMs = Math.max(p.ramShieldMs, 380);
    }
    const singularityStacks = countMutationStacks(p.activeMutations, 'dash_singularity');
    if (singularityStacks > 0) {
      if (state.singularities.length >= 3) {
        state.singularities.shift();
      }
      state.singularities.push({
        id: nextId(state),
        x: p.x,
        y: p.y,
        radius: 175 + singularityStacks * 25,
        lifeMs: 2600,
        maxLifeMs: 2600,
        damage: 24 + singularityStacks * 18,
        hex: 0xa855f7,
        pulsesLeft: 5,
      });
      spawnShockwave(state, p.x, p.y, 120, 0xa855f7, 18);
    }
    spawnShockwave(state, p.x, p.y, 44, 0x00ffff, 14);
    spawnParticleBurst(state, p.x, p.y, 0x00ffff, 12, 3, 3.2, 16);
    bus.emit('PLAYER_DASH', { x: p.x, y: p.y });
  }

  let vx = 0;
  let vy = 0;

  if (p.dashActive) {
    if (now - p.dashStartMs < PLAYER_BASE.dashDurationMs) {
      vx = p.dashDirX * p.dashSpeed;
      vy = p.dashDirY * p.dashSpeed;
      p.moving = true;

      state.afterimages.push({
        x: p.x,
        y: p.y,
        angle: p.facingAngle,
        life: 12,
        maxLife: 12,
      });
    } else {
      p.dashActive = false;
      p.lastDashEndMs = now;
      const shieldNovaStacks = countMutationStacks(p.activeMutations, 'shield_nova');
      if (shieldNovaStacks > 0) {
        triggerShieldNovaBlast(state, bus, shieldNovaStacks);
      }
    }
  }

  if (!p.dashActive) {
    const hullSpeedMult = HULL_CATALOG[p.hullId]?.speedMult ?? 1.0;
    const speedMult =
      (hasBuff(state, 'speed') ? 1.45 : 1.0) *
      hullSpeedMult *
      (p.chronoActiveMs > 0 ? 1.18 : 1.0);
    const moveSpeed = p.speed * speedMult;
    const targetVx = hasMoveInput ? input.moveX * moveSpeed : 0;
    const targetVy = hasMoveInput ? input.moveY * moveSpeed : 0;
    const accelRate = hasMoveInput ? 16 : state.sectorHazard === 'magnetic_nebula' ? 6.2 : 10.5;
    const blend = Math.min(1, dtSec * accelRate);
    vx = p.vx + (targetVx - p.vx) * blend;
    vy = p.vy + (targetVy - p.vy) * blend;
    if (!hasMoveInput && Math.hypot(vx, vy) < 0.04) {
      vx = 0;
      vy = 0;
    }
    p.moving = hasMoveInput || Math.hypot(vx, vy) > 0.12;
    if (hasMoveInput && input.aimMode === 'auto' && !input.shoot) {
      p.targetAngle = Math.atan2(input.moveY, input.moveX);
    }
  }

  p.vx = vx;
  p.vy = vy;
  // Soft leash well outside the ring so nobody flies off into the next solar system
  const softTether = clampPointToStorm(p.x + vx, p.y + vy, state.stormRing, -460);
  p.x = softTether.x;
  p.y = softTether.y;

  // Hand the closest target to the HUD lock-on reticle
  p.lockedTarget = findNearestTarget(state);

  // Keep the nose pointed at the cursor even between bursts
  if (input.aimMode === 'mouse' && input.mouseActive) {
    state.aimWorldX = input.mouseArenaX;
    state.aimWorldY = input.mouseArenaY;
    state.aimWorldActive = true;
    p.targetAngle = Math.atan2(input.mouseArenaY - p.y, input.mouseArenaX - p.x);
  } else {
    state.aimWorldActive = false;
    state.aimWorldX = p.x + Math.cos(p.facingAngle) * 140;
    state.aimWorldY = p.y + Math.sin(p.facingAngle) * 140;
    if (input.shoot) {
      const aim = getAimVector(state, input);
      p.targetAngle = aim.angle;
    }
  }

  // Smooth ship rotation lives in the sim so tests and 3D renderers never disagree on facing
  let angleDiff = p.targetAngle - p.facingAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  p.facingAngle += angleDiff * Math.min(1, dtSec * 14);

  // Bank the wings into turns using lateral strafe speed — makes flying look twice as dramatic
  const rightX = -Math.sin(p.facingAngle);
  const rightY = Math.cos(p.facingAngle);
  const lateralVel = vx * rightX + vy * rightY;
  const targetBank = Math.max(-0.55, Math.min(0.55, lateralVel * 0.14));
  p.bankAngle += (targetBank - p.bankAngle) * Math.min(1, dtSec * 10);

  // Settle gun kickback springs per hardpoint
  for (const slotId of Object.keys(p.loadout.slots) as ShipSlotId[]) {
    const mounted = p.loadout.slots[slotId];
    if (mounted && mounted.recoil > 0) {
      mounted.recoil = Math.max(0, mounted.recoil - dtSec * 8);
    }
  }

  // Each mounted gun tracks its own fire-rate timer independently
  if (input.shoot) {
    firePlayerWeapons(state, input, bus);
  }

  // Hit [F] or Middle Mouse when full to bend time like a sci-fi movie
  if (input.chrono) {
    activateChronoOverdrive(state, bus);
  }

  // Hit [R] above 60% Heat to dump excess fire right onto nearby enemies
  if (input.vent) {
    activateThermalPurge(state, bus);
  }

  // Hit [E] or Right Mouse to fire whatever dorsal toy you bolted on
  if (input.bomb) {
    activatePlayerSkill(state, input, bus);
  }
}
