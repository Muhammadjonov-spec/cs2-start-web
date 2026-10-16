import * as THREE from 'three';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private listenerPos: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public updateListener(pos: THREE.Vector3) {
    this.listenerPos.copy(pos);
  }

  // CS2 Gunshot Sound Synthesizer
  public playGunshot(weapon: string, origin?: THREE.Vector3) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Spatial Panner if origin given
    let panner: PannerNode | null = null;
    let targetNode: AudioNode = this.masterGain;

    if (origin) {
      panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 5;
      panner.maxDistance = 150;
      panner.rolloffFactor = 1.2;
      panner.positionX.setValueAtTime(origin.x - this.listenerPos.x, now);
      panner.positionY.setValueAtTime(origin.y - this.listenerPos.y, now);
      panner.positionZ.setValueAtTime(origin.z - this.listenerPos.z, now);
      panner.connect(this.masterGain);
      targetNode = panner;
    }

    if (weapon === 'knife') {
      this.playKnifeSwish(targetNode, now);
      return;
    }

    // 1. Initial High Punch Transient (Impulse)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    
    if (weapon === 'awp') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
      oscGain.gain.setValueAtTime(1.0, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    } else if (weapon === 'deagle') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.22);
      oscGain.gain.setValueAtTime(0.85, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    } else if (weapon === 'm4a1') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    } else {
      // AK-47: Sharp, punchy mid-low crack
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.2);
      oscGain.gain.setValueAtTime(0.8, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    }

    osc.connect(oscGain);
    oscGain.connect(targetNode);
    osc.start(now);
    osc.stop(now + 0.45);

    // 2. White Noise Burst for Gunpowder Explosion
    const bufferSize = this.ctx.sampleRate * (weapon === 'awp' ? 0.6 : 0.25);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = weapon === 'm4a1' ? 'lowpass' : 'bandpass';
    noiseFilter.frequency.setValueAtTime(weapon === 'm4a1' ? 1200 : 2500, now);
    noiseFilter.Q.setValueAtTime(1.5, now);

    const noiseGain = this.ctx.createGain();
    const peakVolume = weapon === 'awp' ? 1.0 : weapon === 'm4a1' ? 0.35 : 0.75;
    noiseGain.gain.setValueAtTime(peakVolume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (weapon === 'awp' ? 0.55 : 0.22));

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(targetNode);

    noise.start(now);
    noise.stop(now + 0.6);
  }

  private playKnifeSwish(targetNode: AudioNode, now: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(targetNode);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // CS2 Iconic Headshot "Dink" Sound
  public playHeadshotDink() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    
    // High metallic resonant ping
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2400, now);
    osc1.frequency.exponentialRampToValueAtTime(1900, now + 0.25);
    gain1.gain.setValueAtTime(0.7, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Secondary helmet crunch
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(4200, now);
    osc2.frequency.exponentialRampToValueAtTime(3200, now + 0.1);
    gain2.gain.setValueAtTime(0.5, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(now);
    osc2.stop(now + 0.15);
  }

  // Footstep Sound (Concrete / Sand)
  public playFootstep() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Reload Mechanical Click
  public playReload() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Mag out click
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.07);

    // Mag in click after 0.8s
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(950, now + 0.7);
    osc2.frequency.exponentialRampToValueAtTime(450, now + 0.77);
    gain2.gain.setValueAtTime(0.35, now + 0.7);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(now + 0.7);
    osc2.stop(now + 0.8);
  }

  // CS2 Round Win Fanfare (Counter-Terrorists Win!)
  public playRoundWin() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5 (Triumphant Major chord)

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.25);
    });
  }

  // CS2 Round Defeat (Terrorists Win!)
  public playRoundLoss() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [220.0, 207.65, 196.0]; // A3, Ab3, G3 (Ominous descending notes)

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.22);

      gain.gain.setValueAtTime(0.3, now + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 1.0);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.22);
      osc.stop(now + idx * 0.22 + 1.1);
    });
  }

  // CS2 Round Start Tactical Radio Cue ("Let's go!")
  public playRoundStart() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1174, now + 0.07);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }
}
