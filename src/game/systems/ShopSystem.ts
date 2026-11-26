import { PLAYER_BASE, SKILL_BASE } from '../../config/constants';
import { countMutationStacks } from '../../config/mutations';
import { ALL_SHOP_ITEM_IDS, SHOP_ITEMS, type ShopItemId } from '../../config/shopItems';
import { generateSectorMap } from '../map/SectorMapGenerator';
import {
  AUGMENT_CATALOG,
  CORE_SHOP_ITEM_IDS,
  PRIMARY_UPGRADE_DEFS,
  PRIMARY_WEAPON_IDS,
  SECTOR_HAZARDS,
  SHIP_SLOT_MAP,
  SKILL_UPGRADE_DEFS,
  SKILL_WEAPON_IDS,
  WEAPON_CATALOG,
  type AugmentId,
  type ManufacturerId,
  type PrimaryWeaponCatalogEntry,
  type SectorHazardId,
  type ShipSlotId,
  type SkillWeaponCatalogEntry,
  type WeaponId,
  type WeaponUpgradeKey,
} from '../../config/weapons';
import type { EventBus } from '../../engine/EventBus';
import { nextId } from '../GameState';
import type {
  GameState,
  MountedWeapon,
  PlayerState,
  RouletteOffer,
  RouletteRarity,
} from '../types';

export function getShopItemPrice(state: GameState, id: ShopItemId): number {
  const def = SHOP_ITEMS[id];
  const bought = state.shop.levels[id] ?? 0;
  if (id === 'skillUp') {
    return Math.floor((def.basePrice + state.bossKills * 28) * Math.pow(def.priceGrowth, bought));
  }
  return Math.floor(def.basePrice * Math.pow(def.priceGrowth, bought));
}

export function getShopRefreshCost(state: GameState): number {
  return 20 + state.shop.refreshCount * 15;
}

export function isShopItemMaxed(state: GameState, id: ShopItemId): boolean {
  const def = SHOP_ITEMS[id];
  if (def.maxLevel === -1) return false;
  return (state.shop.levels[id] ?? 0) >= def.maxLevel;
}

export function isShopItemUnavailable(state: GameState, id: ShopItemId): boolean {
  if (isShopItemMaxed(state, id)) return true;
  if (id === 'skillUp' && state.shop.skillUpBoughtThisShop) return true;
  return false;
}

export function getSelectedShopTotal(state: GameState): number {
  return state.shop.selected.reduce((sum, id) => sum + getShopItemPrice(state, id), 0);
}

export function generateShopOffers(state: GameState, rng: () => number = Math.random): ShopItemId[] {
  const pool = ALL_SHOP_ITEM_IDS.filter((id) => id !== 'skillUp' && !isShopItemMaxed(state, id));

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const offers = pool.slice(0, 3);
  const canOfferSkillUp = !isShopItemMaxed(state, 'skillUp') && !state.shop.skillUpBoughtThisShop;
  if (canOfferSkillUp && rng() < 0.8) {
    offers.push('skillUp');
  } else if (pool.length > 3) {
    offers.push(pool[3]);
  }

  for (let i = offers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [offers[i], offers[j]] = [offers[j], offers[i]];
  }

  return offers;
}

export function openShop(state: GameState, bus: EventBus): void {
  state.phase = 'SHOP';
  state.shop.visitedForWave = state.wave;
  state.shop.refreshCount = 0;
  state.shop.skillUpBoughtThisShop = false;
  state.shop.selected = [];
  state.shop.offers = generateShopOffers(state);
  state.popupReason = {
    source: 'boss_victory',
    kickerVi: `ĐẠI BOSS KHU VỰC ${state.raid.sectorNumber} ĐÃ BỊ HẠ`,
    kickerEn: `SECTOR ${state.raid.sectorNumber} CAPITAL BOSS SLAIN`,
    titleVi: 'TRẠM CHỢ ĐEN & LẮP RÁP HẬU BOSS',
    titleEn: 'POST-BOSS ARMORY & HANGAR',
    reasonVi: 'Bạn vừa hạ gục Đại Boss và thu hồi chiến lợi phẩm — hãy nâng cấp lõi & lắp súng trước khi qua Khu Vực mới.',
    reasonEn: 'Capital Boss defeated & loot secured — spin supply roulette, upgrade core stats, and mount gear.',
  };

  // Open Boss black-market roulette while carrying pity progress across bosses
  const l = state.player.loadout;
  l.garageMode = 'SHOP';
  l.activeArmoryTab = 'ROULETTE';
  l.roulette = {
    spinCount: 0,
    freeSpinAvailable: true,
    offers: [],
    lastSpinSeed: Math.floor(state.simTimeMs),
    pityCount: l.roulette?.pityCount ?? 0,
  };

  // Serve 3 fresh Augments + 2 sector weather hazards for the next run
  const allAugs = (Object.keys(AUGMENT_CATALOG) as AugmentId[]).filter(
    (id) => !l.activeAugments.includes(id)
  );
  const shuffledAugs = [...allAugs].sort(() => Math.random() - 0.5);
  l.pendingAugmentChoices = shuffledAugs.slice(0, 3);

  const nonDefaultHazards = (Object.keys(SECTOR_HAZARDS) as SectorHazardId[]).filter(
    (id) => id !== state.sectorHazard
  );
  l.pendingHazardChoices = [...nonDefaultHazards].sort(() => Math.random() - 0.5).slice(0, 2);

  bus.emit('PHASE_CHANGED', { from: 'PLAYING', to: 'SHOP' });
  bus.emit('SHOP_OPENED', { wave: state.wave });
}

export function toggleShopSelection(state: GameState, id: ShopItemId): boolean {
  if (!state.shop.offers.includes(id)) return false;
  if (isShopItemUnavailable(state, id)) return false;

  const existingIdx = state.shop.selected.indexOf(id);
  if (existingIdx !== -1) {
    state.shop.selected.splice(existingIdx, 1);
    return true;
  }

  const price = getShopItemPrice(state, id);
  if (state.money < price) return false;

  state.shop.selected.push(id);
  return true;
}

export function applyShopUpgrade(state: GameState, id: ShopItemId): void {
  const p = state.player;
  switch (id) {
    case 'healthUpgrade':
      p.health = Math.min(p.maxHealth, p.health + 30);
      break;
    case 'maxHealth':
      p.maxHealth += 25;
      p.health = Math.min(p.maxHealth, p.health + 25);
      break;
    case 'shield': {
      const lvl = state.shop.levels.shield;
      p.shieldDurationMs = PLAYER_BASE.shieldDurationBaseMs + lvl * PLAYER_BASE.shieldDurationPerLvlMs;
      p.shieldCooldownMaxMs = Math.max(
        PLAYER_BASE.shieldCooldownMinMs,
        PLAYER_BASE.shieldCooldownBaseMs - lvl * 1000
      );
      p.shieldCooldownMs = Math.min(p.shieldCooldownMs, p.shieldCooldownMaxMs);
      break;
    }
    case 'regen':
      p.hpRegen += 0.6;
      break;
    case 'energyUpgrade':
      p.energyRegen += 5;
      break;
    case 'speedBoost':
      p.speed = Number((p.speed + PLAYER_BASE.speed * 0.1).toFixed(3));
      break;
    case 'dashCooldown':
      p.dashCooldownMs = Math.max(PLAYER_BASE.dashCooldownMinMs, p.dashCooldownMs - 100);
      p.dashCost = Math.max(6, p.dashCost - 1);
      break;
    case 'bulletSpeed':
      p.bulletSpeed = Number((p.bulletSpeed + PLAYER_BASE.bulletSpeed * 0.18).toFixed(3));
      break;
    case 'bulletDamage':
      p.bulletDamage += 10;
      break;
    case 'fireRate':
      p.bulletCooldownMs = Math.max(PLAYER_BASE.bulletCooldownMinMs, p.bulletCooldownMs - 55);
      break;
    case 'doubleShot':
      p.doubleShotCount++;
      break;
    case 'tripleShot':
      p.tripleShotCount++;
      break;
    case 'piercing':
      p.pierceCount++;
      break;
    case 'skillUp':
      if (p.skill.level < p.skill.maxLevel) {
        p.skill.level++;
        p.skill.radius += SKILL_BASE.radiusStep;
        p.skill.damage += SKILL_BASE.damageStep;
        p.skill.cooldownMs = Math.max(
          SKILL_BASE.cooldownMinMs,
          p.skill.cooldownMs - SKILL_BASE.cooldownStepMs
        );
      }
      break;
    case 'luck':
      p.dropChanceBonus = Number((p.dropChanceBonus + 0.12).toFixed(3));
      break;
    case 'magnet':
      p.pickupRange += 80;
      break;
    case 'greed':
      p.moneyBonus = Number((p.moneyBonus + 0.2).toFixed(3));
      break;
    case 'cryoCooler':
      p.maxHeat += 20;
      p.coolingRate = computePlayerCoolingRate(state);
      break;
  }
}

export function purchaseSelectedShopItems(state: GameState, bus: EventBus): boolean {
  if (state.shop.selected.length === 0) return false;

  // Check everything up front so half-broken purchases never eat your credits
  const validItems = state.shop.selected.filter((id) => !isShopItemUnavailable(state, id));
  if (validItems.length === 0) {
    state.shop.selected = [];
    return false;
  }

  const totalCost = validItems.reduce((sum, id) => sum + getShopItemPrice(state, id), 0);
  if (state.money < totalCost) {
    bus.emit('SHOP_ERROR', { reason: 'funds' });
    return false;
  }

  state.money -= totalCost;
  for (const id of validItems) {
    state.shop.levels[id] = (state.shop.levels[id] ?? 0) + 1;
    applyShopUpgrade(state, id);
    if (id === 'skillUp') {
      state.shop.skillUpBoughtThisShop = true;
    }
  }

  state.shop.selected = [];
  bus.emit('SHOP_PURCHASED', { items: validItems, totalCost });
  return true;
}

export function refreshShopOffers(state: GameState, bus: EventBus): boolean {
  const cost = getShopRefreshCost(state);
  if (state.money < cost) {
    bus.emit('SHOP_ERROR', { reason: 'funds' });
    return false;
  }

  state.money -= cost;
  state.shop.refreshCount++;
  state.shop.skillUpBoughtThisShop = false;
  state.shop.selected = [];
  state.shop.offers = generateShopOffers(state);
  bus.emit('SHOP_REFRESHED', { cost });
  return true;
}

// Modular 3D hardpoints and per-weapon upgrade tracking

export interface ComputedPrimaryStats {
  damage: number;
  cooldownMs: number;
  bulletSpeed: number;
  projectiles: number;
  spreadRad: number;
  pierce: number;
  homing: boolean;
  bulletRadius: number;
  bulletStyle: PrimaryWeaponCatalogEntry['baseStats']['bulletStyle'];
  hex: number;
}

export interface ComputedSkillStats {
  damage: number;
  cooldownMs: number;
  radius: number;
  energyCost: number;
}

const CORE_ITEM_SET = new Set<ShopItemId>(CORE_SHOP_ITEM_IDS as readonly ShopItemId[]);

export function isCoreShopItem(id: ShopItemId): boolean {
  return CORE_ITEM_SET.has(id);
}

export function getMountedWeaponUpgradePrice(
  weapon: MountedWeapon,
  key: WeaponUpgradeKey
): number {
  const entry = WEAPON_CATALOG[weapon.weaponId];
  const defs = entry.kind === 'primary' ? PRIMARY_UPGRADE_DEFS : SKILL_UPGRADE_DEFS;
  const def = defs.find((d) => d.key === key);
  if (!def) return 99999;
  const currentLvl = weapon.upgrades[key] ?? 0;
  return Math.round(def.basePrice * Math.pow(def.priceScale, currentLvl));
}

export function isMountedWeaponUpgradeMaxed(
  weapon: MountedWeapon,
  key: WeaponUpgradeKey
): boolean {
  const entry = WEAPON_CATALOG[weapon.weaponId];
  const maxMap = entry.maxUpgrades as Record<string, number>;
  const cap = maxMap[key] ?? 0;
  return (weapon.upgrades[key] ?? 0) >= cap;
}

export function getWeaponSalvageValue(weapon: MountedWeapon | null): number {
  if (!weapon) return 0;
  return Math.floor(weapon.investedCredits * 0.35);
}

export function countMountedPrimaryWeapons(state: GameState): number {
  let count = 0;
  for (const [slotId, mounted] of Object.entries(state.player.loadout.slots)) {
    if (!mounted) continue;
    if (SHIP_SLOT_MAP[slotId as ShipSlotId]?.kind === 'primary') {
      count++;
    }
  }
  return count;
}

function getWeaponAccentHex(weaponId: WeaponId): number {
  switch (weaponId) {
    case 'scatter_cannon':
      return 0xffaa33;
    case 'rail_sniper':
      return 0x99f6ff;
    case 'homing_pod':
      return 0xff5277;
    case 'thermal_sink':
      return 0x34d399;
    case 'skill_salvo':
      return 0xff7b29;
    case 'skill_beam':
      return 0xa855f7;
    case 'skill_emp':
      return 0x22d3ee;
    case 'pulse_blaster':
    default:
      return 0x38e8ff;
  }
}

export interface ActiveSynergiesSummary {
  counts: Record<ManufacturerId, number>;
  tiers: Record<ManufacturerId, 0 | 2 | 3>;
}

export function computeActiveSynergies(player: PlayerState): ActiveSynergiesSummary {
  const counts: Record<ManufacturerId, number> = {
    NOVACORP: 0,
    IRONFORGE: 0,
    AETHER: 0,
    VOIDTECH: 0,
  };
  for (const mounted of Object.values(player.loadout.slots)) {
    if (!mounted) continue;
    const mfg = WEAPON_CATALOG[mounted.weaponId].manufacturer;
    counts[mfg] = (counts[mfg] ?? 0) + 1;
  }
  const tiers: Record<ManufacturerId, 0 | 2 | 3> = {
    NOVACORP: counts.NOVACORP >= 3 ? 3 : counts.NOVACORP >= 2 ? 2 : 0,
    IRONFORGE: counts.IRONFORGE >= 3 ? 3 : counts.IRONFORGE >= 2 ? 2 : 0,
    AETHER: counts.AETHER >= 3 ? 3 : counts.AETHER >= 2 ? 2 : 0,
    VOIDTECH: counts.VOIDTECH >= 3 ? 3 : counts.VOIDTECH >= 2 ? 2 : 0,
  };
  return { counts, tiers };
}

export function computePlayerCoolingRate(state: GameState): number {
  const p = state.player;
  const syn = computeActiveSynergies(p);
  const coreCoolerLvl = state.shop.levels.cryoCooler ?? 0;
  let rate = 22 + (syn.tiers.IRONFORGE >= 2 ? 12 : 0) + coreCoolerLvl * 6;

  for (const mounted of Object.values(p.loadout.slots)) {
    if (!mounted || mounted.weaponId !== 'thermal_sink') continue;
    const entry = WEAPON_CATALOG.thermal_sink as PrimaryWeaponCatalogEntry;
    const velLvl = (mounted.upgrades.velocity as number | undefined) ?? 0;
    const tierMult = mounted.tier === 3 ? 1.85 : mounted.tier === 2 ? 1.4 : 1.0;
    rate += ((entry.coolingBonus ?? 26) + velLvl * 10) * tierMult;
  }

  if (state.sectorHazard === 'solar_storm') {
    rate *= 0.85;
  }
  return Math.round(rate * 10) / 10;
}

// Combines Cryo-Sinks, Core Coolers, NovaCorp 3-pc set bonus, and sector heat weather into one shot-heat multiplier.
export function computeWeaponHeatScale(state: GameState): number {
  const p = state.player;
  const syn = computeActiveSynergies(p);
  const coreCoolerLvl = state.shop.levels.cryoCooler ?? 0;

  let mitigation = coreCoolerLvl * 0.1;
  for (const mounted of Object.values(p.loadout.slots)) {
    if (!mounted || mounted.weaponId !== 'thermal_sink') continue;
    const entry = WEAPON_CATALOG.thermal_sink as PrimaryWeaponCatalogEntry;
    const velLvl = (mounted.upgrades.velocity as number | undefined) ?? 0;
    mitigation += (entry.heatReductionPct ?? 0.22) + (mounted.tier - 1) * 0.08 + velLvl * 0.04;
  }

  const baseReduction = Math.max(0.25, 1.0 - mitigation);
  const novaMult = syn.tiers.NOVACORP >= 3 ? 0.8 : 1.0;
  const hazardMult = state.sectorHazard === 'solar_storm' ? 1.28 : 1.0;
  return Math.max(0.25, baseReduction * novaMult * hazardMult);
}

export function computeMountedPrimaryStats(
  weapon: MountedWeapon,
  player: PlayerState,
  slotId?: ShipSlotId,
  metaDmgMult = 1.0
): ComputedPrimaryStats {
  const entry = WEAPON_CATALOG[weapon.weaponId] as PrimaryWeaponCatalogEntry;
  const base = entry.baseStats;
  const up = weapon.upgrades;
  const syn = computeActiveSynergies(player);

  // Thermal Sink doesn't shoot projectiles — it just keeps your ship from becoming a toaster
  if (weapon.weaponId === 'thermal_sink') {
    return {
      damage: 0,
      cooldownMs: 999999,
      bulletSpeed: 0,
      projectiles: 0,
      spreadRad: 0,
      pierce: 0,
      homing: false,
      bulletRadius: 0,
      bulletStyle: 'player_pulse',
      hex: 0x34d399,
    };
  }

  // Carry forward legacy Core Shop multipliers if any older upgrades touched base stats
  const legacyDmgScale = player.bulletDamage / PLAYER_BASE.bulletDamage;
  const legacyRateScale = player.bulletCooldownMs / PLAYER_BASE.bulletCooldownMs;
  const legacySpeedScale = player.bulletSpeed / PLAYER_BASE.bulletSpeed;
  const legacyExtraProj = player.doubleShotCount + player.tripleShotCount * 2;
  const legacyExtraPierce = player.pierceCount;

  const dmgLvl = (up.damage as number | undefined) ?? 0;
  const rateLvl = (up.fireRate as number | undefined) ?? 0;
  const multiLvl = (up.multiBarrel as number | undefined) ?? 0;
  const pierceLvl = (up.pierce as number | undefined) ?? 0;
  const velLvl = (up.velocity as number | undefined) ?? 0;

  const tierDmgMult = weapon.tier === 3 ? 2.1 : weapon.tier === 2 ? 1.45 : 1.0;
  const novaRateMult = syn.tiers.NOVACORP >= 2 ? 0.86 : 1.0;
  const aetherSpdMult = syn.tiers.AETHER >= 2 ? 1.15 : 1.0;
  const aetherPierceBonus = syn.tiers.AETHER >= 3 ? 1 : 0;

  // Three thermal zones: Cool (<60%), Redline (60-99%: +18% DMG risk-reward), Overheat (>=100%: +30% DMG, sluggish fire)
  const heatRatio = Math.max(0, player.heat / Math.max(1, player.maxHeat));
  let overloadMult = player.isOverloaded
    ? syn.tiers.IRONFORGE >= 3
      ? 1.45
      : 1.3
    : heatRatio >= 0.6
      ? 1.18
      : 1.0;
  const heatCdMult = player.isOverloaded ? 1.4 : 1.0;

  if (player.loadout.activeAugments.includes('hellfire_reactor')) {
    overloadMult *= 1 + Math.min(1, heatRatio) * 0.55;
  }

  const prismBonus =
    slotId === 'nose' && player.loadout.activeAugments.includes('prism_splitter') ? 1 : 0;

  const projectiles = base.projectiles + multiLvl + legacyExtraProj + prismBonus;
  const spreadRad =
    projectiles <= 1
      ? base.spreadRad
      : (base.spreadRad > 0 ? base.spreadRad : 0.11) + (multiLvl + prismBonus) * 0.035;

  const chronoAssassinMult =
    player.chronoActiveMs > 0 && countMutationStacks(player.activeMutations, 'chrono_assassin') > 0
      ? 1.4
      : 1.0;
  const sniperChronoMult = player.hullId === 'sniper' && player.chronoActiveMs > 0 ? 1.35 : 1.0;
  const glassCannonMult =
    countMutationStacks(player.activeMutations, 'glass_cannon') > 0 ? 1.45 : 1.0;
  const overclockDmgMult = player.overclockBuffMs > 0 ? 1.25 : 1.0;
  const v19DmgScale =
    chronoAssassinMult * sniperChronoMult * glassCannonMult * overclockDmgMult * metaDmgMult;

  return {
    damage: Math.max(
      1,
      Math.round(
        base.damage *
          Math.pow(1.18, dmgLvl) *
          tierDmgMult *
          overloadMult *
          legacyDmgScale *
          v19DmgScale
      )
    ),
    cooldownMs: Math.max(
      78,
      Math.round(base.cooldownMs * Math.pow(0.89, rateLvl) * novaRateMult * legacyRateScale * heatCdMult)
    ),
    bulletSpeed:
      Math.round(base.bulletSpeed * Math.pow(1.14, velLvl) * aetherSpdMult * legacySpeedScale * 100) /
      100,
    projectiles,
    spreadRad,
    pierce: base.pierce + pierceLvl + legacyExtraPierce + aetherPierceBonus,
    homing: base.homing,
    bulletRadius: base.bulletRadius + (weapon.tier >= 2 ? 0.8 : 0),
    bulletStyle: base.bulletStyle,
    hex: getWeaponAccentHex(weapon.weaponId),
  };
}

export function computeMountedSkillStats(weapon: MountedWeapon): ComputedSkillStats {
  const entry = WEAPON_CATALOG[weapon.weaponId] as SkillWeaponCatalogEntry;
  const base = entry.baseStats;
  const up = weapon.upgrades;
  const tierMult = weapon.tier === 3 ? 1.9 : weapon.tier === 2 ? 1.38 : 1.0;

  const dmgLvl = (up.damage as number | undefined) ?? 0;
  const cdLvl = (up.cooldown as number | undefined) ?? 0;
  const radLvl = (up.radius as number | undefined) ?? 0;
  const costLvl = (up.energyCost as number | undefined) ?? 0;

  return {
    damage: Math.round(base.damage * Math.pow(1.28, dmgLvl) * tierMult),
    cooldownMs: Math.max(2200, Math.round(base.cooldownMs * Math.pow(0.86, cdLvl))),
    radius: base.radius + radLvl * 35 + (weapon.tier - 1) * 20,
    energyCost: Math.max(8, base.energyCost - costLvl * 4),
  };
}

export function syncSkillStatsFromLoadout(state: GameState): void {
  const p = state.player;
  const mountedSkill = p.loadout.slots.skill_1;
  const isSkillMatch =
    mountedSkill !== null &&
    WEAPON_CATALOG[mountedSkill.weaponId].kind === 'skill' &&
    (WEAPON_CATALOG[mountedSkill.weaponId] as SkillWeaponCatalogEntry).skillMode === p.skill.mode;

  if (mountedSkill && isSkillMatch) {
    const stats = computeMountedSkillStats(mountedSkill);
    const dmgLvl = (mountedSkill.upgrades.damage as number | undefined) ?? 0;
    const legacyBonus = state.shop.levels.skillUp ?? 0;
    p.skill.damage = stats.damage + legacyBonus * 25;
    p.skill.cooldownMs = Math.max(1800, stats.cooldownMs - legacyBonus * 350);
    p.skill.radius = stats.radius + legacyBonus * 25;
    p.skill.cost = stats.energyCost;
    p.skill.level = Math.min(p.skill.maxLevel, SKILL_BASE.level + dmgLvl + legacyBonus + (mountedSkill.tier - 1));
  } else {
    const legacyBonus = state.shop.levels.skillUp ?? 0;
    p.skill.damage = SKILL_BASE.damage + legacyBonus * 35;
    p.skill.cooldownMs = Math.max(3000, SKILL_BASE.cooldownMs - legacyBonus * 600);
    p.skill.radius = SKILL_BASE.radius + legacyBonus * 30;
    p.skill.cost = SKILL_BASE.cost;
    p.skill.level = Math.min(p.skill.maxLevel, SKILL_BASE.level + legacyBonus);
  }
}

export function mountWeaponOnSlot(
  state: GameState,
  slotId: ShipSlotId,
  weaponId: WeaponId,
  bus?: EventBus
): { ok: boolean; reason?: 'funds' | 'slot_mismatch'; salvageRefund: number } {
  const slotDef = SHIP_SLOT_MAP[slotId];
  const entry = WEAPON_CATALOG[weaponId];
  if (!slotDef || !entry || slotDef.kind !== entry.kind) {
    return { ok: false, reason: 'slot_mismatch', salvageRefund: 0 };
  }

  const existing = state.player.loadout.slots[slotId];
  const salvageRefund = getWeaponSalvageValue(existing);
  const price = entry.price;

  if (state.money + salvageRefund < price) {
    bus?.emit('SHOP_ERROR', { reason: 'funds' });
    return { ok: false, reason: 'funds', salvageRefund: 0 };
  }

  state.money = state.money + salvageRefund - price;

  // Weapon upgrades belong strictly to that pod — swap the gun out and you start fresh on the new barrel.
  const mounted: MountedWeapon = {
    instanceId: `wpn-${nextId(state)}`,
    weaponId,
    tier: 1,
    upgrades: {},
    investedCredits: price,
    lastFireMs: -10000,
    recoil: 0,
  };
  state.player.loadout.slots[slotId] = mounted;
  state.player.loadout.selectedSlot = slotId;

  if (entry.kind === 'skill') {
    state.player.skill.mode = (entry as SkillWeaponCatalogEntry).skillMode;
  }
  syncSkillStatsFromLoadout(state);

  bus?.emit('GARAGE_MOUNTED', { slotId, weaponId, salvageRefund });
  return { ok: true, salvageRefund };
}

export function unmountWeaponSlot(
  state: GameState,
  slotId: ShipSlotId,
  bus?: EventBus
): { ok: boolean; reason?: 'empty' | 'min_one_primary'; salvageRefund: number } {
  const existing = state.player.loadout.slots[slotId];
  if (!existing) {
    return { ok: false, reason: 'empty', salvageRefund: 0 };
  }

  const slotDef = SHIP_SLOT_MAP[slotId];
  if (slotDef.kind === 'primary' && countMountedPrimaryWeapons(state) <= 1) {
    return { ok: false, reason: 'min_one_primary', salvageRefund: 0 };
  }

  const salvageRefund = getWeaponSalvageValue(existing);
  state.money += salvageRefund;
  state.player.loadout.slots[slotId] = null;
  syncSkillStatsFromLoadout(state);

  bus?.emit('GARAGE_UNMOUNTED', { slotId, weaponId: existing.weaponId, salvageRefund });
  return { ok: true, salvageRefund };
}

export function upgradeMountedWeapon(
  state: GameState,
  slotId: ShipSlotId,
  key: WeaponUpgradeKey,
  bus?: EventBus
): { ok: boolean; reason?: 'empty' | 'maxed' | 'funds' | 'invalid'; cost?: number } {
  const mounted = state.player.loadout.slots[slotId];
  if (!mounted) return { ok: false, reason: 'empty' };

  const entry = WEAPON_CATALOG[mounted.weaponId];
  const validKeys =
    entry.kind === 'primary'
      ? (PRIMARY_UPGRADE_DEFS.map((d) => d.key) as WeaponUpgradeKey[])
      : (SKILL_UPGRADE_DEFS.map((d) => d.key) as WeaponUpgradeKey[]);
  if (!validKeys.includes(key)) {
    return { ok: false, reason: 'invalid' };
  }

  if (isMountedWeaponUpgradeMaxed(mounted, key)) {
    return { ok: false, reason: 'maxed' };
  }

  const cost = getMountedWeaponUpgradePrice(mounted, key);
  if (state.money < cost) {
    bus?.emit('SHOP_ERROR', { reason: 'funds' });
    return { ok: false, reason: 'funds', cost };
  }

  state.money -= cost;
  const nextLvl = ((mounted.upgrades[key] as number | undefined) ?? 0) + 1;
  mounted.upgrades[key] = nextLvl;
  mounted.investedCredits += cost;

  if (entry.kind === 'skill') {
    syncSkillStatsFromLoadout(state);
  }

  bus?.emit('GARAGE_UPGRADED', { slotId, upgradeKey: key, level: nextLvl, cost });
  return { ok: true, cost };
}

export function buyCoreUpgrade(
  state: GameState,
  id: ShopItemId,
  bus?: EventBus
): { ok: boolean; reason?: 'invalid' | 'maxed' | 'funds'; cost?: number } {
  if (!isCoreShopItem(id)) return { ok: false, reason: 'invalid' };
  if (isShopItemMaxed(state, id)) return { ok: false, reason: 'maxed' };

  const cost = getShopItemPrice(state, id);
  if (state.money < cost) {
    bus?.emit('SHOP_ERROR', { reason: 'funds' });
    return { ok: false, reason: 'funds', cost };
  }

  state.money -= cost;
  state.shop.levels[id] = (state.shop.levels[id] ?? 0) + 1;
  applyShopUpgrade(state, id);
  bus?.emit('SHOP_PURCHASED', { items: [id], totalCost: cost });
  return { ok: true, cost };
}

// Inventory drag-and-drop, 3-of-a-kind fusion, boss roulette & augments

export const ROULETTE_LOCK_FEE = 15;
export const ROULETTE_PITY_THRESHOLD = 5;

export function getRouletteEpicChance(state: GameState): number {
  const luck = state.player.dropChanceBonus;
  const bossBonus = Math.min(0.06, state.bossKills * 0.015);
  const luckBonus = Math.min(0.06, luck * 0.12);
  return Math.min(0.16, 0.06 + bossBonus + luckBonus);
}

export function getRouletteSpinCost(state: GameState): number {
  const r = state.player.loadout.roulette;
  if (r.freeSpinAvailable) return 0;
  const lockedCount = r.offers.filter((o) => o.locked && !o.claimed).length;
  return Math.min(125, 25 + r.spinCount * 20) + lockedCount * ROULETTE_LOCK_FEE;
}

export function toggleRouletteLock(
  state: GameState,
  offerId: string
): { ok: boolean; locked?: boolean; reason?: 'not_shop' | 'not_found' | 'claimed' | 'max_locks' } {
  const l = state.player.loadout;
  if (l.garageMode !== 'SHOP') return { ok: false, reason: 'not_shop' };
  const offer = l.roulette.offers.find((o) => o.offerId === offerId);
  if (!offer) return { ok: false, reason: 'not_found' };
  if (offer.claimed) return { ok: false, reason: 'claimed' };

  if (offer.locked) {
    offer.locked = false;
    return { ok: true, locked: false };
  }

  const activeLocks = l.roulette.offers.filter((o) => o.locked && !o.claimed).length;
  if (activeLocks >= 2) {
    return { ok: false, reason: 'max_locks' };
  }

  offer.locked = true;
  return { ok: true, locked: true };
}

function pickDistinct<T>(pool: readonly T[], avoid?: T): T {
  const filtered = pool.length > 1 && avoid !== undefined ? pool.filter((item) => item !== avoid) : pool;
  const source = filtered.length > 0 ? filtered : pool;
  return source[Math.floor(Math.random() * source.length)];
}

export function spinBossRoulette(
  state: GameState,
  bus?: EventBus
): { ok: boolean; reason?: 'not_shop' | 'funds'; offers: RouletteOffer[] } {
  const l = state.player.loadout;
  if (l.garageMode !== 'SHOP') {
    return { ok: false, reason: 'not_shop', offers: [] };
  }

  const cost = getRouletteSpinCost(state);
  if (state.money < cost) {
    bus?.emit('SHOP_ERROR', { reason: 'funds' });
    return { ok: false, reason: 'funds', offers: [] };
  }

  state.money -= cost;
  if (l.roulette.freeSpinAvailable) {
    l.roulette.freeSpinAvailable = false;
  } else {
    l.roulette.spinCount++;
  }

  const luck = state.player.dropChanceBonus;
  const epicChance = getRouletteEpicChance(state);
  const rareChance = Math.min(0.38, 0.24 + luck * 0.2);

  let epicRolledThisSpin = false;
  const rollRarity = (): RouletteRarity => {
    const roll = Math.random();
    if (roll < epicChance) {
      if (epicRolledThisSpin) return 'rare';
      epicRolledThisSpin = true;
      return 'epic';
    }
    if (roll < epicChance + rareChance) return 'rare';
    return 'common';
  };

  const discountFor = (rar: RouletteRarity): number =>
    rar === 'epic' ? 0.8 : rar === 'rare' ? 0.88 : 0.95;

  const computeOfferPrices = (
    kind: RouletteOffer['kind'],
    rawPrice: number,
    rar: RouletteRarity
  ): { originalPrice: number; price: number } => {
    const minPrice = kind === 'core' ? 20 : kind === 'skill' ? 40 : 25;
    if ((kind === 'weapon' || kind === 'skill') && rar === 'epic') {
      const originalPrice = Math.round(rawPrice * 1.9);
      return {
        originalPrice,
        price: Math.max(minPrice, Math.round(originalPrice * 0.8)),
      };
    }
    return {
      originalPrice: rawPrice,
      price: Math.max(minPrice, Math.round(rawPrice * discountFor(rar))),
    };
  };

  const prevOffers = l.roulette.offers;
  const unlockedIndices: number[] = [];
  const nextOffers: RouletteOffer[] = [];

  // Reel 0: Primary gun or Cryo-Sink
  if (prevOffers[0]?.locked && !prevOffers[0].claimed) {
    nextOffers[0] = prevOffers[0];
  } else {
    const primId = pickDistinct(PRIMARY_WEAPON_IDS, prevOffers[0]?.weaponId);
    const primRarity = rollRarity();
    const rawPrice = WEAPON_CATALOG[primId].price;
    const pricing = computeOfferPrices('weapon', rawPrice, primRarity);
    nextOffers[0] = {
      offerId: `rl-${nextId(state)}`,
      kind: 'weapon',
      weaponId: primId,
      rarity: primRarity,
      originalPrice: pricing.originalPrice,
      price: pricing.price,
      claimed: false,
      locked: false,
    };
    unlockedIndices.push(0);
  }

  // Reel 1: Dorsal skill slot toy
  if (prevOffers[1]?.locked && !prevOffers[1].claimed) {
    nextOffers[1] = prevOffers[1];
  } else {
    const skId = pickDistinct(SKILL_WEAPON_IDS, prevOffers[1]?.weaponId);
    const skRarity = rollRarity();
    const rawPrice = WEAPON_CATALOG[skId].price;
    const pricing = computeOfferPrices('skill', rawPrice, skRarity);
    nextOffers[1] = {
      offerId: `rl-${nextId(state)}`,
      kind: 'skill',
      weaponId: skId,
      rarity: skRarity,
      originalPrice: pricing.originalPrice,
      price: pricing.price,
      claimed: false,
      locked: false,
    };
    unlockedIndices.push(1);
  }

  // Reel 2: Permanent chassis core stat
  if (prevOffers[2]?.locked && !prevOffers[2].claimed) {
    nextOffers[2] = prevOffers[2];
  } else {
    const corePool = CORE_SHOP_ITEM_IDS.filter((id) => !isShopItemMaxed(state, id));
    const coreId = corePool.length > 0 ? pickDistinct(corePool, prevOffers[2]?.coreItemId) : 'healthUpgrade';
    const coreRarity = rollRarity();
    const rawPrice = getShopItemPrice(state, coreId);
    const pricing = computeOfferPrices('core', rawPrice, coreRarity);
    nextOffers[2] = {
      offerId: `rl-${nextId(state)}`,
      kind: 'core',
      coreItemId: coreId,
      rarity: coreRarity,
      originalPrice: pricing.originalPrice,
      price: pricing.price,
      claimed: false,
      locked: false,
    };
    unlockedIndices.push(2);
  }

  // Bad-luck protection: if the player spun enough blanks, force an Epic so they don't rage-quit
  const currentPity = l.roulette.pityCount ?? 0;
  let rolledEpic = unlockedIndices.some((i) => nextOffers[i].rarity === 'epic');
  if (!rolledEpic && currentPity >= ROULETTE_PITY_THRESHOLD && unlockedIndices.length > 0) {
    const upgradeIdx = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)];
    const target = nextOffers[upgradeIdx];
    const pricing = computeOfferPrices(target.kind, target.originalPrice, 'epic');
    target.rarity = 'epic';
    target.originalPrice = pricing.originalPrice;
    target.price = pricing.price;
    rolledEpic = true;
  }

  l.roulette.pityCount = rolledEpic ? 0 : Math.min(ROULETTE_PITY_THRESHOLD, currentPity + 1);
  l.roulette.offers = nextOffers;
  l.roulette.lastSpinSeed = Math.floor(state.simTimeMs);
  bus?.emit('ROULETTE_SPUN', { offers: nextOffers, cost });
  return { ok: true, offers: nextOffers };
}

export function claimRouletteOffer(
  state: GameState,
  offerId: string,
  bus?: EventBus
): { ok: boolean; reason?: 'not_found' | 'claimed' | 'funds' } {
  const offer = state.player.loadout.roulette.offers.find((o) => o.offerId === offerId);
  if (!offer) return { ok: false, reason: 'not_found' };
  if (offer.claimed) return { ok: false, reason: 'claimed' };
  if (state.money < offer.price) {
    bus?.emit('SHOP_ERROR', { reason: 'funds' });
    return { ok: false, reason: 'funds' };
  }

  state.money -= offer.price;
  offer.claimed = true;
  offer.locked = false;

  if (offer.kind === 'core' && offer.coreItemId) {
    state.shop.levels[offer.coreItemId] = (state.shop.levels[offer.coreItemId] ?? 0) + 1;
    applyShopUpgrade(state, offer.coreItemId);
  } else if (offer.weaponId) {
    const newItem: MountedWeapon = {
      instanceId: `wpn-${nextId(state)}`,
      weaponId: offer.weaponId,
      tier: offer.rarity === 'epic' ? 2 : 1,
      upgrades: {},
      investedCredits: offer.price,
      lastFireMs: -10000,
      recoil: 0,
    };
    state.player.loadout.inventory.push(newItem);
  }

  bus?.emit('ROULETTE_CLAIMED', { offerId, kind: offer.kind });
  return { ok: true };
}

export function equipInventoryItemToSlot(
  state: GameState,
  instanceId: string,
  slotId: ShipSlotId,
  bus?: EventBus
): { ok: boolean; reason?: 'not_found' | 'slot_mismatch' } {
  const l = state.player.loadout;
  const invIdx = l.inventory.findIndex((i) => i.instanceId === instanceId);
  if (invIdx === -1) return { ok: false, reason: 'not_found' };

  const item = l.inventory[invIdx];
  const entry = WEAPON_CATALOG[item.weaponId];
  const slotDef = SHIP_SLOT_MAP[slotId];
  if (!slotDef || slotDef.kind !== entry.kind) {
    return { ok: false, reason: 'slot_mismatch' };
  }

  const prev = l.slots[slotId];
  l.inventory.splice(invIdx, 1);
  if (prev) {
    prev.recoil = 0;
    l.inventory.push(prev);
  }
  item.recoil = 0;
  item.lastFireMs = -10000;
  l.slots[slotId] = item;
  l.selectedSlot = slotId;

  if (entry.kind === 'skill') {
    state.player.skill.mode = (entry as SkillWeaponCatalogEntry).skillMode;
  }
  syncSkillStatsFromLoadout(state);
  bus?.emit('GARAGE_MOUNTED', { slotId, weaponId: item.weaponId, salvageRefund: 0 });
  return { ok: true };
}

export function swapShipSlots(
  state: GameState,
  fromSlot: ShipSlotId,
  toSlot: ShipSlotId,
  bus?: EventBus
): { ok: boolean } {
  if (fromSlot === toSlot) return { ok: false };
  const fromDef = SHIP_SLOT_MAP[fromSlot];
  const toDef = SHIP_SLOT_MAP[toSlot];
  if (!fromDef || !toDef || fromDef.kind !== toDef.kind) return { ok: false };

  const l = state.player.loadout;
  const a = l.slots[fromSlot];
  const b = l.slots[toSlot];
  if (!a && !b) return { ok: false };

  l.slots[fromSlot] = b;
  l.slots[toSlot] = a;
  l.selectedSlot = toSlot;
  syncSkillStatsFromLoadout(state);

  const wId = (a ?? b)!.weaponId;
  bus?.emit('GARAGE_MOUNTED', { slotId: toSlot, weaponId: wId, salvageRefund: 0 });
  return { ok: true };
}

export function unequipSlotToInventory(
  state: GameState,
  slotId: ShipSlotId,
  bus?: EventBus
): { ok: boolean; reason?: 'empty' | 'min_one_primary' } {
  const l = state.player.loadout;
  const existing = l.slots[slotId];
  if (!existing) return { ok: false, reason: 'empty' };

  const slotDef = SHIP_SLOT_MAP[slotId];
  if (slotDef.kind === 'primary' && countMountedPrimaryWeapons(state) <= 1) {
    return { ok: false, reason: 'min_one_primary' };
  }

  l.slots[slotId] = null;
  existing.recoil = 0;
  l.inventory.push(existing);
  syncSkillStatsFromLoadout(state);
  bus?.emit('GARAGE_UNMOUNTED', { slotId, weaponId: existing.weaponId, salvageRefund: 0 });
  return { ok: true };
}

export function salvageInventoryItem(
  state: GameState,
  instanceId: string,
  bus?: EventBus
): { ok: boolean; refund: number } {
  const l = state.player.loadout;
  const idx = l.inventory.findIndex((i) => i.instanceId === instanceId);
  if (idx === -1) return { ok: false, refund: 0 };

  const item = l.inventory[idx];
  l.inventory.splice(idx, 1);

  const baseSalvage = Math.floor((item.investedCredits || WEAPON_CATALOG[item.weaponId].price) * 0.35);
  const augMult = l.activeAugments.includes('scrap_magnet') ? 1.25 : 1.0;
  const refund = Math.max(20, Math.round(baseSalvage * item.tier * augMult));
  state.money += refund;
  bus?.emit('GARAGE_UNMOUNTED', { slotId: 'INV', weaponId: item.weaponId, salvageRefund: refund });
  return { ok: true, refund };
}

export interface FusableGroup {
  weaponId: WeaponId;
  tier: 1 | 2;
  count: number;
}

export function findFusableWeaponGroups(state: GameState): FusableGroup[] {
  const counts = new Map<string, FusableGroup>();
  const record = (w: MountedWeapon | null) => {
    if (!w || w.tier >= 3) return;
    const t = (w.tier ?? 1) as 1 | 2;
    const key = `${w.weaponId}:${t}`;
    const g = counts.get(key) ?? { weaponId: w.weaponId, tier: t, count: 0 };
    g.count++;
    counts.set(key, g);
  };

  for (const m of Object.values(state.player.loadout.slots)) {
    record(m);
  }
  for (const m of state.player.loadout.inventory) {
    record(m);
  }

  return Array.from(counts.values()).filter((g) => g.count >= 3);
}

export function fuseWeaponGroup(
  state: GameState,
  weaponId: WeaponId,
  tier: 1 | 2,
  bus?: EventBus
): { ok: boolean; newTier?: 2 | 3 } {
  const l = state.player.loadout;
  const equippedMatches: ShipSlotId[] = [];
  for (const [sid, w] of Object.entries(l.slots) as Array<[ShipSlotId, MountedWeapon | null]>) {
    if (w && w.weaponId === weaponId && w.tier === tier) equippedMatches.push(sid);
  }
  const invMatches = l.inventory.filter((w) => w.weaponId === weaponId && w.tier === tier);

  if (equippedMatches.length + invMatches.length < 3) {
    return { ok: false };
  }

  // Keep the merged pod mounted on the ship if one of the copies was already bolted on
  const host =
    equippedMatches.length > 0 ? l.slots[equippedMatches[0]]! : invMatches[0];
  const consumed: MountedWeapon[] = [];

  // Sacrifice spare inventory copies first before unbolting guns off the wings
  for (const w of invMatches) {
    if (w !== host && consumed.length < 2) consumed.push(w);
  }
  for (const sid of equippedMatches) {
    const w = l.slots[sid]!;
    if (w !== host && consumed.length < 2) {
      consumed.push(w);
      l.slots[sid] = null;
    }
  }
  l.inventory = l.inventory.filter((w) => !consumed.includes(w));

  for (const c of consumed) {
    host.investedCredits += c.investedCredits;
    for (const [k, lvl] of Object.entries(c.upgrades) as Array<[WeaponUpgradeKey, number]>) {
      host.upgrades[k] = Math.max(host.upgrades[k] ?? 0, lvl ?? 0);
    }
  }

  const nextTier = Math.min(3, tier + 1) as 2 | 3;
  host.tier = nextTier;
  syncSkillStatsFromLoadout(state);
  bus?.emit('GARAGE_FUSED', { weaponId, newTier: nextTier });
  return { ok: true, newTier: nextTier };
}

export function selectPostBossAugment(
  state: GameState,
  augmentId: AugmentId,
  bus?: EventBus
): boolean {
  const l = state.player.loadout;
  if (!l.pendingAugmentChoices.includes(augmentId)) return false;
  if (!l.activeAugments.includes(augmentId)) {
    l.activeAugments.push(augmentId);
  }
  l.pendingAugmentChoices = [];
  if (augmentId === 'scrap_magnet') {
    state.player.pickupRange += 120;
  }
  bus?.emit('AUGMENT_SELECTED', { augmentId });
  return true;
}

export function selectNextSectorHazard(state: GameState, hazardId: SectorHazardId): boolean {
  const l = state.player.loadout;
  if (!l.pendingHazardChoices.includes(hazardId)) return false;
  state.sectorHazard = hazardId;
  l.pendingHazardChoices = [];
  const hazardSalt =
    hazardId === 'solar_storm'
      ? 1013
      : hazardId === 'radiation_zone'
        ? 2027
        : hazardId === 'magnetic_nebula'
          ? 3049
          : 4093;
  const nextSeed = (state.sectorMap.seed * 1664525 + state.wave * 1013904223 + hazardSalt) >>> 0;
  state.sectorMap = generateSectorMap(nextSeed || 1, hazardId);
  return true;
}

