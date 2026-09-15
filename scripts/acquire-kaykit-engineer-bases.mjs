import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'public/assets/kaykit/characters');
const ANIMATION_ROOT = resolve(process.cwd(), 'public/assets/kaykit/animations');
const LICENSE_DIR = resolve(process.cwd(), 'public/assets/licenses');
const OFFICIAL = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures';
const COMMUNITY_MIRROR = 'https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-characters/main/assets/kaykit/character-animations-1.1/Animations/gltf/Rig_Medium';

const assets = [
  { name: 'Rogue.glb', url: `${OFFICIAL}/Characters/gltf/Rogue.glb`, minBytes: 1_000_000 },
  { name: 'Mage.glb', url: `${OFFICIAL}/Characters/gltf/Mage.glb`, minBytes: 1_000_000 }
];

async function existsLargeEnough(path, minBytes) {
  try {
    const info = await stat(path);
    return info.size >= minBytes;
  } catch {
    return false;
  }
}

async function downloadBinary(url, target, minBytes) {
  if (await existsLargeEnough(target, minBytes)) return true;
  const response = await fetch(url, { headers: { 'User-Agent': 'crisis-electroingenieria-build' } });
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < minBytes || bytes.subarray(0, 4).toString('ascii') !== 'glTF') {
    throw new Error(`Invalid GLB received from ${url}`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  console.log(`[KayKit] acquired ${target} (${bytes.length} bytes)`);
  return true;
}

async function downloadOptionalBinary(url, target, minBytes) {
  try {
    return await downloadBinary(url, target, minBytes);
  } catch (error) {
    console.warn(`[KayKit] optional asset unavailable: ${url}`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function downloadText(url, target) {
  try {
    await stat(target);
    return;
  } catch {}
  const response = await fetch(url, { headers: { 'User-Agent': 'crisis-electroingenieria-build' } });
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, await response.text(), 'utf8');
}

await mkdir(ROOT, { recursive: true });
for (const asset of assets) await downloadBinary(asset.url, resolve(ROOT, asset.name), asset.minBytes);

await mkdir(ANIMATION_ROOT, { recursive: true });
await downloadBinary(
  `${COMMUNITY_MIRROR}/Rig_Medium_CombatMelee.glb`,
  resolve(ANIMATION_ROOT, 'Rig_Medium_CombatMelee.glb'),
  900_000
);

// Character Animations 1.1 adds a CC0 tool set with Holding/Work/Hammer/etc.
// It is optional at build time so a temporary mirror outage never breaks V8/V9.
await downloadOptionalBinary(
  `${COMMUNITY_MIRROR}/Rig_Medium_Tools.glb`,
  resolve(ANIMATION_ROOT, 'Rig_Medium_Tools.glb'),
  250_000
);

await downloadText(`${OFFICIAL}/LICENSE.txt`, resolve(LICENSE_DIR, 'KayKit-Adventurers-CC0.txt'));
await downloadText(
  'https://raw.githubusercontent.com/GeorgeQLe/assets-kaykit-3d-characters/main/LICENSES/KayKit-CC0-License.txt',
  resolve(LICENSE_DIR, 'KayKit-Character-Animations-CC0.txt')
);
