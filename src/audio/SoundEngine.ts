import type { ComboRank } from '../config/constants';
import type { EventBus } from '../engine/EventBus';
import type { BossArchetype } from '../game/types';

const STORAGE_MUTE_KEY = 'spaceshooter_v3_muted';
const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] as const;

export const SFX_MANIFEST = {
  ui_click: ['ui_click.wav'],
  ui_hover: ['ui_hover.wav'],
  ui_confirm: ['ui_confirm.wav'],
  ui_back: ['ui_back.wav'],
  ui_error: ['ui_error.wav'],
  shop_open: ['shop_open.wav'],
  shop_buy: ['shop_buy.wav'],
  level_up: ['level_up.wav'],
  shoot_blaster: ['shoot_blaster_01.wav', 'shoot_blaster_02.wav', 'shoot_blaster_03.wav'],
  shoot_pierce: ['shoot_pierce_01.wav', 'shoot_pierce_02.wav'],
  drone_shot: ['drone_shot_01.wav', 'drone_shot_02.wav'],
  hit_enemy: ['hit_enemy_01.wav', 'hit_enemy_02.wav', 'hit_enemy_03.wav'],
  hit_crit: ['hit_crit_01.wav', 'hit_crit_02.wav'],
  kill_confirm: ['kill_confirm.wav'],
  enemy_explode_sm: ['enemy_explode_sm_01.wav', 'enemy_explode_sm_02.wav', 'enemy_explode_sm_03.wav'],
  enemy_explode_lg: ['enemy_explode_lg_01.wav', 'enemy_explode_lg_02.wav'],
  coin_pickup: ['coin_pickup_01.wav', 'coin_pickup_02.wav', 'coin_pickup_03.wav'],
  powerup_pickup: ['powerup_pickup.wav'],
  dash_thrust: ['dash_thrust.wav'],
  graze_spark: ['graze_spark.wav'],
  player_hurt: ['player_hurt.wav'],
  shield_block: ['shield_block.wav'],
  shield_activate: ['shield_activate.wav'],
  railbeam_fire: ['railbeam_fire.wav'],
  emp_burst: ['emp_burst.wav'],
  bomb_launch: ['bomb_launch.wav'],
  bomb_explode: ['bomb_explode.wav'],
  thermal_purge: ['thermal_purge.wav'],
  parry_reflect: ['parry_reflect.wav'],
  chrono_start: ['chrono_start.wav'],
  chrono_end: ['chrono_end.wav'],
  mutation_acquired: ['mutation_acquired.wav'],
  sortie_launch: ['sortie_launch.wav'],
  warp_jump: ['warp_jump.wav'],
  warp_arrival: ['warp_arrival.wav'],
  module_drop: ['module_drop.wav'],
  boss_charge_warn: ['boss_charge_warn.wav'],
  boss_explode: ['boss_explode.wav'],
  reinforcements_incoming: ['reinforcements_incoming.wav'],
  storm_burn: ['storm_burn.wav'],
  roulette_spin: ['roulette_spin.wav'],
  roulette_claim: ['roulette_claim.wav'],
  augment_install: ['augment_install.wav'],
  game_over: ['game_over.wav'],
} as const;

export type SfxKey = keyof typeof SFX_MANIFEST;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private dcBlocker: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private samples = new Map<SfxKey, AudioBuffer[]>();
  private lastVariantIdx = new Map<SfxKey, number>();
  private loadingPromise: Promise<void> | null = null;

  private muted = false;
  private bossMode = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private coinStreak = 0;
  private lastCoinTime = 0;
  private lastShootTime = 0;
  private lastHitTime = 0;
  private lastHoverTime = 0;
  private lastLowHpBeep = 0;
  private lastDroneShotTime = 0;
  private lastSniperLockTime = 0;
  private lastStormBurnTime = 0;

  constructor(bus: EventBus) {
    try {
      this.muted = localStorage.getItem(STORAGE_MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }

    bus.on('PLAYER_SHOOT', ({ multishot, piercing }) => this.playShoot(multishot, piercing));
    bus.on('PLAYER_DASH', () => this.playDash());
    bus.on('PLAYER_GRAZE', () => this.playGraze());
    bus.on('PLAYER_HIT', ({ shielded }) => (shielded ? this.playShieldBlock() : this.playPlayerHurt()));
    bus.on('PLAYER_HEAL', () => this.playHeal());
    bus.on('BOMB_LAUNCHED', () => this.playBombLaunch());
    bus.on('BOMB_EXPLODED', () => this.playBombExplode());
    bus.on('SKILL_RAILBEAM', () => this.playRailBeam());
    bus.on('SKILL_EMP', () => this.playEmpBurst());
    bus.on('SKILL_MODE_CHANGED', () => this.playSkillSwitch());
    bus.on('ENEMY_HIT', ({ isCrit }) => this.playHit(isCrit));
    bus.on('ENEMY_KILLED', ({ type }) => this.playEnemyExplode(type));
    bus.on('GOLD_COLLECTED', () => this.playCoin());
    bus.on('POWERUP_COLLECTED', () => this.playPowerUp());
    bus.on('BOSS_SPAWNED', ({ archetype }) => {
      this.bossMode = true;
      this.playBossAlarm(archetype, true);
    });
    bus.on('BOSS_ENTRY_IMPACT', ({ archetype }) => this.playBossEntryImpact(archetype));
    bus.on('BOSS_PHASE_CHANGED', ({ archetype, phase }) => this.playBossPhase(archetype, phase));
    bus.on('BOSS_LASER_FIRE', () => this.playLaser());
    bus.on('BOSS_DEFEATED', () => {
      this.bossMode = false;
      this.playBossExplode();
    });
    bus.on('COMBO_KILL', ({ kills, rank }) => this.playComboTick(kills, rank));
    bus.on('COMBO_RANK_UP', ({ rank }) => this.playComboUp(rank));
    bus.on('COMBO_ENDED', ({ rank }) => this.playComboCashIn(rank));
    bus.on('WAVE_CLEARED', ({ bonus }) => this.playWaveCleared(bonus));
    bus.on('SHOP_OPENED', () => this.playShopOpen());
    bus.on('SHOP_PURCHASED', () => this.playShopBuy());
    bus.on('SHOP_REFRESHED', () => this.playUiClick(520));
    bus.on('SHOP_ERROR', () => this.playError());
    bus.on('GARAGE_MOUNTED', () => this.playGarageMount());
    bus.on('GARAGE_UNMOUNTED', () => this.playGarageUnmount());
    bus.on('GARAGE_UPGRADED', () => this.playGarageUpgrade());
    bus.on('GARAGE_FUSED', () => this.playFusionForge());
    bus.on('MODULE_COLLECTED', () => this.playShopBuy());
    bus.on('OVERLOAD_STARTED', () => this.playOverloadWarn());
    bus.on('PLAYER_PARRY', () => this.playParry());
    bus.on('PLAYER_EXECUTE', () => this.playExecute());
    bus.on('THERMAL_PURGE', () => this.playThermalPurge());
    bus.on('ELEMENTAL_COMBO', ({ kind }) => this.playElementalCombo(kind));
    bus.on('BARREL_EXPLODED', () => this.playBarrelExplode());
    bus.on('ASTEROID_SHATTERED', () => this.playEnemyExplode('medium'));
    bus.on('RAID_OBJECTIVE_SPAWNED', () => this.playUiClick(740));
    bus.on('RAID_OBJECTIVE_COMPLETED', () => this.playRaidComplete());
    bus.on('QUICK_DRAFT_OPENED', () => this.playQuickDraftOpen());
    bus.on('CHRONO_STARTED', () => this.playChronoStart());
    bus.on('CHRONO_ENDED', () => this.playChronoEnd());
    bus.on('MUTATION_ACQUIRED', () => this.playMutationAcquired());
    bus.on('LEVEL_UP', () => this.playLevelUp());
    bus.on('WARP_JUMP_STARTED', () => this.playWarpJump());
    bus.on('ROOM_DOORS_OPENED', () => this.playRoomDoorsOpen());
    bus.on('ROOM_ENTERED', () => this.playRoomEnter());
    bus.on('SNIPER_LOCK', () => this.playSniperLock());
    bus.on('SINGULARITY_DETONATED', () => this.playSingularityDetonate());
    bus.on('DRONE_SHOT', () => this.playDroneShot());
    bus.on('GAME_STARTED', () => this.playSortieLaunch());
    bus.on('SHIELD_TRIGGERED', () => this.playShieldActivate());
    bus.on('BOSS_CHARGE_START', () => this.playBossChargeWarn());
    bus.on('MODULE_DROPPED', () => this.playModuleDrop());
    bus.on('ROULETTE_SPUN', () => this.playRouletteSpin());
    bus.on('ROULETTE_CLAIMED', () => this.playRouletteClaim());
    bus.on('AUGMENT_SELECTED', () => this.playAugmentInstall());
    bus.on('WARP_ARRIVED', () => this.playWarpArrival());
    bus.on('REINFORCEMENTS_SPAWNED', () => this.playReinforcementsIncoming());
    bus.on('STORM_BURN_TICK', () => this.playStormBurn());
    bus.on('WAVE_TRANSITION', ({ wave, isBoss }) =>
      isBoss ? this.playBossAlarm(0, false) : this.playWaveChime(wave)
    );
    bus.on('PHASE_CHANGED', ({ to }) => {
      if (to === 'MENU' || to === 'GAMEOVER') {
        this.bossMode = false;
      }
      this.updateMusicDucking(to === 'PLAYING');
    });
    bus.on('GAME_OVER', () => this.playGameOver());
  }

  unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      // Anti-pop master chain: chop off sub-28Hz DC rumble before the compressor squashes spikes
      this.dcBlocker = this.ctx.createBiquadFilter();
      this.dcBlocker.type = 'highpass';
      this.dcBlocker.frequency.value = 28;
      this.dcBlocker.Q.value = 0.707;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -10;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.09;

      this.sfxGain.gain.value = 0.55;
      this.musicGain.gain.value = 0.16;
      this.masterGain.gain.value = this.muted ? 0 : 0.85;

      this.sfxGain.connect(this.dcBlocker);
      this.musicGain.connect(this.dcBlocker);
      this.dcBlocker.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.startAmbientPulse();
    }
    this.preloadSamples();
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private decodeBase64Pcm16(ctx: AudioContext, b64: string, sampleRate: number): AudioBuffer {
    const bin = atob(b64);
    const sampleCount = bin.length >> 1;
    const audioBuf = ctx.createBuffer(1, Math.max(1, sampleCount), sampleRate);
    const ch = audioBuf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      const lo = bin.charCodeAt(i * 2);
      const hi = bin.charCodeAt(i * 2 + 1);
      let val = (hi << 8) | lo;
      if (val >= 0x8000) val -= 0x10000;
      ch[i] = val / 32768;
    }
    return audioBuf;
  }

  private preloadSamples(): void {
    if (this.loadingPromise || !this.ctx || typeof fetch !== 'function') return;
    const ctx = this.ctx;
    this.loadingPromise = (async () => {
      try {
        // Pack all 56 clips into one JSON payload because IDM still tries to hijack every .wav request like it's 2009
        const res = await fetch('./assets/sfx-bank.json', {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          sampleRate?: number;
          clips?: Record<string, string[]>;
        };
        const sr = typeof payload.sampleRate === 'number' && payload.sampleRate > 0 ? payload.sampleRate : 44100;
        const clips = payload.clips ?? {};
        const keys = Object.keys(SFX_MANIFEST) as SfxKey[];
        for (const key of keys) {
          const encodedList = clips[key];
          if (!Array.isArray(encodedList) || encodedList.length === 0) continue;
          const decoded: AudioBuffer[] = [];
          for (const b64 of encodedList) {
            if (typeof b64 !== 'string' || b64.length === 0) continue;
            decoded.push(this.decodeBase64Pcm16(ctx, b64, sr));
          }
          if (decoded.length > 0) {
            this.samples.set(key, decoded);
          }
        }
      } catch {
        // If someone's proxy blocks sfx-bank.json, fall back quietly to live WebAudio synthesis
      }
    })();
  }

  private playSample(
    key: SfxKey,
    gainScale = 1.0,
    jitterSemitones = 0,
    explicitRate?: number
  ): boolean {
    if (this.muted || !this.ctx || !this.sfxGain || this.ctx.state !== 'running') {
      return true;
    }
    const variants = this.samples.get(key);
    if (!variants || variants.length === 0) return false;

    let idx = 0;
    if (variants.length > 1) {
      const prev = this.lastVariantIdx.get(key) ?? -1;
      idx = Math.floor(Math.random() * variants.length);
      if (idx === prev) {
        idx = (idx + 1) % variants.length;
      }
      this.lastVariantIdx.set(key, idx);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = variants[idx];
    if (explicitRate !== undefined) {
      source.playbackRate.value = explicitRate;
    } else if (jitterSemitones > 0) {
      const semi = (Math.random() * 2 - 1) * jitterSemitones;
      source.playbackRate.value = Math.pow(2, semi / 12);
    }

    if (Math.abs(gainScale - 1.0) > 0.01) {
      const g = this.ctx.createGain();
      g.gain.value = Math.max(0.05, gainScale);
      source.connect(g).connect(this.sfxGain);
    } else {
      source.connect(this.sfxGain);
    }

    source.start(this.ctx.currentTime);
    return true;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(STORAGE_MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Incognito tabs hate localStorage; carry on without throwing
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.03);
    }
    return this.muted;
  }

  playUiClick(freq = 640): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const rate = Math.max(0.75, Math.min(1.45, freq / 640));
    if (this.playSample('ui_click', 0.85, 0.35, rate)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playUiHover(pitchOffset = 0): void {
    if (this.muted || !this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastHoverTime < 0.038) return;
    this.lastHoverTime = now;
    if (this.playSample('ui_hover', 0.62, 0.25, Math.pow(2, pitchOffset / 12))) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const startFreq = 1160 + pitchOffset * 55;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.024);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  playUiConfirm(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('ui_confirm', 0.9)) return;
    const now = this.ctx.currentTime;
    [580, 870, 1160].forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.032;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  playUiBack(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('ui_back', 0.9)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playModalTransition(opening: boolean): void {
    if (this.muted || !this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(opening ? 240 : 460, now);
    osc.frequency.exponentialRampToValueAtTime(opening ? 520 : 210, now + 0.11);

    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.2, now);
    filter.frequency.setValueAtTime(opening ? 480 : 320, now);

    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(filter).connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playShopToggle(selected: boolean): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(selected ? 720 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(selected ? 1080 : 340, now + 0.065);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playCountTick(step = 0): void {
    if (this.muted || !this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(840 + (step % 6) * 45, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.024);
  }

  playLowHpAlert(): void {
    if (this.muted || !this.ctx || !this.sfxGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastLowHpBeep < 1.15) return;
    this.lastLowHpBeep = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.14);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  private updateMusicDucking(inCombat: boolean): void {
    if (!this.ctx || !this.musicGain) return;
    const target = inCombat ? (this.bossMode ? 0.2 : 0.15) : 0.07;
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  private startAmbientPulse(): void {
    if (this.bgmTimer !== null) return;
    const scaleNormal = [110, 130.81, 146.83, 164.81, 196.0, 164.81, 146.83, 130.81];
    const scaleBoss = [98, 98, 116.54, 130.81, 98, 146.83, 130.81, 116.54];

    const scheduleBeat = () => {
      const delayMs = this.bossMode ? 280 : 360;
      this.bgmTimer = window.setTimeout(() => {
        if (!this.muted && this.ctx && this.musicGain && this.ctx.state === 'running') {
          const now = this.ctx.currentTime;
          const notes = this.bossMode ? scaleBoss : scaleNormal;
          const freq = notes[this.bgmStep % notes.length];
          this.bgmStep++;

          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = this.bossMode ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(this.bossMode ? 420 : 250, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.20, now + 0.065);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

          osc.connect(filter).connect(gain).connect(this.musicGain);
          osc.start(now);
          osc.stop(now + 0.36);
        }
        if (this.bgmTimer !== null) {
          scheduleBeat();
        }
      }, delayMs);
    };

    scheduleBeat();
  }

  private playShoot(multishot: number, piercing: boolean): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastShootTime < 0.045) return;
    this.lastShootTime = now;

    const sampleVol = Math.min(0.88, 0.56 + multishot * 0.05);
    if (this.playSample(piercing ? 'shoot_pierce' : 'shoot_blaster', sampleVol, 0.9)) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const jitter = 0.94 + Math.random() * 0.12;
    const baseFreq = (piercing ? 920 : 760) * jitter;

    osc.type = piercing ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.085);

    const vol = Math.min(0.24, 0.14 + multishot * 0.015);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  private playDash(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('dash_thrust', 0.95, 0.75)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playHit(isCrit: boolean): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHitTime < 0.03) return;
    this.lastHitTime = now;

    if (this.playSample(isCrit ? 'hit_crit' : 'hit_enemy', isCrit ? 1.18 : 0.96, isCrit ? 0.6 : 1.3)) {
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isCrit ? 'sine' : 'square';
    osc.frequency.setValueAtTime(isCrit ? 1280 : 320 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 1760 : 120, now + 0.055);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(isCrit ? 0.19 : 0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  private playEnemyExplode(type: string): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const isLarge = type === 'elite' || type === 'large';
    if (this.playSample(isLarge ? 'enemy_explode_lg' : 'enemy_explode_sm', isLarge ? 1.12 : 0.96, 1.0)) {
      this.playSample('kill_confirm', isLarge ? 0.52 : 0.42, 0, isLarge ? 0.84 : 1.0);
      return;
    }
    const now = this.ctx.currentTime;
    const pitch = type === 'elite' ? 110 : type === 'large' ? 140 : type === 'medium' ? 185 : 230;
    const dur = isLarge ? 0.26 : 0.16;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch * (0.9 + Math.random() * 0.2), now);
    osc.frequency.exponentialRampToValueAtTime(36, now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);

    this.playNoiseBurst(dur * 0.85, 0.14, 900);
  }

  private playSkillSwitch(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('ui_confirm', 0.65, 0, 1.15)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.055);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  private playGraze(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('graze_spark', 0.82, 0.9)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.exponentialRampToValueAtTime(1980, now + 0.055);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  private playRailBeam(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('railbeam_fire', 1.08, 0.4)) return;
    const now = this.ctx.currentTime;

    // Sharp high-voltage snap up front so the beam reads instantly
    const crack = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(1240, now);
    crack.frequency.exponentialRampToValueAtTime(120, now + 0.48);
    crackGain.gain.setValueAtTime(0.0001, now);
    crackGain.gain.linearRampToValueAtTime(0.32, now + 0.005);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    crack.connect(crackGain).connect(this.sfxGain);
    crack.start(now);
    crack.stop(now + 0.54);

    // Sub-bass gut punch underneath so your desk remembers you fired
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.52);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.45, now + 0.006);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    sub.connect(subGain).connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.56);

    this.playNoiseBurst(0.36, 0.25, 1600);
  }

  private playEmpBurst(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('emp_burst', 1.06, 0.4)) return;
    const now = this.ctx.currentTime;

    const drop = this.ctx.createOscillator();
    const dropGain = this.ctx.createGain();
    drop.type = 'sine';
    drop.frequency.setValueAtTime(420, now);
    drop.frequency.exponentialRampToValueAtTime(32, now + 0.48);
    dropGain.gain.setValueAtTime(0.0001, now);
    dropGain.gain.linearRampToValueAtTime(0.48, now + 0.006);
    dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    drop.connect(dropGain).connect(this.sfxGain);
    drop.start(now);
    drop.stop(now + 0.54);

    // Spicy little arc crackles riding on top of the EMP bass drop
    [1180, 1520, 1890, 2240].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const t = now + idx * 0.045;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.11);
    });

    this.playNoiseBurst(0.32, 0.22, 2200);
  }

  private playBombLaunch(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('bomb_launch', 0.95, 0.8)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  private playBombExplode(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('bomb_explode', 1.12, 0.6)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.6);

    this.playNoiseBurst(0.45, 0.3, 600);
  }

  private playShieldBlock(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('shield_block', 0.95, 0.5)) return;
    const now = this.ctx.currentTime;
    for (const freq of [520, 780, 1040]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.21);
    }
  }

  private playPlayerHurt(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('player_hurt', 1.05, 0.5)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.38, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  private playCoin(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCoinTime < 0.48) {
      this.coinStreak = Math.min(PENTATONIC_SEMITONES.length - 1, this.coinStreak + 1);
    } else {
      this.coinStreak = 0;
    }
    this.lastCoinTime = now;

    const semi = PENTATONIC_SEMITONES[this.coinStreak];
    const pitchRate = Math.pow(2, semi / 12);
    if (this.playSample('coin_pickup', 0.88, 0, pitchRate)) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const base = 740 + this.coinStreak * 65;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.setValueAtTime(base * 1.25, now + 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  private playPowerUp(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('powerup_pickup', 0.92, 0.4)) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.05;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  private playHeal(): void {
    this.playPowerUp();
  }

  private playComboTick(kills: number, rank: ComboRank): void {
    if (kills < 2 || this.muted || !this.ctx || !this.sfxGain) return;
    const idx = Math.min(PENTATONIC_SEMITONES.length - 1, Math.max(0, kills - 2));
    const highRank = rank === 'SSS' || rank === 'SS' || rank === 'S';
    const rate = Math.pow(2, PENTATONIC_SEMITONES[idx] / 12);
    if (this.playSample('kill_confirm', highRank ? 0.72 : 0.55, 0, rate)) return;

    const now = this.ctx.currentTime;
    const pentatonic = [
      523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0,
    ];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = highRank ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(pentatonic[idx], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  private playComboUp(rank?: ComboRank): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const highTier = rank === 'S' || rank === 'SS' || rank === 'SSS';
    const notes = highTier
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
      : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = highTier ? 'sawtooth' : 'triangle';
      const t = now + i * 0.036;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(highTier ? 0.12 : 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.21);
    });
  }

  private playComboCashIn(rank: ComboRank): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const chord =
      rank === 'SSS' || rank === 'SS' || rank === 'S'
        ? [392.0, 493.88, 587.33, 783.99]
        : [329.63, 440.0, 523.25];
    chord.forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.025);
      gain.gain.setValueAtTime(0.11, now + i * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(now + i * 0.025);
      osc.stop(now + 0.36);
    });
  }

  private playBossAlarm(archetype: BossArchetype = 0, includeCharge = true): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Obligatory movie-trailer sci-fi BRAAAM (every boss deserves a dramatic entrance)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.8, now);
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.exponentialRampToValueAtTime(880, now + 0.38);
    filter.frequency.exponentialRampToValueAtTime(220, now + 1.12);

    const braamGain = this.ctx.createGain();
    braamGain.gain.setValueAtTime(0.01, now);
    braamGain.gain.linearRampToValueAtTime(0.26, now + 0.14);
    braamGain.gain.exponentialRampToValueAtTime(0.001, now + 1.16);
    filter.connect(braamGain).connect(this.sfxGain);

    for (const freq of [55, 55.8]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + 1.18);
    }

    // Rising turbine whine synced to the boss slamming into the arena
    if (includeCharge) {
      this.playSample('boss_charge_warn', 0.72);
      const chargeOsc = this.ctx.createOscillator();
      const chargeGain = this.ctx.createGain();
      chargeOsc.type = archetype === 3 ? 'sawtooth' : 'triangle';
      const startFreq =
        archetype === 2 || archetype === 5 ? 180 : archetype === 4 ? 220 : archetype === 3 ? 110 : 140;
      chargeOsc.frequency.setValueAtTime(startFreq, now);
      chargeOsc.frequency.exponentialRampToValueAtTime(archetype === 4 ? 920 : 780, now + 1.15);
      chargeGain.gain.setValueAtTime(0.02, now);
      chargeGain.gain.linearRampToValueAtTime(0.24, now + 1.05);
      chargeGain.gain.exponentialRampToValueAtTime(0.001, now + 1.18);
      chargeOsc.connect(chargeGain).connect(this.sfxGain);
      chargeOsc.start(now);
      chargeOsc.stop(now + 1.2);
    }

    // Two cockpit alarm pings so even muted-TV players notice something big warped in
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.32;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.linearRampToValueAtTime(560, t + 0.15);
      osc.frequency.linearRampToValueAtTime(310, t + 0.28);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.31);
    }
  }

  private playBossEntryImpact(archetype: BossArchetype): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Sub-bass thump for the landing shockwave
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(115, now);
    subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.78);
    subGain.gain.setValueAtTime(0.62, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    subOsc.connect(subGain).connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.82);

    this.playNoiseBurst(0.55, 0.36, 750);

    // Give each boss chassis its own little audio calling card
    if (archetype === 0) {
      const lockOsc = this.ctx.createOscillator();
      const lockGain = this.ctx.createGain();
      lockOsc.type = 'square';
      lockOsc.frequency.setValueAtTime(180, now);
      lockOsc.frequency.exponentialRampToValueAtTime(65, now + 0.24);
      lockGain.gain.setValueAtTime(0.24, now);
      lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      lockOsc.connect(lockGain).connect(this.sfxGain);
      lockOsc.start(now);
      lockOsc.stop(now + 0.28);

      const pingOsc = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      pingOsc.type = 'triangle';
      pingOsc.frequency.setValueAtTime(920, now + 0.06);
      pingGain.gain.setValueAtTime(0.18, now + 0.06);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      pingOsc.connect(pingGain).connect(this.sfxGain);
      pingOsc.start(now + 0.06);
      pingOsc.stop(now + 0.34);
    } else if (archetype === 1) {
      const pairs: Array<[number, number]> = [
        [260, 110],
        [395, 165],
      ];
      for (const [f0, f1] of pairs) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f0, now);
        osc.frequency.exponentialRampToValueAtTime(f1, now + 0.65);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.7);
      }
    } else if (archetype === 3) {
      // Robo-snake growl for Leviathan
      for (const [f0, f1] of [
        [160, 42],
        [320, 96],
      ] as const) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f0, now);
        osc.frequency.exponentialRampToValueAtTime(f1, now + 0.62);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.66);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.68);
      }
    } else if (archetype === 4) {
      // Stereo twin chime for Gemini ("double trouble" energy)
      for (const freq of [293.66, 440, 587.33, 880]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.55);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.64);
      }
    } else if (archetype === 5) {
      // Chunky anvil clang for Bastion dropping its blast shutters
      const anvil = this.ctx.createOscillator();
      const anvilGain = this.ctx.createGain();
      anvil.type = 'square';
      anvil.frequency.setValueAtTime(145, now);
      anvil.frequency.exponentialRampToValueAtTime(48, now + 0.42);
      anvilGain.gain.setValueAtTime(0.28, now);
      anvilGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
      anvil.connect(anvilGain).connect(this.sfxGain);
      anvil.start(now);
      anvil.stop(now + 0.46);
    } else {
      for (const freq of [220, 330, 440, 660]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.75);
      }
    }
  }

  private playBossPhase(archetype: BossArchetype, phase: 2 | 3): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const intensity = phase === 3 ? 1.25 : 1.0;

    if (archetype === 0) {
      // Destroyer slams another blast door open and revs the turbines
      this.playNoiseBurst(0.32, 0.34 * intensity, 680);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(phase === 3 ? 340 : 240, now + 0.55);
      gain.gain.setValueAtTime(0.32 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.65);
    } else if (archetype === 1) {
      // Summoner sucks air into a tiny void rift and screeches
      for (const [f0, f1] of [
        [480, 95],
        [320, 620 * intensity],
      ] as const) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f0, now);
        osc.frequency.exponentialRampToValueAtTime(f1, now + 0.68);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.75);
      }
    } else if (archetype === 2) {
      // Overlord: dramatic golden choir chord right before it tries to vaporize you
      const chord = phase === 3 ? [261.63, 392.0, 523.25, 783.99, 1046.5] : [261.63, 329.63, 523.25, 659.25];
      chord.forEach((f, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.03);
        gain.gain.setValueAtTime(0.14, now + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(now + idx * 0.03);
        osc.stop(now + 0.85);
      });
    } else if (archetype === 3) {
      // Leviathan: angry metallic snake hiss
      this.playNoiseBurst(0.45, 0.28 * intensity, 1650);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.65);
      gain.gain.setValueAtTime(0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.70);
    } else if (archetype === 4) {
      // Gemini: two-tone polarity sync whistle
      for (const [f0, f1] of [
        [330, 660 * intensity],
        [495, 990 * intensity],
      ] as const) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f0, now);
        osc.frequency.exponentialRampToValueAtTime(f1, now + 0.56);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    } else {
      // Bastion: armor plates yeeting off + furnace roar
      this.playNoiseBurst(0.42, 0.42 * intensity, 1100);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(phase === 3 ? 280 : 195, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.55);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.60);
    }
  }

  private playLaser(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.45);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  private playBossExplode(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('boss_explode', 1.18)) return;
    this.playBombExplode();
    setTimeout(() => {
      if (this.muted || !this.ctx || !this.sfxGain) return;
      const now = this.ctx.currentTime;
      [261.63, 329.63, 392.0, 523.25].forEach((f, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.06;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.16, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        osc.connect(gain).connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.48);
      });
    }, 240);
  }

  private playWaveChime(wave = 1): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const base = 392 + Math.min(8, wave) * 14;
    [base, base * 1.334].forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  private playWaveCleared(bonus: number): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = bonus >= 60 ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.055;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  private playShopOpen(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('shop_open', 0.92)) return;
    const now = this.ctx.currentTime;
    const hum = this.ctx.createOscillator();
    const humGain = this.ctx.createGain();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(95, now);
    hum.frequency.linearRampToValueAtTime(145, now + 0.28);
    humGain.gain.setValueAtTime(0.0001, now);
    humGain.gain.linearRampToValueAtTime(0.16, now + 0.008);
    humGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    hum.connect(humGain).connect(this.sfxGain);
    hum.start(now);
    hum.stop(now + 0.34);

    [330.0, 440.0, 659.25].forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + 0.05 + i * 0.06;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  private playShopBuy(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('shop_buy', 0.95)) return;
    const now = this.ctx.currentTime;
    [587.33, 880].forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.07;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  private playGarageMount(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    // Satisfying ratchet thunk when bolting a gun onto the wing
    const lock = this.ctx.createOscillator();
    const lockGain = this.ctx.createGain();
    lock.type = 'sawtooth';
    lock.frequency.setValueAtTime(160, now);
    lock.frequency.exponentialRampToValueAtTime(52, now + 0.11);
    lockGain.gain.setValueAtTime(0.24, now);
    lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    lock.connect(lockGain).connect(this.sfxGain);
    lock.start(now);
    lock.stop(now + 0.14);

    // Little weapon-ready chirp right after the bolt locks
    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(580, now + 0.06);
    ping.frequency.exponentialRampToValueAtTime(980, now + 0.21);
    pingGain.gain.setValueAtTime(0.18, now + 0.06);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    ping.connect(pingGain).connect(this.sfxGain);
    ping.start(now + 0.06);
    ping.stop(now + 0.24);
  }

  private playGarageUnmount(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    this.playNoiseBurst(0.11, 0.14, 1800);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);
    gain.gain.setValueAtTime(0.16, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now + 0.04);
    osc.stop(now + 0.21);
  }

  private playGarageUpgrade(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 1046.5].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.048;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playRouletteTick(pitchFactor = 1.0): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640 + pitchFactor * 360, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.032);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  playRouletteReveal(rarity: 'common' | 'rare' | 'epic'): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const chord =
      rarity === 'epic'
        ? [523.25, 659.25, 783.99, 1046.5]
        : rarity === 'rare'
          ? [440, 554.37, 659.25]
          : [392, 493.88];
    chord.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = rarity === 'epic' ? 'sawtooth' : 'triangle';
      const t = now + idx * 0.04;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  private playFusionForge(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    this.playNoiseBurst(0.14, 0.22, 2200);
    const now = this.ctx.currentTime;
    [330, 440, 659.25, 880, 1318.5].forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  private playOverloadWarn(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.16);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private playError(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('ui_error', 0.95)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(120, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private playGameOver(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('game_over', 1.0)) return;
    const now = this.ctx.currentTime;
    [392, 349.23, 311.13, 261.63].forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.16;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  private playNoiseBurst(durationSec: number, volume: number, cutoffHz: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    noise.connect(filter).connect(gain).connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + durationSec);
  }

  private playParry(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('parry_reflect', 0.98, 0.5)) return;
    const now = this.ctx.currentTime;
    [980, 1480].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.03;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.45, t + 0.09);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  private playExecute(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.16);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
    this.playNoiseBurst(0.12, 0.16, 1500);
  }

  private playThermalPurge(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('thermal_purge', 1.0, 0.4)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.36);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
    this.playNoiseBurst(0.28, 0.24, 2400);
  }

  private playElementalCombo(kind: 'shatter' | 'arc_chain' | 'overload'): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const base = kind === 'shatter' ? 540 : kind === 'arc_chain' ? 880 : 420;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = kind === 'arc_chain' ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.65, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  private playBarrelExplode(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(145, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.38);
    gain.gain.setValueAtTime(0.36, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    sub.connect(gain).connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.42);
    this.playNoiseBurst(0.28, 0.24, 1100);
  }

  private playRaidComplete(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.055;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  private playQuickDraftOpen(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [440, 660, 880].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.04;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  private playEnvelopeOsc(
    type: OscillatorType,
    fStart: number,
    fEnd: number,
    peakGain: number,
    attackSec: number,
    durSec: number,
    offsetSec = 0
  ): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + offsetSec;
    const atk = Math.max(0.005, attackSec);
    const dur = Math.max(atk + 0.015, durSec);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, fStart), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + atk);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.012);
  }

  private playChronoStart(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('chrono_start', 1.05)) return;
    this.playEnvelopeOsc('sine', 260, 48, 0.34, 0.008, 0.42, 0);
    this.playEnvelopeOsc('triangle', 1240, 520, 0.14, 0.012, 0.34, 0.01);
  }

  private playChronoEnd(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('chrono_end', 0.92)) return;
    this.playEnvelopeOsc('sine', 160, 620, 0.2, 0.008, 0.18, 0);
    this.playEnvelopeOsc('triangle', 420, 960, 0.1, 0.006, 0.15, 0.02);
  }

  private playSniperLock(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSniperLockTime < 0.08) return;
    this.lastSniperLockTime = now;
    this.playEnvelopeOsc('sine', 1320, 1760, 0.2, 0.006, 0.085, 0);
    this.playEnvelopeOsc('triangle', 1760, 1980, 0.14, 0.005, 0.08, 0.065);
  }

  private playMutationAcquired(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('mutation_acquired', 0.98)) return;
    this.playEnvelopeOsc('triangle', 440, 554.37, 0.16, 0.008, 0.16, 0);
    this.playEnvelopeOsc('triangle', 659.25, 880, 0.15, 0.008, 0.2, 0.045);
    this.playEnvelopeOsc('sine', 880, 1318.5, 0.12, 0.01, 0.24, 0.09);
  }

  private playLevelUp(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('level_up', 1.0)) return;
    this.playEnvelopeOsc('triangle', 523.25, 659.25, 0.16, 0.007, 0.14, 0);
    this.playEnvelopeOsc('sine', 783.99, 1046.5, 0.15, 0.008, 0.18, 0.05);
    this.playEnvelopeOsc('sine', 1046.5, 1318.5, 0.12, 0.009, 0.22, 0.1);
  }

  private playWarpJump(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('warp_jump', 1.08)) return;
    this.playEnvelopeOsc('sine', 190, 42, 0.3, 0.009, 0.44, 0);
    this.playEnvelopeOsc('triangle', 260, 1420, 0.15, 0.014, 0.42, 0.03);
    this.playEnvelopeOsc('sine', 520, 1860, 0.1, 0.018, 0.36, 0.08);
  }

  private playRoomDoorsOpen(): void {
    this.playEnvelopeOsc('sine', 180, 360, 0.18, 0.012, 0.24, 0);
    this.playEnvelopeOsc('triangle', 540, 810, 0.12, 0.01, 0.22, 0.04);
  }

  private playRoomEnter(): void {
    this.playEnvelopeOsc('sine', 120, 420, 0.22, 0.008, 0.26, 0);
    this.playEnvelopeOsc('triangle', 420, 740, 0.12, 0.008, 0.22, 0.03);
  }

  private playSingularityDetonate(): void {
    this.playEnvelopeOsc('sawtooth', 95, 34, 0.28, 0.007, 0.36, 0);
    this.playEnvelopeOsc('sine', 380, 110, 0.22, 0.006, 0.28, 0.015);
  }

  private playDroneShot(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDroneShotTime < 0.065) return;
    this.lastDroneShotTime = now;
    if (this.playSample('drone_shot', 0.68, 1.15)) return;
    this.playEnvelopeOsc('triangle', 920, 420, 0.16, 0.005, 0.075, 0);
  }

  private playSortieLaunch(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('sortie_launch', 1.0)) return;
    this.playEnvelopeOsc('sine', 160, 480, 0.22, 0.01, 0.38, 0);
  }

  private playShieldActivate(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('shield_activate', 0.92)) return;
    this.playEnvelopeOsc('triangle', 420, 840, 0.16, 0.01, 0.24, 0);
  }

  private playBossChargeWarn(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('boss_charge_warn', 0.95)) return;
    this.playEnvelopeOsc('sawtooth', 220, 480, 0.2, 0.01, 0.26, 0);
  }

  private playModuleDrop(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('module_drop', 0.92)) return;
    this.playEnvelopeOsc('triangle', 660, 1120, 0.16, 0.008, 0.22, 0);
  }

  private playRouletteSpin(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('roulette_spin', 0.88)) return;
    this.playEnvelopeOsc('triangle', 520, 960, 0.14, 0.008, 0.18, 0);
  }

  private playRouletteClaim(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('roulette_claim', 0.95)) return;
    this.playEnvelopeOsc('sine', 587.33, 1174.66, 0.18, 0.01, 0.3, 0);
  }

  private playAugmentInstall(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('augment_install', 0.98)) return;
    this.playEnvelopeOsc('triangle', 260, 520, 0.2, 0.01, 0.28, 0);
  }

  private playWarpArrival(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('warp_arrival', 1.05)) return;
    this.playEnvelopeOsc('sine', 540, 110, 0.24, 0.01, 0.36, 0);
  }

  private playReinforcementsIncoming(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (this.playSample('reinforcements_incoming', 0.88)) return;
    this.playEnvelopeOsc('triangle', 620, 440, 0.14, 0.01, 0.24, 0);
  }

  private playStormBurn(): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStormBurnTime < 0.38) return;
    this.lastStormBurnTime = now;
    if (this.playSample('storm_burn', 0.65, 0.8)) return;
    this.playEnvelopeOsc('sawtooth', 180, 110, 0.1, 0.008, 0.09, 0);
  }

  destroy(): void {
    if (this.bgmTimer !== null) {
      window.clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    void this.ctx?.close();
  }
}
