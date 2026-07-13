"""Test the dist file:// version works."""
import time
from playwright.sync_api import sync_playwright

chrome_path = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome_path, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1400, 'height': 900})

    page_errors = []
    console_logs = []
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('console', lambda m: console_logs.append(f'[{m.type}] {m.text[:300]}'))

    # Use file:// URL
    url = 'file:///C:/Users/Ian/e8_studio/dist/index.html'
    page.goto(url, timeout=20000, wait_until='commit')
    time.sleep(8)
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    time.sleep(1)
    page.screenshot(path=r'C:\Users\Ian\e8_studio\smoke_shots\file_url_test.png')

    state = page.evaluate("""() => ({
        appExists: !!window.__app,
        canvasOk: !!document.querySelector('canvas'),
        view: window.__app?.params?.view,
    })""")
    print(f'State: {state}')
    print(f'Errors: {len(page_errors)}')
    for e in page_errors[:5]: print(f'  PAGEERR: {e[:200]}')
    print(f'Console: {len(console_logs)}')
    for c in console_logs[:10]: print(f'  {c}')
    browser.close()
    console_errors = [c for c in console_logs if c.startswith('[error]')]
    if page_errors or console_errors:
        raise SystemExit(1)
