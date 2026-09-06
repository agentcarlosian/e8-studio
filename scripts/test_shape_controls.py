"""Check discoverable geometry downloads and persistent optional face fills."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from verify import start_server, find_chromium_executable, chromium_webgl_args

ROOT = Path(__file__).resolve().parent.parent

def main():
    server, base = start_server()
    out = ROOT / 'smoke_shots/shape-controls'; out.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=find_chromium_executable(), args=chromium_webgl_args())
            page = browser.new_page(viewport={'width':1440, 'height':900}, reduced_motion='reduce', accept_downloads=True)
            errors = []; page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base + '/dist/web/index.html'); page.wait_for_function('()=>!!window.__app?.currentView')
            page.evaluate("()=>{window.__app.setParam('adaptivePixelRatio',false);window.__app.renderer.setPixelRatio(0.5);}")
            for view, names in [('platonic', ['tetrahedron','cube','octahedron','dodecahedron','icosahedron']), ('polytope', ['5cell','tesseract','16cell','24cell','120cell','600cell'])]:
                page.evaluate("view=>{const a=window.__app;a.switchView(view);a.setPanelMode('scene');a.setParam('autoRotate',false);a.setParam('polyAutoRotate',false);a.setParam('polyRotXY',0.4);a.setParam('polyRotZW',0.3);a.setBgMode('void');}", view)
                for name in names:
                    page.evaluate("o=>window.__app[o.view==='platonic'?'setShape':'setPoly4d'](o.name)", {'view':view,'name':name})
                    page.wait_for_timeout(120)
                    page.evaluate('window.__app.openModelExport()')
                    button = page.locator('[data-file-format="obj"]')
                    assert button.is_visible(), name
                    with page.expect_download() as event: button.click()
                    event.value.save_as(out / (name + '.obj'))
                    page.locator('[data-modal-close]').click()
                    obj = (out / (name + '.obj')).read_text(encoding='utf-8')
                    vertices = [[float(n) for n in line.split()[1:]] for line in obj.splitlines() if line.startswith('v ')]
                    assert vertices and any(line.startswith('f ') for line in obj.splitlines()), name
                    if view == 'polytope':
                        live = page.evaluate('()=>{const p=window.__app.currentView.group.userData.vPoints.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);}')
                        assert len(vertices) == len(live)
                        assert all(abs(a-b)<0.000002 for x,y in zip(vertices,live) for a,b in zip(x,y)), name
                for enabled in [True, False]:
                    if page.evaluate('window.__app.params.showFaces') != enabled:
                        page.locator('[data-act="toggleFaces"]').click()
                    page.wait_for_function("enabled=>{const meshes=window.__app.currentView.group.children.filter(o=>o.name.endsWith('-faces'));return meshes.length>0 && meshes.every(o=>o.visible===enabled);}", arg=enabled)
                    visibility = page.evaluate("window.__app.currentView.group.children.filter(o=>o.name.endsWith('-faces')).map(o=>o.visible)")
                    assert visibility and all(v == enabled for v in visibility), (view, visibility)
                    page.screenshot(path=str(out / f'{view}-faces-{enabled}.png'))
                page.reload(); page.wait_for_function('()=>!!window.__app?.currentView')
                assert page.evaluate('window.__app.params.showFaces') is False
            page.evaluate('window.__app.openModelExport()')
            with page.expect_download() as event: page.locator('[data-file-format="data"]').click()
            event.value.save_as(out/'polytope.json')
            raw=json.loads((out/'polytope.json').read_text())
            assert raw['dimension']==4 and all(len(v)==4 for v in raw['verts']) and raw['faces']
            assert not errors, errors
            browser.close()
            print('Shape controls passed: 11 OBJ downloads, current 4D projection, 4D JSON, face switches, and reload persistence.')
    finally: server.shutdown(); server.server_close()

if __name__ == '__main__': main()
