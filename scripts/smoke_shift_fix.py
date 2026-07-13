"""Verify the shift-mode fixes (round 3, 2026-06-25).

Tests:
  1. 'random' mode is rejected (no such preset)
  2. surprise() never sets shiftMode to 'random'
  3. Default shift speed is 12 (seconds per cycle), not 1.0
  4. Panel slider label is 'Cycle' (not 'Speed') with 's' suffix
  5. Setting shiftMode to 'sunset' cycles palettes, not jumps randomly
  6. setShiftMode('rainbow') resets the cycle timer (no instant palette change
     if the page has been open for hours)
"""
import sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from verify import ROOT

PORT = 8801
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
    page.wait_for_timeout(500)

    print("=== Test 1: 'random' mode is rejected ===")
    result = page.evaluate("""() => {
      try { window.__app.setShiftMode('random'); return 'no error'; }
      catch (e) { return 'threw: ' + e.message; }
    }""")
    state = page.evaluate("() => window.__app.params.shiftMode")
    print(f"  setShiftMode('random') → {result}, params.shiftMode = {state}")
    assert state != 'random', "shiftMode should NOT be 'random'"

    print("\n=== Test 2: default shiftSpeed = 12 (seconds) ===")
    speed = page.evaluate("() => window.__app.params.shiftSpeed")
    print(f"  default shiftSpeed = {speed}")
    assert speed == 12, f"expected 12, got {speed}"

    print("\n=== Test 3: panel slider label is 'Cycle' with 's' suffix ===")
    # Slider only appears when a non-static shift mode is active.
    page.evaluate("() => window.__app.setShiftMode('sunset')")
    page.wait_for_timeout(300)
    label_check = page.evaluate("""() => {
      const rows = Array.from(document.querySelectorAll('.control-row'));
      const cycleRow = rows.find(r => r.textContent.includes('Cycle'));
      const speedRow = rows.find(r => r.textContent.includes('Speed') && r.textContent.toLowerCase().includes('shift'));
      return {
        hasCycleRow: !!cycleRow,
        cycleText: cycleRow ? cycleRow.textContent.trim() : null,
        hasLegacySpeedRow: !!speedRow,
      };
    }""")
    print(f"  hasCycleRow: {label_check['hasCycleRow']}, text: {label_check['cycleText']}")
    print(f"  legacy 'Speed' row still present: {label_check['hasLegacySpeedRow']}")
    assert label_check['hasCycleRow'], "Panel must have a 'Cycle' row when shift mode is active"
    assert 's' in (label_check['cycleText'] or ''), "Cycle label should end with 's'"

    print("\n=== Test 4: setShiftMode resets cycle timer ===")
    # Wait 2 seconds, then set sunset mode, then immediately check palette didn't change
    page.wait_for_timeout(2000)
    page.evaluate("() => window.__app.setShiftMode('sunset')")
    page.wait_for_timeout(50)  # immediately after — first palette should still be the first preset entry
    palette_after = page.evaluate("() => window.__app.params.palette")
    print(f"  palette immediately after setShiftMode('sunset') with speed=12: {palette_after}")
    # Sunset preset starts with 'ember' — should still be ember 50ms after switch (cycle is 12s)
    assert palette_after == 'ember', f"expected ember, got {palette_after}"

    print("\n=== Test 5: surprise() never picks 'random' shift mode ===")
    seen_random = False
    for i in range(10):
      page.evaluate("() => window.__app.surprise()")
      sm = page.evaluate("() => window.__app.params.shiftMode")
      if sm == 'random':
        seen_random = True
        print(f"  iter {i}: shiftMode=random  ❌")
      else:
        print(f"  iter {i}: shiftMode={sm} ✓")
    assert not seen_random, "surprise() should never pick 'random'"

    print("\n=== Test 6: shift cycle changes palette at the speed slider rate ===")
    page.evaluate("() => window.__app.setShiftMode('rainbow')")
    page.evaluate("() => window.__app.setParam('shiftSpeed', 4)")  # 4-second cycle
    palette_samples = []
    for t in range(8):
        page.wait_for_timeout(1000)  # 1 second between samples
        pal = page.evaluate("() => window.__app.params.palette")
        palette_samples.append(pal)
    print(f"  palette over 8s with cycle=4s: {palette_samples}")
    # Should see ~2 different palettes over 8s (cycle=4s → 2 full cycles)
    unique = set(palette_samples)
    assert 2 <= len(unique) <= 5, f"expected 2-5 unique palettes, got {len(unique)}: {palette_samples}"

    print("\n=== Test 7: gallery presets include new atmosphere ones ===")
    presets = page.evaluate("() => window.__app.getGalleryPresets().map(p => p.id)")
    expected_new = ['aurora-borealis', 'deep-space', 'cosmic-dawn', 'mandala-meditation', 'plasma-storm', 'tron-grid', 'milky-meditation']
    for p in expected_new:
        present = p in presets
        print(f"  {p}: {'✓' if present else '❌'}")
        assert present, f"Missing new preset: {p}"

    print("\n=== All tests passed ===")
    browser.close()
server.shutdown()
