import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { CARRY_FEEL, samplePickupLift } from '../../src/v8/gameplay/CarryMotion';
import { DEFAULT_CARRY_CONFIG } from '../../src/v8/gameplay/GameplayComponents';
import { CarryGripConstraint } from '../../src/v8/gameplay/CarryGripConstraint';

describe('V9 rebuilt carry presentation', () => {
  it('defines the neutral load in front of the actor and on the centre line', () => {
    assert.equal(DEFAULT_CARRY_CONFIG.positionOffset[0], 0);
    assert.ok(DEFAULT_CARRY_CONFIG.positionOffset[1] >= 0.98);
    assert.ok(DEFAULT_CARRY_CONFIG.positionOffset[1] <= 1.18);
    assert.ok(DEFAULT_CARRY_CONFIG.positionOffset[2] > 0.4);
    assert.ok(DEFAULT_CARRY_CONFIG.positionOffset[2] < 0.58);
  });

  it('gives medium and heavy loads more deliberate pickup timing than light loads', () => {
    assert.ok(CARRY_FEEL.MEDIUM.pickupTimeScale < CARRY_FEEL.LIGHT.pickupTimeScale);
    assert.ok(CARRY_FEEL.HEAVY.pickupTimeScale < CARRY_FEEL.MEDIUM.pickupTimeScale);
    assert.ok(CARRY_FEEL.MEDIUM.attachMarker >= CARRY_FEEL.LIGHT.attachMarker);
    assert.ok(CARRY_FEEL.HEAVY.attachMarker >= CARRY_FEEL.MEDIUM.attachMarker);
  });

  it('lifts vertically before fully securing the load toward the torso', () => {
    const from = new THREE.Vector3(0, -0.90, 0.68);
    const to = new THREE.Vector3(0, 0, 0);
    const start = samplePickupLift(from, to, 0, CARRY_FEEL.MEDIUM.liftArc);
    const early = samplePickupLift(from, to, 0.22, CARRY_FEEL.MEDIUM.liftArc);
    const end = samplePickupLift(from, to, 1, CARRY_FEEL.MEDIUM.liftArc);

    assert.ok(start.distanceTo(from) < 1e-9, 'lift must begin at the real contact pose');
    const verticalProgress = (early.y - from.y) / (to.y - from.y);
    const depthProgress = (from.z - early.z) / (from.z - to.z);
    assert.ok(verticalProgress > depthProgress, `expected height to lead depth (${verticalProgress} vs ${depthProgress})`);
    assert.ok(end.distanceTo(to) < 1e-9, 'lift must finish exactly at the carry socket');
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
    anchor.position.set(0, 1.04, 0.49);
    anchor.userData.state = 'CARRY_IDLE';
    anchor.userData.weightClass = 'MEDIUM';
    anchor.userData.restPosition = [0, 1.04, 0.49];
    visual.add(anchor);

    const leftGrip = new THREE.Group();
    leftGrip.name = 'V9_LEFT_HAND_GRIP';
    leftGrip.position.set(-0.30, -0.08, -0.06);
    const rightGrip = new THREE.Group();
    rightGrip.name = 'V9_RIGHT_HAND_GRIP';
    rightGrip.position.set(0.30, -0.08, -0.06);
    const crate = new THREE.Group();
    crate.userData.carried = true;
    anchor.add(leftGrip, rightGrip, crate);

    const constraint = new CarryGripConstraint();
    for (let i = 0; i < 90; i++) constraint.update(scene, 1 / 60);

    assert.ok(Math.abs(anchor.position.x) < 1e-6, `carry drifted sideways: ${anchor.position.x}`);
    assert.ok(anchor.position.z >= 0.44, `carry moved behind safe plane: ${anchor.position.z}`);
    assert.ok(anchor.position.z <= 0.54, `carry moved too far forward: ${anchor.position.z}`);
    constraint.reset();
  });
});
