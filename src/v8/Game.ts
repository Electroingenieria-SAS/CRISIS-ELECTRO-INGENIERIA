import * as THREE from 'three';
import { CAPA_OPTIONS, GAUGE_READINGS, LOTO_ORDER, WAREHOUSE_SCANS } from './content';
import { Input } from './Input';
import { Player } from './Player';
import type { GameState, PlayerProfile, ZoneId } from './types';
import { UI } from './UI';
import { World } from './World';

export class CrisisGameV8 {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 220);
  private clock = new THREE.Clock();
  private input: Input;
  private ui: UI;
  private world!: World;
  private player!: Player;
  private profile!: PlayerProfile;
  private running = false;
  private started = false;
  private mapOpen = false;
  private yaw = Math.PI * 0.78;
  private pitch = 0.68;
  private distance = 12.4;
  private cameraTarget = new THREE.Vector3();
  private timerAcc = 0;

  private state: GameState = {
    chapter: 0,
    zone: 'control',
    objective: 'Recibe el briefing de Calidad',
    detail: 'Habla con Laura para conocer el incidente y obtener autorización de investigación.',
    score: 1000,
    errors: 0,
    remainingSeconds: 35 * 60,
    flags: new Set(),
    scans: new Set(),
    measured: new Set(),
    dispatchPlaced: new Set(),
    production: [false, false, false, false],
    lotoStep: 0,
    finished: false
  };

  constructor(private root: HTMLElement) {
    this.root.classList.add('v8-root');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'v8-canvas';
    this.root.appendChild(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement);
    this.ui = new UI(root);
    window.addEventListener('resize', this.onResize);
  }

  async boot(): Promise<void> {
    this.configureScene();
    this.profile = await this.ui.createProfile();
    this.world = new World(this.scene);
    this.world.init();
    this.player = new Player(this.profile);
    this.scene.add(this.player.group);
    this.player.position.set(0, 0, 6);
    this.positionCamera(true, 0);

    this.running = true;
    this.clock.start();
    this.loop();
    await this.ui.storyBriefing();
    this.started = true;
    this.ui.toastMessage('MISIÓN INICIADA', 'Habla con Laura. No avances por velocidad: avanza por evidencia.', 'success');
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color(0x91b7c9);
    this.scene.fog = new THREE.Fog(0x91b7c9, 78, 150);
    const hemi = new THREE.HemisphereLight(0xe9f5ff, 0x385344, 1.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d1, 2.6);
    sun.position.set(-34, 48, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -62;
    sun.shadow.camera.right = 62;
    sun.shadow.camera.top = 62;
    sun.shadow.camera.bottom = -62;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.00035;
    this.scene.add(sun);
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.04);

    this.handleGlobalInput();
    const locked = !this.started || this.ui.isModalOpen() || this.state.finished;
    const screenUp = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const screenRight = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    this.player.update(dt, this.input, this.world.colliders, screenUp, screenRight, locked);
    this.world.update(dt);

    if (this.started && !this.state.finished) {
      this.state.zone = this.world.zoneFor(this.player.position);
      if (!locked) this.handleInteraction();
      this.timerAcc += dt;
      if (!this.ui.isModalOpen() && this.timerAcc >= 0.1) {
        this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - this.timerAcc);
        this.timerAcc = 0;
      }
      if (this.state.remainingSeconds <= 0) this.failMission();
    }

    this.handleCamera(dt);
    this.ui.update(this.state);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  private handleGlobalInput(): void {
    if (this.input.consume('Escape')) {
      this.mapOpen = false;
      this.ui.closeModal();
    }
    if (this.started && !this.state.finished && this.input.consume('KeyQ')) {
      if (this.mapOpen) {
        this.mapOpen = false;
        this.ui.closeModal();
      } else if (!this.ui.isModalOpen()) {
        this.mapOpen = true;
        this.ui.showMap(this.state.zone);
      }
    }
    if (this.started && !this.state.finished && !this.ui.isModalOpen() && this.input.consume('KeyF')) this.scan();
  }

  private handleInteraction(): void {
    const carried = this.player.getCarriedId();
    if (carried) {
      const socket = this.world.nearestSocket(this.player.position);
      if (socket && this.socketRelevant(carried, socket.id)) {
        this.ui.setPrompt(`Colocar en ${socket.label}`);
        if (this.input.consume('KeyE')) {
          const dropped = this.player.drop(this.world.group, this.world.socketPosition(socket.id));
          if (dropped) this.resolvePlacement(dropped.id, socket.id);
        }
      } else {
        this.ui.setPrompt('Transporta el elemento hasta una estación válida');
      }
      return;
    }

    const carryable = this.world.nearestCarryable(this.player.position, (id) => this.carryableEnabled(id));
    if (carryable) {
      this.ui.setPrompt(`Tomar · ${carryable.label}`);
      if (this.input.consume('KeyE')) {
        this.player.pickup(carryable.object, carryable.id);
        this.ui.toastMessage('OBJETO EN MANOS', carryable.label);
      }
      return;
    }

    const action = this.world.nearestAction(this.player.position);
    if (action) {
      this.ui.setPrompt(action.prompt);
      if (this.input.consume('KeyE')) void this.resolveAction(action.id);
    } else {
      this.ui.setPrompt(null);
    }
  }

  private scan(): void {
    if (!this.state.flags.has('scanner')) {
      this.ui.toastMessage('SIN HERRAMIENTA', 'Necesitas retirar el Escáner EI en el Centro de Control.', 'danger');
      return;
    }
    const target = this.world.nearestScan(this.player.position);
    if (!target) {
      this.ui.toastMessage('ESCÁNER EI', 'No hay etiquetas auditables dentro del alcance.');
      return;
    }
    const data = WAREHOUSE_SCANS[target.id];
    if (!data) return;
    this.state.scans.add(target.id);
    this.state.score += this.state.scans.size <= 3 ? 45 : 0;
    this.ui.toastMessage(data.title, `${data.detail} · ${data.result}`, target.id === 'pallet-b' ? 'danger' : 'success');
    if (this.state.scans.size === 3 && !this.state.flags.has('warehouse-scanned')) {
      this.state.flags.add('warehouse-scanned');
      this.setObjective('Aísla la revisión incorrecta', 'El Pallet B contiene CT-48 Rev. A. Cárgalo y llévalo físicamente a CUARENTENA.');
    }
  }

  private async resolveAction(id: string): Promise<void> {
    if (id === 'npc-laura') {
      await this.ui.dialogue('Laura', 'Líder de Calidad', 'El cliente solicitó CT-48 revisión B. El producto que recibió está marcado como revisión A. Necesitamos reconstruir el flujo sin asumir dónde nació el error.');
      this.state.flags.add('briefed');
      this.setObjective('Obtén la herramienta de trazabilidad', 'Retira el Escáner EI del terminal azul del Centro de Control.');
      return;
    }
    if (id === 'scanner-terminal') {
      if (!this.state.flags.has('briefed')) return this.locked('Primero recibe el briefing de Laura.');
      if (this.state.flags.has('scanner')) return;
      this.state.flags.add('scanner');
      this.state.chapter = 1;
      this.state.score += 75;
      this.ui.toastMessage('HERRAMIENTA OBTENIDA', 'Escáner EI habilitado con F. Busca etiquetas en Recepción.', 'success');
      this.setObjective('Reconstruye la entrada del material', 'Ve a Recepción/Almacén y usa F cerca de los tres pallets. Compara revisión, lote y evidencia de proveedor.');
      return;
    }
    if (id === 'npc-mateo') {
      await this.ui.dialogue('Mateo', 'Responsable de Almacén', 'Los tres pallets llegaron en fechas cercanas. El color de la caja no es evidencia: usa la etiqueta y el COA para decidir qué material pertenece al pedido.');
      return;
    }
    if (id.startsWith('prod-sw-')) {
      if (this.state.chapter !== 2) return this.locked('Primero resuelve la trazabilidad de entrada.');
      const index = Number(id.split('-').pop());
      const pairs = [[0, 1], [1, 2], [2, 3], [0, 3]];
      const pair = pairs[index];
      if (!pair) return;
      for (const bit of pair) this.state.production[bit] = !this.state.production[bit];
      this.ui.toastMessage('INTERLOCKS', this.productionStatus());
      if (this.state.production.every(Boolean)) {
        this.state.score += 220;
        this.state.chapter = 3;
        this.state.flags.add('production-seal');
        this.ui.toastMessage('LÍNEA VALIDADA', 'Los cuatro interlocks están en condición segura.', 'success');
        this.setObjective('Comprueba el sistema de medición', 'Ve a Calidad. Toma el patrón maestro 50,00 mm y llévalo a los tres bancos metrológicos.');
      }
      return;
    }
    if (id.startsWith('tag-gauge-')) {
      if (this.state.chapter !== 3 || this.state.measured.size < 3) return this.locked('Primero mide el patrón en los tres bancos.');
      const gaugeId = `gauge-${id.split('-').pop()}`;
      if (gaugeId === 'gauge-2') {
        this.state.score += 240;
        this.state.chapter = 4;
        this.state.flags.add('quality-seal');
        this.ui.toastMessage('EQUIPO RETIRADO', 'M-02 excede ±0,05 mm y queda bloqueado.', 'success');
        this.setObjective('Asegura la intervención de mantenimiento', 'En Mantenimiento ejecuta LOTO: detener → aislar → bloquear/etiquetar → verificar energía cero.');
      } else this.penalty('Decisión metrológica incorrecta', 'Ese banco cumple el criterio ±0,05 mm.');
      return;
    }
    if (id.startsWith('loto-')) {
      if (this.state.chapter !== 4) return this.locked('La intervención LOTO se habilita después de cerrar Metrología.');
      const expected = LOTO_ORDER[this.state.lotoStep];
      if (id !== expected) {
        this.state.lotoStep = 0;
        this.penalty('SECUENCIA LOTO REINICIADA', 'El orden es parte del control. Revisa el procedimiento antes de continuar.');
        return;
      }
      this.state.lotoStep += 1;
      this.state.score += 35;
      if (this.state.lotoStep === LOTO_ORDER.length) {
        this.state.chapter = 5;
        this.state.flags.add('maintenance-seal');
        this.state.score += 170;
        this.ui.toastMessage('ENERGÍA CERO VERIFICADA', 'Intervención asegurada.', 'success');
        this.setObjective('Reconstruye la liberación de salida', 'En Despacho carga AUR-2401, AUR-2402 y AUR-2403 en las posiciones 1, 2 y 3 respectivamente.');
      } else this.ui.toastMessage('LOTO', `Paso ${this.state.lotoStep}/${LOTO_ORDER.length} validado.`, 'success');
      return;
    }
    if (id.startsWith('capa-')) {
      if (this.state.chapter !== 6) return this.locked('El Centro CAPA se resuelve después de cerrar Despacho.');
      const option = CAPA_OPTIONS[id];
      if (!option) return;
      if (!option.correct) {
        this.penalty('ACCIÓN INSUFICIENTE', `${option.detail} No controla el mecanismo que permitió liberar una revisión incorrecta.`);
        return;
      }
      this.state.score += 420;
      this.state.finished = true;
      this.ui.showResult(this.state, 'CAUSA CONTROLADA', `${this.profile.name}, cerraste Operación Aurora con una acción sistémica: ${option.detail}`);
    }
  }

  private resolvePlacement(itemId: string, socketId: string): void {
    if (itemId === 'pallet-b' && socketId === 'quarantine' && this.state.chapter === 1 && this.state.scans.size === 3) {
      this.state.flags.add('warehouse-seal');
      this.state.chapter = 2;
      this.state.score += 220;
      this.ui.toastMessage('CUARENTENA CONFIRMADA', 'La Rev. A queda segregada sin afectar material conforme.', 'success');
      this.setObjective('Restablece la condición de proceso', 'Ve a Producción. Los cuatro interlocks deben quedar verdes; cada pulsador modifica dos condiciones.');
      return;
    }
    if (itemId === 'master-block' && socketId.startsWith('gauge-') && this.state.chapter === 3) {
      const data = GAUGE_READINGS[socketId];
      if (!data) return;
      this.state.measured.add(socketId);
      this.state.score += 60;
      this.ui.toastMessage(data.name, `Patrón 50,00 mm → ${data.reading} · error ${data.error}`, data.conforming ? 'success' : 'danger');
      if (this.state.measured.size === 3) this.setObjective('Retira el instrumento no conforme', 'Compara los errores con ±0,05 mm y usa el terminal correspondiente para retirar un banco de servicio.');
      return;
    }
    if (itemId.startsWith('pkg-') && socketId.startsWith('dispatch-') && this.state.chapter === 5) {
      const expected: Record<string, string> = { 'pkg-2401': 'dispatch-1', 'pkg-2402': 'dispatch-2', 'pkg-2403': 'dispatch-3' };
      if (expected[itemId] !== socketId) {
        this.penalty('POSICIÓN INCORRECTA', 'El serial es correcto, pero la posición no coincide con el manifiesto de despacho.');
        return;
      }
      this.state.dispatchPlaced.add(itemId);
      this.state.score += 85;
      this.ui.toastMessage('POSICIÓN VALIDADA', `${itemId.toUpperCase()} trazado correctamente.`, 'success');
      if (this.state.dispatchPlaced.size === 3) {
        this.state.chapter = 6;
        this.state.flags.add('dispatch-seal');
        this.state.score += 180;
        this.setObjective('Formula la CAPA definitiva', 'En el Centro CAPA evalúa las tres estrategias. Escoge la que controle el origen documental y bloquee la recurrencia.');
      }
      return;
    }
    this.penalty('UBICACIÓN NO VÁLIDA', 'Ese elemento no corresponde a esta estación.');
  }

  private carryableEnabled(id: string): boolean {
    if (id === 'pallet-b') return this.state.chapter === 1 && this.state.scans.size === 3 && !this.state.flags.has('warehouse-seal');
    if (id === 'master-block') return this.state.chapter === 3;
    if (id.startsWith('pkg-')) return this.state.chapter === 5 && !this.state.dispatchPlaced.has(id);
    return false;
  }

  private socketRelevant(itemId: string, socketId: string): boolean {
    if (itemId === 'pallet-b') return socketId === 'quarantine';
    if (itemId === 'master-block') return socketId.startsWith('gauge-');
    if (itemId.startsWith('pkg-')) return socketId.startsWith('dispatch-');
    return false;
  }

  private productionStatus(): string {
    const labels = ['Energía', 'Guarda', 'Fijación', 'Programa'];
    return labels.map((label, index) => `${label}:${this.state.production[index] ? 'OK' : 'NO'}`).join(' · ');
  }

  private locked(message: string): void { this.ui.toastMessage('AÚN NO', message, 'danger'); }

  private penalty(title: string, body: string): void {
    this.state.errors += 1;
    this.state.score = Math.max(0, this.state.score - 80);
    this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - 25);
    this.ui.toastMessage(title, body, 'danger');
  }

  private setObjective(title: string, detail: string): void { this.state.objective = title; this.state.detail = detail; }

  private failMission(): void {
    if (this.state.finished) return;
    this.state.finished = true;
    this.ui.showResult(this.state, 'VENTANA OPERATIVA AGOTADA', 'La investigación no alcanzó un cierre defendible. Repite siguiendo evidencia y evitando decisiones por intuición.');
  }

  private handleCamera(dt: number): void {
    if (!this.ui.isModalOpen()) {
      const pointer = this.input.consumePointer();
      this.yaw -= pointer.x * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch - pointer.y * 0.003, 0.46, 0.94);
      const wheel = this.input.consumeWheel();
      if (wheel) this.distance = THREE.MathUtils.clamp(this.distance + wheel * 0.009, 9.0, 17.0);
    }
    const target = new THREE.Vector3(this.player.position.x, 1.25, this.player.position.z);
    this.cameraTarget.lerp(target, 1 - Math.exp(-dt * 8));
    const horizontal = Math.cos(this.pitch) * this.distance;
    const desired = new THREE.Vector3(this.cameraTarget.x + Math.sin(this.yaw) * horizontal, this.cameraTarget.y + Math.sin(this.pitch) * this.distance, this.cameraTarget.z + Math.cos(this.yaw) * horizontal);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 7));
    this.camera.lookAt(this.cameraTarget);
  }

  private positionCamera(immediate: boolean, dt: number): void {
    const target = new THREE.Vector3(this.player.position.x, 1.25, this.player.position.z);
    this.cameraTarget.copy(target);
    const horizontal = Math.cos(this.pitch) * this.distance;
    const desired = new THREE.Vector3(target.x + Math.sin(this.yaw) * horizontal, target.y + Math.sin(this.pitch) * this.distance, target.z + Math.cos(this.yaw) * horizontal);
    if (immediate) this.camera.position.copy(desired); else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 7));
    this.camera.lookAt(target);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
  };
}
