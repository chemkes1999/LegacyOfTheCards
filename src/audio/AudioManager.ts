import { GameSettings } from '../types/tcg';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private settings: GameSettings = {
    masterVolume: 0.65,
    musicEnabled: true,
    sfxEnabled: true,
    cameraDynamics: true,
    autoChainPrompt: true,
    duelSpeed: 'NORMAL',
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.settings.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.musicEnabled ? 0.18 : 0;
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(next.masterVolume, this.ctx.currentTime, 0.05);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(next.musicEnabled ? 0.18 : 0, this.ctx.currentTime, 0.08);
    }
    if (!next.musicEnabled) {
      this.stopMusic();
    }
  }

  startAmbientMusic(): void {
    if (!this.settings.musicEnabled || this.musicTimer !== null) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;

    // Epic D-minor / Dorian duel ostinato progression
    const bassNotes = [73.42, 73.42, 87.31, 65.41, 73.42, 73.42, 98.0, 82.41]; // D2, D2, F2, C2...
    const arpNotes = [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 392.0, 329.63];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || !this.settings.musicEnabled || this.ctx.state !== 'running') {
        return;
      }
      const now = this.ctx.currentTime;
      const idx = this.musicStep % bassNotes.length;
      this.musicStep++;

      // Warm sub bass pulse every 2 steps
      if (idx % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassNotes[idx], now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.24, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 1.15);
      }

      // Subtle tactical synth arpeggio
      const arp = this.ctx.createOscillator();
      const ag = this.ctx.createGain();
      arp.type = 'sine';
      arp.frequency.setValueAtTime(arpNotes[idx], now);
      ag.gain.setValueAtTime(0.001, now);
      ag.gain.linearRampToValueAtTime(0.09, now + 0.04);
      ag.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      arp.connect(ag);
      ag.connect(this.musicGain);
      arp.start(now);
      arp.stop(now + 0.6);
    }, 620);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak: number = 0.25,
    slideTo?: number,
    delay: number = 0
  ): void {
    if (!this.settings.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    }
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(gainPeak, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playCardHover(): void {
    this.playTone(620 + Math.random() * 45, 0.045, 'sine', 0.06);
  }

  playCardDraw(): void {
    this.playTone(340, 0.09, 'triangle', 0.14, 580);
  }

  playSummon(isBoss: boolean = false): void {
    if (isBoss) {
      this.playTone(146.83, 0.45, 'sawtooth', 0.22, 110, 0);
      this.playTone(293.66, 0.35, 'triangle', 0.22, undefined, 0.04);
      this.playTone(440.0, 0.4, 'triangle', 0.24, undefined, 0.12);
      this.playTone(587.33, 0.65, 'sine', 0.28, undefined, 0.2);
    } else {
      this.playTone(220, 0.16, 'triangle', 0.22, 440);
      this.playTone(440, 0.22, 'sine', 0.18, undefined, 0.06);
    }
  }

  playEffectChain(): void {
    this.playTone(523.25, 0.14, 'sine', 0.2, 783.99, 0);
    this.playTone(783.99, 0.24, 'triangle', 0.18, 1046.5, 0.08);
  }

  playAttackImpact(): void {
    this.playTone(190, 0.18, 'sawtooth', 0.32, 48, 0);
    this.playTone(110, 0.28, 'square', 0.24, 36, 0.04);
  }

  playPhaseChange(): void {
    this.playTone(440, 0.1, 'sine', 0.12, 554.37);
  }

  playVictory(): void {
    const notes = [293.66, 369.99, 440.0, 587.33];
    notes.forEach((n, i) => this.playTone(n, 0.45, 'triangle', 0.24, undefined, i * 0.11));
  }

  playDefeat(): void {
    const notes = [293.66, 261.63, 220.0, 146.83];
    notes.forEach((n, i) => this.playTone(n, 0.45, 'sawtooth', 0.16, undefined, i * 0.14));
  }
}

export const AudioManager = new AudioManagerImpl();
