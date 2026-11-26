import {
  get,
  limitToLast,
  onValue,
  orderByChild,
  orderByKey,
  push,
  query,
  type DataSnapshot,
} from 'firebase/database';
import { getLeaderboardRef } from '../config/firebase';
import { HULL_CATALOG, type HullClassId } from '../config/hulls';
import { MUTATION_CATALOG, type MutationId } from '../config/mutations';
import { SHOP_ITEMS, type ShopItemId } from '../config/shopItems';
import {
  AUGMENT_CATALOG,
  SHIP_GRID_SLOTS,
  SHIP_SLOT_MAP,
  WEAPON_CATALOG,
  type AugmentId,
  type ShipSlotId,
  type WeaponId,
} from '../config/weapons';
import type { GameState } from '../game/types';

export type LeaderboardConnectionState = 'connecting' | 'live' | 'cached' | 'offline';

export interface LeaderboardSlotSnapshot {
  slot: ShipSlotId;
  weaponId: WeaponId;
  tier: 1 | 2 | 3;
  upgTotal: number;
}

export interface LeaderboardBuildSnapshot {
  hullId: HullClassId;
  level: number;
  sector: number;
  rooms: number;
  bossKills: number;
  maxCombo: number;
  drones: number;
  slots: LeaderboardSlotSnapshot[];
  augments: AugmentId[];
  mutations: MutationId[];
  coreLevels: Partial<Record<ShopItemId, number>>;
}

export interface LeaderboardEntry {
  key: string;
  name: string;
  score: number;
  wave: number;
  timestamp: number;
  hullId: HullClassId | null;
  build: LeaderboardBuildSnapshot | null;
}

interface LocalBuildRecord {
  hullId: HullClassId;
  build: LeaderboardBuildSnapshot;
}

const CACHE_STORAGE_KEY = 'nv_leaderboard_cache_v2';
const LOCAL_BUILDS_KEY = 'nv_leaderboard_local_builds_v1';
const CACHE_MAX_ENTRIES = 100;
const LOCAL_BUILDS_MAX = 50;
const QUERY_TIMEOUT_MS = 9000;

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function clampInt(val: unknown, min: number, max: number, fallback = min): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error('Connection timeout')), ms);
    Promise.resolve(promise)
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function isValidHullId(id: unknown): id is HullClassId {
  return typeof id === 'string' && hasOwn(HULL_CATALOG, id);
}

function parseSlotSnapshot(raw: unknown): LeaderboardSlotSnapshot | null {
  if (!isPlainObject(raw)) return null;
  const slot = raw.slot;
  const weaponId = raw.weaponId;
  if (typeof slot !== 'string' || !hasOwn(SHIP_SLOT_MAP, slot)) return null;
  if (typeof weaponId !== 'string' || !hasOwn(WEAPON_CATALOG, weaponId)) return null;
  const tierRaw = clampInt(raw.tier, 1, 3, 1);
  const tier = (tierRaw === 3 ? 3 : tierRaw === 2 ? 2 : 1) as 1 | 2 | 3;
  const upgTotal = clampInt(raw.upgTotal, 0, 99, 0);
  return {
    slot: slot as ShipSlotId,
    weaponId: weaponId as WeaponId,
    tier,
    upgTotal,
  };
}

function sanitizeBuildSnapshot(raw: unknown): LeaderboardBuildSnapshot | null {
  if (!isPlainObject(raw)) return null;
  if (!isValidHullId(raw.hullId)) return null;

  const rawSlots = Array.isArray(raw.slots)
    ? raw.slots
    : isPlainObject(raw.slots)
      ? Object.values(raw.slots)
      : [];
  const seenSlots = new Set<ShipSlotId>();
  const slots: LeaderboardSlotSnapshot[] = [];
  for (const item of rawSlots) {
    const parsed = parseSlotSnapshot(item);
    if (!parsed || seenSlots.has(parsed.slot)) continue;
    seenSlots.add(parsed.slot);
    slots.push(parsed);
  }

  const rawAugments = Array.isArray(raw.augments)
    ? raw.augments
    : isPlainObject(raw.augments)
      ? Object.values(raw.augments)
      : [];
  const augments: AugmentId[] = [];
  const seenAug = new Set<AugmentId>();
  for (const item of rawAugments) {
    if (typeof item === 'string' && hasOwn(AUGMENT_CATALOG, item)) {
      const augId = item as AugmentId;
      if (!seenAug.has(augId)) {
        seenAug.add(augId);
        augments.push(augId);
        if (augments.length >= 16) break;
      }
    }
  }

  const rawMutations = Array.isArray(raw.mutations)
    ? raw.mutations
    : isPlainObject(raw.mutations)
      ? Object.values(raw.mutations)
      : [];
  const mutations: MutationId[] = [];
  const mutCounts = new Map<MutationId, number>();
  for (const item of rawMutations) {
    if (typeof item === 'string' && hasOwn(MUTATION_CATALOG, item)) {
      const mutId = item as MutationId;
      const maxStacks = MUTATION_CATALOG[mutId].maxStacks;
      const cur = mutCounts.get(mutId) ?? 0;
      if (cur < maxStacks) {
        mutCounts.set(mutId, cur + 1);
        mutations.push(mutId);
        if (mutations.length >= 24) break;
      }
    }
  }

  const coreLevels: Partial<Record<ShopItemId, number>> = {};
  if (isPlainObject(raw.coreLevels)) {
    for (const [key, val] of Object.entries(raw.coreLevels)) {
      if (key === 'healthUpgrade' || !hasOwn(SHOP_ITEMS, key)) continue;
      const lvl = clampInt(val, 0, 99, 0);
      if (lvl > 0) {
        coreLevels[key as ShopItemId] = lvl;
      }
    }
  }

  return {
    hullId: raw.hullId,
    level: clampInt(raw.level, 1, 999, 1),
    sector: clampInt(raw.sector, 1, 99, 1),
    rooms: clampInt(raw.rooms, 0, 9999, 0),
    bossKills: clampInt(raw.bossKills, 0, 999, 0),
    maxCombo: clampInt(raw.maxCombo, 0, 99999, 0),
    drones: clampInt(raw.drones, 0, 12, 0),
    slots,
    augments,
    mutations,
    coreLevels,
  };
}

export function extractBuildSnapshot(state: GameState): LeaderboardBuildSnapshot {
  const hullId: HullClassId = isValidHullId(state.player.hullId)
    ? state.player.hullId
    : 'interceptor';

  const slots: LeaderboardSlotSnapshot[] = [];
  for (const slotDef of SHIP_GRID_SLOTS) {
    const mounted = state.player.loadout.slots[slotDef.id];
    if (!mounted || !hasOwn(WEAPON_CATALOG, mounted.weaponId)) continue;
    const upgTotal = Object.values(mounted.upgrades).reduce(
      (sum, v) => sum + clampInt(v, 0, 99, 0),
      0
    );
    const tier = (mounted.tier === 3 ? 3 : mounted.tier === 2 ? 2 : 1) as 1 | 2 | 3;
    slots.push({
      slot: slotDef.id,
      weaponId: mounted.weaponId,
      tier,
      upgTotal,
    });
  }

  const augments: AugmentId[] = [];
  const seenAug = new Set<AugmentId>();
  for (const aug of state.player.loadout.activeAugments) {
    if (hasOwn(AUGMENT_CATALOG, aug) && !seenAug.has(aug)) {
      seenAug.add(aug);
      augments.push(aug);
    }
  }

  const mutations: MutationId[] = [];
  for (const mut of state.player.activeMutations) {
    if (hasOwn(MUTATION_CATALOG, mut)) {
      mutations.push(mut);
      if (mutations.length >= 24) break;
    }
  }

  const coreLevels: Partial<Record<ShopItemId, number>> = {};
  for (const [id, lvlRaw] of Object.entries(state.shop.levels)) {
    if (id === 'healthUpgrade' || !hasOwn(SHOP_ITEMS, id)) continue;
    const lvl = clampInt(lvlRaw, 0, 99, 0);
    if (lvl > 0) {
      coreLevels[id as ShopItemId] = lvl;
    }
  }

  return {
    hullId,
    level: clampInt(state.player.level, 1, 999, 1),
    sector: clampInt(state.raid.sectorNumber, 1, 99, 1),
    rooms: clampInt(state.roomsClearedTotal, 0, 9999, 0),
    bossKills: clampInt(state.bossKills, 0, 999, 0),
    maxCombo: clampInt(state.combo.maxCombo, 0, 99999, 0),
    drones: clampInt(state.drones.length, 0, 12, 0),
    slots,
    augments,
    mutations,
    coreLevels,
  };
}

export function sanitizeLeaderboardEntry(key: string, raw: unknown): LeaderboardEntry | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.score !== 'number' || !Number.isFinite(raw.score) || raw.score < 0) {
    return null;
  }

  const cleanName =
    String(raw.name ?? 'Pilot')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .slice(0, 20) || 'Pilot';

  const build = sanitizeBuildSnapshot(raw.build);
  const hullId: HullClassId | null = isValidHullId(raw.hullId)
    ? raw.hullId
    : build
      ? build.hullId
      : null;

  return {
    key: String(key || '').slice(0, 64),
    name: cleanName,
    score: clampInt(raw.score, 0, 10_000_000, 0),
    wave: clampInt(raw.wave, 0, 999, 0),
    timestamp: clampInt(raw.timestamp, 0, Number.MAX_SAFE_INTEGER, 0),
    hullId,
    build,
  };
}

export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.wave !== a.wave) return b.wave - a.wave;
    const bossA = a.build?.bossKills ?? 0;
    const bossB = b.build?.bossKills ?? 0;
    if (bossB !== bossA) return bossB - bossA;
    const tsA = a.timestamp > 0 ? a.timestamp : Number.MAX_SAFE_INTEGER;
    const tsB = b.timestamp > 0 ? b.timestamp : Number.MAX_SAFE_INTEGER;
    return tsA - tsB;
  });
}

function isMissingIndexError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();
  return lower.includes('index not defined') || lower.includes('indexon') || lower.includes('orderby');
}

function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg.toLowerCase().includes('permission_denied') || msg.toLowerCase().includes('permission denied');
}

export class LeaderboardService {
  public lastSubmittedKey: string | null = null;
  public connectionState: LeaderboardConnectionState = 'connecting';
  private indexMissing = false;

  private readLocalBuildsMap(): Record<string, LocalBuildRecord> {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem(LOCAL_BUILDS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!isPlainObject(parsed)) return {};
      const out: Record<string, LocalBuildRecord> = {};
      for (const [k, val] of Object.entries(parsed)) {
        if (!isPlainObject(val)) continue;
        const build = sanitizeBuildSnapshot(val.build);
        if (build) {
          out[k] = { hullId: build.hullId, build };
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  private saveLocalBuildRecord(key: string, build: LeaderboardBuildSnapshot): void {
    if (!key) return;
    try {
      if (typeof localStorage === 'undefined') return;
      const existing = this.readLocalBuildsMap();
      const keys = Object.keys(existing);
      if (keys.length >= LOCAL_BUILDS_MAX) {
        delete existing[keys[0]];
      }
      existing[key] = { hullId: build.hullId, build };
      localStorage.setItem(LOCAL_BUILDS_KEY, JSON.stringify(existing));
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }

  private readCache(): LeaderboardEntry[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const out: LeaderboardEntry[] = [];
      for (const item of parsed) {
        if (!isPlainObject(item)) continue;
        const entry = sanitizeLeaderboardEntry(String(item.key ?? ''), item);
        if (entry) out.push(entry);
      }
      return sortLeaderboardEntries(out);
    } catch {
      return [];
    }
  }

  private writeCache(entries: LeaderboardEntry[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const trimmed = sortLeaderboardEntries(entries).slice(0, CACHE_MAX_ENTRIES);
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }

  private parseSnapshot(snapshot: DataSnapshot): LeaderboardEntry[] {
    const localBuilds = this.readLocalBuildsMap();
    const entries: LeaderboardEntry[] = [];
    snapshot.forEach((child) => {
      const entry = sanitizeLeaderboardEntry(child.key ?? '', child.val());
      if (!entry) return;
      if (!entry.build && entry.key && hasOwn(localBuilds, entry.key)) {
        entry.build = localBuilds[entry.key].build;
        entry.hullId = localBuilds[entry.key].hullId;
      }
      entries.push(entry);
    });
    return sortLeaderboardEntries(entries);
  }

  async fetchAllEntries(): Promise<LeaderboardEntry[]> {
    const ref = getLeaderboardRef();
    if (!ref) {
      const cached = this.readCache();
      if (cached.length > 0) {
        this.connectionState = 'cached';
        return cached;
      }
      this.connectionState = 'offline';
      throw new Error('Firebase unavailable');
    }

    try {
      let snapshot: DataSnapshot;
      if (!this.indexMissing) {
        try {
          snapshot = await withTimeout(
            get(query(ref, orderByChild('score'), limitToLast(200))),
            QUERY_TIMEOUT_MS
          );
        } catch (err) {
          if (!isMissingIndexError(err)) throw err;
          // Fall back seamlessly to key-ordered query when RTDB lacks ".indexOn": ["score"]
          this.indexMissing = true;
          snapshot = await withTimeout(
            get(query(ref, orderByKey(), limitToLast(500))),
            QUERY_TIMEOUT_MS
          );
        }
      } else {
        snapshot = await withTimeout(
          get(query(ref, orderByKey(), limitToLast(500))),
          QUERY_TIMEOUT_MS
        );
      }

      const entries = this.parseSnapshot(snapshot);
      this.writeCache(entries);
      this.connectionState = 'live';
      return entries;
    } catch (err) {
      const cached = this.readCache();
      if (cached.length > 0) {
        this.connectionState = 'cached';
        return cached;
      }
      this.connectionState = 'offline';
      throw err instanceof Error ? err : new Error('Firebase query failed');
    }
  }

  async fetchTop(limit = 50, hullFilter: HullClassId | 'all' = 'all'): Promise<LeaderboardEntry[]> {
    const all = await this.fetchAllEntries();
    const filtered = hullFilter === 'all' ? all : all.filter((e) => e.hullId === hullFilter);
    return filtered.slice(0, Math.max(1, limit));
  }

  subscribe(
    onUpdate: (entries: LeaderboardEntry[], state: LeaderboardConnectionState) => void
  ): () => void {
    const ref = getLeaderboardRef();
    if (!ref) {
      const cached = this.readCache();
      this.connectionState = cached.length > 0 ? 'cached' : 'offline';
      onUpdate(cached, this.connectionState);
      return () => {};
    }

    const q = query(ref, orderByKey(), limitToLast(500));
    const unsubscribe = onValue(
      q,
      (snapshot) => {
        const entries = this.parseSnapshot(snapshot);
        this.writeCache(entries);
        this.connectionState = 'live';
        onUpdate(entries, 'live');
      },
      () => {
        const cached = this.readCache();
        if (cached.length > 0) {
          this.connectionState = 'cached';
          onUpdate(cached, 'cached');
        } else {
          this.connectionState = 'offline';
          onUpdate([], 'offline');
        }
      }
    );

    return unsubscribe;
  }

  async estimateRank(playerScore: number): Promise<number | null> {
    try {
      const entries = await this.fetchAllEntries();
      let higherCount = 0;
      for (const entry of entries) {
        if (entry.score > playerScore) higherCount++;
      }
      return higherCount + 1;
    } catch {
      return null;
    }
  }

  async submitScore(rawName: string, state: GameState): Promise<LeaderboardEntry> {
    const ref = getLeaderboardRef();
    if (!ref) {
      this.connectionState = 'offline';
      throw new Error('Firebase unavailable');
    }

    const cleanName = rawName.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 20);
    if (!cleanName) {
      throw new Error('Empty name');
    }

    const score = clampInt(state.score, 0, 10_000_000, 0);
    const wave = clampInt(state.wave, 0, 999, 0);
    const timestamp = Date.now();
    const build = extractBuildSnapshot(state);

    const fullPayload = {
      name: cleanName,
      score,
      wave,
      timestamp,
      hullId: build.hullId,
      build,
    };

    let pushedKey = '';
    try {
      const pushed = await withTimeout(push(ref, fullPayload), QUERY_TIMEOUT_MS);
      pushedKey = pushed.key ?? '';
    } catch (err) {
      if (!isPermissionError(err)) throw err;
      // Fallback for strict RTDB rules that reject extra fields beyond name/score/wave/timestamp
      const minimalPayload = { name: cleanName, score, wave, timestamp };
      const pushed = await withTimeout(push(ref, minimalPayload), QUERY_TIMEOUT_MS);
      pushedKey = pushed.key ?? '';
      if (pushedKey) {
        this.saveLocalBuildRecord(pushedKey, build);
      }
    }

    this.lastSubmittedKey = pushedKey || null;
    this.connectionState = 'live';

    const created: LeaderboardEntry = {
      key: pushedKey,
      name: cleanName,
      score,
      wave,
      timestamp,
      hullId: build.hullId,
      build,
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('playerName', cleanName);
      }
    } catch {
      // Ignore private browsing storage block
    }

    const cached = this.readCache().filter((e) => e.key !== created.key || !created.key);
    cached.push(created);
    this.writeCache(cached);

    return created;
  }
}
