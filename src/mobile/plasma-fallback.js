// A bounded vector rendition of the neon flow for devices without WebGL.
// Smooth coordinate shears bend whole ribbons, including their broad glow.
const TAU = Math.PI * 2;
function eddy(x, y, cx, cy, strength, radius) {
  const dx = x - cx, dy = y - cy, a = strength * Math.exp(-(dx * dx + dy * dy) / (radius * radius));
  return [cx + Math.cos(a) * dx - Math.sin(a) * dy, cy + Math.sin(a) * dx + Math.cos(a) * dy];
}
function flow(x, y, t) {
  [x, y] = eddy(x, y, -0.85 + Math.sin(t * 0.3) * 0.15, 0.45, 3.6, 1.1);
  [x, y] = eddy(x, y, 0.85, -0.35 + Math.cos(t * 0.27) * 0.15, -3.7, 0.9);
  let frequency = 1.7, amplitude = 0.26;
  for (let i = 0; i < 4; i++) {
    x += Math.sin(y * frequency + t * 0.19 + i * 1.71) * amplitude;
    y += Math.sin(x * frequency - t * 0.16 + i * 2.31) * amplitude;
    frequency *= 1.47; amplitude *= 0.67;
  }
  return [x / 3.1, -y / 3.1];
}
const hash = value => { const n = Math.sin(value * 127.1) * 43758.5453; return n - Math.floor(n); };

export function drawPlasmaFallback(ctx, width, height, size, time) {
  const w = width / size, h = height / size, alpha = ctx.globalAlpha;
  const cycle = 0.5 + 0.5 * Math.sin(time * 0.075 + 1);
  ctx.fillStyle = '#10021c'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.globalCompositeOperation = 'lighter';
  const pools = [
    [-0.26, -0.22, '#e9006d', 0.53], [-0.18, 0.27, '#ff4800', 0.54],
    [0.28, 0.12, '#004ebc', 0.65], [0.27, -0.36, '#8400a8', 0.5],
  ];
  ctx.globalAlpha = alpha * 0.3;
  for (const [x, y, color, radius] of pools) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color); glow.addColorStop(1, color + '00');
    ctx.fillStyle = glow; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const span = Math.max(w, h) * 1.55 + 1.5;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Sixty-four paths and fixed sampling keep the CPU cost independent of DPR.
  for (let i = 0; i < 64; i++) {
    const seed = hash(i + 2), x = (i / 63 * 2 - 1) * span;
    const warm = (Math.sin(i * 0.43 + cycle * 4) + 1) / 2;
    const hue = x > 0.3 ? 260 - cycle * 65 : 319 + warm * 80;
    const path = new Path2D();
    let previousX = 0, previousY = 0;
    for (let j = 0; j <= 192; j++) {
      const y = (j / 192 * 2 - 1) * span;
      const [px, py] = flow(x + Math.sin(y * 1.1 + seed * 9) * 0.1, y, time * 0.16);
      if (!j) path.moveTo(px, py);
      else path.quadraticCurveTo(previousX, previousY, (previousX + px) / 2, (previousY + py) / 2);
      previousX = px; previousY = py;
    }
    path.lineTo(previousX, previousY);
    ctx.strokeStyle = `hsl(${hue} 100% 50%)`;
    ctx.globalAlpha = alpha * 0.10; ctx.lineWidth = 0.066; ctx.stroke(path);
    ctx.globalAlpha = alpha * 0.16; ctx.lineWidth = 0.025; ctx.stroke(path);
    ctx.globalAlpha = alpha * 0.36; ctx.lineWidth = 0.005; ctx.stroke(path);
    ctx.strokeStyle = `hsl(${hue} 100% 78%)`;
    ctx.globalAlpha = alpha * 0.6; ctx.lineWidth = 0.0011; ctx.stroke(path);
  }
  for (let i = 0; i < 220; i++) {
    const x = (hash(i + 31) - 0.5) * w;
    const y = (((hash(i + 94) + time * 0.002) % 1) - 0.5) * h;
    const radius = 0.0006 + hash(i + 173) * 0.0011;
    ctx.globalAlpha = alpha * (0.2 + hash(i + 83) * 0.5);
    ctx.fillStyle = x > 0.1 ? '#b4eaff' : '#ffb895';
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  }
}
