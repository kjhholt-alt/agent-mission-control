"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ConveyorBelt, Building } from "./types";

interface ConveyorBelt3DProps {
  belt: ConveyorBelt;
  buildings: Building[];
}

// Data type → item shape + color
const DATA_ITEM_CONFIG: Record<
  string,
  { geometry: "box" | "octahedron" | "cylinder" | "tetrahedron" | "cone" | "sphere"; color: string }
> = {
  code:    { geometry: "box",         color: "#3b82f6" },
  tests:   { geometry: "octahedron",  color: "#22c55e" },
  revenue: { geometry: "cylinder",    color: "#eab308" },
  errors:  { geometry: "tetrahedron", color: "#ef4444" },
  deploy:  { geometry: "cone",        color: "#f97316" },
  data:    { geometry: "sphere",      color: "#a855f7" },
  config:  { geometry: "box",         color: "#06b6d4" },
  alerts:  { geometry: "tetrahedron", color: "#e8a019" },
};

const BELT_Y = 0.3;
const ITEM_Y = BELT_Y + 0.1;

/** Number of visible items scales with real throughput. 0 throughput = 0 items. */
function itemCountFromThroughput(throughput: number): number {
  if (throughput <= 0) return 0;
  if (throughput <= 2) return 1;
  if (throughput <= 5) return 2;
  if (throughput <= 15) return 3;
  return 4;
}

/**
 * Factorio-style conveyor belt with 3D body, side rails, rollers,
 * support legs, direction chevrons, and distinct data-type items.
 */
export function ConveyorBelt3D({ belt, buildings }: ConveyorBelt3DProps) {
  const itemsRef = useRef<THREE.Group>(null);
  const beltMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const fromBuilding = buildings.find((b) => b.id === belt.fromBuildingId);
  const toBuilding = buildings.find((b) => b.id === belt.toBuildingId);

  if (!fromBuilding || !toBuilding) return null;

  const from = new THREE.Vector3(fromBuilding.gridX, BELT_Y, fromBuilding.gridY);
  const to = new THREE.Vector3(toBuilding.gridX, BELT_Y, toBuilding.gridY);

  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  dir.normalize();

  const midPoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const rotationY = Math.atan2(dir.x, dir.z);
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const railOffset = 0.22;

  // Belt surface texture with animated chevrons
  const beltTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // Dark steel belt surface
    ctx.fillStyle = "#0e0f1a";
    ctx.fillRect(0, 0, 512, 128);

    // Subtle grid lines across belt surface
    ctx.strokeStyle = "rgba(40, 42, 55, 0.6)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
    }

    // Directional chevrons
    const chevronColor = belt.active ? `${belt.color}55` : "rgba(35, 35, 45, 0.3)";
    ctx.fillStyle = chevronColor;
    for (let x = 0; x < 512; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x + 10, 15);
      ctx.lineTo(x + 24, 64);
      ctx.lineTo(x + 10, 113);
      ctx.lineTo(x + 18, 113);
      ctx.lineTo(x + 32, 64);
      ctx.lineTo(x + 18, 15);
      ctx.closePath();
      ctx.fill();
    }

    // Center tread line
    ctx.strokeStyle = belt.active ? `${belt.color}30` : "rgba(40, 40, 50, 0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(512, 64);
    ctx.stroke();

    // Edge wear lines
    ctx.strokeStyle = "rgba(60, 62, 75, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(512, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 126);
    ctx.lineTo(512, 126);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(Math.max(1, Math.floor(length / 1.5)), 1);
    return tex;
  }, [belt.active, belt.color, length]);

  // Rail positions
  const rail1Mid = new THREE.Vector3()
    .addVectors(
      new THREE.Vector3().copy(from).add(perp.clone().multiplyScalar(railOffset)),
      new THREE.Vector3().copy(to).add(perp.clone().multiplyScalar(railOffset))
    )
    .multiplyScalar(0.5);
  const rail2Mid = new THREE.Vector3()
    .addVectors(
      new THREE.Vector3().copy(from).add(perp.clone().multiplyScalar(-railOffset)),
      new THREE.Vector3().copy(to).add(perp.clone().multiplyScalar(-railOffset))
    )
    .multiplyScalar(0.5);

  // How many support legs and rollers
  const supportCount = Math.max(1, Math.floor(length / 2));
  const rollerCount = Math.max(2, Math.floor(length / 0.8));

  const itemConfig = DATA_ITEM_CONFIG[belt.dataType] || DATA_ITEM_CONFIG.data;
  const itemCount = belt.active ? itemCountFromThroughput(belt.throughput) : 0;

  // Animate belt texture and items
  const beltOffsetRef = useRef(0);

  useFrame((_, delta) => {
    if (!belt.active) return;

    // Scroll belt texture
    beltOffsetRef.current -= delta * 0.4;
    if (beltMatRef.current?.map) {
      beltMatRef.current.map.offset.x = beltOffsetRef.current;
    }

    // Move items along belt
    if (itemsRef.current) {
      itemsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const count = Math.max(1, itemCount);
        const phase = i / count;
        const progress = ((-beltOffsetRef.current * 0.7 + phase) % 1.0 + 1.0) % 1.0;

        const pos = new THREE.Vector3().lerpVectors(from, to, progress);
        pos.y = ITEM_Y;
        mesh.position.copy(pos);
        // Slow spin
        mesh.rotation.y += delta * 1.5;
        mesh.rotation.x += delta * 0.5;
      });
    }
  });

  // Steam vent particles refs
  const steamRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!belt.active || !steamRef.current) return;
    const t = clock.getElapsedTime();
    steamRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const st = (t * 1.2 + i * 0.7) % 2.0;
      mesh.position.y = 0.05 + st * 0.25;
      const s = 0.02 + st * 0.015;
      mesh.scale.setScalar(s);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = Math.max(0, 0.25 - st * 0.125);
    });
  });

  return (
    <group>
      {/* ═══ BELT BODY — wide, visible, industrial ═══ */}
      <mesh
        position={[midPoint.x, BELT_Y, midPoint.z]}
        rotation={[0, rotationY, 0]}
        receiveShadow
      >
        <boxGeometry args={[0.4, 0.08, length]} />
        <meshStandardMaterial
          ref={beltMatRef}
          map={beltTexture}
          color={belt.active ? "#1a1a2e" : "#111118"}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>

      {/* ═══ SIDE RAILS — chrome cylinders along each edge ═══ */}
      <mesh
        position={[rail1Mid.x, BELT_Y + 0.04, rail1Mid.z]}
        rotation={[Math.PI / 2, 0, rotationY]}
      >
        <cylinderGeometry args={[0.03, 0.03, length, 8]} />
        <meshStandardMaterial
          color="#8a8c98"
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>
      <mesh
        position={[rail2Mid.x, BELT_Y + 0.04, rail2Mid.z]}
        rotation={[Math.PI / 2, 0, rotationY]}
      >
        <cylinderGeometry args={[0.03, 0.03, length, 8]} />
        <meshStandardMaterial
          color="#8a8c98"
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>

      {/* ═══ ROLLERS — small cylinders underneath the belt ═══ */}
      {Array.from({ length: rollerCount }).map((_, i) => {
        const t = (i + 0.5) / rollerCount;
        const pos = new THREE.Vector3().lerpVectors(from, to, t);
        return (
          <mesh
            key={`roller-${i}`}
            position={[pos.x, BELT_Y - 0.05, pos.z]}
            rotation={[0, rotationY + Math.PI / 2, 0]}
          >
            <cylinderGeometry args={[0.025, 0.025, 0.38, 6]} />
            <meshStandardMaterial
              color="#555566"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        );
      })}

      {/* ═══ SUPPORT LEGS — posts holding the belt up ═══ */}
      {Array.from({ length: supportCount }).map((_, i) => {
        const t = (i + 1) / (supportCount + 1);
        const pos = new THREE.Vector3().lerpVectors(from, to, t);
        const leftPos = new THREE.Vector3().copy(pos).add(perp.clone().multiplyScalar(0.12));
        const rightPos = new THREE.Vector3().copy(pos).add(perp.clone().multiplyScalar(-0.12));
        return (
          <group key={`support-${i}`}>
            {/* Left leg */}
            <mesh position={[leftPos.x, BELT_Y / 2, leftPos.z]}>
              <boxGeometry args={[0.04, BELT_Y, 0.04]} />
              <meshStandardMaterial
                color="#2a2c38"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
            {/* Right leg */}
            <mesh position={[rightPos.x, BELT_Y / 2, rightPos.z]}>
              <boxGeometry args={[0.04, BELT_Y, 0.04]} />
              <meshStandardMaterial
                color="#2a2c38"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
            {/* Cross brace */}
            <mesh
              position={[pos.x, BELT_Y * 0.35, pos.z]}
              rotation={[0, rotationY, 0]}
            >
              <boxGeometry args={[0.3, 0.025, 0.025]} />
              <meshStandardMaterial
                color="#3a3c48"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
          </group>
        );
      })}

      {/* ═══ DIRECTION CHEVRONS — small 3D cones on belt surface ═══ */}
      {belt.active &&
        Array.from({ length: Math.max(2, Math.floor(length / 2.5)) }).map((_, i) => {
          const t = (i + 0.5) / Math.max(2, Math.floor(length / 2.5));
          const pos = new THREE.Vector3().lerpVectors(from, to, t);
          return (
            <mesh
              key={`chevron-${i}`}
              position={[pos.x, BELT_Y + 0.05, pos.z]}
              rotation={[Math.PI / 2, rotationY + Math.PI, 0]}
            >
              <coneGeometry args={[0.04, 0.08, 3]} />
              <meshStandardMaterial
                color={belt.color}
                emissive={belt.color}
                emissiveIntensity={0.4}
                transparent
                opacity={0.35}
                toneMapped={false}
              />
            </mesh>
          );
        })}

      {/* ═══ DATA ITEMS on belt — only shown when real data is flowing ═══ */}
      <group ref={itemsRef}>
        {belt.active && itemCount > 0 &&
          Array.from({ length: itemCount }).map((_, i) => (
            <mesh key={`item-${i}`} position={[midPoint.x, ITEM_Y, midPoint.z]}>
              {itemConfig.geometry === "box" && (
                <boxGeometry args={[0.12, 0.08, 0.12]} />
              )}
              {itemConfig.geometry === "octahedron" && (
                <octahedronGeometry args={[0.08]} />
              )}
              {itemConfig.geometry === "cylinder" && (
                <cylinderGeometry args={[0.07, 0.07, 0.04, 8]} />
              )}
              {itemConfig.geometry === "tetrahedron" && (
                <tetrahedronGeometry args={[0.09]} />
              )}
              {itemConfig.geometry === "cone" && (
                <coneGeometry args={[0.06, 0.14, 6]} />
              )}
              {itemConfig.geometry === "sphere" && (
                <sphereGeometry args={[0.07, 8, 8]} />
              )}
              <meshStandardMaterial
                color={itemConfig.color}
                emissive={itemConfig.color}
                emissiveIntensity={0.8}
                metalness={0.4}
                roughness={0.25}
                toneMapped={false}
              />
            </mesh>
          ))}
      </group>

      {/* ═══ SORTING MACHINE at belt endpoints ═══ */}
      {belt.active && (
        <group>
          {/* Destination sorting box */}
          <mesh position={[to.x, BELT_Y + 0.04, to.z]}>
            <boxGeometry args={[0.3, 0.2, 0.3]} />
            <meshStandardMaterial
              color="#1a1c28"
              metalness={0.75}
              roughness={0.3}
            />
          </mesh>
          {/* Spinning gear on top */}
          <SortingGear position={[to.x, BELT_Y + 0.18, to.z]} color={belt.color} />
        </group>
      )}

      {/* ═══ STEAM VENTS at belt endpoint ═══ */}
      {belt.active && (
        <group ref={steamRef} position={[to.x, BELT_Y + 0.15, to.z]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={`steam-${i}`} position={[
              Math.sin(i * 1.7) * 0.08,
              0,
              Math.cos(i * 1.7) * 0.08,
            ]}>
              <sphereGeometry args={[1, 5, 5]} />
              <meshStandardMaterial
                color="#aabbcc"
                emissive="#8899aa"
                emissiveIntensity={0.3}
                transparent
                opacity={0.2}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ═══ OIL PUDDLE under belt start ═══ */}
      <mesh
        position={[from.x, 0.01, from.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.25, 12]} />
        <meshStandardMaterial
          color="#0a0b12"
          metalness={0.95}
          roughness={0.1}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}

/** Small spinning gear on sorting machines */
function SortingGear({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 3;
  });

  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.08, 0.02, 4, 6]} />
      <meshStandardMaterial
        color="#6a6c78"
        emissive={color}
        emissiveIntensity={0.3}
        metalness={0.85}
        roughness={0.2}
      />
    </mesh>
  );
}
