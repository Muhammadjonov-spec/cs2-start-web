import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SoundManager } from '../audio/SoundManager';

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public characterController!: RAPIER.KinematicCharacterController;
  public collider!: RAPIER.Collider;
  public position: THREE.Vector3 = new THREE.Vector3(0, 2, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3();

  // CS2 Camera and Rotation
  public yaw: number = 0;
  public pitch: number = 0;
  public mouseSensitivity: number = 0.0022;

  // Key states
  public keys: { [key: string]: boolean } = {};
  public isGrounded: boolean = false;
  public isCrouching: boolean = false;
  public isWalking: boolean = false;

  // Mobile Touch Inputs
  public touchMoveVector: { x: number; y: number } = { x: 0, y: 0 };
  public touchJumpPressed: boolean = false;
  public touchCrouchActive: boolean = false;

  // View Bobbing & Footsteps
  private bobTimer: number = 0;
  public currentBobOffset: THREE.Vector3 = new THREE.Vector3();
  private footstepTimer: number = 0;

  // Movement Constants (CS2 Units converted to m/s: 1 CS unit ≈ 0.0254 m)
  private readonly STAND_HEIGHT = 1.65;
  private readonly CROUCH_HEIGHT = 1.15;
  private currentEyeHeight = 1.65;
  public currentSpeedMult: number = 1.0;

  constructor(
    camera: THREE.PerspectiveCamera,
    private physics: PhysicsWorld,
    private sound: SoundManager,
    private domElement: HTMLElement
  ) {
    this.camera = camera;
    this.setupInputs();
  }

  public init() {
    // Kinematic Character Controller in Rapier
    const offset = 0.05;
    this.characterController = this.physics.world.createCharacterController(offset);
    this.characterController.enableAutostep(0.35, 0.2, true);
    this.characterController.enableSnapToGround(0.3);
    this.characterController.setApplyImpulsesToDynamicBodies(true);

    // Player Capsule Collider: radius 0.35m, half-height 0.5m, centered at height 0.85m
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      this.position.x,
      this.position.y,
      this.position.z
    );
    const rigidBody = this.physics.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.35).setTranslation(0, 0.85, 0);
    this.collider = this.physics.world.createCollider(colliderDesc, rigidBody);
    this.physics.registerCustomCollider(this.collider.handle, 'player');
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.domElement) {
        this.yaw -= e.movementX * this.mouseSensitivity;
        this.pitch -= e.movementY * this.mouseSensitivity;
        // Clamp pitch (-89 to +89 degrees)
        this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
      }
    });
  }

  public addLookDelta(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch -= dy;
    // Clamp pitch (-89 to +89 degrees)
    this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
  }

  public getColliderHandle(): number {
    return this.collider?.handle ?? -1;
  }

  public setPosition(x: number, y: number, z: number, yaw: number = 0) {
    this.position.set(x, y, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.currentBobOffset.set(0, 0, 0);
    this.collider.parent()?.setTranslation({ x, y, z }, true);
    this.velocity.set(0, 0, 0);
  }

  public update(dt: number, currentWeaponSpeed: number, isScoped: boolean = false) {
    // 1. Calculate Target Speed (CS2 1:1 speed scaling)
    let baseSpeed = currentWeaponSpeed * 0.0254; // Convert CS units to m/s
    if (isScoped) baseSpeed *= 0.5;

    this.isCrouching = !!(this.keys['ControlLeft'] || this.keys['ControlRight'] || this.touchCrouchActive);
    this.isWalking = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

    let targetSpeed = baseSpeed;
    if (this.isCrouching) {
      targetSpeed = baseSpeed * 0.34;
    } else if (this.isWalking) {
      targetSpeed = baseSpeed * 0.52;
    }

    // 2. Smooth Eye Height transition (Crouching)
    const targetHeight = this.isCrouching ? this.CROUCH_HEIGHT : this.STAND_HEIGHT;
    this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetHeight, dt * 14);

    // 3. Movement Direction from WASD + Virtual Touch Joystick
    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW']) moveDir.z -= 1;
    if (this.keys['KeyS']) moveDir.z += 1;
    if (this.keys['KeyA']) moveDir.x -= 1;
    if (this.keys['KeyD']) moveDir.x += 1;

    // Analog virtual joystick input (Counter Mobile / Standoff 2 analog response)
    const touchMag = Math.sqrt(this.touchMoveVector.x ** 2 + this.touchMoveVector.y ** 2);
    if (touchMag > 0.08) {
      moveDir.x += this.touchMoveVector.x;
      moveDir.z += this.touchMoveVector.y;

      if (!this.isCrouching && !this.isWalking) {
        if (touchMag < 0.65) {
          // Slow tactical walk on light drag
          targetSpeed = baseSpeed * (0.35 + touchMag * 0.45);
        } else {
          // Full run on full push
          targetSpeed = baseSpeed;
        }
      }
    }

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      // Rotate by Yaw
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }

    // 4. CS2 Acceleration & Counter-Strafing
    const accel = this.isGrounded ? 12.0 : 2.5; // Air accelerate
    const friction = this.isGrounded ? 8.5 : 0.2;

    const horizontalVel = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);

    if (moveDir.lengthSq() > 0) {
      const targetHorizVel = moveDir.clone().multiplyScalar(targetSpeed);
      horizontalVel.lerp(targetHorizVel, Math.min(1.0, dt * accel));
    } else {
      // Counter-strafing rapid friction to zero
      horizontalVel.lerp(new THREE.Vector3(0, 0, 0), Math.min(1.0, dt * friction));
    }

    this.velocity.x = horizontalVel.x;
    this.velocity.z = horizontalVel.z;

    // 5. Jump & Gravity
    const gravity = -20.32; // Snappy CS2 gravity
    if (this.isGrounded) {
      if (this.velocity.y < 0) this.velocity.y = -1.0; // Stay snapped to floor
      if (this.keys['Space'] || this.touchJumpPressed) {
        this.velocity.y = 6.2; // CS2 jump impulse
        this.isGrounded = false;
        this.touchJumpPressed = false;
      }
    } else {
      this.velocity.y += gravity * dt;
    }

    // 6. Rapier Character Controller Movement
    const movement = new THREE.Vector3()
      .copy(this.velocity)
      .multiplyScalar(dt);

    this.characterController.computeColliderMovement(this.collider, {
      x: movement.x,
      y: movement.y,
      z: movement.z,
    });

    const correctedMovement = this.characterController.computedMovement();
    this.isGrounded = this.characterController.computedGrounded();

    const currentPos = this.collider.parent()?.translation();
    if (currentPos) {
      const newPos = {
        x: currentPos.x + correctedMovement.x,
        y: currentPos.y + correctedMovement.y,
        z: currentPos.z + correctedMovement.z,
      };
      this.collider.parent()?.setTranslation(newPos, true);
      this.position.set(newPos.x, newPos.y, newPos.z);
    }

    // 7. View Bobbing and Footsteps
    const currentHorizSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    this.currentSpeedMult = currentHorizSpeed / (baseSpeed || 1);

    if (this.isGrounded && currentHorizSpeed > 0.5) {
      this.bobTimer += dt * currentHorizSpeed * 2.8;
      this.currentBobOffset.x = Math.cos(this.bobTimer * 0.5) * 0.025;
      this.currentBobOffset.y = Math.abs(Math.sin(this.bobTimer)) * 0.02;

      // Footstep sound
      if (!this.isWalking && !this.isCrouching) {
        this.footstepTimer += dt * currentHorizSpeed;
        if (this.footstepTimer > 1.8) {
          this.sound.playFootstep();
          this.footstepTimer = 0;
        }
      }
    } else {
      this.currentBobOffset.lerp(new THREE.Vector3(), dt * 8);
    }

    // 8. Update Camera Position & Rotation
    this.camera.position.set(
      this.position.x + this.currentBobOffset.x,
      this.position.y + this.currentEyeHeight + this.currentBobOffset.y,
      this.position.z
    );

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(euler);

    // Update audio listener position
    this.sound.updateListener(this.camera.position);
  }

  public getForward(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }
}
