import * as THREE from 'three';
import { WeaponDef } from '../types';
import { Bot } from '../bots/BotManager';

export class UIManager {
  private healthEl: HTMLElement;
  private armorEl: HTMLElement;
  private healthBarFillEl: HTMLElement | null = null;
  private armorBarFillEl: HTMLElement | null = null;
  private healthBoxEl: HTMLElement | null = null;

  private clipAmmoEl: HTMLElement;
  private reserveAmmoEl: HTMLElement;
  private weaponNameEl: HTMLElement;
  private killfeedEl: HTMLElement;
  private hitmarkerEl: HTMLElement;
  private damageFlashEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private sniperScopeEl: HTMLElement;
  private scoreTEl: HTMLElement;
  private scoreCTEl: HTMLElement;
  private matchTimerEl: HTMLElement;
  private radarCanvas: HTMLCanvasElement;
  private radarCtx: CanvasRenderingContext2D;

  // Round End Banner Elements
  private roundEndBannerEl: HTMLElement;
  private roundWinnerBadgeEl: HTMLElement;
  private roundWinnerTitleEl: HTMLElement;
  private roundWinnerReasonEl: HTMLElement;
  private bannerScoreCTEl: HTMLElement;
  private bannerScoreTEl: HTMLElement;

  private radarPulseTimer: number = 0;

  constructor() {
    this.healthEl = document.getElementById('health-val')!;
    this.armorEl = document.getElementById('armor-val')!;
    this.healthBarFillEl = document.getElementById('health-bar-fill');
    this.armorBarFillEl = document.getElementById('armor-bar-fill');
    this.healthBoxEl = document.getElementById('health-box');

    this.clipAmmoEl = document.getElementById('clip-ammo')!;
    this.reserveAmmoEl = document.getElementById('reserve-ammo')!;
    this.weaponNameEl = document.getElementById('weapon-display-name')!;
    this.killfeedEl = document.getElementById('killfeed')!;
    this.hitmarkerEl = document.getElementById('hitmarker')!;
    this.damageFlashEl = document.getElementById('damage-flash')!;
    this.crosshairEl = document.getElementById('crosshair')!;
    this.sniperScopeEl = document.getElementById('sniper-scope')!;
    this.scoreTEl = document.getElementById('score-t')!;
    this.scoreCTEl = document.getElementById('score-ct')!;
    this.matchTimerEl = document.getElementById('match-timer')!;
    this.radarCanvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
    this.radarCtx = this.radarCanvas.getContext('2d')!;

    this.roundEndBannerEl = document.getElementById('round-end-banner')!;
    this.roundWinnerBadgeEl = document.getElementById('round-winner-badge')!;
    this.roundWinnerTitleEl = document.getElementById('round-winner-title')!;
    this.roundWinnerReasonEl = document.getElementById('round-winner-reason')!;
    this.bannerScoreCTEl = document.getElementById('banner-score-ct')!;
    this.bannerScoreTEl = document.getElementById('banner-score-t')!;
  }

  public updateHUD(
    health: number,
    armor: number,
    weapon: WeaponDef,
    clipAmmo: number,
    reserveAmmo: number,
    activeSlot: number
  ) {
    const healthVal = Math.max(0, Math.round(health));
    const armorVal = Math.max(0, Math.round(armor));

    this.healthEl.textContent = `${healthVal}`;
    this.armorEl.textContent = `${armorVal}`;

    if (this.healthBarFillEl) {
      this.healthBarFillEl.style.width = `${Math.min(100, healthVal)}%`;
    }
    if (this.armorBarFillEl) {
      this.armorBarFillEl.style.width = `${Math.min(100, armorVal)}%`;
    }

    if (this.healthBoxEl) {
      if (healthVal <= 25) {
        this.healthBoxEl.classList.add('low-hp');
      } else {
        this.healthBoxEl.classList.remove('low-hp');
      }
    }

    this.weaponNameEl.textContent = weapon.name.toUpperCase();
    if (weapon.type === 'melee') {
      this.clipAmmoEl.textContent = '--';
      this.reserveAmmoEl.textContent = '--';
    } else {
      this.clipAmmoEl.textContent = `${clipAmmo}`;
      this.reserveAmmoEl.textContent = `${reserveAmmo}`;
    }

    // Update active inventory slot highlight
    const slots = document.querySelectorAll('.inv-slot');
    slots.forEach((s) => s.classList.remove('active'));
    const current = document.querySelector(`.inv-slot[data-slot="${activeSlot}"]`);
    if (current) current.classList.add('active');

    // Update mobile touch slots if present
    const touchSlots = document.querySelectorAll('.touch-slot-btn');
    touchSlots.forEach((s) => s.classList.remove('active'));
    const currentTouch = document.getElementById(`btn-touch-slot${activeSlot}`);
    if (currentTouch) currentTouch.classList.add('active');
  }

  // Precise CS2 Round Timer Countdown
  public updateTimerDisplay(secondsRemaining: number) {
    if (secondsRemaining < 0) {
      this.matchTimerEl.textContent = '∞';
      return;
    }
    const mins = Math.floor(secondsRemaining / 60);
    const secs = Math.floor(secondsRemaining % 60);
    this.matchTimerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Update Rounds Won Scoreboard
  public setRoundScores(scoreCT: number, scoreT: number) {
    this.scoreCTEl.textContent = `${scoreCT}`;
    this.scoreTEl.textContent = `${scoreT}`;
    if (this.bannerScoreCTEl) this.bannerScoreCTEl.textContent = `${scoreCT}`;
    if (this.bannerScoreTEl) this.bannerScoreTEl.textContent = `${scoreT}`;
  }

  // CS2 Round End Banner (CT Win / T Win)
  public showRoundEnd(winner: 'ct' | 't', scoreCT: number, scoreT: number, reason: string) {
    this.setRoundScores(scoreCT, scoreT);
    this.roundWinnerReasonEl.textContent = reason;

    if (winner === 'ct') {
      this.roundEndBannerEl.className = 'ct-win';
      this.roundWinnerBadgeEl.textContent = 'COUNTER-TERRORISTS';
      this.roundWinnerTitleEl.textContent = 'ROUND WON';
    } else {
      this.roundEndBannerEl.className = 't-win';
      this.roundWinnerBadgeEl.textContent = 'TERRORISTS';
      this.roundWinnerTitleEl.textContent = 'ROUND LOST';
    }

    this.roundEndBannerEl.classList.remove('hidden');
  }

  public hideRoundEnd() {
    this.roundEndBannerEl.classList.add('hidden');
  }

  public updateCrosshair(speedMult: number, isShooting: boolean) {
    const scale = 1 + speedMult * 0.7 + (isShooting ? 0.5 : 0);
    this.crosshairEl.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
  }

  public setScopeVisible(visible: boolean) {
    if (visible) {
      this.sniperScopeEl.classList.remove('hidden');
      this.crosshairEl.classList.add('hidden');
    } else {
      this.sniperScopeEl.classList.add('hidden');
      this.crosshairEl.classList.remove('hidden');
    }
  }

  public showHitmarker(isHeadshot: boolean) {
    this.hitmarkerEl.classList.remove('hidden');
    this.hitmarkerEl.style.color = isHeadshot ? '#ff2222' : '#ffffff';
    setTimeout(() => {
      this.hitmarkerEl.classList.add('hidden');
    }, 90);
  }

  public showDamageFlash() {
    this.damageFlashEl.classList.remove('hidden');
    this.damageFlashEl.style.opacity = '1';
    setTimeout(() => {
      this.damageFlashEl.style.opacity = '0';
      setTimeout(() => this.damageFlashEl.classList.add('hidden'), 200);
    }, 100);
  }

  public addKillfeed(killer: string, weapon: string, victim: string, isHeadshot: boolean, _isPlayerKiller: boolean) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    item.innerHTML = `
      <span class="kill-killer">${killer}</span>
      <span class="kill-weapon">${weapon}</span>
      ${isHeadshot ? '<span class="kill-hs">HEADSHOT</span>' : ''}
      <span class="kill-victim">${victim}</span>
    `;

    this.killfeedEl.appendChild(item);

    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.4s';
      setTimeout(() => item.remove(), 400);
    }, 4500);
  }

  public updateRadar(playerPos: THREE.Vector3, playerYaw: number, bots: Bot[], mapId: string = 'dust2') {
    const ctx = this.radarCtx;
    const width = this.radarCanvas.width;
    const height = this.radarCanvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const scale = 1.25; // 1 meter = 1.25 pixels on radar

    this.radarPulseTimer += 0.05;

    ctx.clearRect(0, 0, width, height);

    // Radar Concentric Range Rings
    ctx.strokeStyle = 'rgba(224, 159, 62, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.arc(cx, cy, 45, 0, Math.PI * 2);
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = 'rgba(224, 159, 62, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, 8);
    ctx.lineTo(cx, height - 8);
    ctx.moveTo(8, cy);
    ctx.lineTo(width - 8, cy);
    ctx.stroke();

    // Player Field of View Cone
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-playerYaw);

    const fovGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 75);
    fovGrad.addColorStop(0, 'rgba(0, 255, 136, 0.35)');
    fovGrad.addColorStop(1, 'rgba(0, 255, 136, 0)');
    ctx.fillStyle = fovGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 75, -Math.PI / 4 - Math.PI / 2, Math.PI / 4 - Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Forward Direction Arrow
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(4, -6);
    ctx.lineTo(-4, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bombsites Coordinates on Radar (A & B)
    const sites = mapId === 'tashkent' ? [
      { name: 'A', x: 38, z: -25 },
      { name: 'B', x: -38, z: 25 },
    ] : [
      { name: 'A', x: 38, z: -25 },
      { name: 'B', x: -36, z: -25 },
    ];

    for (const site of sites) {
      const dx = (site.x - playerPos.x) * scale;
      const dz = (site.z - playerPos.z) * scale;
      const cos = Math.cos(playerYaw);
      const sin = Math.sin(playerYaw);
      const rx = dx * cos - dz * sin;
      const ry = dx * sin + dz * cos;
      const dist = Math.sqrt(rx * rx + ry * ry);

      if (dist < 70) {
        ctx.fillStyle = 'rgba(224, 159, 62, 0.9)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.beginPath();
        ctx.arc(cx + rx, cy + ry, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0d1117';
        ctx.fillText(site.name, cx + rx, cy + ry);
      }
    }

    // Render Bots on Radar
    for (const bot of bots) {
      if (!bot.isAlive) continue;

      const dx = (bot.position.x - playerPos.x) * scale;
      const dz = (bot.position.z - playerPos.z) * scale;

      // Rotate coordinates relative to player yaw
      const cos = Math.cos(playerYaw);
      const sin = Math.sin(playerYaw);
      const rx = dx * cos - dz * sin;
      const ry = dx * sin + dz * cos;

      // Check if within radar circle radius
      const dist = Math.sqrt(rx * rx + ry * ry);
      if (dist < 72) {
        // Red ping halo
        const pulse = Math.sin(this.radarPulseTimer * 4) * 2;
        ctx.strokeStyle = 'rgba(255, 56, 56, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + rx, cy + ry, 6 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Bot red blip with dark outline
        ctx.fillStyle = '#ff3838';
        ctx.beginPath();
        ctx.arc(cx + rx, cy + ry, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}
