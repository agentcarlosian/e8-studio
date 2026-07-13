// fx-shader.js — shared FX mode shader code for points materials.
//
// Usage:
//   import { fxVertexShader, fxFragmentShader, FX_MODE } from '../fx/fx-shader.js';
//   const mat = new THREE.ShaderMaterial({
//     uniforms: { ..., uFXMode: { value: 0 }, uFXIntensity: { value: 0.5 }, uTime: { value: 0 } },
//     vertexShader: /* your vertex shader that includes */ fxVertexPrefix + '\n' + custom + '\n' + fxVertexSuffix,
//     fragmentShader: /* similar */,
//   });
//
// FX modes (numeric IDs match FXRuntime.FX_MODE_MAP):
//   0 = none         (no modification)
//   1 = glow         (extra outer halo on each point)
//   2 = trail        (per-frame color decay — driver must multiply colors by 0.97 each frame)
//   3 = kaleidoscope (position-based hue shift)
//   4 = ripple       (radial wave pulse on point size)
//   5 = spiral       (angular wave pulse on point size)
//   6 = pulse        (breathing scale 0.7..1.3 at 0.5 Hz)
//   7 = chromatic    (RGB split — R/G/B channels offset by depth)
//   8 = fog          (depth-based alpha fade)
//   9 = heat         (warm center, cool outer)
//  10 = edge-glow    (point grows brighter when near view frustum edge)
//  11 = aura         (soft Fresnel-style halo that brightens with viewing angle)
//  12 = voronoi      (jitter color by 3D Voronoi cell distance)
//  13 = caustic      (animated cellular caustic via layered Voronoi)
//  14 = iridescent   (thin-film interference: hue by viewing angle)
//  15 = flowfield    (curl-noise distortion on point positions + colors)
//  16 = plasma       (classic plasma field: sin waves in xyz)
//  17 = kaleido6     (6-fold kaleidoscope symmetry in fragment)
//  18 = dof          (fake depth-of-field: bigger points when far/near)
//  19 = nebula       (per-point additive volumetric color blend)
//  20 = wireframe    (point grows brighter with neighbor density)
//  ── Round 9 additions ──
//  21 = hologram     (scanline interference + cyan flicker, sci-fi display)
//  22 = xray         (edge-detect invert: bright thin rims, dark cores)
//  23 = crystal      (faceted prismatic refraction along point radius)

export const FX_MODE = {
  NONE: 0, GLOW: 1, TRAIL: 2, KALEIDOSCOPE: 3,
  RIPPLE: 4, SPIRAL: 5, PULSE: 6, CHROMATIC: 7, FOG: 8,
  HEAT: 9, EDGE_GLOW: 10,
  AURA: 11, VORONOI: 12, CAUSTIC: 13, IRIDESCENT: 14,
  FLOWFIELD: 15, PLASMA: 16, KALEIDO6: 17, DOF: 18,
  NEBULA: 19, WIREFRAME: 20,
  HOLOGRAM: 21, XRAY: 22, CRYSTAL: 23,
};

/** Map mode-name strings to numeric IDs — used by FXRuntime. */
export const FX_MODE_NAME_TO_ID = {
  none: 0, glow: 1, trail: 2, kaleidoscope: 3,
  ripple: 4, spiral: 5, pulse: 6, chromatic: 7,
  fog: 8, heat: 9, 'edge-glow': 10,
  aura: 11, voronoi: 12, caustic: 13, iridescent: 14,
  flowfield: 15, plasma: 16, kaleido6: 17, dof: 18,
  nebula: 19, wireframe: 20,
  hologram: 21, xray: 22, crystal: 23,
};
/** Alias of FX_MODE_NAME_TO_ID for view imports. */
export const FX_MODE_MAP = FX_MODE_NAME_TO_ID;

/** Uniforms that every FX-aware material must declare. */
export const FX_UNIFORMS = {
  uFXMode: { value: FX_MODE.NONE },
  uFXIntensity: { value: 0.5 },
};

/** Common GLSL declarations to prepend to vertex shaders. */
export const fxVertexPrefix = /* glsl */`
  uniform int uFXMode;
  uniform float uFXIntensity;
  // returns a per-point scale factor combining FX mode effects
  float fxScale(vec3 worldPos) {
    float s = 1.0;
    if (uFXMode == 4) {
      // Ripple: radial wave pulse on point size
      float r = length(worldPos.xy);
      s *= 1.0 + uFXIntensity * 0.4 * sin(r * 8.0 - uTime * 4.0);
    }
    if (uFXMode == 5) {
      // Spiral: angular wave pulse on point size
      float a = atan(worldPos.y, worldPos.x);
      s *= 1.0 + uFXIntensity * 0.5 * sin(a * 6.0 + uTime * 2.0);
    }
    if (uFXMode == 6) {
      // Pulse: breathing scale 0.7..1.3 at 0.5 Hz
      float p = sin(uTime * 3.14159) * 0.5 + 0.5; // 0..1 over 2 seconds
      s *= 0.7 + 0.6 * p * uFXIntensity;
    }
    if (uFXMode == 10) {
      // Edge-glow: pulse near view frustum edges
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
      vec2 ndc = clip.xy / clip.w;
      float edge = max(abs(ndc.x), abs(ndc.y));
      s *= 1.0 + uFXIntensity * 0.6 * smoothstep(0.7, 1.0, edge);
    }
    if (uFXMode == 13) {
      // Caustic: animated cellular modulation on point size
      vec3 p = worldPos * 1.8 + vec3(0.0, 0.0, uTime * 0.6);
      float v1 = sin(p.x + sin(p.y * 2.0 + uTime));
      float v2 = sin(p.y * 1.3 + sin(p.z * 1.7 - uTime));
      float v3 = sin(p.z + cos(p.x * 1.1 + uTime * 0.8));
      float caustic = (v1 + v2 + v3) / 3.0;
      s *= 1.0 + uFXIntensity * 0.5 * caustic;
    }
    if (uFXMode == 16) {
      // Plasma: classic sin-based volumetric ripples, drives point size
      float p = sin(worldPos.x * 4.0 + uTime)
              + sin(worldPos.y * 3.7 - uTime * 1.3)
              + sin(worldPos.z * 4.3 + uTime * 0.9);
      s *= 1.0 + uFXIntensity * 0.25 * (p / 3.0);
    }
    if (uFXMode == 17) {
      // Kaleido6: 6-fold radial breathing — point size pulses on the polygon symmetry
      float a6 = atan(worldPos.y, worldPos.x);
      float r6 = length(worldPos.xy);
      s *= 1.0 + uFXIntensity * 0.35 * sin(a6 * 6.0 + uTime * 1.6) * smoothstep(0.0, 1.0, r6);
    }
    if (uFXMode == 18) {
      // DOF: make points farther from camera appear slightly larger (lens bokeh)
      vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
      float depth = -mv.z;
      s *= 1.0 + uFXIntensity * smoothstep(2.0, 12.0, depth) * 0.8;
    }
    if (uFXMode == 20) {
      // Wireframe-like: pulse when world position is near a Coxeter lattice line
      // Use sin of multiple axes to fake a wireframe density field
      float w = abs(sin(worldPos.x * 6.0)) * abs(sin(worldPos.y * 6.0)) * abs(sin(worldPos.z * 6.0));
      s *= 1.0 + uFXIntensity * 0.6 * pow(w, 4.0);
    }
    if (uFXMode == 21) {
      // Hologram: a vertical scanline breathing — points pulse along the
      // world Y axis as if swept by a scanner plane. Slow + subtle on size.
      float scan = 0.5 + 0.5 * sin(worldPos.y * 10.0 - uTime * 3.0);
      s *= 1.0 + uFXIntensity * 0.3 * scan;
    }
    if (uFXMode == 23) {
      // Crystal: subtle radial faceting pulse on size (hexagonal symmetry).
      float a = atan(worldPos.y, worldPos.x);
      s *= 1.0 + uFXIntensity * 0.18 * sin(a * 6.0 + uTime * 0.7);
    }
    return s;
  }
  // Returns a per-vertex alpha modifier based on FX mode
  float fxAlpha(vec3 worldPos) {
    float a = 1.0;
    if (uFXMode == 8) {
      // Fog: alpha fades with distance from camera (camera at z=6 in this app)
      vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
      float depth = -mv.z;
      // 0..1 over depth 0..14
      a *= 1.0 - smoothstep(4.0, 14.0, depth) * uFXIntensity;
    }
    if (uFXMode == 12) {
      // Voronoi: dim cells that aren't at a cell center (creates bright dots pattern)
      vec3 p = worldPos * 3.5;
      vec3 ip = floor(p);
      vec3 fp = fract(p);
      float minDist = 1.0;
      for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec3 nb = vec3(float(x), float(y), float(z));
            vec3 seed = nb + 0.5
              + 0.5 * vec3(
                  sin(ip + nb).x,
                  sin((ip + nb).y * 1.7),
                  sin((ip + nb).z * 2.3)
                );
            float d = length(seed - fp);
            minDist = min(minDist, d);
          }
        }
      }
      a *= mix(1.0, minDist * 2.5, uFXIntensity);
    }
    if (uFXMode == 19) {
      // Nebula: low-frequency density; dim outside dense regions
      float d = 0.5 + 0.5 * sin(worldPos.x * 1.4 + uTime * 0.4)
                   * cos(worldPos.y * 1.7 - uTime * 0.3)
                   * sin(worldPos.z * 1.1 + uTime * 0.2);
      a *= mix(1.0, smoothstep(0.0, 0.7, d), uFXIntensity);
    }
    return a;
  }
  // Returns a per-vertex position offset based on FX mode (for flowfield-style distortion)
  vec3 fxOffset(vec3 worldPos) {
    vec3 o = vec3(0.0);
    if (uFXMode == 15) {
      // Flowfield: 3D curl-noise approximation via offset sin/cos
      float t = uTime * 0.4;
      o.x += sin(worldPos.y * 1.7 + t) * cos(worldPos.z * 1.3 - t) * uFXIntensity * 0.3;
      o.y += sin(worldPos.z * 1.5 - t) * cos(worldPos.x * 1.9 + t * 0.7) * uFXIntensity * 0.3;
      o.z += sin(worldPos.x * 1.1 + t * 0.9) * cos(worldPos.y * 1.4 + t) * uFXIntensity * 0.3;
    }
    return o;
  }
`;

/** Vertex shader tail — apply fxScale before gl_PointSize is set. */
export const fxVertexSuffix = /* glsl */`
  // Apply FX scale (must be called with the model's position)
  // gl_PointSize should be multiplied by fxScale(position) in caller
`;

/** Common GLSL declarations for fragment shaders. */
export const fxFragmentPrefix = /* glsl */`
  uniform int uFXMode;
  uniform float uFXIntensity;
  // Chromatic offset — returns rgb with channels slightly shifted
  vec3 fxChromaticOffset(vec2 fragCoord, vec3 base) {
    float d = length(gl_PointCoord - vec2(0.5));
    float ca = uFXIntensity * 0.4;
    // Bias R/G/B by sin functions of angle and distance — creates a prismatic split
    float ang = atan(gl_PointCoord.y - 0.5, gl_PointCoord.x - 0.5);
    return base + vec3(
      sin(ang * 3.0 + uTime * 1.5) * ca,
      sin(ang * 3.0 + uTime * 1.5 + 2.094) * ca,
      sin(ang * 3.0 + uTime * 1.5 + 4.188) * ca
    );
  }
  vec3 fxColor(vec3 base, vec2 glPointCoord, vec3 worldPos, float pointAlpha) {
    vec3 col = base;
    float d = length(glPointCoord - vec2(0.5));

    if (uFXMode == 1) {
      // Glow: extra outer halo
      float g = smoothstep(0.5, 0.05, d) * uFXIntensity * 0.8;
      col += base * g * 2.5;
    }
    if (uFXMode == 3) {
      // Kaleidoscope: position-based hue shift
      float h = sin(worldPos.x * 5.0 + worldPos.y * 3.0 + uTime) * uFXIntensity * 0.6;
      col.r *= (1.0 + h);
      col.g *= (1.0 + h * 0.4);
      col.b *= (1.0 - h * 0.4);
    }
    if (uFXMode == 7) {
      // Chromatic: RGB prism split — R/G/B channels offset by radial angle
      float ca = uFXIntensity * 0.5;
      float ang = atan(glPointCoord.y - 0.5, glPointCoord.x - 0.5);
      float r = sin(ang * 4.0 + uTime * 2.0) * ca;
      float g = sin(ang * 4.0 + uTime * 2.0 + 2.094) * ca;
      float b = sin(ang * 4.0 + uTime * 2.0 + 4.188) * ca;
      col += vec3(r, g, b);
    }
    if (uFXMode == 9) {
      // Heat: warm center, cool outer (uses worldPos distance from origin)
      float dist = length(worldPos);
      float t = clamp(dist * 0.5, 0.0, 1.0);
      vec3 cool = vec3(0.2, 0.4, 1.0);
      vec3 warm = vec3(1.0, 0.6, 0.1);
      col = mix(warm, cool, t) * (0.5 + length(base) * 0.5) * uFXIntensity
          + base * (1.0 - uFXIntensity);
    }
    if (uFXMode == 10) {
      // Edge-glow: brighten at view edges (smooth)
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
      vec2 ndc = clip.xy / clip.w;
      float edge = max(abs(ndc.x), abs(ndc.y));
      col += vec3(1.0, 0.9, 0.6) * smoothstep(0.6, 1.0, edge) * uFXIntensity * 0.8;
    }
    if (uFXMode == 11) {
      // Aura: bright soft Fresnel — outer rim of each point glows
      float rim = pow(d, 2.0);
      col += vec3(0.9, 0.85, 1.0) * rim * uFXIntensity * 1.6;
    }
    if (uFXMode == 12) {
      // Voronoi: tint each cell with a hue derived from cell center
      vec3 p = worldPos * 3.5;
      vec3 ip = floor(p);
      vec3 fp = fract(p);
      float minDist = 1.0;
      vec3 cellCenter = vec3(0.0);
      for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec3 nb = vec3(float(x), float(y), float(z));
            vec3 seed = nb + 0.5
              + 0.5 * vec3(
                  sin(ip + nb).x,
                  sin((ip + nb).y * 1.7),
                  sin((ip + nb).z * 2.3)
                );
            float dd = length(seed - fp);
            if (dd < minDist) {
              minDist = dd;
              cellCenter = ip + nb;
            }
          }
        }
      }
      vec3 tint = 0.5 + 0.5 * cos(6.2831 * (cellCenter * 0.18 + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * tint * 1.6, uFXIntensity);
    }
    if (uFXMode == 13) {
      // Caustic: animated voronoi-cellular caustic overlay
      vec3 p = worldPos * 1.8 + vec3(0.0, 0.0, uTime * 0.6);
      float c = 0.5 + 0.5 * sin(p.x * 3.0 + sin(p.y * 2.0 + uTime));
      c += 0.5 + 0.5 * sin(p.y * 3.7 + sin(p.z * 2.5 - uTime));
      c += 0.5 + 0.5 * sin(p.z * 4.1 + sin(p.x * 2.0 + uTime * 0.7));
      c /= 3.0;
      vec3 caust = mix(vec3(0.2, 0.6, 1.0), vec3(1.0, 0.8, 0.4), c);
      col = mix(col, col + caust * 0.8, uFXIntensity * smoothstep(0.5, 0.0, d));
    }
    if (uFXMode == 14) {
      // Iridescent: thin-film interference — hue shifts with viewing angle (radial)
      float ang = atan(glPointCoord.y - 0.5, glPointCoord.x - 0.5);
      float h = fract(ang / 6.2831 + uTime * 0.1 + d * 1.5);
      vec3 irid = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * irid * 1.5, uFXIntensity * (1.0 - d));
    }
    if (uFXMode == 15) {
      // Flowfield: tint by direction of offset
      float t = uTime * 0.4;
      vec3 dir = vec3(
        sin(worldPos.y * 1.7 + t) * cos(worldPos.z * 1.3 - t),
        sin(worldPos.z * 1.5 - t) * cos(worldPos.x * 1.9 + t * 0.7),
        sin(worldPos.x * 1.1 + t * 0.9) * cos(worldPos.y * 1.4 + t)
      );
      float m = length(dir);
      vec3 flowTint = 0.5 + 0.5 * dir / max(m, 0.001);
      col = mix(col, col * (0.4 + flowTint) * 1.5, uFXIntensity);
    }
    if (uFXMode == 16) {
      // Plasma: classic sin-palette applied to point color
      float p = sin(worldPos.x * 4.0 + uTime)
              + sin(worldPos.y * 3.7 - uTime * 1.3)
              + sin(worldPos.z * 4.3 + uTime * 0.9);
      p = p / 3.0 * 0.5 + 0.5;
      vec3 plas = 0.5 + 0.5 * cos(6.2831 * (p + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * plas * 1.4, uFXIntensity);
    }
    if (uFXMode == 17) {
      // Kaleido6: 6-fold symmetric hue in the fragment (combinatorial with vertex scale)
      float ang = atan(glPointCoord.y - 0.5, glPointCoord.x - 0.5);
      float ang6 = mod(ang, 6.2831 / 6.0);
      float h = fract(ang6 / (6.2831 / 6.0) + uTime * 0.15);
      vec3 k6 = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * k6 * 1.4, uFXIntensity * (1.0 - d));
    }
    if (uFXMode == 18) {
      // DOF: tint near and far with bokeh-like color shift
      vec4 mv = modelViewMatrix * vec4(worldPos, 1.0);
      float depth = -mv.z;
      float near = smoothstep(0.5, 2.0, depth);
      float far = smoothstep(6.0, 14.0, depth);
      vec3 warmBokeh = vec3(1.0, 0.85, 0.6);
      vec3 coolBokeh = vec3(0.6, 0.75, 1.0);
      vec3 bokeh = mix(warmBokeh, coolBokeh, far);
      col = mix(col, col * (1.0 + bokeh * 0.5), uFXIntensity * max(near, far));
    }
    if (uFXMode == 19) {
      // Nebula: warm/cool gas colors based on a noise field
      float d2 = 0.5 + 0.5 * sin(worldPos.x * 1.4 + uTime * 0.4)
                     * cos(worldPos.y * 1.7 - uTime * 0.3)
                     * sin(worldPos.z * 1.1 + uTime * 0.2);
      vec3 gasWarm = vec3(1.0, 0.55, 0.2);
      vec3 gasCool = vec3(0.3, 0.55, 1.0);
      vec3 gas = mix(gasCool, gasWarm, smoothstep(-0.5, 0.5, d2));
      col = mix(col, col * (1.0 + gas), uFXIntensity * smoothstep(0.0, 0.7, d2));
    }
    if (uFXMode == 20) {
      // Wireframe-like: bright cross-hatch lines on points
      float hLine = abs(sin(worldPos.x * 6.0 + worldPos.y * 6.0));
      float vLine = abs(sin(worldPos.x * 6.0 - worldPos.z * 6.0));
      float wires = smoothstep(0.95, 1.0, max(hLine, vLine));
      col = mix(col, vec3(1.0, 0.95, 0.85), uFXIntensity * wires);
    }
    if (uFXMode == 21) {
      // Hologram: cyan tint + horizontal scanlines + flicker + faint rim glow.
      // Classic sci-fi "projected display" look.
      float scan = 0.5 + 0.5 * sin(worldPos.y * 28.0 - uTime * 6.0);
      float flicker = 0.85 + 0.15 * sin(uTime * 23.0) * sin(uTime * 7.0);
      vec3 holo = vec3(0.2, 0.9, 1.0);
      col = mix(col, col * holo * (0.6 + 0.4 * scan) * flicker + holo * 0.15 * (1.0 - d), uFXIntensity);
      // Soft scanline darkening for the "screen door" effect
      col -= vec3(0.0, 0.0, 0.0);
      col *= 0.7 + 0.3 * scan;
    }
    if (uFXMode == 22) {
      // X-ray: invert toward bright thin rims, darken cores — like a medical
      // X-ray or wireframe-through-surface. Strongest at the point edge.
      float rim = smoothstep(0.2, 0.5, d);
      vec3 xrayCol = vec3(0.4, 1.0, 0.9) * pow(rim, 1.5) * 1.8;
      col = mix(col, xrayCol + col * 0.15 * (1.0 - rim), uFXIntensity);
    }
    if (uFXMode == 23) {
      // Crystal: faceted prismatic refraction. Splits the point into concentric
      // hexagonal color bands that rotate slowly — like looking through a prism.
      float a = atan(glPointCoord.y - 0.5, glPointCoord.x - 0.5);
      float band = fract(a * 0.955 / 6.2831 + d * 4.0 + uTime * 0.12);
      vec3 prism = 0.5 + 0.5 * cos(6.2831 * (band + vec3(0.0, 0.33, 0.67)));
      // Hex facet edges brighten
      float hexEdge = smoothstep(0.92, 1.0, abs(sin(a * 6.0)));
      col = mix(col, col * prism * 1.5 + vec3(1.0) * hexEdge * 0.3, uFXIntensity * (1.0 - d * 0.5));
    }
    return col;
  }
`;

/** Per-frame update function — call from each view's update(dt, time, params). */
export function updateFXUniforms(material, params) {
  if (!material || !material.uniforms) return;
  if (material.uniforms.uFXMode) {
    material.uniforms.uFXMode.value = FX_MODE_NAME_TO_ID[params.fxMode] ?? 0;
  }
  if (material.uniforms.uFXIntensity) {
    material.uniforms.uFXIntensity.value = params.fxIntensity ?? 0.5;
  }
}

/** Trail FX: per-frame decay of color intensities (caller invokes this). */
export function applyTrailDecay(geometry, factor = 0.97) {
  const c = geometry.attributes.color.array;
  for (let i = 0; i < c.length; i++) c[i] *= factor;
  geometry.attributes.color.needsUpdate = true;
}
