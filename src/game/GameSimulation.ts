import { FIXED_DT_MS } from '../config/constants';
import { HULL_CATALOG, type HullClassId } from '../config/hulls';
import type { ShopItemId } from '../config/shopItems';
import {
  SHIP_SLOT_MAP,
  WEAPON_CATALOG,
  type AugmentId,
  type SectorHazardId,
  type ShipSlotId,
  type SkillWeaponCatalogEntry,
  type WeaponId,
  type WeaponUpgradeKey,
} from '../config/weapons';
import type { EventBus } from '../engine/EventBus';
import type { InputSnapshot } from '../engine/InputManager';
import { metaProgression } from '../services/MetaProgressionService';
import { createInitialGameState, nextId, spawnParticleBurst, spawnShockwave } from './GameState';
import { updateBossSystem } from './systems/BossSystem';
import { updateCombatSystem } from './systems/CombatSystem';
import { updateComboSystem } from './systems/ComboSystem';
import { updateEnemySystem } from './systems/EnemySystem';
import {
  activateChronoOverdrive,
  activateThermalPurge,
  cyclePlayerSkillMode,
  damagePlayer,
  updatePlayerSystem,
} from './systems/PlayerSystem';
import {
  applyQuickDraftChoice,
  initSectorRooms,
  rerollRoomQuickDraft,
  selectRoomDoorOption,
  spawnCombatDrone,
  triggerPendingLevelUpDraft,
  updateRoomSystem,
} from './systems/RoomSystem';
import { pickQuickDraftOption, updateRaidSystem } from './systems/RaidSystem';
import {
  buyCoreUpgrade,
  claimRouletteOffer,
  equipInventoryItemToSlot,
  fuseWeaponGroup,
  mountWeaponOnSlot,
  purchaseSelectedShopItems,
  refreshShopOffers,
  salvageInventoryItem,
  selectNextSectorHazard,
  selectPostBossAugment,
  spinBossRoulette,
  swapShipSlots,
  syncSkillStatsFromLoadout,
  toggleRouletteLock,
  toggleShopSelection,
  unequipSlotToInventory,
  unmountWeaponSlot,
  upgradeMountedWeapon,
} from './systems/ShopSystem';
import { updateStormRing, updateWaveSystem } from './systems/WaveSystem';
import type { GamePhase, GameState, SkillMode } from './types';

export class GameSimulation {
  public state: GameState;
  private openedFromRest = false;

  constructor(public readonly bus: EventBus) {
    this.state = createInitialGameState();
    this.state.metaBonuses = metaProgression.computeMetaBonuses();
    this.state.player.hullId = metaProgression.getProfile().selectedHull;
  }

  startNewGame(hullId?: HullClassId): void {
    const prevPhase = this.state.phase;
    this.openedFromRest = false;
    if (hullId) {
      metaProgression.selectHull(hullId);
    }
    const profile = metaProgression.getProfile();
    const chosenHull: HullClassId = hullId ?? profile.selectedHull;
    const meta = metaProgression.computeMetaBonuses();
    const hullDef = HULL_CATALOG[chosenHull];

    this.state = createInitialGameState();
    this.state.metaBonuses = meta;
    this.state.money += meta.startCredits;

    const p = this.state.player;
    p.hullId = chosenHull;
    p.maxHealth = p.maxHealth + meta.bonusHp + hullDef.bonusHp;
    p.health = p.maxHealth;
    p.dashCooldownMs = Math.max(150, Math.round(p.dashCooldownMs * hullDef.dashCdMult));
    p.chronoMaxMs = Math.round(p.chronoMaxMs * hullDef.chronoDurationMult * meta.chronoMult);
    p.rerollsLeft = meta.rerolls;
    p.pickupRange = p.pickupRange + meta.pickupBonus;
    p.innatePierce = hullDef.innatePierce ?? 0;

    // Everyone starts with one humble Mk.I gun on the left wing — earn the fireworks yourself
    for (let i = 0; i < hullDef.startingDrones; i++) {
      spawnCombatDrone(this.state, this.bus);
    }

    this.state.phase = 'PLAYING';
    this.state.wave = 1;
    this.state.isResting = false;
    this.state.tutorialCircle = null;
    this.state.neededSpawn = false;
    this.state.waveStartMs = 0;
    initSectorRooms(this.state, 1, this.bus, false);
    this.bus.emit('PHASE_CHANGED', { from: prevPhase, to: 'PLAYING' });
    this.bus.emit('GAME_STARTED');
  }

  returnToMenu(): void {
    const prevPhase = this.state.phase;
    this.openedFromRest = false;
    this.state = createInitialGameState();
    this.state.phase = 'MENU';
    if (prevPhase !== 'MENU') {
      this.bus.emit('PHASE_CHANGED', { from: prevPhase, to: 'MENU' });
    }
  }

  setPhase(next: GamePhase): void {
    const prev = this.state.phase;
    if (prev === next) return;
    this.state.phase = next;
    this.bus.emit('PHASE_CHANGED', { from: prev, to: next });
  }

  togglePause(): void {
    if (this.state.phase === 'PLAYING') {
      this.setPhase('PAUSED');
    } else if (this.state.phase === 'PAUSED') {
      this.setPhase('PLAYING');
    }
  }

  pauseIfPlaying(): void {
    if (this.state.phase === 'PLAYING') {
      this.setPhase('PAUSED');
    }
  }

  toggleShopItem(id: ShopItemId): boolean {
    if (this.state.phase !== 'SHOP') return false;
    return toggleShopSelection(this.state, id);
  }

  toggleShopItemByIndex(index: number): boolean {
    if (this.state.phase !== 'SHOP') return false;
    const id = this.state.shop.offers[index];
    if (!id) return false;
    return toggleShopSelection(this.state, id);
  }

  confirmShopPurchase(): boolean {
    if (this.state.phase !== 'SHOP') return false;
    return purchaseSelectedShopItems(this.state, this.bus);
  }

  refreshShop(): boolean {
    if (this.state.phase !== 'SHOP') return false;
    return refreshShopOffers(this.state, this.bus);
  }

  openInventoryIfAllowed(): boolean {
    if (this.state.phase !== 'PLAYING' || this.state.wave < 1) {
      return false;
    }
    this.openedFromRest = true;
    const l = this.state.player.loadout;
    l.garageMode = 'INVENTORY';
    l.activeArmoryTab = 'INVENTORY';
    this.state.phase = 'SHOP';
    this.bus.emit('SHOP_OPENED', { wave: this.state.wave });
    this.bus.emit('PHASE_CHANGED', { from: 'PLAYING', to: 'SHOP' });
    return true;
  }

  openHangarIfAllowed(): boolean {
    return this.openInventoryIfAllowed();
  }

  selectGarageSlot(slot: ShipSlotId | 'CORE'): void {
    this.state.player.loadout.selectedSlot = slot;
    if (slot === 'CORE' && this.state.player.loadout.garageMode === 'SHOP') {
      this.state.player.loadout.activeArmoryTab = 'CORE';
    }
  }

  setGarageArmoryTab(tab: 'ROULETTE' | 'INVENTORY' | 'CORE'): void {
    const l = this.state.player.loadout;
    if (l.garageMode === 'INVENTORY' && tab !== 'INVENTORY') return;
    l.activeArmoryTab = tab;
    if (tab === 'CORE') {
      l.selectedSlot = 'CORE';
    }
  }

  mountWeapon(slotId: ShipSlotId, weaponId: WeaponId) {
    return mountWeaponOnSlot(this.state, slotId, weaponId, this.bus);
  }

  unmountWeapon(slotId: ShipSlotId) {
    return unmountWeaponSlot(this.state, slotId, this.bus);
  }

  upgradeWeaponSlot(slotId: ShipSlotId, key: WeaponUpgradeKey) {
    return upgradeMountedWeapon(this.state, slotId, key, this.bus);
  }

  buyCoreItem(id: ShopItemId) {
    return buyCoreUpgrade(this.state, id, this.bus);
  }

  spinRoulette() {
    return spinBossRoulette(this.state, this.bus);
  }

  toggleRouletteLock(offerId: string) {
    return toggleRouletteLock(this.state, offerId);
  }

  claimRouletteOffer(offerId: string) {
    return claimRouletteOffer(this.state, offerId, this.bus);
  }

  equipInventoryItem(instanceId: string, slotId: ShipSlotId) {
    return equipInventoryItemToSlot(this.state, instanceId, slotId, this.bus);
  }

  unequipToInventory(slotId: ShipSlotId) {
    return unequipSlotToInventory(this.state, slotId, this.bus);
  }

  swapSlots(fromSlot: ShipSlotId, toSlot: ShipSlotId) {
    return swapShipSlots(this.state, fromSlot, toSlot, this.bus);
  }

  salvageInventoryItem(instanceId: string) {
    return salvageInventoryItem(this.state, instanceId, this.bus);
  }

  fuseWeapons(weaponId: WeaponId, tier: 1 | 2) {
    return fuseWeaponGroup(this.state, weaponId, tier, this.bus);
  }

  chooseAugment(augmentId: AugmentId): boolean {
    return selectPostBossAugment(this.state, augmentId, this.bus);
  }

  chooseSectorHazard(hazardId: SectorHazardId): boolean {
    return selectNextSectorHazard(this.state, hazardId);
  }

  pickQuickDraft(optionId: string): boolean {
    if (this.state.phase !== 'QUICK_DRAFT') return false;
    if (this.state.roomsTotalPerSector < 5) {
      return pickQuickDraftOption(this.state, optionId, this.bus);
    }
    return applyQuickDraftChoice(this.state, optionId, this.bus);
  }

  pickQuickDraftByIndex(index: number): boolean {
    if (this.state.phase !== 'QUICK_DRAFT') return false;
    const opt = this.state.raid.pendingQuickDraft[index];
    if (!opt) return false;
    if (this.state.roomsTotalPerSector < 5) {
      return pickQuickDraftOption(this.state, opt.id, this.bus);
    }
    return applyQuickDraftChoice(this.state, opt.id, this.bus);
  }

  rerollQuickDraft(): boolean {
    if (this.state.phase !== 'QUICK_DRAFT') return false;
    return rerollRoomQuickDraft(this.state, this.bus);
  }

  selectRoomDoor(doorIdOrIndex: string | number): boolean {
    if (this.state.phase !== 'ROOM_SELECT') return false;
    return selectRoomDoorOption(this.state, doorIdOrIndex, this.bus);
  }

  triggerChronoOverdrive(): boolean {
    if (this.state.phase !== 'PLAYING') return false;
    return activateChronoOverdrive(this.state, this.bus);
  }

  triggerThermalPurge(): boolean {
    if (this.state.phase !== 'PLAYING') return false;
    return activateThermalPurge(this.state, this.bus);
  }

  attachFloatingModuleToSlot(floatingId: number, slotId: ShipSlotId): boolean {
    const idx = this.state.floatingModules.findIndex((m) => m.id === floatingId);
    if (idx === -1) return false;
    const mod = this.state.floatingModules[idx];
    const entry = WEAPON_CATALOG[mod.weaponId];
    const slotDef = SHIP_SLOT_MAP[slotId];
    if (!slotDef || slotDef.kind !== entry.kind) return false;

    this.state.floatingModules.splice(idx, 1);
    const l = this.state.player.loadout;
    const prev = l.slots[slotId];
    if (prev) {
      prev.recoil = 0;
      l.inventory.push(prev);
    }
    l.slots[slotId] = {
      instanceId: `wpn-${nextId(this.state)}`,
      weaponId: mod.weaponId,
      tier: mod.tier,
      upgrades: {},
      investedCredits: entry.price,
      lastFireMs: -10000,
      recoil: 0,
    };
    if (entry.kind === 'skill') {
      this.state.player.skill.mode = (entry as SkillWeaponCatalogEntry).skillMode;
    }
    syncSkillStatsFromLoadout(this.state);
    this.bus.emit('GARAGE_MOUNTED', { slotId, weaponId: mod.weaponId, salvageRefund: 0 });
    return true;
  }

  closeShop(): void {
    if (this.state.phase !== 'SHOP') return;
    const wasBossShop = this.state.player.loadout.garageMode === 'SHOP';
    this.state.shop.selected = [];
    this.state.player.loadout.garageMode = 'INVENTORY';
    this.setPhase('PLAYING');
    if (this.openedFromRest || !wasBossShop) {
      this.openedFromRest = false;
      return;
    }
    if (this.state.raid.bossTriggered) {
      initSectorRooms(this.state, this.state.raid.sectorNumber + 1, this.bus, true);
    }
  }

  cycleSkillMode(forcedMode?: SkillMode): void {
    cyclePlayerSkillMode(this.state, this.bus, forcedMode);
  }

  step(input: InputSnapshot, dtSec = 1 / 60): void {
    if (this.state.phase !== 'PLAYING') return;

    const dtMs = dtSec * 1000 || FIXED_DT_MS;

    // Let camera shake decay even during hit-stop so big hits still feel alive
    if (this.state.screenShake > 0) {
      this.state.screenShake = Math.max(0, this.state.screenShake - dtSec * 32);
    }

    if (this.state.hitStopMs > 0) {
      this.state.hitStopMs = Math.max(0, this.state.hitStopMs - dtMs);
      return;
    }

    this.state.simTimeMs += dtMs;

    if (this.state.warpTransition.active) {
      this.state.warpTransition.elapsedMs += dtMs;
      updateStormRing(this.state, dtSec);
      this.updateAmbientVfx();
      if (this.state.warpTransition.elapsedMs >= this.state.warpTransition.durationMs) {
        this.state.warpTransition.active = false;
        this.bus.emit('WARP_ARRIVED', { accentHex: this.state.warpTransition.accentHex });
        spawnShockwave(
          this.state,
          this.state.player.x,
          this.state.player.y,
          165,
          this.state.warpTransition.accentHex,
          24
        );
        spawnParticleBurst(
          this.state,
          this.state.player.x,
          this.state.player.y,
          this.state.warpTransition.accentHex,
          24,
          5.5,
          4.5,
          22
        );
        if (this.state.player.pendingLevelUps > 0) {
          triggerPendingLevelUpDraft(this.state, this.bus);
        }
      }
      return;
    }

    if (this.state.waveTransition.active) {
      updateWaveSystem(this.state, this.bus, dtMs);
      // Keep explosions and sparks drifting while the wave banner slides across
      this.updateAmbientVfx();
      return;
    }

    const triggerGameOver = () => {
      if (this.state.phase === 'GAMEOVER') return;
      const { shardsEarned } = metaProgression.recordRunReward({
        roomsCleared: this.state.roomsClearedTotal,
        elitesKilled: this.state.elitesKilledRun,
        bossKills: this.state.bossKills,
        maxCombo: this.state.combo.maxCombo,
        sectorReached: this.state.raid.sectorNumber,
      });
      this.state.shardsEarnedLastRun = shardsEarned;
      this.setPhase('GAMEOVER');
      this.bus.emit('GAME_OVER', {
        score: this.state.score,
        wave: this.state.wave,
        maxCombo: this.state.combo.maxCombo,
        bossKills: this.state.bossKills,
        shardsEarned,
      });
    };

    const worldDtMs = dtMs * (this.state.timeScale ?? 1.0);
    updatePlayerSystem(this.state, input, this.bus, dtSec, dtMs, triggerGameOver);
    if (this.state.phase !== 'PLAYING') return;
    updateEnemySystem(this.state, dtMs, this.bus, (dmg) =>
      damagePlayer(this.state, this.bus, dmg, true, triggerGameOver)
    );
    updateBossSystem(this.state, this.bus, worldDtMs, triggerGameOver);
    updateCombatSystem(this.state, this.bus, dtMs, triggerGameOver);

    if (this.state.phase !== 'PLAYING') return;

    // Pop the 3-card draft right away when XP fills up (no holding points hostage)
    if (this.state.player.pendingLevelUps > 0) {
      triggerPendingLevelUpDraft(this.state, this.bus);
      if (this.state.phase !== 'PLAYING') return;
    }

    if (this.state.roomsTotalPerSector < 5) {
      updateRaidSystem(this.state, this.bus, dtMs);
    } else {
      updateRoomSystem(this.state, this.bus, dtMs);
    }
    if (this.state.phase !== 'PLAYING') return;

    updateComboSystem(this.state, this.bus, dtMs);
    updateWaveSystem(this.state, this.bus, dtMs);
  }

  private updateAmbientVfx(): void {
    this.state.particles = this.state.particles.filter((pt) => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.z += pt.vz;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life--;
      pt.size = Math.max(0.1, pt.maxSize * (pt.life / pt.maxLife));
      return pt.life > 0;
    });

    this.state.shockwaves = this.state.shockwaves.filter((sw) => {
      sw.life--;
      const t = 1 - sw.life / sw.maxLife;
      sw.radius = 4 + (sw.maxRadius - 4) * (1 - Math.pow(1 - t, 3));
      return sw.life > 0;
    });

    this.state.floatingTexts = this.state.floatingTexts.filter((ft) => {
      ft.life--;
      ft.x += ft.vx ?? 0;
      ft.y += ft.vy ?? -0.75;
      if (ft.vx !== undefined) ft.vx *= 0.94;
      if (ft.vy !== undefined && ft.gravity !== undefined) {
        ft.vy = Math.min(0.6, ft.vy + ft.gravity);
      }
      return ft.life > 0;
    });
  }
}
