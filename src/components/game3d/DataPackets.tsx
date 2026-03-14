"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ConveyorBelt, Building } from "./types";
import { DATA_TYPE_COLORS } from "./constants";

interface DataPacketsProps {
  belts: ConveyorBelt[];
  buildings: Building[];
}

const PACKETS_PER_BELT = 4;
const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempScale = new THREE.Vector3(1, 1, 1);
const tempQuaternion = new THREE.Quaternion();

/**
 * Data packets flowing along conveyor belts using InstancedMesh for performance.
 * Each packet lerps along its belt path. Color matches data type.
 */
export function DataPackets({ belts, buildings }: DataPacketsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const activeBelts = useMemo(() => belts.filter((b) => b.active), [belts]);
  const totalInstances = activeBelts.length * PACKETS_PER_BELT;

  // Precompute belt endpoints and colors
  const beltData = useMemo(() => {
    return activeBelts.map((belt) => {
      const fromB = buildings.find((b) => b.id === belt.fromBuildingId);
      const toB = buildings.find((b) => b.id === belt.toBuildingId);
      const from = fromB
        ? new THREE.Vector3(fromB.gridX, 0.25, fromB.gridY)
        : new THREE.Vector3(0, 0.25, 0);
      const to = toB
        ? new THREE.Vector3(toB.gridX, 0.25, toB.gridY)
        : new THREE.Vector3(0, 0.25, 0);
      const color = new THREE.Color(
        DATA_TYPE_COLORS[belt.dataType] || "#ffffff"
      );
      return { from, to, color, speed: 0.3 + Math.random() * 0.2 };
    });
  }, [activeBelts, buildings]);

  // Per-packet phase offsets for staggering
  const packetPhases = useMemo(() => {
    const phases: number[] = [];
    for (let b = 0; b < activeBelts.length; b++) {
      for (let p = 0; p < PACKETS_PER_BELT; p++) {
        phases.push(p / PACKETS_PER_BELT);
      }
    }
    return phases;
  }, [activeBelts.length]);

  // Set initial colors on InstancedMesh
  useFrame(({ clock }) => {
    if (!meshRef.current || totalInstances === 0) return;

    const t = clock.getElapsedTime();
    let instanceIdx = 0;

    for (let b = 0; b < beltData.length; b++) {
      const { from, to, color, speed } = beltData[b];
      for (let p = 0; p < PACKETS_PER_BELT; p++) {
        const phase = packetPhases[instanceIdx];
        // Progress along belt, wrapping around
        const progress = ((t * speed + phase) % 1.0 + 1.0) % 1.0;

        tempPosition.lerpVectors(from, to, progress);
        // Slight vertical bob
        tempPosition.y += Math.sin(t * 6 + instanceIdx) * 0.03;

        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        meshRef.current.setMatrixAt(instanceIdx, tempMatrix);
        meshRef.current.setColorAt(instanceIdx, color);

        instanceIdx++;
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (totalInstances === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, totalInstances]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={0.8}
        metalness={0.3}
        roughness={0.4}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
