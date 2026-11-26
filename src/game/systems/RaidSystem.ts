import { SHOP_ITEMS, type ShopItemId } from '../../config/shopItems';
import {
  PRIMARY_WEAPON_IDS,
  SHIP_GRID_SLOTS,
  SHIP_SLOT_MAP,
  SKILL_WEAPON_IDS,
  WEAPON_CATALOG,
  type ShipSlotId,
  type SkillWeaponCatalogEntry,
} from '../../config/weapons';
import type { EventBus } from '../../engine/EventBus';
import {
  addScreenShake,
  clampPointToStorm,
  createIdleTransitionBeat,
  createInitialRaidState,
  nextId,
  randomPointInStorm,
  spawnFloatingText,
  spawnParticleBurst,
  spawnShockwave,
  triggerHitStop,
  vacuumAndCollectPickupsStep,
} from '../GameState';
import type {
  GameState,
  MountedWeapon,
  QuickDraftOption,
  RaidObjectiveEntity,
  RaidObjectiveKind,
} from '../types';
import { createBoss } from './BossSystem';
import { computeOffscreenSpawnPoint, createEnemy } from './EnemySystem';
import { buildRoomQuickDraft } from './RoomSystem';
import {
  applyShopUpgrade,
  getMountedWeaponUpgradePrice,
  getShopItemPrice,
  isMountedWeaponUpgradeMaxed,
  isShopItemMaxed,
  syncSkillStatsFromLoadout,
} from './ShopSystem';
import { configureStormRingForWave } from './WaveSystem';

function spawnObstacle(
  state: GameState,
  kind: 'ore_asteroid' | 'plasma_barrel',
  x: number,
  y: number,
  radiusVariant = 0
): void {
  const sector = state.raid.sectorNumber;
  const radius = kind === 'plasma_barrel' ? 20 : 28 + (radiusVariant % 3) * 6;
  const maxHp = kind === 'plasma_barrel' ? 28 + sector * 8 : 80 + sector * 22;
  state.arenaObstacles.push({
    id: nextId(state),
    kind,
    x,
    y,
    radius,
    hp: maxHp,
    maxHp,
    rotAngle: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * (kind === 'plasma_barrel' ? 0.5 : 0.32),
    flash: 0,
    hex: kind === 'plasma_barrel' ? 0xff5a1f : 0x67e8f9,
  });
}

function isObstacleClear(
  state: GameState,
  x: number,
  y: number,
  minDist: number
): boolean {
  if (Math.hypot(x - state.player.x, y - state.player.y) < 185) return false;
  for (const ob of state.arenaObstacles) {
    if (Math.hypot(x - ob.x, y - ob.y) < minDist) return false;
  }
  return true;
}

function populateSectorObstacles(state: GameState): void {
  state.arenaObstacles = [];
  const totalAsteroids = 10;
  const totalBarrels = 5;

  for (let i = 0; i < totalAsteroids; i++) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = (i / totalAsteroids) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      const dist = 215 + Math.random() * 340;
      const pt = clampPointToStorm(
        state.player.x + Math.cos(ang) * dist,
        state.player.y + Math.sin(ang) * dist,
        state.stormRing,
        90
      );
      if (isObstacleClear(state, pt.x, pt.y, 115)) {
        spawnObstacle(state, 'ore_asteroid', pt.x, pt.y, i);
        break;
      }
    }
  }

  for (let i = 0; i < totalBarrels; i++) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = (i / totalBarrels) * Math.PI * 2 + 0.35 + (Math.random() - 0.5) * 0.5;
      const dist = 225 + Math.random() * 290;
      const pt = clampPointToStorm(
        state.player.x + Math.cos(ang) * dist,
        state.player.y + Math.sin(ang) * dist,
        state.stormRing,
        95
      );
      if (isObstacleClear(state, pt.x, pt.y, 95)) {
        spawnObstacle(state, 'plasma_barrel', pt.x, pt.y, i);
        break;
      }
    }
  }
}

function spawnSquadFormation(
  state: GameState,
  centerX: number,
  centerY: number,
  types: Array<'small' | 'medium' | 'large' | 'elite'>,
  ringDist = 115
): void {
  for (let i = 0; i < types.length; i++) {
    const ang = (i / Math.max(1, types.length)) * Math.PI * 2 + Math.random() * 0.45;
    const target = clampPointToStorm(
      centerX + Math.cos(ang) * ringDist,
      centerY + Math.sin(ang) * ringDist,
      state.stormRing,
      55
    );
    const e = createEnemy(state, types[i], false, undefined, i, types.length);
    const approachAng = Math.atan2(target.y - state.player.y, target.x - state.player.x);
    const off = computeOffscreenSpawnPoint(state, approachAng, (i % 2) * 50);
    e.x = off.x;
    e.y = off.y;
    e.ingressTargetX = target.x;
    e.ingressTargetY = target.y;
    e.ingressActive = true;
    e.faceAngle = Math.atan2(target.y - e.y, target.x - e.x);
    state.enemies.push(e);
  }
}

export function spawnNextRaidObjective(state: GameState, bus?: EventBus): void {
  const idx = state.raid.completedCount;
  const kind: RaidObjectiveKind = idx === 0 ? 'reactor' : idx === 1 ? 'vault' : 'convoy';
  const sector = state.raid.sectorNumber;
  const p = state.player;

  const ang = Math.random() * Math.PI * 2;
  const dist = 290 + Math.random() * 140;
  const spawnPt = clampPointToStorm(
    p.x + Math.cos(ang) * dist,
    p.y + Math.sin(ang) * dist,
    state.stormRing,
    125
  );

  // Shove stray rocks off the objective pad so nothing spawns wedged inside the reactor
  state.arenaObstacles = state.arenaObstacles.filter(
    (ob) => Math.hypot(ob.x - spawnPt.x, ob.y - spawnPt.y) > 85
  );

  let obj: RaidObjectiveEntity;
  if (kind === 'reactor') {
    const maxHp = 320 + sector * 135;
    obj = {
      id: nextId(state),
      kind: 'reactor',
      x: spawnPt.x,
      y: spawnPt.y,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 40,
      hp: maxHp,
      maxHp,
      progressMs: 0,
      maxProgressMs: 0,
      timeLeftMs: 0,
      maxTimeMs: 0,
      flash: 0,
      completed: false,
      failed: false,
      titleVi: 'LÒ NĂNG LƯỢNG ĐỊCH',
      titleEn: 'SECTOR REACTOR CORE',
      accentHex: 0xff3b4e,
    };
    spawnSquadFormation(state, obj.x, obj.y, ['small', 'small', 'medium'], 110);
    // Put explosive barrels next to the reactor — basically an invitation for fireworks
    for (const offsetAng of [ang + 0.75, ang - 0.75]) {
      const bp = clampPointToStorm(
        obj.x + Math.cos(offsetAng) * 105,
        obj.y + Math.sin(offsetAng) * 105,
        state.stormRing,
        60
      );
      spawnObstacle(state, 'plasma_barrel', bp.x, bp.y);
    }
  } else if (kind === 'vault') {
    obj = {
      id: nextId(state),
      kind: 'vault',
      x: spawnPt.x,
      y: spawnPt.y,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 34,
      hp: 999999,
      maxHp: 999999,
      progressMs: 0,
      maxProgressMs: 4500,
      timeLeftMs: 0,
      maxTimeMs: 0,
      flash: 0,
      completed: false,
      failed: false,
      titleVi: 'GIẢI MÃ HỘP ĐEN DỮ LIỆU',
      titleEn: 'DECRYPT BLACK-BOX VAULT',
      accentHex: 0x38e8ff,
    };
    spawnSquadFormation(state, obj.x, obj.y, ['small', 'medium', 'small'], 130);
  } else {
    const maxHp = 400 + sector * 155;
    const tangent = ang + Math.PI / 2;
    obj = {
      id: nextId(state),
      kind: 'convoy',
      x: spawnPt.x,
      y: spawnPt.y,
      vx: Math.cos(tangent) * 1.65,
      vy: Math.sin(tangent) * 1.65,
      angle: tangent,
      radius: 38,
      hp: maxHp,
      maxHp,
      progressMs: 0,
      maxProgressMs: 0,
      timeLeftMs: 28000,
      maxTimeMs: 28000,
      flash: 0,
      completed: false,
      failed: false,
      titleVi: 'CHẶN TÀU HÀNG HỢP KIM VÀNG',
      titleEn: 'INTERCEPT GOLD-ORE CONVOY',
      accentHex: 0xfbbf24,
    };
    spawnSquadFormation(
      state,
      obj.x,
      obj.y,
      sector >= 2 ? ['large', 'medium', 'small'] : ['medium', 'small', 'small'],
      125
    );
  }

  state.raid.activeObjective = obj;
  spawnShockwave(state, obj.x, obj.y, 120, obj.accentHex, 24);
  bus?.emit('RAID_OBJECTIVE_SPAWNED', { kind: obj.kind, x: obj.x, y: obj.y });
}

export function initSectorRaid(state: GameState, sectorNumber: number, bus?: EventBus): void {
  state.raid = createInitialRaidState(sectorNumber);
  state.bullets = [];
  state.bombs = [];
  state.healthPickup = null;
  populateSectorObstacles(state);
  spawnNextRaidObjective(state, bus);
}

function findBestOpenSlot(state: GameState, kind: 'primary' | 'skill'): ShipSlotId | null {
  const slots = state.player.loadout.slots;
  if (kind === 'skill') {
    return slots.skill_1 === null ? 'skill_1' : null;
  }
  const order: ShipSlotId[] = ['wing_r1', 'nose', 'wing_l2', 'wing_r2', 'wing_l1'];
  for (const sid of order) {
    if (slots[sid] === null) return sid;
  }
  return null;
}

export function buildQuickDraftOptions(state: GameState): QuickDraftOption[] {
  const options: QuickDraftOption[] = [];
  const slots = state.player.loadout.slots;
  const completed = state.raid.completedCount;

  // First draft slot: new toy for the ship (gun if wings have space, or a shiny dorsal skill)
  const needSkill = slots.skill_1 === null && (completed >= 2 || Math.random() < 0.45);
  if (needSkill) {
    const skId = SKILL_WEAPON_IDS[Math.floor(Math.random() * SKILL_WEAPON_IDS.length)];
    const skEntry = WEAPON_CATALOG[skId] as SkillWeaponCatalogEntry;
    options.push({
      id: `qd-skill-${nextId(state)}`,
      kind: 'skill',
      weaponId: skId,
      targetSlot: 'skill_1',
      titleVi: skEntry.nameVi,
      titleEn: skEntry.nameEn,
      descVi: `${skEntry.descVi} (Tự lắp vào lưng tàu)`,
      descEn: `${skEntry.descEn} (Auto-mount Spine)`,
      badgeVi: 'KỸ NĂNG CHỦ ĐỘNG [E]',
      badgeEn: 'ACTIVE SKILL [E]',
      accent: skEntry.accent,
      iconUrl: skEntry.iconUrl,
    });
  } else {
    const openPrimSlot = findBestOpenSlot(state, 'primary');
    // Offer a different weapon than wing_l1 when the right wing is free so players actually try combos
    const l1Id = slots.wing_l1?.weaponId;
    const comboCandidates = PRIMARY_WEAPON_IDS.filter((id) => id !== l1Id && id !== 'thermal_sink');
    const pool =
      openPrimSlot && comboCandidates.length > 0 ? comboCandidates : PRIMARY_WEAPON_IDS;
    const wId = pool[Math.floor(Math.random() * pool.length)];
    const wEntry = WEAPON_CATALOG[wId];
    const slotTag = openPrimSlot ? SHIP_SLOT_MAP[openPrimSlot].shortTag : 'KHO / GHÉP';
    options.push({
      id: `qd-wpn-${nextId(state)}`,
      kind: 'weapon',
      weaponId: wId,
      targetSlot: openPrimSlot ?? undefined,
      titleVi: wEntry.nameVi,
      titleEn: wEntry.nameEn,
      descVi: openPrimSlot
        ? `${wEntry.descVi} · Tự lắp vào ${slotTag}`
        : `${wEntry.descVi} · Thêm vào Kho để ghép Tier`,
      descEn: openPrimSlot
        ? `${wEntry.descEn} · Auto-mount ${slotTag}`
        : `${wEntry.descEn} · Stored in Armory`,
      badgeVi: openPrimSlot ? `LẮP NGAY · ${slotTag}` : 'MÔ-ĐUN KHO',
      badgeEn: openPrimSlot ? `MOUNT · ${slotTag}` : 'ARMORY DROP',
      accent: wEntry.accent,
      iconUrl: wEntry.iconUrl,
    });
  }

  // Second card: permanent hull-core upgrade (also bolts more armor bits onto the 3D ship)
  const preferredCores: ShopItemId[] = [
    'maxHealth',
    'speedBoost',
    'shield',
    'cryoCooler',
    'energyUpgrade',
    'regen',
    'fireRate',
    'bulletDamage',
  ];
  const validCores = preferredCores.filter((id) => !isShopItemMaxed(state, id));
  const corePool: ShopItemId[] = validCores.length > 0 ? validCores : preferredCores;
  const coreId = corePool[Math.floor(Math.random() * corePool.length)];
  const coreDef = SHOP_ITEMS[coreId];
  options.push({
    id: `qd-core-${nextId(state)}`,
    kind: 'core',
    coreItemId: coreId,
    titleVi: coreDef.nameVi,
    titleEn: coreDef.nameEn,
    descVi: coreDef.descVi,
    descEn: coreDef.descEn,
    badgeVi: 'NÂNG LÕI TÀU (HIỆN GIÁP 3D)',
    badgeEn: 'CHASSIS CORE UPGRADE',
    accent: coreDef.accent,
    iconUrl: coreDef.iconUrl,
  });

  // Third card: stimulus check + duct-tape hull repair
  const bounty = 135 + state.raid.sectorNumber * 45;
  options.push({
    id: `qd-bounty-${nextId(state)}`,
    kind: 'upgrade_bounty',
    creditsBonus: bounty,
    titleVi: `TIẾP TẾ +$${bounty} & CƯỜNG HÓA SÚNG`,
    titleEn: `FIELD OVERCLOCK +$${bounty}`,
    descVi: `Nhận +$${bounty}, hồi +35 HP và tự nâng +1 cấp vũ khí đang lắp.`,
    descEn: `Gain +$${bounty}, restore +35 HP, and upgrade one mounted weapon.`,
    badgeVi: 'KINH TẾ & SỬA CHỮA',
    badgeEn: 'BOUNTY & REPAIR',
    accent: '#fbbf24',
    iconUrl: './assets/icons/core_greed.png',
  });

  return options;
}

export function openRaidQuickDraftImmediate(state: GameState, bus?: EventBus): void {
  state.pacingTransition = createIdleTransitionBeat();
  vacuumAndCollectPickupsStep(state, 16, bus, true);
  const isHadesRoomReactor = state.currentRoomKind === 'reactor' && state.roomsTotalPerSector >= 5;
  const draftOpts = isHadesRoomReactor ? buildRoomQuickDraft(state) : buildQuickDraftOptions(state);
  state.popupReason = {
    source: 'raid_objective',
    kickerVi: isHadesRoomReactor
      ? 'LÒ PHẢN ỨNG PHÁT NỔ // TIẾP TẾ ĐỘT KÍCH'
      : `MỤC TIÊU ĐỘT KÍCH ${state.raid.completedCount}/${state.raid.totalRequired}`,
    kickerEn: isHadesRoomReactor
      ? 'REACTOR DESTROYED // RAID SUPPLY'
      : `RAID OBJECTIVE ${state.raid.completedCount}/${state.raid.totalRequired}`,
    titleVi: 'CHỌN NÂNG CẤP ĐỘT KÍCH',
    titleEn: 'SELECT RAID SUPPLY UPGRADE',
    reasonVi: isHadesRoomReactor
      ? 'Bạn đã phá hủy Lò Phản Ứng và thu hồi xong chiến lợi phẩm — chọn 1 nâng cấp.'
      : `Hoàn tất mục tiêu ${state.raid.completedCount}/${state.raid.totalRequired} & hút đủ vàng rơi — chọn 1 tiếp tế.`,
    reasonEn: isHadesRoomReactor
      ? 'Reactor Core shattered & dropped loot secured — pick 1 upgrade.'
      : `Completed sector objective ${state.raid.completedCount}/${state.raid.totalRequired} & secured loot — pick 1 upgrade.`,
  };
  state.raid.pendingQuickDraft = draftOpts;
  const prevPhase = state.phase;
  state.phase = 'QUICK_DRAFT';
  bus?.emit('QUICK_DRAFT_OPENED', { options: draftOpts });
  if (prevPhase !== 'QUICK_DRAFT') {
    bus?.emit('PHASE_CHANGED', { from: prevPhase, to: 'QUICK_DRAFT' });
  }
}

function completeRaidObjective(
  state: GameState,
  obj: RaidObjectiveEntity,
  bus: EventBus,
  grantLoot = true
): void {
  if (obj.completed) return;
  obj.completed = true;
  state.raid.completedCount++;
  state.raid.activeObjective = null;

  if (grantLoot) {
    const scoreGain = (obj.kind === 'convoy' ? 320 : 220) * state.raid.sectorNumber;
    state.score += scoreGain;
    spawnShockwave(state, obj.x, obj.y, 165, obj.accentHex, 26);
    spawnParticleBurst(state, obj.x, obj.y, obj.accentHex, 36, 5.2, 4.8, 30);
    spawnFloatingText(state, obj.x, obj.y - 22, `+${scoreGain}`, '#38e8ff', 1.3, 45);
    addScreenShake(state, 14);
    triggerHitStop(state, 34);

    const coinCount = obj.kind === 'convoy' ? 8 : 5;
    const coinVal = 24 + state.raid.sectorNumber * 12;
    for (let i = 0; i < coinCount; i++) {
      const a = (i / coinCount) * Math.PI * 2;
      state.goldPickups.push({
        id: nextId(state),
        x: obj.x,
        y: obj.y,
        vx: Math.cos(a) * (3.2 + Math.random() * 2.2),
        vy: Math.sin(a) * (3.2 + Math.random() * 2.2),
        value: coinVal,
        size: 6,
        age: 0,
        homing: false,
      });
    }
  }

  bus.emit('RAID_OBJECTIVE_COMPLETED', {
    kind: obj.kind,
    completedCount: state.raid.completedCount,
    totalRequired: state.raid.totalRequired,
  });

  const isHadesRoomReactor = state.currentRoomKind === 'reactor' && state.roomsTotalPerSector >= 5;
  if (isHadesRoomReactor) {
    state.roomsClearedTotal++;
  }

  if (state.pacingEnabled) {
    state.bullets = state.bullets.filter((b) => !b.isEnemy);
    state.scheduledBullets = [];
    state.pacingTransition = {
      kind: 'raid_reward',
      elapsedMs: 0,
      durationMs: 950,
      bannerTitleVi: 'HOÀN THÀNH MỤC TIÊU! // ĐANG HÚT CHIẾN LỢI PHẨM',
      bannerTitleEn: 'OBJECTIVE SECURED! // VACUUMING REWARDS',
      bannerSubVi: 'Thu hồi toàn bộ vàng & năng lượng trước khi mở thẻ tiếp tế...',
      bannerSubEn: 'Pulling dropped credits to hull before opening supply draft...',
      accent: `#${obj.accentHex.toString(16).padStart(6, '0')}`,
    };
    return;
  }

  openRaidQuickDraftImmediate(state, bus);
}

export function damageRaidObjective(
  state: GameState,
  dmg: number,
  hitX: number,
  hitY: number,
  bus: EventBus,
  isCrit = false
): boolean {
  const obj = state.raid.activeObjective;
  if (!obj || obj.completed || obj.kind === 'vault') return false;
  obj.hp = Math.max(0, obj.hp - dmg);
  obj.flash = 1.0;
  spawnParticleBurst(state, hitX, hitY, obj.accentHex, isCrit ? 7 : 4, 2.5, 3.2, 16);
  spawnFloatingText(
    state,
    hitX + (Math.random() - 0.5) * 14,
    hitY - 10,
    isCrit ? `${dmg}!` : `${dmg}`,
    isCrit ? '#ffee44' : '#ffb866',
    isCrit ? 1.2 : 0.9,
    24
  );
  if (obj.hp <= 0) {
    completeRaidObjective(state, obj, bus, true);
    return true;
  }
  return false;
}

export function pickQuickDraftOption(
  state: GameState,
  optionId: string,
  bus?: EventBus
): boolean {
  const idx = state.raid.pendingQuickDraft.findIndex((o) => o.id === optionId);
  if (idx === -1) return false;
  const opt = state.raid.pendingQuickDraft[idx];
  const l = state.player.loadout;

  if ((opt.kind === 'weapon' || opt.kind === 'skill') && opt.weaponId) {
    const entry = WEAPON_CATALOG[opt.weaponId];
    const newItem: MountedWeapon = {
      instanceId: `wpn-${nextId(state)}`,
      weaponId: opt.weaponId,
      tier: 1,
      upgrades: {},
      investedCredits: entry.price,
      lastFireMs: -10000,
      recoil: 0,
    };
    const slotId = opt.targetSlot && l.slots[opt.targetSlot] === null ? opt.targetSlot : findBestOpenSlot(state, entry.kind);
    if (slotId) {
      l.slots[slotId] = newItem;
      l.selectedSlot = slotId;
      if (entry.kind === 'skill') {
        state.player.skill.mode = (entry as SkillWeaponCatalogEntry).skillMode;
      }
      syncSkillStatsFromLoadout(state);
      bus?.emit('GARAGE_MOUNTED', { slotId, weaponId: opt.weaponId, salvageRefund: 0 });
    } else {
      l.inventory.push(newItem);
      bus?.emit('MODULE_COLLECTED', {
        weaponId: opt.weaponId,
        x: state.player.x,
        y: state.player.y,
      });
    }
  } else if (opt.kind === 'core' && opt.coreItemId) {
    state.shop.levels[opt.coreItemId] = (state.shop.levels[opt.coreItemId] ?? 0) + 1;
    applyShopUpgrade(state, opt.coreItemId);
  } else if (opt.kind === 'upgrade_bounty') {
    const credits = opt.creditsBonus ?? 150;
    state.money += credits;
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 35);
    // Freebie +1 level on one mounted weapon so no one leaves empty-handed
    for (const slotDef of SHIP_GRID_SLOTS) {
      const m = l.slots[slotDef.id];
      if (!m) continue;
      const tryKeys =
        WEAPON_CATALOG[m.weaponId].kind === 'skill'
          ? (['damage', 'cooldown', 'radius'] as const)
          : (['damage', 'fireRate', 'velocity'] as const);
      const openKey = tryKeys.find((k) => !isMountedWeaponUpgradeMaxed(m, k));
      if (openKey) {
        m.upgrades[openKey] = (m.upgrades[openKey] ?? 0) + 1;
        m.investedCredits += getMountedWeaponUpgradePrice(m, openKey);
        syncSkillStatsFromLoadout(state);
        break;
      }
    }
    bus?.emit('GOLD_COLLECTED', { amount: credits, x: state.player.x, y: state.player.y });
  }

  state.raid.pendingQuickDraft = [];
  state.popupReason = null;
  state.hitStopMs = 0;
  const prevPhase = state.phase;
  state.phase = 'PLAYING';
  if (prevPhase !== 'PLAYING') {
    bus?.emit('PHASE_CHANGED', { from: prevPhase, to: 'PLAYING' });
  }

  if (state.raid.completedCount < state.raid.totalRequired) {
    spawnNextRaidObjective(state, bus);
  } else if (!state.raid.bossTriggered) {
    // Three objectives done — cue the boss music and lock the storm ring
    state.raid.bossTriggered = true;
    state.wave = state.raid.sectorNumber * 5;
    state.isResting = false;
    state.neededSpawn = false;
    state.spawnQueue = [];
    state.enemies = [];
    state.waveTransition.active = false;
    configureStormRingForWave(state, state.wave);
    const boss = createBoss(state);
    state.boss = boss;
    state.bossSpawnedForWave = true;
    bus?.emit('BOSS_SPAWNED', {
      archetype: boss.archetype,
      name: boss.displayName,
      wave: state.wave,
    });
  }

  return true;
}

export function getEstimatedCoreItemCost(state: GameState, id: ShopItemId): number {
  return getShopItemPrice(state, id);
}

export function updateRaidSystem(state: GameState, bus: EventBus, dtMs: number): void {
  if (state.phase !== 'PLAYING' || state.isResting || state.waveTransition.active) return;
  if (state.boss !== null) return;

  for (const ob of state.arenaObstacles) {
    ob.rotAngle += (ob.rotSpeed * dtMs) / 1000;
    if (ob.flash > 0) ob.flash = Math.max(0, ob.flash - dtMs * 0.006);
  }

  const obj = state.raid.activeObjective;
  if (obj && !obj.completed) {
    if (obj.flash > 0) obj.flash = Math.max(0, obj.flash - dtMs * 0.006);

    if (obj.kind === 'vault') {
      const dist = Math.hypot(state.player.x - obj.x, state.player.y - obj.y);
      const captureRadius = 150;
      if (dist <= captureRadius) {
        const prevProg = obj.progressMs;
        obj.progressMs = Math.min(obj.maxProgressMs, obj.progressMs + dtMs);
        // Drop ambushers at 20% and 65% progress so standing on the capture point isn't a nap
        if (prevProg < 900 && obj.progressMs >= 900) {
          spawnSquadFormation(state, obj.x, obj.y, ['small', 'small', 'medium'], 210);
        } else if (prevProg < 2925 && obj.progressMs >= 2925) {
          spawnSquadFormation(
            state,
            obj.x,
            obj.y,
            state.raid.sectorNumber >= 2 ? ['large', 'small', 'small'] : ['medium', 'small', 'small'],
            225
          );
        }
        if (obj.progressMs >= obj.maxProgressMs) {
          completeRaidObjective(state, obj, bus, true);
          return;
        }
      } else {
        obj.progressMs = Math.max(0, obj.progressMs - dtMs * 0.15);
      }
    } else if (obj.kind === 'convoy') {
      // Keep the gold barge circling inside the storm ring instead of driving off into the void
      const dxC = obj.x - state.stormRing.centerX;
      const dyC = obj.y - state.stormRing.centerY;
      const distC = Math.hypot(dxC, dyC) || 1;
      const tangAng = Math.atan2(dyC, dxC) + Math.PI * 0.52;
      const pullIn = distC > state.stormRing.radius * 0.62 ? 0.45 : distC < 160 ? -0.35 : 0;
      const dirAng = tangAng + pullIn;
      const spd = 1.65 + state.raid.sectorNumber * 0.15;
      obj.vx = Math.cos(dirAng) * spd;
      obj.vy = Math.sin(dirAng) * spd;
      const stepScale = dtMs / (1000 / 60);
      const nextPos = clampPointToStorm(
        obj.x + obj.vx * stepScale,
        obj.y + obj.vy * stepScale,
        state.stormRing,
        110
      );
      obj.x = nextPos.x;
      obj.y = nextPos.y;
      obj.angle = Math.atan2(obj.vy, obj.vx);

      obj.timeLeftMs = Math.max(0, obj.timeLeftMs - dtMs);
      if (obj.timeLeftMs <= 0) {
        obj.failed = true;
        spawnFloatingText(state, obj.x, obj.y - 20, 'CONVOY WARPED OUT', '#fb7185', 1.1, 45);
        completeRaidObjective(state, obj, bus, false);
        return;
      }
    }
  }

  // Keep patrol pressure ticking so the arena never turns into an awkward empty coffee break
  if (obj && !obj.completed && !state.raid.bossTriggered) {
    state.raid.patrolTimerMs -= dtMs;
    const minActiveEnemies = Math.min(8, 3 + state.raid.sectorNumber);
    if (state.enemies.length < minActiveEnemies && state.raid.patrolTimerMs <= 0) {
      state.raid.patrolTimerMs = Math.max(3200, 5600 - state.raid.sectorNumber * 500);
      const pt = randomPointInStorm(
        state.stormRing,
        state.player.x,
        state.player.y,
        320,
        460,
        90
      );
      const pack: Array<'small' | 'medium' | 'large' | 'elite'> =
        state.raid.sectorNumber >= 3
          ? ['medium', 'large', 'small']
          : state.raid.sectorNumber === 2
            ? ['medium', 'small', 'small']
            : ['small', 'small', 'medium'];
      spawnSquadFormation(state, pt.x, pt.y, pack, 80);
    }
  }
}
