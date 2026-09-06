"""Compile and render the environment catalog at landscape and portrait sizes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from verify import start_server, find_chromium_executable, chromium_webgl_args

MODES = ['aurora', 'cosmos', 'mandala', 'plasma', 'quantum', 'tide', 'ember', 'vortex', 'eclipse', 'prism']
HARNESS = '''<!doctype html><html><head><style>
html,body{margin:0;background:#07070c;overflow:hidden}canvas{display:block}
</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body>
<script type="module">
import * as THREE from 'three';
import { BGRuntime } from '/src/fx/bg-runtime.js';
import { createMobileEnvironments } from '/src/mobile/backgrounds.js';
import { createEnvironmentSurface } from '/src/mobile/environment-webgl.js';
import { BACKGROUNDS } from '/src/mobile/state.js';
const scene = new THREE.Scene(), camera = new THREE.Camera();
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);
const background = new BGRuntime(scene,camera);
const canvas = document.createElement('canvas'), ctx=canvas.getContext('2d', {willReadFrequently:true});
const drawMobile = createMobileEnvironments();
const copy = document.createElement('canvas'), read = copy.getContext('2d', {willReadFrequently:true});
window.renderBackground = ({mode,width,height,time=12,intensity=0.9,mobile=false}) => {
  let source;
  if(mobile) {
    canvas.width=width;canvas.height=height;
    ctx.fillStyle=BACKGROUNDS[mode].color;ctx.fillRect(0,0,width,height);
    drawMobile(mode,ctx,width,height,{time,brightness:intensity});
    source=canvas;
  } else {
    renderer.setSize(width,height);
    background.setMode(mode);background.setIntensity(intensity);background.update(0,renderer);
    background.materials[mode].uniforms.uTime.value=time;
    renderer.render(scene,camera);source=renderer.domElement;
  }
  document.body.replaceChildren(source);
  copy.width=160;copy.height=100;read.drawImage(source,0,0,160,100);
  const pixels=read.getImageData(0,0,160,100).data;
  let sum=0, colored=0, checksum=0,bright=0,neutral=0;const levels=new Set(),channels=[0,0,0];
  for(let i=0;i<pixels.length;i+=4) {
    const [r,g,b]=pixels.slice(i,i+3);sum+=r+g+b;
    if(Math.max(r,g,b)>30 && Math.max(r,g,b)-Math.min(r,g,b)>8) {channels[0]+=r;channels[1]+=g;channels[2]+=b;}
    if(Math.min(r,g,b)>90){bright++;if(Math.max(r,g,b)-Math.min(r,g,b)<6)neutral++;}
    if(Math.max(r,g,b)-Math.min(r,g,b)>5)colored++;
    levels.add(r+g+b);checksum=(checksum+((i+1)*(r+g*3+b*7)))%2147483647;
  }
  const center=[...read.getImageData(80,50,1,1).data].slice(0,3);
  return {mean:sum/48000,colored,bright,neutral,center,channels:channels.map(c=>c/16000),levels:levels.size,checksum,
    shaders:renderer.info.programs.map(program=>({runnable:program.diagnostics?.runnable!==false}))};
};
window.checkSurfaceRecovery = async () => {
  const surface=createEnvironmentSurface();
  const first=surface.render('quantum',390,844,12,0.9);
  if(!first)throw new Error('Native environment surface unavailable');
  const gl=first.getContext('webgl2');
  const snapshot=()=>{const pixels=new Uint8Array(first.width*first.height*4);gl.readPixels(0,0,first.width,first.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels.reduce((sum,value,index)=>(sum+value*(index%997))%2147483647,0);};
  const before=snapshot(), dimensions=[first.width,first.height];
  surface.render('quantum',390,844,12,0.9);
  if(snapshot()!==before)throw new Error('Unchanged frame cache is unstable');
  const extension=gl.getExtension('WEBGL_lose_context');
  if(!extension)throw new Error('Context loss testing unavailable');
  const lost=new Promise(resolve=>first.addEventListener('webglcontextlost',resolve,{once:true}));
  extension.loseContext();await lost;
  if(surface.render('quantum',390,844,12,0.9)!==null)throw new Error('Lost context must use Canvas fallback');
  const restored=new Promise(resolve=>first.addEventListener('webglcontextrestored',resolve,{once:true}));
  // Let the loss event finish dispatching before requesting restoration.
  await new Promise(resolve=>setTimeout(resolve,100));
  extension.restoreContext();await restored;
  surface.render('quantum',390,844,12,0.9);
  if(snapshot()!==before)throw new Error('Artwork changed after context recovery');
  surface.dispose();
  if(!surface.render('prism',600,400,12,0.9))throw new Error('Surface cannot resume after pagehide disposal');
  surface.dispose();
  const original=HTMLCanvasElement.prototype.getContext;
  const fallbackResults=[];
  try {
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
    const fallback=createMobileEnvironments();
    for(const mode of ['eclipse','prism','vortex','mandala','quantum','plasma','tide']) {
      canvas.width=390;canvas.height=844;
      const count=fallback(mode,ctx,390,844,{time:12,brightness:0.9});
      const pixels=ctx.getImageData(0,0,390,844).data;
      const colors=new Set();for(let i=0;i<pixels.length;i+=4)colors.add(pixels[i]+pixels[i+1]+pixels[i+2]);
      if(!count||colors.size<20)throw new Error(`${mode} has no useful Canvas fallback`);
      fallbackResults.push(mode);
    }
    fallback.dispose();
  } finally { HTMLCanvasElement.prototype.getContext=original; }
  return {dimensions,fallbackResults};
};
window.checkQuantumForeground = () => {
  renderer.setSize(400,400);background.setMode('quantum');background.update(0,renderer);
  const foreground=new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.4),new THREE.MeshBasicMaterial({color:0xff0000}));
  scene.add(foreground);renderer.render(scene,camera);
  copy.width=400;copy.height=400;read.drawImage(renderer.domElement,0,0);
  const center=[...read.getImageData(200,200,1,1).data];
  scene.remove(foreground);foreground.geometry.dispose();foreground.material.dispose();
  return center;
};
window.checkLowPowerTide = () => {
  const original=HTMLCanvasElement.prototype.getContext;
  let gpuRequests=0;
  HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2')gpuRequests++;return original.call(this,type,...args);};
  const low=createMobileEnvironments();
  try {
    canvas.width=780;canvas.height=1688;ctx.setTransform(2,0,0,2,0,0);
    low('tide',ctx,390,844,{time:12,brightness:0.9,quality:'smooth'});
    if(gpuRequests!==0)throw new Error('Low Tide must not initialize WebGL');
    const water=ctx.getImageData(600,1400,1,1).data;
    if(water[2]<20||water[3]!==255||ctx.getTransform().a!==2)throw new Error('Low Tide must preserve DPR and draw water');
    low('tide',ctx,390,844,{time:12,brightness:0.9,quality:'balanced'});
    if(gpuRequests!==1)throw new Error('Balanced Tide must restore the detailed ocean');
    return true;
  } finally {low.dispose();ctx.setTransform(1,0,0,1,0,0);HTMLCanvasElement.prototype.getContext=original;}
};
</script></body></html>'''


def main():
    output = Path(__file__).resolve().parent.parent / 'smoke_shots' / 'backgrounds'
    output.mkdir(parents=True, exist_ok=True)
    server, base = start_server()
    try:
        with sync_playwright() as p:
            args = {'headless': True, 'args': chromium_webgl_args()}
            executable = find_chromium_executable()
            if executable:
                args['executable_path'] = executable
            browser = p.chromium.launch(**args)
            try:
                page = browser.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda message: errors.append(message.text) if message.type == 'error' or 'Using the Canvas environment fallback.' in message.text else None)
                page.route(base + '/background-preview', lambda route: route.fulfill(content_type='text/html', body=HARNESS))
                page.goto(base + '/background-preview')
                page.wait_for_function('() => !!window.renderBackground')
                for mobile, width, height in [(False,1280,800),(False,390,844),(True,390,844)]:
                    page.set_viewport_size({'width':width,'height':height})
                    checksums = set()
                    for mode in MODES:
                        options = dict(mode=mode,width=width,height=height,mobile=mobile)
                        still = page.evaluate('options => renderBackground(options)', options)
                        assert not errors, errors
                        assert all(shader['runnable'] for shader in still['shaders']), mode
                        assert still['levels'] > 20 and (mode in ['aurora', 'vortex'] or still['colored'] > 50), (mode,still)
                        checksums.add(still['checksum'])
                        name = f'{"mobile" if mobile else "desktop"}-{width}-{mode}'
                        page.screenshot(path=str(output / f'{name}.png'))
                        later = page.evaluate('options => renderBackground({...options,time:32})', options)
                        assert later['checksum'] != still['checksum'], f'{name} must animate'
                        if mode == 'aurora':
                            assert still['bright'] > 200 and still['neutral'] / still['bright'] > 0.98, f'{name} clouds must be neutral white'
                        if mode == 'vortex':
                            assert still['bright'] > 50 and still['neutral'] / still['bright'] > 0.98, f'{name} hurricane must stay neutral white'
                        if mode in ['vortex', 'eclipse']:
                            assert max(still['center']) < 5, f'{name} must have a dark center'
                        if mode == 'prism':
                            assert still['bright'] > 8 and still['neutral'] / still['bright'] > 0.9, f'{name} prism outline must stay white'
                        if mode == 'plasma':
                            delta = sum(abs(a / sum(still['channels']) - b / sum(later['channels'])) for a, b in zip(still['channels'], later['channels']))
                            assert delta > 0.1, f'{name} must shift hue, not just move: {delta:.3f}'
                        dim = page.evaluate('options => renderBackground({...options,intensity:options.mobile?0.3:0})', options)
                        assert dim['mean'] < still['mean'], f'{name} brightness control'
                        print(f'{name}: mean={still["mean"]:.1f}, levels={still["levels"]}', flush=True)
                    assert len(checksums) == len(MODES), 'each environment must have distinct artwork'
                assert not errors, errors
                assert page.evaluate('() => checkQuantumForeground()') == [255,0,0,255], 'Quantum particles must remain behind foreground models'
                assert page.evaluate('() => checkLowPowerTide()'), 'Tide quality paths'
                recovery = page.evaluate('() => Promise.race([checkSurfaceRecovery(),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Context recovery timed out")),10000))])')
                assert max(recovery['dimensions']) <= 800, recovery
                assert not errors, errors
                print('Background smoke passed: 30 rendered scenes, white/dark-center checks, animation, brightness, shader compilation, context recovery, and seven Canvas fallbacks.')
                mobile_page = browser.new_page(viewport={'width':390,'height':844})
                mobile_page.goto(base + '/mobile.html')
                mobile_page.wait_for_function('() => !!window.__mobileApp && window.__mobileApp.getMetrics().firstRenderMs !== null')
                baseline = mobile_page.evaluate('''() => {
                  const app=window.__mobileApp;
                  app.closeSettings();
                  app.setState({modelMode:'platonic',background:'plasma',autoRotate:false,autoZoom:false,autoExtrude:false,autoColor:false,autoFx:false,autoModel:false,softFx:false,fxMode:'none'});
                  return app.getMetrics().motionFrameRenderCount;
                }''')
                mobile_page.wait_for_function('(before) => window.__mobileApp.getMetrics().motionFrameRenderCount > before+2', arg=baseline, timeout=5000)
                sample = '''() => {
                  const canvas=document.getElementById('mobile-background-canvas');
                  const p=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
                  return p.reduce((sum,value,index)=>(sum+value*(index%997))%2147483647,0);
                }'''
                first = mobile_page.evaluate(sample)
                mobile_page.wait_for_timeout(250)
                assert mobile_page.evaluate(sample) != first, 'Background motion must not depend on model or FX animation'
                mobile_page.emulate_media(reduced_motion='reduce')
                mobile_page.wait_for_timeout(200)
                still = mobile_page.evaluate(sample)
                mobile_page.wait_for_timeout(250)
                assert mobile_page.evaluate(sample) == still, 'Reduced-motion backgrounds must remain still'
                assert not mobile_page.evaluate('() => window.__mobileApp.getMetrics().runtimeErrors')
                mobile_page.close()
                print('Mobile background motion and live reduced-motion changes passed.')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
