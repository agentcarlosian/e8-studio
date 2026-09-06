"""Exercise discoverability, all digital formats, print downloads, cancellation, and mobile layout."""
from pathlib import Path
import json
import zipfile
import struct
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright
from verify import start_server, find_chromium_executable, chromium_webgl_args

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'smoke_shots/export-panel'

def download(page, fmt, name):
    with page.expect_download(timeout=90000) as event:
        page.locator(f'[data-file-format="{fmt}"]').click()
    path=OUT/name;event.value.save_as(path)
    page.wait_for_function("()=>document.querySelector('.export-status').textContent.includes('delivered')")
    assert path.stat().st_size > 10
    if fmt=='data': assert json.loads(path.read_text())
    elif fmt=='svg': assert ET.fromstring(path.read_text()).tag.endswith('svg')
    elif fmt=='obj': assert '\nv ' in path.read_text()
    elif fmt=='ply': assert path.read_text().startswith('ply\n')
    elif fmt=='csv': assert path.read_text().startswith('index,x,y,z\n')
    elif fmt=='stl': assert path.stat().st_size==84+50*struct.unpack_from('<I',path.read_bytes(),80)[0]
    elif fmt=='3mf':
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            assert ET.fromstring(z.read('3D/3dmodel.model')).attrib['unit']=='millimeter'

def main(mobile_path="/dist/index.html", desktop_path="/dist/web/index.html"):
    OUT.mkdir(parents=True,exist_ok=True)
    server,base=start_server()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=find_chromium_executable(),args=chromium_webgl_args())
            page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce',accept_downloads=True)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+desktop_path);page.wait_for_function('()=>!!window.__app?.currentView')
            page.evaluate("()=>{const a=window.__app;a.switchView('platonic');a.setShape('cube');a.setPanelMode('scene');a.setParam('autoRotate',false);a.setParam('polyAutoRotate',false);}")
            page.locator('.panel-tools-menu summary').click()
            left=page.locator('[data-act="openCheatsheet"]').bounding_box();right=page.locator('[data-act="openModelExport"]').bounding_box()
            assert abs(left['y']-right['y'])<2 and right['x']>left['x']
            page.screenshot(path=str(OUT/'tools.png'))
            page.locator('[data-act="openModelExport"]').click()
            assert page.locator('[role="dialog"]').is_visible()
            page.screenshot(path=str(OUT/'desktop.png'))
            download(page,'3mf','cube.3mf');download(page,'stl','cube.stl')
            page.keyboard.press('Escape');assert page.locator('#learning-modal').is_hidden()
            for view in ['bloom','platonic','e8coxeter','quasicrystal','polytope','raymarched','rootlab','tiling','dynkin']:
                page.evaluate("v=>{window.__app.switchView(v);window.__app.openModelExport();}",view)
                for fmt in ['obj','ply','csv','svg','data']: download(page,fmt,f'{view}.{fmt}')
                page.locator('[data-modal-close]').click()
            page.evaluate("()=>{const a=window.__app;a.switchView('polytope');a.setPoly4d('tesseract');a.openModelExport();}")
            download(page,'stl','tesseract.stl')
            # Closing while the asynchronous surface is being built cancels delivery.
            downloads=[];page.on('download',lambda d:downloads.append(d.suggested_filename))
            page.locator('[data-file-format="3mf"]').click();page.keyboard.press('Escape');page.wait_for_timeout(1000)
            assert not downloads
            page.close()
            mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
            mobile.on('pageerror',lambda e:errors.append(str(e)))
            mobile.goto(base+mobile_path);mobile.wait_for_function('()=>!!window.__mobileApp')
            mobile.evaluate("()=>{window.__mobileApp.setState({modelMode:'platonic',shape:'cube'});document.querySelector('[data-export-action=\"open-export\"]').click();}")
            assert mobile.locator('dialog').is_visible()
            assert mobile.locator('.model-export').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
            mobile.screenshot(path=str(OUT/'mobile.png'))
            download(mobile,'3mf','mobile-cube.3mf')
            mobile.keyboard.press('Escape');assert mobile.locator('dialog').count()==0
            mobile.evaluate("()=>{window.__mobileApp.setState({modelMode:'rootlab',rootSystem:'G2'});document.querySelector('[data-export-action=\"open-export\"]').click();}")
            download(mobile,'obj','mobile-roots.obj')
            assert (OUT/'mobile-roots.obj').read_text().count('\nv ')==13
            assert not errors,errors
            browser.close()
            print('Export panel passed: Tools position, 45 digital downloads, print files, Escape/cancellation, mobile 3MF and root geometry.')
    finally: server.shutdown();server.server_close()

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--mobile-url',default='/dist/index.html')
    parser.add_argument('--desktop-url',default='/dist/web/index.html')
    args=parser.parse_args()
    main(args.mobile_url,args.desktop_url)
