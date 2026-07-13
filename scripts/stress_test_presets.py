"""Deep test: cycle each preset, take screenshot, sample pixels, check for issues.

For each preset:
  - Apply
  - Wait 2s (let animations + bg-quad shader warm up)
  - Sample pixels from canvas (center, corners)
  - Take screenshot
  - Check for any console errors
  - Verify the bg-quad is actually rendering (not black/transparent)
"""
import sys, threading, time, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from verify import ROOT

PORT = 8804
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'

PRESETS = [
    'coxeter-rings', 'subset-diff', 'sdf-metal', 'platonic-bloom',
    '600-bridge', 'weyl-chamber', 'twin-600',
    'aurora-borealis', 'deep-space', 'cosmic-dawn', 'mandala-meditation',
    'plasma-storm', 'tron-grid', 'milky-meditation',
]
shot_dir = Path(r"C:\Users\Ian\e8_studio\smoke_shots\presets_round2")
shot_dir.mkdir(parents=True, exist_ok=True)

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

    print("=== Stress testing all 14 presets ===\n")
    print(f"{'preset':24s} {'view':11s} {'bg':11s} {'pixel-corner':13s} {'pixel-center':13s} {'errs':5s} {'notes'}")
    print("-" * 100)

    issues = []
    for preset_id in PRESETS:
        before_errs = len(errs)
        page.evaluate(f"() => window.__app.applyGalleryPreset('{preset_id}')")
        page.wait_for_timeout(2200)  # let things settle

        state = page.evaluate("""() => ({
          view: window.__app.params.view,
          bgMode: window.__app.params.bgMode,
          bgIntensity: window.__app.params.bgIntensity,
          fxMode: window.__app.params.fxMode,
        })""")

        # Sample pixels — corner (50,50) and center (640,400)
        pixels = page.evaluate("""() => {
          const c = document.getElementById('canvas');
          const gl = c.getContext('webgl2');
          if (!gl) return null;
          const sample = (x, y) => {
            const p = new Uint8Array(4);
            gl.readPixels(x, c.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
            return Array.from(p);
          };
          return {
            corner: sample(50, 50),
            center: sample(c.width/2|0, c.height/2|0),
          };
        }""")

        new_errs = errs[before_errs:]
        notes = []
        if pixels:
            cc = pixels['corner']
            ct = pixels['center']
            # Check if canvas is suspiciously empty (all zero or all max white)
            if cc and all(c < 10 for c in cc[:3]):
                notes.append('CORNER BLACK')
            if cc and all(c > 245 for c in cc[:3]):
                notes.append('CORNER WHITE')
            if ct and all(c < 5 for c in ct[:3]) and cc and all(c < 5 for c in cc[:3]):
                notes.append('ALL BLACK')
            # Check for shader errors specifically
            shader_errs = [e for e in new_errs if 'Shader' in e or 'WebGLProgram' in e]
            if shader_errs:
                notes.append(f'SHADER ERR: {len(shader_errs)}')
        else:
            notes.append('NO GL CTX')

        screenshot_path = shot_dir / f"{preset_id}.png"
        try:
            page.screenshot(path=str(screenshot_path), full_page=False)
        except:
            notes.append('SCREENSHOT FAIL')

        status = "❌" if new_errs else ("⚠" if notes else "✓")
        corner_str = str(pixels['corner']) if pixels else 'n/a'
        center_str = str(pixels['center']) if pixels else 'n/a'
        print(f"  {status} {preset_id:22s} {state['view']:11s} {state['bgMode']:11s} {corner_str:13s} {center_str:13s} {len(new_errs):5d} {' / '.join(notes)}")

        if new_errs or notes:
            issues.append({
                'preset': preset_id,
                'errs': new_errs,
                'notes': notes,
            })

    print(f"\n=== Summary ===")
    print(f"  Total presets tested: {len(PRESETS)}")
    print(f"  Clean (no errors, no notes): {len(PRESETS) - len(issues)}")
    print(f"  Issues: {len(issues)}")

    if issues:
        print(f"\n=== Issues ===")
        for iss in issues:
            print(f"  {iss['preset']}: {', '.join(iss['notes']) if iss['notes'] else 'errors'}")
            for e in iss['errs'][:2]:
                print(f"    {e[:200]}")

    print(f"\nScreenshots saved to {shot_dir}/")
    browser.close()
server.shutdown()
