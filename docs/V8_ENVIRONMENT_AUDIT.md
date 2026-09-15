# V8 Environment Audit — Vertical Slice Base

Date: 2026-09-15
Branch: `feature/adventure-v8-rebuild`

## Current architecture

The V8 runtime is composed by `WorldCore.ts` plus zone modules for Warehouse, Production and Quality. Maintenance, Dispatch and CAPA are still provisional builders inside `WorldCore.ts`.

The current world already has useful foundations:
- one shared `IndustrialKit` for procedural low-poly industrial props;
- dedicated zone modules for Warehouse, Production and Quality;
- contextual interaction prompts through `WorldAction`;
- carryables and drop sockets;
- story interactions, warehouse scanner flow and production/metrology puzzles;
- instanced perimeter vegetation;
- skeletal player/NPC animation;
- GitHub Pages CI/CD.

## Problems found

### Collision
- Collision is currently 2D AABB only (`minX/maxX/minZ/maxZ`).
- Several visible solid props do not register collision: workstations, cabinets, terminals, measurement benches, quarantine rails, some barriers and decorative structures.
- Existing walls use wider generic boxes than their visible thickness in several sectors.
- No dynamic collider state exists for doors, pushable props or breakables.
- No debug visualization is available for collision volumes.

### Object architecture
- `WorldAction`, `Carryable` and `DropSocket` are separate arrays/maps without a common world-object taxonomy.
- There is no reusable base definition for `StaticObject`, `InteractableObject`, `PickupObject`, `CarryableObject`, `MovableObject`, `BreakableObject`, `ContainerObject` or `PuzzleObject`.
- Story actions and environmental actions are coupled inside `GameCore.resolveAction()`.

### Interaction and inventory
- Context prompts exist and correctly choose the nearest registered action, but only for current story objects.
- No inventory system exists.
- No generic pickup-to-inventory flow exists.
- No container/chest state, loot state or reusable door state exists.
- Carryables can be lifted and dropped, but not thrown.
- No pushable/movable-object collision resolution exists.

### Combat readiness
- There is no world attack query or breakable target interface.
- No reusable hit target/hitbox registry exists.
- Current zones have enough open space in several areas, but there is no explicit combat-space contract or debug boundary.

### Environment quality
- Warehouse, Production and Quality are the strongest sectors and already have coherent industrial theming.
- Maintenance, Dispatch and CAPA remain placeholder three-wall rooms.
- `openBuilding()` creates simple rear/side walls with no architectural trim, window modules, integrated doors or layered wall depth.
- Several routes are broad enough for gameplay, but visual hierarchy between primary path, optional areas and blocked areas is weak.
- Landscape trees are optimized with instancing, but their placement is perimeter-only and does not help route framing or depth enough.

### Scale
- Character scale is now normalized by visible height, but environment elements still use local hand-authored dimensions with no documented reference scale.
- Recommended project reference: player/NPC visible height = 2.35 world units; standard clear door height >= 2.9; main path width >= 4.0; combat pocket clear diameter >= 9.0.

## Uploaded KayKit pack audit

### Prototype Bits 1.1 FREE
Useful for the industrial/campus vertical slice:
- `Door_A`, `Door_A_Decorated`, `Door_B`;
- `Wall`, `Wall_Decorated`, `Wall_Doorway`, `Wall_Window_Open/Closed`;
- `Pillar_A`, `Pillar_B`;
- `Primitive_Stairs`, `Primitive_Slope*`;
- `Box_A/B/C`, `Barrel_A/B/C`;
- `Pallet_Large`, `Pallet_Small*`;
- `table_medium*`;
- `target*` for breakable/combat training prototypes.

Use policy: integrate a small curated subset only; do not import the entire pack.

### Platformer Pack 1.0 FREE
Useful as gameplay-system props rather than as architecture:
- floor/wall lever bases;
- colored buttons;
- modular platforms and slopes;
- directional signage.

Use policy: puzzle controls and testing props only. Avoid replacing the industrial architecture with brightly colored platformer tiles.

### Halloween Bits 1.0 FREE
Most assets conflict with the corporate industrial art direction. Neutral assets that can be adapted:
- `bench`;
- selected `tree_pine_*` silhouettes;
- `path_*` pieces;
- simple lanterns only if recolored and used as exterior campus fixtures.

Use policy: no cemetery, skull, pumpkin, coffin, shrine or grave content in the industrial campus.

All three uploaded KayKit packs include CC0 licensing. Build-time acquisition must preserve a local license copy in `public/assets/licenses/`.

## Refactor plan approved by this audit

1. Add a common world-object registry and object kinds.
2. Add a collision resolver with dynamic enable/disable and pushable bodies.
3. Add inventory and generic pickup/container/door/breakable interactions.
4. Add contextual world interaction queries without replacing story actions.
5. Add a reusable debug overlay for colliders, interaction radii, IDs and combat areas.
6. Build one polished Control/Training vertical-slice area proving doors, chest, pickup, carry, push and breakable behavior.
7. Replace provisional Maintenance/Dispatch/CAPA builders with modular zone modules.
8. Upgrade architecture helpers with layered walls, pillars, base trim and integrated openings.
9. Curate KayKit Prototype/Platformer/Halloween assets at build time instead of bulk-importing packs.
10. Keep main navigation lanes open and reserve explicit combat pockets.

## Performance rules

- Reuse materials and geometry caches.
- Instance repeated vegetation and simple repeated props.
- Keep dynamic shadow casters limited to gameplay-relevant props/characters.
- Do not add one light per decorative object.
- Prefer shared atlas assets and low-poly KayKit geometry.
- Interaction/debug helpers must be hidden in normal play.
