import * as THREE from 'three';
import { CharacterFactory, type CharacterModel, type CharacterRole } from '../visual/CharacterFactory';

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
}

/**
 * Lightweight behavior layer for authored NPCs.
 * Keeps ambient staff alive without navmesh/AI overhead: breathing, natural
 * blink cadence, look-at, weight shifts and contextual hand gestures.
 */
export class NPCLifeController {
  private readonly factory = new CharacterFactory();
  private readonly agents: Agent[] = [];
  private clock = 0;
  private readonly playerWorld = new THREE.Vector3();
  private readonly npcWorld = new THREE.Vector3();

  register(id: string, anchor: THREE.Object3D, model: CharacterModel, role: CharacterRole, phase = 0): void {
    model.root.userData.npcId = id;
    this.agents.push({
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
      attention: 0
    });
  }

  setFocus(id: string, active: boolean): void {
    const agent = this.agents.find((entry) => entry.id === id);
    if (!agent) return;
    agent.focus = active;
    if (active) {
      agent.nextGesture = 0.2;
      agent.gesture = 'none';
      agent.gestureTime = 0;
    }
  }

  update(dt: number, playerPosition: THREE.Vector3): void {
    this.clock += dt;
    this.playerWorld.copy(playerPosition);

    for (const agent of this.agents) {
      this.factory.animateIdle(agent.model, this.clock, agent.phase);
      this.updateBlink(agent, dt);
      this.updateAttention(agent, dt);
      this.updateGesture(agent, dt);
      this.updateWeightShift(agent);
    }
  }

  private updateBlink(agent: Agent, dt: number): void {
    agent.blinkTimer -= dt;
    if (agent.blinkLeft > 0) {
      agent.blinkLeft -= dt;
      const closed = agent.blinkLeft > 0;
      agent.model.blinkLeft.visible = closed;
      agent.model.blinkRight.visible = closed;
      if (!closed) {
        agent.blinkTimer = 1.8 + this.seed(agent.id, this.clock * 0.37) * 3.6;
      }
      return;
    }

    if (agent.blinkTimer <= 0) {
      agent.blinkLeft = 0.105;
      agent.model.blinkLeft.visible = true;
      agent.model.blinkRight.visible = true;
      return;
    }

    // CharacterFactory has a fallback sinusoidal blink; controller owns the
    // final state so the cadence looks less mechanical.
    agent.model.blinkLeft.visible = false;
    agent.model.blinkRight.visible = false;
  }

  private updateAttention(agent: Agent, dt: number): void {
    agent.anchor.getWorldPosition(this.npcWorld);
    const dx = this.playerWorld.x - this.npcWorld.x;
    const dz = this.playerWorld.z - this.npcWorld.z;
    const distance = Math.hypot(dx, dz);
    const shouldAttend = agent.focus || distance < 6.5;
    const targetAttention = shouldAttend ? 1 : 0;
    agent.attention = THREE.MathUtils.damp(agent.attention, targetAttention, 5.2, dt);

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

  private updateGesture(agent: Agent, dt: number): void {
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
