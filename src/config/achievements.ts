// Milestone definitions checked quietly after runs and kills.
export type AchievementId =
  | 'kills'
  | 'waves'
  | 'bosses'
  | 'money'
  | 'dashes'
  | 'purchases'
  | 'games'
  | 'highScore';

export interface AchievementDefinition {
  id: AchievementId;
  icon: string;
  vi: { name: string; desc: string };
  en: { name: string; desc: string };
  levels: number[];
  mode: 'cumulative' | 'best';
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementDefinition> = {
  kills: {
    id: 'kills',
    icon: 'SHP',
    vi: { name: 'Xạ Thủ Không Gian', desc: 'Tiễn {target} tàu địch thành phế liệu' },
    en: { name: 'Star Sharpshooter', desc: 'Turn {target} hostiles into scrap' },
    levels: [10, 50, 100, 250, 500, 1000],
    mode: 'cumulative',
  },
  waves: {
    id: 'waves',
    icon: 'WAV',
    vi: { name: 'Thợ Săn Wave', desc: 'Sống sót lết tới wave {target}' },
    en: { name: 'Wave Vanguard', desc: 'Survive all the way to wave {target}' },
    levels: [5, 10, 15, 20, 30, 50],
    mode: 'best',
  },
  bosses: {
    id: 'bosses',
    icon: 'SLY',
    vi: { name: 'Kẻ Diệt Trùm', desc: 'Cho {target} con Boss ăn khói' },
    en: { name: 'Dreadnought Slayer', desc: 'Send {target} bosses packing' },
    levels: [1, 5, 10, 25, 50],
    mode: 'cumulative',
  },
  money: {
    id: 'money',
    icon: 'CRD',
    vi: { name: 'Tài Phiệt Thiên Hà', desc: 'Hút tổng cộng {target} vàng về ví' },
    en: { name: 'Galactic Tycoon', desc: 'Hoard {target} total credits' },
    levels: [500, 2000, 5000, 10000, 25000],
    mode: 'cumulative',
  },
  dashes: {
    id: 'dashes',
    icon: 'PHS',
    vi: { name: 'Bậc Thầy Lướt Pha', desc: 'Bấm lướt né đạn {target} lần (đừng đâm đầu vào gạch)' },
    en: { name: 'Phase Dancer', desc: 'Execute {target} phase dashes without hugging asteroids' },
    levels: [50, 200, 500, 1000, 2500],
    mode: 'cumulative',
  },
  purchases: {
    id: 'purchases',
    icon: 'ARM',
    vi: { name: 'Kỹ Sư Vũ Trang', desc: 'Chốt đơn {target} món nâng cấp' },
    en: { name: 'Arms Architect', desc: 'Buy {target} upgrades (retail therapy counts)' },
    levels: [10, 50, 100, 250, 500],
    mode: 'cumulative',
  },
  games: {
    id: 'games',
    icon: 'SRT',
    vi: { name: 'Chiến Binh Bền Bỉ', desc: 'Xuất kích {target} chuyến (dù nổ sớm cũng tính)' },
    en: { name: 'Veteran Pilot', desc: 'Launch {target} sorties (short ones still count)' },
    levels: [5, 25, 50, 100, 250],
    mode: 'cumulative',
  },
  highScore: {
    id: 'highScore',
    icon: 'ACE',
    vi: { name: 'Huyền Thoại Tinh Vân', desc: 'Ghi hẳn {target} điểm trong một ván duy nhất' },
    en: { name: 'Nebula Legend', desc: 'Rack up {target} points in one chaotic run' },
    levels: [1000, 5000, 10000, 25000, 50000],
    mode: 'best',
  },
};

export const ACHIEVEMENT_LIST = Object.values(ACHIEVEMENTS);
