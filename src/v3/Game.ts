import * as THREE from 'three';
import { AssetLibrary } from '../game/AssetLibrary';
import { AdventureAudio } from './Audio';
import { CinematicDirector } from './CinematicDirector';
import { Controls } from './Controls';
import { AdventurePlayer } from './Player';
import { CHAPTER_CINEMATICS, CHAPTER_DIALOGUES, OPENING_CINEMATIC, PROLOGUE_BRIEFING } from './story';
import type { GameProgress, PlayerProfile, ZoneId } from './types';
import { AdventureUI } from './UI';
import { AdventureWorld } from './World';

export class AdventureGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private assets = new AssetLibrary();
  private ui: AdventureUI;
  private audio = new AdventureAudio();
  private controls: Controls;
  private cinematic: CinematicDirector;
  private player!: AdventurePlayer;
  private world!: AdventureWorld;
  private profile!: PlayerProfile;
  private running = false;
  private finished = false;
  private chapterTransitioning = false;
  private chapterCinematicsSeen = new Set<ZoneId>(['control']);
  private yaw = Math.PI * 0.72;
  private pitch = 0.76;
  private distance = 10.8;
  private cameraTarget = new THREE.Vector3();
  private lastZone: ZoneId = 'control';
  private timerAccumulator = 0;

  private progress: GameProgress = {
    zone: 'control',
    objective: 'Verifica el pedido original',
    objectiveDetail: 'Habla con Calidad y consulta la referencia maestra antes de entrar a planta.',
    score: 600,
    errors: 0,
    remainingSeconds: 45 * 60,
    startedAt: null,
    completedAt: null,
    scannedLots: new Set(),
    evidence: new Set(),
    inventory: new Map(),
    productionSequence: [],
    causesFound: new Set(),
    ishikawaPlaced: new Map(),
    fiveWhysStep: 0,
    flags: new Set()
  };

  constructor(private root: HTMLElement) {
    this.root.classList.add('adv-root');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.className = 'adv-canvas';
    this.root.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 180);
    this.ui = new AdventureUI(root);
    this.cinematic = new CinematicDirector(root, this.camera);
    this.controls = new Controls(this.renderer.domElement);
    window.addEventListener('resize', this.onResize);
  }

  async boot(): Promise<void> {
    this.configureScene();
    this.profile = await this.ui.createProfile();
    await this.audio.unlock();

    this.player = new AdventurePlayer(this.profile);
    this.world = new AdventureWorld(this.scene, this.assets, this.ui, this.progress, this.profile, this.audio, () => this.finish());

    this.ui.setObjective('Cargando planta...', 'Preparando áreas, terminales y controles de misión.');
    await Promise.all([this.player.init(), this.world.init()]);
    this.scene.add(this.player.group);
    this.player.position.set(-31.6, 0, 0);
    this.player.onFootstep = () => this.audio.step();

    this.positionCamera(true, 0);
    this.renderer.render(this.scene, this.camera);

    // Start the render loop before awaiting cinematics. The mission timer remains
    // stopped until the briefing is complete.
    this.running = true;
    this.clock.start();
    this.loop();

    await this.cinematic.play(OPENING_CINEMATIC);
    await this.ui.dialogue(PROLOGUE_BRIEFING);

    this.progress.startedAt = performance.now();
    this.progress.objective = 'Verifica el pedido original';
    this.progress.objectiveDetail = 'Habla con Laura y consulta la terminal azul antes de atravesar el primer control de acceso.';
    this.ui.setObjective(this.progress.objective, this.progress.objectiveDetail);
    this.ui.update(this.progress);
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(0x07131e);
    this.scene.fog = new THREE.Fog(0x07131e, 28, 92);

    const hemi = new THREE.HemisphereLight(0xb9dcff, 0x19222b, 2.1);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xf2f7ff, 3.0);
    key.position.set(-14, 22, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -55;
    key.shadow.camera.right = 55;
    key.shadow.camera.top = 35;
    key.shadow.camera.bottom = -35;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 80;
    key.shadow.bias = -0.0003;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x5da9d9, 1.0);
    fill.position.set(20, 10, -18);
    this.scene.add(fill);
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.045);

    if (!this.finished) {
      if (this.cinematic.isPlaying) this.cinematic.update(dt);
      else this.handleCameraInput(dt);

      const modalLocked = this.ui.isModalOpen();
      const movementLocked = modalLocked || this.cinematic.isPlaying || this.chapterTransitioning;

      // Exact screen-space axes. These vectors describe literal top/right of
      // the display on the horizontal floor plane for the current camera yaw.
      const screenUp = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const screenRight = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      this.player.update(dt, this.controls, this.world.colliders, screenUp, screenRight, movementLocked);
      this.world.update(dt);

      const zone = this.world.zoneForPosition(this.player.position);
      if (zone !== this.lastZone) {
        this.lastZone = zone;
        this.progress.zone = zone;
        this.ui.setZone(zone);

        const sequence = CHAPTER_CINEMATICS[zone];
        if (sequence && !this.chapterCinematicsSeen.has(zone)) {
          this.chapterCinematicsSeen.add(zone);
          void this.playChapterIntro(zone);
        } else {
          this.ui.showToast('NUEVA ÁREA', this.zoneArrivalText(zone), 'normal');
        }
      }

      this.timerAccumulator += dt;
      const storyPaused = this.cinematic.isPlaying || this.chapterTransitioning || modalLocked;
      if (this.progress.startedAt !== null && !storyPaused && this.timerAccumulator >= 0.1) {
        this.progress.remainingSeconds = Math.max(0, this.progress.remainingSeconds - this.timerAccumulator);
        this.timerAccumulator = 0;
      }
      if (this.progress.remainingSeconds <= 0) this.fail();

      if (!movementLocked) {
        const nearest = this.world.nearestInteractable(this.player.position);
        this.ui.setInteraction(nearest?.label ?? null);
        if (nearest && this.controls.consumePress('KeyE')) {
          this.player.playInteract();
          this.audio.interact();
          void Promise.resolve(nearest.onInteract());
        }
        if (this.controls.consumePress('KeyI')) this.ui.toggleInventory(this.progress);
        if (this.controls.consumePress('KeyQ', 'Tab')) this.ui.toggleMap(this.progress);
        if (this.controls.consumePress('KeyM')) {
          const enabled = this.audio.toggle();
          this.ui.showToast('AUDIO', enabled ? 'Sonido activado.' : 'Sonido silenciado.');
        }
        if (this.controls.consumePress('Escape')) this.ui.closePanels();
      } else {
        this.ui.setInteraction(null);
      }
    }

    if (!this.cinematic.isPlaying) this.positionCamera(false, dt);
    this.ui.update(this.progress);
    this.renderer.render(this.scene, this.camera);
    this.controls.endFrame();
  };

  private async playChapterIntro(zone: ZoneId): Promise<void> {
    const sequence = CHAPTER_CINEMATICS[zone];
    if (!sequence) return;

    this.chapterTransitioning = true;
    this.ui.closePanels();
    try {
      await this.cinematic.play(sequence);
      const briefing = CHAPTER_DIALOGUES[zone];
      if (briefing?.length) await this.ui.dialogue(briefing);
      this.ui.showToast('CAPÍTULO ACTIVO', this.zoneArrivalText(zone), 'normal');
    } finally {
      this.chapterTransitioning = false;
    }
  }

  private handleCameraInput(dt: number): void {
    const pointer = this.controls.consumePointerDelta();
    if (!this.ui.isModalOpen()) {
      this.yaw -= pointer.x * 0.0042;
      this.pitch = THREE.MathUtils.clamp(this.pitch - pointer.y * 0.0032, 0.48, 1.03);
    }
    const wheel = this.controls.consumeWheel();
    if (wheel !== 0) this.distance = THREE.MathUtils.clamp(this.distance + wheel * 0.008, 7.0, 15.5);

    if (Math.abs(pointer.x) < 0.01 && Math.abs(pointer.y) < 0.01 && this.controls.isDown('KeyR')) {
      this.yaw = THREE.MathUtils.damp(this.yaw, Math.PI * 0.72, 4.5, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, 0.76, 4.5, dt);
    }
  }

  private positionCamera(immediate: boolean, dt: number): void {
    if (!this.player) return;
    const desiredTarget = new THREE.Vector3(this.player.position.x, 1.15, this.player.position.z);
    if (immediate) this.cameraTarget.copy(desiredTarget);
    else this.cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 9));

    const horizontal = Math.cos(this.pitch) * this.distance;
    const desired = new THREE.Vector3(
      this.cameraTarget.x + Math.sin(this.yaw) * horizontal,
      this.cameraTarget.y + Math.sin(this.pitch) * this.distance,
      this.cameraTarget.z + Math.cos(this.yaw) * horizontal
    );
    if (immediate) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8));
    this.camera.lookAt(this.cameraTarget);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.progress.completedAt = performance.now();
    this.ui.setInteraction(null);
    this.ui.showResult(
      this.progress,
      'INVESTIGACIÓN CERRADA',
      `${this.profile.name}, reconstruiste la trazabilidad, distinguiste ejecución de causa y cerraste la NC con una CAPA verificable. La causa raíz quedó establecida en control de versiones y validación pedido–OT.`
    );
  }

  private fail(): void {
    if (this.finished) return;
    this.finished = true;
    this.progress.completedAt = performance.now();
    this.ui.setInteraction(null);
    this.ui.showResult(
      this.progress,
      'TIEMPO AGOTADO',
      'La investigación no cerró dentro de la ventana operativa. Repite la misión priorizando evidencia y evitando conclusiones prematuras.'
    );
  }

  private zoneArrivalText(zone: ZoneId): string {
    const messages: Record<ZoneId, string> = {
      control: 'Centro de mando y referencia maestra del incidente.',
      warehouse: 'Rastrea lotes y demuestra qué material fue usado contra la OT.',
      production: 'Reconstruye el flujo real y determina si el error nació o llegó a producción.',
      quality: 'Construye el Ishikawa y profundiza la evidencia con 5 Porqués.',
      dispatch: 'Contén el incidente antes de permitir cualquier nueva salida.',
      capa: 'Transforma la causa raíz en una acción correctiva medible y verificable.'
    };
    return messages[zone];
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  };
}
