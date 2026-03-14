"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Vector2 } from "three";

/**
 * Post-processing stack for the industrial sci-fi look.
 * Bloom makes emissive edges glow, vignette darkens edges,
 * chromatic aberration adds a subtle CRT/holographic feel.
 */
export function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.6}
        luminanceSmoothing={0.4}
        intensity={0.4}
        mipmapBlur
      />
      <Vignette
        offset={0.3}
        darkness={0.5}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
