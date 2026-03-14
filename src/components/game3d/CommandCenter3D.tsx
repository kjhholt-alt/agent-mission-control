"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Building } from "./types";

interface CommandCenter3DProps {
  building: Building;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

/**
 * Special Command Center building -- 1.4x taller, inner energy core,
 * three antenna spires with emissive tips, extra edge glow.
 */
export function CommandCenter3D({
  building,
  isHovered,
  isSelected,
  onHover,
  onClick,
}: CommandCenter3DProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);
  const antennaTip1Ref = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip2Ref = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip3Ref = useRef<THREE.MeshStandardMaterial>(null);

  const width = building.size * 1.5;
  const depth = building.size * 1.5;
  const height = building.size * 1.4; // 1.4x taller
  const color = new THREE.Color(building.color);

  // Pulsing animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (materialRef.current) {
      const pulse = 0.3 + Math.sin(t * 1.5) * 0.12;
      materialRef.current.emissiveIntensity =
        isHovered || isSelected ? pulse + 0.25 : pulse;
    }

    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.opacity =
        isHovered || isSelected
          ? 0.95
          : 0.5 + Math.sin(t * 1.5) * 0.2;
    }

    // Core light pulsing
    if (coreLightRef.current) {
      coreLightRef.current.intensity = 1.5 + Math.sin(t * 2) * 0.5;
    }

    // Antenna tips pulse independently
    const tips = [antennaTip1Ref, antennaTip2Ref, antennaTip3Ref];
    tips.forEach((tip, i) => {
      if (tip.current) {
        tip.current.emissiveIntensity =
          1.5 + Math.sin(t * 3 + i * 2.1) * 1.0;
      }
    });
  });

  const antennaPositions: [number, number, number][] = [
    [0, height / 2, 0],
    [-width * 0.3, height / 2, -depth * 0.25],
    [width * 0.3, height / 2, depth * 0.2],
  ];

  const antennaHeights = [1.8, 1.3, 1.0];

  return (
    <group position={[building.gridX, height / 2, building.gridY]}>
      {/* Main building body */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); onHover(building.id); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); onClick(building.id); }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          metalness={0.6}
          roughness={0.35}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            ref={edgeMaterialRef}
            color={new THREE.Color("#f5c842")}
            transparent
            opacity={0.5}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* Base platform */}
      <mesh position={[0, -height / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[width + 0.5, 0.06, depth + 0.5]} />
        <meshStandardMaterial
          color="#e8a019"
          emissive="#e8a019"
          emissiveIntensity={0.2}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Inner energy core light (gold) */}
      <pointLight
        ref={coreLightRef}
        position={[0, 0, 0]}
        color="#e8a019"
        intensity={2}
        distance={6}
        decay={2}
      />

      {/* Core glow sphere (visible inside) */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          color="#f5c842"
          emissive="#f5c842"
          emissiveIntensity={2}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Antenna spires */}
      {antennaPositions.map((pos, i) => {
        const h = antennaHeights[i];
        const tipRefs = [antennaTip1Ref, antennaTip2Ref, antennaTip3Ref];
        return (
          <group key={i} position={pos}>
            {/* Antenna shaft */}
            <mesh position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.04, 0.08, h, 6]} />
              <meshStandardMaterial
                color="#94a3b8"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            {/* Emissive tip */}
            <mesh position={[0, h, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial
                ref={tipRefs[i]}
                color="#f5c842"
                emissive="#f5c842"
                emissiveIntensity={1.5}
              />
            </mesh>
            {/* Tip point light */}
            <pointLight
              position={[0, h + 0.1, 0]}
              color="#f5c842"
              intensity={0.5}
              distance={3}
              decay={2}
            />
          </group>
        );
      })}

      {/* Floating label */}
      <Html
        position={[0, height / 2 + 2.5, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(5, 5, 8, 0.9)",
            border: "1px solid rgba(232, 160, 25, 0.5)",
            borderRadius: 2,
            padding: "3px 8px",
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace",
            userSelect: "none",
            boxShadow: "0 0 12px rgba(232, 160, 25, 0.3)",
          }}
        >
          <span
            style={{
              color: "#e8a019",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              textShadow: "0 0 10px rgba(232, 160, 25, 0.6)",
            }}
          >
            CMD
          </span>
        </div>
      </Html>
    </group>
  );
}
