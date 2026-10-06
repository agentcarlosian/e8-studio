"""Exercise desktop startup and recovery with local, synthetic failures.

Uses the Vite source server so the test never depends on a stale dist build.
Run: python scripts/test_startup_recovery.py
"""
from __future__ import annotations

import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright
from verify import chromium_webgl_args, find_chromium_executable


ROOT = Path(__file__).resolve().parent.parent


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def start_vite(port: int) -> subprocess.Popen:
    npm = shutil.which('npm')
    if not npm:
        raise RuntimeError('npm is required for the Vite source server')
    process = subprocess.Popen(
        [npm, 'run', 'dev', '--', '--host', '127.0.0.1', '--port', str(port), '--strictPort'],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
    )
    url = f'http://127.0.0.1:{port}/index.html'
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError(f'Vite exited with code {process.returncode}')
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return process
        except Exception:
            time.sleep(0.1)
    process.terminate()
    raise RuntimeError('Vite did not start within 10 seconds')


def start_built_server(port: int) -> subprocess.Popen:
    output = ROOT / 'dist' / 'web'
    if not (output / 'mobile.html').is_file():
        raise RuntimeError('Build the web entrypoints first: npm run build:web')
    process = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(output)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
    )
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError(f'Built web server exited with code {process.returncode}')
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/index.html', timeout=1) as response:
                if response.status == 200:
                    return process
        except Exception:
            time.sleep(0.1)
    process.terminate()
    raise RuntimeError('Built web server did not start within 10 seconds')


def assert_e8_recovered(page) -> None:
    page.wait_for_function("() => window.__app?.params?.view === 'e8coxeter' && window.__app?.currentView?.name === 'e8coxeter'")
    page.wait_for_function("() => JSON.parse(localStorage.getItem('e8_studio_config_v1') || '{}').view === 'e8coxeter'")


def assert_canvas2d_route(browser, base: str) -> None:
    # Force only WebGL contexts to fail; Canvas2D remains available.
    page = browser.new_page()
    try:
        page.add_init_script('''
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
              if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
              return getContext.call(this, kind, ...args);
            };
        ''')
        page.goto(base + '/index.html', wait_until='commit')
        button = page.locator('#render-fallback [data-act="openCanvas2DStudio"]')
        button.wait_for()
        assert page.locator('#render-fallback [data-act="enableReducedMode"]').count() == 0
        button.click()
        page.wait_for_url('**/mobile.html')
        page.wait_for_function('() => !!window.__mobileApp')
        assert page.locator('#mobile-canvas').evaluate('(canvas) => canvas.width > 0 && canvas.height > 0')
    finally:
        page.close()


def main() -> None:
    port = free_port()
    server = start_vite(port)
    base = f'http://127.0.0.1:{port}'
    try:
        with sync_playwright() as playwright:
            launch = {'headless': True, 'args': chromium_webgl_args()}
            executable = find_chromium_executable()
            if executable:
                launch['executable_path'] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                # A nondefault dataset must not be fetched or required for E8.
                page = browser.new_page()
                blocked_data = []
                page.route('**/data/polytopes4d.json', lambda route: (
                    blocked_data.append(route.request.url), route.fulfill(status=503, body='offline')
                ))
                page.goto(base + '/index.html', wait_until='commit')
                page.wait_for_function('() => window.__app?.startupMetrics?.firstFrameMs != null')
                assert not blocked_data, '4D data was requested before selecting a 4D-dependent view'
                assert page.evaluate("window.__app.params.view") == 'e8coxeter'
                assert page.evaluate("window.__app.switchView('polytope')") is False
                assert blocked_data, '4D data was not requested on selection'
                assert_e8_recovered(page)
                assert 'polytopes4d.json returned HTTP 503' in page.locator('#status').inner_text()
                page.unroute('**/data/polytopes4d.json')
                assert page.evaluate("window.__app.switchView('polytope')") is True, 'a transient data failure must be retryable'
                page.wait_for_function("() => window.__app.currentView.name === 'polytope4d'")
                page.close()

                # A failed dynamic import also must repair persisted startup state.
                page = browser.new_page()
                page.add_init_script("localStorage.setItem('e8_studio_config_v1', JSON.stringify({view:'polytope'}))")
                page.route('**/src/views/polytope4d.view.js*', lambda route: route.fulfill(status=503, body='module unavailable'))
                page.goto(base + '/index.html', wait_until='commit')
                assert_e8_recovered(page)
                page.wait_for_function('() => window.__app.startupMetrics.firstFrameMs != null')
                page.close()

                # The lesson handoff must focus the new coach, then restore its opener.
                page = browser.new_page()
                page.goto(base + '/index.html', wait_until='commit')
                page.wait_for_function('() => window.__app?.startupMetrics?.firstFrameMs != null')
                page.locator('#canvas').focus()
                page.evaluate("window.__app.openLearningCenter('meet-e8')")
                page.locator('[data-learning-run-step="rings"]').first.click()
                page.wait_for_function("() => document.activeElement?.id === 'learning-experiment-coach-title'")
                assert 'Count the eight rings' in page.locator('#learning-experiment-coach-title').inner_text()
                page.locator('[data-experiment-coach-close]').click()
                page.wait_for_function("() => document.activeElement?.id === 'canvas'")
                page.close()

                assert_canvas2d_route(browser, base)
                if '--built' in sys.argv:
                    built_port = free_port()
                    built_server = start_built_server(built_port)
                    try:
                        assert_canvas2d_route(browser, f'http://127.0.0.1:{built_port}')
                    finally:
                        built_server.terminate()
                        built_server.wait(timeout=5)
                print('Startup recovery passed: lazy 4D data, retry, failed-module persistence, coach focus, and Canvas2D route.')
            finally:
                browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)


if __name__ == '__main__':
    main()
