import {
  get,
  limitToLast,
  orderByChild,
  push,
  query,
  startAt,
} from 'firebase/database';
import { getLeaderboardRef } from '../config/firebase';

export interface LeaderboardEntry {
  key: string;
  name: string;
  score: number;
  wave: number;
  timestamp: number;
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Connection timeout')), ms);
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

export class LeaderboardService {
  public lastSubmittedKey: string | null = null;

  async fetchTop(limit = 10): Promise<LeaderboardEntry[]> {
    const ref = getLeaderboardRef();
    if (!ref) {
      throw new Error('Firebase unavailable');
    }

    const q = query(ref, orderByChild('score'), limitToLast(limit));
    const snapshot = await withTimeout(get(q), 9000);
    const entries: LeaderboardEntry[] = [];

    snapshot.forEach((child) => {
      const val = child.val() as Partial<LeaderboardEntry> | null;
      if (!val || typeof val.score !== 'number') return;
      entries.push({
        key: child.key ?? '',
        name: String(val.name ?? 'Pilot').slice(0, 20),
        score: Math.max(0, Math.floor(val.score)),
        wave: Math.max(0, Math.floor(Number(val.wave) || 0)),
        timestamp: Number(val.timestamp) || 0,
      });
    });

    entries.sort((a, b) => b.score - a.score);
    return entries;
  }

  async estimateRank(playerScore: number): Promise<number | null> {
    const ref = getLeaderboardRef();
    if (!ref) return null;

    try {
      // Only pull scores higher than yours — nobody wants to download 10,000 rows just for a rank estimate
      const q = query(ref, orderByChild('score'), startAt(playerScore + 1));
      const snapshot = await withTimeout(get(q), 6000);
      let higherCount = 0;
      snapshot.forEach(() => {
        higherCount++;
      });
      return higherCount + 1;
    } catch {
      return null;
    }
  }

  async submitScore(rawName: string, score: number, wave: number): Promise<string> {
    const ref = getLeaderboardRef();
    if (!ref) {
      throw new Error('Firebase unavailable');
    }

    const cleanName = rawName.trim().slice(0, 20);
    if (!cleanName) {
      throw new Error('Empty name');
    }

    const payload = {
      name: cleanName,
      score: Math.max(0, Math.floor(score)),
      wave: Math.max(0, Math.floor(wave)),
      timestamp: Date.now(),
    };

    const pushed = await withTimeout(push(ref, payload), 9000);
    this.lastSubmittedKey = pushed.key;
    try {
      localStorage.setItem('playerName', cleanName);
    } catch {
      // Private tab blocked localStorage; not the end of the world
    }
    return pushed.key ?? '';
  }
}
