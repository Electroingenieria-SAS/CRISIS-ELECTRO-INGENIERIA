export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private started = false;
  private muted = false;

  async start(): Promise<void> {
    if (this.started) {
      await this.context?.resume();
      return;
    }
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    this.context = new AudioContextCtor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.34;
    this.master.connect(this.context.destination);

    this.ambience = this.context.createGain();
    this.ambience.gain.value = 0.08;
    this.ambience.connect(this.master);

    const droneA = this.context.createOscillator();
    const droneB = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    droneA.type = 'sine';
    droneA.frequency.value = 55;
    droneB.type = 'triangle';
    droneB.frequency.value = 82.5;
    droneA.connect(filter);
    droneB.connect(filter);
    filter.connect(this.ambience);
    droneA.start();
    droneB.start();
    this.started = true;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.34, this.context.currentTime, 0.03);
    }
    return this.muted;
  }

  ui(): void { this.tone(520, 0.05, 'square', 0.04); }
  collect(): void { this.chord([660, 880, 1100], 0.16, 0.045); }
  chest(): void { this.chord([180, 240, 360], 0.22, 0.05); }
  success(): void { this.chord([392, 523.25, 659.25, 783.99], 0.34, 0.055); }
  error(): void { this.chord([150, 116], 0.22, 0.06); }
  attack(): void { this.noiseBurst(0.075, 0.055); this.tone(145, 0.07, 'sawtooth', 0.04); }
  hit(): void { this.noiseBurst(0.12, 0.08); this.tone(92, 0.16, 'square', 0.06); }
  gate(): void { this.chord([110, 165, 220], 0.45, 0.05); }

  step(intensity = 1): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(75 + Math.random() * 18, now);
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    gain.gain.setValueAtTime(0.025 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  private chord(frequencies: number[], duration: number, volume: number): void {
    frequencies.forEach((frequency, index) => this.tone(frequency, duration + index * 0.025, 'sine', volume, index * 0.025));
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noiseBurst(duration: number, volume: number): void {
    if (!this.context || !this.master || this.muted) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 480;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }
}
