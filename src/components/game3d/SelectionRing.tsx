"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SelectionRingProps {
  position: [number, number, number];
  color: string;
}

/**
 * Glowing selection ring lying flat on the ground.
 * Slowly rotates and pulses opacity. Used under selected buildings/workers.
 */
export function SelectionRing({ position, color }: SelectionRingProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;
    const t = clock.getElapsedTime();

    // Slow rotation
    meshRef.current.rotation.z = t * 0.5;

    // Opacity pulsing
    materialRef.current.opacity = 0.5 + Math.sin(t * 3) * 0.2;
    materialRef.current.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.4;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.5, 0.6, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={color}
        emissiveIntensity={1.0}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
