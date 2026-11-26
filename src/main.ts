import './ui/styles.css';
import { SoundEngine } from './audio/SoundEngine';
import { EventBus } from './engine/EventBus';
import { FixedLoop } from './engine/FixedLoop';
import { InputManager } from './engine/InputManager';
import { GameSimulation } from './game/GameSimulation';
import { SceneManager } from './render/SceneManager';
import { AchievementService } from './services/AchievementService';
import { LeaderboardService } from './services/LeaderboardService';
import { UIManager } from './ui/UIManager';

function bootstrap(): void {
  const stageEl = document.getElementById('webglStage');
  if (!stageEl) {
    throw new Error('Missing #webglStage mount element');
  }

  const bus = new EventBus();
  const sim = new GameSimulation(bus);
  sim.setPacingEnabled(true);
  const sound = new SoundEngine(bus);
  const achievements = new AchievementService(bus);
  const leaderboard = new LeaderboardService();
  const scene = new SceneManager(stageEl, bus);

  const input = new InputManager(() => sim.state.phase, {
    onFirstInteraction: () => sound.unlock(),
    screenToArena: (cx, cy) => scene.screenToArena(cx, cy),
    onTogglePause: () => sim.togglePause(),
    onPauseRestart: () => sim.startNewGame(),
    onPauseMenu: () => sim.returnToMenu(),
    onShopSelectIndex: (idx) => {
      if (sim.toggleShopItemByIndex(idx)) {
        sound.playUiClick(740);
        ui.renderShop();
      }
    },
    onShopConfirm: () => {
      sim.confirmShopPurchase();
      ui.renderShop();
    },
    onShopRefresh: () => {
      if (sim.state.player.loadout.activeArmoryTab === 'ROULETTE') {
        sim.spinRoulette();
      } else {
        sim.refreshShop();
      }
      ui.renderShop();
    },
    onShopSkip: () => sim.closeShop(),
    onOpenHangar: () => {
      if (sim.openInventoryIfAllowed()) {
        sound.playUiClick(880);
      }
    },
    onQuickDraftPick: (idx) => {
      if (ui.isPopupInputGuarded()) return;
      if (sim.pickQuickDraftByIndex(idx)) {
        sound.playUiConfirm();
      }
    },
    onQuickDraftReroll: () => {
      if (ui.isPopupInputGuarded()) return;
      if (sim.rerollQuickDraft()) {
        sound.playUiClick(920);
      }
    },
    onRoomDoorPick: (idx) => {
      if (ui.isPopupInputGuarded()) return;
      if (sim.selectRoomDoor(idx)) {
        sound.playUiConfirm();
      }
    },
  });

  const ui = new UIManager(sim, input, scene, sound, achievements, leaderboard, bus);

  input.setCallbacks({
    onToggleAimMode: () => {
      sound.playUiClick(820);
      ui.syncControlButtons();
    },
  });

  const loop = new FixedLoop(
    (dt) => {
      const snap = input.getSnapshot();
      sim.step(snap, dt);
    },
    (_alpha, frameDt) => {
      scene.render(sim.state, frameDt, loop.currentFps);
      ui.updateHud(sim.state, loop.currentFps, frameDt);
    },
    () => {
      sim.pauseIfPlaying();
    }
  );

  loop.start();
}

bootstrap();
