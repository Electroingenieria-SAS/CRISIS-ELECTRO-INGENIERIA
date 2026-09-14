import * as THREE from 'three';
import { AdventureUI } from '../v3/UI';
import { AdventureAudio } from '../v3/Audio';
import { Controls } from '../v3/Controls';
import { CinematicDirector, type CinematicSequence } from '../v3/CinematicDirector';
import type { GameProgress, PlayerProfile, ZoneId } from '../v3/types';
import { V5ArtPass } from '../v5/ArtPass';
import { V6AdventureLayer } from '../v6/AdventureLayer';
import { V6PostFX } from '../v6/PostFX';
import { PROLOGUE, V4_OPENING } from './content';
import { V4Overlay } from './Overlay';
import { V4Player } from './Player';
import { V4World } from './World';
import type { CarryableSpec, V4Progress, V4Zone } from './types';

export class AdventureGameV4 {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private ui: AdventureUI;
  private overlay: V4Overlay;
  private audio = new AdventureAudio();
  private controls: Controls;
  private cinematic: CinematicDirector;
  private player!: V4Player;
  private world!: V4World;
  private artPass!: V5ArtPass;
  private premium!: V6AdventureLayer;
  private postFx: V6PostFX;
  private profile!: PlayerProfile;
  private running = false;
  private finished = false;
  private yaw = Math.PI * 0.78;
  private pitch = 0.72;
  private distance = 12.8;
  private cameraTarget = new THREE.Vector3();
  private timerAccumulator = 0;
  private lastZone: V4Zone = 'control';
  private seenZones = new Set<V4Zone>(['control']);
  private transitionLock = false;

  private progress: V4Progress = {
    zone: 'control',
    objective: 'Recibe el briefing de Calidad',
    objectiveDetail: 'Habla con Laura y retira el escáner de investigación antes de entrar al muelle.',
    score: 1000,
    errors: 0,
    remainingSeconds: 55 * 60,
    startedAt: null,
    completedAt: null,
    flags: new Set(),
    evidence: new Set(),
    inventory: new Map(),
    chapter: 0,
    qualitySeals: new Set(),
    quarantinedItems: new Set(),
    calibratedTools: new Set(),
    dispatchSlots: new Set(),
    puzzleState: new Map()
  };

  constructor(private root: HTMLElement) {
    this.root.classList.add('v4-root', 'v5-root', 'v6-root');
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

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 320);
    this.ui = new AdventureUI(root);
    this.overlay = new V4Overlay(root);
    this.controls = new Controls(this.renderer.domElement);
    this.cinematic = new CinematicDirector(root, this.camera);
    this.postFx = new V6PostFX(this.renderer, this.scene, this.camera);
    this.postFx.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio, 1.7));
    window.addEventListener('resize', this.onResize);
  }

  async boot(): Promise<void> {
    this.configureScene();
    this.profile = await this.ui.createProfile();
    await this.audio.unlock();

    this.player = new V4Player(this.profile);
    this.world = new V4World(this.scene, this.ui, this.audio, this.progress, () => this.finish());
    this.artPass = new V5ArtPass(this.scene, this.renderer);
    this.premium = new V6AdventureLayer(this.scene, this.ui, this.audio, this.progress);

    this.ui.showToast('V6 · PREPARANDO OPERACIÓN AURORA', 'Cargando campus, logística, exploración y sistemas de investigación.', 'normal');
    await Promise.all([this.player.init(), this.world.init(), this.artPass.init(), this.premium.init()]);

    this.scene.add(this.player.group);
    this.player.position.set(0, 0, 6);
    this.player.onFootstep = () => this.audio.step();

    this.positionCamera(true, 0);
    this.overlay.update(this.progress, null);

    this.running = true;
    this.clock.start();
    this.loop();

    await this.cinematic.play(V4_OPENING);
    await this.ui.dialogue(PROLOGUE);

    this.progress.startedAt = performance.now();
    this.progress.objective = 'Recibe el briefing de Calidad';
    this.progress.objectiveDetail = 'Habla con Laura, retira el escáner EI y reconstruye la desviación área por área. Explora: hay evidencia opcional fuera del camino crítico.';
    this.ui.setObjective(this.progress.objective, this.progress.objectiveDetail);
    this.ui.showToast('OPERACIÓN AURORA · V6', 'La planta está activa. Usa F cuando obtengas el escáner para detectar hallazgos opcionales.', 'success');
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(0x9dbfce);
    this.scene.fog = new THREE.Fog(0x9bbdcb, 72, 170);

    const hemi = new THREE.HemisphereLight(0xe5f3ff, 0x35483b, 2.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 3.15);
    sun.position.set(-38, 54, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -75;
    sun.shadow.camera.right = 75;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.00025;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6aa8c9, 0.72);
    fill.position.set(55, 24, -45);
    this.scene.add(fill);
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.045);

    if (this.cinematic.isPlaying) this.cinematic.update(dt);
    else this.handleCameraInput(dt);

    if (!this.finished) {
      this.handleGlobalControls();

      const modalLocked = this.ui.isModalOpen();
      const mapLocked = this.overlay.isMapOpen();
      const locked = modalLocked || mapLocked || this.cinematic.isPlaying || this.transitionLock;
      const screenUp = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      const screenRight = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      this.player.update(dt, this.controls, this.world.colliders, screenUp, screenRight, locked);
      this.world.update(dt);
      this.artPass.update(dt);
      this.premium.update(dt, this.player.position);

      const zone = this.world.zoneForPosition(this.player.position);
      if (zone !== this.lastZone) {
        this.lastZone = zone;
        this.progress.zone = zone;
        this.overlay.showZoneBanner(zone);
        if (!this.seenZones.has(zone)) {
          this.seenZones.add(zone);
          void this.playZoneIntro(zone);
        }
      }

      const storyPaused = modalLocked || mapLocked || this.cinematic.isPlaying || this.transitionLock;
      this.timerAccumulator += dt;
      if (this.progress.startedAt !== null && !storyPaused && this.timerAccumulator >= 0.1) {
        this.progress.remainingSeconds = Math.max(0, this.progress.remainingSeconds - this.timerAccumulator);
        this.timerAccumulator = 0;
      }
      if (this.progress.remainingSeconds <= 0) this.fail();

      if (!locked) this.handleInteraction();
      else this.overlay.setPrompt(null);
    }

    if (!this.cinematic.isPlaying) this.positionCamera(false, dt);
    const carried = this.player.getCarriedId();
    const carriedLabel = carried ? this.world.carryables.get(carried)?.label ?? carried : null;
    this.overlay.update(this.progress, carriedLabel);
    this.postFx.render();
    this.controls.endFrame();
  };

  private handleGlobalControls(): void {
    if (!this.cinematic.isPlaying && !this.transitionLock && !this.ui.isModalOpen()) {
      if (this.controls.consumePress('KeyQ', 'Tab')) this.overlay.toggleMap();
      if (this.controls.consumePress('KeyI') && !this.overlay.isMapOpen()) this.ui.toggleInventory(this.legacyProgress());
      if (this.controls.consumePress('KeyF') && !this.overlay.isMapOpen()) this.premium.pulseScan(this.player.position);
      if (this.controls.consumePress('KeyM')) {
        const enabled = this.audio.toggle();
        this.ui.showToast('AUDIO', enabled ? 'Sonido activado.' : 'Sonido silenciado.');
      }
    }
    if (this.controls.consumePress('Escape')) {
      this.overlay.hideMap();
      this.ui.closePanels();
    }
  }

  private handleInteraction(): void {
    const carriedId = this.player.getCarriedId();
    if (carriedId) {
      const socket = this.world.nearestSocket(this.player.position, carriedId);
      if (socket) {
        this.overlay.setPrompt(`Colocar en ${socket.label}`);
        if (this.controls.consumePress('KeyE')) {
          const item = this.world.carryables.get(carriedId);
          if (!item) return;
          const scale = item.carriedScale ?? 0.72;
          const released = this.player.releaseObject(this.world.group, this.world.getSocketPosition(socket.id), 1 / scale);
          if (released) void this.world.onPlaced(released.id, socket.id);
        }
        return;
      }
      this.overlay.setPrompt('Busca una estación compatible para colocar el objeto');
      return;
    }

    const carryable = this.world.nearestCarryable(this.player.position);
    const interactable = this.world.nearestInteractable(this.player.position);
    const premiumInteractable = this.premium.nearestInteractable(this.player.position);

    if (carryable) {
      const denied = this.pickupRequirement(carryable);
      this.overlay.setPrompt(denied ?? `Tomar · ${carryable.label}`);
      if (this.controls.consumePress('KeyE')) {
        if (denied) {
          this.ui.showToast('ACCIÓN NO DISPONIBLE', denied, 'danger');
        } else if (this.player.pickupObject(carryable.object, carryable.id, carryable.carriedScale ?? 0.72)) {
          this.player.playInteract();
          this.world.onPickup(carryable);
        }
      }
    } else if (premiumInteractable) {
      this.overlay.setPrompt(premiumInteractable.label);
      if (this.controls.consumePress('KeyE')) {
        this.player.playInteract();
        this.audio.interact();
        void this.premium.interact(premiumInteractable);
      }
    } else if (interactable) {
      this.overlay.setPrompt(interactable.label);
      if (this.controls.consumePress('KeyE')) {
        this.player.playInteract();
        this.audio.interact();
        void Promise.resolve(interactable.onInteract());
      }
    } else {
      this.overlay.setPrompt(null);
    }
  }

  private pickupRequirement(item: CarryableSpec): string | null {
    if (item.kind === 'material' && !this.progress.flags.has('scanner')) return 'Necesitas el Escáner EI del Centro de Control.';
    if (item.kind === 'sample' && !this.progress.flags.has('production-seal')) return 'El laboratorio se audita después de validar los interlocks de Producción.';
    if (item.kind === 'package' && !this.progress.flags.has('maintenance-seal')) return 'Completa la intervención segura de Mantenimiento antes de liberar movimiento de producto terminado.';
    return null;
  }

  private async playZoneIntro(zone: V4Zone): Promise<void> {
    const sequence = this.zoneSequence(zone);
    if (!sequence) return;
    this.transitionLock = true;
    await this.cinematic.play(sequence);
    this.transitionLock = false;
  }

  private zoneSequence(zone: V4Zone): CinematicSequence | null {
    const data: Partial<Record<V4Zone, { pos: [number, number, number]; target: [number, number, number]; title: string; caption: string }>> = {
      warehouse: { pos: [-55, 11, 27], target: [-38, 0, 10], title: 'CAPÍTULO I · TRAZABILIDAD DE ENTRADA', caption: 'Escanea y transporta los tres contenedores. Libera únicamente lo que cumpla revisión y COA; lo demás debe quedar físicamente en cuarentena.' },
      production: { pos: [-25, 13, -52], target: [-8, 0, -36], title: 'CAPÍTULO II · INTERLOCKS', caption: 'Cada pulsador altera dos condiciones. Comprende el patrón, deja las cuatro condiciones en verde y valida la línea antes de continuar.' },
      quality: { pos: [18, 13, -39], target: [32, 0, -22], title: 'CAPÍTULO III · METROLOGÍA', caption: 'Transporta el patrón maestro a cada banco. El dato importante no es sólo la lectura: es el error contra un valor conocido y su criterio de aceptación.' },
      maintenance: { pos: [57, 12, 31], target: [42, 0, 18], title: 'CAPÍTULO IV · ENERGÍA CERO', caption: 'La intervención sólo es segura si la secuencia LOTO conserva su orden. Un paso omitido reinicia el procedimiento.' },
      dispatch: { pos: [-12, 12, 52], target: [4, 0, 38], title: 'CAPÍTULO V · TRAZABILIDAD DE SALIDA', caption: 'Carga cada caja en la posición indicada por serial. El producto correcto en el lugar equivocado sigue siendo una desviación de trazabilidad.' },
      capa: { pos: [58, 14, 57], target: [43, 0, 43], title: 'CAPÍTULO FINAL · CAPA', caption: 'Cinco sellos operativos deben converger. La respuesta final debe transformar el sistema, no limitarse a pedir más atención a las personas.' }
    };
    const entry = data[zone];
    if (!entry) return null;
    return { id: `v6-${zone}`, skippable: true, shots: [{ duration: 4.2, position: entry.pos, target: entry.target, kicker: 'OPERACIÓN AURORA · V6', title: entry.title, caption: entry.caption }] };
  }

  private handleCameraInput(dt: number): void {
    const pointer = this.controls.consumePointerDelta();
    if (!this.ui.isModalOpen() && !this.overlay.isMapOpen()) {
      this.yaw -= pointer.x * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch - pointer.y * 0.0032, 0.44, 1.02);
    }
    const wheel = this.controls.consumeWheel();
    if (wheel) this.distance = THREE.MathUtils.clamp(this.distance + wheel * 0.009, 8.5, 18.5);
    if (this.controls.isDown('KeyR')) {
      this.yaw = THREE.MathUtils.damp(this.yaw, Math.PI * 0.78, 4.2, dt);
      this.pitch = THREE.MathUtils.damp(this.pitch, 0.72, 4.2, dt);
    }
  }

  private positionCamera(immediate: boolean, dt: number): void {
    if (!this.player) return;
    const target = new THREE.Vector3(this.player.position.x, 1.25, this.player.position.z);
    if (immediate) this.cameraTarget.copy(target);
    else this.cameraTarget.lerp(target, 1 - Math.exp(-dt * 8));
    const horizontal = Math.cos(this.pitch) * this.distance;
    const desired = new THREE.Vector3(
      this.cameraTarget.x + Math.sin(this.yaw) * horizontal,
      this.cameraTarget.y + Math.sin(this.pitch) * this.distance,
      this.cameraTarget.z + Math.cos(this.yaw) * horizontal
    );
    if (immediate) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 7));
    this.camera.lookAt(this.cameraTarget);
  }

  private legacyProgress(): GameProgress {
    const zoneMap: Record<V4Zone, ZoneId> = {
      control: 'control', warehouse: 'warehouse', production: 'production', quality: 'quality', maintenance: 'quality', dispatch: 'dispatch', capa: 'capa'
    };
    return {
      zone: zoneMap[this.progress.zone], objective: this.progress.objective, objectiveDetail: this.progress.objectiveDetail,
      score: this.progress.score, errors: this.progress.errors, remainingSeconds: this.progress.remainingSeconds,
      startedAt: this.progress.startedAt, completedAt: this.progress.completedAt,
      scannedLots: new Set(), evidence: this.progress.evidence, inventory: this.progress.inventory,
      productionSequence: [], causesFound: new Set(), ishikawaPlaced: new Map(), fiveWhysStep: 0, flags: this.progress.flags
    };
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.progress.completedAt = performance.now();
    this.overlay.setPrompt(null);
    const exploration = this.progress.flags.has('v6-explorer-bonus') ? ' Además completaste la exploración sistémica del campus.' : '';
    this.overlay.showResult(
      this.progress,
      'MISIÓN CERRADA',
      `${this.profile.name}, cerraste la cadena desde recepción hasta CAPA. La simulación validó decisiones sobre trazabilidad, interlocks, metrología, LOTO y liberación de despacho antes de proponer una acción sistémica.${exploration}`
    );
  }

  private fail(): void {
    if (this.finished) return;
    this.finished = true;
    this.progress.completedAt = performance.now();
    this.overlay.setPrompt(null);
    this.overlay.showResult(this.progress, 'VENTANA OPERATIVA AGOTADA', 'La investigación no alcanzó un cierre defendible. Repite priorizando evidencia, evitando movimientos innecesarios y usando el plano para decidir la ruta.');
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 1.7);
    this.renderer.setPixelRatio(pixelRatio);
    this.postFx.resize(window.innerWidth, window.innerHeight, pixelRatio);
  };
}
