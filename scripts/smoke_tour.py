"""Smoke-test Track 4: tour mode + code-art gallery."""
import sys, json, threading, time
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from verify import ROOT, find_chromium_executable

PORT = 8784
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
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    msgs, errs = [], []
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:200]}"))
    page.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    print("READY")
    # Verify the new exports exist
    has_tour = page.evaluate("() => typeof window.__app.tourStart === 'function' && typeof window.__app.tourStop === 'function' && typeof window.__app.toggleTour === 'function' && typeof window.__app.copyCodeArt === 'function'")
    has_essay_panel_method = page.evaluate("() => typeof (window.__app._essayPanel?.setEssayById) === 'function'")
    print(f"  __app.tourStart/tourStop/toggleTour/copyCodeArt all defined: {has_tour}")
    print(f"  _essayPanel.setEssayById exists: {has_essay_panel_method}")
    # Check that the Learn section renders
    learn_section = page.evaluate("() => !!document.body.innerHTML.match(/Code-art gallery/)")
    print(f"  Learn section (code-art gallery) in DOM: {learn_section}")
    # Start the tour
    page.evaluate("() => window.__app.tourStart()")
    page.wait_for_timeout(800)
    state = page.evaluate("() => ({ tourRunning: !!document.querySelector('#tour-overlay.tour-on'), view: window.__app.params.view, fxMode: window.__app.params.fxMode })")
    print(f"  after tourStart: {state}")
    # The opening Platonic-duals stop is deliberately longer than the later
    # stops so its shape cycle has time to show every solid (18s + buffer).
    page.wait_for_timeout(18500)
    state2 = page.evaluate("""() => ({
        view: window.__app.params.view,
        fxMode: window.__app.params.fxMode,
        overlayTitle: document.querySelector('.tour-title')?.textContent,
        counter: document.querySelector('.tour-counter')?.textContent,
        progressWidth: parseFloat(document.querySelector('.tour-progress-fill')?.style.width || '0')
    })""")
    print(f"  after 18.5s (should be on stop 2): {state2}")
    assert state2['counter'].startswith('Stop 2 /'), f"tour did not advance to stop 2: {state2}"
    assert 0 <= state2['progressWidth'] < 40, f"tour progress did not reset for stop 2: {state2}"
    # Stop the tour
    page.evaluate("() => window.__app.tourStop()")
    page.wait_for_timeout(300)
    state3 = page.evaluate("() => !!document.querySelector('#tour-overlay.tour-on')")
    print(f"  after tourStop: overlay visible = {state3}")
    # Test setEssayById directly
    page.evaluate("() => window.__app._essayPanel.setEssayById('plato_timaeus')")
    page.wait_for_timeout(300)
    title = page.evaluate("() => document.querySelector('.essay-title')?.textContent")
    print(f"  essay title after setEssayById('plato_timaeus'): {title!r}")
    # Test code-art copy
    has_clip = page.evaluate("() => !!(navigator.clipboard && navigator.clipboard.writeText)")
    print(f"  navigator.clipboard available: {has_clip}")
    page.evaluate("() => window.__app.copyCodeArt(0)")
    page.wait_for_timeout(300)
    toast = page.evaluate("() => document.querySelector('.saved-toast')?.textContent || document.body.innerText.match(/Copied[^.]*/)?.[0]")
    print(f"  toast after copyCodeArt(0): {toast!r}")
    print("--- console (last 10) ---")
    for m in msgs[-10:]: print(m)
    print("--- errors ---")
    for e in errs: print(e)
    browser.close()
server.shutdown()
