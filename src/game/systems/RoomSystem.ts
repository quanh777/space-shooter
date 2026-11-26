import { HULL_CATALOG } from '../../config/hulls';
import {
  MUTATION_CATALOG,
  MUTATION_IDS,
  countMutationStacks,
  type MutationId,
} from '../../config/mutations';
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
  grantPlayerXp,
  nextId,
  spawnFloatingText,
  spawnShockwave,
  triggerHitStop,
  vacuumAndCollectPickupsStep,
  xpRequiredForLevel,
} from '../GameState';
import type {
  EnemySpecialKind,
  EnemyType,
  GameState,
  MountedWeapon,
  QuickDraftOption,
  RoomDoorKind,
  RoomDoorOption,
} from '../types';
import { createBoss } from './BossSystem';
import { computeOffscreenSpawnPoint, createEnemy } from './EnemySystem';
import {
  applyShopUpgrade,
  getMountedWeaponUpgradePrice,
  isMountedWeaponUpgradeMaxed,
  syncSkillStatsFromLoadout,
} from './ShopSystem';
import { ROOM_STORM_CONFIG, configureStormRingForRoom } from './WaveSystem';

export { grantPlayerXp, xpRequiredForLevel };

const ROOM_DOOR_TEMPLATES: Record<
  Exclude<RoomDoorKind, 'boss'>,
  {
    titleVi: string;
    titleEn: string;
    rewardVi: string;
    rewardEn: string;
    riskTagVi: string;
    riskTagEn: string;
    accent: string;
    hex: number;
    doubleReward: boolean;
    bannerUrl: string;
    arenaRadius: number;
    zoneTagVi: string;
    zoneTagEn: string;
  }
> = {
  mutation: {
    titleVi: 'KHO ĐỘT BIẾN HẠT NHÂN',
    titleEn: 'MUTATION CHAMBER',
    rewardVi: 'Chọn 1 trong 3 Đột Biến Build + +38 XP thăng cấp',
    rewardEn: 'Draft 1 of 3 Build Mutations + +38 Bonus XP',
    riskTagVi: 'PHẦN THƯỞNG: ĐỘT BIẾN',
    riskTagEn: 'REWARD: MUTATION',
    accent: '#a855f7',
    hex: 0xa855f7,
    doubleReward: false,
    bannerUrl: './assets/chambers/door_mutation.jpg',
    arenaRadius: ROOM_STORM_CONFIG.mutation.startRadius,
    zoneTagVi: ROOM_STORM_CONFIG.mutation.tagVi,
    zoneTagEn: ROOM_STORM_CONFIG.mutation.tagEn,
  },
  armory: {
    titleVi: 'KHO VŨ KHÍ CHIẾN THUẬT',
    titleEn: 'TACTICAL ARMORY',
    rewardVi: 'Rơi Mô-đun Súng / Kỹ năng lắp lên thân tàu + XP',
    rewardEn: 'Drops a Primary Weapon or Skill Pod + Bonus XP',
    riskTagVi: 'PHẦN THƯỞNG: VŨ KHÍ',
    riskTagEn: 'REWARD: WEAPON POD',
    accent: '#38e8ff',
    hex: 0x38e8ff,
    doubleReward: false,
    bannerUrl: './assets/chambers/door_armory.jpg',
    arenaRadius: ROOM_STORM_CONFIG.armory.startRadius,
    zoneTagVi: ROOM_STORM_CONFIG.armory.tagVi,
    zoneTagEn: ROOM_STORM_CONFIG.armory.tagEn,
  },
  elite: {
    titleVi: 'ĐẤU TRƯỜNG TINH NHUỆ',
    titleEn: 'ELITE GAUNTLET',
    rewardVi: 'Thưởng thêm 1 Nâng Cấp + Mảnh & Vàng x2',
    rewardEn: 'Bonus Extra Draft + Double Credits & Shards',
    riskTagVi: 'NGUY HIỂM · THƯỞNG x2',
    riskTagEn: 'HIGH RISK · REWARD x2',
    accent: '#fb923c',
    hex: 0xfb923c,
    doubleReward: true,
    bannerUrl: './assets/chambers/door_elite.jpg',
    arenaRadius: ROOM_STORM_CONFIG.elite.startRadius,
    zoneTagVi: ROOM_STORM_CONFIG.elite.tagVi,
    zoneTagEn: ROOM_STORM_CONFIG.elite.tagEn,
  },
  supply: {
    titleVi: 'TRẠM SỬA CHỮA & LÕI',
    titleEn: 'REPAIR & CORE BAY',
    rewardVi: 'Hồi ngay +25% HP & +$75 khi bước vào trạm gọn',
    rewardEn: 'Instant +25% Hull Repair & +$75 on compact bay entry',
    riskTagVi: 'PHẦN THƯỞNG: HỒI PHỤC',
    riskTagEn: 'REWARD: REPAIR + CORE',
    accent: '#34d399',
    hex: 0x34d399,
    doubleReward: false,
    bannerUrl: './assets/chambers/door_supply.jpg',
    arenaRadius: ROOM_STORM_CONFIG.supply.startRadius,
    zoneTagVi: ROOM_STORM_CONFIG.supply.tagVi,
    zoneTagEn: ROOM_STORM_CONFIG.supply.tagEn,
  },
  reactor: {
    titleVi: 'ĐỘT KÍCH LÒ PHẢN ỨNG',
    titleEn: 'REACTOR BLITZ',
    rewardVi: 'Phá hủy Lò Năng Lượng kích nổ dây chuyền + XP cao',
    rewardEn: 'Shatter Sector Reactor Core with barrels for High XP',
    riskTagVi: 'MỤC TIÊU: LÒ PHẢN ỨNG',
    riskTagEn: 'OBJECTIVE: REACTOR',
    accent: '#fbbf24',
    hex: 0xfbbf24,
    doubleReward: false,
    bannerUrl: './assets/chambers/door_reactor.jpg',
    arenaRadius: ROOM_STORM_CONFIG.reactor.startRadius,
    zoneTagVi: ROOM_STORM_CONFIG.reactor.tagVi,
    zoneTagEn: ROOM_STORM_CONFIG.reactor.tagEn,
  },
};

function spawnRoomObstacle(
  state: GameState,
  kind: 'ore_asteroid' | 'plasma_barrel',
  x: number,
  y: number,
  variant = 0
): void {
  const sector = state.raid.sectorNumber;
  const radius = kind === 'plasma_barrel' ? 20 : 28 + (variant % 3) * 5;
  const maxHp = kind === 'plasma_barrel' ? 26 + sector * 6 : 75 + sector * 20;
  state.arenaObstacles.push({
    id: nextId(state),
    kind,
    x,
    y,
    radius,
    hp: maxHp,
    maxHp,
    rotAngle: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * (kind === 'plasma_barrel' ? 0.5 : 0.3),
    flash: 0,
    hex: kind === 'plasma_barrel' ? 0xff5a1f : 0x67e8f9,
  });
}

function populateRoomObstacles(state: GameState): void {
  state.arenaObstacles = [];
  const kind = state.currentRoomKind;
  const alchemistBonus = countMutationStacks(state.player.activeMutations, 'barrel_alchemist') > 0 ? 2 : 0;
  const asteroidCount = kind === 'supply' || kind === 'armory' ? 2 : kind === 'elite' ? 4 : 3;
  const barrelCount = (kind === 'supply' || kind === 'armory' ? 2 : 3) + alchemistBonus;
  const maxSpan = Math.max(120, Math.min(340, state.stormRing.targetRadius - 290));

  for (let i = 0; i < asteroidCount; i++) {
    const ang = (i / asteroidCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const dist = 240 + Math.random() * maxSpan;
    const pt = clampPointToStorm(
      state.player.x + Math.cos(ang) * dist,
      state.player.y + Math.sin(ang) * dist,
      state.stormRing,
      85
    );
    spawnRoomObstacle(state, 'ore_asteroid', pt.x, pt.y, i);
  }

  for (let i = 0; i < barrelCount; i++) {
    const ang = (i / barrelCount) * Math.PI * 2 + 0.52;
    const dist = 230 + Math.random() * maxSpan;
    const pt = clampPointToStorm(
      state.player.x + Math.cos(ang) * dist,
      state.player.y + Math.sin(ang) * dist,
      state.stormRing,
      80
    );
    spawnRoomObstacle(state, 'plasma_barrel', pt.x, pt.y, i);
  }
}

export function spawnTacticalSquad(
  state: GameState,
  specs: Array<{ type: Exclude<EnemyType, 'boss'>; special: EnemySpecialKind }>,
  anchorPos?: { x: number; y: number }
): void {
  const anchorX = anchorPos ? anchorPos.x : state.player.x;
  const anchorY = anchorPos ? anchorPos.y : state.player.y;
  const baseAng = Math.random() * Math.PI * 2;
  for (let i = 0; i < specs.length; i++) {
    const ang = baseAng + (i / Math.max(1, specs.length)) * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
    const enemy = createEnemy(state, specs[i].type, false, undefined, i, specs.length, specs[i].special);
    const off = computeOffscreenSpawnPoint(state, ang, (i % 2) * 55);
    enemy.x = off.x;
    enemy.y = off.y;
    const targetDist = 235 + (i % 3) * 38;
    const target = clampPointToStorm(
      anchorX + Math.cos(ang) * targetDist,
      anchorY + Math.sin(ang) * targetDist,
      state.stormRing,
      65
    );
    enemy.ingressTargetX = target.x;
    enemy.ingressTargetY = target.y;
    enemy.ingressActive = true;
    enemy.sectorAngle = ang;
    enemy.faceAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    state.enemies.push(enemy);
  }
}

function buildEncounterSpecs(
  state: GameState,
  kind: RoomDoorKind,
  waveIdx: number
): Array<{ type: Exclude<EnemyType, 'boss'>; special: EnemySpecialKind }> {
  const sector = state.raid.sectorNumber;
  const room = state.runRoomNumber;
  const progressTier = (sector - 1) * 4 + room;
  let squad: Array<{ type: Exclude<EnemyType, 'boss'>; special: EnemySpecialKind }>;

  if (progressTier === 1) {
    // Room 1 stays merciful so the lonely Mk.I pea-shooter isn't mugged on frame 10
    squad =
      waveIdx === 0
        ? [
            { type: 'small', special: 'none' },
            { type: 'small', special: 'none' },
            { type: 'small', special: 'none' },
            { type: 'medium', special: 'none' },
          ]
        : [
            { type: 'small', special: 'none' },
            { type: 'small', special: 'none' },
            { type: 'small', special: 'bomber' },
            { type: 'medium', special: 'none' },
          ];
  } else if (kind === 'elite') {
    squad =
      progressTier <= 2
        ? waveIdx === 0
          ? [
              { type: 'medium', special: 'sniper' },
              { type: 'medium', special: 'shielder' },
              { type: 'small', special: 'bomber' },
              { type: 'small', special: 'bomber' },
              { type: 'small', special: 'none' },
            ]
          : [
              { type: 'elite', special: 'sniper' },
              { type: 'medium', special: 'medic' },
              { type: 'small', special: 'bomber' },
              { type: 'small', special: 'bomber' },
            ]
        : waveIdx === 0
          ? [
              { type: 'elite', special: 'sniper' },
              { type: 'large', special: 'shielder' },
              { type: 'medium', special: 'medic' },
              { type: 'small', special: 'bomber' },
              { type: 'small', special: 'bomber' },
            ]
          : [
              { type: 'elite', special: 'sniper' },
              { type: 'elite', special: 'sniper' },
              { type: 'large', special: 'shielder' },
              { type: 'medium', special: 'medic' },
              { type: 'small', special: 'bomber' },
            ];
  } else if (kind === 'reactor') {
    squad =
      progressTier <= 2
        ? [
            { type: 'medium', special: 'shielder' },
            { type: 'medium', special: 'medic' },
            { type: 'small', special: 'bomber' },
            { type: 'small', special: 'none' },
            { type: 'small', special: 'none' },
          ]
        : [
            { type: 'large', special: 'shielder' },
            { type: 'medium', special: 'medic' },
            { type: 'medium', special: 'sniper' },
            { type: 'small', special: 'bomber' },
            { type: 'small', special: 'bomber' },
          ];
  } else if (kind === 'supply') {
    squad =
      progressTier <= 2
        ? waveIdx === 0
          ? [
              { type: 'small', special: 'none' },
              { type: 'small', special: 'none' },
              { type: 'small', special: 'none' },
              { type: 'medium', special: 'medic' },
            ]
          : [
              { type: 'small', special: 'none' },
              { type: 'small', special: 'none' },
              { type: 'small', special: 'bomber' },
              { type: 'medium', special: 'none' },
            ]
        : waveIdx === 0
          ? [
              { type: 'medium', special: 'medic' },
              { type: 'medium', special: 'sniper' },
              { type: 'small', special: 'bomber' },
              { type: 'small', special: 'bomber' },
            ]
          : [
              { type: 'large', special: 'shielder' },
              { type: 'medium', special: 'none' },
              { type: 'small', special: 'bomber' },
              { type: 'small', special: 'bomber' },
            ];
  } else if (progressTier === 2) {
    squad =
      waveIdx === 0
        ? [
            { type: 'small', special: 'none' },
            { type: 'small', special: 'none' },
            { type: 'small', special: 'bomber' },
            { type: 'medium', special: 'sniper' },
            { type: 'medium', special: 'none' },
          ]
        : [
            { type: 'small', special: 'none' },
            { type: 'small', special: 'none' },
            { type: 'small', special: 'bomber' },
            { type: 'medium', special: 'shielder' },
            { type: 'medium', special: 'medic' },
          ];
  } else if (progressTier === 3) {
    squad =
      waveIdx === 0
        ? [
            { type: 'large', special: 'none' },
            { type: 'medium', special: 'sniper' },
            { type: 'small', special: 'bomber' },
            { type: 'small', special: 'none' },
            { type: 'small', special: 'none' },
          ]
        : [
            { type: 'large', special: 'shielder' },
            { type: 'medium', special: 'medic' },
            { type: 'small', special: 'bomber' },
            { type: 'small', special: 'bomber' },
          ];
  } else {
    squad =
      waveIdx === 0
        ? [
            { type: 'large', special: 'shielder' },
            { type: 'medium', special: 'sniper' },
            { type: 'medium', special: 'medic' },
            { type: 'small', special: 'bomber' },
            { type: 'small', special: 'bomber' },
          ]
        : [
            { type: 'elite', special: 'sniper' },
            { type: 'large', special: 'shielder' },
            { type: 'medium', special: 'medic' },
            { type: 'small', special: 'bomber' },
            { type: 'small', special: 'bomber' },
          ];
  }

  if (sector >= 2) {
    const extraCount = Math.min(2, sector - 1);
    for (let i = 0; i < extraCount; i++) {
      squad.push(
        sector >= 3 && waveIdx > 0 && i === 0
          ? { type: 'large', special: 'none' }
          : { type: 'small', special: 'bomber' }
      );
    }
  }
  return squad;
}

export function spawnCombatDrone(state: GameState, bus?: EventBus): void {
  if (state.drones.length >= 3) return;
  const idx = state.drones.length;
  const orbitPhase = (idx * Math.PI * 2) / Math.max(1, idx + 1);
  const x = state.player.x + Math.cos(orbitPhase) * 44;
  const y = state.player.y + Math.sin(orbitPhase) * 44;
  state.drones.push({
    id: nextId(state),
    x,
    y,
    angle: state.player.facingAngle,
    orbitPhase,
    lastFireMs: -1000,
    fireFlash: 0,
  });
  spawnShockwave(state, x, y, 36, 0x34d399, 14);
  bus?.emit('DRONE_SHOT', { x, y });
}

export function applyWildMutation(
  state: GameState,
  mutationId: MutationId,
  bus?: EventBus
): boolean {
  const def = MUTATION_CATALOG[mutationId];
  if (!def) return false;
  const stacks = countMutationStacks(state.player.activeMutations, mutationId);
  if (stacks >= def.maxStacks) return false;

  state.player.activeMutations.push(mutationId);
  const newStacks = stacks + 1;

  if (mutationId === 'drone_wingman') {
    spawnCombatDrone(state, bus);
    spawnCombatDrone(state, bus);
  } else if (mutationId === 'glass_cannon') {
    state.player.maxHealth = Math.max(45, Math.round(state.player.maxHealth * 0.75));
    state.player.health = Math.min(state.player.health, state.player.maxHealth);
  } else if (mutationId === 'barrel_alchemist') {
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.5;
      const pt = clampPointToStorm(
        state.player.x + Math.cos(ang) * 180,
        state.player.y + Math.sin(ang) * 180,
        state.stormRing,
        80
      );
      spawnRoomObstacle(state, 'plasma_barrel', pt.x, pt.y, i);
    }
  } else if (mutationId === 'chrono_capacitor' as never) {
    // Legacy alias — keep this branch around so old save payloads don't choke
  }

  // Hitting 4 Swarm mutations earns a free fifth-wheel wingman drone
  const swarmCount = state.player.activeMutations.filter(
    (m) => MUTATION_CATALOG[m].archetype === 'swarm'
  ).length;
  if (swarmCount === 4) {
    spawnCombatDrone(state, bus);
  }

  bus?.emit('MUTATION_ACQUIRED', { mutationId, stacks: newStacks });
  return true;
}

function getAvailableMutations(state: GameState): MutationId[] {
  return MUTATION_IDS.filter((id) => {
    const def = MUTATION_CATALOG[id];
    return countMutationStacks(state.player.activeMutations, id) < def.maxStacks;
  });
}

function makeMutationCard(
  state: GameState,
  mutId: MutationId,
  isEpic = false
): QuickDraftOption {
  const def = MUTATION_CATALOG[mutId];
  const stacks = countMutationStacks(state.player.activeMutations, mutId);
  const stackTag = def.maxStacks > 1 ? ` (${stacks + 1}/${def.maxStacks})` : '';
  return {
    id: `qd-mut-${nextId(state)}`,
    kind: 'mutation',
    mutationId: mutId,
    archetype: def.archetype,
    isEpic,
    titleVi: `${def.nameVi}${stackTag}`,
    titleEn: `${def.nameEn}${stackTag}`,
    descVi: def.descVi,
    descEn: def.descEn,
    badgeVi: `ĐỘT BIẾN · ${def.archetype.toUpperCase()}`,
    badgeEn: `MUTATION · ${def.archetype.toUpperCase()}`,
    accent: def.accent,
    iconUrl: `./assets/icons/mut_${def.archetype}.jpg`,
  };
}

function findBestOpenSlot(state: GameState, kind: 'primary' | 'skill'): ShipSlotId | null {
  const slots = state.player.loadout.slots;
  if (kind === 'skill') return slots.skill_1 === null ? 'skill_1' : null;
  const order: ShipSlotId[] = ['wing_r1', 'nose', 'wing_l2', 'wing_r2', 'wing_l1'];
  for (const sid of order) {
    if (slots[sid] === null) return sid;
  }
  return null;
}

function makeWeaponOrSkillCard(state: GameState, isEpic = false): QuickDraftOption {
  const slots = state.player.loadout.slots;
  const needSkill = slots.skill_1 === null && (state.runRoomNumber >= 2 || Math.random() < 0.45);
  if (needSkill) {
    const skId = SKILL_WEAPON_IDS[Math.floor(Math.random() * SKILL_WEAPON_IDS.length)];
    const skEntry = WEAPON_CATALOG[skId] as SkillWeaponCatalogEntry;
    return {
      id: `qd-skill-${nextId(state)}`,
      kind: 'skill',
      weaponId: skId,
      targetSlot: 'skill_1',
      isEpic,
      titleVi: skEntry.nameVi,
      titleEn: skEntry.nameEn,
      descVi: `${skEntry.descVi} (Lắp vào lưng tàu)`,
      descEn: `${skEntry.descEn} (Mounts to Spine)`,
      badgeVi: 'KỸ NĂNG CHỦ ĐỘNG [E]',
      badgeEn: 'ACTIVE SKILL [E]',
      accent: skEntry.accent,
      iconUrl: skEntry.iconUrl,
    };
  }

  const openPrimSlot = findBestOpenSlot(state, 'primary');
  const pool = PRIMARY_WEAPON_IDS.filter((id) => id !== 'thermal_sink');
  const wId = pool[Math.floor(Math.random() * pool.length)];
  const wEntry = WEAPON_CATALOG[wId];
  const slotTag = openPrimSlot ? SHIP_SLOT_MAP[openPrimSlot].shortTag : 'KHO / GHÉP';
  return {
    id: `qd-wpn-${nextId(state)}`,
    kind: 'weapon',
    weaponId: wId,
    targetSlot: openPrimSlot ?? undefined,
    isEpic,
    titleVi: isEpic ? `${wEntry.nameVi} (Cấp II)` : wEntry.nameVi,
    titleEn: isEpic ? `${wEntry.nameEn} (Tier II)` : wEntry.nameEn,
    descVi: openPrimSlot
      ? `${wEntry.descVi} · Tự lắp vào ${slotTag}`
      : `${wEntry.descVi} · Thêm vào Kho ghép Tier`,
    descEn: openPrimSlot
      ? `${wEntry.descEn} · Auto-mount ${slotTag}`
      : `${wEntry.descEn} · Stored in Armory`,
    badgeVi: openPrimSlot ? `VŨ KHÍ · ${slotTag}` : 'MÔ-ĐUN KHO',
    badgeEn: openPrimSlot ? `WEAPON · ${slotTag}` : 'ARMORY DROP',
    accent: wEntry.accent,
    iconUrl: wEntry.iconUrl,
  };
}

function makeCoreCard(state: GameState): QuickDraftOption {
  const pool: ShopItemId[] = ['maxHealth', 'speedBoost', 'shield', 'cryoCooler', 'energyUpgrade', 'fireRate', 'bulletDamage'];
  const coreId = pool[Math.floor(Math.random() * pool.length)];
  const coreDef = SHOP_ITEMS[coreId];
  return {
    id: `qd-core-${nextId(state)}`,
    kind: 'core',
    coreItemId: coreId,
    titleVi: coreDef.nameVi,
    titleEn: coreDef.nameEn,
    descVi: coreDef.descVi,
    descEn: coreDef.descEn,
    badgeVi: 'LÕI TÀU 3D',
    badgeEn: 'CHASSIS CORE',
    accent: coreDef.accent,
    iconUrl: coreDef.iconUrl,
  };
}

export function buildRoomQuickDraft(state: GameState, excludeTitles: Set<string> = new Set()): QuickDraftOption[] {
  const availableMuts = getAvailableMutations(state).sort(() => Math.random() - 0.5);
  const freshMuts = availableMuts.filter((id) => !excludeTitles.has(MUTATION_CATALOG[id].nameEn));
  const mutPool = freshMuts.length >= 3 ? freshMuts : availableMuts;
  const isEpicRoom = state.currentRoomKind === 'elite' || state.currentRoomKind === 'reactor';

  if (state.currentRoomKind === 'mutation' && mutPool.length >= 3) {
    return [
      makeMutationCard(state, mutPool[0], false),
      makeMutationCard(state, mutPool[1], false),
      makeMutationCard(state, mutPool[2], true),
    ];
  }

  if (state.currentRoomKind === 'supply') {
    const bounty = 95 + state.raid.sectorNumber * 35;
    return [
      makeCoreCard(state),
      mutPool.length > 0 ? makeMutationCard(state, mutPool[0], false) : makeCoreCard(state),
      {
        id: `qd-bounty-${nextId(state)}`,
        kind: 'upgrade_bounty',
        creditsBonus: bounty,
        titleVi: `TIẾP TẾ +$${bounty} & CƯỜNG HÓA`,
        titleEn: `FIELD OVERCLOCK +$${bounty}`,
        descVi: `Nhận +$${bounty}, hồi +45 HP & tự nâng +1 cấp vũ khí đang lắp.`,
        descEn: `Gain +$${bounty}, heal +45 HP, and upgrade one mounted weapon.`,
        badgeVi: 'KINH TẾ & SỬA CHỮA',
        badgeEn: 'SUPPLY & REPAIR',
        accent: '#fbbf24',
        iconUrl: './assets/icons/core_health.png',
      },
    ];
  }

  // Default mix: something shoots, something mutates, and either another mutation or armor
  const card0 = makeWeaponOrSkillCard(state, isEpicRoom);
  const card1 = mutPool.length > 0 ? makeMutationCard(state, mutPool[0], isEpicRoom) : makeCoreCard(state);
  const card2 = mutPool.length > 1 ? makeMutationCard(state, mutPool[1], false) : makeCoreCard(state);
  return [card0, card1, card2];
}

export function applyQuickDraftChoice(
  state: GameState,
  optionId: string,
  bus?: EventBus
): boolean {
  const idx = state.raid.pendingQuickDraft.findIndex((o) => o.id === optionId);
  if (idx === -1) return false;
  const opt = state.raid.pendingQuickDraft[idx];
  const l = state.player.loadout;

  if (opt.kind === 'mutation' && opt.mutationId) {
    applyWildMutation(state, opt.mutationId, bus);
  } else if ((opt.kind === 'weapon' || opt.kind === 'skill') && opt.weaponId) {
    const entry = WEAPON_CATALOG[opt.weaponId];
    const newItem: MountedWeapon = {
      instanceId: `wpn-${nextId(state)}`,
      weaponId: opt.weaponId,
      tier: opt.isEpic ? 2 : 1,
      upgrades: {},
      investedCredits: entry.price,
      lastFireMs: -10000,
      recoil: 0,
    };
    const slotId =
      opt.targetSlot && l.slots[opt.targetSlot] === null
        ? opt.targetSlot
        : findBestOpenSlot(state, entry.kind);
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
      bus?.emit('MODULE_COLLECTED', { weaponId: opt.weaponId, x: state.player.x, y: state.player.y });
    }
  } else if (opt.kind === 'core' && opt.coreItemId) {
    state.shop.levels[opt.coreItemId] = (state.shop.levels[opt.coreItemId] ?? 0) + 1;
    applyShopUpgrade(state, opt.coreItemId);
  } else if (opt.kind === 'upgrade_bounty') {
    const credits = opt.creditsBonus ?? 95;
    state.money += credits;
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 45);
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
  state.hitStopMs = 0;

  if (state.player.pendingLevelUps > 0) {
    state.player.pendingLevelUps--;
    state.popupReason = {
      source: 'level_up',
      kickerVi: `THĂNG CẤP CHIẾN HẠM · CẤP ${state.player.level}`,
      kickerEn: `WARSHIP LEVEL UP · LV.${state.player.level}`,
      titleVi: `CHỌN NÂNG CẤP CẤP ${state.player.level}`,
      titleEn: `LEVEL ${state.player.level} UPGRADE DRAFT`,
      reasonVi: `Bạn vừa đủ XP thăng lên Cấp ${state.player.level} — chọn 1 thẻ cường hóa tiếp theo.`,
      reasonEn: `You reached Level ${state.player.level} from combat XP — select 1 upgrade card.`,
    };
    const nextOpts = buildRoomQuickDraft(state);
    state.raid.pendingQuickDraft = nextOpts;
    bus?.emit('QUICK_DRAFT_OPENED', { options: nextOpts });
    return true;
  }

  // Elite rooms pay out an extra draft round — hard work deserves extra toys
  if (state.roomDraftsPending > 0) {
    state.roomDraftsPending--;
    state.popupReason = {
      source: 'room_bonus',
      kickerVi: `THƯỞNG PHÒNG TINH NHUỆ // PHẦN THƯỞNG x2`,
      kickerEn: `ELITE GAUNTLET // DOUBLE DRAFT REWARD`,
      titleVi: 'RƯƠNG THƯỞNG NÂNG CẤP BỔ SUNG',
      titleEn: 'BONUS ELITE UPGRADE DRAFT',
      reasonVi: 'Bạn đã chinh phục phòng Tinh Nhuệ — nhận thêm 1 lượt chọn nâng cấp miễn phí.',
      reasonEn: 'You conquered an Elite chamber — claim 1 bonus upgrade before leaving.',
    };
    const nextOpts = buildRoomQuickDraft(state);
    state.raid.pendingQuickDraft = nextOpts;
    bus?.emit('QUICK_DRAFT_OPENED', { options: nextOpts });
    return true;
  }

  // Non-empty pendingRoomDoors means this draft wrapped up a room clear -> open the Warp Gates.
  // Otherwise it was a mid-fight XP level-up, so shove the pilot straight back into gunfire.
  if (state.pendingRoomDoors.length > 0) {
    openRoomDoorSelection(state, bus);
  } else {
    state.popupReason = null;
    const prevPhase = state.phase;
    state.phase = 'PLAYING';
    if (prevPhase !== 'PLAYING') {
      bus?.emit('PHASE_CHANGED', { from: prevPhase, to: 'PLAYING' });
    }
  }
  return true;
}

export function triggerWarpTransition(
  state: GameState,
  accentHex: number,
  titleVi: string,
  titleEn: string,
  zoneLabelVi: string,
  zoneLabelEn: string,
  bus?: EventBus,
  durationMs = 1250
): void {
  state.warpTransition = {
    active: true,
    elapsedMs: 0,
    durationMs,
    accentHex,
    titleVi,
    titleEn,
    zoneLabelVi,
    zoneLabelEn,
  };
  bus?.emit('WARP_JUMP_STARTED', { accentHex });
}

export function openLevelUpDraftImmediate(state: GameState, bus?: EventBus): boolean {
  if (state.phase !== 'PLAYING' || state.player.pendingLevelUps <= 0) return false;
  state.pacingTransition = createIdleTransitionBeat();
  state.player.pendingLevelUps--;
  state.popupReason = {
    source: 'level_up',
    kickerVi: `ĐỦ KINH NGHIỆM // CẤP ${state.player.level}`,
    kickerEn: `XP THRESHOLD REACHED // LV.${state.player.level}`,
    titleVi: `THĂNG CẤP CHIẾN HẠM · CẤP ${state.player.level}`,
    titleEn: `WARSHIP LEVEL UP · LV.${state.player.level}`,
    reasonVi: `Bạn vừa tiêu diệt địch và đạt Cấp ${state.player.level}. Hãy chọn 1 thẻ nâng cấp bên dưới.`,
    reasonEn: `Combat XP filled Level ${state.player.level}. Choose 1 tactical upgrade card below.`,
  };
  const opts = buildRoomQuickDraft(state);
  state.raid.pendingQuickDraft = opts;
  const prevPhase = state.phase;
  state.phase = 'QUICK_DRAFT';
  bus?.emit('QUICK_DRAFT_OPENED', { options: opts });
  bus?.emit('PHASE_CHANGED', { from: prevPhase, to: 'QUICK_DRAFT' });
  return true;
}

export function triggerPendingLevelUpDraft(state: GameState, bus?: EventBus): boolean {
  if (state.phase !== 'PLAYING' || state.player.pendingLevelUps <= 0) return false;
  if (!state.pacingEnabled) {
    return openLevelUpDraftImmediate(state, bus);
  }
  if (state.pacingTransition.kind !== 'none') return false;
  state.pacingTransition = {
    kind: 'level_up',
    elapsedMs: 0,
    durationMs: 820,
    bannerTitleVi: `THĂNG CẤP CẤP ${state.player.level}! // CHUẨN BỊ NÂNG CẤP`,
    bannerTitleEn: `LEVEL UP LV.${state.player.level}! // INCOMING DRAFT`,
    bannerSubVi: 'Thanh XP đã đầy — đang thu hồi vàng quanh tàu trước khi mở bảng chọn...',
    bannerSubEn: 'XP bar full — collecting nearby gold before opening upgrades...',
    accent: '#fbbf24',
  };
  return false;
}

export function buildNextRoomDoors(state: GameState): RoomDoorOption[] {
  const nextRoomNum = state.runRoomNumber + 1;
  if (nextRoomNum >= state.roomsTotalPerSector) {
    return [
      {
        id: `door-boss-repair-${nextId(state)}`,
        kind: 'boss',
        titleVi: 'ĐỘT KÍCH BOSS · BẢO TRÌ KHẨN',
        titleEn: 'BOSS GATE · REPAIR BAY',
        rewardVi: 'Hồi ngay +40% HP & Khiên trước khi đối đầu Chiến Hạm Boss 3 Dạng',
        rewardEn: 'Restore +40% Hull & reset Shield before 3-Stage Capital Boss',
        riskTagVi: `PHÒNG ${state.roomsTotalPerSector}/${state.roomsTotalPerSector} · TRÙM`,
        riskTagEn: `ROOM ${state.roomsTotalPerSector}/${state.roomsTotalPerSector} · BOSS`,
        accent: '#ff3b4e',
        hex: 0xff3b4e,
        doubleReward: false,
        bannerUrl: './assets/chambers/door_boss.jpg',
        arenaRadius: ROOM_STORM_CONFIG.boss.targetRadius,
        zoneTagVi: ROOM_STORM_CONFIG.boss.tagVi,
        zoneTagEn: ROOM_STORM_CONFIG.boss.tagEn,
      },
      {
        id: `door-boss-overclock-${nextId(state)}`,
        kind: 'boss',
        titleVi: 'ĐỘT KÍCH BOSS · ÉP XUNG CHRONO',
        titleEn: 'BOSS GATE · CHRONO SURGE',
        rewardVi: 'Nạp đầy 100% Chrono Overdrive & +$120 vào đấu Chiến Hạm Boss',
        rewardEn: 'Fill 100% Chrono Overdrive & +$120 Credits for Capital Boss',
        riskTagVi: 'PHÒNG TRÙM · HỎA LỰC',
        riskTagEn: 'BOSS · OVERCLOCK',
        accent: '#c084fc',
        hex: 0xc084fc,
        doubleReward: false,
        bannerUrl: './assets/chambers/door_boss.jpg',
        arenaRadius: ROOM_STORM_CONFIG.boss.targetRadius,
        zoneTagVi: ROOM_STORM_CONFIG.boss.tagVi,
        zoneTagEn: ROOM_STORM_CONFIG.boss.tagEn,
      },
    ];
  }

  const kinds: Array<Exclude<RoomDoorKind, 'boss'>> = [
    'mutation',
    'armory',
    'elite',
    'supply',
    'reactor',
  ].sort(() => Math.random() - 0.5) as Array<Exclude<RoomDoorKind, 'boss'>>;

  const picks = kinds.slice(0, 3);
  if (!picks.includes('mutation') && !picks.includes('armory')) {
    picks[0] = 'mutation';
  }
  return picks.map((kind) => {
    const tpl = ROOM_DOOR_TEMPLATES[kind];
    return {
      id: `door-${kind}-${nextId(state)}`,
      kind,
      ...tpl,
    };
  });
}

export function rerollRoomQuickDraft(state: GameState, bus?: EventBus): boolean {
  if (state.phase !== 'QUICK_DRAFT' || state.player.rerollsLeft <= 0) return false;
  state.player.rerollsLeft--;
  const prevNames = new Set(state.raid.pendingQuickDraft.map((o) => o.titleEn));
  const nextOpts = buildRoomQuickDraft(state, prevNames);
  state.raid.pendingQuickDraft = nextOpts;
  bus?.emit('QUICK_DRAFT_OPENED', { options: nextOpts });
  return true;
}

export function openRoomDoorSelection(state: GameState, bus?: EventBus): void {
  const nextRoomNum = state.runRoomNumber + 1;
  const hasBossDoor = state.pendingRoomDoors.some((d) => d.kind === 'boss');
  const shouldBuildBoss = nextRoomNum >= state.roomsTotalPerSector && !hasBossDoor;
  const doors =
    state.pendingRoomDoors.length > 0 && !shouldBuildBoss
      ? state.pendingRoomDoors
      : buildNextRoomDoors(state);
  state.pendingRoomDoors = doors;
  state.popupReason = {
    source: 'room_doors',
    kickerVi: `PHÒNG ${state.runRoomNumber}/${state.roomsTotalPerSector} ĐÃ HOÀN TẤT`,
    kickerEn: `CHAMBER ${state.runRoomNumber}/${state.roomsTotalPerSector} CLEARED`,
    titleVi: 'CHỌN CỬA DỊCH CHUYỂN TIẾP THEO',
    titleEn: 'SELECT NEXT WARP CHAMBER',
    reasonVi: `Bạn đã dọn sạch quái Phòng ${state.runRoomNumber}/${state.roomsTotalPerSector} và thu đủ chiến lợi phẩm. Chọn 1 cổng để nhảy tiếp.`,
    reasonEn: `Chamber ${state.runRoomNumber}/${state.roomsTotalPerSector} cleared & all loot secured. Pick your next Warp Gate.`,
  };
  const prevPhase = state.phase;
  state.phase = 'ROOM_SELECT';
  bus?.emit('ROOM_DOORS_OPENED', { roomNumber: nextRoomNum, doors });
  if (prevPhase !== 'ROOM_SELECT') {
    bus?.emit('PHASE_CHANGED', { from: prevPhase, to: 'ROOM_SELECT' });
  }
}

export function enterSectorRoom(
  state: GameState,
  roomNumber: number,
  kind: RoomDoorKind,
  bus?: EventBus,
  variantIndex = 0,
  withWarp = false
): void {
  const hullDef = HULL_CATALOG[state.player.hullId];
  const stormCfg = ROOM_STORM_CONFIG[kind];
  state.runRoomNumber = roomNumber;
  state.currentRoomKind = kind;
  state.currentRoomZoneVi = stormCfg.tagVi;
  state.currentRoomZoneEn = stormCfg.tagEn;
  state.roomDraftsPending = 0;
  state.pendingRoomDoors = [];
  state.roomPortal = null;
  state.pacingTransition = createIdleTransitionBeat();
  state.popupReason = null;
  state.bullets = [];
  state.scheduledBullets = [];
  state.bombs = [];
  state.singularities = [];
  state.isResting = false;
  state.waveTransition.active = false;
  state.neededSpawn = false;
  state.spawnQueue = [];
  state.enemies = [];
  state.raid.activeObjective = null;

  if (kind === 'boss') {
    state.currentRoomTitleVi = 'CHIẾN HẠM TRÙM CHỦ LỰC';
    state.currentRoomTitleEn = 'CAPITAL BOSS ARENA';
    state.roomRewardDouble = false;
    state.roomWavePending = 0;
    state.raid.bossTriggered = true;
    state.wave = state.raid.sectorNumber * 5;

    if (variantIndex === 0) {
      state.player.health = Math.min(
        state.player.maxHealth,
        state.player.health + Math.round(state.player.maxHealth * 0.25)
      );
      state.player.shieldCooldownMs = 0;
    } else {
      state.player.chronoCharge = 100;
      state.money += 90;
    }

    configureStormRingForRoom(state, 'boss');
    populateRoomObstacles(state);
    const boss = createBoss(state);
    state.boss = boss;
    state.bossSpawnedForWave = true;

    const prevPhase = state.phase;
    state.phase = 'PLAYING';
    if (prevPhase !== 'PLAYING') {
      bus?.emit('PHASE_CHANGED', { from: prevPhase, to: 'PLAYING' });
    }
    if (withWarp) {
      triggerWarpTransition(
        state,
        0xff3b4e,
        state.currentRoomTitleVi,
        state.currentRoomTitleEn,
        state.currentRoomZoneVi,
        state.currentRoomZoneEn,
        bus,
        1300
      );
    }
    bus?.emit('BOSS_SPAWNED', {
      archetype: boss.archetype,
      name: boss.displayName,
      wave: state.wave,
    });
    bus?.emit('ROOM_ENTERED', { roomNumber, kind, titleEn: state.currentRoomTitleEn });
    return;
  }

  const tpl = ROOM_DOOR_TEMPLATES[kind];
  state.currentRoomTitleVi = tpl.titleVi;
  state.currentRoomTitleEn = tpl.titleEn;
  state.roomRewardDouble = tpl.doubleReward;
  state.wave = (state.raid.sectorNumber - 1) * 5 + Math.min(4, roomNumber);
  state.raid.bossTriggered = false;
  state.boss = null;

  if (roomNumber > 1 && hullDef.id === 'carrier') {
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 8);
  }
  if (kind === 'supply') {
    const heal = Math.round(state.player.maxHealth * 0.25);
    state.player.health = Math.min(state.player.maxHealth, state.player.health + heal);
    state.money += 75;
    spawnFloatingText(state, state.player.x, state.player.y - 26, `+${heal} HP · +$75`, '#34d399', 1.2, 42);
  }

  configureStormRingForRoom(state, kind);
  populateRoomObstacles(state);

  if (kind === 'reactor') {
    const ang = Math.random() * Math.PI * 2;
    const spawnPt = clampPointToStorm(
      state.player.x + Math.cos(ang) * 290,
      state.player.y + Math.sin(ang) * 290,
      state.stormRing,
      120
    );
    state.arenaObstacles = state.arenaObstacles.filter(
      (ob) => Math.hypot(ob.x - spawnPt.x, ob.y - spawnPt.y) > 85
    );
    const maxHp = 260 + state.raid.sectorNumber * 110;
    state.raid.activeObjective = {
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
      titleVi: 'LÒ PHẢN ỨNG ĐỊCH',
      titleEn: 'SECTOR REACTOR CORE',
      accentHex: 0xff3b4e,
    };
    state.roomWavePending = 0;
    spawnTacticalSquad(state, buildEncounterSpecs(state, 'reactor', 0), spawnPt);
    for (const offsetAng of [ang + 0.75, ang - 0.75]) {
      const bp = clampPointToStorm(
        spawnPt.x + Math.cos(offsetAng) * 95,
        spawnPt.y + Math.sin(offsetAng) * 95,
        state.stormRing,
        60
      );
      spawnRoomObstacle(state, 'plasma_barrel', bp.x, bp.y);
    }
  } else {
    state.roomWavePending = 1;
    spawnTacticalSquad(state, buildEncounterSpecs(state, kind, 0));
  }

  const prevPhase = state.phase;
  state.phase = 'PLAYING';
  if (prevPhase !== 'PLAYING') {
    bus?.emit('PHASE_CHANGED', { from: prevPhase, to: 'PLAYING' });
  }
  if (withWarp) {
    triggerWarpTransition(
      state,
      tpl.hex,
      tpl.titleVi,
      tpl.titleEn,
      stormCfg.tagVi,
      stormCfg.tagEn,
      bus,
      1250
    );
  } else {
    spawnShockwave(state, state.player.x, state.player.y, 130, tpl.hex, 22);
  }
  bus?.emit('ROOM_ENTERED', { roomNumber, kind, titleEn: tpl.titleEn });
}

export function selectRoomDoorOption(
  state: GameState,
  doorIdOrIndex: string | number,
  bus?: EventBus
): boolean {
  if (state.phase !== 'ROOM_SELECT' || state.pendingRoomDoors.length === 0) return false;
  const idx =
    typeof doorIdOrIndex === 'number'
      ? doorIdOrIndex
      : state.pendingRoomDoors.findIndex((d) => d.id === doorIdOrIndex);
  const chosen = state.pendingRoomDoors[idx];
  if (!chosen) return false;

  const nextRoomNum = chosen.kind === 'boss' ? state.roomsTotalPerSector : state.runRoomNumber + 1;
  enterSectorRoom(state, nextRoomNum, chosen.kind, bus, idx, true);
  return true;
}

export function finalizeRoomClearAfterPacing(state: GameState, bus: EventBus): void {
  if (state.phase !== 'PLAYING') return;
  state.pacingTransition = createIdleTransitionBeat();
  vacuumAndCollectPickupsStep(state, 16, bus, true);

  state.roomDraftsPending = state.roomRewardDouble ? 1 : 0;

  if (state.player.pendingLevelUps > 0 || state.roomDraftsPending > 0) {
    state.pendingRoomDoors = buildNextRoomDoors(state);
    const fromLevelUp = state.player.pendingLevelUps > 0;
    if (fromLevelUp) {
      state.player.pendingLevelUps--;
      if (state.roomRewardDouble && state.roomDraftsPending > 0) {
        state.roomDraftsPending = 0;
      }
      state.popupReason = {
        source: 'level_up',
        kickerVi: `PHÒNG ${state.runRoomNumber}/${state.roomsTotalPerSector} SẠCH QUÁI // CẤP ${state.player.level}`,
        kickerEn: `CHAMBER ${state.runRoomNumber}/${state.roomsTotalPerSector} CLEARED // LV.${state.player.level}`,
        titleVi: `THĂNG CẤP CẤP ${state.player.level} & MỞ CỔNG PHÒNG`,
        titleEn: `LEVEL ${state.player.level} UPGRADE DRAFT`,
        reasonVi: `Phòng ${state.runRoomNumber}/${state.roomsTotalPerSector} đã sạch quái & XP vừa lên Cấp ${state.player.level}. Chọn nâng cấp trước khi sang cửa mới.`,
        reasonEn: `Room cleared & XP reached Level ${state.player.level}. Pick your upgrade before choosing the next Warp Gate.`,
      };
    } else {
      state.roomDraftsPending--;
      state.popupReason = {
        source: 'room_bonus',
        kickerVi: `HOÀN TẤT PHÒNG TINH NHUỆ // THƯỞNG x2`,
        kickerEn: `ELITE CHAMBER CLEARED // DOUBLE REWARD`,
        titleVi: 'CHỌN THẺ THƯỞNG PHÒNG TINH NHUỆ',
        titleEn: 'ELITE CHAMBER BONUS DRAFT',
        reasonVi: `Bạn vừa tiêu diệt hết đội hình Tinh Nhuệ và thu hồi chiến lợi phẩm — chọn 1 phần thưởng trước khi qua cổng.`,
        reasonEn: `All Elite forces eliminated & loot vacuumed — claim your chamber bonus draft before jumping.`,
      };
    }
    const opts = buildRoomQuickDraft(state);
    state.raid.pendingQuickDraft = opts;
    const prevPhase = state.phase;
    state.phase = 'QUICK_DRAFT';
    bus.emit('QUICK_DRAFT_OPENED', { options: opts });
    bus.emit('PHASE_CHANGED', { from: prevPhase, to: 'QUICK_DRAFT' });
    return;
  }

  state.pendingRoomDoors = [];
  openRoomDoorSelection(state, bus);
}

export function completeCurrentRoom(state: GameState, bus: EventBus): void {
  if (state.phase !== 'PLAYING') return;

  state.raid.activeObjective = null;
  state.roomsClearedTotal++;
  state.raid.completedCount = Math.min(state.raid.totalRequired, state.runRoomNumber);

  const bonus = (state.roomRewardDouble ? 240 : 120) * state.raid.sectorNumber;
  const clearCredits = state.roomRewardDouble ? 95 : 42;
  state.score += bonus;
  state.money += clearCredits;

  const kindBonusXp = state.currentRoomKind === 'mutation' || state.currentRoomKind === 'reactor' ? 12 : 0;
  const xpGain = (state.roomRewardDouble ? 42 : 26) + kindBonusXp;
  grantPlayerXp(state, xpGain, bus);

  spawnFloatingText(
    state,
    state.player.x,
    state.player.y - 26,
    `ROOM CLEAR +$${clearCredits}`,
    '#38e8ff',
    1.25,
    40
  );
  addScreenShake(state, 10);
  triggerHitStop(state, 28);

  const portalDist = state.pacingEnabled ? 170 : 140;
  const toCenterX = state.stormRing.centerX - state.player.x;
  const toCenterY = state.stormRing.centerY - state.player.y;
  const dirAng =
    Math.hypot(toCenterX, toCenterY) > 40
      ? Math.atan2(toCenterY, toCenterX)
      : state.player.facingAngle;
  const px = state.player.x + Math.cos(dirAng) * portalDist;
  const py = state.player.y + Math.sin(dirAng) * portalDist;
  const clamped = clampPointToStorm(px, py, state.stormRing, 90);
  state.roomPortal = {
    x: clamped.x,
    y: clamped.y,
    accentHex: state.roomRewardDouble ? 0xfb923c : 0x38e8ff,
    pulse: 0,
  };

  if (!state.pacingEnabled) {
    finalizeRoomClearAfterPacing(state, bus);
    return;
  }

  state.bullets = state.bullets.filter((b) => !b.isEnemy);
  state.scheduledBullets = [];
  state.pacingTransition = {
    kind: 'room_clear',
    elapsedMs: 0,
    durationMs: 1850,
    bannerTitleVi: `DỌN SẠCH PHÒNG ${state.runRoomNumber}/${state.roomsTotalPerSector}! ĐANG HÚT ĐỒ`,
    bannerTitleEn: `CHAMBER ${state.runRoomNumber}/${state.roomsTotalPerSector} CLEARED! SECURING LOOT`,
    bannerSubVi: 'Tự hút toàn bộ vàng & mô-đun — bay vào Cổng Xanh hoặc chờ chọn cửa',
    bannerSubEn: 'Vacuuming all drops — fly through the Warp Gate or wait briefly',
    accent: state.roomRewardDouble ? '#fb923c' : '#38e8ff',
  };
}

export function initSectorRooms(
  state: GameState,
  sectorNumber: number,
  bus?: EventBus,
  withWarp = false
): void {
  state.raid = createInitialRaidState(sectorNumber);
  state.raid.totalRequired = 4;
  state.runRoomNumber = 1;
  state.bossSpawnedForWave = false;
  enterSectorRoom(state, 1, 'armory', bus, 0, withWarp);
}

export function updateRoomSystem(state: GameState, bus: EventBus, dtMs: number): void {
  if (state.phase !== 'PLAYING' || state.isResting || state.waveTransition.active) return;

  for (const ob of state.arenaObstacles) {
    ob.rotAngle += (ob.rotSpeed * dtMs) / 1000;
    if (ob.flash > 0) ob.flash = Math.max(0, ob.flash - dtMs * 0.006);
  }

  if (state.roomPortal) {
    state.roomPortal.pulse += dtMs * 0.004;
  }

  if (state.boss !== null || state.currentRoomKind === 'boss') return;

  // Reactor rooms end the moment the big glowing tank pops
  if (state.currentRoomKind === 'reactor') {
    const obj = state.raid.activeObjective;
    if (obj) {
      if (obj.flash > 0) obj.flash = Math.max(0, obj.flash - dtMs * 0.006);
      if (obj.completed) {
        completeCurrentRoom(state, bus);
      }
    } else if (state.enemies.length === 0) {
      completeCurrentRoom(state, bus);
    }
    return;
  }

  // Standard rooms trick-drop Wave 2 from off-screen once Wave 1 bites the dust
  if (state.enemies.length === 0) {
    if (state.roomWavePending > 0) {
      state.roomWavePending--;
      const specs = buildEncounterSpecs(state, state.currentRoomKind, 1);
      spawnTacticalSquad(state, specs);
      spawnFloatingText(state, state.player.x, state.player.y - 28, 'REINFORCEMENTS INCOMING', '#fbbf24', 1.1, 36);
      bus?.emit('REINFORCEMENTS_SPAWNED', { count: specs.length });
    } else {
      completeCurrentRoom(state, bus);
    }
  }
}
