"""Learning journeys: search, reading, experiments, quiz recovery, and focus."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
from verify import start_server, find_chromium_executable, chromium_webgl_args


def main():
    server, base = start_server()
    shots = Path(__file__).resolve().parent.parent / 'smoke_shots' / 'learning-center'
    shots.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as p:
            options = {'headless': True, 'args': chromium_webgl_args()}
            executable = find_chromium_executable()
            if executable:
                options['executable_path'] = executable
            browser = p.chromium.launch(**options)
            try:
                for width, height in [(1440, 900), (900, 800), (390, 844), (320, 640)]:
                    context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce', has_touch=width < 400)
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.add_init_script('window.__forceSdfSafeMode = true')
                    page.goto(os.environ.get('LEARNING_UI_URL', base + '/dist/web/index.html'), wait_until='domcontentloaded')
                    page.wait_for_function('() => !!window.__app?.currentView')
                    page.evaluate("window.__app.openLearningCenter('meet-e8')")
                    page.wait_for_selector('.learning-center-dialog')
                    page.wait_for_timeout(120)
                    assert page.locator('.learning-concepts dt').count() == 2
                    assert page.locator('#learning-lesson-title').is_visible(), 'phone shell must not hide lesson headers'
                    assert page.locator('.learning-evidence tbody tr').count() == 4
                    assert page.locator('.learning-library').evaluate('(el) => el.open') == (width > 760)
                    bounds = page.locator('.learning-center-dialog').bounding_box()
                    assert bounds['x'] >= 0 and bounds['y'] >= 0 and bounds['x'] + bounds['width'] <= width + 1
                    assert bounds['y'] + bounds['height'] <= height + 1
                    assert page.locator('.learning-center-content').evaluate('(el) => el.scrollWidth <= el.clientWidth + 1'), 'reader must fit without horizontal scrolling'
                    page.screenshot(path=str(shots / f'reader-{width}.png'))
                    if width < 761:
                        page.locator('.learning-library-toggle').click()
                    search = page.get_by_label('Find a lesson', exact=True)
                    search.fill('angular deficit')
                    assert page.locator('.learning-lesson-link:visible').count() == 1
                    assert page.locator('.learning-lesson-link:visible').get_attribute('data-learning-lesson') == 'why-five-solids'
                    search.fill('no-such-concept')
                    assert page.locator('.learning-lesson-link:visible').count() == 0
                    page.locator('[data-learning-clear]').click()
                    assert search.evaluate('(el) => el === document.activeElement')
                    assert page.locator('.learning-lesson-link').count() == 13
                    search.fill('five regular')
                    page.locator('.learning-lesson-link[data-learning-lesson="why-five-solids"]').click()
                    assert page.locator('#learning-lesson-title').inner_text() == 'Why exactly five regular solids?'
                    assert page.locator('.learning-evidence tbody tr').count() == 6
                    if width < 761:
                        corners = page.locator('.learning-corner select').all()
                        first, second = [control.bounding_box() for control in corners]
                        assert second['y'] > first['y'] + first['height'], 'phone calculator controls must stack with readable labels'
                    page.locator('[data-corner-sides]').select_option('3')
                    page.locator('[data-corner-count]').select_option('5')
                    assert 'Icosahedron' in page.locator('[data-corner-result]').inner_text()
                    assert '60° left' in page.locator('[data-corner-result]').inner_text()
                    page.locator('[data-corner-sides]').select_option('6')
                    page.locator('[data-corner-count]').select_option('3')
                    assert 'Flat arrangement' in page.locator('[data-corner-result]').inner_text()
                    page.locator('[data-corner-count]').select_option('4')
                    assert 'Too much angle' in page.locator('[data-corner-result]').inner_text()
                    page.locator('.learning-corner').scroll_into_view_if_needed()
                    page.screenshot(path=str(shots / f'corner-{width}.png'))
                    page.locator('[data-learning-jump="learning-check-title"]').click()
                    assert page.locator('#learning-check-title').evaluate('(el) => el === document.activeElement')
                    page.locator('.learning-recall summary').click()
                    assert page.locator('.learning-recall details').evaluate('(el) => el.open')
                    page.locator('[data-learning-complete]').click()
                    page.wait_for_timeout(80)
                    assert page.locator('[data-learning-complete]').get_attribute('aria-pressed') == 'true'
                    assert page.locator('[data-learning-complete]').evaluate('(el) => el === document.activeElement')
                    assert page.locator('.learning-center-content').evaluate('(el) => el.scrollTop > 100')
                    page.locator('[data-learning-quiz]').click()
                    page.locator('[data-quiz-submit]').click()
                    assert 'remaining' in page.locator('.quiz-result').inner_text()
                    assert page.locator('.quiz-question input').first.evaluate('(el) => el === document.activeElement')
                    assert page.evaluate("!window.__app.progress.quiz?.['platonic-foundations']"), 'unanswered quiz must not save a failed attempt'
                    for question in page.locator('.quiz-question').all():
                        question.locator('input').first.check()
                    page.locator('[data-quiz-submit]').click()
                    assert page.locator('.quiz-result li').count() == 3
                    page.locator('[data-quiz-back]').click()
                    assert page.locator('#learning-lesson-title').inner_text() == 'Why exactly five regular solids?'
                    page.wait_for_timeout(100)
                    page.screenshot(path=str(shots / f'quiz-return-{width}.png'))
                    page.locator('.learning-hero-action [data-learning-run-step]').click()
                    assert page.locator('#learning-modal').evaluate('(el) => el.classList.contains("hidden")')
                    assert page.evaluate('window.__app.params.shape') == 'icosahedron'
                    page.locator('[data-experiment-coach-observed]').click()
                    page.locator('[data-experiment-coach-review]').click()
                    assert page.locator('.learning-hero-action [data-learning-run-step]').get_attribute('data-learning-run-step') == 'pentagons'
                    assert page.locator('.learning-experiment-step.complete').count() == 1
                    page.locator('[data-learning-jump="learning-experiment-title"]').click()
                    page.screenshot(path=str(shots / f'experiment-{width}.png'))
                    # Collapsed disclosure bodies and filtered lessons must stay out of the focus trap.
                    page.locator('.modal-close').focus()
                    page.keyboard.press('Shift+Tab')
                    assert page.evaluate("document.activeElement.closest('#learning-modal') !== null")
                    assert page.evaluate('document.activeElement.checkVisibility()')
                    page.keyboard.press('Tab')
                    assert page.locator('.modal-close').evaluate('(el) => el === document.activeElement')
                    page.keyboard.press('Escape')
                    assert page.locator('#learning-modal').evaluate('(el) => el.classList.contains("hidden")')
                    page.reload(wait_until='domcontentloaded')
                    page.wait_for_function('() => !!window.__app?.currentView')
                    assert page.evaluate("!!window.__app.progress.lessons?.['why-five-solids']")
                    assert not errors, errors
                    context.close()
                print('Learning Center passed: 4 sizes, search, evidence, recall, quiz recovery, experiment continuity, focus, and saved progress.')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
