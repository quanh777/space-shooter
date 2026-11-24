// Playable hull classes and permanent Meta-Forge upgrades bought with Scrap Shards.
import type { ManufacturerId, PrimaryWeaponId, ShipSlotId } from './weapons';

export type HullClassId = 'interceptor' | 'carrier' | 'juggernaut' | 'sniper';

export interface HullClassDef {
  id: HullClassId;
  nameVi: string;
  nameEn: string;
  roleVi: string;
  roleEn: string;
  passiveTitleVi: string;
  passiveTitleEn: string;
  passiveDescVi: string;
  passiveDescEn: string;
  unlockCostShards: number;
  accent: string;
  accentHex: number;
  livery: ManufacturerId;
  starterWeapon: PrimaryWeaponId;
  starterSlot: ShipSlotId;
  bonusHp: number;
  speedMult: number;
  dashCdMult: number;
  chronoGainMult: number;
  chronoDurationMult: number;
  startingDrones: number;
  innatePierce?: number;
  statArmor: 1 | 2 | 3 | 4 | 5;
  statSpeed: 1 | 2 | 3 | 4 | 5;
  statTech: 1 | 2 | 3 | 4 | 5;
  iconUrl: string;
}

export const HULL_CLASS_ORDER: readonly HullClassId[] = [
  'interceptor',
  'carrier',
  'juggernaut',
  'sniper',
];

export const HULL_CATALOG: Record<HullClassId, HullClassDef> = {
  interceptor: {
    id: 'interceptor',
    nameVi: 'Vanguard Tiêm Kích',
    nameEn: 'Vanguard Interceptor',
    roleVi: 'CƠ ĐỘNG / PHẢN ĐÒN',
    roleEn: 'AGILITY / PARRY',
    passiveTitleVi: 'Phản Xạ Lưỡi Kiếm',
    passiveTitleEn: 'Blade Reflex',
    passiveDescVi: 'Giảm 20% hồi chiêu Dash & lách đạn sạc Chrono +25%. Cầm tạm súng Mk.I ra đồng trước đã.',
    passiveDescEn: '-20% Dash cooldown and +25% Graze Chrono gain. Starts with a humble Mk.I pea-shooter.',
    unlockCostShards: 0,
    accent: '#38e8ff',
    accentHex: 0x38e8ff,
    livery: 'NOVACORP',
    starterWeapon: 'pulse_blaster',
    starterSlot: 'wing_l1',
    bonusHp: 0,
    speedMult: 1.06,
    dashCdMult: 0.8,
    chronoGainMult: 1.25,
    chronoDurationMult: 1.0,
    startingDrones: 0,
    innatePierce: 0,
    statArmor: 2,
    statSpeed: 5,
    statTech: 3,
    iconUrl: '/assets/hulls/hull_interceptor.jpg',
  },
  carrier: {
    id: 'carrier',
    nameVi: 'Mẫu Hạm Aether',
    nameEn: 'Aether Carrier',
    roleVi: 'BẦY ĐÀN DRONE',
    roleEn: 'SWARM DRONES',
    passiveTitleVi: 'Liên Kết Bầy Đàn',
    passiveTitleEn: 'Swarm Link',
    passiveDescVi: 'Dẫn theo 1 bé Drone trinh sát & tự vá +8 HP qua mỗi phòng (đỡ tốn tiền sửa xe).',
    passiveDescEn: 'Starts with 1 Scout Drone wingman & patches +8 HP between rooms.',
    unlockCostShards: 80,
    accent: '#34d399',
    accentHex: 0x34d399,
    livery: 'AETHER',
    starterWeapon: 'pulse_blaster',
    starterSlot: 'wing_l1',
    bonusHp: 10,
    speedMult: 0.96,
    dashCdMult: 1.0,
    chronoGainMult: 1.0,
    chronoDurationMult: 1.0,
    startingDrones: 1,
    innatePierce: 0,
    statArmor: 3,
    statSpeed: 3,
    statTech: 5,
    iconUrl: '/assets/hulls/hull_carrier.jpg',
  },
  juggernaut: {
    id: 'juggernaut',
    nameVi: 'Pháo Đài Bastion',
    nameEn: 'Bastion Juggernaut',
    roleVi: 'HÚC PHÁ / GIÁP DÀY',
    roleEn: 'RAMMER / TANK',
    passiveTitleVi: 'Xung Lực Phá Giáp',
    passiveTitleEn: 'Kinetic Battering Ram',
    passiveDescVi: '+30 HP tối đa; lướt xuyên địch đẩy lùi cực gắt & dập bớt nhiệt như xe ủi.',
    passiveDescEn: '+30 base HP; dashing through foes slams them back with solid-body impulse.',
    unlockCostShards: 150,
    accent: '#fb923c',
    accentHex: 0xfb923c,
    livery: 'IRONFORGE',
    starterWeapon: 'pulse_blaster',
    starterSlot: 'wing_l1',
    bonusHp: 30,
    speedMult: 0.93,
    dashCdMult: 0.92,
    chronoGainMult: 1.0,
    chronoDurationMult: 1.0,
    startingDrones: 0,
    innatePierce: 0,
    statArmor: 5,
    statSpeed: 2,
    statTech: 2,
    iconUrl: '/assets/hulls/hull_juggernaut.jpg',
  },
  sniper: {
    id: 'sniper',
    nameVi: 'U Linh Phantom',
    nameEn: 'Phantom Sniper',
    roleVi: 'XUYÊN PHÁ / CHRONO',
    roleEn: 'PIERCE / CHRONO',
    passiveTitleVi: 'Xạ Thủ Ngưng Đọng',
    passiveTitleEn: 'Deadeye Chrono',
    passiveDescVi: 'Đạn xuyên +1 mục tiêu bẩm sinh; Chrono dài hơn +35% & +35% dmg (giáp hơi mỏng nhé).',
    passiveDescEn: 'Innate +1 pierce; +35% Chrono duration and damage (just try not to get sneezed on).',
    unlockCostShards: 240,
    accent: '#c084fc',
    accentHex: 0xc084fc,
    livery: 'VOIDTECH',
    starterWeapon: 'pulse_blaster',
    starterSlot: 'wing_l1',
    bonusHp: -10,
    speedMult: 1.04,
    dashCdMult: 0.9,
    chronoGainMult: 1.12,
    chronoDurationMult: 1.35,
    startingDrones: 0,
    innatePierce: 1,
    statArmor: 2,
    statSpeed: 4,
    statTech: 4,
    iconUrl: '/assets/hulls/hull_sniper.jpg',
  },
};

export type MetaUpgradeId =
  | 'hull_plating'
  | 'chrono_capacitor'
  | 'draft_reroll'
  | 'starting_credits'
  | 'salvage_magnet'
  | 'overclock_core';

export interface MetaUpgradeDef {
  id: MetaUpgradeId;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  accent: string;
  iconUrl: string;
}

export const META_UPGRADE_ORDER: readonly MetaUpgradeId[] = [
  'hull_plating',
  'chrono_capacitor',
  'draft_reroll',
  'starting_credits',
  'salvage_magnet',
  'overclock_core',
];

export const META_UPGRADE_CATALOG: Record<MetaUpgradeId, MetaUpgradeDef> = {
  hull_plating: {
    id: 'hull_plating',
    nameVi: 'Khung Giáp Gia Cố',
    nameEn: 'Reinforced Airframe',
    descVi: '+20 HP tối đa khởi đầu mỗi cấp vĩnh viễn.',
    descEn: '+20 starting max HP per permanent rank.',
    maxLevel: 5,
    baseCost: 35,
    costStep: 30,
    accent: '#34d399',
    iconUrl: '/assets/icons/core_max_health.png',
  },
  chrono_capacitor: {
    id: 'chrono_capacitor',
    nameVi: 'Tụ Điện Ngưng Đọng',
    nameEn: 'Chrono Capacitor',
    descVi: '+15% thời lượng Chrono Overdrive mỗi cấp.',
    descEn: '+15% Chrono Overdrive duration per rank.',
    maxLevel: 5,
    baseCost: 40,
    costStep: 35,
    accent: '#38e8ff',
    iconUrl: '/assets/icons/mut_chrono.jpg',
  },
  draft_reroll: {
    id: 'draft_reroll',
    nameVi: 'Mạch Đổi Thẻ Đột Biến',
    nameEn: 'Tactical Reroll Relay',
    descVi: '+1 lượt Đổi Thẻ [R] miễn phí trong bảng thăng cấp.',
    descEn: '+1 free Level-Up reroll [R] per run.',
    maxLevel: 3,
    baseCost: 50,
    costStep: 50,
    accent: '#fbbf24',
    iconUrl: '/assets/icons/core_luck.png',
  },
  starting_credits: {
    id: 'starting_credits',
    nameVi: 'Quỹ Hậu Cần Xuất Kích',
    nameEn: 'Expedition Stipend',
    descVi: 'Nhận thêm +60 Credits khi bắt đầu mỗi trận đấu.',
    descEn: 'Start every run with +60 bonus Credits per rank.',
    maxLevel: 4,
    baseCost: 30,
    costStep: 25,
    accent: '#fbbf24',
    iconUrl: '/assets/icons/core_greed.png',
  },
  salvage_magnet: {
    id: 'salvage_magnet',
    nameVi: 'Từ Trường Thu Thập',
    nameEn: 'Shard Extractor',
    descVi: '+20% Shards kiếm được & +30 tầm hút đồ mỗi cấp.',
    descEn: '+20% Scrap Shards earned and +30 pickup range per rank.',
    maxLevel: 4,
    baseCost: 35,
    costStep: 30,
    accent: '#a78bfa',
    iconUrl: '/assets/icons/core_magnet.png',
  },
  overclock_core: {
    id: 'overclock_core',
    nameVi: 'Lõi Ép Xung Hỏa Lực',
    nameEn: 'Hyper-Calibration Core',
    descVi: '+8% sát thương toàn bộ vũ khí & kỹ năng mỗi cấp.',
    descEn: '+8% weapon & skill damage permanently per rank.',
    maxLevel: 5,
    baseCost: 45,
    costStep: 40,
    accent: '#ff5e5e',
    iconUrl: '/assets/icons/pulse_blaster.png',
  },
};
