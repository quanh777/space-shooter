import * as THREE from 'three';
import {
  GLSL3_COLOR_AND_SHADING,
  GLSL3_COMMON_AND_HASH,
  GLSL3_NOISE,
  GLSL3_PATTERN,
} from './shaderLib';

// Star-chart floor grid shader with anti-aliased lines and an outgoing radar pulse from the ship.
export function createArenaDeckMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPlayerWorldXZ: { value: new THREE.Vector2(0, 0) },
      uAccentColor: { value: new THREE.Color(0x38c8ff) },
      uAlertLevel: { value: 0 },
      uPulseOriginXZ: { value: new THREE.Vector2(0, 0) },
      uPulseAge: { value: 10.0 },
    },
    vertexShader: /* glsl */ `
      out vec2 vWorldXZ;
      out vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_PATTERN}

      uniform float uTime;
      uniform vec2 uPlayerWorldXZ;
      uniform vec3 uAccentColor;
      uniform float uAlertLevel;
      uniform vec2 uPulseOriginXZ;
      uniform float uPulseAge;

      in vec2 vWorldXZ;
      in vec2 vUv;
      out vec4 fragColor;

      void main() {
        // Box-filtered major and minor grid lines so perspective distance never moire-flickers
        vec2 majorCoord = vWorldXZ * 0.1;
        vec2 minorCoord = vWorldXZ * 0.5;
        vec2 majorW = fwidth(majorCoord);
        vec2 minorW = fwidth(minorCoord);

        float majorLines = filteredGrid(majorCoord, majorW, 38.0);
        float minorLines = filteredGrid(minorCoord, minorW, 56.0);

        // Soft floor glow around the player ship so it feels grounded in open void
        float distPlayer = length(vWorldXZ - uPlayerWorldXZ);
        float shipGlow = exp(-distPlayer * 0.032);

        // Lazy sonar ping radiating out from the cockpit
        float sweepDist = mod(uTime * 16.0, 68.0);
        float sweepRing = cubicPulse(sweepDist, 2.4, distPlayer) * (1.0 - sweepDist / 68.0);

        // Flash the star-chart grid whenever a big shockwave passes over it
        float blastRadius = uPulseAge * 48.0;
        float blastRing = cubicPulse(blastRadius, 3.2, length(vWorldXZ - uPulseOriginXZ))
                        * exp(-uPulseAge * 2.2);

        float gridIntensity = majorLines * (0.028 + 0.08 * shipGlow + 0.16 * sweepRing + 0.45 * blastRing)
                            + minorLines * (0.006 + 0.02 * shipGlow);

        vec3 baseCol = mix(uAccentColor, vec3(1.0, 0.22, 0.28), uAlertLevel);
        vec3 col = baseCol * gridIntensity;
        col += vec3(0.95, 0.72, 0.32) * blastRing * (majorLines * 0.9 + 0.12);

        float alpha = saturate(gridIntensity + blastRing * 0.2);
        fragColor = vec4(col, alpha);
      }
    `,
  });
}

// Glowing cylinder fence marking the Storm Ring ("step outside and regret it").
export function createStormWallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x38e8ff) },
      uOpacity: { value: 0.28 },
      uPulse: { value: 0 },
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

      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPulse;

      in vec2 vUv;
      out vec4 fragColor;

      void main() {
        float h = vUv.y;
        float baseRim = smoothstep(0.32, 0.0, h);
        float topFade = smoothstep(1.0, 0.2, h);

        // Vertical energy ribs + climbing hologram scanline
        float cols = pow(0.5 + 0.5 * sin(vUv.x * TAU * 48.0 + uTime * 1.6), 6.0);
        float scan = smoothstep(0.65, 1.0, sin((h * 8.0 - uTime * 2.4) * TAU));

        // Pulse band sweeping up the barrier when a wave kicks off
        float pulseBand = cubicPulse(1.0 - uPulse, 0.28, h) * uPulse;

        float intensity = baseRim * 0.85 + topFade * (cols * 0.35 + scan * 0.22) + pulseBand * 1.45;
        vec3 col = mix(uColor, vec3(1.0), saturate(pulseBand * 0.7 + baseRim * 0.25));
        float alpha = saturate(intensity * uOpacity + pulseBand * 0.48);
        fragColor = vec4(col, alpha);
      }
    `,
  });
}

// Procedural swirling gas-giant shader so background planets aren't flat painted beach balls.
export function createProceduralPlanetMaterial(
  colorDarkHex: number,
  colorMidHex: number,
  colorBandHex: number,
  atmoHex: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uTime: { value: 0 },
      uColorDark: { value: new THREE.Color(colorDarkHex) },
      uColorMid: { value: new THREE.Color(colorMidHex) },
      uColorBand: { value: new THREE.Color(colorBandHex) },
      uAtmoColor: { value: new THREE.Color(atmoHex) },
      uLightDir: { value: new THREE.Vector3(0.55, 0.7, 0.45).normalize() },
    },
    vertexShader: /* glsl */ `
      out vec3 vNormalW;
      out vec3 vLocalPos;
      out vec3 vViewDirW;
      void main() {
        vLocalPos = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDirW = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform vec3 uColorDark;
      uniform vec3 uColorMid;
      uniform vec3 uColorBand;
      uniform vec3 uAtmoColor;
      uniform vec3 uLightDir;

      in vec3 vNormalW;
      in vec3 vLocalPos;
      in vec3 vViewDirW;
      out vec4 fragColor;

      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(vViewDirW);
        vec3 l = normalize(uLightDir);

        // Stretch UVs along latitude so clouds wrap into Jupiter-style storm bands
        float lat = asin(clamp(vLocalPos.y, -1.0, 1.0));
        float lon = atan(vLocalPos.z, vLocalPos.x);
        vec2 p = vec2(lon * 1.35 + uTime * 0.035, lat * 4.4);

        vec2 q, r;
        float w = warpedFbm(p, 0.65, 2, q, r);
        float band = 0.5 + 0.5 * sin(lat * 11.0 + w * 2.8 + r.x * 1.4);

        // Blend storm colors in Oklab so gradients never turn into muddy grey soup
        vec3 baseA = mixOklab(uColorDark, uColorMid, smoothstep(0.18, 0.78, band));
        vec3 albedo = mixOklab(baseA, uColorBand, smoothstep(0.55, 0.92, length(q) * 0.55 + band * 0.45));

        // Soft wrap diffuse with just enough night-side fill to read the silhouette
        float diff = max((dot(n, l) + 0.18) / 1.3924, 0.0);
        float nightAmbient = 0.09;
        vec3 lit = albedo * (diff * 1.15 + nightAmbient);

        // Glowing sunlit atmosphere limb
        float rim = rimLight(n, v, 3.0);
        float sunLimb = smoothstep(-0.35, 0.75, dot(n, l));
        lit += uAtmoColor * rim * (0.35 + 0.95 * sunLimb);

        fragColor = vec4(lit, 1.0);
      }
    `,
  });
}

// Hexagonal Voronoi Fresnel bubble shielding the player ship.
export function createHexShieldMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      out vec3 vNormalV;
      out vec3 vViewDirV;
      out vec3 vLocalDir;
      void main() {
        vLocalDir = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDirV = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_PATTERN}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uOpacity;

      in vec3 vNormalV;
      in vec3 vViewDirV;
      in vec3 vLocalDir;
      out vec4 fragColor;

      void main() {
        vec3 n = normalize(vNormalV);
        vec3 v = normalize(vViewDirV);

        // Wrap hex cells in spherical coordinates
        vec2 sphUv = vec2(atan(vLocalDir.z, vLocalDir.x) / PI, vLocalDir.y) * vec2(7.0, 5.5);
        vec4 hx = hexGrid(sphUv);
        float edgeD = hexEdgeDistance(hx.xy);
        float cellRand = hash12(hx.zw);

        // Crisp cell seams pulsing down the bubble
        float line = 1.0 - smoothstep(0.02, 0.09, edgeD);
        float wave = 0.5 + 0.5 * sin(vLocalDir.y * 6.0 - uTime * 7.5 + cellRand * TAU);
        float cellPulse = smoothstep(0.72, 0.98, wave) * 0.32;

        float NoV = abs(dot(n, v));
        float fresnel = fresnelSchlick(NoV, vec3(0.06)).r;

        vec3 iceCyan = vec3(0.14, 0.88, 1.0);
        vec3 hotCore = vec3(0.85, 0.98, 1.0);
        vec3 col = mixOklab(iceCyan, hotCore, saturate(line * 0.65 + fresnel * 0.5));

        float alpha = (fresnel * 0.85 + line * (0.45 + 0.35 * wave) + cellPulse) * uOpacity;
        fragColor = vec4(col * 1.35, saturate(alpha));
      }
    `,
  });
}

// Angry blackbody/plasma reactor core shader tailored to each of the 6 Boss archetypes.
export function createBossCoreMaterial(archetype: 0 | 1 | 2 | 3 | 4 | 5): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0.4 },
      uHitFlash: { value: 0 },
      uPhase: { value: 0 },
      uArchetype: { value: archetype },
    },
    vertexShader: /* glsl */ `
      out vec3 vLocalPos;
      out vec3 vNormalV;
      out vec3 vViewDirV;
      void main() {
        vLocalPos = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDirV = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uEnergy;
      uniform float uHitFlash;
      uniform float uPhase;
      uniform int uArchetype;

      in vec3 vLocalPos;
      in vec3 vNormalV;
      in vec3 vViewDirV;
      out vec4 fragColor;

      void main() {
        float speedMult = 1.0 + uPhase * 0.55;
        vec3 p = vLocalPos * (2.8 + uPhase * 0.65) + vec3(0.0, -uTime * 0.85 * speedMult, uTime * 0.45 * speedMult);
        float turb = turbulence3(p, 4);
        float rim = rimLight(normalize(vNormalV), normalize(vViewDirV), 2.2);
        float phaseBoost = 1.0 + uPhase * 0.36;

        vec3 col;
        if (uArchetype == 0) {
          // Destroyer: white-hot industrial fusion core (1500K up to 10kK+)
          float kelvin = mix(1500.0, 6800.0 + uEnergy * 3200.0 + uPhase * 1600.0, saturate(turb * 1.15 + uEnergy * 0.35));
          col = blackbody(kelvin) * (1.25 + uEnergy * 1.4) * phaseBoost;
        } else if (uArchetype == 1) {
          // Summoner: swirling abyssal purple rift plasma
          vec3 deepVoid = vec3(0.18, 0.02, 0.38);
          vec3 voidArc  = vec3(0.92, 0.36, 1.0);
          col = mixOklab(deepVoid, voidArc, saturate(turb * 1.3 + rim * 0.45)) * (1.3 + uEnergy * 1.5) * phaseBoost;
        } else if (uArchetype == 2) {
          // Overlord: miniature angry sun
          float kelvin = mix(2600.0, 10500.0 + uEnergy * 3500.0, saturate(turb * 1.2 + rim * 0.3));
          col = blackbody(kelvin) * (1.45 + uEnergy * 1.5) * phaseBoost;
        } else if (uArchetype == 3) {
          // Leviathan: toxic deep-sea emerald bio-reactor
          vec3 deepJade = vec3(0.02, 0.24, 0.20);
          vec3 bioVenom = vec3(0.12, 1.0, 0.72);
          col = mixOklab(deepJade, bioVenom, saturate(turb * 1.35 + rim * 0.4)) * (1.35 + uEnergy * 1.4) * phaseBoost;
        } else if (uArchetype == 4) {
          // Gemini: cyan and magenta polarity soup fighting inside one core
          vec3 polCyan = vec3(0.14, 0.92, 1.0);
          vec3 polMag  = vec3(1.0, 0.18, 0.56);
          float polWave = 0.5 + 0.5 * sin(uTime * 3.5 + turb * 5.0);
          col = mixOklab(polCyan, polMag, polWave) * (1.35 + uEnergy * 1.45) * phaseBoost;
        } else {
          // Bastion: superheated tungsten forge ready to melt its own armor off
          float kelvin = mix(1900.0, 9200.0 + uEnergy * 3600.0 + uPhase * 2200.0, saturate(turb * 1.25 + rim * 0.35));
          col = blackbody(kelvin) * (1.4 + uEnergy * 1.55) * phaseBoost;
        }

        col += vec3(1.0) * (uHitFlash * 1.6 + rim * (0.55 + uPhase * 0.22));
        fragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Subtle drifting cosmic mist layered above the background texture so deep space breathes.
export function createNebulaDriftMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBossTint: { value: new THREE.Color(0x1f6aa8) },
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
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform vec3 uBossTint;
      in vec2 vUv;
      out vec4 fragColor;

      void main() {
        vec2 centered = vUv - 0.5;
        // Keep center canvas quiet so incoming bullets never camouflage in pretty dust
        float edgeMask = smoothstep(0.16, 0.56, length(centered));
        if (edgeMask < 0.005) discard;

        vec2 p = centered * 4.2 + vec2(uTime * 0.018, -uTime * 0.012);
        float n1 = 0.5 + 0.5 * fbm(p, 2);
        float n2 = ridgedFbm(p * 1.35 + vec2(4.2, -2.7), 2);
        float density = smoothstep(0.42, 0.88, n1 * 0.65 + n2 * 0.35) * edgeMask;

        vec3 amberDust = vec3(0.85, 0.42, 0.14);
        vec3 col = mixOklab(uBossTint, amberDust, smoothstep(0.55, 0.92, n2));
        fragColor = vec4(col * density * 0.24, density * 0.28);
      }
    `,
  });
}

// Glowing plasma bullet shader with white-hot core and Oklab neon rim (supports InstancedMesh).
export function createPlasmaProjectileMaterial(
  baseOpacity = 0.92,
  coreMix = 0.72,
  boost = 1.65
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: baseOpacity },
      uCoreMix: { value: coreMix },
      uBoost: { value: boost },
    },
    vertexShader: /* glsl */ `
      out vec3 vNormalV;
      out vec3 vViewDirV;
      out vec3 vInstColor;
      out vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vInstColor = vec3(1.0);
        mat4 mvMat = modelViewMatrix;
        #ifdef USE_INSTANCING
          mvMat = modelViewMatrix * instanceMatrix;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vInstColor = instanceColor;
        #endif
        vec4 mvPos = mvMat * vec4(position, 1.0);
        vNormalV = normalize(transpose(inverse(mat3(mvMat))) * normal);
        vViewDirV = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uOpacity;
      uniform float uCoreMix;
      uniform float uBoost;

      in vec3 vNormalV;
      in vec3 vViewDirV;
      in vec3 vInstColor;
      in vec3 vLocalPos;
      out vec4 fragColor;

      void main() {
        vec3 n = normalize(vNormalV);
        vec3 v = normalize(vViewDirV);
        float NoV = abs(dot(n, v));

        // Hot white center fading out to saturated bullet neon at grazing edges
        float coreHeat = pow(NoV, 1.55);
        float pulse = 0.92 + 0.08 * sin(uTime * 18.0 + vLocalPos.x * 6.0);
        vec3 hotWhite = vec3(1.0, 0.98, 0.94);
        vec3 col = mixOklab(vInstColor, hotWhite, coreHeat * uCoreMix) * uBoost * pulse;

        float alpha = saturate((0.48 + 0.52 * coreHeat) * uOpacity);
        fragColor = vec4(col, alpha);
      }
    `,
  });
}

// Thruster jet flame shader with supersonic Mach diamonds that snap to cyan during Dash.
export function createThrusterPlumeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      out vec3 vLocalPos;
      out vec3 vNormalV;
      out vec3 vViewDirV;

      void main() {
        vLocalPos = position;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDirV = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uDash;

      in vec3 vLocalPos;
      in vec3 vNormalV;
      in vec3 vViewDirV;
      out vec4 fragColor;

      void main() {
        // Cone spans x = 0.0 (nozzle) to x = -1.8 (tail)
        float t = saturate(-vLocalPos.x / 1.8);
        float turb = fbm(vec2(t * 7.5 - uTime * 22.0, atan(vLocalPos.z, vLocalPos.y) * 1.4), 3);

        // Fast-marching shock diamonds near the thruster lip
        float shock = 0.5 + 0.5 * cos(t * 28.0 - uTime * 42.0);
        shock = pow(shock, 3.0) * (1.0 - t) * 0.65;

        float edgeFade = pow(abs(dot(normalize(vNormalV), normalize(vViewDirV))), 0.65);
        float axialFade = pow(1.0 - t, 1.45);
        float intensity = saturate(axialFade * (0.75 + 0.35 * turb) + shock) * edgeFade;

        vec3 ionAmber = vec3(1.0, 0.52, 0.08);
        vec3 ionCyan = vec3(0.18, 0.92, 1.0);
        vec3 outerCol = mixOklab(ionAmber, ionCyan, uDash * 0.85 + 0.15);
        vec3 col = mixOklab(outerCol, vec3(0.95, 0.99, 1.0), pow(1.0 - t, 2.5) * 0.85 + shock * 0.6);

        fragColor = vec4(col * (1.6 + uDash * 0.9), saturate(intensity * 1.25));
      }
    `,
  });
}

// Screaming plasma death-ray shader for bosses who dislike sharing the arena.
export function createDeathRayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(0xff3818) },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      out vec3 vNormalV;
      out vec3 vViewDirV;

      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDirV = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform vec3 uTint;

      in vec2 vUv;
      in vec3 vNormalV;
      in vec3 vViewDirV;
      out vec4 fragColor;

      void main() {
        float NoV = abs(dot(normalize(vNormalV), normalize(vViewDirV)));
        float n = ridgedFbm(vec2(vUv.x * 6.0 + uTime * 3.0, vUv.y * 28.0 - uTime * 16.0), 3);
        float streak = 0.55 + 0.45 * n;

        vec3 col = mixOklab(uTint, vec3(1.0, 0.96, 0.84), pow(NoV, 1.4) * 0.72 + streak * 0.25);
        float alpha = saturate(pow(NoV, 0.75) * (0.55 + 0.45 * streak));
        fragColor = vec4(col * 1.85, alpha);
      }
    `,
  });
}

// Boiling displacement fireball shader cooling from white-hot flash to dark soot wisps.
export function createExplosionFireballMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uSeed: { value: 0 },
      uTint: { value: new THREE.Color(0xff5522) },
    },
    vertexShader: /* glsl */ `
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_NOISE}

      uniform float uTime;
      uniform float uProgress;
      uniform float uSeed;

      out vec3 vLocalPos;
      out vec3 vNormalV;
      out vec3 vViewDirV;
      out float vDisp;

      void main() {
        vec3 nLocal = normalize(position);
        float swell = sin(clamp(uProgress, 0.0, 1.0) * PI);
        float nVal = fbm(nLocal * 2.1 + vec3(uSeed, uTime * 1.35, -uSeed * 0.6), 3);
        vDisp = nVal;
        vec3 displaced = position + nLocal * (nVal * 0.44 * (0.35 + 0.65 * swell));

        vLocalPos = normalize(displaced);
        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDirV = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uProgress;
      uniform float uSeed;
      uniform vec3 uTint;

      in vec3 vLocalPos;
      in vec3 vNormalV;
      in vec3 vViewDirV;
      in float vDisp;
      out vec4 fragColor;

      void main() {
        float t = saturate(uProgress);
        vec3 sampleP = vLocalPos * 2.5 + vec3(uSeed * 1.7, -uTime * 1.5, uSeed * 0.8);
        float turb = turbulence3(sampleP, 4);
        float NoV = abs(dot(normalize(vNormalV), normalize(vViewDirV)));
        float edgeHot = pow(NoV, 0.85);

        // Cool down from 10800K plasma to smoky ash over the fireball's brief life
        float heat = saturate(turb * 1.25 + vDisp * 0.35 + (1.0 - t) * 0.65 - t * 0.88);
        float kelvin = mix(1250.0, 10800.0, pow(heat, 1.35) * (1.0 - t * 0.58));
        vec3 physCol = blackbody(kelvin);
        vec3 styledCol = mixOklab(physCol, max(uTint, vec3(0.02)), 0.32 * (1.0 - heat * 0.6));

        // White-hot core -> orange ember -> soot clouds
        vec3 sootCol = vec3(0.06, 0.05, 0.06);
        float fireMask = smoothstep(0.24, 0.64, heat);
        vec3 finalCol = mix(sootCol, styledCol * (3.1 - t * 2.1), fireMask);

        // Quick camera-flash pop in the first 18% of lifetime
        float flash = (1.0 - smoothstep(0.0, 0.18, t));
        finalCol += vec3(1.0, 0.96, 0.88) * flash * 2.6;

        // Chew away the smoke edges with noise before discarding
        float erodeMin = max(0.0, (t - 0.34) * 1.15);
        float density = smoothstep(erodeMin, erodeMin + 0.24, turb * 0.92 + 0.14);
        float alpha = saturate(density * edgeHot * (1.0 - smoothstep(0.84, 1.0, t)));
        if (alpha < 0.015) discard;

        fragColor = vec4(finalCol, alpha);
      }
    `,
  });
}

// Sharp Mach compression shockwave ring shader with a wispy inner wake.
export function createShockwaveRingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(0x2be4ff) },
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
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uProgress;
      uniform vec3 uColor;

      in vec2 vUv;
      out vec4 fragColor;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        float t = saturate(uProgress);
        float angle = atan(p.y, p.x);
        float n = ridgedFbm(vec2(angle * 2.5 + t * 1.4, r * 5.0 - uTime * 3.8), 3);

        // Crisp outer shock front + noisy trailing echo
        float outerFront = cubicPulse(0.86, 0.11, r);
        float wake = smoothstep(0.32, 0.86, r) * (1.0 - smoothstep(0.86, 0.98, r)) * (0.35 + 0.65 * n);
        float innerEcho = cubicPulse(0.56, 0.09, r) * 0.55;

        float intensity = outerFront * 1.35 + wake * 0.8 + innerEcho;
        vec3 hotCol = mixOklab(uColor, vec3(1.0, 0.98, 0.94), saturate(outerFront * 0.85));
        float fade = pow(1.0 - t, 1.35);

        float alpha = saturate(intensity * fade);
        if (alpha < 0.01) discard;
        fragColor = vec4(hotCol * (1.55 + outerFront * 0.85) * fade, alpha);
      }
    `,
  });
}

// Fresnel-lit hemispherical shock dome with subtle hex grid shimmer.
export function createBlastDomeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(0x38e8ff) },
    },
    vertexShader: /* glsl */ `
      out vec3 vNormalV;
      out vec3 vViewDirV;
      out vec3 vLocalDir;
      void main() {
        vLocalDir = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDirV = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_PATTERN}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uProgress;
      uniform vec3 uColor;

      in vec3 vNormalV;
      in vec3 vViewDirV;
      in vec3 vLocalDir;
      out vec4 fragColor;

      void main() {
        float t = saturate(uProgress);
        float NoV = abs(dot(normalize(vNormalV), normalize(vViewDirV)));
        float fresnel = fresnelSchlick(NoV, vec3(0.04)).r;

        vec2 sphUv = vec2(atan(vLocalDir.z, vLocalDir.x) / PI, vLocalDir.y) * vec2(8.0, 5.0);
        vec4 hx = hexGrid(sphUv + vec2(0.0, -uTime * 0.8));
        float hexLine = 1.0 - smoothstep(0.03, 0.11, hexEdgeDistance(hx.xy));

        float fade = pow(1.0 - t, 1.85);
        vec3 col = mixOklab(uColor, vec3(1.0, 0.98, 0.94), fresnel * 0.65);
        float alpha = saturate((fresnel * 0.95 + hexLine * 0.30 * (1.0 - t)) * fade);
        if (alpha < 0.01) discard;
        fragColor = vec4(col * 1.45 * fade, alpha);
      }
    `,
  });
}

// Boss arrival floor sigil shader: drops tactical target locks, void rifts, or solar halos depending on archetype.
export function createBossPortalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0.0 },
      uProgress: { value: 0.0 },
      uColor: { value: new THREE.Color(0xff3344) },
      uArchetype: { value: 0.0 },
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
      ${GLSL3_NOISE}
      ${GLSL3_PATTERN}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform float uProgress;
      uniform vec3 uColor;
      uniform float uArchetype;

      in vec2 vUv;
      out vec4 fragColor;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        if (d > 1.0) discard;

        float prog = saturate(uProgress);
        float ang = atan(p.y, p.x);
        float radialMask = smoothstep(1.0, 0.72, d);
        float intensity = 0.0;
        vec3 col = uColor;

        if (uArchetype < 0.5) {
          // Orbital drop targeting reticle
          float ringOuter = cubicPulse(0.86, 0.045, d);
          float ringInner = cubicPulse(0.54, 0.035, d);
          float coreBull = cubicPulse(0.18, 0.06, d) * (0.7 + 0.3 * sin(uTime * 12.0));

          float spinA = mod(ang + PI + uTime * 1.4, TAU * 0.25);
          float brackets = step(0.18, spinA) * step(spinA, 0.92) * cubicPulse(0.70, 0.055, d);

          float ticks = cubicPulse(0.93, 0.025, d) * step(0.55, cos((ang - uTime * 0.9) * 16.0));
          float sweepAng = mod(ang - uTime * 3.8 + TAU * 4.0, TAU);
          float sweepBeam = smoothstep(0.9, 0.0, sweepAng) * smoothstep(0.12, 0.86, d) * (1.0 - step(0.87, d));

          vec4 hx = hexGrid(p * 4.5 + vec2(0.0, -uTime * 0.6));
          float hexLine = (1.0 - smoothstep(0.02, 0.08, hexEdgeDistance(hx.xy))) * smoothstep(0.85, 0.25, d);

          intensity = ringOuter * 1.35 + ringInner * 1.05 + coreBull * 1.5
                    + brackets * 1.45 + ticks * 0.95 + sweepBeam * 0.65 + hexLine * 0.28;
          col = mixOklab(uColor, blackbody(4600.0), saturate((brackets + coreBull) * 0.55));
        } else if (uArchetype < 1.5) {
          // Abyssal void singularity rift
          vec2 swirled = rot2(uTime * 1.35 + (1.0 - d) * 3.8) * p;
          vec2 q, r;
          float f = warpedFbm(swirled * 2.8 - vec2(uTime * 0.45, -uTime * 0.3), 1.35, 3, q, r);
          float swirlRidge = ridgedFbm(vec2(ang * 3.0 + d * 7.0 - uTime * 3.2, d * 5.0), 3);

          float horizon = cubicPulse(0.46, 0.11, d) * (1.2 + 0.5 * f);
          float outerTendrils = smoothstep(0.2, 0.78, f + swirlRidge * 0.45) * smoothstep(0.98, 0.42, d);
          float abyssCore = 1.0 - smoothstep(0.12, 0.42, d);

          intensity = horizon * 1.7 + outerTendrils * 0.95 + cubicPulse(0.76, 0.05, d) * 0.75;
          intensity *= (1.0 - abyssCore * 0.78);
          col = mixOklab(uColor, vec3(0.42, 0.88, 1.0), saturate(horizon * 0.65));
          col = mixOklab(col, vec3(1.0, 0.95, 1.0), saturate(swirlRidge * horizon * 0.55));
        } else {
          // Celestial solar archon seal
          vec2 p1 = rot2(uTime * 0.85) * p;
          vec2 p2 = rot2(-uTime * 0.85 + PI * 0.1666) * p;
          float tri1 = max(abs(p1.x) * 0.866025 + p1.y * 0.5, -p1.y);
          float tri2 = max(abs(p2.x) * 0.866025 + p2.y * 0.5, -p2.y);
          float starLines = cubicPulse(0.42, 0.032, tri1) + cubicPulse(0.42, 0.032, tri2);

          float halo1 = cubicPulse(0.88, 0.038, d);
          float halo2 = cubicPulse(0.64, 0.032, d);
          float halo3 = cubicPulse(0.24, 0.055, d);
          float rays = pow(max(0.0, cos(ang * 6.0 - uTime * 2.2)), 6.0) * smoothstep(0.15, 0.88, d);

          intensity = starLines * 1.15 + halo1 * 1.3 + halo2 * 1.1 + halo3 * 1.5 + rays * 0.85;
          col = mixOklab(uColor, blackbody(6200.0), saturate((halo3 + rays * 0.6 + starLines * 0.4) * 0.75));
        }

        float alpha = saturate(intensity * radialMask * prog);
        if (alpha < 0.01) discard;
        fragColor = vec4(col * (1.55 + prog * 0.75) * prog * radialMask * intensity, alpha);
      }
    `,
  });
}

// World-space drifting smoke layer so clouds glide smoothly past when the ship flies instead of snapping.
export function createAtmosphericSmokeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorPrimary: { value: new THREE.Color(0x1f6aa8) },
      uColorSecondary: { value: new THREE.Color(0x0a1830) },
      uOpacity: { value: 0.30 },
      uDrift: { value: new THREE.Vector2(0.24, 0.42) },
      uScale: { value: 0.036 },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv;
      out vec2 vWorldXZ;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldXZ = worldPos.xz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${GLSL3_COMMON_AND_HASH}
      ${GLSL3_NOISE}
      ${GLSL3_COLOR_AND_SHADING}

      uniform float uTime;
      uniform vec3 uColorPrimary;
      uniform vec3 uColorSecondary;
      uniform float uOpacity;
      uniform vec2 uDrift;
      uniform float uScale;

      in vec2 vUv;
      in vec2 vWorldXZ;
      out vec4 fragColor;

      void main() {
        vec2 radial = vUv * 2.0 - 1.0;
        float edgeFade = smoothstep(0.96, 0.28, length(radial));
        if (edgeFade < 0.005) discard;

        vec2 pA = vWorldXZ * uScale + uDrift * uTime;
        float billow = 0.5 + 0.5 * fbm(pA, 2);

        vec2 pB = vWorldXZ * (uScale * 1.65) - vec2(uDrift.y * 0.7, -uDrift.x * 0.7) * uTime * 1.15 + vec2(billow * 0.65);
        float detail = 0.5 + 0.5 * fbm(pB, 2);

        float smokeField = saturate(billow * 0.68 + detail * 0.44 - 0.18);
        float density = smoothstep(0.14, 0.86, smokeField);
        float alpha = saturate(density * edgeFade * uOpacity);
        if (alpha < 0.008) discard;

        vec3 col = mix(uColorSecondary, uColorPrimary, saturate(density * 0.85 + detail * 0.25));
        fragColor = vec4(col, alpha);
      }
    `,
  });
}

// GPU-wrapped scrolling starfield & atmospheric ember points (zero per-frame CPU buffer uploads).
export function createScrollingPointsMaterial(
  size: number,
  opacity: number,
  additive: boolean,
  mapTex?: THREE.Texture
): THREE.ShaderMaterial {
  const hasMap = Boolean(mapTex);
  const uniforms: Record<string, THREE.IUniform> = {
    uPlayerXZ: { value: new THREE.Vector2(0, 0) },
    uOffsetXZ: { value: new THREE.Vector2(0, 0) },
    uHalfSpanXZ: { value: new THREE.Vector2(120, 95) },
    uTime: { value: 0 },
    uWaveAmp: { value: 0 },
    uSize: { value: size },
    uPointScale: { value: 400 },
    uOpacity: { value: opacity },
  };
  if (hasMap && mapTex) {
    uniforms.uMap = { value: mapTex };
  }

  const fragmentShader = hasMap
    ? /* glsl */ `
      precision mediump float;
      uniform float uOpacity;
      uniform sampler2D uMap;

      in vec3 vColor;
      out vec4 fragColor;

      void main() {
        vec4 tex = texture(uMap, gl_PointCoord);
        float alpha = uOpacity * tex.a;
        if (alpha < 0.01) discard;
        fragColor = vec4(vColor * tex.rgb, alpha);
      }
    `
    : /* glsl */ `
      precision mediump float;
      uniform float uOpacity;

      in vec3 vColor;
      out vec4 fragColor;

      void main() {
        float dist = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = uOpacity * smoothstep(1.0, 0.2, dist);
        if (alpha < 0.01) discard;
        fragColor = vec4(vColor, alpha);
      }
    `;

  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms,
    vertexShader: /* glsl */ `
      in vec3 aColor;
      in float aPhase;

      uniform vec2 uPlayerXZ;
      uniform vec2 uOffsetXZ;
      uniform vec2 uHalfSpanXZ;
      uniform float uTime;
      uniform float uWaveAmp;
      uniform float uSize;
      uniform float uPointScale;

      out vec3 vColor;

      void main() {
        vec2 span2 = uHalfSpanXZ * 2.0;
        vec2 rel = mod(position.xz + uOffsetXZ - uPlayerXZ + uHalfSpanXZ, span2) - uHalfSpanXZ;
        float wy = position.y + sin(uTime * 1.15 + aPhase) * uWaveAmp;
        vec4 mvPos = modelViewMatrix * vec4(uPlayerXZ.x + rel.x, wy, uPlayerXZ.y + rel.y, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(uSize * (uPointScale / max(1.0, -mvPos.z)), 1.25, 48.0);
        vColor = aColor;
      }
    `,
    fragmentShader,
  });
}
