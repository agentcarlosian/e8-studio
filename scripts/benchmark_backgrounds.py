"""Measure the actual GPU path; never report SwiftShader as hardware performance."""
from pathlib import Path
import argparse
import json
import platform
import subprocess
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from verify import start_server

ROOT = Path(__file__).resolve().parent.parent
MODES = ['void', 'mandala', 'plasma', 'quantum', 'tide']
SAMPLE = '''async milliseconds => {
  const count=()=>window.__mobileApp?window.__mobileApp.getMetrics().motionFrameRenderCount:window.__app.renderer.info.render.frame;
  const before=count(),frames=[]; let start=performance.now(),last=start;
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('No visible animation frames within the sampling window')),milliseconds+10000);
    const frame=now=>{frames.push(now-last);last=now;if(now-start<milliseconds)requestAnimationFrame(frame);else {clearTimeout(timeout);resolve();}};
    requestAnimationFrame(frame);
  });
  frames.shift();frames.sort((a,b)=>a-b);
  const mean=frames.reduce((sum,n)=>sum+n,0)/frames.length;
  const elapsedMs=last-start,renderedFrames=count()-before;
  return {frames:frames.length,meanMs:mean,p95Ms:frames[Math.floor(frames.length*.95)],rafFps:1000/mean,renderedFrames,renderedFps:renderedFrames*1000/elapsedMs};
}'''

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds',type=float,default=3)
    parser.add_argument('--output',default='smoke_shots/pr-preparation/gpu-performance.json')
    args=parser.parse_args()
    output=ROOT/args.output;output.parent.mkdir(parents=True,exist_ok=True)
    server,base=start_server()
    report={'time':datetime.now(timezone.utc).isoformat(),'platform':platform.platform(),
            'revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
            'workingTreeDirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip()),
            'scope':'Local desktop GPU. Phone-size viewport is emulation, not a physical phone. No battery or Safari claim.', 'cases':[]}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,args=['--use-angle=d3d11'] if platform.system()=='Windows' else [])
            for mobile,width,height in [(False,1440,900),(True,390,844)]:
                context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,has_touch=mobile,is_mobile=mobile)
                page=context.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(base+('/mobile.html' if mobile else '/dist/web/index.html'))
                page.wait_for_function('()=>!!window.__mobileApp?.getMetrics().renderCount' if mobile else '()=>!!window.__app?.currentView')
                if not mobile:
                    gpu=page.evaluate('''()=>{const gl=window.__app.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}''')
                    report['gpu']=gpu
                    if any(name in gpu.lower() for name in ['swiftshader','llvmpipe','software','microsoft basic']):
                        raise RuntimeError('Hardware benchmark unavailable: '+gpu)
                for quality in (['smooth','sharp'] if mobile else ['high']):
                    for mode in MODES:
                        if mobile:
                            page.evaluate('''o=>{const a=window.__mobileApp;a.closeSettings();a.setState({modelMode:'e8_2d',showEdges:true,showVertices:true,background:o.mode,quality:o.quality,autoRotate:true,autoZoom:false,autoColor:false,autoFx:false,softFx:false});}''',{'mode':mode,'quality':quality})
                        else:
                            page.evaluate('''mode=>{const a=window.__app;a.setMobileQuality('high');a.switchView('e8coxeter');for(const [k,v] of Object.entries({showEdges:true,showVertices:true,showRings:true,autoRotate:true,paused:false,intro:false,adaptivePixelRatio:false,fxMode:'none',showAmbient:false}))a.setParam(k,v,{save:false});a.setBgMode(mode);}''',mode)
                        page.wait_for_timeout(1500)
                        result=page.evaluate(SAMPLE,max(1000,args.seconds*1000))
                        detail=page.evaluate('''()=>window.__mobileApp?{metrics:window.__mobileApp.getMetrics().motionFrameRenderCount}: {drawCalls:window.__app.renderer.info.render.calls,lines:window.__app.renderer.info.render.lines,points:window.__app.renderer.info.render.points,dpr:window.__app.renderer.getPixelRatio(),errors:window.__app.runtimeErrors}''')
                        if errors or detail.get('errors'):raise AssertionError(errors or detail['errors'])
                        case={'shell':'mobile viewport on desktop GPU' if mobile else 'desktop','viewport':[width,height],'quality':quality,'mode':mode,**result,**detail}
                        report['cases'].append(case)
                        print(json.dumps(case),flush=True)
                        if not mobile and mode!='void':page.screenshot(path=str(output.parent/f'gpu-{mode}.png'))
                context.close()
            browser.close()
    finally:
        output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        server.shutdown();server.server_close()

if __name__=='__main__':main()
