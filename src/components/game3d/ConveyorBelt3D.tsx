"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ConveyorBelt, Building } from "./types";

interface ConveyorBelt3DProps {
  belt: ConveyorBelt;
  buildings: Building[];
}

/**
 * Factorio-style conveyor belt with solid body, animated chevron pattern,
 * side rails, and colored item boxes traveling along it.
 */
export function ConveyorBelt3D({ belt, buildings }: ConveyorBelt3DProps) {
  const beltMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const itemsRef = useRef<THREE.Group>(null);

  const fromBuilding = buildings.find((b) => b.id === belt.fromBuildingId);
  const toBuilding = buildings.find((b) => b.id === belt.toBuildingId);

  if (!fromBuilding || !toBuilding) return null;

  const from = new THREE.Vector3(fromBuilding.gridX, 0.06, fromBuilding.gridY);
  const to = new THREE.Vector3(toBuilding.gridX, 0.06, toBuilding.gridY);

  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  dir.normalize();

  const midPoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const rotationY = Math.atan2(dir.x, dir.z);

  // Perpendicular for side rails
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const railOffset = 0.17;

  // Belt body texture with chevron/arrow pattern
  const beltTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    // Dark metal belt surface
    ctx.fillStyle = "#1a1c28";
    ctx.fillRect(0, 0, 256, 64);

    // Chevron arrows showing direction
    ctx.fillStyle = belt.active
      ? `${belt.color}40`
      : "rgba(50, 50, 60, 0.3)";
    for (let x = 0; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x + 8, 10);
      ctx.lineTo(x + 16, 32);
      ctx.lineTo(x + 8, 54);
      ctx.lineTo(x + 12, 54);
      ctx.lineTo(x + 20, 32);
      ctx.lineTo(x + 12, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Edge lines
    ctx.strokeStyle = "rgba(80, 82, 95, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(256, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 63);
    ctx.lineTo(256, 63);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(Math.max(1, Math.floor(length / 2)), 1);
    return tex;
  }, [belt.active, belt.color, length]);

  // Rail positions
  const rail1From = new THREE.Vector3().copy(from).add(perp.clone().multiplyScalar(railOffset));
  const rail1To = new THREE.Vector3().copy(to).add(perp.clone().multiplyScalar(railOffset));
  const rail2From = new THREE.Vector3().copy(from).add(perp.clone().multiplyScalar(-railOffset));
  const rail2To = new THREE.Vector3().copy(to).add(perp.clone().multiplyScalar(-railOffset));

  const rail1Mid = new THREE.Vector3().addVectors(rail1From, rail1To).multiplyScalar(0.5);
  const rail2Mid = new THREE.Vector3().addVectors(rail2From, rail2To).multiplyScalar(0.5);

  const beltColor = belt.active ? "#2a2c38" : "#1a1c24";
  const itemCount = belt.active ? 4 : 0;

  // Animate belt texture offset and items
  useFrame(({ clock }) => {
    if (!belt.active) return;
    const t = clock.getElapsedTime();

    // Scroll belt texture
    if (beltMatRef.current && beltMatRef.current.map) {
      beltMatRef.current.map.offset.x = -t * 0.3;
    }

    // Move items along belt
    if (itemsRef.current) {
      itemsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const phase = i / itemCount;
        const progress = ((t * 0.25 + phase) % 1.0 + 1.0) % 1.0;

        const pos = new THREE.Vector3().lerpVectors(from, to, progress);
        pos.y = 0.12;
        mesh.position.copy(pos);
        mesh.rotation.y += 0.02;
      });
    }
  });

  return (
    <group>
      {/* Belt body — thin box */}
      <mesh
        position={[midPoint.x, 0.06, midPoint.z]}
        rotation={[0, rotationY, 0]}
      >
        <boxGeometry args={[0.3, 0.05, length]} />
        <meshStandardMaterial
          ref={beltMatRef}
          map={beltTexture}
          color={beltColor}
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>

      {/* Side rail 1 */}
      <mesh position={[rail1Mid.x, 0.08, rail1Mid.z]} rotation={[0, rotationY, 0]}>
        <boxGeometry args={[0.03, 0.06, length]} />
        <meshStandardMaterial
          color="#4a4c58"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Side rail 2 */}
      <mesh position={[rail2Mid.x, 0.08, rail2Mid.z]} rotation={[0, rotationY, 0]}>
        <boxGeometry args={[0.03, 0.06, length]} />
        <meshStandardMaterial
          color="#4a4c58"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Support posts along belt every ~2 units */}
      {Array.from({ length: Math.max(1, Math.floor(length / 2.5)) }).map((_, i) => {
        const t = (i + 1) / (Math.floor(length / 2.5) + 1);
        const pos = new THREE.Vector3().lerpVectors(from, to, t);
        return (
          <mesh key={`support-${i}`} position={[pos.x, 0.03, pos.z]}>
            <boxGeometry args={[0.35, 0.02, 0.06]} />
            <meshStandardMaterial
              color="#3a3c48"
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>
        );
      })}

      {/* Items on belt — small colored boxes like Factorio items */}
      <group ref={itemsRef}>
        {Array.from({ length: itemCount }).map((_, i) => (
          <mesh key={`item-${i}`} position={[midPoint.x, 0.12, midPoint.z]}>
            <boxGeometry args={[0.1, 0.08, 0.1]} />
            <meshStandardMaterial
              color={belt.color}
              emissive={belt.color}
              emissiveIntensity={0.6}
              metalness={0.4}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>

      {/* Steam puff at belt endpoints (active only) */}
      {belt.active && (
        <>
          <mesh position={[to.x, 0.2, to.z]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial
              color="#888899"
              emissive="#555566"
              emissiveIntensity={0.2}
              transparent
              opacity={0.15}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
