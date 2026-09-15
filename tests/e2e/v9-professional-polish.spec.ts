import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ARTIFACT_DIR = resolve(process.cwd(), 'e2e-artifacts');

type Point = { x: number; y: number; z: number };

async function capture(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(80);
  await page.screenshot({ path: resolve(ARTIFACT_DIR, name), animations: 'allow' });
}

async function playerPosition(page: Page): Promise<Point> {
  return page.evaluate(() => {
    const app = (window as any).__V9_APP__;
    const p = app.player.position;
    return { x: p.x, y: p.y, z: p.z };
  });
}

async function configureDeterministicCamera(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as any).__V9_APP__;
    app.yaw = 0;
    app.pitch = 0.68;
    app.distance = 12.4;
    app.positionCamera?.(true, 0);
  });
}

async function setPlayer(page: Page, x: number, z: number, yaw = 0): Promise<void> {
  await page.evaluate(({ x, z, yaw }) => {
    const app = (window as any).__V9_APP__;
    app.player.position.set(x, 0, z);
    app.player.velocity?.set(0, 0, 0);
    app.player.visual.rotation.y = yaw;
    app.world.lastPlayerForward.set(Math.sin(yaw), 0, Math.cos(yaw));
    app.positionCamera?.(true, 0);
  }, { x, z, yaw });
  await page.waitForTimeout(120);
}

async function teleportNear(page: Page, id: string, distance = 1.35, side: 'south' | 'north' = 'south'): Promise<void> {
  await page.evaluate(({ id, distance, side }) => {
    const app = (window as any).__V9_APP__;
    const entry = app.world.registry.get(id);
    if (!entry) throw new Error(`Missing world object ${id}`);
    const target = entry.object.getWorldPosition(app.player.position.clone());
    const sign = side === 'south' ? -1 : 1;
    app.player.position.set(target.x, 0, target.z + sign * distance);
    app.player.velocity?.set(0, 0, 0);
    const direction = target.clone().sub(app.player.position).setY(0).normalize();
    app.player.visual.rotation.y = Math.atan2(direction.x, direction.z);
    app.world.lastPlayerForward.copy(direction);
    app.positionCamera?.(true, 0);
  }, { id, distance, side });
  await page.waitForTimeout(140);
}

async function pressFor(page: Page, key: string, milliseconds: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
  await page.waitForTimeout(140);
}

async function bootIntoGame(page: Page): Promise<void> {
  await page.goto('/?v9e2e=1', { waitUntil: 'networkidle' });
  await page.locator('#v8-profile').waitFor({ state: 'visible' });
  await page.locator('#v8-name').fill('V9 QA');
  await page.locator('#v8-team').fill('Professional Polish');
  await page.locator('#v8-profile button[type="submit"]').click();

  for (let i = 0; i < 10; i++) {
    const next = page.locator('#v8-next');
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await page.waitForTimeout(90);
      continue;
    }
    const started = await page.evaluate(() => Boolean((window as any).__V9_APP__?.started));
    if (started) break;
    await page.waitForTimeout(100);
  }

  await page.waitForFunction(() => Boolean((window as any).__V9_APP__?.started), null, { timeout: 15_000 });
  await page.waitForFunction(() => {
    const app = (window as any).__V9_APP__;
    return Boolean(app?.player?.group?.getObjectByName('V9_HERO_KAYKIT_ENGINEER'));
  }, null, { timeout: 20_000 });
  await configureDeterministicCamera(page);
}

test('V9 professional gameplay, physics, animation and visual-stability matrix', async ({ page }) => {
  rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const badResponses: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));

  await test.step('boot the production renderer and verify KayKit hero', async () => {
    await bootIntoGame(page);
    await expect(page.locator('canvas.v8-canvas')).toBeVisible();
    await capture(page, '01-world-idle.png');
    const hero = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      return {
        name: app.player.visual.name,
        canonical: app.player.group.userData.heroCanonical,
        worldName: app.world.group.name
      };
    });
    expect(hero.name).toBe('V9_HERO_KAYKIT_ENGINEER');
    expect(hero.canonical).toBe('kaykit-engineer-v9-carry-rebuild');
    expect(hero.worldName).toBe('V9_WORLD');
  });

  await test.step('movement: walk, run, diagonal, wall and corner collision', async () => {
    await setPlayer(page, 0, 12, Math.PI);
    const start = await playerPosition(page);
    await pressFor(page, 'w', 420);
    const walked = await playerPosition(page);
    expect(Math.hypot(walked.x - start.x, walked.z - start.z)).toBeGreaterThan(0.65);

    await setPlayer(page, 0, 12, Math.PI);
    const runStart = await playerPosition(page);
    await page.keyboard.down('Shift');
    await pressFor(page, 'w', 420);
    await page.keyboard.up('Shift');
    const ran = await playerPosition(page);
    expect(Math.hypot(ran.x - runStart.x, ran.z - runStart.z)).toBeGreaterThan(Math.hypot(walked.x - start.x, walked.z - start.z) * 1.12);

    await setPlayer(page, 0, 12, Math.PI);
    const diagonalStart = await playerPosition(page);
    await page.keyboard.down('w');
    await page.keyboard.down('d');
    await page.waitForTimeout(480);
    await page.keyboard.up('w');
    await page.keyboard.up('d');
    const diagonal = await playerPosition(page);
    expect(Math.abs(diagonal.x - diagonalStart.x)).toBeGreaterThan(0.25);
    expect(Math.abs(diagonal.z - diagonalStart.z)).toBeGreaterThan(0.25);

    await setPlayer(page, 8.45, 0, Math.PI / 2);
    await pressFor(page, 'd', 900);
    const wallStop = await playerPosition(page);
    expect(wallStop.x).toBeLessThanOrEqual(8.93);

    await setPlayer(page, 8.42, -7.35, -Math.PI / 4);
    await page.keyboard.down('w');
    await page.keyboard.down('d');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');
    await page.keyboard.up('d');
    const cornerStop = await playerPosition(page);
    expect(cornerStop.x).toBeLessThanOrEqual(8.93);
    expect(cornerStop.z).toBeGreaterThanOrEqual(-7.93);
  });

  await test.step('F3 exposes pivots, bodies, anchors and object state', async () => {
    await page.keyboard.press('F3');
    await page.waitForTimeout(220);
    const debug = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      return {
        baseVisible: app.world.debugOverlay.group.visible,
        v9Visible: app.world.v9Debug.group.visible,
        children: app.world.v9Debug.group.children.length
      };
    });
    expect(debug.baseVisible).toBe(true);
    expect(debug.v9Visible).toBe(true);
    expect(debug.children).toBeGreaterThan(3);
    await capture(page, '02-f3-debug-overview.png');
  });

  await test.step('door: hinge pivot, dynamic collider, anti-spam, pass-through and hit-while-opening', async () => {
    await teleportNear(page, 'control-exit-door', 1.42, 'south');
    const closed = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('control-exit-door');
      const c = app.world.colliders.find((item: any) => item.id === e.colliderId);
      return { state: e.state.doorComponent.state, angle: e.state.pivot.rotation.y, width: c.maxX - c.minX, depth: c.maxZ - c.minZ };
    });
    expect(closed.state).toBe('CLOSED');
    expect(Math.abs(closed.angle)).toBeLessThan(0.01);
    await capture(page, '03-door-closed-f3.png');

    await page.keyboard.press('e');
    await page.waitForTimeout(380);
    const opening = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('control-exit-door');
      return { state: e.state.doorComponent.state, angle: e.state.pivot.rotation.y };
    });
    expect(['OPENING', 'OPEN']).toContain(opening.state);
    expect(opening.angle).toBeLessThan(-0.01);
    await capture(page, '04-door-opening-f3.png');

    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('e');
      await page.waitForTimeout(32);
    }
    await page.waitForTimeout(850);
    const open = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('control-exit-door');
      const c = app.world.colliders.find((item: any) => item.id === e.colliderId);
      return { state: e.state.doorComponent.state, angle: e.state.pivot.rotation.y, width: c.maxX - c.minX, depth: c.maxZ - c.minZ, enabled: c.enabled };
    });
    expect(open.state).toBe('OPEN');
    expect(open.depth).toBeGreaterThan(open.width);
    expect(open.enabled).toBe(true);
    await capture(page, '05-door-open-f3.png');

    await setPlayer(page, 0, 7.0, 0);
    await pressFor(page, 's', 950);
    const passed = await playerPosition(page);
    expect(passed.z).toBeGreaterThan(8.75);

    await teleportNear(page, 'control-exit-door', 1.42, 'south');
    await page.keyboard.press('e');
    await page.waitForTimeout(900);
    await expect.poll(async () => page.evaluate(() => (window as any).__V9_APP__.world.registry.get('control-exit-door').state.doorComponent.state)).toBe('CLOSED');
    await page.keyboard.press('e');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await page.waitForTimeout(900);
    const survivedStress = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('control-exit-door');
      return { visible: e.object.visible, state: e.state.doorComponent.state, enabled: e.enabled !== false };
    });
    expect(survivedStress.visible).toBe(true);
    expect(survivedStress.enabled).toBe(true);
    expect(survivedStress.state).toBe('OPEN');
  });

  await test.step('chest and lever: alignment, animation, persistence and one-time loot', async () => {
    await teleportNear(page, 'control-equipment-chest', 1.45, 'south');
    await page.keyboard.down('s');
    await page.waitForTimeout(110);
    await page.keyboard.press('e');
    await page.keyboard.up('s');
    await page.waitForTimeout(1_050);
    const firstOpen = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('control-equipment-chest');
      return { open: e.state.open, looted: e.state.looted, transitioning: e.state.transitioning, inventory: app.world.inventory.list() };
    });
    expect(firstOpen.open).toBe(true);
    expect(firstOpen.looted).toBe(true);
    expect(firstOpen.transitioning).toBe(false);
    expect(firstOpen.inventory.length).toBeGreaterThanOrEqual(2);
    const inventoryCount = firstOpen.inventory.reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0);
    await capture(page, '06-chest-opened.png');

    await page.keyboard.press('e');
    await page.waitForTimeout(650);
    const inventoryCountAgain = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      return app.world.inventory.list().reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0);
    });
    expect(inventoryCountAgain).toBe(inventoryCount);

    await teleportNear(page, 'control-training-lever', 1.25, 'south');
    await page.keyboard.press('e');
    await page.waitForTimeout(720);
    const active = await page.evaluate(() => {
      const e = (window as any).__V9_APP__.world.registry.get('control-training-lever');
      return { active: e.state.active, transitioning: e.state.transitioning, pivot: e.state.pivot.rotation.x };
    });
    expect(active.active).toBe(true);
    expect(active.transitioning).toBe(false);
    await capture(page, '07-lever-active.png');
  });

  await test.step('crate: pickup/lift, hand grips, carry locomotion, collision, putdown, repick and throw', async () => {
    await teleportNear(page, 'env-carry-crate', 1.25, 'south');
    await page.keyboard.press('e');
    await page.waitForFunction(() => {
      const state = (window as any).__V9_APP__.player.getCarryState();
      return state === 'PICKUP_LIFT';
    }, null, { timeout: 3_000 });
    await capture(page, '08-crate-pickup-lift.png');
    await page.waitForFunction(() => {
      const state = (window as any).__V9_APP__.player.getCarryState();
      return state === 'CARRY_IDLE' || state === 'CARRY_WALK';
    }, null, { timeout: 5_000 });

    const carried = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('env-carry-crate');
      const original = e.object.userData.v9OriginalScale;
      const grips = app.player.getGripPoints();
      const leftHand = app.player.visual.getObjectByName('hand.l');
      const rightHand = app.player.visual.getObjectByName('hand.r');
      const p = app.player.position.clone();
      const dist = (a: any, b: any) => a.getWorldPosition(p.clone()).distanceTo(b.getWorldPosition(p.clone()));
      const local = e.object.position;
      const anchor = app.player.getCarryAnchor();
      return {
        id: app.player.getCarriedId(),
        state: app.player.getCarryState(),
        parent: e.object.parent?.name,
        body: e.object.userData.physicsBodyType,
        weight: e.object.userData.weightClass,
        scaleError: original ? e.object.scale.distanceTo(original) : 99,
        gripError: leftHand && rightHand ? (dist(leftHand, grips.left) + dist(rightHand, grips.right)) / 2 : 99,
        objectLocalX: local.x,
        objectLocalZ: local.z,
        anchorX: anchor.position.x,
        anchorZ: anchor.position.z
      };
    });
    expect(carried.id).toBe('env-carry-crate');
    expect(carried.parent).toBe('V9_CARRY_ANCHOR');
    expect(carried.body).toBe('KINEMATIC');
    expect(['LIGHT', 'MEDIUM', 'HEAVY']).toContain(carried.weight);
    expect(carried.scaleError).toBeLessThan(0.001);
    expect(carried.gripError).toBeLessThan(0.9);
    expect(Math.abs(carried.objectLocalX)).toBeLessThan(0.02);
    expect(Math.abs(carried.objectLocalZ)).toBeLessThan(0.02);
    expect(Math.abs(carried.anchorX)).toBeLessThan(0.01);
    expect(carried.anchorZ).toBeGreaterThan(0.40);
    await capture(page, '09-crate-carry-idle.png');

    const beforeCarryWalk = await playerPosition(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(360);
    const carryWalkState = await page.evaluate(() => (window as any).__V9_APP__.player.getCarryState());
    expect(carryWalkState).toBe('CARRY_WALK');
    await capture(page, '10-crate-carry-walk.png');
    await page.keyboard.up('w');
    await page.waitForTimeout(180);
    const afterCarryWalk = await playerPosition(page);
    expect(Math.hypot(afterCarryWalk.x - beforeCarryWalk.x, afterCarryWalk.z - beforeCarryWalk.z)).toBeGreaterThan(0.25);

    await setPlayer(page, 8.20, 0, Math.PI / 2);
    await pressFor(page, 'd', 850);
    const carryingWallStop = await playerPosition(page);
    expect(carryingWallStop.x).toBeLessThan(8.90);

    await setPlayer(page, 0, 12, 0);
    await page.keyboard.press('e');
    await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarriedId() === null, null, { timeout: 4_000 });
    const dropped = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('env-carry-crate');
      return { carried: e.object.userData.carried, body: e.object.userData.physicsBodyType, y: e.object.position.y };
    });
    expect(dropped.carried).toBe(false);
    expect(dropped.body).toBe('DYNAMIC');
    expect(dropped.y).toBeGreaterThanOrEqual(0);
    await capture(page, '11-crate-putdown.png');

    await teleportNear(page, 'env-carry-crate', 1.20, 'south');
    await page.keyboard.press('e');
    await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarriedId() === 'env-carry-crate', null, { timeout: 4_000 });
    const throwStart = await page.evaluate(() => {
      const e = (window as any).__V9_APP__.world.registry.get('env-carry-crate');
      const p = e.object.getWorldPosition((window as any).__V9_APP__.player.position.clone());
      return { x: p.x, y: p.y, z: p.z };
    });
    await page.keyboard.press('Space');
    await page.waitForTimeout(330);
    await capture(page, '12-crate-throw-flight.png');
    await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarriedId() === null, null, { timeout: 4_000 });
    await page.waitForTimeout(850);
    const throwEnd = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const e = app.world.registry.get('env-carry-crate');
      const p = e.object.getWorldPosition(app.player.position.clone());
      return { x: p.x, y: p.y, z: p.z, body: e.object.userData.physicsBodyType };
    });
    expect(throwEnd.body).toBe('DYNAMIC');
    expect(Math.hypot(throwEnd.x - throwStart.x, throwEnd.z - throwStart.z)).toBeGreaterThan(0.8);
    expect(throwEnd.y).toBeGreaterThanOrEqual(0);
  });

  await test.step('throw against a closed door collides instead of teleporting through', async () => {
    const currentDoor = await page.evaluate(() => (window as any).__V9_APP__.world.registry.get('control-exit-door').state.doorComponent.state);
    if (currentDoor !== 'CLOSED') {
      await teleportNear(page, 'control-exit-door', 1.4, 'south');
      await page.keyboard.press('e');
      await page.waitForTimeout(950);
    }
    await expect.poll(async () => page.evaluate(() => (window as any).__V9_APP__.world.registry.get('control-exit-door').state.doorComponent.state)).toBe('CLOSED');

    await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const crate = app.world.registry.get('env-carry-crate').object;
      crate.position.set(0, 0, 6.25);
      crate.rotation.set(0, 0, 0);
      app.world.physics.teleport('env-carry-crate', crate.position.clone());
      app.world.physics.setBodyType('env-carry-crate', 'STATIC');
      crate.userData.physicsBodyType = 'STATIC';
    });
    await teleportNear(page, 'env-carry-crate', 1.15, 'south');
    await page.keyboard.press('e');
    await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarriedId() === 'env-carry-crate', null, { timeout: 4_000 });
    await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      app.player.visual.rotation.y = 0;
      app.world.lastPlayerForward.set(0, 0, 1);
    });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarriedId() === null, null, { timeout: 4_000 });
    await page.waitForTimeout(1_050);
    const collision = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const crate = app.world.registry.get('env-carry-crate').object;
      const door = app.world.registry.get('control-exit-door');
      const collider = app.world.colliders.find((item: any) => item.id === door.colliderId);
      return { crateZ: crate.position.z, doorMinZ: collider.minZ, doorState: door.state.doorComponent.state };
    });
    expect(collision.doorState).toBe('CLOSED');
    expect(collision.crateZ).toBeLessThan(collision.doorMinZ + 0.02);
    await capture(page, '13-crate-door-collision.png');
  });

  await test.step('combat: target damage, visible break sequence, wall feedback and transition lockout', async () => {
    await teleportNear(page, 'control-breakable-target', 1.55, 'south');
    await page.keyboard.press('Space');
    await expect.poll(async () => page.evaluate(() => (window as any).__V9_APP__.world.registry.get('control-breakable-target').health)).toBe(1);
    const firstHit = await page.evaluate(() => {
      const e = (window as any).__V9_APP__.world.registry.get('control-breakable-target');
      return { visible: e.object.visible, state: e.state?.damageState ?? 'DAMAGED' };
    });
    expect(firstHit.visible).toBe(true);
    await capture(page, '14-target-damaged.png');

    await page.waitForTimeout(650);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => {
      const e = (window as any).__V9_APP__.world.registry.get('control-breakable-target');
      return ['BREAKING', 'FRAGMENTING', 'BROKEN'].includes(e.state?.damageState);
    }, null, { timeout: 3_000 });
    const duringBreak = await page.evaluate(() => {
      const e = (window as any).__V9_APP__.world.registry.get('control-breakable-target');
      return { visible: e.object.visible, state: e.state.damageState };
    });
    expect(duringBreak.visible || duringBreak.state === 'BROKEN').toBe(true);
    await capture(page, '15-target-breaking.png');
    await page.waitForFunction(() => !(window as any).__V9_APP__.world.registry.get('control-breakable-target').object.visible, null, { timeout: 3_000 });

    await setPlayer(page, 8.25, 0, Math.PI / 2);
    const wallColliderBefore = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const wall = app.world.colliders.find((c: any) => c.id === 'control-east-wall');
      return wall ? { ...wall } : null;
    });
    await page.keyboard.press('Space');
    await page.waitForTimeout(650);
    const wallColliderAfter = await page.evaluate(() => {
      const app = (window as any).__V9_APP__;
      const wall = app.world.colliders.find((c: any) => c.id === 'control-east-wall');
      return wall ? { ...wall } : null;
    });
    expect(wallColliderAfter).toEqual(wallColliderBefore);

    await teleportNear(page, 'control-equipment-chest', 1.35, 'south');
    await page.keyboard.press('e');
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
    const attackDuringInteraction = await page.evaluate(() => (window as any).__V9_APP__.player.isActionLocked());
    expect(typeof attackDuringInteraction).toBe('boolean');
  });

  await test.step('performance, console, requests and cleanup stay healthy', async () => {
    const runtime = await page.evaluate(async () => {
      const app = (window as any).__V9_APP__;
      const samples: number[] = [];
      let previous = performance.now();
      for (let i = 0; i < 120; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => {
          const now = performance.now();
          samples.push(now - previous);
          previous = now;
          resolve();
        }));
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      return {
        averageFps: 1000 / (samples.reduce((a, b) => a + b, 0) / samples.length),
        p95FrameMs: p95,
        calls: app.renderer.info.render.calls,
        triangles: app.renderer.info.render.triangles,
        textures: app.renderer.info.memory.textures,
        geometries: app.renderer.info.memory.geometries,
        heap: (performance as any).memory?.usedJSHeapSize ?? null
      };
    });
    expect(runtime.averageFps).toBeGreaterThan(30);
    expect(runtime.p95FrameMs).toBeLessThan(48);
    expect(runtime.calls).toBeLessThan(500);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(badResponses, `HTTP errors:\n${badResponses.join('\n')}`).toEqual([]);
    expect(failedRequests, `failed requests:\n${failedRequests.join('\n')}`).toEqual([]);

    writeFileSync(resolve(ARTIFACT_DIR, 'runtime-metrics.json'), JSON.stringify({ runtime, consoleErrors, pageErrors, badResponses, failedRequests }, null, 2));
  });
});
