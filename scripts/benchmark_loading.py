"""Measure cold web first frame and first non-default view load.

Run after ``npm run build:web``. This is a local Chromium comparison, not a
cross-device performance guarantee.
"""
import json
from statistics import median

from playwright.sync_api import sync_playwright
from verify import start_server, find_chromium_executable, chromium_webgl_args


def main():
    server, base = start_server()
    samples = []
    try:
        with sync_playwright() as playwright:
            launch = {'headless': True, 'args': chromium_webgl_args()}
            executable = find_chromium_executable()
            if executable:
                launch['executable_path'] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                for _ in range(3):
                    context = browser.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce')
                    page = context.new_page()
                    page.goto(base + '/dist/web/index.html', wait_until='domcontentloaded')
                    page.wait_for_function('() => window.__app?.startupMetrics?.firstFrameMs != null')
                    result = page.evaluate('''async () => {
                      const firstFrameMs = window.__app.startupMetrics.firstFrameMs;
                      const initialJsBytes = performance.getEntriesByType('resource')
                        .filter(entry => entry.name.endsWith('.js'))
                        .reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0);
                      const start = performance.now();
                      window.__app.switchView('polytope');
                      await (window.__app.currentView?.ready || Promise.resolve());
                      return { firstFrameMs, initialJsBytes,
                        firstPolytopeMs: performance.now() - start,
                        polytopeReady: window.__app.currentView?.name === 'polytope4d' };
                    }''')
                    assert result['polytopeReady'], result
                    samples.append(result)
                    context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
    summary = {key: round(median(sample[key] for sample in samples), 1)
               for key in ('firstFrameMs', 'initialJsBytes', 'firstPolytopeMs')}
    print(json.dumps({'median': summary, 'samples': samples}, indent=2))


if __name__ == '__main__':
    main()
