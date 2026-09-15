export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

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
  pickup(): void { this.tone(220, 0.06, 0.08, 'triangle', 360); }
  drop(): void { this.tone(165, 0.07, 0.08, 'triangle', 120); }
  interact(): void { this.tone(420, 0.04, 0.055, 'sine', 560); }
  success(): void { this.tone(523, 0.07, 0.08, 'sine', 659); this.tone(659, 0.07, 0.07, 'sine', 784, 0.08); }
  error(): void { this.tone(180, 0.09, 0.1, 'sawtooth', 115); }

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
  }
}
