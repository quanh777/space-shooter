import { COMBO_TIERS, COMBO_WINDOW_MS, type ComboRank } from '../../config/constants';
import type { EventBus } from '../../engine/EventBus';
import { addScreenShake, spawnParticleBurst } from '../GameState';
import type { EnemyType, GameState } from '../types';

function resolveComboTier(kills: number): { rank: ComboRank; color: string; multiplier: number } {
  for (const tier of COMBO_TIERS) {
    if (kills >= tier.minKills) {
      return { rank: tier.rank, color: tier.color, multiplier: tier.multiplier };
    }
  }
  return { rank: 'D', color: '#55bbff', multiplier: 1.0 };
}

export function registerComboKill(
  state: GameState,
  bus: EventBus,
  baseScore: number,
  enemyType: EnemyType
): number {
  const prevRank = state.combo.rank;
  const prevKills = state.combo.kills;

  state.combo.kills++;
  state.combo.timerMs = COMBO_WINDOW_MS;
  state.combo.maxCombo = Math.max(state.combo.maxCombo, state.combo.kills);
  state.combo.breakdown[enemyType]++;

  const tier = resolveComboTier(state.combo.kills);
  state.combo.rank = tier.rank;
  state.combo.color = tier.color;
  state.combo.multiplier = tier.multiplier;

  const earnedScore = Math.floor(baseScore * tier.multiplier);
  state.score += earnedScore;
  state.combo.scoreBanked += earnedScore;

  bus.emit('COMBO_KILL', {
    kills: state.combo.kills,
    rank: tier.rank,
    multiplier: tier.multiplier,
    scoreEarned: earnedScore,
    color: tier.color,
  });

  if (prevKills >= 2 && tier.rank !== prevRank) {
    bus.emit('COMBO_RANK_UP', { rank: tier.rank, kills: state.combo.kills });
    addScreenShake(state, 5);
    spawnParticleBurst(state, state.player.x, state.player.y, 0xffee44, 14, 3.6, 4, 24);
  }

  return earnedScore;
}

export function updateComboSystem(state: GameState, bus: EventBus, dtMs: number): void {
  if (state.combo.timerMs > 0) {
    state.combo.timerMs -= dtMs;
    if (state.combo.timerMs <= 0) {
      state.combo.timerMs = 0;

      if (state.combo.kills >= 3) {
        state.combo.endBanner = {
          kills: state.combo.kills,
          score: state.combo.scoreBanked,
          rank: state.combo.rank,
          color: state.combo.color,
          multiplier: state.combo.multiplier,
          breakdown: { ...state.combo.breakdown },
          timerMs: 2200,
          maxTimerMs: 2200,
        };
        bus.emit('COMBO_ENDED', {
          rank: state.combo.rank,
          kills: state.combo.kills,
          score: state.combo.scoreBanked,
        });
      }

      state.combo.kills = 0;
      state.combo.multiplier = 1;
      state.combo.rank = 'D';
      state.combo.color = '#55bbff';
      state.combo.scoreBanked = 0;
      state.combo.breakdown = { small: 0, medium: 0, large: 0, elite: 0, boss: 0 };
    }
  }

  if (state.combo.endBanner) {
    state.combo.endBanner.timerMs -= dtMs;
    if (state.combo.endBanner.timerMs <= 0) {
      state.combo.endBanner = null;
    }
  }
}
