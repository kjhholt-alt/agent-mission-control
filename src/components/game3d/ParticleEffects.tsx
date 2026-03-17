"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { Building, Worker } from "./types";

// ─── BUILDING SPARKLES ───────────────────────────────────────────────────────

interface BuildingSparklesProps {
  buildings: Building[];
  isMobile?: boolean;
}

/**
 * Sparkle particles around active buildings. Industrial glow effect.
 */
export function BuildingSparkles({ buildings, isMobile }: BuildingSparklesProps) {
  const activeBuildings = useMemo(
    () => buildings.filter((b) => b.status === "active"),
    [buildings]
  );

  const sparkleCount = isMobile ? 6 : 12;

  return (
    <>
      {activeBuildings.map((building) => {
        const height = building.size * 1.0;
        return (
          <Sparkles
            key={building.id}
            count={sparkleCount}
            size={1.5}
            speed={0.3}
            scale={[building.size * 2, height + 1, building.size * 2]}
            position={[building.gridX, height / 2 + 0.5, building.gridY]}
            color={building.color}
            opacity={0.4}
          />
        );
      })}
    </>
  );
}

// ─── TASK COMPLETION BURST ───────────────────────────────────────────────────

interface BurstParticle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
}

interface CompletionBurstProps {
  workers: Worker[];
  buildings: Building[];
}

/**
 * When a worker completes a task (progress wraps to 0), spawn a burst
 * of 12 small spheres exploding outward, fading over 0.8s.
 */
export function CompletionBursts({ workers, buildings }: CompletionBurstProps) {
  const [bursts, setBursts] = useState<BurstParticle[]>([]);
  const prevProgress = useRef<Record<string, number>>({});
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const idCounter = useRef(0);

  // Detect task completions (progress drops back to near 0)
  useEffect(() => {
    workers.forEach((w) => {
      const prev = prevProgress.current[w.id];
      if (prev !== undefined && prev > 50 && w.progress < 10) {
        // Worker completed a task — spawn burst
        const building = buildings.find((b) => b.id === w.currentBuildingId);
        if (!building) return;

        const newParticles: BurstParticle[] = [];
        const color = new THREE.Color(w.color);
        const center = new THREE.Vector3(building.gridX, 0.8, building.gridY);

        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const speed = 1.5 + Math.random() * 1.5;
          newParticles.push({
            id: idCounter.current++,
            position: center.clone(),
            velocity: new THREE.Vector3(
              Math.cos(angle) * speed,
              (Math.random() - 0.3) * speed,
              Math.sin(angle) * speed
            ),
            color,
            life: 0.8,
            maxLife: 0.8,
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
      p.velocity.y -= 2 * delta; // Gravity

      const scale = (p.life / p.maxLife) * 0.08;
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
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.8}
      />
    </instancedMesh>
  );
}

// ─── WORKER SPAWN RING ───────────────────────────────────────────────────────

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
 * Expanding ring effect when workers reach a new building.
 * Ring expands and fades over ~1 second.
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
            duration: 1.0,
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
    }, 1100);
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
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return;
    const elapsed = performance.now() / 1000 - ring.startTime;
    const progress = Math.min(elapsed / ring.duration, 1);

    const scale = 0.5 + progress * 2;
    meshRef.current.scale.set(scale, scale, 1);
    materialRef.current.opacity = (1 - progress) * 0.6;
  });

  return (
    <mesh
      ref={meshRef}
      position={[ring.position.x, ring.position.y, ring.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        color={ring.color}
        emissive={ring.color}
        emissiveIntensity={1}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── TASK PARTICLE SYSTEM ────────────────────────────────────────────────────

interface TaskParticle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  status: "running" | "queued" | "failed";
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
          color = new THREE.Color("#10b981"); // Green
        } else if (building.status === "error") {
          status = "failed";
          color = new THREE.Color("#ef4444"); // Red
        } else {
          status = "queued";
          color = new THREE.Color("#e8a019"); // Yellow
        }

        // Spawn 1-2 particles per worker
        const particleCount = isMobile ? 1 : Math.random() > 0.5 ? 2 : 1;

        for (let i = 0; i < particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.3 + Math.random() * 0.5;
          const height = 0.5 + Math.random() * 1.5;

          newParticles.push({
            id: idCounter.current++,
            position: new THREE.Vector3(
              building.gridX + Math.cos(angle) * radius,
              height,
              building.gridY + Math.sin(angle) * radius
            ),
            velocity: new THREE.Vector3(
              (Math.random() - 0.5) * 0.2,
              0.3 + Math.random() * 0.4,
              (Math.random() - 0.5) * 0.2
            ),
            color,
            life: 2.0 + Math.random() * 1.0,
            maxLife: 2.0 + Math.random() * 1.0,
            status,
          });
        }
      });

      setParticles((prev) => [...prev, ...newParticles]);
    }, isMobile ? 800 : 500); // Spawn rate

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

      // Fade and shrink over lifetime
      const lifeRatio = p.life / p.maxLife;
      const scale = lifeRatio * 0.06;

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
        emissiveIntensity={2.0}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  );
}
