import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { DEFAULT_CARRY_CONFIG } from '../../src/v8/gameplay/GameplayComponents';
import { CarryGripConstraint } from '../../src/v8/gameplay/CarryGripConstraint';

describe('V9 rebuilt carry presentation', () => {
  it('defines the neutral load in front of the actor and on the centre line', () => {
    assert.equal(DEFAULT_CARRY_CONFIG.positionOffset[0], 0);
    assert.ok(DEFAULT_CARRY_CONFIG.positionOffset[1] >= 1.0);
    assert.ok(DEFAULT_CARRY_CONFIG.positionOffset[1] <= 1.3);
    assert.ok(DEFAULT_CARRY_CONFIG.positionOffset[2] > 0.4);
  });

  it('never lets hand correction push a carried box sideways or behind the carry plane', () => {
    const scene = new THREE.Group();
    const player = new THREE.Group();
    player.name = 'V9_PLAYER';
    const visual = new THREE.Group();
    visual.name = 'V9_HERO_KAYKIT_ENGINEER';
    player.add(visual);
    scene.add(player);

    const leftHand = new THREE.Group();
    leftHand.name = 'hand.l';
    leftHand.position.set(-0.58, 1.28, 0.34);
    const rightHand = new THREE.Group();
    rightHand.name = 'hand.r';
    rightHand.position.set(0.18, 1.28, 0.34);
    visual.add(leftHand, rightHand);

    const anchor = new THREE.Group();
    anchor.name = 'V9_CARRY_ANCHOR';
    anchor.position.set(0, 1.14, 0.54);
    anchor.userData.state = 'CARRY_IDLE';
    anchor.userData.restPosition = [0, 1.14, 0.54];
    visual.add(anchor);

    const leftGrip = new THREE.Group();
    leftGrip.name = 'V9_LEFT_HAND_GRIP';
    leftGrip.position.set(-0.30, 0.02, 0.02);
    const rightGrip = new THREE.Group();
    rightGrip.name = 'V9_RIGHT_HAND_GRIP';
    rightGrip.position.set(0.30, 0.02, 0.02);
    const crate = new THREE.Group();
    crate.userData.carried = true;
    anchor.add(leftGrip, rightGrip, crate);

    const constraint = new CarryGripConstraint();
    for (let i = 0; i < 60; i++) constraint.update(scene, 1 / 60);

    assert.ok(Math.abs(anchor.position.x) < 1e-6, `carry drifted sideways: ${anchor.position.x}`);
    assert.ok(anchor.position.z >= 0.46, `carry moved behind safe plane: ${anchor.position.z}`);
    assert.ok(anchor.position.z <= 0.62, `carry moved too far forward: ${anchor.position.z}`);
    constraint.reset();
  });
});
