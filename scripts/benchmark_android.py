"""Run the background workload on a USB-authorized Android Chrome device."""
from pathlib import Path
import argparse, json, socket, subprocess, time
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from benchmark_backgrounds import SAMPLE, MODES
from verify import start_server

ROOT=Path(__file__).resolve().parent.parent
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial',required=True)
    parser.add_argument('--seconds',type=float,default=5)
    parser.add_argument('--output',default='smoke_shots/pr-preparation/android-performance.json')
    parser.add_argument('--review-url',help='Optional running local app URL to leave on the phone after testing')
    args=parser.parse_args()
    output=ROOT/args.output;output.parent.mkdir(parents=True,exist_ok=True)
    def adb(*command):return subprocess.check_output(['adb','-s',args.serial,*command],text=True,timeout=30).strip()
    server,base=start_server();port=base.rsplit(':',1)[1]
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));debug_port=sock.getsockname()[1]
    report={'time':datetime.now(timezone.utc).isoformat(),'device':adb('shell','getprop','ro.product.model'),
            'android':adb('shell','getprop','ro.build.version.release'),'scope':'Physical Android phone, USB connected. Charging prevents a valid battery-drain estimate. Safari is not tested.',
            'revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
            'workingTreeDirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip()),'cases':[]}
    report['batteryBefore']=adb('shell','dumpsys','battery')
    try:
        adb('reverse','tcp:'+port,'tcp:'+port)
        target=base+'/mobile.html'
        adb('shell','am','start','-a','android.intent.action.VIEW','-d',target,'-p','com.android.chrome')
        chrome_pid=adb('shell','pidof','com.android.chrome').split()[0]
        adb('forward','tcp:'+str(debug_port),'localabstract:chrome_devtools_remote_'+chrome_pid)
        with sync_playwright() as p:
            browser=None
            for attempt in range(12):
                try:browser=p.chromium.connect_over_cdp('http://127.0.0.1:'+str(debug_port),timeout=10000);break
                except Exception:
                    if attempt==11:raise
                    time.sleep(.5)
            pages=[page for context in browser.contexts for page in context.pages if page.url.startswith(target)]
            if not pages:raise RuntimeError('The test tab did not open in Android Chrome')
            page=pages[-1];page.bring_to_front();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.wait_for_function('()=>!!window.__mobileApp?.getMetrics().renderCount',timeout=30000)
            report['browser']=page.evaluate('navigator.userAgent')
            report['viewport']=page.evaluate('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})')
            report['gpu']=page.evaluate('''()=>{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return 'No WebGL2';const ext=gl.getExtension('WEBGL_debug_renderer_info');const name=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);gl.getExtension('WEBGL_lose_context')?.loseContext();return name;}''')
            for quality in ['smooth','sharp']:
                for mode in MODES:
                    page.evaluate('''o=>{const a=window.__mobileApp;a.closeSettings();a.setState({modelMode:'e8_2d',showEdges:true,showVertices:true,background:o.mode,quality:o.quality,autoRotate:true,autoZoom:false,autoColor:false,autoFx:false,softFx:false});}''',{'mode':mode,'quality':quality})
                    page.wait_for_timeout(2000)
                    result=page.evaluate(SAMPLE,max(1000,args.seconds*1000))
                    if errors:raise AssertionError(errors)
                    case={'quality':quality,'mode':mode,**result};report['cases'].append(case);print(json.dumps(case),flush=True)
                    if quality=='smooth' and mode!='void':page.screenshot(path=str(output.parent/f'android-{mode}.png'))
            if args.review_url:
                from urllib.parse import urlparse
                review=urlparse(args.review_url)
                if review.scheme not in ['http','https'] or review.hostname not in ['localhost','127.0.0.1']:
                    raise ValueError('--review-url must identify a running localhost application')
                review_port=str(review.port or (443 if review.scheme=='https' else 80))
                adb('reverse','tcp:'+review_port,'tcp:'+review_port)
                page.goto(args.review_url)
                page.wait_for_function('()=>!!window.__mobileApp?.getMetrics().renderCount')
                page.evaluate("window.__mobileApp.closeSettings();window.__mobileApp.setState({background:'plasma',quality:'smooth'});")
            else:
                page.close()
            browser.close()  # Disconnects CDP; does not close the user's Chrome.
    finally:
        report['batteryAfter']=adb('shell','dumpsys','battery')
        output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        adb('forward','--remove','tcp:'+str(debug_port));adb('reverse','--remove','tcp:'+port)
        server.shutdown();server.server_close()

if __name__=='__main__':main()
