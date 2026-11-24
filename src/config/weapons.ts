// Ship hardpoints, mountable guns, dorsal skills, brand sets, and hazard telemetry.
import type { SkillMode } from '../game/types';

export type PrimaryWeaponId =
  | 'pulse_blaster'
  | 'scatter_cannon'
  | 'rail_sniper'
  | 'homing_pod'
  | 'thermal_sink';

export type SkillWeaponId = 'skill_salvo' | 'skill_beam' | 'skill_emp';
export type WeaponId = PrimaryWeaponId | SkillWeaponId;

// You only get one dorsal spine slot, so pick your panic button wisely.
export type ShipSlotId =
  | 'nose'
  | 'wing_l1'
  | 'wing_r1'
  | 'wing_l2'
  | 'wing_r2'
  | 'skill_1';

export type SlotKind = 'primary' | 'skill';

export type PrimaryUpgradeKey = 'damage' | 'fireRate' | 'multiBarrel' | 'pierce' | 'velocity';
export type SkillUpgradeKey = 'damage' | 'cooldown' | 'radius' | 'energyCost';
export type WeaponUpgradeKey = PrimaryUpgradeKey | SkillUpgradeKey;

export type ManufacturerId = 'NOVACORP' | 'IRONFORGE' | 'AETHER' | 'VOIDTECH';

export type AugmentId =
  | 'hellfire_reactor'
  | 'vent_salvo'
  | 'prism_splitter'
  | 'scrap_magnet'
  | 'kinetic_aegis';

export type SectorHazardId =
  | 'normal'
  | 'solar_storm'
  | 'radiation_zone'
  | 'magnetic_nebula';

export type WeaponModelId =
  | 'wpn_pulse_blaster'
  | 'wpn_scatter_cannon'
  | 'wpn_rail_sniper'
  | 'wpn_homing_pod'
  | 'wpn_thermal_sink'
  | 'wpn_skill_salvo'
  | 'wpn_skill_beam'
  | 'wpn_skill_emp';

export interface ShipGridSlotDef {
  id: ShipSlotId;
  kind: SlotKind;
  gridCol: number;
  gridRow: number;
  labelVi: string;
  labelEn: string;
  shortTag: string;
  // Local hull coords inside SceneManager's tilted ship group (+X nose, +Y up, +Z right wing).
  mountOffset: { x: number; y: number; z: number };
  // Spread-out socket anchors so 2D garage pins don't pile on top of each other.
  socketUiOffset: { x: number; y: number; z: number };
  // Flat 2D arena muzzle offset relative to player center (+X forward, +Z right wing).
  fireOffset: { x: number; z: number };
  modelScale: number;
}

export const SHIP_GRID_SLOTS: readonly ShipGridSlotDef[] = [
  {
    id: 'nose',
    kind: 'primary',
    gridCol: 2,
    gridRow: 0,
    labelVi: 'Mũi Chiến Hạm',
    labelEn: 'Nose Airframe',
    shortTag: 'NOSE',
    mountOffset: { x: 0.88, y: 0.0, z: 0.0 },
    socketUiOffset: { x: 1.80, y: 0.14, z: 0.0 },
    fireOffset: { x: 26, z: 0 },
    modelScale: 1.0,
  },
  {
    id: 'wing_l1',
    kind: 'primary',
    gridCol: 1,
    gridRow: 1,
    labelVi: 'Cánh Chính Trái',
    labelEn: 'Port Main Wing',
    shortTag: 'L-WING',
    mountOffset: { x: -0.18, y: 0.0, z: -0.52 },
    socketUiOffset: { x: -0.18, y: 0.14, z: -1.12 },
    fireOffset: { x: 12, z: -16 },
    modelScale: 1.0,
  },
  {
    id: 'wing_r1',
    kind: 'primary',
    gridCol: 3,
    gridRow: 1,
    labelVi: 'Cánh Chính Phải',
    labelEn: 'Stbd Main Wing',
    shortTag: 'R-WING',
    mountOffset: { x: -0.18, y: 0.0, z: 0.52 },
    socketUiOffset: { x: -0.18, y: 0.14, z: 1.12 },
    fireOffset: { x: 12, z: 16 },
    modelScale: 1.0,
  },
  {
    id: 'wing_l2',
    kind: 'primary',
    gridCol: 0,
    gridRow: 2,
    labelVi: 'Đầu Cánh Trái',
    labelEn: 'Port Wingtip',
    shortTag: 'L-TIP',
    mountOffset: { x: -0.42, y: 0.02, z: -1.56 },
    socketUiOffset: { x: -0.52, y: 0.16, z: -2.22 },
    fireOffset: { x: 4, z: -28 },
    modelScale: 1.0,
  },
  {
    id: 'wing_r2',
    kind: 'primary',
    gridCol: 4,
    gridRow: 2,
    labelVi: 'Đầu Cánh Phải',
    labelEn: 'Stbd Wingtip',
    shortTag: 'R-TIP',
    mountOffset: { x: -0.42, y: 0.02, z: 1.56 },
    socketUiOffset: { x: -0.52, y: 0.16, z: 2.22 },
    fireOffset: { x: 4, z: 28 },
    modelScale: 1.0,
  },
  {
    id: 'skill_1',
    kind: 'skill',
    gridCol: 2,
    gridRow: 2,
    labelVi: 'Sống Lưng & Lõi Skill',
    labelEn: 'Dorsal Superstructure',
    shortTag: 'DORSAL CORE',
    mountOffset: { x: -0.78, y: 0.26, z: 0.0 },
    socketUiOffset: { x: -0.78, y: 0.62, z: 0.0 },
    fireOffset: { x: 0, z: 0 },
    modelScale: 1.0,
  },
];

export const SHIP_SLOT_MAP: Record<ShipSlotId, ShipGridSlotDef> = SHIP_GRID_SLOTS.reduce(
  (acc, slot) => {
    acc[slot.id] = slot;
    return acc;
  },
  {} as Record<ShipSlotId, ShipGridSlotDef>
);

export type PlayerBulletStyle = 'player_pulse' | 'player_scatter' | 'player_rail' | 'player_missile';

export interface PrimaryWeaponCatalogEntry {
  id: PrimaryWeaponId;
  kind: 'primary';
  manufacturer: ManufacturerId;
  modelId: WeaponModelId;
  iconUrl: string;
  accent: string;
  price: number;
  heatPerShot: number;
  coolingBonus?: number;
  heatReductionPct?: number;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  baseStats: {
    damage: number;
    cooldownMs: number;
    bulletSpeed: number;
    projectiles: number;
    spreadRad: number;
    pierce: number;
    homing: boolean;
    bulletRadius: number;
    bulletStyle: PlayerBulletStyle;
  };
  maxUpgrades: Record<PrimaryUpgradeKey, number>;
}

export interface SkillWeaponCatalogEntry {
  id: SkillWeaponId;
  kind: 'skill';
  skillMode: SkillMode;
  manufacturer: ManufacturerId;
  modelId: WeaponModelId;
  iconUrl: string;
  accent: string;
  price: number;
  heatPerCast: number;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  baseStats: {
    damage: number;
    cooldownMs: number;
    radius: number;
    energyCost: number;
  };
  maxUpgrades: Record<SkillUpgradeKey, number>;
}

export type WeaponCatalogEntry = PrimaryWeaponCatalogEntry | SkillWeaponCatalogEntry;

export const WEAPON_CATALOG: Record<WeaponId, WeaponCatalogEntry> = {
  pulse_blaster: {
    id: 'pulse_blaster',
    kind: 'primary',
    manufacturer: 'NOVACORP',
    modelId: 'wpn_pulse_blaster',
    iconUrl: './assets/icons/pulse_blaster.png',
    accent: '#38e8ff',
    price: 85,
    heatPerShot: 2.8,
    nameVi: 'Pháo Xung Twin-Pulse Mk.I',
    nameEn: 'Mk.I Pulse Cannon',
    descVi: 'Súng lục nhập môn hiền khô — bắn cho quen tay rồi kiếm hàng nóng gắn thêm nhé.',
    descEn: 'Humble starter pea-shooter. Honest work until you bolt real hardware onto the wings.',
    baseStats: {
      damage: 12,
      cooldownMs: 365,
      bulletSpeed: 7.8,
      projectiles: 1,
      spreadRad: 0.04,
      pierce: 0,
      homing: false,
      bulletRadius: 4.8,
      bulletStyle: 'player_pulse',
    },
    maxUpgrades: { damage: 6, fireRate: 6, multiBarrel: 3, pierce: 2, velocity: 3 },
  },
  scatter_cannon: {
    id: 'scatter_cannon',
    kind: 'primary',
    manufacturer: 'IRONFORGE',
    modelId: 'wpn_scatter_cannon',
    iconUrl: './assets/icons/scatter_cannon.png',
    accent: '#ffaa33',
    price: 130,
    heatPerShot: 6.4,
    nameVi: 'Pháo Chùm Tri-Choke',
    nameEn: 'Tri-Choke Flak Sponson',
    descVi: 'Bọc giáp dày với 3 nòng chùm càn quét tầm gần.',
    descEn: 'Heavy armored gunship block blasting a 3-pellet flak cone.',
    baseStats: {
      damage: 15,
      cooldownMs: 410,
      bulletSpeed: 7.4,
      projectiles: 3,
      spreadRad: 0.34,
      pierce: 0,
      homing: false,
      bulletRadius: 5.5,
      bulletStyle: 'player_scatter',
    },
    maxUpgrades: { damage: 5, fireRate: 4, multiBarrel: 3, pierce: 2, velocity: 3 },
  },
  rail_sniper: {
    id: 'rail_sniper',
    kind: 'primary',
    manufacturer: 'AETHER',
    modelId: 'wpn_rail_sniper',
    iconUrl: './assets/icons/rail_sniper.png',
    accent: '#99f6ff',
    price: 175,
    heatPerShot: 10.2,
    nameVi: 'Thương Điện Từ Rail-Lance',
    nameEn: 'Longbow Rail-Lance',
    descVi: 'Mũi thương siêu thanh xuyên 2 mục tiêu, vận tốc cực đại.',
    descEn: 'Extended kinetic lance with crushing damage and innate 2-target pierce.',
    baseStats: {
      damage: 54,
      cooldownMs: 550,
      bulletSpeed: 13.5,
      projectiles: 1,
      spreadRad: 0.0,
      pierce: 2,
      homing: false,
      bulletRadius: 6.5,
      bulletStyle: 'player_rail',
    },
    maxUpgrades: { damage: 5, fireRate: 5, multiBarrel: 1, pierce: 3, velocity: 3 },
  },
  homing_pod: {
    id: 'homing_pod',
    kind: 'primary',
    manufacturer: 'VOIDTECH',
    modelId: 'wpn_homing_pod',
    iconUrl: './assets/icons/homing_pod.png',
    accent: '#ff5277',
    price: 185,
    heatPerShot: 4.6,
    nameVi: 'Ổ Tên Lửa Dẫn Đường',
    nameEn: 'Hydra Seeker Pod',
    descVi: 'Phóng cặp tên lửa tự bẻ lái săn đuổi mục tiêu quanh tàu.',
    descEn: 'Conformal wing pod launching smart seeker missiles.',
    baseStats: {
      damage: 23,
      cooldownMs: 430,
      bulletSpeed: 6.9,
      projectiles: 2,
      spreadRad: 0.45,
      pierce: 0,
      homing: true,
      bulletRadius: 6.5,
      bulletStyle: 'player_missile',
    },
    maxUpgrades: { damage: 5, fireRate: 4, multiBarrel: 2, pierce: 1, velocity: 3 },
  },
  thermal_sink: {
    id: 'thermal_sink',
    kind: 'primary',
    manufacturer: 'IRONFORGE',
    modelId: 'wpn_thermal_sink',
    iconUrl: './assets/icons/thermal_sink.png',
    accent: '#34d399',
    price: 95,
    heatPerShot: 0,
    coolingBonus: 26,
    heatReductionPct: 0.22,
    nameVi: 'Vây Tản Nhiệt Cryo-Sink',
    nameEn: 'Cryo-Radiator Fin',
    descVi: 'Tăng +26/s tản nhiệt, -22% nhiệt vũ khí & duy trì 78% làm mát khi bắn.',
    descEn: 'Boosts +26/s cooling, -22% weapon heat & maintains 78% active-fire cooling.',
    baseStats: {
      damage: 0,
      cooldownMs: 999999,
      bulletSpeed: 0,
      projectiles: 0,
      spreadRad: 0,
      pierce: 0,
      homing: false,
      bulletRadius: 0,
      bulletStyle: 'player_pulse',
    },
    maxUpgrades: { damage: 0, fireRate: 0, multiBarrel: 0, pierce: 0, velocity: 4 },
  },
  skill_salvo: {
    id: 'skill_salvo',
    kind: 'skill',
    skillMode: 'salvo',
    manufacturer: 'NOVACORP',
    modelId: 'wpn_skill_salvo',
    iconUrl: './assets/icons/skill_salvo.png',
    accent: '#ff7b29',
    price: 140,
    heatPerCast: 10,
    nameVi: 'Khoang VLS Salvo',
    nameEn: 'Archangel VLS Spine',
    descVi: 'Kỹ năng duy nhất: Bung nắp lưng phóng loạt tên lửa hủy diệt.',
    descEn: 'Single-slot dorsal bay deploying a full-map tactical missile salvo.',
    baseStats: {
      damage: 52,
      cooldownMs: 8500,
      radius: 95,
      energyCost: 26,
    },
    maxUpgrades: { damage: 5, cooldown: 4, radius: 3, energyCost: 3 },
  },
  skill_beam: {
    id: 'skill_beam',
    kind: 'skill',
    skillMode: 'railbeam',
    manufacturer: 'AETHER',
    modelId: 'wpn_skill_beam',
    iconUrl: './assets/icons/skill_beam.png',
    accent: '#a855f7',
    price: 175,
    heatPerCast: 14,
    nameVi: 'Siêu Pháo Lưng Rail-Beam',
    nameEn: 'Aegis Spinal Rail-Cannon',
    descVi: 'Kỹ năng duy nhất: Đại bác lưng phóng chùm ion xuyên phá & xóa đạn.',
    descEn: 'Single-slot spinal super-cannon erasing hostiles & projectiles in line.',
    baseStats: {
      damage: 68,
      cooldownMs: 9200,
      radius: 105,
      energyCost: 30,
    },
    maxUpgrades: { damage: 5, cooldown: 4, radius: 3, energyCost: 3 },
  },
  skill_emp: {
    id: 'skill_emp',
    kind: 'skill',
    skillMode: 'emp',
    manufacturer: 'VOIDTECH',
    modelId: 'wpn_skill_emp',
    iconUrl: './assets/icons/skill_emp.png',
    accent: '#22d3ee',
    price: 165,
    heatPerCast: -35,
    nameVi: 'Đĩa Radar Xung Cryo-EMP',
    nameEn: 'Tempest AWACS EMP Halo',
    descVi: 'Kỹ năng duy nhất: Sét dây chuyền xóa đạn & hạ -35 nhiệt tức thì.',
    descEn: 'Single-slot EMP halo chaining lightning while purging -35 heat.',
    baseStats: {
      damage: 54,
      cooldownMs: 8200,
      radius: 120,
      energyCost: 28,
    },
    maxUpgrades: { damage: 5, cooldown: 4, radius: 4, energyCost: 3 },
  },
};

export interface WeaponUpgradeDef<K extends WeaponUpgradeKey = WeaponUpgradeKey> {
  key: K;
  basePrice: number;
  priceScale: number;
  nameVi: string;
  nameEn: string;
  bonusLabelVi: string;
  bonusLabelEn: string;
}

export const PRIMARY_UPGRADE_DEFS: readonly WeaponUpgradeDef<PrimaryUpgradeKey>[] = [
  {
    key: 'damage',
    basePrice: 55,
    priceScale: 1.45,
    nameVi: 'Cường Hóa Hỏa Lực',
    nameEn: 'Ordnance Payload',
    bonusLabelVi: '+18% Sát thương nòng này',
    bonusLabelEn: '+18% Weapon Damage',
  },
  {
    key: 'fireRate',
    basePrice: 60,
    priceScale: 1.48,
    nameVi: 'Bộ Nạp Siêu Thanh',
    nameEn: 'Cyclic Autoloader',
    bonusLabelVi: '-11% Cooldown bắn',
    bonusLabelEn: '-11% Fire Cooldown',
  },
  {
    key: 'multiBarrel',
    basePrice: 120,
    priceScale: 1.65,
    nameVi: 'Tách Nòng Kép',
    nameEn: 'Multi-Barrel Splitter',
    bonusLabelVi: '+1 Đạn mỗi loạt bắn',
    bonusLabelEn: '+1 Projectile per volley',
  },
  {
    key: 'pierce',
    basePrice: 95,
    priceScale: 1.55,
    nameVi: 'Đạn Lõi Xuyên Giáp',
    nameEn: 'Tungsten Piercer',
    bonusLabelVi: '+1 Xuyên mục tiêu',
    bonusLabelEn: '+1 Target Pierce',
  },
  {
    key: 'velocity',
    basePrice: 45,
    priceScale: 1.38,
    nameVi: 'Gia Tốc / Tản Nhiệt',
    nameEn: 'Velocity / Cryo Tune',
    bonusLabelVi: '+14% Tốc độ đạn (+10 Tản nhiệt cho Sink)',
    bonusLabelEn: '+14% Speed (+10 Cooling for Sink)',
  },
];

export const SKILL_UPGRADE_DEFS: readonly WeaponUpgradeDef<SkillUpgradeKey>[] = [
  {
    key: 'damage',
    basePrice: 65,
    priceScale: 1.48,
    nameVi: 'Quá Tải Lõi Năng Lượng',
    nameEn: 'Overcharged Matrix',
    bonusLabelVi: '+28% Sát thương kỹ năng',
    bonusLabelEn: '+28% Skill Damage',
  },
  {
    key: 'cooldown',
    basePrice: 70,
    priceScale: 1.50,
    nameVi: 'Tản Nhiệt Siêu Dẫn',
    nameEn: 'Supercooled Capacitors',
    bonusLabelVi: '-14% Thời gian hồi chiêu',
    bonusLabelEn: '-14% Cooldown',
  },
  {
    key: 'radius',
    basePrice: 60,
    priceScale: 1.42,
    nameVi: 'Mở Rộng Trường Xung',
    nameEn: 'Harmonic Amplifier',
    bonusLabelVi: '+35px Phạm vi tác dụng',
    bonusLabelEn: '+35px Effect Radius',
  },
  {
    key: 'energyCost',
    basePrice: 55,
    priceScale: 1.40,
    nameVi: 'Tiết Kiệm Lõi Plasma',
    nameEn: 'Plasma Efficiency',
    bonusLabelVi: '-4 Năng lượng tiêu hao',
    bonusLabelEn: '-4 Energy Cost',
  },
];

export interface ManufacturerSynergyDef {
  id: ManufacturerId;
  color: string;
  nameVi: string;
  nameEn: string;
  bonus2Vi: string;
  bonus2En: string;
  bonus3Vi: string;
  bonus3En: string;
}

export const MANUFACTURER_SYNERGIES: Record<ManufacturerId, ManufacturerSynergyDef> = {
  NOVACORP: {
    id: 'NOVACORP',
    color: '#38e8ff',
    nameVi: 'NovaCorp',
    nameEn: 'NovaCorp',
    bonus2Vi: '2+ món: +14% Tốc độ bắn toàn tàu',
    bonus2En: '2+ pcs: +14% Fleet Fire Rate',
    bonus3Vi: '3+ món: +25 Hồi NL & giảm 20% Nhiệt',
    bonus3En: '3+ pcs: +25% Energy Regen & -20% Heat',
  },
  IRONFORGE: {
    id: 'IRONFORGE',
    color: '#ff9f1c',
    nameVi: 'IronForge',
    nameEn: 'IronForge',
    bonus2Vi: '2+ món: +12 Tản nhiệt/s & +20 Giáp',
    bonus2En: '2+ pcs: +12 Cooling/s & +20 Armor',
    bonus3Vi: '3+ món: Quá tải tăng +45% DMG, giảm nửa rút máu',
    bonus3En: '3+ pcs: Overload +45% DMG & halved burn',
  },
  AETHER: {
    id: 'AETHER',
    color: '#c084fc',
    nameVi: 'AetherLab',
    nameEn: 'AetherLab',
    bonus2Vi: '2+ món: +15% Vận tốc đạn & +10% Crit',
    bonus2En: '2+ pcs: +15% Velocity & +10% Crit',
    bonus3Vi: '3+ món: Toàn bộ đạn được +1 Xuyên giáp',
    bonus3En: '3+ pcs: All weapons gain +1 Pierce',
  },
  VOIDTECH: {
    id: 'VOIDTECH',
    color: '#fb7185',
    nameVi: 'VoidTech',
    nameEn: 'VoidTech',
    bonus2Vi: '2+ món: +15% Hút vàng & rơi đồ',
    bonus2En: '2+ pcs: +15% Scrap & Module Drops',
    bonus3Vi: '3+ món: Mỗi mạng giết xả -3.5 Nhiệt tức thì',
    bonus3En: '3+ pcs: Kills vent -3.5 Heat',
  },
};

export interface StatBadgeDef {
  text: string;
  tone: 'pos' | 'neg' | 'info';
}

export interface AugmentDef {
  id: AugmentId;
  accent: string;
  iconUrl: string;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  shortDescVi: string;
  shortDescEn: string;
  statBadgesVi: readonly StatBadgeDef[];
  statBadgesEn: readonly StatBadgeDef[];
}

export const AUGMENT_CATALOG: Record<AugmentId, AugmentDef> = {
  hellfire_reactor: {
    id: 'hellfire_reactor',
    accent: '#ff5522',
    iconUrl: './assets/icons/skill_salvo.png',
    nameVi: 'Lò Địa Ngục',
    nameEn: 'Hellfire Reactor',
    descVi: 'Nhiệt càng cao bắn càng đau (tối đa +55% DMG ở 100% Nhiệt).',
    descEn: 'Weapons deal up to +55% bonus DMG scaling with current Heat.',
    shortDescVi: 'Nhiệt càng cao bắn càng đau',
    shortDescEn: 'Bonus weapon DMG at high Heat',
    statBadgesVi: [
      { text: '+55% SÁT THƯƠNG', tone: 'pos' },
      { text: 'THEO NHIỆT', tone: 'info' },
    ],
    statBadgesEn: [
      { text: '+55% MAX DMG', tone: 'pos' },
      { text: 'HEAT SCALING', tone: 'info' },
    ],
  },
  vent_salvo: {
    id: 'vent_salvo',
    accent: '#ff9f1c',
    iconUrl: './assets/icons/homing_pod.png',
    nameVi: 'Xả Nhiệt Tên Lửa',
    nameEn: 'Thermal Vent Salvo',
    descVi: 'Mỗi lần chạm ngưỡng Quá Tải tự phóng 4 tên lửa truy đuổi & hạ -35 Nhiệt.',
    descEn: 'Overload auto-fires 4 homing missiles and vents -35 Heat.',
    shortDescVi: 'Tự phóng tên lửa khi quá tải',
    shortDescEn: 'Fires seekers & cools on Overload',
    statBadgesVi: [
      { text: '4 TÊN LỬA', tone: 'pos' },
      { text: '-35 NHIỆT', tone: 'info' },
    ],
    statBadgesEn: [
      { text: '4 MISSILES', tone: 'pos' },
      { text: '-35 HEAT', tone: 'info' },
    ],
  },
  prism_splitter: {
    id: 'prism_splitter',
    accent: '#38e8ff',
    iconUrl: './assets/icons/pulse_blaster.png',
    nameVi: 'Lăng Kính Mũi Tàu',
    nameEn: 'Nose Prism Splitter',
    descVi: 'Vũ khí gắn ở ô NOSE bắn thêm +1 tia phụ hình quạt.',
    descEn: 'Nose hardpoint fires +1 additional fan projectile.',
    shortDescVi: 'Vũ khí mũi tàu bắn thêm 1 tia',
    shortDescEn: 'Extra projectile on Nose slot',
    statBadgesVi: [
      { text: '+1 TIA ĐẠN MŨI', tone: 'pos' },
      { text: 'Ô MŨI TÀU', tone: 'info' },
    ],
    statBadgesEn: [
      { text: '+1 NOSE BOLT', tone: 'pos' },
      { text: 'NOSE SLOT', tone: 'info' },
    ],
  },
  scrap_magnet: {
    id: 'scrap_magnet',
    accent: '#34d399',
    iconUrl: './assets/icons/core_magnet.png',
    nameVi: 'Từ Trường Thu Hoạch',
    nameEn: 'Scavenger Tractor Core',
    descVi: '+120 tầm hút phế liệu/module & +25% giá trị bán phế liệu.',
    descEn: '+120px pickup radius & +25% salvage payout.',
    shortDescVi: 'Hút phế liệu xa & bán lời hơn',
    shortDescEn: 'Wider loot pull & bonus salvage',
    statBadgesVi: [
      { text: '+120 TẦM HÚT', tone: 'pos' },
      { text: '+25% GIÁ BÁN', tone: 'pos' },
    ],
    statBadgesEn: [
      { text: '+120px MAGNET', tone: 'pos' },
      { text: '+25% SALVAGE', tone: 'pos' },
    ],
  },
  kinetic_aegis: {
    id: 'kinetic_aegis',
    accent: '#a855f7',
    iconUrl: './assets/icons/core_dash.png',
    nameVi: 'Lướt Pha Xả Nhiệt',
    nameEn: 'Phase Thermal Dump',
    descVi: 'Mỗi lần Lướt (Shift) xả ngay -18 Nhiệt và giảm 1s hồi chiêu Skill.',
    descEn: 'Dashing instantly vents -18 Heat and shaves 1s off Skill CD.',
    shortDescVi: 'Lướt [SHIFT] xả nhiệt & giảm hồi chiêu',
    shortDescEn: 'Dash cools weapons & lowers CD',
    statBadgesVi: [
      { text: '-18 NHIỆT', tone: 'pos' },
      { text: '-1s HỒI SKILL', tone: 'info' },
    ],
    statBadgesEn: [
      { text: '-18 HEAT', tone: 'pos' },
      { text: '-1s SKILL CD', tone: 'info' },
    ],
  },
};

export interface SectorHazardDef {
  id: SectorHazardId;
  accent: string;
  iconUrl: string;
  bannerUrl: string;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  statBadgesVi: readonly StatBadgeDef[];
  statBadgesEn: readonly StatBadgeDef[];
}

export const SECTOR_HAZARDS: Record<SectorHazardId, SectorHazardDef> = {
  normal: {
    id: 'normal',
    accent: '#38e8ff',
    iconUrl: './assets/icons/core_speed.png',
    bannerUrl: './assets/sectors/sector_normal.jpg',
    nameVi: 'Quỹ Đạo Ổn Định',
    nameEn: 'Clear Sector',
    descVi: 'Trời quang mây tạnh, súng tản nhiệt chuẩn — đánh cho đỡ phải đổ lỗi thời tiết.',
    descEn: 'Calm thermals and clear space — zero weather excuses here.',
    statBadgesVi: [{ text: 'ỔN ĐỊNH · CÂN BẰNG', tone: 'info' }],
    statBadgesEn: [{ text: 'BALANCED SECTOR', tone: 'info' }],
  },
  solar_storm: {
    id: 'solar_storm',
    accent: '#ff7b29',
    iconUrl: './assets/icons/core_greed.png',
    bannerUrl: './assets/sectors/sector_solar_storm.jpg',
    nameVi: 'Bão Bức Xạ Mặt Trời',
    nameEn: 'Solar Flare Storm',
    descVi: 'Vàng rớt nhiều hơn hẳn, đổi lại súng nóng nhanh như điện thoại chơi max setting.',
    descEn: 'Juicier loot drops, at the price of guns running hotter than a summer laptop.',
    statBadgesVi: [
      { text: '+25% VÀNG & ĐỒ', tone: 'pos' },
      { text: '+28% NHIỆT SÚNG', tone: 'neg' },
    ],
    statBadgesEn: [
      { text: '+25% LOOT & CR', tone: 'pos' },
      { text: '+28% WEAPON HEAT', tone: 'neg' },
    ],
  },
  radiation_zone: {
    id: 'radiation_zone',
    accent: '#ef4444',
    iconUrl: './assets/icons/core_shield.png',
    bannerUrl: './assets/sectors/sector_radiation_zone.jpg',
    nameVi: 'Vành Đai Cách Ly',
    nameEn: 'Quarantine Storm',
    descVi: 'Vòng bo ép chặt hơn bình thường — khỏi mơ chuyện chạy trốn ra sát mép.',
    descEn: 'Tighter storm walls — corner campers will be politely barbecued.',
    statBadgesVi: [
      { text: 'BO THU HẸP MẠNH', tone: 'neg' },
      { text: 'CHIẾN ĐẤU CẬN CHIẾN', tone: 'info' },
    ],
    statBadgesEn: [
      { text: 'TIGHTER RING', tone: 'neg' },
      { text: 'CLOSE COMBAT', tone: 'info' },
    ],
  },
  magnetic_nebula: {
    id: 'magnetic_nebula',
    accent: '#c084fc',
    iconUrl: './assets/icons/core_energy.png',
    bannerUrl: './assets/sectors/sector_magnetic_nebula.jpg',
    nameVi: 'Tinh Vân Từ Trường',
    nameEn: 'Magnetic Nebula',
    descVi: 'Năng lượng hồi vù vù và tàu trôi mượt hơn — hợp gu dân thích lạng lách.',
    descEn: 'Juiced Energy regen and silky drift — basically an arcade ice-skating rink.',
    statBadgesVi: [
      { text: '+40% HỒI NĂNG LƯỢNG', tone: 'pos' },
      { text: 'TRÔI QUÁN TÍNH', tone: 'info' },
    ],
    statBadgesEn: [
      { text: '+40% EN REGEN', tone: 'pos' },
      { text: 'ZERO-G DRIFT', tone: 'info' },
    ],
  },
};

export const CORE_SHOP_ITEM_IDS = [
  'healthUpgrade',
  'maxHealth',
  'shield',
  'regen',
  'energyUpgrade',
  'speedBoost',
  'dashCooldown',
  'luck',
  'magnet',
  'greed',
  'cryoCooler',
] as const;

export const SKILL_MODE_TO_WEAPON_ID: Record<SkillMode, SkillWeaponId> = {
  salvo: 'skill_salvo',
  railbeam: 'skill_beam',
  emp: 'skill_emp',
};

export const PRIMARY_WEAPON_IDS: readonly PrimaryWeaponId[] = [
  'pulse_blaster',
  'scatter_cannon',
  'rail_sniper',
  'homing_pod',
  'thermal_sink',
];

export const SKILL_WEAPON_IDS: readonly SkillWeaponId[] = [
  'skill_salvo',
  'skill_beam',
  'skill_emp',
];
