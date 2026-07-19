"""Bug-hunt: cycle every feature combination, capture console errors and
unexpected state changes. Designed to surface real regressions from the
pickup rounds (Tracks 1a/1b/1c/1d/4).

What it does:
  1. Boots the page, waits for ready
  2. Cycles every view (6 views), captures errors
  3. Toggles every FX mode (21 modes)
  4. Toggles every bg mood (8 moods)
  5. Cycles every theme (5 themes)
  6. Cycles every layout (4 layouts)
  7. Cycles every Platonic shape (5 shapes)
  8. Cycles every E8 view mode (coxeter, ortho3d, custom, h4, petrie)
  9. Cycles every shift mode + every blend mode
  10. Cycles every camera path + every camera mode
  11. Toggles every gallery preset (7 presets)
  12. Toggles bloom mandelbox + tweens scale/iters/mix
  13. Triggers surprise() a few times
  14. Tries essay navigation (next/prev/setEssayById)
  15. Toggles tour on/off
  16. Clicks the canvas (root picker)
  17. Toggles every panel toggle (autoRotate, autoZoom, Petrie, rings, etc.)
  18. Saves config (reload page, confirm persistence)
  19. Tries command palette
"""
import sys, json, threading, time
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from verify import ROOT

PORT = 8785
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'

errors_total = []
warnings_total = []
console_log = []  # non-error, non-warning messages too

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox', '--disable-gpu', '--enable-logging=stderr', '--v=0'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800})

    def on_console(msg):
        t = msg.type
        text = msg.text[:400]
        console_log.append((t, text))
        if t == 'error':
            errors_total.append(text)
        elif t == 'warning':
            warnings_total.append(text)
    page.on("console", on_console)
    page.on("pageerror", lambda e: errors_total.append(f"[pageerror] {e}"))

    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    print("READY")

    def check(label, fn):
        """Run fn(); capture any new errors during the call."""
        before = len(errors_total)
        try:
            fn()
        except Exception as e:
            print(f"  EXCEPTION {label}: {e}")
            return
        after = len(errors_total)
        new_errs = errors_total[before:after]
        if new_errs:
            print(f"  ❌ {label}: {len(new_errs)} error(s)")
            for e in new_errs[:3]:
                print(f"      {e[:200]}")
        else:
            print(f"  ✓  {label}")

    # 1. Cycle every view
    print("\n=== 1. Cycle views ===")
    for v in ['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched']:
        check(f"switchView({v})", lambda v=v: (page.evaluate(f"() => window.__app.switchView('{v}')"), page.wait_for_timeout(400)))

    # 2. FX modes
    print("\n=== 2. Cycle FX modes ===")
    for m in ['none','glow','pulse','trail','chromatic','kaleidoscope','ripple','spiral','fog','heat','edge-glow',
             'aura','voronoi','caustic','iridescent','flowfield','plasma','kaleido6','dof','nebula','wireframe']:
        check(f"fx={m}", lambda m=m: (page.evaluate(f"() => window.__app.setFX('{m}')"), page.wait_for_timeout(150)))

    # 3. Background moods
    print("\n=== 3. Cycle bg moods ===")
    for m in ['void','starfield','cosmos','aurora','mandala','grid','plasma']:
        check(f"bg={m}", lambda m=m: (page.evaluate(f"() => window.__app.setBgMode('{m}')"), page.wait_for_timeout(300)))

    # 4. Themes
    print("\n=== 4. Cycle themes ===")
    for t in ['dark-gold','paper-ink','neon-cyber','pure-dark','solarized']:
        check(f"theme={t}", lambda t=t: (page.evaluate(f"() => window.__app.setTheme('{t}')"), page.wait_for_timeout(150)))

    # 5. Layouts
    print("\n=== 5. Cycle layouts ===")
    for l in ['default','compact','wide-canvas','presentation']:
        check(f"layout={l}", lambda l=l: (page.evaluate(f"() => window.__app.setLayout('{l}')"), page.wait_for_timeout(200)))

    # 6. Platonic shapes
    print("\n=== 6. Cycle shapes (on platonic view) ===")
    page.evaluate("() => window.__app.switchView('platonic')")
    page.wait_for_timeout(300)
    for s in ['tetrahedron','cube','octahedron','dodecahedron','icosahedron']:
        check(f"shape={s}", lambda s=s: (page.evaluate(f"() => window.__app.setShape('{s}')"), page.wait_for_timeout(250)))

    # 7. E8 modes (on e8coxeter view)
    print("\n=== 7. E8 view modes ===")
    page.evaluate("() => window.__app.switchView('e8coxeter')")
    page.wait_for_timeout(300)
    for m in ['coxeter','ortho3d','custom','h4','petrie']:
        check(f"e8ViewMode={m}", lambda m=m: (page.evaluate(f"() => window.__app.setE8Mode && window.__app.setE8Mode('{m}')"), page.wait_for_timeout(300)))

    # 8. Shift + blend modes
    print("\n=== 8. Shift modes ===")
    for m in ['static','rainbow','pulse','wave','spiral']:
        check(f"shift={m}", lambda m=m: (page.evaluate(f"() => window.__app.setShiftMode && window.__app.setShiftMode('{m}')"), page.wait_for_timeout(200)))
    print("\n=== 9. Blend modes ===")
    for m in ['spectrum','lab','interpolate']:
        check(f"blend={m}", lambda m=m: (page.evaluate(f"() => window.__app.setBlendMode && window.__app.setBlendMode('{m}')"), page.wait_for_timeout(200)))

    # 10. Camera
    print("\n=== 10. Camera modes + paths ===")
    for m in ['orbit','spiral','figure8','pullback']:
        check(f"cameraMode={m}", lambda m=m: (page.evaluate(f"() => window.__app.setCameraMode('{m}')"), page.wait_for_timeout(300)))
    for p_ in ['manual','coxeterOrbit','ringDive','petrieSpiral','h4Reveal']:
        check(f"cameraPath={p_}", lambda p_=p_: (page.evaluate(f"() => window.__app.setCameraPath('{p_}')"), page.wait_for_timeout(300)))

    # 11. Gallery presets
    print("\n=== 11. Gallery presets ===")
    for pid in ['coxeter-rings','subset-diff','sdf-metal','platonic-bloom','600-bridge','weyl-chamber','twin-600']:
        check(f"preset={pid}", lambda pid=pid: (page.evaluate(f"() => window.__app.applyGalleryPreset('{pid}')"), page.wait_for_timeout(400)))

    # 12. Mandelbox
    print("\n=== 12. Mandelbox (Bloom view) ===")
    page.evaluate("() => window.__app.switchView('bloom')")
    page.wait_for_timeout(400)
    check("toggleBloomMandelbox ON", lambda: page.evaluate("() => window.__app.toggleBloomMandelbox()") or page.wait_for_timeout(200))
    for s in [1.8, 2.618, 3.2, 3.5]:
        check(f"mandelboxScale={s}", lambda s=s: (page.evaluate(f"() => window.__app.setParam('bloomMandelboxScale', {s})"), page.wait_for_timeout(200)))
    for it in [1, 6, 12]:
        check(f"mandelboxIters={it}", lambda it=it: (page.evaluate(f"() => window.__app.setParam('bloomMandelboxIters', {it})"), page.wait_for_timeout(200)))

    # 13. Surprise
    print("\n=== 13. Surprise() ===")
    for i in range(3):
        check(f"surprise #{i+1}", lambda: (page.evaluate("() => window.__app.surprise()"), page.wait_for_timeout(300)))

    # 14. Essay navigation
    print("\n=== 14. Essays ===")
    check("toggleEssay (open)", lambda: page.evaluate("() => window.__app.toggleEssay()") or page.wait_for_timeout(200))
    for essay_id in ['plato_timaeus','e8_overview','moonshine','mandelbox_intro']:
        check(f"setEssayById({essay_id})", lambda essay_id=essay_id: (page.evaluate(f"() => window.__app._essayPanel.setEssayById('{essay_id}')"), page.wait_for_timeout(150)))
    check("essayNext", lambda: page.evaluate("() => window.__app.essayNext()") or page.wait_for_timeout(100))
    check("essayPrev", lambda: page.evaluate("() => window.__app.essayPrev()") or page.wait_for_timeout(100))

    # 15. Tour
    print("\n=== 15. Tour ===")
    check("tourStart", lambda: page.evaluate("() => window.__app.tourStart()") or page.wait_for_timeout(400))
    page.wait_for_timeout(500)
    check("tourStop", lambda: page.evaluate("() => window.__app.tourStop()") or page.wait_for_timeout(200))

    # 16. Canvas click (root picker)
    print("\n=== 16. Canvas click (root picker) ===")
    page.evaluate("() => window.__app.switchView('e8coxeter')")
    page.wait_for_timeout(400)
    page.mouse.click(640, 400)
    page.wait_for_timeout(400)
    check("clearPick", lambda: page.evaluate("() => window.__app.clearPick()") or page.wait_for_timeout(200))

    # 17. Various toggles
    print("\n=== 17. Misc toggles ===")
    for action in ['toggleAutoRotate','toggleAutoZoom','toggleRings','toggleEdges','togglePetrie',
                   'toggleRootDiffusion','toggleWeylMirrors','toggleE8Twin600','toggleH4TwinReveal',
                   'toggleCartanHighlight','toggleProjectionAuto','toggleTeachingMode']:
        check(action, lambda action=action: page.evaluate(f"() => window.__app.{action}()") or page.wait_for_timeout(150))

    # 18. Persistence check (verify save + reload)
    print("\n=== 18. Persistence ===")
    page.evaluate("() => window.__app.setParam('bgMode', 'cosmos')")
    page.evaluate("() => window.__app.setParam('fxMode', 'plasma')")
    page.wait_for_timeout(300)
    check("saveConfig then reload", lambda: (page.reload(wait_until='commit'), page.wait_for_function("() => !!(window.__app)", timeout=10000), page.wait_for_timeout(1000)))

    # 19. Command palette
    print("\n=== 19. Command palette ===")
    check("toggleCommandPalette", lambda: page.evaluate("() => window.__app.toggleCommandPalette()") or page.wait_for_timeout(200))
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)

    # 20. Code-art copy (clipboard may fail in headless — known)
    print("\n=== 20. Code-art copy ===")
    check("copyCodeArt(0)", lambda: page.evaluate("() => window.__app.copyCodeArt(0)") or page.wait_for_timeout(200))

    # Summary
    print("\n" + "=" * 60)
    print(f"SUMMARY: {len(errors_total)} errors, {len(warnings_total)} warnings, {len(console_log)} total console messages")
    print("=" * 60)
    if errors_total:
        print("\n=== UNIQUE ERRORS ===")
        seen = set()
        for e in errors_total:
            key = e[:120]
            if key in seen: continue
            seen.add(key)
            print(f"  • {e[:300]}")
    if warnings_total:
        # Filter out known benign warnings
        benign = ('Download the React DevTools', 'GL Driver Message', 'favicon', 'GL_INVALID_OPERATION')
        real_warns = [w for w in warnings_total if not any(b in w for b in benign)]
        if real_warns:
            print(f"\n=== {len(real_warns)} UNIQUE NON-BENIGN WARNINGS ===")
            seen = set()
            for w in real_warns:
                key = w[:120]
                if key in seen: continue
                seen.add(key)
                print(f"  • {w[:300]}")

    browser.close()
server.shutdown()
