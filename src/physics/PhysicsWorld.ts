import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface RayHit {
  collider: RAPIER.Collider;
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

export class PhysicsWorld {
  public world!: RAPIER.World;
  private initialized: boolean = false;
  private collidersMap: Map<number, { type: string; id?: string }> = new Map();
  private staticBodies: RAPIER.RigidBody[] = [];

  public async init() {
    await RAPIER.init();
    // CS2 gravity: 800 units/s^2 ≈ -20.32 m/s^2
    const gravity = { x: 0.0, y: -20.32, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.initialized = true;
  }

  public step(dt: number) {
    if (!this.initialized) return;
    this.world.timestep = Math.min(dt, 0.1);
    this.world.step();
  }

  // Clear all static environment colliders when reloading or switching maps
  public clearStaticEnvironment() {
    if (!this.initialized) return;
    for (const body of this.staticBodies) {
      try {
        this.world.removeRigidBody(body);
      } catch {
        // Body already removed
      }
    }
    this.staticBodies = [];
  }

  // Create Static Box Collider (Walls, Floors, Crates)
  public createStaticBox(
    pos: THREE.Vector3,
    halfExtents: THREE.Vector3,
    type: string = 'environment',
    id?: string
  ): RAPIER.Collider {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    const collider = this.world.createCollider(colliderDesc, rigidBody);
    
    this.staticBodies.push(rigidBody);
    this.collidersMap.set(collider.handle, { type, id });
    return collider;
  }

  // Raycast with exclusion support (e.g. ignore shooter's own head/body)
  public castRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxToi: number = 200,
    ignoredHandles: number[] = []
  ): RayHit | null {
    if (!this.initialized) return null;

    let currentOrigin = origin.clone();
    let remainingToi = maxToi;
    let accumulatedDistance = 0;

    for (let step = 0; step < 8; step++) {
      const ray = new RAPIER.Ray(
        { x: currentOrigin.x, y: currentOrigin.y, z: currentOrigin.z },
        { x: direction.x, y: direction.y, z: direction.z }
      );

      const hit = this.world.castRayAndGetNormal(ray, remainingToi, true);
      if (!hit) return null;

      // If hit an ignored collider (e.g. shooter's own body), step forward through it!
      if (ignoredHandles.includes(hit.collider.handle)) {
        const stepDist = hit.timeOfImpact + 0.08;
        accumulatedDistance += stepDist;
        remainingToi -= stepDist;
        if (remainingToi <= 0) return null;
        currentOrigin.addScaledVector(direction, stepDist);
        continue;
      }

      const totalDist = accumulatedDistance + hit.timeOfImpact;
      const hitPoint = origin.clone().addScaledVector(direction, totalDist);
      const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);

      return {
        collider: hit.collider,
        distance: totalDist,
        point: hitPoint,
        normal: normal,
      };
    }

    return null;
  }

  // Raycast that ONLY hits static environment geometry (strictly ignores bots, player, and dynamic hitboxes)
  public castRayEnvironment(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxToi: number = 50
  ): RayHit | null {
    if (!this.initialized) return null;

    let currentOrigin = origin.clone();
    let remainingToi = maxToi;
    let accumulatedDistance = 0;

    for (let step = 0; step < 10; step++) {
      const ray = new RAPIER.Ray(
        { x: currentOrigin.x, y: currentOrigin.y, z: currentOrigin.z },
        { x: direction.x, y: direction.y, z: direction.z }
      );

      const hit = this.world.castRayAndGetNormal(ray, remainingToi, true);
      if (!hit) return null;

      const info = this.collidersMap.get(hit.collider.handle);
      // If it's a bot or player or anything not marked as environment, step forward through it!
      if (info && info.type !== 'environment') {
        const stepDist = hit.timeOfImpact + 0.05;
        accumulatedDistance += stepDist;
        remainingToi -= stepDist;
        if (remainingToi <= 0) return null;
        currentOrigin.addScaledVector(direction, stepDist);
        continue;
      }

      const totalDist = accumulatedDistance + hit.timeOfImpact;
      const hitPoint = origin.clone().addScaledVector(direction, totalDist);
      const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);

      return {
        collider: hit.collider,
        distance: totalDist,
        point: hitPoint,
        normal: normal,
      };
    }

    return null;
  }

  public getColliderInfo(handle: number) {
    return this.collidersMap.get(handle);
  }

  public registerCustomCollider(handle: number, type: string, id?: string) {
    this.collidersMap.set(handle, { type, id });
  }
}
