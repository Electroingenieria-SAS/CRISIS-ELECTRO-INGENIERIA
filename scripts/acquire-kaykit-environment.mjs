import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'public/assets/kaykit/environment');
const LICENSE_DIR = resolve(process.cwd(), 'public/assets/licenses');
const UA = { 'User-Agent': 'crisis-electroingenieria-build' };

const packs = [
  {
    id: 'prototype',
    base: 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Prototype-Bits-1.0/main/addons/kaykit_prototype_bits/Assets/gltf',
    assets: ['Door_A_Decorated', 'Box_A', 'Barrel_A', 'Pillar_A', 'table_medium_Decorated', 'target_stand_A_Decorated']
  },
  {
    id: 'platformer',
    base: 'https://media.githubusercontent.com/media/series-ai/jam-ready-assets/main/kaykit-platformer/3D/platformer/Assets/gltf/blue',
    assets: ['button_base_blue', 'lever_floor_base_blue', 'signage_arrow_stand_blue'],
    optional: true
  },
  {
    id: 'halloween',
    base: 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0/main/addons/kaykit_halloween_bits/Assets/gltf',
    assets: ['bench', 'tree_pine_yellow_medium', 'path_A']
  }
];

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: UA });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchText(url) {
  const response = await fetch(url, { headers: UA });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function downloadDependency(base, uri, targetDir) {
  const target = resolve(targetDir, uri);
  if (await exists(target)) return;
  const bytes = await fetchBytes(`${base}/${encodeURIComponent(uri).replaceAll('%2F', '/')}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

async function acquireAsset(pack, name) {
  const targetDir = resolve(ROOT, pack.id);
  const gltfTarget = resolve(targetDir, `${name}.gltf`);
  if (await exists(gltfTarget)) return;

  const url = `${pack.base}/${name}.gltf`;
  const text = await fetchText(url);
  if (text.startsWith('version https://git-lfs')) throw new Error(`LFS pointer returned for ${url}`);
  const json = JSON.parse(text);
  await mkdir(targetDir, { recursive: true });
  await writeFile(gltfTarget, text, 'utf8');

  const uris = new Set();
  for (const entry of json.buffers ?? []) if (entry.uri && !entry.uri.startsWith('data:')) uris.add(entry.uri);
  for (const entry of json.images ?? []) if (entry.uri && !entry.uri.startsWith('data:')) uris.add(entry.uri);
  for (const uri of uris) await downloadDependency(pack.base, uri, targetDir);
  console.log(`[KayKit environment] ${pack.id}/${name}`);
}

await mkdir(ROOT, { recursive: true });
for (const pack of packs) {
  for (const name of pack.assets) {
    try {
      await acquireAsset(pack, name);
    } catch (error) {
      if (!pack.optional) throw error;
      console.warn(`[KayKit environment] optional ${pack.id}/${name} skipped: ${error.message}`);
    }
  }
}

const licenseTarget = resolve(LICENSE_DIR, 'KayKit-Environment-CC0.txt');
if (!(await exists(licenseTarget))) {
  await mkdir(LICENSE_DIR, { recursive: true });
  const license = await fetchText('https://raw.githubusercontent.com/series-ai/jam-ready-assets/main/kaykit-platformer/3D/platformer/License.txt');
  await writeFile(licenseTarget, license, 'utf8');
}

// Guard against accidentally committing/generated LFS pointer assets.
for (const pack of packs) {
  const dir = resolve(ROOT, pack.id);
  for (const name of pack.assets) {
    const file = resolve(dir, `${name}.gltf`);
    if (!(await exists(file))) continue;
    const text = await readFile(file, 'utf8');
    if (text.startsWith('version https://git-lfs')) throw new Error(`Invalid generated asset ${file}`);
  }
}
