import * as THREE from 'three';

export type EngineerAvatarOptions = {
  accent?: string;
  helmet?: string;
  shirt?: string;
  pants?: string;
  skin?: string;
  vest?: string;
  callsign?: string;
};

export class EngineerAvatar {
  readonly group = new THREE.Group();

  private body = new THREE.Group();
  private torsoPivot = new THREE.Group();
  private headPivot = new THREE.Group();
  private leftArm = new THREE.Group();
  private rightArm = new THREE.Group();
  private leftLeg = new THREE.Group();
  private rightLeg = new THREE.Group();
  private badge: THREE.Mesh | null = null;
  private phase = 0;

  constructor(options: EngineerAvatarOptions = {}) {
    const accent = options.accent ?? '#0B5EA8';
    const helmet = options.helmet ?? '#F4C542';
    const shirt = options.shirt ?? '#12324A';
    const pants = options.pants ?? '#2D3943';
    const skin = options.skin ?? '#D9A275';
    const vest = options.vest ?? '#F4C542';

    this.group.name = 'EI_Engineer_Avatar';
    this.group.add(this.body);

    const torsoMat = this.material(shirt, 0.62, 0.04);
    const pantsMat = this.material(pants, 0.78, 0.02);
    const skinMat = this.material(skin, 0.72, 0.0);
    const vestMat = this.material(vest, 0.58, 0.05);
    const reflectiveMat = new THREE.MeshStandardMaterial({
      color: 0xe9f3f6,
      emissive: 0xa8d9e8,
      emissiveIntensity: 0.65,
      roughness: 0.35,
      metalness: 0.08
    });
    const bootMat = this.material('#12171C', 0.82, 0.02);
    const helmetMat = this.material(helmet, 0.48, 0.06);
    const accentMat = this.material(accent, 0.45, 0.1);

    // Torso and vest.
    this.torsoPivot.position.y = 1.48;
    this.body.add(this.torsoPivot);

    const torso = this.box(0.82, 0.9, 0.42, torsoMat);
    torso.position.y = 0;
    this.torsoPivot.add(torso);

    const vestBody = this.box(0.88, 0.78, 0.49, vestMat);
    vestBody.position.set(0, -0.01, 0.005);
    this.torsoPivot.add(vestBody);

    const stripeFrontA = this.box(0.78, 0.065, 0.025, reflectiveMat);
    stripeFrontA.position.set(0, 0.1, 0.265);
    this.torsoPivot.add(stripeFrontA);
    const stripeFrontB = stripeFrontA.clone();
    stripeFrontB.position.y = -0.17;
    this.torsoPivot.add(stripeFrontB);

    const stripeBackA = stripeFrontA.clone();
    stripeBackA.position.z = -0.265;
    this.torsoPivot.add(stripeBackA);
    const stripeBackB = stripeBackA.clone();
    stripeBackB.position.y = -0.17;
    this.torsoPivot.add(stripeBackB);

    const vestOpening = this.box(0.055, 0.68, 0.03, torsoMat);
    vestOpening.position.set(0, 0.02, 0.28);
    this.torsoPivot.add(vestOpening);

    // EI badge / ID card on chest.
    const idCard = this.box(0.18, 0.23, 0.025, new THREE.MeshStandardMaterial({ color: 0xf8fbfd, roughness: 0.35 }));
    idCard.position.set(0.24, 0.13, 0.292);
    this.torsoPivot.add(idCard);
    const idBand = this.box(0.14, 0.038, 0.026, accentMat);
    idBand.position.set(0.24, 0.18, 0.308);
    this.torsoPivot.add(idBand);
    this.badge = idCard;

    // Belt and utility pouches.
    const belt = this.box(0.84, 0.12, 0.46, bootMat);
    belt.position.set(0, 1.02, 0);
    this.body.add(belt);
    const pouchL = this.box(0.2, 0.26, 0.2, bootMat);
    pouchL.position.set(-0.37, 0.92, 0.16);
    this.body.add(pouchL);
    const pouchR = pouchL.clone();
    pouchR.position.x = 0.37;
    this.body.add(pouchR);

    // Head, PPE glasses and helmet.
    this.headPivot.position.y = 2.18;
    this.body.add(this.headPivot);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), skinMat);
    head.scale.set(0.9, 1.02, 0.88);
    this.headPivot.add(head);

    const glasses = this.box(0.47, 0.075, 0.035, new THREE.MeshStandardMaterial({ color: 0x283b48, transparent: true, opacity: 0.88, roughness: 0.2 }));
    glasses.position.set(0, 0.055, 0.275);
    this.headPivot.add(glasses);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.46, 0.07, 18), helmetMat);
    brim.position.y = 0.31;
    this.headPivot.add(brim);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.37, 0.22, 18), helmetMat);
    shell.position.y = 0.42;
    this.headPivot.add(shell);
    const ridge = this.box(0.08, 0.12, 0.48, helmetMat);
    ridge.position.set(0, 0.5, 0);
    this.headPivot.add(ridge);

    // Arms.
    this.leftArm.position.set(-0.52, 1.74, 0);
    this.rightArm.position.set(0.52, 1.74, 0);
    this.body.add(this.leftArm, this.rightArm);
    this.buildArm(this.leftArm, torsoMat, skinMat, reflectiveMat, false);
    this.buildArm(this.rightArm, torsoMat, skinMat, reflectiveMat, true);

    // Legs and work boots.
    this.leftLeg.position.set(-0.22, 0.98, 0);
    this.rightLeg.position.set(0.22, 0.98, 0);
    this.body.add(this.leftLeg, this.rightLeg);
    this.buildLeg(this.leftLeg, pantsMat, bootMat);
    this.buildLeg(this.rightLeg, pantsMat, bootMat);

    // Small tablet clipped to belt to reinforce the engineering role.
    const tablet = this.box(0.31, 0.42, 0.06, new THREE.MeshStandardMaterial({ color: 0x1d2d38, metalness: 0.25, roughness: 0.45 }));
    tablet.position.set(-0.5, 1.02, 0.02);
    tablet.rotation.z = 0.08;
    this.body.add(tablet);
    const tabletScreen = this.box(0.24, 0.31, 0.012, new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), emissive: new THREE.Color(accent), emissiveIntensity: 0.45 }));
    tabletScreen.position.set(-0.5, 1.02, 0.056);
    tabletScreen.rotation.z = 0.08;
    this.body.add(tabletScreen);

    this.group.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  update(dt: number, speed01: number, sprinting: boolean, interacting = false): void {
    const moving = speed01 > 0.05;
    const cadence = sprinting ? 11.2 : 7.6;
    this.phase += dt * (moving ? cadence : 2.2);

    if (moving) {
      const stride = Math.sin(this.phase) * (sprinting ? 0.82 : 0.5) * Math.min(1, speed01);
      this.leftLeg.rotation.x = stride;
      this.rightLeg.rotation.x = -stride;
      this.leftArm.rotation.x = -stride * 0.72;
      this.rightArm.rotation.x = stride * 0.72;
      this.torsoPivot.rotation.x = THREE.MathUtils.lerp(this.torsoPivot.rotation.x, sprinting ? 0.09 : 0.025, 0.16);
      this.torsoPivot.position.y = 1.48 + Math.abs(Math.sin(this.phase * 2)) * (sprinting ? 0.055 : 0.025);
      this.headPivot.position.y = 2.18 + Math.abs(Math.sin(this.phase * 2)) * 0.025;
    } else {
      const breathe = Math.sin(this.phase) * 0.02;
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.18);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.18);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, -0.03 + breathe, 0.14);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0.03 - breathe, 0.14);
      this.torsoPivot.rotation.x = THREE.MathUtils.lerp(this.torsoPivot.rotation.x, 0, 0.12);
      this.torsoPivot.position.y = 1.48 + breathe * 0.25;
      this.headPivot.position.y = 2.18 + breathe * 0.12;
    }

    if (interacting) {
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -1.05, 0.28);
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, -0.18, 0.22);
      this.headPivot.rotation.y = THREE.MathUtils.lerp(this.headPivot.rotation.y, -0.12, 0.2);
    } else {
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0, 0.18);
      this.headPivot.rotation.y = THREE.MathUtils.lerp(this.headPivot.rotation.y, 0, 0.18);
    }
  }

  setAccent(color: string): void {
    if (!this.badge) return;
    const material = this.badge.material;
    if (material instanceof THREE.MeshStandardMaterial) material.emissive = new THREE.Color(color).multiplyScalar(0.08);
  }

  private buildArm(group: THREE.Group, shirtMat: THREE.Material, skinMat: THREE.Material, reflectiveMat: THREE.Material, addWatch: boolean): void {
    const sleeve = this.box(0.23, 0.58, 0.25, shirtMat);
    sleeve.position.y = -0.26;
    group.add(sleeve);

    const reflective = this.box(0.245, 0.065, 0.27, reflectiveMat);
    reflective.position.y = -0.12;
    group.add(reflective);

    const forearm = this.box(0.2, 0.38, 0.21, skinMat);
    forearm.position.y = -0.69;
    group.add(forearm);

    const glove = this.box(0.22, 0.19, 0.23, this.material('#DCE5E9', 0.7, 0));
    glove.position.y = -0.98;
    group.add(glove);

    if (addWatch) {
      const watch = this.box(0.235, 0.075, 0.24, this.material('#15242E', 0.35, 0.18));
      watch.position.y = -0.59;
      group.add(watch);
    }
  }

  private buildLeg(group: THREE.Group, pantsMat: THREE.Material, bootMat: THREE.Material): void {
    const leg = this.box(0.3, 0.78, 0.34, pantsMat);
    leg.position.y = -0.36;
    group.add(leg);
    const knee = this.box(0.315, 0.17, 0.355, this.material('#3A4750', 0.82, 0));
    knee.position.y = -0.46;
    group.add(knee);
    const boot = this.box(0.34, 0.25, 0.47, bootMat);
    boot.position.set(0, -0.83, 0.055);
    group.add(boot);
  }

  private box(width: number, height: number, depth: number, material: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  }

  private material(color: string, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });
  }
}
