"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { BUILDINGS } from "./constants";

/**
 * Static decorative environmental objects scattered around the factory floor:
 * storage crates, barrels, power poles. Industrial atmosphere.
 */
export function Environment3D() {
  // Deterministic pseudo-random placement
  const decorations = useMemo(() => {
    let seed = 123;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Build exclusion zones around buildings (avoid placing stuff on top)
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

    // Storage crates — scattered across all zones
    const crates: { x: number; z: number; scale: number; rotation: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const x = -2 + rand() * 34;
      const z = -2 + rand() * 34;
      if (isValidPos(x, z)) {
        crates.push({
          x,
          z,
          scale: 0.15 + rand() * 0.25,
          rotation: rand() * Math.PI * 2,
        });
      }
    }

    // Barrels — clusters near each zone
    const barrels: { x: number; z: number; scale: number }[] = [];
    for (let i = 0; i < 45; i++) {
      const x = -1 + rand() * 32;
      const z = -1 + rand() * 32;
      if (isValidPos(x, z)) {
        barrels.push({
          x,
          z,
          scale: 0.12 + rand() * 0.1,
        });
      }
    }

    // Power poles — along major conveyor routes
    const poles: { x: number; z: number }[] = [];
    // North row (along production zone)
    for (let i = 0; i < 8; i++) {
      const x = 2 + i * 3.5;
      const z = 1;
      if (isValidPos(x, z)) poles.push({ x, z });
    }
    // East column (services zone)
    for (let i = 0; i < 6; i++) {
      const x = 29;
      const z = 5 + i * 4;
      if (isValidPos(x, z)) poles.push({ x, z });
    }
    // South row (labs zone)
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 4;
      const z = 29;
      if (isValidPos(x, z)) poles.push({ x, z });
    }
    // West column (research zone)
    for (let i = 0; i < 5; i++) {
      const x = 0.5;
      const z = 8 + i * 3.5;
      if (isValidPos(x, z)) poles.push({ x, z });
    }
    // Center cross paths
    for (let i = 0; i < 5; i++) {
      const x = 15;
      const z = 6 + i * 4;
      if (isValidPos(x, z)) poles.push({ x, z });
    }

    // Small vehicles/carts
    const carts: { x: number; z: number; rotation: number }[] = [];
    for (let i = 0; i < 15; i++) {
      const x = 1 + rand() * 28;
      const z = 1 + rand() * 28;
      if (isValidPos(x, z)) {
        carts.push({ x, z, rotation: rand() * Math.PI * 2 });
      }
    }

    // Guard posts / relay stations between zones
    const allStructures: { x: number; z: number; type: "guard" | "relay" | "shed" }[] = [
      // Between north and center
      { x: 15, z: 8, type: "relay" as const },
      // Between center and east
      { x: 22, z: 15, type: "guard" as const },
      // Between center and south
      { x: 15, z: 22, type: "relay" as const },
      // Between center and west
      { x: 8, z: 15, type: "guard" as const },
      // Corners
      { x: 5, z: 5, type: "shed" as const },
      { x: 25, z: 5, type: "shed" as const },
      { x: 5, z: 25, type: "shed" as const },
      { x: 25, z: 25, type: "shed" as const },
    ];
    const structures = allStructures.filter(s => isValidPos(s.x, s.z));

    return { crates, barrels, poles, carts, structures };
  }, []);

  return (
    <group>
      {/* Storage crates */}
      {decorations.crates.map((crate, i) => (
        <mesh
          key={`crate-${i}`}
          position={[crate.x, crate.scale / 2, crate.z]}
          rotation={[0, crate.rotation, 0]}
          castShadow
        >
          <boxGeometry args={[crate.scale, crate.scale, crate.scale]} />
          <meshStandardMaterial
            color="#5c4a32"
            metalness={0.2}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* Barrels */}
      {decorations.barrels.map((barrel, i) => (
        <group key={`barrel-${i}`} position={[barrel.x, barrel.scale * 1.2, barrel.z]}>
          <mesh castShadow>
            <cylinderGeometry args={[barrel.scale, barrel.scale, barrel.scale * 2.4, 8]} />
            <meshStandardMaterial
              color="#4a4a55"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          {/* Barrel band */}
          <mesh position={[0, barrel.scale * 0.4, 0]}>
            <cylinderGeometry args={[barrel.scale + 0.01, barrel.scale + 0.01, barrel.scale * 0.15, 8]} />
            <meshStandardMaterial
              color="#6a5a3a"
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[0, -barrel.scale * 0.4, 0]}>
            <cylinderGeometry args={[barrel.scale + 0.01, barrel.scale + 0.01, barrel.scale * 0.15, 8]} />
            <meshStandardMaterial
              color="#6a5a3a"
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
        </group>
      ))}

      {/* Power poles */}
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
          {/* Cross arm */}
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[0.6, 0.04, 0.04]} />
            <meshStandardMaterial
              color="#5a5c68"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          {/* Insulators */}
          <mesh position={[-0.25, 1.85, 0]}>
            <cylinderGeometry args={[0.02, 0.03, 0.08, 6]} />
            <meshStandardMaterial
              color="#3a8a9a"
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
          <mesh position={[0.25, 1.85, 0]}>
            <cylinderGeometry args={[0.02, 0.03, 0.08, 6]} />
            <meshStandardMaterial
              color="#3a8a9a"
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
          {/* Light on top */}
          <mesh position={[0, 2.05, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#f59e0b"
              emissiveIntensity={1}
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

      {/* Small carts/vehicles */}
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
          {/* Wheels */}
          {[
            [-0.12, -0.05, 0.1],
            [-0.12, -0.05, -0.1],
            [0.12, -0.05, 0.1],
            [0.12, -0.05, -0.1],
          ].map((pos, j) => (
            <mesh
              key={`wheel-${j}`}
              position={pos as [number, number, number]}
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
        </group>
      ))}

      {/* Guard posts, relay stations, storage sheds between zones */}
      {decorations.structures.map((structure, i) => (
        <group key={`structure-${i}`} position={[structure.x, 0, structure.z]}>
          {structure.type === "guard" && (
            <>
              {/* Guard post — small booth with light */}
              <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[0.5, 0.7, 0.5]} />
                <meshStandardMaterial color="#2a2c38" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.75, 0]}>
                <boxGeometry args={[0.55, 0.08, 0.55]} />
                <meshStandardMaterial color="#3a3c48" metalness={0.6} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.85, 0]}>
                <sphereGeometry args={[0.06, 6, 6]} />
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
              </mesh>
              <pointLight position={[0, 0.85, 0]} color="#ef4444" intensity={0.2} distance={3} decay={2} />
            </>
          )}
          {structure.type === "relay" && (
            <>
              {/* Relay station — antenna mast with dish */}
              <mesh position={[0, 0.8, 0]} castShadow>
                <cylinderGeometry args={[0.04, 0.06, 1.6, 6]} />
                <meshStandardMaterial color="#5a5c68" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0.15, 1.4, 0]} rotation={[0, 0, Math.PI / 6]}>
                <coneGeometry args={[0.2, 0.15, 8, 1, true]} />
                <meshStandardMaterial color="#4a4c58" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 1.65, 0]}>
                <sphereGeometry args={[0.04, 6, 6]} />
                <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.2} />
              </mesh>
              <pointLight position={[0, 1.65, 0]} color="#06b6d4" intensity={0.15} distance={2.5} decay={2} />
            </>
          )}
          {structure.type === "shed" && (
            <>
              {/* Storage shed — low flat building */}
              <mesh position={[0, 0.2, 0]} castShadow>
                <boxGeometry args={[0.7, 0.4, 0.5]} />
                <meshStandardMaterial color="#3a3228" metalness={0.4} roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.42, 0]}>
                <boxGeometry args={[0.75, 0.05, 0.55]} />
                <meshStandardMaterial color="#4a4238" metalness={0.5} roughness={0.5} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}
