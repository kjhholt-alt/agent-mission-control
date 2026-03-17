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
import { BuildingSparkles, CompletionBursts, SpawnRingEffects, TaskParticleSystem } from "./ParticleEffects";
import { SelectionRing } from "./SelectionRing";
import { ForceField3D } from "./ForceField3D";
import { Pipes3D } from "./Pipes3D";
import { Environment3D } from "./Environment3D";
import { BUILDINGS as DEFAULT_BUILDINGS, CONVEYORS as DEFAULT_CONVEYORS } from "./constants";
import type { Worker, Building, ConveyorBelt } from "./types";

interface GameCanvasProps {
  hoveredBuilding: string | null;
  selectedBuilding: string | null;
  selectedWorker: string | null;
  workers: Worker[];
  buildings?: Building[];
  conveyors?: ConveyorBelt[];
  onHoverBuilding: (id: string | null) => void;
  onClickBuilding: (id: string) => void;
  onClickWorker: (id: string) => void;
  isMobile?: boolean;
  isStandupActive?: boolean;
}

/**
 * Main React Three Fiber canvas for the Nexus game view.
 * Factorio-style factory floor with industrial lighting, fog,
 * buildings, workers, conveyor belts, pipes, environment details.
 */
export default function GameCanvas({
  hoveredBuilding,
  selectedBuilding,
  selectedWorker,
  workers,
  buildings: buildingsProp,
  conveyors: conveyorsProp,
  onHoverBuilding,
  onClickBuilding,
  onClickWorker,
  isMobile,
  isStandupActive,
}: GameCanvasProps) {
  const BUILDINGS = buildingsProp || DEFAULT_BUILDINGS;
  const CONVEYORS = conveyorsProp || DEFAULT_CONVEYORS;

  const handlePointerMissed = useCallback(() => {
    onClickBuilding("");
  }, [onClickBuilding]);

  const selectedBuildingData = selectedBuilding
    ? BUILDINGS.find((b) => b.id === selectedBuilding)
    : null;

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

  const activeBelts = useMemo(
    () => (isMobile ? CONVEYORS.filter((b) => b.active).slice(0, 4) : CONVEYORS),
    [isMobile, CONVEYORS]
  );

  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      frameloop="always"
      dpr={[1, 2]}
      performance={{ min: 0.5 }}
      shadows={!isMobile}
      style={{ background: "#050508" }}
      onPointerMissed={handlePointerMissed}
    >
      {/* Isometric camera */}
      <OrthographicCamera
        makeDefault
        position={[30, 30, 30]}
        zoom={25}
        near={0.1}
        far={300}
      />

      {/* Camera controls: smooth pan + zoom with improved responsiveness */}
      <OrbitControls
        enableRotate={false}
        enablePan={true}
        enableZoom={true}
        target={[15, 0, 15]}
        minZoom={15}
        maxZoom={80}
        panSpeed={1.5}
        zoomSpeed={1.2}
        mouseButtons={{
          LEFT: 2,
          MIDDLE: 1,
          RIGHT: 2,
        }}
        enableDamping
        dampingFactor={0.08}
        screenSpacePanning={true}
      />

      {/* Enhanced industrial fog — deeper atmosphere */}
      <fog attach="fog" args={["#050508", 25, 95]} />

      {/* Hemisphere light — industrial: dark blue sky, warm orange ground */}
      <hemisphereLight
        args={["#1a2448", "#2a1808", 0.5]}
      />

      {/* Ambient fill — enhanced warm industrial tint */}
      <ambientLight intensity={0.4} color="#ffe8d0" />

      {/* Primary directional — brighter warm industrial light */}
      <directionalLight
        position={[18, 15, 18]}
        intensity={0.9}
        color="#ffead0"
        castShadow={!isMobile}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={85}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0001}
      />

      {/* Secondary warm fill from the other side — enhanced */}
      <directionalLight
        position={[-5, 6, -5]}
        intensity={0.35}
        color="#ffcc88"
      />

      {/* Enhanced cool rim light for depth */}
      <directionalLight
        position={[0, -3, -10]}
        intensity={0.12}
        color="#06b6d4"
      />

      {/* Factory floor overhead lights — brighter for better visibility */}
      <directionalLight
        position={[15, 18, 15]}
        intensity={0.25}
        color="#ffe8c0"
      />

      {/* Additional accent light for active areas */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.2}
        color="#10b981"
      />

      {/* Ground plane — factory floor */}
      <Ground />

      {/* Force field dome (skip on mobile) */}
      {!isMobile && <ForceField3D />}

      {/* Industrial pipes between buildings */}
      <Pipes3D />

      {/* Conveyor belts */}
      {CONVEYORS.map((belt) => (
        <ConveyorBelt3D
          key={belt.id}
          belt={belt}
          buildings={BUILDINGS}
        />
      ))}

      {/* Data packets flowing along belts */}
      <DataPackets belts={activeBelts} buildings={BUILDINGS} />

      {/* Environmental decorations — crates, barrels, poles, carts */}
      <Environment3D />

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
          allWorkers={workers}
          isSelected={selectedWorker === worker.id}
          onClick={onClickWorker}
          isStandupActive={isStandupActive}
        />
      ))}

      {/* Building sparkles */}
      <BuildingSparkles buildings={BUILDINGS} isMobile={isMobile} />

      {/* Task particle system — floating status indicators */}
      <TaskParticleSystem
        workers={workers}
        buildings={BUILDINGS}
        isMobile={isMobile}
      />

      {/* Completion burst effects */}
      <CompletionBursts workers={workers} buildings={BUILDINGS} />

      {/* Spawn ring effects */}
      <SpawnRingEffects workers={workers} buildings={BUILDINGS} />

      {/* Post-processing: bloom, chromatic aberration, vignette */}
      <PostProcessing />
    </Canvas>
  );
}
