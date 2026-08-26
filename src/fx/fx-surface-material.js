// fx-surface-material.js — FX-aware lit material for solid polygon faces.
//
// Point and line renderers have dedicated FX shaders, but Platonic faces are
// best kept on Three's physically lit MeshStandardMaterial path. This class
// adds the shared FX uniforms and a compact surface treatment through
// onBeforeCompile, preserving the renderer's lights, tone mapping, fog, and
// transparency while making every catalog effect visible on the actual faces.

import * as THREE from 'three';
import { FX_MODE } from './fx-shader.js';

const SURFACE_VERTEX_DECLARATIONS = /* glsl */`
  attribute vec3 fxBarycentric;
  varying vec3 vFxBarycentric;
  varying vec3 vFxWorldPos;
  varying vec3 vFxNormal;
`;

const SURFACE_FRAGMENT_DECLARATIONS = /* glsl */`
  uniform int uFXMode;
  uniform float uFXIntensity;
  uniform float uTime;
  uniform float uSurfaceRole;
  varying vec3 vFxBarycentric;
  varying vec3 vFxWorldPos;
  varying vec3 vFxNormal;

  vec3 fxHue(float h) {
    return 0.5 + 0.5 * cos(6.2831853 * (h + vec3(0.0, 0.3333333, 0.6666667)));
  }

  float fxTriangleEdge() {
    float nearest = min(vFxBarycentric.x, min(vFxBarycentric.y, vFxBarycentric.z));
    return 1.0 - smoothstep(0.012, 0.075, nearest);
  }

  vec4 applySurfaceFX(vec4 surface, vec3 normalDir, vec3 viewDir) {
    vec3 base = surface.rgb;
    vec3 col = base;
    float alpha = surface.a;
    float amount = clamp(uFXIntensity, 0.0, 1.0);
    float radius = length(vFxWorldPos);
    float radial2 = length(vFxWorldPos.xy);
    float angle = atan(vFxWorldPos.y, vFxWorldPos.x);
    float facing = clamp(abs(dot(normalDir, viewDir)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.2);
    float triEdge = fxTriangleEdge();

    if (uFXMode == ${FX_MODE.GLOW}) {
      float glow = 0.35 + fresnel * 1.45;
      col += (base * 0.85 + vec3(0.18, 0.15, 0.08)) * glow * amount;
    }
    if (uFXMode == ${FX_MODE.TRAIL}) {
      float band = 0.5 + 0.5 * sin(dot(vFxWorldPos, vec3(3.2, 2.1, 1.3)) - uTime * 3.2);
      vec3 echo = fxHue(fract(band * 0.22 + uTime * 0.04));
      col = mix(base * (0.5 + 0.5 * band), base + echo * 0.62, amount);
      alpha *= mix(1.0, 0.58 + 0.42 * band, amount);
    }
    if (uFXMode == ${FX_MODE.KALEIDOSCOPE}) {
      float sector = abs(fract(angle / 1.0471976 + 0.5) - 0.5) * 2.0;
      vec3 tint = fxHue(fract(sector + radial2 * 0.16 + uTime * 0.05));
      col = mix(base, base * (0.35 + tint * 1.45), amount);
    }
    if (uFXMode == ${FX_MODE.RIPPLE}) {
      float wave = 0.5 + 0.5 * sin(radial2 * 8.0 - uTime * 4.0);
      vec3 tint = fxHue(fract(radial2 * 0.12 - uTime * 0.035));
      col = mix(base * (0.68 + wave * 0.58), base + tint * wave * 0.85, amount);
    }
    if (uFXMode == ${FX_MODE.SPIRAL}) {
      float wave = 0.5 + 0.5 * sin(angle * 6.0 + radial2 * 3.0 + uTime * 2.0);
      vec3 tint = fxHue(fract(angle / 6.2831853 + radial2 * 0.2 + uTime * 0.07));
      col = mix(base, base * (0.45 + wave) + tint * wave * 0.52, amount);
    }
    if (uFXMode == ${FX_MODE.PULSE}) {
      float pulse = 0.5 + 0.5 * sin(uTime * 3.1415927);
      col *= mix(1.0, 0.64 + pulse * 0.8, amount);
    }
    if (uFXMode == ${FX_MODE.CHROMATIC}) {
      vec3 split = fxHue(fract(dot(vFxWorldPos, vec3(0.17, 0.11, 0.07)) + uTime * 0.08));
      col = mix(base, base * (0.55 + split * 1.18), amount);
    }
    if (uFXMode == ${FX_MODE.FOG}) {
      float depth = smoothstep(2.0, 10.5, distance(cameraPosition, vFxWorldPos));
      col = mix(base, vec3(0.3, 0.55, 0.78), depth * amount * 0.62);
      alpha *= 1.0 - depth * amount * 0.72;
      alpha = max(alpha, surface.a * 0.22);
    }
    if (uFXMode == ${FX_MODE.HEAT}) {
      float heat = 0.5 + 0.5 * sin(radius * 5.0 - uTime * 1.8);
      vec3 thermal = mix(vec3(0.16, 0.38, 1.0), vec3(1.0, 0.18, 0.02), heat);
      col = mix(base, base * 0.4 + thermal * 1.05, amount);
    }
    if (uFXMode == ${FX_MODE.EDGE_GLOW}) {
      float edgeLight = max(triEdge * 0.8, fresnel);
      col = mix(base, base + vec3(0.62, 0.9, 1.0) * edgeLight * 1.35, amount);
      alpha = min(1.0, alpha + edgeLight * amount * 0.18);
    }
    if (uFXMode == ${FX_MODE.AURA}) {
      float aura = fresnel * (0.75 + 0.25 * sin(uTime * 1.7 + radius * 3.0));
      col = mix(base, base + vec3(0.42, 0.32, 1.0) * (0.3 + aura * 1.35), amount);
    }
    if (uFXMode == ${FX_MODE.VORONOI}) {
      vec3 cell = floor(vFxWorldPos * 3.25);
      vec3 tint = fxHue(fract(dot(cell, vec3(0.1031, 0.11369, 0.13787))));
      vec3 local = abs(fract(vFxWorldPos * 3.25) - 0.5);
      float border = smoothstep(0.34, 0.49, max(local.x, max(local.y, local.z)));
      col = mix(base, base * (0.35 + tint * 1.28) + tint * border * 0.38, amount);
    }
    if (uFXMode == ${FX_MODE.CAUSTIC}) {
      float caustic = sin(vFxWorldPos.x * 5.1 + sin(vFxWorldPos.y * 3.3 + uTime));
      caustic += sin(vFxWorldPos.y * 4.7 + sin(vFxWorldPos.z * 3.8 - uTime * 0.8));
      caustic = pow(0.5 + 0.25 * caustic, 3.0);
      vec3 waterLight = mix(vec3(0.12, 0.58, 1.0), vec3(1.0, 0.86, 0.36), caustic);
      col = mix(base, base + waterLight * caustic * 1.8, amount);
    }
    if (uFXMode == ${FX_MODE.IRIDESCENT}) {
      vec3 film = fxHue(fract(facing * 0.82 + radius * 0.12 + uTime * 0.035));
      col = mix(base, base * (0.4 + film * 1.3) + film * fresnel * 0.42, amount);
    }
    if (uFXMode == ${FX_MODE.FLOWFIELD}) {
      float flow = sin(vFxWorldPos.y * 2.7 + uTime) * cos(vFxWorldPos.z * 2.1 - uTime * 0.7);
      vec3 flowTint = fxHue(fract(flow * 0.24 + angle / 6.2831853));
      col = mix(base, base * (0.5 + flowTint * 1.12), amount);
    }
    if (uFXMode == ${FX_MODE.PLASMA}) {
      float plasma = sin(vFxWorldPos.x * 4.0 + uTime)
                   + sin(vFxWorldPos.y * 3.7 - uTime * 1.3)
                   + sin(vFxWorldPos.z * 4.3 + uTime * 0.9);
      vec3 plasmaTint = fxHue(fract(plasma / 6.0 + 0.5));
      col = mix(base, base * (0.35 + plasmaTint * 1.35) + plasmaTint * 0.22, amount);
    }
    if (uFXMode == ${FX_MODE.KALEIDO6}) {
      float fold = abs(fract(angle / 1.0471976 + 0.5) - 0.5) * 2.0;
      vec3 sixTint = fxHue(fract(fold + uTime * 0.08));
      col = mix(base, base * (0.35 + sixTint * 1.42), amount);
    }
    if (uFXMode == ${FX_MODE.DOF}) {
      float focus = 5.2 + sin(uTime * 0.35) * 1.4;
      float blur = smoothstep(0.4, 4.2, abs(distance(cameraPosition, vFxWorldPos) - focus));
      float luminance = dot(base, vec3(0.299, 0.587, 0.114));
      col = mix(base, vec3(luminance) * vec3(0.72, 0.86, 1.0), blur * amount * 0.74);
      alpha *= 1.0 - blur * amount * 0.62;
      alpha = max(alpha, surface.a * 0.24);
    }
    if (uFXMode == ${FX_MODE.NEBULA}) {
      float gas = 0.5 + 0.5 * sin(vFxWorldPos.x * 1.4 + uTime * 0.4)
                            * cos(vFxWorldPos.y * 1.7 - uTime * 0.3)
                            * sin(vFxWorldPos.z * 1.1 + uTime * 0.2);
      vec3 cloud = mix(vec3(0.3, 0.52, 1.0), vec3(1.0, 0.46, 0.2), gas);
      col = mix(base, base * (0.55 + cloud * 1.18) + cloud * gas * 0.22, amount);
    }
    if (uFXMode == ${FX_MODE.WIREFRAME}) {
      col = mix(base * 0.16, vec3(0.9, 0.96, 1.0) + base * 0.5, triEdge);
      col = mix(base, col, amount);
      alpha *= mix(1.0, 0.2 + triEdge * 0.8, amount);
    }
    if (uFXMode == ${FX_MODE.HOLOGRAM}) {
      float scan = 0.5 + 0.5 * sin(vFxWorldPos.y * 28.0 - uTime * 6.0);
      float flicker = 0.86 + 0.14 * sin(uTime * 23.0) * sin(uTime * 7.0);
      vec3 hologram = vec3(0.16, 0.88, 1.0);
      col = mix(base, hologram * (0.38 + 0.62 * scan) * flicker + base * triEdge * 0.55, amount);
      alpha *= mix(1.0, 0.62 + 0.38 * scan, amount);
    }
    if (uFXMode == ${FX_MODE.XRAY}) {
      float xrayEdge = max(fresnel, triEdge * 0.58);
      vec3 xray = vec3(0.28, 1.0, 0.86) * (0.15 + xrayEdge * 1.65);
      col = mix(base, xray + base * facing * 0.12, amount);
      alpha *= mix(1.0, 0.3 + xrayEdge * 0.7, amount);
    }
    if (uFXMode == ${FX_MODE.CRYSTAL}) {
      float facet = dot(abs(normalDir), vec3(0.52, 0.31, 0.17));
      vec3 prism = fxHue(fract(facet + facing * 0.42 + uTime * 0.025));
      col = mix(base, base * (0.42 + prism * 1.25) + vec3(1.0) * pow(fresnel, 2.0) * 0.55, amount);
    }

    // Star faces blend without writing depth. Keep their center planes
    // translucent so intersections read as depth, while retaining bright
    // silhouettes without additive white-out where many planes overlap.
    if (uSurfaceRole > 0.5) {
      alpha *= 0.82 + fresnel * 0.18;
      col += base * fresnel * 0.16;
    }
    return vec4(max(col, vec3(0.0)), clamp(alpha, 0.0, 1.0));
  }
`;

export function makeTriangleBarycentrics(triangleCount) {
  const values = new Float32Array(Math.max(0, triangleCount) * 9);
  for (let i = 0; i < triangleCount; i++) {
    const offset = i * 9;
    values[offset] = 1;
    values[offset + 4] = 1;
    values[offset + 8] = 1;
  }
  return values;
}

export class SurfaceFXMaterial extends THREE.MeshStandardMaterial {
  constructor(options = {}) {
    const { star = false, ...standardOptions } = options;
    super(standardOptions);
    this.uniforms = {
      uFXMode: { value: FX_MODE.NONE },
      uFXIntensity: { value: 0.5 },
      uTime: { value: 0 },
      uSurfaceRole: { value: star ? 1 : 0 },
    };
    this.userData.fxSurface = true;
    this.userData.surfaceRole = star ? 'star' : 'convex';

    this.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${SURFACE_VERTEX_DECLARATIONS}`)
        .replace('#include <worldpos_vertex>', `
          #include <worldpos_vertex>
          vFxWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vFxNormal = normalize(mat3(modelMatrix) * objectNormal);
          vFxBarycentric = fxBarycentric;
        `);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${SURFACE_FRAGMENT_DECLARATIONS}`)
        .replace('#include <color_fragment>', `
          #include <color_fragment>
          diffuseColor = applySurfaceFX(
            diffuseColor,
            normalize(vFxNormal),
            normalize(cameraPosition - vFxWorldPos)
          );
        `);
    };
  }

  customProgramCacheKey() {
    return `e8-surface-fx-${this.userData.surfaceRole}`;
  }
}
