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

const PACKET_SIZE = 0.18;
const BELT_Y = 0.3;

/** Packet count scales with real throughput. 0 throughput = 0 packets. */
function packetsForThroughput(throughput: number): number {
  if (throughput <= 0) return 0;
  if (throughput <= 2) return 1;
  if (throughput <= 5) return 2;
  if (throughput <= 15) return 3;
  return 4;
}

// Data type -> visual differentiation
const DATA_TYPE_SHAPE_SCALE: Record<string, { scaleX: number; scaleY: number; scaleZ: number }> = {
  code:    { scaleX: 1.0, scaleY: 0.7, scaleZ: 1.0 },    // flat square
  tests:   { scaleX: 0.8, scaleY: 1.2, scaleZ: 0.8 },    // tall diamond
  revenue: { scaleX: 1.2, scaleY: 0.5, scaleZ: 1.2 },    // wide coin
  errors:  { scaleX: 0.6, scaleY: 0.6, scaleZ: 0.6 },    // small cube
  config:  { scaleX: 0.9, scaleY: 0.9, scaleZ: 0.9 },    // even cube
  data:    { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 },    // default cube
  deploy:  { scaleX: 0.7, scaleY: 1.3, scaleZ: 0.7 },    // tall thin
  alerts:  { scaleX: 1.1, scaleY: 0.8, scaleZ: 0.5 },    // flat wide
};

// Glow intensity per data type -- errors and alerts glow more
const DATA_TYPE_GLOW: Record<string, number> = {
  code:    1.2,
  tests:   1.0,
  revenue: 1.5,
  errors:  2.0,
  config:  0.8,
  data:    1.0,
  deploy:  1.3,
  alerts:  1.8,
};

const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();
const tempScale = new THREE.Vector3();

/**
 * Data packets flowing along conveyor belts using InstancedMesh for performance.
 * Each packet lerps along its belt, spinning slowly. Color matches data type.
 * Packets are clearly visible at default zoom with color-coded glow and shape variety.
 */
export function DataPackets({ belts, buildings }: DataPacketsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const trailMeshRef = useRef<THREE.InstancedMesh>(null);

  // Only include belts that are active AND have real throughput
  const activeBelts = useMemo(
    () => belts.filter((b) => b.active && b.throughput > 0),
    [belts]
  );

  // Precompute belt endpoints, colors, and per-belt packet counts
  const beltData = useMemo(() => {
    return activeBelts.map((belt) => {
      const fromB = buildings.find((b) => b.id === belt.fromBuildingId);
      const toB = buildings.find((b) => b.id === belt.toBuildingId);
      const from = fromB
        ? new THREE.Vector3(fromB.gridX, BELT_Y + 0.14, fromB.gridY)
        : new THREE.Vector3(0, BELT_Y + 0.14, 0);
      const to = toB
        ? new THREE.Vector3(toB.gridX, BELT_Y + 0.14, toB.gridY)
        : new THREE.Vector3(0, BELT_Y + 0.14, 0);
      const color = new THREE.Color(
        DATA_TYPE_COLORS[belt.dataType] || "#ffffff"
      );
      const trailColor = new THREE.Color(
        DATA_TYPE_COLORS[belt.dataType] || "#ffffff"
      ).multiplyScalar(0.5);
      const shapeScale = DATA_TYPE_SHAPE_SCALE[belt.dataType] || DATA_TYPE_SHAPE_SCALE.data;
      const glowIntensity = DATA_TYPE_GLOW[belt.dataType] || 1.0;
      const packetCount = packetsForThroughput(belt.throughput);
      return { from, to, color, trailColor, shapeScale, glowIntensity, speed: 0.25 + Math.random() * 0.15, packetCount, dataType: belt.dataType };
    });
  }, [activeBelts, buildings]);

  const totalInstances = useMemo(
    () => beltData.reduce((sum, d) => sum + d.packetCount, 0),
    [beltData]
  );

  // Trail count: 2 trail segments per packet
  const totalTrails = totalInstances * 2;

  // Per-packet phase offsets for staggering
  const packetPhases = useMemo(() => {
    const phases: number[] = [];
    for (let b = 0; b < beltData.length; b++) {
      const count = beltData[b].packetCount;
      for (let p = 0; p < count; p++) {
        phases.push(count > 1 ? p / count : 0);
      }
    }
    return phases;
  }, [beltData]);

  useFrame(({ clock }) => {
    if (!meshRef.current || totalInstances === 0) return;

    const t = clock.getElapsedTime();
    let instanceIdx = 0;

    for (let b = 0; b < beltData.length; b++) {
      const { from, to, color, trailColor, shapeScale, speed, packetCount } = beltData[b];
      for (let p = 0; p < packetCount; p++) {
        const phase = packetPhases[instanceIdx];
        const progress = ((t * speed + phase) % 1.0 + 1.0) % 1.0;

        tempPosition.lerpVectors(from, to, progress);
        // Slight vertical bob
        tempPosition.y += Math.sin(t * 4 + instanceIdx * 1.3) * 0.025;

        // Spin the packet
        tempEuler.set(
          t * 0.8 + instanceIdx * 0.5,
          t * 1.2 + instanceIdx * 0.3,
          0
        );
        tempQuaternion.setFromEuler(tempEuler);

        // Apply shape scale variation per data type
        tempScale.set(
          PACKET_SIZE * shapeScale.scaleX,
          PACKET_SIZE * shapeScale.scaleY,
          PACKET_SIZE * shapeScale.scaleZ
        );

        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        meshRef.current.setMatrixAt(instanceIdx, tempMatrix);
        meshRef.current.setColorAt(instanceIdx, color);

        // Trail segments
        if (trailMeshRef.current) {
          for (let trail = 0; trail < 2; trail++) {
            const trailIdx = instanceIdx * 2 + trail;
            const trailOffset = (trail + 1) * 0.025;
            const trailProgress = ((t * speed + phase - trailOffset) % 1.0 + 1.0) % 1.0;

            tempPosition.lerpVectors(from, to, trailProgress);
            tempPosition.y += Math.sin(t * 4 + instanceIdx * 1.3) * 0.02;

            const trailScale = PACKET_SIZE * 0.5 * (1 - trail * 0.3);
            tempScale.set(trailScale, trailScale, trailScale);

            tempQuaternion.setFromEuler(tempEuler);
            tempMatrix.compose(tempPosition, tempQuaternion, tempScale);

            if (trailIdx < totalTrails) {
              trailMeshRef.current.setMatrixAt(trailIdx, tempMatrix);
              trailMeshRef.current.setColorAt(trailIdx, trailColor);
            }
          }
        }

        instanceIdx++;
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    if (trailMeshRef.current && totalTrails > 0) {
      trailMeshRef.current.instanceMatrix.needsUpdate = true;
      if (trailMeshRef.current.instanceColor) {
        trailMeshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  if (totalInstances === 0) return null;

  return (
    <group>
      {/* Main packets -- brighter, larger, clearly visible */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, totalInstances]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          emissive="#ffffff"
          emissiveIntensity={1.5}
          metalness={0.3}
          roughness={0.2}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Trail segments -- smaller, dimmer, fading glow behind packets */}
      {totalTrails > 0 && (
        <instancedMesh
          ref={trailMeshRef}
          args={[undefined, undefined, totalTrails]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            emissive="#ffffff"
            emissiveIntensity={0.8}
            metalness={0.2}
            roughness={0.4}
            transparent
            opacity={0.4}
            toneMapped={false}
          />
        </instancedMesh>
      )}
    </group>
  );
}
