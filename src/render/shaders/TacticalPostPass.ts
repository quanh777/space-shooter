import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {
  GLSL3_COLOR_AND_SHADING,
  GLSL3_COMMON_AND_HASH,
  GLSL3_POST_AND_TONEMAP,
} from './shaderLib';

// Screen-space shockwaves, speed blur, impact contrast snap, film grain, AgX tonemap, and dithering.
export function createTacticalPostPass(): ShaderPass {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(1280, 800) },
      uFrame: { value: 0 },
      uTime: { value: 0 },
      uQualityTier: { value: 2 },
      uEmissiveGlowBoost: { value: 0.0 },
      uChromaStrength: { value: 0 },
      uDamageFlash: { value: 0 },
      uLowHpPulse: { value: 0 },
      uOverdrive: { value: 0.0 },
      uOverdriveColor: { value: new THREE.Color(0xffb833) },
      uBulletTime: { value: 0.0 },
      uWarpSpeed: { value: 0.0 },
      uHitPulse: { value: 0.0 },
      uShockOriginUv: { value: new THREE.Vector2(0.5, 0.5) },
      uShockProgress: { value: 1.0 },
      uShocks: {
        value: [
          new THREE.Vector4(0.5, 0.5, 1.0, 0.0),
          new THREE.Vector4(0.5, 0.5, 1.0, 0.0),
          new THREE.Vector4(0.5, 0.5, 1.0, 0.0),
        ],
      },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_COLOR_AND_SHADING}
      ${GLSL3_POST_AND_TONEMAP}

      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform int uFrame;
      uniform float uTime;
      uniform int uQualityTier;
      uniform float uEmissiveGlowBoost;
      uniform float uChromaStrength;
      uniform float uDamageFlash;
      uniform float uLowHpPulse;
      uniform float uOverdrive;
      uniform vec3 uOverdriveColor;
      uniform float uBulletTime;
      uniform float uWarpSpeed;
      uniform float uHitPulse;
      uniform vec2 uShockOriginUv;
      uniform float uShockProgress;
      uniform vec4 uShocks[3];

      in vec2 vUv;
      out vec4 fragColor;

      void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / max(uResolution.y, 1.0);

        // Shockwave refraction ripples across the screen when something chunky blows up
        vec2 shockDisperse = vec2(0.0);
        if (uShockProgress < 0.99) {
          vec2 delta = uv - uShockOriginUv;
          float dist = length(vec2(delta.x * aspect, delta.y));
          float wave = cubicPulse(uShockProgress * 0.95, 0.085, dist) * (1.0 - uShockProgress);
          vec2 dir = dist > 1e-4 ? (delta / dist) : vec2(0.0);
          uv -= dir * wave * 0.022;
          shockDisperse += dir * wave * 0.008;
        }
        for (int i = 0; i < 3; i++) {
          vec4 sh = uShocks[i];
          if (sh.z < 0.99 && sh.w > 0.01) {
            vec2 delta = uv - sh.xy;
            float dist = length(vec2(delta.x * aspect, delta.y));
            float wave = cubicPulse(sh.z * 0.98, 0.09, dist) * (1.0 - sh.z) * sh.w;
            vec2 dir = dist > 1e-4 ? (delta / dist) : vec2(0.0);
            uv -= dir * wave * 0.026;
            shockDisperse += dir * wave * 0.011;
          }
        }

        // Edge chroma split + hyperspace warp streaks (preserve game feel at all tiers)
        vec2 fromCenter = uv - 0.5;
        float bt = saturate(uBulletTime);
        float warp = saturate(uWarpSpeed);
        float radial = length(fromCenter);
        float ca = (0.0007 + uChromaStrength * 0.011 + bt * 0.0075 + warp * 0.014) * radial;
        vec2 caOffset = fromCenter * ca + shockDisperse;

        vec3 hdrCol;
        bool useChroma =
          (uQualityTier > 0) ||
          (uChromaStrength > 0.18) ||
          (bt > 0.05) ||
          (warp > 0.05) ||
          (length(shockDisperse) > 0.0015);

        if (useChroma) {
          hdrCol.r = texture(tDiffuse, clamp(uv + caOffset, 0.0, 1.0)).r;
          hdrCol.g = texture(tDiffuse, clamp(uv, 0.0, 1.0)).g;
          hdrCol.b = texture(tDiffuse, clamp(uv - caOffset, 0.0, 1.0)).b;
        } else {
          hdrCol = texture(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
        }

        if (warp > 0.005) {
          vec3 blurAcc = hdrCol;
          int blurSteps = (uQualityTier >= 2) ? 5 : (uQualityTier == 1) ? 3 : 2;
          float stepScale = radial * warp * (0.028 * 5.0 / float(blurSteps));
          for (int i = 1; i <= 5; i++) {
            if (i > blurSteps) break;
            vec2 sampleUv = clamp(uv - fromCenter * (float(i) * stepScale), 0.0, 1.0);
            blurAcc += texture(tDiffuse, sampleUv).rgb;
          }
          hdrCol = mix(hdrCol, blurAcc / float(blurSteps + 1), warp * 0.82);
          hdrCol += vec3(0.28, 0.88, 1.0) * smoothstep(0.18, 0.88, radial) * warp * 0.36;
        }

        if (uEmissiveGlowBoost > 0.001) {
          hdrCol += max(hdrCol - vec3(0.95), vec3(0.0)) * uEmissiveGlowBoost;
        }

        // Optical lens vignette + angry red border when your hull is held together with tape
        vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);
        float vig = vignette(centered, 1.75);
        hdrCol *= mix(0.68, 1.0, vig);

        float edgeAlert = smoothstep(0.32, 0.92, length(uv - 0.5) * 1.45);
        float stress = saturate(uDamageFlash * 0.85 + uLowHpPulse * 0.42);
        hdrCol += vec3(0.95, 0.06, 0.12) * edgeAlert * stress * 0.7;

        if (uOverdrive > 0.01) {
          float odPulse = 0.75 + 0.25 * sin(uTime * 8.0);
          hdrCol += uOverdriveColor * edgeAlert * uOverdrive * odPulse * 0.28;
          hdrCol *= (1.0 + uOverdrive * 0.08);
        }

        // Quick contrast pop right under the center on crits, parries, and big kills
        if (uHitPulse > 0.005) {
          float centerWeight = 1.0 - smoothstep(0.15, 0.85, radial);
          hdrCol *= (1.0 + saturate(uHitPulse) * 0.09 * centerWeight);
        }

        if (bt > 0.005) {
          float lum = dot(hdrCol, vec3(0.2126, 0.7152, 0.0722));
          vec3 chronoGrade = mix(hdrCol, vec3(lum) * vec3(0.72, 1.05, 1.38), radial * 0.72);
          hdrCol = mix(hdrCol, chronoGrade, bt * 0.78);
          float chronoPulse = 0.8 + 0.2 * sin(uTime * 10.0);
          vec3 visorHue = mix(vec3(0.16, 0.78, 1.0), vec3(0.45, 0.42, 0.98), radial);
          hdrCol += visorHue * edgeAlert * bt * chronoPulse * 0.34;
        }

        // Subtle grain in linear space before tonemapping (skipped on low tier for fill-rate savings)
        if (uQualityTier > 0) {
          float grainNoise = hash12(floor(gl_FragCoord.xy) + 131.0 * float(uFrame % 64)) * 2.0 - 1.0;
          hdrCol = filmGrain(hdrCol, 0.014, grainNoise);
        }

        // AgX punchy tonemap -> exact sRGB -> TPDF dither so dark space doesn't show ugly 8-bit stripes
        vec3 mapped = tonemapAgXPunchy(hdrCol * 1.08);
        vec3 srgb = linearToSrgb(mapped);
        srgb += ditherTPDF(gl_FragCoord.xy, uFrame);

        fragColor = vec4(saturate(srgb), 1.0);
      }
    `,
  });

  const pass = new ShaderPass(mat);
  pass.renderToScreen = true;
  return pass;
}
