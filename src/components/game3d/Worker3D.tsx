"use client";

import { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Worker, WorkerType, Building } from "./types";
import { WORKER_TYPE_CONFIG, BUILDINGS } from "./constants";

// ---- REUSABLE TEMP VECTOR ---------------------------------------------------

const _tmpV = new THREE.Vector3();

// ---- SHARED DETAIL SUB-COMPONENTS ------------------------------------------

/** Small bolt detail -- tiny metallic sphere placed on corners/edges */
function Bolt({ position, size = 0.015 }: { position: [number, number, number]; size?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 4, 4]} />
      <meshStandardMaterial color="#7a7c88" metalness={0.95} roughness={0.1} />
    </mesh>
  );
}

/** Panel line -- thin edge strip for visual detail */
function PanelLine({
  position,
  args,
  rotation,
  color = "#0a0b14",
}: {
  position: [number, number, number];
  args: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.5} />
    </mesh>
  );
}

/** Exhaust vent -- small cylinder on back of workers */
function ExhaustVent({
  position,
  color = "#3a3c48",
}: {
  position: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.025, 0.03, 0.06, 6]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Inner glow of vent */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.01, 6]} />
        <meshStandardMaterial
          color="#1a1c28"
          emissive="#ff4400"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

/** Joint sphere -- shiny metallic sphere at articulation points */
function JointSphere({ position, size = 0.03 }: { position: [number, number, number]; size?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 6, 6]} />
      <meshStandardMaterial color="#8a8c98" metalness={0.95} roughness={0.1} />
    </mesh>
  );
}

/** Level indicator ring -- scales with worker level */
function LevelRing({ level, color }: { level: number; color: string }) {
  const intensity = 0.5 + (level / 10) * 2.5;
  const ringSize = 0.28 + (level / 10) * 0.12;
  return (
    <mesh position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[ringSize, ringSize + 0.015, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        transparent
        opacity={0.4 + (level / 10) * 0.3}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---- BUILDER (Forge) -- Welding Mech ----------------------------------------

function BuilderModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const rightArmRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const hoverRef = useRef<THREE.Mesh>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const visorRef = useRef<THREE.MeshStandardMaterial>(null);
  const breatheRef = useRef<THREE.Group>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 2.5) * 0.015;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }

    if (status === "working") {
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 6) * 0.8;
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 6 + Math.PI) * 0.3;
      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(t * 3) * 0.05;
      if (sparkGroupRef.current) {
        sparkGroupRef.current.visible = true;
        sparkGroupRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const st = (t * 12 + i * 0.9) % 1.0;
          const angle = st * Math.PI * 5 + i * 1.8;
          mesh.position.set(
            0.25 + Math.cos(angle) * 0.15,
            -0.15 + st * 0.4,
            Math.sin(angle) * 0.15
          );
          const s = st < 0.5 ? 0.035 : 0.035 * (1 - (st - 0.5) * 2);
          mesh.scale.setScalar(Math.max(0.001, s));
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = st < 0.7 ? 1.0 : (1 - st) * 3.3;
        });
      }
      if (visorRef.current) visorRef.current.emissiveIntensity = 2.5 + Math.sin(t * 8) * 1.0;
    } else {
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (bodyRef.current) bodyRef.current.rotation.z = 0;
      if (sparkGroupRef.current) sparkGroupRef.current.visible = false;
      if (visorRef.current) visorRef.current.emissiveIntensity = status === "idle" ? 0.5 : 1.2;
    }
    if (status === "moving") {
      if (bodyRef.current) bodyRef.current.rotation.x = 0.15;
      if (hoverRef.current) {
        const mat = hoverRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.emissiveIntensity = 2.0;
      }
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 8) * 0.4;
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 8 + Math.PI) * 0.4;
    } else if (status === "idle") {
      if (bodyRef.current) bodyRef.current.rotation.x = 0;
      if (hoverRef.current) {
        const mat = hoverRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.emissiveIntensity = 0.5;
      }
    }
  });

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      {/* Body / torso */}
      <mesh ref={bodyRef} position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.3, 0.35, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Chest plate accent (darker shade) */}
      <mesh position={[0, 0.12, 0.126]}>
        <boxGeometry args={[0.22, 0.18, 0.005]} />
        <meshStandardMaterial color="#1a1c28" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Chest core light (level-scaled glow) */}
      <mesh position={[0, 0.1, 0.13]}>
        <circleGeometry args={[0.035, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5 + level * 0.3}
          toneMapped={false}
        />
      </mesh>
      {/* Panel lines on body */}
      <PanelLine position={[0, 0.0, 0.127]} args={[0.28, 0.005, 0.005]} />
      <PanelLine position={[0, 0.2, 0.127]} args={[0.28, 0.005, 0.005]} />
      <PanelLine position={[0.12, 0.1, 0.127]} args={[0.005, 0.16, 0.005]} />
      <PanelLine position={[-0.12, 0.1, 0.127]} args={[0.005, 0.16, 0.005]} />
      {/* Corner bolts on body */}
      <Bolt position={[0.14, 0.26, 0.13]} />
      <Bolt position={[-0.14, 0.26, 0.13]} />
      <Bolt position={[0.14, -0.04, 0.13]} />
      <Bolt position={[-0.14, -0.04, 0.13]} />
      {/* Head */}
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.22, 0.16, 0.22]} />
        <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Head crest (tier indicator) */}
      <mesh position={[0, 0.47, 0]}>
        <boxGeometry args={[0.06, 0.02, 0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Visor -- glows when working */}
      <mesh position={[0, 0.37, 0.12]}>
        <boxGeometry args={[0.18, 0.05, 0.02]} />
        <meshStandardMaterial ref={visorRef} color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {/* Head bolts */}
      <Bolt position={[0.1, 0.44, 0.12]} />
      <Bolt position={[-0.1, 0.44, 0.12]} />
      {/* Tool belt */}
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.02, 6, 12]} />
        <meshStandardMaterial color="#4a3c28" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Right arm (welding arm) */}
      <JointSphere position={[0.19, 0.2, 0]} size={0.04} />
      <group ref={rightArmRef} position={[0.22, 0.15, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.04, 0.035, 0.25, 6]} />
          <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Armor plate on upper arm */}
        <mesh position={[0.03, -0.06, 0]}>
          <boxGeometry args={[0.015, 0.12, 0.06]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
        </mesh>
        <JointSphere position={[0, -0.25, 0]} size={0.03} />
        {/* Welding torch */}
        <mesh position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.04, 0.1, 6]} />
          <meshStandardMaterial color="#fbbf24" emissive="#ff6600" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
      {/* Left arm */}
      <JointSphere position={[-0.19, 0.2, 0]} size={0.04} />
      <group ref={leftArmRef} position={[-0.22, 0.15, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.04, 0.035, 0.25, 6]} />
          <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[-0.03, -0.06, 0]}>
          <boxGeometry args={[0.015, 0.12, 0.06]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
        </mesh>
        <JointSphere position={[0, -0.25, 0]} size={0.03} />
        {/* Left hand tool (wrench shape) */}
        <mesh position={[0, -0.28, 0]}>
          <boxGeometry args={[0.06, 0.04, 0.02]} />
          <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.15} />
        </mesh>
      </group>
      {/* Legs */}
      <mesh position={[0.08, -0.18, 0]}>
        <boxGeometry args={[0.07, 0.22, 0.07]} />
        <meshStandardMaterial color="#3a3c48" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.08, -0.18, 0]}>
        <boxGeometry args={[0.07, 0.22, 0.07]} />
        <meshStandardMaterial color="#3a3c48" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Knee joints */}
      <JointSphere position={[0.08, -0.12, 0.04]} size={0.025} />
      <JointSphere position={[-0.08, -0.12, 0.04]} size={0.025} />
      {/* Exhaust vents on back */}
      <ExhaustVent position={[0.08, 0.2, -0.14]} />
      <ExhaustVent position={[-0.08, 0.2, -0.14]} />
      {/* Engine port on back */}
      <mesh position={[0, 0.08, -0.13]}>
        <boxGeometry args={[0.1, 0.08, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} toneMapped={false} />
      </mesh>
      {/* Hover pad */}
      <mesh ref={hoverRef} position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} toneMapped={false} />
      </mesh>
      {/* Hover pad thrust ring */}
      <mesh position={[0, -0.36, 0]}>
        <torusGeometry args={[0.18, 0.01, 4, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* Welding sparks */}
      <group ref={sparkGroupRef} visible={false}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={`bs-${i}`}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#fbbf24" : "#ff6600"}
              emissive={i % 2 === 0 ? "#ff8800" : "#ffcc00"}
              emissiveIntensity={5}
              transparent
              opacity={0.9}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---- INSPECTOR (Lens) -- Scanner Drone ---------------------------------------

function InspectorModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const sensorRingRef = useRef<THREE.Mesh>(null);
  const scannerRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const scanBeamRef = useRef<THREE.Mesh>(null);
  const radarRef = useRef<THREE.Group>(null);
  const breatheRef = useRef<THREE.Group>(null);
  const dataStreamRef = useRef<THREE.Group>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 2) * 0.012;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }

    if (status === "working") {
      if (sensorRingRef.current) sensorRingRef.current.rotation.y = t * 5;
      if (bodyRef.current) bodyRef.current.rotation.y = t * 0.5;
      if (scanBeamRef.current) {
        scanBeamRef.current.visible = true;
        scanBeamRef.current.rotation.z = Math.sin(t * 3) * 0.4;
        const mat = scanBeamRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.opacity = 0.5 + Math.sin(t * 6) * 0.3;
      }
      if (radarRef.current) radarRef.current.rotation.y = t * 8;
      // Data stream particles
      if (dataStreamRef.current) {
        dataStreamRef.current.visible = true;
        dataStreamRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const dt = (t * 3 + i * 0.6) % 1.5;
          mesh.position.set(
            Math.sin(t * 2 + i * 1.5) * 0.1,
            -0.35 - dt * 0.5,
            Math.cos(t * 2 + i * 1.5) * 0.1
          );
          const s = 0.015 - dt * 0.008;
          mesh.scale.setScalar(Math.max(0.001, s));
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = Math.max(0, 0.8 - dt * 0.5);
        });
      }
    } else {
      if (sensorRingRef.current) sensorRingRef.current.rotation.y = t * 0.3;
      if (bodyRef.current) bodyRef.current.rotation.y = t * 0.15;
      if (scanBeamRef.current) scanBeamRef.current.visible = false;
      if (radarRef.current) radarRef.current.rotation.y = t * 1;
      if (dataStreamRef.current) dataStreamRef.current.visible = false;
    }
    if (status === "moving" && bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(t * 3) * 0.15;
    }
  });

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      {/* Body -- diamond */}
      <mesh ref={bodyRef} castShadow>
        <octahedronGeometry args={[0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Armored panels (flat plates on faces) */}
      {[
        [0, 0.15, 0.15] as [number, number, number],
        [0, -0.15, 0.15] as [number, number, number],
        [0.15, 0, 0.15] as [number, number, number],
        [-0.15, 0, 0.15] as [number, number, number],
      ].map((pos, i) => (
        <mesh key={`ap-${i}`} position={pos}>
          <boxGeometry args={[0.06, 0.06, 0.005]} />
          <meshStandardMaterial color="#1a1c28" metalness={0.85} roughness={0.2} />
        </mesh>
      ))}
      <Bolt position={[0.12, 0.12, 0.12]} />
      <Bolt position={[-0.12, 0.12, 0.12]} />
      <Bolt position={[0.12, -0.12, 0.12]} />
      <Bolt position={[-0.12, -0.12, 0.12]} />
      {/* Scanner housing underneath */}
      <mesh ref={scannerRef} position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.07, 0.04, 0.18, 6]} />
        <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Scanner lens (emissive) */}
      <mesh position={[0, -0.3, 0]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} toneMapped={false} />
      </mesh>
      {/* Antenna spike on top */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.01, 0.02, 0.15, 4]} />
        <meshStandardMaterial color="#e2e8f0" emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Rotating radar dish */}
      <group ref={radarRef} position={[0, 0.35, 0]}>
        <mesh rotation={[0.3, 0, 0]}>
          <circleGeometry args={[0.06, 6]} />
          <meshStandardMaterial
            color="#e2e8f0"
            emissive={color}
            emissiveIntensity={0.8}
            metalness={0.7}
            roughness={0.2}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.04, 0.03]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.08, 4]} />
          <meshStandardMaterial color="#8a8c98" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
      {/* Sensor ring */}
      <mesh ref={sensorRingRef} position={[0, 0, 0]}>
        <torusGeometry args={[0.32, 0.018, 6, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      {/* Scanner beam -- visible cone */}
      <mesh ref={scanBeamRef} position={[0, -0.55, 0]} visible={false}>
        <coneGeometry args={[0.2, 0.7, 8, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          transparent
          opacity={0.15}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Data stream particles (working effect) */}
      <group ref={dataStreamRef} visible={false}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`ds-${i}`}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? color : "#06b6d4"}
              emissive={i % 2 === 0 ? color : "#06b6d4"}
              emissiveIntensity={3}
              transparent
              opacity={0.7}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <ExhaustVent position={[0.15, 0, -0.15]} />
      <ExhaustVent position={[-0.15, 0, -0.15]} />
    </group>
  );
}

// ---- MINER (Digger) -- Drill Rig --------------------------------------------

function MinerModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const drillRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const scoopRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.Group>(null);
  const treadLeftRef = useRef<THREE.Mesh>(null);
  const treadRightRef = useRef<THREE.Mesh>(null);
  const breatheRef = useRef<THREE.Group>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 2.2) * 0.01;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }

    if (status === "working") {
      if (drillRef.current) drillRef.current.rotation.y = t * 15;
      if (bodyRef.current) {
        bodyRef.current.position.x = Math.sin(t * 20) * 0.015;
        bodyRef.current.position.z = Math.cos(t * 25) * 0.015;
      }
      if (scoopRef.current) scoopRef.current.rotation.x = Math.sin(t * 3) * 0.3 - 0.2;
      if (debrisRef.current) {
        debrisRef.current.visible = true;
        debrisRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const dt = (t * 6 + i * 1.1) % 1.5;
          mesh.position.set(
            Math.sin(i * 2.3) * 0.18,
            dt * 0.55,
            Math.cos(i * 2.3) * 0.18 + 0.15
          );
          const baseSize = i % 3 === 0 ? 0.03 : i % 3 === 1 ? 0.02 : 0.015;
          const s = dt < 0.8 ? baseSize : baseSize * (1 - (dt - 0.8) / 0.7);
          mesh.scale.setScalar(Math.max(0.001, s));
          mesh.rotation.x = t * 5 + i;
          mesh.rotation.z = t * 3 + i * 2;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = dt < 1.0 ? 0.85 : Math.max(0, (1.5 - dt) * 1.6);
        });
      }
    } else {
      if (drillRef.current) drillRef.current.rotation.y = 0;
      if (bodyRef.current) {
        bodyRef.current.position.x = 0;
        bodyRef.current.position.z = 0;
      }
      if (scoopRef.current) scoopRef.current.rotation.x = 0;
      if (debrisRef.current) debrisRef.current.visible = false;
    }
    if (status === "moving") {
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 6)) * 0.03;
    }
  });

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      <group ref={bodyRef}>
        {/* Main housing */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.32, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Top cap */}
        <mesh position={[0, 0.27, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.04, 8]} />
          <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Reinforcement band */}
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.215, 0.012, 4, 12]} />
          <meshStandardMaterial color="#1a1c28" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Panel lines */}
        <PanelLine position={[0.21, 0.1, 0]} args={[0.005, 0.28, 0.005]} />
        <PanelLine position={[-0.21, 0.1, 0]} args={[0.005, 0.28, 0.005]} />
        <PanelLine position={[0, 0.1, 0.21]} args={[0.005, 0.28, 0.005]} />
        {/* Bolts */}
        <Bolt position={[0.18, 0.22, 0.1]} />
        <Bolt position={[-0.18, 0.22, 0.1]} />
        <Bolt position={[0.18, 0.22, -0.1]} />
        <Bolt position={[-0.18, 0.22, -0.1]} />
        {/* Status light on top */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={status === "working" ? 3 : 0.8}
            toneMapped={false}
          />
        </mesh>
        {/* Drill -- multi-cone */}
        <group ref={drillRef} position={[0.14, -0.1, 0.14]} rotation={[0.3, 0, 0.3]}>
          <mesh>
            <coneGeometry args={[0.09, 0.28, 6]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} emissive="#aaaaaa" emissiveIntensity={0.3} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={`groove-${i}`} position={[Math.cos(i * 2.1) * 0.04, -0.05 + i * 0.06, Math.sin(i * 2.1) * 0.04]}>
              <coneGeometry args={[0.025, 0.08, 4]} />
              <meshStandardMaterial color="#ccccdd" metalness={0.9} roughness={0.15} />
            </mesh>
          ))}
          <mesh position={[0, -0.15, 0]}>
            <sphereGeometry args={[0.02, 4, 4]} />
            <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
        {/* Treads */}
        <mesh ref={treadLeftRef} position={[-0.17, -0.12, 0]}>
          <boxGeometry args={[0.07, 0.1, 0.38]} />
          <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh ref={treadRightRef} position={[0.17, -0.12, 0]}>
          <boxGeometry args={[0.07, 0.1, 0.38]} />
          <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Tread rollers */}
        {[-0.15, -0.05, 0.05, 0.15].map((z, i) => (
          <group key={`tread-detail-${i}`}>
            <mesh position={[-0.17, -0.12, z]}>
              <boxGeometry args={[0.075, 0.02, 0.04]} />
              <meshStandardMaterial color="#1a1c28" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0.17, -0.12, z]}>
              <boxGeometry args={[0.075, 0.02, 0.04]} />
              <meshStandardMaterial color="#1a1c28" metalness={0.9} roughness={0.3} />
            </mesh>
          </group>
        ))}
        {/* Scoop */}
        <mesh ref={scoopRef} position={[0, -0.05, 0.24]}>
          <boxGeometry args={[0.22, 0.03, 0.12]} />
          <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Exhaust twin stacks */}
        <mesh position={[-0.08, 0.32, -0.08]}>
          <cylinderGeometry args={[0.03, 0.04, 0.14, 6]} />
          <meshStandardMaterial color="#3a3c48" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0.08, 0.34, -0.08]}>
          <cylinderGeometry args={[0.025, 0.035, 0.16, 6]} />
          <meshStandardMaterial color="#3a3c48" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Stack caps */}
        <mesh position={[-0.08, 0.4, -0.08]}>
          <cylinderGeometry args={[0.035, 0.03, 0.02, 6]} />
          <meshStandardMaterial color="#555566" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.08, 0.43, -0.08]}>
          <cylinderGeometry args={[0.03, 0.025, 0.02, 6]} />
          <meshStandardMaterial color="#555566" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Engine port */}
        <mesh position={[0, 0.05, -0.23]}>
          <boxGeometry args={[0.12, 0.1, 0.02]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </group>
      {/* Debris particles */}
      <group ref={debrisRef} visible={false}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`db-${i}`}>
            {i % 3 === 0 ? (
              <boxGeometry args={[1, 0.7, 1]} />
            ) : i % 3 === 1 ? (
              <tetrahedronGeometry args={[1]} />
            ) : (
              <sphereGeometry args={[1, 4, 4]} />
            )}
            <meshStandardMaterial
              color={i % 3 === 0 ? "#8B7355" : i % 3 === 1 ? "#6b7280" : "#9a8a6a"}
              emissive={i % 2 === 0 ? "#8B7355" : "#6b7280"}
              emissiveIntensity={0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---- SCOUT (Hawk) -- Recon Drone ---------------------------------------------

function ScoutModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const radarRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftWingRef = useRef<THREE.Mesh>(null);
  const rightWingRef = useRef<THREE.Mesh>(null);
  const engineRef = useRef<THREE.Mesh>(null);
  const scanRingsRef = useRef<THREE.Group>(null);
  const breatheRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Group>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 1.8) * 0.01;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }

    if (radarRef.current) {
      radarRef.current.rotation.y = status === "working" ? t * 8 : t * 1.5;
    }
    if (status === "working") {
      if (scanRingsRef.current) {
        scanRingsRef.current.visible = true;
        scanRingsRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const rt = (t * 1.5 + i * 0.5) % 2.0;
          const s = 0.3 + rt * 0.8;
          mesh.scale.setScalar(s);
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = Math.max(0, 0.6 - rt * 0.3);
        });
      }
      if (engineRef.current) {
        const mat = engineRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.emissiveIntensity = 2.5 + Math.sin(t * 4) * 0.5;
      }
    } else {
      if (scanRingsRef.current) scanRingsRef.current.visible = false;
      if (engineRef.current) {
        const mat = engineRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.emissiveIntensity = status === "moving" ? 2.0 : 0.8;
      }
    }
    if (status === "moving") {
      if (leftWingRef.current) leftWingRef.current.rotation.z = Math.sin(t * 3) * 0.1 - 0.1;
      if (rightWingRef.current) rightWingRef.current.rotation.z = -Math.sin(t * 3) * 0.1 + 0.1;
      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(t * 2) * 0.1;
      // Engine trail
      if (trailRef.current) {
        trailRef.current.visible = true;
        trailRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const tt = (t * 5 + i * 0.4) % 1.2;
          mesh.position.set(0, -tt * 0.05, 0.2 + tt * 0.4);
          const s = 0.02 - tt * 0.015;
          mesh.scale.setScalar(Math.max(0.001, s));
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = Math.max(0, 0.8 - tt * 0.67);
        });
      }
    } else {
      if (leftWingRef.current) leftWingRef.current.rotation.z = -0.05;
      if (rightWingRef.current) rightWingRef.current.rotation.z = 0.05;
      if (bodyRef.current) bodyRef.current.rotation.z = 0;
      if (trailRef.current) trailRef.current.visible = false;
    }
  });

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      <group ref={bodyRef}>
        {/* Stealth body */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.15, 0.4, 3]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Belly panel */}
        <mesh position={[0, -0.06, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.18, 0.25]} />
          <meshStandardMaterial color="#1a1c28" metalness={0.85} roughness={0.2} />
        </mesh>
        <Bolt position={[0, 0.08, -0.1]} />
        <Bolt position={[0.08, -0.05, 0.05]} />
        <Bolt position={[-0.08, -0.05, 0.05]} />
        {/* Left wing */}
        <mesh ref={leftWingRef} position={[-0.2, 0, 0]} rotation={[0, 0, -0.05]}>
          <boxGeometry args={[0.25, 0.015, 0.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Wing tip lights */}
        <mesh position={[-0.33, 0, 0]}>
          <sphereGeometry args={[0.015, 4, 4]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {/* Right wing */}
        <mesh ref={rightWingRef} position={[0.2, 0, 0]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[0.25, 0.015, 0.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.33, 0, 0]}>
          <sphereGeometry args={[0.015, 4, 4]} />
          <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {/* Radar dome */}
        <mesh ref={radarRef} position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#e2e8f0" emissive={color} emissiveIntensity={1} toneMapped={false} />
        </mesh>
        {/* Engine at rear */}
        <mesh ref={engineRef} position={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.05, 0.04, 0.08, 6]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
        <ExhaustVent position={[0.06, -0.03, 0.18]} />
        <ExhaustVent position={[-0.06, -0.03, 0.18]} />
      </group>
      {/* Scan rings (working) */}
      <group ref={scanRingsRef} visible={false} position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={`sr-${i}`}>
            <torusGeometry args={[0.3, 0.008, 6, 24]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Engine trail (moving) */}
      <group ref={trailRef} visible={false}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={`trail-${i}`}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#ff6600" : "#ffcc00"}
              emissive={i % 2 === 0 ? "#ff4400" : "#ff8800"}
              emissiveIntensity={4}
              transparent
              opacity={0.7}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---- DEPLOYER (Rocket) -- Launch Platform ------------------------------------

function DeployerModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const bodyRef = useRef<THREE.Group>(null);
  const nozzleRef = useRef<THREE.Mesh>(null);
  const payloadRef = useRef<THREE.Mesh>(null);
  const exhaustRef = useRef<THREE.Group>(null);
  const steamRef = useRef<THREE.Group>(null);
  const breatheRef = useRef<THREE.Group>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 2.3) * 0.01;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }

    if (status === "working") {
      if (bodyRef.current) {
        bodyRef.current.position.x = Math.sin(t * 18) * 0.008;
        bodyRef.current.position.z = Math.cos(t * 22) * 0.008;
      }
      if (nozzleRef.current) {
        const mat = nozzleRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.emissiveIntensity = 3.0 + Math.sin(t * 10) * 1.0;
      }
      if (payloadRef.current) {
        payloadRef.current.position.y = 0.35 + Math.sin(t * 2) * 0.03;
      }
      if (exhaustRef.current) {
        exhaustRef.current.visible = true;
        exhaustRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const et = (t * 8 + i * 0.8) % 1.2;
          mesh.position.set(
            Math.sin(i * 1.7) * 0.04,
            -0.3 - et * 0.4,
            Math.cos(i * 1.7) * 0.04
          );
          const s = 0.03 - et * 0.02;
          mesh.scale.setScalar(Math.max(0.001, s));
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = Math.max(0, 1 - et * 0.83);
        });
      }
    } else {
      if (bodyRef.current) {
        bodyRef.current.position.x = 0;
        bodyRef.current.position.z = 0;
      }
      if (nozzleRef.current) {
        const mat = nozzleRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.emissiveIntensity = 0.5;
      }
      if (payloadRef.current) payloadRef.current.position.y = 0.35;
      if (exhaustRef.current) exhaustRef.current.visible = false;
    }
    if (steamRef.current) {
      if (status === "idle") {
        steamRef.current.visible = true;
        steamRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const st = (t * 1.5 + i * 1.2) % 3.0;
          mesh.position.set(0.15, -0.1 + st * 0.3, Math.sin(i) * 0.05);
          const s = 0.015 + st * 0.01;
          mesh.scale.setScalar(s);
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = Math.max(0, 0.3 - st * 0.1);
        });
      } else {
        steamRef.current.visible = false;
      }
    }
    if (status === "moving" && bodyRef.current) {
      bodyRef.current.rotation.x = Math.PI / 2;
      if (nozzleRef.current) {
        const mat = nozzleRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.emissiveIntensity = 2.5;
      }
      if (exhaustRef.current) {
        exhaustRef.current.visible = true;
        exhaustRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const et = (t * 6 + i * 0.5) % 1.0;
          mesh.position.set(
            Math.sin(i * 1.7) * 0.03,
            -0.3 - et * 0.3,
            Math.cos(i * 1.7) * 0.03
          );
          const s = 0.025 - et * 0.02;
          mesh.scale.setScalar(Math.max(0.001, s));
          const mat2 = mesh.material as THREE.MeshStandardMaterial;
          if (mat2) mat2.opacity = Math.max(0, 1 - et);
        });
      }
    } else if (status !== "moving" && bodyRef.current) {
      bodyRef.current.rotation.x = 0;
    }
  });

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      <group ref={bodyRef}>
        {/* Rocket body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.14, 0.5, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Body stripe */}
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.115, 0.008, 4, 12]} />
          <meshStandardMaterial color="#1a1c28" metalness={0.85} roughness={0.2} />
        </mesh>
        <Bolt position={[0.1, 0.15, 0.05]} />
        <Bolt position={[-0.1, 0.15, 0.05]} />
        <Bolt position={[0.1, -0.1, 0.05]} />
        <Bolt position={[-0.1, -0.1, 0.05]} />
        {/* Nose cone */}
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.1, 0.15, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Nose tip */}
        <mesh position={[0, 0.39, 0]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {/* Payload */}
        <mesh ref={payloadRef} position={[0, 0.35, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} toneMapped={false} />
        </mesh>
        {/* Fins (4) */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
          <mesh key={`fin-${i}`} position={[Math.cos(angle) * 0.12, -0.2, Math.sin(angle) * 0.12]} rotation={[0, -angle, 0.3]}>
            <boxGeometry args={[0.08, 0.12, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        {/* Nozzle */}
        <mesh ref={nozzleRef} position={[0, -0.28, 0]}>
          <torusGeometry args={[0.08, 0.025, 6, 12]} />
          <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
        {/* Engine port */}
        <mesh position={[0, -0.08, 0.14]}>
          <boxGeometry args={[0.06, 0.06, 0.01]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} toneMapped={false} />
        </mesh>
        {/* Exhaust */}
        <group ref={exhaustRef} visible={false}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={`ex-${i}`}>
              <sphereGeometry args={[1, 4, 4]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#ff6600" : "#ff2200"}
                emissive={i % 3 === 0 ? "#ffcc00" : i % 3 === 1 ? "#ff6600" : "#ff2200"}
                emissiveIntensity={4}
                transparent
                opacity={0.8}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      </group>
      {/* Idle steam */}
      <group ref={steamRef} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={`stm-${i}`}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial color="#ccccdd" emissive="#aaaacc" emissiveIntensity={0.3} transparent opacity={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---- MESSENGER (Spark) -- Communication Relay --------------------------------

function MessengerModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const signalRingsRef = useRef<THREE.Group>(null);
  const antennaTipsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const arcRef = useRef<THREE.Group>(null);
  const breatheRef = useRef<THREE.Group>(null);
  const dataOrbRef = useRef<THREE.Mesh>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 2.5) * 0.015;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }

    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      if (status === "working") {
        const hue = (t * 0.1) % 1;
        mat.emissive.setHSL(hue, 0.8, 0.5);
        mat.emissiveIntensity = 1.5 + Math.sin(t * 4) * 0.5;
      } else {
        mat.emissive.set(color);
        mat.emissiveIntensity = status === "idle" ? 0.5 + Math.sin(t * 1.5) * 0.2 : 0.8;
      }
    }
    // Data orb orbiting when working
    if (dataOrbRef.current) {
      if (status === "working") {
        dataOrbRef.current.visible = true;
        const orbAngle = t * 3;
        dataOrbRef.current.position.set(
          Math.cos(orbAngle) * 0.3,
          Math.sin(t * 2) * 0.05,
          Math.sin(orbAngle) * 0.3
        );
      } else {
        dataOrbRef.current.visible = false;
      }
    }
    if (signalRingsRef.current) {
      if (status === "working") {
        signalRingsRef.current.visible = true;
        signalRingsRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const rt = (t * 2 + i * 0.8) % 2.5;
          const s = 0.25 + rt * 0.5;
          mesh.scale.setScalar(s);
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = Math.max(0, 0.6 - rt * 0.24);
        });
      } else if (status === "moving") {
        signalRingsRef.current.visible = true;
        signalRingsRef.current.children.forEach((child) => {
          const mesh = child as THREE.Mesh;
          mesh.scale.setScalar(0.2);
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = 0.3;
        });
      } else {
        signalRingsRef.current.visible = false;
      }
    }
    antennaTipsRef.current.forEach((mat, i) => {
      if (!mat) return;
      if (status === "working") {
        mat.emissiveIntensity = Math.sin(t * 6 + i * 2.1) > 0.3 ? 3 : 0.3;
      } else {
        mat.emissiveIntensity = 0.8;
      }
    });
    if (arcRef.current) {
      arcRef.current.visible = status === "working";
      if (status === "working") {
        arcRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          mesh.visible = Math.sin(t * 12 + i * 3.7) > 0.5;
        });
      }
    }
  });

  const antennaAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      {/* Crystalline core */}
      <mesh ref={coreRef} castShadow>
        <icosahedronGeometry args={[0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} metalness={0.4} roughness={0.2} toneMapped={false} />
      </mesh>
      {/* Inner core glow */}
      <mesh>
        <icosahedronGeometry args={[0.12]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.3}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <Bolt position={[0.1, 0.1, 0.1]} />
      <Bolt position={[-0.1, 0.1, 0.1]} />
      <Bolt position={[0, -0.15, 0.1]} />
      {/* Orbiting data orb (working) */}
      <mesh ref={dataOrbRef} visible={false}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      {/* Antennae */}
      {antennaAngles.map((angle, i) => {
        const dx = Math.cos(angle) * 0.15;
        const dz = Math.sin(angle) * 0.15;
        const tipDx = Math.cos(angle) * 0.32;
        const tipDz = Math.sin(angle) * 0.32;
        return (
          <group key={`ant-${i}`}>
            <JointSphere position={[dx, 0.05, dz]} size={0.02} />
            <mesh
              position={[(dx + tipDx) / 2, 0.08, (dz + tipDz) / 2]}
              rotation={[0, 0, Math.PI / 2 - 0.3]}
            >
              <cylinderGeometry args={[0.01, 0.01, 0.2, 4]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[tipDx, 0.12, tipDz]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial
                ref={(el) => { antennaTipsRef.current[i] = el; }}
                color={color}
                emissive={color}
                emissiveIntensity={0.8}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
      {/* Signal rings */}
      <group ref={signalRingsRef} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={`sg-${i}`} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.25, 0.01, 6, 20]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Lightning arcs */}
      <group ref={arcRef} visible={false}>
        {[0, 1, 2].map((i) => {
          const a1 = antennaAngles[i];
          const a2 = antennaAngles[(i + 1) % 3];
          const midX = (Math.cos(a1) * 0.32 + Math.cos(a2) * 0.32) / 2;
          const midZ = (Math.sin(a1) * 0.32 + Math.sin(a2) * 0.32) / 2;
          return (
            <mesh key={`arc-${i}`} position={[midX, 0.12, midZ]}>
              <sphereGeometry args={[0.02, 4, 4]} />
              <meshStandardMaterial color="#ffffff" emissive="#aaddff" emissiveIntensity={5} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ---- BROWSER (Web Nav drone -- dodecahedron shell) --------------------------

function BrowserModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const breatheRef = useRef<THREE.Group>(null);
  const orbitalRef = useRef<THREE.Group>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 2) * 0.012;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.y = t * (status === "working" ? 2 : 0.5);
      bodyRef.current.rotation.x = Math.sin(t * 1.5) * 0.1;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 3;
      ringRef.current.rotation.z = t * 2;
      ringRef.current.visible = status === "working";
    }
    // Orbital particles when working
    if (orbitalRef.current) {
      orbitalRef.current.visible = status === "working";
      if (status === "working") {
        orbitalRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const oAngle = t * 4 + i * (Math.PI * 2 / 3);
          mesh.position.set(
            Math.cos(oAngle) * 0.35,
            Math.sin(oAngle * 0.7) * 0.1,
            Math.sin(oAngle) * 0.35
          );
        });
      }
    }
  });

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      <mesh ref={bodyRef} castShadow>
        <dodecahedronGeometry args={[0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Face plates */}
      <mesh position={[0, 0, 0.22]}>
        <circleGeometry args={[0.08, 6]} />
        <meshStandardMaterial color="#1a1c28" metalness={0.85} roughness={0.2} />
      </mesh>
      <Bolt position={[0.15, 0.1, 0.1]} />
      <Bolt position={[-0.15, 0.1, 0.1]} />
      <Bolt position={[0, -0.18, 0.1]} />
      <ExhaustVent position={[0.1, 0, -0.18]} />
      <ExhaustVent position={[-0.1, 0, -0.18]} />
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[0.35, 0.015, 6, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      {/* Orbital data particles */}
      <group ref={orbitalRef} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={`orb-${i}`}>
            <boxGeometry args={[0.025, 0.025, 0.025]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---- SUPERVISOR (Warden) -- Amber patrol star --------------------------------

function SupervisorModel({ status, t, color, level }: { status: string; t: number; color: string; level: number }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const breatheRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  const scale = 0.9 + (level / 10) * 0.25;

  useFrame(() => {
    if (breatheRef.current) {
      const breathe = 1 + Math.sin(t * 2) * 0.012;
      breatheRef.current.scale.set(breathe * scale, breathe * scale, breathe * scale);
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.y = t * (status === "working" ? 3 : 0.8);
      bodyRef.current.rotation.z = Math.sin(t * 0.7) * 0.1;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2;
      ringRef.current.rotation.z = t * 1.5;
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = status === "working" ? 0.6 + Math.sin(t * 4) * 0.3 : 0.4;
    }
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 1.5 + Math.sin(t * 6) * 1.0;
      beaconRef.current.position.y = 0.32 + Math.sin(t * 2) * 0.02;
    }
    // Authority aura
    if (auraRef.current) {
      const mat = auraRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.opacity = status === "working"
          ? 0.12 + Math.sin(t * 2) * 0.05
          : 0.06;
      }
    }
  });

  return (
    <group ref={breatheRef}>
      <LevelRing level={level} color={color} />
      {/* Main body */}
      <mesh ref={bodyRef} castShadow>
        <octahedronGeometry args={[0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Inner glow */}
      <mesh>
        <octahedronGeometry args={[0.15]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={1.0}
          transparent
          opacity={0.2}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <Bolt position={[0.12, 0.12, 0.12]} />
      <Bolt position={[-0.12, 0.12, 0.12]} />
      <Bolt position={[0.12, -0.12, 0.12]} />
      <Bolt position={[-0.12, -0.12, 0.12]} />
      {/* Patrol ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.35, 0.018, 6, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* Beacon on top */}
      <mesh ref={beaconRef} position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* Authority spikes */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <mesh key={`spike-${i}`} position={[Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2]} rotation={[0, 0, angle + Math.PI / 2]}>
          <coneGeometry args={[0.035, 0.12, 4]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Authority aura */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
      <ExhaustVent position={[0.12, 0, -0.15]} />
      <ExhaustVent position={[-0.12, 0, -0.15]} />
    </group>
  );
}

// ---- MODEL DISPATCHER -------------------------------------------------------

function WorkerModel({ type, status, t, color, level }: { type: WorkerType; status: string; t: number; color: string; level: number }) {
  switch (type) {
    case "builder":
      return <BuilderModel status={status} t={t} color={color} level={level} />;
    case "inspector":
      return <InspectorModel status={status} t={t} color={color} level={level} />;
    case "miner":
      return <MinerModel status={status} t={t} color={color} level={level} />;
    case "scout":
      return <ScoutModel status={status} t={t} color={color} level={level} />;
    case "deployer":
      return <DeployerModel status={status} t={t} color={color} level={level} />;
    case "messenger":
      return <MessengerModel status={status} t={t} color={color} level={level} />;
    case "browser":
      return <BrowserModel status={status} t={t} color={color} level={level} />;
    case "supervisor":
      return <SupervisorModel status={status} t={t} color={color} level={level} />;
  }
}

// ---- CONSTRUCTION EFFECTS ---------------------------------------------------

function ConstructionEffects({
  building,
  color,
  t,
}: {
  building: Building;
  color: string;
  t: number;
}) {
  const scaffoldRef = useRef<THREE.Group>(null);

  const width = building.size * 1.5;
  const height = building.size * 1.0;
  const depth = building.size * 1.5;

  useFrame(() => {
    if (scaffoldRef.current) {
      scaffoldRef.current.children.forEach((child) => {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat) mat.opacity = 0.3 + Math.sin(t * 3) * 0.15;
      });
    }
  });

  const scaffoldPositions: [number, number, number][] = [
    [width / 2 + 0.1, 0, depth / 2 + 0.1],
    [-width / 2 - 0.1, 0, depth / 2 + 0.1],
    [width / 2 + 0.1, 0, -depth / 2 - 0.1],
    [-width / 2 - 0.1, 0, -depth / 2 - 0.1],
  ];

  return (
    <group position={[building.gridX, height / 2, building.gridY]}>
      <group ref={scaffoldRef}>
        {scaffoldPositions.map((pos, i) => (
          <mesh key={`scf-${i}`} position={pos}>
            <cylinderGeometry args={[0.015, 0.015, height + 0.4, 4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.4} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, height / 2 + 0.15, depth / 2 + 0.1]}>
          <boxGeometry args={[width + 0.2, 0.015, 0.015]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        <mesh position={[0, height / 2 + 0.15, -depth / 2 - 0.1]}>
          <boxGeometry args={[width + 0.2, 0.015, 0.015]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        <mesh position={[width / 2 + 0.1, height / 2 + 0.15, 0]}>
          <boxGeometry args={[0.015, 0.015, depth + 0.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        <mesh position={[-width / 2 - 0.1, height / 2 + 0.15, 0]}>
          <boxGeometry args={[0.015, 0.015, depth + 0.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---- WORK POSITION CALCULATOR -----------------------------------------------

function getWorkPosition(
  buildingX: number,
  buildingZ: number,
  buildingSize: number,
  workerIndex: number
): [number, number, number] {
  const offset = buildingSize * 0.9;
  const positions: [number, number, number][] = [
    [buildingX + offset, 0.5, buildingZ],
    [buildingX - offset, 0.5, buildingZ],
    [buildingX, 0.5, buildingZ + offset],
    [buildingX, 0.5, buildingZ - offset],
    [buildingX + offset * 0.7, 0.5, buildingZ + offset * 0.7],
    [buildingX - offset * 0.7, 0.5, buildingZ + offset * 0.7],
    [buildingX + offset * 0.7, 0.5, buildingZ - offset * 0.7],
    [buildingX - offset * 0.7, 0.5, buildingZ - offset * 0.7],
  ];
  return positions[workerIndex % positions.length];
}

// ---- HOVER TOOLTIP ----------------------------------------------------------

function WorkerHoverTooltip({
  worker,
  config,
}: {
  worker: Worker;
  config: { color: string; label: string };
}) {
  const building = BUILDINGS.find((b) => b.id === worker.currentBuildingId);
  const taskText =
    worker.task.length > 40 ? worker.task.slice(0, 40) + "..." : worker.task;

  return (
    <Html
      position={[0, 1.1, 0]}
      center
      transform
      occlude={false}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          background: "rgba(5, 5, 8, 0.94)",
          border: `1px solid ${config.color}44`,
          borderRadius: 4,
          padding: "8px 12px",
          whiteSpace: "nowrap",
          fontFamily: "'JetBrains Mono', monospace",
          userSelect: "none",
          boxShadow: `0 0 20px ${config.color}18, 0 4px 24px rgba(0,0,0,0.7)`,
          minWidth: 160,
          maxWidth: 220,
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Name + Level */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span
            style={{
              color: config.color,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textShadow: `0 0 8px ${config.color}`,
            }}
          >
            {worker.name}
          </span>
          <span
            style={{
              color: "#eab308",
              fontSize: 8,
              fontWeight: 700,
              background: "rgba(234, 179, 8, 0.12)",
              padding: "1px 4px",
              borderRadius: 2,
              border: "1px solid rgba(234, 179, 8, 0.3)",
            }}
          >
            Lv.{worker.level}
          </span>
        </div>

        {/* Type */}
        <div
          style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: 5,
          }}
        >
          {config.label}
        </div>

        {/* Current task */}
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.55)",
            marginBottom: 5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 200,
          }}
        >
          {taskText}
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
            marginBottom: 5,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${worker.progress}%`,
              background: `linear-gradient(90deg, ${config.color}66, ${config.color})`,
              borderRadius: 2,
              transition: "width 0.3s",
              boxShadow: `0 0 6px ${config.color}44`,
            }}
          />
        </div>

        {/* Bottom stats */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 8,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          <span>@ {building?.shortName || "\u2014"}</span>
          <span>{Math.round(worker.progress)}%</span>
          <span style={{ marginLeft: "auto", color: config.color + "88" }}>
            {worker.status === "working" ? "ACTIVE" : worker.status === "moving" ? "TRANSIT" : "IDLE"}
          </span>
        </div>
      </div>
    </Html>
  );
}

// ---- STANDUP GATHERING HELPER -----------------------------------------------

function getStandupGatherPosition(
  workerIndex: number,
  totalWorkers: number,
  commandCenterX: number,
  commandCenterZ: number,
): [number, number, number] {
  const radius = 3.5;
  const startAngle = -Math.PI * 0.6;
  const endAngle = Math.PI * 0.6;
  const angleStep = totalWorkers > 1 ? (endAngle - startAngle) / (totalWorkers - 1) : 0;
  const angle = startAngle + angleStep * workerIndex;

  return [
    commandCenterX + Math.cos(angle) * radius,
    0.5,
    commandCenterZ + Math.sin(angle) * radius,
  ];
}

// ---- MAIN WORKER 3D COMPONENT -----------------------------------------------

interface Worker3DProps {
  worker: Worker;
  buildings: Building[];
  allWorkers: Worker[];
  isSelected: boolean;
  onClick: (id: string) => void;
  isStandupActive?: boolean;
}

export function Worker3D({ worker, buildings, allWorkers, isSelected, onClick, isStandupActive }: Worker3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const positionRef = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  const timeRef = useRef(0);
  const facingAngleRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  const config = WORKER_TYPE_CONFIG[worker.type];

  const currentBuilding = buildings.find((b) => b.id === worker.currentBuildingId);
  const targetBuilding = buildings.find((b) => b.id === worker.targetBuildingId);

  const commandCenter = buildings.find((b) => b.id === "command-center");
  const workerStandupIndex = useMemo(() => {
    return allWorkers.findIndex((w) => w.id === worker.id);
  }, [allWorkers, worker.id]);

  const workingBuilding = worker.status === "working" ? (currentBuilding || targetBuilding) : null;

  const workerIndexAtBuilding = useMemo(() => {
    if (!workingBuilding) return 0;
    const workersAtSameBuilding = allWorkers.filter(
      (w) =>
        w.status === "working" &&
        (w.currentBuildingId === workingBuilding.id || w.targetBuildingId === workingBuilding.id)
    );
    const idx = workersAtSameBuilding.findIndex((w) => w.id === worker.id);
    return idx >= 0 ? idx : 0;
  }, [workingBuilding, allWorkers, worker.id]);

  const fromPos = useMemo(() => {
    if (!currentBuilding) return new THREE.Vector3(5, 0.5, 5);
    return new THREE.Vector3(currentBuilding.gridX, 0.5, currentBuilding.gridY);
  }, [currentBuilding]);

  const toPos = useMemo(() => {
    if (!targetBuilding) return new THREE.Vector3(5, 0.5, 5);
    return new THREE.Vector3(targetBuilding.gridX, 0.5, targetBuilding.gridY);
  }, [targetBuilding]);

  const baseY = worker.type === "scout" ? 1.2 : 0.5;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    const t = clock.getElapsedTime();
    timeRef.current = t;
    const progress = worker.progress / 100;

    let targetPos: THREE.Vector3;

    if (isStandupActive && commandCenter) {
      const [gx, gy, gz] = getStandupGatherPosition(
        workerStandupIndex,
        allWorkers.length,
        commandCenter.gridX,
        commandCenter.gridY
      );
      targetPos = _tmpV.set(gx, gy, gz);
      targetPos.y = baseY;
      facingAngleRef.current = Math.atan2(
        commandCenter.gridX - gx,
        commandCenter.gridY - gz
      );
    } else if (worker.status === "working" && workingBuilding) {
      const [wx, wy, wz] = getWorkPosition(
        workingBuilding.gridX,
        workingBuilding.gridY,
        workingBuilding.size,
        workerIndexAtBuilding
      );
      targetPos = _tmpV.set(wx, wy, wz);
      targetPos.y = baseY;

      facingAngleRef.current = Math.atan2(
        workingBuilding.gridX - wx,
        workingBuilding.gridY - wz
      );
    } else {
      targetPos = _tmpV.lerpVectors(fromPos, toPos, progress);
      targetPos.y = baseY;
    }

    if (!initialized.current) {
      positionRef.current.copy(targetPos);
      initialized.current = true;
    }

    // Smoother interpolation with ease-out
    const smoothFactor = 1 - Math.pow(0.0005, delta);
    positionRef.current.lerp(targetPos, smoothFactor);

    const bobSpeed = worker.status === "working" ? 4 : 2;
    const bobAmount = worker.status === "working" ? 0.08 : 0.05;
    const bob = Math.sin(t * bobSpeed + worker.id.charCodeAt(1) * 0.7) * bobAmount;

    groupRef.current.position.set(
      positionRef.current.x,
      positionRef.current.y + bob,
      positionRef.current.z
    );

    if (worker.status === "working") {
      const currentY = groupRef.current.rotation.y;
      let diff = facingAngleRef.current - currentY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      groupRef.current.rotation.y += diff * Math.min(1, delta * 5);
    } else {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <>
      <group ref={groupRef}>
        {/* Ground shadow/glow circle */}
        <mesh position={[0, -baseY + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[worker.status === "working" ? 0.5 : 0.4, 16]} />
          <meshStandardMaterial
            color={config.color}
            emissive={config.color}
            emissiveIntensity={worker.status === "working" ? 0.8 : 0.5}
            transparent
            opacity={worker.status === "working" ? 0.25 : 0.15}
            depthWrite={false}
          />
        </mesh>

        {/* Selection ring */}
        {isSelected && (
          <mesh position={[0, -baseY + 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.52, 16]} />
            <meshStandardMaterial
              color={config.color}
              emissive={config.color}
              emissiveIntensity={2}
              transparent
              opacity={0.8}
              toneMapped={false}
            />
          </mesh>
        )}

        {/* Worker model */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onClick(worker.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          <WorkerModel
            type={worker.type}
            status={worker.status}
            t={timeRef.current}
            color={config.color}
            level={worker.level}
          />
        </group>

        {/* Hover tooltip */}
        {hovered && !isSelected && (
          <WorkerHoverTooltip worker={worker} config={config} />
        )}

        {/* Main glow light */}
        <pointLight
          color={config.color}
          intensity={worker.status === "working" ? 1.2 : 0.6}
          distance={worker.status === "working" ? 3.5 : 2.5}
          decay={2}
        />

        {/* Pulsing glow sphere for active workers */}
        {worker.status === "working" && (
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshStandardMaterial
              color={config.color}
              emissive={config.color}
              emissiveIntensity={0.8}
              transparent
              opacity={0.1}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Floating label */}
        <Html
          position={[0, 0.55, 0]}
          center
          transform
          occlude={false}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              background: "rgba(5, 5, 8, 0.92)",
              border: `1px solid ${config.color}55`,
              borderRadius: 3,
              padding: "1px 6px",
              whiteSpace: "nowrap",
              fontFamily: "'JetBrains Mono', monospace",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
              boxShadow: `0 0 8px ${config.color}15`,
            }}
          >
            <span
              style={{
                color: config.color,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textShadow: `0 0 8px ${config.color}`,
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
            {worker.status === "working" && (
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 4px #22c55e",
                  display: "inline-block",
                }}
              />
            )}
          </div>
        </Html>

        {/* Speech bubble */}
        {worker.speechBubble && (
          <Html
            position={[0, 0.85, 0]}
            center
            transform
            occlude={false}
            style={{ pointerEvents: "none" }}
          >
            <div
              style={{
                background: "rgba(5, 5, 8, 0.95)",
                border: `1px solid ${config.color}33`,
                borderRadius: 4,
                padding: "3px 8px",
                whiteSpace: "nowrap",
                fontFamily: "'JetBrains Mono', monospace",
                userSelect: "none",
                boxShadow: `0 0 12px ${config.color}18`,
                position: "relative",
              }}
            >
              <span style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 7, letterSpacing: "0.03em" }}>
                {worker.speechBubble}
              </span>
              {/* Tail triangle */}
              <div
                style={{
                  position: "absolute",
                  bottom: -5,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "4px solid transparent",
                  borderRight: "4px solid transparent",
                  borderTop: `5px solid ${config.color}33`,
                }}
              />
            </div>
          </Html>
        )}
      </group>

      {/* Construction scaffolding */}
      {workingBuilding && (
        <ConstructionEffects building={workingBuilding} color={config.color} t={timeRef.current} />
      )}
    </>
  );
}
