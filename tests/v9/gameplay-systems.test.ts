import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { RiggedHeroAnimator } from '../../src/v8/characters/RiggedHeroAnimator';
import { DamageSystem } from '../../src/v8/gameplay/DamageSystem';
import { DoorComponent } from '../../src/v8/gameplay/DoorComponent';
import { DEFAULT_CARRY_CONFIG, WEIGHT_PROFILES } from '../../src/v8/gameplay/GameplayComponents';
import { KinematicPhysicsWorld } from '../../src/v8/gameplay/KinematicPhysicsWorld';
import type { Collider, WorldObjectDefinition } from '../../src/v8/types';
import { WorldObjectRegistry } from '../../src/v8/world/WorldObjectRegistry';

describe('V9 professional gameplay contracts', () => {
  it('keeps weight classes ordered and heavy objects non-throwable', () => {
    assert.ok(WEIGHT_PROFILES.LIGHT.moveSpeed > WEIGHT_PROFILES.MEDIUM.moveSpeed);
    assert.ok(WEIGHT_PROFILES.MEDIUM.moveSpeed > WEIGHT_PROFILES.HEAVY.moveSpeed);
    assert.ok(WEIGHT_PROFILES.LIGHT.acceleration > WEIGHT_PROFILES.HEAVY.acceleration);
    assert.equal(WEIGHT_PROFILES.HEAVY.throwMultiplier, 0);
    assert.ok((DEFAULT_CARRY_CONFIG.attachNormalizedTime ?? 0) > 0);
    assert.ok((DEFAULT_CARRY_CONFIG.attachNormalizedTime ?? 1) < 1);
  });

  it('launches a dynamic carryable with gravity without tunnelling through a wall', () => {
    const wall: Collider = {
      id: 'wall', minX: 2, maxX: 2.25, minZ: -2, maxZ: 2, enabled: true
    };
    const colliders: Collider[] = [wall];
    const physics = new KinematicPhysicsWorld(colliders);
    const crate = new THREE.Group();
    crate.position.set(0, 0, 0);
    physics.register({
      id: 'crate', object: crate, bodyType: 'DYNAMIC', halfExtents: [0.5, 0.5, 0.5],
      mass: 1, restitution: 0.08, friction: 0.84
    });

    assert.equal(physics.launch('crate', new THREE.Vector3(10, 3.2, 0)), true);
    for (let i = 0; i < 120; i++) physics.step(1 / 60);

    assert.ok(crate.position.x <= 1.502, `crate crossed wall: x=${crate.position.x}`);
    assert.ok(crate.position.y >= 0);
    assert.equal(physics.get('crate')?.bodyType, 'DYNAMIC');
  });

  it('rotates a door from its hinge, moves the collider with the leaf and rejects spam', () => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    root.add(pivot);
    const collider: Collider = {
      id: 'door-col', minX: 0, maxX: 2, minZ: -0.1, maxZ: 0.1, enabled: true
    };
    const entry: WorldObjectDefinition = {
      id: 'door', kind: 'door', label: 'Test door', object: root, colliderId: collider.id, state: {}
    };
    const door = new DoorComponent({
      id: 'door', entry, collider, pivot, root,
      closedAngle: 0, openAngle: -Math.PI / 2, duration: 0.5,
      leafWidth: 2, leafThickness: 0.2, hingeSide: 'left'
    });

    const closedWidth = collider.maxX - collider.minX;
    const closedDepth = collider.maxZ - collider.minZ;
    assert.equal(door.toggle(), true);
    assert.equal(door.toggle(), false, 'door accepted interaction spam while opening');
    for (let i = 0; i < 40; i++) door.update(1 / 60);

    const openWidth = collider.maxX - collider.minX;
    const openDepth = collider.maxZ - collider.minZ;
    assert.equal(door.state, 'OPEN');
    assert.ok(closedWidth > closedDepth);
    assert.ok(openDepth > openWidth, `open collider did not follow rotated leaf: ${openWidth}x${openDepth}`);
    assert.equal(collider.enabled, true, 'open leaf should remain solid only where the visual leaf exists');
  });

  it('keeps ordinary objects visible and gives breakables a visible damage/break sequence', () => {
    const registry = new WorldObjectRegistry();
    const effects = new THREE.Group();
    const colliders: Collider[] = [];
    const damage = new DamageSystem(registry, colliders, effects);

    const staticObject = new THREE.Group();
    staticObject.position.set(0, 0, 1.1);
    registry.register({ id: 'table', kind: 'interactable', label: 'Table', object: staticObject, category: 'STATIC' });

    const target = new THREE.Group();
    target.position.set(0, 0, 1.4);
    const targetCollider: Collider = { id: 'target-col', minX: -0.4, maxX: 0.4, minZ: 1.2, maxZ: 1.6, enabled: true };
    colliders.push(targetCollider);
    registry.register({
      id: 'target', kind: 'breakable', label: 'Wood target', object: target,
      colliderId: targetCollider.id, health: 2, maxHealth: 2,
      damage: { category: 'BREAKABLE', material: 'WOOD', health: 2, maxHealth: 2, breakDelay: 0.5 }
    });

    const origin = new THREE.Vector3(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, 1);
    damage.attack(origin, forward);
    assert.equal(registry.get('target')?.health, 1);
    assert.equal(target.visible, true);
    assert.equal(staticObject.visible, true);

    const second = damage.attack(origin, forward);
    assert.deepEqual(second.destroyedIds, ['target']);
    assert.equal(target.visible, true, 'breakable vanished on the impact frame');
    assert.equal(registry.get('target')?.state?.damageState, 'BREAKING');

    damage.update(0.22);
    assert.equal(target.visible, true);
    damage.update(0.32);
    assert.equal(target.visible, false);
    assert.equal(targetCollider.enabled, false);
    assert.equal(staticObject.visible, true, 'ordinary object was removed by combat');
    damage.dispose();
  });

  it('fires combat gameplay on an AnimationMixer marker instead of the input frame', () => {
    const root = new THREE.Group();
    const clip = (name: string, duration = 1) => new THREE.AnimationClip(name, duration, []);
    const animator = new RiggedHeroAnimator(root, {
      idle: clip('Idle'), walk: clip('Walk'), run: clip('Run'), attack: clip('Attack')
    });
    let impacts = 0;
    assert.equal(animator.playAttack({ marker: 0.35, onMarker: () => impacts++ }), true);
    assert.equal(impacts, 0);
    animator.update(0.20);
    assert.equal(impacts, 0);
    animator.update(0.16);
    assert.equal(impacts, 1);
    animator.update(0.20);
    assert.equal(impacts, 1, 'marker fired more than once');
    animator.dispose();
  });
});
