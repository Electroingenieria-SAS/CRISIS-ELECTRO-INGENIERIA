import * as THREE from 'three';

export type CinematicShot = {
  duration: number;
  position: [number, number, number];
  target: [number, number, number];
  kicker?: string;
  title?: string;
  caption?: string;
};

export type CinematicSequence = {
  id: string;
  shots: CinematicShot[];
  skippable?: boolean;
};

/**
 * Lightweight in-engine cinematic system.
 * It owns the game camera only while a sequence is playing and exposes an
 * overlay with letterboxing, chapter labels, captions and skip controls.
 */
export class CinematicDirector {
  private overlay: HTMLDivElement;
  private kicker: HTMLElement;
  private title: HTMLElement;
  private caption: HTMLElement;
  private counter: HTMLElement;
  private progress: HTMLElement;
  private skipButton: HTMLButtonElement;

  private sequence: CinematicSequence | null = null;
  private shotIndex = 0;
  private shotTime = 0;
  private startPosition = new THREE.Vector3();
  private startTarget = new THREE.Vector3();
  private currentTarget = new THREE.Vector3();
  private resolvePlay: (() => void) | null = null;

  constructor(private root: HTMLElement, private camera: THREE.PerspectiveCamera) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'ei-cinematic is-hidden';
    this.overlay.innerHTML = `
      <div class="ei-cine-bar ei-cine-bar--top"></div>
      <div class="ei-cine-bar ei-cine-bar--bottom"></div>
      <div class="ei-cine-gradient"></div>
      <div class="ei-cine-copy">
        <span class="ei-cine-kicker" id="ei-cine-kicker"></span>
        <h2 id="ei-cine-title"></h2>
        <p id="ei-cine-caption"></p>
      </div>
      <div class="ei-cine-status">
        <span id="ei-cine-counter">01 / 01</span>
        <div class="ei-cine-progress"><i id="ei-cine-progress"></i></div>
        <button id="ei-cine-skip" type="button">SALTAR · ESC</button>
      </div>
      <div class="ei-cine-continue">ENTER / ESPACIO · CONTINUAR</div>
    `;
    this.root.appendChild(this.overlay);

    this.kicker = this.overlay.querySelector('#ei-cine-kicker')!;
    this.title = this.overlay.querySelector('#ei-cine-title')!;
    this.caption = this.overlay.querySelector('#ei-cine-caption')!;
    this.counter = this.overlay.querySelector('#ei-cine-counter')!;
    this.progress = this.overlay.querySelector('#ei-cine-progress')!;
    this.skipButton = this.overlay.querySelector<HTMLButtonElement>('#ei-cine-skip')!;

    this.skipButton.addEventListener('click', () => this.finish());
    window.addEventListener('keydown', this.onKeyDown);
  }

  get isPlaying(): boolean {
    return this.sequence !== null;
  }

  play(sequence: CinematicSequence): Promise<void> {
    if (!sequence.shots.length) return Promise.resolve();
    if (this.isPlaying) this.finish();

    this.sequence = sequence;
    this.shotIndex = 0;
    this.shotTime = 0;
    this.startPosition.copy(this.camera.position);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    this.currentTarget.copy(this.camera.position).add(forward.multiplyScalar(10));
    this.startTarget.copy(this.currentTarget);
    this.overlay.classList.remove('is-hidden');
    this.skipButton.style.display = sequence.skippable === false ? 'none' : '';
    this.prepareShot();

    return new Promise<void>((resolve) => {
      this.resolvePlay = resolve;
    });
  }

  update(dt: number): void {
    if (!this.sequence) return;
    const shot = this.sequence.shots[this.shotIndex];
    if (!shot) {
      this.finish();
      return;
    }

    this.shotTime += dt;
    const blendDuration = Math.max(0.55, Math.min(1.35, shot.duration * 0.38));
    const rawT = THREE.MathUtils.clamp(this.shotTime / blendDuration, 0, 1);
    const t = rawT * rawT * (3 - 2 * rawT); // smoothstep
    const targetPosition = new THREE.Vector3(...shot.position);
    const targetLookAt = new THREE.Vector3(...shot.target);

    this.camera.position.lerpVectors(this.startPosition, targetPosition, t);
    this.currentTarget.lerpVectors(this.startTarget, targetLookAt, t);
    this.camera.lookAt(this.currentTarget);

    const progress = THREE.MathUtils.clamp(this.shotTime / shot.duration, 0, 1);
    this.progress.style.width = `${Math.round(progress * 100)}%`;

    if (this.shotTime >= shot.duration) this.nextShot();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.overlay.remove();
  }

  private prepareShot(): void {
    if (!this.sequence) return;
    const shot = this.sequence.shots[this.shotIndex];
    if (!shot) return;

    this.kicker.textContent = shot.kicker ?? '';
    this.title.textContent = shot.title ?? '';
    this.caption.textContent = shot.caption ?? '';
    this.counter.textContent = `${String(this.shotIndex + 1).padStart(2, '0')} / ${String(this.sequence.shots.length).padStart(2, '0')}`;
    this.progress.style.width = '0%';

    const copy = this.overlay.querySelector('.ei-cine-copy');
    copy?.classList.remove('is-entering');
    requestAnimationFrame(() => copy?.classList.add('is-entering'));
  }

  private nextShot(): void {
    if (!this.sequence) return;
    if (this.shotIndex >= this.sequence.shots.length - 1) {
      this.finish();
      return;
    }

    this.shotIndex += 1;
    this.shotTime = 0;
    this.startPosition.copy(this.camera.position);
    this.startTarget.copy(this.currentTarget);
    this.prepareShot();
  }

  private finish(): void {
    if (!this.sequence) return;
    this.sequence = null;
    this.overlay.classList.add('is-hidden');
    this.progress.style.width = '0%';
    const resolve = this.resolvePlay;
    this.resolvePlay = null;
    resolve?.();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.sequence) return;
    if (event.code === 'Escape' && this.sequence.skippable !== false) {
      event.preventDefault();
      this.finish();
      return;
    }
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      this.nextShot();
    }
  };
}
