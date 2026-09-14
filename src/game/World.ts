import * as THREE from 'three';
import type { AssetLibrary } from './AssetLibrary';
import type { AudioManager } from './AudioManager';
import type { Collider, EnemyState, GameStats, Interactable, InventoryItem, PlayerProfile } from './types';
import type { UI } from './UI';

const DUNGEON = '/assets/kaykit/dungeon';

type Gate = {
  id: string;
  object: THREE.Object3D;
  open: boolean;
  opening: boolean;
  collider: Collider;
  targetY: number;
  requirement: () => boolean;
};

type ChestAnimation = {
  lid: THREE.Object3D;
  progress: number;
  opening: boolean;
  opened: boolean;
};

export class World {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly interactables: Interactable[] = [];
  readonly enemies: EnemyState[] = [];

  private gates = new Map<string, Gate>();
  private chestAnimations: ChestAnimation[] = [];
  private skeletonMixer: THREE.AnimationMixer | null = null;
  private skeleton: THREE.Object3D | null = null;
  private finalSolved = false;
  private traceabilitySolved = false;
  private ishikawaSolved = false;
  private fiveWhysSolved = false;
  private hitCooldown = 0;
  private labelTextures: THREE.Texture[] = [];

  constructor(
    private scene: THREE.Scene,
    private assets: AssetLibrary,
    private ui: UI,
    private audio: AudioManager,
    private stats: GameStats,
    private profile: PlayerProfile,
    private onFinish: () => void,
    private onEvent: (type: string, payload?: Record<string, unknown>) => void
  ) {
    this.scene.add(this.group);
  }

  async init(): Promise<void> {
    await this.buildDungeonShell();
    await Promise.all([
      this.buildDecor(),
      this.buildEvidenceRoom(),
      this.buildTraceabilityRoom(),
      this.buildRiskRoom(),
      this.buildIshikawaRoom(),
      this.buildFiveWhysRoom()
    ]);
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.skeletonMixer?.update(dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    for (const gate of this.gates.values()) {
      if (gate.opening && !gate.open) {
        gate.object.position.y += dt * 3.25;
        if (gate.object.position.y >= gate.targetY) {
          gate.object.position.y = gate.targetY;
          gate.open = true;
          gate.opening = false;
        }
      }
    }

    for (const chest of this.chestAnimations) {
      if (!chest.opening || chest.opened) continue;
      chest.progress = Math.min(1, chest.progress + dt * 1.85);
      chest.lid.rotation.x = -chest.progress * Math.PI * 0.62;
      if (chest.progress >= 1) {
        chest.opening = false;
        chest.opened = true;
      }
    }

    this.updateEnemies(dt, playerPosition);

    if (this.skeleton) {
      const dx = playerPosition.x - this.skeleton.position.x;
      const dz = playerPosition.z - this.skeleton.position.z;
      if (Math.hypot(dx, dz) < 8) {
        const target = Math.atan2(dx, dz);
        this.skeleton.rotation.y += this.shortestAngle(this.skeleton.rotation.y, target) * (1 - Math.exp(-dt * 5));
      }
    }
  }

  nearestInteractable(position: THREE.Vector3): Interactable | null {
    let best: Interactable | null = null;
    let bestDistance = Infinity;
    for (const item of this.interactables) {
      if (item.once && item.consumed) continue;
      if (item.enabled && !item.enabled()) continue;
      const distance = position.distanceTo(item.object.position);
      if (distance <= item.radius && distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  attackErrors(position: THREE.Vector3, facing: THREE.Vector3): number {
    let defeated = 0;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const toEnemy = enemy.object.position.clone().sub(position);
      const distance = toEnemy.length();
      if (distance > 2.65) continue;
      toEnemy.y = 0;
      if (toEnemy.lengthSq() > 0.01) toEnemy.normalize();
      if (facing.dot(toEnemy) < -0.2) continue;
      enemy.hp -= 1;
      enemy.hitCooldown = 0.18;
      (enemy.object as THREE.Group).scale.setScalar(1.35);
      if (enemy.hp <= 0) {
        enemy.active = false;
        enemy.object.visible = false;
        defeated += 1;
        this.stats.defeatedErrors += 1;
        this.stats.score += 85;
        this.audio.success();
        this.onEvent('error_defeated', { enemy: enemy.id, total: this.stats.defeatedErrors });
      }
    }
    if (defeated > 0) {
      this.ui.showToast('ERROR NEUTRALIZADO', `${this.stats.defeatedErrors}/4 errores críticos neutralizados.`, 'success');
      if (this.stats.defeatedErrors >= 4 && !this.stats.keys.has('quality-key')) {
        this.setStage('risk', 'Los errores están contenidos. Habla con el Guardián de Calidad para obtener el Sello de Liberación.');
      }
    }
    return defeated;
  }

  private async buildDungeonShell(): Promise<void> {
    const floorPath = `${DUNGEON}/floor_tile_large.gltf`;
    const rockPath = `${DUNGEON}/floor_tile_large_rocks.gltf`;
    for (let x = -12; x <= 56; x += 4) {
      for (let z = -12; z <= 12; z += 4) {
        const path = ((x + z) / 4) % 7 === 0 ? rockPath : floorPath;
        const floor = await this.assets.cloneStatic(path);
        floor.position.set(x, 0, z);
        this.group.add(floor);
      }
    }

    const wall = `${DUNGEON}/wall.gltf`;
    for (let x = -12; x <= 56; x += 4) {
      await this.placeStatic(wall, x, 0, -14, 0);
      await this.placeStatic(wall, x, 0, 14, 0);
    }
    for (let z = -12; z <= 12; z += 4) {
      await this.placeStatic(wall, -14, 0, z, Math.PI / 2);
      await this.placeStatic(wall, 58, 0, z, Math.PI / 2);
    }

    this.colliders.push(
      { minX: -14.6, maxX: -13.35, minZ: -14, maxZ: 14 },
      { minX: 57.35, maxX: 58.6, minZ: -14, maxZ: 14 },
      { minX: -14, maxX: 58, minZ: -14.6, maxZ: -13.35 },
      { minX: -14, maxX: 58, minZ: 13.35, maxZ: 14.6 }
    );

    for (const x of [2, 16, 30, 44]) {
      for (const z of [-12, -8, -4, 4, 8, 12]) await this.placeStatic(wall, x, 0, z, Math.PI / 2);
      await this.placeStatic(`${DUNGEON}/wall_doorway.gltf`, x, 0, 0, Math.PI / 2);
      this.colliders.push(
        { minX: x - 0.58, maxX: x + 0.58, minZ: -14, maxZ: -1.55 },
        { minX: x - 0.58, maxX: x + 0.58, minZ: 1.55, maxZ: 14 }
      );
    }

    await this.createGate('evidence-gate', 2, () => this.stats.evidence.size >= 3, 'Se requieren 3 evidencias trazadas.');
    await this.createGate('traceability-gate', 16, () => this.traceabilitySolved, 'El flujo de trazabilidad todavía no está reconstruido.');
    await this.createGate('risk-gate', 30, () => this.stats.defeatedErrors >= 4 && this.stats.keys.has('quality-key'), 'Neutraliza 4 errores y consigue el Sello de Calidad.');
    await this.createGate('ishikawa-gate', 44, () => this.ishikawaSolved, 'El diagrama Ishikawa aún no ha sido validado.');
  }

  private async createGate(id: string, x: number, requirement: () => boolean, deniedText: string): Promise<void> {
    const object = await this.assets.cloneStatic(`${DUNGEON}/wall_gated.gltf`);
    object.rotation.y = Math.PI / 2;
    object.position.set(x, 0, 0);
    this.group.add(object);

    const gate: Gate = {
      id,
      object,
      open: false,
      opening: false,
      targetY: 4.4,
      requirement,
      collider: { minX: x - 0.64, maxX: x + 0.64, minZ: -1.55, maxZ: 1.55, enabled: () => !gate.open }
    };
    this.gates.set(id, gate);
    this.colliders.push(gate.collider);
    this.interactables.push({
      id,
      label: 'Activar mecanismo de compuerta',
      object,
      radius: 2.8,
      onInteract: async () => {
        if (gate.open || gate.opening) return;
        if (!gate.requirement()) {
          this.audio.error();
          await this.ui.dialogue('MECANISMO BLOQUEADO', deniedText);
          return;
        }
        gate.opening = true;
        this.audio.gate();
        this.stats.score += 100;
        this.ui.showToast('COMPUERTA DESBLOQUEADA', 'El siguiente sector de la mazmorra está disponible.', 'success');
        this.onEvent('gate_opened', { gate: id });
        if (id === 'evidence-gate') this.setStage('traceability', 'Reconstruye el flujo Pedido → OT → Producción → Inspección → Despacho en el pedestal central.');
        if (id === 'traceability-gate') this.setStage('risk', 'Cruza la Cámara de Riesgo. Usa ESPACIO para neutralizar al menos 4 errores activos.');
        if (id === 'risk-gate') this.setStage('ishikawa', 'Recoge las 6 fichas de causa y completa el Ishikawa físico de la Sala de Análisis.');
        if (id === 'ishikawa-gate') this.setStage('five-whys', 'Completa la cadena íntegra de 5 Porqués en el altar causal.');
      }
    });
  }

  private async buildDecor(): Promise<void> {
    const decor: Array<[string, number, number, number]> = [
      ['crates_stacked.gltf', -11, 0, 10], ['barrel_large_decorated.gltf', -7.5, 0, 10.2],
      ['shelf_large.gltf', -1, 0, -11.6], ['table_medium_decorated_A.gltf', 8, 0, 8.5],
      ['pillar_decorated.gltf', 20, 0, -10], ['pillar_decorated.gltf', 26, 0, 10],
      ['shelf_small_candles.gltf', 34, 0, -11.2], ['crates_stacked.gltf', 41, 0, 10.2],
      ['banner_patternA_blue.gltf', 49, 0, -12.8], ['banner_patternA_yellow.gltf', 53, 0, -12.8]
    ];
    for (const [name, x, y, z] of decor) await this.placeStatic(`${DUNGEON}/${name}`, x, y, z, 0);

    for (let x = -10; x <= 54; x += 8) {
      for (const z of [-12.8, 12.8]) {
        await this.placeStatic(`${DUNGEON}/torch_mounted.gltf`, x, 2.15, z, z < 0 ? 0 : Math.PI);
        const light = new THREE.PointLight(0xff9a3c, 2.4, 8, 2);
        light.position.set(x, 2.8, z * 0.93);
        this.group.add(light);
      }
    }

    const roomNames: Array<[number, string, string]> = [
      [-6, '01', 'ARCHIVO DE EVIDENCIAS'],
      [9, '02', 'TRAZABILIDAD'],
      [23, '03', 'CÁMARA DE RIESGO'],
      [37, '04', 'ISHIKAWA'],
      [51, '05', '5 PORQUÉS']
    ];
    for (const [x, number, name] of roomNames) {
      const marker = this.createLabelSprite(`${number} · ${name}`, '#ffd43b');
      marker.position.set(x, 3.5, -12.2);
      marker.scale.set(7.6, 1.15, 1);
      this.group.add(marker);
    }
  }

  private async buildEvidenceRoom(): Promise<void> {
    const briefingChest = this.createPhysicalChest(-10, -5.2, 0xd99a2b);
    this.interactables.push({
      id: 'briefing-chest', label: 'Abrir cofre de incidente', object: briefingChest.group, radius: 2.5, once: true,
      onInteract: async () => {
        this.openChest(briefingChest.animation);
        await this.ui.dialogue('EXPEDIENTE NC-26-0914', 'Cliente crítico: 24 conjuntos CT-48 debían salir en versión B, pero fueron liberados como versión A. No busques culpables: reconstruye el sistema que permitió la falla.');
        this.addInventory({ id: 'incident-file', name: 'Expediente NC-26-0914', description: 'Orden de investigación de la no conformidad.', icon: 'NC', kind: 'mission' });
        this.setStage('evidence', 'Recoge y analiza las 3 evidencias documentales de la primera sala.');
        this.onEvent('mission_briefing_opened');
      }
    });

    const orderChest = this.createPhysicalChest(-9, 5.4, 0x3b82f6);
    this.interactables.push({
      id: 'ev-order', label: 'Abrir cofre OT', object: orderChest.group, radius: 2.4, once: true,
      onInteract: async () => {
        this.openChest(orderChest.animation);
        await this.ui.document('Orden de Producción', 'OT-260914-017', [
          ['Pedido cliente', 'CT-48 / versión B'], ['Orden emitida', 'CT-48 / versión A'], ['Plantilla', 'OT_BASE_2025_v3'], ['Liberación', 'Sin contraste contra pedido']
        ], 'La inconsistencia aparece al crear la OT: el pedido original sí especificaba versión B.');
        this.collectEvidence('order', 'OT-260914-017', 'La OT fue emitida con referencia A desde una plantilla obsoleta.');
      }
    });

    const dispatch = await this.placeStatic(`${DUNGEON}/table_medium_decorated_A.gltf`, -3.3, 0, 5.6, 0);
    this.interactables.push({
      id: 'ev-dispatch', label: 'Analizar remisión', object: dispatch, radius: 2.5, once: true,
      onInteract: async () => {
        await this.ui.document('Remisión de Despacho', 'REM-7784', [
          ['Cantidad', '24 unidades'], ['Lote', 'L-0908-A'], ['Referencia remisión', 'CT-48 / versión A'], ['Chequeo', 'Coincide con OT']
        ], 'Despacho ejecutó lo indicado en la OT. El error ya estaba incorporado en la documentación de producción.');
        this.collectEvidence('dispatch', 'REM-7784', 'La remisión replica correctamente la OT equivocada.');
      }
    });

    const inspection = await this.placeStatic(`${DUNGEON}/shelf_small_candles.gltf`, -3.1, 0, -5.7, -Math.PI / 2);
    this.interactables.push({
      id: 'ev-inspection', label: 'Revisar registro de inspección', object: inspection, radius: 2.4, once: true,
      onInteract: async () => {
        await this.ui.document('Registro de Inspección', 'CAL-FT-021', [
          ['Dimensional', 'Conforme'], ['Cantidad', 'Conforme'], ['Referencia vs. pedido', 'No verificada'], ['Doble control documental', 'No ejecutado']
        ], 'El control final validó producto contra OT, pero no cerró el lazo con el requerimiento original del cliente.');
        this.collectEvidence('inspection', 'CAL-FT-021', 'La inspección omitió la validación pedido–OT.');
      }
    });
  }

  private async buildTraceabilityRoom(): Promise<void> {
    const pedestal = this.createPedestal(9, 0, 0x38a3ff);
    const hologram = this.createLabelSprite('MATRIZ DE TRAZABILIDAD', '#7cc5ff');
    hologram.position.set(9, 2.4, 0);
    hologram.scale.set(5.2, 0.8, 1);
    this.group.add(hologram);

    this.interactables.push({
      id: 'traceability-puzzle', label: 'Reconstruir trazabilidad', object: pedestal, radius: 2.7,
      enabled: () => this.stats.evidence.size >= 3 && !this.traceabilitySolved,
      onInteract: async () => {
        const success = await this.ui.sequencePuzzle(
          'Reconstruye el flujo del incidente',
          'Selecciona las etapas en el orden correcto del flujo documental y físico.',
          [
            { id: 'inspection', text: 'Inspección y liberación' },
            { id: 'order', text: 'Pedido del cliente' },
            { id: 'dispatch', text: 'Despacho' },
            { id: 'production', text: 'Producción / alistamiento' },
            { id: 'ot', text: 'Emisión de OT' }
          ],
          ['order', 'ot', 'production', 'inspection', 'dispatch']
        );
        if (!success) {
          this.penalize(25, 8, 'SECUENCIA INCORRECTA', 'La trazabilidad no enlaza correctamente origen, transformación y liberación.');
          return;
        }
        this.traceabilitySolved = true;
        this.stats.score += 240;
        this.audio.success();
        this.addInventory({ id: 'traceability-map', name: 'Mapa de trazabilidad', description: 'Secuencia completa Pedido → OT → Producción → Inspección → Despacho.', icon: '↝', kind: 'tool' });
        this.ui.showToast('TRAZABILIDAD RECONSTRUIDA', 'El sello de la segunda compuerta está activo.', 'success');
        this.setStage('traceability', 'Activa la compuerta oriental para entrar a la Cámara de Riesgo.');
        this.onEvent('traceability_solved');
      }
    });
  }

  private async buildRiskRoom(): Promise<void> {
    const spike = await this.assets.cloneStatic(`${DUNGEON}/floor_tile_big_spikes.gltf`);
    spike.position.set(22, 0.025, -7.5);
    this.group.add(spike);

    const enemyPositions: Array<[number, number]> = [[19, -5], [20, 5], [23, -1], [25, 5.5], [27, -5.5], [28, 1.5]];
    enemyPositions.forEach(([x, z], index) => this.createErrorEnemy(`ERR-${index + 1}`, x, z));

    const skeleton = await this.assets.cloneSkinned('/assets/kaykit/characters/Skeleton_Warrior.glb');
    skeleton.position.set(27, 0, 9.2);
    skeleton.rotation.y = Math.PI;
    this.group.add(skeleton);
    this.skeleton = skeleton;
    this.colliders.push({ minX: 26.3, maxX: 27.7, minZ: 8.45, maxZ: 9.95 });
    this.skeletonMixer = new THREE.AnimationMixer(skeleton);
    const clips = await this.assets.animations('/assets/kaykit/animations/Rig_Medium_General.glb');
    const idle = clips.find((clip) => clip.name === 'Idle_B') ?? clips.find((clip) => clip.name === 'Idle_A');
    if (idle) this.skeletonMixer.clipAction(idle).play();

    this.interactables.push({
      id: 'guardian', label: 'Hablar con el Guardián de Calidad', object: skeleton, radius: 2.9,
      enabled: () => this.stats.defeatedErrors >= 4 && !this.stats.keys.has('quality-key'),
      onInteract: async () => {
        await this.ui.dialogue('GUARDIÁN DE CALIDAD', 'Has contenido ruido operativo. Ahora demuestra que distingues una evidencia trazable de un dato meramente circunstancial.');
        const answer = await this.ui.choose('Sello de liberación', '¿Qué dato enlaza material, proceso, inspección y despacho de forma verificable?', [
          { id: 'lot', text: 'Número de lote / identificador único controlado' },
          { id: 'name', text: 'Nombre informal del operario' },
          { id: 'color', text: 'Color de la etiqueta' },
          { id: 'mail', text: 'Hora del correo del cliente' }
        ]);
        if (answer !== 'lot') {
          this.penalize(30, 7, 'RESPUESTA NO TRAZABLE', 'Busca un identificador que viaje con el material a través de las etapas.');
          return;
        }
        this.stats.keys.add('quality-key');
        this.stats.score += 150;
        this.audio.success();
        this.addInventory({ id: 'quality-key', name: 'Sello de Calidad', description: 'Autoriza el acceso al análisis de causa.', icon: '◆', kind: 'key' });
        this.ui.showToast('SELLO DE CALIDAD OBTENIDO', 'La compuerta hacia Ishikawa puede activarse.', 'success');
        this.onEvent('quality_key_obtained');
      }
    });
  }

  private async buildIshikawaRoom(): Promise<void> {
    this.buildPhysicalFishbone();

    const tokens: Array<{ id: string; label: string; x: number; z: number; color: number }> = [
      { id: 'method', label: 'Método', x: 32.8, z: -9, color: 0x38a3ff },
      { id: 'material', label: 'Material', x: 33.5, z: 8.8, color: 0xffd43b },
      { id: 'machine', label: 'Máquina', x: 37, z: -9.2, color: 0x8b5cf6 },
      { id: 'people', label: 'Mano de obra', x: 38, z: 9, color: 0x34d399 },
      { id: 'measurement', label: 'Medición', x: 41.8, z: -8.6, color: 0xfb7185 },
      { id: 'environment', label: 'Entorno', x: 42, z: 8.6, color: 0x94a3b8 }
    ];

    for (const token of tokens) {
      const orb = this.createCollectibleOrb(token.x, token.z, token.color, token.label);
      this.interactables.push({
        id: `cause-${token.id}`, label: `Recoger ficha: ${token.label}`, object: orb, radius: 2.2, once: true,
        onInteract: async () => {
          this.stats.ishikawaTokens.add(token.id);
          orb.visible = false;
          this.addInventory({ id: `cause-${token.id}`, name: `Ficha ${token.label}`, description: 'Categoría del diagrama Ishikawa.', icon: '●', kind: 'cause' });
          this.stats.score += 35;
          this.audio.collect();
          this.ui.showToast('FICHA DE CAUSA RECOGIDA', `${this.stats.ishikawaTokens.size}/6 categorías recuperadas.`, 'success');
          if (this.stats.ishikawaTokens.size === 6) this.setStage('ishikawa', 'Las 6 categorías están listas. Interactúa con la cabeza del Ishikawa para clasificar las causas.');
        }
      });
    }

    const head = this.createPedestal(42.2, 0, 0xffd43b);
    this.interactables.push({
      id: 'ishikawa-head', label: 'Completar Ishikawa', object: head, radius: 2.8,
      enabled: () => this.stats.ishikawaTokens.size === 6 && !this.ishikawaSolved,
      onInteract: async () => {
        const categories = [
          { id: 'method', text: 'Método' }, { id: 'material', text: 'Material' }, { id: 'machine', text: 'Máquina' },
          { id: 'people', text: 'Mano de obra' }, { id: 'measurement', text: 'Medición' }, { id: 'environment', text: 'Entorno' }
        ];
        const result = await this.ui.classificationPuzzle('Clasifica cada causa', [
          { id: 'obsolete', text: 'Una plantilla documental obsoleta seguía disponible para crear OT.' },
          { id: 'double', text: 'El proceso no exige doble verificación pedido–OT antes de liberar.' },
          { id: 'indicator', text: 'No existe indicador que mida discrepancias entre pedido y OT.' },
          { id: 'training', text: 'El personal nuevo no reconoce el código de versión del producto.' },
          { id: 'system', text: 'El sistema permite seleccionar referencias descontinuadas.' },
          { id: 'noise', text: 'El área de revisión comparte espacio con interrupciones frecuentes.' }
        ], categories, {
          obsolete: 'method', double: 'method', indicator: 'measurement', training: 'people', system: 'machine', noise: 'environment'
        });

        if (result.correct < 5) {
          this.penalize(40, 10, 'ISHIKAWA INCOMPLETO', `Clasificaste ${result.correct}/6 correctamente. Se requiere mínimo 5/6.`);
          return;
        }
        this.ishikawaSolved = true;
        this.stats.score += 360;
        this.audio.success();
        this.addInventory({ id: 'ishikawa-report', name: 'Ishikawa validado', description: 'Mapa causal con categorías y causas potenciales.', icon: '⟫', kind: 'tool' });
        this.ui.showToast('ISHIKAWA VALIDADO', `${result.correct}/6 clasificaciones correctas.`, 'success');
        this.setStage('ishikawa', 'Activa la última compuerta y entra al Altar de los 5 Porqués.');
        this.onEvent('ishikawa_solved', { correct: result.correct });
      }
    });
  }

  private async buildFiveWhysRoom(): Promise<void> {
    const altar = this.createPedestal(51, 0, 0x8b5cf6);
    const label = this.createLabelSprite('CADENA DE LOS 5 PORQUÉS', '#c4b5fd');
    label.position.set(51, 2.7, 0);
    label.scale.set(5.5, 0.8, 1);
    this.group.add(label);

    this.interactables.push({
      id: 'five-whys', label: 'Iniciar secuencia de 5 Porqués', object: altar, radius: 3,
      enabled: () => this.ishikawaSolved && !this.fiveWhysSolved,
      onInteract: async () => {
        const result = await this.ui.fiveWhys([
          {
            why: '¿Por qué el cliente recibió la versión A cuando había solicitado la B?',
            choices: [{ id: 'a', text: 'Porque despacho envió la referencia indicada en la OT.' }, { id: 'b', text: 'Porque el cliente cambió de opinión.' }, { id: 'c', text: 'Porque faltó inventario.' }],
            correct: 'a', explanation: 'La salida física fue coherente con la OT; el error ya estaba aguas arriba.'
          },
          {
            why: '¿Por qué la OT indicaba versión A?',
            choices: [{ id: 'a', text: 'Porque se creó desde una plantilla que conservaba la referencia A.' }, { id: 'b', text: 'Porque despacho modificó la OT.' }, { id: 'c', text: 'Porque la inspección cambió el plano.' }],
            correct: 'a', explanation: 'La plantilla introdujo el dato incorrecto al comienzo del flujo productivo.'
          },
          {
            why: '¿Por qué una plantilla obsoleta seguía disponible?',
            choices: [{ id: 'a', text: 'Porque no existía control efectivo de versiones y retiro de documentos obsoletos.' }, { id: 'b', text: 'Porque era más rápida.' }, { id: 'c', text: 'Porque el operario decidió ignorar el sistema.' }],
            correct: 'a', explanation: 'La condición es sistémica: el repositorio no impedía reutilizar una versión fuera de vigencia.'
          },
          {
            why: '¿Por qué el error no fue detectado en inspección?',
            choices: [{ id: 'a', text: 'Porque la inspección comparaba producto contra OT, no OT contra pedido original.' }, { id: 'b', text: 'Porque no se midieron dimensiones.' }, { id: 'c', text: 'Porque el lote no tenía cantidad.' }],
            correct: 'a', explanation: 'El control existente verificaba conformidad interna, pero no el requisito fuente.'
          },
          {
            why: '¿Por qué el proceso permitía liberar sin contrastar pedido–OT?',
            choices: [{ id: 'a', text: 'Porque el flujo no tenía un punto obligatorio de verificación cruzada ni bloqueo por discrepancia.' }, { id: 'b', text: 'Porque la persona tuvo un mal día.' }, { id: 'c', text: 'Porque el cliente necesitaba urgencia.' }],
            correct: 'a', explanation: 'Causa raíz: gestión documental débil + ausencia de un control preventivo obligatorio antes de liberar producción.'
          }
        ]);
        if (result.mistakes > 0) {
          this.stats.errors += result.mistakes;
          this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - result.mistakes * 20);
          this.stats.score = Math.max(0, this.stats.score - result.mistakes * 35);
        }

        const action = await this.ui.choose('Acción correctiva sistémica', 'Selecciona la respuesta que elimina la condición causal y agrega prevención.', [
          { id: 'system', text: 'Retirar plantillas obsoletas, controlar versiones y bloquear liberación hasta validar Pedido ↔ OT.' },
          { id: 'talk', text: 'Recordar verbalmente al equipo que tenga más cuidado.' },
          { id: 'inspect', text: 'Aumentar sólo el muestreo final.' },
          { id: 'stock', text: 'Comprar más inventario de todas las referencias.' }
        ], 'CAPA · ACCIÓN CORRECTIVA');
        if (action !== 'system') {
          this.penalize(45, 12, 'ACCIÓN DÉBIL', 'La acción propuesta no elimina la condición sistémica identificada.');
          return;
        }

        const hits = await this.ui.timingMiniGame(3);
        if (hits < 2) {
          this.penalize(35, 8, 'VERIFICACIÓN FALLIDA', `Aciertos ${hits}/3. Repite la ventana de control para liberar la acción.`);
          return;
        }

        this.fiveWhysSolved = true;
        this.stats.score += 520;
        this.audio.success();
        this.addInventory({ id: 'root-cause', name: 'Causa raíz confirmada', description: 'Control documental insuficiente y falta de verificación Pedido ↔ OT.', icon: '✓', kind: 'mission' });
        this.setStage('containment', 'Abre el cofre dorado de contención y cierra formalmente la no conformidad.');
        this.ui.showToast('CAUSA RAÍZ CONFIRMADA', 'La evidencia, Ishikawa, 5 Porqués y control de liberación son coherentes.', 'success');
        this.onEvent('five_whys_solved', { mistakes: result.mistakes, timingHits: hits });
      }
    });

    const finalChest = this.createPhysicalChest(55, 0, 0xf6c945, 1.3);
    this.interactables.push({
      id: 'final-chest', label: 'Cerrar expediente NC-26-0914', object: finalChest.group, radius: 2.6,
      enabled: () => this.fiveWhysSolved && !this.finalSolved,
      onInteract: async () => {
        this.openChest(finalChest.animation);
        this.finalSolved = true;
        this.stats.stage = 'complete';
        this.stats.score += Math.max(0, Math.floor(this.stats.remainingSeconds * 0.45));
        this.audio.success();
        await this.ui.dialogue('PROTOCOLO CERRADO', 'Acción correctiva: retirar documentos obsoletos, controlar versiones y establecer verificación obligatoria Pedido ↔ OT antes de liberar. El incidente pasa a seguimiento de eficacia.', 'FINALIZAR MISIÓN');
        this.onEvent('mission_completed', { score: this.stats.score, errors: this.stats.errors });
        this.onFinish();
      }
    });
  }

  private buildPhysicalFishbone(): void {
    const material = new THREE.MeshStandardMaterial({ color: 0x7cc5ff, emissive: 0x0b3154, metalness: 0.42, roughness: 0.36 });
    const spine = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.08, 0.14), material);
    spine.position.set(37.4, 0.11, 0);
    spine.castShadow = true;
    this.group.add(spine);

    const branchData: Array<[number, number, number, string]> = [
      [34.3, -1.55, -0.72, 'MÉTODO'], [36.7, -1.55, -0.72, 'MÁQUINA'], [39.1, -1.55, -0.72, 'MEDICIÓN'],
      [34.3, 1.55, 0.72, 'MATERIAL'], [36.7, 1.55, 0.72, 'PERSONAS'], [39.1, 1.55, 0.72, 'ENTORNO']
    ];
    for (const [x, z, angle, label] of branchData) {
      const bone = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.07, 0.12), material);
      bone.position.set(x, 0.12, z);
      bone.rotation.y = angle;
      this.group.add(bone);
      const sprite = this.createLabelSprite(label, '#9ed7ff');
      sprite.position.set(x - 0.7, 0.55, z * 1.9);
      sprite.scale.set(2.1, 0.45, 1);
      this.group.add(sprite);
    }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0xffd43b, emissive: 0x503b00 }));
    head.rotation.z = -Math.PI / 2;
    head.position.set(42.1, 0.6, 0);
    this.group.add(head);
  }

  private createErrorEnemy(id: string, x: number, z: number): void {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 1),
      new THREE.MeshStandardMaterial({ color: 0xff3b51, emissive: 0x7a0715, emissiveIntensity: 1.2, roughness: 0.26, metalness: 0.2 })
    );
    shell.castShadow = true;
    group.add(shell);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.055, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xff8b9b, transparent: true, opacity: 0.65 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const light = new THREE.PointLight(0xff203a, 2.4, 5, 2);
    group.add(light);
    group.position.set(x, 1.05, z);
    this.group.add(group);
    this.enemies.push({ id, object: group, velocity: new THREE.Vector3(), home: new THREE.Vector3(x, 1.05, z), hp: 1, active: true, hitCooldown: 0, phase: Math.random() * Math.PI * 2 });
  }

  private updateEnemies(dt: number, playerPosition: THREE.Vector3): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
      enemy.phase += dt * 2.2;
      enemy.object.rotation.y += dt * 1.5;
      const baseScale = enemy.hitCooldown > 0 ? 1.25 : 1 + Math.sin(enemy.phase * 2) * 0.06;
      enemy.object.scale.lerp(new THREE.Vector3(baseScale, baseScale, baseScale), 1 - Math.exp(-dt * 18));
      enemy.object.position.y = 1.05 + Math.sin(enemy.phase) * 0.22;

      const toPlayer = playerPosition.clone().sub(enemy.object.position);
      toPlayer.y = 0;
      const distance = toPlayer.length();
      if (distance < 6.5 && distance > 0.001) {
        toPlayer.normalize();
        enemy.object.position.addScaledVector(toPlayer, dt * 1.25);
      } else {
        const homeVector = enemy.home.clone().sub(enemy.object.position);
        homeVector.y = 0;
        if (homeVector.length() > 0.5) enemy.object.position.addScaledVector(homeVector.normalize(), dt * 0.5);
      }

      if (distance < 1.05 && this.hitCooldown <= 0) {
        this.hitCooldown = 1.2;
        const damage = this.profile.characterClass === 'engineer' ? 9 : 15;
        this.stats.health = Math.max(0, this.stats.health - damage);
        this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - 12);
        this.stats.errors += 1;
        this.stats.score = Math.max(0, this.stats.score - 45);
        this.audio.hit();
        this.ui.showToast('IMPACTO DE ERROR', `-${damage}% integridad · -12 s. Usa ESPACIO a corta distancia para neutralizarlo.`, 'danger');
        this.onEvent('player_hit', { enemy: enemy.id, damage });
        enemy.object.position.copy(enemy.home);
      }
    }
  }

  private createPhysicalChest(x: number, z: number, color: number, scale = 1): { group: THREE.Group; animation: ChestAnimation } {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    const wood = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x28384b, roughness: 0.28, metalness: 0.78 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.78, 1.18), wood);
    base.position.y = 0.48;
    base.castShadow = true;
    group.add(base);
    const bandA = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.84, 1.23), metal);
    bandA.position.set(-0.53, 0.5, 0);
    group.add(bandA);
    const bandB = bandA.clone();
    bandB.position.x = 0.53;
    group.add(bandB);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.89, -0.52);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.42, 1.16), wood);
    lid.position.set(0, 0.18, 0.52);
    lid.castShadow = true;
    lidPivot.add(lid);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 0.11), metal);
    latch.position.set(0, 0.12, 1.1);
    lidPivot.add(latch);
    group.add(lidPivot);
    this.group.add(group);
    this.colliders.push({ minX: x - 1.0 * scale, maxX: x + 1.0 * scale, minZ: z - 0.75 * scale, maxZ: z + 0.75 * scale });
    const animation = { lid: lidPivot, progress: 0, opening: false, opened: false };
    this.chestAnimations.push(animation);
    return { group, animation };
  }

  private openChest(animation: ChestAnimation): void {
    if (animation.opened || animation.opening) return;
    animation.opening = true;
    this.audio.chest();
  }

  private createPedestal(x: number, z: number, color: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x303b4a, roughness: 0.72, metalness: 0.08 });
    const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.32 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.2, 0.55, 8), stone);
    base.position.y = 0.28;
    base.castShadow = true;
    group.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 0.9, 8), stone);
    top.position.y = 0.95;
    group.add(top);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), glow);
    crystal.position.y = 1.72;
    group.add(crystal);
    const light = new THREE.PointLight(color, 1.8, 5, 2);
    light.position.y = 1.75;
    group.add(light);
    this.group.add(group);
    this.colliders.push({ minX: x - 0.82, maxX: x + 0.82, minZ: z - 0.82, maxZ: z + 0.82 });
    return group;
  }

  private createCollectibleOrb(x: number, z: number, color: number, label: string): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 1.05, z);
    const orb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.25 }));
    group.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.035, 8, 30), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const sprite = this.createLabelSprite(label.toUpperCase(), '#ffffff');
    sprite.position.y = 1.0;
    sprite.scale.set(2.2, 0.45, 1);
    group.add(sprite);
    const light = new THREE.PointLight(color, 1.8, 4, 2);
    group.add(light);
    this.group.add(group);
    return group;
  }

  private createLabelSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '900 54px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(3,8,15,.78)';
    context.fillRect(0, 22, canvas.width, 116);
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.strokeRect(4, 26, canvas.width - 8, 108);
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.labelTextures.push(texture);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    return new THREE.Sprite(material);
  }

  private collectEvidence(id: string, name: string, description: string): void {
    this.stats.evidence.add(id);
    this.stats.score += 110;
    this.audio.collect();
    this.addInventory({ id: `evidence-${id}`, name, description, icon: 'DOC', kind: 'evidence' });
    this.ui.showToast('EVIDENCIA ASEGURADA', `${this.stats.evidence.size}/3 evidencias recuperadas.`, 'success');
    this.onEvent('evidence_collected', { evidence: id, total: this.stats.evidence.size });
    if (this.stats.evidence.size >= 3) this.setStage('evidence', 'Las 3 evidencias están trazadas. Activa la primera compuerta para continuar.');
  }

  private addInventory(item: InventoryItem): void {
    if (this.stats.inventory.some((existing) => existing.id === item.id)) return;
    this.stats.inventory.push(item);
  }

  private penalize(seconds: number, health: number, title: string, body: string): void {
    this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - seconds);
    this.stats.health = Math.max(0, this.stats.health - health);
    this.stats.errors += 1;
    this.stats.score = Math.max(0, this.stats.score - 70);
    this.audio.error();
    this.ui.showToast(title, `-${seconds} s · -${health}% integridad. ${body}`, 'danger');
    this.onEvent('penalty', { seconds, health, title });
  }

  private setStage(stage: GameStats['stage'], objective: string): void {
    this.stats.stage = stage;
    this.stats.objective = objective;
    this.ui.setObjective(objective);
  }

  private async placeStatic(path: string, x: number, y: number, z: number, rotationY = 0): Promise<THREE.Object3D> {
    const object = await this.assets.cloneStatic(path);
    object.position.set(x, y, z);
    object.rotation.y = rotationY;
    this.group.add(object);
    return object;
  }

  private shortestAngle(a: number, b: number): number {
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
  }
}
