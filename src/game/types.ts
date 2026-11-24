import type { BossMutationId } from '../config/bossMutations';
import type { ComboRank, PowerUpType } from '../config/constants';
import type { HullClassId } from '../config/hulls';
import type { MutationArchetype, MutationId } from '../config/mutations';
import type { ShopItemId } from '../config/shopItems';
import type {
  AugmentId,
  SectorHazardId,
  ShipSlotId,
  WeaponId,
  WeaponUpgradeKey,
} from '../config/weapons';

export type GamePhase =
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'QUICK_DRAFT'
  | 'ROOM_SELECT'
  | 'SHOP'
  | 'GAMEOVER';
export type EnemyType = 'small' | 'medium' | 'large' | 'elite' | 'boss';
export type EnemySpecialKind = 'none' | 'sniper' | 'shielder' | 'bomber' | 'medic';
export type RoomDoorKind = 'armory' | 'mutation' | 'elite' | 'supply' | 'reactor' | 'boss';
export type BossArchetype = 0 | 1 | 2 | 3 | 4 | 5; // 0 Destroyer, 1 Summoner, 2 Overlord, 3 Leviathan, 4 Gemini, 5 Bastion
export type BossTransformStage = 1 | 2 | 3;
export type BotEvolutionTier = 1 | 2 | 3;
export type BossState = 'IDLE' | 'ATTACKING' | 'WAITING_CLEAR_SKILL' | 'WAITING_CLEAR_REST' | 'RESTING';
export type AimMode = 'auto' | 'mouse';
export type GraphicsQuality = 'high' | 'medium' | 'low';
export type BulletVisualStyle = 'bolt' | 'needle' | 'orb' | 'petal';
export type SkillMode = 'salvo' | 'railbeam' | 'emp';
export type EnemyTacticalRole = 'flanker' | 'artillery' | 'interceptor' | 'sniper';

export interface RoomDoorOption {
  id: string;
  kind: RoomDoorKind;
  titleVi: string;
  titleEn: string;
  rewardVi: string;
  rewardEn: string;
  riskTagVi: string;
  riskTagEn: string;
  zoneTagVi: string;
  zoneTagEn: string;
  arenaRadius: number;
  bannerUrl: string;
  accent: string;
  hex: number;
  doubleReward: boolean;
}

export interface WarpTransitionState {
  active: boolean;
  elapsedMs: number;
  durationMs: number;
  accentHex: number;
  titleVi: string;
  titleEn: string;
  zoneLabelVi: string;
  zoneLabelEn: string;
}

export interface CombatDroneEntity {
  id: number;
  x: number;
  y: number;
  angle: number;
  orbitPhase: number;
  lastFireMs: number;
  fireFlash: number;
}

export interface GravitySingularityEntity {
  id: number;
  x: number;
  y: number;
  radius: number;
  lifeMs: number;
  maxLifeMs: number;
  damage: number;
  hex: number;
  pulsesLeft: number;
}

export interface RoomPortalEntity {
  x: number;
  y: number;
  accentHex: number;
  pulse: number;
}

export interface MetaBonusesSnapshot {
  bonusHp: number;
  chronoMult: number;
  rerolls: number;
  startCredits: number;
  shardMult: number;
  pickupBonus: number;
  dmgMult: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type GarageMode = 'INVENTORY' | 'SHOP';
export type RouletteRarity = 'common' | 'rare' | 'epic';

export interface RouletteOffer {
  offerId: string;
  kind: 'weapon' | 'skill' | 'core';
  weaponId?: WeaponId;
  coreItemId?: ShopItemId;
  rarity: RouletteRarity;
  originalPrice: number;
  price: number;
  claimed: boolean;
  locked?: boolean;
}

export interface RouletteState {
  spinCount: number;
  freeSpinAvailable: boolean;
  offers: RouletteOffer[];
  lastSpinSeed: number;
  pityCount: number;
}

export interface MountedWeapon {
  instanceId: string;
  weaponId: WeaponId;
  tier: 1 | 2 | 3;
  upgrades: Partial<Record<WeaponUpgradeKey, number>>;
  investedCredits: number;
  lastFireMs: number;
  recoil: number;
}

export interface ShipLoadoutState {
  slots: Record<ShipSlotId, MountedWeapon | null>;
  selectedSlot: ShipSlotId | 'CORE';
  garageMode: GarageMode;
  activeArmoryTab: 'ROULETTE' | 'INVENTORY' | 'CORE';
  inventory: MountedWeapon[];
  roulette: RouletteState;
  activeAugments: AugmentId[];
  pendingAugmentChoices: AugmentId[];
  pendingHazardChoices: SectorHazardId[];
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  radius: number;
  facingAngle: number;
  targetAngle: number;
  bankAngle: number;
  moving: boolean;

  health: number;
  maxHealth: number;
  hpRegen: number;
  energy: number;
  maxEnergy: number;
  energyRegen: number;

  heat: number;
  maxHeat: number;
  coolingRate: number;
  isOverloaded: boolean;
  ventCooldownMs: number;
  thermalPurgeCooldownMs: number;

  speed: number;
  dashSpeed: number;
  dashCost: number;
  dashCooldownMs: number;
  dashActive: boolean;
  dashStartMs: number;
  dashDirX: number;
  dashDirY: number;
  lastDashEndMs: number;
  dashParryUntilMs: number;

  shieldActive: boolean;
  shieldStartMs: number;
  shieldDurationMs: number;
  shieldCooldownMs: number;
  shieldCooldownMaxMs: number;
  dashInvulnUntilMs: number;

  bulletSpeed: number;
  bulletCooldownMs: number;
  bulletDamage: number;
  lastShotMs: number;
  shotRecoil: number;
  doubleShotCount: number;
  tripleShotCount: number;
  pierceCount: number;

  dropChanceBonus: number;
  pickupRange: number;
  moneyBonus: number;

  hullId: HullClassId;
  level: number;
  xp: number;
  xpToNext: number;
  pendingLevelUps: number;
  innatePierce: number;
  chronoCharge: number;
  chronoActiveMs: number;
  chronoMaxMs: number;
  grazeCount: number;
  activeMutations: MutationId[];
  rerollsLeft: number;
  shotCounter: number;
  orbitalBladeAngle: number;
  overclockBuffMs: number;
  ramShieldMs: number;

  lockedTarget: {
    id: number;
    x: number;
    y: number;
    hpRatio: number;
    isBoss: boolean;
  } | null;

  loadout: ShipLoadoutState;

  skill: {
    mode: SkillMode;
    level: number;
    maxLevel: number;
    cooldownMs: number;
    lastUseMs: number;
    radius: number;
    damage: number;
    cost: number;
  };
}

export interface BulletEntity {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  radius: number;
  damage: number;
  color: string;
  hex: number;
  isEnemy: boolean;
  pierceLeft: number;
  hitIds: Set<number>;
  age: number;
  bounces: number;
  isCritVisual: boolean;
  visualStyle?: BulletVisualStyle;
  grazed?: boolean;
  homing?: boolean;
  element?: 'kinetic' | 'burn' | 'ion' | 'parried';
}

export interface ScheduledBullet {
  x: number;
  y: number;
  angle: number;
  delayMs: number;
  color: string;
  hex: number;
  damage: number;
  speed: number;
  visualStyle?: BulletVisualStyle;
  bounces?: number;
}

export interface EnemyEntity {
  id: number;
  type: Exclude<EnemyType, 'boss'>;
  isMinion: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  hp: number;
  maxHp: number;
  contactDamage: number;
  scoreValue: number;
  moneyValue: number;
  speed: number;
  canDrop: boolean;
  flash: number;
  anim: number;
  aiTimer: number;
  aiState: 'chase' | 'windup' | 'dash';
  orbitAngle: number;
  zigzagDir: number;
  dashCooldown: number;
  dashTimer: number;
  dashDirX: number;
  dashDirY: number;
  lastShotMs: number;
  teleportCooldown: number;
  warpWarmupTimer: number;
  warpLineTimer: number;
  warpStartX: number;
  warpStartY: number;
  faceAngle: number;
  vx: number;
  vy: number;
  tacticalRole: EnemyTacticalRole;
  flankSign: 1 | -1;
  sectorAngle: number;
  strafeTimer: number;
  ingressActive: boolean;
  ingressTargetX: number;
  ingressTargetY: number;
  ingressTicks: number;
  evolutionTier: BotEvolutionTier;
  specialKind: EnemySpecialKind;
  telegraphTimerMs: number;
  telegraphMaxMs: number;
  telegraphAngle: number;
  telegraphTargetX: number;
  telegraphTargetY: number;
  shieldArcRad: number;
  healTargetId: number | null;
  burnMs?: number;
  burnTickMs?: number;
  ionizedMs?: number;
}

export interface BossMine {
  id: number;
  x: number;
  y: number;
  timerMs: number;
  maxTimerMs: number;
  pulse: number;
  homing: boolean;
  color: string;
  hex: number;
}

export interface BossPylon {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  angle: number;
  orbitRadius: number;
  hitFlash: number;
  fireTimerMs: number;
  hex: number;
}

export interface BossClone {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  angle: number;
  lifeMs: number;
  maxLifeMs: number;
  fireTimerMs: number;
  hitFlash: number;
  hex: number;
}

export interface BossHazardZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  warningMs: number;
  maxWarningMs: number;
  detonateFlashMs: number;
  damage: number;
  hex: number;
  detonated: boolean;
}

export interface BossGravityWell {
  id: number;
  x: number;
  y: number;
  radius: number;
  pullStrength: number;
  lifeMs: number;
  maxLifeMs: number;
  pulse: number;
  hex: number;
}

export interface BossSegment {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface BossTwinHull {
  x: number;
  y: number;
  angle: number;
  radius: number;
  hitFlash: number;
  tetherChargingMs: number;
  tetherActiveMs: number;
}

export interface BossEntity {
  id: number;
  archetype: BossArchetype;
  displayName: string;
  color: string;
  hex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  hp: number;
  maxHp: number;
  displayHp: number;
  speed: number;
  damageMultiplier: number;
  phase: 1 | 2 | 3;
  enraged: boolean;
  state: BossState;

  transformStage: BossTransformStage;
  transformBlend: number;
  segments: BossSegment[];
  twin: BossTwinHull | null;
  armorPlates: number;

  mutations: BossMutationId[];
  attackDeck: string[];
  lastAttack: string;
  staggerTimerMs: number;
  laserBeamCount: number;
  laserSpinSpeed: number;
  blinkSlashTimerMs: number;
  blinkOriginX: number;
  blinkOriginY: number;

  entering: boolean;
  entryTimer: number;
  entryState: number;
  dying: boolean;
  deathTimer: number;
  deathState: number;
  deadFinalized: boolean;

  consecutiveAttacks: number;
  maxConsecutiveAttacks: number;
  attackCooldownMs: number;
  restTimerMs: number;
  attackPool: string[];

  rotation: number;
  breathe: number;
  attackFlash: number;
  hitFlash: number;
  bodyRecoil: number;
  coreEnergy: number;
  attackWindup: number;
  restProgress: number;
  currentPhaseLevel: number;
  faceAngle: number;

  transitioning: boolean;
  transitionTimer: number;
  skillChargeTimerMs: number;

  laserCharging: boolean;
  laserFiring: boolean;
  laserAngle: number;
  laserTimerMs: number;
  laserDamageTimerMs: number;

  teleporting: boolean;
  teleportTimerMs: number;
  teleportTarget: Vec2 | null;

  machineGunActive: boolean;
  machineGunTimerMs: number;
  machineGunShotsFired: number;
  machineGunMaxShots: number;

  sniperActive: boolean;
  sniperTimerMs: number;
  sniperShotsFired: number;
  sniperMaxShots: number;

  isCharging: boolean;
  preChargeTimer: number;
  chargeDirX: number;
  chargeDirY: number;
  chargeProgress: number;
  chargeCount: number;

  mines: BossMine[];
  pylons: BossPylon[];
  clones: BossClone[];
  hazardZones: BossHazardZone[];
  gravityWells: BossGravityWell[];
  burnMs?: number;
  burnTickMs?: number;
  ionizedMs?: number;
}

export interface BombProjectile {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  turnSpeed: number;
  targetId: number | null;
  lifeTicks: number;
  radius: number;
}

export interface GoldPickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  size: number;
  age: number;
  homing: boolean;
}

export interface PowerUpPickup {
  id: number;
  x: number;
  y: number;
  type: PowerUpType;
  pulse: number;
  lifeTicks: number;
}

export interface HealthPickup {
  x: number;
  y: number;
  radius: number;
  pulse: number;
}

export interface ParticleEntity {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hex: number;
  size: number;
  maxSize: number;
  life: number;
  maxLife: number;
}

export interface ShockwaveEntity {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  hex: number;
  life: number;
  maxLife: number;
}

export interface AfterimageEntity {
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  gravity?: number;
  isCrit?: boolean;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface PlayerBeamEffect {
  id: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  life: number;
  maxLife: number;
  hex: number;
}

export interface LightningArcEffect {
  id: number;
  points: Vec2[];
  life: number;
  maxLife: number;
  hex: number;
}

export interface TutorialCircle {
  x: number;
  y: number;
  radius: number;
  progressMs: number;
  pulse: number;
}

export interface FloatingModuleEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponId: WeaponId;
  tier: 1 | 2 | 3;
  pulse: number;
  lifeMs: number;
}

export type StormRingPhase = 'IDLE' | 'EXPANDING' | 'SHRINKING' | 'BOSS_LOCK';

export interface StormRingState {
  centerX: number;
  centerY: number;
  targetCenterX: number;
  targetCenterY: number;
  radius: number;
  targetRadius: number;
  shrinkRate: number;
  bossLocked: boolean;
  damagePerSec: number;
  outsideStorm: boolean;
  phase: StormRingPhase;
  transitionActive: boolean;
  transitionFromRadius: number;
  transitionFromX: number;
  transitionFromY: number;
  transitionToRadius: number;
  transitionToX: number;
  transitionToY: number;
  transitionElapsedMs: number;
  transitionDurationMs: number;
  pulseFlash: number;
}

export type SectorBiomeId =
  | 'azure_rift'
  | 'crimson_forge'
  | 'emerald_veil'
  | 'violet_abyss'
  | 'amber_frontier';

export type SectorMapPropKind =
  | 'asteroid'
  | 'crystal'
  | 'ruin_ring'
  | 'beacon_spire'
  | 'derelict_hulk'
  | 'debris_cluster';

export type SectorAtmosphereParticleKind = 'dust' | 'ember' | 'ash' | 'ion';

export interface SectorBiomePalette {
  nebulaHex: number;
  nebulaTintHex: number;
  gridHex: number;
  starHex: number;
  planetA: readonly [number, number, number, number];
  planetB: readonly [number, number, number, number];
}

export interface SectorAtmosphereProfile {
  smokePrimaryHex: number;
  smokeSecondaryHex: number;
  smokeOpacity: number;
  smokeSpeedX: number;
  smokeSpeedZ: number;
  smokeScale: number;
  particleKind: SectorAtmosphereParticleKind;
  particleHex: number;
  particleAltHex: number;
  particleSize: number;
  particleOpacity: number;
  particleDriftX: number;
  particleDriftZ: number;
  fogHex: number;
  fogDensity: number;
  hemiSkyHex: number;
  rimLightHex: number;
  meteoriteDensity: number;
}

export interface SectorMapProp {
  id: number;
  kind: SectorMapPropKind;
  x: number;
  y: number;
  depthY: number;
  scale: number;
  rotSpeed: number;
  seedPhase: number;
  hex: number;
  stratum: 'near' | 'mid' | 'deep';
  variant: 0 | 1 | 2;
  accentHex: number;
}

export interface SectorMapState {
  seed: number;
  hazardId: SectorHazardId;
  biomeId: SectorBiomeId;
  nameVi: string;
  nameEn: string;
  palette: SectorBiomePalette;
  atmosphere: SectorAtmosphereProfile;
  planetAOffset: { x: number; z: number; scale: number };
  planetBOffset: { x: number; z: number; scale: number };
  props: SectorMapProp[];
}

export type ArenaObstacleKind = 'ore_asteroid' | 'plasma_barrel';

export interface ArenaObstacle {
  id: number;
  kind: ArenaObstacleKind;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  rotAngle: number;
  rotSpeed: number;
  flash: number;
  hex: number;
}

export type RaidObjectiveKind = 'reactor' | 'vault' | 'convoy';

export interface RaidObjectiveEntity {
  id: number;
  kind: RaidObjectiveKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  progressMs: number;
  maxProgressMs: number;
  timeLeftMs: number;
  maxTimeMs: number;
  flash: number;
  completed: boolean;
  failed: boolean;
  titleVi: string;
  titleEn: string;
  accentHex: number;
}

export interface QuickDraftOption {
  id: string;
  kind: 'weapon' | 'skill' | 'core' | 'upgrade_bounty' | 'mutation';
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  badgeVi: string;
  badgeEn: string;
  accent: string;
  iconUrl: string;
  weaponId?: WeaponId;
  coreItemId?: ShopItemId;
  creditsBonus?: number;
  targetSlot?: ShipSlotId;
  mutationId?: MutationId;
  archetype?: MutationArchetype;
  isEpic?: boolean;
}

export interface SectorRaidState {
  sectorNumber: number;
  completedCount: number;
  totalRequired: number;
  activeObjective: RaidObjectiveEntity | null;
  pendingQuickDraft: QuickDraftOption[];
  patrolTimerMs: number;
  bossTriggered: boolean;
}

export interface WaveTransitionState {
  active: boolean;
  elapsedMs: number;
  durationMs: number;
  wave: number;
  isBoss: boolean;
}

export interface ComboEndBanner {
  kills: number;
  score: number;
  rank: ComboRank;
  color: string;
  multiplier: number;
  breakdown: Record<EnemyType, number>;
  timerMs: number;
  maxTimerMs: number;
}

export interface ShopState {
  levels: Record<ShopItemId, number>;
  offers: ShopItemId[];
  selected: ShopItemId[];
  refreshCount: number;
  skillUpBoughtThisShop: boolean;
  visitedForWave: number;
}

export interface GameState {
  phase: GamePhase;
  simTimeMs: number;
  hitStopMs: number;
  screenShake: number;
  nextEntityId: number;

  score: number;
  money: number;
  wave: number;
  bossKills: number;

  isResting: boolean;
  restStartMs: number;
  bossSpawnedForWave: boolean;
  neededSpawn: boolean;
  waveStartMs: number;

  tutorialCircle: TutorialCircle | null;
  waveTransition: WaveTransitionState;

  spawnQueue: Array<Array<Exclude<EnemyType, 'boss'>>>;
  spawnTimerMs: number;
  spawnIntervalMs: number;

  player: PlayerState;
  enemies: EnemyEntity[];
  boss: BossEntity | null;
  bullets: BulletEntity[];
  scheduledBullets: ScheduledBullet[];
  bombs: BombProjectile[];
  goldPickups: GoldPickup[];
  powerUps: PowerUpPickup[];
  healthPickup: HealthPickup | null;
  floatingModules: FloatingModuleEntity[];
  arenaObstacles: ArenaObstacle[];
  drones: CombatDroneEntity[];
  singularities: GravitySingularityEntity[];
  timeScale: number;
  runRoomNumber: number;
  roomsTotalPerSector: number;
  roomsClearedTotal: number;
  elitesKilledRun: number;
  currentRoomKind: RoomDoorKind;
  currentRoomTitleVi: string;
  currentRoomTitleEn: string;
  currentRoomZoneVi: string;
  currentRoomZoneEn: string;
  roomRewardDouble: boolean;
  roomWavePending: number;
  roomDraftsPending: number;
  pendingRoomDoors: RoomDoorOption[];
  roomPortal: RoomPortalEntity | null;
  warpTransition: WarpTransitionState;
  shardsEarnedLastRun: number;
  metaBonuses: MetaBonusesSnapshot;
  aimWorldX: number;
  aimWorldY: number;
  aimWorldActive: boolean;
  raid: SectorRaidState;
  stormRing: StormRingState;
  sectorMap: SectorMapState;
  sectorHazard: SectorHazardId;
  radiationMargin: number;

  particles: ParticleEntity[];
  shockwaves: ShockwaveEntity[];
  afterimages: AfterimageEntity[];
  floatingTexts: FloatingText[];
  playerBeams: PlayerBeamEffect[];
  lightningArcs: LightningArcEffect[];

  activeBuffs: Partial<Record<PowerUpType, number>>;

  combo: {
    kills: number;
    timerMs: number;
    maxCombo: number;
    multiplier: number;
    rank: ComboRank;
    color: string;
    scoreBanked: number;
    breakdown: Record<EnemyType, number>;
    endBanner: ComboEndBanner | null;
  };

  shop: ShopState;
}
