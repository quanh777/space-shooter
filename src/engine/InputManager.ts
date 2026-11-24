import type { AimMode, SkillMode } from '../game/types';

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  shoot: boolean;
  dash: boolean;
  bomb: boolean;
  vent: boolean;
  chrono?: boolean;
  aimMode: AimMode;
  autoFire: boolean;
  mouseArenaX: number;
  mouseArenaY: number;
  mouseActive: boolean;
}

export interface InputCallbacks {
  onTogglePause?: () => void;
  onPauseRestart?: () => void;
  onPauseMenu?: () => void;
  onToggleAimMode?: () => void;
  onCycleSkillMode?: (forcedMode?: SkillMode) => void;
  onShopSelectIndex?: (idx: number) => void;
  onShopConfirm?: () => void;
  onShopRefresh?: () => void;
  onShopSkip?: () => void;
  onOpenHangar?: () => void;
  onQuickDraftPick?: (idx: number) => void;
  onQuickDraftReroll?: () => void;
  onRoomDoorPick?: (idx: number) => void;
  onFirstInteraction?: () => void;
  screenToArena?: (clientX: number, clientY: number) => { x: number; y: number } | null;
}

export class InputManager {
  private pressedCodes = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightQueued = false;
  private ventQueued = false;
  private chronoQueued = false;
  private mouseArenaX = 400;
  private mouseArenaY = 300;
  private mouseActive = false;

  private joystickTouchId: number | null = null;
  private joystickVec = { x: 0, y: 0 };
  private touchShoot = false;
  private touchDash = false;
  private touchBomb = false;

  public aimMode: AimMode = 'mouse';
  public autoFire = false;
  public isMobile = false;

  private callbacks: InputCallbacks = {};
  private phaseGetter: () => string = () => 'MENU';
  private interacted = false;

  constructor(phaseGetter: () => string, callbacks: InputCallbacks = {}) {
    this.phaseGetter = phaseGetter;
    this.callbacks = callbacks;
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.matchMedia('(pointer: coarse)').matches;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  setCallbacks(callbacks: Partial<InputCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  bindMobileControls(
    joystickEl: HTMLElement | null,
    innerEl: HTMLElement | null,
    shootBtn: HTMLElement | null,
    dashBtn: HTMLElement | null,
    skillBtn: HTMLElement | null
  ): void {
    if (joystickEl && innerEl) {
      const maxRadius = 38;
      const updateStick = (touch: Touch) => {
        const rect = joystickEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = touch.clientX - cx;
        const dy = touch.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const vx = Math.cos(angle) * clamped;
        const vy = Math.sin(angle) * clamped;

        innerEl.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`;
        this.joystickVec.x = vx / maxRadius;
        this.joystickVec.y = vy / maxRadius;
      };

      const resetStick = () => {
        this.joystickTouchId = null;
        this.joystickVec.x = 0;
        this.joystickVec.y = 0;
        innerEl.style.transform = 'translate(-50%, -50%)';
      };

      joystickEl.addEventListener(
        'touchstart',
        (e) => {
          this.notifyInteraction();
          e.preventDefault();
          if (this.joystickTouchId === null && e.changedTouches.length > 0) {
            const t = e.changedTouches[0];
            this.joystickTouchId = t.identifier;
            updateStick(t);
          }
        },
        { passive: false }
      );

      joystickEl.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === this.joystickTouchId) {
              updateStick(t);
              break;
            }
          }
        },
        { passive: false }
      );

      const handleEnd = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystickTouchId) {
            resetStick();
            break;
          }
        }
      };

      joystickEl.addEventListener('touchend', handleEnd, { passive: false });
      joystickEl.addEventListener('touchcancel', handleEnd, { passive: false });
    }

    const bindHoldBtn = (el: HTMLElement | null, setter: (down: boolean) => void) => {
      if (!el) return;
      let activeTouchId: number | null = null;
      el.addEventListener(
        'touchstart',
        (e) => {
          this.notifyInteraction();
          e.preventDefault();
          if (activeTouchId === null && e.changedTouches.length > 0) {
            activeTouchId = e.changedTouches[0].identifier;
            setter(true);
            el.classList.add('pressed');
          }
        },
        { passive: false }
      );
      const release = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeTouchId) {
            activeTouchId = null;
            setter(false);
            el.classList.remove('pressed');
            break;
          }
        }
      };
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
    };

    bindHoldBtn(shootBtn, (v) => (this.touchShoot = v));
    bindHoldBtn(dashBtn, (v) => (this.touchDash = v));
    bindHoldBtn(skillBtn, (v) => (this.touchBomb = v));
  }

  getSnapshot(): InputSnapshot {
    let moveX = 0;
    let moveY = 0;

    if (this.pressedCodes.has('KeyA') || this.pressedCodes.has('ArrowLeft')) moveX -= 1;
    if (this.pressedCodes.has('KeyD') || this.pressedCodes.has('ArrowRight')) moveX += 1;
    if (this.pressedCodes.has('KeyW') || this.pressedCodes.has('ArrowUp')) moveY -= 1;
    if (this.pressedCodes.has('KeyS') || this.pressedCodes.has('ArrowDown')) moveY += 1;

    if (Math.hypot(this.joystickVec.x, this.joystickVec.y) > 0.15) {
      moveX = this.joystickVec.x;
      moveY = this.joystickVec.y;
    }

    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    const shoot =
      this.autoFire ||
      this.pressedCodes.has('Space') ||
      this.touchShoot ||
      (this.mouseLeftDown && this.phaseGetter() === 'PLAYING');

    const dash =
      this.pressedCodes.has('ShiftLeft') ||
      this.pressedCodes.has('ShiftRight') ||
      this.touchDash;

    const bomb =
      this.pressedCodes.has('KeyE') ||
      this.pressedCodes.has('KeyQ') ||
      this.touchBomb ||
      this.mouseRightQueued;

    const vent = this.ventQueued;
    const chrono = this.chronoQueued;
    this.mouseRightQueued = false;
    this.ventQueued = false;
    this.chronoQueued = false;

    return {
      moveX,
      moveY,
      shoot,
      dash,
      bomb,
      vent,
      chrono,
      aimMode: this.aimMode,
      autoFire: this.autoFire,
      mouseArenaX: this.mouseArenaX,
      mouseArenaY: this.mouseArenaY,
      mouseActive: this.mouseActive,
    };
  }

  queueVent(): void {
    this.notifyInteraction();
    if (this.phaseGetter() === 'PLAYING') {
      this.ventQueued = true;
    }
  }

  queueChrono(): void {
    this.notifyInteraction();
    if (this.phaseGetter() === 'PLAYING') {
      this.chronoQueued = true;
    }
  }

  clearInputs(): void {
    this.pressedCodes.clear();
    this.mouseLeftDown = false;
    this.mouseRightQueued = false;
    this.ventQueued = false;
    this.chronoQueued = false;
    this.touchShoot = false;
    this.touchDash = false;
    this.touchBomb = false;
    this.joystickVec.x = 0;
    this.joystickVec.y = 0;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
  }

  private notifyInteraction(): void {
    if (!this.interacted) {
      this.interacted = true;
      this.callbacks.onFirstInteraction?.();
    }
  }

  private isTypingInInput(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.notifyInteraction();
    if (this.isTypingInInput(e.target)) return;

    const phase = this.phaseGetter();
    if (
      phase === 'PLAYING' &&
      (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow'))
    ) {
      e.preventDefault();
    }

    this.pressedCodes.add(e.code);

    if (e.repeat) return;

    if (e.code === 'Escape') {
      if (phase === 'PLAYING' || phase === 'PAUSED') {
        this.callbacks.onTogglePause?.();
      } else if (phase === 'SHOP') {
        this.callbacks.onShopSkip?.();
      }
      return;
    }

    if (phase === 'PLAYING' && e.code === 'Tab') {
      this.aimMode = this.aimMode === 'auto' ? 'mouse' : 'auto';
      this.callbacks.onToggleAimMode?.();
      return;
    }

    if (phase === 'PLAYING') {
      if (e.code === 'KeyG') {
        this.callbacks.onOpenHangar?.();
        return;
      }
      if (e.code === 'KeyR') {
        this.ventQueued = true;
        return;
      }
      if (e.code === 'KeyF') {
        this.chronoQueued = true;
        return;
      }
    }

    if (phase === 'QUICK_DRAFT') {
      if (e.code === 'Digit1') this.callbacks.onQuickDraftPick?.(0);
      else if (e.code === 'Digit2') this.callbacks.onQuickDraftPick?.(1);
      else if (e.code === 'Digit3') this.callbacks.onQuickDraftPick?.(2);
      else if (e.code === 'KeyR') this.callbacks.onQuickDraftReroll?.();
      return;
    }

    if (phase === 'ROOM_SELECT') {
      if (e.code === 'Digit1') this.callbacks.onRoomDoorPick?.(0);
      else if (e.code === 'Digit2') this.callbacks.onRoomDoorPick?.(1);
      else if (e.code === 'Digit3') this.callbacks.onRoomDoorPick?.(2);
      return;
    }

    if (phase === 'PAUSED') {
      if (e.code === 'KeyR') this.callbacks.onPauseRestart?.();
      else if (e.code === 'KeyM') this.callbacks.onPauseMenu?.();
      return;
    }

    if (phase === 'SHOP') {
      if (e.code === 'Digit1') this.callbacks.onShopSelectIndex?.(0);
      else if (e.code === 'Digit2') this.callbacks.onShopSelectIndex?.(1);
      else if (e.code === 'Digit3') this.callbacks.onShopSelectIndex?.(2);
      else if (e.code === 'Digit4') this.callbacks.onShopSelectIndex?.(3);
      else if (e.code === 'Enter') this.callbacks.onShopConfirm?.();
      else if (e.code === 'KeyR') this.callbacks.onShopRefresh?.();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressedCodes.delete(e.code);
  };

  private onBlur = (): void => {
    this.clearInputs();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.phaseGetter() !== 'PLAYING') return;
    const mapped = this.callbacks.screenToArena?.(e.clientX, e.clientY);
    if (mapped) {
      this.mouseArenaX = mapped.x;
      this.mouseArenaY = mapped.y;
      this.mouseActive = true;
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.notifyInteraction();
    if (this.phaseGetter() !== 'PLAYING') return;
    if (e.target instanceof HTMLElement && e.target.closest('button, .hud-interactive')) {
      return;
    }
    if (e.button === 0) {
      this.mouseLeftDown = true;
    } else if (e.button === 2) {
      this.mouseRightQueued = true;
    } else if (e.button === 1) {
      e.preventDefault();
      this.chronoQueued = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.mouseLeftDown = false;
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    if (this.phaseGetter() === 'PLAYING') {
      e.preventDefault();
    }
  };
}
