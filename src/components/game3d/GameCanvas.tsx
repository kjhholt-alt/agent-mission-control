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
 * Cinematic industrial factory floor with volumetric-feel lighting,
 * atmospheric fog, buildings, workers, conveyor belts, pipes.
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
  }, [selectedWorker, workers, BUILDINGS]);

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
      style={{ background: "#030305" }}
      onPointerMissed={handlePointerMissed}
    >
      {/* Dramatic isometric camera — slightly lower angle with tilt for depth */}
      <OrthographicCamera
        makeDefault
        position={[28, 35, 32]}
        zoom={25}
        near={0.1}
        far={400}
      />

      {/* Camera controls: smooth pan + zoom */}
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
        dampingFactor={0.06}
        screenSpacePanning={true}
      />

      {/* Deep atmospheric fog — dark navy-black with slow falloff */}
      <fog attach="fog" args={["#020308", 20, 110]} />

      {/* Hemisphere light — deep blue sky, warm amber ground bounce */}
      <hemisphereLight args={["#0a1030", "#1a0f04", 0.45]} />

      {/* Ambient fill — very subtle warm wash so nothing is pure black */}
      <ambientLight intensity={0.25} color="#ffe0c0" />

      {/* Primary key light — warm industrial overhead, strong shadows */}
      <directionalLight
        position={[20, 18, 22]}
        intensity={1.0}
        color="#ffe4c8"
        castShadow={!isMobile}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={100}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0001}
      />

      {/* Secondary warm fill — softer, from opposite side */}
      <directionalLight
        position={[-8, 8, -8]}
        intensity={0.25}
        color="#ffbb77"
      />

      {/* Cyan rim light — cool edge highlight from below-right for sci-fi depth */}
      <directionalLight
        position={[-2, -4, -12]}
        intensity={0.18}
        color="#06b6d4"
      />

      {/* Overhead factory fluorescent — slightly greenish-white */}
      <directionalLight
        position={[15, 22, 15]}
        intensity={0.2}
        color="#e0ecd8"
      />

      {/* Emerald accent — low from the left, hits building edges */}
      <directionalLight
        position={[2, 6, 28]}
        intensity={0.12}
        color="#10b981"
      />

      {/* Amber accent — warm industrial glow from far side */}
      <directionalLight
        position={[30, 4, 2]}
        intensity={0.1}
        color="#e8a019"
      />

      {/* Cyan point light — pooled glow near center, simulates overhead hologram */}
      <pointLight
        position={[15, 8, 15]}
        intensity={0.6}
        color="#06b6d4"
        distance={30}
        decay={2}
      />

      {/* Warm point light — distant factory glow */}
      <pointLight
        position={[4, 3, 4]}
        intensity={0.3}
        color="#e8a019"
        distance={20}
        decay={2}
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

      {/* Post-processing: bloom, noise, vignette, SMAA, tone mapping */}
      <PostProcessing />
    </Canvas>
  );
}
