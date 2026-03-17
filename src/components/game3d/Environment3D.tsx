"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDINGS } from "./constants";

/**
 * Static + animated decorative environmental objects scattered around the factory floor:
 * detailed crates, hazard barrels, power poles with wires, carts with headlights,
 * guard posts with rotating warning lights, relay stations with LED arrays.
 */
export function Environment3D() {
  const warningLightsRef = useRef<THREE.Group>(null);
  const relayLedsRef = useRef<THREE.Group>(null);

  // Deterministic pseudo-random placement
  const decorations = useMemo(() => {
    let seed = 123;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Build exclusion zones around buildings
    const exclusionZones = BUILDINGS.map((b) => ({
      x: b.gridX,
      z: b.gridY,
      radius: b.size * 1.2,
    }));

    const isValidPos = (x: number, z: number): boolean => {
      return !exclusionZones.some(
        (zone) => Math.abs(x - zone.x) < zone.radius && Math.abs(z - zone.z) < zone.radius
      );
    };

    // Label colors for crates
    const labelColors = ["#06b6d4", "#10b981", "#e8a019", "#ef4444", "#a855f7", "#3b82f6"];

    // Storage crates
    const crates: { x: number; z: number; scale: number; rotation: number; hasLabel: boolean; labelColor: string }[] = [];
    for (let i = 0; i < 60; i++) {
      const x = -2 + rand() * 34;
      const z = -2 + rand() * 34;
      if (isValidPos(x, z)) {
        crates.push({
          x,
          z,
          scale: 0.15 + rand() * 0.25,
          rotation: rand() * Math.PI * 2,
          hasLabel: rand() > 0.5,
          labelColor: labelColors[Math.floor(rand() * labelColors.length)],
        });
      }
    }

    // Barrels with hazard/glow variants
    const barrels: { x: number; z: number; scale: number; variant: "normal" | "hazard" | "glowing" }[] = [];
    for (let i = 0; i < 45; i++) {
      const x = -1 + rand() * 32;
      const z = -1 + rand() * 32;
      if (isValidPos(x, z)) {
        const v = rand();
        const variant = v > 0.75 ? "hazard" : v > 0.55 ? "glowing" : "normal";
        barrels.push({
          x,
          z,
          scale: 0.12 + rand() * 0.1,
          variant,
        });
      }
    }

    // Power poles
    const poles: { x: number; z: number; idx: number }[] = [];
    let poleIdx = 0;
    // North row
    for (let i = 0; i < 8; i++) {
      const x = 2 + i * 3.5;
      const z = 1;
      if (isValidPos(x, z)) { poles.push({ x, z, idx: poleIdx }); poleIdx++; }
    }
    // East column
    for (let i = 0; i < 6; i++) {
      const x = 29;
      const z = 5 + i * 4;
      if (isValidPos(x, z)) { poles.push({ x, z, idx: poleIdx }); poleIdx++; }
    }
    // South row
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 4;
      const z = 29;
      if (isValidPos(x, z)) { poles.push({ x, z, idx: poleIdx }); poleIdx++; }
    }
    // West column
    for (let i = 0; i < 5; i++) {
      const x = 0.5;
      const z = 8 + i * 3.5;
      if (isValidPos(x, z)) { poles.push({ x, z, idx: poleIdx }); poleIdx++; }
    }
    // Center cross paths
    for (let i = 0; i < 5; i++) {
      const x = 15;
      const z = 6 + i * 4;
      if (isValidPos(x, z)) { poles.push({ x, z, idx: poleIdx }); poleIdx++; }
    }

    // Build pole adjacency for wire connections
    const poleWires: { from: { x: number; z: number }; to: { x: number; z: number } }[] = [];
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i];
      const b = poles[i + 1];
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Only connect if close enough (same row/column)
      if (dist < 6) {
        poleWires.push({ from: a, to: b });
      }
    }

    // Small vehicles/carts
    const carts: { x: number; z: number; rotation: number; hasHeadlights: boolean }[] = [];
    for (let i = 0; i < 15; i++) {
      const x = 1 + rand() * 28;
      const z = 1 + rand() * 28;
      if (isValidPos(x, z)) {
        carts.push({ x, z, rotation: rand() * Math.PI * 2, hasHeadlights: rand() > 0.4 });
      }
    }

    // Guard posts, relay stations, storage sheds
    const allStructures: { x: number; z: number; type: "guard" | "relay" | "shed" }[] = [
      { x: 15, z: 8, type: "relay" as const },
      { x: 22, z: 15, type: "guard" as const },
      { x: 15, z: 22, type: "relay" as const },
      { x: 8, z: 15, type: "guard" as const },
      { x: 5, z: 5, type: "shed" as const },
      { x: 25, z: 5, type: "shed" as const },
      { x: 5, z: 25, type: "shed" as const },
      { x: 25, z: 25, type: "shed" as const },
    ];
    const structures = allStructures.filter(s => isValidPos(s.x, s.z));

    return { crates, barrels, poles, poleWires, carts, structures };
  }, []);

  // Animate warning lights and relay LEDs
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Rotate warning lights on guard posts
    if (warningLightsRef.current) {
      warningLightsRef.current.children.forEach((child) => {
        child.rotation.y = t * 3;
      });
    }

    // Blink relay LED arrays
    if (relayLedsRef.current) {
      relayLedsRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          // Different blink patterns per LED
          const phase = i * 0.7;
          const blink = Math.sin(t * 3 + phase) > 0;
          mat.emissiveIntensity = blink ? 1.5 : 0.2;
        }
      });
    }
  });

  return (
    <group>
      {/* Storage crates with edge highlights and optional labels */}
      {decorations.crates.map((crate, i) => (
        <group
          key={`crate-${i}`}
          position={[crate.x, crate.scale / 2, crate.z]}
          rotation={[0, crate.rotation, 0]}
        >
          {/* Main crate body */}
          <mesh castShadow>
            <boxGeometry args={[crate.scale, crate.scale, crate.scale]} />
            <meshStandardMaterial
              color="#5c4a32"
              metalness={0.2}
              roughness={0.8}
            />
          </mesh>
          {/* Edge highlight -- top frame */}
          <mesh position={[0, crate.scale * 0.48, 0]}>
            <boxGeometry args={[crate.scale + 0.01, crate.scale * 0.04, crate.scale + 0.01]} />
            <meshStandardMaterial
              color="#7a6a52"
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
          {/* Edge highlight -- bottom frame */}
          <mesh position={[0, -crate.scale * 0.48, 0]}>
            <boxGeometry args={[crate.scale + 0.01, crate.scale * 0.04, crate.scale + 0.01]} />
            <meshStandardMaterial
              color="#4a3a22"
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
          {/* Optional colored label on front face */}
          {crate.hasLabel && (
            <mesh position={[0, 0, crate.scale * 0.51]}>
              <boxGeometry args={[crate.scale * 0.5, crate.scale * 0.3, 0.005]} />
              <meshStandardMaterial
                color={crate.labelColor}
                emissive={crate.labelColor}
                emissiveIntensity={0.15}
                metalness={0.1}
                roughness={0.9}
              />
            </mesh>
          )}
        </group>
      ))}

      {/* Barrels with hazard markings and glowing contents */}
      {decorations.barrels.map((barrel, i) => (
        <group key={`barrel-${i}`} position={[barrel.x, barrel.scale * 1.2, barrel.z]}>
          <mesh castShadow>
            <cylinderGeometry args={[barrel.scale, barrel.scale, barrel.scale * 2.4, 8]} />
            <meshStandardMaterial
              color={barrel.variant === "hazard" ? "#5a4a30" : "#4a4a55"}
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          {/* Upper band */}
          <mesh position={[0, barrel.scale * 0.4, 0]}>
            <cylinderGeometry args={[barrel.scale + 0.01, barrel.scale + 0.01, barrel.scale * 0.15, 8]} />
            <meshStandardMaterial
              color={barrel.variant === "hazard" ? "#e8a019" : "#6a5a3a"}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          {/* Lower band */}
          <mesh position={[0, -barrel.scale * 0.4, 0]}>
            <cylinderGeometry args={[barrel.scale + 0.01, barrel.scale + 0.01, barrel.scale * 0.15, 8]} />
            <meshStandardMaterial
              color={barrel.variant === "hazard" ? "#e8a019" : "#6a5a3a"}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          {/* Hazard diamond marking */}
          {barrel.variant === "hazard" && (
            <mesh
              position={[barrel.scale * 0.95, 0, 0]}
              rotation={[0, Math.PI / 2, Math.PI / 4]}
            >
              <planeGeometry args={[barrel.scale * 0.6, barrel.scale * 0.6]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#ef4444"
                emissiveIntensity={0.3}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
          {/* Glowing contents -- emissive top cap */}
          {barrel.variant === "glowing" && (
            <mesh position={[0, barrel.scale * 1.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[barrel.scale * 0.8, 8]} />
              <meshStandardMaterial
                color="#10b981"
                emissive="#10b981"
                emissiveIntensity={1.2}
                transparent
                opacity={0.6}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      ))}

      {/* Power poles with better insulators and top lights */}
      {decorations.poles.map((pole, i) => (
        <group key={`pole-${i}`} position={[pole.x, 0, pole.z]}>
          {/* Main pole */}
          <mesh position={[0, 1.0, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.06, 2.0, 6]} />
            <meshStandardMaterial
              color="#6a6c78"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
          {/* Base plate */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.04, 8]} />
            <meshStandardMaterial
              color="#3a3c48"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          {/* Cross arm */}
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[0.7, 0.05, 0.05]} />
            <meshStandardMaterial
              color="#5a5c68"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          {/* Left insulator -- stacked discs */}
          <group position={[-0.28, 1.85, 0]}>
            <mesh>
              <cylinderGeometry args={[0.025, 0.035, 0.04, 6]} />
              <meshStandardMaterial color="#3a8a9a" metalness={0.3} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.02, 0.028, 0.03, 6]} />
              <meshStandardMaterial color="#4a9aaa" metalness={0.3} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.015, 0.022, 0.02, 6]} />
              <meshStandardMaterial color="#5aabb8" metalness={0.3} roughness={0.6} />
            </mesh>
          </group>
          {/* Right insulator -- stacked discs */}
          <group position={[0.28, 1.85, 0]}>
            <mesh>
              <cylinderGeometry args={[0.025, 0.035, 0.04, 6]} />
              <meshStandardMaterial color="#3a8a9a" metalness={0.3} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.02, 0.028, 0.03, 6]} />
              <meshStandardMaterial color="#4a9aaa" metalness={0.3} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.015, 0.022, 0.02, 6]} />
              <meshStandardMaterial color="#5aabb8" metalness={0.3} roughness={0.6} />
            </mesh>
          </group>
          {/* Light on top */}
          <mesh position={[0, 2.05, 0]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#f59e0b"
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[0, 2.05, 0]}
            color="#f59e0b"
            intensity={0.15}
            distance={2}
            decay={2}
          />
        </group>
      ))}

      {/* Wire connections between adjacent poles */}
      {decorations.poleWires.map((wire, i) => {
        const dx = wire.to.x - wire.from.x;
        const dz = wire.to.z - wire.from.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const midX = (wire.from.x + wire.to.x) / 2;
        const midZ = (wire.from.z + wire.to.z) / 2;
        const rotY = Math.atan2(dx, dz);

        return (
          <group key={`wire-${i}`}>
            {/* Left wire -- slight sag via lower midpoint */}
            <mesh
              position={[
                midX + Math.cos(rotY + Math.PI / 2) * 0.28,
                1.88,
                midZ + Math.sin(rotY + Math.PI / 2) * 0.28,
              ]}
              rotation={[Math.PI / 2, 0, rotY]}
            >
              <cylinderGeometry args={[0.008, 0.008, dist, 4]} />
              <meshStandardMaterial
                color="#2a2c35"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
            {/* Right wire */}
            <mesh
              position={[
                midX - Math.cos(rotY + Math.PI / 2) * 0.28,
                1.88,
                midZ - Math.sin(rotY + Math.PI / 2) * 0.28,
              ]}
              rotation={[Math.PI / 2, 0, rotY]}
            >
              <cylinderGeometry args={[0.008, 0.008, dist, 4]} />
              <meshStandardMaterial
                color="#2a2c35"
                metalness={0.7}
                roughness={0.4}
              />
            </mesh>
          </group>
        );
      })}

      {/* Small carts/vehicles with optional headlights */}
      {decorations.carts.map((cart, i) => (
        <group
          key={`cart-${i}`}
          position={[cart.x, 0.08, cart.z]}
          rotation={[0, cart.rotation, 0]}
        >
          {/* Cart body */}
          <mesh castShadow>
            <boxGeometry args={[0.35, 0.12, 0.2]} />
            <meshStandardMaterial
              color="#3a3c48"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
          {/* Cargo */}
          <mesh position={[0.05, 0.1, 0]}>
            <boxGeometry args={[0.15, 0.1, 0.12]} />
            <meshStandardMaterial
              color="#5c4a32"
              metalness={0.2}
              roughness={0.8}
            />
          </mesh>
          {/* Cab roof */}
          <mesh position={[-0.12, 0.12, 0]}>
            <boxGeometry args={[0.1, 0.06, 0.2]} />
            <meshStandardMaterial
              color="#2a2c35"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          {/* Wheels */}
          {(
            [
              [-0.12, -0.05, 0.1],
              [-0.12, -0.05, -0.1],
              [0.12, -0.05, 0.1],
              [0.12, -0.05, -0.1],
            ] as [number, number, number][]
          ).map((pos, j) => (
            <mesh
              key={`wheel-${j}`}
              position={pos}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
              <meshStandardMaterial
                color="#2a2a35"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          ))}
          {/* Headlights -- small emissive spheres at front */}
          {cart.hasHeadlights && (
            <>
              <mesh position={[0.18, 0.02, 0.07]}>
                <sphereGeometry args={[0.015, 6, 6]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  emissive="#f59e0b"
                  emissiveIntensity={1.5}
                  toneMapped={false}
                />
              </mesh>
              <mesh position={[0.18, 0.02, -0.07]}>
                <sphereGeometry args={[0.015, 6, 6]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  emissive="#f59e0b"
                  emissiveIntensity={1.5}
                  toneMapped={false}
                />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* Guard posts with rotating warning lights */}
      <group ref={warningLightsRef}>
        {decorations.structures
          .filter((s) => s.type === "guard")
          .map((structure, i) => (
            <group key={`warning-light-${i}`} position={[structure.x, 0.88, structure.z]}>
              {/* Rotating arm with light */}
              <mesh position={[0.08, 0, 0]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshStandardMaterial
                  color="#ef4444"
                  emissive="#ef4444"
                  emissiveIntensity={2}
                  toneMapped={false}
                />
              </mesh>
              <mesh position={[-0.08, 0, 0]}>
                <sphereGeometry args={[0.02, 4, 4]} />
                <meshStandardMaterial
                  color="#ef4444"
                  emissive="#ef4444"
                  emissiveIntensity={0.5}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}
      </group>

      {/* Guard post, relay, and shed structures */}
      {decorations.structures.map((structure, i) => (
        <group key={`structure-${i}`} position={[structure.x, 0, structure.z]}>
          {structure.type === "guard" && (
            <>
              {/* Guard post body */}
              <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[0.5, 0.7, 0.5]} />
                <meshStandardMaterial color="#2a2c38" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Roof overhang */}
              <mesh position={[0, 0.75, 0]}>
                <boxGeometry args={[0.6, 0.08, 0.6]} />
                <meshStandardMaterial color="#3a3c48" metalness={0.6} roughness={0.4} />
              </mesh>
              {/* Warning stripe at base */}
              <mesh position={[0, 0.05, 0.26]}>
                <boxGeometry args={[0.48, 0.08, 0.01]} />
                <meshStandardMaterial
                  color="#e8a019"
                  emissive="#e8a019"
                  emissiveIntensity={0.2}
                />
              </mesh>
              {/* Light mount post */}
              <mesh position={[0, 0.82, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.08, 4]} />
                <meshStandardMaterial color="#4a4c58" metalness={0.7} roughness={0.3} />
              </mesh>
              <pointLight position={[0, 0.88, 0]} color="#ef4444" intensity={0.3} distance={3} decay={2} />
            </>
          )}
          {structure.type === "relay" && (
            <>
              {/* Relay station mast */}
              <mesh position={[0, 0.8, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.06, 1.6, 6]} />
                <meshStandardMaterial color="#5a5c68" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Base box */}
              <mesh position={[0, 0.12, 0]}>
                <boxGeometry args={[0.3, 0.24, 0.3]} />
                <meshStandardMaterial color="#2a2c38" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Dish */}
              <mesh position={[0.15, 1.4, 0]} rotation={[0, 0, Math.PI / 6]}>
                <coneGeometry args={[0.2, 0.15, 8, 1, true]} />
                <meshStandardMaterial color="#4a4c58" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
              </mesh>
              {/* Top beacon */}
              <mesh position={[0, 1.65, 0]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.2} toneMapped={false} />
              </mesh>
              <pointLight position={[0, 1.65, 0]} color="#06b6d4" intensity={0.15} distance={2.5} decay={2} />
            </>
          )}
          {structure.type === "shed" && (
            <>
              {/* Storage shed body */}
              <mesh position={[0, 0.2, 0]} castShadow>
                <boxGeometry args={[0.7, 0.4, 0.5]} />
                <meshStandardMaterial color="#3a3228" metalness={0.4} roughness={0.7} />
              </mesh>
              {/* Roof */}
              <mesh position={[0, 0.42, 0]}>
                <boxGeometry args={[0.75, 0.05, 0.55]} />
                <meshStandardMaterial color="#4a4238" metalness={0.5} roughness={0.5} />
              </mesh>
              {/* Door */}
              <mesh position={[0, 0.15, 0.26]}>
                <boxGeometry args={[0.2, 0.28, 0.01]} />
                <meshStandardMaterial color="#2a2218" metalness={0.4} roughness={0.7} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* Relay LED arrays -- positioned near relay structures */}
      <group ref={relayLedsRef}>
        {decorations.structures
          .filter((s) => s.type === "relay")
          .flatMap((structure, si) =>
            Array.from({ length: 6 }).map((_, li) => (
              <mesh
                key={`relay-led-${si}-${li}`}
                position={[
                  structure.x - 0.1 + (li % 3) * 0.1,
                  0.18 + Math.floor(li / 3) * 0.06,
                  structure.z + 0.16,
                ]}
              >
                <boxGeometry args={[0.025, 0.025, 0.005]} />
                <meshStandardMaterial
                  color={li % 2 === 0 ? "#10b981" : "#06b6d4"}
                  emissive={li % 2 === 0 ? "#10b981" : "#06b6d4"}
                  emissiveIntensity={1.0}
                  toneMapped={false}
                />
              </mesh>
            ))
          )}
      </group>
    </group>
  );
}
