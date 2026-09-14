# V5 · Asset provenance and visual pipeline

This document records the third-party visual sources used by the V5 art pass of **Crisis en Electroingeniería · Operación Aurora**.

## Licensing policy

The public repository prioritizes assets whose source pack is published under **CC0 / public domain**. Gameplay code and Electroingeniería-specific composition, materials, signage and interactions are authored for this project.

## Kenney · City Kit (Roads)

- Official pack: https://kenney.nl/assets/city-kit-roads
- License: Creative Commons CC0.
- Runtime mirror used by V5: `petroulacl/fps-buildings-env-kit`.
- Source commit verified during V5 implementation: `1dd8e932402deb82422920df2e7fd079391e55d3`.
- Used for: road modules, pedestrian crossings, street lights, cones and construction barriers.

## Kenney · Modular Buildings

- Source family: Kenney 3D building assets.
- License file is retained in the public mirror and identifies the Kenney CC0 terms.
- Runtime mirror used by V5: `petroulacl/fps-buildings-env-kit`.
- Source commit verified during V5 implementation: `1dd8e932402deb82422920df2e7fd079391e55d3`.
- Used for: exterior architectural masses / campus landmarks. The game adds its own EI glass facade, steel framing, signs and lighting.

## Kenney · Nature Kit

- Official pack: https://kenney.nl/assets/nature-kit
- License: Creative Commons CC0.
- Runtime subset mirror: `rajsinghtech/spurfire`.
- Pinned commit: `8792fe1404eabd93ff12dd0726460da5db648b02`.
- Used for: trees and rocks around the campus perimeter.

## Kenney · Platformer Kit subset

- Kenney game assets are released under CC0.
- Runtime mirror: `levinzonr/godot-asset-placer`.
- Source commit verified during V5 implementation: `1dbf9fd782566780d6a6c52bd4197f448622f0aa`.
- Used for: conveyors, barrels and non-mission set-dressing crates.

## Runtime loading strategy

V5 uses `src/v5/RemoteAssetLibrary.ts` to cache and clone GLB models. It normalizes scale and materials, enables shadows and uses graceful fallback behavior: failure of an external set-dressing asset does **not** stop the gameplay world from loading.

The functional V4 geometry remains underneath the V5 visual layer so collision, puzzles and accessibility do not depend on a decorative remote model.

## Original project work

The following are project-specific and not copied from the external packs:

- campus layout and zone composition;
- Electroingeniería color language and wayfinding;
- glass/steel architectural overlay;
- procedural ground materials, puddles, oil marks and drainage system;
- pipe/cable-tray system;
- safety zones and investigation signage;
- warning-light system;
- gameplay puzzles, mission objects and quality logic;
- player/NPC integration and cinematics.
