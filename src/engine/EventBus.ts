import type { ComboRank, PowerUpType } from '../config/constants';
import type { MutationId } from '../config/mutations';
import type { ShopItemId } from '../config/shopItems';
import type { AugmentId } from '../config/weapons';
import type {
  BossArchetype,
  EnemyType,
  GamePhase,
  QuickDraftOption,
  RaidObjectiveKind,
  RoomDoorKind,
  RoomDoorOption,
  RouletteOffer,
  SkillMode,
} from '../game/types';

export interface GameEvents {
  PHASE_CHANGED: { from: GamePhase; to: GamePhase };
  PLAYER_SHOOT: { multishot: number; piercing: boolean };
  PLAYER_DASH: { x: number; y: number };
  PLAYER_PARRY: { x: number; y: number };
  PLAYER_EXECUTE: { x: number; y: number; enemyType: EnemyType };
  PLAYER_GRAZE: { x: number; y: number };
  THERMAL_PURGE: { x: number; y: number; radius: number };
  ELEMENTAL_COMBO: { kind: 'shatter' | 'arc_chain' | 'overload'; x: number; y: number };
  BARREL_EXPLODED: { x: number; y: number; radius: number };
  ASTEROID_SHATTERED: { x: number; y: number };
  RAID_OBJECTIVE_SPAWNED: { kind: RaidObjectiveKind; x: number; y: number };
  RAID_OBJECTIVE_COMPLETED: { kind: RaidObjectiveKind; completedCount: number; totalRequired: number };
  QUICK_DRAFT_OPENED: { options: QuickDraftOption[] };
  PLAYER_HIT: { damage: number; shielded: boolean };
  PLAYER_HEAL: { amount: number };
  SHIELD_TRIGGERED: { x: number; y: number };
  BOMB_LAUNCHED: { x: number; y: number };
  BOMB_EXPLODED: { x: number; y: number; radius: number };
  SKILL_RAILBEAM: { x: number; y: number; angle: number; hits: number; bulletsCleared: number };
  SKILL_EMP: { x: number; y: number; radius: number; chains: number; bulletsCleared: number };
  SKILL_MODE_CHANGED: { mode: SkillMode };
  ENEMY_HIT: {
    x: number;
    y: number;
    damage: number;
    isCrit: boolean;
    isBoss: boolean;
    nx?: number;
    ny?: number;
  };
  ENEMY_KILLED: {
    x: number;
    y: number;
    type: EnemyType;
    isMinion: boolean;
    scoreEarned: number;
    color: string;
  };
  BOSS_SPAWNED: { archetype: BossArchetype; name: string; wave: number };
  BOSS_ENTRY_IMPACT: { archetype: BossArchetype; x: number; y: number; hex: number; name: string };
  BOSS_PHASE_CHANGED: { archetype: BossArchetype; phase: 2 | 3; x: number; y: number; hex: number };
  BOSS_DEFEATED: { archetype: BossArchetype; x: number; y: number; reward: number };
  BOSS_LASER_FIRE: { x: number; y: number };
  BOSS_CHARGE_START: { x: number; y: number };
  GOLD_COLLECTED: { amount: number; x: number; y: number };
  POWERUP_COLLECTED: { type: PowerUpType; x: number; y: number };
  WAVE_TRANSITION: { wave: number; isBoss: boolean };
  WAVE_CLEARED: { wave: number; bonus: number };
  COMBO_KILL: { kills: number; rank: ComboRank; multiplier: number; scoreEarned: number; color: string };
  COMBO_RANK_UP: { rank: ComboRank; kills: number };
  COMBO_ENDED: { rank: ComboRank; kills: number; score: number };
  SHOP_OPENED: { wave: number };
  SHOP_PURCHASED: { items: ShopItemId[]; totalCost: number };
  SHOP_REFRESHED: { cost: number };
  SHOP_ERROR: { reason: 'funds' };
  GARAGE_MOUNTED: { slotId: string; weaponId: string; salvageRefund: number };
  GARAGE_UNMOUNTED: { slotId: string; weaponId: string; salvageRefund: number };
  GARAGE_UPGRADED: { slotId: string; upgradeKey: string; level: number; cost: number };
  GARAGE_FUSED: { weaponId: string; newTier: number };
  ROULETTE_SPUN: { offers: RouletteOffer[]; cost: number };
  ROULETTE_CLAIMED: { offerId: string; kind: string };
  MODULE_DROPPED: { weaponId: string; x: number; y: number };
  MODULE_COLLECTED: { weaponId: string; x: number; y: number };
  AUGMENT_SELECTED: { augmentId: AugmentId };
  OVERLOAD_STARTED: undefined;
  CHRONO_STARTED: { durationMs: number };
  CHRONO_ENDED: undefined;
  MUTATION_ACQUIRED: { mutationId: MutationId; stacks: number };
  LEVEL_UP: { level: number };
  WARP_JUMP_STARTED: { accentHex: number };
  WARP_ARRIVED: { accentHex: number };
  ROOM_DOORS_OPENED: { roomNumber: number; doors: RoomDoorOption[] };
  ROOM_ENTERED: { roomNumber: number; kind: RoomDoorKind; titleEn: string };
  REINFORCEMENTS_SPAWNED: { count: number };
  STORM_BURN_TICK: { x: number; y: number };
  SNIPER_LOCK: { x: number; y: number };
  SINGULARITY_DETONATED: { x: number; y: number; radius: number };
  DRONE_SHOT: { x: number; y: number };
  GAME_STARTED: undefined;
  GAME_OVER: { score: number; wave: number; maxCombo: number; bossKills: number; shardsEarned?: number };
}

type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<keyof GameEvents, Set<Listener<unknown>>>();

  on<K extends keyof GameEvents>(event: K, listener: Listener<GameEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => {
      set?.delete(listener as Listener<unknown>);
    };
  }

  emit<K extends keyof GameEvents>(
    event: K,
    ...args: GameEvents[K] extends undefined ? [] : [GameEvents[K]]
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    const payload = args[0];
    set.forEach((fn) => fn(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}
