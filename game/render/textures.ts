import * as THREE from "three";

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function asphaltTexture(): THREE.CanvasTexture {
  return canvasTex(512, (ctx, s) => {
    ctx.fillStyle = "#2a2a2c";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) {
      const n = 20 + Math.random() * 30;
      ctx.fillStyle = `rgb(${n},${n},${n + 2})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    ctx.strokeStyle = "#c9b44a";
    ctx.lineWidth = 6;
    ctx.setLineDash([28, 22]);
    ctx.beginPath();
    ctx.moveTo(s / 2, 0);
    ctx.lineTo(s / 2, s);
    ctx.stroke();
  });
}

export function sidewalkTexture(): THREE.CanvasTexture {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#8a8478";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#5a564e";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i * s) / 8, 0);
      ctx.lineTo((i * s) / 8, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * s) / 8);
      ctx.lineTo(s, (i * s) / 8);
      ctx.stroke();
    }
  });
}

export function dirtTexture(): THREE.CanvasTexture {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#3d3428";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 8, 8);
    }
  });
}

export function commitFacadeTexture(level: number, lit: boolean): THREE.CanvasTexture {
  const walls = ["#0d1117", "#0e4429", "#006d32", "#26a641", "#39d353"];
  const roofs = ["#010409", "#052e16", "#0e4429", "#006d32", "#196c2e"];
  const wall = walls[Math.max(0, Math.min(4, level))] ?? walls[1];
  const roof = roofs[Math.max(0, Math.min(4, level))] ?? roofs[1];
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = roof;
    ctx.fillRect(0, 0, s, 18);
    const cols = 4;
    const rows = 5;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const on = lit && Math.random() > 0.5;
        ctx.fillStyle = on ? "#9be9a8" : "#010409";
        const wx = 22 + x * 58;
        const wy = 28 + y * 42;
        ctx.fillRect(wx, wy, 28, 22);
      }
    }
  });
}

export function facadeTexture(hue: number, lit: boolean): THREE.CanvasTexture {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = `hsl(${hue * 360} 32% 46%)`;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = `hsl(${hue * 360} 22% 34%)`;
    ctx.fillRect(0, 0, s, 18);
    const cols = 4;
    const rows = 5;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const on = lit && Math.random() > 0.55;
        ctx.fillStyle = on ? "#e8c36a" : "#1a1e24";
        const wx = 22 + x * 58;
        const wy = 28 + y * 42;
        ctx.fillRect(wx, wy, 28, 22);
      }
    }
  });
}
