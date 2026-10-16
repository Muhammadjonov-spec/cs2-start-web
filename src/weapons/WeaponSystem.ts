import * as THREE from 'three';
import { WeaponId, WeaponDef } from '../types';
import { SoundManager } from '../audio/SoundManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { TextureGenerator } from '../graphics/TextureGenerator';

// CS2 AK-47 Real Spray Pattern Offsets (X, Y in degrees/pixels)
const AK_SPRAY_PATTERN = [
  { x: 0, y: 0 },
  { x: 0, y: -0.6 },
  { x: 0.1, y: -1.3 },
  { x: -0.1, y: -2.1 },
  { x: -0.4, y: -2.9 },
  { x: -0.8, y: -3.5 },
  { x: -1.2, y: -3.8 },
  { x: -1.0, y: -4.0 },
  { x: -0.4, y: -4.1 },
  { x: 0.3, y: -4.2 },
  { x: 1.0, y: -4.3 },
  { x: 1.6, y: -4.2 },
  { x: 1.8, y: -4.1 },
  { x: 1.6, y: -4.0 },
  { x: 1.1, y: -4.0 },
  { x: 0.2, y: -4.1 },
  { x: -0.6, y: -4.2 },
  { x: -1.3, y: -4.3 },
  { x: -1.7, y: -4.2 },
  { x: -1.8, y: -4.1 },
  { x: -1.4, y: -4.0 },
  { x: -0.8, y: -4.1 },
  { x: 0.1, y: -4.2 },
  { x: 0.9, y: -4.3 },
  { x: 1.4, y: -4.2 },
  { x: 1.6, y: -4.1 },
  { x: 1.2, y: -4.0 },
  { x: 0.5, y: -4.1 },
  { x: -0.2, y: -4.2 },
  { x: -0.8, y: -4.2 },
];

export const WEAPON_REGISTRY: Record<WeaponId, WeaponDef> = {
  ak47: {
    id: 'ak47',
    name: 'AK-47',
    type: 'rifle',
    damage: 36,
    fireRate: 600,
    clipSize: 30,
    reserveAmmo: 90,
    reloadTime: 2.3,
    moveSpeed: 215,
    price: 2700,
    sprayPattern: AK_SPRAY_PATTERN,
    spread: 0.003,
    spreadMoveMult: 4.5,
  },
  m4a1: {
    id: 'm4a1',
    name: 'M4A1-S',
    type: 'rifle',
    damage: 38,
    fireRate: 600,
    clipSize: 20,
    reserveAmmo: 80,
    reloadTime: 2.7,
    moveSpeed: 225,
    price: 2900,
    sprayPattern: AK_SPRAY_PATTERN.map((p) => ({ x: p.x * 0.65, y: p.y * 0.7 })),
    spread: 0.002,
    spreadMoveMult: 3.8,
  },
  awp: {
    id: 'awp',
    name: 'AWP',
    type: 'sniper',
    damage: 115,
    fireRate: 41,
    clipSize: 5,
    reserveAmmo: 30,
    reloadTime: 3.4,
    moveSpeed: 200,
    price: 4750,
    sprayPattern: [{ x: 0, y: 0 }],
    spread: 0.0005,
    spreadMoveMult: 12.0,
  },
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle',
    type: 'pistol',
    damage: 53,
    fireRate: 267,
    clipSize: 7,
    reserveAmmo: 35,
    reloadTime: 2.1,
    moveSpeed: 230,
    price: 700,
    sprayPattern: [
      { x: 0, y: 0 },
      { x: 0, y: -1.2 },
      { x: 0.3, y: -2.4 },
      { x: -0.2, y: -3.2 },
      { x: 0.4, y: -3.8 },
      { x: -0.3, y: -4.2 },
      { x: 0.1, y: -4.5 },
    ],
    spread: 0.004,
    spreadMoveMult: 6.0,
  },
  knife: {
    id: 'knife',
    name: 'Karambit Knife',
    type: 'melee',
    damage: 45,
    fireRate: 150,
    clipSize: 0,
    reserveAmmo: 0,
    reloadTime: 0,
    moveSpeed: 250,
    price: 0,
    sprayPattern: [],
    spread: 0,
    spreadMoveMult: 1.0,
  },
};

export class WeaponSystem {
  public activeWeapon: WeaponDef = WEAPON_REGISTRY.ak47;
  public ammo: Record<WeaponId, { clip: number; reserve: number }> = {
    ak47: { clip: 30, reserve: 90 },
    m4a1: { clip: 20, reserve: 80 },
    awp: { clip: 5, reserve: 30 },
    deagle: { clip: 7, reserve: 35 },
    knife: { clip: 0, reserve: 0 },
  };

  public isReloading: boolean = false;
  public isScoped: boolean = false;
  public isAiming: boolean = false;
  private aimProgress: number = 0; // 0 to 1 for smooth ADS

  private reloadTimer: number = 0;
  private fireTimer: number = 0;
  private sprayIndex: number = 0;
  private sprayResetTimer: number = 0;

  // Viewmodel Group & Positioning
  public viewmodelGroup: THREE.Group = new THREE.Group();
  private currentWeaponMesh: THREE.Group | null = null;
  private armsGroup: THREE.Group = new THREE.Group();
  private targetRecoilOffset: THREE.Vector3 = new THREE.Vector3();
  private currentRecoilOffset: THREE.Vector3 = new THREE.Vector3();
  private targetRecoilRot: THREE.Euler = new THREE.Euler();
  private currentRecoilRot: THREE.Euler = new THREE.Euler();

  // Muzzle flash & Visuals
  private muzzleFlashMesh!: THREE.Mesh;
  private muzzleFlashLight!: THREE.PointLight;
  private muzzleTimer: number = 0;

  // Bullet Tracers and Decals
  private tracers: { line: THREE.Line; velocity: THREE.Vector3; life: number }[] = [];
  private decalGroup: THREE.Group = new THREE.Group();
  private bulletHoleTex: THREE.CanvasTexture = TextureGenerator.createBulletHoleTexture();
  private playerColliderHandle: number = -1;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private sound: SoundManager,
    private physics: PhysicsWorld,
    private onHitCallback: (damage: number, hitbox: string, botId?: string) => void
  ) {
    this.initViewmodel();
    this.scene.add(this.decalGroup);
  }

  public setPlayerCollider(handle: number) {
    this.playerColliderHandle = handle;
  }

  public clearDecals() {
    while (this.decalGroup.children.length > 0) {
      this.decalGroup.remove(this.decalGroup.children[0]);
    }
  }

  private initViewmodel() {
    this.camera.add(this.viewmodelGroup);
    this.scene.add(this.camera);

    // Muzzle Flash
    const flashGeo = new THREE.DodecahedronGeometry(0.06, 1);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2a3 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashLight = new THREE.PointLight(0xffaa22, 0, 10);
    this.muzzleFlashMesh.add(this.muzzleFlashLight);
    this.muzzleFlashMesh.visible = false;
    this.viewmodelGroup.add(this.muzzleFlashMesh);

    // Build Tactical Arms & Hands
    this.buildTacticalArms();
    this.viewmodelGroup.add(this.armsGroup);

    this.equipWeapon('ak47');
  }

  private buildTacticalArms() {
    const camoTex = TextureGenerator.createTacticalCamo();
    camoTex.repeat.set(2, 2);

    const sleeveMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.85,
    });
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x181a1d,
      roughness: 0.45,
      metalness: 0.2,
    });
    const knuckleMat = new THREE.MeshStandardMaterial({
      color: 0x0f1114,
      roughness: 0.2,
      metalness: 0.8,
    });

    // Right Arm
    const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 12), sleeveMat);
    rForearm.position.set(0.24, -0.32, -0.12);
    rForearm.rotation.set(-0.6, -0.2, -0.4);
    this.armsGroup.add(rForearm);

    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.12), gloveMat);
    rHand.position.set(0.18, -0.2, -0.26);
    rHand.rotation.set(-0.3, -0.2, 0);
    this.armsGroup.add(rHand);

    const rKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.02, 0.05), knuckleMat);
    rKnuckle.position.set(0, 0.038, 0);
    rHand.add(rKnuckle);

    // Left Arm
    const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.45, 12), sleeveMat);
    lForearm.position.set(-0.16, -0.34, -0.22);
    lForearm.rotation.set(-0.5, 0.4, 0.6);
    this.armsGroup.add(lForearm);

    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, 0.11), gloveMat);
    lHand.position.set(0.05, -0.18, -0.42);
    lHand.rotation.set(0.2, 0.4, -0.5);
    this.armsGroup.add(lHand);
  }

  public equipWeapon(id: WeaponId) {
    if (this.isReloading) {
      this.isReloading = false;
    }
    this.activeWeapon = WEAPON_REGISTRY[id];
    this.isAiming = false;
    this.isScoped = false;
    this.aimProgress = 0;
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();

    if (this.currentWeaponMesh) {
      this.viewmodelGroup.remove(this.currentWeaponMesh);
    }

    this.currentWeaponMesh = this.buildWeaponMesh(id);
    this.viewmodelGroup.add(this.currentWeaponMesh);
    this.armsGroup.visible = true;

    if (id === 'awp') {
      this.muzzleFlashMesh.position.set(0.18, -0.13, -1.05);
    } else if (id === 'knife') {
      this.muzzleFlashMesh.position.set(0, 0, 0);
    } else if (id === 'deagle') {
      this.muzzleFlashMesh.position.set(0.14, -0.12, -0.52);
    } else {
      this.muzzleFlashMesh.position.set(0.18, -0.13, -0.85);
    }
  }

  // CS2 Aim Down Sights / Zoom Toggle for ALL Weapons!
  public toggleAim() {
    if (this.activeWeapon.type === 'melee') return;
    this.isAiming = !this.isAiming;
    this.isScoped = this.isAiming && (this.activeWeapon.id === 'awp');
  }

  public setAim(aim: boolean) {
    if (this.activeWeapon.type === 'melee') {
      this.isAiming = false;
      this.isScoped = false;
      return;
    }
    this.isAiming = aim;
    this.isScoped = this.isAiming && (this.activeWeapon.id === 'awp');
  }

  private buildWeaponMesh(id: WeaponId): THREE.Group {
    const group = new THREE.Group();

    const gunMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2328,
      roughness: 0.32,
      metalness: 0.92,
    });
    const walnutWoodMat = new THREE.MeshStandardMaterial({
      color: 0x6e3518,
      roughness: 0.45,
      metalness: 0.1,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe5e9f0,
      roughness: 0.18,
      metalness: 0.98,
    });
    const oliveChassisMat = new THREE.MeshStandardMaterial({
      color: 0x3d493a,
      roughness: 0.6,
      metalness: 0.25,
    });

    if (id === 'ak47') {
      // 1. Stamped Steel Receiver
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.078, 0.3), gunMetalMat);
      receiver.position.set(0, 0, -0.22);
      group.add(receiver);

      // Dust Cover
      const dustCover = new THREE.Mesh(
        new THREE.CylinderGeometry(0.023, 0.023, 0.25, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2),
        gunMetalMat
      );
      dustCover.position.set(0, 0.04, -0.22);
      group.add(dustCover);

      // Bolt Carrier Handle (Chrome/Steel)
      const boltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.035).rotateZ(Math.PI / 2), chromeMat);
      boltHandle.position.set(0.028, 0.025, -0.18);
      group.add(boltHandle);

      // Wood Handguard & Gas Cylinder
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.22), walnutWoodMat);
      handguard.position.set(0, 0.015, -0.45);
      group.add(handguard);

      // Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 12).rotateX(Math.PI / 2), gunMetalMat);
      barrel.position.set(0, 0.02, -0.7);
      group.add(barrel);

      // Front Sight Post (CS2 Iron Sight)
      const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.038, 0.025), gunMetalMat);
      sightBase.position.set(0, 0.045, -0.82);
      group.add(sightBase);

      const sightPin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.015), gunMetalMat);
      sightPin.position.set(0, 0.065, -0.82);
      group.add(sightPin);

      // Slanted AK Muzzle Compensator
      const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.05, 8).rotateX(Math.PI / 2), gunMetalMat);
      muzzleBrake.position.set(0, 0.02, -0.88);
      group.add(muzzleBrake);

      // Curved 30-Round Steel Magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.22, 0.085), gunMetalMat);
      mag.position.set(0, -0.11, -0.27);
      mag.rotation.x = 0.26;
      group.add(mag);

      // Ergonomic Wooden Pistol Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.12, 0.055), walnutWoodMat);
      grip.position.set(0, -0.07, -0.09);
      grip.rotation.x = -0.3;
      group.add(grip);

      // Curved Walnut Buttstock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.26), walnutWoodMat);
      stock.position.set(0, -0.02, 0.06);
      group.add(stock);

      // Steel Buttplate
      const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.105, 0.01), gunMetalMat);
      buttplate.position.set(0, -0.02, 0.19);
      group.add(buttplate);

      group.position.set(0.18, -0.16, -0.3);
      group.rotation.set(0.04, -0.04, 0);
    } else if (id === 'm4a1') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.085, 0.35), gunMetalMat);
      body.position.set(0, 0, -0.22);
      group.add(body);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.015, 0.3), gunMetalMat);
      rail.position.set(0, 0.05, -0.22);
      group.add(rail);

      const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.24, 16).rotateX(Math.PI / 2), gunMetalMat);
      handguard.position.set(0, 0.02, -0.46);
      group.add(handguard);

      const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.32, 20).rotateX(Math.PI / 2), gunMetalMat);
      silencer.position.set(0, 0.02, -0.68);
      group.add(silencer);

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.18, 0.065), gunMetalMat);
      mag.position.set(0, -0.1, -0.24);
      mag.rotation.x = 0.1;
      group.add(mag);

      group.position.set(0.18, -0.16, -0.3);
    } else if (id === 'awp') {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.095, 0.6), oliveChassisMat);
      chassis.position.set(0, 0, -0.3);
      group.add(chassis);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.65, 16).rotateX(Math.PI / 2), gunMetalMat);
      barrel.position.set(0, 0.025, -0.76);
      group.add(barrel);

      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.08), gunMetalMat);
      brake.position.set(0, 0.025, -1.08);
      group.add(brake);

      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.32, 16).rotateX(Math.PI / 2), gunMetalMat);
      scopeBody.position.set(0, 0.085, -0.32);
      group.add(scopeBody);

      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.026, 16),
        new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.1, metalness: 0.9 })
      );
      lens.position.set(0, 0.085, -0.48);
      group.add(lens);

      group.position.set(0.18, -0.16, -0.32);
    } else if (id === 'deagle') {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.068, 0.28), chromeMat);
      slide.position.set(0, 0.025, -0.16);
      group.add(slide);

      const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 12).rotateX(Math.PI / 2), gunMetalMat);
      bore.position.set(0, 0.035, -0.31);
      group.add(bore);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.075), gunMetalMat);
      grip.position.set(0, -0.065, -0.06);
      grip.rotation.x = -0.22;
      group.add(grip);

      group.position.set(0.14, -0.14, -0.26);
    } else {
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x181b20,
        roughness: 0.15,
        metalness: 0.95,
      });
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xe09f3e,
        roughness: 0.25,
        metalness: 0.9,
      });

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.14, 0.038), gunMetalMat);
      handle.position.set(0, 0, 0);
      group.add(handle);

      const fingerRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 8, 16), ringMat);
      fingerRing.position.set(0, 0.08, 0);
      group.add(fingerRing);

      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4).rotateZ(Math.PI), bladeMat);
      blade.position.set(0, -0.13, -0.05);
      blade.rotation.x = 0.65;
      group.add(blade);

      group.position.set(0.14, -0.12, -0.26);
      group.rotation.set(0.2, -0.3, 0.4);
    }

    return group;
  }

  public fire(origin: THREE.Vector3, forward: THREE.Vector3, currentSpeedMult: number) {
    if (this.isReloading) return;
    if (this.fireTimer > 0) return;

    const currentAmmo = this.ammo[this.activeWeapon.id];
    if (this.activeWeapon.type !== 'melee' && currentAmmo.clip <= 0) {
      this.reload();
      return;
    }

    if (this.activeWeapon.type !== 'melee') {
      currentAmmo.clip--;
    }

    this.sound.playGunshot(this.activeWeapon.id);
    this.fireTimer = 60 / this.activeWeapon.fireRate;

    // Viewmodel Recoil Kick
    if (this.activeWeapon.type === 'melee') {
      this.targetRecoilOffset.set(-0.04, 0.06, -0.12);
      this.targetRecoilRot.set(-0.25, 0.4, -0.3);
    } else {
      const kickZ = this.activeWeapon.id === 'awp' ? 0.26 : 0.085;
      const kickY = this.activeWeapon.id === 'awp' ? 0.08 : 0.035;
      this.targetRecoilOffset.set(0, kickY, kickZ);
      this.targetRecoilRot.set(0.08, (Math.random() - 0.5) * 0.02, 0);

      this.muzzleFlashMesh.visible = true;
      this.muzzleFlashLight.intensity = 5.0;
      this.muzzleTimer = 0.05;
    }

    // ADS improves accuracy (reduces spread by 60%!)
    const aimSpreadReduction = this.isAiming ? 0.4 : 1.0;
    const spreadAmount = this.activeWeapon.spread * aimSpreadReduction * (1 + currentSpeedMult * this.activeWeapon.spreadMoveMult);

    // Authentic CS2 camera local basis vectors
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const shootDir = forward.clone();

    // Spray pattern applied in camera local space (first shot sprayIndex 0 is 100% pin-point accurate!)
    if (this.activeWeapon.sprayPattern.length > 0 && this.sprayIndex > 0) {
      const pattern = this.activeWeapon.sprayPattern[Math.min(this.sprayIndex, this.activeWeapon.sprayPattern.length - 1)];
      const sprayYaw = pattern.x * 0.003 * aimSpreadReduction;
      const sprayPitch = pattern.y * 0.003 * aimSpreadReduction;

      shootDir.addScaledVector(right, sprayYaw);
      shootDir.addScaledVector(up, -sprayPitch); // Climb upwards in screen space
    }

    if (this.sprayIndex > 0 || currentSpeedMult > 0.3) {
      shootDir.addScaledVector(right, (Math.random() - 0.5) * spreadAmount);
      shootDir.addScaledVector(up, (Math.random() - 0.5) * spreadAmount);
    }
    shootDir.normalize();

    this.sprayIndex++;
    this.sprayResetTimer = 0.45;

    // CRITICAL FIX: Raycast starts 0.45m in front of camera, strictly ignoring player capsule collider!
    const rayOrigin = origin.clone().addScaledVector(shootDir, 0.45);
    const maxDist = this.activeWeapon.type === 'melee' ? 2.8 : 250;
    const ignoredList = this.playerColliderHandle >= 0 ? [this.playerColliderHandle] : [];
    const hit = this.physics.castRay(rayOrigin, shootDir, maxDist, ignoredList);

    if (this.activeWeapon.type !== 'melee') {
      const tracerEnd = hit ? hit.point : origin.clone().addScaledVector(shootDir, 80);
      this.spawnTracer(origin, tracerEnd);
    }

    if (hit) {
      const colliderInfo = this.physics.getColliderInfo(hit.collider.handle);

      if (colliderInfo && colliderInfo.type.startsWith('bot')) {
        let hitbox: 'head' | 'chest' | 'stomach' | 'legs' = 'chest';
        let damageMult = 1.0;

        if (colliderInfo.type === 'bot_head') {
          hitbox = 'head';
          damageMult = 4.0;
          this.sound.playHeadshotDink();
        } else if (colliderInfo.type === 'bot_legs') {
          hitbox = 'legs';
          damageMult = 0.75;
        }

        const totalDamage = Math.round(this.activeWeapon.damage * damageMult);
        this.onHitCallback(totalDamage, hitbox, colliderInfo.id);
      } else {
        this.spawnBulletDecal(hit.point, hit.normal);
      }
    }
  }

  // Public tracer generator (also used for bot gunfire)
  public spawnTracer(start: THREE.Vector3, target: THREE.Vector3) {
    const dir = new THREE.Vector3().subVectors(target, start).normalize();
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      dir.clone().multiplyScalar(1.5),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffd266, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(geo, mat);
    line.position.copy(start);
    this.scene.add(line);

    this.tracers.push({
      line,
      velocity: dir.multiplyScalar(160),
      life: 0.35,
    });
  }

  private spawnBulletDecal(point: THREE.Vector3, normal: THREE.Vector3) {
    const decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
    const decalMat = new THREE.MeshBasicMaterial({
      map: this.bulletHoleTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.position.copy(point).addScaledVector(normal, 0.008);
    decal.lookAt(point.clone().add(normal));
    this.decalGroup.add(decal);

    if (this.decalGroup.children.length > 50) {
      const oldest = this.decalGroup.children[0];
      this.decalGroup.remove(oldest);
    }
  }

  public reload() {
    if (this.isReloading || this.activeWeapon.type === 'melee') return;
    const currentAmmo = this.ammo[this.activeWeapon.id];
    if (currentAmmo.clip >= this.activeWeapon.clipSize || currentAmmo.reserve <= 0) return;

    this.isReloading = true;
    this.reloadTimer = this.activeWeapon.reloadTime;
    this.sound.playReload();

    this.targetRecoilOffset.set(0, -0.16, 0.06);
    this.targetRecoilRot.set(-0.4, 0.2, -0.2);
  }

  public update(dt: number) {
    if (this.fireTimer > 0) this.fireTimer -= dt;

    if (this.sprayResetTimer > 0) {
      this.sprayResetTimer -= dt;
      if (this.sprayResetTimer <= 0) {
        this.sprayIndex = 0;
      }
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleFlashLight.intensity = 0;
      }
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const currentAmmo = this.ammo[this.activeWeapon.id];
        const needed = this.activeWeapon.clipSize - currentAmmo.clip;
        const toAdd = Math.min(needed, currentAmmo.reserve);
        currentAmmo.clip += toAdd;
        currentAmmo.reserve -= toAdd;
      }
    }

    // Smooth ADS Aim Interpolation
    this.aimProgress = THREE.MathUtils.lerp(
      this.aimProgress,
      this.isAiming ? 1.0 : 0.0,
      dt * 15
    );

    // Smooth Camera FOV
    let targetFov = 75;
    if (this.activeWeapon.id === 'awp') {
      targetFov = this.isAiming ? 20 : 75;
    } else if (this.activeWeapon.type !== 'melee') {
      targetFov = this.isAiming ? 45 : 75; // 45 FOV zoom for AK-47, M4A1, Deagle
    }
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 15);
    this.camera.updateProjectionMatrix();

    // AWP sniper scope hide/show
    if (this.activeWeapon.id === 'awp') {
      const showMesh = this.aimProgress < 0.7;
      if (this.currentWeaponMesh) this.currentWeaponMesh.visible = showMesh;
      this.armsGroup.visible = showMesh;
    } else {
      if (this.currentWeaponMesh) this.currentWeaponMesh.visible = true;
      this.armsGroup.visible = true;

      // Smoothly transition viewmodel to center (ADS)
      const hipPos = this.activeWeapon.id === 'deagle'
        ? new THREE.Vector3(0.14, -0.14, -0.26)
        : new THREE.Vector3(0.18, -0.16, -0.3);
      const adsPos = this.activeWeapon.id === 'deagle'
        ? new THREE.Vector3(0, -0.1, -0.2)
        : new THREE.Vector3(0, -0.115, -0.24);

      const currentBasePos = hipPos.clone().lerp(adsPos, this.aimProgress);
      this.currentWeaponMesh?.position.copy(currentBasePos);
    }

    // Smooth Recoil Return to Rest Position
    this.currentRecoilOffset.lerp(this.targetRecoilOffset, dt * 25);
    this.targetRecoilOffset.lerp(new THREE.Vector3(), dt * 10);

    this.currentRecoilRot.x = THREE.MathUtils.lerp(this.currentRecoilRot.x, this.targetRecoilRot.x, dt * 25);
    this.currentRecoilRot.y = THREE.MathUtils.lerp(this.currentRecoilRot.y, this.targetRecoilRot.y, dt * 25);
    this.currentRecoilRot.z = THREE.MathUtils.lerp(this.currentRecoilRot.z, this.targetRecoilRot.z, dt * 25);
    this.targetRecoilRot.set(0, 0, 0);

    this.viewmodelGroup.position.copy(this.currentRecoilOffset);
    this.viewmodelGroup.rotation.copy(this.currentRecoilRot);

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.line.position.addScaledVector(t.velocity, dt);
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      }
    }
  }
}
