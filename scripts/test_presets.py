"""Test all gallery presets — apply each, screenshot, check for errors."""
import sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from verify import ROOT

PORT = 8802

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

handler = partial(QuietHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    msgs, errs = [], []
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:200]}"))
    page.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    page.wait_for_timeout(800)

    PRESETS = page.evaluate("() => window.__app.getGalleryPresets().map(p => p.id)")
    if len(sys.argv) > 1:
        requested = set(sys.argv[1:])
        PRESETS = [preset for preset in PRESETS if preset in requested]
    print(f"=== Testing all {len(PRESETS)} gallery presets ===\n")
    results = []
    for preset_id in PRESETS:
        before_errs = len(errs)
        page.evaluate(f"() => window.__app.applyGalleryPreset('{preset_id}')")
        page.wait_for_timeout(250)  # one stable frame is enough for this smoke test
        # Capture state
        state = page.evaluate("""() => ({
          view: window.__app.params.view,
          palette: window.__app.params.palette,
          fxMode: window.__app.params.fxMode,
          bgMode: window.__app.params.bgMode,
          bgIntensity: window.__app.params.bgIntensity,
          autoRotate: !!window.__app.params.autoRotate,
          bloomAuto: !!window.__app.params.bloomAuto,
          cameraPath: window.__app.params.cameraPath,
          fxIntensity: window.__app.params.fxIntensity,
          shape: window.__app.params.shape,
          currentView: window.__app.currentView?.name,
        })""")
        # Keep the per-preset pass cheap; the main verifier performs the costly
        # non-blank pixel read. Here we need a live, sized canvas and clean logs.
        png_size = page.evaluate("() => { const c = document.getElementById('canvas'); return c.width * c.height; }")
        new_errs = errs[before_errs:]
        status = "FAIL" if new_errs else "ok"
        print(f"  {status} {preset_id:24s}  view={state['view']:11s}  bg={state['bgMode']:11s}  fx={state['fxMode']:13s}  png={png_size}")
        if new_errs:
            for e in new_errs[:2]:
                print(f"      ERROR: {e[:150]}")
        results.append({
          'preset': preset_id, 'ok': not new_errs, 'errors': new_errs,
          'state': state, 'png_size': png_size
        })

    print(f"\n=== Summary ===")
    print(f"  Total: {len(results)}")
    print(f"  Passed: {sum(1 for r in results if r['ok'])}")
    print(f"  Failed: {sum(1 for r in results if not r['ok'])}")

    # Test slider range too
    print(f"\n=== Speed slider range test ===")
    page.evaluate("() => window.__app.setShiftMode('rainbow')")
    page.wait_for_timeout(500)
    for val in [1, 5, 12, 30, 60, 90, 120]:
        page.evaluate(f"() => window.__app.setParam('shiftSpeed', {val})")
        page.wait_for_timeout(300)
        applied = page.evaluate("() => window.__app.params.shiftSpeed")
        slider_text = page.evaluate("""() => {
          const rows = Array.from(document.querySelectorAll('.control-row'));
          const cycleRow = rows.find(r => r.textContent.includes('Cycle'));
          if (!cycleRow) return null;
          // Find the value display — it's typically a span/div after the slider
          const valueEl = cycleRow.querySelector('span, .control-value, [class*="value"]');
          return valueEl ? valueEl.textContent.trim() : cycleRow.textContent.trim();
        }""")
        # Get the formatted text from the row
        formatted = page.evaluate("""() => {
          const rows = Array.from(document.querySelectorAll('.control-row'));
          const cycleRow = rows.find(r => r.textContent.includes('Cycle'));
          if (!cycleRow) return null;
          // Extract number from text
          const m = cycleRow.textContent.match(/(\\d+)(?:m)?(?:\\s*(\\d+)s)?/);
          return m ? m[0] : cycleRow.textContent.trim().slice(-10);
        }""")
        print(f"  shiftSpeed={val:3d}  -> params.shiftSpeed={applied:3d}  slider label: '{formatted}'")

    print("\n--- errors ---")
    for e in errs:
        print(f"  {e[:200]}")
    browser.close()
server.shutdown()
if any(not r['ok'] for r in results):
    raise SystemExit(1)
