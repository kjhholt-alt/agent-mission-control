"use client";

import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Worker, WorkerType, Building } from "./types";
import { WORKER_TYPE_CONFIG, BUILDINGS } from "./constants";

// ─── WORKER GEOMETRY BY TYPE ─────────────────────────────────────────────────

function WorkerGeometry({ type }: { type: WorkerType }) {
  switch (type) {
    case "builder":
      return <boxGeometry args={[0.5, 0.5, 0.5]} />;
    case "inspector":
      return <octahedronGeometry args={[0.35]} />;
    case "miner":
      return <sphereGeometry args={[0.3, 16, 16]} />;
    case "scout":
      return <coneGeometry args={[0.3, 0.6, 4]} />;
    case "deployer":
      return <cylinderGeometry args={[0.15, 0.3, 0.7, 8]} />;
    case "messenger":
      return <icosahedronGeometry args={[0.25]} />;
  }
}

// ─── SINGLE WORKER 3D COMPONENT ──────────────────────────────────────────────

interface Worker3DProps {
  worker: Worker;
  buildings: Building[];
  isSelected: boolean;
  onClick: (id: string) => void;
}

export function Worker3D({ worker, buildings, isSelected, onClick }: Worker3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const positionRef = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  const config = WORKER_TYPE_CONFIG[worker.type];
  const color = useMemo(() => new THREE.Color(config.color), [config.color]);

  // Compute current/target positions from building grid coords
  const currentBuilding = buildings.find((b) => b.id === worker.currentBuildingId);
  const targetBuilding = buildings.find((b) => b.id === worker.targetBuildingId);

  const fromPos = useMemo(() => {
    if (!currentBuilding) return new THREE.Vector3(5, 0.5, 5);
    return new THREE.Vector3(currentBuilding.gridX, 0.5, currentBuilding.gridY);
  }, [currentBuilding]);

  const toPos = useMemo(() => {
    if (!targetBuilding) return new THREE.Vector3(5, 0.5, 5);
    return new THREE.Vector3(targetBuilding.gridX, 0.5, targetBuilding.gridY);
  }, [targetBuilding]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !materialRef.current) return;

    const t = clock.getElapsedTime();
    const progress = worker.progress / 100;

    // Lerp position along path between buildings
    const targetPos = new THREE.Vector3().lerpVectors(fromPos, toPos, progress);

    // Initialize position on first frame to avoid lerp from origin
    if (!initialized.current) {
      positionRef.current.copy(targetPos);
      initialized.current = true;
    }

    // Smooth interpolation toward target
    positionRef.current.lerp(targetPos, 0.08);

    // Bob animation
    const bobSpeed = worker.status === "working" ? 4 : 2;
    const bobAmount = worker.status === "working" ? 0.15 : 0.1;
    const bob = Math.sin(t * bobSpeed + worker.id.charCodeAt(1) * 0.7) * bobAmount;

    groupRef.current.position.set(
      positionRef.current.x,
      positionRef.current.y + bob,
      positionRef.current.z
    );

    // Slow rotation
    groupRef.current.rotation.y += 0.008;

    // Emissive intensity based on state
    const baseEmissive = worker.status === "working" ? 0.8 : 0.5;
    const pulse = Math.sin(t * 3 + worker.id.charCodeAt(1)) * 0.15;
    materialRef.current.emissiveIntensity = isSelected
      ? baseEmissive + 0.4 + pulse
      : baseEmissive + pulse;
  });

  return (
    <group ref={groupRef}>
      {/* Worker mesh */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick(worker.id);
        }}
        castShadow
      >
        <WorkerGeometry type={worker.type} />
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Point light for glow */}
      <pointLight
        color={config.color}
        intensity={0.6}
        distance={2.5}
        decay={2}
      />

      {/* Floating label */}
      <Html
        position={[0, 0.7, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(5, 5, 8, 0.9)",
            border: `1px solid ${config.color}66`,
            borderRadius: 2,
            padding: "1px 5px",
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <span
            style={{
              color: config.color,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textShadow: `0 0 6px ${config.color}`,
            }}
          >
            {worker.name}
          </span>
          <span
            style={{
              color: "#eab308",
              fontSize: 7,
              fontWeight: 700,
              background: "rgba(234, 179, 8, 0.1)",
              padding: "0 3px",
              borderRadius: 2,
              border: "1px solid rgba(234, 179, 8, 0.3)",
            }}
          >
            {worker.level}
          </span>
        </div>
      </Html>

      {/* Speech bubble */}
      {worker.speechBubble && (
        <Html
          position={[0, 1.1, 0]}
          center
          distanceFactor={15}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              background: "rgba(5, 5, 8, 0.95)",
              border: `1px solid ${config.color}44`,
              borderRadius: 4,
              padding: "2px 6px",
              whiteSpace: "nowrap",
              fontFamily: "'JetBrains Mono', monospace",
              userSelect: "none",
              boxShadow: `0 0 8px ${config.color}22`,
            }}
          >
            <span
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 7,
              }}
            >
              {worker.speechBubble}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
