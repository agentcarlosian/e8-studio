"""Boot the self-contained desktop HTML from file:// and switch a deferred view."""
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from verify import find_chromium_executable, chromium_webgl_args, assert_canvas_nonblank


ROOT = Path(__file__).resolve().parent.parent
ARTIFACT = ROOT / 'dist' / 'e8-studio.html'


def main():
    if not ARTIFACT.is_file():
        raise SystemExit('Build the desktop artifact first: npm run build:single')
    with sync_playwright() as playwright:
        launch = {'headless': True, 'args': chromium_webgl_args()}
        executable = find_chromium_executable()
        if executable:
            launch['executable_path'] = executable
        browser = playwright.chromium.launch(**launch)
        try:
            page = browser.new_page(viewport={'width': 1400, 'height': 900})
            errors = []
            console_errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
            page.goto(ARTIFACT.as_uri(), wait_until='commit', timeout=30_000)
            page.wait_for_function('() => window.__app?.startupMetrics?.firstFrameMs != null', timeout=30_000)
            assert_canvas_nonblank(page)
            page.evaluate("window.__app.switchView('polytope')")
            try:
                page.wait_for_function("() => window.__app?.currentView?.name === 'polytope4d' && window.__app.currentView.object3d.children.length > 0", timeout=8_000)
            except PlaywrightTimeoutError as error:
                state = page.evaluate("() => ({ view: window.__app?.currentView?.name, status: document.querySelector('#status')?.textContent, modules: !!window.__modules?.createPolytope4DView })")
                raise AssertionError(f'Standalone deferred view failed: {state}; page={errors[:3]}; console={console_errors[:3]}') from error
            assert_canvas_nonblank(page)
            if errors or console_errors:
                raise AssertionError(f'file:// runtime errors: page={errors[:5]}, console={console_errors[:5]}')
            print('Standalone file boot and deferred 4D view passed.')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
