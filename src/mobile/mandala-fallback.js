// Vector ornament for the no-WebGL path. All coordinates use the shorter
// viewport dimension; no bitmap assets, image downloads, or per-pixel CPU work.
const TAU = Math.PI * 2;
const ENAMEL = ['#102633', '#173940', '#1e5052'];

function almond(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.bezierCurveTo(-w * 0.38, -h * 1.333, w * 0.38, -h * 1.333, w, 0);
  ctx.bezierCurveTo(w * 0.38, h * 1.333, -w * 0.38, h * 1.333, -w, 0);
  ctx.closePath();
}

function relief(ctx, w, h, gold) {
  almond(ctx, w, h);
  ctx.strokeStyle = '#03090c'; ctx.lineWidth = 0.016; ctx.stroke();
  ctx.strokeStyle = gold; ctx.lineWidth = 0.008; ctx.stroke();
  ctx.strokeStyle = '#48381d'; ctx.lineWidth = 0.001; ctx.stroke();
  almond(ctx, w - 0.018, h - 0.014);
  ctx.strokeStyle = gold; ctx.lineWidth = 0.0015; ctx.stroke();
}

function compartment(ctx, w, h, tier, gold) {
  almond(ctx, w, h);
  ctx.fillStyle = ENAMEL[tier % ENAMEL.length]; ctx.fill();
  relief(ctx, w, h, gold);
  ctx.strokeStyle = gold; ctx.fillStyle = gold; ctx.lineWidth = 0.001;
  const radius = (w * w + h * h) / (2 * h);
  for (let i = -7; i <= 7; i++) {
    const x = i / 8 * w;
    const y = Math.sqrt(Math.max(0, radius * radius - x * x)) - radius + h - 0.021;
    if (y < 0.006) continue;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.arc(x, y * side, 0.002, 0, TAU); ctx.fill();
    }
  }
  // Mirrored scrolls and a branch of small engraved leaves.
  ctx.beginPath(); ctx.moveTo(-w * 0.7, 0);
  ctx.bezierCurveTo(-w * 0.3, h * 0.1, w * 0.2, -h * 0.1, w * 0.7, 0); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(w * 0.3, 0);
    ctx.bezierCurveTo(-w * 0.6, side * h * 0.1, -w * 0.5, side * h * 0.8, w * 0.1, side * h * 0.5);
    ctx.bezierCurveTo(w * 0.3, side * h * 0.25, -w * 0.15, side * h * 0.22, -w * 0.1, side * h * 0.4); ctx.stroke();
    for (let j = -2; j <= 2; j++) {
      ctx.save(); ctx.translate(j * w * 0.22, side * h * 0.18); ctx.rotate(side * 0.55);
      almond(ctx, w * 0.085, h * 0.052); ctx.fill();
      ctx.strokeStyle = '#514222'; ctx.lineWidth = 0.0005;
      ctx.beginPath(); ctx.moveTo(-w * 0.07, 0); ctx.lineTo(w * 0.07, 0); ctx.stroke(); ctx.restore();
    }
  }
  if (tier % 3 === 0) {
    ctx.save(); ctx.translate(-w * 0.22, 0);
    ctx.fillStyle = ENAMEL[tier % 3]; ctx.beginPath(); ctx.arc(0, 0, h * 0.39, 0, TAU); ctx.fill();
    ctx.strokeStyle = gold; ctx.lineWidth = 0.0014;
    for (const scale of [1, 0.6]) {
      ctx.beginPath();
      for (let j = 0; j <= 64; j++) {
        const a = j / 64 * TAU, r = (0.29 + Math.cos(a * 8) * 0.06) * h * scale;
        if (!j) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, h * 0.06, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

export function drawMandalaFallback(ctx, width, height, size, time) {
  const gold = ctx.createLinearGradient(-0.3, -0.4, 0.35, 0.45);
  gold.addColorStop(0, '#d2b66d'); gold.addColorStop(0.35, '#97713c');
  gold.addColorStop(0.55, '#bfa05b'); gold.addColorStop(1, '#655027');
  ctx.fillStyle = '#10202b'; ctx.fillRect(-width / size / 2, -height / size / 2, width / size, height / size);
  const diagonal = Math.hypot(width, height) / size / 2;
  for (let tier = 0; tier < 10; tier++) {
    const center = tier === 9 ? 0.182 : 1.42 - tier * 0.147;
    const w = tier === 9 ? 0.12 : 0.207 - tier * 0.007;
    if (center - w > diagonal) continue;
    const count = tier === 9 ? 12 : 32 - Math.floor(tier / 2) * 4;
    const h = tier === 9 ? 0.049 : center * Math.sin(Math.PI / count) * 0.97;
    const phase = (tier % 2) * Math.PI / count + Math.sin(time * 0.025 + tier) * 0.012;
    for (let i = 0; i < count; i++) {
      ctx.save(); ctx.rotate(i / count * TAU + phase); ctx.translate(center, 0);
      compartment(ctx, w, h, tier, gold); ctx.restore();
    }
  }
  almond(ctx, 0.294, 0.131); ctx.fillStyle = '#102b36'; ctx.fill();
  relief(ctx, 0.294, 0.131, gold);
  const white = ctx.createLinearGradient(0, -0.085, 0, 0.085);
  white.addColorStop(0, '#252923'); white.addColorStop(0.52, '#bdbda5'); white.addColorStop(1, '#424639');
  almond(ctx, 0.245, 0.083); ctx.fillStyle = white; ctx.fill();
  ctx.save(); ctx.clip();
  const iris = ctx.createRadialGradient(0, 0, 0.026, 0, 0, 0.077);
  iris.addColorStop(0, '#252a0e'); iris.addColorStop(0.22, '#667333'); iris.addColorStop(0.68, '#4c6029'); iris.addColorStop(1, '#07100a');
  ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(0, 0, 0.077, 0, TAU); ctx.fill();
  for (let i = 0; i < 240; i++) {
    const a = i / 240 * TAU, fiber = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const inner = 0.029 + Math.abs(fiber) * 0.012, outer = 0.072 - Math.abs(fiber) * 0.01;
    ctx.strokeStyle = i % 3 ? '#a4ad585c' : '#19290c80'; ctx.lineWidth = 0.00045;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.quadraticCurveTo(Math.cos(a + 0.02) * 0.05, Math.sin(a + 0.02) * 0.05, Math.cos(a) * outer, Math.sin(a) * outer); ctx.stroke();
  }
  ctx.fillStyle = '#010506'; ctx.beginPath(); ctx.arc(0, 0, 0.028, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ecf4e5'; ctx.beginPath(); ctx.arc(-0.018, -0.024, 0.007, 0, TAU); ctx.fill();
  ctx.restore();
  almond(ctx, 0.251, 0.089); ctx.strokeStyle = gold; ctx.lineWidth = 0.003; ctx.stroke();
}
