export type BossMutationId =
  | 'GRAVITY_WELL'
  | 'MIRAGE_PROTOCOL'
  | 'AEGIS_PYLONS'
  | 'ORBITAL_ARTILLERY'
  | 'SOLAR_OVERCLOCK'
  | 'CHRONO_STALKER';

export interface BossMutationDef {
  id: BossMutationId;
  shortVi: string;
  shortEn: string;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  titlePrefix: string;
  accent: string;
  hex: number;
  signatureAttack: string;
}

export const BOSS_MUTATION_IDS: readonly BossMutationId[] = [
  'GRAVITY_WELL',
  'MIRAGE_PROTOCOL',
  'AEGIS_PYLONS',
  'ORBITAL_ARTILLERY',
  'SOLAR_OVERCLOCK',
  'CHRONO_STALKER',
];

export const BOSS_MUTATIONS: Record<BossMutationId, BossMutationDef> = {
  GRAVITY_WELL: {
    id: 'GRAVITY_WELL',
    shortVi: 'HỐ ĐEN',
    shortEn: 'SINGULARITY',
    nameVi: 'Hố Đen Trọng Lực',
    nameEn: 'Gravity Singularity',
    descVi: 'Triệu hồi hố đen hút tàu & bẻ cong quỹ đạo chiến đấu.',
    descEn: 'Spawns gravity vortices pulling your ship toward lethal spirals.',
    titlePrefix: 'VOID',
    accent: '#a855f7',
    hex: 0xa855f7,
    signatureAttack: 'gravityVortex',
  },
  MIRAGE_PROTOCOL: {
    id: 'MIRAGE_PROTOCOL',
    shortVi: 'PHÂN THÂN',
    shortEn: 'MIRAGE',
    nameVi: 'Ảo Ảnh Phân Thân',
    nameEn: 'Mirage Protocol',
    descVi: 'Tách 2–3 phân thân bắn chéo góc; phá vỡ để hồi Năng Lượng & xả Nhiệt.',
    descEn: 'Projects holographic wing clones; shatter them to vent heat & restore Energy.',
    titlePrefix: 'PHANTOM',
    accent: '#22d3ee',
    hex: 0x22d3ee,
    signatureAttack: 'mirageSplit',
  },
  AEGIS_PYLONS: {
    id: 'AEGIS_PYLONS',
    shortVi: 'TRỤ KHIÊN',
    shortEn: 'PYLONS',
    nameVi: 'Trụ Khiên Aegis',
    nameEn: 'Aegis Shield Pylons',
    descVi: 'Bật trụ quay giảm -65% sát thương; đập vỡ hết để Choáng Boss (1.75x DMG).',
    descEn: 'Deploys orbiting pylons (-65% DMG taken); break all for 1.75x Stagger.',
    titlePrefix: 'AEGIS',
    accent: '#34d399',
    hex: 0x34d399,
    signatureAttack: 'aegisPylons',
  },
  ORBITAL_ARTILLERY: {
    id: 'ORBITAL_ARTILLERY',
    shortVi: 'PHÁO KÍCH',
    shortEn: 'ORBITAL',
    nameVi: 'Pháo Kích Quỹ Đạo',
    nameEn: 'Orbital Artillery',
    descVi: 'Đánh dấu vùng oanh tạc quỹ đạo buộc cơ động né liên tục.',
    descEn: 'Locks orbital blast zones beneath your flight path forcing agile dodges.',
    titlePrefix: 'SIEGE',
    accent: '#fb7185',
    hex: 0xfb7185,
    signatureAttack: 'orbitalBarrage',
  },
  SOLAR_OVERCLOCK: {
    id: 'SOLAR_OVERCLOCK',
    shortVi: 'ĐA LASER',
    shortEn: 'OVERCLOCK',
    nameVi: 'Quá Tải Đa Laser',
    nameEn: 'Solar Overclock',
    descVi: 'Xoay chùm tia Laser đa nhánh & bắn đạn dội tường vòng Bo.',
    descEn: 'Fires rotating 2–4 arm laser carousels and storm-bouncing plasma bolts.',
    titlePrefix: 'SOLAR',
    accent: '#fbbf24',
    hex: 0xfbbf24,
    signatureAttack: 'laserCarousel',
  },
  CHRONO_STALKER: {
    id: 'CHRONO_STALKER',
    shortVi: 'DỊCH CHUYỂN',
    shortEn: 'STALKER',
    nameVi: 'Bước Nhảy Không Gian',
    nameEn: 'Chrono Stalker',
    descVi: 'Tốc biến đánh úp sau lưng, ra đòn nhanh và áp sát liên hoàn.',
    descEn: 'Phase-blinks onto flanks for crescent slashes with accelerated attack tempo.',
    titlePrefix: 'CHRONO',
    accent: '#c084fc',
    hex: 0xc084fc,
    signatureAttack: 'chronoAmbush',
  },
};
