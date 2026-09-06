// Hydrogen probability-cloud presentation inspired by kavan010/Atoms:
// https://github.com/kavan010/Atoms. Independent implementation of the standard
// radial Laguerre / angular Legendre wavefunctions, in Bohr-radius units.
export const QUANTUM_ORBITAL = Object.freeze({ n: 4, l: 3, m: 1 });
export const QUANTUM_PARTICLE_COUNT = 64000;

function laguerre(degree, alpha, x) {
  let previous = 1, value = alpha + 1 - x;
  if (degree === 0) return previous;
  for (let order = 2; order <= degree; order++) {
    [previous, value] = [value, ((2 * order - 1 + alpha - x) * value - (order - 1 + alpha) * previous) / order];
  }
  return value;
}

// Normalization constants cancel when building a CDF or relative-density color.
export function hydrogenRadial(n, l, radius) {
  const rho = 2 * radius / n;
  return Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
}

export function hydrogenAngular(l, m, cosine) {
  const order = Math.abs(m), transverse = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  let diagonal = 1;
  for (let i = 1; i <= order; i++) diagonal *= -(2 * i - 1) * transverse;
  if (l === order) return diagonal;
  let previous = diagonal, value = (2 * order + 1) * cosine * diagonal;
  for (let degree = order + 2; degree <= l; degree++) {
    [previous, value] = [value, ((2 * degree - 1) * cosine * value - (degree + order - 1) * previous) / (degree - order)];
  }
  return value;
}

function distribution(min, max, bins, probability) {
  const cdf = new Float64Array(bins + 1), step = (max - min) / bins;
  let previous = probability(min);
  for (let i = 1; i <= bins; i++) {
    const next = probability(min + i * step);
    cdf[i] = cdf[i - 1] + (previous + next) * step / 2;
    previous = next;
  }
  const total = cdf[bins];
  for (let i = 1; i <= bins; i++) cdf[i] /= total;
  return quantile => {
    let low = 0, high = bins;
    while (high - low > 1) {
      const middle = (low + high) >>> 1;
      if (cdf[middle] < quantile) low = middle; else high = middle;
    }
    const fraction = (quantile - cdf[low]) / Math.max(1e-15, cdf[high] - cdf[low]);
    return min + (low + fraction) * step;
  };
}

export function createHydrogenCloud({ n = 4, l = 3, m = 1, count = QUANTUM_PARTICLE_COUNT, seed = 0x4f010e8 } = {}) {
  if (![n,l,m,count,seed].every(Number.isInteger) || n < 1 || n > 6 || l < 0 || l >= n || Math.abs(m) > l || count < 1 || count > QUANTUM_PARTICLE_COUNT) {
    throw new RangeError('Invalid hydrogen state or particle budget');
  }
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0;
    let value = Math.imul(randomState ^ (randomState >>> 15), randomState | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const radiusMax = 10 * n * n;
  let radialPeak = 0, angularPeak = 0;
  const radial = r => { const squared = hydrogenRadial(n,l,r) ** 2; radialPeak = Math.max(radialPeak,squared); return r * r * squared; };
  const angular = cosine => { const squared = hydrogenAngular(l,m,cosine) ** 2; angularPeak = Math.max(angularPeak,squared); return squared; };
  const sampleRadius = distribution(0,radiusMax,4096,radial);
  // Sampling cos(theta) directly includes the spherical volume element.
  const sampleCosine = distribution(-1,1,2048,angular);
  const bohrToScene = 1.20 / sampleRadius(0.995), peak = radialPeak * angularPeak;
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const radius = sampleRadius(random()), cosine = sampleCosine(random()), phi = random() * Math.PI * 2;
    const transverse = Math.sqrt(Math.max(0,1-cosine*cosine)), scaled = radius * bohrToScene, offset = i * 4;
    data[offset] = scaled * transverse * Math.cos(phi);
    data[offset + 1] = scaled * cosine;
    data[offset + 2] = scaled * transverse * Math.sin(phi);
    data[offset + 3] = Math.min(1, (hydrogenRadial(n,l,radius) * hydrogenAngular(l,m,cosine)) ** 2 / peak);
  }
  return { data, count, bohrToScene, n, l, m };
}

export const QUANTUM_POINT_VERTEX = /* glsl */`
precision highp float;
attribute vec3 position;
attribute float aDensity;
uniform float uTime;
uniform float uAspect;
uniform vec2 uTexSize;
varying float vDensity;
varying float vDepth;
mat2 quantumTurn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
void main() {
  vec3 p=position;
  // Azimuthal sample circulation preserves the stationary |Y_l^m|^2 density.
  // Time is slowed and bounded for display; these are not electron trajectories.
  p.xz=quantumTurn(uTime*0.009/max(dot(p.xz,p.xz),0.065))*p.xz;
  p.yz=quantumTurn(0.57+0.10*sin(uTime*0.035))*p.yz;
  p.xy=quantumTurn(0.14+uTime*0.022)*p.xy;
  float depth=3.1+p.z, fit=min(uAspect,1.0);
  vec2 projected=p.xy*1.30/depth;
  gl_Position=vec4(projected*2.0*vec2(fit/uAspect,fit),0.99,1.0);
  gl_PointSize=clamp(uTexSize.y*fit*(0.0017+0.0010*sqrt(aDensity))*3.1/depth,1.0,4.5);
  vDensity=aDensity;
  vDepth=clamp(3.1/depth,0.65,1.4);
}`;

export const QUANTUM_POINT_FRAGMENT = /* glsl */`
precision highp float;
uniform float uIntensity;
uniform float uExposure;
varying float vDensity;
varying float vDepth;
void main() {
  float radius=length(gl_PointCoord-0.5);
  float coverage=1.0-smoothstep(0.12,0.5,radius);
  float heat=pow(vDensity,0.65);
  vec3 color=mix(vec3(0.22,0.025,0.68),vec3(0.91,0.055,0.25),smoothstep(0.02,0.40,heat));
  color=mix(color,vec3(1.0,0.43,0.045),smoothstep(0.32,0.69,heat));
  color=mix(color,vec3(1.0,0.93,0.64),smoothstep(0.63,0.92,heat));
  color=mix(color,vec3(1.0),smoothstep(0.86,1.0,heat));
  gl_FragColor=vec4(color*coverage*(0.55+0.45*heat)*vDepth*uIntensity*uExposure,1.0);
}`;
