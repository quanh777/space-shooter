export const ARENA_W = 800;
export const ARENA_H = 600;
export const WORLD_SCALE = 0.1; // Squeeze 800x600 sim units down to an 80x60 Three.js stage

export const FIXED_DT = 1 / 60;
export const FIXED_DT_MS = 1000 / 60;
export const MAX_FRAME_DT = 0.05;

export const PLAYER_BASE = {
  width: 44,
  height: 44,
  radius: 18,
  maxHealth: 100,
  speed: 3.45, // px per 60Hz tick — fast enough to dodge, slow enough to feel deliberate
  energyMax: 100,
  energyRegen: 8.5, // per second
  energyDelayAfterDashMs: 1400,
  dashSpeed: 10.6,
  dashDurationMs: 120,
  dashCost: 22,
  dashCooldownBaseMs: 780,
  dashCooldownMinMs: 280,
  dashInvulnMs: 180,
  bulletSpeed: 7.5,
  bulletCooldownMs: 360,
  bulletCooldownMinMs: 110,
  bulletDamage: 26,
  shieldDurationBaseMs: 950,
  shieldDurationPerLvlMs: 750,
  shieldCooldownBaseMs: 18000,
  shieldCooldownMinMs: 7500,
  pickupRangeBase: 60,
  critChance: 0.08,
  critMultiplier: 2.0,
} as const;

export const SKILL_BASE = {
  level: 1,
  maxLevel: 99,
  cooldownMs: 8500,
  cooldownMinMs: 2200,
  cooldownStepMs: 650,
  radius: 95,
  radiusStep: 26,
  damage: 52,
  damageStep: 32,
  cost: 26,
} as const;

export type PowerUpType = 'speed' | 'rapid' | 'damage' | 'magnet';

export interface PowerUpConfig {
  color: string;
  hex: number;
  durationMs: number;
  labelEn: string;
  labelVi: string;
}

export const POWER_UP_CONFIG: Record<PowerUpType, PowerUpConfig> = {
  speed: {
    color: '#22ff88',
    hex: 0x22ff88,
    durationMs: 6000,
    labelEn: 'HYPER THRUST',
    labelVi: 'SIÊU TỐC ĐỘ',
  },
  rapid: {
    color: '#ffee33',
    hex: 0xffee33,
    durationMs: 5000,
    labelEn: 'OVERCLOCK FIRE',
    labelVi: 'BẮN SIÊU THANH',
  },
  damage: {
    color: '#ff6622',
    hex: 0xff6622,
    durationMs: 6000,
    labelEn: 'PLASMA OVERLOAD',
    labelVi: 'TĂNG SÁT THƯƠNG',
  },
  magnet: {
    color: '#ee44ff',
    hex: 0xee44ff,
    durationMs: 7000,
    labelEn: 'GRAVITY MAGNET',
    labelVi: 'NAM CHÂM HÚT ĐỒ',
  },
};

export type ComboRank = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export interface ComboTier {
  minKills: number;
  rank: ComboRank;
  color: string;
  multiplier: number;
}

export const COMBO_TIERS: ComboTier[] = [
  { minKills: 25, rank: 'SSS', color: '#ff5577', multiplier: 3.0 },
  { minKills: 18, rank: 'SS', color: '#ffffff', multiplier: 3.0 },
  { minKills: 13, rank: 'S', color: '#ffdd44', multiplier: 2.5 },
  { minKills: 9, rank: 'A', color: '#ff8833', multiplier: 2.0 },
  { minKills: 6, rank: 'B', color: '#ff5533', multiplier: 1.5 },
  { minKills: 4, rank: 'C', color: '#aa88ff', multiplier: 1.5 },
  { minKills: 2, rank: 'D', color: '#55bbff', multiplier: 1.0 },
];

export const COMBO_WINDOW_MS = 2800;
export const TUTORIAL_HOLD_MS = 1800;
export const TUTORIAL_AUTO_START_MS = 15000;
export const WAVE_REST_MS = 1800;
export const WAVE_TRANSITION_MS = 950;

export function arenaToWorldX(x: number): number {
  return (x - ARENA_W / 2) * WORLD_SCALE;
}

export function arenaToWorldZ(y: number): number {
  return (y - ARENA_H / 2) * WORLD_SCALE;
}

export function worldToArenaX(wx: number): number {
  return wx / WORLD_SCALE + ARENA_W / 2;
}

export function worldToArenaY(wz: number): number {
  return wz / WORLD_SCALE + ARENA_H / 2;
}
