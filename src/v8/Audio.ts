import { subscribeAudioCues, type GameAudioCue } from './gameplay/AudioCue';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private readonly unsubscribeCues = subscribeAudioCues((cue) => this.playCue(cue));

  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  scan(): void { this.tone(880, 0.055, 0.11, 'square', 1280); this.tone(1280, 0.04, 0.07, 'sine', 1480, 0.055); }
  pickup(): void { this.playCue('pickup'); }
  drop(): void { this.playCue('place'); }
  interact(): void { this.tone(420, 0.04, 0.055, 'sine', 560); }
  success(): void { this.tone(523, 0.07, 0.08, 'sine', 659); this.tone(659, 0.07, 0.07, 'sine', 784, 0.08); }
  error(): void { this.tone(180, 0.09, 0.1, 'sawtooth', 115); }

  dispose(): void {
    this.unsubscribeCues();
    this.ambient?.stop();
    this.ambient?.disconnect();
    this.ambientGain?.disconnect();
    this.master?.disconnect();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.ambientGain = null;
  }

  private playCue(cue: GameAudioCue): void {
    switch (cue) {
      case 'footstep':
        this.tone(92, 0.035, 0.022, 'triangle', 70);
        break;
      case 'pickup':
        this.tone(220, 0.06, 0.08, 'triangle', 360);
        break;
      case 'place':
        this.tone(165, 0.07, 0.075, 'triangle', 120);
        break;
      case 'throw':
        this.tone(250, 0.08, 0.055, 'triangle', 150);
        break;
      case 'hit-wood':
        this.tone(145, 0.055, 0.075, 'square', 92);
        break;
      case 'hit-metal':
        this.tone(1180, 0.045, 0.045, 'triangle', 1720);
        this.tone(690, 0.07, 0.025, 'sine', 540, 0.025);
        break;
      case 'hit-stone':
        this.tone(105, 0.05, 0.052, 'triangle', 78);
        break;
      case 'hit-generic':
        this.tone(180, 0.045, 0.045, 'triangle', 130);
        break;
      case 'break':
        this.tone(125, 0.10, 0.085, 'sawtooth', 62);
        break;
      case 'door-open':
        this.tone(118, 0.16, 0.038, 'sine', 150);
        break;
      case 'door-close':
        this.tone(142, 0.13, 0.044, 'triangle', 92);
        break;
      case 'chest-open':
        this.tone(196, 0.10, 0.045, 'triangle', 285);
        break;
      case 'lever':
        this.tone(310, 0.04, 0.055, 'square', 210);
        break;
    }
  }

  private startAmbient(): void {
    if (!this.ctx || !this.master || this.ambient) return;
    this.ambient = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();
    this.ambient.type = 'sine';
    this.ambient.frequency.value = 48;
    this.ambientGain.gain.value = 0.014;
    this.ambient.connect(this.ambientGain);
    this.ambientGain.connect(this.master);
    this.ambient.start();
  }

  private tone(
    frequency: number,
    duration: number,
    gain: number,
    type: OscillatorType,
    endFrequency = frequency,
    delay = 0
  ): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      envelope.disconnect();
    }, { once: true });
  }
}
