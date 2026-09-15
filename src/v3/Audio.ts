export class AdventureAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private ambienceTimer: number | null = null;

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.startAmbience();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.32 : 0;
    return this.enabled;
  }

  step(): void {
    this.tone(95 + Math.random() * 12, 0.025, 'triangle', 0.055, -28);
  }

  interact(): void {
    this.tone(430, 0.055, 'sine', 0.08, 75);
    window.setTimeout(() => this.tone(610, 0.06, 'sine', 0.06, 45), 45);
  }

  success(): void {
    this.tone(523.25, 0.09, 'sine', 0.08, 0);
    window.setTimeout(() => this.tone(659.25, 0.1, 'sine', 0.08, 0), 90);
    window.setTimeout(() => this.tone(783.99, 0.14, 'sine', 0.09, 0), 180);
  }

  error(): void {
    this.tone(170, 0.16, 'sawtooth', 0.08, -80);
    window.setTimeout(() => this.tone(120, 0.18, 'sawtooth', 0.07, -40), 100);
  }

  gate(): void {
    this.tone(86, 0.32, 'triangle', 0.12, 160);
  }

  scan(): void {
    this.tone(880, 0.05, 'square', 0.045, 110);
    window.setTimeout(() => this.tone(1180, 0.05, 'square', 0.04, 0), 55);
  }

  private startAmbience(): void {
    if (!this.context || this.ambienceTimer !== null) return;
    const pulse = () => {
      if (!this.context || !this.enabled) return;
      this.tone(52 + Math.random() * 8, 1.8, 'sine', 0.008, -5);
    };
    pulse();
    this.ambienceTimer = window.setInterval(pulse, 3400);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, sweep: number): void {
    if (!this.context || !this.master || !this.enabled) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + sweep), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
