"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Shield dome over the entire base.
 * Half-sphere with hexagonal grid pattern, upward-moving scan line,
 * fresnel edge glow, and subtle pulse. Ethereal but visible.
 */
export function ForceField3D() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#06b6d4") },
      uAccent: { value: new THREE.Color("#10b981") },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh position={[15, 0, 15]}>
      {/* radius=25, 48 width segments, 24 height segments, top hemisphere only */}
      <sphereGeometry args={[25, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

// ---------- GLSL ----------

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uAccent;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Hexagonal distance field
  // Returns distance to nearest hexagon edge in a tiling pattern
  float hexDist(vec2 p) {
    // Hex grid constants
    vec2 s = vec2(1.0, 1.732);
    vec2 h = s * 0.5;

    // Two offset grids
    vec2 a = mod(p, s) - h;
    vec2 b = mod(p - h, s) - h;

    // Pick closest center
    vec2 g = length(a) < length(b) ? a : b;

    // Distance to hex edge (6 sides)
    float d = max(abs(g.x), dot(abs(g), normalize(vec2(1.0, 1.732))));
    return d;
  }

  void main() {
    vec3 viewDir = normalize(-vPosition);

    // Fresnel — stronger than before, visible edge glow
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 2.5);

    // Hexagonal pattern — using world-space spherical coords for stable tiling
    // Map world position to spherical UV for hex grid
    vec3 localPos = vWorldPosition - vec3(15.0, 0.0, 15.0); // center offset
    float theta = atan(localPos.z, localPos.x); // longitude
    float phi = acos(clamp(localPos.y / 25.0, -1.0, 1.0)); // latitude

    // Scale hex grid
    vec2 hexUV = vec2(theta * 4.0, phi * 8.0);
    float hex = hexDist(hexUV);

    // Hex edge lines — thin bright edges
    float hexLine = 1.0 - smoothstep(0.42, 0.48, hex);
    hexLine *= 0.35;

    // Hex center dots — subtle bright centers
    float hexDot = 1.0 - smoothstep(0.0, 0.15, hex);
    hexDot *= 0.15;

    // Slow pulse
    float pulse = 0.65 + 0.35 * sin(uTime * 0.6);

    // Upward scan line — moves from bottom to top of dome
    float scanSpeed = 0.4;
    // normalizedHeight: 0 at base, 1 at top
    float normalizedHeight = clamp(localPos.y / 25.0, 0.0, 1.0);
    float scanPos = fract(uTime * scanSpeed);
    float scanDist = abs(normalizedHeight - scanPos);
    // Wrap-around for smooth looping
    scanDist = min(scanDist, 1.0 - scanDist);
    float scanLine = exp(-scanDist * 30.0) * 0.5;

    // Secondary slower scan — opposite direction
    float scanPos2 = fract(-uTime * scanSpeed * 0.6 + 0.5);
    float scanDist2 = abs(normalizedHeight - scanPos2);
    scanDist2 = min(scanDist2, 1.0 - scanDist2);
    float scanLine2 = exp(-scanDist2 * 50.0) * 0.2;

    // Compose alpha
    float baseAlpha = fresnel * 0.08 * pulse;
    float hexAlpha = (hexLine + hexDot) * pulse * 0.7;
    float scanAlpha = scanLine + scanLine2;
    float totalAlpha = baseAlpha + hexAlpha + scanAlpha;

    // Color: base cyan + emerald tint on scan lines
    vec3 finalColor = uColor;
    finalColor = mix(finalColor, uAccent, scanLine * 0.4);
    // Brighten hex edges slightly
    finalColor += vec3(0.1, 0.15, 0.2) * hexLine;

    // Clamp alpha — keep it ethereal
    totalAlpha = clamp(totalAlpha, 0.0, 0.18);

    gl_FragColor = vec4(finalColor, totalAlpha);
  }
`;
