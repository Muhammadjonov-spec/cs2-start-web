import * as THREE from 'three';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { SoundManager } from './audio/SoundManager';
import { PlayerController } from './player/PlayerController';
import { TouchController } from './player/TouchController';
import { WeaponSystem, WEAPON_REGISTRY } from './weapons/WeaponSystem';
import { MapLoader, MapData } from './maps/MapLoader';
import { BotManager } from './bots/BotManager';
import { UIManager } from './ui/UIManager';
import { MapId, BotDifficulty, WeaponId } from './types';
import { TextureGenerator } from './graphics/TextureGenerator';

class CS2Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  private physics: PhysicsWorld;
  private sound: SoundManager;
  private player: PlayerController;
  private touchController: TouchController;
  private weapons: WeaponSystem;
  private mapLoader: MapLoader;
  private botManager: BotManager;
  private ui: UIManager;

  // Game Settings & State
  private selectedMap: MapId = 'dust2';
  private selectedDifficulty: BotDifficulty = 'medium';
  private botCount: number = 4;
  private mouseMode: 'standard' | 'inverted' = 'standard';
  private controlMode: 'auto' | 'touch' | 'desktop' = 'auto';
  private currentMapData!: MapData;

  // CS2 Authentic Round System (1:55 Round Time by default)
  private selectedRoundDuration: number = 115; // 115s = 1:55
  private currentRoundSeconds: number = 115;
  private scoreCT: number = 0;
  private scoreT: number = 0;
  private roundState: 'active' | 'round_end' = 'active';
  private roundEndTimer: number = 0;
  private isRoundEnded: boolean = false;

  private playerHealth: number = 100;
  private playerArmor: number = 100;
  private isPointerLocked: boolean = false;
  private activeSlot: number = 1;
  private clock: THREE.Clock = new THREE.Clock();
  private isFiring: boolean = false;

  // DOM Elements
  private menuOverlay: HTMLElement;
  private buyMenu: HTMLElement;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);

    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88; // Balanced tone mapping preventing bright wash

    TextureGenerator.setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

    this.physics = new PhysicsWorld();
    this.sound = new SoundManager();
    this.ui = new UIManager();
    this.player = new PlayerController(this.camera, this.physics, this.sound, canvas);

    // Initialize Mobile Touch Controller
    this.touchController = new TouchController({
      onFireStart: () => {
        if (this.roundState !== 'active') return;
        this.isFiring = true;
        this.weapons.fire(this.camera.position, this.player.getForward(), this.player.currentSpeedMult);
      },
      onFireEnd: () => {
        this.isFiring = false;
      },
      onJump: () => {
        this.player.touchJumpPressed = true;
      },
      onCrouchToggle: (isCrouched) => {
        this.player.touchCrouchActive = isCrouched;
      },
      onScopeToggle: () => {
        this.weapons.toggleAim();
        this.ui.setScopeVisible(this.weapons.isScoped);
      },
      onReload: () => {
        this.weapons.reload();
      },
      onWeaponSelect: (slot) => {
        this.selectSlot(slot);
      },
      onOpenBuyMenu: () => {
        this.toggleBuyMenu();
      },
      onOpenMenu: () => {
        this.openMenuOverlay();
      },
      onLookDelta: (dx, dy) => {
        this.player.addLookDelta(dx, dy);
      },
    });

    this.weapons = new WeaponSystem(
      this.scene,
      this.camera,
      this.sound,
      this.physics,
      (damage, hitbox, botId) => this.onBulletHitBot(damage, hitbox, botId)
    );

    this.mapLoader = new MapLoader(this.scene, this.physics);

    // Bot Manager connected with bot gunfire and bullet tracers
    this.botManager = new BotManager(
      this.scene,
      this.physics,
      this.sound,
      (damage) => this.onPlayerTakeDamage(damage),
      (from, to) => this.weapons.spawnTracer(from, to)
    );

    this.menuOverlay = document.getElementById('menu-overlay')!;
    this.buyMenu = document.getElementById('buy-menu')!;

    this.setupLighting();
    this.setupWindowEvents();
    this.setupMenuEvents();
  }

  public async init() {
    await this.physics.init();
    this.player.init();
    this.touchController.init();
    this.weapons.setPlayerCollider(this.player.getColliderHandle());
    this.loadSelectedMap();

    this.clock.start();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private setupLighting() {
    // Warm ground bounce and rich sky illumination
    this.hemiLight = new THREE.HemisphereLight(0x7ea0c4, 0x4a4034, 0.55);
    this.hemiLight.position.set(0, 60, 0);
    this.scene.add(this.hemiLight);

    // Balanced Golden Sun with soft shadows
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.15);
    this.dirLight.position.set(50, 90, 45);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 280;
    const d = 70;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);
  }

  private loadSelectedMap() {
    // Reset Round Scores for fresh game
    this.scoreCT = 0;
    this.scoreT = 0;
    this.ui.setRoundScores(0, 0);

    // Clear old bullet impact decals
    this.weapons.clearDecals();

    this.currentMapData = this.mapLoader.loadMap(this.selectedMap);

    this.scene.background = this.currentMapData.skyTexture;
    this.scene.environment = this.currentMapData.skyTexture;

    const fogColor = this.selectedMap === 'tashkent' ? 0x8fa6bc : 0xd8b682;
    this.scene.fog = new THREE.FogExp2(fogColor, 0.0035);
    this.dirLight.color.setHex(this.currentMapData.sunColor);

    this.player.setPosition(
      this.currentMapData.playerSpawn.x,
      this.currentMapData.playerSpawn.y,
      this.currentMapData.playerSpawn.z,
      this.currentMapData.playerYaw
    );

    this.botManager.spawnBots(
      this.currentMapData.botSpawns,
      this.botCount,
      this.selectedDifficulty,
      this.currentMapData.botRoutes
    );

    this.startNewRound(true);

    const radarLabel = document.querySelector('.radar-label');
    if (radarLabel) radarLabel.textContent = `MAP: ${this.selectedMap.toUpperCase()}`;
  }

  public selectSlot(slot: number) {
    if (slot === 1) {
      this.weapons.equipWeapon('ak47');
      this.activeSlot = 1;
      this.ui.setScopeVisible(false);
    } else if (slot === 2) {
      this.weapons.equipWeapon('deagle');
      this.activeSlot = 2;
      this.ui.setScopeVisible(false);
    } else if (slot === 3) {
      this.weapons.equipWeapon('knife');
      this.activeSlot = 3;
      this.ui.setScopeVisible(false);
    }
  }

  public openMenuOverlay() {
    this.menuOverlay.classList.remove('hidden');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  public closeMenuOverlay() {
    this.menuOverlay.classList.add('hidden');
    if (!this.touchController.isEnabled) {
      document.getElementById('three-canvas')!.requestPointerLock();
    }
  }

  private setupMenuEvents() {
    // Control Mode Selection (Auto, Touch, Desktop)
    document.querySelectorAll('#control-mode-select .menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#control-mode-select .menu-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.controlMode = (target.dataset.ctrl as 'auto' | 'touch' | 'desktop') || 'auto';
      });
    });

    document.querySelectorAll('#map-select .menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#map-select .menu-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.selectedMap = target.dataset.map as MapId;
      });
    });

    // Round Duration Selection (1:55, 3:00, 5:00, 10:00, Unlimited)
    document.querySelectorAll('#round-time-select .menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#round-time-select .menu-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.selectedRoundDuration = parseInt(target.dataset.time || '115', 10);
      });
    });

    document.querySelectorAll('#bot-diff-select .menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#bot-diff-select .menu-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.selectedDifficulty = target.dataset.diff as BotDifficulty;
        this.botManager.setDifficulty(this.selectedDifficulty);
      });
    });

    document.querySelectorAll('#bot-count-select .menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#bot-count-select .menu-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.botCount = parseInt(target.dataset.count || '4', 10);
      });
    });

    // Mouse Controls Mode (Standard vs Inverted)
    document.querySelectorAll('#mouse-mode-select .menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#mouse-mode-select .menu-btn').forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.mouseMode = (target.dataset.mode as 'standard' | 'inverted') || 'standard';
      });
    });

    const startBtn = document.getElementById('start-game-btn')!;
    startBtn.addEventListener('click', () => {
      this.sound.init();
      this.loadSelectedMap();
      this.menuOverlay.classList.add('hidden');

      // Auto detect mobile device or follow explicit control setting
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth < 900;
      if (this.controlMode === 'touch' || (this.controlMode === 'auto' && isTouch)) {
        this.touchController.setEnabled(true);
      } else {
        this.touchController.setEnabled(false);
        document.getElementById('three-canvas')!.requestPointerLock();
      }
    });

    document.querySelectorAll('.weapon-buy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const weaponId = (e.currentTarget as HTMLElement).dataset.weapon as WeaponId;
        if (weaponId) {
          this.weapons.equipWeapon(weaponId);
          if (weaponId === 'knife') this.activeSlot = 3;
          else if (weaponId === 'deagle') this.activeSlot = 2;
          else this.activeSlot = 1;
          this.closeBuyMenu();
        }
      });
    });
  }

  private setupWindowEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Quick action buttons in top-right HUD
    const quickMenuBtn = document.getElementById('btn-quick-menu');
    if (quickMenuBtn) {
      quickMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMenuOverlay();
      });
    }

    const quickFsBtn = document.getElementById('btn-quick-fs');
    if (quickFsBtn) {
      quickFsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    const quickBuyBtn = document.getElementById('btn-quick-buy');
    if (quickBuyBtn) {
      quickBuyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleBuyMenu();
      });
    }

    const closeBuyBtn = document.getElementById('close-buy-menu-btn');
    if (closeBuyBtn) {
      closeBuyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeBuyMenu();
      });
    }

    document.addEventListener('pointerlockchange', () => {
      const canvas = document.getElementById('three-canvas')!;
      this.isPointerLocked = document.pointerLockElement === canvas;
      // On desktop: if pointer lock is lost, return to menu overlay
      if (!this.isPointerLocked && !this.touchController.isEnabled) {
        if (this.buyMenu.classList.contains('hidden')) {
          this.menuOverlay.classList.remove('hidden');
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;

      const isLeft = e.button === 0;
      const isRight = e.button === 2;

      const isShootClick = (this.mouseMode === 'standard' && isLeft) || (this.mouseMode === 'inverted' && isRight);
      const isZoomClick = (this.mouseMode === 'standard' && isRight) || (this.mouseMode === 'inverted' && isLeft);

      if (isShootClick) {
        this.isFiring = true;
        this.weapons.fire(this.camera.position, this.player.getForward(), this.player.currentSpeedMult);
      } else if (isZoomClick) {
        e.preventDefault();
        // Toggle ADS / Scope Zoom for all weapons!
        this.weapons.toggleAim();
        this.ui.setScopeVisible(this.weapons.isScoped);
      }
    });

    window.addEventListener('mouseup', (e) => {
      const isLeft = e.button === 0;
      const isRight = e.button === 2;
      const isShootClick = (this.mouseMode === 'standard' && isLeft) || (this.mouseMode === 'inverted' && isRight);

      if (isShootClick) {
        this.isFiring = false;
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (!this.isPointerLocked && !this.touchController.isEnabled) return;

      if (e.code === 'Digit1') {
        this.selectSlot(1);
      } else if (e.code === 'Digit2') {
        this.selectSlot(2);
      } else if (e.code === 'Digit3') {
        this.selectSlot(3);
      } else if (e.code === 'KeyR') {
        this.weapons.reload();
      } else if (e.code === 'KeyB') {
        this.toggleBuyMenu();
      } else if (e.code === 'KeyZ' || e.code === 'KeyV') {
        // Alternative key for Zoom
        this.weapons.toggleAim();
        this.ui.setScopeVisible(this.weapons.isScoped);
      } else if (e.code === 'Escape') {
        if (!this.buyMenu.classList.contains('hidden')) {
          this.closeBuyMenu();
        } else {
          this.openMenuOverlay();
        }
      }
    });
  }

  private toggleBuyMenu() {
    if (this.buyMenu.classList.contains('hidden')) {
      this.buyMenu.classList.remove('hidden');
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } else {
      this.closeBuyMenu();
    }
  }

  private closeBuyMenu() {
    this.buyMenu.classList.add('hidden');
    if (!this.touchController.isEnabled) {
      document.getElementById('three-canvas')!.requestPointerLock();
    }
  }

  private startNewRound(isMatchStart: boolean = false) {
    this.roundState = 'active';
    this.isRoundEnded = false;
    this.currentRoundSeconds = this.selectedRoundDuration;
    this.playerHealth = 100;
    this.playerArmor = 100;

    // Refill clips and reserve ammo for weapons
    for (const wid of Object.keys(this.weapons.ammo) as WeaponId[]) {
      this.weapons.ammo[wid].clip = WEAPON_REGISTRY[wid].clipSize;
      this.weapons.ammo[wid].reserve = WEAPON_REGISTRY[wid].reserveAmmo;
    }

    if (this.currentMapData) {
      this.player.setPosition(
        this.currentMapData.playerSpawn.x,
        this.currentMapData.playerSpawn.y,
        this.currentMapData.playerSpawn.z,
        this.currentMapData.playerYaw
      );

      if (!isMatchStart) {
        this.botManager.resetAllBotsForNewRound(
          this.currentMapData.botSpawns,
          this.currentMapData.botRoutes
        );
      }
    }

    this.ui.hideRoundEnd();
    this.sound.playRoundStart();
  }

  private endRound(winner: 'ct' | 't', reason: string) {
    if (this.isRoundEnded) return;
    this.isRoundEnded = true;
    this.roundState = 'round_end';
    this.roundEndTimer = 4.2;

    if (winner === 'ct') {
      this.scoreCT++;
      this.sound.playRoundWin();
    } else {
      this.scoreT++;
      this.sound.playRoundLoss();
    }

    this.ui.showRoundEnd(winner, this.scoreCT, this.scoreT, reason);
  }

  private onBulletHitBot(damage: number, hitbox: string, botId?: string) {
    const isHeadshot = hitbox === 'head';
    this.ui.showHitmarker(isHeadshot);

    const bot = this.botManager.bots.find((b) => b.id === botId);
    if (bot) {
      const killed = bot.takeDamage(damage, hitbox);
      if (killed) {
        this.ui.addKillfeed('Player', this.weapons.activeWeapon.name, bot.name, isHeadshot, true);

        // Check if all enemy bots are eliminated in round
        if (this.botManager.getAliveBotsCount() === 0 && !this.isRoundEnded) {
          setTimeout(() => {
            this.endRound('ct', "Barcha terrorchilar yo'q qilindi!");
          }, 350);
        }
      }
    }
  }

  private onPlayerTakeDamage(damage: number) {
    if (this.playerHealth <= 0 || this.isRoundEnded) return;

    // CS2 Kevlar + Helmet absorption: 50% damage absorbed by armor!
    let healthDamage = damage;
    if (this.playerArmor > 0) {
      const absorbed = Math.min(this.playerArmor, Math.round(damage * 0.5));
      this.playerArmor -= absorbed;
      healthDamage = damage - absorbed;
    }

    this.playerHealth = Math.max(0, this.playerHealth - healthDamage);
    this.ui.showDamageFlash();

    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.ui.addKillfeed('Bot', 'AK-47', 'Player', false, false);
      this.endRound('t', "Kontr-terrorchi safdan chiqdi!");
    }
  }

  private gameLoop(_timestamp: number) {
    requestAnimationFrame((t) => this.gameLoop(t));

    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Sync mobile virtual joystick into player controller
    if (this.touchController.isEnabled) {
      this.player.touchMoveVector.x = this.touchController.moveVector.x;
      this.player.touchMoveVector.y = this.touchController.moveVector.y;
    }

    // Round Timer and Victory / Defeat State Machine
    if (this.roundState === 'active') {
      // Countdown round timer if not unlimited
      if (this.selectedRoundDuration > 0) {
        this.currentRoundSeconds -= dt;
        if (this.currentRoundSeconds <= 0) {
          this.currentRoundSeconds = 0;
          this.endRound('ct', "Vaqt tugadi — Kontr-terrorchilar himoyalandi!");
        }
      }
      this.ui.updateTimerDisplay(this.currentRoundSeconds);

      // Check if all bots are dead
      if (this.botManager.getAliveBotsCount() === 0 && this.botManager.bots.length > 0 && !this.isRoundEnded) {
        this.endRound('ct', "Barcha terrorchilar yo'q qilindi!");
      }
    } else if (this.roundState === 'round_end') {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        this.startNewRound(false);
      }
    }

    // Weapon firing (desktop or touch hold)
    const isTriggerDown = this.isFiring || this.touchController.isFiring;
    if (isTriggerDown && this.weapons.activeWeapon.type === 'rifle' && this.roundState === 'active') {
      this.weapons.fire(this.camera.position, this.player.getForward(), this.player.currentSpeedMult);
    }

    this.physics.step(dt);
    this.player.update(dt, this.weapons.activeWeapon.moveSpeed, this.weapons.isScoped || this.weapons.isAiming);
    this.weapons.update(dt);
    this.botManager.update(dt, this.player.position);

    // Keep UI scope overlay in sync
    this.ui.setScopeVisible(this.weapons.isScoped);

    const activeAmmo = this.weapons.ammo[this.weapons.activeWeapon.id];
    this.ui.updateHUD(
      this.playerHealth,
      this.playerArmor,
      this.weapons.activeWeapon,
      activeAmmo.clip,
      activeAmmo.reserve,
      this.activeSlot
    );
    this.ui.updateCrosshair(this.player.currentSpeedMult, isTriggerDown);
    this.ui.updateRadar(this.player.position, this.player.yaw, this.botManager.bots, this.selectedMap);

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const game = new CS2Game();
  await game.init();
});
