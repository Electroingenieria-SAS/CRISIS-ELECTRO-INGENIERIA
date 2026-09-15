import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const assets = [
  {
    url: 'https://raw.githubusercontent.com/programasweights/avatar/main/public/assets/character.glb',
    path: 'public/assets/quaternius/hero.glb',
    minBytes: 700_000
  },
  {
    url: 'https://raw.githubusercontent.com/Seyamalam/blood-league-kickoff/main/public/assets/vendor/quaternius/universal-animation-library.glb',
    path: 'public/assets/quaternius/universal-animation-library.glb',
    minBytes: 2_600_000
  }
];

async function valid(path, minBytes) {
  try {
    return (await stat(path)).size >= minBytes;
  } catch {
    return false;
  }
}

async function download(asset) {
  const target = resolve(asset.path);
  if (await valid(target, asset.minBytes)) {
    console.log(`[assets] cached ${asset.path}`);
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  const response = await fetch(asset.url, {
    headers: { 'User-Agent': 'Crisis-Electroingenieria-Build/1.0' }
  });
  if (!response.ok) throw new Error(`Failed ${response.status} ${response.statusText}: ${asset.url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < asset.minBytes) throw new Error(`Asset too small (${bytes.byteLength} bytes): ${asset.url}`);
  await writeFile(target, bytes);
  console.log(`[assets] downloaded ${asset.path} (${bytes.byteLength} bytes)`);
}

for (const asset of assets) await download(asset);

// Guard against accidental HTML/error payloads being cached as GLB.
for (const asset of assets) {
  const bytes = await readFile(resolve(asset.path));
  if (bytes.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error(`Invalid GLB header: ${asset.path}`);
}
