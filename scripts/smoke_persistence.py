"""Regression test for persistence: pickup round 2 params should survive reload.

Before fix: bgMode/bgIntensity/theme/layout/bloomMandelbox*/etc were
NOT in PERSISTABLE set, so they were saved to localStorage as
the debounced save ran but on reload they were ignored.

After fix: PERSISTABLE includes all pickup params.
"""
import sys, json, threading, time
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from verify import ROOT, find_chromium_executable

PORT = 8787
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    launch_args = {'headless': True, 'args': ['--no-sandbox', '--disable-gpu']}
    chrome = find_chromium_executable()
    if chrome:
        launch_args['executable_path'] = chrome
    browser = p.chromium.launch(**launch_args)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    page.evaluate("() => window.__app.resetConfig()")  # start clean
    page.wait_for_timeout(300)

    # Set a bunch of pickup params
    sets = [
        "() => window.__app.setBgMode('cosmos')",
        "() => window.__app.setBgIntensity(0.9)",
        "() => window.__app.setTheme('neon-cyber')",
        "() => window.__app.setLayout('wide-canvas')",
        "() => window.__app.switchView('bloom')",
        "() => window.__app.toggleBloomMandelbox()",
        "() => window.__app.setParam('bloomMandelboxScale', 3.14)",
        "() => window.__app.switchView('e8coxeter')",
        "() => window.__app.togglePetrie()",
        "() => window.__app.toggleWeylMirrors()",
        "() => window.__app.setCompareMode('difference')",
        "() => window.__app.setParam('e8MorphT', 0.42)",
        "() => window.__app.setParam('rootHaloDepth', 5)",
    ]
    for s in sets:
        page.evaluate(s)
        page.wait_for_timeout(150)

    # Wait for save debounce (250ms)
    page.wait_for_timeout(500)

    # Snapshot before reload
    before = page.evaluate("""() => ({
      bgMode: window.__app.params.bgMode,
      bgIntensity: window.__app.params.bgIntensity,
      theme: window.__app.params.theme,
      layout: window.__app.params.layout,
      view: window.__app.params.view,
      bloomMandelbox: window.__app.params.bloomMandelbox,
      bloomMandelboxScale: window.__app.params.bloomMandelboxScale,
      showPetrie: window.__app.params.showPetrie,
      showWeylMirrors: window.__app.params.showWeylMirrors,
      compareMode: window.__app.params.compareMode,
      e8MorphT: window.__app.params.e8MorphT,
      rootHaloDepth: window.__app.params.rootHaloDepth,
    })""")
    print(f"Before reload: {before}")

    # Reload
    page.reload(wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params)", timeout=15000)
    page.wait_for_timeout(1000)

    after = page.evaluate("""() => ({
      bgMode: window.__app.params.bgMode,
      bgIntensity: window.__app.params.bgIntensity,
      theme: window.__app.params.theme,
      layout: window.__app.params.layout,
      view: window.__app.params.view,
      bloomMandelbox: window.__app.params.bloomMandelbox,
      bloomMandelboxScale: window.__app.params.bloomMandelboxScale,
      showPetrie: window.__app.params.showPetrie,
      showWeylMirrors: window.__app.params.showWeylMirrors,
      compareMode: window.__app.params.compareMode,
      e8MorphT: window.__app.params.e8MorphT,
      rootHaloDepth: window.__app.params.rootHaloDepth,
      // And confirm they were applied (not just stored)
      appliedTheme: document.documentElement.getAttribute('data-theme'),
      appliedLayout: document.body.getAttribute('data-layout'),
    })""")
    print(f"After reload:  {after}")

    # Verify each param survived
    checks = [
        ('bgMode',          before['bgMode'],          after['bgMode']),
        ('bgIntensity',     before['bgIntensity'],     after['bgIntensity']),
        ('theme',           before['theme'],           after['theme']),
        ('layout',          before['layout'],          after['layout']),
        ('view',            before['view'],            after['view']),
        ('bloomMandelbox',  before['bloomMandelbox'],  after['bloomMandelbox']),
        ('bloomMandelboxScale', before['bloomMandelboxScale'], after['bloomMandelboxScale']),
        ('showPetrie',      before['showPetrie'],      after['showPetrie']),
        ('showWeylMirrors', before['showWeylMirrors'], after['showWeylMirrors']),
        ('compareMode',     before['compareMode'],     after['compareMode']),
        ('e8MorphT',        before['e8MorphT'],        after['e8MorphT']),
        ('rootHaloDepth',   before['rootHaloDepth'],   after['rootHaloDepth']),
    ]
    failed = []
    for name, b, a in checks:
        if b != a:
            failed.append((name, b, a))
            print(f"  FAIL {name}: before={b}  after={a}")
        else:
            print(f"  ok   {name}: persisted = {a!r}")

    # Also verify CSS vars / attributes were applied
    if after['appliedTheme'] == before['theme']:
        print(f"  ok   appliedTheme (CSS attr): {after['appliedTheme']!r}")
    else:
        print(f"  FAIL appliedTheme: before={before['theme']}  after CSS attr={after['appliedTheme']}")

    if after['appliedLayout'] == before['layout']:
        print(f"  ok   appliedLayout (CSS attr): {after['appliedLayout']!r}")
    else:
        print(f"  FAIL appliedLayout: before={before['layout']}  after CSS attr={after['appliedLayout']}")

    if failed:
        print(f"\nFAIL: {len(failed)} params did not persist")
    else:
        print(f"\nPASS: all pickup round 2 params persist across reload")
    browser.close()
server.shutdown()
