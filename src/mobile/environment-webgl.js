import { STUDIO_BACKGROUND_SHADERS } from '../fx/background-shaders.js';
import { createHydrogenCloud, QUANTUM_POINT_VERTEX, QUANTUM_POINT_FRAGMENT } from '../fx/quantum-orbitals.js';

const GPU_ENVIRONMENTS = new Set(['mandala', 'plasma', 'quantum', 'tide', 'vortex', 'eclipse', 'prism']);

// One small, reusable surface gives Canvas scenes the same procedural artwork
// as desktop. No Three.js dependency; only the visible environment is rendered.
export function createEnvironmentSurface() {
  let canvas, gl, vertex, buffer, quantumBuffer, quantumCloud, lastFrame = '', unavailable = false;
  const programs = new Map();
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Environment shader: ${message}`);
    }
    return shader;
  }
  function initialize() {
    const firstContext = !canvas;
    canvas ??= document.createElement('canvas');
    const contextCanvas = canvas;
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
    if (!gl) { unavailable = true; return false; }
    vertex = compile(gl.VERTEX_SHADER, '#version 300 es\nin vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}');
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    if (firstContext) canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      if (canvas !== contextCanvas) return;
      lastFrame = '';
    });
    if (firstContext) canvas.addEventListener('webglcontextrestored', () => {
      if (canvas !== contextCanvas) return;
      programs.clear();
      vertex = null;
      buffer = null;
      quantumBuffer = null;
      gl = null;
      lastFrame = '';
    });
    return true;
  }
  function programFor(mode) {
    if (programs.has(mode)) return programs.get(mode);
    const quantum = mode === 'quantum';
    const fragmentSource = quantum ? QUANTUM_POINT_FRAGMENT.replaceAll('varying ', 'in ') : STUDIO_BACKGROUND_SHADERS[mode];
    const fragment = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\nout vec4 environmentColor;\n' + fragmentSource.replaceAll('gl_FragColor', 'environmentColor'));
    const pointVertex = quantum ? compile(gl.VERTEX_SHADER, '#version 300 es\n' + QUANTUM_POINT_VERTEX.replaceAll('attribute ', 'in ').replaceAll('varying ', 'out ')) : null;
    const program = gl.createProgram();
    gl.attachShader(program, pointVertex || vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'position');
    if (quantum) gl.bindAttribLocation(program, 1, 'aDensity');
    gl.linkProgram(program);
    gl.deleteShader(fragment);
    if (pointVertex) gl.deleteShader(pointVertex);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Environment program: ${message}`);
    }
    const uniforms = Object.fromEntries(['uTime','uIntensity','uExposure','uAspect','uTexSize'].map(name => [name, gl.getUniformLocation(program, name)]));
    if (quantum) {
      quantumCloud ??= createHydrogenCloud({ count: 32000 });
      quantumBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quantumBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, quantumCloud.data, gl.STATIC_DRAW);
    }
    const entry = { program, uniforms };
    programs.set(mode, entry);
    return entry;
  }
  return {
    render(mode, width, height, time, brightness) {
      if (!GPU_ENVIRONMENTS.has(mode) || unavailable || width <= 0 || height <= 0) return null;
      try {
        if (!gl && !initialize()) return null;
        if (gl.isContextLost()) return null;
        // Fine geometry needs sharper edges; raymarched fields use fewer pixels.
        const limit = mode === 'mandala' || mode === 'prism' ? 1280 : 800;
        const scale = Math.min(1, limit / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        const phase = Math.floor(time * 24) / 24;
        const key = `${mode}:${w}:${h}:${phase}:${brightness}`;
        if (key !== lastFrame) {
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          const { program, uniforms } = programFor(mode);
          gl.viewport(0, 0, w, h);
          gl.useProgram(program);
          const quantum = mode === 'quantum';
          gl.bindBuffer(gl.ARRAY_BUFFER, quantum ? quantumBuffer : buffer);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, quantum ? 3 : 2, gl.FLOAT, false, quantum ? 16 : 0, 0);
          if (quantum) {
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
          } else gl.disableVertexAttribArray(1);
          gl.uniform1f(uniforms.uTime, phase);
          gl.uniform1f(uniforms.uIntensity, brightness);
          gl.uniform1f(uniforms.uExposure, 1.7);
          gl.uniform1f(uniforms.uAspect, width / height);
          gl.uniform2f(uniforms.uTexSize, w, h);
          if (quantum) {
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.drawArrays(gl.POINTS, 0, quantumCloud.count);
            gl.disable(gl.BLEND);
          } else gl.drawArrays(gl.TRIANGLES, 0, 3);
          lastFrame = key;
        }
        return canvas;
      } catch (error) {
        console.warn('Using the Canvas environment fallback.', error);
        unavailable = true;
        return null;
      }
    },
    dispose() {
      if (gl && !gl.isContextLost()) {
        for (const { program } of programs.values()) gl.deleteProgram(program);
        if (vertex) gl.deleteShader(vertex);
        if (buffer) gl.deleteBuffer(buffer);
        if (quantumBuffer) gl.deleteBuffer(quantumBuffer);
      }
      programs.clear();
      gl = null; canvas = null; vertex = null; buffer = null; quantumBuffer = null; quantumCloud = null; lastFrame = ''; unavailable = false;
    },
  };
}
