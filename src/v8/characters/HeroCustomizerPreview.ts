import * as THREE from 'three';
import { CharacterAnimator } from '../animation/CharacterAnimator';
import type { HeroAppearance } from '../types';
import { HeroCharacter } from './HeroCharacter';

type PreviewAsset = {
  visual: THREE.Group;
  animator: CharacterAnimator;
};

/** Live preview of the exact same canonical hero used during gameplay. */
export class HeroCustomizerPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
  private readonly clock = new THREE.Clock();
  private current: PreviewAsset | null = null;
  private frame = 0;
  private generation = 0;
  private disposed = false;
  private yaw = -0.04;
  private dragging = false;
  private lastPointerX = 0;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'v8-customizer-canvas';
    this.renderer.domElement.style.cursor = 'grab';
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x09151d);
    this.scene.fog = new THREE.Fog(0x09151d, 7.5, 14);
    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0x17252c, 1.85));

    const key = new THREE.DirectionalLight(0xffefd5, 3.25);
    key.position.set(-3.4, 5.8, 4.6);
    key.castShadow = true;
    key.shadow.mapSize.set(768, 768);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -1;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x57bff2, 2.35);
    rim.position.set(4.2, 3.8, -3.5);
    this.scene.add(rim);

    const faceFill = new THREE.PointLight(0xd9f3ff, 1.2, 8);
    faceFill.position.set(0.2, 2.45, 3.8);
    this.scene.add(faceFill);

    const warmFill = new THREE.PointLight(0xf3c83f, 0.5, 8);
    warmFill.position.set(-2.5, 1.5, 2.4);
    this.scene.add(warmFill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.25, 64),
      new THREE.MeshStandardMaterial({ color: 0x111f27, roughness: 0.82, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.34, 0.018, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x3c9cc8, transparent: true, opacity: 0.44 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    this.camera.position.set(0.25, 2.05, 5.15);
    this.camera.lookAt(0, 1.25, 0);

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.resize);

    this.resize();
    this.clock.start();
    this.animate();
  }

  async setAppearance(appearance: HeroAppearance): Promise<void> {
    const generation = ++this.generation;
    try {
      const hero = new HeroCharacter();
      const model = hero.create({
        name: 'Investigador',
        role: 'quality',
        accent: new THREE.Color(appearance.vest).getHex(),
        appearance
      });
      const animator = new CharacterAnimator({ ...model.rig, root: model.root, visual: model.visual });
      const next: PreviewAsset = { visual: model.visual, animator };

      if (this.disposed || generation !== this.generation) return;

      if (this.current) this.scene.remove(this.current.visual);
      this.current = next;
      next.visual.position.set(0, 0, 0);
      next.visual.rotation.y = this.yaw;
      next.animator.setLocomotion(false, false, false);
      this.scene.add(next.visual);
      this.host.classList.add('is-ready');
      this.host.classList.remove('is-error');
    } catch (error) {
      console.warn('[V8] Hero customizer preview unavailable.', error);
      this.host.classList.add('is-error');
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    cancelAnimationFrame(this.frame);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.dragging = true;
    this.lastPointerX = event.clientX;
    this.renderer.domElement.style.cursor = 'grabbing';
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = event.clientX - this.lastPointerX;
    this.lastPointerX = event.clientX;
    this.yaw += dx * 0.008;
  };

  private onPointerUp = (): void => {
    this.dragging = false;
    this.renderer.domElement.style.cursor = 'grab';
  };

  private animate = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.04);
    if (this.current) {
      this.current.animator.update(dt);
      this.current.visual.rotation.y = THREE.MathUtils.lerp(this.current.visual.rotation.y, this.yaw, 0.18);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private resize = (): void => {
    const width = Math.max(260, this.host.clientWidth || 420);
    const height = Math.max(320, this.host.clientHeight || 520);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };
}
