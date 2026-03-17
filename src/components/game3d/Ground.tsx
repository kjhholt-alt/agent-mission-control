"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Factory floor ground plane — wet concrete with glowing cyan grid lines
 * that pulse subtly, metal plate tiles with rivets, yellow warning stripes,
 * oil stains, and a reflective sheen like fluorescent lights on damp concrete.
 */
export function Ground() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Static base texture: concrete tiles, warning stripes, scuffs, oil stains
  const baseTexture = useMemo(() => {
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

    // Very dark concrete base
    ctx.fillStyle = "#0c0d14";
    ctx.fillRect(0, 0, size, size);

    const tileSize = size / 40;

    // Draw concrete/metal plate tiles with stronger contrast
    for (let tx = 0; tx < 40; tx++) {
      for (let ty = 0; ty < 40; ty++) {
        const x = tx * tileSize;
        const y = ty * tileSize;
        const isLight = (tx + ty) % 2 === 0;

        // Tile fill — higher contrast between alternating tiles
        ctx.fillStyle = isLight ? "#141520" : "#0a0b12";
        ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // Tile groove — brighter border for visible separation
        ctx.strokeStyle = "rgba(45, 48, 65, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);

        // Inner highlight on light tiles — subtle bevel effect
        if (isLight) {
          // Top-left inner highlight
          ctx.strokeStyle = "rgba(55, 58, 75, 0.25)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x + 3, y + tileSize - 3);
          ctx.lineTo(x + 3, y + 3);
          ctx.lineTo(x + tileSize - 3, y + 3);
          ctx.stroke();

          // Bottom-right inner shadow
          ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
          ctx.beginPath();
          ctx.moveTo(x + tileSize - 3, y + 3);
          ctx.lineTo(x + tileSize - 3, y + tileSize - 3);
          ctx.lineTo(x + 3, y + tileSize - 3);
          ctx.stroke();

          // Inner plate detail
          const inset = tileSize * 0.15;
          ctx.strokeStyle = "rgba(50, 52, 70, 0.3)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + inset, y + inset, tileSize - inset * 2, tileSize - inset * 2);

          // Rivet dots in corners
          const rivetInset = inset + 3;
          ctx.fillStyle = "rgba(70, 72, 90, 0.5)";
          for (const [rx, ry] of [
            [x + rivetInset, y + rivetInset],
            [x + tileSize - rivetInset, y + rivetInset],
            [x + rivetInset, y + tileSize - rivetInset],
            [x + tileSize - rivetInset, y + tileSize - rivetInset],
          ]) {
            ctx.beginPath();
            ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Dark tiles get a subtle cross-hatch for diamond plate look
        if (!isLight) {
          ctx.strokeStyle = "rgba(30, 32, 45, 0.2)";
          ctx.lineWidth = 0.3;
          const step = tileSize / 6;
          for (let d = -tileSize; d < tileSize * 2; d += step) {
            ctx.beginPath();
            ctx.moveTo(x + d, y);
            ctx.lineTo(x + d + tileSize, y + tileSize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + tileSize - d, y);
            ctx.lineTo(x + tileSize - d - tileSize, y + tileSize);
            ctx.stroke();
          }
        }
      }
    }

    // Yellow warning stripes along edges — much more visible
    const stripeWidth = tileSize * 0.8;
    const stripePitch = 20;

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
      ctx.fillStyle = "#151208";
      ctx.fillRect(sx, sy, sw, sh);

      // Bright yellow diagonal stripes
      ctx.strokeStyle = "rgba(232, 160, 25, 0.5)";
      ctx.lineWidth = 9;
      const maxDim = Math.max(sw, sh) * 2;
      for (let i = -maxDim; i < maxDim; i += stripePitch) {
        ctx.beginPath();
        ctx.moveTo(sx + i, sy);
        ctx.lineTo(sx + i + maxDim, sy + maxDim);
        ctx.stroke();
      }

      // Black alternating stripes
      ctx.strokeStyle = "rgba(5, 5, 8, 0.65)";
      ctx.lineWidth = 9;
      for (let i = -maxDim + stripePitch / 2; i < maxDim; i += stripePitch) {
        ctx.beginPath();
        ctx.moveTo(sx + i, sy);
        ctx.lineTo(sx + i + maxDim, sy + maxDim);
        ctx.stroke();
      }

      // Edge border lines
      ctx.strokeStyle = "rgba(232, 160, 25, 0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);

      ctx.restore();
    };

    // Edge warning stripes
    drawWarningStripes(0, 0, size, stripeWidth); // top
    drawWarningStripes(0, size - stripeWidth, size, stripeWidth); // bottom
    drawWarningStripes(0, 0, stripeWidth, size); // left
    drawWarningStripes(size - stripeWidth, 0, stripeWidth, size); // right

    // Walkway center stripes
    const walkwayWidth = 14;
    const centerX = size / 2;
    const centerY = size / 2;
    drawWarningStripes(centerX - walkwayWidth / 2, stripeWidth, walkwayWidth, size - stripeWidth * 2);
    drawWarningStripes(stripeWidth, centerY - walkwayWidth / 2, size - stripeWidth * 2, walkwayWidth);

    // Scuff marks and wear
    for (let i = 0; i < 150; i++) {
      const sx = seededRandom() * size;
      const sy = seededRandom() * size;
      const sr = 3 + seededRandom() * 18;
      const alpha = 0.04 + seededRandom() * 0.08;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fill();
    }

    // Oil stains — brownish, slightly larger
    for (let i = 0; i < 40; i++) {
      const sx = seededRandom() * size;
      const sy = seededRandom() * size;
      const sr = 8 + seededRandom() * 25;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(25, 20, 10, ${0.06 + seededRandom() * 0.1})`;
      ctx.fill();
    }

    // Scratch lines
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 50; i++) {
      const sx = seededRandom() * size;
      const sy = seededRandom() * size;
      const len = 20 + seededRandom() * 80;
      const angle = seededRandom() * Math.PI * 2;
      ctx.strokeStyle = `rgba(60, 60, 75, ${0.06 + seededRandom() * 0.08})`;
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

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBaseMap: { value: baseTexture },
      uGridColor: { value: new THREE.Color("#06b6d4") },
      uFloorSize: { value: 80.0 },
      uTileCount: { value: 40.0 },
    }),
    [baseTexture]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, -0.01, 15]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={false}
      />
    </mesh>
  );
}

// ---------- GLSL ----------

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uBaseMap;
  uniform vec3 uGridColor;
  uniform float uFloorSize;
  uniform float uTileCount;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  // Smooth grid line function — returns intensity [0,1]
  float gridLine(float coord, float lineWidth) {
    float wrapped = fract(coord);
    float dist = min(wrapped, 1.0 - wrapped);
    return 1.0 - smoothstep(0.0, lineWidth, dist);
  }

  void main() {
    // Sample the base concrete texture
    vec4 base = texture2D(uBaseMap, vUv);

    // World-space coordinates scaled to tile count
    // The plane is 80x80 centered at (15,15), so world X maps to vUv * 80
    float tileX = vUv.x * uTileCount;
    float tileY = vUv.y * uTileCount;

    // Major grid every 2 tiles, minor grid every tile
    float majorLineWidth = 0.04;
    float minorLineWidth = 0.02;

    float majorX = gridLine(tileX / 2.0, majorLineWidth);
    float majorY = gridLine(tileY / 2.0, majorLineWidth);
    float major = max(majorX, majorY);

    float minorX = gridLine(tileX, minorLineWidth);
    float minorY = gridLine(tileY, minorLineWidth);
    float minor = max(minorX, minorY);

    // Pulse: slow breathe on major lines, faster subtle shimmer on minor
    float pulse = 0.7 + 0.3 * sin(uTime * 0.8);
    float shimmer = 0.85 + 0.15 * sin(uTime * 2.0 + tileX * 0.5 + tileY * 0.3);

    // Combine grid intensities
    float gridIntensity = major * 0.18 * pulse + minor * 0.06 * shimmer;

    // Grid intersection dots — brighter at major crossings
    float dotMajor = gridLine(tileX / 5.0, 0.06) * gridLine(tileY / 5.0, 0.06);
    float dotMinor = gridLine(tileX / 2.0, 0.04) * gridLine(tileY / 2.0, 0.04);
    gridIntensity += dotMajor * 0.35 * pulse + dotMinor * 0.12 * shimmer;

    // Distance-based fade — grid fades toward edges for depth
    vec2 center = vec2(0.5);
    float distFromCenter = length(vUv - center) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.6, 1.0, distFromCenter);
    gridIntensity *= edgeFade;

    // Wet concrete reflectivity — subtle specular-like highlight
    // Simulates overhead fluorescent reflection on damp surface
    float reflectX = smoothstep(0.3, 0.5, vUv.x) * smoothstep(0.7, 0.5, vUv.x);
    float reflectY = smoothstep(0.2, 0.45, vUv.y) * smoothstep(0.8, 0.55, vUv.y);
    float wetHighlight = reflectX * reflectY * 0.06;
    // Subtle moving caustic pattern
    float caustic = sin(tileX * 3.0 + uTime * 0.3) * sin(tileY * 3.0 - uTime * 0.2) * 0.5 + 0.5;
    wetHighlight *= (0.7 + caustic * 0.3);

    // Compose final color
    vec3 finalColor = base.rgb;

    // Add wet concrete sheen (warm white)
    finalColor += vec3(0.85, 0.9, 0.95) * wetHighlight;

    // Add cyan grid glow
    finalColor += uGridColor * gridIntensity;

    // Very slight overall cyan tint to tie it together
    finalColor += uGridColor * 0.008;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
