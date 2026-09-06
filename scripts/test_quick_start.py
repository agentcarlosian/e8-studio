#!/usr/bin/env python3
"""Exercise the opt-in guide in isolation, using a real browser and scene adapter."""
from __future__ import annotations

import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

from verify import find_chromium_executable

ROOT = Path(__file__).resolve().parent.parent
HARNESS = b"""<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/src/assets/quick-start.css">
<style>body{margin:0;background:#07070c;color:#f4f1ea;font:14px system-ui}
button{margin:0}#open-guide,#canvas{position:absolute;left:24px;top:24px;min-height:44px}
#canvas{top:90px}</style>
<button id="open-guide">Start exploring</button><button id="canvas">Artwork</button>
<script type="module">
import { createQuickStart } from '/src/ui/quick-start.js';
window.calls = []; window.dismissals = []; window.failStep = null;
window.guide = createQuickStart({
  applyStep(step) {
    window.calls.push(step.id);
    if (window.failStep === step.id) throw new Error('Injected adapter failure');
  },
  onDismiss(result) { window.dismissals.push(result); },
});
document.getElementById('open-guide').onclick = () => window.guide.start();
</script></html>"""


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/__quick_start_test__':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(HARNESS)
        else:
            super().do_GET()

    def log_message(self, _format, *args):
        pass


def main() -> None:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            options = {'headless': True}
            executable = find_chromium_executable()
            if executable:
                options['executable_path'] = executable
            browser = playwright.chromium.launch(**options)
            try:
                page = browser.new_page(viewport={'width': 1280, 'height': 800})
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(f'http://127.0.0.1:{server.server_port}/__quick_start_test__')
                page.wait_for_function('!!window.guide')
                assert page.evaluate('window.calls.length') == 0, 'Construction must not alter the scene'
                assert page.locator('#quick-start-coach').count() == 0

                page.click('#open-guide')
                assert page.evaluate('window.guide.active')
                assert page.evaluate('window.calls') == ['e8-rings']
                assert page.evaluate('document.activeElement.id') == 'quick-start-heading'
                assert page.locator('#quick-start-coach').get_attribute('role') == 'region'
                assert page.locator('[aria-modal]').count() == 0, 'The guide is nonmodal'
                assert page.locator('[data-quick-start="back"]').is_disabled()
                assert page.evaluate('window.guide.start()') is False
                assert page.evaluate('window.calls.length') == 1, 'Repeated Start must not reset the scene'

                page.click('[data-quick-start="next"]')
                assert page.locator('#quick-start-coach').get_attribute('data-step') == 'platonic-geometry'
                assert page.evaluate('document.activeElement.id') == 'quick-start-heading'
                page.click('[data-quick-start="back"]')
                assert page.evaluate('window.calls.slice(-1)[0]') == 'e8-rings'
                page.click('[data-quick-start="next"]')
                page.click('[data-quick-start="next"]')
                assert page.locator('#quick-start-progress').inner_text().startswith('Step 3 of 3')
                page.click('#canvas')
                assert page.evaluate('document.activeElement.id') == 'canvas', 'Focus must remain free to leave the guide'
                page.click('[data-quick-start="next"]')
                assert page.evaluate('window.guide.active') is False
                assert page.evaluate('window.dismissals') == [{'completed': True, 'stepId': 'visual-style'}]
                assert page.evaluate('document.activeElement.id') == 'open-guide'
                assert page.evaluate('window.guide.close()') is False

                page.click('#open-guide')
                page.evaluate("window.failStep = 'platonic-geometry'")
                page.click('[data-quick-start="next"]')
                assert page.locator('[role="alert"]').is_visible(), 'Adapter failures need a recoverable action'
                assert page.locator('#quick-start-coach').get_attribute('data-step') == 'e8-rings'
                page.evaluate('window.failStep = null')
                page.get_by_role('button', name='Try again', exact=True).click()
                assert page.locator('#quick-start-coach').get_attribute('data-step') == 'platonic-geometry'
                assert page.locator('[role="alert"]').count() == 0

                page.evaluate("""() => {
                  const modal = document.createElement('div');
                  modal.id = 'test-modal'; modal.setAttribute('aria-modal', 'true');
                  modal.innerHTML = '<button id="modal-control">Modal control</button>';
                  document.body.appendChild(modal); modal.firstElementChild.focus();
                }""")
                page.keyboard.press('Escape')
                assert page.evaluate('window.guide.active'), 'Focused modal owns Escape'
                page.evaluate("document.getElementById('test-modal').remove()")
                assert page.evaluate("""() => {
                  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
                  window.dispatchEvent(event); return event.defaultPrevented;
                }"""), 'Active guide consumes Escape'
                assert page.evaluate('window.guide.active') is False
                assert page.evaluate('window.dismissals.slice(-1)[0].completed') is False
                assert not page.evaluate("""() => {
                  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
                  window.dispatchEvent(event); return event.defaultPrevented;
                }"""), 'Closed guide must release its key listener'

                for width, height in [(1280, 800), (390, 844), (320, 568), (568, 320)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    page.click('#open-guide')
                    bounds = page.locator('#quick-start-coach').bounding_box()
                    assert bounds and bounds['x'] >= 0 and bounds['y'] >= 0
                    assert bounds['x'] + bounds['width'] <= width + 1
                    assert bounds['y'] + bounds['height'] <= height + 1
                    assert page.evaluate("""() => {
                      const coach = document.getElementById('quick-start-coach');
                      return coach.scrollWidth <= coach.clientWidth && [...coach.querySelectorAll('button')].every(button => {
                        const rect = button.getBoundingClientRect();
                        return rect.width >= 44 && rect.height >= 44 && parseFloat(getComputedStyle(button).fontSize) >= 14;
                      });
                    }"""), f'Guide clips or has undersized controls at {width}x{height}'
                    page.evaluate('window.guide.close()')

                page.emulate_media(reduced_motion='reduce')
                page.click('#open-guide')
                assert page.locator('[data-quick-start="next"]').evaluate('(button) => getComputedStyle(button).transitionDuration') == '0s'
                page.click('[data-quick-start="close"]')
                assert page.evaluate('document.activeElement.id') == 'open-guide'

                # The real caller refreshes its panel on dismissal, replacing
                # the original trigger. A supplied restore adapter runs last.
                page.evaluate("""async () => {
                  const { createQuickStart } = await import('/src/ui/quick-start.js');
                  const original = document.getElementById('open-guide');
                  original.focus();
                  const guide = createQuickStart({
                    applyStep() {},
                    onDismiss() { original.replaceWith(original.cloneNode(true)); },
                    restoreFocus(invoker) {
                      window.restoredOriginal = invoker === original && !invoker.isConnected;
                      document.getElementById('open-guide').focus();
                    },
                  });
                  guide.start(); guide.close();
                }""")
                assert page.evaluate('window.restoredOriginal')
                assert page.evaluate('document.activeElement.id') == 'open-guide'
                assert not errors, errors
                print('Quick-start browser checks passed: opt-in lifecycle, navigation, focus, Escape, recovery, responsive controls, and reduced motion.')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
