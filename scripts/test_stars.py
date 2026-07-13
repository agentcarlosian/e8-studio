"""Test showStarfield in isolation."""
import time
from playwright.sync_api import sync_playwright

chrome_path = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome_path, args=['--no-sandbox', '--disable-gpu'])
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page_errors = []
    page.on('pageerror', lambda e: page_errors.append(str(e)))

    page.goto('http://127.0.0.1:8771/index.html', timeout=20000, wait_until='commit')
    time.sleep(6)
    print(f'After wait: {len(page_errors)} errors')

    page.evaluate("window.__app.params.showStarfield = true")
    time.sleep(3)
    print(f'After showStarfield: {len(page_errors)} errors')
    if page_errors: print(f'  first: {page_errors[0][:200]}')

    browser.close()
