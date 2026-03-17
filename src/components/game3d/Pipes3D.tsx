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
 * Industrial pipes connecting buildings -- flanged joints, animated glowing fluid,
 * detailed junction boxes with indicator LEDs, valve wheels on long runs.
 */
export function Pipes3D() {
  const flowRef = useRef<THREE.Group>(null);
  const junctionLedRef = useRef<THREE.Group>(null);

  // Define pipe connections between buildings
  const pipes = useMemo((): PipeSegment[] => {
    const getBuildingPos = (id: string) => {
      const b = BUILDINGS.find((b) => b.id === id);
      return b ? new THREE.Vector3(b.gridX, 0.5, b.gridY) : new THREE.Vector3(0, 0.5, 0);
    };

    const segments: PipeSegment[] = [];

    // Pipe from command-center to outdoor-crm via junction
    const cmdPos = getBuildingPos("command-center");
    const ocrPos = getBuildingPos("outdoor-crm");
    const junction1 = new THREE.Vector3(cmdPos.x - 5, 0.5, cmdPos.z);
    const junction1b = new THREE.Vector3(ocrPos.x, 0.5, cmdPos.z);
    segments.push({ from: cmdPos, to: junction1, hasFlow: true });
    segments.push({ from: junction1, to: junction1b, hasFlow: true });
    segments.push({ from: junction1b, to: ocrPos, hasFlow: true });

    // Pipe from barrelhouse to pl-engine
    const bhPos = getBuildingPos("barrelhouse");
    const plePos = getBuildingPos("pl-engine");
    const junction2a = new THREE.Vector3(bhPos.x, 0.5, 10);
    const junction2b = new THREE.Vector3(15, 0.5, 10);
    const junction2c = new THREE.Vector3(15, 0.5, plePos.z);
    segments.push({ from: bhPos, to: junction2a, hasFlow: false });
    segments.push({ from: junction2a, to: junction2b, hasFlow: false });
    segments.push({ from: junction2b, to: junction2c, hasFlow: false });
    segments.push({ from: junction2c, to: plePos, hasFlow: false });

    // Pipe from automation-hub to mcp-array
    const n8nPos = getBuildingPos("automation-hub");
    const mcpPos = getBuildingPos("mcp-array");
    const junction3a = new THREE.Vector3(n8nPos.x, 0.5, mcpPos.z);
    segments.push({ from: n8nPos, to: junction3a, hasFlow: true });
    segments.push({ from: junction3a, to: mcpPos, hasFlow: true });

    // Pipe from chess-academy to email-finder
    const chePos = getBuildingPos("chess-academy");
    const emlPos = getBuildingPos("email-finder");
    const junction4 = new THREE.Vector3(chePos.x, 0.5, 18);
    const junction4b = new THREE.Vector3(emlPos.x, 0.5, 18);
    segments.push({ from: chePos, to: junction4, hasFlow: false });
    segments.push({ from: junction4, to: junction4b, hasFlow: false });
    segments.push({ from: junction4b, to: emlPos, hasFlow: false });

    // Pipe from nexus-hq to pc-bottleneck
    const nxsPos = getBuildingPos("nexus-hq");
    const pcbPos = getBuildingPos("pc-bottleneck");
    segments.push({ from: nxsPos, to: pcbPos, hasFlow: true });

    // Pipe from nexus-hq to pl-engine
    segments.push({ from: nxsPos, to: plePos, hasFlow: false });

    // Pipe from finance-tower to email-finder
    const finPos = getBuildingPos("finance-brief");
    const junction5 = new THREE.Vector3(finPos.x, 0.5, emlPos.z);
    segments.push({ from: finPos, to: junction5, hasFlow: true });
    segments.push({ from: junction5, to: emlPos, hasFlow: true });

    return segments;
  }, []);

  // Collect junction points (where pipes share endpoints)
  const junctions = useMemo(() => {
    const pointMap = new Map<string, THREE.Vector3>();
    const countMap = new Map<string, number>();
    const flowMap = new Map<string, boolean>();

    pipes.forEach((pipe) => {
      for (const p of [pipe.from, pipe.to]) {
        const key = `${p.x.toFixed(1)}_${p.z.toFixed(1)}`;
        pointMap.set(key, p);
        countMap.set(key, (countMap.get(key) || 0) + 1);
        if (pipe.hasFlow) flowMap.set(key, true);
      }
    });

    const result: { pos: THREE.Vector3; hasFlow: boolean }[] = [];
    countMap.forEach((count, key) => {
      if (count >= 2) {
        const p = pointMap.get(key)!;
        const isBuilding = BUILDINGS.some(
          (b) => Math.abs(b.gridX - p.x) < 0.1 && Math.abs(b.gridY - p.z) < 0.1
        );
        if (!isBuilding) {
          result.push({ pos: p, hasFlow: flowMap.get(key) || false });
        }
      }
    });
    return result;
  }, [pipes]);

  // Identify long pipe segments for valve placement (length > 4)
  const valvePositions = useMemo(() => {
    const valves: { pos: THREE.Vector3; rotY: number }[] = [];
    pipes.forEach((pipe) => {
      const dir = new THREE.Vector3().subVectors(pipe.to, pipe.from);
      const len = dir.length();
      if (len > 4) {
        const mid = new THREE.Vector3().addVectors(pipe.from, pipe.to).multiplyScalar(0.5);
        const rotY = Math.atan2(dir.x, dir.z);
        valves.push({ pos: mid, rotY });
      }
    });
    return valves;
  }, [pipes]);

  // Animate flow indicators and junction LEDs
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Animated flow sections -- pulse emissive
    if (flowRef.current) {
      flowRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.emissiveIntensity = 0.5 + Math.sin(t * 3 + i * 1.5) * 0.4;
          // Move flow section along pipe axis
          if (mat.map) {
            mat.map.offset.x = -t * 0.5;
          }
        }
      });
    }

    // Blink junction LEDs
    if (junctionLedRef.current) {
      junctionLedRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          const blink = Math.sin(t * 2.5 + i * 1.8) > 0.3;
          mat.emissiveIntensity = blink ? 1.5 : 0.3;
        }
      });
    }
  });

  return (
    <group>
      {/* Pipe segments with flanges */}
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
                color={pipe.hasFlow ? "#3a3c48" : "#2a2c35"}
                metalness={0.8}
                roughness={0.35}
              />
            </mesh>

            {/* Flanges at each end of segment */}
            <mesh
              position={[pipe.from.x, 0.5, pipe.from.z]}
              rotation={[Math.PI / 2, 0, rotationY]}
            >
              <cylinderGeometry args={[0.09, 0.09, 0.04, 8]} />
              <meshStandardMaterial
                color="#4a4c58"
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>
            <mesh
              position={[pipe.to.x, 0.5, pipe.to.z]}
              rotation={[Math.PI / 2, 0, rotationY]}
            >
              <cylinderGeometry args={[0.09, 0.09, 0.04, 8]} />
              <meshStandardMaterial
                color="#4a4c58"
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>

            {/* Flange bolts -- 4 small dots on each flange */}
            {[pipe.from, pipe.to].map((flangePos, fi) => {
              const offsets = [
                [0.07, 0.01],
                [-0.07, 0.01],
                [0.01, 0.07],
                [0.01, -0.07],
              ];
              return offsets.map((off, bi) => (
                <mesh
                  key={`bolt-${fi}-${bi}`}
                  position={[
                    flangePos.x + (Math.cos(rotationY) * off[0] - Math.sin(rotationY) * off[1]) * 0.6,
                    0.5,
                    flangePos.z + (Math.sin(rotationY) * off[0] + Math.cos(rotationY) * off[1]) * 0.6,
                  ]}
                >
                  <sphereGeometry args={[0.012, 4, 4]} />
                  <meshStandardMaterial
                    color="#6a6c78"
                    metalness={0.9}
                    roughness={0.2}
                  />
                </mesh>
              ));
            })}

            {/* Rust accents on longer pipes */}
            {length > 2 && (
              <mesh
                position={[mid.x, 0.5, mid.z]}
                rotation={[Math.PI / 2, 0, rotationY]}
              >
                <cylinderGeometry args={[0.075, 0.075, length * 0.12, 8]} />
                <meshStandardMaterial
                  color="#5a3c28"
                  metalness={0.6}
                  roughness={0.6}
                />
              </mesh>
            )}

            {/* Pipe support clamps every ~3 units */}
            {Array.from({ length: Math.max(0, Math.floor(length / 3)) }).map((_, ci) => {
              const clampT = (ci + 1) / (Math.floor(length / 3) + 1);
              const clampPos = new THREE.Vector3().lerpVectors(pipe.from, pipe.to, clampT);
              return (
                <group key={`clamp-${ci}`}>
                  {/* Clamp ring */}
                  <mesh
                    position={[clampPos.x, 0.5, clampPos.z]}
                    rotation={[Math.PI / 2, 0, rotationY]}
                  >
                    <torusGeometry args={[0.08, 0.015, 4, 8]} />
                    <meshStandardMaterial
                      color="#5a5c68"
                      metalness={0.8}
                      roughness={0.3}
                    />
                  </mesh>
                  {/* Clamp support bracket down to ground */}
                  <mesh position={[clampPos.x, 0.25, clampPos.z]}>
                    <boxGeometry args={[0.03, 0.5, 0.03]} />
                    <meshStandardMaterial
                      color="#3a3c48"
                      metalness={0.7}
                      roughness={0.4}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}

      {/* Junction boxes -- industrial with indicator lights */}
      {junctions.map((junction, i) => (
        <group key={`junction-${i}`} position={[junction.pos.x, 0.5, junction.pos.z]}>
          {/* Main junction box body */}
          <mesh>
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial
              color="#4a4c58"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
          {/* Top plate */}
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[0.24, 0.02, 0.24]} />
            <meshStandardMaterial
              color="#5a5c68"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
          {/* Bottom plate */}
          <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[0.24, 0.02, 0.24]} />
            <meshStandardMaterial
              color="#3a3c48"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
          {/* Corner bolts */}
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dx, dz], bi) => (
            <mesh
              key={`jbolt-${bi}`}
              position={[dx * 0.09, 0.12, dz * 0.09]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.03, 6]} />
              <meshStandardMaterial
                color="#6a6c78"
                metalness={0.9}
                roughness={0.15}
              />
            </mesh>
          ))}
          {/* Side panel lines */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, si) => (
            <mesh
              key={`panel-${si}`}
              position={[
                Math.sin(angle) * 0.115,
                0,
                Math.cos(angle) * 0.115,
              ]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.15, 0.12, 0.005]} />
              <meshStandardMaterial
                color="#3a3c48"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Junction indicator LEDs */}
      <group ref={junctionLedRef}>
        {junctions.map((junction, i) => (
          <mesh
            key={`led-${i}`}
            position={[junction.pos.x + 0.08, 0.62, junction.pos.z + 0.08]}
          >
            <sphereGeometry args={[0.018, 6, 6]} />
            <meshStandardMaterial
              color={junction.hasFlow ? "#10b981" : "#e8a019"}
              emissive={junction.hasFlow ? "#10b981" : "#e8a019"}
              emissiveIntensity={1.0}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Valve wheels on long pipe segments */}
      {valvePositions.map((valve, i) => (
        <group key={`valve-${i}`} position={[valve.pos.x, 0.5, valve.pos.z]}>
          {/* Valve body */}
          <mesh rotation={[Math.PI / 2, 0, valve.rotY]}>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 8]} />
            <meshStandardMaterial
              color="#5a5c68"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
          {/* Valve stem -- vertical */}
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
            <meshStandardMaterial
              color="#6a6c78"
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>
          {/* Valve wheel */}
          <mesh position={[0, 0.22, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.06, 0.012, 4, 8]} />
            <meshStandardMaterial
              color="#ef4444"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
          {/* Wheel spokes */}
          {[0, Math.PI / 3, (Math.PI * 2) / 3].map((angle, si) => (
            <mesh
              key={`spoke-${si}`}
              position={[
                Math.cos(angle) * 0.03,
                0.22,
                Math.sin(angle) * 0.03,
              ]}
              rotation={[Math.PI / 2, 0, angle]}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.12, 4]} />
              <meshStandardMaterial
                color="#ef4444"
                metalness={0.7}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Animated glowing flow sections on active pipes */}
      <group ref={flowRef}>
        {pipes
          .filter((p) => p.hasFlow)
          .map((pipe, i) => {
            const dir = new THREE.Vector3().subVectors(pipe.to, pipe.from);
            const length = dir.length();
            dir.normalize();
            const rotationY = Math.atan2(dir.x, dir.z);

            // Create multiple flow segments that animate along the pipe
            const flowSegments = Math.max(2, Math.floor(length / 2));
            return Array.from({ length: flowSegments }).map((_, si) => {
              const segT = (si + 0.5) / flowSegments;
              const segPos = new THREE.Vector3().lerpVectors(pipe.from, pipe.to, segT);

              return (
                <mesh
                  key={`flow-${i}-${si}`}
                  position={[segPos.x, 0.5, segPos.z]}
                  rotation={[Math.PI / 2, 0, rotationY]}
                >
                  <cylinderGeometry args={[0.04, 0.04, length / flowSegments * 0.6, 8]} />
                  <meshStandardMaterial
                    color="#06b6d4"
                    emissive="#06b6d4"
                    emissiveIntensity={0.8}
                    transparent
                    opacity={0.35}
                    toneMapped={false}
                  />
                </mesh>
              );
            });
          })}
      </group>
    </group>
  );
}
