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

let heatTexture = null;
/**
 * Procedural circular radial heat-aura texture for temperature sensors on the floor.
 */
export function getRadialHeatTexture() {
  if (heatTexture) return heatTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.25, "rgba(255, 255, 255, 0.85)");
  grad.addColorStop(0.55, "rgba(255, 255, 255, 0.40)");
  grad.addColorStop(0.85, "rgba(255, 255, 255, 0.10)");
  grad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  heatTexture = new THREE.CanvasTexture(canvas);
  heatTexture.colorSpace = THREE.SRGBColorSpace;
  return heatTexture;
}

let heatRingTexture = null;
/**
 * Circular wave ring texture for heat stress hazard warnings.
 */
export function getHeatRingTexture() {
  if (heatRingTexture) return heatRingTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const half = size / 2;
  ctx.beginPath();
  ctx.arc(half, half, half - 12, 0, Math.PI * 2);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.stroke();
  heatRingTexture = new THREE.CanvasTexture(canvas);
  heatRingTexture.colorSpace = THREE.SRGBColorSpace;
  return heatRingTexture;
}

