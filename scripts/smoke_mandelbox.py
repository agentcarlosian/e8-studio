"""Smoke-test: switch to Bloom, toggle mandelbox, vary scale/iter/mix."""
import sys, json, threading, time
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from verify import ROOT

PORT = 8783
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
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
    print("READY")
    page.evaluate("() => window.__app.switchView('bloom')")
    page.evaluate("() => window.__app.setParam('bloomAmount', 0.9)")
    page.evaluate("() => window.__app.setParam('bloomAuto', false)")
    page.wait_for_timeout(1500)
    info = page.evaluate("""() => ({
      view: window.__app.currentView?.name,
      bloomAmount: window.__app.params.bloomAmount,
      matCount: window.__app.currentView?.group?.userData?.materials?.length || 0,
      uEnable: window.__app.currentView?.group?.userData?.materials?.[0]?.uniforms?.uMandelboxEnable?.value,
      uScale:  window.__app.currentView?.group?.userData?.materials?.[0]?.uniforms?.uMandelboxScale?.value,
    })""")
    print(f"  initial: view={info['view']} bloom={info['bloomAmount']} matCount={info['matCount']} uEnable={info['uEnable']} uScale={info['uScale']}")
    print("--- mandelbox toggles ---")
    page.evaluate("() => window.__app.setParam('bloomMandelbox', true)")
    page.wait_for_timeout(500)
    post = page.evaluate("""() => ({
      uEnable: window.__app.currentView?.group?.userData?.materials?.[0]?.uniforms?.uMandelboxEnable?.value,
      uScale:  window.__app.currentView?.group?.userData?.materials?.[0]?.uniforms?.uMandelboxScale?.value,
      uIters:  window.__app.currentView?.group?.userData?.materials?.[0]?.uniforms?.uMandelboxIters?.value,
      uMix:    window.__app.currentView?.group?.userData?.materials?.[0]?.uniforms?.uMandelboxMix?.value,
    })""")
    print(f"  after toggle ON: uEnable={post['uEnable']} uScale={post['uScale']} uIters={post['uIters']} uMix={post['uMix']}")
    states = [
        ("off",        {}),
        ("on@def",     {"bloomMandelbox": True}),
        ("on@sc=1.8",  {"bloomMandelboxScale": 1.8, "bloomMandelboxIters": 8}),
        ("on@sc=3.2",  {"bloomMandelboxScale": 3.2, "bloomMandelboxIters": 4}),
        ("on@mix=1.0", {"bloomMandelboxMix": 1.0}),
        ("on@mix=0.0", {"bloomMandelboxMix": 0.0}),
        ("off",        {"bloomMandelbox": False}),
    ]
    for label, overrides in states:
        for k, v in overrides.items():
            page.evaluate(f"() => window.__app.setParam('{k}', {str(v).lower() if isinstance(v, bool) else v})")
        page.wait_for_timeout(500)
        cur = page.evaluate("() => ({ on: window.__app.params.bloomMandelbox, sc: window.__app.params.bloomMandelboxScale, it: window.__app.params.bloomMandelboxIters, mx: window.__app.params.bloomMandelboxMix })")
        png = page.evaluate("() => document.getElementById('canvas').toDataURL('image/png').length")
        print(f"  {label:14s}  on={cur['on']} sc={cur['sc']:.2f} it={cur['it']} mx={cur['mx']:.2f}  png_bytes={png}")
    print("--- console (last 10) ---")
    for m in msgs[-10:]: print(m)
    print("--- errors ---")
    for e in errs: print(e)
    browser.close()
server.shutdown()
