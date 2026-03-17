"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ConveyorBelt, Building } from "./types";

interface ConveyorBelt3DProps {
  belt: ConveyorBelt;
  buildings: Building[];
}

// Data type -> item shape + color
const DATA_ITEM_CONFIG: Record<
  string,
  { geometry: "box" | "octahedron" | "cylinder" | "tetrahedron" | "cone" | "sphere"; color: string; trailColor: string }
> = {
  code:    { geometry: "box",         color: "#3b82f6", trailColor: "#1d4ed8" },
  tests:   { geometry: "octahedron",  color: "#22c55e", trailColor: "#15803d" },
  revenue: { geometry: "cylinder",    color: "#eab308", trailColor: "#a16207" },
  errors:  { geometry: "tetrahedron", color: "#ef4444", trailColor: "#b91c1c" },
  deploy:  { geometry: "cone",        color: "#f97316", trailColor: "#c2410c" },
  data:    { geometry: "sphere",      color: "#a855f7", trailColor: "#7e22ce" },
  config:  { geometry: "box",         color: "#06b6d4", trailColor: "#0e7490" },
  alerts:  { geometry: "tetrahedron", color: "#e8a019", trailColor: "#a16207" },
};

const BELT_Y = 0.3;
const ITEM_Y = BELT_Y + 0.12;

/** Number of visible items scales with real throughput. 0 throughput = 0 items. */
function itemCountFromThroughput(throughput: number): number {
  if (throughput <= 0) return 0;
  if (throughput <= 2) return 1;
  if (throughput <= 5) return 2;
  if (throughput <= 15) return 3;
  return 4;
}

/**
 * Factorio-style conveyor belt with animated treads, glowing rails,
 * distinct data-type items with trails, detailed sorting machines with sparks,
 * and active/inactive visual states.
 */
export function ConveyorBelt3D({ belt, buildings }: ConveyorBelt3DProps) {
  const itemsRef = useRef<THREE.Group>(null);
  const trailsRef = useRef<THREE.Group>(null);
  const beltMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rail1MatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rail2MatRef = useRef<THREE.MeshStandardMaterial>(null);
  const sparksRef = useRef<THREE.Group>(null);
  const sortGlowRef = useRef<THREE.MeshStandardMaterial>(null);

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

  // Belt surface texture with animated track treads
  const beltTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // Dark steel belt surface
    ctx.fillStyle = belt.active ? "#0e0f1a" : "#080810";
    ctx.fillRect(0, 0, 512, 128);

    // Tread pattern -- horizontal ridges across the belt
    const treadColor = belt.active ? "rgba(50, 52, 70, 0.8)" : "rgba(25, 26, 35, 0.5)";
    ctx.fillStyle = treadColor;
    for (let x = 0; x < 512; x += 12) {
      ctx.fillRect(x, 0, 5, 128);
    }

    // Tread gap highlights
    const gapColor = belt.active ? "rgba(30, 32, 45, 0.6)" : "rgba(15, 16, 22, 0.4)";
    ctx.fillStyle = gapColor;
    for (let x = 5; x < 512; x += 12) {
      ctx.fillRect(x, 0, 7, 128);
    }

    // Subtle grid lines across belt surface
    ctx.strokeStyle = belt.active ? "rgba(55, 58, 75, 0.5)" : "rgba(25, 26, 35, 0.3)";
    ctx.lineWidth = 1;
    for (let y = 0; y < 128; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Directional chevrons
    const chevronColor = belt.active ? `${belt.color}66` : "rgba(35, 35, 45, 0.2)";
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

    // Center tread line -- brighter when active
    ctx.strokeStyle = belt.active ? `${belt.color}50` : "rgba(30, 30, 40, 0.3)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(512, 64);
    ctx.stroke();

    // Edge wear lines
    ctx.strokeStyle = belt.active ? "rgba(70, 72, 90, 0.6)" : "rgba(35, 36, 45, 0.4)";
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
    tex.repeat.set(Math.max(1, Math.floor(length / 1.2)), 1);
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
  const treadSegmentCount = Math.max(3, Math.floor(length / 0.5));

  const itemConfig = DATA_ITEM_CONFIG[belt.dataType] || DATA_ITEM_CONFIG.data;
  const itemCount = belt.active ? itemCountFromThroughput(belt.throughput) : 0;

  // Animate belt texture, items, rails, sparks
  const beltOffsetRef = useRef(0);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    if (belt.active) {
      // Scroll belt texture -- faster for higher throughput
      const speed = 0.3 + (belt.throughput / 40) * 0.3;
      beltOffsetRef.current -= delta * speed;
      if (beltMatRef.current?.map) {
        beltMatRef.current.map.offset.x = beltOffsetRef.current;
      }

      // Animate rail glow -- pulse when active
      const railGlow = 0.3 + Math.sin(t * 2) * 0.15;
      if (rail1MatRef.current) {
        rail1MatRef.current.emissiveIntensity = railGlow;
      }
      if (rail2MatRef.current) {
        rail2MatRef.current.emissiveIntensity = railGlow;
      }
    }

    // Move items along belt
    if (itemsRef.current && belt.active) {
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

    // Move trail ghosts behind items
    if (trailsRef.current && belt.active) {
      trailsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const count = Math.max(1, itemCount);
        const trailIndex = Math.floor(i / 2);
        const trailOffset = (i % 2 + 1) * 0.04;
        const phase = trailIndex / count;
        const progress = ((-beltOffsetRef.current * 0.7 + phase - trailOffset) % 1.0 + 1.0) % 1.0;

        const pos = new THREE.Vector3().lerpVectors(from, to, progress);
        pos.y = ITEM_Y;
        mesh.position.copy(pos);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.opacity = 0.25 - (i % 2) * 0.1;
        }
      });
    }

    // Animate sparks at sorting machine
    if (sparksRef.current && belt.active) {
      sparksRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const sparkCycle = (t * 4 + i * 1.3) % 1.5;
        if (sparkCycle < 0.3) {
          mesh.visible = true;
          const sparkProgress = sparkCycle / 0.3;
          const angle = i * 2.1 + t * 8;
          mesh.position.set(
            Math.cos(angle) * 0.15 * sparkProgress,
            0.1 + sparkProgress * 0.3,
            Math.sin(angle) * 0.15 * sparkProgress
          );
          const s = 0.015 * (1 - sparkProgress);
          mesh.scale.setScalar(s > 0 ? s : 0.001);
        } else {
          mesh.visible = false;
        }
      });
    }

    // Pulse sorting machine glow
    if (sortGlowRef.current && belt.active) {
      sortGlowRef.current.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.3;
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
      {/* --- BELT BODY --- animated tread surface */}
      <mesh
        position={[midPoint.x, BELT_Y, midPoint.z]}
        rotation={[0, rotationY, 0]}
        receiveShadow
      >
        <boxGeometry args={[0.42, 0.08, length]} />
        <meshStandardMaterial
          ref={beltMatRef}
          map={beltTexture}
          color={belt.active ? "#1a1a2e" : "#0a0a12"}
          metalness={0.85}
          roughness={belt.active ? 0.3 : 0.6}
        />
      </mesh>

      {/* --- BELT UNDERSIDE --- darker bottom plate */}
      <mesh
        position={[midPoint.x, BELT_Y - 0.06, midPoint.z]}
        rotation={[0, rotationY, 0]}
      >
        <boxGeometry args={[0.38, 0.03, length]} />
        <meshStandardMaterial
          color="#0a0a12"
          metalness={0.7}
          roughness={0.5}
        />
      </mesh>

      {/* --- TREAD SEGMENTS --- visible individual tread plates on top */}
      {belt.active &&
        Array.from({ length: treadSegmentCount }).map((_, i) => {
          const t = (i + 0.5) / treadSegmentCount;
          const pos = new THREE.Vector3().lerpVectors(from, to, t);
          return (
            <mesh
              key={`tread-${i}`}
              position={[pos.x, BELT_Y + 0.042, pos.z]}
              rotation={[0, rotationY, 0]}
            >
              <boxGeometry args={[0.38, 0.005, 0.06]} />
              <meshStandardMaterial
                color="#1e2035"
                metalness={0.9}
                roughness={0.25}
                emissive={belt.color}
                emissiveIntensity={0.05}
              />
            </mesh>
          );
        })}

      {/* --- SIDE RAILS --- with emissive glow when active */}
      <mesh
        position={[rail1Mid.x, BELT_Y + 0.04, rail1Mid.z]}
        rotation={[Math.PI / 2, 0, rotationY]}
      >
        <cylinderGeometry args={[0.035, 0.035, length, 8]} />
        <meshStandardMaterial
          ref={rail1MatRef}
          color={belt.active ? "#9a9caa" : "#4a4c55"}
          emissive={belt.active ? belt.color : "#000000"}
          emissiveIntensity={belt.active ? 0.3 : 0}
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>
      <mesh
        position={[rail2Mid.x, BELT_Y + 0.04, rail2Mid.z]}
        rotation={[Math.PI / 2, 0, rotationY]}
      >
        <cylinderGeometry args={[0.035, 0.035, length, 8]} />
        <meshStandardMaterial
          ref={rail2MatRef}
          color={belt.active ? "#9a9caa" : "#4a4c55"}
          emissive={belt.active ? belt.color : "#000000"}
          emissiveIntensity={belt.active ? 0.3 : 0}
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>

      {/* --- RAIL EDGE TRIM --- thin strips along outer rail edge */}
      <mesh
        position={[rail1Mid.x, BELT_Y + 0.075, rail1Mid.z]}
        rotation={[Math.PI / 2, 0, rotationY]}
      >
        <cylinderGeometry args={[0.01, 0.01, length, 4]} />
        <meshStandardMaterial
          color={belt.active ? "#6a6c78" : "#2a2c35"}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh
        position={[rail2Mid.x, BELT_Y + 0.075, rail2Mid.z]}
        rotation={[Math.PI / 2, 0, rotationY]}
      >
        <cylinderGeometry args={[0.01, 0.01, length, 4]} />
        <meshStandardMaterial
          color={belt.active ? "#6a6c78" : "#2a2c35"}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* --- ROLLERS --- small cylinders underneath the belt */}
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
              color={belt.active ? "#555566" : "#333340"}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
        );
      })}

      {/* --- SUPPORT LEGS --- posts holding the belt up */}
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
                color={belt.active ? "#2a2c38" : "#1a1c24"}
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
            {/* Right leg */}
            <mesh position={[rightPos.x, BELT_Y / 2, rightPos.z]}>
              <boxGeometry args={[0.04, BELT_Y, 0.04]} />
              <meshStandardMaterial
                color={belt.active ? "#2a2c38" : "#1a1c24"}
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
                color={belt.active ? "#3a3c48" : "#222230"}
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
            {/* Foot plate */}
            <mesh position={[pos.x, 0.01, pos.z]} rotation={[0, rotationY, 0]}>
              <boxGeometry args={[0.32, 0.02, 0.08]} />
              <meshStandardMaterial
                color="#1a1c24"
                metalness={0.6}
                roughness={0.5}
              />
            </mesh>
          </group>
        );
      })}

      {/* --- DIRECTION CHEVRONS --- small 3D cones on belt surface */}
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
                emissiveIntensity={0.5}
                transparent
                opacity={0.4}
                toneMapped={false}
              />
            </mesh>
          );
        })}

      {/* --- DATA ITEMS on belt --- with distinct shapes per type */}
      <group ref={itemsRef}>
        {belt.active && itemCount > 0 &&
          Array.from({ length: itemCount }).map((_, i) => (
            <mesh key={`item-${i}`} position={[midPoint.x, ITEM_Y, midPoint.z]}>
              {itemConfig.geometry === "box" && (
                <boxGeometry args={[0.14, 0.1, 0.14]} />
              )}
              {itemConfig.geometry === "octahedron" && (
                <octahedronGeometry args={[0.1]} />
              )}
              {itemConfig.geometry === "cylinder" && (
                <cylinderGeometry args={[0.08, 0.08, 0.05, 8]} />
              )}
              {itemConfig.geometry === "tetrahedron" && (
                <tetrahedronGeometry args={[0.11]} />
              )}
              {itemConfig.geometry === "cone" && (
                <coneGeometry args={[0.07, 0.16, 6]} />
              )}
              {itemConfig.geometry === "sphere" && (
                <sphereGeometry args={[0.08, 8, 8]} />
              )}
              <meshStandardMaterial
                color={itemConfig.color}
                emissive={itemConfig.color}
                emissiveIntensity={1.2}
                metalness={0.4}
                roughness={0.2}
                toneMapped={false}
              />
            </mesh>
          ))}
      </group>

      {/* --- ITEM TRAILS --- ghost copies trailing behind each item */}
      <group ref={trailsRef}>
        {belt.active && itemCount > 0 &&
          Array.from({ length: itemCount * 2 }).map((_, i) => (
            <mesh key={`trail-${i}`} position={[midPoint.x, ITEM_Y, midPoint.z]}>
              <sphereGeometry args={[0.04, 4, 4]} />
              <meshStandardMaterial
                color={itemConfig.trailColor}
                emissive={itemConfig.trailColor}
                emissiveIntensity={0.8}
                transparent
                opacity={0.25}
                toneMapped={false}
              />
            </mesh>
          ))}
      </group>

      {/* --- SORTING MACHINE at belt endpoint --- detailed geometry */}
      <group>
        {/* Main housing */}
        <mesh position={[to.x, BELT_Y + 0.06, to.z]}>
          <boxGeometry args={[0.35, 0.25, 0.35]} />
          <meshStandardMaterial
            color={belt.active ? "#1a1c28" : "#0e0f16"}
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>
        {/* Top plate */}
        <mesh position={[to.x, BELT_Y + 0.195, to.z]}>
          <boxGeometry args={[0.38, 0.02, 0.38]} />
          <meshStandardMaterial
            color={belt.active ? "#2a2c38" : "#151620"}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
        {/* Side vents (left) */}
        {[0, 1, 2].map((j) => (
          <mesh
            key={`vent-l-${j}`}
            position={[to.x - 0.18, BELT_Y + 0.02 + j * 0.06, to.z]}
          >
            <boxGeometry args={[0.01, 0.03, 0.2]} />
            <meshStandardMaterial
              color={belt.active ? "#2a2c38" : "#151620"}
              emissive={belt.active ? belt.color : "#000000"}
              emissiveIntensity={belt.active ? 0.2 : 0}
            />
          </mesh>
        ))}
        {/* Side vents (right) */}
        {[0, 1, 2].map((j) => (
          <mesh
            key={`vent-r-${j}`}
            position={[to.x + 0.18, BELT_Y + 0.02 + j * 0.06, to.z]}
          >
            <boxGeometry args={[0.01, 0.03, 0.2]} />
            <meshStandardMaterial
              color={belt.active ? "#2a2c38" : "#151620"}
              emissive={belt.active ? belt.color : "#000000"}
              emissiveIntensity={belt.active ? 0.2 : 0}
            />
          </mesh>
        ))}
        {/* Status indicator light */}
        <mesh position={[to.x + 0.18, BELT_Y + 0.16, to.z + 0.14]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial
            ref={sortGlowRef}
            color={belt.active ? "#10b981" : "#333340"}
            emissive={belt.active ? "#10b981" : "#000000"}
            emissiveIntensity={belt.active ? 0.8 : 0}
            toneMapped={false}
          />
        </mesh>
        {/* Spinning gear on top */}
        {belt.active && (
          <SortingGear position={[to.x, BELT_Y + 0.24, to.z]} color={belt.color} />
        )}
        {/* Sorting machine intake funnel */}
        <mesh position={[to.x, BELT_Y - 0.08, to.z]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.12, 0.1, 6, 1, true]} />
          <meshStandardMaterial
            color="#1a1c28"
            metalness={0.8}
            roughness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* --- SPARKS at sorting machine --- bursts of emissive particles */}
      {belt.active && (
        <group ref={sparksRef} position={[to.x, BELT_Y + 0.2, to.z]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={`spark-${i}`} visible={false}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={belt.color}
                emissive={belt.color}
                emissiveIntensity={3}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* --- STEAM VENTS at belt endpoint --- */}
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

      {/* --- ORIGIN ENDCAP --- small plate at belt start */}
      <mesh
        position={[from.x, BELT_Y, from.z]}
        rotation={[0, rotationY, 0]}
      >
        <boxGeometry args={[0.44, 0.1, 0.08]} />
        <meshStandardMaterial
          color={belt.active ? "#2a2c38" : "#151620"}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* --- OIL PUDDLE under belt start --- */}
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

      {/* --- INACTIVE OVERLAY --- dim powered-down look */}
      {!belt.active && (
        <mesh
          position={[midPoint.x, BELT_Y + 0.045, midPoint.z]}
          rotation={[0, rotationY, 0]}
        >
          <boxGeometry args={[0.44, 0.005, length]} />
          <meshStandardMaterial
            color="#050508"
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

/** Small spinning gear on sorting machines -- dual torus for more detail */
function SortingGear({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 3;
  });

  return (
    <group ref={ref} position={position}>
      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[0.09, 0.02, 4, 8]} />
        <meshStandardMaterial
          color="#6a6c78"
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
      {/* Inner ring -- counter-rotates visually via smaller size */}
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[0.05, 0.015, 4, 6]} />
        <meshStandardMaterial
          color="#5a5c68"
          emissive={color}
          emissiveIntensity={0.3}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
      {/* Center hub */}
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, 0.03, 6]} />
        <meshStandardMaterial
          color="#8a8c98"
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>
    </group>
  );
}
