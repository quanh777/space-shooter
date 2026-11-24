import { ACHIEVEMENTS, ACHIEVEMENT_LIST, type AchievementId } from '../config/achievements';
import type { EventBus } from '../engine/EventBus';

const STORAGE_KEY = 'spaceshooter_achievements_v2';

export type AchievementStore = Record<AchievementId, number>;

export interface AchievementUnlockEvent {
  id: AchievementId;
  level: number;
}

function createEmptyStore(): AchievementStore {
  return {
    kills: 0,
    waves: 0,
    bosses: 0,
    money: 0,
    dashes: 0,
    purchases: 0,
    games: 0,
    highScore: 0,
  };
}

export class AchievementService {
  private data: AchievementStore = createEmptyStore();
  private unlockListeners = new Set<(ev: AchievementUnlockEvent) => void>();
  private storage: Storage | null;

  constructor(bus?: EventBus, storage?: Storage | null) {
    this.storage = storage !== undefined ? storage : typeof localStorage !== 'undefined' ? localStorage : null;
    this.load();

    if (bus) {
      bus.on('ENEMY_KILLED', () => this.record('kills', 1));
      bus.on('BOSS_DEFEATED', () => this.record('bosses', 1));
      bus.on('GOLD_COLLECTED', ({ amount }) => this.record('money', amount));
      bus.on('PLAYER_DASH', () => this.record('dashes', 1));
      bus.on('SHOP_PURCHASED', ({ items }) => this.record('purchases', items.length));
      bus.on('GAME_STARTED', () => this.record('games', 1));
      bus.on('WAVE_CLEARED', ({ wave }) => this.record('waves', wave));
      bus.on('GAME_OVER', ({ score, wave }) => {
        this.record('highScore', score);
        this.record('waves', wave);
      });
    }
  }

  onUnlock(cb: (ev: AchievementUnlockEvent) => void): () => void {
    this.unlockListeners.add(cb);
    return () => this.unlockListeners.delete(cb);
  }

  load(): void {
    this.data = createEmptyStore();
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<AchievementId, unknown>>;
      if (parsed && typeof parsed === 'object') {
        for (const def of ACHIEVEMENT_LIST) {
          const val = Number(parsed[def.id]);
          if (Number.isFinite(val) && val >= 0) {
            this.data[def.id] = Math.floor(val);
          }
        }
      }
    } catch {
      // Someone poked localStorage with a fork; reset cleanly instead of crashing
      this.data = createEmptyStore();
    }
  }

  save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Private browsing / full quota — quietly skip saving
    }
  }

  getValue(id: AchievementId): number {
    return this.data[id] ?? 0;
  }

  getLevel(id: AchievementId): number {
    const def = ACHIEVEMENTS[id];
    const value = this.getValue(id);
    let level = 0;
    for (let i = 0; i < def.levels.length; i++) {
      if (value >= def.levels[i]) level = i + 1;
      else break;
    }
    return level;
  }

  getProgress(id: AchievementId): {
    current: number;
    target: number;
    level: number;
    maxLevel: number;
    percent: number;
    isMaxed: boolean;
  } {
    const def = ACHIEVEMENTS[id];
    const current = this.getValue(id);
    const level = this.getLevel(id);
    const maxLevel = def.levels.length;
    const isMaxed = level >= maxLevel;
    const prevTarget = level > 0 ? def.levels[level - 1] : 0;
    const target = isMaxed ? def.levels[maxLevel - 1] : def.levels[level];
    const range = Math.max(1, target - prevTarget);
    const percent = isMaxed ? 100 : Math.max(0, Math.min(100, ((current - prevTarget) / range) * 100));

    return { current, target, level, maxLevel, percent, isMaxed };
  }

  getSummary(): { unlocked: number; total: number } {
    let unlocked = 0;
    let total = 0;
    for (const def of ACHIEVEMENT_LIST) {
      total += def.levels.length;
      unlocked += this.getLevel(def.id);
    }
    return { unlocked, total };
  }

  record(id: AchievementId, value: number): number {
    if (!Number.isFinite(value) || value <= 0) return this.getLevel(id);
    const def = ACHIEVEMENTS[id];
    const prevLevel = this.getLevel(id);

    if (def.mode === 'best') {
      if (value > this.data[id]) {
        this.data[id] = Math.floor(value);
      }
    } else {
      this.data[id] = Math.floor((this.data[id] || 0) + value);
    }

    this.save();

    const newLevel = this.getLevel(id);
    if (newLevel > prevLevel) {
      for (let lvl = prevLevel + 1; lvl <= newLevel; lvl++) {
        this.unlockListeners.forEach((cb) => cb({ id, level: lvl }));
      }
    }
    return newLevel;
  }
}
