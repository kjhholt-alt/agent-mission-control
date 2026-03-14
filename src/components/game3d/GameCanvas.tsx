"use client";

import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls } from "@react-three/drei";
import { Ground } from "./Ground";
import { Building3D } from "./Building3D";
import { CommandCenter3D } from "./CommandCenter3D";
import { PostProcessing } from "./PostProcessing";
import { BUILDINGS } from "./constants";

interface GameCanvasProps {
  hoveredBuilding: string | null;
  selectedBuilding: string | null;
  onHoverBuilding: (id: string | null) => void;
  onClickBuilding: (id: string) => void;
}

/**
 * Main React Three Fiber canvas for the Nexus game view.
 * Isometric camera, industrial lighting, buildings with glowing edges.
 */
export default function GameCanvas({
  hoveredBuilding,
  selectedBuilding,
  onHoverBuilding,
  onClickBuilding,
}: GameCanvasProps) {
  const handlePointerMissed = useCallback(() => {
    onClickBuilding("");
  }, [onClickBuilding]);

  return (
    <Canvas
      gl={{ antialias: true, alpha: false }}
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
        castShadow
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

      {/* Post-processing: bloom, chromatic aberration, vignette */}
      <PostProcessing />
    </Canvas>
  );
}
