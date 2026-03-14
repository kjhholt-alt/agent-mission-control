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
 * Epic multi-level Command Center HQ with rotating radar dish,
 * antenna arrays, holographic display, landing pad, dramatic lighting.
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
  const radarRef = useRef<THREE.Group>(null);
  const holoRef = useRef<THREE.Mesh>(null);
  const holoMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip1Ref = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip2Ref = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip3Ref = useRef<THREE.MeshStandardMaterial>(null);

  const width = building.size * 1.5;
  const depth = building.size * 1.5;
  const baseHeight = building.size * 0.7;
  const midHeight = building.size * 0.5;
  const topHeight = building.size * 0.35;
  const totalHeight = baseHeight + midHeight + topHeight;
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

    if (coreLightRef.current) {
      coreLightRef.current.intensity = 2.0 + Math.sin(t * 2) * 0.8;
    }

    // Rotate radar dish
    if (radarRef.current) {
      radarRef.current.rotation.y += 0.012;
    }

    // Holographic display pulse
    if (holoMatRef.current) {
      holoMatRef.current.opacity = 0.15 + Math.sin(t * 2.5) * 0.08;
      holoMatRef.current.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.5;
    }
    if (holoRef.current) {
      holoRef.current.position.y = totalHeight / 2 + 2.2 + Math.sin(t * 1.2) * 0.08;
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
    [0, totalHeight / 2, 0],
    [-width * 0.3, totalHeight / 2, -depth * 0.25],
    [width * 0.3, totalHeight / 2, depth * 0.2],
  ];

  const antennaHeights = [1.8, 1.3, 1.0];

  return (
    <group position={[building.gridX, totalHeight / 2, building.gridY]}>
      {/* Level 1 — Base (widest) */}
      <mesh
        position={[0, -totalHeight / 2 + baseHeight / 2, 0]}
        onPointerOver={(e) => { e.stopPropagation(); onHover(building.id); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); onClick(building.id); }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, baseHeight, depth]} />
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

      {/* Level 2 — Mid section (slightly narrower) */}
      <mesh
        position={[0, -totalHeight / 2 + baseHeight + midHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[width * 0.75, midHeight, depth * 0.75]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          metalness={0.65}
          roughness={0.3}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            color={new THREE.Color("#f5c842")}
            transparent
            opacity={0.4}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* Level 3 — Top section (smallest) */}
      <mesh
        position={[0, -totalHeight / 2 + baseHeight + midHeight + topHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[width * 0.5, topHeight, depth * 0.5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.7}
          roughness={0.25}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            color={new THREE.Color("#f5c842")}
            transparent
            opacity={0.5}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* Window strips on all levels */}
      {/* Base level windows — front and back */}
      <mesh position={[0, -totalHeight / 2 + baseHeight * 0.5, depth / 2 + 0.01]}>
        <planeGeometry args={[width * 0.7, baseHeight * 0.25]} />
        <meshStandardMaterial
          color="#f5c842"
          emissive="#f5c842"
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh position={[0, -totalHeight / 2 + baseHeight * 0.5, -(depth / 2 + 0.01)]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width * 0.7, baseHeight * 0.25]} />
        <meshStandardMaterial
          color="#f5c842"
          emissive="#f5c842"
          emissiveIntensity={1.2}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Base level windows — sides */}
      <mesh position={[width / 2 + 0.01, -totalHeight / 2 + baseHeight * 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth * 0.7, baseHeight * 0.25]} />
        <meshStandardMaterial
          color="#f5c842"
          emissive="#f5c842"
          emissiveIntensity={1.0}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh position={[-(width / 2 + 0.01), -totalHeight / 2 + baseHeight * 0.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth * 0.7, baseHeight * 0.25]} />
        <meshStandardMaterial
          color="#f5c842"
          emissive="#f5c842"
          emissiveIntensity={1.0}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Mid level windows */}
      <mesh position={[0, -totalHeight / 2 + baseHeight + midHeight * 0.5, depth * 0.375 + 0.01]}>
        <planeGeometry args={[width * 0.5, midHeight * 0.3]} />
        <meshStandardMaterial
          color="#f5c842"
          emissive="#f5c842"
          emissiveIntensity={1.8}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Roof overhangs on each level */}
      <mesh position={[0, -totalHeight / 2 + baseHeight + 0.02, 0]}>
        <boxGeometry args={[width + 0.2, 0.04, depth + 0.2]} />
        <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, -totalHeight / 2 + baseHeight + midHeight + 0.02, 0]}>
        <boxGeometry args={[width * 0.78, 0.04, depth * 0.78]} />
        <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Base platform */}
      <mesh position={[0, -totalHeight / 2 + 0.02, 0]} receiveShadow>
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

      {/* Landing pad extending from right side */}
      <mesh position={[width / 2 + 1.2, -totalHeight / 2 + 0.04, 0]} receiveShadow>
        <boxGeometry args={[2.0, 0.05, 2.5]} />
        <meshStandardMaterial
          color="#1a1c28"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>
      {/* Landing pad markings — circle */}
      <mesh position={[width / 2 + 1.2, -totalHeight / 2 + 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.65, 16]} />
        <meshStandardMaterial
          color="#e8a019"
          emissive="#e8a019"
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Landing pad corner lights */}
      {[
        [width / 2 + 0.3, -totalHeight / 2 + 0.1, 1.1],
        [width / 2 + 0.3, -totalHeight / 2 + 0.1, -1.1],
        [width / 2 + 2.1, -totalHeight / 2 + 0.1, 1.1],
        [width / 2 + 2.1, -totalHeight / 2 + 0.1, -1.1],
      ].map((pos, i) => (
        <mesh key={`pad-light-${i}`} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={2}
          />
        </mesh>
      ))}

      {/* Radar dish on top — rotating */}
      <group
        ref={radarRef}
        position={[0, totalHeight / 2 + 0.3, 0]}
      >
        {/* Dish support post */}
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.06, 0.1, 0.3, 6]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Dish (torus = ring) */}
        <mesh rotation={[Math.PI / 6, 0, 0]}>
          <torusGeometry args={[0.35, 0.04, 8, 16]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* Dish center receiver */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 6]} />
          <meshStandardMaterial
            color="#f5c842"
            emissive="#f5c842"
            emissiveIntensity={1.5}
          />
        </mesh>
        {/* Dish arm */}
        <mesh rotation={[0, 0, Math.PI / 6]} position={[0.15, 0.05, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.02]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Holographic display floating above */}
      <mesh
        ref={holoRef}
        position={[0, totalHeight / 2 + 2.2, 0]}
        rotation={[-Math.PI / 6, 0, 0]}
      >
        <planeGeometry args={[1.8, 1.2]} />
        <meshStandardMaterial
          ref={holoMatRef}
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={1.0}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Holo display border */}
      <mesh
        position={[0, totalHeight / 2 + 2.2, 0]}
        rotation={[-Math.PI / 6, 0, 0]}
      >
        <ringGeometry args={[0.85, 0.92, 4]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={1.5}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner energy core light (gold) */}
      <pointLight
        ref={coreLightRef}
        position={[0, 0, 0]}
        color="#e8a019"
        intensity={2}
        distance={8}
        decay={2}
      />

      {/* Additional colored point lights for dramatic effect */}
      <pointLight
        position={[width / 2, -totalHeight / 4, depth / 2]}
        color="#f5c842"
        intensity={0.6}
        distance={4}
        decay={2}
      />
      <pointLight
        position={[-width / 2, totalHeight / 4, -depth / 2]}
        color="#06b6d4"
        intensity={0.4}
        distance={4}
        decay={2}
      />
      <pointLight
        position={[0, totalHeight / 2 + 1, 0]}
        color="#e8a019"
        intensity={0.5}
        distance={5}
        decay={2}
      />

      {/* Core glow sphere */}
      <mesh position={[0, -totalHeight / 2 + baseHeight * 0.6, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
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
        position={[0, totalHeight / 2 + 3.5, 0]}
        center
        transform={false}
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
              fontSize: 8,
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
