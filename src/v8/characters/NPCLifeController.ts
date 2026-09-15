import * as THREE from 'three';
import { CharacterFactory, type CharacterModel, type CharacterRole } from '../visual/CharacterFactory';
import { RiggedStaffCharacter, type RiggedStaffAsset, type RiggedStaffStyle } from './RiggedStaffCharacter';

type Gesture = 'none' | 'explain' | 'point' | 'radio' | 'inspect' | 'tablet';

interface Agent {
  id: string;
  anchor: THREE.Object3D;
  model: CharacterModel;
  role: CharacterRole;
  phase: number;
  blinkTimer: number;
  blinkLeft: number;
  gesture: Gesture;
  gestureTime: number;
  nextGesture: number;
  focus: boolean;
  baseYaw: number;
  attention: number;
  rigged?: RiggedStaffAsset;
  riggedActionUntil: number;
}

/**
 * NPC life system. Procedural actors are immediate fallbacks; each registered
 * staff member is then promoted to a cached skeletal actor with real clips.
 */
export class NPCLifeController {
  private static readonly CANONICAL_CHARACTER_SCALE = 0.94;
  private readonly factory = new CharacterFactory();
  private readonly riggedFactory = new RiggedStaffCharacter();
  private readonly agents: Agent[] = [];
  private clock = 0;
  private readonly playerWorld = new THREE.Vector3();
  private readonly npcWorld = new THREE.Vector3();

  register(id: string, anchor: THREE.Object3D, model: CharacterModel, role: CharacterRole, phase = 0): void {
    model.root.userData.npcId = id;
    model.root.scale.setScalar(NPCLifeController.CANONICAL_CHARACTER_SCALE);
    const agent: Agent = {
      id,
      anchor,
      model,
      role,
      phase,
      blinkTimer: 1.6 + this.seed(id, 0.9) * 2.4,
      blinkLeft: 0,
      gesture: 'none',
      gestureTime: 0,
      nextGesture: 2.5 + this.seed(id, 1.7) * 4.0,
      focus: false,
      baseYaw: model.visual.rotation.y,
      attention: 0,
      riggedActionUntil: 0
    };
    this.agents.push(agent);
    void this.promoteToRigged(agent);
  }

  setFocus(id: string, active: boolean): void {
    const agent = this.agents.find((entry) => entry.id === id);
    if (!agent) return;
    agent.focus = active;
    if (active) {
      agent.nextGesture = 0.18;
      agent.gesture = 'none';
      agent.gestureTime = 0;
      if (agent.rigged) this.playRiggedGesture(agent, true);
    }
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.clock += dt;
    this.resolvePlayerPosition(playerPosition);

    for (const agent of this.agents) {
      if (agent.rigged) {
        this.updateRigged(agent, dt);
      } else {
        this.factory.animateIdle(agent.model, this.clock, agent.phase);
        this.updateBlink(agent, dt);
        this.updateAttentionProcedural(agent, dt);
        this.updateGestureProcedural(agent, dt);
        this.updateWeightShift(agent);
      }
    }
  }

  private async promoteToRigged(agent: Agent): Promise<void> {
    try {
      const rigged = await this.riggedFactory.load(this.styleFor(agent));
      if (!agent.anchor.parent) return;

      // Canonical scale: protagonist and every rigged NPC share the same world size.
      rigged.visual.scale.setScalar(NPCLifeController.CANONICAL_CHARACTER_SCALE);
      rigged.root.userData.canonicalScale = NPCLifeController.CANONICAL_CHARACTER_SCALE;

      agent.anchor.remove(agent.model.root);
      agent.anchor.add(rigged.root);
      agent.rigged = rigged;
      agent.baseYaw = 0;
      agent.anchor.userData.riggedNPC = true;
      agent.anchor.userData.npcId = agent.id;
    } catch (error) {
      console.warn(`[V8] Rigged NPC unavailable for ${agent.id}; using procedural fallback.`, error);
    }
  }

  private updateRigged(agent: Agent, dt: number): void {
    const rigged = agent.rigged!;
    rigged.mixer.update(dt);

    agent.anchor.getWorldPosition(this.npcWorld);
    const dx = this.playerWorld.x - this.npcWorld.x;
    const dz = this.playerWorld.z - this.npcWorld.z;
    const distance = Math.hypot(dx, dz);
    const shouldAttend = agent.focus || distance < 6.8;
    agent.attention = THREE.MathUtils.damp(agent.attention, shouldAttend ? 1 : 0, 5.0, dt);

    const worldTargetYaw = shouldAttend ? Math.atan2(dx, dz) : agent.baseYaw;
    const bodyBlend = agent.focus || distance < 3.9 ? 0.9 : 0.34;
    const targetYaw = this.mixAngle(agent.baseYaw, worldTargetYaw, bodyBlend * agent.attention);
    rigged.root.rotation.y = this.dampAngle(rigged.root.rotation.y, targetYaw, 5.6, dt);

    if (rigged.head) {
      const relative = this.wrapAngle(worldTargetYaw - rigged.root.rotation.y);
      const yaw = THREE.MathUtils.clamp(relative, -0.42, 0.42) * agent.attention;
      rigged.head.rotation.y += (yaw - rigged.head.rotation.y) * (1 - Math.exp(-dt * 7.2));
      if (agent.focus) rigged.head.rotation.x += (-0.015 - rigged.head.rotation.x) * (1 - Math.exp(-dt * 5.5));
    }

    agent.nextGesture -= dt;
    if (this.clock >= agent.riggedActionUntil && agent.nextGesture <= 0) {
      this.playRiggedGesture(agent, agent.focus);
      agent.nextGesture = (agent.focus ? 1.9 : 4.1) + this.seed(agent.id, this.clock * 0.57) * (agent.focus ? 1.8 : 4.4);
    }
  }

  private playRiggedGesture(agent: Agent, dialogue: boolean): void {
    const rigged = agent.rigged;
    if (!rigged) return;
    const seed = this.seed(agent.id, this.clock + agent.phase);
    const action = (dialogue || seed < 0.58 ? rigged.interact : rigged.useItem) ?? rigged.interact ?? rigged.useItem;
    if (!action) return;

    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(dialogue ? 0.88 : 0.76 + seed * 0.24);
    action.crossFadeFrom(rigged.idle, 0.18, true);
    action.play();
    const duration = Math.max(0.7, action.getClip().duration / action.getEffectiveTimeScale());
    agent.riggedActionUntil = this.clock + duration;

    window.setTimeout(() => {
      if (!agent.rigged || agent.rigged !== rigged) return;
      rigged.idle.reset().play();
      rigged.idle.crossFadeFrom(action, 0.22, true);
    }, duration * 1000);
  }

  private resolvePlayerPosition(candidate: THREE.Vector3): void {
    if (candidate.lengthSq() < 100000) {
      this.playerWorld.copy(candidate);
      return;
    }

    const first = this.agents[0];
    if (!first) {
      this.playerWorld.copy(candidate);
      return;
    }

    let root: THREE.Object3D = first.anchor;
    while (root.parent) root = root.parent;
    const player = root.getObjectByName('V8_PLAYER');
    if (player) player.getWorldPosition(this.playerWorld);
    else this.playerWorld.copy(candidate);
  }

  private updateBlink(agent: Agent, dt: number): void {
    agent.blinkTimer -= dt;
    if (agent.blinkLeft > 0) {
      agent.blinkLeft -= dt;
      const closed = agent.blinkLeft > 0;
      agent.model.blinkLeft.visible = closed;
      agent.model.blinkRight.visible = closed;
      if (!closed) agent.blinkTimer = 1.8 + this.seed(agent.id, this.clock * 0.37) * 3.6;
      return;
    }

    if (agent.blinkTimer <= 0) {
      agent.blinkLeft = 0.105;
      agent.model.blinkLeft.visible = true;
      agent.model.blinkRight.visible = true;
      return;
    }

    agent.model.blinkLeft.visible = false;
    agent.model.blinkRight.visible = false;
  }

  private updateAttentionProcedural(agent: Agent, dt: number): void {
    agent.anchor.getWorldPosition(this.npcWorld);
    const dx = this.playerWorld.x - this.npcWorld.x;
    const dz = this.playerWorld.z - this.npcWorld.z;
    const distance = Math.hypot(dx, dz);
    const shouldAttend = agent.focus || distance < 6.5;
    agent.attention = THREE.MathUtils.damp(agent.attention, shouldAttend ? 1 : 0, 5.2, dt);

    const targetYaw = shouldAttend ? Math.atan2(dx, dz) : agent.baseYaw;
    const current = agent.model.visual.rotation.y;
    const bodyBlend = agent.focus || distance < 3.8 ? 0.78 : 0.28;
    const bodyTarget = this.mixAngle(agent.baseYaw, targetYaw, bodyBlend * agent.attention);
    agent.model.visual.rotation.y = this.dampAngle(current, bodyTarget, 5.8, dt);

    const relative = this.wrapAngle(targetYaw - agent.model.visual.rotation.y);
    const headYawTarget = THREE.MathUtils.clamp(relative, -0.52, 0.52) * agent.attention;
    const headPitchTarget = agent.focus ? -0.018 : Math.sin(this.clock * 0.47 + agent.phase) * 0.018;
    agent.model.rig.head.rotation.y = THREE.MathUtils.damp(agent.model.rig.head.rotation.y, headYawTarget, 7.0, dt);
    agent.model.rig.head.rotation.x = THREE.MathUtils.damp(agent.model.rig.head.rotation.x, headPitchTarget, 6.0, dt);
  }

  private updateGestureProcedural(agent: Agent, dt: number): void {
    if (agent.gesture === 'none') {
      agent.nextGesture -= dt;
      if (agent.nextGesture <= 0) {
        agent.gesture = this.pickGesture(agent);
        agent.gestureTime = 0;
        agent.nextGesture = (agent.focus ? 1.9 : 4.0) + this.seed(agent.id, this.clock * 0.61) * (agent.focus ? 1.7 : 4.0);
      }
      return;
    }

    agent.gestureTime += dt;
    const duration = agent.focus ? 1.6 : 2.0;
    const t = THREE.MathUtils.clamp(agent.gestureTime / duration, 0, 1);
    const envelope = Math.sin(Math.PI * t);
    const r = agent.model.rig;

    if (agent.gesture === 'explain') {
      r.leftShoulder.rotation.x += -0.72 * envelope;
      r.rightShoulder.rotation.x += -0.88 * envelope;
      r.leftShoulder.rotation.z += -0.24 * envelope;
      r.rightShoulder.rotation.z += 0.28 * envelope;
      r.leftElbow.rotation.x += -0.48 * envelope;
      r.rightElbow.rotation.x += -0.4 * envelope;
    } else if (agent.gesture === 'point') {
      r.rightShoulder.rotation.x += -1.12 * envelope;
      r.rightShoulder.rotation.z += 0.2 * envelope;
      r.rightElbow.rotation.x += -0.22 * envelope;
      r.head.rotation.y += 0.08 * envelope;
    } else if (agent.gesture === 'radio') {
      r.leftShoulder.rotation.x += -1.0 * envelope;
      r.leftShoulder.rotation.z += -0.18 * envelope;
      r.leftElbow.rotation.x += -1.05 * envelope;
      r.head.rotation.y += -0.08 * envelope;
    } else if (agent.gesture === 'inspect') {
      r.torso.rotation.x += 0.18 * envelope;
      r.head.rotation.x += 0.12 * envelope;
      r.rightShoulder.rotation.x += -0.55 * envelope;
      r.rightElbow.rotation.x += -0.65 * envelope;
    } else if (agent.gesture === 'tablet') {
      r.leftShoulder.rotation.x += -0.72 * envelope;
      r.leftElbow.rotation.x += -0.82 * envelope;
      r.head.rotation.x += 0.08 * envelope;
      r.head.rotation.y += -0.06 * envelope;
    }

    if (t >= 1) {
      agent.gesture = 'none';
      agent.gestureTime = 0;
    }
  }

  private updateWeightShift(agent: Agent): void {
    const t = this.clock * 0.72 + agent.phase;
    const sway = Math.sin(t) * 0.018;
    agent.model.rig.torso.rotation.z += sway;
    agent.model.rig.leftHip.rotation.z = -sway * 0.42;
    agent.model.rig.rightHip.rotation.z = -sway * 0.42;
  }

  private pickGesture(agent: Agent): Gesture {
    const seed = this.seed(agent.id, this.clock + agent.phase * 3.1);
    if (agent.focus) {
      if (seed < 0.34) return 'explain';
      if (seed < 0.58) return 'point';
      if (seed < 0.8) return agent.role === 'quality' || agent.role === 'metrology' ? 'tablet' : 'inspect';
      return 'radio';
    }

    if (agent.role === 'warehouse') return seed < 0.5 ? 'inspect' : 'radio';
    if (agent.role === 'production') return seed < 0.48 ? 'point' : 'inspect';
    if (agent.role === 'quality' || agent.role === 'metrology') return seed < 0.68 ? 'tablet' : 'inspect';
    if (agent.role === 'maintenance') return seed < 0.55 ? 'inspect' : 'radio';
    return seed < 0.5 ? 'inspect' : 'explain';
  }

  private styleFor(agent: Agent): RiggedStaffStyle {
    const presets: Record<string, Partial<RiggedStaffStyle>> = {
      'npc-laura': { accent: 0x326f8f, feminine: true, helmet: false, glasses: true, labCoat: true, tablet: true, hairColor: 0x3b2b27 },
      'npc-mateo': { accent: 0xf3c83f, helmet: true, glasses: false, hairColor: 0x2d211d },
      'npc-andres': { accent: 0x4f9b68, helmet: true, glasses: true, hairColor: 0x211d1b },
      'npc-daniela': { accent: 0x7eb7ff, feminine: true, helmet: false, glasses: true, labCoat: true, tablet: true, hairColor: 0x51372c },
      'npc-maintenance': { accent: 0xd9a928, helmet: true, glasses: true, hairColor: 0x2b2522 },
      'npc-dispatch': { accent: 0xb77042, feminine: true, helmet: true, glasses: false, tablet: true, hairColor: 0x402b26 },
      'npc-capa-lead': { accent: 0x9c7ad8, feminine: true, helmet: false, glasses: true, labCoat: false, tablet: true, hairColor: 0x342822 }
    };
    const preset = presets[agent.id] ?? {};
    return {
      id: agent.id,
      role: agent.role,
      accent: preset.accent ?? 0xf3c83f,
      feminine: preset.feminine,
      helmet: preset.helmet,
      glasses: preset.glasses,
      labCoat: preset.labCoat,
      tablet: preset.tablet,
      hairColor: preset.hairColor
    };
  }

  private seed(id: string, salt: number): number {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const value = Math.sin(hash * 0.000001 + salt * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }

  private wrapAngle(value: number): number {
    return Math.atan2(Math.sin(value), Math.cos(value));
  }

  private mixAngle(a: number, b: number, t: number): number {
    return a + this.wrapAngle(b - a) * THREE.MathUtils.clamp(t, 0, 1);
  }

  private dampAngle(current: number, target: number, lambda: number, dt: number): number {
    const delta = this.wrapAngle(target - current);
    return current + delta * (1 - Math.exp(-lambda * dt));
  }
}
