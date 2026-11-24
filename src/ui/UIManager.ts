import { ACHIEVEMENTS, ACHIEVEMENT_LIST } from '../config/achievements';
import { BOSS_MUTATIONS } from '../config/bossMutations';
import {
  COMBO_TIERS,
  COMBO_WINDOW_MS,
  POWER_UP_CONFIG,
  TUTORIAL_AUTO_START_MS,
  TUTORIAL_HOLD_MS,
  WAVE_REST_MS,
  type ComboRank,
  type PowerUpType,
} from '../config/constants';
import {
  CONTROL_DECK_ITEMS,
  LANGUAGES,
  type ControlDocId,
  type ControlRoleId,
  type LangCode,
  type LanguageStrings,
} from '../config/languages';
import {
  HULL_CATALOG,
  HULL_CLASS_ORDER,
  META_UPGRADE_CATALOG,
  META_UPGRADE_ORDER,
} from '../config/hulls';
import {
  ARCHETYPE_SYNERGY_DEFS,
  MUTATION_CATALOG,
  computeMutationArchetypeCounts,
  countMutationStacks,
  type MutationArchetype,
} from '../config/mutations';
import { SHOP_ITEMS } from '../config/shopItems';
import {
  AUGMENT_CATALOG,
  CORE_SHOP_ITEM_IDS,
  MANUFACTURER_SYNERGIES,
  PRIMARY_UPGRADE_DEFS,
  PRIMARY_WEAPON_IDS,
  SECTOR_HAZARDS,
  SHIP_GRID_SLOTS,
  SHIP_SLOT_MAP,
  SKILL_UPGRADE_DEFS,
  SKILL_WEAPON_IDS,
  WEAPON_CATALOG,
  type AugmentId,
  type ManufacturerId,
  type PrimaryWeaponCatalogEntry,
  type SectorHazardId,
  type ShipSlotId,
  type SkillWeaponCatalogEntry,
  type WeaponId,
} from '../config/weapons';
import type { SoundEngine } from '../audio/SoundEngine';
import type { EventBus } from '../engine/EventBus';
import type { InputManager } from '../engine/InputManager';
import type { GameSimulation } from '../game/GameSimulation';
import {
  computeActiveSynergies,
  computeMountedPrimaryStats,
  computeMountedSkillStats,
  computePlayerCoolingRate,
  computeWeaponHeatScale,
  countMountedPrimaryWeapons,
  findFusableWeaponGroups,
  getMountedWeaponUpgradePrice,
  getRouletteEpicChance,
  getRouletteSpinCost,
  getShopItemPrice,
  getWeaponSalvageValue,
  isMountedWeaponUpgradeMaxed,
  isShopItemMaxed,
  ROULETTE_PITY_THRESHOLD,
} from '../game/systems/ShopSystem';
import type { GameState, GraphicsQuality, MountedWeapon, RouletteOffer } from '../game/types';
import type { SceneManager } from '../render/SceneManager';
import type { AchievementService, AchievementUnlockEvent } from '../services/AchievementService';
import type { LeaderboardEntry, LeaderboardService } from '../services/LeaderboardService';
import { metaProgression } from '../services/MetaProgressionService';
import { createTierStarsEl, createUiIcon, setIconText, type UiIconId } from './TacticalIcons';

const LANG_STORAGE_KEY = 'spaceshooter_lang';

interface DragSession {
  sourceType: 'inventory' | 'slot';
  instanceId?: string;
  fromSlot?: ShipSlotId;
  weaponId: WeaponId;
  kind: 'primary' | 'skill';
  label: string;
  iconUrl: string;
  startX: number;
  startY: number;
  active: boolean;
}

export class UIManager {
  private lang: LangCode = 'vi';
  private scoreSubmitted = false;
  private floatingEls = new Map<number, HTMLDivElement>();
  private toastQueue: AchievementUnlockEvent[] = [];
  private toastActive = false;

  // Cached DOM handles so we aren't querySelecting every frame
  private globalTopBar: HTMLElement;
  private muteQuickBtn: HTMLButtonElement;
  private muteQuickLabel: HTMLElement;
  private langToggleBtn: HTMLButtonElement;
  private fcsReticle: HTMLElement;
  private fcsTag: HTMLElement;
  private hitmarkerReticle: HTMLElement;
  private hpDelayFill: HTMLElement;

  private mainMenu: HTMLElement;
  private menuShardCount: HTMLElement;
  private hangarSpecCard: HTMLElement;
  private forgeReadyDot: HTMLElement;
  private hullSelectorGrid: HTMLElement;
  private heroActions: HTMLElement;
  private heroFocusRail: HTMLElement;
  private playBtn: HTMLButtonElement;
  private hudLayer: HTMLElement;
  private hudTopLeft: HTMLElement;
  private mobileControls: HTMLElement;
  private shopOverlay: HTMLElement;
  private pauseOverlay: HTMLElement;
  private quickDraftScreen: HTMLElement;
  private quickDraftKicker: HTMLElement;
  private quickDraftTitle: HTMLElement;
  private quickDraftGrid: HTMLElement;
  private quickDraftRerollBtn: HTMLButtonElement;
  private quickDraftRerollCount: HTMLElement;
  private roomSelectScreen: HTMLElement;
  private roomSelectKicker: HTMLElement;
  private roomSelectTitle: HTMLElement;
  private roomDoorGrid: HTMLElement;
  private metaForgeScreen: HTMLElement;
  private metaForgeShardTotal: HTMLElement;
  private metaForgeHullGrid: HTMLElement;
  private metaForgeUpgradeGrid: HTMLElement;
  private gameOverScreen: HTMLElement;
  private leaderboardScreen: HTMLElement;
  private instructionsScreen: HTMLElement;
  private infoScreen: HTMLElement;
  private achievementsScreen: HTMLElement;
  private floatingLayer: HTMLElement;
  private toastStack: HTMLElement;

  // Combat HUD element handles
  private webglStageEl: HTMLElement;
  private hpFill: HTMLElement;
  private hpValue: HTMLElement;
  private enFill: HTMLElement;
  private enValue: HTMLElement;
  private heatFill: HTMLElement;
  private heatValue: HTMLElement;
  private thermalPurgeBtn: HTMLButtonElement;
  private chronoRow: HTMLElement;
  private chronoFill: HTMLElement;
  private chronoValue: HTMLElement;
  private chronoHudBtn: HTMLButtonElement;
  private hudRoomPill: HTMLElement;
  private hudRoomSubBanner: HTMLElement;
  private hudLevelBadge: HTMLElement;
  private xpFill: HTMLElement;
  private hudXpText: HTMLElement;
  private warpJumpBanner: HTMLElement;
  private warpJumpKicker: HTMLElement;
  private warpJumpTitle: HTMLElement;
  private warpJumpZone: HTMLElement;
  private hudMutationStrip: HTMLElement;
  private raidObjectiveHud: HTMLElement;
  private raidSectorLabel: HTMLElement;
  private raidObjPips: HTMLElement;
  private raidObjTitle: HTMLElement;
  private raidObjFill: HTMLElement;
  private raidObjMeta: HTMLElement;
  private lastRaidHudKey = '';
  private lastQuickDraftKey = '';
  private lastRoomDoorsKey = '';
  private lastMutationHudKey = '';
  private synergyHudRow: HTMLElement;
  private hazardBadge: HTMLElement;
  private hudWave: HTMLElement;
  private hudScore: HTMLElement;
  private hudMoney: HTMLElement;
  private owPortraitWrap: HTMLElement;
  private owOnFireTag: HTMLElement;
  private owUltArc: SVGCircleElement;
  private owUltPct: HTMLElement;
  private owDashTile: HTMLElement;
  private owDashCd: HTMLElement;
  private owKillFeed: HTMLElement;
  private hudMotionRig: HTMLElement;
  private hudSwayX = 0;
  private hudSwayY = 0;
  private hudTiltX = 0;
  private hudTiltY = 0;
  private hudScale = 1;
  private bossBarContainer: HTMLElement;
  private bossNameLabel: HTMLElement;
  private bossMutatorsRow: HTMLElement;
  private bossPhaseLabel: HTMLElement;
  private bossHpFill: HTMLElement;
  private bossHpTrail: HTMLElement;
  private lastBossMutatorKey = '';
  private restBanner: HTMLElement;
  private restTitle: HTMLElement;
  private restSub: HTMLElement;
  private restHangarBtn: HTMLButtonElement;
  private shieldBadge: HTMLElement;
  private shieldStatusText: HTMLElement;
  private weaponBadges: HTMLElement;
  private fpsBadge: HTMLElement;
  private comboHud: HTMLElement;
  private comboRankText: HTMLElement;
  private comboCalloutText: HTMLElement;
  private comboBankedText: HTMLElement;
  private comboHitsText: HTMLElement;
  private comboTimerFill: HTMLElement;
  private comboMultText: HTMLElement;
  private comboProgressDots: HTMLElement;
  private comboEndBanner: HTMLElement;
  private comboEndRank: HTMLElement;
  private comboEndDetails: HTMLElement;
  private skillWidget: HTMLElement;
  private skillCdText: HTMLElement;
  private skillIconImg: HTMLImageElement;
  private skillNameLabel: HTMLElement;
  private skillLvlText: HTMLElement;
  private activeBuffsBar: HTMLElement;
  private stormWarningBanner: HTMLElement;
  private tacticalRadar: HTMLCanvasElement;
  private radarCtx: CanvasRenderingContext2D | null;
  private radarRadiusLabel: HTMLElement;
  private offscreenMarkers: HTMLElement;
  private waveBanner: HTMLElement;
  private waveBannerTag: HTMLElement;
  private waveBannerGhost: HTMLElement;
  private waveBannerTitle: HTMLElement;
  private waveBannerSub: HTMLElement;
  private waveProgressTrack: HTMLElement;
  private waveClearBanner: HTMLElement;
  private waveClearKicker: HTMLElement;
  private waveClearTitle: HTMLElement;
  private waveClearBonus: HTMLElement;
  private cinemaBarTop: HTMLElement;
  private cinemaBarBottom: HTMLElement;
  private bossIntroOverlay: HTMLElement;
  private bossIntroWarning: HTMLElement;
  private bossIntroSector: HTMLElement;
  private bossIntroClass: HTMLElement;
  private bossIntroTitle: HTMLElement;
  private bossIntroSubtitle: HTMLElement;
  private bossIntroThreat: HTMLElement;
  private lastIntroBossId = -1;
  private introSlamTimer: number | null = null;
  private comboPopTimer: number | null = null;
  private comboRankTimer: number | null = null;
  private fcsKillTimer: number | null = null;
  private hitmarkerTimer: number | null = null;
  private hudDamageTimer: number | null = null;
  private waveClearTimer: number | null = null;
  private xpFlashTimer: number | null = null;
  private levelUpBurstTimer: number | null = null;
  private modalTimers = new Map<HTMLElement, number>();
  private gameOverAnimFrame: number | null = null;
  private activeHeroChoice: HTMLElement | null = null;
  private lastScoreVal = 0;
  private lastMoneyVal = 0;
  private lastPointerX = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 640;
  private lastPointerY = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 400;
  private hpLagPct = 100;
  private hpLagHoldSec = 0;
  private lastHpPct = 100;
  private lastXpVal = 0;
  private lastRenderedWaveBanner = -1;
  private currentWaveNum = 1;

  private hudAimBtn: HTMLButtonElement;
  private hudAutoFireBtn: HTMLButtonElement;
  private hudMuteBtn: HTMLButtonElement;

  // Post-boss screens: Draft / Armory Store / 3D Hangar refs
  private shopTitle: HTMLElement;
  private shopMoneyVal: HTMLElement;
  private shopSelectionBar: HTMLElement;
  private navViewDraft: HTMLButtonElement;
  private navDraftBadge: HTMLElement;
  private navViewStore: HTMLButtonElement;
  private navViewGarage: HTMLButtonElement;
  private navGarageCount: HTMLElement;
  private postBossDraftView: HTMLElement;
  private draftStageTitle: HTMLElement;
  private draftStepIndicator: HTMLElement;
  private draftCardsGrid: HTMLElement;
  private draftContinueBtn: HTMLButtonElement;
  private bossStoreView: HTMLElement;
  private storeRouletteContainer: HTMLElement;
  private storeCoreGrid: HTMLElement;
  private storeGoGarageBtn: HTMLButtonElement;
  private shipGarageView: HTMLElement;
  private garageArmoryPanel: HTMLElement;
  private garageArmoryList: HTMLElement;
  private garageSynergyBar: HTMLElement;
  private shipDropStage: HTMLElement;
  private garageInspector: HTMLElement;
  private dragGhost: HTMLElement;
  private dragSession: DragSession | null = null;
  private activePostWaveView: 'DRAFT' | 'STORE' | 'GARAGE' = 'GARAGE';
  private rouletteSpinning = false;
  private rouletteRevealed: [boolean, boolean, boolean] = [true, true, true];
  private rouletteJustLanded: [boolean, boolean, boolean] = [false, false, false];
  private rouletteTimers: number[] = [];

  // Pause menu refs
  private pauseStats: HTMLElement;
  private pauseSoundBtn: HTMLButtonElement;
  private pauseAimBtn: HTMLButtonElement;
  private pauseAutoFireBtn: HTMLButtonElement;
  private pauseQualityBtn: HTMLButtonElement;

  // Death screen & high-score table refs
  private gameOverShell: HTMLElement;
  private gameOverKicker: HTMLElement;
  private gameOverTitle: HTMLElement;
  private finalScoreEl: HTMLElement;
  private finalWaveEl: HTMLElement;
  private finalComboEl: HTMLElement;
  private finalBossesEl: HTMLElement;
  private finalRoomsEl: HTMLElement;
  private finalShardsEl: HTMLElement;
  private rankPreviewEl: HTMLElement;
  private playerNameInput: HTMLInputElement;
  private submitScoreBtn: HTMLButtonElement;
  private submitStatusMsg: HTMLElement;
  private gameOverLeaderboardBody: HTMLElement;

  private leaderboardBody: HTMLElement;
  private achievementsSummary: HTMLElement;
  private achievementsList: HTMLElement;

  // Control deck simulator handles
  private ctrlDeckStage: HTMLElement;
  private vmouseSensorDot: HTMLElement;
  private ctrlInspBadge: HTMLElement;
  private ctrlInspRole: HTMLElement;
  private ctrlInspTitle: HTMLElement;
  private ctrlInspDesc: HTMLElement;
  private ctrlInspStatus: HTMLElement;
  private deckInteractiveEls: HTMLElement[] = [];
  private codeToDeckEl = new Map<string, HTMLElement[]>();
  private activeDeckCodes = new Set<string>();
  private pointerDeckCodes = new Set<string>();
  private selectedControlBindId: ControlDocId = 'move';

  private lastHudKey = '';

  constructor(
    private readonly sim: GameSimulation,
    private readonly input: InputManager,
    private readonly scene: SceneManager,
    private readonly sound: SoundEngine,
    private readonly achievements: AchievementService,
    private readonly leaderboard: LeaderboardService,
    bus: EventBus
  ) {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'vi' || saved === 'en') this.lang = saved;
    } catch {
      this.lang = 'vi';
    }

    const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

    this.globalTopBar = byId('globalTopBar');
    this.muteQuickBtn = byId('muteQuickBtn');
    this.muteQuickLabel = byId('muteQuickLabel');
    this.langToggleBtn = byId('langToggleBtn');
    this.fcsReticle = byId('fcsReticle');
    this.fcsTag = byId('fcsTag');
    this.hitmarkerReticle = byId('hitmarkerReticle');
    this.hpDelayFill = byId('hpDelayFill');

    this.mainMenu = byId('mainMenu');
    this.menuShardCount = byId('menuShardCount');
    this.hangarSpecCard = byId('hangarSpecCard');
    this.forgeReadyDot = byId('forgeReadyDot');
    this.hullSelectorGrid = byId('hullSelectorGrid');
    this.heroActions = byId('heroActions');
    this.heroFocusRail = byId('heroFocusRail');
    this.playBtn = byId('playBtn');
    this.hudLayer = byId('hudLayer');
    this.hudTopLeft = this.hudLayer.querySelector('.hud-top-left') as HTMLElement;
    this.mobileControls = byId('mobileControls');
    this.shopOverlay = byId('shopOverlay');
    this.pauseOverlay = byId('pauseOverlay');
    this.quickDraftScreen = byId('quickDraftScreen');
    this.quickDraftKicker = byId('quickDraftKicker');
    this.quickDraftTitle = byId('quickDraftTitle');
    this.quickDraftGrid = byId('quickDraftGrid');
    this.quickDraftRerollBtn = byId('quickDraftRerollBtn');
    this.quickDraftRerollCount = byId('quickDraftRerollCount');
    this.roomSelectScreen = byId('roomSelectScreen');
    this.roomSelectKicker = byId('roomSelectKicker');
    this.roomSelectTitle = byId('roomSelectTitle');
    this.roomDoorGrid = byId('roomDoorGrid');
    this.metaForgeScreen = byId('metaForgeScreen');
    this.metaForgeShardTotal = byId('metaForgeShardTotal');
    this.metaForgeHullGrid = byId('metaForgeHullGrid');
    this.metaForgeUpgradeGrid = byId('metaForgeUpgradeGrid');
    this.gameOverScreen = byId('gameOverScreen');
    this.leaderboardScreen = byId('leaderboardScreen');
    this.instructionsScreen = byId('instructionsScreen');
    this.infoScreen = byId('infoScreen');
    this.achievementsScreen = byId('achievementsScreen');
    this.floatingLayer = byId('floatingLayer');
    this.toastStack = byId('toastStack');

    this.ctrlDeckStage = byId('ctrlDeckStage');
    this.vmouseSensorDot = byId('vmouseSensorDot');
    this.ctrlInspBadge = byId('ctrlInspBadge');
    this.ctrlInspRole = byId('ctrlInspRole');
    this.ctrlInspTitle = byId('ctrlInspTitle');
    this.ctrlInspDesc = byId('ctrlInspDesc');
    this.ctrlInspStatus = byId('ctrlInspStatus');

    // Lobby shows the live spinning 3D ship instead of some static hero poster

    this.webglStageEl = byId('webglStage');
    this.hpFill = byId('hpFill');
    this.hpValue = byId('hpValue');
    this.enFill = byId('enFill');
    this.enValue = byId('enValue');
    this.heatFill = byId('heatFill');
    this.heatValue = byId('heatValue');
    this.thermalPurgeBtn = byId('thermalPurgeBtn');
    this.chronoRow = byId('chronoRow');
    this.chronoFill = byId('chronoFill');
    this.chronoValue = byId('chronoValue');
    this.chronoHudBtn = byId('chronoHudBtn');
    this.hudRoomPill = byId('hudRoomPill');
    this.hudRoomSubBanner = byId('hudRoomSubBanner');
    this.hudLevelBadge = byId('hudLevelBadge');
    this.xpFill = byId('xpFill');
    this.hudXpText = byId('hudXpText');
    this.warpJumpBanner = byId('warpJumpBanner');
    this.warpJumpKicker = byId('warpJumpKicker');
    this.warpJumpTitle = byId('warpJumpTitle');
    this.warpJumpZone = byId('warpJumpZone');
    this.hudMutationStrip = byId('hudMutationStrip');
    this.raidObjectiveHud = byId('raidObjectiveHud');
    this.raidSectorLabel = byId('raidSectorLabel');
    this.raidObjPips = byId('raidObjPips');
    this.raidObjTitle = byId('raidObjTitle');
    this.raidObjFill = byId('raidObjFill');
    this.raidObjMeta = byId('raidObjMeta');
    this.synergyHudRow = byId('synergyHudRow');
    this.hazardBadge = byId('hazardBadge');
    this.hudWave = byId('hudWave');
    this.hudScore = byId('hudScore');
    this.hudMoney = byId('hudMoney');
    this.owPortraitWrap = byId('owPortraitWrap');
    this.owOnFireTag = byId('owOnFireTag');
    this.owUltArc = document.getElementById('owUltArc') as unknown as SVGCircleElement;
    this.owUltPct = byId('owUltPct');
    this.owDashTile = byId('owDashTile');
    this.owDashCd = byId('owDashCd');
    this.owKillFeed = byId('owKillFeed');
    this.hudMotionRig = byId('hudMotionRig');
    this.bossBarContainer = byId('bossBarContainer');
    this.bossNameLabel = byId('bossNameLabel');
    this.bossMutatorsRow = byId('bossMutatorsRow');
    this.bossPhaseLabel = byId('bossPhaseLabel');
    this.bossHpFill = byId('bossHpFill');
    this.bossHpTrail = byId('bossHpTrail');
    this.restBanner = byId('restBanner');
    this.restTitle = byId('restTitle');
    this.restSub = byId('restSub');
    this.restHangarBtn = byId('restHangarBtn');
    this.shieldBadge = byId('shieldBadge');
    this.shieldStatusText = byId('shieldStatusText');
    this.weaponBadges = byId('weaponBadges');
    this.fpsBadge = byId('fpsBadge');
    this.comboHud = byId('comboHud');
    this.comboRankText = byId('comboRankText');
    this.comboCalloutText = byId('comboCalloutText');
    this.comboBankedText = byId('comboBankedText');
    this.comboHitsText = byId('comboHitsText');
    this.comboTimerFill = byId('comboTimerFill');
    this.comboMultText = byId('comboMultText');
    this.comboProgressDots = byId('comboProgressDots');
    this.comboEndBanner = byId('comboEndBanner');
    this.comboEndRank = byId('comboEndRank');
    this.comboEndDetails = byId('comboEndDetails');
    this.skillWidget = byId('skillWidget');
    this.skillCdText = byId('skillCdText');
    this.skillIconImg = byId('skillIconImg');
    this.skillNameLabel = byId('skillNameLabel');
    this.skillLvlText = byId('skillLvlText');
    this.activeBuffsBar = byId('activeBuffsBar');
    this.stormWarningBanner = byId('stormWarningBanner');
    this.tacticalRadar = byId('tacticalRadar');
    this.radarCtx = this.tacticalRadar.getContext('2d');
    this.radarRadiusLabel = byId('radarRadiusLabel');
    this.offscreenMarkers = byId('offscreenMarkers');
    this.waveBanner = byId('waveBanner');
    this.waveBannerTag = byId('waveBannerTag');
    this.waveBannerGhost = byId('waveBannerGhost');
    this.waveBannerTitle = byId('waveBannerTitle');
    this.waveBannerSub = byId('waveBannerSub');
    this.waveProgressTrack = byId('waveProgressTrack');
    this.waveClearBanner = byId('waveClearBanner');
    this.waveClearKicker = byId('waveClearKicker');
    this.waveClearTitle = byId('waveClearTitle');
    this.waveClearBonus = byId('waveClearBonus');
    this.cinemaBarTop = byId('cinemaBarTop');
    this.cinemaBarBottom = byId('cinemaBarBottom');
    this.bossIntroOverlay = byId('bossIntroOverlay');
    this.bossIntroWarning = byId('bossIntroWarning');
    this.bossIntroSector = byId('bossIntroSector');
    this.bossIntroClass = byId('bossIntroClass');
    this.bossIntroTitle = byId('bossIntroTitle');
    this.bossIntroSubtitle = byId('bossIntroSubtitle');
    this.bossIntroThreat = byId('bossIntroThreat');

    this.hudAimBtn = byId('hudAimBtn');
    this.hudAutoFireBtn = byId('hudAutoFireBtn');
    this.hudMuteBtn = byId('hudMuteBtn');

    this.shopTitle = byId('shopTitle');
    this.shopMoneyVal = byId('shopMoneyVal');
    this.shopSelectionBar = byId('shopSelectionBar');
    this.navViewDraft = byId('navViewDraft');
    this.navDraftBadge = byId('navDraftBadge');
    this.navViewStore = byId('navViewStore');
    this.navViewGarage = byId('navViewGarage');
    this.navGarageCount = byId('navGarageCount');
    this.postBossDraftView = byId('postBossDraftView');
    this.draftStageTitle = byId('draftStageTitle');
    this.draftStepIndicator = byId('draftStepIndicator');
    this.draftCardsGrid = byId('draftCardsGrid');
    this.draftContinueBtn = byId('draftContinueBtn');
    this.bossStoreView = byId('bossStoreView');
    this.storeRouletteContainer = byId('storeRouletteContainer');
    this.storeCoreGrid = byId('storeCoreGrid');
    this.storeGoGarageBtn = byId('storeGoGarageBtn');
    this.shipGarageView = byId('shipGarageView');
    this.garageArmoryPanel = byId('garageArmoryPanel');
    this.garageArmoryList = byId('garageArmoryList');
    this.garageSynergyBar = byId('garageSynergyBar');
    this.shipDropStage = byId('shipDropStage');
    this.garageInspector = byId('garageInspector');
    this.dragGhost = byId('dragGhost');

    this.pauseStats = byId('pauseStats');
    this.pauseSoundBtn = byId('pauseSoundBtn');
    this.pauseAimBtn = byId('pauseAimBtn');
    this.pauseAutoFireBtn = byId('pauseAutoFireBtn');
    this.pauseQualityBtn = byId('pauseQualityBtn');

    this.gameOverShell = byId('gameOverShell');
    this.gameOverKicker = byId('gameOverKicker');
    this.gameOverTitle = byId('gameOverTitle');
    this.finalScoreEl = byId('finalScore');
    this.finalWaveEl = byId('finalWave');
    this.finalComboEl = byId('finalCombo');
    this.finalBossesEl = byId('finalBosses');
    this.finalRoomsEl = byId('finalRooms');
    this.finalShardsEl = byId('finalShards');
    this.rankPreviewEl = byId('rankPreview');
    this.playerNameInput = byId('playerNameInput');
    this.submitScoreBtn = byId('submitScoreBtn');
    this.submitStatusMsg = byId('submitStatusMsg');
    this.gameOverLeaderboardBody = byId('gameOverLeaderboardBody');

    this.leaderboardBody = byId('leaderboardBody');
    this.achievementsSummary = byId('achievementsSummary');
    this.achievementsList = byId('achievementsList');

    this.bindEvents();
    this.initControlDeckSimulator();
    this.applyLanguage();
    this.syncAudioButtons();
    this.syncControlButtons();
    this.renderMenuHulls();

    bus.on('PHASE_CHANGED', ({ to }) => this.onPhaseChanged(to));
    bus.on('BOSS_ENTRY_IMPACT', () => this.triggerBossIntroSlam());
    bus.on('COMBO_KILL', () => this.triggerComboKillPop());
    bus.on('COMBO_RANK_UP', () => this.triggerComboRankBurst());
    bus.on('GAME_STARTED', () => {
      this.clearKillFeed();
      this.hpLagPct = 100;
      this.hpLagHoldSec = 0;
      this.lastHpPct = 100;
      this.lastXpVal = 0;
    });
    bus.on('ENEMY_HIT', (ev) => {
      this.triggerHitmarker(ev.x, ev.y, ev.isCrit ? 'crit' : 'hit');
    });
    bus.on('ENEMY_KILLED', (ev) => {
      this.triggerHitmarker(ev.x, ev.y, 'kill');
      this.triggerFcsKillFlash();
      if (!ev.isMinion && ev.type === 'elite') {
        this.pushKillFeed('ELITE SLAIN', ev.type.toUpperCase(), `+${ev.scoreEarned}`, 'kill');
      }
    });
    bus.on('PLAYER_PARRY', (ev) => {
      this.triggerHitmarker(ev.x, ev.y, 'crit');
    });
    bus.on('LEVEL_UP', () => {
      this.triggerLevelUpBurst();
    });
    bus.on('PLAYER_HIT', ({ shielded }) => {
      if (!shielded) this.triggerHudDamageShake();
    });
    bus.on('WAVE_CLEARED', ({ wave, bonus }) => this.showWaveClearStamp(wave, bonus));
    bus.on('BOSS_DEFEATED', ({ archetype, reward }) => {
      this.showBossDefeatedStamp(reward);
      const bossClasses = ['DESTROYER', 'CARRIER', 'ARCHON', 'LEVIATHAN', 'GEMINI', 'BASTION'];
      const bossClass = bossClasses[archetype] ?? 'DREADNOUGHT';
      this.pushKillFeed('ELIMINATED', bossClass, `+$${reward}`, 'boss');
    });
    bus.on('MODULE_DROPPED', ({ weaponId }) => {
      const entry = WEAPON_CATALOG[weaponId as WeaponId];
      const name = entry ? (this.lang === 'vi' ? entry.nameVi : entry.nameEn) : weaponId;
      this.pushKillFeed('DROP POD', name.toUpperCase(), 'LOOT', 'drop');
    });
    bus.on('SKILL_MODE_CHANGED', () => this.triggerSkillModePop());
    bus.on('SHOP_PURCHASED', () => this.renderShop());
    bus.on('SHOP_REFRESHED', () => this.renderShop());
    bus.on('SHOP_ERROR', () => this.renderShop(true));
    bus.on('GARAGE_MOUNTED', () => this.renderShop());
    bus.on('GARAGE_UNMOUNTED', () => this.renderShop());
    bus.on('GARAGE_UPGRADED', () => this.renderShop());
    bus.on('GARAGE_FUSED', () => this.renderShop());
    bus.on('QUICK_DRAFT_OPENED', () => this.renderQuickDraft(true));
    bus.on('ROOM_DOORS_OPENED', () => this.renderRoomSelect(true));
    bus.on('MUTATION_ACQUIRED', () => {
      this.lastMutationHudKey = '';
    });
    this.setupDragDrop();

    this.activeHeroChoice = this.playBtn;
    this.heroActions.querySelectorAll('.btn').forEach((btn, idx) => {
      btn.setAttribute('data-hover-idx', String(idx));
    });
    requestAnimationFrame(() => this.moveHeroFocusRail(this.playBtn));

    this.achievements.onUnlock((ev) => {
      this.toastQueue.push(ev);
      this.flushToastQueue();
    });

    this.input.bindMobileControls(
      document.getElementById('mobileJoystick'),
      document.getElementById('mobileJoystickKnob'),
      document.getElementById('mobileShootBtn'),
      document.getElementById('mobileDashBtn'),
      document.getElementById('mobileSkillBtn')
    );
    document.getElementById('mobileVentBtn')?.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this.sound.unlock();
      this.input.queueVent();
    });
  }

  private get t(): LanguageStrings {
    return LANGUAGES[this.lang];
  }

  private bindEvents(): void {
    const click = (
      id: string,
      fn: () => void,
      soundMode: 'default' | 'confirm' | 'back' | 'none' = 'default'
    ) => {
      document.getElementById(id)?.addEventListener('click', () => {
        this.sound.unlock();
        if (soundMode === 'confirm') this.sound.playUiConfirm();
        else if (soundMode === 'back') this.sound.playUiBack();
        else if (soundMode === 'default') this.sound.playUiClick();
        fn();
      });
    };

    // One delegated listener for crisp hover ticks and button clicks across panels
    let lastHoveredControl: Element | null = null;
    document.addEventListener('pointerover', (ev) => {
      const target = (ev.target as Element | null)?.closest(
        '.btn, .tac-btn, .hud-mini-btn, .shop-card'
      );
      if (!target || target === lastHoveredControl) return;
      lastHoveredControl = target;
      if ((target as HTMLButtonElement).disabled || target.classList.contains('disabled')) return;

      const idxAttr = target.getAttribute('data-hover-idx');
      this.sound.playUiHover(idxAttr ? Number(idxAttr) : 0);

      if (this.heroActions.contains(target)) {
        this.moveHeroFocusRail(target as HTMLElement);
      }
    });

    // Track cursor for snappy reticle hitmarkers & 3D foil-card tilt/glare
    let tiltedCard: HTMLElement | null = null;
    const resetTiltedCard = (card: HTMLElement | null) => {
      if (!card) return;
      card.style.setProperty('--card-rx', '0deg');
      card.style.setProperty('--card-ry', '0deg');
      card.style.setProperty('--glare-x', '50%');
      card.style.setProperty('--glare-y', '50%');
      card.style.setProperty('--glare-alpha', '0');
    };
    document.addEventListener('pointermove', (ev) => {
      this.lastPointerX = ev.clientX;
      this.lastPointerY = ev.clientY;
      const card = (ev.target as Element | null)?.closest<HTMLElement>(
        '.quick-draft-card, .room-door-card, .ow-game-card:not(.is-picked), .hull-card'
      );
      if (tiltedCard && tiltedCard !== card) {
        resetTiltedCard(tiltedCard);
      }
      tiltedCard = card ?? null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const px = Math.max(-0.5, Math.min(0.5, (ev.clientX - rect.left) / rect.width - 0.5));
      const py = Math.max(-0.5, Math.min(0.5, (ev.clientY - rect.top) / rect.height - 0.5));
      card.style.setProperty('--card-rx', `${(-py * 7).toFixed(2)}deg`);
      card.style.setProperty('--card-ry', `${(px * 8).toFixed(2)}deg`);
      card.style.setProperty('--glare-x', `${((px + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${((py + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-alpha', '1');
    });
    document.addEventListener('pointerout', (ev) => {
      if (!tiltedCard) return;
      const related = ev.relatedTarget as Element | null;
      if (!related || !tiltedCard.contains(related)) {
        resetTiltedCard(tiltedCard);
        tiltedCard = null;
      }
    });

    document.addEventListener('focusin', (ev) => {
      const target = (ev.target as Element | null)?.closest(
        '.btn, .tac-btn, .hud-mini-btn, .shop-card'
      );
      if (!target) return;
      if (this.heroActions.contains(target)) {
        this.sound.playUiHover(1);
        this.moveHeroFocusRail(target as HTMLElement);
      }
    });

    window.addEventListener('resize', () => {
      if (!this.mainMenu.classList.contains('hidden') && this.activeHeroChoice) {
        this.moveHeroFocusRail(this.activeHeroChoice);
      }
    });

    click('langToggleBtn', () => {
      this.lang = this.lang === 'vi' ? 'en' : 'vi';
      try {
        localStorage.setItem(LANG_STORAGE_KEY, this.lang);
      } catch {
        // Private mode or storage blocked? Fine, keep calm and use defaults
      }
      this.applyLanguage();
      if (!this.shopOverlay.classList.contains('hidden')) this.renderShop();
      if (!this.pauseOverlay.classList.contains('hidden')) this.renderPause();
      if (!this.achievementsScreen.classList.contains('hidden')) this.renderAchievements();
    });

    click('muteQuickBtn', () => this.toggleAudio());
    click('hudMuteBtn', () => this.toggleAudio());

    click('playBtn', () => this.sim.startNewGame(metaProgression.getProfile().selectedHull), 'confirm');
    click(
      'playAgainBtn',
      () => this.sim.startNewGame(metaProgression.getProfile().selectedHull),
      'confirm'
    );
    click('openMetaForgeBtn', () => {
      this.mainMenu.classList.add('hidden');
      this.renderMetaForge();
      this.openModal(this.metaForgeScreen);
    });
    click('gameOverForgeBtn', () => {
      this.hideOverlayImmediate(this.gameOverScreen);
      this.renderMetaForge();
      this.openModal(this.metaForgeScreen);
    });
    click(
      'closeMetaForgeBtn',
      () => {
        this.closeModal(this.metaForgeScreen, () => {
          if (this.sim.state.phase === 'GAMEOVER') {
            this.openModal(this.gameOverScreen);
          } else {
            this.mainMenu.classList.remove('hidden');
            this.renderMenuHulls();
            requestAnimationFrame(() =>
              this.moveHeroFocusRail(this.activeHeroChoice ?? this.playBtn)
            );
          }
        });
      },
      'back'
    );
    click('gameOverMenuBtn', () => this.sim.returnToMenu(), 'back');

    click('leaderboardBtn', () => {
      this.mainMenu.classList.add('hidden');
      this.openModal(this.leaderboardScreen);
      void this.loadLeaderboardInto(this.leaderboardBody, false);
    });
    click(
      'closeLeaderboardBtn',
      () => {
        this.closeModal(this.leaderboardScreen, () => {
          this.mainMenu.classList.remove('hidden');
          requestAnimationFrame(() => this.moveHeroFocusRail(this.activeHeroChoice ?? this.playBtn));
        });
      },
      'back'
    );

    click('instructionsBtn', () => {
      this.mainMenu.classList.add('hidden');
      this.resetControlDeckState();
      this.renderControlInspector(this.selectedControlBindId, false);
      this.openModal(this.instructionsScreen);
    });
    click(
      'closeInstructionsBtn',
      () => {
        this.resetControlDeckState();
        this.closeModal(this.instructionsScreen, () => {
          this.mainMenu.classList.remove('hidden');
          requestAnimationFrame(() => this.moveHeroFocusRail(this.activeHeroChoice ?? this.playBtn));
        });
      },
      'back'
    );

    click('infoBtn', () => {
      this.mainMenu.classList.add('hidden');
      this.openModal(this.infoScreen);
    });
    click(
      'closeInfoBtn',
      () => {
        this.closeModal(this.infoScreen, () => {
          this.mainMenu.classList.remove('hidden');
          requestAnimationFrame(() => this.moveHeroFocusRail(this.activeHeroChoice ?? this.playBtn));
        });
      },
      'back'
    );

    click('achievementsBtn', () => {
      this.mainMenu.classList.add('hidden');
      this.openModal(this.achievementsScreen);
      this.renderAchievements();
    });
    click(
      'closeAchievementsBtn',
      () => {
        this.closeModal(this.achievementsScreen, () => {
          this.mainMenu.classList.remove('hidden');
          requestAnimationFrame(() => this.moveHeroFocusRail(this.activeHeroChoice ?? this.playBtn));
        });
      },
      'back'
    );

    click('hudPauseBtn', () => this.sim.togglePause());
    click('hudAimBtn', () => {
      this.input.aimMode = this.input.aimMode === 'auto' ? 'mouse' : 'auto';
      this.syncControlButtons();
    });
    click('hudAutoFireBtn', () => {
      this.input.autoFire = !this.input.autoFire;
      this.syncControlButtons();
    });

    // Pause overlay actions
    click('pauseResumeBtn', () => this.sim.togglePause(), 'confirm');
    click('pauseRestartBtn', () => this.sim.startNewGame(), 'confirm');
    click('pauseMenuBtn', () => this.sim.returnToMenu(), 'back');
    click('pauseSoundBtn', () => {
      this.toggleAudio();
      this.renderPause();
    });
    click('pauseAimBtn', () => {
      this.input.aimMode = this.input.aimMode === 'auto' ? 'mouse' : 'auto';
      this.syncControlButtons();
      this.renderPause();
    });
    click('pauseAutoFireBtn', () => {
      this.input.autoFire = !this.input.autoFire;
      this.syncControlButtons();
      this.renderPause();
    });
    click('pauseQualityBtn', () => {
      const order: GraphicsQuality[] = ['high', 'medium', 'low'];
      const next = order[(order.indexOf(this.scene.getQuality()) + 1) % order.length];
      this.scene.setQuality(next);
      this.renderPause();
    });

    // Quick detour into the Hangar during rest breaks
    click('restHangarBtn', () => {
      if (this.sim.openInventoryIfAllowed()) {
        this.sound.playUiClick(880);
      }
    });
    click('thermalPurgeBtn', () => this.sim.triggerThermalPurge(), 'none');
    click('chronoHudBtn', () => this.sim.triggerChronoOverdrive(), 'none');
    click(
      'quickDraftRerollBtn',
      () => {
        if (this.sim.rerollQuickDraft()) {
          this.sound.playUiClick(920);
        }
      },
      'none'
    );

    // Tab switching between Post-Boss Draft, Store, and 3D Garage
    click('navViewDraft', () => this.setPostWaveView('DRAFT'));
    click('navViewStore', () => this.setPostWaveView('STORE'));
    click('navViewGarage', () => this.setPostWaveView('GARAGE'));
    click('draftContinueBtn', () => this.setPostWaveView('STORE'), 'confirm');
    click('storeGoGarageBtn', () => this.setPostWaveView('GARAGE'), 'confirm');
    click('shopSkipBtn', () => this.sim.closeShop(), 'back');

    // Submit run score straight from simulation state (never trust editable DOM text)
    click('submitScoreBtn', () => void this.handleSubmitScore(), 'confirm');
  }

  private toggleAudio(): void {
    this.sound.toggleMute();
    this.syncAudioButtons();
  }

  private syncAudioButtons(): void {
    const muted = this.sound.isMuted();
    const label = muted ? 'AUD:OFF' : 'AUD:ON';
    this.muteQuickLabel.textContent = label;
    this.muteQuickBtn.classList.toggle('muted', muted);
    this.hudMuteBtn.textContent = label;
  }

  syncControlButtons(): void {
    this.hudAimBtn.textContent = this.input.aimMode === 'auto' ? 'FCS:AUTO' : 'AIM:MOUSE';
    this.hudAimBtn.classList.toggle('active', this.input.aimMode === 'mouse');
    this.hudAutoFireBtn.textContent = this.input.autoFire ? 'FIRE:AUTO' : 'FIRE:HOLD';
    this.hudAutoFireBtn.classList.toggle('active', this.input.autoFire);
  }

  applyLanguage(): void {
    const strings = this.t;
    this.langToggleBtn.textContent = this.lang === 'vi' ? 'LOC:VI' : 'LOC:EN';
    this.lastIntroBossId = -1;
    this.lastRenderedWaveBanner = -1;
    this.lastRaidHudKey = '';
    this.lastQuickDraftKey = '';
    this.lastRoomDoorsKey = '';
    this.lastMutationHudKey = '';
    this.thermalPurgeBtn.textContent = strings.thermalPurgeReady;
    this.chronoHudBtn.textContent = strings.chronoReadyBtn;
    this.quickDraftKicker.textContent = strings.quickDraftKicker;
    this.quickDraftTitle.textContent = strings.quickDraftTitle;
    this.roomSelectKicker.textContent = strings.roomSelectKicker;
    this.roomSelectTitle.textContent = strings.roomSelectTitle;
    this.renderMenuHulls();
    if (!this.metaForgeScreen.classList.contains('hidden')) {
      this.renderMetaForge();
    }

    document.querySelectorAll<HTMLElement>('[data-lang]').forEach((el) => {
      const key = el.dataset.lang as keyof LanguageStrings | undefined;
      if (key && strings[key]) {
        el.textContent = strings[key];
      }
    });

    document.querySelectorAll<HTMLInputElement>('[data-lang-placeholder]').forEach((el) => {
      const key = el.dataset.langPlaceholder as keyof LanguageStrings | undefined;
      if (key && strings[key]) {
        el.placeholder = strings[key];
      }
    });

    this.renderControlInspector(this.selectedControlBindId, this.activeDeckCodes.size > 0);
  }

  private onPhaseChanged(phase: GameState['phase']): void {
    this.mainMenu.classList.toggle('hidden', phase !== 'MENU');
    this.hudLayer.classList.toggle('hidden', phase === 'MENU' || phase === 'GAMEOVER');
    this.globalTopBar.classList.toggle(
      'hidden',
      phase === 'PLAYING' ||
        phase === 'SHOP' ||
        phase === 'PAUSED' ||
        phase === 'QUICK_DRAFT' ||
        phase === 'ROOM_SELECT'
    );

    if (phase === 'QUICK_DRAFT') {
      this.renderQuickDraft(true);
      this.openModal(this.quickDraftScreen);
    } else {
      this.hideOverlayImmediate(this.quickDraftScreen);
    }

    if (phase === 'ROOM_SELECT') {
      this.renderRoomSelect(true);
      this.openModal(this.roomSelectScreen);
    } else {
      this.hideOverlayImmediate(this.roomSelectScreen);
    }

    if (phase === 'SHOP') {
      this.openModal(this.shopOverlay);
    } else {
      this.clearRouletteTimers();
      this.cancelDragSession();
      this.hideOverlayImmediate(this.shopOverlay);
    }

    if (phase !== 'PLAYING') {
      this.cancelDragSession();
      this.hitmarkerReticle.classList.add('hidden');
      this.hitmarkerReticle.classList.remove('is-hit', 'is-crit', 'is-kill');
    }

    if (phase === 'PAUSED') {
      this.openModal(this.pauseOverlay);
    } else {
      this.hideOverlayImmediate(this.pauseOverlay);
    }

    if (phase === 'MENU' || phase === 'GAMEOVER') {
      this.clearKillFeed();
    }

    if (phase === 'GAMEOVER') {
      this.openModal(this.gameOverScreen);
    } else {
      this.hideOverlayImmediate(this.gameOverScreen);
    }

    const showMobile = this.input.isMobile && phase === 'PLAYING';
    this.mobileControls.classList.toggle('hidden', !showMobile);

    if (phase !== 'PLAYING') {
      this.cinemaBarTop.classList.remove('active');
      this.cinemaBarBottom.classList.remove('active');
      this.bossIntroOverlay.classList.remove('active', 'impact-slam');
    }

    if (phase === 'MENU') {
      this.hideOverlayImmediate(this.leaderboardScreen);
      this.hideOverlayImmediate(this.instructionsScreen);
      this.hideOverlayImmediate(this.infoScreen);
      this.hideOverlayImmediate(this.achievementsScreen);
      this.hideOverlayImmediate(this.metaForgeScreen);
      this.renderMenuHulls();
      this.waveClearBanner.classList.add('hidden');
      this.lastIntroBossId = -1;
      this.lastScoreVal = 0;
      this.lastMoneyVal = 0;
      this.lastRenderedWaveBanner = -1;
      this.clearFloatingTexts();
      requestAnimationFrame(() => this.moveHeroFocusRail(this.playBtn));
    } else if (phase === 'SHOP') {
      this.input.clearInputs();
      const loadout = this.sim.state.player.loadout;
      if (loadout.garageMode === 'INVENTORY') {
        this.activePostWaveView = 'GARAGE';
      } else if (
        loadout.pendingAugmentChoices.length > 0 ||
        loadout.pendingHazardChoices.length > 0
      ) {
        this.activePostWaveView = 'DRAFT';
      } else {
        this.activePostWaveView = 'STORE';
      }
      this.renderShop();
    } else if (phase === 'PAUSED') {
      this.input.clearInputs();
      this.renderPause();
    } else if (phase === 'GAMEOVER') {
      this.input.clearInputs();
      this.waveClearBanner.classList.add('hidden');
      this.clearFloatingTexts();
      this.openGameOverScreen();
    }
  }

  private resolveMountTargetSlot(state: GameState, kind: 'primary' | 'skill'): ShipSlotId {
    const sel = state.player.loadout.selectedSlot;
    if (sel !== 'CORE' && SHIP_SLOT_MAP[sel].kind === kind) {
      return sel;
    }
    const empty = SHIP_GRID_SLOTS.find((s) => s.kind === kind && !state.player.loadout.slots[s.id]);
    if (empty) return empty.id;
    return SHIP_GRID_SLOTS.find((s) => s.kind === kind)!.id;
  }

  private getWeaponTotalUpgradeLevel(weapon: MountedWeapon | null): number {
    if (!weapon) return 0;
    return Object.values(weapon.upgrades).reduce((sum, v) => sum + (v ?? 0), 0);
  }

  private createItemImg(iconUrl: string, className = 'item-icon-img'): HTMLImageElement {
    const img = document.createElement('img');
    img.src = iconUrl;
    img.alt = '';
    img.className = className;
    img.draggable = false;
    return img;
  }

  private clearRouletteTimers(): void {
    for (const id of this.rouletteTimers) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    this.rouletteTimers = [];
    this.rouletteSpinning = false;
    this.rouletteRevealed = [true, true, true];
    this.rouletteJustLanded = [false, false, false];
  }

  private setPostWaveView(view: 'DRAFT' | 'STORE' | 'GARAGE'): void {
    const loadout = this.sim.state.player.loadout;
    if (loadout.garageMode !== 'SHOP' && view !== 'GARAGE') {
      this.activePostWaveView = 'GARAGE';
    } else {
      this.activePostWaveView = view;
      if (loadout.garageMode === 'SHOP') {
        this.sim.setGarageArmoryTab(view === 'STORE' ? 'ROULETTE' : 'INVENTORY');
      }
    }
    this.cancelDragSession();
    this.renderShop();
  }

  renderShop(showFundsError = false): void {
    const state = this.sim.state;
    const strings = this.t;
    const loadout = state.player.loadout;
    const isShopMode = loadout.garageMode === 'SHOP';

    if (!isShopMode) {
      this.activePostWaveView = 'GARAGE';
      if (loadout.activeArmoryTab !== 'INVENTORY') {
        loadout.activeArmoryTab = 'INVENTORY';
      }
    }

    const pendingCount =
      loadout.pendingAugmentChoices.length + loadout.pendingHazardChoices.length;
    this.navViewDraft.classList.toggle('hidden', !isShopMode);
    this.navViewStore.classList.toggle('hidden', !isShopMode);
    this.navViewDraft.classList.toggle('active', this.activePostWaveView === 'DRAFT');
    this.navViewStore.classList.toggle('active', this.activePostWaveView === 'STORE');
    this.navViewGarage.classList.toggle('active', this.activePostWaveView === 'GARAGE');
    this.navDraftBadge.classList.toggle('hidden', pendingCount === 0);
    this.navGarageCount.textContent = String(loadout.inventory.length);

    this.postBossDraftView.classList.toggle('hidden', this.activePostWaveView !== 'DRAFT');
    this.bossStoreView.classList.toggle('hidden', this.activePostWaveView !== 'STORE');
    this.shipGarageView.classList.toggle('hidden', this.activePostWaveView !== 'GARAGE');

    if (this.activePostWaveView === 'DRAFT') {
      this.shopTitle.textContent =
        this.lang === 'vi' ? 'NÂNG CẤP & TUYẾN ĐƯỜNG' : 'AUGMENT & SECTOR DRAFT';
      const draftBtnText =
        pendingCount > 0
          ? this.lang === 'vi'
            ? 'BỎ QUA - CỬA HÀNG'
            : 'SKIP TO STORE'
          : this.lang === 'vi'
            ? 'ĐẾN CỬA HÀNG'
            : 'TO STORE';
      setIconText(this.draftContinueBtn, 'arrowRight', draftBtnText, true, 'ui-svg-icon ui-arrow-inline');
    } else if (this.activePostWaveView === 'STORE') {
      this.shopTitle.textContent = strings.bossShopTitle;
      const goGarageText =
        this.lang === 'vi'
          ? `LẮP ĐỒ VÀO TÀU (${loadout.inventory.length})`
          : `EQUIP MODULES (${loadout.inventory.length})`;
      setIconText(this.storeGoGarageBtn, 'arrowRight', goGarageText, true, 'ui-svg-icon ui-arrow-inline');
    } else {
      this.shopTitle.textContent = strings.inventoryTitle;
    }

    this.shopMoneyVal.textContent = `${state.money}`;

    if (showFundsError) {
      this.shopSelectionBar.textContent = strings.insufficientFunds;
      this.shopSelectionBar.className = 'shop-selection-bar err shake-err';
    } else {
      const armedPrim = countMountedPrimaryWeapons(state);
      const hasSkill = loadout.slots.skill_1 !== null ? 1 : 0;
      const heatRate = computePlayerCoolingRate(state);
      this.shopSelectionBar.textContent =
        this.lang === 'vi'
          ? `SÚNG ${armedPrim}/5 · SKILL ${hasSkill}/1 · TẢN NHIỆT ${heatRate.toFixed(0)}/s`
          : `GUNS ${armedPrim}/5 · SKILL ${hasSkill}/1 · COOL ${heatRate.toFixed(0)}/s`;
      this.shopSelectionBar.className = 'shop-selection-bar ok';
    }

    if (this.activePostWaveView === 'DRAFT') {
      this.renderDraftView(state);
      return;
    }

    if (this.activePostWaveView === 'STORE') {
      this.renderStoreView(state);
      return;
    }

    this.renderGarageSynergyBar(state);
    this.garageArmoryList.textContent = '';
    this.renderInventoryTab(state);
    this.renderShipDropStage(state);
    this.renderGarageInspector(state);
    requestAnimationFrame(() => this.syncShipSocketCoordinates(this.sim.state));
  }

  private renderDraftView(state: GameState): void {
    const loadout = state.player.loadout;
    const augChoices: AugmentId[] = loadout.pendingAugmentChoices;
    const hazChoices: SectorHazardId[] = loadout.pendingHazardChoices;

    this.draftCardsGrid.textContent = '';

    if (augChoices.length > 0) {
      const totalSteps = hazChoices.length > 0 ? 2 : 1;
      this.draftStepIndicator.textContent =
        this.lang === 'vi' ? `BƯỚC 1 / ${totalSteps}` : `STEP 1 / ${totalSteps}`;
      this.draftStageTitle.textContent =
        this.lang === 'vi' ? 'CHỌN 1 LÕI CÔNG NGHỆ' : 'CHOOSE A SYSTEM AUGMENT';
      this.draftCardsGrid.className = 'ow-draft-cards';

      for (const id of augChoices) {
        const def = AUGMENT_CATALOG[id];
        const card = this.buildDraftGameCard(
          def.accent,
          def.iconUrl,
          this.lang === 'vi' ? def.nameVi : def.nameEn,
          this.lang === 'vi' ? def.statBadgesVi : def.statBadgesEn,
          this.lang === 'vi' ? def.shortDescVi : def.shortDescEn,
          this.lang === 'vi' ? 'CHỌN' : 'SELECT'
        );
        card.addEventListener('click', () => {
          this.sound.playUiConfirm();
          this.sim.chooseAugment(id);
          const l = this.sim.state.player.loadout;
          if (l.pendingAugmentChoices.length === 0 && l.pendingHazardChoices.length === 0) {
            this.setPostWaveView('STORE');
          } else {
            this.renderShop();
          }
        });
        this.draftCardsGrid.appendChild(card);
      }
      return;
    }

    if (hazChoices.length > 0) {
      this.draftStepIndicator.textContent =
        this.lang === 'vi' ? 'BƯỚC 2 / 2' : 'STEP 2 / 2';
      this.draftStageTitle.textContent =
        this.lang === 'vi' ? 'CHỌN TUYẾN ĐƯỜNG KẾ TIẾP' : 'CHOOSE NEXT SECTOR';
      this.draftCardsGrid.className = 'ow-draft-cards is-two-col';

      for (const hid of hazChoices) {
        const def = SECTOR_HAZARDS[hid];
        const card = this.buildDraftGameCard(
          def.accent,
          def.iconUrl,
          this.lang === 'vi' ? def.nameVi : def.nameEn,
          this.lang === 'vi' ? def.statBadgesVi : def.statBadgesEn,
          this.lang === 'vi' ? def.descVi : def.descEn,
          this.lang === 'vi' ? 'TIẾN VÀO' : 'DEPLOY',
          false,
          def.bannerUrl
        );
        card.addEventListener('click', () => {
          this.sound.playUiClick(840);
          this.sim.chooseSectorHazard(hid);
          this.setPostWaveView('STORE');
        });
        this.draftCardsGrid.appendChild(card);
      }
      return;
    }

    // Already claimed both? Just display static receipts so nobody double-dips
    this.draftStepIndicator.textContent = this.lang === 'vi' ? 'ĐÃ HOÀN TẤT' : 'DRAFT COMPLETE';
    this.draftStageTitle.textContent =
      this.lang === 'vi' ? 'CẤU HÌNH ĐÃ CHỌN' : 'ACTIVE SELECTIONS';
    this.draftCardsGrid.className = 'ow-draft-cards is-two-col';

    if (loadout.activeAugments.length > 0) {
      const lastAug = AUGMENT_CATALOG[loadout.activeAugments[loadout.activeAugments.length - 1]];
      const card = this.buildDraftGameCard(
        lastAug.accent,
        lastAug.iconUrl,
        this.lang === 'vi' ? lastAug.nameVi : lastAug.nameEn,
        this.lang === 'vi' ? lastAug.statBadgesVi : lastAug.statBadgesEn,
        this.lang === 'vi' ? lastAug.shortDescVi : lastAug.shortDescEn,
        this.lang === 'vi' ? 'ĐÃ BẬT' : 'ACTIVE',
        true
      );
      this.draftCardsGrid.appendChild(card);
    }

    const curSector = SECTOR_HAZARDS[state.sectorHazard];
    const secCard = this.buildDraftGameCard(
      curSector.accent,
      curSector.iconUrl,
      this.lang === 'vi' ? curSector.nameVi : curSector.nameEn,
      this.lang === 'vi' ? curSector.statBadgesVi : curSector.statBadgesEn,
      this.lang === 'vi' ? curSector.descVi : curSector.descEn,
      this.lang === 'vi' ? 'ĐÃ CHỌN' : 'LOCKED',
      true,
      curSector.bannerUrl
    );
    this.draftCardsGrid.appendChild(secCard);
  }

  private buildDraftGameCard(
    accent: string,
    iconUrl: string,
    titleText: string,
    badges: ReadonlyArray<{ text: string; tone: 'pos' | 'neg' | 'info' }>,
    subText: string,
    ctaText: string,
    isPicked = false,
    bannerUrl?: string
  ): HTMLElement {
    const card = document.createElement(isPicked ? 'div' : 'button');
    if (card instanceof HTMLButtonElement) card.type = 'button';
    card.className = isPicked ? 'ow-game-card is-picked' : 'ow-game-card';
    card.style.setProperty('--card-accent', accent);

    const title = document.createElement('div');
    title.className = 'ow-card-title';
    title.textContent = titleText;

    const chips = document.createElement('div');
    chips.className = 'ow-card-chips';
    for (const b of badges) {
      const chip = document.createElement('span');
      chip.className = `ow-stat-chip ${b.tone}`;
      chip.textContent = b.text;
      chips.appendChild(chip);
    }

    const sub = document.createElement('div');
    sub.className = 'ow-card-sub';
    sub.textContent = subText;

    const cta = document.createElement('div');
    cta.className = 'ow-card-select-pill';
    if (isPicked) {
      setIconText(cta, 'check', ctaText);
    } else {
      cta.textContent = ctaText;
    }

    if (bannerUrl) {
      card.classList.add('is-sector-banner');
      const bannerWrap = document.createElement('div');
      bannerWrap.className = 'ow-card-banner';

      const bannerImg = document.createElement('img');
      bannerImg.className = 'ow-card-banner-img';
      bannerImg.src = bannerUrl;
      bannerImg.alt = titleText;
      bannerImg.loading = 'eager';
      bannerImg.decoding = 'async';

      const fade = document.createElement('div');
      fade.className = 'ow-card-banner-fade';
      fade.setAttribute('aria-hidden', 'true');

      bannerWrap.append(bannerImg, fade);

      const bodyWrap = document.createElement('div');
      bodyWrap.className = 'ow-card-body';
      bodyWrap.append(title, chips, sub, cta);

      card.append(bannerWrap, bodyWrap);
      return card;
    }

    const orb = document.createElement('div');
    orb.className = 'ow-card-orb';
    orb.appendChild(this.createItemImg(iconUrl, 'ow-card-orb-img'));

    card.append(orb, title, chips, sub, cta);
    return card;
  }

  private renderStoreView(state: GameState): void {
    this.storeRouletteContainer.textContent = '';
    this.renderBossRouletteTab(state, this.storeRouletteContainer);

    this.storeCoreGrid.textContent = '';
    for (const id of CORE_SHOP_ITEM_IDS) {
      const def = SHOP_ITEMS[id];
      const price = getShopItemPrice(state, id);
      const lvl = state.shop.levels[id] ?? 0;
      const maxed = isShopItemMaxed(state, id);
      const affordable = state.money >= price;

      const tile = document.createElement('div');
      tile.className = 'ow-core-tile';
      tile.style.setProperty('--card-accent', def.accent);

      const iconBox = document.createElement('div');
      iconBox.className = 'ow-core-icon-box';
      iconBox.appendChild(this.createItemImg(def.iconUrl, 'ow-core-icon-img'));

      const info = document.createElement('div');
      info.className = 'ow-core-info';

      const name = document.createElement('div');
      name.className = 'ow-core-name';
      name.textContent = this.lang === 'vi' ? def.nameVi : def.nameEn;

      const bonus = document.createElement('div');
      bonus.className = 'ow-core-bonus';
      bonus.textContent = this.lang === 'vi' ? def.shortBonusVi : def.shortBonusEn;

      const lvlRow = document.createElement('div');
      lvlRow.className = 'ow-core-lvl-row';
      const pips = document.createElement('div');
      pips.className = 'upgrade-pips';
      const pipCap = def.maxLevel === -1 ? Math.min(8, lvl + 1) : def.maxLevel;
      for (let i = 0; i < pipCap; i++) {
        const pip = document.createElement('span');
        pip.className = i < lvl ? 'upgrade-pip filled' : 'upgrade-pip';
        pips.appendChild(pip);
      }
      const lvlTxt = document.createElement('span');
      lvlTxt.className = 'ow-core-lvl-txt';
      lvlTxt.textContent = def.maxLevel === -1 ? `LV ${lvl}` : `${lvl}/${def.maxLevel}`;
      lvlRow.append(pips, lvlTxt);

      info.append(name, bonus, lvlRow);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ow-core-buy-btn';
      btn.textContent = maxed ? 'MAX' : `$${price}`;
      btn.disabled = maxed || !affordable;
      btn.addEventListener('click', () => {
        this.sim.buyCoreItem(id);
        this.renderShop();
      });

      tile.append(iconBox, info, btn);
      this.storeCoreGrid.appendChild(tile);
    }
  }

  private renderGarageSynergyBar(state: GameState): void {
    const synergies = computeActiveSynergies(state.player);
    this.garageSynergyBar.textContent = '';
    const order: ManufacturerId[] = ['NOVACORP', 'IRONFORGE', 'AETHER', 'VOIDTECH'];
    for (const mfr of order) {
      const count = synergies.counts[mfr] ?? 0;
      if (count === 0) continue;
      const def = MANUFACTURER_SYNERGIES[mfr];
      const chip = document.createElement('div');
      chip.className = `synergy-chip ${count >= 2 ? 'active' : ''}`;
      const bonusTxt =
        count >= 3
          ? this.lang === 'vi'
            ? def.bonus3Vi
            : def.bonus3En
          : count >= 2
            ? this.lang === 'vi'
              ? def.bonus2Vi
              : def.bonus2En
            : `${count}/2`;
      chip.textContent = `${this.lang === 'vi' ? def.nameVi : def.nameEn} (${count}) · ${bonusTxt}`;
      this.garageSynergyBar.appendChild(chip);
    }
  }

  private getRouletteReelPoolIcons(idx: number): string[] {
    if (idx === 0) {
      return PRIMARY_WEAPON_IDS.map((id) => WEAPON_CATALOG[id].iconUrl);
    }
    if (idx === 1) {
      return SKILL_WEAPON_IDS.map((id) => WEAPON_CATALOG[id].iconUrl);
    }
    return CORE_SHOP_ITEM_IDS.map((id) => SHOP_ITEMS[id].iconUrl);
  }

  private getRouletteStatSummary(offer: RouletteOffer): string {
    const isCoreOffer = offer.kind === 'core' && Boolean(offer.coreItemId);
    if (isCoreOffer && offer.coreItemId) {
      const coreDef = SHOP_ITEMS[offer.coreItemId];
      return this.lang === 'vi' ? coreDef.shortBonusVi : coreDef.shortBonusEn;
    }
    if (!offer.weaponId) return '';
    const entry = WEAPON_CATALOG[offer.weaponId];
    const starTier = offer.rarity === 'epic' ? 2 : 1;
    if (entry.kind === 'primary') {
      if (entry.id === 'thermal_sink') {
        const bonus = Math.round((entry.coolingBonus ?? 26) * (starTier === 2 ? 1.4 : 1));
        const redPct = Math.round(((entry.heatReductionPct ?? 0.22) + (starTier - 1) * 0.08) * 100);
        return this.lang === 'vi'
          ? `TẢN +${bonus}/s · -${redPct}% NHIỆT`
          : `COOL +${bonus}/s · -${redPct}% HEAT`;
      }
      const dmg = Math.round(entry.baseStats.damage * (starTier === 2 ? 1.45 : 1));
      const parts = [`DMG ${dmg}`];
      if (entry.baseStats.projectiles > 1) parts.push(`×${entry.baseStats.projectiles}`);
      if (entry.baseStats.pierce > 0) parts.push(this.lang === 'vi' ? `XUYÊN ${entry.baseStats.pierce}` : `PIERCE ${entry.baseStats.pierce}`);
      parts.push(this.lang === 'vi' ? `NHIỆT ${entry.heatPerShot}` : `HEAT ${entry.heatPerShot}`);
      return parts.join(' · ');
    }
    const dmg = Math.round(entry.baseStats.damage * (starTier === 2 ? 1.4 : 1));
    const cdSec = ((entry.baseStats.cooldownMs * (starTier === 2 ? 0.9 : 1)) / 1000).toFixed(1);
    return `DMG ${dmg} · ${cdSec}s`;
  }

  private populateRouletteReelElement(
    reel: HTMLElement,
    offer: RouletteOffer,
    idx: number,
    revealed: boolean,
    justLanded: boolean,
    state: GameState,
    lockedCount: number
  ): void {
    const strings = this.t;
    const isCoreOffer = offer.kind === 'core' && Boolean(offer.coreItemId);
    const weaponEntry = offer.weaponId ? WEAPON_CATALOG[offer.weaponId] : null;
    const coreDef = isCoreOffer ? SHOP_ITEMS[offer.coreItemId!] : null;

    const iconUrl = weaponEntry?.iconUrl ?? coreDef?.iconUrl ?? './assets/icons/core_health.png';
    const displayName = weaponEntry
      ? this.lang === 'vi'
        ? weaponEntry.nameVi
        : weaponEntry.nameEn
      : coreDef
        ? this.lang === 'vi'
          ? coreDef.nameVi
          : coreDef.nameEn
        : 'MODULE';
    const starTier = offer.rarity === 'epic' ? 2 : 1;
    const discVal =
      offer.originalPrice > 0
        ? Math.round((1 - offer.price / offer.originalPrice) * 100)
        : 0;
    const discountPct = discVal > 0 ? `-${discVal}%` : '-5%';
    const isLocked = Boolean(offer.locked && !offer.claimed);

    reel.textContent = '';
    reel.dataset.reelIdx = String(idx);
    reel.className = `roulette-reel rarity-${revealed ? offer.rarity : 'common'}`;
    if (!revealed) reel.classList.add('spinning');
    if (isLocked) reel.classList.add('is-locked');
    if (offer.claimed) reel.classList.add('claimed');
    if (justLanded) reel.classList.add('just-landed');

    // Card top bar: rarity tag, discount, and pin toggle
    const topBar = document.createElement('div');
    topBar.className = 'roulette-reel-top';

    const rarityTag = document.createElement('span');
    rarityTag.className = 'roulette-rarity-tag';
    if (!revealed) {
      rarityTag.textContent = '...';
    } else {
      const rarLabel =
        offer.rarity === 'epic'
          ? strings.rarityEpic
          : offer.rarity === 'rare'
            ? strings.rarityRare
            : strings.rarityCommon;
      rarityTag.classList.add('ui-inline-flex');
      rarityTag.append(document.createTextNode(`${rarLabel} `));
      if (isCoreOffer) {
        rarityTag.append(document.createTextNode('CORE'));
      } else {
        rarityTag.append(createTierStarsEl(starTier, `tier-${starTier}`));
      }
      rarityTag.append(document.createTextNode(` · ${discountPct}`));
    }

    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = `roulette-lock-btn${isLocked ? ' is-locked' : ''}`;
    setIconText(lockBtn, isLocked ? 'lock' : 'unlock', isLocked ? strings.rouletteLocked : strings.rouletteLock);
    lockBtn.disabled = offer.claimed || this.rouletteSpinning || (!isLocked && lockedCount >= 2);
    lockBtn.addEventListener('click', () => {
      const res = this.sim.toggleRouletteLock(offer.offerId);
      if (!res.ok) return;
      this.sound.playUiClick(res.locked ? 860 : 640);
      this.renderShop();
    });
    topBar.append(rarityTag, lockBtn);

    // Rolling vertical showcase reel in the middle
    const viewport = document.createElement('div');
    viewport.className = 'roulette-reel-viewport';

    const payline = document.createElement('div');
    payline.className = 'roulette-payline';
    payline.setAttribute('aria-hidden', 'true');
    viewport.appendChild(payline);

    if (!revealed) {
      const strip = document.createElement('div');
      strip.className = 'roulette-strip';
      strip.style.setProperty('--strip-dur', `${0.38 + idx * 0.05}s`);
      const pool = this.getRouletteReelPoolIcons(idx);
      const tilesCount = 10;
      const allIcons: string[] = [];
      for (let i = 0; i < tilesCount; i++) {
        allIcons.push(pool[(i + idx) % pool.length]);
      }
      // Clone sequence once at the end for an endless loop illusion
      for (const src of [...allIcons, ...allIcons]) {
        const cell = document.createElement('div');
        cell.className = 'roulette-strip-item';
        cell.appendChild(this.createItemImg(src, 'roulette-strip-img'));
        strip.appendChild(cell);
      }
      viewport.appendChild(strip);
    } else {
      const iconStage = document.createElement('div');
      iconStage.className = 'roulette-icon-stage';
      iconStage.appendChild(this.createItemImg(iconUrl, 'roulette-item-img'));

      const name = document.createElement('div');
      name.className = 'roulette-item-name';
      name.textContent = displayName;

      const metaRow = document.createElement('div');
      metaRow.className = 'roulette-badges-row';
      const mfr = document.createElement('span');
      if (weaponEntry) {
        mfr.className = `mfr-pill mfr-${weaponEntry.manufacturer}`;
        mfr.textContent = weaponEntry.manufacturer;
      } else {
        mfr.className = 'mfr-pill mfr-NOVACORP';
        mfr.textContent = 'CORE';
      }
      const statChip = document.createElement('span');
      statChip.className = 'roulette-stat-chip';
      statChip.textContent = this.getRouletteStatSummary(offer);
      metaRow.append(mfr, statChip);

      viewport.append(iconStage, name, metaRow);
    }

    // Claim button with crossed-out retail price -> markdown
    const claimBtn = document.createElement('button');
    claimBtn.type = 'button';
    claimBtn.className = 'roulette-claim-btn';
    const affordable = state.money >= offer.price;
    claimBtn.disabled = offer.claimed || !revealed || !affordable;
    if (offer.claimed) {
      claimBtn.textContent = strings.claimed;
    } else if (!revealed) {
      claimBtn.textContent = '···';
    } else {
      if (offer.originalPrice > offer.price) {
        const oldPrice = document.createElement('span');
        oldPrice.className = 'roulette-old-price';
        oldPrice.textContent = `$${offer.originalPrice}`;
        claimBtn.appendChild(oldPrice);
      }
      const salePrice = document.createElement('span');
      salePrice.className = 'roulette-sale-price';
      salePrice.textContent = `$${offer.price}`;
      const word = document.createElement('span');
      word.className = 'roulette-claim-word';
      word.textContent = strings.rouletteClaimShort;
      claimBtn.append(salePrice, word);
    }
    claimBtn.addEventListener('click', () => {
      const res = this.sim.claimRouletteOffer(offer.offerId);
      if (!res.ok) {
        this.renderShop(res.reason === 'funds');
        return;
      }
      this.sound.playUiConfirm();
      this.renderShop();
    });

    reel.append(topBar, viewport, claimBtn);
  }

  private renderBossRouletteTab(state: GameState, targetContainer: HTMLElement): void {
    const strings = this.t;
    const roulette = state.player.loadout.roulette;
    const spinCost = getRouletteSpinCost(state);
    const isFree = spinCost === 0;
    const pityCount = Math.min(ROULETTE_PITY_THRESHOLD, roulette.pityCount ?? 0);
    const pityReady = pityCount >= ROULETTE_PITY_THRESHOLD;
    const epicOddsPct = Math.round(getRouletteEpicChance(state) * 100);
    const lockedCount = roulette.offers.filter((o) => o.locked && !o.claimed).length;

    const stage = document.createElement('div');
    stage.className = 'roulette-stage';

    // Bad-luck pity gauge & drop odds banner on top
    const pityBar = document.createElement('div');
    pityBar.className = `roulette-pity-bar${pityReady ? ' is-ready' : ''}`;

    const pityLabel = document.createElement('span');
    pityLabel.className = 'roulette-pity-label';
    if (pityReady) {
      setIconText(pityLabel, 'spark', strings.roulettePityReady);
    } else {
      pityLabel.textContent = strings.roulettePityLabel;
    }

    const pityPips = document.createElement('div');
    pityPips.className = 'roulette-pity-pips';
    for (let i = 0; i < ROULETTE_PITY_THRESHOLD; i++) {
      const pip = document.createElement('span');
      pip.className = `roulette-pity-pip${i < pityCount ? ' filled' : ''}`;
      pityPips.appendChild(pip);
    }
    const starPip = document.createElement('span');
    starPip.className = `roulette-pity-star${pityReady ? ' ready' : ''}`;
    starPip.append(
      createUiIcon('star', 'ui-svg-icon ui-star-icon'),
      createUiIcon('star', 'ui-svg-icon ui-star-icon')
    );
    pityPips.appendChild(starPip);

    const oddsBadge = document.createElement('span');
    oddsBadge.className = 'roulette-odds-badge';
    oddsBadge.textContent = `EPIC ${epicOddsPct}%`;
    pityBar.append(pityLabel, pityPips, oddsBadge);

    // Centerpiece: three spinning gacha reels
    const reels = document.createElement('div');
    reels.className = 'roulette-reels';

    if (roulette.offers.length === 0) {
      const placeholders: Array<[string, string, string]> = [
        ['./assets/icons/rail_sniper.png', 'PRIMARY', '?'],
        ['./assets/icons/skill_salvo.png', 'SKILL', '?'],
        ['./assets/icons/core_health.png', 'CORE', '?'],
      ];
      for (const [iconPath, slotTitle, q] of placeholders) {
        const reel = document.createElement('div');
        reel.className = 'roulette-reel rarity-common standby';
        const topBar = document.createElement('div');
        topBar.className = 'roulette-reel-top';
        const tag = document.createElement('span');
        tag.className = 'roulette-rarity-tag';
        tag.textContent = slotTitle;
        topBar.appendChild(tag);

        const viewport = document.createElement('div');
        viewport.className = 'roulette-reel-viewport';
        const iconStage = document.createElement('div');
        iconStage.className = 'roulette-icon-stage';
        iconStage.appendChild(this.createItemImg(iconPath, 'roulette-item-img standby-icon'));
        const name = document.createElement('div');
        name.className = 'roulette-item-name';
        name.textContent = q;
        viewport.append(iconStage, name);

        const foot = document.createElement('div');
        foot.className = 'roulette-standby-pill';
        foot.textContent = 'READY';

        reel.append(topBar, viewport, foot);
        reels.appendChild(reel);
      }
    } else {
      roulette.offers.forEach((offer: RouletteOffer, idx: number) => {
        const reel = document.createElement('div');
        const revealed = this.rouletteRevealed[idx] ?? true;
        const justLanded = this.rouletteJustLanded[idx] ?? false;
        this.populateRouletteReelElement(reel, offer, idx, revealed, justLanded, state, lockedCount);
        reels.appendChild(reel);
      });
    }

    // Bottom deck housing the big shiny Spin button
    const footer = document.createElement('div');
    footer.className = 'roulette-footer';

    const spinBtn = document.createElement('button');
    spinBtn.id = 'rouletteSpinBtn';
    spinBtn.type = 'button';
    spinBtn.className = `roulette-spin-btn${isFree ? ' is-free' : ''}`;
    spinBtn.disabled = this.rouletteSpinning || (!isFree && state.money < spinCost);
    const spinText = isFree
      ? strings.btnSpinFree
      : `${strings.btnSpinPaid} · $${spinCost}${lockedCount > 0 ? ` (${strings.rouletteLockFeeHint}×${lockedCount})` : ''}`;
    spinBtn.textContent = spinText;
    spinBtn.addEventListener('click', () => this.triggerRouletteSpinAnimation());
    footer.appendChild(spinBtn);

    stage.append(pityBar, reels, footer);
    targetContainer.appendChild(stage);
  }

  private triggerRouletteSpinAnimation(): void {
    if (this.rouletteSpinning) return;
    const prevOffers = this.sim.state.player.loadout.roulette.offers;
    const wasLocked: [boolean, boolean, boolean] = [
      Boolean(prevOffers[0]?.locked && !prevOffers[0]?.claimed),
      Boolean(prevOffers[1]?.locked && !prevOffers[1]?.claimed),
      Boolean(prevOffers[2]?.locked && !prevOffers[2]?.claimed),
    ];

    const res = this.sim.spinRoulette();
    if (!res.ok) {
      this.renderShop(res.reason === 'funds');
      return;
    }

    this.clearRouletteTimers();
    const unlockedIndices = [0, 1, 2].filter((idx) => !wasLocked[idx]);
    this.rouletteSpinning = unlockedIndices.length > 0;
    this.rouletteRevealed = [wasLocked[0], wasLocked[1], wasLocked[2]];
    this.rouletteJustLanded = [false, false, false];
    this.renderShop();

    let ticks = 0;
    const tickTimer = window.setInterval(() => {
      ticks++;
      this.sound.playRouletteTick(0.65 + (ticks % 5) * 0.22);
    }, 85);
    this.rouletteTimers.push(tickTimer);

    unlockedIndices.forEach((reelIdx, orderIdx) => {
      const delay = 460 + orderIdx * 360;
      const t = window.setTimeout(() => {
        this.rouletteRevealed[reelIdx] = true;
        this.rouletteJustLanded[reelIdx] = true;
        const roulette = this.sim.state.player.loadout.roulette;
        const offer = roulette.offers[reelIdx];
        if (offer) this.sound.playRouletteReveal(offer.rarity);

        const isLast = orderIdx === unlockedIndices.length - 1;
        if (isLast) {
          window.clearInterval(tickTimer);
          this.rouletteSpinning = false;
        }

        if (this.sim.state.phase === 'SHOP') {
          if (isLast) {
            this.renderShop();
          } else if (offer) {
            const reelEl = this.storeRouletteContainer.querySelector<HTMLElement>(
              `[data-reel-idx="${reelIdx}"]`
            );
            if (reelEl) {
              const lockedCount = roulette.offers.filter((o) => o.locked && !o.claimed).length;
              this.populateRouletteReelElement(reelEl, offer, reelIdx, true, true, this.sim.state, lockedCount);
            }
          }
          const settleTimer = window.setTimeout(() => {
            this.rouletteJustLanded[reelIdx] = false;
            const settledEl = this.storeRouletteContainer.querySelector<HTMLElement>(
              `[data-reel-idx="${reelIdx}"]`
            );
            settledEl?.classList.remove('just-landed');
          }, 420);
          this.rouletteTimers.push(settleTimer);
        }
      }, delay);
      this.rouletteTimers.push(t);
    });
  }

  private renderInventoryTab(state: GameState): void {
    const strings = this.t;
    const inv = state.player.loadout.inventory;
    const fusable = findFusableWeaponGroups(state);

    if (fusable.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'fusion-banner';
      for (const grp of fusable) {
        const entry = WEAPON_CATALOG[grp.weaponId];
        const row = document.createElement('div');
        row.className = 'fusion-row';
        const label = document.createElement('div');
        label.className = 'armory-card-title';
        label.append(
          this.createItemImg(entry.iconUrl, 'item-icon-sm'),
          document.createTextNode(`${this.lang === 'vi' ? entry.nameVi : entry.nameEn} `),
          createTierStarsEl(grp.tier, `tier-${grp.tier}`),
          createUiIcon('arrowRight', 'ui-svg-icon ui-arrow-inline'),
          createTierStarsEl(grp.tier + 1, `tier-${grp.tier + 1}`)
        );
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fusion-btn';
        btn.textContent = strings.btnFuse;
        btn.addEventListener('click', () => {
          this.sim.fuseWeapons(grp.weaponId, grp.tier);
          this.renderShop();
        });
        row.append(label, btn);
        banner.appendChild(row);
      }
      this.garageArmoryList.appendChild(banner);
    }

    if (inv.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'armory-card-desc';
      empty.textContent = strings.slotEmptyHint;
      this.garageArmoryList.appendChild(empty);
      return;
    }

    inv.forEach((item, idx) => {
      const entry = WEAPON_CATALOG[item.weaponId];
      const card = document.createElement('div');
      card.className = 'armory-card ow-inv-card';
      card.dataset.dragType = 'inventory';
      card.dataset.instanceId = item.instanceId;
      card.dataset.weaponId = item.weaponId;
      card.style.setProperty('--card-accent', entry.accent);
      card.style.setProperty('--card-i', String(idx));

      const head = document.createElement('div');
      head.className = 'armory-card-head';
      const title = document.createElement('div');
      title.className = 'armory-card-title';
      title.append(
        this.createItemImg(entry.iconUrl, 'item-icon-img'),
        document.createTextNode(this.lang === 'vi' ? entry.nameVi : entry.nameEn)
      );
      const stars = document.createElement('span');
      stars.className = `tier-stars tier-${item.tier}`;
      stars.appendChild(createTierStarsEl(item.tier, `tier-${item.tier}`));
      head.append(title, stars);

      const statsRow = document.createElement('div');
      statsRow.className = 'armory-card-stats';
      const mfrPill = document.createElement('span');
      mfrPill.className = `mfr-pill mfr-${entry.manufacturer}`;
      mfrPill.textContent = entry.manufacturer;
      statsRow.appendChild(mfrPill);

      const statChip = document.createElement('span');
      statChip.className = 'armory-stat-chip';
      if (entry.kind === 'primary') {
        const pEntry = entry as PrimaryWeaponCatalogEntry;
        if (pEntry.coolingBonus) {
          const redPct = Math.round(((pEntry.heatReductionPct ?? 0.22) + (item.tier - 1) * 0.08) * 100);
          statChip.textContent = `+${pEntry.coolingBonus}/s · -${redPct}% HEAT`;
        } else {
          const dmg = Math.round(
            pEntry.baseStats.damage * (item.tier === 3 ? 1.85 : item.tier === 2 ? 1.38 : 1)
          );
          statChip.textContent = `DMG ${dmg} · HEAT ${pEntry.heatPerShot}`;
        }
      } else {
        const sEntry = entry as SkillWeaponCatalogEntry;
        statChip.textContent = `SKILL · DMG ${sEntry.baseStats.damage}`;
      }
      statsRow.appendChild(statChip);

      const footer = document.createElement('div');
      footer.className = 'armory-card-footer';
      const salvageVal = getWeaponSalvageValue(item);
      const salvageBtn = document.createElement('button');
      salvageBtn.type = 'button';
      salvageBtn.className = 'btn-unmount';
      salvageBtn.textContent = `${strings.btnSalvage} +$${salvageVal}`;
      salvageBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.sim.salvageInventoryItem(item.instanceId);
        this.renderShop();
      });

      const quickMountBtn = document.createElement('button');
      quickMountBtn.type = 'button';
      quickMountBtn.className = 'armory-action-btn ui-inline-flex';
      const targetSlot = this.resolveMountTargetSlot(state, entry.kind);
      quickMountBtn.append(
        document.createTextNode(`${strings.btnMount} `),
        createUiIcon('arrowRight', 'ui-svg-icon ui-arrow-inline'),
        document.createTextNode(` ${SHIP_SLOT_MAP[targetSlot].shortTag}`)
      );
      quickMountBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.sim.equipInventoryItem(item.instanceId, targetSlot);
        this.renderShop();
      });

      footer.append(salvageBtn, quickMountBtn);
      card.append(head, statsRow, footer);
      this.garageArmoryList.appendChild(card);
    });
  }

  private renderShipDropStage(state: GameState): void {
    const strings = this.t;
    const loadout = state.player.loadout;
    this.shipDropStage.innerHTML = '';

    for (const slotDef of SHIP_GRID_SLOTS) {
      const mounted = loadout.slots[slotDef.id];
      const entry = mounted ? WEAPON_CATALOG[mounted.weaponId] : null;
      const totalUps = this.getWeaponTotalUpgradeLevel(mounted);

      const node = document.createElement('div');
      node.className = 'ship-socket';
      node.dataset.slotId = slotDef.id;
      node.dataset.slotKind = slotDef.kind;
      if (slotDef.kind === 'skill') node.classList.add('skill-socket', 'core-socket');
      if (mounted) {
        node.classList.add('is-occupied');
        node.dataset.weaponId = mounted.weaponId;
      }
      if (loadout.selectedSlot === slotDef.id || (slotDef.id === 'skill_1' && loadout.selectedSlot === 'CORE')) {
        node.classList.add('is-selected');
      }
      if (entry) node.style.setProperty('--slot-accent', entry.accent);

      const topRow = document.createElement('div');
      topRow.className = 'socket-top-row';
      const tagEl = document.createElement('span');
      tagEl.textContent = slotDef.shortTag;
      const starsEl = document.createElement('span');
      starsEl.className = mounted ? `tier-stars tier-${mounted.tier}` : '';
      if (mounted) {
        starsEl.appendChild(
          createTierStarsEl(mounted.tier, `tier-${mounted.tier}`, totalUps > 0 ? ` +${totalUps}` : '')
        );
      } else {
        starsEl.textContent = slotDef.kind === 'skill' ? 'CORE' : '';
      }
      topRow.append(tagEl, starsEl);
      node.appendChild(topRow);

      if (entry && mounted) {
        node.appendChild(this.createItemImg(entry.iconUrl, 'socket-icon-img'));
      } else {
        const plus = document.createElement('div');
        plus.className = 'socket-empty-plus';
        plus.appendChild(
          createUiIcon(
            slotDef.kind === 'skill' ? 'diamond' : 'plus',
            slotDef.kind === 'skill' ? 'ui-svg-icon socket-diamond-svg' : 'ui-svg-icon socket-plus-svg'
          )
        );
        node.appendChild(plus);
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'socket-name';
      nameEl.textContent = entry ? (this.lang === 'vi' ? entry.nameVi : entry.nameEn) : strings.slotEmpty;
      node.appendChild(nameEl);

      this.shipDropStage.appendChild(node);
    }
  }

  private syncShipSocketCoordinates(state: GameState): void {
    if (state.phase !== 'SHOP' || this.activePostWaveView !== 'GARAGE') return;
    const dropRect = this.shipDropStage.getBoundingClientRect();
    if (dropRect.width <= 0 || dropRect.height <= 0) return;
    const stageRect = this.webglStageEl.getBoundingClientRect();
    const projected = this.scene.projectShipHardpoints(state);

    for (const pt of projected) {
      const el = this.shipDropStage.querySelector<HTMLElement>(`.ship-socket[data-slot-id="${pt.id}"]`);
      if (!el) continue;
      const localX = Math.max(46, Math.min(dropRect.width - 46, stageRect.left + pt.x - dropRect.left));
      const localY = Math.max(42, Math.min(dropRect.height - 42, stageRect.top + pt.y - dropRect.top));
      el.style.left = `${localX}px`;
      el.style.top = `${localY}px`;
    }
  }

  private appendCoreMatrixTelemetry(state: GameState): void {
    const strings = this.t;
    const p = state.player;
    const head = document.createElement('div');
    head.className = 'inspector-head';
    const kicker = document.createElement('div');
    kicker.className = 'inspector-slot-kicker';
    kicker.textContent = 'CHASSIS CORE MATRIX';
    const titleRow = document.createElement('div');
    titleRow.className = 'inspector-weapon-title';
    titleRow.append(
      this.createItemImg('./assets/icons/core_health.png', 'item-icon-img'),
      document.createTextNode(strings.slotCoreTitle)
    );
    const pill = document.createElement('span');
    pill.className = 'inspector-bound-pill core';
    pill.textContent = strings.corePersistsBadge;
    head.append(kicker, titleRow, pill);

    const desc = document.createElement('div');
    desc.className = 'armory-card-desc';
    desc.textContent = strings.slotCoreDesc;

    const stats = document.createElement('div');
    stats.className = 'inspector-stats-grid';
    const coolRate = computePlayerCoolingRate(this.sim.state);
    const heatScalePct = Math.round(computeWeaponHeatScale(this.sim.state) * 100);
    const corePairs: Array<[string, string]> = [
      ['HULL HP', `${Math.ceil(p.health)}/${p.maxHealth}`],
      ['REGEN/S', `${p.hpRegen.toFixed(1)}`],
      ['ENERGY', `${p.maxEnergy}`],
      ['COOLING', `${coolRate.toFixed(0)}/s`],
      ['MAX HEAT', `${p.maxHeat}`],
      ['HEAT SCALE', `${heatScalePct}%`],
      ['THRUST', `${p.speed.toFixed(2)}`],
      ['PICKUP RNG', `${p.pickupRange}`],
    ];
    for (const [lbl, val] of corePairs) {
      const box = document.createElement('div');
      box.className = 'inspector-stat-box';
      const lblEl = document.createElement('div');
      lblEl.className = 'inspector-stat-lbl';
      lblEl.textContent = lbl;
      const valEl = document.createElement('div');
      valEl.className = 'inspector-stat-val';
      valEl.textContent = val;
      box.append(lblEl, valEl);
      stats.appendChild(box);
    }

    this.garageInspector.append(head, desc, stats);

    if (p.loadout.activeAugments.length > 0) {
      const augList = document.createElement('div');
      augList.className = 'choice-pills';
      for (const aid of p.loadout.activeAugments) {
        const def = AUGMENT_CATALOG[aid as AugmentId];
        const item = document.createElement('div');
        item.className = 'choice-pill selected';
        item.innerHTML = `<span class="choice-pill-name">${this.lang === 'vi' ? def.nameVi : def.nameEn}</span><span class="choice-pill-desc">${this.lang === 'vi' ? def.descVi : def.descEn}</span>`;
        augList.appendChild(item);
      }
      this.garageInspector.appendChild(augList);
    }

    if (p.loadout.garageMode === 'SHOP') {
      const openTabBtn = document.createElement('button');
      openTabBtn.type = 'button';
      openTabBtn.className = 'armory-action-btn';
      openTabBtn.textContent = strings.tabCore;
      openTabBtn.addEventListener('click', () => {
        this.setPostWaveView('STORE');
      });
      this.garageInspector.appendChild(openTabBtn);
    }
  }

  private renderGarageInspector(state: GameState): void {
    const strings = this.t;
    const p = state.player;
    const sel = p.loadout.selectedSlot;
    this.garageInspector.innerHTML = '';

    if (sel === 'CORE') {
      this.appendCoreMatrixTelemetry(state);
      return;
    }

    const slotDef = SHIP_SLOT_MAP[sel];
    const mounted = p.loadout.slots[sel];

    const head = document.createElement('div');
    head.className = 'inspector-head';
    const kicker = document.createElement('div');
    kicker.className = 'inspector-slot-kicker';
    kicker.textContent = `${slotDef.shortTag} · ${
      this.lang === 'vi' ? slotDef.labelVi : slotDef.labelEn
    }`;
    head.appendChild(kicker);

    if (!mounted) {
      const emptyTitle = document.createElement('div');
      emptyTitle.className = 'inspector-weapon-title';
      emptyTitle.textContent = strings.slotEmpty;
      const hint = document.createElement('div');
      hint.className = 'armory-card-desc';
      hint.textContent = strings.slotEmptyHint;
      head.append(emptyTitle, hint);
      this.garageInspector.appendChild(head);
      if (sel === 'skill_1') {
        this.appendCoreMatrixTelemetry(state);
      }
      return;
    }

    const entry = WEAPON_CATALOG[mounted.weaponId];
    const wTitle = document.createElement('div');
    wTitle.className = 'inspector-weapon-title';
    wTitle.append(
      this.createItemImg(entry.iconUrl, 'item-icon-img'),
      document.createTextNode(`${this.lang === 'vi' ? entry.nameVi : entry.nameEn} `),
      createTierStarsEl(mounted.tier, `tier-${mounted.tier}`)
    );
    const boundPill = document.createElement('span');
    boundPill.className = 'inspector-bound-pill';
    boundPill.textContent = `${entry.manufacturer} · ${strings.weaponBoundBadge}`;
    head.append(wTitle, boundPill);
    this.garageInspector.appendChild(head);

    // Live DPS & stat readout for this socket's gear
    const statsGrid = document.createElement('div');
    statsGrid.className = 'inspector-stats-grid';
    if (entry.kind === 'primary') {
      const st = computeMountedPrimaryStats(mounted, p, sel);
      const pEntry = entry as PrimaryWeaponCatalogEntry;
      const heatScale = computeWeaponHeatScale(this.sim.state);
      const rawHeat = pEntry.heatPerShot;
      const effHeat = rawHeat * heatScale;
      const heatLabel =
        rawHeat <= 0
          ? '0 (COOLANT)'
          : Math.abs(effHeat - rawHeat) >= 0.05
            ? `${rawHeat} -> ${effHeat.toFixed(1)}`
            : `${rawHeat}`;
      for (const [lbl, val] of [
        ['DAMAGE', `${st.damage}`],
        ['COOLDOWN', `${st.cooldownMs}ms`],
        ['VOLLEY', `x${st.projectiles}`],
        ['PIERCE', `${st.pierce}`],
        ['HEAT/SHOT', heatLabel],
        ['GUIDANCE', st.homing ? 'HOMING' : 'DIRECT'],
      ] as const) {
        const box = document.createElement('div');
        box.className = 'inspector-stat-box';
        const lblEl = document.createElement('div');
        lblEl.className = 'inspector-stat-lbl';
        lblEl.textContent = lbl;
        const valEl = document.createElement('div');
        valEl.className = 'inspector-stat-val';
        valEl.textContent = val;
        box.append(lblEl, valEl);
        statsGrid.appendChild(box);
      }
    } else {
      const st = computeMountedSkillStats(mounted);
      for (const [lbl, val] of [
        ['DAMAGE', `${st.damage}`],
        ['COOLDOWN', `${(st.cooldownMs / 1000).toFixed(1)}s`],
        ['RADIUS', `${st.radius}px`],
        ['ENERGY COST', `${st.energyCost}`],
      ] as const) {
        const box = document.createElement('div');
        box.className = 'inspector-stat-box';
        box.innerHTML = `<div class="inspector-stat-lbl">${lbl}</div><div class="inspector-stat-val">${val}</div>`;
        statsGrid.appendChild(box);
      }
    }
    this.garageInspector.appendChild(statsGrid);

    // Per-weapon overclock upgrade buttons
    const defs = entry.kind === 'primary' ? PRIMARY_UPGRADE_DEFS : SKILL_UPGRADE_DEFS;
    const maxMap = entry.maxUpgrades as Record<string, number>;
    for (const upDef of defs) {
      const curLvl = (mounted.upgrades[upDef.key] as number | undefined) ?? 0;
      const cap = maxMap[upDef.key] ?? 0;
      const maxed = isMountedWeaponUpgradeMaxed(mounted, upDef.key);
      const cost = getMountedWeaponUpgradePrice(mounted, upDef.key);

      const row = document.createElement('div');
      row.className = 'upgrade-row';

      const info = document.createElement('div');
      info.className = 'upgrade-row-info';
      const name = document.createElement('div');
      name.className = 'upgrade-row-name';
      name.textContent = this.lang === 'vi' ? upDef.nameVi : upDef.nameEn;
      const sub = document.createElement('div');
      sub.className = 'upgrade-row-sub';
      sub.textContent = this.lang === 'vi' ? upDef.bonusLabelVi : upDef.bonusLabelEn;

      const pips = document.createElement('div');
      pips.className = 'upgrade-pips';
      for (let i = 0; i < cap; i++) {
        const pip = document.createElement('span');
        pip.className = i < curLvl ? 'upgrade-pip filled' : 'upgrade-pip';
        pips.appendChild(pip);
      }
      info.append(name, sub, pips);

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'armory-action-btn';
      upBtn.textContent = maxed ? strings.maxed : `$${cost}`;
      upBtn.disabled = maxed || state.money < cost;
      upBtn.addEventListener('click', () => {
        this.sim.upgradeWeaponSlot(sel, upDef.key);
        this.renderShop();
      });

      row.append(info, upBtn);
      this.garageInspector.appendChild(row);
    }

    // Tiny Unequip vs Scrap-for-cash button duo
    const salvage = getWeaponSalvageValue(mounted);
    const minPrimaryLocked =
      slotDef.kind === 'primary' && countMountedPrimaryWeapons(state) <= 1;

    const actionRow = document.createElement('div');
    actionRow.className = 'ow-inspector-actions';
    actionRow.title = minPrimaryLocked ? strings.minPrimaryWarn : strings.warnSwapLose;

    const unequipBtn = document.createElement('button');
    unequipBtn.type = 'button';
    unequipBtn.className = 'armory-action-btn';
    unequipBtn.disabled = minPrimaryLocked;
    unequipBtn.textContent = strings.btnUnequip;
    unequipBtn.addEventListener('click', () => {
      this.sim.unequipToInventory(sel);
      this.renderShop();
    });

    const unmountBtn = document.createElement('button');
    unmountBtn.type = 'button';
    unmountBtn.className = 'btn-unmount';
    unmountBtn.disabled = minPrimaryLocked;
    unmountBtn.textContent = `${strings.btnSalvage} +$${salvage}`;
    unmountBtn.addEventListener('click', () => {
      this.sim.unmountWeapon(sel);
      this.renderShop();
    });

    actionRow.append(unequipBtn, unmountBtn);
    this.garageInspector.appendChild(actionRow);
    if (sel === 'skill_1') {
      this.appendCoreMatrixTelemetry(state);
    }
  }

  private renderPause(): void {
    const s = this.sim.state;
    const strings = this.t;
    this.pauseStats.textContent = `WAVE ${s.wave}  ·  SCORE ${s.score}  ·  $${s.money}`;
    this.pauseSoundBtn.textContent = this.sound.isMuted() ? strings.soundOff : strings.soundOn;
    this.pauseAimBtn.textContent = this.input.aimMode === 'auto' ? strings.aimAuto : strings.aimMouse;
    this.pauseAutoFireBtn.textContent = this.input.autoFire ? strings.autoFireOn : strings.autoFireOff;

    const q = this.scene.getQuality();
    const qText =
      q === 'high' ? strings.qualityHigh : q === 'medium' ? strings.qualityMedium : strings.qualityLow;
    this.pauseQualityBtn.textContent = `${strings.graphicsLabel}: ${qText}`;
  }

  private openGameOverScreen(): void {
    const s = this.sim.state;
    this.scoreSubmitted = false;

    this.gameOverShell.classList.remove('extraction-win');
    this.gameOverKicker.textContent = 'SIGNAL LOST // SORTIE TERMINATED';
    this.gameOverTitle.textContent = this.t.gameOver;

    if (this.gameOverAnimFrame !== null) {
      cancelAnimationFrame(this.gameOverAnimFrame);
      this.gameOverAnimFrame = null;
    }

    const targetScore = s.score;
    const targetWave = s.wave;
    const targetCombo = s.combo.maxCombo;
    const targetBosses = s.bossKills;
    const targetRooms = s.roomsClearedTotal;
    const startMs = performance.now();
    const durationMs = 540;
    let lastTickStep = -1;

    const totalShards = metaProgression.getProfile().shards;
    this.finalShardsEl.textContent = `+${s.shardsEarnedLastRun} (${totalShards})`;

    const tickCount = (nowMs: number) => {
      const p = Math.min(1, (nowMs - startMs) / durationMs);
      const ease = 1 - Math.pow(1 - p, 3);
      this.finalScoreEl.textContent = `${Math.round(targetScore * ease)}`;
      this.finalWaveEl.textContent = `${Math.round(targetWave * ease)}`;
      this.finalComboEl.textContent = `${Math.round(targetCombo * ease)}`;
      this.finalBossesEl.textContent = `${Math.round(targetBosses * ease)}`;
      this.finalRoomsEl.textContent = `${Math.round(targetRooms * ease)}`;

      const step = Math.floor(p * 9);
      if (p < 1 && step > lastTickStep) {
        lastTickStep = step;
        this.sound.playCountTick(step);
      }

      if (p < 1 && !this.gameOverScreen.classList.contains('hidden')) {
        this.gameOverAnimFrame = requestAnimationFrame(tickCount);
      } else {
        this.gameOverAnimFrame = null;
      }
    };
    this.gameOverAnimFrame = requestAnimationFrame(tickCount);

    this.submitScoreBtn.disabled = false;
    const submitLabel = this.submitScoreBtn.querySelector<HTMLElement>('[data-lang]');
    if (submitLabel) submitLabel.textContent = this.t.submitScore;
    this.submitStatusMsg.textContent = '';
    this.submitStatusMsg.className = 'submit-status';
    this.rankPreviewEl.textContent = '';

    try {
      const savedName = localStorage.getItem('playerName');
      if (savedName) this.playerNameInput.value = savedName;
    } catch {
      // Private mode or storage blocked? Fine, keep calm and use defaults
    }

    void this.leaderboard.estimateRank(s.score).then((rank) => {
      if (rank !== null) {
        this.rankPreviewEl.textContent = this.t.rankPreview.replace('{rank}', String(rank));
      }
    });
    void this.loadLeaderboardInto(this.gameOverLeaderboardBody, true);
  }

  private async handleSubmitScore(): Promise<void> {
    if (this.scoreSubmitted) return;
    const rawName = this.playerNameInput.value.trim();
    if (!rawName) {
      this.submitStatusMsg.textContent = this.t.enterNameAlert;
      this.submitStatusMsg.className = 'submit-status err';
      this.playerNameInput.focus();
      return;
    }
    if (rawName.length > 20) {
      this.submitStatusMsg.textContent = this.t.nameTooLong;
      this.submitStatusMsg.className = 'submit-status err';
      return;
    }

    this.submitScoreBtn.disabled = true;
    try {
      // Pull straight from GameSimulation truth - HUD DOM is strictly read-only
      await this.leaderboard.submitScore(rawName, this.sim.state.score, this.sim.state.wave);
      this.scoreSubmitted = true;
      this.submitStatusMsg.textContent = this.t.submitSuccess;
      this.submitStatusMsg.className = 'submit-status';
      const label = this.submitScoreBtn.querySelector<HTMLElement>('[data-lang]');
      if (label) label.textContent = this.t.submitted;
      void this.loadLeaderboardInto(this.gameOverLeaderboardBody, true);
    } catch {
      this.submitScoreBtn.disabled = false;
      this.submitStatusMsg.textContent = this.t.submitError;
      this.submitStatusMsg.className = 'submit-status err';
    }
  }

  private async loadLeaderboardInto(container: HTMLElement, compact: boolean): Promise<void> {
    container.textContent = '';
    const loading = document.createElement('div');
    loading.className = 'lb-empty';
    loading.textContent = this.t.loadingScores;
    container.appendChild(loading);

    try {
      const entries = await this.leaderboard.fetchTop(10);
      this.renderLeaderboardTable(container, entries, compact);
    } catch {
      container.textContent = '';
      const errDiv = document.createElement('div');
      errDiv.className = 'lb-empty';
      errDiv.textContent = this.t.firebaseOffline;
      container.appendChild(errDiv);
    }
  }

  private renderLeaderboardTable(
    container: HTMLElement,
    entries: LeaderboardEntry[],
    compact: boolean
  ): void {
    container.textContent = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = this.t.noScores;
      container.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'lb-table';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const headers = compact
      ? ['#', this.t.name, this.t.score]
      : [this.t.rank, this.t.name, this.t.score, this.t.wave];
    for (const h of headers) {
      const th = document.createElement('th');
      th.textContent = h;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    entries.forEach((entry, idx) => {
      const rank = idx + 1;
      const tr = document.createElement('tr');
      if (rank <= 3) tr.classList.add(`rank-${rank}`);
      if (this.leaderboard.lastSubmittedKey && entry.key === this.leaderboard.lastSubmittedKey) {
        tr.classList.add('is-self');
      }

      const tdRank = document.createElement('td');
      tdRank.textContent = String(rank).padStart(2, '0');

      const tdName = document.createElement('td');
      tdName.textContent = entry.name; // textContent stops <script> injection cold

      const tdScore = document.createElement('td');
      tdScore.textContent = entry.score.toLocaleString();

      tr.append(tdRank, tdName, tdScore);
      if (!compact) {
        const tdWave = document.createElement('td');
        tdWave.textContent = String(entry.wave);
        tr.appendChild(tdWave);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  private renderAchievements(): void {
    const summary = this.achievements.getSummary();
    this.achievementsSummary.textContent = `${summary.unlocked} / ${summary.total} ${this.t.levelsLabel}`;
    this.achievementsList.textContent = '';

    for (const def of ACHIEVEMENT_LIST) {
      const prog = this.achievements.getProgress(def.id);
      const copy = def[this.lang];

      const item = document.createElement('div');
      item.className = `ach-item ${prog.level > 0 ? 'unlocked' : ''}`;

      const icon = document.createElement('div');
      icon.className = 'ach-icon';
      icon.textContent = def.icon;

      const info = document.createElement('div');
      info.className = 'ach-info';

      const head = document.createElement('div');
      head.className = 'ach-head';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = copy.name;
      const lvlSpan = document.createElement('span');
      lvlSpan.className = 'ach-lvl';
      lvlSpan.textContent = `${this.t.lvPrefix} ${prog.level}/${prog.maxLevel}`;
      head.append(nameSpan, lvlSpan);

      const desc = document.createElement('div');
      desc.className = 'ach-desc';
      desc.textContent = copy.desc.replace('{target}', String(prog.target));

      info.append(head, desc);

      if (prog.isMaxed) {
        const done = document.createElement('div');
        done.className = 'ach-count';
        done.style.color = '#38f288';
        setIconText(done, 'check', this.t.completed);
        info.appendChild(done);
      } else {
        const bar = document.createElement('div');
        bar.className = 'ach-bar';
        const fill = document.createElement('div');
        fill.className = 'ach-bar-fill';
        fill.style.width = `${prog.percent.toFixed(1)}%`;
        bar.appendChild(fill);

        const count = document.createElement('div');
        count.className = 'ach-count';
        count.textContent = `${prog.current} / ${prog.target}`;
        info.append(bar, count);
      }

      item.append(icon, info);
      this.achievementsList.appendChild(item);
    }
  }

  private flushToastQueue(): void {
    if (this.toastActive || this.toastQueue.length === 0) return;
    this.toastActive = true;
    const ev = this.toastQueue.shift()!;
    const def = ACHIEVEMENTS[ev.id];
    const copy = def[this.lang];

    const toast = document.createElement('div');
    toast.className = 'ach-toast';

    const icon = document.createElement('span');
    icon.className = 'ach-toast-badge';
    icon.textContent = def.icon;

    const textBox = document.createElement('div');
    const tTitle = document.createElement('div');
    tTitle.className = 'ach-toast-title';
    tTitle.textContent = this.t.achievementLvl.replace('{lvl}', String(ev.level));
    const tName = document.createElement('div');
    tName.className = 'ach-toast-name';
    tName.textContent = copy.name;

    textBox.append(tTitle, tName);
    toast.append(icon, textBox);
    this.toastStack.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
      this.toastActive = false;
      this.flushToastQueue();
    }, 3000);
  }

  updateHud(state: GameState, fps: number, frameDtSec = 1 / 60): void {
    if (state.phase === 'MENU' || state.phase === 'GAMEOVER') return;

    const p = state.player;
    const hpPct = Math.max(0, Math.min(100, (p.health / p.maxHealth) * 100));
    const dtHud = Math.min(0.05, Math.max(0.001, frameDtSec));
    if (hpPct < this.lastHpPct - 0.2) {
      this.hpLagHoldSec = 0.26;
    }
    if (hpPct >= this.hpLagPct) {
      this.hpLagPct = hpPct;
      this.hpLagHoldSec = 0;
    } else if (this.hpLagHoldSec > 0) {
      this.hpLagHoldSec = Math.max(0, this.hpLagHoldSec - dtHud);
    } else {
      this.hpLagPct = Math.max(hpPct, this.hpLagPct - dtHud * 56);
    }
    this.lastHpPct = hpPct;
    this.hpFill.style.width = `${hpPct}%`;
    this.hpDelayFill.style.width = `${this.hpLagPct.toFixed(2)}%`;
    this.hpFill.className = `bar-fill hp-fill ow-hp-fill ${hpPct <= 30 ? 'low' : hpPct <= 60 ? 'mid' : ''}`;
    this.hpValue.textContent = `${Math.ceil(p.health)}/${p.maxHealth}`;

    const enPct = Math.max(0, Math.min(100, (p.energy / p.maxEnergy) * 100));
    this.enFill.style.width = `${enPct}%`;
    this.enValue.textContent = `${Math.floor(p.energy)}`;

    const heatPct = Math.max(0, Math.min(100, (p.heat / p.maxHeat) * 100));
    const isRedline = !p.isOverloaded && heatPct >= 60;
    this.heatFill.style.width = `${heatPct}%`;
    this.heatValue.textContent = p.isOverloaded
      ? this.t.heatOverload
      : isRedline
        ? `${Math.round(heatPct)}% +18%`
        : `${Math.round(heatPct)}%`;
    this.hudTopLeft.classList.toggle('heat-redline', isRedline);
    this.hudTopLeft.classList.toggle('overload-active', p.isOverloaded);
    this.thermalPurgeBtn.classList.toggle(
      'hidden',
      state.phase !== 'PLAYING' || p.heat < 60 || p.thermalPurgeCooldownMs > 0
    );

    if (p.chronoActiveMs > 0) {
      const activePct = Math.max(0, Math.min(100, (p.chronoActiveMs / Math.max(1, p.chronoMaxMs)) * 100));
      this.chronoRow.classList.add('active');
      this.chronoFill.style.width = `${activePct}%`;
      this.chronoValue.textContent = `${(p.chronoActiveMs / 1000).toFixed(1)}s`;
      this.chronoHudBtn.classList.add('hidden');
    } else {
      const chPct = Math.max(0, Math.min(100, p.chronoCharge));
      this.chronoRow.classList.remove('active');
      this.chronoFill.style.width = `${chPct}%`;
      this.chronoValue.textContent = `${Math.floor(chPct)}%`;
      this.chronoHudBtn.classList.toggle('hidden', state.phase !== 'PLAYING' || p.chronoCharge < 100);
    }

    this.hudRoomPill.textContent = `${state.runRoomNumber}/${state.roomsTotalPerSector}`;
    const roomTitle = this.lang === 'vi' ? state.currentRoomTitleVi : state.currentRoomTitleEn;
    const zoneTag = this.lang === 'vi' ? state.currentRoomZoneVi : state.currentRoomZoneEn;
    this.hudRoomSubBanner.textContent = `${roomTitle}${zoneTag ? ` · ${zoneTag}` : ''}`;

    this.hudLevelBadge.textContent = `LV.${p.level}`;
    if (p.xp > this.lastXpVal) {
      this.triggerXpGainFlash();
    }
    this.lastXpVal = p.xp;
    const xpPct = Math.max(0, Math.min(100, (p.xp / Math.max(1, p.xpToNext)) * 100));
    this.xpFill.style.width = `${xpPct}%`;
    this.hudXpText.textContent = `${Math.floor(p.xp)}/${p.xpToNext} XP`;

    if (state.warpTransition.active) {
      this.warpJumpBanner.classList.remove('hidden');
      this.warpJumpKicker.textContent =
        this.lang === 'vi' ? 'DU HÀNH ÁNH SÁNG // HYPERSPACE JUMP' : 'HYPERSPACE JUMP // ENGAGED';
      this.warpJumpTitle.textContent =
        this.lang === 'vi' ? state.warpTransition.titleVi : state.warpTransition.titleEn;
      this.warpJumpZone.textContent =
        this.lang === 'vi' ? state.warpTransition.zoneLabelVi : state.warpTransition.zoneLabelEn;
      this.warpJumpBanner.style.setProperty(
        '--warp-accent',
        `#${state.warpTransition.accentHex.toString(16).padStart(6, '0')}`
      );
    } else {
      this.warpJumpBanner.classList.add('hidden');
    }

    this.syncMutationHudStrip(state);

    this.updateRaidHud(state);

    if (state.phase === 'SHOP') {
      this.syncShipSocketCoordinates(state);
    }

    if (state.phase === 'PLAYING' && state.stormRing.outsideStorm) {
      const distOut = Math.max(
        1,
        Math.round(
          Math.hypot(p.x - state.stormRing.centerX, p.y - state.stormRing.centerY) -
            state.stormRing.radius
        )
      );
      this.stormWarningBanner.classList.remove('hidden');
      setIconText(this.stormWarningBanner, 'warn', `${this.t.stormOutsideWarn} (${distOut}m)`);
    } else {
      this.stormWarningBanner.classList.add('hidden');
    }

    if (state.phase === 'PLAYING') {
      this.renderTacticalRadar(state);
      this.updateOffscreenMarkers(state);
    } else {
      this.offscreenMarkers.textContent = '';
    }

    this.hudWave.textContent = String(state.wave).padStart(2, '0');
    this.currentWaveNum = Math.max(1, state.wave);

    if (state.score > this.lastScoreVal) {
      this.lastScoreVal = state.score;
      this.hudScore.classList.remove('tick-pop');
      void this.hudScore.offsetWidth;
      this.hudScore.classList.add('tick-pop');
    } else if (state.score < this.lastScoreVal) {
      this.lastScoreVal = state.score;
    }
    this.hudScore.textContent = state.score.toLocaleString();

    if (state.money > this.lastMoneyVal) {
      this.lastMoneyVal = state.money;
      this.hudMoney.classList.remove('tick-pop');
      void this.hudMoney.offsetWidth;
      this.hudMoney.classList.add('tick-pop');
    } else if (state.money < this.lastMoneyVal) {
      this.lastMoneyVal = state.money;
    }
    this.hudMoney.textContent = String(state.money);
    this.fpsBadge.textContent = `${fps} FPS // AGX`;
    this.updateOverwatchHud(state, frameDtSec);

    if (state.phase === 'PLAYING' && hpPct > 0 && hpPct <= 25) {
      this.sound.playLowHpAlert();
    }

    // Floaty FCS lock-on brackets tracking whoever we're shooting at in 3D space
    if (state.phase === 'PLAYING' && p.lockedTarget && !state.waveTransition.active) {
      const lt = p.lockedTarget;
      const proj = this.scene.projectToScreen(lt.x, lt.y, 0.5);
      if (proj.visible) {
        this.fcsReticle.classList.remove('hidden');
        this.fcsReticle.classList.toggle('boss', lt.isBoss);
        this.fcsReticle.style.left = `${proj.x}px`;
        this.fcsReticle.style.top = `${proj.y}px`;
        this.fcsTag.textContent = `${lt.isBoss ? 'TGT.BOSS' : 'FCS.LOCK'} ${Math.ceil(lt.hpRatio * 100)}%`;
      } else {
        this.fcsReticle.classList.add('hidden');
      }
    } else {
      this.fcsReticle.classList.add('hidden');
    }

    // Boss health gauge & dramatic intro title card
    if (state.boss && !state.boss.deadFinalized) {
      const b = state.boss;
      this.bossBarContainer.classList.remove('hidden');
      this.bossNameLabel.textContent = b.displayName;
      this.bossNameLabel.style.color = b.color;

      const mutKey = `${b.id}:${this.lang}:${b.mutations.join(',')}`;
      if (mutKey !== this.lastBossMutatorKey) {
        this.lastBossMutatorKey = mutKey;
        this.bossMutatorsRow.textContent = '';
        for (const mutId of b.mutations) {
          const def = BOSS_MUTATIONS[mutId];
          const pill = document.createElement('span');
          pill.className = 'boss-mutator-pill';
          pill.style.borderColor = def.accent;
          pill.style.color = def.accent;
          pill.textContent = this.lang === 'vi' ? def.shortVi : def.shortEn;
          this.bossMutatorsRow.appendChild(pill);
        }
      }

      const shielded = b.pylons.length > 0;
      const staggered = !shielded && b.staggerTimerMs > 0;
      const formStage = b.transformStage;
      this.bossPhaseLabel.classList.toggle('is-shielded', shielded);
      this.bossPhaseLabel.classList.toggle('is-staggered', staggered);
      this.bossPhaseLabel.classList.toggle('form-2', !shielded && !staggered && formStage === 2);
      this.bossPhaseLabel.classList.toggle('form-3', !shielded && !staggered && formStage === 3);
      if (staggered) {
        this.bossPhaseLabel.textContent = this.t.bossStaggeredTag;
      } else if (shielded) {
        this.bossPhaseLabel.textContent = `${this.t.bossShieldedTag} (${b.pylons.length})`;
      } else {
        const formLabel =
          formStage === 3
            ? this.t.bossForm3
            : formStage === 2
              ? this.t.bossForm2
              : this.t.bossForm1;
        if (b.archetype === 5) {
          const armorTag =
            b.armorPlates > 0
              ? `${this.t.bossArmorPlates} x${b.armorPlates}`
              : this.t.bossCoreExposed;
          this.bossPhaseLabel.textContent = `${formLabel} · ${armorTag}`;
        } else {
          this.bossPhaseLabel.textContent = formLabel;
        }
      }

      const fillRatio = b.entering ? b.displayHp / b.maxHp : b.hp / b.maxHp;
      this.bossHpFill.style.width = `${Math.max(0, fillRatio * 100)}%`;
      this.bossHpTrail.style.width = `${Math.max(0, (b.displayHp / b.maxHp) * 100)}%`;
    } else {
      this.bossBarContainer.classList.add('hidden');
      this.lastBossMutatorKey = '';
    }

    const showBossIntro = state.phase === 'PLAYING' && !!state.boss && state.boss.entering;
    if (showBossIntro && state.boss) {
      const b = state.boss;
      this.hudLayer.style.setProperty('--boss-accent', b.color);
      this.cinemaBarTop.classList.add('active');
      this.cinemaBarBottom.classList.add('active');
      this.bossIntroOverlay.classList.add('active');
      if (this.lastIntroBossId !== b.id) {
        this.lastIntroBossId = b.id;
        this.bossIntroOverlay.classList.remove('impact-slam');
        this.bossIntroWarning.textContent = this.t.bossWarningStamp;
        this.bossIntroSector.textContent = `WAVE ${String(state.wave).padStart(2, '0')}`;
        const bossClasses = [
          this.t.bossClass0,
          this.t.bossClass1,
          this.t.bossClass2,
          this.t.bossClass3,
          this.t.bossClass4,
          this.t.bossClass5,
        ];
        const bossSubs = [
          this.t.bossSub0,
          this.t.bossSub1,
          this.t.bossSub2,
          this.t.bossSub3,
          this.t.bossSub4,
          this.t.bossSub5,
        ];
        this.bossIntroClass.textContent = bossClasses[b.archetype] ?? this.t.bossClass0;
        this.bossIntroTitle.textContent = b.displayName;
        const mutList = b.mutations
          .map((m) => (this.lang === 'vi' ? BOSS_MUTATIONS[m].nameVi : BOSS_MUTATIONS[m].nameEn))
          .join(' + ');
        this.bossIntroSubtitle.textContent = mutList
          ? `${this.t.bossMutationPrefix}: ${mutList}`
          : (bossSubs[b.archetype] ?? this.t.bossSub0);
        this.bossIntroThreat.textContent = this.t.bossThreatExtreme;
      }
    } else {
      this.cinemaBarTop.classList.remove('active');
      this.cinemaBarBottom.classList.remove('active');
      this.bossIntroOverlay.classList.remove('active', 'impact-slam');
    }

    // Between-wave breather / tutorial banner
    if (state.isResting && state.phase === 'PLAYING' && !state.waveTransition.active) {
      this.restBanner.classList.remove('hidden');
      const total = state.wave === 0 ? TUTORIAL_AUTO_START_MS : WAVE_REST_MS;
      const remainSec = Math.max(1, Math.ceil((total - (state.simTimeMs - state.restStartMs)) / 1000));
      if (state.wave === 0 && state.tutorialCircle) {
        const holdRemain = Math.max(
          0,
          Math.ceil((TUTORIAL_HOLD_MS - state.tutorialCircle.progressMs) / 100) / 10
        );
        this.restTitle.textContent =
          state.tutorialCircle.progressMs > 0
            ? `${this.t.holdToStart}: ${holdRemain.toFixed(1)}s`
            : `${this.t.tutorialPrompt} (${remainSec}s)`;
        this.restSub.textContent = this.t.tutorialHint;
        this.restHangarBtn.classList.add('hidden');
      } else {
        this.restTitle.textContent = `${this.t.nextWaveIn}: ${remainSec}s`;
        this.restSub.textContent = '';
        this.restHangarBtn.classList.remove('hidden');
      }
    } else {
      this.restBanner.classList.add('hidden');
      this.restHangarBtn.classList.add('hidden');
    }

    // Active energy shield pip
    if (p.shieldActive) {
      const rem = Math.max(0, (p.shieldDurationMs - (state.simTimeMs - p.shieldStartMs)) / 1000);
      this.shieldBadge.className = 'shield-badge active';
      this.shieldStatusText.textContent = `${this.t.shieldActive} ${rem.toFixed(1)}s`;
    } else if (p.shieldCooldownMs > 0) {
      this.shieldBadge.className = 'shield-badge cooldown';
      this.shieldStatusText.textContent = `${this.t.shieldCd} ${Math.ceil(p.shieldCooldownMs / 1000)}s`;
    } else {
      this.shieldBadge.className = 'shield-badge ready';
      this.shieldStatusText.textContent = this.t.shieldReady;
    }

    // Dorsal active-skill widget (stays hidden until you actually mount a Skill Pod)
    const mountedSkill = p.loadout.slots.skill_1;
    this.skillWidget.parentElement?.classList.toggle('hidden', mountedSkill === null);
    const skillEntry = mountedSkill ? WEAPON_CATALOG[mountedSkill.weaponId] : null;
    const skillElapsed = state.simTimeMs - p.skill.lastUseMs;
    const skillReady = Boolean(mountedSkill) && skillElapsed >= p.skill.cooldownMs && p.energy >= p.skill.cost;
    const mode = p.skill.mode;
    this.skillWidget.classList.toggle('ready', skillReady);
    this.skillWidget.classList.toggle('mode-salvo', mode === 'salvo');
    this.skillWidget.classList.toggle('mode-railbeam', mode === 'railbeam');
    this.skillWidget.classList.toggle('mode-emp', mode === 'emp');
    if (skillEntry) {
      this.skillIconImg.src = skillEntry.iconUrl;
      this.skillIconImg.classList.remove('hidden');
      this.skillNameLabel.textContent = this.lang === 'vi' ? skillEntry.nameVi : skillEntry.nameEn;
    } else {
      this.skillIconImg.classList.add('hidden');
      this.skillNameLabel.textContent = this.t.noSkillEquipped;
    }
    if (mountedSkill) {
      this.skillLvlText.textContent = '';
      this.skillLvlText.classList.add('ui-inline-flex');
      this.skillLvlText.append(
        createUiIcon('star', 'ui-svg-icon ui-star-icon'),
        document.createTextNode(String(mountedSkill.tier))
      );
    } else {
      this.skillLvlText.classList.remove('ui-inline-flex');
      this.skillLvlText.textContent = '--';
    }
    if (mountedSkill && skillElapsed < p.skill.cooldownMs) {
      this.skillCdText.classList.remove('hidden');
      this.skillCdText.textContent = `${Math.ceil((p.skill.cooldownMs - skillElapsed) / 1000)}s`;
    } else {
      this.skillCdText.classList.add('hidden');
    }

    // Weapon strip, synergy tags, sector hazard & active buffs (only rebuild DOM when state actually shifts)
    const activeBuffEntries = (Object.keys(POWER_UP_CONFIG) as PowerUpType[])
      .map((type) => {
        const exp = state.activeBuffs[type];
        const rem = exp && exp > state.simTimeMs ? Math.ceil((exp - state.simTimeMs) / 1000) : 0;
        return { type, rem };
      })
      .filter((x) => x.rem > 0);

    const loadoutSummary = SHIP_GRID_SLOTS.filter((s) => p.loadout.slots[s.id] !== null)
      .map((s) => `${s.shortTag}:${p.loadout.slots[s.id]!.weaponId}:t${p.loadout.slots[s.id]!.tier}`)
      .join(',');

    const hudKey = `${this.lang}|${state.sectorHazard}|${loadoutSummary}|${p.doubleShotCount}-${p.tripleShotCount}-${p.pierceCount}-${activeBuffEntries
      .map((b) => `${b.type}:${b.rem}`)
      .join(',')}`;

    if (hudKey !== this.lastHudKey) {
      this.lastHudKey = hudKey;
      this.weaponBadges.textContent = '';
      for (const s of SHIP_GRID_SLOTS) {
        const m = p.loadout.slots[s.id];
        if (!m) continue;
        const e = WEAPON_CATALOG[m.weaponId];
        const tag = document.createElement('span');
        tag.className = 'weapon-tag ui-inline-flex';
        tag.append(
          this.createItemImg(e.iconUrl, 'item-icon-sm'),
          document.createTextNode(`${s.shortTag} `),
          createTierStarsEl(m.tier, `tier-${m.tier}`)
        );
        this.weaponBadges.appendChild(tag);
      }
      if (p.pierceCount > 0) this.appendWeaponTag(`PIERCE +${p.pierceCount}`);

      const synergies = computeActiveSynergies(p);
      this.synergyHudRow.textContent = '';
      (['NOVACORP', 'IRONFORGE', 'AETHER', 'VOIDTECH'] as ManufacturerId[]).forEach((mfr) => {
        const cnt = synergies.counts[mfr] ?? 0;
        if (cnt < 2) return;
        const pill = document.createElement('span');
        pill.className = 'synergy-pill active';
        pill.textContent = `${mfr} ${cnt}`;
        this.synergyHudRow.appendChild(pill);
      });

      if (state.sectorHazard !== 'normal') {
        const hazDef = SECTOR_HAZARDS[state.sectorHazard];
        this.hazardBadge.classList.remove('hidden');
        setIconText(this.hazardBadge, 'warn', this.lang === 'vi' ? hazDef.nameVi : hazDef.nameEn);
      } else {
        this.hazardBadge.classList.add('hidden');
      }

      this.activeBuffsBar.textContent = '';
      for (const b of activeBuffEntries) {
        const cfg = POWER_UP_CONFIG[b.type];
        const pill = document.createElement('div');
        pill.className = 'buff-pill';
        pill.style.color = cfg.color;
        pill.textContent = `${this.lang === 'vi' ? cfg.labelVi : cfg.labelEn} · ${b.rem}s`;
        this.activeBuffsBar.appendChild(pill);
      }
    }

    // Right-flank arcade streak combo meter
    if (state.combo.kills >= 2) {
      this.comboHud.classList.remove('hidden');
      this.comboHud.style.setProperty('--combo-color', state.combo.color);
      this.comboRankText.textContent = state.combo.rank;
      this.comboRankText.style.color = state.combo.color;
      this.comboCalloutText.textContent = this.getComboTag(state.combo.rank);
      this.comboBankedText.textContent = `+${state.combo.scoreBanked.toLocaleString()} PTS`;
      this.comboHitsText.textContent = `${state.combo.kills} HITS`;
      const timerRatio = Math.max(0, state.combo.timerMs / COMBO_WINDOW_MS);
      this.comboTimerFill.style.width = `${timerRatio * 100}%`;
      this.comboTimerFill.style.background = state.combo.color;
      this.comboHud.classList.toggle('urgent', timerRatio < 0.28);
      this.comboMultText.textContent =
        state.combo.multiplier > 1 ? `x${state.combo.multiplier} SCORE` : '';
      this.renderComboProgressDots(state.combo.kills);
    } else {
      this.comboHud.classList.add('hidden');
      this.comboHud.classList.remove('urgent');
    }

    // Combo receipt card when your streak finally cools off
    if (state.combo.endBanner) {
      const b = state.combo.endBanner;
      this.comboEndBanner.classList.remove('hidden');
      this.comboEndBanner.style.borderColor = b.color;
      this.comboEndRank.textContent = b.rank;
      this.comboEndRank.style.color = b.color;
      this.comboEndDetails.textContent = `${b.kills} HITS  ·  +${b.score.toLocaleString()} PTS`;
      this.comboEndBanner.style.opacity = String(Math.min(1, b.timerMs / 400));
    } else {
      this.comboEndBanner.classList.add('hidden');
    }

    // Wave launch banner with sector milestone track
    if (state.waveTransition.active && !showBossIntro) {
      this.waveBanner.classList.remove('hidden');
      this.waveBanner.classList.toggle('boss', state.waveTransition.isBoss);
      const titleText = state.waveTransition.isBoss
        ? `${this.t.bossWave} ${state.waveTransition.wave}`
        : `WAVE ${String(state.waveTransition.wave).padStart(2, '0')}`;
      const biomeTitle = this.lang === 'vi' ? state.sectorMap.nameVi : state.sectorMap.nameEn;
      this.waveBannerTag.textContent = state.waveTransition.isBoss
        ? `${biomeTitle} // ${this.t.bossApproaching}`
        : `${biomeTitle} // ${this.t.sectorDeploy}`;
      this.waveBannerTitle.textContent = titleText;
      this.waveBannerGhost.textContent = titleText;
      this.waveBannerSub.textContent = state.waveTransition.isBoss
        ? this.t.prepareForBattle
        : state.waveTransition.wave === 1
          ? this.t.tutorialStart
          : this.t.getReady;
      if (this.lastRenderedWaveBanner !== state.waveTransition.wave) {
        this.lastRenderedWaveBanner = state.waveTransition.wave;
        this.renderWaveProgressNodes(state.waveTransition.wave);
      }
    } else {
      this.waveBanner.classList.add('hidden');
    }

    // Floating damage numbers projected cleanly out of 3D combat
    this.syncFloatingTexts(state);
  }

  private triggerBossIntroSlam(): void {
    this.bossIntroOverlay.classList.remove('impact-slam');
    void this.bossIntroOverlay.offsetWidth;
    this.bossIntroOverlay.classList.add('impact-slam');
    if (this.introSlamTimer !== null) {
      window.clearTimeout(this.introSlamTimer);
    }
    this.introSlamTimer = window.setTimeout(() => {
      this.bossIntroOverlay.classList.remove('impact-slam');
      this.introSlamTimer = null;
    }, 450);
  }

  private openModal(el: HTMLElement): void {
    const existingTimer = this.modalTimers.get(el);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      this.modalTimers.delete(el);
    }
    el.classList.remove('hidden', 'closing', 'entering');
    void el.offsetWidth;
    el.classList.add('entering');
    this.sound.playModalTransition(true);
  }

  private closeModal(el: HTMLElement, onClosed?: () => void): void {
    const existingTimer = this.modalTimers.get(el);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    el.classList.remove('entering');
    el.classList.add('closing');
    this.sound.playModalTransition(false);
    const timer = window.setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('closing');
      this.modalTimers.delete(el);
      onClosed?.();
    }, 180);
    this.modalTimers.set(el, timer);
  }

  private hideOverlayImmediate(el: HTMLElement): void {
    const existingTimer = this.modalTimers.get(el);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      this.modalTimers.delete(el);
    }
    el.classList.add('hidden');
    el.classList.remove('entering', 'closing');
  }

  private moveHeroFocusRail(targetEl: HTMLElement): void {
    if (!this.heroActions.contains(targetEl)) return;
    this.activeHeroChoice = targetEl;
    const containerRect = this.heroActions.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    if (containerRect.width <= 0 || targetRect.height <= 0) return;

    const relX = targetRect.left - containerRect.left;
    const relY = targetRect.top - containerRect.top;
    this.heroFocusRail.style.width = `${targetRect.width}px`;
    this.heroFocusRail.style.height = `${targetRect.height}px`;
    this.heroFocusRail.style.transform = `translate3d(${relX}px, ${relY}px, 0)`;
    this.heroFocusRail.classList.add('visible');
  }

  private getComboTag(rank: ComboRank): string {
    switch (rank) {
      case 'SSS':
        return this.t.comboTagSSS;
      case 'SS':
        return this.t.comboTagSS;
      case 'S':
        return this.t.comboTagS;
      case 'A':
        return this.t.comboTagA;
      case 'B':
        return this.t.comboTagB;
      case 'C':
        return this.t.comboTagC;
      default:
        return this.t.comboTagD;
    }
  }

  private triggerSkillModePop(): void {
    this.skillWidget.classList.remove('mode-pop');
    void this.skillWidget.offsetWidth;
    this.skillWidget.classList.add('mode-pop');
  }

  private triggerComboKillPop(): void {
    this.comboHud.classList.remove('kill-pop');
    void this.comboHud.offsetWidth;
    this.comboHud.classList.add('kill-pop');
    if (this.comboPopTimer !== null) window.clearTimeout(this.comboPopTimer);
    this.comboPopTimer = window.setTimeout(() => {
      this.comboHud.classList.remove('kill-pop');
      this.comboPopTimer = null;
    }, 220);
  }

  private triggerComboRankBurst(): void {
    this.comboHud.classList.remove('rank-up');
    void this.comboHud.offsetWidth;
    this.comboHud.classList.add('rank-up');
    if (this.comboRankTimer !== null) window.clearTimeout(this.comboRankTimer);
    this.comboRankTimer = window.setTimeout(() => {
      this.comboHud.classList.remove('rank-up');
      this.comboRankTimer = null;
    }, 450);
  }

  private updateOverwatchHud(state: GameState, frameDtSec = 1 / 60): void {
    const p = state.player;
    const onFire = state.combo.kills >= 9;
    this.owPortraitWrap.classList.toggle('on-fire', onFire);
    this.owPortraitWrap.classList.toggle('shielded', p.shieldActive);
    this.owOnFireTag.classList.toggle('hidden', !onFire);

    // Circular Nova Bomb charge ring (r = 42, circumference ~ 263.89)
    const ultCircumference = 263.89;
    const skillElapsed = Math.max(0, state.simTimeMs - p.skill.lastUseMs);
    const ratio = p.skill.cooldownMs > 0 ? Math.min(1, skillElapsed / p.skill.cooldownMs) : 1;
    const skillReady = ratio >= 1 && p.energy >= p.skill.cost;
    this.owUltArc.style.strokeDashoffset = (ultCircumference * (1 - ratio)).toFixed(2);
    if (skillReady) {
      this.owUltPct.classList.add('hidden');
    } else {
      this.owUltPct.classList.remove('hidden');
      this.owUltPct.textContent =
        ratio < 1 ? `${Math.min(99, Math.floor(ratio * 100))}%` : 'EN';
    }

    // Phase Dash cooldown tile [SHIFT / SPACE]
    const dashRemainMs = Math.max(0, p.dashCooldownMs - (state.simTimeMs - p.dashStartMs));
    const dashReady = !p.dashActive && dashRemainMs <= 0 && p.energy >= p.dashCost;
    this.owDashTile.classList.toggle('ready', dashReady);
    this.owDashTile.classList.toggle('active', p.dashActive);
    this.owDashTile.classList.toggle('cooldown', dashRemainMs > 0);
    if (dashRemainMs > 0) {
      this.owDashCd.classList.remove('hidden');
      this.owDashCd.textContent = `${(dashRemainMs / 1000).toFixed(1)}s`;
    } else {
      this.owDashCd.classList.add('hidden');
    }

    // Subtle helmet-visor parallax & shake coupling (feels way livelier than static UI)
    const dt = Math.min(0.05, Math.max(0.001, frameDtSec));
    const damp = (lambda: number) => 1 - Math.exp(-lambda * dt);

    if (state.phase !== 'PLAYING') {
      const kReset = damp(14.0);
      this.hudSwayX += (0 - this.hudSwayX) * kReset;
      this.hudSwayY += (0 - this.hudSwayY) * kReset;
      this.hudTiltX += (0 - this.hudTiltX) * kReset;
      this.hudTiltY += (0 - this.hudTiltY) * kReset;
      this.hudScale += (1 - this.hudScale) * kReset;
      this.hudMotionRig.style.transform = '';
    } else {
      const camVel = this.scene.lastCameraMotion;
      const camShake = this.scene.lastCameraShake;
      const dashPushX = p.dashActive ? -p.dashDirX * 7.5 : 0;
      const dashPushY = p.dashActive ? -p.dashDirY * 7.5 : 0;
      const recoilX = p.shotRecoil > 0.01 ? -Math.cos(p.facingAngle) * p.shotRecoil * 2.4 : 0;
      const recoilY = p.shotRecoil > 0.01 ? -Math.sin(p.facingAngle) * p.shotRecoil * 2.4 : 0;

      const targetSwayX = Math.max(-16, Math.min(16, -p.vx * 1.65 - camVel.vx * 0.24 + dashPushX));
      const targetSwayY = Math.max(-13, Math.min(13, -p.vy * 1.45 - camVel.vz * 0.24 + dashPushY));
      const targetTiltY = Math.max(-2.1, Math.min(2.1, -targetSwayX * 0.13));
      const targetTiltX = Math.max(-1.7, Math.min(1.7, targetSwayY * 0.13));
      const targetScale = p.dashActive ? 1.022 : 1.0;

      this.hudSwayX += (targetSwayX - this.hudSwayX) * damp(10.5);
      this.hudSwayY += (targetSwayY - this.hudSwayY) * damp(10.5);
      this.hudTiltX += (targetTiltX - this.hudTiltX) * damp(9.0);
      this.hudTiltY += (targetTiltY - this.hudTiltY) * damp(9.0);
      this.hudScale += (targetScale - this.hudScale) * damp(11.0);

      const shakePxX = Math.max(-18, Math.min(18, -camShake.x * 13.5));
      const shakePxY = Math.max(-18, Math.min(18, -camShake.z * 13.5));
      const shakeRoll = Math.max(-0.55, Math.min(0.55, camShake.x * 0.42));
      const tx = (this.hudSwayX + shakePxX + recoilX).toFixed(2);
      const ty = (this.hudSwayY + shakePxY + recoilY).toFixed(2);

      this.hudMotionRig.style.transform = `perspective(1200px) translate3d(${tx}px, ${ty}px, 0) rotateX(${this.hudTiltX.toFixed(2)}deg) rotateY(${this.hudTiltY.toFixed(2)}deg) rotate(${shakeRoll.toFixed(2)}deg) scale(${this.hudScale.toFixed(4)})`;
    }

    if (state.phase === 'SHOP' && this.activePostWaveView === 'GARAGE') {
      this.syncShipSocketCoordinates(state);
    }
  }

  private pushKillFeed(
    actor: string,
    target: string,
    ptsText: string,
    variant: 'kill' | 'boss' | 'drop'
  ): void {
    const item = document.createElement('div');
    item.className = `ow-kf-item${variant === 'boss' ? ' is-boss' : variant === 'drop' ? ' is-drop' : ''}`;

    const actorEl = document.createElement('span');
    actorEl.className = 'ow-kf-actor';
    actorEl.textContent = actor;

    const sepEl = document.createElement('span');
    sepEl.className = 'ow-kf-sep ui-inline-flex';
    sepEl.appendChild(createUiIcon('play', 'ui-svg-icon ui-sep-svg'));

    const targetEl = document.createElement('span');
    targetEl.className = 'ow-kf-target';
    targetEl.textContent = target;

    const ptsEl = document.createElement('span');
    ptsEl.className = 'ow-kf-pts';
    ptsEl.textContent = ptsText;

    item.append(actorEl, sepEl, targetEl, ptsEl);
    this.owKillFeed.prepend(item);

    while (this.owKillFeed.children.length > 4) {
      this.owKillFeed.lastElementChild?.remove();
    }

    window.setTimeout(() => item.classList.add('fading'), 3100);
    window.setTimeout(() => item.remove(), 3400);
  }

  private clearKillFeed(): void {
    this.owKillFeed.textContent = '';
  }

  private triggerHitmarker(arenaX: number, arenaY: number, mode: 'hit' | 'crit' | 'kill'): void {
    const state = this.sim.state;
    if (state.phase !== 'PLAYING') return;
    let sx = this.lastPointerX;
    let sy = this.lastPointerY;
    if (!state.aimWorldActive) {
      const proj = this.scene.projectToScreen(arenaX, arenaY, 0.7);
      if (!proj.visible) return;
      sx = proj.x;
      sy = proj.y;
    }
    this.hitmarkerReticle.style.left = `${sx}px`;
    this.hitmarkerReticle.style.top = `${sy}px`;
    this.hitmarkerReticle.classList.remove('hidden', 'is-hit', 'is-crit', 'is-kill');
    void this.hitmarkerReticle.offsetWidth;
    this.hitmarkerReticle.classList.add(
      mode === 'kill' ? 'is-kill' : mode === 'crit' ? 'is-crit' : 'is-hit'
    );
    if (this.hitmarkerTimer !== null) window.clearTimeout(this.hitmarkerTimer);
    const dur = mode === 'kill' ? 220 : mode === 'crit' ? 175 : 115;
    this.hitmarkerTimer = window.setTimeout(() => {
      this.hitmarkerReticle.classList.add('hidden');
      this.hitmarkerReticle.classList.remove('is-hit', 'is-crit', 'is-kill');
      this.hitmarkerTimer = null;
    }, dur);
  }

  private triggerXpGainFlash(): void {
    this.xpFill.classList.remove('xp-gain-flash');
    void this.xpFill.offsetWidth;
    this.xpFill.classList.add('xp-gain-flash');
    if (this.xpFlashTimer !== null) window.clearTimeout(this.xpFlashTimer);
    this.xpFlashTimer = window.setTimeout(() => {
      this.xpFill.classList.remove('xp-gain-flash');
      this.xpFlashTimer = null;
    }, 220);
  }

  private triggerLevelUpBurst(): void {
    this.hudLevelBadge.classList.remove('level-up-burst');
    void this.hudLevelBadge.offsetWidth;
    this.hudLevelBadge.classList.add('level-up-burst');
    if (this.levelUpBurstTimer !== null) window.clearTimeout(this.levelUpBurstTimer);
    this.levelUpBurstTimer = window.setTimeout(() => {
      this.hudLevelBadge.classList.remove('level-up-burst');
      this.levelUpBurstTimer = null;
    }, 520);
  }

  private triggerFcsKillFlash(): void {
    if (this.fcsReticle.classList.contains('hidden')) return;
    this.fcsReticle.classList.add('kill-flash');
    if (this.fcsKillTimer !== null) window.clearTimeout(this.fcsKillTimer);
    this.fcsKillTimer = window.setTimeout(() => {
      this.fcsReticle.classList.remove('kill-flash');
      this.fcsKillTimer = null;
    }, 120);
  }

  private triggerHudDamageShake(): void {
    this.hudTopLeft.classList.remove('damage-shake');
    void this.hudTopLeft.offsetWidth;
    this.hudTopLeft.classList.add('damage-shake');
    if (this.hudDamageTimer !== null) window.clearTimeout(this.hudDamageTimer);
    this.hudDamageTimer = window.setTimeout(() => {
      this.hudTopLeft.classList.remove('damage-shake');
      this.hudDamageTimer = null;
    }, 280);
  }

  private showWaveClearStamp(wave: number, bonus: number): void {
    if (wave <= 0 || wave % 5 === 0) return;
    this.waveClearBanner.className = 'wave-clear-banner';
    this.waveClearKicker.textContent = this.t.waveClearedTag;
    this.waveClearTitle.textContent = `WAVE ${String(wave).padStart(2, '0')} COMPLETE`;
    this.waveClearBonus.textContent = bonus > 0 ? `${this.t.fastClearBonus} +$${bonus}` : '';
    void this.waveClearBanner.offsetWidth;
    if (this.waveClearTimer !== null) window.clearTimeout(this.waveClearTimer);
    this.waveClearTimer = window.setTimeout(() => {
      this.waveClearBanner.classList.add('hidden');
      this.waveClearTimer = null;
    }, 1900);
  }

  private showBossDefeatedStamp(reward: number): void {
    this.waveClearBanner.className = 'wave-clear-banner boss-victory';
    this.waveClearKicker.textContent = `WAVE ${String(this.currentWaveNum).padStart(2, '0')} // VICTORY`;
    this.waveClearTitle.textContent = this.t.bossSlainTag;
    this.waveClearBonus.textContent = `${this.t.bossBounty} +$${reward} · ${this.t.bossSlainSub}`;
    void this.waveClearBanner.offsetWidth;
    if (this.waveClearTimer !== null) window.clearTimeout(this.waveClearTimer);
    this.waveClearTimer = window.setTimeout(() => {
      this.waveClearBanner.classList.add('hidden');
      this.waveClearTimer = null;
    }, 2600);
  }

  private renderWaveProgressNodes(wave: number): void {
    const cyclePos = ((Math.max(1, wave) - 1) % 5) + 1;
    this.waveProgressTrack.textContent = '';
    for (let i = 1; i <= 5; i++) {
      const pip = document.createElement('div');
      pip.className = 'wave-pip';
      if (i === 5) pip.classList.add('boss-node');
      if (i < cyclePos) pip.classList.add('done');
      else if (i === cyclePos) pip.classList.add('current');
      this.waveProgressTrack.appendChild(pip);
    }
  }

  private renderComboProgressDots(kills: number): void {
    let curMin = 2;
    let nextMin = 4;
    const asc = [...COMBO_TIERS].reverse();
    for (let i = 0; i < asc.length; i++) {
      if (kills >= asc[i].minKills) {
        curMin = asc[i].minKills;
        nextMin = i + 1 < asc.length ? asc[i + 1].minKills : curMin;
      }
    }
    const totalSlots = 5;
    const filledCount =
      nextMin <= curMin
        ? totalSlots
        : Math.max(1, Math.min(totalSlots, Math.ceil(((kills - curMin + 1) / (nextMin - curMin)) * totalSlots)));

    if (this.comboProgressDots.childElementCount !== totalSlots) {
      this.comboProgressDots.textContent = '';
      for (let i = 0; i < totalSlots; i++) {
        const dot = document.createElement('div');
        dot.className = 'combo-pip';
        this.comboProgressDots.appendChild(dot);
      }
    }
    for (let i = 0; i < totalSlots; i++) {
      const dot = this.comboProgressDots.children[i];
      if (dot) dot.classList.toggle('filled', i < filledCount);
    }
  }

  private appendWeaponTag(label: string): void {
    const tag = document.createElement('span');
    tag.className = 'weapon-tag';
    tag.textContent = label;
    this.weaponBadges.appendChild(tag);
  }

  private syncFloatingTexts(state: GameState): void {
    const activeIds = new Set<number>();
    for (const ft of state.floatingTexts) {
      activeIds.add(ft.id);
      let el = this.floatingEls.get(ft.id);
      if (!el) {
        el = document.createElement('div');
        el.className = ft.isCrit || ft.text.endsWith('!') ? 'floating-dmg crit' : 'floating-dmg';
        el.textContent = ft.text;
        el.style.color = ft.color;
        this.floatingLayer.appendChild(el);
        this.floatingEls.set(ft.id, el);
      }

      const proj = this.scene.projectToScreen(ft.x, ft.y, 1.8);
      if (proj.visible) {
        const ageT = 1 - Math.max(0, ft.life) / Math.max(1, ft.maxLife);
        let dynScale = ft.scale;
        if (ageT < 0.22) {
          // Juicy EaseOutBack bounce on freshly spawned damage numbers
          const k = ageT / 0.22;
          const m = k - 1;
          const ease = 1 + 2.70158 * m * m * m + 1.70158 * m * m;
          const peakScale = ft.isCrit || ft.text.endsWith('!') ? 1.32 : 1.15;
          dynScale = ft.scale * (0.45 + (peakScale - 0.45) * ease);
        } else if (ageT < 0.72) {
          const settleT = (ageT - 0.22) / 0.5;
          const peakScale = ft.isCrit || ft.text.endsWith('!') ? 1.32 : 1.15;
          dynScale = ft.scale * (peakScale + (1.0 - peakScale) * settleT);
        } else {
          const tailT = (ageT - 0.72) / 0.28;
          dynScale = ft.scale * Math.max(0.55, 1.0 - tailT * 0.45);
        }
        el.style.left = `${proj.x}px`;
        el.style.top = `${proj.y}px`;
        el.style.opacity = String(Math.min(1, ft.life / Math.min(12, ft.maxLife)));
        el.style.transform = `translate(-50%, -50%) scale(${dynScale.toFixed(3)})`;
      } else {
        el.style.opacity = '0';
      }
    }

    for (const [id, el] of this.floatingEls.entries()) {
      if (!activeIds.has(id)) {
        el.remove();
        this.floatingEls.delete(id);
      }
    }
  }

  private clearFloatingTexts(): void {
    for (const el of this.floatingEls.values()) {
      el.remove();
    }
    this.floatingEls.clear();
  }

  private setupDragDrop(): void {
    document.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const target = ev.target as Element | null;
      if (!target || target.closest('button')) return;

      const invCard = target.closest<HTMLElement>('.armory-card[data-drag-type="inventory"]');
      if (invCard) {
        const weaponId = invCard.dataset.weaponId as WeaponId | undefined;
        const instanceId = invCard.dataset.instanceId;
        if (!weaponId || !instanceId) return;
        const entry = WEAPON_CATALOG[weaponId];
        this.dragSession = {
          sourceType: 'inventory',
          instanceId,
          weaponId,
          kind: entry.kind,
          label: this.lang === 'vi' ? entry.nameVi : entry.nameEn,
          iconUrl: entry.iconUrl,
          startX: ev.clientX,
          startY: ev.clientY,
          active: false,
        };
        return;
      }

      const socketEl = target.closest<HTMLElement>('.ship-socket[data-slot-id]');
      if (socketEl && this.shopDropContains(socketEl)) {
        const slotId = socketEl.dataset.slotId as ShipSlotId | 'CORE' | undefined;
        if (!slotId) return;
        if (slotId === 'CORE') return;
        const mounted = this.sim.state.player.loadout.slots[slotId];
        if (!mounted) return;
        const entry = WEAPON_CATALOG[mounted.weaponId];
        this.dragSession = {
          sourceType: 'slot',
          fromSlot: slotId,
          weaponId: mounted.weaponId,
          kind: entry.kind,
          label: this.lang === 'vi' ? entry.nameVi : entry.nameEn,
          iconUrl: entry.iconUrl,
          startX: ev.clientX,
          startY: ev.clientY,
          active: false,
        };
        return;
      }
    });

    document.addEventListener('pointermove', (ev) => {
      const ds = this.dragSession;
      if (!ds) return;
      if (!ds.active) {
        if (Math.hypot(ev.clientX - ds.startX, ev.clientY - ds.startY) < 6) return;
        ds.active = true;
        this.dragGhost.textContent = '';
        this.dragGhost.append(
          this.createItemImg(ds.iconUrl, 'item-icon-img'),
          (() => {
            const s = document.createElement('span');
            s.className = 'drag-ghost-name';
            s.textContent = ds.label;
            return s;
          })()
        );
        this.dragGhost.classList.remove('hidden');
        this.highlightValidDropSockets(ds.kind, true);
      }

      this.dragGhost.style.left = `${ev.clientX}px`;
      this.dragGhost.style.top = `${ev.clientY}px`;
      this.updateDragHoverHighlight(ev.clientX, ev.clientY, ds);
    });

    const handlePointerEnd = (ev: PointerEvent) => {
      const ds = this.dragSession;
      if (!ds) return;
      this.dragSession = null;

      if (!ds.active) {
        // Tap a Hangar socket to inspect whatever's bolted there
        const socket = (ev.target as Element | null)?.closest<HTMLElement>('.ship-socket[data-slot-id]');
        if (socket && this.shopDropContains(socket)) {
          const sid = socket.dataset.slotId as ShipSlotId | 'CORE' | undefined;
          if (sid) {
            this.sound.playUiClick(840);
            this.sim.selectGarageSlot(sid);
            this.renderShop();
          }
        }
        this.cancelDragSession();
        return;
      }

      const prevGhostHidden = this.dragGhost.classList.contains('hidden');
      this.dragGhost.classList.add('hidden');
      const underEl = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!prevGhostHidden) this.dragGhost.classList.remove('hidden');

      const dropSocket = underEl?.closest<HTMLElement>('.ship-socket[data-slot-id]');
      if (dropSocket) {
        const targetSlot = dropSocket.dataset.slotId as ShipSlotId | 'CORE' | undefined;
        if (targetSlot && targetSlot !== 'CORE' && SHIP_SLOT_MAP[targetSlot].kind === ds.kind) {
          if (ds.sourceType === 'inventory' && ds.instanceId) {
            this.sim.equipInventoryItem(ds.instanceId, targetSlot);
          } else if (ds.sourceType === 'slot' && ds.fromSlot && ds.fromSlot !== targetSlot) {
            this.sim.swapSlots(ds.fromSlot, targetSlot);
          }
          this.renderShop();
        }
      } else if (ds.sourceType === 'slot' && ds.fromSlot && underEl?.closest('#garageArmoryPanel')) {
        this.sim.unequipToInventory(ds.fromSlot);
        this.renderShop();
      }

      this.cancelDragSession();
    };

    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', () => this.cancelDragSession());

    this.shipDropStage.addEventListener('click', (ev) => {
      if (this.dragSession?.active) return;
      const socket = (ev.target as Element | null)?.closest<HTMLElement>('.ship-socket[data-slot-id]');
      if (!socket) return;
      const sid = socket.dataset.slotId as ShipSlotId | 'CORE' | undefined;
      if (!sid) return;
      this.sound.playUiClick(840);
      this.sim.selectGarageSlot(sid);
      this.renderShop();
    });
  }

  private shopDropContains(el: HTMLElement): boolean {
    return this.shipDropStage.contains(el);
  }

  private highlightValidDropSockets(kind: 'primary' | 'skill', enabled: boolean): void {
    document
      .querySelectorAll<HTMLElement>('.ship-socket[data-slot-kind]')
      .forEach((el) => {
        el.classList.toggle('drop-valid', enabled && el.dataset.slotKind === kind);
      });
  }

  private updateDragHoverHighlight(cx: number, cy: number, ds: DragSession): void {
    document.querySelectorAll<HTMLElement>('.ship-socket.drop-hover').forEach((el) => {
      el.classList.remove('drop-hover');
    });
    this.garageArmoryPanel.classList.remove('drop-unequip-hover');

    const underEl = document.elementFromPoint(cx, cy);
    const sock = underEl?.closest<HTMLElement>('.ship-socket[data-slot-id]');
    if (sock && sock.dataset.slotKind === ds.kind) {
      sock.classList.add('drop-hover');
      return;
    }
    if (ds.sourceType === 'slot' && underEl?.closest('#garageArmoryPanel')) {
      this.garageArmoryPanel.classList.add('drop-unequip-hover');
    }
  }

  private cancelDragSession(): void {
    this.dragSession = null;
    this.dragGhost.classList.add('hidden');
    document.querySelectorAll<HTMLElement>('.ship-socket').forEach((el) => {
      el.classList.remove('drop-valid', 'drop-hover');
    });
    this.garageArmoryPanel.classList.remove('drop-unequip-hover');
  }

  private renderTacticalRadar(state: GameState): void {
    const ctx = this.radarCtx;
    if (!ctx) return;

    const size = this.tacticalRadar.width;
    const half = size * 0.5;
    const ring = state.stormRing;
    const p = state.player;
    const radarRange = Math.max(1050, ring.radius * 1.15);
    const scale = (half - 6) / radarRange;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    // Clip radar into a circle and paint range rings
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 12, 24, 0.85)';
    ctx.fill();
    ctx.clip();

    ctx.strokeStyle = 'rgba(56, 232, 255, 0.14)';
    ctx.lineWidth = 1;
    for (const frac of [0.35, 0.7]) {
      ctx.beginPath();
      ctx.arc(half, half, (half - 4) * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Where the storm wall is shrinking to next (dashed ring)
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.arc(
      half + (ring.targetCenterX - p.x) * scale,
      half + (ring.targetCenterY - p.y) * scale,
      Math.max(2, ring.targetRadius * scale),
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.restore();

    // Live storm perimeter pulsing cleanly on the radar
    ctx.strokeStyle = ring.outsideStorm
      ? '#ff3355'
      : ring.bossLocked
        ? '#ff7b29'
        : ring.phase === 'EXPANDING'
          ? '#34d399'
          : '#38e8ff';
    ctx.lineWidth = 1.6 + ring.pulseFlash * 2.0;
    ctx.beginPath();
    ctx.arc(
      half + (ring.centerX - p.x) * scale,
      half + (ring.centerY - p.y) * scale,
      Math.max(2, ring.radius * scale),
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // Blip destructible rocks & spicy exploding barrels
    for (const ob of state.arenaObstacles) {
      ctx.fillStyle =
        ob.kind === 'plasma_barrel' ? '#ff7b29' : 'rgba(103, 232, 249, 0.55)';
      ctx.beginPath();
      ctx.arc(
        half + (ob.x - p.x) * scale,
        half + (ob.y - p.y) * scale,
        ob.kind === 'plasma_barrel' ? 2.4 : 2.2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Blip unclaimed loot drops floating in space
    ctx.fillStyle = '#38e8ff';
    for (const m of state.floatingModules) {
      ctx.fillRect(half + (m.x - p.x) * scale - 2, half + (m.y - p.y) * scale - 2, 4, 4);
    }

    // Blip hostile ships & boss icon
    ctx.fillStyle = '#ff4d6d';
    for (const e of state.enemies) {
      ctx.beginPath();
      ctx.arc(half + (e.x - p.x) * scale, half + (e.y - p.y) * scale, e.type === 'elite' ? 2.8 : 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.boss && !state.boss.dying) {
      ctx.fillStyle = state.boss.color;
      ctx.beginPath();
      ctx.arc(
        half + (state.boss.x - p.x) * scale,
        half + (state.boss.y - p.y) * scale,
        4.8,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (state.raid?.activeObjective && !state.raid.activeObjective.completed) {
      const obj = state.raid.activeObjective;
      const rx = half + (obj.x - p.x) * scale;
      const ry = half + (obj.y - p.y) * scale;
      const pulse = 4.5 + Math.sin(state.simTimeMs * 0.01) * 1.1;
      ctx.fillStyle =
        obj.kind === 'vault' ? '#38e8ff' : obj.kind === 'convoy' ? '#fbbf24' : '#ff4d6d';
      ctx.beginPath();
      ctx.moveTo(rx, ry - pulse);
      ctx.lineTo(rx + pulse, ry);
      ctx.lineTo(rx, ry + pulse);
      ctx.lineTo(rx - pulse, ry);
      ctx.closePath();
      ctx.fill();
    }

    // Dead-center heading arrow for our own ship
    ctx.translate(half, half);
    ctx.rotate(p.facingAngle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(5.5, 0);
    ctx.lineTo(-4, -3.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-4, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this.radarRadiusLabel.textContent = ring.bossLocked
      ? this.t.stormBossLock
      : `${Math.round(ring.radius)}m · ${this.lang === 'vi' ? state.sectorMap.nameVi : state.sectorMap.nameEn}`;
  }

  private updateOffscreenMarkers(state: GameState): void {
    const stageRect = this.webglStageEl.getBoundingClientRect();
    const w = stageRect.width;
    const h = stageRect.height;
    if (w <= 0 || h <= 0) return;

    const targets: Array<{ x: number; y: number; color: string; label: string }> = [];
    if (state.boss && !state.boss.dying) {
      targets.push({ x: state.boss.x, y: state.boss.y, color: state.boss.color, label: 'BOSS' });
    } else if (state.raid?.activeObjective && !state.raid.activeObjective.completed) {
      const obj = state.raid.activeObjective;
      const color = `#${obj.accentHex.toString(16).padStart(6, '0')}`;
      const label =
        obj.kind === 'vault' ? 'VAULT' : obj.kind === 'convoy' ? 'CONVOY' : 'REACTOR';
      targets.push({ x: obj.x, y: obj.y, color, label });
    }
    if (state.stormRing.outsideStorm) {
      targets.push({
        x: state.stormRing.centerX,
        y: state.stormRing.centerY,
        color: '#ff3355',
        label: 'SAFE ZONE',
      });
    }
    for (const m of state.floatingModules.slice(0, 3)) {
      targets.push({ x: m.x, y: m.y, color: '#38e8ff', label: 'POD' });
    }

    const pad = 34;
    this.offscreenMarkers.textContent = '';

    for (const t of targets) {
      const proj = this.scene.projectToScreen(t.x, t.y, 0.8);
      const inside =
        proj.visible &&
        proj.x >= stageRect.left + pad &&
        proj.x <= stageRect.right - pad &&
        proj.y >= stageRect.top + pad &&
        proj.y <= stageRect.bottom - pad;
      if (inside) continue;

      const ang = Math.atan2(t.y - state.player.y, t.x - state.player.x);
      const halfW = w * 0.5 - pad;
      const halfH = h * 0.5 - pad;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const factor = Math.min(
        Math.abs(cos) > 0.001 ? halfW / Math.abs(cos) : Infinity,
        Math.abs(sin) > 0.001 ? halfH / Math.abs(sin) : Infinity
      );

      const px = stageRect.left + w * 0.5 + cos * factor;
      const py = stageRect.top + h * 0.5 + sin * factor;
      const dist = Math.round(Math.hypot(t.x - state.player.x, t.y - state.player.y));

      const marker = document.createElement('div');
      marker.className = 'offscreen-arrow';
      marker.style.left = `${px}px`;
      marker.style.top = `${py}px`;
      marker.style.color = t.color;

      const chev = document.createElement('span');
      chev.className = 'offscreen-chevron ui-inline-flex';
      chev.appendChild(createUiIcon('chevronRight', 'ui-svg-icon ui-chev-svg'));
      chev.style.transform = `rotate(${ang}rad)`;

      const txt = document.createElement('span');
      txt.textContent = `${t.label} ${dist}m`;

      marker.append(chev, txt);
      this.offscreenMarkers.appendChild(marker);
    }
  }

  private updateRaidHud(state: GameState): void {
    const obj =
      state.phase === 'PLAYING' &&
      state.boss === null &&
      state.raid?.activeObjective &&
      !state.raid.activeObjective.completed
        ? state.raid.activeObjective
        : null;
    if (!obj) {
      this.raidObjectiveHud.classList.add('hidden');
      return;
    }

    this.raidObjectiveHud.classList.remove('hidden');
    this.raidSectorLabel.textContent = `${this.t.raidSectorPrefix} ${String(
      state.raid.sectorNumber
    ).padStart(2, '0')}`;
    this.raidObjTitle.textContent = this.lang === 'vi' ? obj.titleVi : obj.titleEn;

    const pipKey = `${state.raid.completedCount}/${state.raid.totalRequired}/${obj.kind}`;
    if (pipKey !== this.lastRaidHudKey) {
      this.lastRaidHudKey = pipKey;
      this.raidObjPips.textContent = '';
      const stepIcons: UiIconId[] = ['target', 'lock', 'coin'];
      for (let i = 0; i < state.raid.totalRequired; i++) {
        const pip = document.createElement('span');
        const done = i < state.raid.completedCount;
        const active = i === state.raid.completedCount;
        pip.className = `raid-pip${done ? ' done' : active ? ' active' : ''}`;
        pip.appendChild(createUiIcon(done ? 'check' : stepIcons[i] ?? 'diamond', 'ui-svg-icon'));
        this.raidObjPips.appendChild(pip);
      }
    }

    if (obj.kind === 'vault') {
      const pct = Math.max(0, Math.min(100, (obj.progressMs / Math.max(1, obj.maxProgressMs)) * 100));
      this.raidObjFill.style.width = `${pct}%`;
      this.raidObjFill.style.background = 'linear-gradient(90deg, #38e8ff, #34d399)';
      this.raidObjMeta.textContent = `${Math.round(pct)}% · ${this.t.raidVaultHint}`;
    } else if (obj.kind === 'convoy') {
      const pct = Math.max(0, Math.min(100, (obj.hp / Math.max(1, obj.maxHp)) * 100));
      this.raidObjFill.style.width = `${pct}%`;
      this.raidObjFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      this.raidObjMeta.textContent = `${Math.ceil(obj.hp)} HP · ${this.t.raidConvoyTimer} ${(
        obj.timeLeftMs / 1000
      ).toFixed(1)}s`;
    } else {
      const pct = Math.max(0, Math.min(100, (obj.hp / Math.max(1, obj.maxHp)) * 100));
      this.raidObjFill.style.width = `${pct}%`;
      this.raidObjFill.style.background = 'linear-gradient(90deg, #ff3b4e, #ff7b29)';
      this.raidObjMeta.textContent = `${Math.ceil(obj.hp)} / ${obj.maxHp} HP`;
    }
  }

  private syncMutationHudStrip(state: GameState): void {
    const muts = state.player.activeMutations;
    const key = `${this.lang}|${muts.join(',')}`;
    if (key === this.lastMutationHudKey) return;
    this.lastMutationHudKey = key;
    this.hudMutationStrip.textContent = '';
    if (muts.length === 0) return;

    const counts = computeMutationArchetypeCounts(muts);
    const archOrder: readonly MutationArchetype[] = ['vortex', 'solar', 'swarm', 'chrono'];
    for (const arch of archOrder) {
      const cnt = counts[arch];
      if (cnt <= 0) continue;
      const def = ARCHETYPE_SYNERGY_DEFS[arch];
      const pill = document.createElement('span');
      pill.className = `mut-arch-pill${cnt >= 4 ? ' tier4' : cnt >= 2 ? ' tier2' : ''}`;
      pill.style.setProperty('--mut-accent', def.accent);
      pill.title = this.lang === 'vi' ? `${def.nameVi}: ${def.tier2Vi}` : `${def.nameEn}: ${def.tier2En}`;
      pill.textContent = `${arch.toUpperCase()} ${cnt}`;
      this.hudMutationStrip.appendChild(pill);
    }

    const uniqueMuts = Array.from(new Set(muts));
    for (const id of uniqueMuts) {
      const stacks = countMutationStacks(muts, id);
      const def = MUTATION_CATALOG[id];
      const chip = document.createElement('span');
      chip.className = 'mut-chip';
      const title = this.lang === 'vi' ? def.nameVi : def.nameEn;
      chip.textContent = stacks > 1 ? `${title} x${stacks}` : title;
      this.hudMutationStrip.appendChild(chip);
    }
  }

  public renderQuickDraft(force = false): void {
    const state = this.sim.state;
    const opts = state.raid?.pendingQuickDraft ?? [];
    const rerolls = state.player.rerollsLeft;
    const lvl = state.player.level;
    this.quickDraftKicker.textContent =
      this.lang === 'vi'
        ? `CHIẾN HẠM CẤP ${lvl} // CHỌN 1 NÂNG CẤP`
        : `WARSHIP LEVEL ${lvl} // DRAFT 1 UPGRADE`;
    this.quickDraftTitle.textContent =
      this.lang === 'vi'
        ? `THĂNG CẤP CHIẾN HẠM · CẤP ${lvl}`
        : `WARSHIP LEVEL UP · LV.${lvl}`;
    const key = `${this.lang}|${lvl}|${rerolls}|${opts.map((o) => o.id).join(',')}`;
    this.quickDraftRerollCount.textContent = String(rerolls);
    this.quickDraftRerollBtn.disabled = rerolls <= 0;
    if (!force && key === this.lastQuickDraftKey) return;
    this.lastQuickDraftKey = key;

    this.quickDraftGrid.textContent = '';
    opts.forEach((opt, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `quick-draft-card${opt.isEpic ? ' epic' : ''}`;
      card.style.setProperty('--qd-accent', opt.accent);
      card.style.setProperty('--stagger-idx', String(idx));

      const topRow = document.createElement('div');
      topRow.className = 'qd-top-row';

      const keycap = document.createElement('span');
      keycap.className = 'qd-hotkey';
      keycap.textContent = `[${idx + 1}]`;

      const badge = document.createElement('span');
      badge.className = 'qd-badge';
      badge.textContent = this.lang === 'vi' ? opt.badgeVi : opt.badgeEn;

      topRow.append(keycap, badge);
      if (opt.kind === 'mutation' && opt.mutationId) {
        const def = MUTATION_CATALOG[opt.mutationId];
        const cur = countMutationStacks(state.player.activeMutations, opt.mutationId);
        const stackBadge = document.createElement('span');
        stackBadge.className = 'qd-stack-badge';
        stackBadge.textContent = `x${cur + 1}/${def.maxStacks}`;
        topRow.appendChild(stackBadge);
      }

      const iconWrap = document.createElement('div');
      iconWrap.className = 'qd-icon-wrap';
      if (opt.iconUrl) {
        const img = document.createElement('img');
        img.className = 'qd-icon-img';
        img.src = opt.iconUrl.startsWith('/') ? `.${opt.iconUrl}` : opt.iconUrl;
        img.alt = '';
        iconWrap.appendChild(img);
      } else {
        iconWrap.appendChild(createUiIcon('spark', 'ui-svg-icon qd-fallback-svg'));
      }

      const title = document.createElement('div');
      title.className = 'qd-title';
      title.textContent = this.lang === 'vi' ? opt.titleVi : opt.titleEn;

      const desc = document.createElement('p');
      desc.className = 'qd-desc';
      desc.textContent = this.lang === 'vi' ? opt.descVi : opt.descEn;

      card.append(topRow, iconWrap, title, desc);
      card.addEventListener('click', () => {
        this.sound.unlock();
        if (this.sim.pickQuickDraft(opt.id)) {
          this.sound.playUiConfirm();
        }
      });

      this.quickDraftGrid.appendChild(card);
    });
  }

  public renderRoomSelect(force = false): void {
    const doors = this.sim.state.pendingRoomDoors;
    const key = `${this.lang}|${doors.map((d) => d.id).join(',')}`;
    if (!force && key === this.lastRoomDoorsKey) return;
    this.lastRoomDoorsKey = key;

    this.roomDoorGrid.textContent = '';
    doors.forEach((door, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `room-door-card${door.doubleReward ? ' double' : ''}`;
      card.style.setProperty('--door-accent', door.accent);
      card.style.setProperty('--stagger-idx', String(idx));

      const bannerWrap = document.createElement('div');
      bannerWrap.className = 'door-banner-wrap';

      if (door.bannerUrl) {
        const bannerImg = document.createElement('img');
        bannerImg.className = 'door-banner-img';
        bannerImg.src = door.bannerUrl.startsWith('/') ? `.${door.bannerUrl}` : door.bannerUrl;
        bannerImg.alt = '';
        bannerWrap.appendChild(bannerImg);
      }

      const vignette = document.createElement('div');
      vignette.className = 'door-banner-vignette';
      bannerWrap.appendChild(vignette);

      const topRow = document.createElement('div');
      topRow.className = 'door-top-row';

      const hotkey = document.createElement('span');
      hotkey.className = 'qd-hotkey';
      hotkey.textContent = `[${idx + 1}]`;

      const zonePill = document.createElement('span');
      zonePill.className = 'door-zone-pill';
      zonePill.textContent = this.lang === 'vi' ? door.zoneTagVi : door.zoneTagEn;

      topRow.append(hotkey, zonePill);
      bannerWrap.appendChild(topRow);

      const body = document.createElement('div');
      body.className = 'door-body';

      const riskTag = document.createElement('span');
      riskTag.className = 'door-risk-tag';
      riskTag.textContent = this.lang === 'vi' ? door.riskTagVi : door.riskTagEn;

      const title = document.createElement('div');
      title.className = 'door-title';
      title.textContent = this.lang === 'vi' ? door.titleVi : door.titleEn;

      const reward = document.createElement('p');
      reward.className = 'door-reward';
      reward.textContent = this.lang === 'vi' ? door.rewardVi : door.rewardEn;

      body.append(riskTag, title, reward);
      card.append(bannerWrap, body);
      card.addEventListener('click', () => {
        this.sound.unlock();
        if (this.sim.selectRoomDoor(door.id)) {
          this.sound.playUiConfirm();
        }
      });

      this.roomDoorGrid.appendChild(card);
    });
  }

  private createSpecStatRow(label: string, value: number, accent: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'spec-stat-row';

    const lbl = document.createElement('span');
    lbl.className = 'spec-stat-label';
    lbl.textContent = label;

    const track = document.createElement('div');
    track.className = 'spec-stat-track';
    const fill = document.createElement('div');
    fill.className = 'spec-stat-fill';
    const pct = value <= 5 ? value * 20 : value <= 10 ? value * 10 : value;
    fill.style.width = `${Math.max(12, Math.min(100, pct))}%`;
    fill.style.background = accent;
    track.appendChild(fill);

    row.append(lbl, track);
    return row;
  }

  private renderMenuHulls(): void {
    const profile = metaProgression.getProfile();
    this.menuShardCount.textContent = String(profile.shards);
    this.forgeReadyDot.classList.toggle('hidden', profile.shards < 30);

    const activeDef = HULL_CATALOG[profile.selectedHull];
    this.hangarSpecCard.textContent = '';
    this.hangarSpecCard.style.setProperty('--hull-accent', activeDef.accent);

    const specRole = document.createElement('div');
    specRole.className = 'spec-role-tag';
    specRole.textContent = this.lang === 'vi' ? activeDef.roleVi : activeDef.roleEn;

    const specName = document.createElement('div');
    specName.className = 'spec-hull-name';
    specName.textContent = this.lang === 'vi' ? activeDef.nameVi : activeDef.nameEn;

    const specPassive = document.createElement('p');
    specPassive.className = 'spec-passive-desc';
    specPassive.textContent = this.lang === 'vi' ? activeDef.passiveDescVi : activeDef.passiveDescEn;

    const specStarter = document.createElement('div');
    specStarter.className = 'spec-starter-tag';
    specStarter.textContent =
      this.lang === 'vi' ? 'KHỞI ĐẦU: XUNG QUANG MK.I' : 'STARTER: PULSE BLASTER MK.I';

    const specBars = document.createElement('div');
    specBars.className = 'spec-bars';
    specBars.append(
      this.createSpecStatRow(this.lang === 'vi' ? 'GIÁP' : 'ARMOR', activeDef.statArmor, activeDef.accent),
      this.createSpecStatRow(this.lang === 'vi' ? 'TỐC ĐỘ' : 'SPEED', activeDef.statSpeed, activeDef.accent),
      this.createSpecStatRow(this.lang === 'vi' ? 'KỸ THUẬT' : 'TECH', activeDef.statTech, activeDef.accent)
    );

    this.hangarSpecCard.append(specRole, specName, specPassive, specStarter, specBars);

    this.hullSelectorGrid.textContent = '';
    for (const id of HULL_CLASS_ORDER) {
      const def = HULL_CATALOG[id];
      const unlocked = profile.unlockedHulls.includes(id);
      const selected = profile.selectedHull === id;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `hull-card${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
      card.style.setProperty('--hull-accent', def.accent);

      const artWrap = document.createElement('div');
      artWrap.className = 'hull-art-wrap';
      const art = document.createElement('img');
      art.className = `hull-card-art${id === 'sniper' ? ' mirrored' : ''}`;
      art.src = def.iconUrl.startsWith('/') ? `.${def.iconUrl}` : def.iconUrl;
      art.alt = '';
      artWrap.appendChild(art);

      const top = document.createElement('div');
      top.className = 'hull-card-top';

      const name = document.createElement('span');
      name.className = 'hull-card-name';
      name.textContent = this.lang === 'vi' ? def.nameVi : def.nameEn;

      const tag = document.createElement('span');
      tag.className = 'hull-card-tag';
      tag.textContent = this.lang === 'vi' ? def.roleVi : def.roleEn;

      top.append(name, tag);

      const footer = document.createElement('div');
      footer.className = 'hull-card-cost';
      if (!unlocked) {
        footer.appendChild(createUiIcon('lock', 'ui-svg-icon'));
        footer.appendChild(document.createTextNode(` ${def.unlockCostShards} SHARDS`));
      } else if (selected) {
        footer.appendChild(createUiIcon('check', 'ui-svg-icon'));
        footer.appendChild(document.createTextNode(this.lang === 'vi' ? ' ĐANG CHỌN' : ' SELECTED'));
      } else {
        footer.textContent = this.lang === 'vi' ? 'SẴN SÀNG' : 'READY';
      }

      card.append(artWrap, top, footer);
      card.addEventListener('click', () => {
        this.sound.unlock();
        if (unlocked) {
          metaProgression.selectHull(id);
          this.sound.playUiClick(780);
          this.renderMenuHulls();
        } else if (metaProgression.unlockHull(id)) {
          this.sound.playUiConfirm();
          this.renderMenuHulls();
        } else {
          this.sound.playUiBack();
        }
      });

      this.hullSelectorGrid.appendChild(card);
    }
  }

  private renderMetaForge(): void {
    const profile = metaProgression.getProfile();
    this.metaForgeShardTotal.textContent = String(profile.shards);

    this.metaForgeHullGrid.textContent = '';
    for (const id of HULL_CLASS_ORDER) {
      const def = HULL_CATALOG[id];
      const unlocked = profile.unlockedHulls.includes(id);
      const selected = profile.selectedHull === id;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `hull-card${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
      card.style.setProperty('--hull-accent', def.accent);

      const artWrap = document.createElement('div');
      artWrap.className = 'hull-art-wrap compact';
      const art = document.createElement('img');
      art.className = `hull-card-art${id === 'sniper' ? ' mirrored' : ''}`;
      art.src = def.iconUrl.startsWith('/') ? `.${def.iconUrl}` : def.iconUrl;
      art.alt = '';
      artWrap.appendChild(art);

      const top = document.createElement('div');
      top.className = 'hull-card-top';
      const name = document.createElement('span');
      name.className = 'hull-card-name';
      name.textContent = this.lang === 'vi' ? def.nameVi : def.nameEn;
      const status = document.createElement('span');
      status.className = 'hull-card-tag';
      status.textContent = unlocked
        ? selected
          ? 'ACTIVE'
          : 'READY'
        : `${def.unlockCostShards} SHARDS`;
      top.append(name, status);

      const desc = document.createElement('div');
      desc.className = 'hull-card-stats';
      desc.textContent = this.lang === 'vi' ? def.passiveDescVi : def.passiveDescEn;

      card.append(artWrap, top, desc);
      card.addEventListener('click', () => {
        this.sound.unlock();
        if (unlocked) {
          metaProgression.selectHull(id);
          this.sound.playUiClick(780);
        } else if (metaProgression.unlockHull(id)) {
          this.sound.playUiConfirm();
        } else {
          this.sound.playUiBack();
        }
        this.renderMetaForge();
        this.renderMenuHulls();
      });

      this.metaForgeHullGrid.appendChild(card);
    }

    this.metaForgeUpgradeGrid.textContent = '';
    for (const upgId of META_UPGRADE_ORDER) {
      const def = META_UPGRADE_CATALOG[upgId];
      const lvl = profile.upgrades[upgId] ?? 0;
      const maxed = lvl >= def.maxLevel;
      const cost = maxed ? 0 : metaProgression.getUpgradeCost(upgId);

      const card = document.createElement('div');
      card.className = 'forge-card';

      const top = document.createElement('div');
      top.className = 'forge-card-top';

      const topLeft = document.createElement('div');
      topLeft.className = 'forge-card-title-wrap';
      const upgIcon = document.createElement('img');
      upgIcon.className = 'forge-upg-icon';
      upgIcon.src = def.iconUrl.startsWith('/') ? `.${def.iconUrl}` : def.iconUrl;
      upgIcon.alt = '';
      const title = document.createElement('span');
      title.textContent = this.lang === 'vi' ? def.nameVi : def.nameEn;
      topLeft.append(upgIcon, title);

      const lvlBadge = document.createElement('span');
      lvlBadge.className = 'hull-card-tag';
      lvlBadge.style.color = def.accent;
      lvlBadge.textContent = `LV ${lvl}/${def.maxLevel}`;
      top.append(topLeft, lvlBadge);

      const pips = document.createElement('div');
      pips.className = 'forge-pips';
      for (let i = 0; i < def.maxLevel; i++) {
        const pip = document.createElement('span');
        pip.className = `forge-pip${i < lvl ? ' filled' : ''}`;
        pips.appendChild(pip);
      }

      const desc = document.createElement('p');
      desc.className = 'forge-desc';
      desc.textContent = this.lang === 'vi' ? def.descVi : def.descEn;

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'btn btn-steel btn-sm';
      buyBtn.disabled = maxed || profile.shards < cost;
      buyBtn.textContent = maxed
        ? this.lang === 'vi'
          ? 'ĐÃ TỐI ĐA'
          : 'MAXED'
        : `${this.lang === 'vi' ? 'NÂNG CẤP' : 'UPGRADE'} (${cost})`;
      buyBtn.addEventListener('click', () => {
        this.sound.unlock();
        if (metaProgression.buyUpgrade(upgId)) {
          this.sound.playUiConfirm();
          this.renderMetaForge();
          this.renderMenuHulls();
        } else {
          this.sound.playUiBack();
        }
      });

      card.append(top, pips, desc, buyBtn);
      this.metaForgeUpgradeGrid.appendChild(card);
    }
  }

  private isControlDeckOpen(): boolean {
    return !this.instructionsScreen.classList.contains('hidden');
  }

  private getRoleLabel(role: ControlRoleId): string {
    const s = this.t;
    switch (role) {
      case 'flight':
        return s.roleFlight;
      case 'ordnance':
        return s.roleOrdnance;
      case 'tactical':
        return s.roleTactical;
      case 'systems':
        return s.roleSystems;
    }
  }

  private syncPressedClasses(): void {
    for (const el of this.deckInteractiveEls) {
      const codesAttr = el.dataset.codes;
      if (!codesAttr) continue;
      const codes = codesAttr.split(',');
      const pressed = codes.some((code) => this.activeDeckCodes.has(code));
      el.classList.toggle('is-pressed', pressed);
    }
  }

  private renderControlInspector(bindId: ControlDocId, isPressed: boolean): void {
    const entry = CONTROL_DECK_ITEMS[bindId] ?? CONTROL_DECK_ITEMS.move;
    this.selectedControlBindId = entry.id;

    this.ctrlInspBadge.textContent = entry.keycapLabel;
    this.ctrlInspRole.textContent = this.getRoleLabel(entry.role);
    this.ctrlInspRole.className = `ctrl-insp-role role-${entry.role}`;
    this.ctrlInspTitle.textContent = this.lang === 'vi' ? entry.titleVi : entry.titleEn;
    this.ctrlInspDesc.textContent = this.lang === 'vi' ? entry.descVi : entry.descEn;
    this.ctrlInspStatus.textContent = isPressed ? this.t.inspectorActive : this.t.inspectorStandby;
    this.ctrlInspStatus.classList.toggle('active', isPressed);

    for (const el of this.deckInteractiveEls) {
      el.classList.toggle('is-selected', el.dataset.bind === entry.id);
    }
  }

  private resetControlDeckState(): void {
    this.activeDeckCodes.clear();
    this.pointerDeckCodes.clear();
    for (const el of this.deckInteractiveEls) {
      el.classList.remove('is-pressed');
    }
    this.vmouseSensorDot.style.transform = 'translate(0px, 0px)';
    this.renderControlInspector(this.selectedControlBindId, false);
  }

  private initControlDeckSimulator(): void {
    this.deckInteractiveEls = Array.from(
      this.instructionsScreen.querySelectorAll<HTMLElement>('[data-bind]')
    );
    this.codeToDeckEl.clear();

    for (const el of this.deckInteractiveEls) {
      const bindId = el.dataset.bind as ControlDocId | undefined;
      if (!bindId || !(bindId in CONTROL_DECK_ITEMS)) continue;

      const codesAttr = el.dataset.codes;
      if (codesAttr) {
        for (const raw of codesAttr.split(',')) {
          const code = raw.trim();
          if (!code) continue;
          const list = this.codeToDeckEl.get(code) ?? [];
          list.push(el);
          this.codeToDeckEl.set(code, list);
        }
      }

      const inspect = () => {
        this.renderControlInspector(bindId, this.activeDeckCodes.size > 0);
      };
      el.addEventListener('mouseenter', inspect);
      el.addEventListener('focus', inspect);
      el.addEventListener('click', () => {
        this.sound.unlock();
        this.sound.playUiClick(740);
        this.renderControlInspector(bindId, this.activeDeckCodes.size > 0);
      });

      // Allow holding virtual keys/mouse zones cleanly via pointer press
      if (codesAttr && (el.classList.contains('vkb-key') || el.classList.contains('vmouse-zone'))) {
        const primaryCode = codesAttr.split(',')[0].trim();
        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0 || !primaryCode) return;
          this.pointerDeckCodes.add(primaryCode);
          this.activeDeckCodes.add(primaryCode);
          this.syncPressedClasses();
          this.renderControlInspector(bindId, true);
        });
      }
    }

    const deckPreventCodes = new Set([
      'Space',
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]);

    window.addEventListener('keydown', (e) => {
      if (!this.isControlDeckOpen()) return;
      if (deckPreventCodes.has(e.code)) {
        e.preventDefault();
      }
      const matched = this.codeToDeckEl.get(e.code);
      if (!matched || matched.length === 0) return;

      this.activeDeckCodes.add(e.code);
      this.syncPressedClasses();
      const bindId = (matched[0].dataset.bind as ControlDocId | undefined) ?? this.selectedControlBindId;
      if (!e.repeat) {
        this.sound.unlock();
        this.sound.playUiClick(700);
      }
      this.renderControlInspector(bindId, true);
    });

    window.addEventListener('keyup', (e) => {
      if (!this.activeDeckCodes.has(e.code)) return;
      this.activeDeckCodes.delete(e.code);
      this.syncPressedClasses();
      if (this.isControlDeckOpen()) {
        this.renderControlInspector(this.selectedControlBindId, this.activeDeckCodes.size > 0);
      }
    });

    this.ctrlDeckStage.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.ctrlDeckStage.addEventListener('mousedown', (e) => {
      if (!this.isControlDeckOpen()) return;
      const target = e.target as HTMLElement | null;
      const clickedKeyboard = !!target?.closest('.vkb-key:not(.inert)');

      let mouseCode: string | null = null;
      if (e.button === 1) {
        e.preventDefault();
        mouseCode = 'MMB';
      } else if (e.button === 2) {
        mouseCode = 'RMB';
      } else if (e.button === 0 && !clickedKeyboard && target?.closest('.vmouse-chassis')) {
        if (!target.closest('.vmouse-zone')) {
          mouseCode = 'LMB';
        }
      }
      if (!mouseCode) return;

      const matched = this.codeToDeckEl.get(mouseCode);
      if (!matched || matched.length === 0) return;
      this.pointerDeckCodes.add(mouseCode);
      this.activeDeckCodes.add(mouseCode);
      this.syncPressedClasses();
      const bindId = (matched[0].dataset.bind as ControlDocId | undefined) ?? 'fire';
      this.sound.unlock();
      this.sound.playUiClick(680);
      this.renderControlInspector(bindId, true);
    });

    this.ctrlDeckStage.addEventListener('mousemove', (e) => {
      if (!this.isControlDeckOpen()) return;
      const rect = this.ctrlDeckStage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      const dx = Math.max(-5, Math.min(5, nx * 5));
      const dy = Math.max(-5, Math.min(5, ny * 5));
      this.vmouseSensorDot.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    });

    window.addEventListener('mouseup', () => {
      if (this.pointerDeckCodes.size === 0) return;
      for (const code of this.pointerDeckCodes) {
        this.activeDeckCodes.delete(code);
      }
      this.pointerDeckCodes.clear();
      this.syncPressedClasses();
      if (this.isControlDeckOpen()) {
        this.renderControlInspector(this.selectedControlBindId, this.activeDeckCodes.size > 0);
      }
    });

    window.addEventListener('blur', () => {
      if (this.activeDeckCodes.size > 0 || this.pointerDeckCodes.size > 0) {
        this.resetControlDeckState();
      }
    });
  }
}
