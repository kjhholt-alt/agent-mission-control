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

    // Storage crates
    const crates: { x: number; z: number; scale: number; rotation: number }[] = [];
    for (let i = 0; i < 25; i++) {
      const x = -2 + rand() * 18;
      const z = -2 + rand() * 16;
      if (isValidPos(x, z)) {
        crates.push({
          x,
          z,
          scale: 0.15 + rand() * 0.2,
          rotation: rand() * Math.PI * 2,
        });
      }
    }

    // Barrels near industrial buildings
    const barrels: { x: number; z: number; scale: number }[] = [];
    for (let i = 0; i < 18; i++) {
      const x = -1 + rand() * 16;
      const z = -1 + rand() * 15;
      if (isValidPos(x, z)) {
        barrels.push({
          x,
          z,
          scale: 0.12 + rand() * 0.08,
        });
      }
    }

    // Power poles
    const poles: { x: number; z: number }[] = [];
    // Place poles along two paths
    for (let i = 0; i < 5; i++) {
      const x = 1 + i * 3;
      const z = -0.5;
      if (isValidPos(x, z)) poles.push({ x, z });
    }
    for (let i = 0; i < 4; i++) {
      const x = 14;
      const z = 1 + i * 3;
      if (isValidPos(x, z)) poles.push({ x, z });
    }

    // Small vehicles/carts
    const carts: { x: number; z: number; rotation: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const x = 1 + rand() * 12;
      const z = 1 + rand() * 12;
      if (isValidPos(x, z)) {
        carts.push({ x, z, rotation: rand() * Math.PI * 2 });
      }
    }

    return { crates, barrels, poles, carts };
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
    </group>
  );
}
