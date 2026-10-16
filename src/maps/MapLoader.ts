import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MapId } from '../types';
import { TextureGenerator } from '../graphics/TextureGenerator';

export interface MapData {
  id: MapId;
  name: string;
  playerSpawn: THREE.Vector3;
  playerYaw: number;
  botSpawns: THREE.Vector3[];
  botRoutes: THREE.Vector3[][];
  skyTexture: THREE.CanvasTexture;
  sunColor: number;
}

export class MapLoader {
  private currentMapGroup: THREE.Group = new THREE.Group();

  constructor(private scene: THREE.Scene, private physics: PhysicsWorld) {
    this.scene.add(this.currentMapGroup);
  }

  public loadMap(mapId: MapId): MapData {
    // 1. CLEAR PREVIOUS 3D MESHES
    while (this.currentMapGroup.children.length > 0) {
      this.currentMapGroup.remove(this.currentMapGroup.children[0]);
    }

    // 2. CRITICAL: PURGE ALL OLD GHOST COLLIDERS FROM PHYSICS WORLD!
    this.physics.clearStaticEnvironment();

    if (mapId === 'tashkent') {
      return this.buildTashkentMap();
    } else {
      return this.buildDust2Map();
    }
  }

  // 1:1 High-Fidelity de_dust2 (Dust II) Map
  private buildDust2Map(): MapData {
    const wallPBR = TextureGenerator.createDust2Wall();
    wallPBR.map.repeat.set(6, 2);
    wallPBR.normalMap.repeat.set(6, 2);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallPBR.map,
      normalMap: wallPBR.normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.85,
      metalness: 0.05,
    });

    const groundPBR = TextureGenerator.createDust2Ground();
    groundPBR.map.repeat.set(16, 16);
    groundPBR.normalMap.repeat.set(16, 16);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundPBR.map,
      normalMap: groundPBR.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.9,
      metalness: 0.0,
    });

    const woodCratePBR = TextureGenerator.createWoodCrate();
    const crateMat = new THREE.MeshStandardMaterial({
      map: woodCratePBR.map,
      normalMap: woodCratePBR.normalMap,
      roughness: 0.7,
      metalness: 0.15,
    });

    const containerBlue = TextureGenerator.createContainer('#1e4878');
    containerBlue.map.repeat.set(3, 1);
    containerBlue.normalMap.repeat.set(3, 1);
    const blueContainerMat = new THREE.MeshStandardMaterial({
      map: containerBlue.map,
      normalMap: containerBlue.normalMap,
      roughness: 0.45,
      metalness: 0.7,
    });

    const containerRed = TextureGenerator.createContainer('#8a3224');
    containerRed.map.repeat.set(3, 1);
    containerRed.normalMap.repeat.set(3, 1);
    const redContainerMat = new THREE.MeshStandardMaterial({
      map: containerRed.map,
      normalMap: containerRed.normalMap,
      roughness: 0.45,
      metalness: 0.7,
    });

    // Main Ground Floor (120m x 120m)
    this.createStaticBlock(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(120, 1, 120), groundMat);

    // Perimeter Fortress Walls
    this.createStaticBlock(new THREE.Vector3(0, 5, -60), new THREE.Vector3(120, 10, 3), wallMat);
    this.createStaticBlock(new THREE.Vector3(0, 5, 60), new THREE.Vector3(120, 10, 3), wallMat);
    this.createStaticBlock(new THREE.Vector3(-60, 5, 0), new THREE.Vector3(3, 10, 120), wallMat);
    this.createStaticBlock(new THREE.Vector3(60, 5, 0), new THREE.Vector3(3, 10, 120), wallMat);

    // --- LONG A SECTION ---
    this.createStaticBlock(new THREE.Vector3(30, 4.5, 10), new THREE.Vector3(2.5, 9, 44), wallMat);
    this.createStaticBlock(new THREE.Vector3(45, 4.5, 10), new THREE.Vector3(2.5, 9, 44), wallMat);

    // Long A Arched Entrance
    this.createArchway(new THREE.Vector3(37.5, 0, 30), 8, 7, wallMat);

    // Long A Blue Container
    this.createStaticBlock(new THREE.Vector3(35, 1.3, 12), new THREE.Vector3(2.6, 2.6, 6.2), blueContainerMat);

    // Long A Pit & Ramp
    this.createStaticBlock(new THREE.Vector3(42, -0.5, 38), new THREE.Vector3(12, 1, 12), groundMat);
    this.createStaticBlock(new THREE.Vector3(36, 1.5, 36), new THREE.Vector3(8, 3, 2), wallMat);

    // --- A SITE PLATFORM ---
    this.createStaticBlock(new THREE.Vector3(38, 0.5, -25), new THREE.Vector3(26, 1, 26), groundMat);
    this.createStaticBlock(new THREE.Vector3(38, 0.25, -12), new THREE.Vector3(8, 0.5, 6), groundMat);
    this.createStaticBlock(new THREE.Vector3(49, 4.5, -30), new THREE.Vector3(2.5, 9, 16), wallMat);

    // A-Site Double Crates
    this.createStaticBlock(new THREE.Vector3(35, 2.2, -24), new THREE.Vector3(2.4, 2.4, 2.4), crateMat);
    this.createStaticBlock(new THREE.Vector3(37.5, 2.2, -24), new THREE.Vector3(2.4, 2.4, 2.4), crateMat);
    this.createStaticBlock(new THREE.Vector3(36.2, 4.0, -24), new THREE.Vector3(2.2, 1.6, 2.2), crateMat);

    // Oil Barrels
    this.createBarrel(new THREE.Vector3(39, 1.65, -21), 0x27ae60);
    this.createBarrel(new THREE.Vector3(40, 1.65, -21), 0x27ae60);
    this.createBarrel(new THREE.Vector3(39.5, 1.65, -22), 0xc0392b);

    // --- MIDDLE & CATWALK ---
    this.createStaticBlock(new THREE.Vector3(12, 5, 0), new THREE.Vector3(2.5, 10, 64), wallMat);
    this.createStaticBlock(new THREE.Vector3(1, 3, -15), new THREE.Vector3(3.8, 6, 0.4), crateMat);
    this.createStaticBlock(new THREE.Vector3(6, 3, -15), new THREE.Vector3(3.8, 6, 0.4), crateMat);
    this.createArchway(new THREE.Vector3(3.5, 0, -15), 9, 8, wallMat);

    // Xbox Crate
    this.createStaticBlock(new THREE.Vector3(4, 1.25, 6), new THREE.Vector3(2.5, 2.5, 2.5), crateMat);

    // Catwalk / Short
    this.createStaticBlock(new THREE.Vector3(18, 1.5, -10), new THREE.Vector3(14, 3, 10), groundMat);
    this.createStaticBlock(new THREE.Vector3(22, 2.5, -15), new THREE.Vector3(2.2, 2.2, 2.2), crateMat);

    // --- B SITE SECTION ---
    this.createStaticBlock(new THREE.Vector3(-36, 0.5, -25), new THREE.Vector3(28, 1, 28), groundMat);
    this.createStaticBlock(new THREE.Vector3(-22, 5, -25), new THREE.Vector3(2.5, 10, 28), wallMat);
    this.createArchway(new THREE.Vector3(-22, 0, -16), 5, 6, wallMat);
    this.createStaticBlock(new THREE.Vector3(-22, 5.5, -30), new THREE.Vector3(2.5, 3, 4), wallMat);

    // B Tunnels Corridor
    this.createStaticBlock(new THREE.Vector3(-38, 3.5, 8), new THREE.Vector3(14, 7, 30), wallMat);

    // B Red Container & Big Box
    this.createStaticBlock(new THREE.Vector3(-38, 2.3, -22), new THREE.Vector3(2.6, 2.6, 6.2), redContainerMat);
    this.createStaticBlock(new THREE.Vector3(-32, 2.2, -26), new THREE.Vector3(2.5, 2.5, 2.5), crateMat);
    this.createBarrel(new THREE.Vector3(-34, 1.65, -28), 0xe67e22);

    this.createStreetLantern(new THREE.Vector3(32, 0, 20));
    this.createStreetLantern(new THREE.Vector3(44, 1, -22));
    this.createStreetLantern(new THREE.Vector3(-24, 1, -20));

    return {
      id: 'dust2',
      name: 'de_dust2 (Dust II)',
      // Authentic CT Spawn: Behind Mid doors & between Sites
      playerSpawn: new THREE.Vector3(-12, 0.1, -40),
      playerYaw: Math.PI, // Facing South towards Mid doors and Catwalk
      // Authentic T Spawns: Opposite end of the map (z = 45..50)
      botSpawns: [
        new THREE.Vector3(0, 0.1, 48),    // T Spawn Center (rushing Mid)
        new THREE.Vector3(-14, 0.1, 46),  // T Spawn West (rushing B Tunnels)
        new THREE.Vector3(14, 0.1, 46),   // T Spawn East (rushing Long A)
        new THREE.Vector3(38, 0.1, 32),   // Outside Long Doors
        new THREE.Vector3(-38, 0.1, 22),  // Upper Tunnels Entrance
        new THREE.Vector3(-5, 0.1, 50),   // T Spawn Plateau (rushing Short/Catwalk)
      ],
      botRoutes: [
        // Route 0: Mid Rush
        [new THREE.Vector3(0, 0.1, 48), new THREE.Vector3(2, 0.1, 24), new THREE.Vector3(3.5, 0.1, 0), new THREE.Vector3(3.5, 0.1, -12), new THREE.Vector3(-6, 0.1, -28)],
        // Route 1: B Tunnels Rush
        [new THREE.Vector3(-14, 0.1, 46), new THREE.Vector3(-38, 0.1, 22), new THREE.Vector3(-38, 0.1, 2), new THREE.Vector3(-35, 0.5, -18), new THREE.Vector3(-25, 0.5, -24)],
        // Route 2: Long A Rush
        [new THREE.Vector3(14, 0.1, 46), new THREE.Vector3(38, 0.1, 32), new THREE.Vector3(37, 0.1, 14), new THREE.Vector3(38, 0.5, -8), new THREE.Vector3(36, 0.5, -22)],
        // Route 3: Pit to A Site
        [new THREE.Vector3(38, 0.1, 32), new THREE.Vector3(42, 0.1, 18), new THREE.Vector3(38, 0.5, -10), new THREE.Vector3(32, 0.5, -24)],
        // Route 4: Tunnels to Lower Mid
        [new THREE.Vector3(-38, 0.1, 22), new THREE.Vector3(-30, 0.1, 8), new THREE.Vector3(-15, 0.1, 0), new THREE.Vector3(3, 0.1, -5)],
        // Route 5: Catwalk / Short Rush
        [new THREE.Vector3(-5, 0.1, 50), new THREE.Vector3(4, 0.1, 20), new THREE.Vector3(14, 1.5, -4), new THREE.Vector3(20, 1.5, -12), new THREE.Vector3(32, 0.5, -22)],
      ],
      skyTexture: TextureGenerator.createSkyTexture(true),
      sunColor: 0xfffaed,
    };
  }

  // Realistic CS2 de_tashkent (Urban City Environment with TV Tower)
  private buildTashkentMap(): MapData {
    // 1. High-Detail PBR Materials (NO blinding flat white!)
    const roadPBR = TextureGenerator.createAsphaltRoad();
    roadPBR.map.repeat.set(4, 16);
    roadPBR.normalMap.repeat.set(4, 16);
    const asphaltMat = new THREE.MeshStandardMaterial({
      map: roadPBR.map,
      normalMap: roadPBR.normalMap,
      roughness: 0.85,
    });

    const granitePBR = TextureGenerator.createUrbanGranite();
    granitePBR.map.repeat.set(8, 8);
    granitePBR.normalMap.repeat.set(8, 8);
    const granitePlazaMat = new THREE.MeshStandardMaterial({
      map: granitePBR.map,
      normalMap: granitePBR.normalMap,
      roughness: 0.65,
    });

    const buildingFacadeTex = TextureGenerator.createBuildingFacade();
    buildingFacadeTex.repeat.set(4, 2);
    const buildingMat = new THREE.MeshStandardMaterial({
      map: buildingFacadeTex,
      roughness: 0.75,
    });

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x4a5058,
      roughness: 0.8,
    });

    const foliageTex = TextureGenerator.createFoliageTexture();
    const foliageMat = new THREE.MeshStandardMaterial({
      map: foliageTex,
      roughness: 0.9,
    });

    const blueDomeMat = new THREE.MeshStandardMaterial({
      color: 0x0984e3,
      roughness: 0.35,
      metalness: 0.6,
    });

    // 2. Main Avenue Ground (Dark Tarmac Asphalt)
    this.createStaticBlock(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(130, 1, 130), asphaltMat);

    // 3. Central Promenade Plaza (Textured Granite Stone)
    this.createStaticBlock(new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(44, 0.2, 84), granitePlazaMat);

    // Stone Curbs bordering the plaza
    this.createStaticBlock(new THREE.Vector3(22.2, 0.2, 0), new THREE.Vector3(0.5, 0.4, 84), curbMat);
    this.createStaticBlock(new THREE.Vector3(-22.2, 0.2, 0), new THREE.Vector3(0.5, 0.4, 84), curbMat);

    // 4. TASHKENT TV TOWER (Detailed Industrial Steel Lattice & Aviation Lighting)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(0, 0, -115);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2d3436, metalness: 0.85, roughness: 0.3 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.7, roughness: 0.25 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.1, metalness: 0.9 });

    // 3 Massive Curved Tripod Lattice Legs with Cross Bracing
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 4.2, 55, 12), steelMat);
      leg.position.set(Math.cos(angle) * 18, 26, Math.sin(angle) * 18);
      leg.rotation.z = Math.cos(angle) * 0.22;
      leg.rotation.x = -Math.sin(angle) * 0.22;
      towerGroup.add(leg);
    }

    // Circular Restaurant & Observation Deck
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(20, 16, 12, 32), deckMat);
    deck.position.set(0, 56, 0);
    towerGroup.add(deck);

    // Observation Windows Strip around the Deck
    const winRing = new THREE.Mesh(new THREE.CylinderGeometry(18.2, 18.2, 3.5, 32, 1, true), windowMat);
    winRing.position.set(0, 56, 0);
    towerGroup.add(winRing);

    // Central Transmission Column
    const col = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.8, 75, 16), steelMat);
    col.position.set(0, 96, 0);
    towerGroup.add(col);

    // Red & White Striped Spire
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.8, 110, 12), new THREE.MeshStandardMaterial({ color: 0xd63031, metalness: 0.5 }));
    spire.position.set(0, 180, 0);
    towerGroup.add(spire);

    // Glowing Aviation Warning Beacon
    const beaconLight = new THREE.PointLight(0xff0000, 6, 250);
    beaconLight.position.set(0, 230, 0);
    towerGroup.add(beaconLight);

    this.currentMapGroup.add(towerGroup);

    // 5. AMIR TEMUR PARK & CENTRAL MONUMENT
    // Granite Monument Pedestal
    this.createStaticBlock(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(10, 2.8, 10), granitePlazaMat);
    this.createStaticBlock(new THREE.Vector3(0, 3.2, 0), new THREE.Vector3(5, 1.0, 5), steelMat);

    // Circular Stone Fountain
    const fountainRing = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.0, 32, 1, true), granitePlazaMat);
    fountainRing.position.set(0, 0.5, 0);
    this.currentMapGroup.add(fountainRing);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(13.5, 32),
      new THREE.MeshStandardMaterial({ color: 0x1b74e4, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.8 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.8, 0);
    this.currentMapGroup.add(water);

    // 6. SURROUNDING BUILDINGS WITH REAL WINDOWS & CORNICES (Site A & Site B)
    // Site A: Hotel / Business Complex Facade
    this.createStaticBlock(new THREE.Vector3(38, 7, -25), new THREE.Vector3(30, 14, 10), buildingMat);

    // Site B: Historic Registan/Chorsu Oriental Building & Turquoise Ribbed Dome
    this.createStaticBlock(new THREE.Vector3(-38, 5, 25), new THREE.Vector3(26, 10, 14), buildingMat);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2), blueDomeMat);
    dome.position.set(-38, 10, 25);
    this.currentMapGroup.add(dome);

    // 7. REALISTIC TREE MODELS (Multi-tiered organic canopies with leaf textures)
    for (let x = -26; x <= 26; x += 13) {
      if (Math.abs(x) < 5) continue;
      this.createRealisticTree(new THREE.Vector3(x, 0, -20), foliageMat);
      this.createRealisticTree(new THREE.Vector3(x, 0, 20), foliageMat);
    }

    // 8. TACTICAL URBAN COVER: BUS SHELTER & POLICE CARICADE (replaces flat yellow box!)
    this.createBusStopShelter(new THREE.Vector3(14, 0, 16));
    this.createConcreteBarricade(new THREE.Vector3(-16, 0, -12));
    this.createConcreteBarricade(new THREE.Vector3(16, 0, -8));

    // Street Lamps with warm ambient illumination
    this.createStreetLantern(new THREE.Vector3(18, 0, 8));
    this.createStreetLantern(new THREE.Vector3(-18, 0, 8));
    this.createStreetLantern(new THREE.Vector3(18, 0, -8));
    this.createStreetLantern(new THREE.Vector3(-18, 0, -8));

    // Outer Boundary City Walls with Architectural Texture
    this.createStaticBlock(new THREE.Vector3(0, 6, -65), new THREE.Vector3(130, 12, 3), buildingMat);
    this.createStaticBlock(new THREE.Vector3(0, 6, 65), new THREE.Vector3(130, 12, 3), buildingMat);
    this.createStaticBlock(new THREE.Vector3(-65, 6, 0), new THREE.Vector3(3, 12, 130), buildingMat);
    this.createStaticBlock(new THREE.Vector3(65, 6, 0), new THREE.Vector3(3, 12, 130), buildingMat);

    return {
      id: 'tashkent',
      name: 'de_tashkent (Toshkent Teleminorasi & Xiyobon)',
      // CT Spawn: South Plaza entrance (Amir Temur Avenue), facing the Teleminora
      playerSpawn: new THREE.Vector3(0, 0.1, 48),
      playerYaw: 0, // Facing North straight towards Tashkent TV Tower
      // Terrorist (Bot) Spawns: North Plaza approach & TV Tower base (70-90m away)
      botSpawns: [
        new THREE.Vector3(0, 0.1, -42),   // North Plaza Center
        new THREE.Vector3(26, 0.1, -38),  // North East Avenue
        new THREE.Vector3(-26, 0.1, -38), // North West Avenue
        new THREE.Vector3(34, 0.1, -20),  // Site A Courtyard
        new THREE.Vector3(-34, 0.1, -20), // Site B Courtyard
        new THREE.Vector3(0, 0.1, -28),   // Teleminora Plaza Gate
      ],
      botRoutes: [
        // Route 0: Central Promenade Push
        [new THREE.Vector3(0, 0.1, -42), new THREE.Vector3(0, 0.1, -20), new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0, 0.1, 25)],
        // Route 1: East Avenue Flank
        [new THREE.Vector3(26, 0.1, -38), new THREE.Vector3(28, 0.1, -15), new THREE.Vector3(28, 0.1, 10), new THREE.Vector3(18, 0.1, 32)],
        // Route 2: West Avenue Flank
        [new THREE.Vector3(-26, 0.1, -38), new THREE.Vector3(-28, 0.1, -15), new THREE.Vector3(-28, 0.1, 10), new THREE.Vector3(-18, 0.1, 32)],
        // Route 3: Site A to Center Fountain
        [new THREE.Vector3(34, 0.1, -20), new THREE.Vector3(22, 0.1, -5), new THREE.Vector3(10, 0.1, 15), new THREE.Vector3(4, 0.1, 35)],
        // Route 4: Site B to Center Fountain
        [new THREE.Vector3(-34, 0.1, -20), new THREE.Vector3(-22, 0.1, -5), new THREE.Vector3(-10, 0.1, 15), new THREE.Vector3(-4, 0.1, 35)],
        // Route 5: Teleminora Gate to South Plaza
        [new THREE.Vector3(0, 0.1, -28), new THREE.Vector3(-14, 0.1, -10), new THREE.Vector3(-6, 0.1, 15), new THREE.Vector3(0, 0.1, 35)],
      ],
      skyTexture: TextureGenerator.createSkyTexture(false),
      sunColor: 0xfff4e6,
    };
  }

  // Realistic Multi-Tiered Tree Model
  private createRealisticTree(pos: THREE.Vector3, foliageMat: THREE.Material) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2716, roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 4.2, 10), trunkMat);
    trunk.position.set(pos.x, pos.y + 2.1, pos.z);
    trunk.castShadow = true;
    this.currentMapGroup.add(trunk);

    // 3 Layered Canopy Volumes
    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 2), foliageMat);
    c1.position.set(pos.x, pos.y + 4.8, pos.z);
    c1.castShadow = true;
    this.currentMapGroup.add(c1);

    const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.0, 2), foliageMat);
    c2.position.set(pos.x + 0.4, pos.y + 6.2, pos.z - 0.3);
    c2.castShadow = true;
    this.currentMapGroup.add(c2);

    const c3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 2), foliageMat);
    c3.position.set(pos.x - 0.3, pos.y + 5.6, pos.z + 0.5);
    c3.castShadow = true;
    this.currentMapGroup.add(c3);

    this.physics.createStaticBox(new THREE.Vector3(pos.x, pos.y + 2.1, pos.z), new THREE.Vector3(0.35, 2.1, 0.35), 'environment');
  }

  // Modern CS2 Tactical Bus Stop Shelter (replaces the flat yellow box!)
  private createBusStopShelter(pos: THREE.Vector3) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, metalness: 0.85, roughness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.5 }); // Red urban shelter canopy

    // Canopy Roof
    this.createStaticBlock(new THREE.Vector3(pos.x, pos.y + 2.7, pos.z), new THREE.Vector3(6.5, 0.3, 3.2), roofMat);

    // Steel Support Columns
    this.createStaticBlock(new THREE.Vector3(pos.x - 3.0, pos.y + 1.35, pos.z - 1.3), new THREE.Vector3(0.2, 2.7, 0.2), frameMat);
    this.createStaticBlock(new THREE.Vector3(pos.x + 3.0, pos.y + 1.35, pos.z - 1.3), new THREE.Vector3(0.2, 2.7, 0.2), frameMat);

    // Rear Glass Panel
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(6.0, 2.3, 0.08), glassMat);
    rearGlass.position.set(pos.x, pos.y + 1.35, pos.z - 1.3);
    this.currentMapGroup.add(rearGlass);
    this.physics.createStaticBox(new THREE.Vector3(pos.x, pos.y + 1.35, pos.z - 1.3), new THREE.Vector3(3.0, 1.2, 0.1), 'environment');

    // Wooden Waiting Bench
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8e5828, roughness: 0.7 });
    this.createStaticBlock(new THREE.Vector3(pos.x, pos.y + 0.45, pos.z - 0.7), new THREE.Vector3(4.8, 0.1, 0.6), benchMat);
  }

  // Concrete Tactical Barricade
  private createConcreteBarricade(pos: THREE.Vector3) {
    const concMat = new THREE.MeshStandardMaterial({ color: 0x636e72, roughness: 0.9 });
    this.createStaticBlock(new THREE.Vector3(pos.x, pos.y + 0.65, pos.z), new THREE.Vector3(4.2, 1.3, 1.2), concMat);
  }

  private createArchway(pos: THREE.Vector3, width: number, height: number, mat: THREE.Material) {
    const pW = 1.5;
    this.createStaticBlock(new THREE.Vector3(pos.x - width / 2 + pW / 2, pos.y + height / 2, pos.z), new THREE.Vector3(pW, height, 2.5), mat);
    this.createStaticBlock(new THREE.Vector3(pos.x + width / 2 - pW / 2, pos.y + height / 2, pos.z), new THREE.Vector3(pW, height, 2.5), mat);
    this.createStaticBlock(new THREE.Vector3(pos.x, pos.y + height - 0.5, pos.z), new THREE.Vector3(width, 1.5, 2.5), mat);
  }

  private createBarrel(pos: THREE.Vector3, colorHex: number) {
    const geo = new THREE.CylinderGeometry(0.48, 0.48, 1.3, 16);
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.75 });
    const barrel = new THREE.Mesh(geo, mat);
    barrel.position.copy(pos);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    this.currentMapGroup.add(barrel);

    this.physics.createStaticBox(pos, new THREE.Vector3(0.48, 0.65, 0.48), 'environment');
  }

  private createStreetLantern(pos: THREE.Vector3) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.85, roughness: 0.2 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeaa7, emissiveIntensity: 1.5 });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 8), poleMat);
    pole.position.set(pos.x, pos.y + 2.1, pos.z);
    pole.castShadow = true;
    this.currentMapGroup.add(pole);

    const lamp = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), lampMat);
    lamp.position.set(pos.x, pos.y + 4.3, pos.z);
    this.currentMapGroup.add(lamp);

    const light = new THREE.PointLight(0xffeaa7, 1.2, 18);
    light.position.set(pos.x, pos.y + 4.1, pos.z);
    this.currentMapGroup.add(light);
  }

  private createStaticBlock(pos: THREE.Vector3, size: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.currentMapGroup.add(mesh);

    const halfExtents = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
    this.physics.createStaticBox(pos, halfExtents, 'environment');

    return mesh;
  }
}
