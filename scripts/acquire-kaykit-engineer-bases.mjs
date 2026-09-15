import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'public/assets/kaykit/characters');
const LICENSE_DIR = resolve(process.cwd(), 'public/assets/licenses');
const OFFICIAL = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures';

const assets = [
  {
    name: 'Rogue.glb',
    url: `${OFFICIAL}/Characters/gltf/Rogue.glb`,
    minBytes: 1_000_000
  },
  {
    name: 'Mage.glb',
    url: `${OFFICIAL}/Characters/gltf/Mage.glb`,
    minBytes: 1_000_000
  }
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
  if (await existsLargeEnough(target, minBytes)) return;
  const response = await fetch(url, { headers: { 'User-Agent': 'crisis-electroingenieria-build' } });
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < minBytes || bytes.subarray(0, 4).toString('ascii') !== 'glTF') {
    throw new Error(`Invalid GLB received from ${url}`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  console.log(`[KayKit] acquired ${target} (${bytes.length} bytes)`);
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
for (const asset of assets) {
  await downloadBinary(asset.url, resolve(ROOT, asset.name), asset.minBytes);
}
await downloadText(`${OFFICIAL}/LICENSE.txt`, resolve(LICENSE_DIR, 'KayKit-Adventurers-CC0.txt'));
