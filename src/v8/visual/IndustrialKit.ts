import * as THREE from 'three';

export const INDUSTRIAL_COLORS = {
  blue: 0x1769a6,
  navy: 0x18313f,
  yellow: 0xf3c83f,
  yellowDark: 0xba8c20,
  steel: 0x68757b,
  steelDark: 0x39474e,
  concrete: 0x90999c,
  floor: 0x4c5a60,
  white: 0xe9eef0,
  red: 0xc64c4c,
  green: 0x4f9a69,
  cardboard: 0x9a7049,
  wood: 0x765a3d,
  black: 0x151b1f
} as const;

export class IndustrialKit {
  readonly materials = {
    blue: this.mat(INDUSTRIAL_COLORS.blue, 0.48, 0.22),
    navy: this.mat(INDUSTRIAL_COLORS.navy, 0.58, 0.28),
    yellow: this.mat(INDUSTRIAL_COLORS.yellow, 0.5, 0.12),
    yellowDark: this.mat(INDUSTRIAL_COLORS.yellowDark, 0.55, 0.15),
    steel: this.mat(INDUSTRIAL_COLORS.steel, 0.46, 0.62),
    steelDark: this.mat(INDUSTRIAL_COLORS.steelDark, 0.5, 0.58),
    concrete: this.mat(INDUSTRIAL_COLORS.concrete, 0.95, 0.02),
    floor: this.mat(INDUSTRIAL_COLORS.floor, 0.88, 0.05),
    white: this.mat(INDUSTRIAL_COLORS.white, 0.68, 0.03),
    red: this.mat(INDUSTRIAL_COLORS.red, 0.58, 0.08),
    green: this.mat(INDUSTRIAL_COLORS.green, 0.58, 0.08),
    cardboard: this.mat(INDUSTRIAL_COLORS.cardboard, 0.88, 0.0),
    wood: this.mat(INDUSTRIAL_COLORS.wood, 0.86, 0.0),
    black: this.mat(INDUSTRIAL_COLORS.black, 0.78, 0.16),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbad8e6, roughness: 0.14, metalness: 0, transparent: true, opacity: 0.34, transmission: 0.16, thickness: 0.08 })
  };

  private boxGeo = new Map<string, THREE.BoxGeometry>();
  private labelTextures = new Map<string, THREE.CanvasTexture>();

  box(w: number, h: number, d: number, material: THREE.Material, cast = true, receive = true): THREE.Mesh {
    const key = `${w}|${h}|${d}`;
    let geometry = this.boxGeo.get(key);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(w, h, d);
      this.boxGeo.set(key, geometry);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }

  sign(text: string, width = 3.2, height = 0.72, background = '#173346', foreground = '#ffffff', accent = '#f3c83f'): THREE.Group {
    const group = new THREE.Group();
    const frame = this.box(width + 0.1, height + 0.1, 0.07, this.materials.steelDark);
    group.add(frame);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.labelTexture(text, background, foreground, accent), transparent: true })
    );
    plane.position.z = 0.041;
    group.add(plane);
    return group;
  }

  floorDecal(text: string, width: number, height: number, background: string, foreground = '#ffffff'): THREE.Mesh {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.labelTexture(text, background, foreground, '#ffffff'), transparent: true, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.012;
    plane.renderOrder = 2;
    return plane;
  }

  rack(width = 4.4, height = 3.65, depth = 1.45, levels = 3): THREE.Group {
    const group = new THREE.Group();
    const uprightGeo = new THREE.BoxGeometry(0.14, height, 0.14);
    const beamGeo = new THREE.BoxGeometry(width, 0.14, 0.16);
    for (const x of [-width / 2, width / 2]) {
      for (const z of [-depth / 2, depth / 2]) {
        const upright = new THREE.Mesh(uprightGeo, this.materials.blue);
        upright.position.set(x, height / 2, z);
        upright.castShadow = true;
        group.add(upright);
      }
    }
    for (let level = 1; level <= levels; level++) {
      const y = level * (height / (levels + 0.3));
      for (const z of [-depth / 2, depth / 2]) {
        const beam = new THREE.Mesh(beamGeo, this.materials.yellowDark);
        beam.position.set(0, y, z);
        beam.castShadow = true;
        group.add(beam);
      }
      const shelf = this.box(width - 0.18, 0.07, depth - 0.1, this.materials.steel, true, true);
      shelf.position.y = y + 0.05;
      group.add(shelf);
    }
    return group;
  }

  crate(width = 0.78, height = 0.55, depth = 0.62, colorMaterial: THREE.Material = this.materials.cardboard): THREE.Group {
    const group = new THREE.Group();
    const body = this.box(width, height, depth, colorMaterial);
    body.position.y = height / 2;
    group.add(body);
    const tape = this.box(width * 0.14, 0.014, depth + 0.015, this.materials.yellow, false, false);
    tape.position.y = height + 0.008;
    group.add(tape);
    return group;
  }

  pallet(code: string, accentMaterial: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    group.name = `pallet-${code}`;
    for (const z of [-0.45, 0, 0.45]) {
      const runner = this.box(1.8, 0.12, 0.16, this.materials.wood);
      runner.position.set(0, 0.08, z);
      group.add(runner);
    }
    for (let i = -2; i <= 2; i++) {
      const slat = this.box(0.3, 0.09, 1.3, this.materials.wood);
      slat.position.set(i * 0.37, 0.19, 0);
      group.add(slat);
    }
    for (let row = 0; row < 2; row++) {
      for (let col = -1; col <= 1; col++) {
        const crate = this.crate(0.52, 0.52, 0.52, accentMaterial);
        crate.position.set(col * 0.58, 0.25 + row * 0.56, row % 2 === 0 ? -0.2 : 0.18);
        group.add(crate);
      }
    }
    const wrap = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.18, 1.28),
      new THREE.MeshPhysicalMaterial({ color: 0xd9f2f6, transparent: true, opacity: 0.11, roughness: 0.2, metalness: 0, depthWrite: false })
    );
    wrap.position.y = 0.82;
    wrap.castShadow = false;
    group.add(wrap);
    const label = this.sign(code, 0.62, 0.34, '#f7f7f2', '#17232a', '#1769a6');
    label.position.set(0, 0.9, 0.68);
    group.add(label);
    return group;
  }

  forklift(): THREE.Group {
    const group = new THREE.Group();
    const base = this.box(1.8, 0.55, 2.35, this.materials.yellow);
    base.position.y = 0.52;
    group.add(base);
    const hood = this.box(1.55, 0.65, 1.05, this.materials.yellowDark);
    hood.position.set(0, 1.02, -0.5);
    group.add(hood);
    const cabin = new THREE.Group();
    for (const x of [-0.68, 0.68]) {
      for (const z of [-0.55, 0.55]) {
        const post = this.box(0.09, 1.55, 0.09, this.materials.steelDark);
        post.position.set(x, 1.65, z);
        cabin.add(post);
      }
    }
    const roof = this.box(1.55, 0.12, 1.25, this.materials.steelDark);
    roof.position.y = 2.45;
    cabin.add(roof);
    group.add(cabin);
    for (const x of [-0.73, 0.73]) {
      for (const z of [-0.72, 0.72]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.22, 14), this.materials.black);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.36, z);
        group.add(wheel);
      }
    }
    const mast = this.box(0.24, 2.8, 0.22, this.materials.steelDark);
    mast.position.set(0, 1.55, 1.15);
    group.add(mast);
    for (const x of [-0.42, 0.42]) {
      const fork = this.box(0.13, 0.11, 2.05, this.materials.steel);
      fork.position.set(x, 0.28, 2.02);
      group.add(fork);
    }
    return group;
  }

  workstation(): THREE.Group {
    const group = new THREE.Group();
    const desk = this.box(3.8, 0.12, 1.55, this.materials.steel);
    desk.position.y = 1.02;
    group.add(desk);
    for (const x of [-1.65, 1.65]) {
      for (const z of [-0.58, 0.58]) {
        const leg = this.box(0.12, 1.0, 0.12, this.materials.steelDark);
        leg.position.set(x, 0.5, z);
        group.add(leg);
      }
    }
    const monitorBack = this.box(1.25, 0.72, 0.08, this.materials.navy);
    monitorBack.position.set(-0.8, 1.55, -0.2);
    monitorBack.rotation.x = -0.08;
    group.add(monitorBack);
    const screen = this.box(1.08, 0.56, 0.015, this.materials.blue, false, false);
    (screen.material as THREE.MeshStandardMaterial).emissive.setHex(INDUSTRIAL_COLORS.blue);
    (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.28;
    screen.position.set(-0.8, 1.55, -0.155);
    screen.rotation.x = -0.08;
    group.add(screen);
    const keyboard = this.box(0.85, 0.035, 0.32, this.materials.black);
    keyboard.position.set(-0.8, 1.11, 0.2);
    group.add(keyboard);
    return group;
  }

  toolCabinet(colorMaterial: THREE.Material = this.materials.blue): THREE.Group {
    const group = new THREE.Group();
    const body = this.box(1.2, 2.0, 0.58, colorMaterial);
    body.position.y = 1.0;
    group.add(body);
    for (let y = 0.3; y <= 1.55; y += 0.31) {
      const line = this.box(1.05, 0.02, 0.6, this.materials.steelDark, false, false);
      line.position.set(0, y, 0.01);
      group.add(line);
      const handle = this.box(0.38, 0.035, 0.04, this.materials.steel, false, false);
      handle.position.set(0, y + 0.11, 0.315);
      group.add(handle);
    }
    return group;
  }

  dockDoor(label: string, width = 6.1): THREE.Group {
    const group = new THREE.Group();
    for (let row = 0; row < 7; row++) {
      const slat = this.box(width, 0.47, 0.11, this.materials.steel);
      slat.position.y = 0.34 + row * 0.46;
      group.add(slat);
    }
    const frameTop = this.box(width + 0.45, 0.2, 0.35, this.materials.steelDark);
    frameTop.position.y = 3.65;
    group.add(frameTop);
    for (const x of [-width / 2 - 0.12, width / 2 + 0.12]) {
      const side = this.box(0.2, 3.7, 0.35, this.materials.steelDark);
      side.position.set(x, 1.85, 0);
      group.add(side);
      const bumper = this.box(0.34, 1.1, 0.46, this.materials.black);
      bumper.position.set(x, 0.58, 0.26);
      group.add(bumper);
    }
    const sign = this.sign(label, 2.35, 0.5, '#173346', '#ffffff', '#f3c83f');
    sign.position.set(0, 3.25, 0.1);
    group.add(sign);
    return group;
  }

  overheadLight(length = 2.6): THREE.Group {
    const group = new THREE.Group();
    const housing = this.box(length, 0.13, 0.36, this.materials.steelDark);
    group.add(housing);
    const emitterMaterial = new THREE.MeshStandardMaterial({ color: 0xf6fbff, emissive: 0xe9f5ff, emissiveIntensity: 1.35, roughness: 0.25 });
    const emitter = this.box(length - 0.18, 0.035, 0.26, emitterMaterial, false, false);
    emitter.position.y = -0.075;
    group.add(emitter);
    return group;
  }

  barrier(width = 2.2): THREE.Group {
    const group = new THREE.Group();
    for (const x of [-width / 2, width / 2]) {
      const foot = this.box(0.48, 0.1, 0.6, this.materials.black);
      foot.position.set(x, 0.05, 0);
      group.add(foot);
      const post = this.box(0.11, 0.95, 0.11, this.materials.yellow);
      post.position.set(x, 0.5, 0);
      group.add(post);
    }
    const rail = this.box(width, 0.16, 0.11, this.materials.yellow);
    rail.position.y = 0.72;
    group.add(rail);
    for (let i = -2; i <= 2; i++) {
      const black = this.box(0.24, 0.17, 0.115, this.materials.black, false, false);
      black.position.set((i * width) / 5, 0.72, 0.01);
      black.rotation.z = -0.55;
      group.add(black);
    }
    return group;
  }

  cone(): THREE.Group {
    const group = new THREE.Group();
    const base = this.box(0.52, 0.07, 0.52, this.materials.black);
    base.position.y = 0.035;
    group.add(base);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.72, 16), this.materials.yellow);
    cone.position.y = 0.43;
    cone.castShadow = true;
    group.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.08, 16), this.materials.white);
    band.position.y = 0.44;
    group.add(band);
    return group;
  }

  private labelTexture(text: string, background: string, foreground: string, accent: string): THREE.CanvasTexture {
    const key = `${text}|${background}|${foreground}|${accent}`;
    const cached = this.labelTextures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear contexto 2D para señalización');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 30, canvas.height);
    ctx.fillStyle = foreground;
    ctx.font = '700 74px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2 + 12, canvas.height / 2, canvas.width - 100);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.labelTextures.set(key, texture);
    return texture;
  }

  private mat(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }
}
