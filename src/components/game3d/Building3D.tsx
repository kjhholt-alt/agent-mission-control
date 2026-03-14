"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Building } from "./types";

interface Building3DProps {
  building: Building;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

/**
 * A single building rendered as a BoxGeometry with glowing edges,
 * emissive pulsing, and a floating label. Industrial sci-fi aesthetic.
 */
export function Building3D({
  building,
  isHovered,
  isSelected,
  onHover,
  onClick,
}: Building3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeMaterialRef = useRef<THREE.LineBasicMaterial>(null);

  const width = building.size * 1.5;
  const depth = building.size * 1.5;
  const height = building.size * 1.0;

  const color = useMemo(() => new THREE.Color(building.color), [building.color]);
  const edgeColor = useMemo(() => new THREE.Color(building.color), [building.color]);

  // Pulsing emissive glow
  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    const t = clock.getElapsedTime();
    const isActive = building.status === "active";
    const isWarning = building.status === "warning";

    let emissiveIntensity: number;
    if (isActive) {
      // Pulse between 0.15 and 0.35
      emissiveIntensity = 0.25 + Math.sin(t * 2 + building.gridX) * 0.1;
    } else if (isWarning) {
      // Faster warning pulse
      emissiveIntensity = 0.2 + Math.sin(t * 4) * 0.15;
    } else {
      emissiveIntensity = 0.1;
    }

    // Brighten on hover/select
    if (isHovered || isSelected) {
      emissiveIntensity += 0.2;
    }

    materialRef.current.emissiveIntensity = emissiveIntensity;

    // Edge glow intensity
    if (edgeMaterialRef.current) {
      const edgeOpacity = isHovered || isSelected
        ? 0.9
        : isActive
          ? 0.4 + Math.sin(t * 2 + building.gridX) * 0.15
          : 0.2;
      edgeMaterialRef.current.opacity = edgeOpacity;
    }
  });

  // Status indicator color
  const statusColor = building.status === "active"
    ? "#22c55e"
    : building.status === "warning"
      ? "#f59e0b"
      : "#6b7280";

  return (
    <group position={[building.gridX, height / 2, building.gridY]}>
      {/* Main building box */}
      <mesh
        ref={meshRef}
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
          emissiveIntensity={0.1}
          metalness={0.5}
          roughness={0.4}
          transparent={false}
        />
        <Edges
          threshold={15}
          scale={1.001}
        >
          <lineBasicMaterial
            ref={edgeMaterialRef}
            color={edgeColor}
            transparent
            opacity={0.4}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* Base platform (slightly wider, thin slab under building) */}
      <mesh position={[0, -height / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[width + 0.3, 0.04, depth + 0.3]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={0.15}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Status LED indicator */}
      <mesh position={[width / 2 - 0.15, height / 2 - 0.15, depth / 2 + 0.01]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Floating label */}
      <Html
        position={[0, height / 2 + 0.6, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(5, 5, 8, 0.85)",
            border: `1px solid ${building.color}66`,
            borderRadius: 2,
            padding: "2px 6px",
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace",
            userSelect: "none",
          }}
        >
          <span
            style={{
              color: building.color,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textShadow: `0 0 8px ${building.glowColor}`,
            }}
          >
            {building.shortName}
          </span>
        </div>
      </Html>
    </group>
  );
}
