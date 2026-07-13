import sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from verify import ROOT

PORT = 8803
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
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text[:300]}"))
    page.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
    page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    page.wait_for_timeout(800)

    page.evaluate("() => window.__app.setShiftMode('rainbow')")
    page.wait_for_timeout(500)

    cycle_html = page.evaluate("""() => {
      const rows = Array.from(document.querySelectorAll('.control-row'));
      const cycleRow = rows.find(r => r.textContent.includes('Cycle'));
      return cycleRow ? cycleRow.outerHTML : null;
    }""")
    print('Cycle row HTML:')
    print(cycle_html[:2000] if cycle_html else 'NOT FOUND')
    print()

    for val in [3, 12, 30, 60, 90, 120]:
        page.evaluate(f"""() => {{
          const slider = document.querySelector('#slider-val-shiftSpeed')?.parentElement?.querySelector('input[type=range]');
          if (slider) {{
            slider.value = {val};
            slider.dispatchEvent(new Event('input', {{ bubbles: true }}));
          }}
        }}""")
        page.wait_for_timeout(200)
        displayed = page.evaluate("() => document.getElementById('slider-val-shiftSpeed')?.textContent")
        params_val = page.evaluate("() => window.__app.params.shiftSpeed")
        print(f"  drag → {val:3d}  params.shiftSpeed={params_val}  displayed={displayed!r}")

    print()
    print('--- errors ---')
    for e in errs: print(e[:200])
    for m in msgs:
        if m.startswith('[error]'):
            print(f'  {m[:200]}')
    browser.close()
server.shutdown()
