import * as THREE from 'three';
import {
  TUTORIAL_HOLD_MS,
  arenaToWorldX,
  arenaToWorldZ,
} from '../config/constants';
import type { GameState, SectorMapProp } from '../game/types';
import {
  createArenaDeckMaterial,
  createAtmosphericSmokeMaterial,
  createNebulaDriftMaterial,
  createProceduralPlanetMaterial,
} from './shaders/gameShaders';

const ATMO_PARTICLE_COUNT = 340;
const ATMO_HALF_X = 110;
const ATMO_HALF_Z = 90;

export class BackdropSystem {
  public readonly group = new THREE.Group();

  private nebulaMesh: THREE.Mesh;
  private nebulaMeshMat: THREE.MeshBasicMaterial;
  private driftPlane: THREE.Mesh;
  private nebulaDriftMat: THREE.ShaderMaterial;
  private smokeNearMat: THREE.ShaderMaterial;
  private smokeNearPlane: THREE.Mesh;
  private smokeMidMat: THREE.ShaderMaterial;
  private smokeMidPlane: THREE.Mesh;
  private atmoParticles: THREE.Points;
  private atmoParticleMat: THREE.PointsMaterial;
  private atmoParticleBaseY = new Float32Array(ATMO_PARTICLE_COUNT);
  private atmoParticlePhases = new Float32Array(ATMO_PARTICLE_COUNT);
  private atmoParticleSpeeds = new Float32Array(ATMO_PARTICLE_COUNT);
  private atmoDriftX = 0.85;
  private atmoDriftZ = 2.35;

  private arenaDeckMat: THREE.ShaderMaterial;
  private deckPlane: THREE.Mesh;
  private starLayerNear: THREE.Points;
  private starLayerFar: THREE.Points;
  private planetA: THREE.Group;
  private planetAMat: THREE.ShaderMaterial;
  private planetB: THREE.Mesh;
  private planetBMat: THREE.ShaderMaterial;
  private planetBaseA = { x: -54, z: -28 };
  private planetBaseB = { x: 53, z: 24 };

  // Sector props & pre-chipped asteroid meshes
  private mapPropsGroup = new THREE.Group();
  private rockGeos: THREE.BufferGeometry[];
  private propEntries: Array<{ mesh: THREE.Object3D; rotSpeed: number; baseY: number; phase: number }> = [];
  private beaconPulses: Array<{ mat: THREE.MeshStandardMaterial; phase: number }> = [];
  private lastMapSeed = -1;

  // Opening green warmup pad
  private tutorialGroup = new THREE.Group();
  private tutorialOuterRing: THREE.Mesh;
  private tutorialProgressMesh: THREE.Mesh;
  private tutorialGuideLine: THREE.Line;
  private tutorialGuidePos: Float32Array;

  private floorPulseAge = 10;
  private warpTravelX = 0;
  private warpTravelZ = 0;
  private warpSmokeTime = 0;

  constructor() {
    // Deep nebula painting parked way down in the basement so fog never washes it out
    const texLoader = new THREE.TextureLoader();
    const nebulaTex = texLoader.load('./assets/nebula-backdrop.jpg');
    nebulaTex.colorSpace = THREE.SRGBColorSpace;

    const nebulaGeo = new THREE.PlaneGeometry(520, 380);
    this.nebulaMeshMat = new THREE.MeshBasicMaterial({
      map: nebulaTex,
      color: 0xa0b8e8,
      depthWrite: false,
      fog: false,
    });
    this.nebulaMesh = new THREE.Mesh(nebulaGeo, this.nebulaMeshMat);
    this.nebulaMesh.rotation.x = -Math.PI / 2;
    this.nebulaMesh.position.set(0, -44, -4);
    this.group.add(this.nebulaMesh);

    // Slowly churning GLSL nebula veil above the backdrop
    this.nebulaDriftMat = createNebulaDriftMaterial();
    this.driftPlane = new THREE.Mesh(new THREE.PlaneGeometry(460, 340), this.nebulaDriftMat);
    this.driftPlane.rotation.x = -Math.PI / 2;
    this.driftPlane.position.set(0, -37, -4);
    this.group.add(this.driftPlane);

    // Two parallax star layers that wrap forever around the player
    this.starLayerFar = this.createStarLayer(520, -30, -16, 0.34, 0.72);
    this.starLayerNear = this.createStarLayer(260, -14, -4, 0.48, 0.9);
    this.group.add(this.starLayerFar, this.starLayerNear);

    // Counter-drifting cosmic smoke sheets so warp speed feels real
    this.smokeMidMat = createAtmosphericSmokeMaterial();
    this.smokeMidPlane = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), this.smokeMidMat);
    this.smokeMidPlane.rotation.x = -Math.PI / 2;
    this.smokeMidPlane.position.set(0, -19.5, 0);
    this.smokeMidPlane.renderOrder = 2;

    this.smokeNearMat = createAtmosphericSmokeMaterial();
    this.smokeNearPlane = new THREE.Mesh(new THREE.PlaneGeometry(290, 290), this.smokeNearMat);
    this.smokeNearPlane.rotation.x = -Math.PI / 2;
    this.smokeNearPlane.position.set(0, -6.8, 0);
    this.smokeNearPlane.renderOrder = 3;
    this.group.add(this.smokeMidPlane, this.smokeNearPlane);

    // Floating space dust / embers — wrapped in a box around the camera so we don't spawn a million points
    const pPos = new Float32Array(ATMO_PARTICLE_COUNT * 3);
    const pCol = new Float32Array(ATMO_PARTICLE_COUNT * 3);
    for (let i = 0; i < ATMO_PARTICLE_COUNT; i++) {
      const rx = ((i * 73 + 19) % 997) / 997;
      const ry = ((i * 137 + 41) % 991) / 991;
      const rz = ((i * 211 + 83) % 983) / 983;
      const baseY = -15.0 + ry * 19.0;
      pPos[i * 3] = (rx - 0.5) * ATMO_HALF_X * 2;
      pPos[i * 3 + 1] = baseY;
      pPos[i * 3 + 2] = (rz - 0.5) * ATMO_HALF_Z * 2;
      this.atmoParticleBaseY[i] = baseY;
      this.atmoParticlePhases[i] = (i * 0.618033988) % (Math.PI * 2);
      this.atmoParticleSpeeds[i] = 0.65 + ((i * 37) % 100) * 0.0075;
      pCol[i * 3] = 0.6;
      pCol[i * 3 + 1] = 0.85;
      pCol[i * 3 + 2] = 1.0;
    }
    const atmoGeo = new THREE.BufferGeometry();
    atmoGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    atmoGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    this.atmoParticleMat = new THREE.PointsMaterial({
      size: 0.62,
      map: this.createSoftParticleTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.atmoParticles = new THREE.Points(atmoGeo, this.atmoParticleMat);
    this.atmoParticles.frustumCulled = false;
    this.atmoParticles.renderOrder = 4;
    this.group.add(this.atmoParticles);

    // Two procedural gas giants scrolling slowly in the background
    this.planetA = new THREE.Group();
    this.planetAMat = createProceduralPlanetMaterial(0x09162e, 0x184366, 0x357a99, 0x4ad8ff);
    const sphereA = new THREE.Mesh(new THREE.SphereGeometry(8.8, 40, 30), this.planetAMat);
    this.planetA.add(sphereA);

    // Multi-band feathered planetary ring
    const ringCanvas = document.createElement('canvas');
    ringCanvas.width = 256;
    ringCanvas.height = 16;
    const rctx = ringCanvas.getContext('2d')!;
    const rGrad = rctx.createLinearGradient(0, 0, 256, 0);
    rGrad.addColorStop(0.0, 'rgba(120, 210, 255, 0)');
    rGrad.addColorStop(0.18, 'rgba(120, 210, 255, 0.24)');
    rGrad.addColorStop(0.36, 'rgba(255, 190, 110, 0.08)');
    rGrad.addColorStop(0.55, 'rgba(110, 200, 255, 0.28)');
    rGrad.addColorStop(0.76, 'rgba(170, 230, 255, 0.14)');
    rGrad.addColorStop(1.0, 'rgba(120, 210, 255, 0)');
    rctx.fillStyle = rGrad;
    rctx.fillRect(0, 0, 256, 16);
    const ringTex = new THREE.CanvasTexture(ringCanvas);
    ringTex.colorSpace = THREE.SRGBColorSpace;

    const ringGeo = new THREE.RingGeometry(11.2, 17.8, 72);
    const uv = ringGeo.attributes.uv;
    const pos = ringGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      const u = Math.max(0, Math.min(1, (r - 11.2) / (17.8 - 11.2)));
      uv.setXY(i, u, 0.5);
    }
    const ringMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
    ringMesh.rotation.x = Math.PI / 2.25;
    ringMesh.rotation.y = 0.3;
    this.planetA.add(ringMesh);
    this.planetA.position.set(-54, -27, -28);
    this.group.add(this.planetA);

    this.planetBMat = createProceduralPlanetMaterial(0x1f0d1c, 0x522130, 0xb86634, 0xff9f44);
    this.planetB = new THREE.Mesh(new THREE.SphereGeometry(5.6, 32, 24), this.planetBMat);
    this.planetB.position.set(53, -24, 24);
    this.group.add(this.planetB);

    // Pre-built bumpy rock shapes + floor grid plane
    this.rockGeos = [
      this.buildCraggyRockGeometry(0),
      this.buildCraggyRockGeometry(1),
      this.buildCraggyRockGeometry(2),
    ];

    this.arenaDeckMat = createArenaDeckMaterial();
    this.deckPlane = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), this.arenaDeckMat);
    this.deckPlane.rotation.x = -Math.PI / 2;
    this.deckPlane.position.y = -0.75;
    this.group.add(this.deckPlane);
    this.group.add(this.mapPropsGroup);

    // Green starting circle for Wave 0 warmup
    this.tutorialOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(5.3, 5.85, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38f288,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    this.tutorialOuterRing.rotation.x = -Math.PI / 2;

    const fillDisc = new THREE.Mesh(
      new THREE.CircleGeometry(5.3, 48),
      new THREE.MeshBasicMaterial({
        color: 0x22ff77,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      })
    );
    fillDisc.rotation.x = -Math.PI / 2;

    this.tutorialProgressMesh = new THREE.Mesh(
      new THREE.RingGeometry(4.0, 4.9, 48),
      new THREE.MeshBasicMaterial({
        color: 0x88ffcc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    this.tutorialProgressMesh.rotation.x = -Math.PI / 2;
    this.tutorialProgressMesh.position.y = 0.05;

    this.tutorialGroup.add(this.tutorialOuterRing, fillDisc, this.tutorialProgressMesh);
    this.tutorialGroup.visible = false;
    this.group.add(this.tutorialGroup);

    this.tutorialGuidePos = new Float32Array(6);
    const guideGeo = new THREE.BufferGeometry();
    guideGeo.setAttribute('position', new THREE.BufferAttribute(this.tutorialGuidePos, 3));
    this.tutorialGuideLine = new THREE.Line(
      guideGeo,
      new THREE.LineBasicMaterial({ color: 0x38f288, transparent: true, opacity: 0.55 })
    );
    this.tutorialGuideLine.visible = false;
    this.group.add(this.tutorialGuideLine);
  }

  private createSoftParticleTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildCraggyRockGeometry(variant: 0 | 1 | 2): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1.18, 2);
    const pos = geo.attributes.position;
    const freqA = 2.6 + variant * 0.7;
    const freqB = 4.1 + variant * 0.9;
    const squashY = variant === 1 ? 0.68 : variant === 2 ? 1.18 : 0.84;
    const stretchX = variant === 0 ? 1.24 : variant === 2 ? 0.88 : 1.05;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ridge =
        Math.sin(x * freqA + variant * 1.4) * Math.cos(z * freqB) * 0.24 +
        Math.cos(y * 3.5 - x * 2.1 + variant) * 0.16;
      const disp = Math.max(0.55, 1.0 + ridge);
      pos.setXYZ(i, x * disp * stretchX, y * disp * squashY, z * disp);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  triggerFloorPulse(arenaX: number, arenaY: number): void {
    this.arenaDeckMat.uniforms.uPulseOriginXZ.value.set(
      arenaToWorldX(arenaX),
      arenaToWorldZ(arenaY)
    );
    this.floorPulseAge = 0;
  }

  private createStarLayer(
    count: number,
    yMin: number,
    yMax: number,
    size: number,
    opacity: number
  ): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0xf4f7ff),
      new THREE.Color(0x99ddff),
      new THREE.Color(0xffcc88),
      new THREE.Color(0xd0e2ff),
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 240;
      positions[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
      positions[i * 3 + 2] = (Math.random() - 0.5) * 190;

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
  }

  private buildLandmarkVisual(p: SectorMapProp): THREE.Object3D {
    const baseMat = new THREE.MeshStandardMaterial({
      color: p.hex,
      emissive: p.hex,
      emissiveIntensity: p.stratum === 'deep' ? 0.14 : 0.24,
      roughness: p.kind === 'asteroid' || p.kind === 'debris_cluster' ? 0.88 : 0.42,
      metalness: p.kind === 'asteroid' ? 0.16 : 0.72,
    });

    if (p.kind === 'asteroid') {
      const rock = new THREE.Mesh(this.rockGeos[p.variant % this.rockGeos.length], baseMat);
      rock.userData.cachedGeo = true;
      return rock;
    }

    const g = new THREE.Group();
    const accentMat = new THREE.MeshStandardMaterial({
      color: p.accentHex,
      emissive: p.accentHex,
      emissiveIntensity: p.stratum === 'deep' ? 0.42 : 0.92,
      roughness: 0.28,
      metalness: 0.5,
    });

    if (p.kind === 'crystal') {
      const baseRock = new THREE.Mesh(this.rockGeos[p.variant % this.rockGeos.length], baseMat);
      baseRock.scale.set(0.75, 0.55, 0.75);
      baseRock.userData.cachedGeo = true;
      g.add(baseRock);
      const spireCount = 3 + (p.variant % 2);
      for (let i = 0; i < spireCount; i++) {
        const ang = (i / spireCount) * Math.PI * 2 + p.seedPhase;
        const spire = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), accentMat);
        spire.scale.set(0.46, 1.55 + (i % 2) * 0.45, 0.46);
        spire.position.set(Math.cos(ang) * 0.34, 0.35, Math.sin(ang) * 0.34);
        spire.rotation.set(Math.sin(ang) * 0.38, ang, Math.cos(ang) * 0.38);
        g.add(spire);
      }
      return g;
    }

    if (p.kind === 'ruin_ring') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.19, 8, 22), baseMat);
      g.add(ring);
      const innerArc = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.06, 6, 20), accentMat);
      g.add(innerArc);
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 0.32), baseMat);
        pylon.position.set(Math.cos(ang) * 1.55, Math.sin(ang) * 1.55, 0);
        pylon.rotation.z = ang;
        g.add(pylon);
      }
      return g;
    }

    if (p.kind === 'beacon_spire') {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.48, 2.8, 8), baseMat);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.08, 6, 14), baseMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.62;
      const tipMat = accentMat.clone();
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), tipMat);
      beacon.position.y = 1.55;
      this.beaconPulses.push({ mat: tipMat, phase: p.seedPhase });
      g.add(mast, collar, beacon);
      return g;
    }

    if (p.kind === 'derelict_hulk') {
      const spine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.72, 0.96), baseMat);
      g.add(spine);
      for (let r = -1; r <= 1; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.05, 1.35), baseMat);
        rib.position.x = r * 0.75;
        g.add(rib);
      }
      const brokenWing = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 1.65), baseMat);
      brokenWing.position.set(0.35, 0.28, 0.78);
      brokenWing.rotation.set(0.32, -0.25, 0.18);
      g.add(brokenWing);
      const warnMat = accentMat.clone();
      const warnLamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), warnMat);
      warnLamp.position.set(-0.9, 0.44, 0);
      this.beaconPulses.push({ mat: warnMat, phase: p.seedPhase });
      g.add(warnLamp);
      return g;
    }

    // Scrap cluster: twisted beam plus a few angry-looking rock shards
    baseMat.dispose();
    accentMat.dispose();
    const shardMat = new THREE.MeshStandardMaterial({
      color: p.hex,
      emissive: p.hex,
      emissiveIntensity: 0.18,
      roughness: 0.78,
      metalness: 0.56,
    });
    const shardCount = 4 + (p.variant % 2);
    for (let i = 0; i < shardCount; i++) {
      const isPlate = i % 2 === 0;
      const piece = new THREE.Mesh(
        isPlate ? new THREE.BoxGeometry(0.68, 0.16, 0.46) : this.rockGeos[i % this.rockGeos.length],
        shardMat
      );
      if (!isPlate) {
        piece.userData.cachedGeo = true;
        piece.scale.setScalar(0.38);
      }
      const a = (i / shardCount) * Math.PI * 2 + p.seedPhase;
      piece.position.set(Math.cos(a) * 0.85, Math.sin(a * 1.7) * 0.35, Math.sin(a) * 0.85);
      piece.rotation.set(a * 0.7, a, i * 0.5);
      g.add(piece);
    }
    const girder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), shardMat);
    girder.rotation.set(0.45, 0.2, 1.1);
    g.add(girder);
    return g;
  }

  private clearMapPropsGroup(): void {
    const disposedMats = new Set<THREE.Material>();
    this.mapPropsGroup.traverse((node) => {
      const m = node as THREE.Mesh;
      if (m.isMesh) {
        if (!m.userData.cachedGeo && m.geometry) {
          m.geometry.dispose();
        }
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (mat && !disposedMats.has(mat)) {
            disposedMats.add(mat);
            mat.dispose();
          }
        }
      }
    });
    while (this.mapPropsGroup.children.length > 0) {
      this.mapPropsGroup.remove(this.mapPropsGroup.children[0]);
    }
    this.propEntries = [];
    this.beaconPulses = [];
  }

  private syncSectorMap(state: GameState): void {
    const map = state.sectorMap;
    if (map.seed === this.lastMapSeed) return;
    this.lastMapSeed = map.seed;

    // Swap biome colors when warping into a new sector
    const pal = map.palette;
    this.nebulaMeshMat.color.setHex(pal.nebulaHex).multiplyScalar(0.55);
    this.nebulaMeshMat.opacity = 0.42;
    this.arenaDeckMat.uniforms.uAccentColor.value.setHex(pal.gridHex);
    this.planetAMat.uniforms.uColorDark.value.setHex(pal.planetA[0]);
    this.planetAMat.uniforms.uColorMid.value.setHex(pal.planetA[1]);
    this.planetAMat.uniforms.uColorBand.value.setHex(pal.planetA[2]);
    this.planetAMat.uniforms.uAtmoColor.value.setHex(pal.planetA[3]);
    this.planetBMat.uniforms.uColorDark.value.setHex(pal.planetB[0]);
    this.planetBMat.uniforms.uColorMid.value.setHex(pal.planetB[1]);
    this.planetBMat.uniforms.uColorBand.value.setHex(pal.planetB[2]);
    this.planetBMat.uniforms.uAtmoColor.value.setHex(pal.planetB[3]);

    this.planetBaseA = { x: map.planetAOffset.x, z: map.planetAOffset.z };
    this.planetBaseB = { x: map.planetBOffset.x, z: map.planetBOffset.z };
    this.planetA.scale.setScalar(map.planetAOffset.scale);
    this.planetB.scale.setScalar(map.planetBOffset.scale);

    // Retint drifting smoke sheets & space dust for the new sector
    const atmo = map.atmosphere;
    (this.smokeNearMat.uniforms.uColorPrimary.value as THREE.Color).setHex(atmo.smokePrimaryHex);
    (this.smokeNearMat.uniforms.uColorSecondary.value as THREE.Color).setHex(atmo.smokeSecondaryHex);
    this.smokeNearMat.uniforms.uOpacity.value = atmo.smokeOpacity * 0.55;
    this.smokeNearMat.uniforms.uScale.value = atmo.smokeScale;
    (this.smokeNearMat.uniforms.uDrift.value as THREE.Vector2).set(atmo.smokeSpeedX, atmo.smokeSpeedZ);

    (this.smokeMidMat.uniforms.uColorPrimary.value as THREE.Color).setHex(atmo.smokeSecondaryHex);
    (this.smokeMidMat.uniforms.uColorSecondary.value as THREE.Color).setHex(atmo.fogHex);
    this.smokeMidMat.uniforms.uOpacity.value = atmo.smokeOpacity * 0.42;
    this.smokeMidMat.uniforms.uScale.value = atmo.smokeScale * 0.65;
    (this.smokeMidMat.uniforms.uDrift.value as THREE.Vector2).set(
      -atmo.smokeSpeedX * 0.65,
      atmo.smokeSpeedZ * 0.45
    );

    const colAttr = this.atmoParticles.geometry.getAttribute('color') as THREE.BufferAttribute;
    const cPrim = new THREE.Color(atmo.particleHex);
    const cAlt = new THREE.Color(atmo.particleAltHex);
    for (let i = 0; i < ATMO_PARTICLE_COUNT; i++) {
      const c = i % 3 === 0 ? cAlt : cPrim;
      colAttr.setXYZ(i, c.r, c.g, c.b);
    }
    colAttr.needsUpdate = true;
    this.atmoParticleMat.size = atmo.particleSize;
    this.atmoParticleMat.opacity = Math.min(0.22, atmo.particleOpacity * 0.52);
    const nextBlending =
      atmo.particleKind === 'ash' ? THREE.NormalBlending : THREE.AdditiveBlending;
    if (this.atmoParticleMat.blending !== nextBlending) {
      this.atmoParticleMat.blending = nextBlending;
      this.atmoParticleMat.needsUpdate = true;
    }
    this.atmoDriftX = atmo.particleDriftX;
    this.atmoDriftZ = atmo.particleDriftZ;

    // Swap in fresh landmark props
    this.clearMapPropsGroup();
    for (const p of map.props) {
      const obj = this.buildLandmarkVisual(p);
      const wx = arenaToWorldX(p.x);
      const wz = arenaToWorldZ(p.y);
      obj.position.set(wx, p.depthY, wz);
      obj.scale.setScalar(p.scale);
      obj.rotation.set(p.seedPhase, p.seedPhase * 0.7, 0);
      this.mapPropsGroup.add(obj);
      this.propEntries.push({ mesh: obj, rotSpeed: p.rotSpeed, baseY: p.depthY, phase: p.seedPhase });
    }
  }

  update(state: GameState, elapsedSec: number, dtSec: number): void {
    this.syncSectorMap(state);
    const inMenu = state.phase === 'MENU';
    this.mapPropsGroup.visible = false;
    this.smokeNearPlane.visible = !inMenu;
    this.smokeMidPlane.visible = !inMenu;
    this.atmoParticles.visible = !inMenu;

    const playerWX = inMenu ? 0 : arenaToWorldX(state.player.x);
    const playerWZ = inMenu ? 0 : arenaToWorldZ(state.player.y);

    const warpProg =
      !inMenu && state.warpTransition.active
        ? Math.min(1, state.warpTransition.elapsedMs / Math.max(1, state.warpTransition.durationMs))
        : 0;
    const warpBell = warpProg > 0 ? Math.sin(Math.PI * warpProg) : 0;
    const shipDirX = Math.cos(state.player.facingAngle);
    const shipDirZ = Math.sin(state.player.facingAngle);

    if (warpBell > 0.001) {
      this.warpTravelX += shipDirX * warpBell * 185 * dtSec;
      this.warpTravelZ += shipDirZ * warpBell * 185 * dtSec;
    }
    this.warpSmokeTime += dtSec * (1 + warpBell * 10.5);

    for (const pe of this.propEntries) {
      pe.mesh.rotation.y += pe.rotSpeed * dtSec;
      pe.mesh.position.y = pe.baseY + Math.sin(elapsedSec * 0.9 + pe.phase) * 0.25;
    }

    for (const bp of this.beaconPulses) {
      bp.mat.emissiveIntensity = 0.45 + 0.75 * (0.5 + 0.5 * Math.sin(elapsedSec * 3.4 + bp.phase));
    }

    const wrapStars = (points: THREE.Points, speed: number, warpMult: number) => {
      const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const halfSpanX = 120;
      const halfSpanZ = 95;
      const spanX2 = halfSpanX * 2;
      const spanZ2 = halfSpanZ * 2;
      const warpVx = -shipDirX * warpBell * 185 * warpMult;
      const warpVz = -shipDirZ * warpBell * 185 * warpMult;
      for (let i = 0; i < attr.count; i++) {
        let x = attr.getX(i) + warpVx * dtSec;
        let z = attr.getZ(i) + (speed + warpVz) * dtSec;
        while (x - playerWX > halfSpanX) x -= spanX2;
        while (x - playerWX < -halfSpanX) x += spanX2;
        while (z - playerWZ > halfSpanZ) z -= spanZ2;
        while (z - playerWZ < -halfSpanZ) z += spanZ2;
        attr.setX(i, x);
        attr.setZ(i, z);
      }
      attr.needsUpdate = true;
    };

    wrapStars(this.starLayerFar, 1.35, 0.68);
    wrapStars(this.starLayerNear, 3.4, 1.2);

    if (!inMenu) {
      // Push atmospheric dust past the ship (and crank it to 11 during hyperspace warps)
      const pAttr = this.atmoParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const atmoWarpVx = -shipDirX * warpBell * 150;
      const atmoWarpVz = -shipDirZ * warpBell * 150;
      for (let i = 0; i < ATMO_PARTICLE_COUNT; i++) {
        const sp = this.atmoParticleSpeeds[i];
        let x = pAttr.getX(i) + (this.atmoDriftX * sp + atmoWarpVx) * dtSec;
        let z = pAttr.getZ(i) + (this.atmoDriftZ * sp + atmoWarpVz) * dtSec;
        while (x - playerWX > ATMO_HALF_X) x -= ATMO_HALF_X * 2;
        while (x - playerWX < -ATMO_HALF_X) x += ATMO_HALF_X * 2;
        while (z - playerWZ > ATMO_HALF_Z) z -= ATMO_HALF_Z * 2;
        while (z - playerWZ < -ATMO_HALF_Z) z += ATMO_HALF_Z * 2;
        const y = this.atmoParticleBaseY[i] + Math.sin(elapsedSec * 1.15 + this.atmoParticlePhases[i]) * 0.42;
        pAttr.setXYZ(i, x, y, z);
      }
      pAttr.needsUpdate = true;

      this.smokeNearPlane.position.set(playerWX, -6.8, playerWZ);
      this.smokeMidPlane.position.set(playerWX, -19.5, playerWZ);
      this.smokeNearMat.uniforms.uTime.value = this.warpSmokeTime;
      this.smokeMidMat.uniforms.uTime.value = this.warpSmokeTime;
    }

    // Wrap exoplanets smoothly around the infinite scrolling backdrop so warp travel actually passes planets
    const wrapRel = (v: number, span: number) => ((((v + span) % (span * 2)) + span * 2) % (span * 2)) - span;
    const pAx = wrapRel(this.planetBaseA.x - this.warpTravelX * 0.18, 95);
    const pAz = wrapRel(this.planetBaseA.z - this.warpTravelZ * 0.18, 70);
    const pBx = wrapRel(this.planetBaseB.x - this.warpTravelX * 0.14, 95);
    const pBz = wrapRel(this.planetBaseB.z - this.warpTravelZ * 0.14, 70);

    this.nebulaMesh.position.set(playerWX * 0.96, -52, -4 + playerWZ * 0.96);
    this.driftPlane.position.set(playerWX * 0.92, -44, -4 + playerWZ * 0.92);
    this.planetA.position.set(pAx + playerWX * 0.85, -42, pAz + playerWZ * 0.85);
    this.planetB.position.set(pBx + playerWX * 0.80, -46, pBz + playerWZ * 0.80);

    // Snap the deck in 10u grid steps shifted by warp distance so floor lines race under your wings
    const deckOffX = ((this.warpTravelX % 10) + 10) % 10;
    const deckOffZ = ((this.warpTravelZ % 10) + 10) % 10;
    this.deckPlane.position.set(
      Math.round(playerWX / 10) * 10 - deckOffX,
      -0.75,
      Math.round(playerWZ / 10) * 10 - deckOffZ
    );

    // Update procedural GPU planet & nebula shaders
    this.planetAMat.uniforms.uTime.value = elapsedSec;
    this.planetBMat.uniforms.uTime.value = elapsedSec * 1.15;
    this.planetA.rotation.y += dtSec * 0.03;
    this.planetB.rotation.y -= dtSec * 0.05;

    this.nebulaDriftMat.uniforms.uTime.value = this.warpSmokeTime * 0.72;
    if (state.boss && !state.boss.dying) {
      this.nebulaDriftMat.uniforms.uBossTint.value.setHex(state.boss.hex);
    } else {
      this.nebulaDriftMat.uniforms.uBossTint.value.setHex(state.sectorMap.palette.nebulaTintHex);
    }

    // Update analytically filtered star-chart shader
    this.floorPulseAge = Math.min(10, this.floorPulseAge + dtSec);
    this.arenaDeckMat.uniforms.uTime.value = elapsedSec;
    this.arenaDeckMat.uniforms.uPulseAge.value = this.floorPulseAge;
    this.arenaDeckMat.uniforms.uPlayerWorldXZ.value.set(playerWX, playerWZ);

    const lowHp = state.phase === 'PLAYING' && state.player.health / state.player.maxHealth <= 0.3;
    const outsideStorm = state.phase === 'PLAYING' && state.stormRing.outsideStorm;
    const bossAlert = Boolean(state.boss && !state.boss.dying);
    const alertLevel = outsideStorm
      ? 0.85 + Math.sin(elapsedSec * 10) * 0.15
      : bossAlert
        ? 0.6 + Math.sin(elapsedSec * 5) * 0.25
        : lowHp
          ? 0.5 + Math.sin(elapsedSec * 8) * 0.35
          : 0;
    this.arenaDeckMat.uniforms.uAlertLevel.value = alertLevel;

    // Tutorial 3D holographic zone
    if (state.phase === 'PLAYING' && state.tutorialCircle) {
      const tc = state.tutorialCircle;
      const wx = arenaToWorldX(tc.x);
      const wz = arenaToWorldZ(tc.y);
      this.tutorialGroup.visible = true;
      this.tutorialGroup.position.set(wx, -0.15, wz);

      const pulseScale = 1 + Math.sin(elapsedSec * 4) * 0.04;
      this.tutorialOuterRing.scale.set(pulseScale, pulseScale, 1);

      const ratio = Math.max(0.01, Math.min(1, tc.progressMs / TUTORIAL_HOLD_MS));
      this.tutorialProgressMesh.visible = tc.progressMs > 0;
      this.tutorialProgressMesh.scale.set(ratio, ratio, 1);

      this.tutorialGuideLine.visible = true;
      this.tutorialGuidePos[0] = arenaToWorldX(state.player.x);
      this.tutorialGuidePos[1] = 0.2;
      this.tutorialGuidePos[2] = arenaToWorldZ(state.player.y);
      this.tutorialGuidePos[3] = wx;
      this.tutorialGuidePos[4] = 0.2;
      this.tutorialGuidePos[5] = wz;
      (this.tutorialGuideLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate =
        true;
    } else {
      this.tutorialGroup.visible = false;
      this.tutorialGuideLine.visible = false;
    }
  }
}
