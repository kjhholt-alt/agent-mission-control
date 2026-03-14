"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Factory floor ground plane — concrete/metal plate pattern with
 * yellow warning stripes, cyan grid lines, scuff marks, and wear.
 * Factorio-style industrial aesthetic.
 */
export function Ground() {
  const gridTexture = useMemo(() => {
    const size = 2048;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Seeded pseudo-random for consistent scuff marks
    let seed = 42;
    const seededRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Dark concrete base
    ctx.fillStyle = "#12131a";
    ctx.fillRect(0, 0, size, size);

    const tileSize = size / 25; // 25 major tiles across

    // Draw concrete/metal plate tiles — alternating dark/lighter rectangles
    for (let tx = 0; tx < 25; tx++) {
      for (let ty = 0; ty < 25; ty++) {
        const x = tx * tileSize;
        const y = ty * tileSize;
        const isLight = (tx + ty) % 2 === 0;

        // Tile fill
        ctx.fillStyle = isLight ? "#16171f" : "#111218";
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // Tile border — subtle groove line
        ctx.strokeStyle = "rgba(40, 42, 55, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);

        // Inner metal plate detail on lighter tiles
        if (isLight) {
          const inset = tileSize * 0.15;
          ctx.strokeStyle = "rgba(50, 52, 65, 0.3)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + inset, y + inset, tileSize - inset * 2, tileSize - inset * 2);

          // Rivet dots in corners of inner plate
          const rivetInset = inset + 3;
          ctx.fillStyle = "rgba(60, 62, 75, 0.5)";
          for (const [rx, ry] of [
            [x + rivetInset, y + rivetInset],
            [x + tileSize - rivetInset, y + rivetInset],
            [x + rivetInset, y + tileSize - rivetInset],
            [x + tileSize - rivetInset, y + tileSize - rivetInset],
          ]) {
            ctx.beginPath();
            ctx.arc(rx, ry, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Yellow warning stripes along edges (top, bottom, left, right)
    const stripeWidth = tileSize * 0.6;
    const stripeAngle = Math.PI / 4;
    const stripePitch = 18;

    const drawWarningStripes = (
      sx: number,
      sy: number,
      sw: number,
      sh: number
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy, sw, sh);
      ctx.clip();

      // Dark base for stripe area
      ctx.fillStyle = "#1a1a10";
      ctx.fillRect(sx, sy, sw, sh);

      // Yellow diagonal stripes
      ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
      ctx.lineWidth = 8;
      const maxDim = Math.max(sw, sh) * 2;
      for (let i = -maxDim; i < maxDim; i += stripePitch) {
        ctx.beginPath();
        ctx.moveTo(sx + i, sy);
        ctx.lineTo(sx + i + maxDim * Math.tan(stripeAngle), sy + maxDim);
        ctx.stroke();
      }

      // Black alternating stripes
      ctx.strokeStyle = "rgba(10, 10, 15, 0.5)";
      ctx.lineWidth = 8;
      for (let i = -maxDim + stripePitch / 2; i < maxDim; i += stripePitch) {
        ctx.beginPath();
        ctx.moveTo(sx + i, sy);
        ctx.lineTo(sx + i + maxDim * Math.tan(stripeAngle), sy + maxDim);
        ctx.stroke();
      }

      ctx.restore();
    };

    // Edge warning stripes
    drawWarningStripes(0, 0, size, stripeWidth); // top
    drawWarningStripes(0, size - stripeWidth, size, stripeWidth); // bottom
    drawWarningStripes(0, 0, stripeWidth, size); // left
    drawWarningStripes(size - stripeWidth, 0, stripeWidth, size); // right

    // Walkway stripes — horizontal and vertical center lines
    const walkwayWidth = 12;
    const centerX = size / 2;
    const centerY = size / 2;

    drawWarningStripes(centerX - walkwayWidth / 2, stripeWidth, walkwayWidth, size - stripeWidth * 2);
    drawWarningStripes(stripeWidth, centerY - walkwayWidth / 2, size - stripeWidth * 2, walkwayWidth);

    // Subtle cyan grid lines every 2 tiles
    ctx.strokeStyle = "rgba(6, 182, 212, 0.06)";
    ctx.lineWidth = 0.8;
    const majorGridStep = tileSize * 2;
    for (let i = 0; i <= size; i += majorGridStep) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Finer cyan grid dots at every tile intersection
    for (let x = 0; x <= 25; x++) {
      for (let y = 0; y <= 25; y++) {
        const px = x * tileSize;
        const py = y * tileSize;
        const isMajor = x % 5 === 0 && y % 5 === 0;
        ctx.beginPath();
        ctx.arc(px, py, isMajor ? 3 : 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isMajor
          ? "rgba(6, 182, 212, 0.18)"
          : "rgba(6, 182, 212, 0.08)";
        ctx.fill();
      }
    }

    // Scuff marks and wear patterns — random darker spots
    for (let i = 0; i < 120; i++) {
      const sx = seededRandom() * size;
      const sy = seededRandom() * size;
      const sr = 3 + seededRandom() * 15;
      const alpha = 0.03 + seededRandom() * 0.06;

      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fill();
    }

    // Oil stains — slightly brownish circles
    for (let i = 0; i < 30; i++) {
      const sx = seededRandom() * size;
      const sy = seededRandom() * size;
      const sr = 5 + seededRandom() * 20;

      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(30, 25, 15, ${0.05 + seededRandom() * 0.08})`;
      ctx.fill();
    }

    // Scratch lines
    ctx.strokeStyle = "rgba(60, 60, 70, 0.08)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 40; i++) {
      const sx = seededRandom() * size;
      const sy = seededRandom() * size;
      const len = 20 + seededRandom() * 60;
      const angle = seededRandom() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[7, -0.01, 7]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial
        map={gridTexture}
        color="#14151c"
        metalness={0.7}
        roughness={0.65}
      />
    </mesh>
  );
}
