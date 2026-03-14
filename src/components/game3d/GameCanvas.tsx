"use client";

import { useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls } from "@react-three/drei";
import { Ground } from "./Ground";
import { Building3D } from "./Building3D";
import { CommandCenter3D } from "./CommandCenter3D";
import { PostProcessing } from "./PostProcessing";
import { Worker3D } from "./Worker3D";
import { ConveyorBelt3D } from "./ConveyorBelt3D";
import { DataPackets } from "./DataPackets";
import { BuildingSparkles, CompletionBursts, SpawnRingEffects } from "./ParticleEffects";
import { SelectionRing } from "./SelectionRing";
import { ForceField3D } from "./ForceField3D";
import { BUILDINGS, CONVEYORS } from "./constants";
import type { Worker } from "./types";

interface GameCanvasProps {
  hoveredBuilding: string | null;
  selectedBuilding: string | null;
  selectedWorker: string | null;
  workers: Worker[];
  onHoverBuilding: (id: string | null) => void;
  onClickBuilding: (id: string) => void;
  onClickWorker: (id: string) => void;
  isMobile?: boolean;
}

/**
 * Main React Three Fiber canvas for the Nexus game view.
 * Isometric camera, industrial lighting, buildings, workers,
 * conveyor belts, data packets, particles, force field.
 */
export default function GameCanvas({
  hoveredBuilding,
  selectedBuilding,
  selectedWorker,
  workers,
  onHoverBuilding,
  onClickBuilding,
  onClickWorker,
  isMobile,
}: GameCanvasProps) {
  const handlePointerMissed = useCallback(() => {
    onClickBuilding("");
  }, [onClickBuilding]);

  // Find selected building position for selection ring
  const selectedBuildingData = selectedBuilding
    ? BUILDINGS.find((b) => b.id === selectedBuilding)
    : null;

  // Find selected worker position for selection ring
  const selectedWorkerPosition = useMemo((): {
    position: [number, number, number];
    color: string;
  } | null => {
    if (!selectedWorker) return null;
    const worker = workers.find((w) => w.id === selectedWorker);
    if (!worker) return null;

    const currentBuilding = BUILDINGS.find(
      (b) => b.id === worker.currentBuildingId
    );
    const targetBuilding = BUILDINGS.find(
      (b) => b.id === worker.targetBuildingId
    );
    if (!currentBuilding || !targetBuilding) return null;

    const progress = worker.progress / 100;
    const x =
      currentBuilding.gridX +
      (targetBuilding.gridX - currentBuilding.gridX) * progress;
    const z =
      currentBuilding.gridY +
      (targetBuilding.gridY - currentBuilding.gridY) * progress;

    return { position: [x, 0.02, z], color: worker.color };
  }, [selectedWorker, workers]);

  // Mobile: reduce data packet count
  const activeBelts = useMemo(
    () => (isMobile ? CONVEYORS.filter((b) => b.active).slice(0, 4) : CONVEYORS),
    [isMobile]
  );

  return (
    <Canvas
      gl={{ antialias: true, alpha: false }}
      shadows={!isMobile}
      style={{ background: "#050508" }}
      onPointerMissed={handlePointerMissed}
    >
      {/* Isometric camera */}
      <OrthographicCamera
        makeDefault
        position={[15, 15, 15]}
        zoom={40}
        near={0.1}
        far={200}
      />

      {/* Camera controls: pan + zoom only, no rotation */}
      <OrbitControls
        enableRotate={false}
        enablePan={true}
        enableZoom={true}
        target={[7, 0, 7]}
        minZoom={20}
        maxZoom={80}
        panSpeed={1.2}
        zoomSpeed={0.8}
        mouseButtons={{
          LEFT: 2,   // PAN on left-click drag
          MIDDLE: 1, // DOLLY on middle-click
          RIGHT: 2,  // PAN on right-click drag
        }}
        enableDamping
        dampingFactor={0.1}
      />

      {/* Ambient fill -- dim, lets emissives pop */}
      <ambientLight intensity={0.4} color="#ffffff" />

      {/* Primary directional -- slight blue tint for StarCraft feel */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.8}
        color="#d0d8ff"
        castShadow={!isMobile}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Warm fill from the other side */}
      <directionalLight
        position={[-3, 5, -3]}
        intensity={0.3}
        color="#ffe0b0"
      />

      {/* Subtle rim light from below-behind */}
      <directionalLight
        position={[0, -2, -8]}
        intensity={0.1}
        color="#06b6d4"
      />

      {/* Ground plane */}
      <Ground />

      {/* Force field dome (skip on mobile) */}
      {!isMobile && <ForceField3D />}

      {/* Conveyor belts (under everything else) */}
      {CONVEYORS.map((belt) => (
        <ConveyorBelt3D
          key={belt.id}
          belt={belt}
          buildings={BUILDINGS}
        />
      ))}

      {/* Data packets flowing along belts */}
      <DataPackets belts={activeBelts} buildings={BUILDINGS} />

      {/* Buildings */}
      {BUILDINGS.map((building) =>
        building.id === "command-center" ? (
          <CommandCenter3D
            key={building.id}
            building={building}
            isHovered={hoveredBuilding === building.id}
            isSelected={selectedBuilding === building.id}
            onHover={onHoverBuilding}
            onClick={onClickBuilding}
          />
        ) : (
          <Building3D
            key={building.id}
            building={building}
            isHovered={hoveredBuilding === building.id}
            isSelected={selectedBuilding === building.id}
            onHover={onHoverBuilding}
            onClick={onClickBuilding}
          />
        )
      )}

      {/* Selection ring under selected building */}
      {selectedBuildingData && (
        <SelectionRing
          position={[selectedBuildingData.gridX, 0.02, selectedBuildingData.gridY]}
          color={selectedBuildingData.color}
        />
      )}

      {/* Selection ring under selected worker */}
      {selectedWorkerPosition && (
        <SelectionRing
          position={selectedWorkerPosition.position}
          color={selectedWorkerPosition.color}
        />
      )}

      {/* Workers */}
      {workers.map((worker) => (
        <Worker3D
          key={worker.id}
          worker={worker}
          buildings={BUILDINGS}
          isSelected={selectedWorker === worker.id}
          onClick={onClickWorker}
        />
      ))}

      {/* Building sparkles */}
      <BuildingSparkles buildings={BUILDINGS} isMobile={isMobile} />

      {/* Completion burst effects */}
      <CompletionBursts workers={workers} buildings={BUILDINGS} />

      {/* Spawn ring effects */}
      <SpawnRingEffects workers={workers} buildings={BUILDINGS} />

      {/* Post-processing: bloom, chromatic aberration, vignette */}
      <PostProcessing />
    </Canvas>
  );
}
