"""Verify that a standalone file never offers a missing Canvas2D sibling link.

Run after `npm run build:single`: python scripts/test_file_fallback.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright
from verify import chromium_webgl_args, find_chromium_executable


ARTIFACT = Path(__file__).resolve().parent.parent / 'dist' / 'e8-studio.html'


def main() -> None:
    if not ARTIFACT.is_file():
        raise SystemExit('Build the standalone file first: npm run build:single')
    with sync_playwright() as playwright:
        launch = {'headless': True, 'args': chromium_webgl_args()}
        executable = find_chromium_executable()
        if executable:
            launch['executable_path'] = executable
        browser = playwright.chromium.launch(**launch)
        try:
            page = browser.new_page()
            page.add_init_script('''
                const getContext = HTMLCanvasElement.prototype.getContext;
                HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
                  if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
                  return getContext.call(this, kind, ...args);
                };
            ''')
            page.goto(ARTIFACT.as_uri(), wait_until='commit', timeout=30_000)
            page.locator('#render-fallback').wait_for(timeout=30_000)
            assert page.locator('#render-fallback [data-act="openCanvas2DStudio"]').count() == 0
            assert page.locator('#render-fallback [data-act="enableReducedMode"]').count() == 0
            assert page.locator('#render-fallback [data-act="retryWebGL"]').count() == 1
            assert 'opened separately if it was supplied' in page.locator('#render-fallback').inner_text()
            print('Standalone file:// no-WebGL fallback passed: truthful guidance, no missing link or reload-loop action.')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
