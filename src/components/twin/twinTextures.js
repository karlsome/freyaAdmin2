import * as THREE from "three";

/**
 * Procedural canvas textures (no external assets) for the soft status glow
 * under each machine and the selection outline.
 */
let glowTexture = null;
let outlineTexture = null;

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.filter = "blur(22px)";
  ctx.fillStyle = "#ffffff";
  roundedRectPath(ctx, 48, 48, size - 96, size - 96, 40);
  ctx.fill();
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function getOutlineTexture() {
  if (outlineTexture) return outlineTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  ctx.setLineDash([22, 12]);
  roundedRectPath(ctx, 12, 12, size - 24, size - 24, 30);
  ctx.stroke();
  outlineTexture = new THREE.CanvasTexture(canvas);
  outlineTexture.colorSpace = THREE.SRGBColorSpace;
  return outlineTexture;
}
