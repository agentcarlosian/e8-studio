"""Regression test for bloom edge opacity decay bug.

Before fix: edgesMat.opacity only grew via Math.max, so cycling
bloomAmount 0 → 1 → 0 left edges permanently opaque.

After fix: opacity decays back to ~0 when phaseMorph is at endpoints.
"""
import sys, json, threading, time
from functools import partial
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from verify import ROOT

PORT = 8786
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    page.evaluate("() => window.__app.switchView('bloom')")
    page.wait_for_timeout(500)

    def get_edge_opacity():
        return page.evaluate("() => window.__app.currentView?.group?.children?.find(c => c.type === 'LineSegments')?.material?.opacity")

    # Cycle bloomAmount 0 → 1 → 0
    samples = []
    page.evaluate("() => window.__app.setParam('bloomAmount', 0)")
    page.evaluate("() => window.__app.setParam('bloomAuto', false)")
    page.wait_for_timeout(400)
    samples.append(('amount=0 (start)', get_edge_opacity()))

    page.evaluate("() => window.__app.setParam('bloomAmount', 0.5)")
    page.wait_for_timeout(400)
    samples.append(('amount=0.5 (mid)', get_edge_opacity()))

    page.evaluate("() => window.__app.setParam('bloomAmount', 1.0)")
    page.wait_for_timeout(400)
    samples.append(('amount=1.0 (end)', get_edge_opacity()))

    page.evaluate("() => window.__app.setParam('bloomAmount', 0)")
    page.wait_for_timeout(400)
    samples.append(('amount=0 (back to start)', get_edge_opacity()))

    print("Edge opacity across bloomAmount cycle:")
    for label, val in samples:
        print(f"  {label:30s}  opacity={val}")

    # Verify: opacity should follow the math, not be permanently high.
    # Sample 0: amount=0    → phaseMorph=0   → sourceEdgeOpacity = 0.35*1 = 0.35
    # Sample 1: amount=0.5  → phaseMorph=1   → sourceEdgeOpacity = 0, trailOpacity ≈ 0
    # Sample 2: amount=1.0  → phaseMorph=1   → same as sample 1, ≈ 0
    # Sample 3: amount=0    → should match sample 0 (= 0.35)
    start_op = samples[0][1]
    mid_op   = samples[1][1]
    peak_op  = samples[2][1]
    back_op  = samples[3][1]

    ok = True
    if start_op is None or abs(start_op - 0.35) > 0.05:
        print(f"\n❌ FAIL: amount=0 opacity = {start_op}, expected ~0.35")
        ok = False
    if mid_op is None or mid_op > 0.05:
        print(f"\n❌ FAIL: amount=0.5 opacity = {mid_op}, expected ~0 (phaseMorph=1, sin(π)=0)")
        ok = False
    if peak_op is None or peak_op > 0.05:
        print(f"\n❌ FAIL: amount=1.0 opacity = {peak_op}, expected ~0")
        ok = False
    if abs(back_op - start_op) > 0.05:
        print(f"\n❌ FAIL: cycle mismatch — start={start_op}, back={back_op}")
        ok = False
    if ok:
        print(f"\n✓ PASS: opacity correctly tracks phase (no permanent high state)")

    browser.close()
server.shutdown()
