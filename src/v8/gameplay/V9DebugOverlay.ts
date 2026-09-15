import * as THREE from 'three';
import type { WorldObjectDefinition } from '../types';
import type { DoorComponent } from './DoorComponent';

interface Marker {
  mesh: THREE.Mesh;
  source: THREE.Object3D;
}

interface LabelEntry {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  text: string;
  source: THREE.Object3D;
  definition?: WorldObjectDefinition;
}

/** Supplemental V9 F3 overlay. V8 collider/radius overlay remains active too. */
export class V9DebugOverlay {
  readonly group = new THREE.Group();
  private enabled = false;
  private readonly pointGeometry = new THREE.SphereGeometry(0.085, 10, 8);
  private readonly pivotMaterial = new THREE.MeshBasicMaterial({ color: 0xff66cc, depthTest: false });
  private readonly interactionMaterial = new THREE.MeshBasicMaterial({ color: 0x33ddff, depthTest: false });
  private readonly anchorMaterial = new THREE.MeshBasicMaterial({ color: 0x65ff7a, depthTest: false });
  private readonly gripMaterial = new THREE.MeshBasicMaterial({ color: 0xffd84a, depthTest: false });
  private readonly markers = new Map<string, Marker>();
  private readonly labels = new Map<string, LabelEntry>();
  private readonly playerHitbox = this.makeRing(2.15, 0xffa63d);
  private readonly playerHurtbox = this.makeRing(0.42, 0x7cffb2);
  private readonly temp = new THREE.Vector3();

  constructor() {
    this.group.name = 'V9_PROFESSIONAL_DEBUG';
    this.group.visible = false;
    this.group.renderOrder = 1000;
    this.playerHitbox.name = 'V9_ATTACK_HITBOX';
    this.playerHurtbox.name = 'V9_PLAYER_HURTBOX';
    this.group.add(this.playerHitbox, this.playerHurtbox);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  update(sceneRoot: THREE.Object3D, objects: WorldObjectDefinition[], doors: readonly DoorComponent[]): void {
    if (!this.enabled) return;
    const activeMarkers = new Set<string>();
    const activeLabels = new Set<string>();

    for (const door of doors) {
      this.syncMarker(`door-pivot:${door.debugState().id}`, door.pivot, this.pivotMaterial, activeMarkers);
      this.syncMarker(`door-interaction:${door.debugState().id}`, door.interactionPoint, this.interactionMaterial, activeMarkers);
    }

    const player = sceneRoot.getObjectByName('V9_PLAYER');
    if (player) {
      player.getWorldPosition(this.temp);
      this.playerHitbox.position.set(this.temp.x, 0.045, this.temp.z);
      this.playerHurtbox.position.set(this.temp.x, 0.042, this.temp.z);
      const anchor = player.getObjectByName('V9_CARRY_ANCHOR');
      const leftGrip = player.getObjectByName('V9_LEFT_HAND_GRIP');
      const rightGrip = player.getObjectByName('V9_RIGHT_HAND_GRIP');
      if (anchor) this.syncMarker('player-carry-anchor', anchor, this.anchorMaterial, activeMarkers);
      if (leftGrip) this.syncMarker('player-left-grip', leftGrip, this.gripMaterial, activeMarkers);
      if (rightGrip) this.syncMarker('player-right-grip', rightGrip, this.gripMaterial, activeMarkers);
    }

    for (const entry of objects) {
      if (entry.enabled === false || !entry.object.visible) continue;
      if (!['door', 'carryable', 'movable', 'breakable', 'container', 'puzzle'].includes(entry.kind)) continue;
      const state = String(entry.object.userData.objectState ?? entry.state?.doorState ?? entry.state?.damageState ?? (entry.state?.active ? 'ACTIVE' : 'READY'));
      const physics = String(entry.object.userData.physicsBodyType ?? entry.bodyType ?? 'STATIC');
      const weight = String(entry.object.userData.weightClass ?? entry.carryConfig?.weightClass ?? '-');
      const health = entry.health !== undefined ? `\nHP: ${entry.health}/${entry.maxHealth ?? entry.health}` : '';
      const text = `${entry.id}\nState: ${state}\nPhysics: ${physics}\nWeight: ${weight}${health}`;
      this.syncLabel(`label:${entry.id}`, entry.object, text, entry, activeLabels);
    }

    for (const [key, marker] of this.markers) marker.mesh.visible = activeMarkers.has(key);
    for (const [key, label] of this.labels) label.sprite.visible = activeLabels.has(key);
  }

  dispose(): void {
    this.pointGeometry.dispose();
    this.pivotMaterial.dispose();
    this.interactionMaterial.dispose();
    this.anchorMaterial.dispose();
    this.gripMaterial.dispose();
    (this.playerHitbox.geometry as THREE.BufferGeometry).dispose();
    (this.playerHitbox.material as THREE.Material).dispose();
    (this.playerHurtbox.geometry as THREE.BufferGeometry).dispose();
    (this.playerHurtbox.material as THREE.Material).dispose();
    for (const label of this.labels.values()) {
      label.texture.dispose();
      (label.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.markers.clear();
    this.labels.clear();
    this.group.clear();
  }

  private syncMarker(key: string, source: THREE.Object3D, material: THREE.Material, active: Set<string>): void {
    active.add(key);
    let marker = this.markers.get(key);
    if (!marker) {
      const mesh = new THREE.Mesh(this.pointGeometry, material);
      mesh.renderOrder = 1001;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      marker = { mesh, source };
      this.markers.set(key, marker);
    }
    source.getWorldPosition(marker.mesh.position);
    marker.mesh.visible = true;
  }

  private syncLabel(key: string, source: THREE.Object3D, text: string, definition: WorldObjectDefinition, active: Set<string>): void {
    active.add(key);
    let label = this.labels.get(key);
    if (!label) {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 164;
      const context = canvas.getContext('2d')!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(3.2, 1.46, 1);
      sprite.renderOrder = 1002;
      this.group.add(sprite);
      label = { sprite, canvas, context, texture, text: '', source, definition };
      this.labels.set(key, label);
    }
    source.getWorldPosition(label.sprite.position);
    label.sprite.position.y += 1.65;
    label.sprite.visible = true;
    if (label.text !== text) {
      label.text = text;
      this.drawLabel(label, text);
    }
  }

  private drawLabel(label: LabelEntry, text: string): void {
    const ctx = label.context;
    ctx.clearRect(0, 0, label.canvas.width, label.canvas.height);
    ctx.fillStyle = 'rgba(7,18,24,0.90)';
    ctx.fillRect(0, 0, label.canvas.width, label.canvas.height);
    ctx.strokeStyle = '#7fd9ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, label.canvas.width - 4, label.canvas.height - 4);
    ctx.font = 'bold 22px monospace';
    ctx.textBaseline = 'top';
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      ctx.fillStyle = index === 0 ? '#f3c83f' : '#d9f5ff';
      ctx.fillText(line, 14, 12 + index * 28);
    });
    label.texture.needsUpdate = true;
  }

  private makeRing(radius: number, color: number): THREE.Mesh {
    const geometry = new THREE.RingGeometry(radius - 0.025, radius + 0.025, 48);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthTest: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1000;
    return mesh;
  }
}
