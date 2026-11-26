// All player-facing strings live here so we never have to hunt down hardcoded Vietnamese or English copy at 2 AM.
export type LangCode = 'vi' | 'en';

export interface LanguageStrings {
  subtitle: string;
  playGame: string;
  leaderboard: string;
  instructions: string;
  info: string;
  achievementsTitle: string;
  back: string;

  gameOver: string;
  score: string;
  wave: string;
  maxCombo: string;
  bossesSlain: string;
  enterName: string;
  submitScore: string;
  submitted: string;
  encourageSubmit: string;
  rankPreview: string;
  playAgain: string;
  mainMenu: string;
  top10: string;

  manualKicker: string;
  controls: string;
  deckLiveBadge: string;
  deckLiveHint: string;
  mouseUnitLabel: string;
  mouseAimSensor: string;
  inspectorStandby: string;
  inspectorActive: string;
  roleFlight: string;
  roleOrdnance: string;
  roleTactical: string;
  roleSystems: string;
  leaderboardTitle: string;
  movement: string;
  moveDesc: string;
  dashDesc: string;
  combat: string;
  shootDesc: string;
  aimToggleDesc: string;
  bombDesc: string;
  chronoShortDesc: string;
  ventShortDesc: string;
  shop: string;
  selectItems: string;
  buyItems: string;
  refreshShop: string;
  skipShop: string;
  hangarKeyDesc: string;
  pauseKeyDesc: string;
  tips: string;
  tip1Title: string;
  tip2Title: string;
  tip3Title: string;
  tip4Title: string;
  tip1: string;
  tip2: string;
  tip3: string;
  tip4: string;

  infoKicker: string;
  infoModalTitle: string;
  infoBuildBadge: string;
  aboutGame: string;
  gameDescription: string;
  metricSimLabel: string;
  metricSlotsLabel: string;
  metricBossLabel: string;
  metricAudioLabel: string;
  credits: string;
  developer: string;
  version: string;
  engineLabel: string;
  cloudLabel: string;
  techHighlights: string;
  tech1Title: string;
  tech2Title: string;
  tech3Title: string;
  tech4Title: string;
  tech1: string;
  tech2: string;
  tech3: string;
  tech4: string;
  feedback: string;
  feedbackDesc: string;
  sendFeedback: string;

  bossWave: string;
  getReady: string;
  prepareForBattle: string;
  bossWarningStamp: string;
  bossClass0: string;
  bossClass1: string;
  bossClass2: string;
  bossClass3: string;
  bossClass4: string;
  bossClass5: string;
  bossSub0: string;
  bossSub1: string;
  bossSub2: string;
  bossSub3: string;
  bossSub4: string;
  bossSub5: string;
  bossForm1: string;
  bossForm2: string;
  bossForm3: string;
  bossArmorPlates: string;
  bossCoreExposed: string;
  bossThreatExtreme: string;
  comboTagD: string;
  comboTagC: string;
  comboTagB: string;
  comboTagA: string;
  comboTagS: string;
  comboTagSS: string;
  comboTagSSS: string;
  waveClearedTag: string;
  bossSlainTag: string;
  bossSlainSub: string;
  fastClearBonus: string;
  bossBounty: string;
  bossApproaching: string;
  bossShieldedTag: string;
  bossStaggeredTag: string;
  bossMutationPrefix: string;
  sectorDeploy: string;
  skillSalvo: string;
  skillRailbeam: string;
  skillEmp: string;
  skillSwitchHint: string;
  tutorialStart: string;
  tutorialPrompt: string;
  tutorialHint: string;
  holdToStart: string;
  nextWaveIn: string;
  fastClear: string;

  paused: string;
  resume: string;
  restart: string;
  soundOn: string;
  soundOff: string;
  aimAuto: string;
  aimMouse: string;
  autoFireOn: string;
  autoFireOff: string;
  graphicsLabel: string;
  qualityHigh: string;
  qualityMedium: string;
  qualityLow: string;
  pauseHint: string;

  shopTitle: string;
  waveCompleted: string;
  cost: string;
  after: string;
  buySelected: string;
  refresh: string;
  skip: string;
  maxed: string;
  bought: string;
  insufficientFunds: string;

  garageTitle: string;
  garageSubtitle: string;
  tabPrimary: string;
  tabSkill: string;
  tabCore: string;
  slotEmpty: string;
  slotEmptyHint: string;
  slotCoreTitle: string;
  slotCoreDesc: string;
  btnMount: string;
  btnSwap: string;
  btnUnmount: string;
  btnDeploy: string;
  warnSwapLose: string;
  salvageRefundLabel: string;
  restOpenHangar: string;
  corePersistsBadge: string;
  weaponBoundBadge: string;
  minPrimaryWarn: string;

  restOpenInventory: string;
  inventoryTitle: string;
  bossShopTitle: string;
  tabRoulette: string;
  tabInventory: string;
  dragHint: string;
  btnSpinFree: string;
  btnSpinPaid: string;
  btnClaim: string;
  claimed: string;
  btnSalvage: string;
  btnUnequip: string;
  btnFuse: string;
  noSkillEquipped: string;
  rarityCommon: string;
  rarityRare: string;
  rarityEpic: string;
  roulettePityLabel: string;
  roulettePityReady: string;
  rouletteLock: string;
  rouletteLocked: string;
  rouletteLockFeeHint: string;
  rouletteReadySub: string;
  rouletteClaimShort: string;
  augmentTitle: string;
  hazardTitle: string;
  heatOverload: string;
  stormOutsideWarn: string;
  stormBossLock: string;
  skillCoreTitle: string;

  raidSectorPrefix: string;
  raidVaultHint: string;
  raidConvoyTimer: string;
  quickDraftKicker: string;
  quickDraftTitle: string;
  quickDraftHotkey: string;
  thermalPurgeReady: string;
  ventDesc: string;

  shieldReady: string;
  shieldActive: string;
  shieldCd: string;

  rank: string;
  name: string;
  loadingScores: string;
  noScores: string;
  submitSuccess: string;
  submitError: string;
  enterNameAlert: string;
  nameTooLong: string;
  firebaseOffline: string;
  lbKicker: string;
  lbLiveBadge: string;
  lbSyncBadge: string;
  lbCachedBadge: string;
  lbOfflineBadge: string;
  lbRefreshBtn: string;
  lbYouTag: string;
  lbEmptySlot: string;
  lbRunLoadoutTitle: string;
  lbSubtitleMeta: string;
  lbPodiumTop1: string;
  lbPodiumTop2: string;
  lbPodiumTop3: string;
  lbRivalChase: string;
  lbRivalKing: string;
  lbChaseBtn: string;
  lbTargetBadge: string;
  lbUpdateBtn: string;
  lbSavedPilotHint: string;
  goHeroScoreLabel: string;
  goNewCrown: string;
  goNewPb: string;
  goFirstRecord: string;
  goKeepBest: string;
  goUpdatedKeepBest: string;
  goNewRecordSaved: string;

  achievementLvl: string;
  levelsLabel: string;
  completed: string;
  lvPrefix: string;

  metaForgeTitle: string;
  metaForgeBtn: string;
  shardsLabel: string;
  roomsCleared: string;
  shardsEarned: string;
  rerollBtn: string;
  roomSelectKicker: string;
  roomSelectTitle: string;
  roomSelectHint: string;
  chronoReadyBtn: string;

  bootCampBtn: string;
  startTutorialBtn: string;
  skipTutorialBtn: string;
  gpuQuickLabel: string;
  gpuBoostBtn: string;
  gpuModalKicker: string;
  gpuModalTitleIgpu: string;
  gpuModalTitleDiscrete: string;
  gpuModalCurrentLabel: string;
  gpuModalStep1: string;
  gpuModalStep2: string;
  gpuModalStep3: string;
  gpuModalNote: string;
  gpuModalAckBtn: string;
  pauseGpuPrefix: string;
  pauseGpuDiscrete: string;
  pauseGpuIntegrated: string;
  pauseGpuSoftware: string;

  onbBadgePrefix: string;
  onbStep1Title: string;
  onbStep1Desc: string;
  onbStep1DescMobile: string;
  onbStep1MoveTask: string;
  onbStep1DashTask: string;
  onbStep2Title: string;
  onbStep2Desc: string;
  onbStep2DescMobile: string;
  onbStep2KillTask: string;
  onbStep2VentTask: string;
  onbStep3Title: string;
  onbStep3Desc: string;
  onbStep3LootTask: string;
  onbCompleteMsg: string;

  coachOverheatTip: string;
  coachChronoTip: string;
  coachInventoryTip: string;
  popupReasonPrefix: string;
}

export const LANGUAGES: Record<LangCode, LanguageStrings> = {
  vi: {
    subtitle: 'NEBULA VANGUARD · 2.5D/3D EDITION',
    playGame: 'XUẤT KÍCH',
    leaderboard: 'BẢNG XẾP HẠNG',
    instructions: 'HƯỚNG DẪN',
    info: 'THÔNG TIN',
    achievementsTitle: 'THÀNH TỰU',
    back: 'QUAY LẠI',

    gameOver: 'CHIẾN HẠM THẤT THỦ',
    score: 'Điểm',
    wave: 'Wave',
    maxCombo: 'Combo Tối Đa',
    bossesSlain: 'Boss Đã Hạ',
    enterName: 'Nhập biệt danh phi công...',
    submitScore: 'GỬI ĐIỂM',
    submitted: 'ĐÃ GỬI',
    encourageSubmit: 'Ghi tên lên Bảng Vàng trước khi kẻ khác vượt mặt!',
    rankPreview: 'Thứ hạng dự kiến: #{rank}',
    playAgain: 'CHƠI LẠI',
    mainMenu: 'MENU CHÍNH',
    top10: 'TOP 10 PHI CÔNG',

    manualKicker: 'TÀI LIỆU VẬN HÀNH // HỆ THỐNG ĐIỀU KHIỂN',
    controls: 'HƯỚNG DẪN ĐIỀU KHIỂN & TÁC CHIẾN',
    deckLiveBadge: 'MÔ PHỎNG TƯƠNG TÁC',
    deckLiveHint: 'Nhấn phím thực tế trên bàn phím hoặc chọn nút trên sơ đồ để kiểm tra chức năng',
    mouseUnitLabel: 'CHUỘT CHIẾN THUẬT',
    mouseAimSensor: 'CẢM BIẾN TÂM NGẮM 360°',
    inspectorStandby: 'SẴN SÀNG TRA CỨU',
    inspectorActive: 'TÍN HIỆU ĐANG NHẤN',
    roleFlight: 'CƠ ĐỘNG',
    roleOrdnance: 'HỎA LỰC',
    roleTactical: 'KỸ NĂNG',
    roleSystems: 'HỆ THỐNG',
    leaderboardTitle: 'BẢNG XẾP HẠNG',
    movement: 'Điều Khiển Bay & Né Đạn',
    moveDesc: 'Điều hướng phi thuyền đa hướng 360° theo 8 trục (WASD / Phím mũi tên)',
    dashDesc: 'Lướt Pha Tốc (bất tử ngắn và kích hoạt Phản Đòn khi đúng nhịp)',
    combat: 'Hệ Thống Vũ Khí & Kỹ Năng',
    shootDesc: 'Khai hỏa vũ khí chính (hỗ trợ bật Auto-Fire trên HUD)',
    aimToggleDesc: 'Chuyển đổi giữa Tự Động Khóa Mục Tiêu và Ngắm Chuột Thủ Công',
    bombDesc: 'Kích hoạt Kỹ năng Sống Lưng [E]; hỗ trợ [F] Chrono và [R] Xả Nhiệt',
    chronoShortDesc: 'Kích hoạt Trường Ngưng Đọng làm chậm đạn địch (khi đủ 100%)',
    ventShortDesc: 'Xả nhiệt khẩn cấp để đẩy lùi địch khi mức nhiệt từ 60% trở lên',
    shop: 'Xưởng Lắp Ráp & Giao Dịch',
    selectItems: 'Chọn nhanh nâng cấp hoặc Cổng Dịch Chuyển (1 - 4)',
    buyItems: 'Xác nhận thanh toán các trang bị đã chọn',
    refreshShop: 'Làm mới danh sách cửa hàng (tiêu tốn Credits)',
    skipShop: 'Đóng cửa hàng và tiếp tục lộ trình chiến đấu',
    hangarKeyDesc: 'Mở Xưởng Lắp Ráp Thân Tàu trong giai đoạn nghỉ giữa phòng',
    pauseKeyDesc: 'Tạm dừng giao tranh hoặc đóng cửa sổ giao dịch hiện tại',
    tips: 'NGUYÊN TẮC TÁC CHIẾN CỐT LÕI',
    tip1Title: 'Phản Đòn & Tích Lũy Chrono',
    tip2Title: 'Quản Lý Nhiệt Lượng Vũ Khí',
    tip3Title: 'Khắc Chế Đội Hình Đặc Chủng',
    tip4Title: 'Kỷ Luật Vành Đai & Lộ Trình',
    tip1: 'Kích hoạt Lướt Pha [SHIFT] đúng thời điểm đạn chạm mũi tàu để phản xạ đạn địch với sát thương khuếch đại và hoàn hồi lượt lướt; bay áp sát đường đạn (Graze) giúp nạp nhanh thanh Chrono [F].',
    tip2: 'Khai hỏa liên tục làm tăng nhiệt độ lõi vũ khí. Khi mức nhiệt đạt từ 60% trở lên, hãy kích hoạt Xả Nhiệt [R] để giải phóng xung nhiệt đẩy lùi địch trước khi vũ khí bị khóa quá tải.',
    tip3: 'Tàu Hộ Thuẫn (Shielder) giảm mạnh sát thương nhận từ góc chính diện — hãy cơ động vòng ra phía sau để khai hỏa. Luôn ưu tiên tiêu diệt Tàu Tiếp Viện (Medic) đang duy trì tia hồi phục.',
    tip4: 'Duy trì vị trí bên trong Vành Đai An Toàn để tránh tổn thất giáp do bức xạ ngoài biên, đồng thời lựa chọn Cổng Dịch Chuyển phù hợp với tình trạng thân tàu và cấu hình hỏa lực.',

    infoKicker: 'HỒ SƠ HỆ THỐNG // THÔNG SỐ KỸ THUẬT',
    infoModalTitle: 'THÔNG TIN DỰ ÁN & KIẾN TRÚC HỆ THỐNG',
    infoBuildBadge: 'WEBGL2 · 60HZ DETERMINISTIC',
    aboutGame: 'Tổng Quan Dự Án',
    gameDescription:
      'Space Shooter: Nebula Vanguard là trò chơi bắn tàu không gian chiến thuật Roguelite 2.5D/3D trên trình duyệt, phát triển bằng Three.js (WebGL2) và TypeScript. Người chơi khởi đầu với cấu hình tiêu chuẩn, lắp ráp mô-đun vũ khí trực tiếp lên 6 ổ cứng thân tàu, vượt qua lộ trình 5 phòng phân nhánh và đối đầu 6 Đại Boss đa giai đoạn.',
    metricSimLabel: 'Mô phỏng cố định',
    metricSlotsLabel: 'Ổ cứng mô-đun',
    metricBossLabel: 'Đại Boss biến hình',
    metricAudioLabel: 'Âm thanh tổng hợp',
    credits: 'Thông Số Phiên Bản & Tác Giả',
    developer: 'Phát triển & Thiết kế hệ thống',
    version: 'Phiên bản phát hành',
    engineLabel: 'Nền tảng kỹ thuật',
    cloudLabel: 'Dịch vụ trực tuyến',
    techHighlights: 'Kiến Trúc Kỹ Thuật Cốt Lõi',
    tech1Title: 'Kết Xuất 3D & Hậu Kỳ GPU',
    tech2Title: 'Lõi Mô Phỏng 60Hz Độc Lập',
    tech3Title: 'Tổng Hợp Âm Thanh Số WebAudio',
    tech4Title: 'Phản Hồi Tác Chiến & Giao Diện',
    tech1: 'Đường ống dựng hình Three.js WebGL2, mô hình PBR tối ưu từ Blender, shader GLSL ES 3.00 tùy biến và hậu kỳ UnrealBloom cùng chuẩn màu AgX.',
    tech2: 'Lõi mô phỏng bước thời gian cố định 60Hz tách biệt hoàn toàn khỏi DOM và bộ dựng hình, bảo đảm tính tất định vật lý và hỗ trợ kiểm thử tự động 54 kịch bản.',
    tech3: 'Hệ thống 56 hiệu ứng âm thanh tổng hợp thời gian thực đóng gói dạng ngân hàng dữ liệu JSON nội bộ, loại bỏ hoàn toàn hiện tượng tải rời tệp âm thanh.',
    tech4: 'Hệ thống phản hồi đa tầng gồm độ rung Trauma^2 đa tần số, thanh máu trễ 260ms, tâm ngắm hitmarker 3 cấp và quỹ đạo hiển thị sát thương.',
    feedback: 'Phản Hồi Kỹ Thuật & Báo Cáo Lỗi',
    feedbackDesc: 'Nếu phát hiện lỗi vận hành, sự cố hiển thị WebGL2 hoặc có đề xuất cân bằng thông số chiến đấu, vui lòng gửi báo cáo qua biểu mẫu chính thức.',
    sendFeedback: 'GỬI BÁO CÁO & GÓP Ý',

    bossWave: 'CẢNH BÁO BOSS',
    getReady: 'SẴN SÀNG CHIẾN ĐẤU',
    prepareForBattle: 'PHÁT HIỆN THỰC THỂ NGUY HIỂM CẤP CAO',
    bossWarningStamp: 'CẢNH BÁO TỐI CAO // THỰC THỂ CẤP OMEGA',
    bossClass0: 'CHIẾN HẠM HỦY DIỆT · HẠNG TITAN',
    bossClass1: 'NỮ HOÀNG HƯ KHÔNG · HẠNG ABYSS',
    bossClass2: 'THIÊN SỨ THÁI DƯƠNG · HẠNG SERAPH',
    bossClass3: 'MÃNG XÀ CƠ KHÍ · HẠNG LEVIATHAN',
    bossClass4: 'SONG LÕI LIÊN KẾT · HẠNG GEMINI',
    bossClass5: 'PHÁO ĐÀI THIẾT GIÁP · HẠNG BASTION',
    bossSub0: 'HỎA LỰC TỔNG LỰC · PHÁO HẠM XUNG KÍCH',
    bossSub1: 'XÉ RÁCH HƯ KHÔNG · TRIỆU HỒI BẦY ĐÀN',
    bossSub2: 'QUANG TRỤ THÁI DƯƠNG · TIA HỦY DIỆT',
    bossSub3: 'XƯƠNG SỐNG 6 ĐỐT · ĐUÔI QUẤT ĐỘC TỐ',
    bossSub4: 'SONG HẠM CỘNG HƯỞNG · TIA PLASMA LIÊN KẾT',
    bossSub5: 'GIÁP VỠ 4 MẢNG · LÕI QUÁ TẢI TỐC ĐỘ',
    bossForm1: 'DẠNG I · PHONG ẤN',
    bossForm2: 'DẠNG II · GIẢI PHÓNG',
    bossForm3: 'DẠNG III · TỐI THƯỢNG',
    bossArmorPlates: 'GIÁP',
    bossCoreExposed: 'LÕI LỘ THIÊN +20%',
    bossThreatExtreme: 'NGUY HIỂM: CỰC ĐẠI',
    comboTagD: 'KHAI HỎA',
    comboTagC: 'BỨT TỐC',
    comboTagB: 'ÁP ĐẢO',
    comboTagA: 'CUỒNG BẠO',
    comboTagS: 'TỐI THƯỢNG',
    comboTagSS: 'HỦY DIỆT',
    comboTagSSS: 'THẦN THÁNH',
    waveClearedTag: 'HOÀN TẤT KHU VỰC',
    bossSlainTag: 'ĐÃ TIÊU DIỆT SIÊU BOSS',
    bossSlainSub: 'XƯỞNG NÂNG CẤP ĐANG MỞ CỬA...',
    fastClearBonus: 'THƯỞNG DỌN NHANH',
    bossBounty: 'TIỀN THƯỞNG HẠ BOSS',
    bossApproaching: 'TRÙM CUỐI SẮP XUẤT HIỆN',
    bossShieldedTag: 'KHIÊN AEGIS -65%',
    bossStaggeredTag: 'VỠ KHIÊN · 1.75x DMG',
    bossMutationPrefix: 'BIẾN THỂ',
    sectorDeploy: 'TRIỂN KHAI KHU VỰC',
    skillSalvo: 'LOẠT TÊN LỬA NOVA',
    skillRailbeam: 'ĐẠI PHÁO RAIL-LANCE',
    skillEmp: 'XUNG TỪ SÉT EMP',
    skillSwitchHint: 'F ĐỔI CHIÊU',
    tutorialStart: 'KHỞI ĐỘNG HỆ THỐNG',
    tutorialPrompt: 'BAY VÀO VÒNG XANH ĐỂ BẮT ĐẦU',
    tutorialHint: 'WASD bay · SHIFT lướt/parry · SPACE bắn · E skill · F chrono · R xả nhiệt',
    holdToStart: 'Giữ nguyên vị trí',
    nextWaveIn: 'Đợt mới tới trong',
    fastClear: 'DỌN GỌN LẸ',

    paused: 'TẠM DỪNG',
    resume: 'CHIẾN TIẾP',
    restart: 'LÀM VÁN MỚI',
    soundOn: 'Âm thanh: BẬT',
    soundOff: 'Âm thanh: TẮT',
    aimAuto: 'Ngắm: TỰ ĐỘNG',
    aimMouse: 'Ngắm: CHUỘT',
    autoFireOn: 'Tự bắn: BẬT',
    autoFireOff: 'Tự bắn: TẮT',
    graphicsLabel: 'Đồ họa',
    qualityHigh: 'Cao (Bloom)',
    qualityMedium: 'Trung bình',
    qualityLow: 'Nhẹ',
    pauseHint: 'ESC Chiến tiếp · R Làm lại cuộc đời · M Về sảnh',

    shopTitle: 'XƯỞNG NÂNG CẤP CHIẾN HẠM',
    waveCompleted: 'Hoàn thành Wave',
    cost: 'Tổng thiệt hại',
    after: 'Ví còn',
    buySelected: 'MUA ĐÃ CHỌN',
    refresh: 'LÀM MỚI',
    skip: 'XUẤT KÍCH TIẾP',
    maxed: 'KỊCH TRẦN',
    bought: 'ĐÃ CHỐT',
    insufficientFunds: 'Cháy túi rồi chỉ huy ơi!',

    garageTitle: 'GARA CHẾ TẠO & LẮP RÁP CHIẾN HẠM',
    garageSubtitle: 'Chọn ô trên khung tàu, gắn mô-đun vũ khí 3D hoặc cường hóa Core',
    tabPrimary: 'VŨ KHÍ CHÍNH',
    tabSkill: 'MÔ-ĐUN SKILL',
    tabCore: 'LÕI TÀU (CORE)',
    slotEmpty: 'TRỐNG',
    slotEmptyHint: 'Chọn vũ khí ở Kho bên trái để lắp vào vị trí này',
    slotCoreTitle: 'LÕI LÒ PHẢN ỨNG CORE',
    slotCoreDesc: 'Các nâng cấp Core (Máu, Giáp, Năng lượng, Tốc độ, Tài nguyên) gắn chết vào khung tàu, tha hồ đổi súng mà KHÔNG BỊ MẤT.',
    btnMount: 'LẮP VÀO Ô',
    btnSwap: 'THAY THẾ',
    btnUnmount: 'THÁO VŨ KHÍ',
    btnDeploy: 'XUẤT KÍCH WAVE',
    warnSwapLose: 'Nhắc nhẹ: Đổi hoặc tháo là bay sạch nâng cấp trên khẩu cũ đấy nhé (hoàn 35% vốn).',
    salvageRefundLabel: 'Hoàn phế liệu',
    restOpenHangar: 'GARA LẮP RÁP [G]',
    corePersistsBadge: 'GẮN VĨNH VIỄN VÀO CORE TÀU',
    weaponBoundBadge: 'GẮN RIÊNG CHO VŨ KHÍ NÀY',
    minPrimaryWarn: 'Tháo nốt khẩu cuối là ra lấy mũi tàu húc quái đấy! Giữ lại ít nhất 1 súng.',

    restOpenInventory: 'KHO TRANG BỊ [G]',
    inventoryTitle: 'KHO TRANG BỊ & LẮP RÁP TÀU 3D',
    bossShopTitle: 'TRẠM CHỢ ĐEN & VÒNG QUAY BOSS',
    tabRoulette: 'VÒNG QUAY BOSS',
    tabInventory: 'KHO ĐỒ (INVENTORY)',
    dragHint: 'Kéo thả trực tiếp trang bị lên các ổ cắm trên thân tàu 3D hoặc kéo ra để tháo',
    btnSpinFree: 'QUAY MIỄN PHÍ',
    btnSpinPaid: 'QUAY LẠI',
    btnClaim: 'NHẬN VÀO KHO',
    claimed: 'ĐÃ NHẬN',
    btnSalvage: 'RÃ PHẾ LIỆU',
    btnUnequip: 'CẤT VÀO KHO',
    btnFuse: 'HỢP NHẤT 3 MÓN',
    noSkillEquipped: 'Chưa gắn Skill (kéo Skill vào ổ lưng tàu)',
    rarityCommon: 'PHỔ THÔNG',
    rarityRare: 'HIẾM',
    rarityEpic: 'CỰC PHẨM',
    roulettePityLabel: 'TÍCH LŨY CỰC PHẨM',
    roulettePityReady: 'CHẮC CHẮN CỰC PHẨM',
    rouletteLock: 'KHÓA',
    rouletteLocked: 'ĐÃ KHÓA',
    rouletteLockFeeHint: '+$15/KHÓA',
    rouletteReadySub: 'NHẤN QUAY ĐỂ MỞ HÒM TIẾP TẾ',
    rouletteClaimShort: 'NHẬN',
    augmentTitle: 'LÕI CÔNG NGHỆ (CHỌN 1)',
    hazardTitle: 'TUYẾN ĐƯỜNG KẾ TIẾP',
    heatOverload: 'QUÁ NHIỆT +30%',
    stormOutsideWarn: 'NGOÀI VÒNG BO — QUAY VÀO KẺO CHÁY GIÁP!',
    stormBossLock: 'ĐẤU TRƯỜNG BOSS ĐÃ KHÓA BO',
    skillCoreTitle: 'LÕI KỸ NĂNG DUY NHẤT',

    raidSectorPrefix: 'KHU VỰC',
    raidVaultHint: 'ĐỨNG TRONG VÒNG XANH ĐỂ GIẢI MÃ',
    raidConvoyTimer: 'THOÁT TRONG',
    quickDraftKicker: 'ĐỘT KÍCH KHU VỰC // TIẾP TẾ NHANH',
    quickDraftTitle: 'CHỌN NÂNG CẤP CHIẾN TRƯỜNG',
    quickDraftHotkey: 'Nhấn phím [1] [2] [3] hoặc bấm thẻ để lắp ngay',
    thermalPurgeReady: '[R] XẢ NHIỆT',
    ventDesc: 'Xả Nhiệt Chủ Động (nổ sóng nhiệt & đốt cháy địch khi Nhiệt >= 60%)',

    shieldReady: 'KHIÊN SẴN SÀNG',
    shieldActive: 'KHIÊN ĐANG BẬT',
    shieldCd: 'HỒI KHIÊN',

    rank: 'Hạng',
    name: 'Phi Công',
    loadingScores: 'Đang gọi dữ liệu từ trạm quỹ đạo...',
    noScores: 'Bảng vàng đang trống trơn — vào làm kỷ lục mở bát đi!',
    submitSuccess: 'Đã khắc tên lên bảng vàng!',
    submitError: 'Mạng chập chờn quá, thử gửi lại phát nữa nhé.',
    enterNameAlert: 'Quên nhập biệt danh kìa phi công ơi!',
    nameTooLong: 'Tên dài quá rồi (tối đa 20 ký tự thôi)!',
    firebaseOffline: 'Firebase đang ngủ đông hoặc chưa cấu hình.',
    lbKicker: 'MẠNG QUỸ ĐẠO // BẢNG XẾP HẠNG TRỰC TUYẾN',
    lbLiveBadge: 'TRỰC TUYẾN · FIREBASE LIVE',
    lbSyncBadge: 'ĐANG ĐỒNG BỘ...',
    lbCachedBadge: 'BỘ NHỚ ĐỆM CỤC BỘ',
    lbOfflineBadge: 'MẤT KẾT NỐI TRẠM',
    lbRefreshBtn: 'LÀM MỚI',
    lbYouTag: 'BẠN',
    lbEmptySlot: 'Ổ trống',
    lbRunLoadoutTitle: 'TÀU & TRANG BỊ CỦA TRẬN',
    lbSubtitleMeta: '{count} PHI CÔNG GHI DANH · ĐỈNH BẢNG {top}',
    lbPodiumTop1: 'QUÁN QUÂN #1',
    lbPodiumTop2: 'Á QUÂN #2',
    lbPodiumTop3: 'HẠNG #3',
    lbRivalChase: 'HẠNG CỦA BẠN: #{rank} · CẦN THÊM +{diff} ĐIỂM ĐỂ VƯỢT #{targetRank} {targetName}',
    lbRivalKing: 'ĐANG GIỮ NGÔI ĐẦU #01 · DẪN TRƯỚC #{targetRank} +{diff} ĐIỂM',
    lbChaseBtn: 'XUẤT KÍCH ĐUA TOP',
    lbTargetBadge: 'MỤC TIÊU +{diff}',
    lbUpdateBtn: 'CẬP NHẬT KỶ LỤC',
    lbSavedPilotHint: 'Đã tự điền biệt danh của bạn — nhấn Enter hoặc nút bên cạnh để lưu',
    goHeroScoreLabel: 'TỔNG ĐIỂM CHIẾN DỊCH',
    goNewCrown: 'TÂN VƯƠNG THIÊN HÀ — CHIẾM NGÔI HẠNG #1!',
    goNewPb: 'PHÁ KỶ LỤC CÁ NHÂN! (+{diff} ĐIỂM)',
    goFirstRecord: 'HẠNG DỰ KIẾN #{rank} · SẴN SÀNG GHI DANH!',
    goKeepBest: 'KỶ LỤC CỦA BẠN: {best} (#{rank}) · CÒN KÉM {diff} ĐIỂM ĐỂ PHÁ KỶ LỤC',
    goUpdatedKeepBest: 'Đã cập nhật tên & giữ nguyên kỷ lục cao nhất {best}!',
    goNewRecordSaved: 'Đã phá kỷ lục & vươn lên Hạng #{rank}!',

    achievementLvl: 'THÀNH TỰU CẤP {lvl}!',
    levelsLabel: 'cấp độ',
    completed: 'Hoàn thành tối đa',
    lvPrefix: 'Cấp',

    metaForgeTitle: 'XƯỞNG NÂNG CẤP VĨNH VIỄN // META-FORGE',
    metaForgeBtn: 'XƯỞNG META-FORGE',
    shardsLabel: 'SCRAP SHARDS',
    roomsCleared: 'Phòng Đã Vượt',
    shardsEarned: 'Scrap Shards Nhận',
    rerollBtn: '[R] ĐỔI THẺ',
    roomSelectKicker: 'CỔNG DỊCH CHUYỂN // CHỌN NHÁNH PHÒNG',
    roomSelectTitle: 'CHỌN CỬA DỊCH CHUYỂN TIẾP THEO',
    roomSelectHint: 'Nhấn phím [1] [2] [3] hoặc chọn cổng dịch chuyển',
    chronoReadyBtn: '[F] CHRONO',

    bootCampBtn: 'TẬP LÁI CƠ BẢN (20s)',
    startTutorialBtn: 'VÀO SÂN TẬP LÁI THỰC TẾ',
    skipTutorialBtn: 'BỎ QUA',
    gpuQuickLabel: 'iGPU · MẸO TĂNG FPS',
    gpuBoostBtn: 'HƯỚNG DẪN BẬT CARD RỜI (dGPU)',
    gpuModalKicker: 'CHẨN ĐOÁN PHẦN CỨNG // BỘ XỬ LÝ ĐỒ HỌA',
    gpuModalTitleIgpu: 'TRÌNH DUYỆT ĐANG CHẠY CARD TÍCH HỢP (iGPU)',
    gpuModalTitleDiscrete: 'ĐANG DÙNG CARD ĐỒ HỌA RỜI (dGPU)',
    gpuModalCurrentLabel: 'GPU hiện tại trình duyệt đang nhận:',
    gpuModalStep1: '1. Trên Windows 10/11, mở Settings -> System -> Display -> Graphics.',
    gpuModalStep2: '2. Bấm Browse / chọn trình duyệt bạn đang mở (Chrome, Edge hoặc Cốc Cốc).',
    gpuModalStep3: '3. Chọn Options -> High performance (NVIDIA / AMD), bấm Save và mở lại trình duyệt.',
    gpuModalNote: 'Lưu ý: Đã tự động tối ưu bộ đệm cho iGPU. Nếu laptop có card rời mà vẫn hiện iGPU, hãy cắm sạc và làm 3 bước trên để đạt 60 FPS ổn định.',
    gpuModalAckBtn: 'ĐÃ HIỂU',
    pauseGpuPrefix: 'GPU ĐANG DÙNG',
    pauseGpuDiscrete: 'Card rời (dGPU)',
    pauseGpuIntegrated: 'Card tích hợp (iGPU — đã bật chế độ tiết kiệm băng thông)',
    pauseGpuSoftware: 'Dựng hình CPU (khuyên bật Hardware Acceleration trong trình duyệt)',

    onbBadgePrefix: 'HUẤN LUYỆN PHI CÔNG MỚI',
    onbStep1Title: 'CƠ ĐỘNG & LƯỚT NÉ ĐẠN',
    onbStep1Desc: 'Giữ WASD (hoặc phím mũi tên) để bay, nhấn SHIFT để Lướt Pha bất tử né đạn.',
    onbStep1DescMobile: 'Kéo cần xoay bên trái để bay, bấm nút DASH để Lướt Pha né đạn.',
    onbStep1MoveTask: 'Bay thử nghiệm bằng WASD / Mũi tên',
    onbStep1DashTask: 'Nhấn SHIFT để kích hoạt Lướt Pha',
    onbStep2Title: 'NGẮM BẮN & XẢ NHIỆT VŨ KHÍ',
    onbStep2Desc: 'Nhấn giữ Chuột Trái hoặc SPACE để hạ 2 Drone tập, sau đó nhấn R để Xả Nhiệt.',
    onbStep2DescMobile: 'Nhấn FIRE để hạ 2 Drone tập, sau đó bấm VENT để Xả Nhiệt.',
    onbStep2KillTask: 'Hạ gục Drone tập bắn',
    onbStep2VentTask: 'Nhấn [R] kích hoạt Xả Nhiệt đẩy lùi',
    onbStep3Title: 'THU HỒI CHIẾN LỢI PHẨM',
    onbStep3Desc: 'Bay lại gần các hạt Vàng rơi để nạp Credits, sau đó xuất kích vào Phòng 1.',
    onbStep3LootTask: 'Thu hồi Credits rơi từ mục tiêu',
    onbCompleteMsg: 'HUẤN LUYỆN HOÀN TẤT — CHUẨN BỊ VÀO PHÒNG 1!',

    coachOverheatTip: 'QUÁ NHIỆT! Nhấn [R] ngay khi Nhiệt >= 60% để Xả Nhiệt & nổ xung đẩy lùi địch.',
    coachChronoTip: 'CHRONO ĐẦY 100%! Nhấn [F] (hoặc chuột giữa) để làm chậm đạn địch & tăng sát thương.',
    coachInventoryTip: 'ĐÃ NHẶT VŨ KHÍ MỚI! Nhấn [G] lúc nghỉ giữa đợt để mở Kho & gắn lên 6 ổ thân tàu.',
    popupReasonPrefix: 'VÌ SAO HIỆN BẢNG NÀY:',
  },
  en: {
    subtitle: 'NEBULA VANGUARD · 2.5D/3D EDITION',
    playGame: 'LAUNCH SORTIE',
    leaderboard: 'LEADERBOARD',
    instructions: 'CONTROLS',
    info: 'SYSTEM INFO',
    achievementsTitle: 'ACHIEVEMENTS',
    back: 'BACK',

    gameOver: 'HULL DESTROYED',
    score: 'Score',
    wave: 'Wave',
    maxCombo: 'Max Combo',
    bossesSlain: 'Bosses Slain',
    enterName: 'Enter pilot callsign...',
    submitScore: 'SUBMIT SCORE',
    submitted: 'SUBMITTED',
    encourageSubmit: 'Carve your callsign onto the board before someone else beats it!',
    rankPreview: 'Projected Rank: #{rank}',
    playAgain: 'PLAY AGAIN',
    mainMenu: 'MAIN MENU',
    top10: 'TOP 10 PILOTS',

    manualKicker: 'OPERATIONS MANUAL // FLIGHT CONTROL DECK',
    controls: 'FLIGHT & COMBAT CONTROL MANUAL',
    deckLiveBadge: 'INTERACTIVE SIMULATOR',
    deckLiveHint: 'Press any physical key or click a control on the diagram to inspect its function',
    mouseUnitLabel: 'TACTICAL MOUSE',
    mouseAimSensor: '360° RETICLE SENSOR',
    inspectorStandby: 'STANDBY',
    inspectorActive: 'INPUT ACTIVE',
    roleFlight: 'FLIGHT',
    roleOrdnance: 'ORDNANCE',
    roleTactical: 'TACTICAL',
    roleSystems: 'SYSTEMS',
    leaderboardTitle: 'GALACTIC LEADERBOARD',
    movement: 'Flight & Evasion',
    moveDesc: '360° eight-axis thruster maneuvering (WASD / Arrow keys)',
    dashDesc: 'Phase Dash (brief invulnerability and timing-based projectile Parry)',
    combat: 'Ordnance & Active Systems',
    shootDesc: 'Fire primary weapons (supports HUD Auto-Fire toggle)',
    aimToggleDesc: 'Toggle between Automated Target Lock and Manual Mouse Aim',
    bombDesc: 'Activate Dorsal Skill [E]; paired with [F] Chrono and [R] Thermal Purge',
    chronoShortDesc: 'Trigger Chrono Overdrive to decelerate hostile projectiles (at 100% charge)',
    ventShortDesc: 'Purge core heat at 60%+ to release a radial knockback pulse',
    shop: 'Hangar & Logistics',
    selectItems: 'Quick-select upgrades, quick drafts, or Warp Gates (1 - 4)',
    buyItems: 'Confirm purchase for selected modules or upgrades',
    refreshShop: 'Reroll shop inventory (consumes Credits)',
    skipShop: 'Close Hangar interface and resume sortie',
    hangarKeyDesc: 'Open Ship Hardpoint Garage during intermission phases',
    pauseKeyDesc: 'Toggle tactical pause or exit the current Armory screen',
    tips: 'CORE TACTICAL DOCTRINE',
    tip1Title: 'Phase Parry & Chrono Charge',
    tip2Title: 'Weapon Thermal Management',
    tip3Title: 'Priority Target Counterplay',
    tip4Title: 'Safe Perimeter & Route Planning',
    tip1: 'Trigger Phase Dash [SHIFT] on projectile impact to parry shots back with amplified damage and reset cooldown; close-range Graze maneuvering accelerates Chrono [F] charge.',
    tip2: 'Sustained fire raises core weapon heat. Once temperature reaches 60% or above, execute Thermal Purge [R] to vent heat and repel nearby hostiles before weapon lockout.',
    tip3: 'Shield-Bearer hulls mitigate frontal impacts significantly — flank behind their arc to deal full damage. Prioritize eliminating Medic units maintaining active repair tethers.',
    tip4: 'Keep the fighter inside the Safe Perimeter Ring to prevent outer radiation hull decay, and select Warp Gates aligned with your current hull integrity and weapon loadout.',

    infoKicker: 'SYSTEM DOSSIER // TECHNICAL SPECIFICATIONS',
    infoModalTitle: 'PROJECT & SYSTEM ARCHITECTURE',
    infoBuildBadge: 'WEBGL2 · 60HZ DETERMINISTIC',
    aboutGame: 'Project Overview',
    gameDescription:
      'Space Shooter: Nebula Vanguard is a browser-based 2.5D/3D tactical space roguelite built with Three.js (WebGL2) and TypeScript. Pilots deploy with a baseline frame, mount modular weapon assemblies across 6 hull hardpoints, navigate 5 branching combat chambers, and engage 6 multi-form capital bosses.',
    metricSimLabel: 'Fixed-Step Tick',
    metricSlotsLabel: 'Hull Hardpoints',
    metricBossLabel: 'Multi-Form Bosses',
    metricAudioLabel: 'Procedural SFX',
    credits: 'Build & Authorship Metadata',
    developer: 'Lead Developer & System Design',
    version: 'Release Build',
    engineLabel: 'Core Stack',
    cloudLabel: 'Online Telemetry',
    techHighlights: 'Core Technical Architecture',
    tech1Title: '3D Rendering & GPU Post-Processing',
    tech2Title: 'Decoupled 60Hz Simulation Core',
    tech3Title: 'Procedural WebAudio Sound Bank',
    tech4Title: 'Combat Telemetry & Input Pipeline',
    tech1: 'Three.js WebGL2 rendering pipeline featuring Blender-authored PBR models, custom GLSL ES 3.00 shaders, UnrealBloom post-processing, and AgX tonemapping.',
    tech2: 'Deterministic 60Hz fixed-timestep simulation decoupled from DOM and WebGL state, ensuring consistent physics and enabling 54 automated verification suites.',
    tech3: '56 procedurally synthesized sound effects compiled into an embedded JSON audio bank, preventing external download managers from intercepting standalone audio files.',
    tech4: 'Layered combat feedback combining multi-frequency Trauma^2 camera response, a 260ms delayed HP drain indicator, 3-tier hitmarkers, and parabolic damage readouts.',
    feedback: 'Technical Feedback & Issue Reporting',
    feedbackDesc: 'If you encounter gameplay defects, WebGL2 rendering anomalies, or combat balance suggestions, please submit a report through the official feedback channel.',
    sendFeedback: 'SUBMIT REPORT & FEEDBACK',

    bossWave: 'BOSS WARNING',
    getReady: 'ENGAGE HOSTILES',
    prepareForBattle: 'CAPITAL-CLASS THREAT DETECTED',
    bossWarningStamp: 'RED ALERT // OMEGA-CLASS SIGNATURE',
    bossClass0: 'TITAN-CLASS ASSAULT DREADNOUGHT',
    bossClass1: 'ABYSSAL SWARM LEVIATHAN',
    bossClass2: 'SOLAR ORBITAL ARCHON',
    bossClass3: 'ARTICULATED CYBER-SERPENT · HYDRA',
    bossClass4: 'DUAL-CORE POLARITY CRUISERS · GEMINI',
    bossClass5: 'SHATTER-ARMOR SIEGE FORTRESS · BASTION',
    bossSub0: 'FULL BROADSIDE · ORBITAL DROP ASSAULT',
    bossSub1: 'VOID RIFT BREACH · BIO-SWARM CARRIER',
    bossSub2: 'CELESTIAL DESCENT · SOLAR ANNIHILATION',
    bossSub3: '6-SEGMENT IK SPINE · VENOM WHIP BARRAGE',
    bossSub4: 'LINKED TWIN HULLS · PLASMA TETHER BEAM',
    bossSub5: '4-PLATE ARMOR SHED · EXPOSED CORE OVERDRIVE',
    bossForm1: 'FORM I · SEALED',
    bossForm2: 'FORM II · UNLEASHED',
    bossForm3: 'FORM III · APEX OVERDRIVE',
    bossArmorPlates: 'ARMOR',
    bossCoreExposed: 'CORE EXPOSED +20%',
    bossThreatExtreme: 'THREAT: EXTREME',
    comboTagD: 'ENGAGED',
    comboTagC: 'CRUISING',
    comboTagB: 'BRUTAL',
    comboTagA: 'ANARCHIC',
    comboTagS: 'SUPREME',
    comboTagSS: 'SAVAGE NOVA',
    comboTagSSS: 'GODLIKE VANGUARD',
    waveClearedTag: 'SECTOR CLEARED',
    bossSlainTag: 'CAPITAL THREAT ANNIHILATED',
    bossSlainSub: 'ORDNANCE HANGAR INBOUND...',
    fastClearBonus: 'FAST CLEAR BONUS',
    bossBounty: 'BOUNTY CREDITED',
    bossApproaching: 'CAPITAL BOSS INBOUND',
    bossShieldedTag: 'AEGIS SHIELD -65%',
    bossStaggeredTag: 'SHIELD BREAK · 1.75x DMG',
    bossMutationPrefix: 'MUTATIONS',
    sectorDeploy: 'SECTOR DEPLOYMENT',
    skillSalvo: 'MACROSS SALVO',
    skillRailbeam: 'RAIL-LANCE BEAM',
    skillEmp: 'CHRONO EMP STORM',
    skillSwitchHint: 'F SWITCH',
    tutorialStart: 'SYSTEMS ONLINE',
    tutorialPrompt: 'FLY INTO THE GREEN ZONE TO LAUNCH',
    tutorialHint: 'WASD Fly · SHIFT Dash/Parry · SPACE Shoot · E Skill · F Chrono · R Purge',
    holdToStart: 'Hold steady',
    nextWaveIn: 'Next wave in',
    fastClear: 'CLEAN SWEEP',

    paused: 'PAUSED',
    resume: 'RESUME',
    restart: 'RESTART',
    soundOn: 'Audio: ON',
    soundOff: 'Audio: MUTED',
    aimAuto: 'Aim: AUTO',
    aimMouse: 'Aim: MOUSE',
    autoFireOn: 'Auto-Fire: ON',
    autoFireOff: 'Auto-Fire: OFF',
    graphicsLabel: 'Graphics',
    qualityHigh: 'High (Bloom)',
    qualityMedium: 'Medium',
    qualityLow: 'Low',
    pauseHint: 'ESC Resume · R Start Fresh · M Main Menu',

    shopTitle: 'SHIP UPGRADE HANGAR',
    waveCompleted: 'Wave Cleared',
    cost: 'Total Damage',
    after: 'Leftover',
    buySelected: 'PURCHASE',
    refresh: 'REROLL',
    skip: 'NEXT WAVE',
    maxed: 'MAXED',
    bought: 'BOUGHT',
    insufficientFunds: 'Wallet says no, Commander!',

    garageTitle: 'MODULAR SHIP ASSEMBLY HANGAR',
    garageSubtitle: 'Select a hull hardpoint to mount 3D ordnance or upgrade persistent Ship Core',
    tabPrimary: 'PRIMARY ARMS',
    tabSkill: 'SKILL BAYS',
    tabCore: 'SHIP CORE',
    slotEmpty: 'EMPTY BAY',
    slotEmptyHint: 'Select a weapon from the Armory on the left to mount into this bay',
    slotCoreTitle: 'REACTOR CORE MATRIX',
    slotCoreDesc: 'Core upgrades (Hull HP, Shield, Energy, Thrusters, Utility) bolt straight into the airframe and NEVER vanish when swapping guns.',
    btnMount: 'MOUNT TO SLOT',
    btnSwap: 'SWAP POD',
    btnUnmount: 'UNMOUNT POD',
    btnDeploy: 'DEPLOY WAVE',
    warnSwapLose: 'Heads up: Swapping or unmounting scraps upgrades on the old gun (35% salvage refund).',
    salvageRefundLabel: 'Salvage refund',
    restOpenHangar: 'HANGAR [G]',
    corePersistsBadge: 'PERMANENT CHASSIS UPGRADE',
    weaponBoundBadge: 'BOUND TO THIS WEAPON ONLY',
    minPrimaryWarn: 'Keep at least 1 gun unless you plan on angry staring!',

    restOpenInventory: 'INVENTORY BAY [G]',
    inventoryTitle: 'SHIP INVENTORY & 3D ASSEMBLY',
    bossShopTitle: 'BLACK-MARKET BOSS SUPPLY ROULETTE',
    tabRoulette: 'BOSS ROULETTE',
    tabInventory: 'INVENTORY',
    dragHint: 'Drag items directly onto glowing 3D ship sockets or drag off to unequip',
    btnSpinFree: 'FREE SUPPLY SPIN',
    btnSpinPaid: 'RESPIN ROULETTE',
    btnClaim: 'CLAIM',
    claimed: 'CLAIMED',
    btnSalvage: 'SALVAGE',
    btnUnequip: 'STASH TO INV',
    btnFuse: 'FUSE 3-IN-1',
    noSkillEquipped: 'No Skill Equipped',
    rarityCommon: 'COMMON',
    rarityRare: 'RARE',
    rarityEpic: 'EPIC',
    roulettePityLabel: 'EPIC PITY',
    roulettePityReady: 'GUARANTEED EPIC NEXT',
    rouletteLock: 'LOCK',
    rouletteLocked: 'LOCKED',
    rouletteLockFeeHint: '+$15/LOCK',
    rouletteReadySub: 'SPIN TO UNLOCK SUPPLY REELS',
    rouletteClaimShort: 'CLAIM',
    augmentTitle: 'SYSTEM AUGMENT (PICK 1)',
    hazardTitle: 'NEXT SECTOR HAZARD',
    heatOverload: 'OVERHEAT +30%',
    stormOutsideWarn: 'OUTSIDE SAFE RING — GET BACK IN HERE!',
    stormBossLock: 'BOSS ARENA RING LOCKED',
    skillCoreTitle: 'SINGLE CENTRAL SKILL CORE',

    raidSectorPrefix: 'SECTOR',
    raidVaultHint: 'HOLD INSIDE RING TO DECRYPT',
    raidConvoyTimer: 'WARPS IN',
    quickDraftKicker: 'SECTOR RAID // INSTANT DROP',
    quickDraftTitle: 'SELECT FIELD UPGRADE',
    quickDraftHotkey: 'Press [1] [2] [3] or click a card to equip immediately',
    thermalPurgeReady: '[R] PURGE',
    ventDesc: 'Thermal Purge (vent heat >= 60% into an AoE burn shockwave)',

    shieldReady: 'SHIELD READY',
    shieldActive: 'SHIELD ACTIVE',
    shieldCd: 'SHIELD CD',

    rank: 'Rank',
    name: 'Pilot',
    loadingScores: 'Pinging orbital relay...',
    noScores: 'Board is wide open — go claim #1!',
    submitSuccess: 'Score logged in orbital history!',
    submitError: 'Relay hiccupped. Give it another shot.',
    enterNameAlert: 'You forgot to type a callsign, pilot!',
    nameTooLong: 'Keep the callsign under 20 characters!',
    firebaseOffline: 'Firebase is either napping or unconfigured.',
    lbKicker: 'ORBITAL UPLINK // GLOBAL LEADERBOARD',
    lbLiveBadge: 'ONLINE · FIREBASE LIVE',
    lbSyncBadge: 'SYNCING RELAY...',
    lbCachedBadge: 'OFFLINE CACHE',
    lbOfflineBadge: 'RELAY OFFLINE',
    lbRefreshBtn: 'REFRESH',
    lbYouTag: 'YOU',
    lbEmptySlot: 'Empty Slot',
    lbRunLoadoutTitle: 'SHIP & MOUNTED LOADOUT',
    lbSubtitleMeta: '{count} PILOTS LOGGED · TOP RECORD {top}',
    lbPodiumTop1: 'CHAMPION #1',
    lbPodiumTop2: 'RUNNER-UP #2',
    lbPodiumTop3: '3RD PLACE',
    lbRivalChase: 'YOUR RANK: #{rank} · +{diff} PTS NEEDED TO PASS #{targetRank} {targetName}',
    lbRivalKing: 'HOLDING #01 CROWN · LEADING #{targetRank} BY +{diff} PTS',
    lbChaseBtn: 'LAUNCH & CHASE',
    lbTargetBadge: 'TARGET +{diff}',
    lbUpdateBtn: 'UPDATE RECORD',
    lbSavedPilotHint: 'Callsign auto-filled — press Enter or click to save',
    goHeroScoreLabel: 'FINAL SORTIE SCORE',
    goNewCrown: 'NEW GALACTIC CHAMPION — RANK #1 CLAIMED!',
    goNewPb: 'NEW PERSONAL BEST! (+{diff} PTS)',
    goFirstRecord: 'PROJECTED RANK #{rank} · READY TO LOG!',
    goKeepBest: 'YOUR BEST: {best} (#{rank}) · {diff} PTS SHORT OF NEW PB',
    goUpdatedKeepBest: 'Callsign updated & highest record {best} preserved!',
    goNewRecordSaved: 'New record logged at Rank #{rank}!',

    achievementLvl: 'ACHIEVEMENT LVL {lvl}!',
    levelsLabel: 'levels',
    completed: 'Maxed Out',
    lvPrefix: 'Lv',

    metaForgeTitle: 'ORBITAL META-FORGE // PERMANENT UPGRADES',
    metaForgeBtn: 'META-FORGE',
    shardsLabel: 'SCRAP SHARDS',
    roomsCleared: 'Rooms Cleared',
    shardsEarned: 'Scrap Shards Earned',
    rerollBtn: '[R] REROLL',
    roomSelectKicker: 'WARP GATES // BRANCHING ROUTE',
    roomSelectTitle: 'SELECT NEXT WARP CHAMBER',
    roomSelectHint: 'Press [1] [2] [3] or click a Warp Gate',
    chronoReadyBtn: '[F] CHRONO',

    bootCampBtn: 'FLIGHT TUTORIAL (20s)',
    startTutorialBtn: 'LAUNCH FLIGHT TUTORIAL',
    skipTutorialBtn: 'SKIP',
    gpuQuickLabel: 'iGPU · BOOST FPS',
    gpuBoostBtn: 'HOW TO ENABLE DISCRETE GPU',
    gpuModalKicker: 'HARDWARE TELEMETRY // GRAPHICS ADAPTER',
    gpuModalTitleIgpu: 'RUNNING ON INTEGRATED GRAPHICS (iGPU)',
    gpuModalTitleDiscrete: 'RUNNING ON DISCRETE GPU (dGPU)',
    gpuModalCurrentLabel: 'Detected WebGL2 Adapter:',
    gpuModalStep1: '1. On Windows 10/11, open Settings -> System -> Display -> Graphics.',
    gpuModalStep2: '2. Select your browser (Chrome, Edge, or Brave) or browse to its .exe.',
    gpuModalStep3: '3. Click Options -> High performance (NVIDIA / AMD GPU), Save and restart the browser.',
    gpuModalNote: 'Note: Render targets and pixel budgets are automatically tuned for iGPU. On dual-GPU laptops, plug in AC power and apply the 3 steps above for maximum FPS.',
    gpuModalAckBtn: 'GOT IT',
    pauseGpuPrefix: 'ACTIVE GPU',
    pauseGpuDiscrete: 'Discrete GPU (dGPU)',
    pauseGpuIntegrated: 'Integrated iGPU (low-bandwidth mode active)',
    pauseGpuSoftware: 'Software Rasterizer (enable Browser Hardware Acceleration)',

    onbBadgePrefix: 'ROOKIE FLIGHT CHECK',
    onbStep1Title: 'THRUST & PHASE DASH',
    onbStep1Desc: 'Fly with WASD (or Arrow keys), then press SHIFT to trigger an invulnerable Phase Dash.',
    onbStep1DescMobile: 'Use the left joystick to fly, then tap DASH to trigger Phase Dash.',
    onbStep1MoveTask: 'Steer fighter with WASD / Arrows',
    onbStep1DashTask: 'Trigger Phase Dash with [SHIFT]',
    onbStep2Title: 'AIM FIRE & THERMAL PURGE',
    onbStep2Desc: 'Hold LMB or SPACE to destroy 2 Training Drones, then press R to vent Thermal Purge.',
    onbStep2DescMobile: 'Hold FIRE to destroy 2 Training Drones, then tap VENT to Thermal Purge.',
    onbStep2KillTask: 'Destroy Training Drones',
    onbStep2VentTask: 'Press [R] to trigger Thermal Purge',
    onbStep3Title: 'COLLECT BATTLE LOOT',
    onbStep3Desc: 'Fly near dropped Credits to vacuum them aboard before launching Room 1.',
    onbStep3LootTask: 'Collect dropped Credits',
    onbCompleteMsg: 'FLIGHT CHECK PASSED — DEPLOYING TO CHAMBER 1!',

    coachOverheatTip: 'OVERHEATED! Press [R] whenever Heat >= 60% to purge weapons & knock back foes.',
    coachChronoTip: 'CHRONO 100%! Press [F] (or Middle Mouse) to slow enemy bullets & boost damage.',
    coachInventoryTip: 'WEAPON POD LOOTED! Press [G] between waves to open Garage & mount on 6 slots.',
    popupReasonPrefix: 'WHY THIS APPEARED:',
  },
};

export type ControlRoleId = 'flight' | 'ordnance' | 'tactical' | 'systems';

export type ControlDocId =
  | 'move'
  | 'dash'
  | 'fire'
  | 'skill'
  | 'vent'
  | 'chrono'
  | 'aim_toggle'
  | 'mouse_aim'
  | 'slots'
  | 'confirm'
  | 'garage'
  | 'esc'
  | 'menu_key';

export interface ControlDeckEntry {
  id: ControlDocId;
  codes: string[];
  keycapLabel: string;
  role: ControlRoleId;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
}

export const CONTROL_DECK_ITEMS: Record<ControlDocId, ControlDeckEntry> = {
  move: {
    id: 'move',
    codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    keycapLabel: 'WASD / ARROWS',
    role: 'flight',
    titleVi: 'Động Cơ Điều Hướng 8 Trục',
    titleEn: '8-Axis Thruster Propulsion',
    descVi: 'Di chuyển phi thuyền 360° theo trục phẳng chiến trường. Kết hợp nghiêng cánh động lực học và né đạn tầm gần để tích điểm Graze.',
    descEn: 'Navigate 360° across the combat plane. Pair tight vector adjustments with close projectile skims (Graze) to charge Chrono.',
  },
  dash: {
    id: 'dash',
    codes: ['ShiftLeft', 'ShiftRight'],
    keycapLabel: 'SHIFT',
    role: 'flight',
    titleVi: 'Lướt Pha Tốc & Phản Đòn (Parry)',
    titleEn: 'Phase Dash & Projectile Parry',
    descVi: 'Lướt nhanh xuyên đe dọa với khung bất tử ngắn (tiêu tốn Năng lượng). Kích hoạt đúng nhịp đạn chạm mũi để phản xạ đạn ngược lại mục tiêu.',
    descEn: 'Burst forward with brief invulnerability (uses Energy). Time the dash on projectile contact to Parry shots back with bonus damage.',
  },
  fire: {
    id: 'fire',
    codes: ['Space', 'LMB'],
    keycapLabel: 'SPACE / LMB',
    role: 'ordnance',
    titleVi: 'Khai Hỏa Vũ Khí Chính',
    titleEn: 'Primary Weapons Fire',
    descVi: 'Nhấn giữ để khai hỏa toàn bộ các tổ hợp súng gắn trên mũi và cánh tàu. Theo dõi vạch Nhiệt để tránh quá tải khi bắn liên tục.',
    descEn: 'Hold to fire all primary cannons mounted on nose and wing hardpoints. Monitor weapon Thermal build-up during sustained bursts.',
  },
  skill: {
    id: 'skill',
    codes: ['KeyE', 'KeyQ', 'RMB'],
    keycapLabel: 'E / Q / RMB',
    role: 'tactical',
    titleVi: 'Kỹ Năng Sống Lưng (Dorsal Skill)',
    titleEn: 'Dorsal Core Skill Activation',
    descVi: 'Kích hoạt mô-đun kỹ năng gắn trên Sống Lưng (Salvo tên lửa, Pháo Rail-Lance hoặc Xung điện từ EMP) khi hồi chiêu sẵn sàng.',
    descEn: 'Trigger the mounted Dorsal Skill Core (Missile Salvo, Rail-Lance Beam, or EMP Discharge) when off cooldown.',
  },
  vent: {
    id: 'vent',
    codes: ['KeyR'],
    keycapLabel: 'R',
    role: 'ordnance',
    titleVi: 'Xả Nhiệt Chủ Động / Đổi Sạp Hàng',
    titleEn: 'Thermal Purge / Shop Reroll',
    descVi: 'Trong trận (khi Nhiệt >= 60%): xả toàn bộ nhiệt lượng thành sóng xung kích đẩy lùi địch. Tại Xưởng/Draft: làm mới danh sách lựa chọn.',
    descEn: 'In combat (Heat >= 60%): vent core heat into a radial knockback pulse. In Shop/Draft/Pause: reroll options or quick-restart.',
  },
  chrono: {
    id: 'chrono',
    codes: ['KeyF', 'MMB'],
    keycapLabel: 'F / MMB',
    role: 'tactical',
    titleVi: 'Trường Ngưng Đọng Chrono Overdrive',
    titleEn: 'Chrono Overdrive Field',
    descVi: 'Khi thanh Chrono đạt 100% (tích qua Graze hoặc tiêu diệt), kích hoạt để làm chậm thời gian đạn địch và tăng hỏa lực tức thời.',
    descEn: 'At 100% Chrono charge (gained from Graze and eliminations), deploy a dilation field that slows hostile shots and boosts fire output.',
  },
  aim_toggle: {
    id: 'aim_toggle',
    codes: ['Tab'],
    keycapLabel: 'TAB',
    role: 'systems',
    titleVi: 'Chuyển Đổi Hệ Thống Ngắm Bắn',
    titleEn: 'Targeting Mode Switch',
    descVi: 'Chuyển đổi tức thì giữa chế độ Tự Động Khóa Mục Tiêu (Auto-Aim) và Ngắm Thủ Công theo vị trí con trỏ chuột (Mouse Aim).',
    descEn: 'Switch instantaneously between Automated FCS Target Lock and precision Manual Mouse Aim tracking.',
  },
  mouse_aim: {
    id: 'mouse_aim',
    codes: ['AIM'],
    keycapLabel: 'MOUSE SENSOR',
    role: 'ordnance',
    titleVi: 'Cảm Biến Hướng Tâm Ngắm 360°',
    titleEn: '360° Reticle Aim Tracking',
    descVi: 'Di chuyển chuột trên mặt phẳng chiến trường để xoay mũi tàu và khóa tuyến bắn theo góc ngắm thủ công chính xác.',
    descEn: 'Sweep the cursor across the 3D arena plane to orient the fighter heading and steer manual fire trajectories.',
  },
  slots: {
    id: 'slots',
    codes: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
    keycapLabel: '1 - 4',
    role: 'systems',
    titleVi: 'Chọn Nhanh Thẻ / Cổng / Trang Bị',
    titleEn: 'Quick-Select Draft, Gates & Shop',
    descVi: 'Phím [1]-[3] chọn nhanh thẻ Thăng Cấp hoặc Cổng Dịch Chuyển; [1]-[4] đánh dấu hoặc bỏ chọn mặt hàng trong Cửa Hàng sau Boss.',
    descEn: 'Keys [1]-[3] immediately select Level-Up Drafts or Warp Gates; [1]-[4] toggle items inside the Post-Boss Armory.',
  },
  confirm: {
    id: 'confirm',
    codes: ['Enter'],
    keycapLabel: 'ENTER',
    role: 'systems',
    titleVi: 'Xác Nhận Giao Dịch Cửa Hàng',
    titleEn: 'Confirm Shop Purchase',
    descVi: 'Thanh toán ngay các trang bị đang được đánh dấu trong Cửa Hàng mà không cần rê chuột xuống nút xác nhận.',
    descEn: 'Purchase all currently flagged modules and upgrades in the Armory without moving the pointer away from the selection.',
  },
  garage: {
    id: 'garage',
    codes: ['KeyG'],
    keycapLabel: 'G',
    role: 'systems',
    titleVi: 'Truy Cập Nhanh Xưởng Thân Tàu',
    titleEn: 'Quick Hangar Garage Access',
    descVi: 'Mở nhanh Xưởng 3D để kiểm tra ổ cứng vũ khí, ghép 3 trang bị đồng cấp hoặc điều phối lại vị trí mô-đun giữa các đợt giao tranh.',
    descEn: 'Open the 3D Hangar Garage during rest windows to inspect hardpoints, fuse 3 matching items, or swap weapon bays.',
  },
  esc: {
    id: 'esc',
    codes: ['Escape'],
    keycapLabel: 'ESC',
    role: 'systems',
    titleVi: 'Tạm Dừng / Thoát Giao Diện',
    titleEn: 'Tactical Pause / Close Shop',
    descVi: 'Tạm dừng trận đấu và mở bảng điều chỉnh (âm thanh, khởi động lại, về Menu chính), hoặc đóng nhanh Cửa Hàng để tiếp tục xuất kích.',
    descEn: 'Pause combat to adjust audio or restart, or close the Armory overlay immediately to deploy into the next sector.',
  },
  menu_key: {
    id: 'menu_key',
    codes: ['KeyM'],
    keycapLabel: 'M',
    role: 'systems',
    titleVi: 'Quay Về Menu Chính (Khi Tạm Dừng)',
    titleEn: 'Return to Hangar Menu (While Paused)',
    descVi: 'Khi đang mở màn hình Tạm Dừng, nhấn [M] để hủy nhiệm vụ hiện tại và quay trở về Sảnh Hangar chính.',
    descEn: 'While the Pause overlay is active, press [M] to abort the current sortie and return to the Hangar Main Menu.',
  },
};
