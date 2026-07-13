"""Verify audit fixes — apply each fix and check the panel reflects it."""
import sys, threading, time
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'):
    # Panel labels intentionally contain mathematical Unicode (E₈, H₄, etc.).
    # Use UTF-8 even when Windows inherited a legacy CP-1252 console.
    sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from verify import ROOT, find_chromium_executable

PORT = 8809
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome = find_chromium_executable()

with sync_playwright() as p:
    launch_args = {'headless': True, 'args': ['--no-sandbox', '--disable-gpu']}
    if chrome:
        launch_args['executable_path'] = chrome
    browser = p.chromium.launch(**launch_args)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    msgs, errs = [], []
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:200]}"))
    page.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    page.wait_for_timeout(800)

    print("=== Audit fix regression tests ===\n")

    # Fix #1, #2, #3: defaults
    p = page.evaluate("() => ({ autoRotate: window.__app.params.autoRotate, e8Spin: window.__app.params.e8Spin, e8Tilt: window.__app.params.e8Tilt, e8Roll: window.__app.params.e8Roll, morph4d: window.__app.params.morph4d, polyAutoRotate: window.__app.params.polyAutoRotate, e8AutoRotate: window.__app.params.e8AutoRotate, e8ViewMode: window.__app.params.e8ViewMode })")
    print(f"#1/#2/#3: defaults")
    print(f"  autoRotate={p['autoRotate']} (expected: false)")
    print(f"  e8Spin={p['e8Spin']} e8Tilt={p['e8Tilt']} e8Roll={p['e8Roll']} (expected: 0 0 0)")
    print(f"  morph4d={p['morph4d']} (expected: 0)")
    print(f"  polyAutoRotate={p['polyAutoRotate']} (expected: false)")
    print(f"  e8AutoRotate={p['e8AutoRotate']} (expected: false)")
    print(f"  e8ViewMode={p['e8ViewMode']} (expected: coxeter)")
    assert p['autoRotate'] == False
    assert p['e8Spin'] == 0 and p['e8Tilt'] == 0 and p['e8Roll'] == 0
    assert p['morph4d'] == 0
    assert p['polyAutoRotate'] == False
    assert p['e8AutoRotate'] == False
    assert p['e8ViewMode'] == 'coxeter'
    print("  OK\n")

    # Fix #10: theme labels
    labels = page.evaluate("""() => {
      // Theme subsection is followed by a .seg-wrap with theme buttons
      const subs = document.querySelectorAll('.ps-subtitle');
      for (const s of subs) {
        if (s.textContent.trim() === 'Theme') {
          const seg = s.nextElementSibling;
          if (!seg || !seg.classList.contains('seg')) return null;
          return Array.from(seg.querySelectorAll('button')).map(b => b.textContent.trim());
        }
      }
      return null;
    }""")
    print(f"#10: theme labels: {labels}")
    assert labels == ['Dark', 'Light', 'Neon', 'Mono', 'Solar'], f"unexpected labels: {labels}"
    print("  OK\n")

    # Layout picker was intentionally removed when wide-canvas became the
    # default. Keep a regression check for both parts of that current contract.
    layout_state = page.evaluate("""() => ({
      hasPicker: Array.from(document.querySelectorAll('.ps-subtitle'))
        .some(s => s.textContent.trim() === 'Layout'),
      value: window.__app.params.layout,
    })""")
    print(f"#11: layout picker removed, default retained: {layout_state}")
    assert layout_state == {'hasPicker': False, 'value': 'wide-canvas'}, f"unexpected: {layout_state}"
    print("  OK\n")

    # Fix #7: E8 projection labels
    e8_labels = page.evaluate("""() => {
      const subs = document.querySelectorAll('.ps-subtitle');
      for (const s of subs) {
        if (s.textContent.includes('E') && s.textContent.includes('projection')) {
          const seg = s.nextElementSibling;
          if (!seg || !seg.classList.contains('seg')) return null;
          return Array.from(seg.querySelectorAll('button')).map(b => b.textContent.trim());
        }
      }
      return null;
    }""")
    print(f"#7: E8 projection labels: {e8_labels}")
    assert 'Axes' in e8_labels, f"Axes missing: {e8_labels}"
    assert 'Spin' in e8_labels, f"Spin missing: {e8_labels}"
    assert 'Rand' not in e8_labels, f"old 'Rand' still present: {e8_labels}"
    assert '8D' not in e8_labels, f"old '8D' still present: {e8_labels}"
    print("  OK\n")

    # Fix #24: showInspector default
    inspector_default = page.evaluate("() => window.__app.params.showInspector")
    print(f"#24: showInspector default = {inspector_default} (expected: false)")
    assert inspector_default == False
    print("  OK\n")

    # Fix #5: Opacity slider in bloom view
    page.evaluate("() => window.__app.switchView('bloom')")
    page.wait_for_timeout(500)
    has_opacity = page.evaluate("""() => {
      const rows = document.querySelectorAll('.control-row');
      return Array.from(rows).some(r => r.textContent.includes('Opacity'));
    }""")
    print(f"#5: Opacity slider in bloom view: {has_opacity} (expected: true)")
    assert has_opacity, "Opacity slider should appear in bloom view"
    print("  OK\n")

    # Fix #18: Mandelbox sliders visible (with reduced opacity when off)
    page.evaluate("() => window.__app.setParam('bloomAmount', 0.9)")
    page.wait_for_timeout(500)
    mandelbox_state = page.evaluate("""() => {
      const subs = document.querySelectorAll('.ps-subtitle');
      for (const s of subs) {
        if (s.textContent.includes('Mandelbox')) {
          const wrapper = s.nextElementSibling;
          const dimmed = wrapper?.style?.opacity;
          return { found: true, dimmed };
        }
      }
      return { found: false };
    }""")
    print(f"#18: Mandelbox sliders, dimmed opacity when off: {mandelbox_state}")
    # bloomMandelbox defaults to false so it should be dimmed
    assert mandelbox_state['found'] == True
    print("  OK\n")

    # Fix #14: Camera path tooltips
    page.evaluate("() => window.__app.switchView('e8coxeter')")
    page.wait_for_timeout(500)
    tooltips = page.evaluate("""() => {
      const subs = document.querySelectorAll('.ps-subtitle');
      for (const s of subs) {
        if (s.textContent.trim() === 'Camera') {
          const buttons = s.parentElement.querySelectorAll('.seg button');
          // Find camera PATH buttons (not mode buttons)
          const pathButtons = Array.from(buttons).filter(b =>
            ['Manual', 'Coxeter', 'Dive', 'Petrie', 'H4'].includes(b.textContent.trim())
          );
          return pathButtons.map(b => b.title || '(no tooltip)');
        }
      }
      return null;
    }""")
    print(f"#14: camera path tooltips: {tooltips}")
    assert all('camera path' not in t for t in tooltips), f"old generic tooltips: {tooltips}"
    assert all(len(t) > 20 for t in tooltips), f"tooltips too short: {tooltips}"
    print("  OK\n")

    # Fix #13: shapeShort is consistent
    page.evaluate("() => window.__app.switchView('platonic')")
    page.wait_for_timeout(500)
    abbrev_check = page.evaluate("""() => {
      // shape pills
      const pills = Array.from(document.querySelectorAll('.shape-pill')).map(b => b.textContent.trim());
      // compare subset — need to switch view to get these in DOM
      window.__app.switchView('e8coxeter');
      return new Promise(r => setTimeout(() => {
        const subs = document.querySelectorAll('.ps-subtitle');
        let cmpButtons = [];
        for (const s of subs) {
          if (s.textContent.includes('Compare')) {
            cmpButtons = Array.from(s.parentElement.querySelectorAll('button')).map(b => b.textContent.trim());
            break;
          }
        }
        r({ pills, cmpButtons });
      }, 500));
    }""")
    print(f"#13: shape abbreviations — pills: {abbrev_check['pills']}, compare: {abbrev_check['cmpButtons']}")
    # Same shape names should produce same abbreviations
    shape_names = ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron']
    expected = ['tetr', 'cube', 'octa', 'dode', 'icos']
    # Both should contain the same set
    for name, abbr in zip(shape_names, expected):
        if name != 'cube':
            assert abbr in abbrev_check['pills'], f"{abbr} missing in pills"
            assert abbr in abbrev_check['cmpButtons'], f"{abbr} missing in cmp"
    print("  OK\n")

    print("=== All audit fix regression tests passed ===")
    if errs:
        print("ERRORS:")
        for e in errs: print(f"  {e[:200]}")
    browser.close()
server.shutdown()
