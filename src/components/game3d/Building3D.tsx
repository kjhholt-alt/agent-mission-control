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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Panel texture with subtle grid lines for that sci-fi panel look */
function usePanelTexture(tint: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#0a0b14";
    ctx.fillRect(0, 0, 64, 64);

    // Horizontal grooves
    ctx.strokeStyle = `${tint}18`;
    ctx.lineWidth = 1;
    for (let y = 8; y < 64; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(64, y);
      ctx.stroke();
    }
    // Vertical grooves
    for (let x = 8; x < 64; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 64);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }, [tint]);
}

/** Warning-stripe texture for the base perimeter */
function useWarningTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#1a1a10";
    ctx.fillRect(0, 0, 128, 128);

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
}

// ---------------------------------------------------------------------------
// Sub-components for panel details
// ---------------------------------------------------------------------------

function PanelRib({
  position,
  args,
  rotation,
}: {
  position: [number, number, number];
  args: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]}>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#1a1c28" metalness={0.85} roughness={0.25} />
    </mesh>
  );
}

function VentGrill({
  position,
  rotation,
  w,
  h,
  color,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  w: number;
  h: number;
  color: string;
}) {
  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      {/* Grill housing */}
      <mesh>
        <boxGeometry args={[w, h, 0.02]} />
        <meshStandardMaterial color="#0c0d16" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Grill slats */}
      {[-0.3, -0.1, 0.1, 0.3].map((off, i) => (
        <mesh key={i} position={[off * w, 0, 0.012]}>
          <boxGeometry args={[w * 0.05, h * 0.8, 0.005]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Industrial sci-fi factory building with multi-level geometry, stepped
 * rooflines, panel details, holographic status displays, active energy
 * fields, error threat effects, and proper exhaust billowing.
 */
export function Building3D({
  building,
  isHovered,
  isSelected,
  onHover,
  onClick,
}: Building3DProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const windowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const smokeParticlesRef = useRef<THREE.Group>(null);
  const energyFieldRef = useRef<THREE.Mesh>(null);
  const energyFieldMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const errorBeaconRef = useRef<THREE.MeshStandardMaterial>(null);
  const holoDisplayRef = useRef<THREE.Group>(null);
  const holoMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const antennaLightRef = useRef<THREE.MeshStandardMaterial>(null);

  const width = building.size * 1.5;
  const depth = building.size * 1.5;
  const height = building.size * 1.0;

  const isActive = building.status === "active";
  const isError = building.status === "error";
  const isWarning = building.status === "warning";
  const isLarge = building.size >= 2;

  const color = useMemo(
    () => new THREE.Color(isError ? "#ef4444" : building.color),
    [building.color, isError]
  );
  const edgeColor = useMemo(
    () => new THREE.Color(isError ? "#ef4444" : building.color),
    [building.color, isError]
  );

  const warningTexture = useWarningTexture();
  const panelTexture = usePanelTexture(building.color);

  // --- stepped tier sizes ---
  const tier1H = height * 0.65;
  const tier2H = height * 0.3;
  const tier2W = width * 0.7;
  const tier2D = depth * 0.65;

  // Animation loop
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // --- Material pulsing ---
    if (materialRef.current) {
      let emissiveIntensity: number;
      if (isError) {
        emissiveIntensity = 0.5 + Math.sin(t * 5) * 0.35;
      } else if (isActive) {
        emissiveIntensity = 0.3 + Math.sin(t * 2 + building.gridX) * 0.12;
      } else if (isWarning) {
        emissiveIntensity = 0.25 + Math.sin(t * 4) * 0.18;
      } else {
        emissiveIntensity = 0.12;
      }
      if (isHovered || isSelected) emissiveIntensity += 0.25;
      materialRef.current.emissiveIntensity = emissiveIntensity;
    }

    // --- Edge glow ---
    if (edgeMaterialRef.current) {
      edgeMaterialRef.current.opacity =
        isHovered || isSelected
          ? 0.9
          : isActive
            ? 0.45 + Math.sin(t * 2 + building.gridX) * 0.15
            : 0.2;
    }

    // --- Window glow ---
    if (windowMatRef.current) {
      windowMatRef.current.emissiveIntensity = isActive
        ? 2.0 + Math.sin(t * 1.5 + building.gridX * 0.3) * 0.8
        : isError
          ? 1.5 + Math.sin(t * 6) * 1.0
          : 0.3;
    }

    // --- Smoke / exhaust billowing ---
    if (smokeParticlesRef.current && isLarge) {
      smokeParticlesRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const speed = isActive ? 0.5 : 0.15;
        const yOffset = (t * speed + i * 0.35) % 2.5;
        const drift = Math.sin(t * 0.8 + i * 1.7) * 0.12;
        mesh.position.set(drift, yOffset, Math.cos(t * 0.6 + i * 2.1) * 0.06);
        const scale = 0.04 + yOffset * 0.06;
        mesh.scale.set(scale, scale * 0.7, scale);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.opacity = Math.max(0, 0.35 - yOffset * 0.14);
        }
      });
    }

    // --- Energy field at base (active buildings) ---
    if (energyFieldRef.current && energyFieldMatRef.current) {
      energyFieldMatRef.current.opacity = isActive
        ? 0.12 + Math.sin(t * 3 + building.gridX) * 0.06
        : 0;
      energyFieldRef.current.scale.setScalar(
        1 + Math.sin(t * 2) * 0.03
      );
    }

    // --- Error beacon pulsing ---
    if (errorBeaconRef.current && isError) {
      errorBeaconRef.current.emissiveIntensity =
        2.5 + Math.sin(t * 7) * 1.5;
    }

    // --- Holographic display ---
    if (holoDisplayRef.current) {
      holoDisplayRef.current.position.y =
        height / 2 + 0.55 + Math.sin(t * 1.4) * 0.06;
    }
    if (holoMatRef.current) {
      holoMatRef.current.opacity = 0.18 + Math.sin(t * 2.5) * 0.08;
      holoMatRef.current.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.5;
    }

    // --- Antenna light blink ---
    if (antennaLightRef.current && isActive) {
      antennaLightRef.current.emissiveIntensity =
        Math.sin(t * 4 + building.gridX) > 0.3 ? 3.0 : 0.4;
    }
  });

  const statusColor =
    building.status === "error"
      ? "#ef4444"
      : building.status === "active"
        ? "#22c55e"
        : building.status === "warning"
          ? "#f59e0b"
          : "#6b7280";

  // Window geometry
  const windowY = tier1H * 0.2 - height / 2 + tier1H / 2;
  const windowH = tier1H * 0.22;
  const windowW = width * 0.55;
  const windowDs = depth * 0.55;

  return (
    <group position={[building.gridX, height / 2, building.gridY]}>
      {/* ===== TIER 1 - Main body (lower, wider) ===== */}
      <mesh
        position={[0, -height / 2 + tier1H / 2, 0]}
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
          emissiveIntensity={0.12}
          metalness={0.55}
          roughness={0.35}
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

      {/* Panel texture overlay on front face */}
      <mesh position={[0, -height / 2 + tier1H / 2, depth / 2 + 0.005]}>
        <planeGeometry args={[width * 0.95, tier1H * 0.95]} />
        <meshStandardMaterial
          map={panelTexture}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      {/* Horizontal panel ribs on main body */}
      <PanelRib
        position={[0, -height / 2 + tier1H * 0.35, depth / 2 + 0.01]}
        args={[width * 0.9, 0.02, 0.005]}
      />
      <PanelRib
        position={[0, -height / 2 + tier1H * 0.65, depth / 2 + 0.01]}
        args={[width * 0.9, 0.02, 0.005]}
      />
      {/* Vertical ribs on sides */}
      <PanelRib
        position={[width / 2 + 0.01, -height / 2 + tier1H / 2, 0]}
        args={[0.005, tier1H * 0.8, 0.02]}
      />
      <PanelRib
        position={[-(width / 2 + 0.01), -height / 2 + tier1H / 2, 0]}
        args={[0.005, tier1H * 0.8, 0.02]}
      />

      {/* ===== TIER 2 - Stepped upper section ===== */}
      <mesh
        position={[0, -height / 2 + tier1H + tier2H / 2, 0]}
        castShadow
      >
        <boxGeometry args={[tier2W, tier2H, tier2D]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.35 : 0.15}
          metalness={0.65}
          roughness={0.3}
        />
        <Edges threshold={15} scale={1.001}>
          <lineBasicMaterial
            color={edgeColor}
            transparent
            opacity={0.3}
            linewidth={1}
          />
        </Edges>
      </mesh>

      {/* Tier 2 roof slab with overhang */}
      <mesh position={[0, -height / 2 + tier1H + tier2H + 0.025, 0]}>
        <boxGeometry args={[tier2W + 0.15, 0.05, tier2D + 0.15]} />
        <meshStandardMaterial color="#2a2c38" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Tier 1 ledge / overhang at the tier boundary */}
      <mesh position={[0, -height / 2 + tier1H + 0.015, 0]}>
        <boxGeometry args={[width + 0.18, 0.03, depth + 0.18]} />
        <meshStandardMaterial color="#2a2c38" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Angled roof ridge on tier 2 */}
      <mesh
        position={[0, -height / 2 + tier1H + tier2H + 0.08, 0]}
        rotation={[0, 0, 0]}
      >
        <boxGeometry args={[tier2W * 0.12, 0.06, tier2D + 0.1]} />
        <meshStandardMaterial color="#3a3c48" metalness={0.75} roughness={0.3} />
      </mesh>

      {/* ===== WINDOW STRIPS ===== */}
      {/* Front windows - two rows */}
      <mesh position={[0, windowY, depth / 2 + 0.012]}>
        <planeGeometry args={[windowW, windowH]} />
        <meshStandardMaterial
          ref={windowMatRef}
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 2.0 : 0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Upper window row on front */}
      <mesh position={[0, windowY + windowH * 1.4, depth / 2 + 0.012]}>
        <planeGeometry args={[windowW * 0.7, windowH * 0.6]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.6 : 0.2}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Back windows */}
      <mesh
        position={[0, windowY, -(depth / 2 + 0.012)]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[windowW, windowH]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.5 : 0.2}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Side windows */}
      <mesh
        position={[width / 2 + 0.012, windowY, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[windowDs, windowH]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.2 : 0.2}
          transparent
          opacity={0.65}
        />
      </mesh>
      <mesh
        position={[-(width / 2 + 0.012), windowY, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[windowDs, windowH]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 1.2 : 0.2}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Tier 2 windows (smaller, brighter) */}
      <mesh
        position={[0, -height / 2 + tier1H + tier2H * 0.5, tier2D / 2 + 0.012]}
      >
        <planeGeometry args={[tier2W * 0.6, tier2H * 0.35]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 2.5 : 0.4}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* ===== FRONT ENTRANCE ===== */}
      <mesh position={[0, -height / 2 + tier1H * 0.28, depth / 2 + 0.018]}>
        <planeGeometry args={[width * 0.22, tier1H * 0.5]} />
        <meshStandardMaterial color="#060610" metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Door frame glow */}
      <mesh position={[0, -height / 2 + tier1H * 0.28, depth / 2 + 0.022]}>
        <planeGeometry args={[width * 0.25, tier1H * 0.53]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={isActive ? 0.6 : 0.15}
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* ===== VENT GRILLS on sides ===== */}
      <VentGrill
        position={[width / 2 + 0.015, -height / 2 + tier1H * 0.75, depth * 0.25]}
        rotation={[0, Math.PI / 2, 0]}
        w={depth * 0.2}
        h={tier1H * 0.15}
        color={building.color}
      />
      <VentGrill
        position={[-(width / 2 + 0.015), -height / 2 + tier1H * 0.75, -depth * 0.25]}
        rotation={[0, -Math.PI / 2, 0]}
        w={depth * 0.2}
        h={tier1H * 0.15}
        color={building.color}
      />

      {/* ===== CHIMNEY / EXHAUST (large buildings) ===== */}
      {isLarge && (
        <group position={[width * 0.28, -height / 2 + tier1H, -depth * 0.22]}>
          {/* Primary stack */}
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.1, 0.14, 0.9, 8]} />
            <meshStandardMaterial color="#2a2c38" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Stack collar */}
          <mesh position={[0, 0.92, 0]}>
            <cylinderGeometry args={[0.16, 0.1, 0.06, 8]} />
            <meshStandardMaterial color="#4a4c58" metalness={0.75} roughness={0.3} />
          </mesh>
          {/* Secondary stack (shorter) */}
          <mesh position={[0.22, 0.3, 0.05]}>
            <cylinderGeometry args={[0.065, 0.08, 0.6, 6]} />
            <meshStandardMaterial color="#2a2c38" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0.22, 0.62, 0.05]}>
            <cylinderGeometry args={[0.1, 0.065, 0.04, 6]} />
            <meshStandardMaterial color="#4a4c58" metalness={0.75} roughness={0.3} />
          </mesh>

          {/* Smoke billows */}
          <group ref={smokeParticlesRef} position={[0, 0.96, 0]}>
            {Array.from({ length: 7 }).map((_, i) => (
              <mesh
                key={i}
                position={[
                  Math.sin(i * 1.3) * 0.05,
                  i * 0.35,
                  Math.cos(i * 1.3) * 0.05,
                ]}
              >
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshStandardMaterial
                  color="#8888aa"
                  emissive="#555566"
                  emissiveIntensity={0.25}
                  transparent
                  opacity={0.3}
                />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* ===== ANTENNA ARRAY (active buildings) ===== */}
      {isActive && (
        <group position={[-width * 0.3, -height / 2 + tier1H + tier2H, -depth * 0.2]}>
          {/* Main antenna mast */}
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.02, 0.035, 0.7, 4]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Antenna tip light */}
          <mesh position={[0, 0.72, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial
              ref={antennaLightRef}
              color={building.color}
              emissive={building.color}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
          {/* Cross-arm */}
          <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.008, 0.008, 0.25, 4]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Secondary shorter mast */}
          <mesh position={[0.12, 0.2, 0.06]}>
            <cylinderGeometry args={[0.012, 0.02, 0.4, 4]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.15} />
          </mesh>
        </group>
      )}

      {/* ===== HOLOGRAPHIC STATUS DISPLAY ===== */}
      <group
        ref={holoDisplayRef}
        position={[0, height / 2 + 0.55, 0]}
      >
        {/* Main holo panel */}
        <mesh rotation={[-Math.PI / 8, 0, 0]}>
          <planeGeometry args={[width * 0.55, 0.35]} />
          <meshStandardMaterial
            ref={holoMatRef}
            color={isError ? "#ef4444" : "#06b6d4"}
            emissive={isError ? "#ef4444" : "#06b6d4"}
            emissiveIntensity={1.2}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Holo scanline bars (data effect) */}
        {[0.08, 0, -0.08].map((yOff, i) => (
          <mesh
            key={i}
            position={[0, yOff, 0.005]}
            rotation={[-Math.PI / 8, 0, 0]}
          >
            <planeGeometry args={[width * 0.45 * (1 - i * 0.15), 0.015]} />
            <meshStandardMaterial
              color={isError ? "#ef4444" : "#06b6d4"}
              emissive={isError ? "#ef4444" : "#06b6d4"}
              emissiveIntensity={2}
              transparent
              opacity={0.4}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
        {/* Holo border frame */}
        <mesh rotation={[-Math.PI / 8, 0, 0]}>
          <ringGeometry args={[width * 0.25, width * 0.28, 4]} />
          <meshStandardMaterial
            color={isError ? "#ef4444" : "#06b6d4"}
            emissive={isError ? "#ef4444" : "#06b6d4"}
            emissiveIntensity={1.8}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ===== ENERGY FIELD RING (active buildings) ===== */}
      {isActive && (
        <mesh
          ref={energyFieldRef}
          position={[0, -height / 2 + 0.06, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[width * 0.72, width * 0.82, 32]} />
          <meshStandardMaterial
            ref={energyFieldMatRef}
            color={building.color}
            emissive={building.color}
            emissiveIntensity={1.5}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ===== BASE PLATFORM (warning stripes) ===== */}
      <mesh position={[0, -height / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[width + 0.3, 0.04, depth + 0.3]} />
        <meshStandardMaterial
          map={warningTexture}
          color="#e8a019"
          emissive="#e8a019"
          emissiveIntensity={0.12}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* ===== STATUS LED ===== */}
      <mesh position={[width / 2 - 0.12, -height / 2 + tier1H - 0.08, depth / 2 + 0.015]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      {/* Second LED on opposite corner */}
      <mesh position={[-(width / 2 - 0.12), -height / 2 + tier1H - 0.08, depth / 2 + 0.015]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>

      {/* ===== INTERIOR GLOW ===== */}
      {isActive && (
        <pointLight
          position={[0, -height / 2 + tier1H * 0.4, 0]}
          color={building.color}
          intensity={1.0}
          distance={4}
          decay={2}
        />
      )}

      {/* ===== ERROR STATE EFFECTS ===== */}
      {isError && (
        <>
          {/* Threat ring */}
          <mesh
            position={[0, -height / 2 + 0.04, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[width * 0.85, width * 1.15, 32]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={2.0}
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Red point light */}
          <pointLight
            position={[0, height * 0.3, 0]}
            color="#ef4444"
            intensity={2.5}
            distance={6}
            decay={2}
          />
          {/* Warning beacons on corners */}
          {[
            [width / 2, -height / 2 + tier1H, depth / 2],
            [-width / 2, -height / 2 + tier1H, -depth / 2],
          ].map((pos, i) => (
            <mesh key={`err-beacon-${i}`} position={pos as [number, number, number]}>
              <cylinderGeometry args={[0.04, 0.04, 0.12, 6]} />
              <meshStandardMaterial
                ref={i === 0 ? errorBeaconRef : undefined}
                color="#ef4444"
                emissive="#ef4444"
                emissiveIntensity={2.5}
                toneMapped={false}
              />
            </mesh>
          ))}
          {/* Warning cross geometry on top */}
          <mesh
            position={[0, -height / 2 + tier1H + tier2H + 0.12, 0]}
            rotation={[0, Math.PI / 4, 0]}
          >
            <boxGeometry args={[tier2W * 0.5, 0.04, 0.04]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
          <mesh
            position={[0, -height / 2 + tier1H + tier2H + 0.12, 0]}
            rotation={[0, -Math.PI / 4, 0]}
          >
            <boxGeometry args={[tier2W * 0.5, 0.04, 0.04]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        </>
      )}

      {/* ===== FLOATING LABEL ===== */}
      <Html
        position={[0, height / 2 + 1.1, 0]}
        center
        transform={false}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(5, 5, 8, 0.88)",
            border: `1px solid ${building.color}55`,
            borderRadius: 3,
            padding: "2px 8px",
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace",
            userSelect: "none",
            boxShadow: `0 0 10px ${building.glowColor}`,
          }}
        >
          <span
            style={{
              color: building.color,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textShadow: `0 0 8px ${building.glowColor}`,
            }}
          >
            {building.shortName}
          </span>
          <span
            style={{
              color: statusColor,
              fontSize: 6,
              fontWeight: 700,
              marginLeft: 4,
              textShadow: `0 0 4px ${statusColor}`,
            }}
          >
            {isActive ? "ONLINE" : isError ? "ALERT" : isWarning ? "WARN" : "IDLE"}
          </span>
        </div>
      </Html>
    </group>
  );
}
