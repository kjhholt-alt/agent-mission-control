"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { Building, Worker } from "./types";

// ---- BUILDING SPARKLES -------------------------------------------------------

interface BuildingSparklesProps {
  buildings: Building[];
  isMobile?: boolean;
}

/**
 * Sparkle particles around active buildings. Color-matched, larger, more visible.
 */
export function BuildingSparkles({ buildings, isMobile }: BuildingSparklesProps) {
  const activeBuildings = useMemo(
    () => buildings.filter((b) => b.status === "active"),
    [buildings]
  );

  const sparkleCount = isMobile ? 10 : 20;

  return (
    <>
      {activeBuildings.map((building) => {
        const height = building.size * 1.0;
        return (
          <group key={building.id}>
            {/* Primary sparkles -- larger and color-matched */}
            <Sparkles
              count={sparkleCount}
              size={3.0}
              speed={0.4}
              scale={[building.size * 2.2, height + 1.5, building.size * 2.2]}
              position={[building.gridX, height / 2 + 0.5, building.gridY]}
              color={building.color}
              opacity={0.6}
            />
            {/* Secondary sparkles -- smaller, white, add depth */}
            <Sparkles
              count={Math.floor(sparkleCount * 0.5)}
              size={1.5}
              speed={0.6}
              scale={[building.size * 1.5, height + 0.5, building.size * 1.5]}
              position={[building.gridX, height / 2 + 1.0, building.gridY]}
              color="#ffffff"
              opacity={0.3}
            />
          </group>
        );
      })}
    </>
  );
}

// ---- TASK COMPLETION BURST ---------------------------------------------------

interface BurstParticle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
}

interface CompletionBurstProps {
  workers: Worker[];
  buildings: Building[];
}

// Color palette for burst variety
const BURST_COLORS = [
  "#06b6d4", "#10b981", "#e8a019", "#ef4444", "#a855f7",
  "#3b82f6", "#f97316", "#22c55e", "#8b5cf6", "#f59e0b",
];

/**
 * When a worker completes a task, spawn a burst of 20 particles
 * with color variety, gravity, and size variation.
 */
export function CompletionBursts({ workers, buildings }: CompletionBurstProps) {
  const [bursts, setBursts] = useState<BurstParticle[]>([]);
  const prevProgress = useRef<Record<string, number>>({});
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const idCounter = useRef(0);

  // Detect task completions
  useEffect(() => {
    workers.forEach((w) => {
      const prev = prevProgress.current[w.id];
      if (prev !== undefined && prev > 50 && w.progress < 10) {
        const building = buildings.find((b) => b.id === w.currentBuildingId);
        if (!building) return;

        const newParticles: BurstParticle[] = [];
        const baseColor = new THREE.Color(w.color);
        const center = new THREE.Vector3(building.gridX, 0.8, building.gridY);

        // 20 particles with color variety
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          const speed = 2.0 + Math.random() * 2.0;
          const elevation = (Math.random() - 0.2) * speed;

          // Mix between worker color and a random burst color
          const mixColor = new THREE.Color(BURST_COLORS[i % BURST_COLORS.length]);
          const finalColor = baseColor.clone().lerp(mixColor, 0.3);

          newParticles.push({
            id: idCounter.current++,
            position: center.clone(),
            velocity: new THREE.Vector3(
              Math.cos(angle) * speed,
              elevation,
              Math.sin(angle) * speed
            ),
            color: finalColor,
            life: 1.0 + Math.random() * 0.5,
            maxLife: 1.0 + Math.random() * 0.5,
            size: 0.06 + Math.random() * 0.06,
          });
        }

        setBursts((prev) => [...prev, ...newParticles]);
      }
      prevProgress.current[w.id] = w.progress;
    });
  }, [workers, buildings]);

  // Animate burst particles
  useFrame((_, delta) => {
    if (bursts.length === 0 || !meshRef.current) return;

    const tempMatrix = new THREE.Matrix4();
    const alive: BurstParticle[] = [];

    bursts.forEach((p, i) => {
      p.life -= delta;
      if (p.life <= 0) return;

      p.position.add(p.velocity.clone().multiplyScalar(delta));
      p.velocity.y -= 3.5 * delta; // Stronger gravity for arc effect

      const lifeRatio = p.life / p.maxLife;
      const scale = lifeRatio * p.size;
      tempMatrix.makeScale(scale, scale, scale);
      tempMatrix.setPosition(p.position);
      meshRef.current!.setMatrixAt(i, tempMatrix);
      meshRef.current!.setColorAt(i, p.color);

      alive.push(p);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    if (alive.length !== bursts.length) {
      setBursts(alive);
    }
  });

  const maxParticles = Math.max(bursts.length, 1);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maxParticles]}
      frustumCulled={false}
      visible={bursts.length > 0}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={2.0}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}

// ---- WORKER SPAWN RING -------------------------------------------------------

interface SpawnRing {
  id: number;
  position: THREE.Vector3;
  color: string;
  startTime: number;
  duration: number;
}

interface SpawnRingEffectsProps {
  workers: Worker[];
  buildings: Building[];
}

/**
 * Double expanding ring effect when workers reach a new building.
 * Outer ring expands fast, inner ring expands slower -- dramatic arrival.
 */
export function SpawnRingEffects({ workers, buildings }: SpawnRingEffectsProps) {
  const [rings, setRings] = useState<SpawnRing[]>([]);
  const prevBuildings = useRef<Record<string, string>>({});
  const idCounter = useRef(0);

  useEffect(() => {
    workers.forEach((w) => {
      const prev = prevBuildings.current[w.id];
      if (prev !== undefined && prev !== w.currentBuildingId) {
        const building = buildings.find((b) => b.id === w.currentBuildingId);
        if (!building) return;
        setRings((r) => [
          ...r,
          {
            id: idCounter.current++,
            position: new THREE.Vector3(building.gridX, 0.05, building.gridY),
            color: w.color,
            startTime: performance.now() / 1000,
            duration: 1.2,
          },
        ]);
      }
      prevBuildings.current[w.id] = w.currentBuildingId;
    });
  }, [workers, buildings]);

  // Clean up expired rings
  useEffect(() => {
    if (rings.length === 0) return;
    const timer = setTimeout(() => {
      const now = performance.now() / 1000;
      setRings((r) => r.filter((ring) => now - ring.startTime < ring.duration));
    }, 1400);
    return () => clearTimeout(timer);
  }, [rings]);

  return (
    <>
      {rings.map((ring) => (
        <SpawnRingMesh key={ring.id} ring={ring} />
      ))}
    </>
  );
}

function SpawnRingMesh({ ring }: { ring: SpawnRing }) {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const outerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const innerMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const elapsed = performance.now() / 1000 - ring.startTime;
    const progress = Math.min(elapsed / ring.duration, 1);

    // Outer ring -- expands fast
    if (outerRef.current && outerMatRef.current) {
      const outerScale = 0.5 + progress * 3.0;
      outerRef.current.scale.set(outerScale, outerScale, 1);
      outerMatRef.current.opacity = (1 - progress) * 0.7;
      outerMatRef.current.emissiveIntensity = (1 - progress) * 1.5;
    }

    // Inner ring -- expands slower, lags behind
    if (innerRef.current && innerMatRef.current) {
      const innerProgress = Math.min(progress * 1.3, 1);
      const innerScale = 0.3 + innerProgress * 2.0;
      innerRef.current.scale.set(innerScale, innerScale, 1);
      innerMatRef.current.opacity = (1 - innerProgress) * 0.5;
      innerMatRef.current.emissiveIntensity = (1 - innerProgress) * 1.2;
    }
  });

  return (
    <group position={[ring.position.x, ring.position.y, ring.position.z]}>
      {/* Outer ring -- wider, thinner */}
      <mesh
        ref={outerRef}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.45, 0.55, 32]} />
        <meshStandardMaterial
          ref={outerMatRef}
          color={ring.color}
          emissive={ring.color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Inner ring -- narrower, brighter */}
      <mesh
        ref={innerRef}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.3, 0.38, 32]} />
        <meshStandardMaterial
          ref={innerMatRef}
          color={ring.color}
          emissive={ring.color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ---- TASK PARTICLE SYSTEM ----------------------------------------------------

interface TaskParticle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  status: "running" | "queued" | "failed";
  size: number;
}

interface TaskParticleSystemProps {
  workers: Worker[];
  buildings: Building[];
  isMobile?: boolean;
}

/**
 * Floating particle system representing active tasks.
 * - Green particles for running tasks
 * - Yellow particles for queued/idle workers
 * - Red particles for failed/error states
 * Particles are larger and more visible at default zoom.
 */
export function TaskParticleSystem({
  workers,
  buildings,
  isMobile,
}: TaskParticleSystemProps) {
  const [particles, setParticles] = useState<TaskParticle[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const idCounter = useRef(0);

  // Spawn particles around active workers
  useEffect(() => {
    const interval = setInterval(() => {
      const newParticles: TaskParticle[] = [];

      workers.forEach((worker) => {
        const building = buildings.find((b) => b.id === worker.currentBuildingId);
        if (!building) return;

        // Determine particle status and color
        let status: TaskParticle["status"] = "queued";
        let color: THREE.Color;

        if (worker.status === "working") {
          status = "running";
          color = new THREE.Color("#10b981");
        } else if (building.status === "error") {
          status = "failed";
          color = new THREE.Color("#ef4444");
        } else {
          status = "queued";
          color = new THREE.Color("#e8a019");
        }

        // Spawn 1-2 particles per worker
        const particleCount = isMobile ? 1 : Math.random() > 0.5 ? 2 : 1;

        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.3 + Math.random() * 0.5;
          const height = 0.5 + Math.random() * 1.5;

          // Vary size based on status
          const baseSize = status === "failed" ? 0.12 : status === "running" ? 0.10 : 0.08;

          newParticles.push({
            id: idCounter.current++,
            position: new THREE.Vector3(
              building.gridX + Math.cos(angle) * radius,
              height,
              building.gridY + Math.sin(angle) * radius
            ),
            velocity: new THREE.Vector3(
              (Math.random() - 0.5) * 0.2,
              0.4 + Math.random() * 0.5,
              (Math.random() - 0.5) * 0.2
            ),
            color,
            life: 2.5 + Math.random() * 1.0,
            maxLife: 2.5 + Math.random() * 1.0,
            status,
            size: baseSize + Math.random() * 0.04,
          });
        }
      });

      setParticles((prev) => [...prev, ...newParticles]);
    }, isMobile ? 800 : 500);

    return () => clearInterval(interval);
  }, [workers, buildings, isMobile]);

  // Animate particles
  useFrame((_, delta) => {
    if (particles.length === 0 || !meshRef.current) return;

    const tempMatrix = new THREE.Matrix4();
    const alive: TaskParticle[] = [];

    particles.forEach((p, i) => {
      p.life -= delta;
      if (p.life <= 0) return;

      // Update position
      p.position.add(p.velocity.clone().multiplyScalar(delta));

      // Fade and shrink over lifetime -- but start larger
      const lifeRatio = p.life / p.maxLife;
      const scale = lifeRatio * p.size;

      tempMatrix.makeScale(scale, scale, scale);
      tempMatrix.setPosition(p.position);
      meshRef.current!.setMatrixAt(i, tempMatrix);
      meshRef.current!.setColorAt(i, p.color);

      alive.push(p);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // Clean up dead particles
    if (alive.length !== particles.length) {
      setParticles(alive);
    }
  });

  const maxParticles = Math.max(particles.length, 1);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maxParticles]}
      frustumCulled={false}
      visible={particles.length > 0}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={2.5}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}
