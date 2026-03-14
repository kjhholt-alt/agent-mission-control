"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDINGS } from "./constants";

interface PipeSegment {
  from: THREE.Vector3;
  to: THREE.Vector3;
  hasFlow: boolean;
}

/**
 * Industrial pipes connecting some buildings — raised off ground,
 * dark gray metallic with subtle rust, junction nodes, flowing liquid sections.
 */
export function Pipes3D() {
  const flowRef = useRef<THREE.Group>(null);

  // Define pipe connections between buildings (different from conveyor belts)
  const pipes = useMemo((): PipeSegment[] => {
    const getBuildingPos = (id: string) => {
      const b = BUILDINGS.find((b) => b.id === id);
      return b ? new THREE.Vector3(b.gridX, 0.5, b.gridY) : new THREE.Vector3(0, 0.5, 0);
    };

    // Pipes go through intermediate junction points for interesting routing
    const segments: PipeSegment[] = [];

    // Pipe from command-center to outdoor-crm via junction
    const cmdPos = getBuildingPos("command-center");
    const ocrPos = getBuildingPos("outdoor-crm");
    const junction1 = new THREE.Vector3(cmdPos.x - 2, 0.5, cmdPos.z);
    segments.push({ from: cmdPos, to: junction1, hasFlow: true });
    segments.push({ from: junction1, to: ocrPos, hasFlow: true });

    // Pipe from barrelhouse to pl-engine
    const bhPos = getBuildingPos("barrelhouse");
    const plePos = getBuildingPos("pl-engine");
    const junction2 = new THREE.Vector3(bhPos.x, 0.5, plePos.z);
    segments.push({ from: bhPos, to: junction2, hasFlow: false });
    segments.push({ from: junction2, to: plePos, hasFlow: false });

    // Pipe from automation-hub to mcp-array
    const n8nPos = getBuildingPos("automation-hub");
    const mcpPos = getBuildingPos("mcp-array");
    const junction3 = new THREE.Vector3(mcpPos.x, 0.5, n8nPos.z);
    segments.push({ from: n8nPos, to: junction3, hasFlow: true });
    segments.push({ from: junction3, to: mcpPos, hasFlow: true });

    // Short pipe from chess-academy to email-finder
    const chePos = getBuildingPos("chess-academy");
    const emlPos = getBuildingPos("email-finder");
    segments.push({ from: chePos, to: emlPos, hasFlow: false });

    return segments;
  }, []);

  // Collect junction points (where pipes share endpoints)
  const junctions = useMemo(() => {
    const pointMap = new Map<string, THREE.Vector3>();
    const countMap = new Map<string, number>();

    pipes.forEach((pipe) => {
      for (const p of [pipe.from, pipe.to]) {
        const key = `${p.x.toFixed(1)}_${p.z.toFixed(1)}`;
        pointMap.set(key, p);
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    });

    // Only show junctions where 2+ pipes meet AND it's not a building position
    const result: THREE.Vector3[] = [];
    countMap.forEach((count, key) => {
      if (count >= 2) {
        const p = pointMap.get(key)!;
        // Check if this is NOT a building position
        const isBuilding = BUILDINGS.some(
          (b) => Math.abs(b.gridX - p.x) < 0.1 && Math.abs(b.gridY - p.z) < 0.1
        );
        if (!isBuilding) {
          result.push(p);
        }
      }
    });
    return result;
  }, [pipes]);

  // Animate flow indicators
  useFrame(({ clock }) => {
    if (!flowRef.current) return;
    const t = clock.getElapsedTime();

    flowRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.5 + Math.sin(t * 3 + i * 1.5) * 0.4;
      }
    });
  });

  return (
    <group>
      {/* Pipe segments */}
      {pipes.map((pipe, i) => {
        const dir = new THREE.Vector3().subVectors(pipe.to, pipe.from);
        const length = dir.length();
        dir.normalize();

        const mid = new THREE.Vector3().addVectors(pipe.from, pipe.to).multiplyScalar(0.5);
        const rotationY = Math.atan2(dir.x, dir.z);

        return (
          <group key={`pipe-${i}`}>
            {/* Main pipe body */}
            <mesh
              position={[mid.x, 0.5, mid.z]}
              rotation={[Math.PI / 2, 0, rotationY]}
            >
              <cylinderGeometry args={[0.06, 0.06, length, 8]} />
              <meshStandardMaterial
                color="#3a3c48"
                metalness={0.8}
                roughness={0.35}
              />
            </mesh>

            {/* Rust accents — slightly larger diameter sections */}
            {length > 2 && (
              <mesh
                position={[mid.x, 0.5, mid.z]}
                rotation={[Math.PI / 2, 0, rotationY]}
              >
                <cylinderGeometry args={[0.075, 0.075, length * 0.15, 8]} />
                <meshStandardMaterial
                  color="#5a3c28"
                  metalness={0.6}
                  roughness={0.6}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Junction nodes */}
      {junctions.map((pos, i) => (
        <mesh key={`junction-${i}`} position={[pos.x, 0.5, pos.z]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial
            color="#4a4c58"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Glowing flow sections on active pipes */}
      <group ref={flowRef}>
        {pipes
          .filter((p) => p.hasFlow)
          .map((pipe, i) => {
            const mid = new THREE.Vector3().addVectors(pipe.from, pipe.to).multiplyScalar(0.5);
            const dir = new THREE.Vector3().subVectors(pipe.to, pipe.from);
            const length = dir.length();
            dir.normalize();
            const rotationY = Math.atan2(dir.x, dir.z);

            return (
              <mesh
                key={`flow-${i}`}
                position={[mid.x, 0.5, mid.z]}
                rotation={[Math.PI / 2, 0, rotationY]}
              >
                <cylinderGeometry args={[0.04, 0.04, length * 0.3, 8]} />
                <meshStandardMaterial
                  color="#06b6d4"
                  emissive="#06b6d4"
                  emissiveIntensity={0.8}
                  transparent
                  opacity={0.4}
                />
              </mesh>
            );
          })}
      </group>
    </group>
  );
}
