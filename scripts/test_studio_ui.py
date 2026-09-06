"""User journeys for the studio shell and integrated opt-in introduction."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
from verify import start_server, find_chromium_executable, chromium_webgl_args, open_checked_page


def main():
    server, base = start_server()
    output = Path(__file__).resolve().parent.parent / 'smoke_shots' / 'ui-upgrade'
    output.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as p:
            args = {'headless': True, 'args': chromium_webgl_args()}
            executable = find_chromium_executable()
            if executable:
                args['executable_path'] = executable
            browser = p.chromium.launch(**args)
            try:
                for width, height in [(1440,900), (900,800), (390,844), (320,640)]:
                    context = browser.new_context(viewport={'width':width,'height':height}, has_touch=width <= 390, is_mobile=width <= 390, reduced_motion='reduce')
                    page = context.new_page()
                    errors=[]
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.add_init_script('window.__forceSdfSafeMode = true')
                    page.goto(base + '/' + os.environ.get('STUDIO_UI_ENTRY', 'dist/web/index.html'), wait_until='domcontentloaded')
                    page.wait_for_function('() => !!window.__app?.currentView')
                    page.wait_for_timeout(500)
                    assert page.locator('#quick-start-coach').count() == 0, 'guide must be opt-in'
                    if width <= 390:
                        page.get_by_role('button', name='Open controls', exact=True).click()
                    assert page.locator('.view-card').count() == 9
                    metrics=page.evaluate('''() => ({ overflow:document.body.scrollWidth > innerWidth+1, cards:[...document.querySelectorAll('.view-card')].map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y}}) })''')
                    assert not metrics['overflow'], metrics
                    assert abs(metrics['cards'][0]['y'] - metrics['cards'][2]['y']) < 1, 'view cards must form a three-column grid'
                    assert all(r['width']>=44 and r['height']>=44 for r in metrics['cards']), metrics
                    page.evaluate("window.__app.setParam('bgIntensity', 0)")
                    page.locator('.exploration-invite [data-act="startQuickStart"]').click()
                    page.wait_for_selector('#quick-start-coach')
                    assert page.evaluate('window.__app.params.view') == 'e8coxeter'
                    assert page.evaluate('window.__app.params.showRings') is True
                    assert page.evaluate('window.__app.bgRuntime.intensity === window.__app.params.bgIntensity'), 'guide must synchronize renderer intensity'
                    if width <= 390:
                        page.get_by_role('button', name='Open controls', exact=True).click()
                        page.keyboard.press('Escape')
                        assert page.locator('#quick-start-coach').count() == 1, 'drawer Escape must preserve the guide'
                        assert not page.evaluate("document.body.classList.contains('desktop-controls-open')")
                    else:
                        page.locator('#global-quality-menu summary').click()
                        page.keyboard.press('Escape')
                        assert page.locator('#quick-start-coach').count() == 1, 'quality Escape must preserve the guide'
                        assert not page.locator('#global-quality-menu').evaluate('(el) => el.open')
                    assert page.evaluate('window.__app.params.autoRotate') is False
                    page.locator('[data-quick-start="next"]').click()
                    assert page.evaluate('window.__app.params.view') == 'platonic'
                    assert page.evaluate('window.__app.params.shape') == 'icosahedron'
                    assert page.evaluate('window.__app.params.autoRotate') is False
                    page.locator('[data-quick-start="back"]').click()
                    assert page.evaluate('window.__app.params.view') == 'e8coxeter'
                    page.locator('[data-quick-start="next"]').click()
                    page.locator('[data-quick-start="next"]').click()
                    assert page.evaluate('window.__app.params.panelMode') == 'style'
                    coach=page.locator('#quick-start-coach').bounding_box()
                    assert coach['x'] >=0 and coach['x']+coach['width']<=width+1, coach
                    assert coach['y']>=0 and coach['y']+coach['height']<=height+1, coach
                    page.locator('[data-quick-start="next"]').click()
                    assert page.locator('#quick-start-coach').count()==0
                    assert page.evaluate("localStorage.getItem('e8_quick_start_seen_v1')")=='true'
                    assert page.evaluate('document.activeElement.tagName')=='BUTTON'
                    if width <=390:
                        page.get_by_role('button', name='Open controls', exact=True).click()
                    page.locator('#panel-tab-scene').click()
                    assert page.locator('.exploration-invite').count()==0
                    page.locator('[data-act="switchView"][data-arg="e8coxeter"]').click()
                    page.wait_for_timeout(400)
                    assert page.locator('#ps-motion').inner_text().strip(), 'motion status must survive rerenders'
                    page.screenshot(path=str(output/f'studio-{width}.png'))
                    if width<=390:
                        page.get_by_role('button', name='Close controls', exact=True).first.click()
                        page.wait_for_timeout(400)
                        hints = page.locator('#ov-bl').bounding_box()
                        metadata = page.locator('#ov-br').bounding_box()
                        assert metadata['y'] + metadata['height'] <= hints['y'], 'phone metadata must not overlap gesture hints'
                        page.screenshot(path=str(output/f'canvas-{width}.png'))
                    assert not errors, errors
                    context.close()
                print('Studio UI journeys passed: 4 sizes, 9 views, guide navigation, persistence, focus, motion, and no runtime errors.')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__=='__main__':
    main()
