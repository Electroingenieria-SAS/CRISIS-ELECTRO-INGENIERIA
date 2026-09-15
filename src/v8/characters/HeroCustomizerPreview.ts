import * as THREE from 'three';
import type { HeroAppearance } from '../types';
import { RiggedHeroCharacter, type RiggedHeroAsset } from './RiggedHeroCharacter';

/** Lightweight live preview used only on the start screen. */
export class HeroCustomizerPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  private readonly clock = new THREE.Clock();
  private current: RiggedHeroAsset | null = null;
  private frame = 0;
  private generation = 0;
  private disposed = false;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'v8-customizer-canvas';
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x09151d);
    this.scene.fog = new THREE.Fog(0x09151d, 7, 14);
    this.scene.add(new THREE.HemisphereLight(0xdff4ff, 0x1c2a30, 2.25));

    const key = new THREE.DirectionalLight(0xffefd1, 3.2);
    key.position.set(-3.6, 5.8, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x58bff0, 2.4);
    rim.position.set(4.5, 3.2, -3.5);
    this.scene.add(rim);

    const fill = new THREE.PointLight(0xf3c83f, 1.25, 9);
    fill.position.set(2.2, 2.2, 3.5);
    this.scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.25, 48),
      new THREE.MeshStandardMaterial({ color: 0x111f27, roughness: 0.82, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.32, 0.018, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0x3c9cc8, transparent: true, opacity: 0.42 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    this.camera.position.set(3.15, 2.25, 5.6);
    this.camera.lookAt(0, 1.25, 0);
    this.resize();
    window.addEventListener('resize', this.resize);
    this.clock.start();
    this.animate();
  }

  async setAppearance(appearance: HeroAppearance): Promise<void> {
    const generation = ++this.generation;
    try {
      const next = await new RiggedHeroCharacter().load(appearance);
      if (this.disposed || generation !== this.generation) {
        next.animator.dispose();
        return;
      }

      if (this.current) {
        this.scene.remove(this.current.root);
        this.current.animator.dispose();
      }
      this.current = next;
      next.root.position.set(0, 0, 0);
      next.root.rotation.y = -0.34;
      next.animator.setLocomotion(false, false, false);
      this.scene.add(next.root);
      this.host.classList.add('is-ready');
    } catch (error) {
      console.warn('[V8] Hero customizer preview unavailable.', error);
      this.host.classList.add('is-error');
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    window.removeEventListener('resize', this.resize);
    cancelAnimationFrame(this.frame);
    this.current?.animator.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.04);
    if (this.current) {
      this.current.animator.update(dt);
      this.current.root.rotation.y += dt * 0.14;
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
