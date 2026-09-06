"""Follow learning progress through an experiment, quiz, export and scene share."""
from pathlib import Path
import json, subprocess
from playwright.sync_api import sync_playwright
from verify import start_server, find_chromium_executable, chromium_webgl_args

ROOT=Path(__file__).resolve().parent.parent
def main():
    server,base=start_server();out=ROOT/'smoke_shots/pr-preparation';out.mkdir(parents=True,exist_ok=True)
    answers=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {QUIZ_MODULES} from './src/content/learning.js'; console.log(JSON.stringify(QUIZ_MODULES.find(q=>q.id==='platonic-foundations').questions.map(q=>q.answer)));"],cwd=ROOT,text=True))
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path=find_chromium_executable(),args=chromium_webgl_args())
            context=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce',accept_downloads=True)
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/dist/web/index.html');page.wait_for_function('()=>!!window.__app?.currentView')
            page.evaluate("window.__app.openLearningCenter('why-five-solids')")
            page.locator('[data-learning-complete]').click()
            page.locator('.learning-hero-action [data-learning-run-step]').click()
            page.locator('[data-experiment-coach-observed]').click()
            page.locator('[data-experiment-coach-review]').click()
            page.locator('[data-learning-quiz]').click()
            for i,answer in enumerate(answers):page.locator(f'input[name="quiz-platonic-foundations-{i}"][value="{answer}"]').check()
            page.locator('[data-quiz-submit]').click()
            assert 'Passed' in page.locator('.quiz-result').inner_text()
            page.locator('[data-quiz-back]').click();page.screenshot(path=str(out/'journey-lesson.png'))
            page.keyboard.press('Escape');page.reload();page.wait_for_function('()=>!!window.__app?.currentView')
            assert page.evaluate("!!window.__app.progress.lessons?.['why-five-solids'] && !!window.__app.progress.quiz?.['platonic-foundations']")
            # High selects the full shader catalog; a smaller buffer bounds software-GPU readback.
            page.evaluate("window.__app.setMobileQuality('high');window.__app.setParam('adaptivePixelRatio',false);window.__app.renderer.setPixelRatio(0.5);window.__app.switchView('platonic');window.__app.setParam('shape','icosahedron');window.__app.setBgMode('plasma');window.__app.setBgIntensity(0.7);")
            page.wait_for_timeout(300)
            for mode in ['mandala','plasma','quantum','tide']:
                page.evaluate('mode=>window.__app.setBgMode(mode)',mode);page.wait_for_timeout(150)
                page.screenshot(path=str(out/f'journey-{mode}.png'))
            page.evaluate("window.__app.setBgMode('plasma')")
            for method,suffix in [('exportOBJ','obj'),('shareSnapshot','png')]:
                with page.expect_download() as event:page.evaluate('method=>window.__app[method]()',method)
                download=event.value;download.save_as(out/f'journey-export.{suffix}')
                assert (out/f'journey-export.{suffix}').stat().st_size>100
            page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}})")
            url=page.evaluate('window.__app.sharePage()');assert '#scene=v1.' in url
            fresh=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
            recipient=fresh.new_page();recipient.on('pageerror',lambda e:errors.append(str(e)))
            recipient.goto(url);recipient.wait_for_function('()=>!!window.__app?.currentView')
            state=recipient.evaluate("({view:window.__app.params.view,shape:window.__app.params.shape,bg:window.__app.params.bgMode,personalProgress:Object.keys(window.__app.progress.lessons||{}).length})")
            assert state=={'view':'platonic','shape':'icosahedron','bg':'plasma','personalProgress':0},state
            assert not errors,errors
            recipient.screenshot(path=str(out/'journey-shared.png'))
            fresh.close();context.close();browser.close()
            print('Release journey passed: lesson, experiment, quiz, saved progress, background readability captures, OBJ, PNG and fresh-session scene sharing.')
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
