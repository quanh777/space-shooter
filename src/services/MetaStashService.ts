import type { MountedWeapon, ShipLoadoutState } from '../game/types';

const META_STASH_KEY = 'nebula_v8_meta_stash';

export interface ExtractedMetaStash {
  extractedCount: number;
  lastExtractedAt: number;
  savedSlots: Partial<Record<string, MountedWeapon | null>>;
  savedInventory: MountedWeapon[];
}

function safeCloneWeapon(w: MountedWeapon): MountedWeapon {
  return {
    instanceId: w.instanceId,
    weaponId: w.weaponId,
    tier: w.tier ?? 1,
    upgrades: { ...w.upgrades },
    investedCredits: w.investedCredits,
    lastFireMs: -10000,
    recoil: 0,
  };
}

export function loadMetaStash(): ExtractedMetaStash | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(META_STASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExtractedMetaStash;
    if (!parsed || typeof parsed !== 'object' || !parsed.savedSlots) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveExtractedRun(loadout: ShipLoadoutState): ExtractedMetaStash | null {
  try {
    const prev = loadMetaStash();
    const savedSlots: Partial<Record<string, MountedWeapon | null>> = {};
    for (const [k, v] of Object.entries(loadout.slots)) {
      savedSlots[k] = v ? safeCloneWeapon(v) : null;
    }
    const payload: ExtractedMetaStash = {
      extractedCount: (prev?.extractedCount ?? 0) + 1,
      lastExtractedAt: Date.now(),
      savedSlots,
      savedInventory: loadout.inventory.slice(0, 12).map(safeCloneWeapon),
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(META_STASH_KEY, JSON.stringify(payload));
    }
    return payload;
  } catch {
    return null;
  }
}

export function clearMetaStash(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(META_STASH_KEY);
    }
  } catch {
    // No localStorage in Vitest/Node, and that's totally fine
  }
}
