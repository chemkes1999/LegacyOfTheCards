import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CardInstance, DuelEventCue, DuelState, PlayerId, ZoneLocation } from '../types/tcg';
import { CardManager } from '../engine/CardManager';
import { CardTextureFactory } from './CardTextureFactory';

export interface ZoneClickPayload {
  owner: PlayerId;
  zone: ZoneLocation;
  index: number;
  cardUid?: string;
  screenX: number;
  screenY: number;
}

export interface ProjectedBadge {
  uid: string;
  cardId: string;
  controller: PlayerId;
  atk: number;
  def: number;
  level: number;
  isXyz: boolean;
  xyzCount: number;
  isLink: boolean;
  faceUp: boolean;
  position: 'ATK' | 'DEF';
  screenX: number;
  screenY: number;
  canAttack: boolean;
  isTargetable: boolean;
  isSelected: boolean;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  r: number;
  g: number;
  b: number;
}

const _vec3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();
const _euler = new THREE.Euler();

const BOARD_COLS = [-3.8, -1.9, 0, 1.9, 3.8];
const ROW_OPP_ST = -4.25;
const ROW_OPP_M = -2.15;
const ROW_EMZ = 0;
const ROW_PLR_M = 2.15;
const ROW_PLR_ST = 4.25;
const EMZ_COLS = [-1.9, 1.9];
const COL_SIDE = 5.7;

function makeStoneFloorTextures(palette: 'volcanic' | 'temple'): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Deterministic pseudo-random generator for natural stone mineral speckles
  let seed = palette === 'volcanic' ? 1337 : 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  if (palette === 'volcanic') {
    // Deep carved dark basalt slate
    ctx.fillStyle = '#1b1d24';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Subtle stone slab tonal variation
    const tile = 128;
    for (let gy = 0; gy < size; gy += tile) {
      for (let gx = 0; gx < size; gx += tile) {
        const shade = Math.floor(24 + rand() * 14);
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 7})`;
        ctx.fillRect(gx + 2, gy + 2, tile - 4, tile - 4);
      }
    }

    // Fine mineral grain & basalt pores
    for (let i = 0; i < 2400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.7 + rand() * 2.1;
      const bright = rand() > 0.5;
      ctx.fillStyle = bright ? 'rgba(130, 140, 165, 0.055)' : 'rgba(6, 7, 10, 0.14)';
      ctx.fillRect(x, y, r, r);
      bCtx.fillStyle = bright ? 'rgba(205, 205, 205, 0.16)' : 'rgba(40, 40, 40, 0.18)';
      bCtx.fillRect(x, y, r, r);
    }

    // Subtle warm bronze/ember hairline veins (not garish orange zigzags)
    ctx.strokeStyle = 'rgba(212, 130, 62, 0.22)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = rand() * size;
      let y = 0;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (rand() - 0.5) * 44;
        y += size / 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    // Honed warm limestone / sandstone sanctuary marble
    ctx.fillStyle = '#30343e';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    const tile = 128;
    for (let gy = 0; gy < size; gy += tile) {
      for (let gx = 0; gx < size; gx += tile) {
        const base = Math.floor(42 + rand() * 14);
        ctx.fillStyle = `rgb(${base + 4}, ${base + 2}, ${base - 4})`;
        ctx.fillRect(gx + 2, gy + 2, tile - 4, tile - 4);
      }
    }

    // Honed marble grain & warm gold flecks
    for (let i = 0; i < 2400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.7 + rand() * 2.2;
      const bright = rand() > 0.48;
      ctx.fillStyle = bright ? 'rgba(215, 200, 170, 0.06)' : 'rgba(12, 14, 18, 0.14)';
      ctx.fillRect(x, y, r, r);
      bCtx.fillStyle = bright ? 'rgba(210, 210, 210, 0.15)' : 'rgba(45, 45, 45, 0.18)';
      bCtx.fillRect(x, y, r, r);
    }

    // Subtle inlaid marble veins
    ctx.strokeStyle = 'rgba(212, 175, 95, 0.14)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = rand() * size;
      let y = 0;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (rand() - 0.5) * 42;
        y += size / 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Carved beveled mortar seams on both color and bump maps
  ctx.strokeStyle = 'rgba(8, 10, 14, 0.72)';
  ctx.lineWidth = 3;
  bCtx.strokeStyle = '#181818';
  bCtx.lineWidth = 4;
  for (let g = 0; g <= size; g += 128) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(size, g);
    ctx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(g, 0);
    bCtx.lineTo(g, size);
    bCtx.stroke();
    bCtx.beginPath();
    bCtx.moveTo(0, g);
    bCtx.lineTo(size, g);
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1.5);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 1.5);

  return { map, bumpMap };
}

function makeZoneTileTexture(accent: string, symbol: string, label: string = ''): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // Recessed dark etched stone interior with inner shadow vignette
  const bg = ctx.createRadialGradient(128, 160, 20, 128, 160, 185);
  bg.addColorStop(0, 'rgba(18, 22, 32, 0.78)');
  bg.addColorStop(1, 'rgba(7, 9, 14, 0.92)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 320);

  // Outer engraved metallic border
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 304);

  // Inner fine antique gold hairline
  ctx.strokeStyle = 'rgba(235, 215, 165, 0.28)';
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, 220, 284);

  // Ornate corner L-brackets
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  const bLen = 18;
  const brackets: [number, number, number, number][] = [
    [18, 18, 1, 1],
    [238, 18, -1, 1],
    [18, 302, 1, -1],
    [238, 302, -1, -1],
  ];
  for (const [bx, by, dx, dy] of brackets) {
    ctx.beginPath();
    ctx.moveTo(bx + dx * bLen, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by + dy * bLen);
    ctx.stroke();
  }

  // Subtle recessed center seal
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 154, 46, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(128, 154, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.55;
  ctx.font = 'bold 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 128, 155);
  ctx.restore();

  if (label) {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 286);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePendulumZoneTexture(side: 'LEFT' | 'RIGHT'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  const isLeft = side === 'LEFT';
  const mainColor = isLeft ? '#0ea5e9' : '#e11d48';
  const lightColor = isLeft ? '#bae6fd' : '#fecdd3';
  const darkColor = isLeft ? '#082f49' : '#4c0519';

  // Glowing burst background
  const bg = ctx.createRadialGradient(128, 160, 12, 128, 160, 155);
  bg.addColorStop(0, lightColor);
  bg.addColorStop(0.45, mainColor);
  bg.addColorStop(1, darkColor);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 320);

  // Outer border
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 304);

  // Inner bright frame
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 220, 284);

  // Faceted horizontal Pendulum Crystal Diamond (matching Master Rule 4/5 board)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(128, 102);
  ctx.lineTo(208, 160);
  ctx.lineTo(128, 218);
  ctx.lineTo(48, 160);
  ctx.closePath();
  const gemGrad = ctx.createLinearGradient(48, 102, 208, 218);
  gemGrad.addColorStop(0, lightColor);
  gemGrad.addColorStop(0.5, mainColor);
  gemGrad.addColorStop(1, darkColor);
  ctx.fillStyle = gemGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner facet highlight
  ctx.beginPath();
  ctx.moveTo(128, 118);
  ctx.lineTo(182, 160);
  ctx.lineTo(128, 152);
  ctx.lineTo(74, 160);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.restore();

  // Top & Bottom zone labels
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ZONA DE PÉNDULO', 128, 44);

  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('MÁGICAS & TRAMPAS', 128, 282);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class DuelArena3D {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;

  private texFactory = new CardTextureFactory();
  private zoneFrames: Map<string, THREE.Mesh> = new Map();
  private cardMeshes: Map<string, { group: THREE.Group; targetPos: THREE.Vector3; targetRotY: number; targetRotZ: number }> = new Map();
  private interactables: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private lastHoverCheck = 0;

  // Dynamic camera choreography
  private camMode: 'TITLE' | 'DUEL' | 'SUMMON_FOCUS' | 'ATTACK_FOCUS' = 'TITLE';
  private camTargetPos = new THREE.Vector3(0, 12.2, 10.6);
  private camLookTarget = new THREE.Vector3(0, 0, 0.3);
  private camLookCurrent = new THREE.Vector3(0, 0, 0.3);
  private camFocusTimer = 0;
  private trauma = 0;
  private summonBeamMesh: THREE.Mesh;
  private summonBeamTimer = 0;
  private duelOrbitCrystal: THREE.Mesh[] = [];

  // Deck thickness meshes
  private deckStacks: Record<'pDeck' | 'pExtra' | 'oDeck' | 'oExtra', THREE.Mesh | null> = {
    pDeck: null,
    pExtra: null,
    oDeck: null,
    oExtra: null,
  };

  // Pooled particles
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Synced state refs
  private latestDuel: DuelState | null = null;
  private selectedUid: string | null = null;
  private targetableUids: Set<string> = new Set();
  private cameraDynamics = true;
  private seenCueIds = new Set<string>();
  private onZoneClick: (payload: ZoneClickPayload) => void;
  private onProjectedBadges: (badges: ProjectedBadge[]) => void;
  private lastBadgeEmit = 0;
  private resizeObserver: ResizeObserver;

  // Shared card geometry
  private cardGeom = new THREE.BoxGeometry(1.42, 0.04, 2.02);
  private cardSideMat = new THREE.MeshStandardMaterial({ color: 0xd4a53a, roughness: 0.35, metalness: 0.7 });

  constructor(
    container: HTMLElement,
    onZoneClick: (payload: ZoneClickPayload) => void,
    onProjectedBadges: (badges: ProjectedBadge[]) => void
  ) {
    this.container = container;
    this.onZoneClick = onZoneClick;
    this.onProjectedBadges = onProjectedBadges;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.texFactory.setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090d16');
    this.scene.fog = new THREE.FogExp2('#090d16', 0.022);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 12.2, 10.6);
    this.camera.lookAt(0, 0, 0.3);

    this.buildLighting();
    this.buildDuelBoard();

    // Summon beam pillar
    const beamGeo = new THREE.CylinderGeometry(1.1, 1.5, 9, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.summonBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.summonBeamMesh.position.set(0, 4.5, 0);
    this.summonBeamMesh.visible = false;
    this.scene.add(this.summonBeamMesh);

    // Pooled Particle Ring Buffer (150 instances)
    const pGeo = new THREE.OctahedronGeometry(0.11, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, 150);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < 150; i++) {
      this.particles.push({
        active: false,
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, scale: 0,
        r: 1, g: 1, b: 1,
      });
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.setRGB(1, 0.8, 0.3));
    }
    this.scene.add(this.particleMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind pointer & resize
    const dom = this.renderer.domElement;
    dom.addEventListener('click', this.handleClick);
    dom.addEventListener('pointermove', this.handlePointerMove);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  private buildLighting(): void {
    const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x1c140d, 0.72);
    this.scene.add(hemi);

    // Overhead warm tournament key spotlight with crisp 2048 soft shadows
    const key = new THREE.DirectionalLight(0xfff0d4, 2.35);
    key.position.set(4.5, 16, 8.5);
    key.castShadow = !this.isSoftwareGl;
    key.shadow.mapSize.set(this.isSoftwareGl ? 1024 : 2048, this.isSoftwareGl ? 1024 : 2048);
    key.shadow.camera.left = -10.5;
    key.shadow.camera.right = 10.5;
    key.shadow.camera.top = 9.5;
    key.shadow.camera.bottom = -9.5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    // Cool architectural rim light from behind
    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.85);
    rim.position.set(-8, 8, -11);
    this.scene.add(rim);

    // Subtle warm tabletop brazier glows at corners
    const cornerGlows: [number, number, number][] = [
      [-8.2, 1.3, 5.9],
      [8.2, 1.3, 5.9],
      [-8.2, 1.3, -5.9],
      [8.2, 1.3, -5.9],
    ];
    for (const [gx, gy, gz] of cornerGlows) {
      const pt = new THREE.PointLight(0xf59e0b, 3.2, 10, 1.8);
      pt.position.set(gx, gy, gz);
      this.scene.add(pt);
    }
  }

  private buildDuelBoard(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    // Deep atmospheric sanctuary hall floor
    const outerPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 30, 1.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x07090f, roughness: 0.92, metalness: 0.12 })
    );
    outerPlinth.position.y = -0.78;
    outerPlinth.receiveShadow = true;
    this.scene.add(outerPlinth);

    // Opponent Dark Basalt Arena Half (z < 0) with PBR bump map
    const oppTextures = makeStoneFloorTextures('volcanic');
    oppTextures.map.anisotropy = maxAniso;
    oppTextures.bumpMap.anisotropy = maxAniso;
    const oppGround = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.24, 6.2),
      new THREE.MeshStandardMaterial({
        map: oppTextures.map,
        bumpMap: oppTextures.bumpMap,
        bumpScale: 0.045,
        color: 0xffffff,
        roughness: 0.72,
        metalness: 0.14,
      })
    );
    oppGround.position.set(0, -0.12, -3.12);
    oppGround.receiveShadow = true;
    this.scene.add(oppGround);

    // Player Honed Sanctuary Marble Half (z > 0) with PBR bump map
    const plrTextures = makeStoneFloorTextures('temple');
    plrTextures.map.anisotropy = maxAniso;
    plrTextures.bumpMap.anisotropy = maxAniso;
    const plrGround = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.24, 6.2),
      new THREE.MeshStandardMaterial({
        map: plrTextures.map,
        bumpMap: plrTextures.bumpMap,
        bumpScale: 0.045,
        color: 0xffffff,
        roughness: 0.64,
        metalness: 0.12,
      })
    );
    plrGround.position.set(0, -0.12, 3.12);
    plrGround.receiveShadow = true;
    this.scene.add(plrGround);

    // Heavy Carved Obsidian Table Apron Surround
    const boardRim = new THREE.Mesh(
      new THREE.BoxGeometry(16.3, 0.32, 13.5),
      new THREE.MeshStandardMaterial({ color: 0x11141d, roughness: 0.48, metalness: 0.42 })
    );
    boardRim.position.set(0, -0.22, 0);
    boardRim.receiveShadow = true;
    this.scene.add(boardRim);

    // Brushed Antique-Gold Inlay Rails framing all 4 edges of the stone arena
    const goldRailMat = new THREE.MeshStandardMaterial({
      color: 0xc9a04e,
      roughness: 0.28,
      metalness: 0.86,
    });
    const northRail = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.06, 0.12), goldRailMat);
    northRail.position.set(0, 0.01, -6.28);
    const southRail = northRail.clone();
    southRail.position.set(0, 0.01, 6.28);
    const westRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 12.68), goldRailMat);
    westRail.position.set(-7.68, 0.01, 0);
    const eastRail = westRail.clone();
    eastRail.position.set(7.68, 0.01, 0);
    this.scene.add(northRail, southRail, westRail, eastRail);

    // Engraved Brushed-Bronze Midfield Divider Strip
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.025, 0.12),
      goldRailMat
    );
    divider.position.set(0, 0.005, 0);
    this.scene.add(divider);

    // 4 Sculpted Bronze Corner Braziers (realistic atmospheric lighting)
    this.buildAvatarObelisk(-8.2, 6.1, 0xf59e0b, 0x161922);
    this.buildAvatarObelisk(8.2, 6.1, 0xf59e0b, 0x161922);
    this.buildAvatarObelisk(-8.2, -6.1, 0xea580c, 0x1a1416);
    this.buildAvatarObelisk(8.2, -6.1, 0xea580c, 0x1a1416);

    // Build Zones: Master Rule 4/5 7-column etched-stone inlays
    const mTexPlayer = makeZoneTileTexture('#c99b44', '⚔', 'MONSTRUO');
    const stTexPlayer = makeZoneTileTexture('#2a9d8f', '✦', 'MÁGICA / TRAMPA');
    const mTexOpp = makeZoneTileTexture('#b86b3a', '⚔', 'MONSTRUO');
    const stTexOpp = makeZoneTileTexture('#a84674', '✦', 'MÁGICA / TRAMPA');
    const pendLeftTex = makePendulumZoneTexture('LEFT');
    const pendRightTex = makePendulumZoneTexture('RIGHT');
    const emzTex = makeZoneTileTexture('#d4af5f', '★', 'EXTRA');

    for (let i = 0; i < 5; i++) {
      this.createZonePad('player', 'MONSTER', i, BOARD_COLS[i], ROW_PLR_M, mTexPlayer);
      const plrStTex = i === 0 ? pendLeftTex : i === 4 ? pendRightTex : stTexPlayer;
      this.createZonePad('player', 'SPELL_TRAP', i, BOARD_COLS[i], ROW_PLR_ST, plrStTex);

      this.createZonePad('opponent', 'MONSTER', i, BOARD_COLS[i], ROW_OPP_M, mTexOpp);
      const oppStTex = i === 4 ? pendLeftTex : i === 0 ? pendRightTex : stTexOpp;
      this.createZonePad('opponent', 'SPELL_TRAP', i, BOARD_COLS[i], ROW_OPP_ST, oppStTex);
    }

    // 2 Extra Monster Zones
    this.createZonePad('player', 'EXTRA_MONSTER', 0, EMZ_COLS[0], ROW_EMZ, emzTex);
    this.createZonePad('player', 'EXTRA_MONSTER', 1, EMZ_COLS[1], ROW_EMZ, emzTex);

    // Field Spell Zones (Col 0 Monster Row — Emerald)
    const fieldTex = makeZoneTileTexture('#2ea06b', '❖', 'CAMPO');
    this.createZonePad('player', 'FIELD', 0, -COL_SIDE, ROW_PLR_M, fieldTex);
    this.createZonePad('opponent', 'FIELD', 0, COL_SIDE, ROW_OPP_M, fieldTex);

    // Deck (Col 6 S/T Row) & Extra Deck (Col 0 S/T Row)
    this.deckStacks.pDeck = this.buildDeckPedestal(COL_SIDE, ROW_PLR_ST, 'player', 'DECK', 0xc9a04e);
    this.deckStacks.pExtra = this.buildDeckPedestal(-COL_SIDE, ROW_PLR_ST, 'player', 'EXTRA_DECK', 0x7a8599);
    this.deckStacks.oDeck = this.buildDeckPedestal(-COL_SIDE, ROW_OPP_ST, 'opponent', 'DECK', 0xc9a04e);
    this.deckStacks.oExtra = this.buildDeckPedestal(COL_SIDE, ROW_OPP_ST, 'opponent', 'EXTRA_DECK', 0x7a8599);

    // Sculpted Obsidian & Bronze Graveyard & Banished Shrines
    this.buildWellPedestal(COL_SIDE, ROW_PLR_M, 'player', 'GRAVEYARD', 0x475569);
    this.buildWellPedestal(7.45, 1.35, 'player', 'BANISHED', 0x0e7490);
    this.buildWellPedestal(-COL_SIDE, ROW_OPP_M, 'opponent', 'GRAVEYARD', 0x475569);
    this.buildWellPedestal(-7.45, -1.35, 'opponent', 'BANISHED', 0x0e7490);
  }

  private buildAvatarObelisk(x: number, z: number, gemColor: number, baseColor: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Sculpted octagonal stone brazier pedestal
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.64, 0.42, 8),
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.68, metalness: 0.3 })
    );
    base.position.y = 0.21;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Antique bronze bowl rim
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.055, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xc9a04e, roughness: 0.28, metalness: 0.88 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.44;
    group.add(ring);

    // Glowing ember crystal core inside the brazier
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({
        color: gemColor,
        emissive: gemColor,
        emissiveIntensity: 1.4,
        roughness: 0.2,
        metalness: 0.2,
      })
    );
    crystal.position.y = 0.62;
    group.add(crystal);
    this.duelOrbitCrystal.push(crystal);

    this.scene.add(group);
  }

  private buildDeckPedestal(
    x: number,
    z: number,
    owner: PlayerId,
    zone: ZoneLocation,
    accentHex: number
  ): THREE.Mesh {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = owner === 'player' ? 0 : Math.PI;

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.1, 2.18),
      new THREE.MeshStandardMaterial({ color: 0x151821, roughness: 0.52, metalness: 0.48 })
    );
    plinth.position.y = 0.05;
    plinth.receiveShadow = true;
    group.add(plinth);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(1.66, 0.035, 2.24),
      new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.3, metalness: 0.82 })
    );
    trim.position.y = 0.018;
    group.add(trim);

    const backTex = this.texFactory.getCardBackTexture();
    const stackMats = [
      new THREE.MeshStandardMaterial({ color: 0xc7bba8, roughness: 0.72 }),
      new THREE.MeshStandardMaterial({ color: 0xc7bba8, roughness: 0.72 }),
      new THREE.MeshStandardMaterial({ map: backTex, color: 0xffffff, roughness: 0.42, metalness: 0.06 }),
      new THREE.MeshStandardMaterial({ color: 0x151821 }),
      new THREE.MeshStandardMaterial({ color: 0xc7bba8, roughness: 0.72 }),
      new THREE.MeshStandardMaterial({ color: 0xc7bba8, roughness: 0.72 }),
    ];
    const stack = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.45, 2.02), stackMats);
    stack.position.y = 0.33;
    stack.castShadow = true;
    stack.receiveShadow = true;
    stack.userData = { owner, zone, index: 0 };
    group.add(stack);
    this.interactables.push(stack);
    this.scene.add(group);
    return stack;
  }

  private buildWellPedestal(x: number, z: number, owner: PlayerId, zone: ZoneLocation, accentHex: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Sculpted dark obsidian crypt ring
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.84, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x141720, roughness: 0.55, metalness: 0.45 })
    );
    ring.position.y = 0.06;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);

    // Antique brass inner collar
    const brassRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.032, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0xc9a04e, roughness: 0.3, metalness: 0.85 })
    );
    brassRing.rotation.x = Math.PI / 2;
    brassRing.position.y = 0.125;
    group.add(brassRing);

    // Deep recessed dark crypt core (subtle glow instead of flat white disc)
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 28),
      new THREE.MeshStandardMaterial({
        color: 0x0b0e16,
        emissive: accentHex,
        emissiveIntensity: 0.38,
        roughness: 0.35,
        metalness: 0.3,
      })
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = 0.122;
    core.userData = { owner, zone, index: 0 };
    group.add(core);
    this.interactables.push(core);
    this.scene.add(group);
  }

  private createZonePad(
    owner: PlayerId,
    zone: ZoneLocation,
    index: number,
    x: number,
    z: number,
    tex: THREE.CanvasTexture
  ): void {
    const key = `${owner}_${zone}_${index}`;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      transparent: true,
      roughness: 0.5,
      metalness: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 2.1), mat);
    pad.rotation.x = -Math.PI / 2;
    if (owner === 'opponent') pad.rotation.z = Math.PI;
    pad.position.set(x, 0.025, z);
    pad.userData = { owner, zone, index, baseColor: 0xffffff };
    this.scene.add(pad);
    this.zoneFrames.set(key, pad);
    this.interactables.push(pad);
  }

  private getZoneWorldPosition(owner: PlayerId, zone: ZoneLocation, index: number): THREE.Vector3 {
    if (zone === 'EXTRA_MONSTER') {
      return new THREE.Vector3(EMZ_COLS[index] ?? 0, 0.12, ROW_EMZ);
    }
    if (zone === 'FIELD') {
      return new THREE.Vector3(
        owner === 'player' ? -COL_SIDE : COL_SIDE,
        0.12,
        owner === 'player' ? ROW_PLR_M : ROW_OPP_M
      );
    }
    if (zone === 'PENDULUM_LEFT') {
      // Master Rule 4/5: Left Pendulum Zone = leftmost S/T slot (index 0 for player, index 4 for opponent)
      return new THREE.Vector3(
        owner === 'player' ? BOARD_COLS[0] : BOARD_COLS[4],
        0.12,
        owner === 'player' ? ROW_PLR_ST : ROW_OPP_ST
      );
    }
    if (zone === 'PENDULUM_RIGHT') {
      // Master Rule 4/5: Right Pendulum Zone = rightmost S/T slot (index 4 for player, index 0 for opponent)
      return new THREE.Vector3(
        owner === 'player' ? BOARD_COLS[4] : BOARD_COLS[0],
        0.12,
        owner === 'player' ? ROW_PLR_ST : ROW_OPP_ST
      );
    }
    const x = BOARD_COLS[index] ?? 0;
    const z =
      owner === 'player'
        ? zone === 'MONSTER'
          ? ROW_PLR_M
          : ROW_PLR_ST
        : zone === 'MONSTER'
        ? ROW_OPP_M
        : ROW_OPP_ST;
    return new THREE.Vector3(x, 0.12, z);
  }

  setMode(mode: 'TITLE' | 'DUEL'): void {
    this.camMode = mode;
    if (mode === 'DUEL') {
      this.camTargetPos.set(0, 12.2, 10.9);
      this.camLookTarget.set(0, 0, 0.35);
    }
  }

  setCameraDynamics(enabled: boolean): void {
    this.cameraDynamics = enabled;
  }

  syncDuelState(
    duel: DuelState | null,
    selectedUid: string | null,
    targetableUids: string[]
  ): void {
    this.latestDuel = duel;
    this.selectedUid = selectedUid;
    this.targetableUids = new Set(targetableUids);

    const disposeCardGroup = (group: THREE.Group) => {
      for (const child of group.children) {
        if (child instanceof THREE.Mesh && Array.isArray(child.material)) {
          for (const mat of child.material) {
            if (mat !== this.cardSideMat) {
              mat.dispose();
            }
          }
        }
      }
      this.scene.remove(group);
    };

    if (!duel) {
      // Clear field cards when returning to menu
      for (const [, entry] of this.cardMeshes) {
        disposeCardGroup(entry.group);
        this.interactables = this.interactables.filter((o) => o.parent !== entry.group);
      }
      this.cardMeshes.clear();
      return;
    }

    // Update deck thickness scales
    const scaleStack = (mesh: THREE.Mesh | null, count: number, max: number) => {
      if (!mesh) return;
      mesh.visible = count > 0;
      const ratio = Math.max(0.12, Math.min(1, count / max));
      mesh.scale.y = ratio;
      mesh.position.y = 0.12 + 0.22 * ratio;
    };
    scaleStack(this.deckStacks.pDeck, duel.player.deck.length, 40);
    scaleStack(this.deckStacks.pExtra, duel.player.extraDeck.length, 15);
    scaleStack(this.deckStacks.oDeck, duel.opponent.deck.length, 40);
    scaleStack(this.deckStacks.oExtra, duel.opponent.extraDeck.length, 15);

    // Collect all live cards on the 3D board
    const activeCards: CardInstance[] = [
      ...CardManager.getAllFieldCards(duel, 'player'),
      ...CardManager.getAllFieldCards(duel, 'opponent'),
    ];
    const activeUidSet = new Set(activeCards.map((c) => c.uid));

    // Remove cards no longer on board
    for (const [uid, entry] of this.cardMeshes.entries()) {
      if (!activeUidSet.has(uid)) {
        disposeCardGroup(entry.group);
        this.interactables = this.interactables.filter((o) => !entry.group.children.includes(o));
        this.cardMeshes.delete(uid);
      }
    }

    // Create or update board card meshes
    for (const card of activeCards) {
      const targetPos = this.getZoneWorldPosition(card.controller, card.location, card.zoneIndex);
      const isOpp = card.controller === 'opponent';
      const targetRotY = (isOpp ? Math.PI : 0) + (card.position === 'DEF' ? Math.PI / 2 : 0);
      const targetRotZ = card.faceUp ? 0 : Math.PI;

      let entry = this.cardMeshes.get(card.uid);
      if (!entry) {
        const group = new THREE.Group();
        group.position.set(targetPos.x, targetPos.y + 1.4, targetPos.z + (isOpp ? -2 : 2));

        const faceTex = this.texFactory.getCardFaceTexture(card.cardId);
        const backTex = this.texFactory.getCardBackTexture();
        const mats = [
          this.cardSideMat,
          this.cardSideMat,
          new THREE.MeshStandardMaterial({ map: faceTex, color: 0xffffff, roughness: 0.32, metalness: 0.12 }),
          new THREE.MeshStandardMaterial({ map: backTex, color: 0xffffff, roughness: 0.5, metalness: 0.08 }),
          this.cardSideMat,
          this.cardSideMat,
        ];
        const mesh = new THREE.Mesh(this.cardGeom, mats);
        mesh.castShadow = !this.isSoftwareGl;
        mesh.receiveShadow = true;
        mesh.userData = {
          owner: card.controller,
          zone: card.location,
          index: card.zoneIndex,
          cardUid: card.uid,
        };
        group.add(mesh);

        // Soft contact shadow disc
        const shadowDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.95, 16),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
        );
        shadowDisc.rotation.x = -Math.PI / 2;
        shadowDisc.position.y = -0.08;
        group.add(shadowDisc);

        this.scene.add(group);
        this.interactables.push(mesh);
        entry = { group, targetPos, targetRotY, targetRotZ };
        this.cardMeshes.set(card.uid, entry);
      } else {
        entry.targetPos.copy(targetPos);
        entry.targetRotY = targetRotY;
        entry.targetRotZ = targetRotZ;
        const mesh = entry.group.children[0] as THREE.Mesh;
        mesh.userData.owner = card.controller;
        mesh.userData.zone = card.location;
        mesh.userData.index = card.zoneIndex;
      }
    }

    // Highlight selected / targetable zones
    this.zoneFrames.forEach((pad) => {
      const mat = pad.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    });

    for (const card of activeCards) {
      const zoneKey = `${card.controller}_${card.location}_${card.zoneIndex}`;
      const pad = this.zoneFrames.get(zoneKey);
      if (!pad) continue;
      const mat = pad.material as THREE.MeshStandardMaterial;
      if (card.uid === selectedUid) {
        mat.emissive.setHex(0xfacc15);
        mat.emissiveIntensity = 1.4;
      } else if (this.targetableUids.has(card.uid)) {
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 1.4;
      }
    }

    // Process new DuelEventCues for particles, summon beam, and camera impact
    for (const cue of duel.recentCues) {
      if (this.seenCueIds.has(cue.id)) continue;
      this.seenCueIds.add(cue.id);
      this.triggerCueVFX(cue);
    }
  }

  private triggerCueVFX(cue: DuelEventCue): void {
    const pos = cue.sourceZone
      ? this.getZoneWorldPosition(cue.sourceZone.owner, cue.sourceZone.zone, cue.sourceZone.index)
      : cue.targetZone
      ? this.getZoneWorldPosition(cue.targetZone.owner, cue.targetZone.zone, cue.targetZone.index)
      : _vec3.set(0, 0.2, 0);

    if (cue.kind === 'BOSS_SUMMON') {
      this.spawnBurst(pos.x, 0.3, pos.z, 36, 0x38bdf8);
      this.summonBeamMesh.position.set(pos.x, 4.5, pos.z);
      this.summonBeamMesh.visible = true;
      (this.summonBeamMesh.material as THREE.MeshBasicMaterial).color.setHex(
        cue.summonMethod === 'SYNCHRO'
          ? 0x34d399
          : cue.summonMethod === 'XYZ'
          ? 0xfacc15
          : cue.summonMethod === 'FUSION'
          ? 0xc084fc
          : 0x38bdf8
      );
      this.summonBeamTimer = 1.0;
      this.trauma = Math.min(1, this.trauma + 0.55);
      if (this.cameraDynamics && this.camMode === 'DUEL') {
        this.camMode = 'SUMMON_FOCUS';
        this.camTargetPos.set(pos.x * 0.5, 6.4, pos.z + 5.8);
        this.camLookTarget.set(pos.x, 0.6, pos.z);
        this.camFocusTimer = 1.25;
      }
    } else if (cue.kind === 'SUMMON') {
      this.spawnBurst(pos.x, 0.25, pos.z, 18, 0xfacc15);
    } else if (cue.kind === 'ATTACK') {
      this.spawnBurst(pos.x, 0.3, pos.z, 14, 0xfb923c);
      if (this.cameraDynamics && this.camMode === 'DUEL') {
        this.camMode = 'ATTACK_FOCUS';
        this.camTargetPos.set(0, 9.8, 8.6);
        this.camLookTarget.set(0, 0.2, 0);
        this.camFocusTimer = 0.65;
      }
    } else if (cue.kind === 'DAMAGE' || cue.kind === 'DESTROY') {
      this.spawnBurst(pos.x, 0.35, pos.z, 28, 0xef4444);
      this.trauma = Math.min(1, this.trauma + 0.65);
    } else if (cue.kind === 'EFFECT') {
      this.spawnBurst(pos.x, 0.3, pos.z, 20, 0x34d399);
    }
  }

  private spawnBurst(x: number, y: number, z: number, count: number, hexColor: number): void {
    _color.setHex(hexColor);
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.5 + Math.random() * 3.8;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.cos(angle) * speed;
      slot.vy = 2.2 + Math.random() * 3.5;
      slot.vz = Math.sin(angle) * speed;
      slot.life = 0;
      slot.maxLife = 0.45 + Math.random() * 0.45;
      slot.scale = 0.7 + Math.random() * 0.8;
      slot.r = _color.r;
      slot.g = _color.g;
      slot.b = _color.b;
    }
  }

  private handleClick = (event: MouseEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, false);
    if (hits.length > 0) {
      const ud = hits[0].object.userData;
      this.onZoneClick({
        owner: ud.owner,
        zone: ud.zone,
        index: ud.index,
        cardUid: ud.cardUid,
        screenX: event.clientX,
        screenY: event.clientY,
      });
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverCheck < 50) return;
    this.lastHoverCheck = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, false);
    this.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'default';
  };

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = this.clock.elapsedTime;

      // Animate floating avatar crystals
      this.duelOrbitCrystal.forEach((c, idx) => {
        c.rotation.y += dt * (idx === 0 ? 1.1 : -1.1);
        c.position.y = 1.15 + Math.sin(elapsed * 2 + idx) * 0.12;
      });

      // Camera Choreography
      if (this.camMode === 'TITLE') {
        const angle = elapsed * 0.16;
        this.camTargetPos.set(Math.sin(angle) * 10.8, 9.2 + Math.sin(elapsed * 0.3) * 0.8, Math.cos(angle) * 11.4);
        this.camLookTarget.set(0, 0.2, 0);
      } else if (this.camMode === 'SUMMON_FOCUS' || this.camMode === 'ATTACK_FOCUS') {
        this.camFocusTimer -= dt;
        if (this.camFocusTimer <= 0) {
          this.camMode = 'DUEL';
          this.camTargetPos.set(0, 12.1, 10.7);
          this.camLookTarget.set(0, 0, 0.45);
        }
      }

      const dampAlpha = 1 - Math.exp(-5.5 * dt);
      this.camera.position.lerp(this.camTargetPos, dampAlpha);
      this.camLookCurrent.lerp(this.camLookTarget, dampAlpha);
      this.camera.lookAt(this.camLookCurrent);

      // Trauma shake
      if (this.trauma > 0) {
        const shake = this.trauma * this.trauma;
        this.camera.position.x += (Math.random() - 0.5) * shake * 0.45;
        this.camera.position.y += (Math.random() - 0.5) * shake * 0.35;
        this.trauma = Math.max(0, this.trauma - dt * 1.9);
      }

      // Summon pillar fade
      if (this.summonBeamTimer > 0) {
        this.summonBeamTimer -= dt;
        const mat = this.summonBeamMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, this.summonBeamTimer * 0.65);
        this.summonBeamMesh.rotation.y += dt * 3;
        if (this.summonBeamTimer <= 0) this.summonBeamMesh.visible = false;
      }

      // Smoothly damp card meshes to target positions & rotations
      for (const [, entry] of this.cardMeshes) {
        entry.group.position.lerp(entry.targetPos, 1 - Math.exp(-10 * dt));
        entry.group.rotation.y = THREE.MathUtils.damp(entry.group.rotation.y, entry.targetRotY, 10, dt);
        entry.group.rotation.z = THREE.MathUtils.damp(entry.group.rotation.z, entry.targetRotZ, 10, dt);
      }

      // Update pooled particles (Zero-GC)
      let particlesDirty = false;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.active) continue;
        particlesDirty = true;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          _mat4.makeScale(0, 0, 0);
          this.particleMesh.setMatrixAt(i, _mat4);
          continue;
        }
        p.vy -= 5.2 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const t = 1 - p.life / p.maxLife;
        const s = p.scale * t;
        _vec3.set(p.x, p.y, p.z);
        _euler.set(p.life * 4, p.life * 3, 0);
        _quat.setFromEuler(_euler);
        _scaleVec.set(s, s, s);
        _mat4.compose(_vec3, _quat, _scaleVec);
        this.particleMesh.setMatrixAt(i, _mat4);
        _color.setRGB(p.r, p.g, p.b);
        this.particleMesh.setColorAt(i, _color);
      }
      if (particlesDirty) {
        this.particleMesh.instanceMatrix.needsUpdate = true;
        if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
      }

      this.renderer.render(this.scene, this.camera);

      // Project board monster badges to 2D HUD at <= 15Hz
      const now = performance.now();
      if (this.latestDuel && now - this.lastBadgeEmit > 75) {
        this.lastBadgeEmit = now;
        this.emitProjectedBadges();
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private emitProjectedBadges(): void {
    if (!this.latestDuel) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const badges: ProjectedBadge[] = [];

    const allMons = [
      ...CardManager.getAllFieldMonsters(this.latestDuel, 'player'),
      ...CardManager.getAllFieldMonsters(this.latestDuel, 'opponent'),
    ];

    for (const m of allMons) {
      const entry = this.cardMeshes.get(m.uid);
      if (!entry) continue;
      _vec3.copy(entry.group.position);
      _vec3.z += m.controller === 'player' ? 1.15 : -1.15;
      _vec3.project(this.camera);
      if (_vec3.z < -1 || _vec3.z > 1) continue;

      const screenX = ((_vec3.x + 1) / 2) * width;
      const screenY = ((-_vec3.y + 1) / 2) * height;
      const def = CardManager.getDef(m.cardId);
      const stats = CardManager.getEffectiveStats(this.latestDuel, m);
      const canAttack =
        this.latestDuel.activePlayer === 'player' &&
        this.latestDuel.phase === 'BATTLE' &&
        this.latestDuel.turnNumber > 1 &&
        m.controller === 'player' &&
        m.faceUp &&
        m.position === 'ATK' &&
        !m.attackedThisTurn &&
        !m.restrictions.includes('CANNOT_ATTACK');

      badges.push({
        uid: m.uid,
        cardId: m.cardId,
        controller: m.controller,
        atk: stats.atk,
        def: stats.def,
        level: def.level,
        isXyz: def.subtype === 'xyz',
        xyzCount: m.xyzMaterials.length,
        isLink: def.subtype === 'link',
        faceUp: m.faceUp,
        position: m.position,
        screenX,
        screenY,
        canAttack,
        isTargetable: this.targetableUids.has(m.uid),
        isSelected: m.uid === this.selectedUid,
      });
    }

    this.onProjectedBadges(badges);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.texFactory.dispose();
    this.cardGeom.dispose();
    this.cardSideMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
