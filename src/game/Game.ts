import * as THREE from 'three';
import { AssetLibrary } from './AssetLibrary';
import { Input } from './Input';
import { Player } from './Player';
import { UI } from './UI';
import { World } from './World';
import type { GameStats, Interactable } from './types';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private input = new Input();
  private assets = new AssetLibrary();
  private ui: UI;
  private player = new Player(this.assets);
  private world!: World;
  private running = false;
  private finished = false;
  private hovered: Interactable | null = null;
  private cameraTarget = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(10.5, 13.5, 10.5);
  private timerAccumulator = 0;
  private readonly stats: GameStats = {
    remainingSeconds: 45 * 60,
    errors: 0,
    hints: 0,
    evidence: new Set<string>(),
    keys: new Set<string>(),
    startedAt: null,
    finishedAt: null
  };

  constructor(private root: HTMLElement) {
    this.root.classList.add('game-root');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.className = 'game-canvas';
    this.root.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-10, 10, 7.5, -7.5, 0.1, 100);
    this.ui = new UI(this.root);
    window.addEventListener('resize', () => this.resize());
  }

  async boot(): Promise<void> {
    this.configureScene();
    this.world = new World(this.scene, this.assets, this.ui, this.stats, () => this.finish());

    this.ui.setObjective('Cargando activos de la mazmorra...');
    await Promise.all([this.player.init(), this.world.init()]);
    this.scene.add(this.player.group);
    this.player.position.set(-6.7, 0, 0);

    this.ui.setObjective('Reúne las 3 evidencias de trazabilidad en la primera cámara.');
    this.ui.update(this.stats);
    this.positionCamera(true);
    this.renderer.render(this.scene, this.camera);

    await this.ui.waitForStart();
    this.stats.startedAt = performance.now();
    this.running = true;
    this.clock.start();
    this.loop();
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(0x08101a);
    this.scene.fog = new THREE.FogExp2(0x08101a, 0.018);

    const hemi = new THREE.HemisphereLight(0x9dbdff, 0x17110d, 1.5);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d2, 2.7);
    sun.position.set(-8, 18, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 55;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.finished) {
      const locked = this.ui.isModalOpen();
      this.player.update(dt, this.input, this.world.colliders, locked);
      this.world.update(dt, this.player.position);

      this.timerAccumulator += dt;
      // El cronómetro no se pausa al leer documentos o resolver retos: sigue siendo un escape room.
      if (this.timerAccumulator >= 0.1) {
        this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - this.timerAccumulator);
        this.timerAccumulator = 0;
      }
      if (this.stats.remainingSeconds <= 0) this.fail();

      this.hovered = locked ? null : this.world.nearestInteractable(this.player.position);
      this.ui.setInteraction(this.hovered ? this.hovered.label : null);
      if (this.hovered && this.input.consumePress('KeyE')) {
        this.player.playInteract();
        const item = this.hovered;
        void Promise.resolve(item.onInteract()).then(() => {
          if (item.once) item.consumed = true;
        });
      }
    }

    this.positionCamera(false, dt);
    this.ui.update(this.stats);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  private positionCamera(immediate: boolean, dt = 0): void {
    this.cameraTarget.set(this.player.position.x, 0.8, this.player.position.z);
    const desired = this.cameraTarget.clone().add(this.cameraOffset);
    if (immediate) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 6.5));
    this.camera.lookAt(this.cameraTarget);
  }

  private resize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const viewHeight = 15.5;
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.stats.finishedAt = performance.now();
    const elapsed = this.stats.startedAt ? (this.stats.finishedAt - this.stats.startedAt) / 1000 : 0;
    this.ui.setInteraction(null);
    this.ui.showVictory(elapsed, this.stats);
  }

  private fail(): void {
    if (this.finished) return;
    this.finished = true;
    this.ui.setInteraction(null);
    this.ui.showFailure();
  }
}
