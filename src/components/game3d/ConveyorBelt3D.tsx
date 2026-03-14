"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { ConveyorBelt, Building } from "./types";

interface ConveyorBelt3DProps {
  belt: ConveyorBelt;
  buildings: Building[];
}

/**
 * Conveyor belt rendered as two parallel dashed rail lines with
 * animated dash offset for flow direction, plus directional arrow markers.
 */
export function ConveyorBelt3D({ belt, buildings }: ConveyorBelt3DProps) {
  const dashOffsetRef = useRef(0);
  const line1Ref = useRef<any>(null);
  const line2Ref = useRef<any>(null);

  const fromBuilding = buildings.find((b) => b.id === belt.fromBuildingId);
  const toBuilding = buildings.find((b) => b.id === belt.toBuildingId);

  if (!fromBuilding || !toBuilding) return null;

  const from = new THREE.Vector3(fromBuilding.gridX, 0.1, fromBuilding.gridY);
  const to = new THREE.Vector3(toBuilding.gridX, 0.1, toBuilding.gridY);

  // Direction and perpendicular for rail offset
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const offset = 0.15;

  // Two parallel rail lines
  const rail1Points: [number, number, number][] = [
    [from.x + perp.x * offset, 0.1, from.z + perp.z * offset],
    [to.x + perp.x * offset, 0.1, to.z + perp.z * offset],
  ];
  const rail2Points: [number, number, number][] = [
    [from.x - perp.x * offset, 0.1, from.z - perp.z * offset],
    [to.x - perp.x * offset, 0.1, to.z - perp.z * offset],
  ];

  // Arrow markers along the belt
  const arrowCount = 3;
  const arrowPositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    for (let i = 1; i <= arrowCount; i++) {
      const t = i / (arrowCount + 1);
      positions.push(new THREE.Vector3().lerpVectors(from, to, t));
    }
    return positions;
  }, [from.x, from.z, to.x, to.z]);

  // Arrow rotation to point in flow direction
  const arrowRotationY = useMemo(() => {
    return Math.atan2(dir.x, dir.z);
  }, [dir.x, dir.z]);

  const beltColor = belt.active ? belt.color : "#333333";
  const opacity = belt.active ? 0.6 : 0.15;

  // Animate dash offset for flow
  useFrame((_, delta) => {
    if (!belt.active) return;
    dashOffsetRef.current -= delta * 2;
    if (line1Ref.current?.material) {
      line1Ref.current.material.dashOffset = dashOffsetRef.current;
    }
    if (line2Ref.current?.material) {
      line2Ref.current.material.dashOffset = dashOffsetRef.current;
    }
  });

  return (
    <group>
      {/* Rail 1 */}
      <Line
        ref={line1Ref}
        points={rail1Points}
        color={beltColor}
        lineWidth={1.5}
        dashed
        dashSize={0.3}
        gapSize={0.15}
        transparent
        opacity={opacity}
      />

      {/* Rail 2 */}
      <Line
        ref={line2Ref}
        points={rail2Points}
        color={beltColor}
        lineWidth={1.5}
        dashed
        dashSize={0.3}
        gapSize={0.15}
        transparent
        opacity={opacity}
      />

      {/* Directional arrow markers */}
      {belt.active &&
        arrowPositions.map((pos, i) => (
          <mesh
            key={i}
            position={[pos.x, 0.12, pos.z]}
            rotation={[-Math.PI / 2, 0, -arrowRotationY]}
          >
            <coneGeometry args={[0.08, 0.2, 3]} />
            <meshStandardMaterial
              color={beltColor}
              emissive={beltColor}
              emissiveIntensity={0.4}
              transparent
              opacity={0.5}
            />
          </mesh>
        ))}
    </group>
  );
}
