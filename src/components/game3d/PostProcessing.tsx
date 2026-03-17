"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  SMAA,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

/**
 * Post-processing stack for cinematic industrial sci-fi look.
 * - Bloom: dramatic glow on emissive edges and accent lights
 * - Noise: subtle film grain for cinematic texture
 * - Vignette: strong edge darkening for focus
 * - SMAA: sub-pixel morphological anti-aliasing (cheap, effective)
 * - ToneMapping: ACES filmic for rich contrast and color
 */
export function PostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      {/* Bloom — lower threshold catches more emissive glow, higher intensity */}
      <Bloom
        luminanceThreshold={0.35}
        luminanceSmoothing={0.6}
        intensity={0.7}
        mipmapBlur
      />

      {/* Film grain — very subtle, adds tactile cinematic quality */}
      <Noise
        blendFunction={BlendFunction.SOFT_LIGHT}
        opacity={0.18}
      />

      {/* Vignette — stronger darkening pulls focus to center */}
      <Vignette
        offset={0.25}
        darkness={0.7}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* SMAA anti-aliasing — smooths jagged edges without MSAA cost */}
      <SMAA />

      {/* ACES filmic tone mapping — rich contrast, cinematic color response */}
      <ToneMapping />
    </EffectComposer>
  );
}
