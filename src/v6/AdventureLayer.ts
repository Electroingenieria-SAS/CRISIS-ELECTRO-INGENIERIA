import * as THREE from 'three';
import type { AdventureUI } from '../v3/UI';
import type { AdventureAudio } from '../v3/Audio';
import type { InventoryItem } from '../v3/types';
import type { V4Progress } from '../v4/types';
import { RemoteAssetLibrary, type AssetPlacement } from '../v5/RemoteAssetLibrary';

type PremiumInteractable = {
  id: string;
  label: string;
  object: THREE.Object3D;
  radius: number;
  opened: boolean;
  onInteract: () => Promise<void>;
};

type CabinetAnimation = {
  lid: THREE.Object3D;
  target: number;
  current: number;
};

type SteamEmitter = {
  points: THREE.Points;
  velocities: Float32Array;
  origin: THREE.Vector3;
  height: number;
};

const KENNEY_RACING_REV = '2f2e5f2646dda89cb21d4e8539bab60c6e955dc8';
const RACING_BASE = `https://raw.githubusercontent.com/KenneyNL/Starter-Kit-Racing/${KENNEY_RACING_REV}/models/`;

export class V6AdventureLayer {
  readonly group = new THREE.Group();
  private assets = new RemoteAssetLibrary();
  private interactables: PremiumInteractable[] = [];
  private cabinetAnimations: CabinetAnimation[] = [];
  private drone = new THREE.Group();
  private droneTarget = new THREE.Vector3();
  private scanRing!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private scanAge = 99;
  private steam: SteamEmitter[] = [];
  private time = 0;
  private hud: HTMLDivElement;

  constructor(
    private scene: THREE.Scene,
    private ui: AdventureUI,
    private audio: AdventureAudio,
    private progress: V4Progress
  ) {
    this.group.name = 'V6_PREMIUM_ADVENTURE_LAYER';
    this.scene.add(this.group);

    this.hud = document.createElement('div');
    this.hud.className = 'v6-system-hud';
    this.hud.innerHTML = `
      <span class="v6-system-tag">SISTEMA EI</span>
      <span><kbd>F</kbd> pulso de escáner</span>
      <span class="v6-secrets"><b>0</b>/5 hallazgos opcionales</span>
    `;
    document.body.appendChild(this.hud);
  }

  async init(): Promise<void> {
    this.buildDrone();
    this.buildScanPulse();
    this.buildExplorationCaches();
    this.buildEnvironmentalVfx();
    this.buildPremiumLandmarks();
    await this.loadLogisticsAssets();
    this.refreshHud();
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.time += dt;
    this.updateDrone(dt, playerPosition);
    this.updateCabinets(dt);
    this.updateScanPulse(dt);
    this.updateSteam(dt);
  }

  nearestInteractable(position: THREE.Vector3): PremiumInteractable | null {
    let best: PremiumInteractable | null = null;
    let bestDistance = Infinity;
    for (const item of this.interactables) {
      if (item.opened) continue;
      const p = item.object.getWorldPosition(new THREE.Vector3());
      const distance = p.distanceTo(position);
      if (distance <= item.radius && distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  async interact(item: PremiumInteractable): Promise<void> {
    if (item.opened) return;
    await item.onInteract();
  }

  pulseScan(playerPosition: THREE.Vector3): void {
    if (!this.progress.flags.has('scanner')) {
      this.ui.showToast('ESCÁNER NO DISPONIBLE', 'Retira primero el Escáner EI del Centro de Control.', 'danger');
      return;
    }

    this.audio.scan();
    this.scanAge = 0;
    this.scanRing.position.set(playerPosition.x, 0.16, playerPosition.z);
    this.scanRing.visible = true;
    this.scanRing.scale.setScalar(0.2);
    this.scanRing.material.opacity = 0.9;

    let nearest: PremiumInteractable | null = null;
    let distance = Infinity;
    for (const item of this.interactables) {
      if (item.opened) continue;
      const d = item.object.getWorldPosition(new THREE.Vector3()).distanceTo(playerPosition);
      if (d < distance) {
        nearest = item;
        distance = d;
      }
    }

    if (nearest && distance <= 28) {
      this.ui.showToast('PULSO EI', `Se detecta un hallazgo opcional a ${Math.round(distance)} m. Explora el entorno.`, 'normal');
      this.flashInteractable(nearest.object);
    } else {
      this.ui.showToast('PULSO EI', 'No hay hallazgos opcionales próximos. Continúa con la investigación principal.', 'normal');
    }
  }

  private buildDrone(): void {
    const shell = new THREE.MeshStandardMaterial({ color: 0x263c4a, roughness: 0.34, metalness: 0.55 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x0b5ea8, roughness: 0.28, metalness: 0.4, emissive: 0x0b5ea8, emissiveIntensity: 0.7 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf4c542, roughness: 0.3, metalness: 0.25, emissive: 0xf4c542, emissiveIntensity: 0.42 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), shell);
    body.scale.set(1.45, 0.62, 1);
    body.castShadow = true;
    this.drone.add(body);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), blue);
    eye.position.set(0, 0, -0.26);
    this.drone.add(eye);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 8, 32), yellow);
    ring.rotation.x = Math.PI / 2;
    this.drone.add(ring);

    for (const x of [-0.46, 0.46]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.035), shell);
      arm.position.x = x * 0.52;
      this.drone.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.018, 20), blue);
      rotor.position.x = x;
      rotor.rotation.z = Math.PI / 2;
      rotor.name = 'rotor';
      this.drone.add(rotor);
    }

    const light = new THREE.PointLight(0x66c7f2, 2.2, 4.5, 2);
    light.position.set(0, -0.15, 0);
    this.drone.add(light);
    this.drone.visible = false;
    this.group.add(this.drone);
  }

  private updateDrone(dt: number, playerPosition: THREE.Vector3): void {
    const active = this.progress.flags.has('scanner');
    this.drone.visible = active;
    if (!active) return;

    const orbit = this.time * 0.55;
    this.droneTarget.set(
      playerPosition.x + Math.cos(orbit) * 1.25,
      2.15 + Math.sin(this.time * 1.8) * 0.12,
      playerPosition.z + Math.sin(orbit) * 1.25
    );
    this.drone.position.lerp(this.droneTarget, 1 - Math.exp(-dt * 5.5));
    this.drone.lookAt(playerPosition.x, 1.15, playerPosition.z);
    this.drone.children.forEach((child) => {
      if (child.name === 'rotor') child.rotation.x += dt * 24;
    });
  }

  private buildScanPulse(): void {
    const material = new THREE.MeshBasicMaterial({ color: 0x64d4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    this.scanRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 96), material);
    this.scanRing.rotation.x = -Math.PI / 2;
    this.scanRing.visible = false;
    this.group.add(this.scanRing);
  }

  private updateScanPulse(dt: number): void {
    if (!this.scanRing.visible) return;
    this.scanAge += dt;
    const t = Math.min(1, this.scanAge / 1.25);
    const scale = THREE.MathUtils.lerp(0.4, 22, t);
    this.scanRing.scale.setScalar(scale);
    this.scanRing.material.opacity = (1 - t) * 0.7;
    if (t >= 1) this.scanRing.visible = false;
  }

  private buildExplorationCaches(): void {
    const caches = [
      {
        id: 'v6-cache-control',
        label: 'Abrir gabinete de lecciones aprendidas',
        position: new THREE.Vector3(7.2, 0, -4.6),
        color: '#66C7F2',
        item: { id: 'lesson-card', title: 'Lección aprendida · Proyecto anterior', category: 'evidence', description: 'Un caso previo ya advertía que las revisiones documentales deben bloquear la liberación cuando no coinciden pedido, OT y material.' } as InventoryItem,
        toast: 'HALLAZGO · LECCIÓN APRENDIDA'
      },
      {
        id: 'v6-cache-warehouse',
        label: 'Abrir locker de recepción',
        position: new THREE.Vector3(-50.5, 0, 7.4),
        color: '#F4C542',
        item: { id: 'receiving-master-label', title: 'Etiqueta maestra de recepción', category: 'evidence', description: 'La etiqueta patrón confirma que revisión, lote y COA deben verificarse como una sola condición de liberación.' } as InventoryItem,
        toast: 'HALLAZGO · ETIQUETA MAESTRA'
      },
      {
        id: 'v6-cache-production',
        label: 'Abrir gabinete de primera pieza',
        position: new THREE.Vector3(-18.5, 0, -40.5),
        color: '#55B985',
        item: { id: 'first-piece-record', title: 'Registro de primera pieza', category: 'document', description: 'El control de primera pieza sólo es válido si los interlocks y la configuración del proceso quedaron satisfechos antes del arranque.' } as InventoryItem,
        toast: 'HALLAZGO · PRIMERA PIEZA'
      },
      {
        id: 'v6-cache-quality',
        label: 'Abrir cajón metrológico',
        position: new THREE.Vector3(39.5, 0, -16.2),
        color: '#8DB8FF',
        item: { id: 'master-certificate', title: 'Certificado del patrón maestro', category: 'document', description: 'El valor nominal y la tolerancia sólo son defendibles cuando el patrón conserva trazabilidad metrológica vigente.' } as InventoryItem,
        toast: 'HALLAZGO · CERTIFICADO'
      },
      {
        id: 'v6-cache-maintenance',
        label: 'Abrir estación LOTO auxiliar',
        position: new THREE.Vector3(50.3, 0, 20.8),
        color: '#E8984A',
        item: { id: 'loto-backup-lock', title: 'Candado LOTO de respaldo', category: 'tool', description: 'La barrera física evita que la energía sea restablecida mientras la intervención siga abierta.' } as InventoryItem,
        toast: 'HALLAZGO · CONTROL DE ENERGÍA'
      }
    ];

    for (const cache of caches) {
      const object = this.makeIndustrialCache(cache.position, cache.color);
      const lid = object.userData.lid as THREE.Object3D;
      const animation: CabinetAnimation = { lid, target: 0, current: 0 };
      this.cabinetAnimations.push(animation);

      const interactable: PremiumInteractable = {
        id: cache.id,
        label: cache.label,
        object,
        radius: 2.35,
        opened: this.progress.flags.has(cache.id),
        onInteract: async () => {
          if (interactable.opened) return;
          interactable.opened = true;
          this.progress.flags.add(cache.id);
          this.progress.evidence.add(cache.item.id);
          this.progress.inventory.set(cache.item.id, cache.item);
          this.progress.score += 90;
          animation.target = -1.22;
          this.audio.success();
          this.ui.showToast(cache.toast, `${cache.item.title} añadido al expediente. +90 puntos de exploración.`, 'success');
          this.refreshHud();
          this.checkExplorationBonus();
        }
      };
      if (interactable.opened) animation.target = -1.22;
      this.interactables.push(interactable);
    }
  }

  private makeIndustrialCache(position: THREE.Vector3, accent: string): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(position);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x253842, roughness: 0.48, metalness: 0.62 });
    const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.35, metalness: 0.25, emissive: new THREE.Color(accent), emissiveIntensity: 0.08 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x10191f, roughness: 0.6, metalness: 0.38 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.68, 0.82), bodyMat);
    base.position.y = 0.38;
    base.castShadow = base.receiveShadow = true;
    group.add(base);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.10, 0.04), accentMat);
    stripe.position.set(0, 0.47, -0.43);
    group.add(stripe);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.72, 0.39);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 0.86), bodyMat);
    lid.position.set(0, 0, -0.39);
    lid.castShadow = true;
    lidPivot.add(lid);
    group.add(lidPivot);

    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.09), dark);
    lock.position.set(0, 0.67, -0.47);
    group.add(lock);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), accentMat);
    beacon.position.set(0.52, 0.83, 0.28);
    group.add(beacon);

    group.userData.lid = lidPivot;
    group.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    this.group.add(group);
    return group;
  }

  private updateCabinets(dt: number): void {
    for (const animation of this.cabinetAnimations) {
      animation.current = THREE.MathUtils.damp(animation.current, animation.target, 7.5, dt);
      animation.lid.rotation.x = animation.current;
    }
  }

  private checkExplorationBonus(): void {
    const opened = this.interactables.filter((item) => item.opened).length;
    if (opened !== this.interactables.length || this.progress.flags.has('v6-explorer-bonus')) return;
    this.progress.flags.add('v6-explorer-bonus');
    this.progress.score += 400;
    this.progress.inventory.set('v6-systemic-explorer', {
      id: 'v6-systemic-explorer',
      title: 'Sello · Explorador Sistémico',
      category: 'key',
      description: 'Encontraste evidencia secundaria en todas las áreas y conectaste señales que no formaban parte del camino mínimo.'
    });
    this.audio.success();
    this.ui.showToast('EXPLORACIÓN COMPLETA', 'Encontraste los 5 hallazgos opcionales. Sello Explorador Sistémico obtenido. +400 puntos.', 'success');
  }

  private refreshHud(): void {
    const opened = this.interactables.filter((item) => item.opened).length;
    const count = this.hud.querySelector('.v6-secrets b');
    if (count) count.textContent = String(opened);
  }

  private flashInteractable(object: THREE.Object3D): void {
    const original: Array<[THREE.MeshStandardMaterial, THREE.Color, number]> = [];
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        original.push([material, material.emissive.clone(), material.emissiveIntensity]);
        material.emissive.set(0x53d8ff);
        material.emissiveIntensity = 1.4;
      }
    });
    window.setTimeout(() => {
      original.forEach(([material, emissive, intensity]) => {
        material.emissive.copy(emissive);
        material.emissiveIntensity = intensity;
      });
    }, 900);
  }

  private buildEnvironmentalVfx(): void {
    this.makeSteamEmitter(new THREE.Vector3(-13, 1.2, -30), 4.5);
    this.makeSteamEmitter(new THREE.Vector3(-2, 1.0, -31.5), 3.7);
    this.makeSteamEmitter(new THREE.Vector3(49, 1.0, 14.5), 4.2);

    // Warm interior pools help each operational zone read as a destination at a distance.
    const zones: Array<[number, number, number, number]> = [
      [-38, 10, 0xf4c542, 18],
      [-8, -36, 0x55b985, 19],
      [32, -22, 0x8db8ff, 17],
      [42, 18, 0xe8984a, 16],
      [4, 38, 0xffb36b, 17],
      [43, 43, 0xa98ae0, 16]
    ];
    for (const [x, z, color, distance] of zones) {
      const light = new THREE.PointLight(color, 1.1, distance, 2);
      light.position.set(x, 4.8, z);
      this.group.add(light);
    }
  }

  private makeSteamEmitter(origin: THREE.Vector3, height: number): void {
    const count = 28;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.35;
      positions[i * 3 + 1] = origin.y + Math.random() * height;
      positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.35;
      velocities[i] = 0.35 + Math.random() * 0.45;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xdde8ea, size: 0.24, transparent: true, opacity: 0.18, depthWrite: false, sizeAttenuation: true });
    const points = new THREE.Points(geometry, material);
    this.group.add(points);
    this.steam.push({ points, velocities, origin: origin.clone(), height });
  }

  private updateSteam(dt: number): void {
    for (const emitter of this.steam) {
      const attribute = emitter.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attribute.count; i++) {
        let y = attribute.getY(i) + emitter.velocities[i] * dt;
        let x = attribute.getX(i) + Math.sin(this.time * 0.8 + i) * dt * 0.025;
        if (y > emitter.origin.y + emitter.height) {
          y = emitter.origin.y;
          x = emitter.origin.x + (Math.random() - 0.5) * 0.28;
          attribute.setZ(i, emitter.origin.z + (Math.random() - 0.5) * 0.28);
        }
        attribute.setX(i, x);
        attribute.setY(i, y);
      }
      attribute.needsUpdate = true;
    }
  }

  private buildPremiumLandmarks(): void {
    this.makeZoneTotem(-38, 10, '#F4C542', 'A');
    this.makeZoneTotem(-8, -36, '#55B985', 'P');
    this.makeZoneTotem(32, -22, '#8DB8FF', 'Q');
    this.makeZoneTotem(42, 18, '#E8984A', 'M');
    this.makeZoneTotem(4, 38, '#FFB36B', 'D');
    this.makeZoneTotem(43, 43, '#A98AE0', 'C');

    const heroSign = new THREE.Group();
    heroSign.position.set(0, 0, -11.2);
    const steel = new THREE.MeshStandardMaterial({ color: 0x20313b, roughness: 0.4, metalness: 0.52 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x0b5ea8, roughness: 0.3, metalness: 0.32, emissive: 0x0b5ea8, emissiveIntensity: 0.15 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf4c542, roughness: 0.32, metalness: 0.2, emissive: 0xf4c542, emissiveIntensity: 0.12 });
    const pillarA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.5, 0.22), steel);
    const pillarB = pillarA.clone();
    pillarA.position.set(-3.8, 2.25, 0);
    pillarB.position.set(3.8, 2.25, 0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.35, 0.28), blue);
    bar.position.set(0, 4.2, 0);
    const accent = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.13, 0.34), yellow);
    accent.position.set(0, 3.85, 0);
    heroSign.add(pillarA, pillarB, bar, accent);
    heroSign.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    this.group.add(heroSign);
  }

  private makeZoneTotem(x: number, z: number, color: string, glyph: string): void {
    const group = new THREE.Group();
    group.position.set(x + 7.8, 0, z - 7.8);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.34, metalness: 0.25, emissive: new THREE.Color(color), emissiveIntensity: 0.18 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a2a33, roughness: 0.46, metalness: 0.45 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.2, 12), dark);
    mast.position.y = 2.1;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 8, 28), mat);
    halo.position.y = 4.25;
    halo.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
    core.position.y = 4.25;
    group.add(mast, halo, core);
    group.userData.glyph = glyph;
    this.group.add(group);
  }

  private async loadLogisticsAssets(): Promise<void> {
    const specs: AssetPlacement[] = [
      {
        url: `${RACING_BASE}vehicle-truck-yellow.glb`,
        position: new THREE.Vector3(-48, 0.03, 26.5),
        rotationY: Math.PI / 2,
        targetMaxSize: 5.8,
        roughness: 0.5,
        metalness: 0.18,
        name: 'ei-logistics-truck-west'
      },
      {
        url: `${RACING_BASE}vehicle-truck-green.glb`,
        position: new THREE.Vector3(15.5, 0.03, 46.5),
        rotationY: Math.PI,
        targetMaxSize: 5.6,
        tint: '#0B5EA8',
        roughness: 0.5,
        metalness: 0.18,
        name: 'ei-logistics-truck-dispatch'
      },
      {
        url: `${RACING_BASE}decoration-forest.glb`,
        position: new THREE.Vector3(-72, -0.1, -38),
        rotationY: 0.8,
        targetMaxSize: 24,
        roughness: 0.94,
        name: 'campus-distant-greenbelt'
      }
    ];
    await this.assets.placeMany(this.group, specs);
  }
}
