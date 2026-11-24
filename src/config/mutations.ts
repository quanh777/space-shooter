// 22 mid-run mutations grouped into 4 chaotic archetypes.
export type MutationArchetype = 'vortex' | 'solar' | 'swarm' | 'chrono';

export type MutationId =
  | 'split_shrapnel'
  | 'ricochet_prism'
  | 'dash_singularity'
  | 'comet_overheat'
  | 'graze_lightning'
  | 'drone_wingman'
  | 'drone_tether'
  | 'chronoshift_echo'
  | 'vampiric_execute'
  | 'orbital_sawblades'
  | 'chain_detonation'
  | 'barrel_alchemist'
  | 'rail_overcharge'
  | 'shield_nova'
  | 'thermal_supernova'
  | 'homing_barrage'
  | 'gravity_bullets'
  | 'chrono_assassin'
  | 'glass_cannon'
  | 'scrap_overclock'
  | 'parry_overload'
  | 'singularity_core';

export interface MutationDef {
  id: MutationId;
  archetype: MutationArchetype;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  accent: string;
  hex: number;
  maxStacks: 1 | 2;
  iconKey: string;
}

export interface ArchetypeSynergyDef {
  id: MutationArchetype;
  nameVi: string;
  nameEn: string;
  accent: string;
  hex: number;
  tier2Vi: string;
  tier2En: string;
  tier4Vi: string;
  tier4En: string;
}

export const ARCHETYPE_SYNERGY_DEFS: Record<MutationArchetype, ArchetypeSynergyDef> = {
  vortex: {
    id: 'vortex',
    nameVi: 'HỐ ĐEN TRỌNG LỰC',
    nameEn: 'GRAVITY VORTEX',
    accent: '#a855f7',
    hex: 0xa855f7,
    tier2Vi: 'Tăng +35% lực hút & bán kính xung lực',
    tier2En: '+35% singularity pull radius & knockback impulse',
    tier4Vi: 'Hố Đen liên hoàn hút cả đạn địch thành sóng nổ',
    tier4En: 'Singularities absorb enemy bullets & detonate twice',
  },
  solar: {
    id: 'solar',
    nameVi: 'NHẬT THỰC HỦY DIỆT',
    nameEn: 'SOLAR SUPERNOVA',
    accent: '#fb923c',
    hex: 0xfb923c,
    tier2Vi: 'Sát thương lửa & nổ AoE tăng +35%',
    tier2En: '+35% Burn, Blast & Shrapnel detonation damage',
    tier4Vi: 'Mỗi vụ nổ đều đốt cháy & kích nổ lan sang mục tiêu gần',
    tier4En: 'Every explosion ignites & triggers chain shrapnel',
  },
  swarm: {
    id: 'swarm',
    nameVi: 'BẦY ĐÀN TỰ HÀNH',
    nameEn: 'AUTONOMOUS SWARM',
    accent: '#34d399',
    hex: 0x34d399,
    tier2Vi: 'Drone bắn nhanh +35% & tên lửa bay xoáy gắt hơn',
    tier2En: '+35% Drone fire rate & tighter homing tracking',
    tier4Vi: 'Gọi thêm +1 Drone đặc chiến & Drone tự phóng tên lửa',
    tier4En: '+1 bonus Combat Drone & periodic swarm micro-missiles',
  },
  chrono: {
    id: 'chrono',
    nameVi: 'THỜI KHÔNG NGƯNG ĐỌNG',
    nameEn: 'CHRONO OVERDRIVE',
    accent: '#38e8ff',
    hex: 0x38e8ff,
    tier2Vi: 'Mỗi lần Graze sạc +6% Chrono & hồi +4 Energy',
    tier2En: 'Grazing bullets grants +6% Chrono & +4 Energy',
    tier4Vi: 'Đạn bắn ra trong Chrono được tăng gấp 1.6x tốc độ & xuyên +1',
    tier4En: 'Player shots gain 1.6x speed & +1 pierce inside Chrono',
  },
};

export const MUTATION_IDS: readonly MutationId[] = [
  'split_shrapnel',
  'ricochet_prism',
  'dash_singularity',
  'comet_overheat',
  'graze_lightning',
  'drone_wingman',
  'drone_tether',
  'chronoshift_echo',
  'vampiric_execute',
  'orbital_sawblades',
  'chain_detonation',
  'barrel_alchemist',
  'rail_overcharge',
  'shield_nova',
  'thermal_supernova',
  'homing_barrage',
  'gravity_bullets',
  'chrono_assassin',
  'glass_cannon',
  'scrap_overclock',
  'parry_overload',
  'singularity_core',
];

export const MUTATION_CATALOG: Record<MutationId, MutationDef> = {
  dash_singularity: {
    id: 'dash_singularity',
    archetype: 'vortex',
    nameVi: 'Lướt Hố Đen',
    nameEn: 'Dash Singularity',
    descVi: 'Mỗi lần Dash tạo Hố Đen kéo toàn bộ địch xung quanh lại rồi nổ tung.',
    descEn: 'Dashing leaves a Gravity Singularity that pulls nearby enemies before detonating.',
    accent: '#a855f7',
    hex: 0xa855f7,
    maxStacks: 2,
    iconKey: 'singularity',
  },
  gravity_bullets: {
    id: 'gravity_bullets',
    archetype: 'vortex',
    nameVi: 'Đạn Trọng Trường',
    nameEn: 'Gravity Rounds',
    descVi: 'Đạn trúng đích tạo lực kéo các tàu địch lân cận va vào nhau.',
    descEn: 'Projectiles tug nearby enemies inward on impact via magnetic impulse.',
    accent: '#c084fc',
    hex: 0xc084fc,
    maxStacks: 2,
    iconKey: 'vortex',
  },
  singularity_core: {
    id: 'singularity_core',
    archetype: 'vortex',
    nameVi: 'Nhân Khối Trọng Lực',
    nameEn: 'Singularity Core',
    descVi: 'Tăng +45% bán kính Hố Đen, +50% sát thương va chạm & nổ.',
    descEn: '+45% Singularity pull radius and +50% vortex/collision blast damage.',
    accent: '#a855f7',
    hex: 0xa855f7,
    maxStacks: 1,
    iconKey: 'singularity',
  },
  orbital_sawblades: {
    id: 'orbital_sawblades',
    archetype: 'vortex',
    nameVi: 'Đĩa Cưa Quỹ Đạo',
    nameEn: 'Orbital Sawblades',
    descVi: 'Triệu hồi 3 đĩa cưa plasma quay quanh tàu cắt nát địch & xóa đạn áp sát.',
    descEn: 'Summons 3 orbiting plasma sawblades that shred close enemies & slice bullets.',
    accent: '#d946ef',
    hex: 0xd946ef,
    maxStacks: 2,
    iconKey: 'blades',
  },
  shield_nova: {
    id: 'shield_nova',
    archetype: 'vortex',
    nameVi: 'Sóng Nổ Khiên Aegis',
    nameEn: 'Aegis Shield Nova',
    descVi: 'Khiên bị vỡ hoặc hết Dash phóng sóng xung kích hất văng địch & xóa đạn.',
    descEn: 'Shield break or Dash finish emits a shockwave pushing enemies & clearing bullets.',
    accent: '#818cf8',
    hex: 0x818cf8,
    maxStacks: 1,
    iconKey: 'nova',
  },
  parry_overload: {
    id: 'parry_overload',
    archetype: 'vortex',
    nameVi: 'Phản Đòn Phá Giới',
    nameEn: 'Parry Shockburst',
    descVi: 'Mở rộng khung Dash Parry & phản đạn tạo vụ nổ trọng lực 3.5x sát thương.',
    descEn: 'Widens Dash Parry timing and empowers reflected bolts with gravity bursts.',
    accent: '#c084fc',
    hex: 0xc084fc,
    maxStacks: 1,
    iconKey: 'parry',
  },

  split_shrapnel: {
    id: 'split_shrapnel',
    archetype: 'solar',
    nameVi: 'Mảnh Đạn Phân Tách',
    nameEn: 'Split Shrapnel',
    descVi: 'Hạ địch bắn tung ra 4 mảnh đạn nóng chảy xuyên thẳng sang mục tiêu khác.',
    descEn: 'Killing enemies shatters them into 4 glowing shrapnel bolts in all directions.',
    accent: '#fb923c',
    hex: 0xfb923c,
    maxStacks: 2,
    iconKey: 'shrapnel',
  },
  comet_overheat: {
    id: 'comet_overheat',
    archetype: 'solar',
    nameVi: 'Sao Chổi Quá Nhiệt',
    nameEn: 'Comet Overheat',
    descVi: 'Nhiệt trên 60% hoặc đang Dash bọc giáp lửa, húc xuyên địch nổ tung cực mạnh.',
    descEn: 'Above 60% heat or dashing wraps ship in plasma, ramming enemies cleanly.',
    accent: '#f97316',
    hex: 0xf97316,
    maxStacks: 1,
    iconKey: 'comet',
  },
  chain_detonation: {
    id: 'chain_detonation',
    archetype: 'solar',
    nameVi: 'Kích Nổ Dây Chuyền',
    nameEn: 'Chain Detonation',
    descVi: 'Kẻ địch bị hạ phát nổ AoE gây sát thương 45% máu tối đa của chúng xung quanh.',
    descEn: 'Slain enemies detonate for 45% of their max HP in thermal AoE damage.',
    accent: '#ef4444',
    hex: 0xef4444,
    maxStacks: 2,
    iconKey: 'explosion',
  },
  barrel_alchemist: {
    id: 'barrel_alchemist',
    archetype: 'solar',
    nameVi: 'Nhà Giả Kim Plasma',
    nameEn: 'Barrel Alchemist',
    descVi: 'Mỗi phòng thêm +3 thùng Plasma nổ; nổ thùng thả ngay 1 Mô-đun hoặc Buff.',
    descEn: 'Spawns +3 extra Plasma Barrels per room; barrel blasts drop bonus loot.',
    accent: '#f59e0b',
    hex: 0xf59e0b,
    maxStacks: 1,
    iconKey: 'barrel',
  },
  thermal_supernova: {
    id: 'thermal_supernova',
    archetype: 'solar',
    nameVi: 'Siêu Tân Tinh Xả Nhiệt',
    nameEn: 'Thermal Supernova',
    descVi: 'Xả Nhiệt [R] phóng sóng hủy diệt gấp 2.4x phạm vi & hồi ngay +25 HP.',
    descEn: 'Thermal Purge [R] blasts 2.4x wider, deals massive fire damage & heals +25 HP.',
    accent: '#ff5a1f',
    hex: 0xff5a1f,
    maxStacks: 1,
    iconKey: 'thermal',
  },
  vampiric_execute: {
    id: 'vampiric_execute',
    archetype: 'solar',
    nameVi: 'Kết Liễu Hấp Huyết',
    nameEn: 'Vampiric Execute',
    descVi: 'Dash Execute kết liễu địch dưới 40% HP & hồi trực tiếp +8 HP mỗi mạng.',
    descEn: 'Dash Execute slays foes below 40% HP & restores +8 HP per execution.',
    accent: '#fb7185',
    hex: 0xfb7185,
    maxStacks: 1,
    iconKey: 'vampiric',
  },

  drone_wingman: {
    id: 'drone_wingman',
    archetype: 'swarm',
    nameVi: 'Phi Đội Drone Tự Hành',
    nameEn: 'Combat Drone Wingman',
    descVi: 'Triệu hồi thêm +2 Drone chiến đấu tự động nhắm bắn địch gần nhất.',
    descEn: 'Deploys +2 autonomous Combat Drones orbiting ship & firing plasma bolts.',
    accent: '#34d399',
    hex: 0x34d399,
    maxStacks: 2,
    iconKey: 'drone',
  },
  drone_tether: {
    id: 'drone_tether',
    archetype: 'swarm',
    nameVi: 'Tia Nối Laser Drone',
    nameEn: 'Drone Laser Tether',
    descVi: 'Drone căng tia năng lượng nối với thân tàu cắt cháy mọi kẻ địch chạm phải.',
    descEn: 'Links every Combat Drone to your ship with continuous searing energy beams.',
    accent: '#10b981',
    hex: 0x10b981,
    maxStacks: 1,
    iconKey: 'tether',
  },
  homing_barrage: {
    id: 'homing_barrage',
    archetype: 'swarm',
    nameVi: 'Loạt Tên Lửa Đuổi',
    nameEn: 'Micro-Missile Barrage',
    descVi: 'Mỗi phát bắn thứ 4 phóng kèm 2 tên lửa nhỏ tự tìm mục tiêu Ion.',
    descEn: 'Every 4th shot launches 2 homing Ion micro-missiles seeking priority targets.',
    accent: '#2dd4bf',
    hex: 0x2dd4bf,
    maxStacks: 2,
    iconKey: 'missile',
  },
  scrap_overclock: {
    id: 'scrap_overclock',
    archetype: 'swarm',
    nameVi: 'Ép Xung Phế Liệu',
    nameEn: 'Scrap Overclock',
    descVi: 'Nhặt Vàng hoặc Mô-đun cho +22% tốc bắn & giảm -15% nhiệt trong 4 giây.',
    descEn: 'Collecting gold or drops grants +22% fire rate & cooling surge for 4s.',
    accent: '#fbbf24',
    hex: 0xfbbf24,
    maxStacks: 1,
    iconKey: 'overclock',
  },

  ricochet_prism: {
    id: 'ricochet_prism',
    archetype: 'chrono',
    nameVi: 'Lăng Kính Nảy Đạn',
    nameEn: 'Ricochet Prism',
    descVi: 'Toàn bộ đạn nảy thêm +2 lần giữa các mục tiêu hoặc đá quặng.',
    descEn: 'All player projectiles ricochet +2 times toward nearby enemies & asteroids.',
    accent: '#38e8ff',
    hex: 0x38e8ff,
    maxStacks: 2,
    iconKey: 'ricochet',
  },
  graze_lightning: {
    id: 'graze_lightning',
    archetype: 'chrono',
    nameVi: 'Sét Lách Đạn',
    nameEn: 'Graze Lightning',
    descVi: 'Mỗi lần bay sát đạn (Graze) phóng tia sét 45 dmg giật thẳng kẻ bắn & sạc Chrono.',
    descEn: 'Grazing enemy bullets calls a 45 dmg lightning arc onto nearby attackers.',
    accent: '#22d3ee',
    hex: 0x22d3ee,
    maxStacks: 2,
    iconKey: 'lightning',
  },
  chronoshift_echo: {
    id: 'chronoshift_echo',
    archetype: 'chrono',
    nameVi: 'Dư Ảnh Thời Không',
    nameEn: 'Chronoshift Echo',
    descVi: 'Bật Chrono Overdrive [F] dội thêm loạt đạn 360° & làm mới hồi chiêu Dash/Skill.',
    descEn: 'Triggering Chrono Overdrive [F] unleashes a 360° barrage & resets Dash/Skill CD.',
    accent: '#60a5fa',
    hex: 0x60a5fa,
    maxStacks: 1,
    iconKey: 'chrono',
  },
  rail_overcharge: {
    id: 'rail_overcharge',
    archetype: 'chrono',
    nameVi: 'Xung Phá Xuyên Giáp',
    nameEn: 'Rail Overcharge',
    descVi: '+1 xuyên thấu cho mọi vũ khí & bắn vỡ khiên của tàu Shielder nhanh gấp 2.5x.',
    descEn: '+1 pierce to all shots & deals 2.5x damage against Shield-Bearer frontal barriers.',
    accent: '#818cf8',
    hex: 0x818cf8,
    maxStacks: 2,
    iconKey: 'rail',
  },
  chrono_assassin: {
    id: 'chrono_assassin',
    archetype: 'chrono',
    nameVi: 'Sát Thủ Ngưng Đọng',
    nameEn: 'Chrono Assassin',
    descVi: 'Trong Chrono Overdrive [F], tốc chạy/bắn của bạn đạt 100% & +40% sát thương.',
    descEn: 'Move & shoot at full speed during Chrono Overdrive with +40% critical damage.',
    accent: '#0ea5e9',
    hex: 0x0ea5e9,
    maxStacks: 1,
    iconKey: 'assassin',
  },
  glass_cannon: {
    id: 'glass_cannon',
    archetype: 'chrono',
    nameVi: 'Pháo Thủy Tinh',
    nameEn: 'Glass Cannon',
    descVi: '+45% toàn bộ sát thương & +20% tốc bắn, bù lại -25% HP tối đa (né hụt là đi bán muối nhé).',
    descEn: '+45% all damage & +20% fire rate for -25% max HP (hope your dodge game is sharp).',
    accent: '#f43f5e',
    hex: 0xf43f5e,
    maxStacks: 1,
    iconKey: 'glass',
  },
};

export function countMutationStacks(list: readonly MutationId[], id: MutationId): number {
  let c = 0;
  for (const m of list) {
    if (m === id) c++;
  }
  return c;
}

export function computeMutationArchetypeCounts(
  list: readonly MutationId[]
): Record<MutationArchetype, number> {
  const counts: Record<MutationArchetype, number> = {
    vortex: 0,
    solar: 0,
    swarm: 0,
    chrono: 0,
  };
  for (const id of list) {
    const def = MUTATION_CATALOG[id];
    if (def) counts[def.archetype]++;
  }
  return counts;
}
