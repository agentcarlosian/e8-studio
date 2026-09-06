// A modest Canvas rendition for devices without a usable WebGL context.
// Keep the same motifs and neutral whites while avoiding per-pixel CPU work.
import { createHydrogenCloud } from '../fx/quantum-orbitals.js';
import { drawMandalaFallback } from './mandala-fallback.js';
import { drawPlasmaFallback } from './plasma-fallback.js';
let fallbackQuantumCloud;
export function drawEnvironmentFallback(mode, ctx, width, height, gain, time) {
  const modes = ['mandala','plasma','quantum','tide','vortex','eclipse','prism'];
  if (!modes.includes(mode)) return 0;
  const size = Math.min(width, height), tau = Math.PI * 2;
  const callerTransform = ctx.getTransform();
  ctx.save();
  ctx.globalAlpha = Math.min(1, gain);
  ctx.fillStyle = '#020306'; ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2); ctx.scale(size, size);
  const polygon = (x, y, r, n, angle) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = angle + i / n * tau;
      if (!i) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
      else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    ctx.closePath();
  };
  if (mode === 'mandala') {
    drawMandalaFallback(ctx, width, height, size, time);
  } else if (mode === 'eclipse') {
    ctx.translate(0,-0.035);
    const corona=ctx.createRadialGradient(0,0,0.249,0,0,0.46);
    corona.addColorStop(0,'#fff4d7');corona.addColorStop(0.07,'#e9a052');corona.addColorStop(0.27,'#87431c');corona.addColorStop(1,'#00000000');
    ctx.fillStyle=corona;ctx.fillRect(-0.5,-0.5,1,1);
    ctx.fillStyle='#000';ctx.beginPath();ctx.arc(0,0,0.255,0,tau);ctx.fill();
  } else if (mode === 'prism') {
    const colors=['#ed5252','#ffb541','#c7ec68','#4bddb0','#5a9ef5','#a776ff'];
    ctx.lineWidth=0.003;
    colors.forEach((color,i)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(0.1,0);ctx.lineTo(width/size,(-0.36+i*0.14)*width/size);ctx.stroke();});
    ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(-width/size,0);ctx.lineTo(-0.13,0);ctx.stroke();
    polygon(-0.035,0,0.242,3,-Math.PI/2);ctx.fillStyle='#ffffff08';ctx.fill();ctx.stroke();
  } else if (mode === 'plasma') {
    drawPlasmaFallback(ctx, width, height, size, time);
  } else if (mode === 'quantum') {
    fallbackQuantumCloud ??= createHydrogenCloud({count:6000});
    const points=fallbackQuantumCloud.data, colors=['#4216a6','#861cad','#d93468','#f87423','#ffce73','#fff9d8'];
    const turn=(x,y,a)=>[Math.cos(a)*x+Math.sin(a)*y,-Math.sin(a)*x+Math.cos(a)*y];
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<points.length;i+=4) {
      let x=points[i],y=points[i+1],z=points[i+2];
      [x,z]=turn(x,z,time*0.009/Math.max(x*x+z*z,0.065));
      [y,z]=turn(y,z,0.57+0.10*Math.sin(time*0.035));
      [x,y]=turn(x,y,0.14+time*0.022);
      const depth=3.1+z,heat=Math.pow(points[i+3],0.43),radius=0.0038*3.1/depth;
      ctx.fillStyle=colors[Math.min(5,Math.floor(heat*6))];
      ctx.globalAlpha=Math.min(1,gain*(0.25+0.55*heat));
      ctx.fillRect(x*1.3/depth-radius/2,-y*1.3/depth-radius/2,radius,radius);
    }
  } else if (mode === 'vortex') {
    // Curved cloud banks around a dark eye, all neutral white and gray.
    for(let i=0;i<260;i++) {
      const r=0.07+Math.sqrt(i/260)*0.47,a=i*2.399+Math.log(r)*3.1-time*0.06;
      const x=Math.cos(a)*r,y=Math.sin(a)*r, radius=0.016+(1-r)*0.06;
      const cloud=ctx.createRadialGradient(x,y,0,x,y,radius);
      cloud.addColorStop(0,'#ffffff24');cloud.addColorStop(1,'#ffffff00');
      ctx.fillStyle=cloud;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
  } else if (mode === 'tide') {
    ctx.setTransform(callerTransform);
    const horizon=height*0.25;
    const sea=ctx.createLinearGradient(0,horizon,0,height);sea.addColorStop(0,'#354d59');sea.addColorStop(1,'#062c38');ctx.fillStyle=sea;ctx.fillRect(0,horizon,width,height-horizon);
    for(let i=0;i<36;i++) {
      const depth=i/35,y=horizon+depth*depth*(height-horizon),amp=2+depth*depth*size*0.06;
      ctx.beginPath();ctx.moveTo(0,height);
      for(let x=0;x<=width+12;x+=12)ctx.lineTo(x,y+Math.sin(x/(24+depth*100)+time*0.7+i)*amp);
      ctx.lineTo(width,height);ctx.closePath();ctx.fillStyle=`rgb(${8+depth*8},${45+depth*24},${60+depth*22})`;ctx.fill();
      ctx.strokeStyle=`rgba(145,201,204,${0.10+depth*0.18})`;ctx.lineWidth=1+depth;ctx.stroke();
    }
  }
  ctx.restore();
  return 1;
}
