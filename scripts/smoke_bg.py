"""Smoke-test: load dist, cycle every bgMode, take a screenshot of each."""
import sys, json, threading, time
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from verify import ROOT

PORT = 8781
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
t = threading.Thread(target=server.serve_forever, daemon=True)
t.start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome_path = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'
BG_MODES = ['void', 'starfield', 'grid', 'aurora',
            'cosmos', 'mandala', 'plasma',
            'vortex', 'quantum', 'eclipse', 'synthwave', 'prism']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome_path, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    msgs = []
    errs = []
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:300]}"))
    page.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function(
        "() => !!(window.__app && window.__app.params && window.__app.currentView)",
        timeout=15000,
    )
    print("READY")
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    page.wait_for_timeout(500)
    for mode in BG_MODES:
        page.evaluate(f"() => window.__app.setBgMode('{mode}')")
        page.wait_for_timeout(800)
        cur = page.evaluate("() => window.__app.params.bgMode")
        canvas_len = page.evaluate("() => document.getElementById('canvas').toDataURL('image/png').length")
        print(f"  {mode:10s}  → params.bgMode={cur}  canvas_png_bytes={canvas_len}")
    print("--- console msgs (last 20) ---")
    for m in msgs[-20:]:
        print(m)
    print("--- page errors ---")
    for e in errs:
        print(e)
    browser.close()
server.shutdown()
