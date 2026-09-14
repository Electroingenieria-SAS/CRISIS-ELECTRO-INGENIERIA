import * as THREE from 'three';

export class PerformanceGovernor {
  private pixelRatio: number;
  private emaMs = 16.7;
  private elapsed = 0;
  private readonly minRatio = 0.72;
  private readonly maxRatio: number;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.maxRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    this.pixelRatio = Math.min(this.maxRatio, 1.0);
    this.apply();
  }

  update(dt: number): void {
    const frameMs = Math.min(50, dt * 1000);
    this.emaMs = this.emaMs * 0.92 + frameMs * 0.08;
    this.elapsed += dt;
    if (this.elapsed < 1.15) return;
    this.elapsed = 0;

    let next = this.pixelRatio;
    if (this.emaMs > 22.5) next -= 0.1;
    else if (this.emaMs < 15.2) next += 0.06;

    next = THREE.MathUtils.clamp(next, this.minRatio, this.maxRatio);
    if (Math.abs(next - this.pixelRatio) < 0.035) return;
    this.pixelRatio = next;
    this.apply();
  }

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.apply();
  }

  get ratio(): number {
    return this.pixelRatio;
  }

  private apply(): void {
    this.renderer.setPixelRatio(this.pixelRatio);
  }
}
