import * as THREE from 'three';
import { AssetLibrary } from './AssetLibrary';
import { AudioManager } from './AudioManager';
import { Input } from './Input';
import { SupabaseBridge } from './Multiplayer';
import { Player } from './Player';
import { UI } from './UI';
import { World } from './World';
import type { GameMasterCommand, GameStats, Interactable, PlayerProfile } from './types';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private clock = new THREE.Clock();
  private input = new Input();
  private assets = new AssetLibrary();
  private audio = new AudioManager();
  private multiplayer = new SupabaseBridge();
  private ui: UI;
  private player = new Player(this.assets);
  private world!: World;
  private profile!: PlayerProfile;
  private running = false;
  private finished = false;
  private hovered: Interactable | null = null;
  private cameraTarget = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(10.5, 14.5, 10.5);
  private cameraForward = new THREE.Vector3(-1, 0, -1).normalize();
  private cameraRight = new THREE.Vector3(1, 0, -1).normalize();
  private timerAccumulator = 0;
  private stepAccumulator = 0;

  private readonly stats: GameStats = {
    remainingSeconds: 45 * 60,
    maxSeconds: 45 * 60,
    errors: 0,
    hints: 0,
    score: 1000,
    health: 100,
    evidence: new Set<string>(),
    keys: new Set<string>(),
    inventory: [],
    defeatedErrors: 0,
    ishikawaTokens: new Set<string>(),
    stage: 'briefing',
    objective: 'Registra tu equipo y entra a la operación.',
    startedAt: null,
    finishedAt: null,
    pausedByGameMaster: false,
    sessionStatus: 'playing'
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
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.domElement.className = 'game-canvas';
    this.root.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-10, 10, 7.5, -7.5, 0.1, 140);
    this.ui = new UI(this.root);
    window.addEventListener('resize', () => this.resize());
  }

  async boot(): Promise<void> {
    this.configureScene();
    this.profile = await this.ui.waitForStart();
    await this.audio.start();

    if (this.profile.characterClass === 'analyst') {
      this.stats.remainingSeconds += 90;
      this.stats.maxSeconds += 90;
    }

    this.stats.objective = 'Cargando la mazmorra operacional...';
    this.ui.setObjective(this.stats.objective);
    this.ui.showToast('AGENTE REGISTRADO', `${this.profile.callsign} · ${this.profile.teamName}`, 'success');

    this.world = new World(
      this.scene,
      this.assets,
      this.ui,
      this.audio,
      this.stats,
      this.profile,
      () => this.finish(),
      (type, payload) => { void this.multiplayer.log(type, payload ?? {}); }
    );

    await Promise.all([this.player.init(this.profile), this.world.init()]);
    this.scene.add(this.player.group);
    this.player.position.set(-11.2, 0, 0);
    this.positionCamera(true);
    this.renderer.render(this.scene, this.camera);

    if (this.multiplayer.enabled) {
      try {
        await this.multiplayer.registerTeam(this.profile, this.stats);
        this.multiplayer.subscribeCommands((command) => this.handleGameMasterCommand(command));
        await this.multiplayer.log('team_connected', { team: this.profile.teamName, callsign: this.profile.callsign });
        this.ui.showToast('EQUIPO EN LÍNEA', 'Conectado al centro Game Master mediante Supabase.', 'success');
      } catch (error) {
        console.warn('Supabase no disponible:', error);
        this.ui.showToast('MODO LOCAL ACTIVO', 'La misión continúa sin sincronización Game Master.', 'normal');
      }
    }

    this.stats.objective = 'Abre el cofre del expediente NC-26-0914 para recibir el briefing.';
    this.ui.setObjective(this.stats.objective);
    this.ui.update(this.stats);
    this.stats.startedAt = performance.now();
    this.running = true;
    this.clock.start();
    this.loop();
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(0x06101a);
    this.scene.fog = new THREE.FogExp2(0x06101a, 0.0125);

    const hemi = new THREE.HemisphereLight(0x9dbdff, 0x17110d, 1.25);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d2, 2.45);
    sun.position.set(-10, 22, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.00035;
    this.scene.add(sun);
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.finished) {
      if (this.input.consumePress('KeyI')) this.ui.toggleInventory();
      if (this.input.consumePress('KeyM')) {
        const muted = this.audio.toggleMute();
        this.ui.showToast(muted ? 'AUDIO SILENCIADO' : 'AUDIO ACTIVADO');
      }

      const locked = this.ui.isModalOpen() || this.stats.pausedByGameMaster;
      const moving = this.player.update(dt, this.input, this.world.colliders, locked, this.cameraForward, this.cameraRight);
      this.world.update(dt, this.player.position);

      if (moving && !locked) {
        this.stepAccumulator += dt;
        const cadence = this.input.isDown('ShiftLeft', 'ShiftRight') ? 0.27 : 0.39;
        if (this.stepAccumulator >= cadence) {
          this.audio.step(this.input.isDown('ShiftLeft', 'ShiftRight') ? 1.25 : 0.8);
          this.stepAccumulator = 0;
        }
      } else {
        this.stepAccumulator = 0;
      }

      if (!locked && this.input.consumePress('Space')) {
        this.player.attack();
        this.audio.attack();
        this.world.attackErrors(this.player.position, this.player.getFacing());
      }

      if (!this.stats.pausedByGameMaster) {
        this.timerAccumulator += dt;
        if (this.timerAccumulator >= 0.1) {
          this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - this.timerAccumulator);
          this.timerAccumulator = 0;
        }
      }

      if (this.stats.remainingSeconds <= 0 || this.stats.health <= 0) this.fail();

      this.hovered = locked ? null : this.world.nearestInteractable(this.player.position);
      this.ui.setInteraction(this.hovered ? this.hovered.label : null);
      if (this.hovered && this.input.consumePress('KeyE')) {
        this.player.playInteract();
        const item = this.hovered;
        void Promise.resolve(item.onInteract()).then(() => {
          if (item.once) item.consumed = true;
        });
      }

      void this.multiplayer.sync(this.stats);
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

    // Movimiento relativo a pantalla: W/↑ siempre avanza visualmente hacia arriba,
    // S/↓ hacia abajo, independientemente de la rotación isométrica.
    this.cameraForward.copy(this.cameraTarget).sub(this.camera.position).setY(0).normalize();
    this.cameraRight.copy(this.cameraForward).cross(new THREE.Vector3(0, 1, 0)).normalize();
  }

  private resize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const viewHeight = 16.5;
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  }

  private async handleGameMasterCommand(command: GameMasterCommand): Promise<void> {
    switch (command.command) {
      case 'pause':
        this.stats.pausedByGameMaster = true;
        this.stats.sessionStatus = 'paused';
        this.ui.showToast('PAUSA GAME MASTER', 'La operación ha sido pausada desde el centro de control.', 'normal');
        break;
      case 'resume':
        this.stats.pausedByGameMaster = false;
        this.stats.sessionStatus = 'playing';
        this.ui.showToast('OPERACIÓN REANUDADA', 'El Game Master liberó nuevamente la misión.', 'success');
        break;
      case 'add_time': {
        const seconds = Number(command.payload.seconds ?? 60);
        this.stats.remainingSeconds += Number.isFinite(seconds) ? seconds : 60;
        this.ui.showToast('BONIFICACIÓN GAME MASTER', `+${Math.round(seconds)} segundos.`, 'success');
        break;
      }
      case 'remove_time': {
        const seconds = Number(command.payload.seconds ?? 60);
        this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - (Number.isFinite(seconds) ? seconds : 60));
        this.ui.showToast('PENALIZACIÓN GAME MASTER', `-${Math.round(seconds)} segundos.`, 'danger');
        break;
      }
      case 'message':
        await this.ui.showGameMasterMessage(String(command.payload.text ?? 'Mensaje de operación.'));
        break;
      case 'finish':
        this.finish();
        break;
    }
    await this.multiplayer.log('gm_command_received', { command: command.command, commandId: command.id });
    await this.multiplayer.sync(this.stats, true);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.stats.finishedAt = performance.now();
    this.stats.stage = 'complete';
    this.stats.sessionStatus = 'completed';
    const elapsed = this.stats.startedAt ? (this.stats.finishedAt - this.stats.startedAt) / 1000 : 0;
    this.ui.setInteraction(null);
    this.ui.showVictory(elapsed, this.stats, this.profile);
    void this.multiplayer.sync(this.stats, true);
  }

  private fail(): void {
    if (this.finished) return;
    this.finished = true;
    this.stats.finishedAt = performance.now();
    this.stats.sessionStatus = 'failed';
    this.stats.score = Math.max(0, this.stats.score - 250);
    this.ui.setInteraction(null);
    this.audio.error();
    this.ui.showFailure();
    void this.multiplayer.log('mission_failed', { score: this.stats.score, health: this.stats.health });
    void this.multiplayer.sync(this.stats, true);
  }
}
