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
 * Industrial factory building with roof overhang, window strips,
 * chimney/exhaust on larger buildings, front door, and warning stripe base.
 * Factorio-style aesthetic.
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
  const windowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const smokeParticlesRef = useRef<THREE.Group>(null);

  const width = building.size * 1.5;
  const depth = building.size * 1.5;
  const height = building.size * 1.0;

  const isActive = building.status === "active";
  const isLarge = building.size >= 2;

  const color = useMemo(() => new THREE.Color(building.color), [building.color]);
  const edgeColor = useMemo(() => new THREE.Color(building.color), [building.color]);

  // Warning stripe texture for base platform
  const warningTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#1a1a10";
    ctx.fillRect(0, 0, 128, 128);

    // Diagonal yellow/black stripes
    ctx.strokeStyle = "rgba(234, 179, 8, 0.45)";
    ctx.lineWidth = 10;
    for (let i = -128; i < 256; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(10, 10, 15, 0.6)";
    ctx.lineWidth = 10;
    for (let i = -128 + 10; i < 256; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, []);

  // Pulsing emissive glow
  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    const t = clock.getElapsedTime();
    const isWarning = building.status === "warning";

    let emissiveIntensity: number;
    if (isActive) {
      emissiveIntensity = 0.25 + Math.sin(t * 2 + building.gridX) * 0.1;
    } else if (isWarning) {
      emissiveIntensity = 0.2 + Math.sin(t * 4) * 0.15;
    } else {
      emissiveIntensity = 0.1;
    }

    if (isHovered || isSelected) {
      emissiveIntensity += 0.2;
    }

    materialRef.current.emissiveIntensity = emissiveIntensity;

    if (edgeMaterialRef.current) {
      const edgeOpacity = isHovered || isSelected
        ? 0.9
        : isActive
          ? 0.4 + Math.sin(t * 2 + building.gridX) * 0.15
          : 0.2;
      edgeMaterialRef.current.opacity = edgeOpacity;
    }

    // Window glow pulsing
    if (windowMatRef.current) {
      const windowGlow = isActive
        ? 1.5 + Math.sin(t * 1.5 + building.gridX * 0.3) * 0.5
        : 0.3;
      windowMatRef.current.emissiveIntensity = windowGlow;
    }

    // Smoke particles animation
    if (smokeParticlesRef.current && isLarge) {
      smokeParticlesRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const speed = isActive ? 0.6 : 0.2;
        const yOffset = ((t * speed + i * 0.4) % 2.0);
        mesh.position.y = yOffset;
        const scale = 0.03 + yOffset * 0.04;
        mesh.scale.set(scale, scale, scale);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.opacity = Math.max(0, 0.3 - yOffset * 0.15);
        }
      });
    }
  });

  const statusColor = building.status === "active"
    ? "#22c55e"
    : building.status === "warning"
      ? "#f59e0b"
      : "#6b7280";

  // Window strip positions — two on each long side
  const windowY = height * 0.15;
  const windowHeight = height * 0.2;
  const windowWidth = width * 0.6;
  const windowDepthSize = depth * 0.6;

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
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            ref={edgeMaterialRef}
            color={edgeColor}
            transparent
            opacity={0.4}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* Roof overhang — slightly wider thin slab on top */}
      <mesh position={[0, height / 2 + 0.04, 0]} castShadow>
        <boxGeometry args={[width + 0.25, 0.08, depth + 0.25]} />
        <meshStandardMaterial
          color="#2a2c38"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Roof ridge line */}
      <mesh position={[0, height / 2 + 0.12, 0]}>
        <boxGeometry args={[width * 0.1, 0.08, depth + 0.15]} />
        <meshStandardMaterial
          color="#3a3c48"
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>

      {/* Window strips — front and back */}
      <mesh position={[0, windowY, depth / 2 + 0.01]}>
        <planeGeometry args={[windowWidth, windowHeight]} />
        <meshStandardMaterial
          ref={windowMatRef}
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.5 : 0.3}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh position={[0, windowY, -(depth / 2 + 0.01)]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[windowWidth, windowHeight]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.2 : 0.2}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Window strips — left and right sides */}
      <mesh position={[width / 2 + 0.01, windowY, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[windowDepthSize, windowHeight]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.0 : 0.2}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh position={[-(width / 2 + 0.01), windowY, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[windowDepthSize, windowHeight]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.0 : 0.2}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Front door — darker rectangle on front face */}
      <mesh position={[0, -height * 0.2, depth / 2 + 0.015]}>
        <planeGeometry args={[width * 0.25, height * 0.5]} />
        <meshStandardMaterial
          color="#0a0a0f"
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>
      {/* Door frame */}
      <mesh position={[0, -height * 0.2, depth / 2 + 0.018]}>
        <planeGeometry args={[width * 0.28, height * 0.53]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Chimney/exhaust vent on larger buildings */}
      {isLarge && (
        <group position={[width * 0.3, height / 2 + 0.08, -depth * 0.25]}>
          {/* Chimney cylinder */}
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.12, 0.15, 0.8, 8]} />
            <meshStandardMaterial
              color="#3a3c48"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
          {/* Chimney top cap */}
          <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.18, 0.12, 0.06, 8]} />
            <meshStandardMaterial
              color="#4a4c58"
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>

          {/* Smoke particles */}
          <group ref={smokeParticlesRef} position={[0, 0.9, 0]}>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[
                Math.sin(i * 1.3) * 0.05,
                i * 0.4,
                Math.cos(i * 1.3) * 0.05,
              ]}>
                <sphereGeometry args={[0.05, 6, 6]} />
                <meshStandardMaterial
                  color="#888899"
                  emissive="#555566"
                  emissiveIntensity={0.3}
                  transparent
                  opacity={0.25}
                />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* Base platform with warning stripes */}
      <mesh position={[0, -height / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[width + 0.3, 0.04, depth + 0.3]} />
        <meshStandardMaterial
          map={warningTexture}
          color="#e8a019"
          emissive="#e8a019"
          emissiveIntensity={0.1}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.7}
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

      {/* Interior glow light visible through windows */}
      {isActive && (
        <pointLight
          position={[0, 0, 0]}
          color={building.color}
          intensity={0.8}
          distance={4}
          decay={2}
        />
      )}

      {/* Floating label */}
      <Html
        position={[0, height / 2 + 0.6, 0]}
        center
        transform={false}
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
              fontSize: 8,
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
