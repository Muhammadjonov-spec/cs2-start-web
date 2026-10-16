// CS2 Web 3D - Mobile Touch Controller System (Counter Mobile / Standoff 2 Style)
// Provides Dynamic Floating Virtual Joystick, Smooth Touch Aim, and Ergonomic CS Action Buttons.

export interface TouchControllerCallbacks {
  onFireStart: () => void;
  onFireEnd: () => void;
  onJump: () => void;
  onCrouchToggle: (isCrouching: boolean) => void;
  onScopeToggle: () => void;
  onReload: () => void;
  onWeaponSelect: (slot: number) => void;
  onOpenBuyMenu: () => void;
  onOpenMenu: () => void;
  onLookDelta: (deltaX: number, deltaY: number) => void;
}

export class TouchController {
  private container: HTMLElement | null = null;
  private joystickZone: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickThumb: HTMLElement | null = null;

  // Floating Dynamic Joystick State
  private joystickActive: boolean = false;
  private joystickTouchId: number | null = null;
  private joystickCenter: { x: number; y: number } = { x: 0, y: 0 };
  private readonly MAX_JOYSTICK_RADIUS = 52; // max distance in pixels
  private readonly DEADZONE_RADIUS = 6;

  // Look / Aim Swipe State
  private lookTouchId: number | null = null;
  private lastLookPos: { x: number; y: number } = { x: 0, y: 0 };
  public touchSensitivity: number = 0.0036;

  // Movement Vector (-1 to 1)
  public moveVector: { x: number; y: number } = { x: 0, y: 0 };

  // States
  public isCrouched: boolean = false;
  public isFiring: boolean = false;
  public isEnabled: boolean = false;

  constructor(private callbacks: TouchControllerCallbacks) {}

  public init() {
    this.container = document.getElementById('touch-controls');
    this.joystickZone = document.getElementById('touch-joystick-zone');
    this.joystickBase = document.getElementById('touch-joystick-base');
    this.joystickThumb = document.getElementById('touch-joystick-thumb');

    if (!this.container) return;

    this.setupJoystickEvents();
    this.setupLookEvents();
    this.setupButtonEvents();

    // Auto-detect mobile touch support
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
    this.setEnabled(isTouch);
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (this.container) {
      if (enabled) {
        this.container.classList.remove('hidden');
        this.container.style.display = 'block';
      } else {
        this.container.classList.add('hidden');
        this.container.style.display = 'none';
      }
    }
  }

  private isEventInsideModal(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    return !!(target.closest('#menu-overlay') || target.closest('#buy-menu'));
  }

  // Counter Mobile Dynamic Floating Joystick
  private setupJoystickEvents() {
    if (!this.joystickZone || !this.joystickBase || !this.joystickThumb) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!this.isEnabled) return;
      if (this.isEventInsideModal(e.target)) return;

      const target = e.target as HTMLElement;
      if (target.closest('.touch-action-btn') || target.closest('.touch-util-btn')) return;

      if (this.joystickActive) return;

      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;
      this.joystickActive = true;

      const rect = this.joystickZone!.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.joystickCenter = { x, y };

      // Instantly position floating base under user's thumb
      this.joystickBase!.style.left = `${x}px`;
      this.joystickBase!.style.top = `${y}px`;
      this.joystickBase!.style.opacity = '1';
      this.joystickBase!.style.display = 'block';
      this.joystickThumb!.style.transform = `translate(0px, 0px)`;

      this.moveVector.x = 0;
      this.moveVector.y = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!this.isEnabled || !this.joystickActive || this.joystickTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          // Only prevent default on the active joystick touch!
          e.preventDefault();

          const rect = this.joystickZone!.getBoundingClientRect();
          const currentX = touch.clientX - rect.left;
          const currentY = touch.clientY - rect.top;

          let dx = currentX - this.joystickCenter.x;
          let dy = currentY - this.joystickCenter.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= this.DEADZONE_RADIUS) {
            this.moveVector.x = 0;
            this.moveVector.y = 0;
            this.joystickThumb!.style.transform = `translate(0px, 0px)`;
            break;
          }

          let clampedDx = dx;
          let clampedDy = dy;
          if (distance > this.MAX_JOYSTICK_RADIUS) {
            clampedDx = (dx / distance) * this.MAX_JOYSTICK_RADIUS;
            clampedDy = (dy / distance) * this.MAX_JOYSTICK_RADIUS;
          }

          // Move thumb visual
          this.joystickThumb!.style.transform = `translate(${clampedDx}px, ${clampedDy}px)`;

          // Normalized movement vector (-1 to 1)
          this.moveVector.x = clampedDx / this.MAX_JOYSTICK_RADIUS;
          this.moveVector.y = clampedDy / this.MAX_JOYSTICK_RADIUS;
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!this.joystickActive || this.joystickTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.joystickActive = false;
          this.joystickTouchId = null;
          this.moveVector.x = 0;
          this.moveVector.y = 0;

          // Reset thumb to center and fade base slightly
          this.joystickThumb!.style.transform = `translate(0px, 0px)`;
          this.joystickBase!.style.opacity = '0.4';
          break;
        }
      }
    };

    this.joystickZone.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  // Smooth Touch Aim on Right Half of Screen
  private setupLookEvents() {
    const lookZone = document.getElementById('touch-look-zone');
    if (!lookZone) return;

    lookZone.addEventListener('touchstart', (e: TouchEvent) => {
      if (!this.isEnabled) return;
      if (this.isEventInsideModal(e.target)) return;

      const target = e.target as HTMLElement;
      if (target.closest('.touch-action-btn') || target.closest('.touch-util-btn')) return;

      if (this.lookTouchId !== null) return;

      const touch = e.changedTouches[0];
      this.lookTouchId = touch.identifier;
      this.lastLookPos = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (!this.isEnabled || this.lookTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookTouchId) {
          e.preventDefault(); // Only prevent default on the aim finger
          const dx = (touch.clientX - this.lastLookPos.x) * this.touchSensitivity;
          const dy = (touch.clientY - this.lastLookPos.y) * this.touchSensitivity;

          this.lastLookPos = { x: touch.clientX, y: touch.clientY };
          this.callbacks.onLookDelta(dx, dy);
          break;
        }
      }
    }, { passive: false });

    const onLookEnd = (e: TouchEvent) => {
      if (this.lookTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.lookTouchId) {
          this.lookTouchId = null;
          break;
        }
      }
    };

    window.addEventListener('touchend', onLookEnd, { passive: true });
    window.addEventListener('touchcancel', onLookEnd, { passive: true });
  }

  // CS Action Buttons (Fire, Aim, Jump, Crouch, Reload, Slots)
  private setupButtonEvents() {
    // Primary Right Fire button
    const fireBtn = document.getElementById('btn-touch-fire');
    // Secondary Left Fire button (Dual-fire for claw players)
    const fireLeftBtn = document.getElementById('btn-touch-fire-left');

    const bindFireBtn = (btn: HTMLElement | null) => {
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isFiring = true;
        btn.classList.add('active');
        this.callbacks.onFireStart();
      }, { passive: false });

      const stopFire = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.isFiring = false;
        btn.classList.remove('active');
        this.callbacks.onFireEnd();
      };
      btn.addEventListener('touchend', stopFire, { passive: false });
      btn.addEventListener('touchcancel', stopFire, { passive: false });
    };

    bindFireBtn(fireBtn);
    bindFireBtn(fireLeftBtn);

    // Jump button
    const jumpBtn = document.getElementById('btn-touch-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        jumpBtn.classList.add('active');
        this.callbacks.onJump();
      }, { passive: false });
      jumpBtn.addEventListener('touchend', () => jumpBtn.classList.remove('active'), { passive: true });
    }

    // Crouch button (toggle)
    const crouchBtn = document.getElementById('btn-touch-crouch');
    if (crouchBtn) {
      crouchBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isCrouched = !this.isCrouched;
        if (this.isCrouched) crouchBtn.classList.add('active');
        else crouchBtn.classList.remove('active');
        this.callbacks.onCrouchToggle(this.isCrouched);
      }, { passive: false });
    }

    // Scope / Aim button (toggle)
    const scopeBtn = document.getElementById('btn-touch-scope');
    if (scopeBtn) {
      scopeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scopeBtn.classList.toggle('active');
        this.callbacks.onScopeToggle();
      }, { passive: false });
    }

    // Reload button
    const reloadBtn = document.getElementById('btn-touch-reload');
    if (reloadBtn) {
      reloadBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        reloadBtn.classList.add('active');
        this.callbacks.onReload();
      }, { passive: false });
      reloadBtn.addEventListener('touchend', () => reloadBtn.classList.remove('active'), { passive: true });
    }

    // Weapon Slots: Primary (1), Secondary (2), Knife (3)
    [1, 2, 3].forEach((slot) => {
      const btn = document.getElementById(`btn-touch-slot${slot}`);
      if (btn) {
        btn.addEventListener('touchstart', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.onWeaponSelect(slot);
        }, { passive: false });
      }
    });

    // Buy Menu button
    const buyBtn = document.getElementById('btn-touch-buy');
    if (buyBtn) {
      buyBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onOpenBuyMenu();
      }, { passive: false });
    }

    // Settings / Pause button
    const menuBtn = document.getElementById('btn-touch-menu');
    if (menuBtn) {
      menuBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onOpenMenu();
      }, { passive: false });
    }
  }
}
