import { createEnvironmentSurface } from './environment-webgl.js';
import { drawEnvironmentFallback } from './environment-fallback.js';
// Approved Cloud/Cosmos textures and Ember stay on Canvas; detailed environments
// share the desktop shaders through a bounded, reusable offscreen surface.
const TAU = Math.PI * 2;
const clamp01 = n => Math.max(0, Math.min(1, n));
const hash = (x, y = 0) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const mix = (a, b, t) => a + (b - a) * t;
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy; fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
  return mix(mix(hash(ix,iy),hash(ix+1,iy),fx),mix(hash(ix,iy+1),hash(ix+1,iy+1),fx),fy);
}
function haze(x,y) {
  let value=0, amplitude=0.5;
  for(let i=0;i<4;i++) { value+=noise(x,y)*amplitude; [x,y]=[(0.8*x+0.6*y)*2.03+13.2,(-0.6*x+0.8*y)*2.03+13.2]; amplitude*=0.5; }
  return value;
}

export function createMobileEnvironments() {
  const textures = new Map();
  const surface = createEnvironmentSurface();
  function texture(mode) {
    if(textures.has(mode)) return textures.get(mode);
    const canvas=document.createElement('canvas'); canvas.width=384; canvas.height=320;
    const context=canvas.getContext('2d'), data=context.createImageData(canvas.width,canvas.height);
    for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
      const u=x/canvas.width-0.5, v=y/canvas.height-0.5;
      const n=haze(u*4+3.5,v*4+6.2), detail=haze(u*8+n,v*8-n);
      let color;
      if(mode==='aurora') {
        const billow=haze(u*2.8+n*1.7,v*2.8+detail*1.7);
        const density=clamp01((billow-0.27)/0.37);
        const light=clamp01((billow*0.65+detail*0.45-0.3)/0.36);
        const silver=Math.pow(clamp01((detail-0.37)/0.29),2)*density;
        const value=10+density*(32+light*220)+silver*60;
        color=[value,value,value+0.5];
      } else {
        const qx=0.86*u+0.51*v, qy=-0.51*u+0.86*v;
        const fine=haze(qx*6+5.2,qy*12+5.2), gas=haze(qx*2.8+fine*0.7,qy*6+3.2);
        const band=Math.exp(-Math.pow(qy+(gas-0.5)*0.1,2)*42);
        const core=Math.exp(-Math.pow(qy+(gas-0.5)*0.1,2)*160)*Math.exp(-Math.pow((qx+0.22)*1.25,2));
        const lane=qy+(haze(qx*4+13,qy*9+13)-0.5)*0.16;
        const dust=Math.exp(-lane*lane*1700)*clamp01((fine-0.24)/0.4);
        const cloud=(band*0.12+core*clamp01((gas-0.26)/0.48)*(0.35+fine)*0.58)*(1-dust*0.93);
        color=[0.5+cloud*mix(135,237,core),0.7+cloud*mix(163,217,core),1.5+cloud*mix(214,179,core)];
      }
      const index=(y*canvas.width+x)*4;
      for(let c=0;c<3;c++) data.data[index+c]=color[c];
      data.data[index+3]=255;
    }
    context.putImageData(data,0,0); textures.set(mode,canvas); return canvas;
  }
  function drawEnvironment(mode,ctx,width,height,{brightness=0.7,time=0,quality='balanced'}={}) {
    const gain=Math.max(0,Math.min(1.5,brightness)), size=Math.min(width,height);
    // Low mode keeps the sea motif using vector swells, without compiling or
    // sampling the raymarched ocean. Balanced/High use the detailed water.
    if(mode==='tide' && quality==='smooth') return drawEnvironmentFallback(mode,ctx,width,height,gain,time);
    const gpu = surface.render(mode,width,height,time,gain);
    if(gpu) { ctx.drawImage(gpu,0,0,width,height); return 1; }
    const fallback = drawEnvironmentFallback(mode,ctx,width,height,gain,time);
    if(fallback) return fallback;
    let primitives=0;
    ctx.save();
    if(mode==='aurora'||mode==='cosmos') {
      ctx.globalAlpha=clamp01(gain);
      const dx=Math.sin(time*0.035)*width*0.025, dy=Math.cos(time*0.027)*height*0.02;
      const cloudTexture=texture(mode), scale=Math.max(width/cloudTexture.width,height/cloudTexture.height)*1.12;
      const tw=cloudTexture.width*scale, th=cloudTexture.height*scale;
      ctx.drawImage(cloudTexture,(width-tw)/2+dx,(height-th)/2+dy,tw,th); primitives++;
      ctx.globalAlpha=1;
      if(mode==='cosmos') {
        // A dense unresolved galactic population plus sparse foreground stars.
        for(let i=0;i<920;i++) {
          const x=hash(i,2.7)*width,y=hash(i,9.4)*height;
          const u=(x-width/2)/height,v=(height/2-y)/height;
          const band=Math.exp(-Math.pow(-0.51*u+0.86*v,2)*42);
          if(i>220&&hash(i,8)>band*0.8)continue;
          const power=hash(i,5.7),r=i<220?0.3+Math.pow(power,9)*1.1:0.3+power*0.25;
          const warm=hash(i,3), alpha=clamp01((i<220?0.22+Math.pow(power,4)*0.76:0.15+band*0.20)*gain);
          ctx.fillStyle=`rgba(${Math.round(mix(175,255,warm))},${Math.round(mix(204,234,warm))},${Math.round(mix(255,198,warm))},${alpha})`;
          ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();primitives++;
        }
      }
    } else if(mode==='ember') {
      const warm=ctx.createLinearGradient(0,height,0,0);
      warm.addColorStop(0,`rgba(129,35,8,${clamp01(gain*0.18)})`);warm.addColorStop(1,'rgba(39,7,14,0)');ctx.fillStyle=warm;ctx.fillRect(0,0,width,height);primitives++;
      for(let i=0;i<84;i++) {
        const x=hash(i,1.8)*width+Math.sin(time*0.12+i)*size*0.02,y=((hash(i,5.8)*height-time*(4+hash(i,2)*8))%height+height)%height;
        const fade=Math.min(1,y/30,(height-y)/30), r=0.5+hash(i,7.6)*1.1;
        ctx.fillStyle=`rgba(255,178,86,${clamp01(gain*fade*(0.35+hash(i,4)*0.45))})`;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();primitives++;
        if(i%3===0) { const glow=ctx.createRadialGradient(x,y,0,x,y,9);glow.addColorStop(0,`rgba(251,108,23,${clamp01(gain*fade*0.18)})`);glow.addColorStop(1,'rgba(177,48,8,0)');ctx.fillStyle=glow;ctx.fillRect(x-9,y-9,18,18);primitives++; }
      }
    }
    // Leave breathing room behind the model while keeping the edges atmospheric.
    if(primitives && gain>0) {
      ctx.globalAlpha=1;
      const vignette=ctx.createRadialGradient(width/2,height/2,0,width/2,height/2,Math.hypot(width,height)/2);
      vignette.addColorStop(0,'rgba(0,0,0,0.22)');vignette.addColorStop(0.45,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,0.18)');
      ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);primitives++;
    }
    ctx.restore();
    return primitives;
  }
  drawEnvironment.dispose = () => { surface.dispose(); textures.clear(); };
  return drawEnvironment;
}
