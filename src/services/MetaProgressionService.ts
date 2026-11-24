import {
  HULL_CATALOG,
  META_UPGRADE_CATALOG,
  type HullClassId,
  type MetaUpgradeId,
} from '../config/hulls';

export const META_STORAGE_KEY = 'spaceshooter_meta_v19';

export interface MetaProfile {
  shards: number;
  totalRuns: number;
  bestRoom: number;
  bestSector: number;
  selectedHull: HullClassId;
  unlockedHulls: HullClassId[];
  upgrades: Record<MetaUpgradeId, number>;
}

export interface MetaComputedBonuses {
  bonusHp: number;
  chronoMult: number;
  rerolls: number;
  startCredits: number;
  shardMult: number;
  pickupBonus: number;
  dmgMult: number;
}

function createDefaultProfile(): MetaProfile {
  return {
    shards: 0,
    totalRuns: 0,
    bestRoom: 0,
    bestSector: 1,
    selectedHull: 'interceptor',
    unlockedHulls: ['interceptor'],
    upgrades: {
      hull_plating: 0,
      chrono_capacitor: 0,
      draft_reroll: 0,
      starting_credits: 0,
      salvage_magnet: 0,
      overclock_core: 0,
    },
  };
}

function readSafeStorage(): MetaProfile {
  try {
    if (typeof localStorage === 'undefined') return createDefaultProfile();
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<MetaProfile>;
    const def = createDefaultProfile();
    const unlocked: HullClassId[] = Array.isArray(parsed.unlockedHulls)
      ? (parsed.unlockedHulls.filter((h) => h in HULL_CATALOG) as HullClassId[])
      : ['interceptor'];
    if (!unlocked.includes('interceptor')) unlocked.unshift('interceptor');
    const selected: HullClassId =
      parsed.selectedHull && unlocked.includes(parsed.selectedHull)
        ? parsed.selectedHull
        : 'interceptor';
    return {
      shards: Math.max(0, Math.floor(Number(parsed.shards) || 0)),
      totalRuns: Math.max(0, Math.floor(Number(parsed.totalRuns) || 0)),
      bestRoom: Math.max(0, Math.floor(Number(parsed.bestRoom) || 0)),
      bestSector: Math.max(1, Math.floor(Number(parsed.bestSector) || 1)),
      selectedHull: selected,
      unlockedHulls: unlocked,
      upgrades: {
        ...def.upgrades,
        ...(parsed.upgrades ?? {}),
      },
    };
  } catch {
    return createDefaultProfile();
  }
}

function writeSafeStorage(profile: MetaProfile): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Node tests and private tabs don't care about our Shard bank
  }
}

export class MetaProgressionService {
  private profile: MetaProfile;

  constructor() {
    this.profile = readSafeStorage();
  }

  getProfile(): MetaProfile {
    return {
      ...this.profile,
      unlockedHulls: [...this.profile.unlockedHulls],
      upgrades: { ...this.profile.upgrades },
    };
  }

  selectHull(id: HullClassId): boolean {
    if (!this.profile.unlockedHulls.includes(id)) return false;
    this.profile.selectedHull = id;
    writeSafeStorage(this.profile);
    return true;
  }

  unlockHull(id: HullClassId): boolean {
    if (this.profile.unlockedHulls.includes(id)) {
      this.profile.selectedHull = id;
      writeSafeStorage(this.profile);
      return true;
    }
    const cost = HULL_CATALOG[id].unlockCostShards;
    if (this.profile.shards < cost) return false;
    this.profile.shards -= cost;
    this.profile.unlockedHulls.push(id);
    this.profile.selectedHull = id;
    writeSafeStorage(this.profile);
    return true;
  }

  getUpgradeCost(id: MetaUpgradeId): number {
    const def = META_UPGRADE_CATALOG[id];
    const lvl = this.profile.upgrades[id] ?? 0;
    return def.baseCost + lvl * def.costStep;
  }

  buyUpgrade(id: MetaUpgradeId): boolean {
    const def = META_UPGRADE_CATALOG[id];
    const lvl = this.profile.upgrades[id] ?? 0;
    if (lvl >= def.maxLevel) return false;
    const cost = this.getUpgradeCost(id);
    if (this.profile.shards < cost) return false;
    this.profile.shards -= cost;
    this.profile.upgrades[id] = lvl + 1;
    writeSafeStorage(this.profile);
    return true;
  }

  computeMetaBonuses(): MetaComputedBonuses {
    const u = this.profile.upgrades;
    return {
      bonusHp: (u.hull_plating ?? 0) * 20,
      chronoMult: 1 + (u.chrono_capacitor ?? 0) * 0.15,
      rerolls: 1 + (u.draft_reroll ?? 0),
      startCredits: (u.starting_credits ?? 0) * 60,
      shardMult: 1 + (u.salvage_magnet ?? 0) * 0.2,
      pickupBonus: (u.salvage_magnet ?? 0) * 30,
      dmgMult: 1 + (u.overclock_core ?? 0) * 0.08,
    };
  }

  grantShards(amount: number): number {
    const add = Math.max(0, Math.floor(amount));
    this.profile.shards += add;
    writeSafeStorage(this.profile);
    return this.profile.shards;
  }

  recordRunReward(summary: {
    roomsCleared: number;
    elitesKilled: number;
    bossKills: number;
    maxCombo: number;
    sectorReached: number;
  }): { shardsEarned: number; totalShards: number } {
    const bonuses = this.computeMetaBonuses();
    const raw =
      12 +
      summary.roomsCleared * 9 +
      summary.elitesKilled * 6 +
      summary.bossKills * 30 +
      Math.min(20, Math.floor(summary.maxCombo * 0.4));
    const shardsEarned = Math.max(10, Math.round(raw * bonuses.shardMult));
    this.profile.shards += shardsEarned;
    this.profile.totalRuns += 1;
    this.profile.bestRoom = Math.max(this.profile.bestRoom, summary.roomsCleared);
    this.profile.bestSector = Math.max(this.profile.bestSector, summary.sectorReached);
    writeSafeStorage(this.profile);
    return { shardsEarned, totalShards: this.profile.shards };
  }

  resetForTests(initialShards = 0): void {
    this.profile = createDefaultProfile();
    this.profile.shards = initialShards;
    writeSafeStorage(this.profile);
  }
}

export const metaProgression = new MetaProgressionService();
