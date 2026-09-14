import * as THREE from 'three';
import type { AssetLibrary } from './AssetLibrary';
import type { Collider, Interactable, GameStats } from './types';
import type { UI } from './UI';

const DUNGEON = '/assets/kaykit/dungeon';

type Gate = {
  object: THREE.Object3D;
  open: boolean;
  opening: boolean;
  collider: Collider;
  targetY: number;
};

export class World {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly interactables: Interactable[] = [];
  private gates = new Map<string, Gate>();
  private skeletonMixer: THREE.AnimationMixer | null = null;
  private skeleton: THREE.Object3D | null = null;
  private hazardCooldown = 0;
  private finalSolved = false;

  constructor(
    private scene: THREE.Scene,
    private assets: AssetLibrary,
    private ui: UI,
    private stats: GameStats,
    private onFinish: () => void
  ) {
    this.scene.add(this.group);
  }

  async init(): Promise<void> {
    await Promise.all([
      this.buildFloor(),
      this.buildWalls(),
      this.buildDecor(),
      this.buildInteractables(),
      this.buildGuardian()
    ]);
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.skeletonMixer?.update(dt);
    if (this.skeleton) {
      const dx = playerPosition.x - this.skeleton.position.x;
      const dz = playerPosition.z - this.skeleton.position.z;
      if (Math.hypot(dx, dz) < 6) {
        const target = Math.atan2(dx, dz);
        this.skeleton.rotation.y += this.shortestAngle(this.skeleton.rotation.y, target) * (1 - Math.exp(-dt * 5));
      }
    }

    for (const gate of this.gates.values()) {
      if (gate.opening && !gate.open) {
        gate.object.position.y += dt * 3.4;
        if (gate.object.position.y >= gate.targetY) {
          gate.object.position.y = gate.targetY;
          gate.open = true;
          gate.opening = false;
        }
      }
    }

    this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    if (playerPosition.x > 9.5 && playerPosition.x < 13.5 && playerPosition.z > -2.1 && playerPosition.z < 1.9 && this.hazardCooldown <= 0) {
      this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - 8);
      this.stats.errors += 1;
      this.hazardCooldown = 2.2;
      this.ui.showToast('TRAMPA ACTIVADA', '-8 segundos. Observa el entorno antes de avanzar.', 'danger');
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

  private async buildFloor(): Promise<void> {
    const floorPath = `${DUNGEON}/floor_tile_large.gltf`;
    const rockyPath = `${DUNGEON}/floor_tile_large_rocks.gltf`;
    for (let x = -8; x <= 28; x += 4) {
      for (let z = -8; z <= 8; z += 4) {
        const inGap = x > 6 && x < 10;
        if (inGap && Math.abs(z) > 2) continue;
        const model = await this.assets.cloneStatic((x === 12 && z === 0) || (x === 24 && z === 4) ? rockyPath : floorPath);
        model.position.set(x, 0, z);
        this.group.add(model);
      }
    }

    const spikes = await this.assets.cloneStatic(`${DUNGEON}/floor_tile_big_spikes.gltf`);
    spikes.position.set(12, 0.03, 0);
    this.group.add(spikes);
  }

  private async buildWalls(): Promise<void> {
    const wall = `${DUNGEON}/wall.gltf`;
    const doorway = `${DUNGEON}/wall_doorway.gltf`;

    // Perímetro longitudinal
    for (let x = -8; x <= 28; x += 4) {
      await this.placeStatic(wall, x, 0, -10, 0);
      await this.placeStatic(wall, x, 0, 10, 0);
    }
    for (let z = -8; z <= 8; z += 4) {
      await this.placeStatic(wall, -10, 0, z, Math.PI / 2);
      await this.placeStatic(wall, 30, 0, z, Math.PI / 2);
    }

    // Separadores de salas con puerta central.
    for (const x of [8, 20]) {
      for (const z of [-8, -4, 4, 8]) await this.placeStatic(wall, x, 0, z, Math.PI / 2);
      await this.placeStatic(doorway, x, 0, 0, Math.PI / 2);
    }

    // Colliders del perímetro.
    this.colliders.push(
      { minX: -10.5, maxX: -9.4, minZ: -10, maxZ: 10 },
      { minX: 29.4, maxX: 30.5, minZ: -10, maxZ: 10 },
      { minX: -10, maxX: 30, minZ: -10.5, maxZ: -9.4 },
      { minX: -10, maxX: 30, minZ: 9.4, maxZ: 10.5 }
    );

    // Separadores dejando paso central, que ocuparán las rejas.
    for (const x of [8, 20]) {
      this.colliders.push(
        { minX: x - 0.55, maxX: x + 0.55, minZ: -10, maxZ: -1.45 },
        { minX: x - 0.55, maxX: x + 0.55, minZ: 1.45, maxZ: 10 }
      );
    }

    await this.createGate('evidenceGate', 8, 0, () => this.stats.evidence.size >= 3);
    await this.createGate('keyGate', 20, 0, () => this.stats.keys.has('quality-key'));
  }

  private async createGate(id: string, x: number, z: number, requirement: () => boolean): Promise<void> {
    const gateObject = await this.assets.cloneStatic(`${DUNGEON}/wall_gated.gltf`);
    gateObject.rotation.y = Math.PI / 2;
    gateObject.position.set(x, 0, z);
    this.group.add(gateObject);

    const gate: Gate = {
      object: gateObject,
      open: false,
      opening: false,
      targetY: 4.2,
      collider: { minX: x - 0.6, maxX: x + 0.6, minZ: -1.45, maxZ: 1.45, enabled: () => !gate.open }
    };
    this.gates.set(id, gate);
    this.colliders.push(gate.collider);

    this.interactables.push({
      id,
      label: 'Inspeccionar reja',
      object: gateObject,
      radius: 2.5,
      onInteract: async () => {
        if (gate.open || gate.opening) return;
        if (requirement()) {
          gate.opening = true;
          this.ui.showToast('MECANISMO DESBLOQUEADO', id === 'evidenceGate' ? 'Trazabilidad mínima verificada.' : 'Llave de Calidad aceptada.', 'success');
          if (id === 'evidenceGate') this.ui.setObjective('Cruza la Cámara de Riesgo y consulta al Guardián de Calidad.');
          if (id === 'keyGate') this.ui.setObjective('Ingresa a la Cámara de Causa Raíz y cierra la no conformidad.');
        } else if (id === 'evidenceGate') {
          await this.ui.dialogue('SISTEMA DE TRAZABILIDAD', `Acceso denegado. Se requieren 3 evidencias verificadas. Actualmente: ${this.stats.evidence.size}/3.`);
        } else {
          await this.ui.dialogue('SELLO DE CALIDAD', 'Esta reja responde a una Llave de Calidad. El guardián de la cámara anterior puede saber cómo obtenerla.');
        }
      }
    });
  }

  private async buildDecor(): Promise<void> {
    const decor: Array<[string, number, number, number, number?]> = [
      ['banner_patternA_blue.gltf', -7.5, 0, -8.9, 0],
      ['banner_patternA_yellow.gltf', -3.5, 0, -8.9, 0],
      ['crates_stacked.gltf', -6.6, 0, 6.7, 0],
      ['barrel_large_decorated.gltf', -3.2, 0, 7.0, 0],
      ['shelf_large.gltf', 4.9, 0, -8.6, 0],
      ['pillar_decorated.gltf', 14, 0, -7.4, 0],
      ['pillar_decorated.gltf', 14, 0, 7.4, 0],
      ['banner_patternA_blue.gltf', 25, 0, -8.9, 0],
      ['banner_patternA_yellow.gltf', 21, 0, -8.9, 0],
      ['chest_gold.gltf', 27, 0, 6.7, Math.PI]
    ];
    for (const [name, x, y, z, r = 0] of decor) await this.placeStatic(`${DUNGEON}/${name}`, x, y, z, r);

    for (const [x,z,rot] of [
      [-8.9,-5.5, Math.PI/2],[-8.9,5.5,Math.PI/2],
      [7.0,-5.5,-Math.PI/2],[7.0,5.5,-Math.PI/2],
      [9.0,-5.5,Math.PI/2],[9.0,5.5,Math.PI/2],
      [19.0,-5.5,-Math.PI/2],[19.0,5.5,-Math.PI/2],
      [21.0,-5.5,Math.PI/2],[21.0,5.5,Math.PI/2],
      [28.9,-5.5,-Math.PI/2],[28.9,5.5,-Math.PI/2]
    ] as Array<[number,number,number]>) {
      const torch = await this.placeStatic(`${DUNGEON}/torch_mounted.gltf`, x, 2.1, z, rot);
      const light = new THREE.PointLight(0xff9f43, 2.8, 8, 2);
      light.position.set(x, 2.8, z);
      light.castShadow = false;
      this.group.add(light);
      torch.userData.decor = true;
    }

    // Colliders para decoración voluminosa.
    this.colliders.push(
      { minX: -7.8, maxX: -5.2, minZ: 5.5, maxZ: 8.0 },
      { minX: -4.4, maxX: -2.0, minZ: 5.6, maxZ: 8.1 },
      { minX: 4.2, maxX: 5.8, minZ: -9.2, maxZ: -7.4 },
      { minX: 13.2, maxX: 14.8, minZ: -8.2, maxZ: -6.6 },
      { minX: 13.2, maxX: 14.8, minZ: 6.6, maxZ: 8.2 }
    );
  }

  private async buildInteractables(): Promise<void> {
    const chest = await this.placeStatic(`${DUNGEON}/chest.gltf`, -5.2, 0, -3.7, 0.25);
    this.interactables.push({
      id: 'ev-order', label: 'Abrir cofre de registros', object: chest, radius: 2.15, once: true,
      onInteract: async () => {
        await this.ui.document('Orden de Producción', 'OT-260914-017', [
          ['Cliente', 'Proyecto crítico / prioridad A'],
          ['Ítem solicitado', 'Conjunto CT-48 / versión B'],
          ['Ítem en OT', 'Conjunto CT-48 / versión A'],
          ['Plantilla origen', 'OT_BASE_2025_v3']
        ], 'La referencia transcrita en la OT no coincide con la versión solicitada por el cliente.');
        this.collectEvidence('order', 'ORDEN DE PRODUCCIÓN RECUPERADA');
      }
    });

    const table = await this.placeStatic(`${DUNGEON}/table_medium_decorated_A.gltf`, 1.8, 0, 4.1, 0);
    this.interactables.push({
      id: 'ev-dispatch', label: 'Revisar remisión de despacho', object: table, radius: 2.25, once: true,
      onInteract: async () => {
        await this.ui.document('Remisión de Despacho', 'REM-7784', [
          ['Cantidad solicitada', '24 unidades'],
          ['Cantidad alistada', '24 unidades'],
          ['Lote registrado', 'L-0908-A'],
          ['Verificación contra OT', 'Conforme']
        ], 'La remisión replica la información de la OT; el error no se originó durante el alistamiento.');
        this.collectEvidence('dispatch', 'REMISIÓN TRAZADA');
      }
    });

    const shelf = await this.placeStatic(`${DUNGEON}/shelf_small_candles.gltf`, 5.1, 0, 5.6, -Math.PI / 2);
    this.interactables.push({
      id: 'ev-inspection', label: 'Consultar registro de inspección', object: shelf, radius: 2.2, once: true,
      onInteract: async () => {
        await this.ui.document('Registro de Inspección', 'CAL-FT-021', [
          ['Control dimensional', 'Conforme'],
          ['Cantidad', 'Conforme'],
          ['Referencia vs. plano', 'No registrada'],
          ['Doble verificación documental', 'No ejecutada']
        ], 'El producto fue inspeccionado, pero faltó contrastar la referencia documental contra el requerimiento original.');
        this.collectEvidence('inspection', 'REGISTRO DE INSPECCIÓN ANALIZADO');
      }
    });

    const finalChest = await this.placeStatic(`${DUNGEON}/chest_gold.gltf`, 26.2, 0, 0, Math.PI / 2);
    this.interactables.push({
      id: 'final', label: 'Abrir expediente de No Conformidad', object: finalChest, radius: 2.5,
      enabled: () => this.stats.keys.has('quality-key') && !this.finalSolved,
      onInteract: async () => this.solveFinal()
    });

    this.colliders.push(
      { minX: -6.2, maxX: -4.2, minZ: -4.6, maxZ: -2.8 },
      { minX: 0.65, maxX: 2.95, minZ: 2.95, maxZ: 5.25 },
      { minX: 4.2, maxX: 6.0, minZ: 4.8, maxZ: 6.4 },
      { minX: 25.25, maxX: 27.2, minZ: -1.0, maxZ: 1.0 }
    );
  }

  private async buildGuardian(): Promise<void> {
    const skeleton = await this.assets.cloneSkinned('/assets/kaykit/characters/Skeleton_Warrior.glb');
    skeleton.position.set(16.2, 0, -0.2);
    skeleton.rotation.y = -Math.PI / 2;
    this.group.add(skeleton);
    this.skeleton = skeleton;
    this.colliders.push({ minX: 15.55, maxX: 16.85, minZ: -0.85, maxZ: 0.45 });

    this.skeletonMixer = new THREE.AnimationMixer(skeleton);
    const clips = await this.assets.animations('/assets/kaykit/animations/Rig_Medium_General.glb');
    const idle = clips.find((clip) => clip.name === 'Idle_B') ?? clips.find((clip) => clip.name === 'Idle_A');
    if (idle) this.skeletonMixer.clipAction(idle).play();

    this.interactables.push({
      id: 'guardian', label: 'Hablar con el Guardián de Calidad', object: skeleton, radius: 2.6,
      enabled: () => this.stats.evidence.size >= 3 && !this.stats.keys.has('quality-key'),
      onInteract: async () => {
        await this.ui.dialogue('GUARDIÁN DE CALIDAD', 'Has reunido documentos, pero una trazabilidad no consiste en coleccionar papeles. Demuestra que entiendes qué dato enlaza el material físico con su historia documental.');
        const answer = await this.ui.choose('Prueba de trazabilidad', '¿Qué identificador permite seguir el material usado desde recepción, producción, inspección y despacho?', [
          { id: 'a', text: 'El nombre del operario' },
          { id: 'b', text: 'El número de lote' },
          { id: 'c', text: 'La fecha del correo del cliente' },
          { id: 'd', text: 'El color de la etiqueta' }
        ]);
        if (answer === 'b') {
          this.stats.keys.add('quality-key');
          const key = await this.assets.cloneStatic(`${DUNGEON}/key.gltf`);
          key.position.set(16.2, 1.45, 1.45);
          key.scale.setScalar(1.45);
          this.group.add(key);
          this.ui.showToast('LLAVE DE CALIDAD OBTENIDA', 'La puerta de la Cámara de Causa Raíz puede abrirse.', 'success');
          this.ui.setObjective('Usa la Llave de Calidad en la segunda reja.');
        } else {
          this.stats.errors += 1;
          this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - 30);
          this.ui.showToast('RESPUESTA INCORRECTA', '-30 segundos. Piensa en el identificador que acompaña físicamente al material.', 'danger');
        }
      }
    });
  }

  private async solveFinal(): Promise<void> {
    await this.ui.dialogue('EXPEDIENTE NC-26-0914', 'Las evidencias coinciden: el pedido original pedía versión B, la OT se emitió como versión A desde una plantilla antigua y la inspección no verificó la referencia contra el requerimiento original. Ahora identifica la causa raíz, no el síntoma.');

    const rootCause = await this.ui.choose('5 Porqués — Causa raíz', '¿Cuál de estas opciones describe mejor una causa sistémica del incidente?', [
      { id: 'operator', text: 'El operario no prestó suficiente atención.' },
      { id: 'dispatch', text: 'Despachos envió exactamente lo que decía la OT.' },
      { id: 'system', text: 'La plantilla documental obsoleta seguía disponible y el flujo no exigía validar la referencia contra el pedido original.' },
      { id: 'customer', text: 'El cliente solicitó una versión distinta.' }
    ]);

    if (rootCause !== 'system') {
      this.stats.errors += 1;
      this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - 45);
      this.ui.showToast('CAUSA SUPERFICIAL', '-45 segundos. Busca qué condición del sistema permitió que el error atravesara varias etapas.', 'danger');
      return;
    }

    const action = await this.ui.choose('Acción correctiva', '¿Qué acción reduce mejor la probabilidad de recurrencia?', [
      { id: 'talk', text: 'Pedir al personal que tenga más cuidado.' },
      { id: 'inspect', text: 'Inspeccionar únicamente más unidades al final.' },
      { id: 'system', text: 'Retirar plantillas obsoletas, controlar versiones y exigir verificación pedido–OT antes de liberar producción.' },
      { id: 'stock', text: 'Aumentar el inventario de todas las referencias.' }
    ]);

    if (action !== 'system') {
      this.stats.errors += 1;
      this.stats.remainingSeconds = Math.max(0, this.stats.remainingSeconds - 45);
      this.ui.showToast('ACCIÓN DÉBIL', '-45 segundos. Una acción correctiva debe atacar la causa y prevenir recurrencia.', 'danger');
      return;
    }

    this.finalSolved = true;
    await this.ui.dialogue('SISTEMA', 'Causa raíz validada. Acción correctiva aceptada. La No Conformidad queda contenida y pasa a verificación de eficacia.', 'CERRAR INCIDENTE');
    this.onFinish();
  }

  private collectEvidence(id: string, toast: string): void {
    this.stats.evidence.add(id);
    this.ui.showToast(toast, `${this.stats.evidence.size}/3 evidencias registradas.`, 'success');
    if (this.stats.evidence.size === 3) this.ui.setObjective('Regresa a la reja oriental: ya puedes desbloquear la siguiente cámara.');
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
