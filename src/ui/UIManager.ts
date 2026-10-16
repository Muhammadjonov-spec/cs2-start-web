import * as THREE from 'three';
import { WeaponDef } from '../types';
import { Bot } from '../bots/BotManager';

export class UIManager {
  private healthEl: HTMLElement;
  private armorEl: HTMLElement;
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

  constructor() {
    this.healthEl = document.getElementById('health-val')!;
    this.armorEl = document.getElementById('armor-val')!;
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
    this.healthEl.textContent = `${Math.max(0, Math.round(health))}`;
    this.armorEl.textContent = `${Math.max(0, Math.round(armor))}`;

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
      ${isHeadshot ? '<span class="kill-hs">💀 HS</span>' : ''}
      <span class="kill-victim">${victim}</span>
    `;

    this.killfeedEl.appendChild(item);

    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.5s';
      setTimeout(() => item.remove(), 500);
    }, 4500);
  }

  public updateRadar(playerPos: THREE.Vector3, playerYaw: number, bots: Bot[]) {
    const ctx = this.radarCtx;
    const width = this.radarCanvas.width;
    const height = this.radarCanvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const scale = 1.3; // 1 meter = 1.3 pixels on radar

    ctx.clearRect(0, 0, width, height);

    // Radar Background Grid & Cross
    ctx.strokeStyle = 'rgba(224, 159, 62, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Player Field of View Cone
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-playerYaw);

    ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 75, -Math.PI / 4 - Math.PI / 2, Math.PI / 4 - Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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
        ctx.fillStyle = '#ff3838';
        ctx.beginPath();
        ctx.arc(cx + rx, cy + ry, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
