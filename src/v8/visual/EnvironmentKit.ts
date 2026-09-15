import * as THREE from 'three';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from './IndustrialKit';

export class EnvironmentKit {
  readonly industrial = new IndustrialKit();

  wall(length: number, height = 4.4, thickness = 0.28, material: THREE.Material = this.industrial.materials.white, accent = C.blue): THREE.Group {
    const group = new THREE.Group();
    const body = this.industrial.box(length, height, thickness, material);
    body.position.y = height / 2;
    group.add(body);

    const base = this.industrial.box(length + 0.04, 0.18, thickness + 0.07, this.industrial.materials.steelDark);
    base.position.y = 0.09;
    group.add(base);

    const cap = this.industrial.box(length + 0.05, 0.13, thickness + 0.08, this.industrial.materials.steel);
    cap.position.y = height - 0.065;
    group.add(cap);

    const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.05 });
    const stripe = this.industrial.box(length - 0.15, 0.08, thickness + 0.035, accentMaterial, false, false);
    stripe.position.y = 0.36;
    group.add(stripe);

    for (const x of [-length / 2, length / 2]) {
      const pillar = this.industrial.box(0.24, height + 0.18, thickness + 0.17, this.industrial.materials.steelDark);
      pillar.position.set(x, height / 2, 0);
      group.add(pillar);
    }

    return group;
  }

  wallWithDoor(length: number, doorWidth = 2.5, height = 4.4, accent = C.blue): { group: THREE.Group; opening: { left: number; right: number } } {
    const group = new THREE.Group();
    const sideLength = Math.max(0.5, (length - doorWidth) / 2);
    const left = this.wall(sideLength, height, 0.28, this.industrial.materials.white, accent);
    left.position.x = -(doorWidth / 2 + sideLength / 2);
    const right = this.wall(sideLength, height, 0.28, this.industrial.materials.white, accent);
    right.position.x = doorWidth / 2 + sideLength / 2;
    group.add(left, right);

    const lintel = this.industrial.box(doorWidth + 0.28, 0.32, 0.42, this.industrial.materials.steelDark);
    lintel.position.set(0, 3.18, 0);
    group.add(lintel);

    for (const x of [-doorWidth / 2, doorWidth / 2]) {
      const jamb = this.industrial.box(0.22, 3.18, 0.42, this.industrial.materials.steelDark);
      jamb.position.set(x, 1.59, 0);
      group.add(jamb);
    }

    return { group, opening: { left: -doorWidth / 2, right: doorWidth / 2 } };
  }

  windowBay(width = 3.2, height = 2.0, accent = C.blue): THREE.Group {
    const group = new THREE.Group();
    const frame = this.industrial.box(width + 0.18, height + 0.18, 0.12, this.industrial.materials.steelDark);
    frame.position.y = height / 2;
    const glass = this.industrial.box(width, height, 0.05, this.industrial.materials.glass, false, false);
    glass.position.set(0, height / 2, 0.07);
    const divider = this.industrial.box(0.08, height, 0.08, this.industrial.materials.steelDark);
    divider.position.set(0, height / 2, 0.11);
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
    const sill = this.industrial.box(width + 0.26, 0.12, 0.24, accentMat);
    sill.position.set(0, 0.02, 0.05);
    group.add(frame, glass, divider, sill);
    return group;
  }

  planter(width = 2.4, depth = 0.8): THREE.Group {
    const group = new THREE.Group();
    const base = this.industrial.box(width, 0.48, depth, this.industrial.materials.concrete);
    base.position.y = 0.24;
    const soil = this.industrial.box(width - 0.16, 0.07, depth - 0.16, this.industrial.materials.wood, false, true);
    soil.position.y = 0.5;
    group.add(base, soil);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4c7a50, roughness: 0.95 });
    for (let i = -2; i <= 2; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7 + (i % 2) * 0.12, 7), leafMat);
      leaf.position.set((i * width) / 6.2, 0.86, i % 2 === 0 ? 0.08 : -0.08);
      leaf.castShadow = true;
      group.add(leaf);
    }
    return group;
  }

  bollard(height = 0.8, accent = C.yellow): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.48, metalness: 0.12 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, height, 12), mat);
    post.position.y = height / 2;
    post.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), mat);
    cap.position.y = height;
    group.add(post, cap);
    return group;
  }

  rock(scale = 1): THREE.Mesh {
    const geometry = new THREE.DodecahedronGeometry(0.55 * scale, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x687077, roughness: 0.98, flatShading: true });
    const rock = new THREE.Mesh(geometry, material);
    rock.scale.set(1.15, 0.72, 0.9);
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
  }
}
