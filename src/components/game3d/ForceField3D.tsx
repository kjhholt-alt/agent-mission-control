"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Shield dome over the entire base.
 * Half-sphere (top hemisphere only) with fresnel-like shader effect.
 * Very subtle -- barely visible cyan at low opacity.
 * Radius 14, centered on the base at [7, 0, 7].
 */
export function ForceField3D() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#06b6d4") },
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
      {/* radius=25, 32 width segments, 16 height segments,
          phiStart=0, phiLength=2PI, thetaStart=0, thetaLength=PI/2 (top half only) */}
      <sphereGeometry args={[25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vec3 viewDir = normalize(-vPosition);
            float fresnel = 1.0 - abs(dot(viewDir, vNormal));
            fresnel = pow(fresnel, 3.0);

            // Subtle pulse
            float pulse = sin(uTime * 0.5) * 0.3 + 0.7;

            float alpha = fresnel * 0.06 * pulse;
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  );
}
