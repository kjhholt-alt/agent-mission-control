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
 * Epic multi-tiered Command Center HQ — the centerpiece of the factory.
 * Features: 4-tier architecture, proper radar dish, holographic data display,
 * antenna variety, animated landing pad, upward beacon pillar, dramatic lighting.
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
  const holoRef = useRef<THREE.Group>(null);
  const holoMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const holoGridRef = useRef<THREE.Group>(null);
  const antennaTip1Ref = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip2Ref = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip3Ref = useRef<THREE.MeshStandardMaterial>(null);
  const antennaTip4Ref = useRef<THREE.MeshStandardMaterial>(null);
  const beaconRef = useRef<THREE.Group>(null);
  const beaconMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const padLightsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const energyRingRef = useRef<THREE.Mesh>(null);
  const energyRingMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const width = building.size * 1.5;
  const depth = building.size * 1.5;

  // 4-tier height distribution
  const tier1H = building.size * 0.55; // Base - widest
  const tier2H = building.size * 0.4; // Mid
  const tier3H = building.size * 0.28; // Upper
  const tier4H = building.size * 0.2; // Command deck
  const totalHeight = tier1H + tier2H + tier3H + tier4H;

  const color = new THREE.Color(building.color);
  const goldColor = "#f5c842";
  const cyanColor = "#06b6d4";

  // Animation loop
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Main material pulse
    if (materialRef.current) {
      const pulse = 0.35 + Math.sin(t * 1.5) * 0.12;
      materialRef.current.emissiveIntensity =
        isHovered || isSelected ? pulse + 0.25 : pulse;
    }

    // Edge glow
    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.opacity =
        isHovered || isSelected
          ? 0.95
          : 0.5 + Math.sin(t * 1.5) * 0.2;
    }

    // Core light pulse
    if (coreLightRef.current) {
      coreLightRef.current.intensity = 2.5 + Math.sin(t * 2) * 1.0;
    }

    // Radar dish rotation
    if (radarRef.current) {
      radarRef.current.rotation.y += 0.015;
    }

    // Holographic display
    if (holoMatRef.current) {
      holoMatRef.current.opacity = 0.18 + Math.sin(t * 2.5) * 0.08;
      holoMatRef.current.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.6;
    }
    if (holoRef.current) {
      holoRef.current.position.y =
        totalHeight / 2 + 2.2 + Math.sin(t * 1.2) * 0.08;
    }
    // Holo grid data scroll
    if (holoGridRef.current) {
      holoGridRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          const flicker = Math.sin(t * 4 + i * 2.5) * 0.5 + 0.5;
          mat.opacity = 0.15 + flicker * 0.35;
        }
      });
    }

    // Antenna tips pulse independently
    const tips = [antennaTip1Ref, antennaTip2Ref, antennaTip3Ref, antennaTip4Ref];
    tips.forEach((tip, i) => {
      if (tip.current) {
        tip.current.emissiveIntensity =
          1.5 + Math.sin(t * 3 + i * 2.1) * 1.0;
      }
    });

    // Beacon pillar of light
    if (beaconRef.current && beaconMatRef.current) {
      beaconMatRef.current.opacity = 0.08 + Math.sin(t * 1.5) * 0.04;
      beaconMatRef.current.emissiveIntensity = 1.5 + Math.sin(t * 2) * 0.5;
      beaconRef.current.rotation.y = t * 0.3;
    }

    // Landing pad lights chase animation
    padLightsRef.current.forEach((mat, i) => {
      if (!mat) return;
      const phase = (t * 2 + i * 0.6) % (Math.PI * 2);
      mat.emissiveIntensity = 1.0 + Math.sin(phase) * 1.5;
    });

    // Energy ring at base
    if (energyRingRef.current && energyRingMatRef.current) {
      energyRingRef.current.rotation.z = t * 0.5;
      energyRingMatRef.current.opacity =
        0.15 + Math.sin(t * 2.5) * 0.08;
    }
  });

  // Antenna definitions — more variety
  const antennaConfigs: {
    pos: [number, number, number];
    h: number;
    tipRef: React.RefObject<THREE.MeshStandardMaterial | null>;
    tipColor: string;
    hasCross: boolean;
  }[] = [
    {
      pos: [0, totalHeight / 2, 0],
      h: 2.0,
      tipRef: antennaTip1Ref,
      tipColor: goldColor,
      hasCross: true,
    },
    {
      pos: [-width * 0.32, totalHeight / 2, -depth * 0.28],
      h: 1.4,
      tipRef: antennaTip2Ref,
      tipColor: "#ef4444",
      hasCross: false,
    },
    {
      pos: [width * 0.32, totalHeight / 2, depth * 0.22],
      h: 1.1,
      tipRef: antennaTip3Ref,
      tipColor: cyanColor,
      hasCross: true,
    },
    {
      pos: [width * 0.15, totalHeight / 2, -depth * 0.32],
      h: 0.8,
      tipRef: antennaTip4Ref,
      tipColor: "#10b981",
      hasCross: false,
    },
  ];

  // Landing pad light positions (8 around perimeter for chase effect)
  const padCenterX = width / 2 + 1.5;
  const padLightPositions: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    padLightPositions.push([
      padCenterX + Math.cos(angle) * 1.0,
      -totalHeight / 2 + 0.1,
      Math.sin(angle) * 1.0,
    ]);
  }

  return (
    <group position={[building.gridX, totalHeight / 2, building.gridY]}>
      {/* ===== TIER 1 - Base (widest) ===== */}
      <mesh
        position={[0, -totalHeight / 2 + tier1H / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(building.id);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClick(building.id);
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, tier1H, depth]} />
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          metalness={0.6}
          roughness={0.3}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            ref={edgeMaterialRef}
            color={new THREE.Color(goldColor)}
            transparent
            opacity={0.5}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* Tier 1 - Panel detail ribs */}
      {[-0.3, -0.1, 0.1, 0.3].map((xOff, i) => (
        <mesh
          key={`t1-rib-${i}`}
          position={[
            xOff * width,
            -totalHeight / 2 + tier1H / 2,
            depth / 2 + 0.008,
          ]}
        >
          <boxGeometry args={[0.03, tier1H * 0.85, 0.005]} />
          <meshStandardMaterial
            color="#1a1c28"
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* ===== TIER 2 - Mid section ===== */}
      <mesh
        position={[
          0,
          -totalHeight / 2 + tier1H + tier2H / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[width * 0.78, tier2H, depth * 0.78]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.38}
          metalness={0.65}
          roughness={0.28}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            color={new THREE.Color(goldColor)}
            transparent
            opacity={0.4}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* ===== TIER 3 - Upper section ===== */}
      <mesh
        position={[
          0,
          -totalHeight / 2 + tier1H + tier2H + tier3H / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[width * 0.55, tier3H, depth * 0.55]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.42}
          metalness={0.7}
          roughness={0.25}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            color={new THREE.Color(goldColor)}
            transparent
            opacity={0.45}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* ===== TIER 4 - Command Deck (top) ===== */}
      <mesh
        position={[
          0,
          -totalHeight / 2 + tier1H + tier2H + tier3H + tier4H / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[width * 0.38, tier4H, depth * 0.38]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.75}
          roughness={0.2}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            color={new THREE.Color(goldColor)}
            transparent
            opacity={0.55}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* ===== WINDOW STRIPS - All tiers ===== */}
      {/* Tier 1 windows (all 4 sides) */}
      {[
        { pos: [0, -totalHeight / 2 + tier1H * 0.5, depth / 2 + 0.012] as [number, number, number], rot: [0, 0, 0] as [number, number, number], w: width * 0.7, h: tier1H * 0.28 },
        { pos: [0, -totalHeight / 2 + tier1H * 0.5, -(depth / 2 + 0.012)] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number], w: width * 0.7, h: tier1H * 0.28 },
        { pos: [width / 2 + 0.012, -totalHeight / 2 + tier1H * 0.5, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], w: depth * 0.7, h: tier1H * 0.28 },
        { pos: [-(width / 2 + 0.012), -totalHeight / 2 + tier1H * 0.5, 0] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number], w: depth * 0.7, h: tier1H * 0.28 },
      ].map((win, i) => (
        <mesh key={`t1w-${i}`} position={win.pos} rotation={win.rot}>
          <planeGeometry args={[win.w, win.h]} />
          <meshStandardMaterial
            color={goldColor}
            emissive={goldColor}
            emissiveIntensity={1.5 - i * 0.15}
            transparent
            opacity={0.8 - i * 0.05}
          />
        </mesh>
      ))}

      {/* Tier 2 windows (front + back) */}
      {[1, -1].map((side, i) => (
        <mesh
          key={`t2w-${i}`}
          position={[
            0,
            -totalHeight / 2 + tier1H + tier2H * 0.5,
            side * (depth * 0.39 + 0.012),
          ]}
          rotation={side < 0 ? [0, Math.PI, 0] : [0, 0, 0]}
        >
          <planeGeometry args={[width * 0.52, tier2H * 0.35]} />
          <meshStandardMaterial
            color={goldColor}
            emissive={goldColor}
            emissiveIntensity={1.8}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* Tier 3 wraparound window band */}
      <mesh
        position={[
          0,
          -totalHeight / 2 + tier1H + tier2H + tier3H * 0.5,
          depth * 0.275 + 0.012,
        ]}
      >
        <planeGeometry args={[width * 0.45, tier3H * 0.45]} />
        <meshStandardMaterial
          color={cyanColor}
          emissive={cyanColor}
          emissiveIntensity={2.0}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Tier 4 command deck panoramic window */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, i) => {
        const face =
          i % 2 === 0
            ? [0, 0, (i === 0 ? 1 : -1) * (depth * 0.19 + 0.012)] as [number, number, number]
            : [(i === 1 ? 1 : -1) * (width * 0.19 + 0.012), 0, 0] as [number, number, number];
        return (
          <mesh
            key={`t4w-${i}`}
            position={[
              face[0],
              -totalHeight / 2 + tier1H + tier2H + tier3H + tier4H * 0.5,
              face[2],
            ]}
            rotation={[0, rot, 0]}
          >
            <planeGeometry args={[width * 0.3, tier4H * 0.6]} />
            <meshStandardMaterial
              color={goldColor}
              emissive={goldColor}
              emissiveIntensity={2.5}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}

      {/* ===== TIER OVERHANGS / LEDGES ===== */}
      {[
        { y: -totalHeight / 2 + tier1H + 0.02, w: width + 0.22, d: depth + 0.22 },
        { y: -totalHeight / 2 + tier1H + tier2H + 0.02, w: width * 0.82, d: depth * 0.82 },
        { y: -totalHeight / 2 + tier1H + tier2H + tier3H + 0.02, w: width * 0.6, d: depth * 0.6 },
        { y: -totalHeight / 2 + tier1H + tier2H + tier3H + tier4H + 0.02, w: width * 0.42, d: depth * 0.42 },
      ].map((ledge, i) => (
        <mesh key={`ledge-${i}`} position={[0, ledge.y, 0]}>
          <boxGeometry args={[ledge.w, 0.04, ledge.d]} />
          <meshStandardMaterial
            color="#2a2c38"
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* ===== BASE PLATFORM ===== */}
      <mesh position={[0, -totalHeight / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[width + 0.6, 0.08, depth + 0.6]} />
        <meshStandardMaterial
          color="#e8a019"
          emissive="#e8a019"
          emissiveIntensity={0.25}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Energy ring at base */}
      <mesh
        ref={energyRingRef}
        position={[0, -totalHeight / 2 + 0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[width * 0.7, width * 0.82, 48]} />
        <meshStandardMaterial
          ref={energyRingMatRef}
          color={goldColor}
          emissive={goldColor}
          emissiveIntensity={1.5}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ===== LANDING PAD ===== */}
      <group position={[width / 2 + 1.5, -totalHeight / 2, 0]}>
        {/* Pad surface */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[2.5, 0.06, 2.8]} />
          <meshStandardMaterial
            color="#12141e"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        {/* Pad markings - H symbol */}
        <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.7, 20]} />
          <meshStandardMaterial
            color="#e8a019"
            emissive="#e8a019"
            emissiveIntensity={0.8}
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* H crossbar */}
        <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.12]} />
          <meshStandardMaterial
            color="#e8a019"
            emissive="#e8a019"
            emissiveIntensity={0.8}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* H verticals */}
        {[-0.2, 0.2].map((xOff, i) => (
          <mesh
            key={`h-${i}`}
            position={[xOff, 0.078, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.1, 0.5]} />
            <meshStandardMaterial
              color="#e8a019"
              emissive="#e8a019"
              emissiveIntensity={0.6}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        {/* Animated perimeter lights */}
        {padLightPositions.map((pos, i) => (
          <mesh
            key={`pl-${i}`}
            position={[
              pos[0] - padCenterX,
              0.1,
              pos[2],
            ]}
          >
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial
              ref={(el) => {
                padLightsRef.current[i] = el;
              }}
              color="#f59e0b"
              emissive="#f59e0b"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        ))}
        {/* Corner posts */}
        {[
          [-1.1, 0.15, -1.25],
          [-1.1, 0.15, 1.25],
          [1.1, 0.15, -1.25],
          [1.1, 0.15, 1.25],
        ].map((pos, i) => (
          <mesh key={`post-${i}`} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.035, 0.035, 0.22, 6]} />
            <meshStandardMaterial
              color="#4a4c58"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* ===== RADAR DISH (proper dish shape) ===== */}
      <group ref={radarRef} position={[0, totalHeight / 2 + 0.35, 0]}>
        {/* Support post */}
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.06, 0.12, 0.35, 6]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.85}
            roughness={0.15}
          />
        </mesh>
        {/* Dish body (concave shape via sphere segment) */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 5, 0, 0]}>
          <sphereGeometry args={[0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI / 3]} />
          <meshStandardMaterial
            color="#c0c8d8"
            metalness={0.85}
            roughness={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Dish rim ring */}
        <mesh position={[0, 0.08, 0.08]} rotation={[Math.PI / 5, 0, 0]}>
          <torusGeometry args={[0.39, 0.025, 8, 20]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
        {/* Feed horn (center receiver on arm) */}
        <mesh position={[0, 0.2, -0.08]}>
          <cylinderGeometry args={[0.025, 0.015, 0.25, 6]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        {/* Feed tip */}
        <mesh position={[0, 0.33, -0.08]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial
            color={goldColor}
            emissive={goldColor}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
        {/* Support struts (3 arms) */}
        {[0, 2.1, 4.2].map((angle, i) => (
          <mesh
            key={`strut-${i}`}
            position={[
              Math.cos(angle) * 0.15,
              0.12,
              Math.sin(angle) * 0.15 - 0.02,
            ]}
            rotation={[0.3, angle, Math.PI / 4]}
          >
            <boxGeometry args={[0.25, 0.015, 0.015]} />
            <meshStandardMaterial
              color="#94a3b8"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* ===== HOLOGRAPHIC DISPLAY ===== */}
      <group
        ref={holoRef}
        position={[0, totalHeight / 2 + 2.2, 0]}
      >
        {/* Main holo surface */}
        <mesh rotation={[-Math.PI / 6, 0, 0]}>
          <planeGeometry args={[2.0, 1.4]} />
          <meshStandardMaterial
            ref={holoMatRef}
            color={cyanColor}
            emissive={cyanColor}
            emissiveIntensity={1.2}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Holo border frame (rectangular) */}
        <mesh rotation={[-Math.PI / 6, 0, 0]}>
          <ringGeometry args={[0.95, 1.02, 4]} />
          <meshStandardMaterial
            color={cyanColor}
            emissive={cyanColor}
            emissiveIntensity={1.8}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Data grid lines (visible "data") */}
        <group ref={holoGridRef} rotation={[-Math.PI / 6, 0, 0]}>
          {/* Horizontal scan lines */}
          {[-0.4, -0.2, 0, 0.2, 0.4].map((yOff, i) => (
            <mesh key={`hg-h-${i}`} position={[0, yOff, 0.005]}>
              <planeGeometry args={[1.7 * (1 - Math.abs(yOff) * 0.3), 0.012]} />
              <meshStandardMaterial
                color={cyanColor}
                emissive={cyanColor}
                emissiveIntensity={2}
                transparent
                opacity={0.3}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          {/* Vertical data columns */}
          {[-0.5, -0.15, 0.2, 0.55].map((xOff, i) => (
            <mesh key={`hg-v-${i}`} position={[xOff, 0, 0.005]}>
              <planeGeometry args={[0.012, 1.0]} />
              <meshStandardMaterial
                color={cyanColor}
                emissive={cyanColor}
                emissiveIntensity={2}
                transparent
                opacity={0.25}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          {/* Data blocks (simulated chart bars) */}
          {[-0.35, -0.05, 0.25, 0.5].map((xOff, i) => (
            <mesh
              key={`hg-b-${i}`}
              position={[xOff, -0.1 + i * 0.05, 0.008]}
            >
              <planeGeometry args={[0.12, 0.08 + i * 0.06]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? cyanColor : goldColor}
                emissive={i % 2 === 0 ? cyanColor : goldColor}
                emissiveIntensity={2.5}
                transparent
                opacity={0.3}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* ===== BEACON / PILLAR OF LIGHT ===== */}
      <group
        ref={beaconRef}
        position={[0, totalHeight / 2 + 0.5, 0]}
      >
        {/* Vertical light beam */}
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.08, 0.2, 5.0, 8, 1, true]} />
          <meshStandardMaterial
            ref={beaconMatRef}
            color={goldColor}
            emissive={goldColor}
            emissiveIntensity={1.5}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Beacon source glow */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial
            color={goldColor}
            emissive={goldColor}
            emissiveIntensity={3}
            transparent
            opacity={0.6}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ===== ANTENNA SPIRES (varied) ===== */}
      {antennaConfigs.map((ant, i) => (
        <group key={`ant-${i}`} position={ant.pos}>
          {/* Shaft */}
          <mesh position={[0, ant.h / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.06, ant.h, 6]} />
            <meshStandardMaterial
              color="#94a3b8"
              metalness={0.85}
              roughness={0.15}
            />
          </mesh>
          {/* Emissive tip */}
          <mesh position={[0, ant.h, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              ref={ant.tipRef}
              color={ant.tipColor}
              emissive={ant.tipColor}
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
          {/* Tip point light */}
          <pointLight
            position={[0, ant.h + 0.1, 0]}
            color={ant.tipColor}
            intensity={0.4}
            distance={3}
            decay={2}
          />
          {/* Cross-arm (on selected antennae) */}
          {ant.hasCross && (
            <mesh
              position={[0, ant.h * 0.7, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.008, 0.008, 0.3, 4]} />
              <meshStandardMaterial
                color="#94a3b8"
                metalness={0.85}
                roughness={0.15}
              />
            </mesh>
          )}
          {/* Mid-shaft ring detail */}
          <mesh position={[0, ant.h * 0.4, 0]}>
            <torusGeometry args={[0.05, 0.008, 4, 8]} />
            <meshStandardMaterial
              color="#94a3b8"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* ===== LIGHTS ===== */}
      {/* Inner energy core */}
      <pointLight
        ref={coreLightRef}
        position={[0, 0, 0]}
        color="#e8a019"
        intensity={2.5}
        distance={10}
        decay={2}
      />
      {/* Colored atmosphere lights */}
      <pointLight
        position={[width / 2, -totalHeight / 4, depth / 2]}
        color={goldColor}
        intensity={0.7}
        distance={5}
        decay={2}
      />
      <pointLight
        position={[-width / 2, totalHeight / 4, -depth / 2]}
        color={cyanColor}
        intensity={0.5}
        distance={5}
        decay={2}
      />
      <pointLight
        position={[0, totalHeight / 2 + 1, 0]}
        color="#e8a019"
        intensity={0.6}
        distance={6}
        decay={2}
      />

      {/* Core glow sphere */}
      <mesh position={[0, -totalHeight / 2 + tier1H * 0.6, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial
          color={goldColor}
          emissive={goldColor}
          emissiveIntensity={2.5}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* ===== FLOATING LABEL ===== */}
      <Html
        position={[0, totalHeight / 2 + 5.8, 0]}
        center
        transform={false}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(5, 5, 8, 0.92)",
            border: "1px solid rgba(232, 160, 25, 0.5)",
            borderRadius: 3,
            padding: "3px 10px",
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace",
            userSelect: "none",
            boxShadow: "0 0 16px rgba(232, 160, 25, 0.4)",
          }}
        >
          <span
            style={{
              color: "#e8a019",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              textShadow: "0 0 12px rgba(232, 160, 25, 0.7)",
            }}
          >
            CMD
          </span>
          <span
            style={{
              color: "#22c55e",
              fontSize: 7,
              fontWeight: 700,
              marginLeft: 5,
              textShadow: "0 0 6px rgba(34, 197, 94, 0.6)",
            }}
          >
            ONLINE
          </span>
        </div>
      </Html>
    </group>
  );
}
