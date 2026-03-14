"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Ground plane with grid dots and subtle cyan grid lines.
 * Creates a canvas texture for the metallic floor with grid markings.
 */
export function Ground() {
  const gridTexture = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Dark metallic base
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, size, size);

    const cellSize = size / 50; // 50 units mapped to texture

    // Subtle grid lines
    ctx.strokeStyle = "rgba(6, 182, 212, 0.04)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 50; i++) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // Grid dots at each integer coordinate
    for (let x = 0; x <= 50; x++) {
      for (let y = 0; y <= 50; y++) {
        const px = x * cellSize;
        const py = y * cellSize;

        // Brighter dots at every 5th position
        const isMajor = x % 5 === 0 && y % 5 === 0;

        ctx.beginPath();
        ctx.arc(px, py, isMajor ? 2 : 1, 0, Math.PI * 2);
        ctx.fillStyle = isMajor
          ? "rgba(6, 182, 212, 0.15)"
          : "rgba(6, 182, 212, 0.06)";
        ctx.fill();
      }
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
        color="#0a0a0f"
        metalness={0.8}
        roughness={0.6}
      />
    </mesh>
  );
}
