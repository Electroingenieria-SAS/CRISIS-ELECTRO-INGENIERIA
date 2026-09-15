import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ARTIFACT_DIR = resolve(process.cwd(), 'e2e-artifacts-carry');

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: resolve(ARTIFACT_DIR, name), animations: 'allow' });
}

async function fastBoot(page: Page): Promise<void> {
  await page.goto('/?v9e2e=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('#v8-profile')), null, { timeout: 20_000 });

  // One browser-context operation avoids Playwright actionability overhead while
  // software WebGL is rendering the live character preview.
  await page.evaluate(() => {
    const name = document.querySelector<HTMLInputElement>('#v8-name');
    const team = document.querySelector<HTMLInputElement>('#v8-team');
    if (name) name.value = 'Carry QA';
    if (team) team.value = 'V9 Carry Rebuild';
    document.querySelector<HTMLButtonElement>('#v8-profile button[type="submit"]')?.click();
  });

  await page.evaluate(async () => {
    const start = performance.now();
    while (!(window as any).__V9_APP__?.started) {
      document.querySelector<HTMLButtonElement>('#v8-next')?.click();
      if (performance.now() - start > 30_000) throw new Error('V9 onboarding did not complete');
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
  });

  await page.waitForFunction(() => {
    const app = (window as any).__V9_APP__;
    return Boolean(app?.player?.group?.getObjectByName('V9_HERO_KAYKIT_ENGINEER'));
  }, null, { timeout: 30_000 });
}

async function placeAtCrate(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as any).__V9_APP__;
    const entry = app.world.registry.get('env-carry-crate');
    if (!entry) throw new Error('env-carry-crate missing');
    const target = entry.object.getWorldPosition(app.player.position.clone());
    app.player.position.set(target.x, 0, target.z - 1.18);
    app.player.velocity?.set(0, 0, 0);
    const direction = target.clone().sub(app.player.position).setY(0).normalize();
    app.player.visual.rotation.y = Math.atan2(direction.x, direction.z);
    app.world.lastPlayerForward.copy(direction);
    app.yaw = 0;
    app.pitch = 0.68;
    app.distance = 10.8;
    app.positionCamera?.(true, 0);
  });
  await page.waitForTimeout(120);
}

test('rebuilt carry visually lifts and keeps the crate centred in front', async ({ page }) => {
  test.setTimeout(180_000);
  rmSync(ARTIFACT_DIR, { recursive: true, force: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await fastBoot(page);
  await placeAtCrate(page);
  await capture(page, 'carry-01-before-pickup.png');

  await page.keyboard.press('e');
  await page.waitForFunction(() => {
    const state = (window as any).__V9_APP__.player.getCarryState();
    return state === 'PICKUP_LIFT';
  }, null, { timeout: 15_000 });

  const lift = await page.evaluate(() => {
    const app = (window as any).__V9_APP__;
    const crate = app.world.registry.get('env-carry-crate').object;
    const anchor = app.player.getCarryAnchor();
    const crateWorld = crate.getWorldPosition(app.player.position.clone());
    const anchorWorld = anchor.getWorldPosition(app.player.position.clone());
    return {
      state: app.player.getCarryState(),
      parent: crate.parent?.name,
      local: crate.position.toArray(),
      distanceToFinalAnchor: crateWorld.distanceTo(anchorWorld)
    };
  });
  expect(lift.state).toBe('PICKUP_LIFT');
  expect(lift.parent).toBe('V9_CARRY_ANCHOR');
  // At the lift marker the crate must still be travelling, proving it was not
  // teleported directly from floor to its final chest pose.
  expect(lift.distanceToFinalAnchor).toBeGreaterThan(0.04);
  await capture(page, 'carry-02-pickup-lift.png');

  await page.waitForFunction(() => {
    const state = (window as any).__V9_APP__.player.getCarryState();
    return state === 'CARRY_IDLE' || state === 'CARRY_WALK';
  }, null, { timeout: 20_000 });
  await page.waitForTimeout(180);

  const idle = await page.evaluate(() => {
    const app = (window as any).__V9_APP__;
    const crate = app.world.registry.get('env-carry-crate').object;
    const anchor = app.player.getCarryAnchor();
    const playerWorld = app.player.visual.getWorldPosition(app.player.position.clone());
    const crateWorld = crate.getWorldPosition(app.player.position.clone());
    const inverse = app.player.visual.getWorldQuaternion(crate.quaternion.clone()).invert();
    const actorLocal = crateWorld.clone().sub(playerWorld).applyQuaternion(inverse);
    return {
      state: app.player.getCarryState(),
      localX: crate.position.x,
      localY: crate.position.y,
      localZ: crate.position.z,
      anchorX: anchor.position.x,
      anchorY: anchor.position.y,
      anchorZ: anchor.position.z,
      actorLocalX: actorLocal.x,
      actorLocalZ: actorLocal.z,
      body: crate.userData.physicsBodyType,
      carried: crate.userData.carried
    };
  });

  expect(idle.carried).toBe(true);
  expect(idle.body).toBe('KINEMATIC');
  expect(Math.abs(idle.localX)).toBeLessThan(0.015);
  expect(Math.abs(idle.localZ)).toBeLessThan(0.015);
  expect(Math.abs(idle.anchorX)).toBeLessThan(0.01);
  expect(idle.anchorY).toBeGreaterThan(1.0);
  expect(idle.anchorY).toBeLessThan(1.35);
  expect(idle.anchorZ).toBeGreaterThan(0.40);
  expect(idle.anchorZ).toBeLessThan(0.72);
  expect(Math.abs(idle.actorLocalX)).toBeLessThan(0.08);
  expect(idle.actorLocalZ).toBeGreaterThan(0.35);
  await capture(page, 'carry-03-idle-centred.png');

  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarryState() === 'CARRY_WALK', null, { timeout: 15_000 });
  await capture(page, 'carry-04-walk-centred.png');
  await page.keyboard.up('w');
  await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarryState() === 'CARRY_IDLE', null, { timeout: 15_000 });

  await page.keyboard.press('e');
  await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarriedId() === null, null, { timeout: 20_000 });
  await capture(page, 'carry-05-putdown.png');

  await placeAtCrate(page);
  await page.keyboard.press('e');
  await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarryState() === 'CARRY_IDLE', null, { timeout: 20_000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => (window as any).__V9_APP__.player.getCarriedId() === null, null, { timeout: 20_000 });
  await page.waitForTimeout(100);
  await capture(page, 'carry-06-throw-release.png');

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
