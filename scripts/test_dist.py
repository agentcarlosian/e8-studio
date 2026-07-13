"""Test the dist via http (not file://)."""
import time
from playwright.sync_api import sync_playwright

chrome_path = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome_path, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page_errors = []
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.goto('http://127.0.0.1:8771/dist/index.html', timeout=20000, wait_until='commit')
    time.sleep(8)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    time.sleep(0.5)
    page.screenshot(path=r'C:\Users\Ian\e8_studio\smoke_shots\dist_via_http.png')
    state = page.evaluate("""() => ({
        appExists: !!window.__app,
        view: window.__app?.params?.view,
    })""")
    print(f'Dist via http: {state}, errors: {len(page_errors)}')
    for e in page_errors[:5]: print(f'  {e[:200]}')
    browser.close()
    if page_errors:
        raise SystemExit(1)
