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
const PACKET_SIZE = 0.15;
const BELT_Y = 0.3;

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();

/**
 * Data packets flowing along conveyor belts using InstancedMesh for performance.
 * Each packet lerps along its belt, spinning slowly. Color matches data type.
 * Packets are big enough to see at default zoom and ride on top of the belts.
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
        ? new THREE.Vector3(fromB.gridX, BELT_Y + 0.12, fromB.gridY)
        : new THREE.Vector3(0, BELT_Y + 0.12, 0);
      const to = toB
        ? new THREE.Vector3(toB.gridX, BELT_Y + 0.12, toB.gridY)
        : new THREE.Vector3(0, BELT_Y + 0.12, 0);
      const color = new THREE.Color(
        DATA_TYPE_COLORS[belt.dataType] || "#ffffff"
      );
      return { from, to, color, speed: 0.25 + Math.random() * 0.15 };
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

  const tempScale = useMemo(() => new THREE.Vector3(PACKET_SIZE, PACKET_SIZE, PACKET_SIZE), []);

  useFrame(({ clock }) => {
    if (!meshRef.current || totalInstances === 0) return;

    const t = clock.getElapsedTime();
    let instanceIdx = 0;

    for (let b = 0; b < beltData.length; b++) {
      const { from, to, color, speed } = beltData[b];
      for (let p = 0; p < PACKETS_PER_BELT; p++) {
        const phase = packetPhases[instanceIdx];
        const progress = ((t * speed + phase) % 1.0 + 1.0) % 1.0;

        tempPosition.lerpVectors(from, to, progress);
        // Slight vertical bob
        tempPosition.y += Math.sin(t * 4 + instanceIdx * 1.3) * 0.02;

        // Spin the packet
        tempEuler.set(
          t * 0.8 + instanceIdx * 0.5,
          t * 1.2 + instanceIdx * 0.3,
          0
        );
        tempQuaternion.setFromEuler(tempEuler);

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
      <boxGeometry args={[1, 0.7, 1]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={1.0}
        metalness={0.3}
        roughness={0.3}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
