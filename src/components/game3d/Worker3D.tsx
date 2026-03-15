"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Worker, WorkerType, Building } from "./types";
import { WORKER_TYPE_CONFIG } from "./constants";

// ---- SPARK POOL (reusable temp vectors) ------------------------------------

const _tmpV = new THREE.Vector3();

// ---- BUILDER (Forge) — Welding Mech ----------------------------------------

function BuilderModel({ status, t, color }: { status: string; t: number; color: string }) {
  const rightArmRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const hoverRef = useRef<THREE.Mesh>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);
  const visorRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (status === "working") {
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 6) * 0.8;
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(t * 6 + Math.PI) * 0.3;
      if (bodyRef.current) bodyRef.current.rotation.z = Math.sin(t * 3) * 0.05;
      if (sparkGroupRef.current) {
        sparkGroupRef.current.visible = true;
        sparkGroupRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const st = (t * 10 + i * 1.5) % 1.0;
          const angle = st * Math.PI * 4 + i * 2.1;
          mesh.position.set(
            0.25 + Math.cos(angle) * 0.1,
            -0.15 + st * 0.3,
            Math.sin(angle) * 0.1
          );
          const s = st < 0.5 ? 0.025 : 0.025 * (1 - (st - 0.5) * 2);
          mesh.scale.setScalar(Math.max(0.001, s));
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = st < 0.7 ? 1.0 : (1 - st) * 3.3;
        });
      }
      if (visorRef.current) visorRef.current.emissiveIntensity = 2.0 + Math.sin(t * 8) * 0.5;
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
      // Leg animation
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
    <group>
      {/* Body / torso */}
      <mesh ref={bodyRef} position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.3, 0.35, 0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.2, 0.15, 0.2]} />
        <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 0.37, 0.11]}>
        <boxGeometry args={[0.16, 0.04, 0.02]} />
        <meshStandardMaterial ref={visorRef} color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {/* Right arm (welding arm) */}
      <group ref={rightArmRef} position={[0.22, 0.15, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.25, 6]} />
          <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Welding torch tip */}
        <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.03, 0.08, 6]} />
          <meshStandardMaterial color="#fbbf24" emissive="#ff6600" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
      {/* Left arm */}
      <group ref={leftArmRef} position={[-0.22, 0.15, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.25, 6]} />
          <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      {/* Legs */}
      <mesh position={[0.08, -0.18, 0]}>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#3a3c48" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.08, -0.18, 0]}>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#3a3c48" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Hover pad */}
      <mesh ref={hoverRef} position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} toneMapped={false} />
      </mesh>
      {/* Welding sparks */}
      <group ref={sparkGroupRef} visible={false}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={`bs-${i}`}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial color="#fbbf24" emissive="#ff8800" emissiveIntensity={4} transparent opacity={0.9} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---- INSPECTOR (Lens) — Scanner Drone ---------------------------------------

function InspectorModel({ status, t, color }: { status: string; t: number; color: string }) {
  const sensorRingRef = useRef<THREE.Mesh>(null);
  const scannerRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const scanBeamRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (status === "working") {
      if (sensorRingRef.current) sensorRingRef.current.rotation.y = t * 5;
      if (bodyRef.current) bodyRef.current.rotation.y = t * 0.5;
      if (scanBeamRef.current) {
        scanBeamRef.current.visible = true;
        const mat = scanBeamRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.opacity = 0.4 + Math.sin(t * 6) * 0.3;
      }
    } else {
      if (sensorRingRef.current) sensorRingRef.current.rotation.y = t * 0.3;
      if (bodyRef.current) bodyRef.current.rotation.y = t * 0.15;
      if (scanBeamRef.current) scanBeamRef.current.visible = false;
    }
    if (status === "moving" && bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(t * 3) * 0.15;
    }
  });

  return (
    <group>
      {/* Body — flat diamond */}
      <mesh ref={bodyRef} castShadow>
        <octahedronGeometry args={[0.25]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Scanner housing underneath */}
      <mesh ref={scannerRef} position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.06, 0.04, 0.15, 6]} />
        <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Antenna spike on top */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.01, 0.02, 0.12, 4]} />
        <meshStandardMaterial color="#e2e8f0" emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Sensor ring */}
      <mesh ref={sensorRingRef} position={[0, 0, 0]}>
        <torusGeometry args={[0.32, 0.015, 6, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      {/* Scanner beam */}
      <mesh ref={scanBeamRef} position={[0, -0.55, 0]} visible={false}>
        <cylinderGeometry args={[0.02, 0.08, 0.6, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---- MINER (Digger) — Drill Rig --------------------------------------------

function MinerModel({ status, t, color }: { status: string; t: number; color: string }) {
  const drillRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const scoopRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.Group>(null);
  const treadLeftRef = useRef<THREE.Mesh>(null);
  const treadRightRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (status === "working") {
      if (drillRef.current) drillRef.current.rotation.y = t * 15;
      if (bodyRef.current) {
        bodyRef.current.position.x = Math.sin(t * 20) * 0.01;
        bodyRef.current.position.z = Math.cos(t * 25) * 0.01;
      }
      if (scoopRef.current) scoopRef.current.rotation.x = Math.sin(t * 3) * 0.3 - 0.2;
      if (debrisRef.current) {
        debrisRef.current.visible = true;
        debrisRef.current.children.forEach((child, i) => {
          const mesh = child as THREE.Mesh;
          const dt = (t * 5 + i * 1.3) % 1.5;
          mesh.position.set(
            Math.sin(i * 2.3) * 0.15,
            dt * 0.5,
            Math.cos(i * 2.3) * 0.15 + 0.15
          );
          const s = dt < 0.8 ? 0.02 : 0.02 * (1 - (dt - 0.8) / 0.7);
          mesh.scale.setScalar(Math.max(0.001, s));
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) mat.opacity = dt < 1.0 ? 0.8 : Math.max(0, (1.5 - dt) * 1.6);
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
    <group>
      <group ref={bodyRef}>
        {/* Main housing */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.2, 0.3, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Drill */}
        <mesh ref={drillRef} position={[0.12, -0.1, 0.12]} rotation={[0.3, 0, 0.3]}>
          <coneGeometry args={[0.08, 0.25, 6]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} emissive="#aaaaaa" emissiveIntensity={0.3} />
        </mesh>
        {/* Treads */}
        <mesh ref={treadLeftRef} position={[-0.15, -0.12, 0]}>
          <boxGeometry args={[0.06, 0.08, 0.35]} />
          <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh ref={treadRightRef} position={[0.15, -0.12, 0]}>
          <boxGeometry args={[0.06, 0.08, 0.35]} />
          <meshStandardMaterial color="#2a2c38" metalness={0.8} roughness={0.4} />
        </mesh>
        {/* Scoop */}
        <mesh ref={scoopRef} position={[0, -0.05, 0.22]}>
          <boxGeometry args={[0.2, 0.02, 0.1]} />
          <meshStandardMaterial color="#4a4c58" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Top exhaust */}
        <mesh position={[-0.08, 0.3, 0]}>
          <cylinderGeometry args={[0.03, 0.04, 0.1, 6]} />
          <meshStandardMaterial color="#3a3c48" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
      {/* Debris particles */}
      <group ref={debrisRef} visible={false}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={`db-${i}`}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#8B7355" : "#6b7280"}
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

// ---- SCOUT (Hawk) — Recon Drone ---------------------------------------------

function ScoutModel({ status, t, color }: { status: string; t: number; color: string }) {
  const radarRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftWingRef = useRef<THREE.Mesh>(null);
  const rightWingRef = useRef<THREE.Mesh>(null);
  const engineRef = useRef<THREE.Mesh>(null);
  const scanRingsRef = useRef<THREE.Group>(null);

  useFrame(() => {
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
    } else {
      if (leftWingRef.current) leftWingRef.current.rotation.z = -0.05;
      if (rightWingRef.current) rightWingRef.current.rotation.z = 0.05;
      if (bodyRef.current) bodyRef.current.rotation.z = 0;
    }
  });

  return (
    <group>
      <group ref={bodyRef}>
        {/* Stealth body — flat cone */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.15, 0.4, 3]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Left wing */}
        <mesh ref={leftWingRef} position={[-0.2, 0, 0]} rotation={[0, 0, -0.05]}>
          <boxGeometry args={[0.25, 0.015, 0.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Right wing */}
        <mesh ref={rightWingRef} position={[0.2, 0, 0]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[0.25, 0.015, 0.2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Radar dome on top */}
        <mesh ref={radarRef} position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#e2e8f0" emissive={color} emissiveIntensity={1} toneMapped={false} />
        </mesh>
        {/* Engine at rear */}
        <mesh ref={engineRef} position={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.05, 0.04, 0.08, 6]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>
      {/* Scan rings (working only) */}
      <group ref={scanRingsRef} visible={false} position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={`sr-${i}`}>
            <torusGeometry args={[0.3, 0.008, 6, 24]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---- DEPLOYER (Rocket) — Launch Platform ------------------------------------

function DeployerModel({ status, t, color }: { status: string; t: number; color: string }) {
  const bodyRef = useRef<THREE.Group>(null);
  const nozzleRef = useRef<THREE.Mesh>(null);
  const payloadRef = useRef<THREE.Mesh>(null);
  const exhaustRef = useRef<THREE.Group>(null);
  const steamRef = useRef<THREE.Group>(null);

  useFrame(() => {
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
    // Idle steam
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
      bodyRef.current.rotation.x = Math.PI / 2; // Horizontal flight
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
    <group>
      <group ref={bodyRef}>
        {/* Rocket body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.14, 0.5, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Nose cone */}
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.1, 0.15, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Payload */}
        <mesh ref={payloadRef} position={[0, 0.35, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.06]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} toneMapped={false} />
        </mesh>
        {/* Fins */}
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
        {/* Exhaust particles */}
        <group ref={exhaustRef} visible={false}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={`ex-${i}`}>
              <sphereGeometry args={[1, 4, 4]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#ff6600" : "#ff2200"}
                emissive={i % 2 === 0 ? "#ff6600" : "#ff2200"}
                emissiveIntensity={3}
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

// ---- MESSENGER (Spark) — Communication Relay --------------------------------

function MessengerModel({ status, t, color }: { status: string; t: number; color: string }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const signalRingsRef = useRef<THREE.Group>(null);
  const antennaTipsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const arcRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      if (status === "working") {
        // Color shifting
        const hue = (t * 0.1) % 1;
        mat.emissive.setHSL(hue, 0.8, 0.5);
        mat.emissiveIntensity = 1.5 + Math.sin(t * 4) * 0.5;
      } else {
        mat.emissive.set(color);
        mat.emissiveIntensity = status === "idle" ? 0.5 + Math.sin(t * 1.5) * 0.2 : 0.8;
      }
    }
    // Signal rings
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
    // Antenna tip blinking
    antennaTipsRef.current.forEach((mat, i) => {
      if (!mat) return;
      if (status === "working") {
        mat.emissiveIntensity = Math.sin(t * 6 + i * 2.1) > 0.3 ? 3 : 0.3;
      } else {
        mat.emissiveIntensity = 0.8;
      }
    });
    // Lightning arcs
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
    <group>
      {/* Crystalline core */}
      <mesh ref={coreRef} castShadow>
        <icosahedronGeometry args={[0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} metalness={0.4} roughness={0.2} toneMapped={false} />
      </mesh>
      {/* Antennae */}
      {antennaAngles.map((angle, i) => {
        const dx = Math.cos(angle) * 0.15;
        const dz = Math.sin(angle) * 0.15;
        const tipDx = Math.cos(angle) * 0.32;
        const tipDz = Math.sin(angle) * 0.32;
        return (
          <group key={`ant-${i}`}>
            {/* Antenna rod */}
            <mesh
              position={[(dx + tipDx) / 2, 0.08, (dz + tipDz) / 2]}
              rotation={[0, 0, Math.PI / 2 - 0.3]}
            >
              <cylinderGeometry args={[0.008, 0.008, 0.2, 4]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Antenna tip */}
            <mesh position={[tipDx, 0.12, tipDz]}>
              <sphereGeometry args={[0.025, 6, 6]} />
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
            <torusGeometry args={[0.25, 0.008, 6, 20]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Lightning arcs between antennae */}
      <group ref={arcRef} visible={false}>
        {[0, 1, 2].map((i) => {
          const a1 = antennaAngles[i];
          const a2 = antennaAngles[(i + 1) % 3];
          const midX = (Math.cos(a1) * 0.32 + Math.cos(a2) * 0.32) / 2;
          const midZ = (Math.sin(a1) * 0.32 + Math.sin(a2) * 0.32) / 2;
          return (
            <mesh key={`arc-${i}`} position={[midX, 0.12, midZ]}>
              <sphereGeometry args={[0.015, 4, 4]} />
              <meshStandardMaterial color="#ffffff" emissive="#aaddff" emissiveIntensity={5} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ---- BROWSER (fallback — dodecahedron shell) --------------------------------

function BrowserModel({ status, t, color }: { status: string; t: number; color: string }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (bodyRef.current) {
      bodyRef.current.rotation.y = t * (status === "working" ? 2 : 0.5);
      bodyRef.current.rotation.x = Math.sin(t * 1.5) * 0.1;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 3;
      ringRef.current.rotation.z = t * 2;
      ringRef.current.visible = status === "working";
    }
  });

  return (
    <group>
      <mesh ref={bodyRef} castShadow>
        <dodecahedronGeometry args={[0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh ref={ringRef} visible={false}>
        <torusGeometry args={[0.35, 0.012, 6, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---- SUPERVISOR (Warden) — Amber patrol star --------------------------------

function SupervisorModel({ status, t, color }: { status: string; t: number; color: string }) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (bodyRef.current) {
      // Slow authoritative rotation — the foreman surveys
      bodyRef.current.rotation.y = t * (status === "working" ? 3 : 0.8);
      bodyRef.current.rotation.z = Math.sin(t * 0.7) * 0.1;
    }
    if (ringRef.current) {
      // Patrol ring always visible, pulses when working
      ringRef.current.rotation.x = Math.PI / 2;
      ringRef.current.rotation.z = t * 1.5;
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = status === "working" ? 0.6 + Math.sin(t * 4) * 0.3 : 0.4;
    }
    if (beaconRef.current) {
      // Amber beacon on top pulses like a warning light
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 1.5 + Math.sin(t * 6) * 1.0;
      beaconRef.current.position.y = 0.32 + Math.sin(t * 2) * 0.02;
    }
  });

  // Create star shape via two intersecting tetrahedra (Star of David / merkaba)
  return (
    <group>
      {/* Main body — octahedron stretched into a star-like shape */}
      <mesh ref={bodyRef} castShadow>
        <octahedronGeometry args={[0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Patrol ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.35, 0.015, 6, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* Beacon on top — amber warning light */}
      <mesh ref={beaconRef} position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* Authority spikes — 4 small cones pointing outward */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
        <mesh key={`spike-${i}`} position={[Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2]} rotation={[0, 0, angle + Math.PI / 2]}>
          <coneGeometry args={[0.03, 0.1, 4]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// ---- MODEL DISPATCHER -------------------------------------------------------

function WorkerModel({ type, status, t, color }: { type: WorkerType; status: string; t: number; color: string }) {
  switch (type) {
    case "builder":
      return <BuilderModel status={status} t={t} color={color} />;
    case "inspector":
      return <InspectorModel status={status} t={t} color={color} />;
    case "miner":
      return <MinerModel status={status} t={t} color={color} />;
    case "scout":
      return <ScoutModel status={status} t={t} color={color} />;
    case "deployer":
      return <DeployerModel status={status} t={t} color={color} />;
    case "messenger":
      return <MessengerModel status={status} t={t} color={color} />;
    case "browser":
      return <BrowserModel status={status} t={t} color={color} />;
    case "supervisor":
      return <SupervisorModel status={status} t={t} color={color} />;
  }
}

// ---- CONSTRUCTION EFFECTS (scaffolding + progress bar at buildings) ---------

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
    // Vertical bars at corners
    [width / 2 + 0.1, 0, depth / 2 + 0.1],
    [-width / 2 - 0.1, 0, depth / 2 + 0.1],
    [width / 2 + 0.1, 0, -depth / 2 - 0.1],
    [-width / 2 - 0.1, 0, -depth / 2 - 0.1],
  ];

  return (
    <group position={[building.gridX, height / 2, building.gridY]}>
      {/* Scaffolding lines */}
      <group ref={scaffoldRef}>
        {scaffoldPositions.map((pos, i) => (
          <mesh key={`scf-${i}`} position={pos}>
            <cylinderGeometry args={[0.015, 0.015, height + 0.4, 4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.4} toneMapped={false} />
          </mesh>
        ))}
        {/* Horizontal bars */}
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

// ---- SINGLE WORKER 3D COMPONENT ---------------------------------------------

interface Worker3DProps {
  worker: Worker;
  buildings: Building[];
  isSelected: boolean;
  onClick: (id: string) => void;
}

export function Worker3D({ worker, buildings, isSelected, onClick }: Worker3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const positionRef = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  const timeRef = useRef(0);

  const config = WORKER_TYPE_CONFIG[worker.type];

  const currentBuilding = buildings.find((b) => b.id === worker.currentBuildingId);
  const targetBuilding = buildings.find((b) => b.id === worker.targetBuildingId);

  // Building the worker is actively working at
  const workingBuilding = worker.status === "working" ? (currentBuilding || targetBuilding) : null;

  const fromPos = useMemo(() => {
    if (!currentBuilding) return new THREE.Vector3(5, 0.5, 5);
    return new THREE.Vector3(currentBuilding.gridX, 0.5, currentBuilding.gridY);
  }, [currentBuilding]);

  const toPos = useMemo(() => {
    if (!targetBuilding) return new THREE.Vector3(5, 0.5, 5);
    return new THREE.Vector3(targetBuilding.gridX, 0.5, targetBuilding.gridY);
  }, [targetBuilding]);

  // Worker height depends on type (scout flies higher)
  const baseY = worker.type === "scout" ? 1.2 : 0.5;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.getElapsedTime();
    timeRef.current = t;
    const progress = worker.progress / 100;

    const targetPos = new THREE.Vector3().lerpVectors(fromPos, toPos, progress);
    targetPos.y = baseY;

    if (!initialized.current) {
      positionRef.current.copy(targetPos);
      initialized.current = true;
    }

    positionRef.current.lerp(targetPos, 0.08);

    // Hover bob
    const bobSpeed = worker.status === "working" ? 4 : 2;
    const bobAmount = worker.status === "working" ? 0.08 : 0.05;
    const bob = Math.sin(t * bobSpeed + worker.id.charCodeAt(1) * 0.7) * bobAmount;

    // For working workers, offset from the building so they're visible next to it
    let workOffset = 0;
    if (worker.status === "working" && workingBuilding) {
      workOffset = workingBuilding.size * 0.9;
    }

    groupRef.current.position.set(
      positionRef.current.x + (worker.status === "working" ? workOffset : 0),
      positionRef.current.y + bob,
      positionRef.current.z
    );

    // Slow rotation when not working
    if (worker.status !== "working") {
      groupRef.current.rotation.y += 0.008;
    }
  });

  return (
    <>
      <group ref={groupRef}>
        {/* Ground shadow/glow circle */}
        <mesh position={[0, -baseY + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.4, 16]} />
          <meshStandardMaterial
            color={config.color}
            emissive={config.color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.15}
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

        {/* Worker model — clickable wrapper */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onClick(worker.id);
          }}
        >
          <WorkerModel type={worker.type} status={worker.status} t={timeRef.current} color={config.color} />
        </group>

        {/* Main glow light */}
        <pointLight color={config.color} intensity={0.6} distance={2.5} decay={2} />

        {/* Floating label */}
        <Html
          position={[0, 0.55, 0]}
          center
          transform={false}
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
            position={[0, 0.85, 0]}
            center
            transform={false}
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
              <span style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: 7 }}>
                {worker.speechBubble}
              </span>
            </div>
          </Html>
        )}
      </group>

      {/* Construction scaffolding at the building the worker is constructing at */}
      {workingBuilding && (
        <ConstructionEffects building={workingBuilding} color={config.color} t={timeRef.current} />
      )}
    </>
  );
}
