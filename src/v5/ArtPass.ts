import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RemoteAssetLibrary, type AssetPlacement } from './RemoteAssetLibrary';

const ROAD_BASE = 'https://raw.githubusercontent.com/petroulacl/fps-buildings-env-kit/main/props/kenney-city-kit-roads/Models/GLB%20format/';
const BUILDING_BASE = 'https://raw.githubusercontent.com/petroulacl/fps-buildings-env-kit/main/buildings/kenney-modular-buildings/Models/GLB%20format/';
const NATURE_BASE = 'https://raw.githubusercontent.com/rajsinghtech/spurfire/8792fe1404eabd93ff12dd0726460da5db648b02/game/assets/kenney/nature-kit/';
const PLATFORM_BASE = 'https://raw.githubusercontent.com/levinzonr/godot-asset-placer/main/demo/assets/kenney_platformer_kit/';

const COLORS = {
  blue: '#0B5EA8',
  yellow: '#F4C542',
  steel: '#425763',
  concrete: '#78858B',
  asphalt: '#262C31',
  green: '#2B5A3B',
  orange: '#E8984A',
  red: '#C84E4E',
  white: '#E7EEF2'
};

type PulseLight = {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  phase: number;
  speed: number;
};

export class V5ArtPass {
  readonly group = new THREE.Group();
  private assets = new RemoteAssetLibrary();
  private pulses: PulseLight[] = [];
  private rotating: Array<{ object: THREE.Object3D; speed: number }> = [];
  private clock = 0;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer
  ) {
    this.group.name = 'V5_PROFESSIONAL_ART_PASS';
    this.scene.add(this.group);
  }

  async init(): Promise<void> {
    this.configureRendererAndEnvironment();
    this.buildPbrGroundLayer();
    this.buildArchitecturalSkin();
    this.buildIndustrialDetails();
    this.buildSafetyAndWayfinding();
    this.buildAtmosphericDetails();

    await Promise.all([
      this.loadRoadSystem(),
      this.loadNatureSystem(),
      this.loadArchitecturalAssets(),
      this.loadIndustrialProps()
    ]);
  }

  update(dt: number): void {
    this.clock += dt;
    for (const pulse of this.pulses) {
      const intensity = 0.55 + Math.sin(this.clock * pulse.speed + pulse.phase) * 0.32;
      const material = pulse.mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = Math.max(0.15, intensity * 2.1);
      pulse.light.intensity = Math.max(0.2, 3.5 + intensity * 5.5);
    }
    for (const item of this.rotating) item.object.rotation.y += dt * item.speed;
  }

  private configureRendererAndEnvironment(): void {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    env.dispose();
    pmrem.dispose();

    const sky = new Sky();
    sky.scale.setScalar(450000);
    const uniforms = sky.material.uniforms;
    uniforms.turbidity.value = 5.2;
    uniforms.rayleigh.value = 1.65;
    uniforms.mieCoefficient.value = 0.0042;
    uniforms.mieDirectionalG.value = 0.82;
    const phi = THREE.MathUtils.degToRad(90 - 57);
    const theta = THREE.MathUtils.degToRad(128);
    const sun = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    uniforms.sunPosition.value.copy(sun);
    this.group.add(sky);

    this.scene.fog = new THREE.FogExp2(0x9eb9c6, 0.0062);
  }

  private buildPbrGroundLayer(): void {
    const grassTexture = this.makeNoiseTexture('#31543d', '#213d2e', 384, 0.34);
    grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(22, 20);
    grassTexture.colorSpace = THREE.SRGBColorSpace;

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(184, 164),
      new THREE.MeshStandardMaterial({
        map: grassTexture,
        color: 0x8ba690,
        roughness: 0.98,
        metalness: 0,
        normalScale: new THREE.Vector2(0.25, 0.25)
      })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.105;
    grass.receiveShadow = true;
    this.group.add(grass);

    const asphaltTexture = this.makeNoiseTexture('#30363b', '#15191d', 384, 0.46);
    asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltTexture.repeat.set(18, 3);
    asphaltTexture.colorSpace = THREE.SRGBColorSpace;

    const asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltTexture,
      color: 0x7c858a,
      roughness: 0.91,
      metalness: 0.02
    });

    const roadStrips = [
      { x: 0, z: 2, w: 108, d: 7.3 },
      { x: -17, z: 10, w: 7.3, d: 43 },
      { x: -19, z: -20, w: 64, d: 7.3 },
      { x: 24, z: 8, w: 7.3, d: 74 },
      { x: 21, z: 33, w: 52, d: 7.3 }
    ];
    for (const strip of roadStrips) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(strip.w, 0.09, strip.d), asphaltMat);
      mesh.position.set(strip.x, 0.015, strip.z);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    // Curbs add depth so roads stop looking painted on the floor.
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.86, metalness: 0.03 });
    const curbRuns = [
      { x: 0, z: -1.85, w: 108, d: 0.22 }, { x: 0, z: 5.85, w: 108, d: 0.22 },
      { x: -20.85, z: 10, w: 0.22, d: 43 }, { x: -13.15, z: 10, w: 0.22, d: 43 },
      { x: 20.15, z: 8, w: 0.22, d: 74 }, { x: 27.85, z: 8, w: 0.22, d: 74 }
    ];
    for (const curb of curbRuns) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(curb.w, 0.22, curb.d), curbMat);
      mesh.position.set(curb.x, 0.1, curb.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    this.addOilStain(-12, -30, 4.8, 2.3, 0.15);
    this.addOilStain(45, 18, 3.2, 1.5, -0.24);
    this.addOilStain(9, 39, 4.0, 1.8, 0.37);
    this.addPuddle(-28, 3.8, 3.4, 1.1);
    this.addPuddle(29, 6.7, 2.4, 0.9);
  }

  private async loadRoadSystem(): Promise<void> {
    const specs: AssetPlacement[] = [];

    for (let x = -48; x <= 48; x += 8) {
      specs.push({
        url: `${ROAD_BASE}road-straight.glb`,
        position: new THREE.Vector3(x, 0.07, 2),
        rotationY: 0,
        targetMaxSize: 8.05,
        roughness: 0.88,
        name: `road-main-${x}`
      });
    }
    for (let z = -42; z <= 46; z += 8) {
      specs.push({
        url: `${ROAD_BASE}road-straight.glb`,
        position: new THREE.Vector3(0, 0.075, z),
        rotationY: Math.PI / 2,
        targetMaxSize: 8.05,
        roughness: 0.88,
        name: `road-north-${z}`
      });
    }

    specs.push(
      { url: `${ROAD_BASE}road-crossroad.glb`, position: new THREE.Vector3(0, 0.08, 2), targetMaxSize: 8.15, name: 'road-main-crossroad' },
      { url: `${ROAD_BASE}road-crossing.glb`, position: new THREE.Vector3(-17, 0.09, 2), targetMaxSize: 8.1, rotationY: Math.PI / 2 },
      { url: `${ROAD_BASE}road-crossing.glb`, position: new THREE.Vector3(24, 0.09, 2), targetMaxSize: 8.1, rotationY: Math.PI / 2 }
    );

    // Real road furniture.
    const lamps = [
      [-44, -1.2], [-30, 5.2], [-14, -1.2], [14, 5.2], [30, -1.2], [46, 5.2],
      [-20.8, -12], [-13.2, 18], [20.5, -30], [27.5, -11], [20.5, 25], [27.5, 42]
    ] as Array<[number, number]>;
    lamps.forEach(([x, z], index) => specs.push({
      url: `${ROAD_BASE}light-square.glb`,
      position: new THREE.Vector3(x, 0.02, z),
      targetMaxSize: 5.6,
      rotationY: index % 2 ? Math.PI : 0,
      roughness: 0.52,
      metalness: 0.32,
      name: `street-light-${index}`
    }));

    const cones = [
      [-48, 5.5], [-46.8, 5.5], [-45.6, 5.5],
      [37, 8], [38.2, 8], [39.4, 8],
      [8, 34], [9.2, 34]
    ] as Array<[number, number]>;
    cones.forEach(([x, z], index) => specs.push({
      url: `${ROAD_BASE}construction-cone.glb`,
      position: new THREE.Vector3(x, 0.02, z),
      targetMaxSize: 0.9,
      name: `safety-cone-${index}`
    }));

    const barriers = [[-44, 3.8, 0], [40, 9.6, Math.PI / 2], [10, 35.4, 0]] as Array<[number, number, number]>;
    barriers.forEach(([x, z, r], index) => specs.push({
      url: `${ROAD_BASE}construction-barrier.glb`,
      position: new THREE.Vector3(x, 0.02, z),
      targetMaxSize: 2.4,
      rotationY: r,
      name: `safety-barrier-${index}`
    }));

    await this.assets.placeMany(this.group, specs);
  }

  private async loadNatureSystem(): Promise<void> {
    const specs: AssetPlacement[] = [];
    const treeSpots: Array<[number, number, string, number]> = [
      [-52, -44, 'tree_oak.glb', 5.8], [-43, -46, 'tree_default.glb', 5.2], [-30, -47, 'tree_oak.glb', 6.0],
      [-13, -48, 'tree_default.glb', 4.8], [8, -48, 'tree_oak.glb', 5.7], [31, -47, 'tree_default.glb', 5.0], [52, -44, 'tree_oak.glb', 6.2],
      [-53, 45, 'tree_default.glb', 5.1], [-42, 49, 'tree_oak.glb', 6.0], [-26, 50, 'tree_default.glb', 4.9], [-8, 50, 'tree_oak.glb', 6.1],
      [19, 50, 'tree_default.glb', 5.1], [53, 47, 'tree_oak.glb', 6.0],
      [-52, -20, 'tree_oak.glb', 5.6], [-53, 27, 'tree_default.glb', 5.1], [56, -22, 'tree_default.glb', 4.9], [56, 29, 'tree_oak.glb', 5.8]
    ];
    treeSpots.forEach(([x, z, file, size], index) => specs.push({
      url: `${NATURE_BASE}${file}`,
      position: new THREE.Vector3(x, 0.0, z),
      targetMaxSize: size,
      rotationY: (index * 1.73) % (Math.PI * 2),
      roughness: 0.96,
      name: `campus-tree-${index}`
    }));

    const rocks: Array<[number, number, string, number]> = [
      [-49, -38, 'rock_largeA.glb', 2.2], [-36, -44, 'rock_smallA.glb', 1.3],
      [49, -38, 'rock_largeA.glb', 2.0], [54, 39, 'rock_smallA.glb', 1.2],
      [-48, 38, 'rock_largeA.glb', 1.9], [17, 47, 'rock_smallA.glb', 1.2]
    ];
    rocks.forEach(([x, z, file, size], index) => specs.push({
      url: `${NATURE_BASE}${file}`,
      position: new THREE.Vector3(x, 0.0, z),
      targetMaxSize: size,
      rotationY: index * 0.87,
      tint: '#6B7770',
      roughness: 0.98
    }));

    await this.assets.placeMany(this.group, specs);
  }

  private async loadArchitecturalAssets(): Promise<void> {
    const buildings: AssetPlacement[] = [
      // Visitor / administration frontage.
      { url: `${BUILDING_BASE}building-sample-house-a.glb`, position: new THREE.Vector3(0, 0.02, -8.2), targetMaxSize: 15.5, rotationY: 0, tint: '#7D9CAE', roughness: 0.68, name: 'v5-control-building' },
      // Warehouse visual massing behind gameplay volume.
      { url: `${BUILDING_BASE}building-sample-house-c.glb`, position: new THREE.Vector3(-38, 0.02, 20.2), targetMaxSize: 19.5, rotationY: Math.PI, tint: '#B29455', roughness: 0.72, name: 'v5-warehouse-building' },
      // Quality / office block.
      { url: `${BUILDING_BASE}building-sample-tower-a.glb`, position: new THREE.Vector3(33, 0.02, -31.5), targetMaxSize: 18.5, rotationY: 0, tint: '#668EB1', roughness: 0.65, name: 'v5-quality-building' },
      // CAPA landmark becomes a taller building visible from most of the campus.
      { url: `${BUILDING_BASE}building-sample-tower-c.glb`, position: new THREE.Vector3(48, 0.02, 48), targetMaxSize: 22.0, rotationY: -Math.PI / 2, tint: '#597A8E', roughness: 0.62, name: 'v5-capa-landmark' },
      // Distant silhouettes for depth.
      { url: `${BUILDING_BASE}building-sample-tower-b.glb`, position: new THREE.Vector3(-70, 0, -12), targetMaxSize: 25, rotationY: 0.45, tint: '#687C87', roughness: 0.82 },
      { url: `${BUILDING_BASE}building-sample-tower-d.glb`, position: new THREE.Vector3(73, 0, 10), targetMaxSize: 29, rotationY: -0.5, tint: '#61747E', roughness: 0.82 }
    ];
    await this.assets.placeMany(this.group, buildings);
  }

  private async loadIndustrialProps(): Promise<void> {
    const specs: AssetPlacement[] = [];

    // Production line: actual 3D conveyors layered into the gameplay area.
    for (let x = -20; x <= 4; x += 6) {
      specs.push({
        url: `${PLATFORM_BASE}conveyor-belt.glb`,
        position: new THREE.Vector3(x, 0.03, -27.4),
        targetMaxSize: 4.4,
        rotationY: Math.PI / 2,
        tint: '#405A67',
        roughness: 0.56,
        metalness: 0.22,
        name: `production-conveyor-${x}`
      });
    }

    const crateSpots: Array<[number, number, number]> = [
      [-50, 17, 0.2], [-47, 17.8, -0.12], [-35, 18.5, 0.18],
      [8, 42, -0.1], [12, 41.2, 0.22],
      [-13, -28, 0.15], [-4, -28, -0.16]
    ];
    crateSpots.forEach(([x, z, r], index) => specs.push({
      url: `${PLATFORM_BASE}crate.glb`,
      position: new THREE.Vector3(x, 0.03, z),
      targetMaxSize: 1.65,
      rotationY: r + index * 0.25,
      tint: index < 3 ? '#B28A56' : '#667E8A',
      roughness: 0.83,
      name: `setdress-crate-${index}`
    }));

    const barrelSpots: Array<[number, number]> = [[-53, 15], [-52, 18], [-18, -29], [45, 25], [48, 24], [13, 43]];
    barrelSpots.forEach(([x, z], index) => specs.push({
      url: `${PLATFORM_BASE}barrel.glb`,
      position: new THREE.Vector3(x, 0.03, z),
      targetMaxSize: 1.5,
      rotationY: index * 0.52,
      tint: index % 2 ? '#315F79' : '#D6A525',
      roughness: 0.56,
      metalness: 0.16,
      name: `industrial-barrel-${index}`
    }));

    await this.assets.placeMany(this.group, specs);
  }

  private buildArchitecturalSkin(): void {
    // Glass fronts and steel portal frames layer over the procedural buildings,
    // preserving collision/gameplay while raising visual fidelity.
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x6e9db6,
      roughness: 0.12,
      metalness: 0.04,
      transmission: 0.15,
      transparent: true,
      opacity: 0.62,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18
    });
    const steel = new THREE.MeshStandardMaterial({ color: 0x314753, roughness: 0.42, metalness: 0.5 });

    const fronts = [
      { x: 0, z: -7.65, w: 13.5, h: 2.7, accent: COLORS.blue },
      { x: -38, z: 20.45, w: 21.5, h: 2.6, accent: COLORS.yellow },
      { x: -8, z: -23.35, w: 26, h: 2.7, accent: '#55B985' },
      { x: 32, z: -9.7, w: 20.5, h: 2.7, accent: '#8DB8FF' },
      { x: 42, z: 29.65, w: 18, h: 2.7, accent: COLORS.orange },
      { x: 4, z: 48.7, w: 21, h: 2.7, accent: '#FFB36B' },
      { x: 43, z: 53.8, w: 19, h: 2.9, accent: '#A98AE0' }
    ];

    fronts.forEach((front, index) => {
      const frame = new THREE.Group();
      frame.position.set(front.x, 0, front.z);
      const panelCount = Math.max(3, Math.floor(front.w / 3));
      const panelW = front.w / panelCount - 0.16;
      for (let i = 0; i < panelCount; i++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, front.h, 0.07), glass);
        panel.position.set(-front.w / 2 + panelW / 2 + i * (front.w / panelCount), 1.55, 0);
        panel.castShadow = false;
        panel.receiveShadow = true;
        frame.add(panel);

        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.09, front.h + 0.35, 0.11), steel);
        mullion.position.set(-front.w / 2 + i * (front.w / panelCount), 1.58, 0.02);
        mullion.castShadow = true;
        frame.add(mullion);
      }
      const headerMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(front.accent),
        roughness: 0.38,
        metalness: 0.2,
        emissive: new THREE.Color(front.accent),
        emissiveIntensity: 0.08
      });
      const header = new THREE.Mesh(new THREE.BoxGeometry(front.w + 0.8, 0.25, 0.25), headerMat);
      header.position.set(0, front.h + 0.55, 0.01);
      frame.add(header);
      frame.name = `v5-glass-front-${index}`;
      this.group.add(frame);
    });
  }

  private buildIndustrialDetails(): void {
    // Cable trays / pipe runs give production and maintenance a real industrial silhouette.
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x667983, roughness: 0.43, metalness: 0.55 });
    const yellowPipe = new THREE.MeshStandardMaterial({ color: 0xe2b42c, roughness: 0.46, metalness: 0.28 });
    for (const z of [-39, -34]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 27, 14), z === -39 ? pipeMat : yellowPipe);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-8, 4.3, z);
      pipe.castShadow = true;
      this.group.add(pipe);
      for (let x = -20; x <= 4; x += 6) {
        const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 3.3, 10), pipeMat);
        drop.position.set(x, 2.75, z);
        this.group.add(drop);
      }
    }

    // Maintenance overhead cable trays.
    for (let i = 0; i < 4; i++) {
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.12, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x465861, roughness: 0.48, metalness: 0.62 })
      );
      tray.position.set(42, 4.1 + i * 0.12, 10 + i * 4.8);
      tray.castShadow = true;
      this.group.add(tray);
    }

    // Drainage grates, repeated as inexpensive instanced meshes.
    const grateGeometry = new THREE.BoxGeometry(1.45, 0.035, 0.55);
    const grateMaterial = new THREE.MeshStandardMaterial({ color: 0x26333a, roughness: 0.37, metalness: 0.76 });
    const grates = new THREE.InstancedMesh(grateGeometry, grateMaterial, 18);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 18; i++) {
      const x = -48 + i * 5.8;
      dummy.position.set(x, 0.085, 5.25);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      grates.setMatrixAt(i, dummy.matrix);
    }
    grates.castShadow = true;
    grates.receiveShadow = true;
    this.group.add(grates);

    this.buildWarningBeacon(-30, 1.5, 3.0, COLORS.yellow, 1.7);
    this.buildWarningBeacon(35, 2.1, 11.3, COLORS.orange, 2.2);
    this.buildWarningBeacon(10, 38, 2.9, COLORS.red, 2.6);
  }

  private buildSafetyAndWayfinding(): void {
    // Zebra crossings and exclusion zones use actual geometry instead of flat labels.
    this.zebraCrossing(-17, 2, Math.PI / 2);
    this.zebraCrossing(24, 2, Math.PI / 2);
    this.zebraCrossing(0, 33, 0);

    this.safetyZone(-45, 3.2, 12, 4.8, COLORS.red);
    this.safetyZone(-32, 3.2, 12, 4.8, '#55B985');
    this.safetyZone(42, 18, 20, 20, COLORS.orange, true);

    // Directional gantries at the campus main intersection.
    this.buildWayfindingGantries();
  }

  private buildAtmosphericDetails(): void {
    const dustGeometry = new THREE.BufferGeometry();
    const count = 420;
    const positions = new Float32Array(count * 3);
    const seeded = this.rng(91214);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seeded() - 0.5) * 120;
      positions[i * 3 + 1] = 0.6 + seeded() * 8;
      positions[i * 3 + 2] = (seeded() - 0.5) * 108;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0xdce9ee, size: 0.035, transparent: true, opacity: 0.2, depthWrite: false })
    );
    dust.name = 'v5-atmospheric-dust';
    this.group.add(dust);

    // Roof HVAC units on the larger visual masses.
    [[-38, 5.1, 10], [-8, 4.8, -36], [32, 5.0, -22], [42, 4.7, 18], [4, 4.6, 38]].forEach(([x, y, z], index) => {
      const unit = this.buildRooftopHvac(x, y, z, index);
      this.group.add(unit);
    });
  }

  private buildRooftopHvac(x: number, y: number, z: number, index: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.75, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x687980, roughness: 0.62, metalness: 0.45 })
    );
    body.castShadow = true;
    group.add(body);
    const fan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x26333a, roughness: 0.42, metalness: 0.68 })
    );
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0.45, 0.44, 0);
    group.add(fan);
    this.rotating.push({ object: fan, speed: index % 2 ? 1.5 : -1.25 });
    return group;
  }

  private buildWarningBeacon(x: number, z: number, y: number, color: string, speed: number): void {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.88,
      roughness: 0.2
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 16), mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    const light = new THREE.PointLight(new THREE.Color(color), 6, 7, 2.0);
    light.position.set(x, y + 0.2, z);
    this.group.add(light);
    this.pulses.push({ mesh, light, phase: x * 0.2 + z * 0.13, speed });
  }

  private zebraCrossing(x: number, z: number, rotationY: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0.105, z);
    group.rotation.y = rotationY;
    const white = new THREE.MeshStandardMaterial({ color: 0xe7e9e5, roughness: 0.9 });
    for (let i = 0; i < 7; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.018, 4.7), white);
      stripe.position.x = (i - 3) * 0.82;
      stripe.receiveShadow = true;
      group.add(stripe);
    }
    this.group.add(group);
  }

  private safetyZone(x: number, z: number, w: number, d: number, color: string, perimeterOnly = false): void {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.05,
      roughness: 0.8,
      transparent: true,
      opacity: 0.6
    });
    const thickness = 0.12;
    const parts = perimeterOnly
      ? [
          [0, -d / 2, w, thickness], [0, d / 2, w, thickness],
          [-w / 2, 0, thickness, d], [w / 2, 0, thickness, d]
        ]
      : [
          [0, -d / 2, w, thickness], [0, d / 2, w, thickness],
          [-w / 2, 0, thickness, d], [w / 2, 0, thickness, d]
        ];
    for (const [ox, oz, pw, pd] of parts) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.024, pd), material);
      line.position.set(x + ox, 0.115, z + oz);
      this.group.add(line);
    }
  }

  private buildWayfindingGantries(): void {
    const steel = new THREE.MeshStandardMaterial({ color: 0x344a55, roughness: 0.45, metalness: 0.55 });
    const signs = [
      { text: '← ALMACÉN', color: COLORS.yellow, x: -5.2 },
      { text: 'PRODUCCIÓN ↓', color: '#55B985', x: -1.7 },
      { text: 'CALIDAD →', color: '#8DB8FF', x: 2.0 },
      { text: 'CAPA ↗', color: '#A98AE0', x: 5.2 }
    ];
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.4, 0.18), steel);
    const rightPost = leftPost.clone();
    leftPost.position.set(-6.7, 2.2, -2.1);
    rightPost.position.set(6.7, 2.2, -2.1);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.18, 0.18), steel);
    beam.position.set(0, 4.2, -2.1);
    this.group.add(leftPost, rightPost, beam);

    for (const sign of signs) {
      const board = this.makeSignTexture(sign.text, sign.color);
      board.position.set(sign.x, 3.55, -2.0);
      this.group.add(board);
    }
  }

  private makeSignTexture(text: string, color: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#102530';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 18, canvas.height);
    ctx.strokeStyle = '#8DA7B4';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    ctx.fillStyle = '#F4F8FA';
    ctx.font = '800 58px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2 + 10, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.08 });
    return new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.88), mat);
  }

  private addOilStain(x: number, z: number, w: number, d: number, rotation: number): void {
    const texture = this.makeRadialStainTexture();
    const mat = new THREE.MeshPhysicalMaterial({
      map: texture,
      transparent: true,
      opacity: 0.58,
      roughness: 0.24,
      metalness: 0.06,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotation;
    mesh.position.set(x, 0.112, z);
    this.group.add(mesh);
  }

  private addPuddle(x: number, z: number, w: number, d: number): void {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x466a79,
      transparent: true,
      opacity: 0.35,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 32), mat);
    mesh.scale.set(w / 2, d / 2, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.118, z);
    this.group.add(mesh);
  }

  private makeNoiseTexture(colorA: string, colorB: string, size: number, variation: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(size, size);
    const a = new THREE.Color(colorA);
    const b = new THREE.Color(colorB);
    const seeded = this.rng(size * 991 + Math.floor(variation * 100));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const coarse = (Math.sin(x * 0.11) + Math.cos(y * 0.09)) * 0.06;
        const n = THREE.MathUtils.clamp(seeded() * variation + 0.18 + coarse, 0, 1);
        const color = a.clone().lerp(b, n);
        const i = (y * size + x) * 4;
        image.data[i] = Math.round(color.r * 255);
        image.data[i + 1] = Math.round(color.g * 255);
        image.data[i + 2] = Math.round(color.b * 255);
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return new THREE.CanvasTexture(canvas);
  }

  private makeRadialStainTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
    gradient.addColorStop(0, 'rgba(11,16,18,0.9)');
    gradient.addColorStop(0.55, 'rgba(20,25,27,0.55)');
    gradient.addColorStop(1, 'rgba(20,25,27,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }

  private rng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }
}
