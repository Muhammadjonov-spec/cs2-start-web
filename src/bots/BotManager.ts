import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { BotDifficulty, BotConfig } from '../types';
import { SoundManager } from '../audio/SoundManager';
import { TextureGenerator } from '../graphics/TextureGenerator';

const BOT_DIFFICULTY_CONFIGS: Record<BotDifficulty, BotConfig> = {
  easy: {
    reactionTime: 0.85,
    aimAccuracy: 0.45,
    recoilControl: 0.3,
    patrolSpeed: 3.5,
    health: 100,
  },
  medium: {
    reactionTime: 0.45,
    aimAccuracy: 0.7,
    recoilControl: 0.6,
    patrolSpeed: 4.8,
    health: 100,
  },
  hard: {
    reactionTime: 0.28,
    aimAccuracy: 0.88,
    recoilControl: 0.85,
    patrolSpeed: 5.4,
    health: 100,
  },
  expert: {
    reactionTime: 0.18,
    aimAccuracy: 0.96,
    recoilControl: 0.95,
    patrolSpeed: 5.8,
    health: 100,
  },
};

export class Bot {
  public id: string;
  public name: string;
  public group: THREE.Group = new THREE.Group();
  public position: THREE.Vector3 = new THREE.Vector3();
  public health: number = 100;
  public isAlive: boolean = true;
  public respawnTimer: number = 0;

  // Visual Meshes for Hitboxes & Animation
  public headMesh!: THREE.Mesh;
  public chestMesh!: THREE.Mesh;
  public legL!: THREE.Mesh;
  public legR!: THREE.Mesh;
  public armL!: THREE.Mesh;
  public armR!: THREE.Mesh;
  public gunMesh!: THREE.Mesh;
  private vestMesh!: THREE.Mesh;

  // Bot Muzzle Flash & Tracer
  private muzzleFlashMesh!: THREE.Mesh;
  private muzzleFlashLight!: THREE.PointLight;
  private muzzleTimer: number = 0;

  // Rapier Colliders for Hitboxes
  public headCollider!: RAPIER.Collider;
  public chestCollider!: RAPIER.Collider;
  public legsCollider!: RAPIER.Collider;

  // AI & Combat State Machine
  public state: 'patrol' | 'spotted' | 'engage' | 'hunt' | 'dead' = 'patrol';
  private targetWaypoints: THREE.Vector3[] = [];
  private currentWaypointIndex: number = 0;
  private reactionTimer: number = 0;
  private spawnOrigin: THREE.Vector3 = new THREE.Vector3();

  // Difficulty & Gunplay Settings
  public difficultyName: BotDifficulty;
  private currentDifficulty: BotConfig;

  // CS2 Tactical Burst & Ammo System (NO INFINITE AUTO-FIRE!)
  public magazineAmmo: number = 30;
  public isReloading: boolean = false;
  private reloadTimer: number = 0;
  private burstShotsRemaining: number = 0;
  private burstCooldownTimer: number = 0;
  private shotCadenceTimer: number = 0;

  // Tactical Movement, Dodging & Physical Gravity
  private walkTimer: number = 0;
  private isMoving: boolean = false;
  private strafeDir: number = 1; // 1 = right, -1 = left
  private strafeChangeTimer: number = 1.2;
  private isCrouching: boolean = false;
  private crouchTimer: number = 0;
  private lastKnownPlayerPos: THREE.Vector3 = new THREE.Vector3();
  private huntTimer: number = 0;
  private velocityY: number = 0;

  constructor(
    id: string,
    name: string,
    spawnPos: THREE.Vector3,
    waypoints: THREE.Vector3[],
    diff: BotDifficulty,
    private scene: THREE.Scene,
    private physics: PhysicsWorld,
    private sound: SoundManager,
    private onBotShootPlayer: (damage: number) => void,
    private onSpawnTracer: (from: THREE.Vector3, to: THREE.Vector3) => void
  ) {
    this.id = id;
    this.name = name;
    this.spawnOrigin.copy(spawnPos);
    this.position.copy(spawnPos);
    this.targetWaypoints = waypoints;
    this.difficultyName = diff;
    this.currentDifficulty = BOT_DIFFICULTY_CONFIGS[diff];

    this.buildBotMesh();
    this.initPhysics();
    this.snapToGround();
  }

  // Realistic CS2 Tactical Operator Model with Animated Limbs
  private buildBotMesh() {
    const camoTex = TextureGenerator.createTacticalCamo();
    camoTex.repeat.set(3, 3);

    const uniformMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      roughness: 0.85,
    });
    const armorVestMat = new THREE.MeshStandardMaterial({
      color: 0x181c22,
      roughness: 0.45,
      metalness: 0.25,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x222830,
      roughness: 0.35,
      metalness: 0.6,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0984e3,
      roughness: 0.1,
      metalness: 0.95,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x0d0e12,
      roughness: 0.5,
    });
    const gunMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1f2328,
      metalness: 0.9,
      roughness: 0.3,
    });

    // 1. ANIMATED LEGS - Hip pivot at y = 0.75, soles firmly touch ground at y = 0.00
    const legGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.75, 10);
    legGeo.translate(0, -0.375, 0);

    this.legL = new THREE.Mesh(legGeo, uniformMat);
    this.legL.position.set(-0.16, 0.75, 0);
    this.legL.castShadow = true;
    this.group.add(this.legL);

    this.legR = new THREE.Mesh(legGeo, uniformMat);
    this.legR.position.set(0.16, 0.75, 0);
    this.legR.castShadow = true;
    this.group.add(this.legR);

    // Boots (Soles at exact ground level y = 0.00)
    const bootGeo = new THREE.BoxGeometry(0.15, 0.14, 0.24);
    const bootL = new THREE.Mesh(bootGeo, bootMat);
    bootL.position.set(0, -0.68, 0.04);
    this.legL.add(bootL);

    const bootR = new THREE.Mesh(bootGeo, bootMat);
    bootR.position.set(0, -0.68, 0.04);
    this.legR.add(bootR);

    // 2. TORSO & KEVLAR PLATE CARRIER
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.32), uniformMat);
    torso.position.set(0, 1.07, 0);
    torso.castShadow = true;
    this.group.add(torso);
    this.chestMesh = torso;

    this.vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.36), armorVestMat);
    this.vestMesh.position.set(0, 1.10, 0);
    this.vestMesh.castShadow = true;
    this.group.add(this.vestMesh);

    // Ammo Pouches
    for (let p = -1; p <= 1; p++) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.08), armorVestMat);
      pouch.position.set(p * 0.14, 1.05, 0.2);
      this.group.add(pouch);
    }

    // 3. ANIMATED ARMS & WEAPON
    const armGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.55, 8);
    armGeo.translate(0, -0.25, 0);

    this.armL = new THREE.Mesh(armGeo, uniformMat);
    this.armL.position.set(-0.3, 1.30, 0);
    this.armL.rotation.set(0.6, 0.2, -0.3);
    this.group.add(this.armL);

    this.armR = new THREE.Mesh(armGeo, uniformMat);
    this.armR.position.set(0.3, 1.30, 0);
    this.armR.rotation.set(0.8, -0.2, 0.2);
    this.group.add(this.armR);

    // 4. HEAD, COMBAT HELMET & GOGGLES
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), uniformMat);
    head.position.set(0, 1.57, 0);
    head.castShadow = true;
    this.group.add(head);
    this.headMesh = head;

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7),
      helmetMat
    );
    helmet.position.set(0, 1.60, 0);
    this.group.add(helmet);

    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), visorMat);
    goggles.position.set(0, 1.59, 0.18);
    this.group.add(goggles);

    // 5. WEAPON IN HANDS (AK-47 Rifle)
    const gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.5), gunMetalMat);
    gunGroup.add(gunBody);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8).rotateX(Math.PI / 2), gunMetalMat);
    gunBarrel.position.set(0, 0.02, -0.42);
    gunGroup.add(gunBarrel);

    const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.08), gunMetalMat);
    gunMag.position.set(0, -0.1, -0.15);
    gunMag.rotation.x = 0.3;
    gunGroup.add(gunMag);

    // Muzzle flash on gun tip
    const flashGeo = new THREE.DodecahedronGeometry(0.08, 1);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2a3 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashLight = new THREE.PointLight(0xffaa22, 0, 8);
    this.muzzleFlashMesh.add(this.muzzleFlashLight);
    this.muzzleFlashMesh.position.set(0, 0.02, -0.65);
    this.muzzleFlashMesh.visible = false;
    gunGroup.add(this.muzzleFlashMesh);

    gunGroup.position.set(0.18, 1.07, -0.28);
    this.group.add(gunGroup);
    this.gunMesh = gunBody;

    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  private initPhysics() {
    const headBody = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.position.x,
        this.position.y + 1.57,
        this.position.z
      )
    );
    this.headCollider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.ball(0.22),
      headBody
    );
    this.physics.registerCustomCollider(this.headCollider.handle, 'bot_head', this.id);

    const chestBody = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.position.x,
        this.position.y + 1.07,
        this.position.z
      )
    );
    this.chestCollider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.28, 0.35, 0.22),
      chestBody
    );
    this.physics.registerCustomCollider(this.chestCollider.handle, 'bot_chest', this.id);

    const legsBody = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.position.x,
        this.position.y + 0.37,
        this.position.z
      )
    );
    this.legsCollider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.24, 0.36, 0.22),
      legsBody
    );
    this.physics.registerCustomCollider(this.legsCollider.handle, 'bot_legs', this.id);
  }

  // Snaps bot firmly to the environment ground level (no floating!)
  private snapToGround() {
    const checkStart = new THREE.Vector3(this.position.x, this.position.y + 2.5, this.position.z);
    const groundHit = this.physics.castRayEnvironment(checkStart, new THREE.Vector3(0, -1, 0), 20);

    if (groundHit) {
      this.position.y = groundHit.point.y;
    } else {
      this.position.y = 0.0;
    }
    this.velocityY = 0;
    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.updateColliderPositions(this.position);
  }

  public takeDamage(dmg: number, _hitbox: string): boolean {
    if (!this.isAlive) return false;
    this.health -= dmg;

    // React to being shot: immediately enter combat and evasive strafe
    this.state = 'engage';
    this.strafeChangeTimer = 0.2; // Immediately dodge!

    (this.vestMesh.material as THREE.MeshStandardMaterial).color.setHex(0xff3333);
    setTimeout(() => {
      if (this.isAlive) {
        (this.vestMesh.material as THREE.MeshStandardMaterial).color.setHex(0x181c22);
      }
    }, 120);

    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  public isRoundMode: boolean = true;

  private die() {
    this.isAlive = false;
    this.state = 'dead';
    this.respawnTimer = 4.0;
    this.muzzleFlashMesh.visible = false;
    this.muzzleFlashLight.intensity = 0;

    this.group.rotation.x = -Math.PI / 2;
    this.group.position.y = this.position.y + 0.15;

    this.updateColliderPositions(new THREE.Vector3(0, -100, 0));
  }

  public respawn() {
    this.isAlive = true;
    this.health = 100;
    this.magazineAmmo = 30;
    this.isReloading = false;
    this.burstShotsRemaining = 0;
    this.burstCooldownTimer = 0;
    this.state = 'patrol';
    this.currentWaypointIndex = 0;
    this.position.copy(this.spawnOrigin);
    this.group.rotation.set(0, 0, 0);
    this.group.position.copy(this.position);
    (this.vestMesh.material as THREE.MeshStandardMaterial).color.setHex(0x181c22);
    this.snapToGround();
  }

  // Reset bot for new CS2 round at spawn point
  public resetForNewRound(spawnPos: THREE.Vector3, waypoints: THREE.Vector3[]) {
    this.isAlive = true;
    this.health = 100;
    this.magazineAmmo = 30;
    this.isReloading = false;
    this.burstShotsRemaining = 0;
    this.burstCooldownTimer = 0;
    this.shotCadenceTimer = 0;
    this.state = 'patrol';
    this.currentWaypointIndex = 0;
    this.spawnOrigin.copy(spawnPos);
    this.position.copy(spawnPos);
    this.targetWaypoints = waypoints;
    this.group.rotation.set(0, 0, 0);
    this.group.position.copy(this.position);
    (this.vestMesh.material as THREE.MeshStandardMaterial).color.setHex(0x181c22);
    this.snapToGround();
  }

  private updateColliderPositions(pos: THREE.Vector3) {
    const crouchOffset = this.isCrouching ? -0.35 : 0;
    this.headCollider?.parent()?.setTranslation({ x: pos.x, y: pos.y + 1.57 + crouchOffset, z: pos.z }, true);
    this.chestCollider?.parent()?.setTranslation({ x: pos.x, y: pos.y + 1.07 + crouchOffset, z: pos.z }, true);
    this.legsCollider?.parent()?.setTranslation({ x: pos.x, y: pos.y + 0.37 + crouchOffset * 0.5, z: pos.z }, true);
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    if (!this.isAlive) {
      if (!this.isRoundMode) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.respawn();
        }
      }
      return;
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleFlashLight.intensity = 0;
      }
    }

    // 1. Raycast Line of Sight from Bot eye to Player chest/head
    const botEye = new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z);
    const playerTarget = new THREE.Vector3(playerPos.x, playerPos.y + 1.3, playerPos.z);
    const toPlayerVec = new THREE.Vector3().subVectors(playerTarget, botEye);
    const distToPlayer = toPlayerVec.length();
    const toPlayerDir = toPlayerVec.clone().normalize();

    // Start ray 0.6m forward from bot eye
    const rayStart = botEye.clone().addScaledVector(toPlayerDir, 0.6);
    const losHit = this.physics.castRay(rayStart, toPlayerDir, Math.min(distToPlayer, 75), [
      this.headCollider.handle,
      this.chestCollider.handle,
      this.legsCollider.handle,
    ]);

    // Bot can see player ONLY if no wall is hit before the player position!
    const canSeePlayer = (distToPlayer < 65) && (!losHit || losHit.distance >= (distToPlayer - 1.2));

    // 2. State Machine & Tactical Combat Movement
    if (canSeePlayer) {
      // Remember where we saw the player
      this.lastKnownPlayerPos.copy(playerPos);
      this.group.lookAt(new THREE.Vector3(playerPos.x, this.position.y, playerPos.z));

      if (this.state === 'patrol' || this.state === 'hunt') {
        this.state = 'spotted';
        this.reactionTimer = this.currentDifficulty.reactionTime;
      } else if (this.state === 'spotted') {
        this.reactionTimer -= dt;
        if (this.reactionTimer <= 0) {
          this.state = 'engage';
        }
      } else if (this.state === 'engage') {
        // --- DYNAMIC COMBAT MOVEMENT (STRAFING, DODGING, CROUCHING) ---
        this.strafeChangeTimer -= dt;
        if (this.strafeChangeTimer <= 0) {
          this.strafeDir = Math.random() > 0.5 ? 1 : -1;
          this.strafeChangeTimer = 1.0 + Math.random() * 1.5;

          // Hard and Expert bots crouch occasionally for accuracy
          if (this.currentDifficulty.aimAccuracy > 0.8 && Math.random() < 0.35) {
            this.isCrouching = true;
            this.crouchTimer = 0.9;
          }
        }

        // Handle crouching
        if (this.isCrouching) {
          this.crouchTimer -= dt;
          if (this.crouchTimer <= 0) {
            this.isCrouching = false;
          }
        }

        // Calculate strictly horizontal sideways strafe vector
        const toPlayerHoriz = new THREE.Vector3(playerPos.x - this.position.x, 0, playerPos.z - this.position.z).normalize();
        const strafeVec = new THREE.Vector3(-toPlayerHoriz.z, 0, toPlayerHoriz.x).multiplyScalar(this.strafeDir);

        // If low on health (< 45 HP) or too close (< 7m), step backward to retreat!
        if (this.health < 45 || distToPlayer < 7) {
          strafeVec.addScaledVector(toPlayerHoriz, -0.6);
        } else if (distToPlayer > 26) {
          // If too far, close in slightly while strafing
          strafeVec.addScaledVector(toPlayerHoriz, 0.4);
        }
        strafeVec.y = 0; // STRICTLY HORIZONTAL!
        strafeVec.normalize();

        // Check if path is clear of obstacles at bot waist height (y + 0.8)
        const waistCheckOrigin = new THREE.Vector3(this.position.x, this.position.y + 0.8, this.position.z);
        const moveCheck = this.physics.castRay(waistCheckOrigin, strafeVec, 1.2, [
          this.headCollider.handle,
          this.chestCollider.handle,
          this.legsCollider.handle,
        ]);

        if (!moveCheck) {
          // Path clear: move!
          const combatSpeed = this.isCrouching ? 1.8 : this.currentDifficulty.patrolSpeed * 0.85;
          this.position.x += strafeVec.x * combatSpeed * dt;
          this.position.z += strafeVec.z * combatSpeed * dt;
          this.isMoving = true;
        } else {
          // Hit an obstacle: flip strafe direction!
          this.strafeDir = -this.strafeDir;
          this.isMoving = false;
        }

        // --- CS2 TACTICAL BURST GUNPLAY (NO INFINITE LASER-STREAM!) ---
        if (this.isReloading) {
          this.reloadTimer -= dt;
          if (this.reloadTimer <= 0) {
            this.isReloading = false;
            this.magazineAmmo = 30;
          }
        } else {
          // Burst pause cooldown
          if (this.burstCooldownTimer > 0) {
            this.burstCooldownTimer -= dt;
          } else {
            // Time to fire burst rounds
            this.shotCadenceTimer -= dt;
            if (this.shotCadenceTimer <= 0) {
              if (this.burstShotsRemaining <= 0) {
                // Initialize burst count and subsequent pause based on difficulty
                if (this.difficultyName === 'easy') {
                  this.burstShotsRemaining = 2;
                  this.burstCooldownTimer = 0.85 + Math.random() * 0.35; // 0.85s - 1.2s pause
                } else if (this.difficultyName === 'medium') {
                  this.burstShotsRemaining = 2 + Math.floor(Math.random() * 2); // 2-3 shots
                  this.burstCooldownTimer = 0.55 + Math.random() * 0.25; // 0.55s - 0.8s pause
                } else if (this.difficultyName === 'hard') {
                  this.burstShotsRemaining = 3 + Math.floor(Math.random() * 2); // 3-4 shots
                  this.burstCooldownTimer = 0.35 + Math.random() * 0.18; // 0.35s - 0.53s pause
                } else {
                  // Expert
                  this.burstShotsRemaining = 3 + Math.floor(Math.random() * 3); // 3-5 shots
                  this.burstCooldownTimer = 0.22 + Math.random() * 0.14; // 0.22s - 0.36s pause
                }
              }

              this.shootAtPlayer(playerPos, this.burstShotsRemaining);
              this.magazineAmmo--;
              this.burstShotsRemaining--;
              this.shotCadenceTimer = 0.11; // 0.11s between burst bullets (AK-47 cyclic rate)

              // Check if magazine is empty
              if (this.magazineAmmo <= 0) {
                this.isReloading = true;
                this.reloadTimer = 2.4; // 2.4s tactical reload
                this.burstShotsRemaining = 0;
              }
            }
          }
        }
      }
    } else {
      // Line of sight lost: Player is behind a wall!
      this.isCrouching = false;

      if (this.state === 'engage' || this.state === 'spotted') {
        // Enter HUNT mode: actively run towards where the player was last seen!
        this.state = 'hunt';
        this.huntTimer = 5.0;
      }

      if (this.state === 'hunt') {
        this.huntTimer -= dt;
        const toLastKnown = new THREE.Vector3(this.lastKnownPlayerPos.x - this.position.x, 0, this.lastKnownPlayerPos.z - this.position.z);

        if (toLastKnown.lengthSq() > 3.0 && this.huntTimer > 0) {
          toLastKnown.normalize();
          this.isMoving = true;
          this.position.x += toLastKnown.x * this.currentDifficulty.patrolSpeed * dt;
          this.position.z += toLastKnown.z * this.currentDifficulty.patrolSpeed * dt;
          this.group.lookAt(new THREE.Vector3(this.lastKnownPlayerPos.x, this.position.y, this.lastKnownPlayerPos.z));
        } else {
          // Hunt expired: resume normal patrol
          this.state = 'patrol';
        }
      } else {
        // Standard Patrol along tactical waypoints
        this.state = 'patrol';
        if (this.targetWaypoints.length > 0) {
          const target = this.targetWaypoints[this.currentWaypointIndex];
          const toTarget = new THREE.Vector3(target.x - this.position.x, 0, target.z - this.position.z);

          if (toTarget.lengthSq() < 3.0) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.targetWaypoints.length;
          } else {
            this.isMoving = true;
            toTarget.normalize();
            this.position.x += toTarget.x * this.currentDifficulty.patrolSpeed * dt;
            this.position.z += toTarget.z * this.currentDifficulty.patrolSpeed * dt;
            this.group.lookAt(new THREE.Vector3(target.x, this.position.y, target.z));
          }
        }
      }
    }

    // 3. FIRM GROUND ADHERENCE & GRAVITY (NO FLOATING EVER!)
    // Cast ray from 2.0m above bot straight down against static environment geometry
    const rayDownOrigin = new THREE.Vector3(this.position.x, this.position.y + 2.0, this.position.z);
    const groundHit = this.physics.castRayEnvironment(rayDownOrigin, new THREE.Vector3(0, -1, 0), 20);

    let targetFloorY = 0.0;
    if (groundHit) {
      targetFloorY = groundHit.point.y;
    }

    // If bot walked off a box or platform, fall naturally with gravity
    if (this.position.y > targetFloorY + 0.12) {
      this.velocityY += -20.0 * dt;
      this.position.y += this.velocityY * dt;
      if (this.position.y <= targetFloorY) {
        this.position.y = targetFloorY;
        this.velocityY = 0;
      }
    } else {
      // Snapped firmly to the ground surface
      this.position.y = targetFloorY;
      this.velocityY = 0;
    }

    // Sync 3D group position with exact coordinates
    this.group.position.set(this.position.x, this.position.y, this.position.z);

    // 4. ANIMATE RUNNING / WALKING LEGS & ARMS
    if (this.isMoving) {
      this.walkTimer += dt * this.currentDifficulty.patrolSpeed * 3.8;
      const legAngle = Math.sin(this.walkTimer) * 0.7;
      this.legL.rotation.x = legAngle;
      this.legR.rotation.x = -legAngle;

      this.armL.rotation.x = 0.6 - legAngle * 0.5;
      this.armR.rotation.x = 0.8 + legAngle * 0.5;
    } else {
      this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0, dt * 10);
      this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0, dt * 10);
    }

    // Crouch visual height adjustment
    if (this.isCrouching) {
      this.group.position.y -= 0.35;
    }

    this.updateColliderPositions(this.position);
  }

  // Physical Bullet Raycast - 100% CANNOT PENETRATE WALLS!
  private shootAtPlayer(playerPos: THREE.Vector3, burstIndex: number) {
    this.sound.playGunshot('ak47', this.position);

    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashLight.intensity = 4.0;
    this.muzzleTimer = 0.06;

    const gunTip = new THREE.Vector3();
    this.muzzleFlashMesh.getWorldPosition(gunTip);

    // Aim target at player chest (y + 1.25)
    const aimTarget = playerPos.clone();
    aimTarget.y += 1.25;

    // CS2 Recoil rise for successive bullets in the burst
    const burstRise = (3 - Math.min(burstIndex, 3)) * 0.08;
    aimTarget.y += burstRise;

    // Movement & crouch inaccuracy
    const movementSpread = this.isMoving ? 1.7 : 1.0;
    const crouchBonus = this.isCrouching ? 0.65 : 1.0;
    const accuracy = this.currentDifficulty.aimAccuracy;
    const spread = (1.0 - accuracy) * 0.05 * movementSpread * crouchBonus;

    aimTarget.x += (Math.random() - 0.5) * spread * 10;
    aimTarget.y += (Math.random() - 0.5) * spread * 6;
    aimTarget.z += (Math.random() - 0.5) * spread * 10;

    const bulletDir = new THREE.Vector3().subVectors(aimTarget, gunTip).normalize();

    // Physical Raycast for Bullet from Gun Tip
    const bulletHit = this.physics.castRay(gunTip, bulletDir, 85, [
      this.headCollider.handle,
      this.chestCollider.handle,
      this.legsCollider.handle,
    ]);

    if (bulletHit) {
      const colliderInfo = this.physics.getColliderInfo(bulletHit.collider.handle);

      // IF HIT A WALL OR OBSTACLE BEFORE REACHING PLAYER:
      if (!colliderInfo || colliderInfo.type !== 'player') {
        // Bullet strikes the wall! Tracer ends at the wall!
        this.onSpawnTracer(gunTip, bulletHit.point);
        // NO DAMAGE! Wall completely blocks bullet!
        return;
      }

      // DIRECT HIT ON PLAYER!
      this.onSpawnTracer(gunTip, bulletHit.point);

      const isHeadshot = bulletHit.point.y > (playerPos.y + 1.58);
      let baseDamage = 12;
      if (this.difficultyName === 'easy') {
        baseDamage = isHeadshot ? 22 : 9;
      } else if (this.difficultyName === 'medium') {
        baseDamage = isHeadshot ? 30 : 13;
      } else if (this.difficultyName === 'hard') {
        baseDamage = isHeadshot ? 42 : 18;
      } else {
        // Expert
        baseDamage = isHeadshot ? 55 : 24;
      }
      this.onBotShootPlayer(baseDamage);
    } else {
      // Missed into distance
      const tracerEnd = gunTip.clone().addScaledVector(bulletDir, 60);
      this.onSpawnTracer(gunTip, tracerEnd);
    }
  }

  public setDifficulty(diff: BotDifficulty) {
    this.difficultyName = diff;
    this.currentDifficulty = BOT_DIFFICULTY_CONFIGS[diff];
  }
}

export class BotManager {
  public bots: Bot[] = [];

  constructor(
    private scene: THREE.Scene,
    private physics: PhysicsWorld,
    private sound: SoundManager,
    private onPlayerDamaged: (damage: number) => void,
    private onSpawnTracer: (from: THREE.Vector3, to: THREE.Vector3) => void
  ) {}

  public spawnBots(
    spawnPoints: THREE.Vector3[],
    count: number,
    difficulty: BotDifficulty,
    botRoutes?: THREE.Vector3[][]
  ) {
    this.clearBots();

    const botNames = [
      'Bot Danil', 'Bot Timur', 'Bot Farrukh', 'Bot Jasur',
      'Bot Shoxrux', 'Bot Alex', 'Bot Viktor', 'Bot Roman'
    ];

    for (let i = 0; i < count && i < spawnPoints.length; i++) {
      const spawn = spawnPoints[i];
      let waypoints: THREE.Vector3[] = [];

      if (botRoutes && botRoutes[i] && botRoutes[i].length > 0) {
        waypoints = botRoutes[i].map((pt) => pt.clone());
      } else {
        waypoints = [
          spawn.clone(),
          spawnPoints[(i + 1) % spawnPoints.length].clone(),
          spawnPoints[(i + 2) % spawnPoints.length].clone(),
        ];
      }

      const bot = new Bot(
        `bot_${i}`,
        botNames[i % botNames.length],
        spawn,
        waypoints,
        difficulty,
        this.scene,
        this.physics,
        this.sound,
        (dmg) => this.onPlayerDamaged(dmg),
        (from, to) => this.onSpawnTracer(from, to)
      );

      this.bots.push(bot);
    }
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    for (const bot of this.bots) {
      bot.update(dt, playerPos);
    }
  }

  public setDifficulty(diff: BotDifficulty) {
    for (const bot of this.bots) {
      bot.setDifficulty(diff);
    }
  }

  public getAliveBotsCount(): number {
    return this.bots.filter((b) => b.isAlive).length;
  }

  public setRoundMode(isRoundMode: boolean) {
    for (const bot of this.bots) {
      bot.isRoundMode = isRoundMode;
    }
  }

  public resetAllBotsForNewRound(spawnPoints: THREE.Vector3[], botRoutes?: THREE.Vector3[][]) {
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const spawn = spawnPoints[i % spawnPoints.length];
      let waypoints: THREE.Vector3[] = [];

      if (botRoutes && botRoutes[i % botRoutes.length] && botRoutes[i % botRoutes.length].length > 0) {
        waypoints = botRoutes[i % botRoutes.length].map((pt) => pt.clone());
      } else {
        waypoints = [
          spawn.clone(),
          spawnPoints[(i + 1) % spawnPoints.length].clone(),
          spawnPoints[(i + 2) % spawnPoints.length].clone(),
        ];
      }

      bot.resetForNewRound(spawn, waypoints);
    }
  }

  public clearBots() {
    for (const bot of this.bots) {
      this.scene.remove(bot.group);
    }
    this.bots = [];
  }
}
