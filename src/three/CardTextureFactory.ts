import * as THREE from 'three';
import { CardDefinition, CardSubtype } from '../types/tcg';
import { CardManager } from '../engine/CardManager';

const FRAME_COLORS: Record<CardSubtype | 'spell' | 'trap', [string, string]> = {
  normal: ['#c99e48', '#785a1c'],
  effect: ['#c4692b', '#6d320e'],
  fusion: ['#7d46a8', '#3c1b59'],
  synchro: ['#d5dde8', '#7a8799'],
  xyz: ['#1d212b', '#07090e'],
  pendulum: ['#1c7d63', '#8c6927'],
  link: ['#1a56b0', '#0a2554'],
  ritual: ['#3b6ec4', '#163166'],
  continuous: ['#127860', '#073b2f'],
  equip: ['#127860', '#073b2f'],
  field: ['#127860', '#073b2f'],
  quickplay: ['#127860', '#073b2f'],
  counter: ['#a62b63', '#4d0e2b'],
  spell: ['#127860', '#073b2f'],
  trap: ['#a62b63', '#4d0e2b'],
};

export function drawProceduralMotif(
  ctx: CanvasRenderingContext2D,
  card: CardDefinition,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const [c1, c2, glow] = card.artPalette;
  const bg = ctx.createRadialGradient(x + w * 0.5, y + h * 0.42, w * 0.05, x + w * 0.5, y + h * 0.5, w * 0.78);
  bg.addColorStop(0, c1);
  bg.addColorStop(0.55, c2);
  bg.addColorStop(1, '#07090f');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;

  // Arcane geometry ring
  ctx.save();
  ctx.strokeStyle = glow;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1.5, w * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.24, 0, Math.PI * 2);
  ctx.stroke();

  // Motif silhouette emblem
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = glow;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.2, w * 0.01);

  if (card.artMotif === 'dragon' || card.artMotif === 'seraph') {
    // Winged dragon / seraph crest
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.34, cy - h * 0.08);
    ctx.lineTo(cx + w * 0.16, cy + h * 0.12);
    ctx.lineTo(cx + w * 0.22, cy + h * 0.3);
    ctx.lineTo(cx, cy + h * 0.18);
    ctx.lineTo(cx - w * 0.22, cy + h * 0.3);
    ctx.lineTo(cx - w * 0.16, cy + h * 0.12);
    ctx.lineTo(cx - w * 0.34, cy - h * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (card.artMotif === 'knight' || card.artMotif === 'mech') {
    // Shield & Twin Blade emblem
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.32);
    ctx.lineTo(cx + w * 0.24, cy - h * 0.16);
    ctx.lineTo(cx + w * 0.18, cy + h * 0.16);
    ctx.lineTo(cx, cy + h * 0.34);
    ctx.lineTo(cx - w * 0.18, cy + h * 0.16);
    ctx.lineTo(cx - w * 0.24, cy - h * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (card.artMotif === 'spell' || card.artMotif === 'field') {
    // Hexagram rune star
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      const rot = (i * Math.PI) / 3;
      for (let p = 0; p < 3; p++) {
        const ang = rot + (p * Math.PI * 2) / 3 - Math.PI / 2;
        const px = cx + Math.cos(ang) * w * 0.28;
        const py = cy + Math.sin(ang) * h * 0.28;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Diamond arcane crystal
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.22, cy);
    ctx.lineTo(cx, cy + h * 0.3);
    ctx.lineTo(cx - w * 0.22, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export class CardTextureFactory {
  private faceCache = new Map<string, THREE.CanvasTexture>();
  private backTexture: THREE.CanvasTexture | null = null;
  private imageCache = new Map<string, HTMLImageElement>();
  private maxAniso = 4;

  setMaxAnisotropy(aniso: number): void {
    this.maxAniso = Math.max(1, aniso);
  }

  getCardBackTexture(): THREE.CanvasTexture {
    if (this.backTexture) return this.backTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 372;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 256, 372);
    grad.addColorStop(0, '#1e1410');
    grad.addColorStop(0.5, '#3b2416');
    grad.addColorStop(1, '#120c09');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 372);

    ctx.strokeStyle = '#c89b3c';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 236, 352);

    ctx.strokeStyle = 'rgba(218, 175, 72, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 216, 332);

    // Central swirl vortex
    const vGrad = ctx.createRadialGradient(128, 186, 8, 128, 186, 86);
    vGrad.addColorStop(0, '#05060a');
    vGrad.addColorStop(0.65, '#191426');
    vGrad.addColorStop(1, 'rgba(59, 36, 22, 0)');
    ctx.fillStyle = vGrad;
    ctx.beginPath();
    ctx.ellipse(128, 186, 72, 108, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d4a53a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(128, 186, 66, 98, 0, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;
    this.backTexture = tex;
    return tex;
  }

  getCardFaceTexture(cardId: string, onAsyncLoad?: () => void): THREE.CanvasTexture {
    const existing = this.faceCache.get(cardId);
    if (existing) return existing;

    const card = CardManager.getDef(cardId);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 372;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;

    const paint = (img?: HTMLImageElement) => {
      const palette =
        card.category === 'SPELL'
          ? FRAME_COLORS.spell
          : card.category === 'TRAP'
          ? FRAME_COLORS.trap
          : FRAME_COLORS[card.subtype];

      const frameGrad = ctx.createLinearGradient(0, 0, 256, 372);
      frameGrad.addColorStop(0, palette[0]);
      frameGrad.addColorStop(1, palette[1]);
      ctx.fillStyle = frameGrad;
      ctx.fillRect(0, 0, 256, 372);

      // Outer border
      ctx.strokeStyle = '#0c0f16';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 248, 364);

      // Title bar
      ctx.fillStyle = 'rgba(10, 13, 20, 0.72)';
      ctx.fillRect(16, 16, 224, 30);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 16, 224, 30);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(card.name.slice(0, 24), 22, 36);

      // Stars / Level bar
      if (card.category === 'MONSTER') {
        ctx.fillStyle = '#facc15';
        const count = Math.min(card.level, 8);
        for (let i = 0; i < count; i++) {
          ctx.beginPath();
          ctx.arc(230 - i * 16, 58, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Art box
      const artX = 20;
      const artY = 70;
      const artW = 216;
      const artH = 196;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, artX, artY, artW, artH);
      } else {
        drawProceduralMotif(ctx, card, artX, artY, artW, artH);
      }
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeRect(artX, artY, artW, artH);

      // Bottom effect/stat box
      ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
      ctx.fillRect(16, 276, 224, 80);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 276, 224, 80);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px sans-serif';
      ctx.fillText(card.description.slice(0, 34), 24, 296);
      ctx.fillText(card.description.slice(34, 68), 24, 312);

      if (card.category === 'MONSTER') {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`ATK ${card.atk}  /  DEF ${card.def}`, 24, 344);
      } else {
        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(card.category === 'SPELL' ? 'CARTA MÁGICA' : 'CARTA DE TRAMPA', 24, 344);
      }

      tex.needsUpdate = true;
    };

    paint();

    const artSrc = card.imageUrl ?? card.bossImage;
    if (artSrc) {
      const cachedImg = this.imageCache.get(artSrc);
      if (cachedImg && cachedImg.complete) {
        paint(cachedImg);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.imageCache.set(artSrc, img);
          paint(img);
          onAsyncLoad?.();
        };
        img.src = artSrc;
      }
    }

    this.faceCache.set(cardId, tex);
    return tex;
  }

  dispose(): void {
    this.faceCache.forEach((t) => t.dispose());
    this.faceCache.clear();
    this.backTexture?.dispose();
    this.backTexture = null;
  }
}
