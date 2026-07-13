"""Smoke-test: cycle every theme + layout, verify the page survives."""
import sys, json, threading, time
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from verify import ROOT

PORT = 8782
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'
THEMES = ['dark-gold', 'paper-ink', 'neon-cyber', 'pure-dark', 'solarized']
LAYOUTS = ['default', 'compact', 'wide-canvas', 'presentation']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    msgs, errs = [], []
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:200]}"))
    page.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    print("READY")
    print("--- themes ---")
    for t in THEMES:
        page.evaluate(f"() => window.__app.setTheme('{t}')")
        page.wait_for_timeout(300)
        cur = page.evaluate("() => window.__app.params.theme")
        attr = page.evaluate("() => document.documentElement.getAttribute('data-theme')")
        bg = page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--bg-0').trim()")
        print(f"  {t:12s}  theme={cur}  data-theme={attr}  --bg-0={bg}")
    print("--- layouts ---")
    for l in LAYOUTS:
        page.evaluate(f"() => window.__app.setLayout('{l}')")
        page.wait_for_timeout(300)
        cur = page.evaluate("() => window.__app.params.layout")
        attr = page.evaluate("() => document.body.getAttribute('data-layout')")
        headerVisible = page.evaluate("() => getComputedStyle(document.querySelector('header')).display !== 'none'")
        footerVisible = page.evaluate("() => getComputedStyle(document.querySelector('footer')).display !== 'none'")
        panelVisible = page.evaluate("() => getComputedStyle(document.querySelector('#panel')).display !== 'none'")
        print(f"  {l:14s}  layout={cur}  data-layout={attr}  hdr={headerVisible} ftr={footerVisible} panel={panelVisible}")
    print("--- errors ---")
    for e in errs: print(e)
    print("--- console (last 10) ---")
    for m in msgs[-10:]: print(m)
    browser.close()
server.shutdown()
