// Procedural environments: bounded loops, resolution-aware detail, slow motion.
// All environments share the same coordinate and intensity contract.
const ENVIRONMENT_COMMON = /* glsl */`
uniform float uTime;
uniform float uIntensity;
uniform float uAspect;
uniform vec2 uTexSize;
uniform vec3 uColorA;
uniform vec3 uColorB;
vec2 spaceUV() { return (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0); }
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash22(vec2 p) { return vec2(hash21(p), hash21(p + 17.81)); }
float softNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x), mix(hash21(i + vec2(0,1)), hash21(i + 1.0), f.x), f.y);
}
float haze(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * softNoise(p); p = mat2(0.8,-0.6,0.6,0.8) * p * 2.03 + 13.2; a *= 0.5; }
  return v;
}
float fineLine(float d, float width) { return 1.0 - smoothstep(width, width + max(fwidth(d), 0.0005), abs(d)); }
void finishEnvironment(vec3 color, vec2 uv) {
  float centerSpace = 0.64 + 0.36 * smoothstep(0.10, 0.58, length(uv));
  float vignette = 1.0 - 0.28 * smoothstep(0.35, 1.15, length(uv / vec2(max(uAspect,1.0),1.0)));
  color = max(color, 0.0) * uIntensity * centerSpace * vignette;
  gl_FragColor = vec4(color / (1.0 + color * 0.65), 1.0);
}
`;

const CLOUD_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
void main() {
  vec2 uv = spaceUV(), p = uv * 2.8 + vec2(uTime * 0.018, -uTime * 0.008);
  vec2 warp = vec2(haze(p + 3.1), haze(p - 6.2));
  float billow = haze(p + warp * 1.7);
  float detail = haze(p * 3.0 - warp * 0.7);
  float cloud = smoothstep(0.27, 0.64, billow);
  float light = smoothstep(0.30, 0.66, billow * 0.65 + detail * 0.45);
  float silver = pow(smoothstep(0.37, 0.66, detail), 2.0) * cloud;
  vec3 sky = vec3(0.014,0.019,0.026);
  vec3 body = mix(uColorB * 0.3, uColorA * 2.9, light);
  finishEnvironment(mix(sky, body, cloud) + uColorA * silver * 0.8, uv);
}`;

const COSMOS_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
float galacticNoise(vec2 p) {
  float value=0.0, weight=0.5;
  for(int i=0;i<6;i++) { value+=softNoise(p)*weight; p=mat2(0.8,-0.6,0.6,0.8)*p*2.11+17.2; weight*=0.5; }
  return value;
}
vec3 stellarLayer(vec2 uv,float scale,float seed,float concentration) {
  vec2 cell=floor(uv*scale), f=fract(uv*scale);
  vec2 pos=0.16+hash22(cell+seed)*0.68;
  float chance=hash21(cell+seed+4.9), power=hash21(cell+seed+12.7);
  float distancePixels=length(f-pos)*uTexSize.y/scale;
  float radius=mix(0.35,1.35,pow(power,9.0));
  float point=(1.0-smoothstep(radius*0.25,radius+0.65,distancePixels));
  float halo=exp(-distancePixels*0.7)*pow(power,15.0)*0.22;
  float brightness=0.18+pow(power,5.0)*2.8;
  vec3 temperature=mix(vec3(0.65,0.79,1.0),vec3(1.0,0.88,0.69),hash21(cell+seed+2.4));
  return temperature*(point+halo)*brightness*step(1.0-concentration,chance);
}
void main() {
  vec2 uv=spaceUV(), drift=uv+vec2(uTime*0.0006,0.0);
  vec2 q=mat2(0.86,-0.51,0.51,0.86)*drift;
  float fine=galacticNoise(q*vec2(6.0,12.0)+5.2);
  float gas=galacticNoise(q*vec2(2.8,6.0)+vec2(fine*0.7,3.2));
  float width=q.y+(gas-0.5)*0.1;
  float band=exp(-width*width*42.0);
  float core=exp(-width*width*160.0)*exp(-pow((q.x+0.22)*1.25,2.0));
  float lane=q.y+(galacticNoise(q*vec2(4.0,9.0)+13.0)-0.5)*0.16;
  float dust=exp(-lane*lane*1700.0)*smoothstep(0.24,0.64,fine);
  float wisps=smoothstep(0.26,0.74,gas)*(0.35+fine);
  vec3 unresolved=mix(vec3(0.53,0.64,0.84),vec3(0.93,0.85,0.7),core);
  vec3 galaxy=unresolved*(band*0.12+core*wisps*0.58)*(1.0-dust*0.93);
  float hydrogen=pow(smoothstep(0.52,0.76,fine),3.0)*band;
  galaxy+=vec3(0.34,0.09,0.14)*hydrogen*0.13;
  vec3 stars=stellarLayer(drift,28.0,2.7,0.15)+stellarLayer(drift,64.0,11.3,0.13)
    +stellarLayer(drift,145.0,31.2,0.08+band*0.18)*(0.24+band*0.38)
    +stellarLayer(drift,290.0,45.1,band*0.26)*0.24;
  finishEnvironment(vec3(0.0015,0.0025,0.006)+galaxy+stars*(1.0-dust*0.65),uv);
}`;

const MANDALA_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
const float PI=3.14159265;
const float TAU=6.2831853;
mat2 turn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
// Intersected circular arcs give a pointed, carved enamel compartment.
float almond(vec2 p,vec2 size) {
  float radius=(size.x*size.x+size.y*size.y)/(2.0*size.y);
  return length(vec2(p.x,abs(p.y)+radius-size.y))-radius;
}
float ink(float d,float width) {
  return 1.0-smoothstep(width,width+max(fwidth(d),0.00045),abs(d));
}
vec3 gild(vec3 col,float d,float width,vec2 p,float grain) {
  float edge=clamp(d/width,-1.0,1.0);
  vec2 normal=normalize(vec2(dFdx(d),dFdy(d))+vec2(0.0000001));
  float light=0.67-0.36*edge*dot(normal,normalize(vec2(-0.6,0.8)));
  float crown=sqrt(max(0.0,1.0-edge*edge));
  float glint=pow(crown,8.0)*(0.10+0.07*sin(uTime*0.16+p.x*5.0));
  vec3 gold=mix(vec3(0.32,0.175,0.051),vec3(1.22,0.90,0.40),light);
  gold*=0.74+grain*0.32;
  gold+=vec3(0.8,0.63,0.34)*glint;
  col*=1.0-ink(d,width*2.1)*0.65;
  return mix(col,gold,ink(d,width));
}
float scroll(vec2 p) {
  float r=length(p),a=atan(p.y,p.x);
  float d=abs(mod(a+r*17.0+PI,TAU)-PI)*r/5.0;
  return max(d,r-0.31);
}
vec3 ornament(vec3 col,vec2 q,vec2 size,float id,vec2 p,float grain) {
  // Leave a wide margin around the relief so derivatives remain valid at its edges.
  if(abs(q.x)>size.x+0.025 || abs(q.y)>size.y+0.025) return col;
  float d=almond(q,size),aa=max(fwidth(d),0.0005);
  float inside=1.0-smoothstep(-aa,aa,d);
  // Deep recess, teal enamel and three raised gold mouldings.
  col*=1.0-(1.0-smoothstep(0.0,0.013,d))*0.83;
  vec2 s=q/size;
  vec3 enamel=mix(vec3(0.024,0.055,0.079),vec3(0.065,0.175,0.184),mod(id,3.0)/2.0);
  enamel*=0.55+0.8*grain+0.22*s.y;
  enamel*=0.50+0.5*smoothstep(0.0,0.03,-d);
  col=mix(col,enamel,inside);
  col=gild(col,d+0.003,0.0035,p,grain);
  col=gild(col,d+0.011,0.0013,p,grain);
  col=gild(col,d+0.018,0.0011,p,grain);
  float inset=1.0-smoothstep(-0.023,-0.021,d);
  // Beaded trim follows the two curved rims, with each bead shaded as a rivet.
  float beadX=(floor(q.x/0.012)+0.5)*0.012;
  float radius=(size.x*size.x+size.y*size.y)/(2.0*size.y);
  float beadY=max(0.0,sqrt(max(0.0,radius*radius-beadX*beadX))-(radius-size.y)-0.025);
  float beads=length(vec2(q.x-beadX,abs(q.y)-beadY))-0.002;
  vec3 beadColor=gild(col,beads,0.0011,p,grain);
  col=mix(col,beadColor,inset);
  // Symmetric curling stems, paired engraved leaves, and diamond inlays.
  float stem=abs(s.y-0.04*sin(s.x*5.0));
  vec2 curl=vec2(s.x*0.7+0.03,abs(s.y)-0.36);
  float carving=min(stem,scroll(curl));
  vec2 leaf=vec2(mod(s.x+0.125,0.25)-0.125,abs(s.y)-0.15);
  leaf=turn(-0.65)*leaf;
  float leaves=almond(leaf,vec2(0.105,0.045));
  float leafVein=abs(leaf.y)+max(0.0,abs(leaf.x)-0.085);
  float diamonds=abs(s.x+0.65)*0.8+abs(s.y)-0.12;
  vec2 flower=vec2((s.x+0.23)*1.55,s.y);
  float flowerR=length(flower),flowerA=atan(flower.y,flower.x);
  float rosette=flowerR-(0.29+0.065*cos(flowerA*8.0));
  float rosetteInner=flowerR-(0.17+0.03*cos(flowerA*8.0));
  float rosetteCore=flowerR-0.065;
  float flowerZone=1.0-smoothstep(0.36,0.40,flowerR);
  if(mod(id,3.0)<0.5) {
    carving=mix(carving,1.0,flowerZone);
    leaves=mix(leaves,1.0,flowerZone);
    leafVein=mix(leafVein,1.0,flowerZone);
  }
  vec3 chased=col;
  chased=gild(chased,carving*size.y,0.00085,p,grain);
  chased=gild(chased,leaves*size.y,0.0013,p,grain);
  chased=gild(chased,leafVein*size.y,0.00045,p,grain);
  chased=gild(chased,diamonds*size.y,0.0010,p,grain);
  if(mod(id,3.0)<0.5) {
    chased=gild(chased,rosette*size.y,0.0013,p,grain);
    chased=gild(chased,rosetteInner*size.y,0.0009,p,grain);
    chased=gild(chased,rosetteCore*size.y,0.0011,p,grain);
  }
  return mix(col,chased,inset);
}
vec3 eye(vec3 col,vec2 p,float grain) {
  float d=almond(p,vec2(0.245,0.083));
  float frame=almond(p,vec2(0.294,0.131));
  float aa=max(fwidth(d),0.00045);
  col*=1.0-(1.0-smoothstep(0.0,0.014,frame))*0.84;
  col=mix(col,vec3(0.028,0.073,0.087)*(0.8+grain*0.5),1.0-smoothstep(-aa,aa,frame));
  col=gild(col,frame+0.003,0.0033,p,grain);
  col=gild(col,frame+0.011,0.0012,p,grain);
  // Tiny palm-shaped engravings decorate the eyelid frame.
  vec2 lid=vec2(mod(p.x+0.009,0.018)-0.009,abs(p.y));
  float lidY=0.11*(1.0-pow(abs(p.x)/0.29,1.8));
  float engraving=almond(turn(0.5)*vec2(lid.x,lid.y-lidY),vec2(0.009,0.0035));
  vec3 engraved=gild(col,engraving,0.00055,p,grain);
  col=mix(col,engraved,(1.0-smoothstep(-0.016,-0.014,frame))*smoothstep(0.008,0.018,d));
  float r=length(p),a=atan(p.y,p.x),irisRadius=0.077;
  float scleraShade=0.3+0.65*pow(max(0.0,1.0-abs(p.x)/0.245),0.3);
  scleraShade*=0.35+0.65*smoothstep(0.0,0.028,-d);
  vec3 eyeball=vec3(0.92,0.89,0.76)*scleraShade;
  float fiber=softNoise(vec2(a*91.0,r*260.0))*0.55+softNoise(vec2(a*177.0,r*45.0))*0.45;
  float striation=pow(0.5+0.5*sin(a*173.0+sin(a*23.0)*3.0+r*115.0),3.0);
  float irisDepth=smoothstep(0.027,0.043,r)*(1.0-smoothstep(0.061,0.079,r));
  vec3 iris=mix(vec3(0.057,0.098,0.019),vec3(0.39,0.47,0.12),fiber);
  iris+=vec3(0.39,0.39,0.13)*striation*irisDepth*0.75;
  iris*=0.28+irisDepth*1.35;
  iris+=vec3(0.30,0.23,0.035)*exp(-abs(r-0.037)*270.0)*fiber;
  eyeball=mix(eyeball,iris,1.0-smoothstep(irisRadius-0.001,irisRadius+0.001,r));
  float pupil=1.0-smoothstep(0.027,0.029,r);
  eyeball=mix(eyeball,vec3(0.0005,0.0015,0.002),pupil);
  float reflection=1.0-smoothstep(0.006,0.009,length(p-vec2(-0.018,0.024)));
  eyeball+=vec3(0.95,1.03,1.05)*reflection;
  eyeball+=vec3(0.09,0.14,0.16)*exp(-length(p-vec2(-0.023,0.021))*85.0);
  col=mix(col,eyeball,1.0-smoothstep(-aa,aa,d));
  col=gild(col,d-0.005,0.0021,p,grain);
  col=gild(col,d-0.012,0.0009,p,grain);
  return col;
}
void main() {
  vec2 uv=spaceUV(),p=uv/min(uAspect,1.0);
  float r=length(p),a=atan(p.y,p.x);
  float grain=0.4+0.6*softNoise(p*650.0);
  vec3 col=vec3(0.016,0.034,0.046);
  // Radial folding evaluates one compartment per tier, not every repeated petal.
  // The outer tiers continue past the viewport so the engraving fills every corner.
  for(int i=0;i<9;i++) {
    float tier=float(i),center=1.42-tier*0.147;
    float count=32.0-floor(tier/2.0)*4.0;
    float phase=mod(tier,2.0)*PI/count+sin(uTime*0.025+tier)*0.012;
    float sector=TAU/count,angle=mod(a+phase+sector*0.5,sector)-sector*0.5;
    vec2 q=vec2(cos(angle),sin(angle))*r-vec2(center,0.0);
    vec2 size=vec2(0.207-tier*0.007,center*sin(sector*0.5)*0.97);
    col=ornament(col,q,size,tier,p,grain);
  }
  // A smaller counter-rotating corona meets the central almond-shaped eye.
  float angle=mod(a+sin(uTime*0.025)*0.015+PI/12.0,TAU/12.0)-PI/12.0;
  vec2 q=vec2(cos(angle),sin(angle))*r-vec2(0.182,0.0);
  col=ornament(col,q,vec2(0.12,0.049),2.0,p,grain);
  col=eye(col,p,grain);
  finishEnvironment(col*1.6,uv);
}`;

const PLASMA_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
const float TAU=6.2831853;
vec2 eddy(vec2 p,vec2 center,float strength,float radius) {
  vec2 q=p-center;
  float angle=strength*exp(-dot(q,q)/(radius*radius));
  return center+mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
}
vec2 plasmaFlow(vec2 p,float t) {
  p=eddy(p,vec2(-0.9,0.55)+vec2(sin(t*0.3),cos(t*0.27))*0.15,2.6,1.05);
  p=eddy(p,vec2(0.9,-0.2)+vec2(cos(t*0.23),sin(t*0.31))*0.17,-2.5,0.95);
  p=eddy(p,vec2(-0.1,-1.2),3.0,0.8);
  p=eddy(p,vec2(-1.8,-0.7),2.8,0.7);
  p=eddy(p,vec2(0.15,0.95),-3.0,0.62);
  p=eddy(p,vec2(1.6,-0.9),2.5,0.62);
  // Alternating smooth shears stretch the gas into folded ribbons. Each shear
  // preserves area, so the folds retain thin detail as they flow through eddies.
  float frequency=1.7,amplitude=0.38;
  for(int i=0;i<6;i++) {
    p.x+=sin(p.y*frequency+t*0.19+float(i)*1.71)*amplitude;
    p.y+=sin(p.x*frequency-t*0.16+float(i)*2.31)*amplitude;
    frequency*=1.47;amplitude*=0.67;
  }
  return p;
}
float plasmaDust(vec2 p,float scale,float seed) {
  vec2 grid=p*scale,cell=floor(grid),position=0.15+0.7*hash22(cell+seed);
  float d=length(fract(grid)-position),power=hash21(cell+seed+7.9);
  float aa=max(fwidth(grid.x),fwidth(grid.y));
  float point=1.0-smoothstep(0.009,0.025+aa,d);
  float glow=exp(-d*16.0)*pow(power,20.0)*0.6;
  return (point*0.6+glow)*step(0.81,power)*(0.7+0.3*sin(uTime*0.6+power*29.0));
}
void main() {
  vec2 uv=spaceUV(),p=uv/min(uAspect,1.0),q=plasmaFlow(p*3.1,uTime*0.16);
  float drift=uTime*0.025;
  vec2 turbulence=vec2(haze(q*1.8+vec2(drift*0.13,9.2)),haze(q*1.8+vec2(8.3,-drift*0.11)))-0.5;
  q+=turbulence*2.1;
  float field=q.x*0.9+q.y*0.3+softNoise(q*2.1+4.7)*0.55-drift;
  float band=abs(sin(field*6.3));
  float ripple=sin(field*46.0+softNoise(q*4.0)*3.0)*0.5+0.5;
  float veil=exp(-band*2.5),bloom=exp(-band*6.0);
  float ridge=1.0-smoothstep(0.012,0.019+max(fwidth(band),0.001),band);
  float filaments=pow(ripple,11.0)*veil*(0.3+softNoise(q*7.0));
  // Subpixel folds dissolve into the gas instead of producing dotted contours.
  ridge*=1.0-smoothstep(0.13,0.65,fwidth(field)*6.3);
  filaments*=1.0-smoothstep(0.4,1.5,fwidth(field)*46.0);
  float mist=haze(q*1.7+vec2(drift,4.1));
  ridge*=0.35+0.65*smoothstep(0.3,0.65,mist);
  float cycle=0.5+0.5*sin(uTime*0.075+1.0);
  float warm=pow(0.5+0.5*sin(q.y*0.75+q.x*0.4+cycle*4.0),2.0);
  float heat=exp(-dot(p-vec2(-0.26,-0.12),p-vec2(-0.26,-0.12))*5.0)*(0.4+mist*0.5);
  warm=clamp(warm*0.85+heat*0.75,0.0,1.0);
  float cool=smoothstep(-0.15,0.43,p.x+0.12*sin(p.y*4.0+cycle*2.0)+(mist-0.5)*0.7);
  vec3 hot=mix(vec3(1.4,0.012,0.36),vec3(1.8,0.18,0.006),warm);
  vec3 cold=mix(vec3(0.14,0.025,1.15),vec3(0.006,0.83,1.65),clamp(pow(cycle,1.5)+0.20*sin(q.y),0.0,1.0));
  vec3 gas=mix(hot,cold,cool);
  vec3 edge=mix(mix(vec3(2.1,0.14,0.79),vec3(2.2,1.05,0.035),warm),vec3(0.26,1.5,2.0),cool);
  float cloud=smoothstep(0.28,0.78,mist+veil*0.28);
  vec3 col=vec3(0.022,0.002,0.057)+gas*(0.05+cloud*0.42);
  col+=gas*(veil*(0.5+mist*0.65)+bloom*0.45);
  col+=edge*(ridge*0.50+filaments*0.38);
  col+=vec3(1.2,0.3,0.008)*pow(warm,3.0)*cloud*(1.0-cool)*0.6;
  // Drifting sparks brighten as the luminous gas flows past them.
  float dust=plasmaDust(p-vec2(drift*0.035,drift*0.08),90.0,4.3);
  dust+=plasmaDust(p+vec2(drift*0.02,-drift*0.04),43.0,17.1)*0.45;
  col+=mix(gas,vec3(1.4,1.05,0.76),0.55)*dust*(0.25+veil*0.8);
  finishEnvironment(col*1.25,uv);
}`;

const TIDE_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
float seaHeight(vec2 p) {
  float t=uTime*0.62;
  float swell=sin(p.y*1.45-p.x*0.22-t);
  float crest=pow(0.5+0.5*swell,3.0);
  return crest*0.74-0.27+sin(p.y*2.55+p.x*0.57-t*1.35)*0.10
    +sin(p.x*2.8+p.y*1.3+t*0.7)*0.055+sin(p.x*6.4-p.y*4.5-t*1.6)*0.021;
}
vec3 oceanSky(vec3 d) {
  float horizon=exp(-abs(d.y)*8.0);
  vec3 sky=mix(vec3(0.018,0.036,0.062),vec3(0.21,0.32,0.39),horizon);
  float light=pow(max(dot(d,normalize(vec3(-0.5,0.32,1.0))),0.0),64.0);
  return sky+vec3(0.58,0.67,0.68)*light*0.7;
}
void main() {
  vec2 uv=spaceUV();
  vec3 origin=vec3(0.0,1.55,-2.5), ray=normalize(vec3(uv.x*1.25,uv.y-0.24,1.3));
  vec3 col=oceanSky(ray);
  if(ray.y< -0.006) {
    float far=min(100.0,2.1/-ray.y);
    float hit=max(0.0,(origin.y-0.66)/-ray.y);
    // Stay above the heightfield until the first surface. A coarse uniform
    // march can skip a crest and expose distant water as horizontal shelves.
    float slopeBound=-ray.y+1.35*length(ray.xz);
    bool found=false;
    for(int i=0;i<96;i++) {
      vec3 p=origin+ray*hit;
      float gap=p.y-seaHeight(p.xz);
      if(gap<0.001+hit*0.0001) { found=true;break; }
      hit+=max(gap/slopeBound,0.0005);
      if(hit>far)break;
    }
    col=oceanSky(vec3(ray.x,0.0,ray.z));
    if(found || hit<far) {
      vec3 p=origin+ray*hit;
      float e=0.012+hit*0.0003, h=seaHeight(p.xz);
      vec3 normal=normalize(vec3(seaHeight(p.xz-vec2(e,0.0))-seaHeight(p.xz+vec2(e,0.0)),2.0*e,seaHeight(p.xz-vec2(0.0,e))-seaHeight(p.xz+vec2(0.0,e))));
      vec3 reflection=reflect(ray,normal), light=normalize(vec3(-0.5,0.65,0.9));
      float fresnel=0.04+0.96*pow(1.0-max(dot(-ray,normal),0.0),4.0);
      float sun=pow(max(dot(reflection,light),0.0),95.0);
      vec3 water=mix(vec3(0.012,0.082,0.105),vec3(0.035,0.29,0.30),smoothstep(-0.2,0.48,h));
      water*=0.55+max(dot(normal,light),0.0)*0.75;
      col=mix(water,oceanSky(reflection),fresnel*0.78)+vec3(0.75,0.87,0.88)*sun*1.8;
      float broken=softNoise(p.xz*vec2(9.0,14.0)+vec2(0.0,uTime*0.18));
      float foam=smoothstep(0.32,0.51,h+broken*0.14)*smoothstep(0.27,0.7,broken);
      float bubbles=softNoise(p.xz*75.0+broken*5.0);
      foam*=smoothstep(0.15,0.7,bubbles)*0.72+0.28;
      col=mix(col,vec3(0.73,0.87,0.86)*(0.6+0.4*max(dot(normal,light),0.0)),foam*0.88);
      col=mix(col,oceanSky(vec3(ray.x,0.0,ray.z)),1.0-exp(-hit*0.025));
    }
  }
  finishEnvironment(col*1.35,uv);
}`;

const EMBER_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
float sparks(vec2 uv,float scale,float seed) {
  vec2 p=uv*scale-vec2(uTime*0.025,uTime*0.16), id=floor(p), f=fract(p);
  vec2 pos=0.2+0.6*hash22(id+seed), d=f-pos;
  float life=hash21(id+seed+6.7);
  d.x += sin(uTime*0.12+id.y)*0.06;
  float core=exp(-dot(d,d)*900.0);
  float halo=exp(-dot(d,d)*65.0)*0.15;
  float trail=exp(-abs(d.x)*65.0-abs(d.y+0.07)*14.0)*0.22;
  return (core+halo+trail)*step(0.72,life)*(0.6+0.4*sin(uTime*0.35+life*12.0));
}
void main() {
  vec2 uv=spaceUV();
  float smoke=haze(uv*4.0-vec2(0.0,uTime*0.027));
  float warmth=exp(-pow((uv.y+0.62)*1.6,2.0))*(0.3+smoke);
  float motes=sparks(uv,12.0,3.0)+sparks(uv+4.0,27.0,9.0)*0.35;
  finishEnvironment(vec3(0.008,0.002,0.004)+uColorB*warmth*0.20+uColorA*motes*1.2,uv);
}`;


const VORTEX_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
void main() {
  vec2 uv=spaceUV(), p=uv/min(uAspect,1.0);
  float r=length(p), a=atan(p.y,p.x), t=uTime*0.06;
  float swirl=a+1.85*log(r+0.075)-t;
  vec2 q=r*vec2(cos(swirl),sin(swirl));
  float mass=haze(q*8.0+vec2(2.4,5.7));
  vec2 turbulence=vec2(haze(p*17.0+vec2(t,3.1)),haze(p*19.0-t));
  float texture=haze(q*31.0+turbulence*1.3);
  float bands=0.5+0.5*sin(swirl*4.0+mass*6.0);
  float cloud=smoothstep(0.22,0.68,mass*0.76+bands*0.24);
  float envelope=1.0-smoothstep(0.29,0.65,r+(mass-0.5)*0.12);
  float eyeRadius=0.058+(softNoise(vec2(cos(a),sin(a))*5.0+t)-0.5)*0.009;
  float eye=smoothstep(eyeRadius,eyeRadius+0.023,r);
  float eyewall=exp(-pow((r-eyeRadius-0.037)*23.0,2.0));
  float body=(cloud*0.88+eyewall*0.60)*(0.36+texture*1.6);
  float light=haze(q*31.0+turbulence*1.3+vec2(-0.11,0.15));
  float sculpt=clamp((texture-light)*3.5+0.80,0.35,1.3);
  float white=body*sculpt*envelope*eye*1.9;
  finishEnvironment(vec3(0.002)+vec3(white),uv);
}`;

const ECLIPSE_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
void main() {
  vec2 uv=spaceUV(), p=(uv-vec2(0.0,0.035*min(uAspect,1.0)))/min(uAspect,1.0);
  float r=length(p), a=atan(p.y,p.x), radius=0.255, d=r-radius;
  vec2 radial=vec2(cos(a),sin(a));
  float tendrils=haze(radial*7.0+vec2(r*6.0,uTime*0.018));
  float fine=softNoise(radial*31.0+vec2(r*19.0,uTime*0.035));
  float plume=0.48+tendrils*0.80+fine*0.15;
  float corona=exp(-max(d,0.0)*(20.0-tendrils*9.0))*plume;
  float streamers=exp(-max(d,0.0)*10.5)*pow(tendrils,3.0);
  float rim=exp(-max(d,0.0)*180.0);
  float side=0.77+0.23*cos(a-0.65);
  vec3 col=vec3(1.0,0.41,0.10)*corona*1.65*side
    +vec3(0.7,0.24,0.045)*streamers*0.70+vec3(1.0,0.89,0.66)*rim*2.8;
  float aa=1.0/(uTexSize.y*min(uAspect,1.0));
  col*=smoothstep(-aa,aa,d);
  finishEnvironment(col,uv);
}`;

const PRISM_ENVIRONMENT = /* glsl */`${ENVIRONMENT_COMMON}
float beam(vec2 p,vec2 origin,float slope,float width) {
  return exp(-abs(p.y-origin.y-(p.x-origin.x)*slope)/width)*smoothstep(origin.x,origin.x+0.035,p.x);
}
void main() {
  vec2 uv=spaceUV(), p=uv/min(uAspect,1.0), q=p-vec2(-0.035,0.0);
  q.x=abs(q.x)-0.21;q.y+=0.12;
  if(q.x+1.73205*q.y>0.0)q=vec2(q.x-1.73205*q.y,-1.73205*q.x-q.y)*0.5;
  q.x-=clamp(q.x,-0.42,0.0);
  float triangle=-length(q)*sign(q.y);
  float edge=fineLine(triangle,0.0018), halo=exp(-abs(triangle)*140.0);
  float glass=1.0-smoothstep(-0.002,0.002,triangle);
  vec3 col=vec3(0.002)+vec3(0.023)*glass;
  float incoming=exp(-abs(p.y+0.018)*170.0)*(1.0-smoothstep(-0.18,-0.165,p.x));
  col+=vec3(1.0)*incoming*0.7;
  vec2 origin=vec2(0.11,-0.018);
  vec3 spectrum=vec3(1.0,0.17,0.20)*beam(p,origin,0.38,0.005)
    +vec3(1.0,0.60,0.12)*beam(p,origin,0.24,0.005)
    +vec3(0.90,1.0,0.24)*beam(p,origin,0.10,0.005)
    +vec3(0.1,0.93,0.70)*beam(p,origin,-0.04,0.005)
    +vec3(0.20,0.48,1.0)*beam(p,origin,-0.18,0.005)
    +vec3(0.65,0.22,1.0)*beam(p,origin,-0.32,0.005);
  col+=spectrum*(0.74+0.04*sin(uTime*0.3));
  col+=vec3(halo)*0.11;
  // Composite the white glass outline last, so the spectrum cannot tint it.
  col=mix(col,vec3(1.65),edge);
  finishEnvironment(col,uv);
}`;

export const STUDIO_BACKGROUND_SHADERS = Object.freeze({
  aurora: CLOUD_ENVIRONMENT, cosmos: COSMOS_ENVIRONMENT,
  mandala: MANDALA_ENVIRONMENT, plasma: PLASMA_ENVIRONMENT,
  tide: TIDE_ENVIRONMENT, ember: EMBER_ENVIRONMENT,
  vortex: VORTEX_ENVIRONMENT, eclipse: ECLIPSE_ENVIRONMENT, prism: PRISM_ENVIRONMENT,
});
