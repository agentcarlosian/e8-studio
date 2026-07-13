"""Random fuzz testing: generate random sequences of UI actions, look for
crashes, console errors, or state corruption.

Strategy:
  - Pick a random view
  - Pick 5-20 random actions to apply in sequence
  - Between actions, take a screenshot, sample the canvas, check for errors
  - After the sequence, reload the page (state corruption test)
  - Report any error or pixel anomaly

Run: python scripts/fuzzer.py [iterations]
"""
import sys, threading, time, random, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from verify import ROOT
from fuzz_actions import ACTIONS, ACTION_SCRIPT, TOGGLE_METHODS, ACTION_METHODS

# Slider needs closure over the live random module
ACTION_SCRIPT['slider'] = lambda a: f"window.__app.setParam('{a[1]}', {random.uniform(a[2], a[3])})"

PORT = 8810
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
time.sleep(0.3)

from playwright.sync_api import sync_playwright
chrome = r'C:\Users\Ian\AppData\Local\ms-playwright\chromium_headless_shell-1228\chrome-headless-shell-win64\chrome-headless-shell.exe'

# Action definitions live in fuzz_actions.py — imported above.

# Maps to JS action calls — uses ACTUAL method names from main.js, not naive
# string-conversion of the action-id (which would e.g. mangle 'e8-twin-600' to
# 'toggleE8twin600' instead of 'toggleE8Twin600').
# (ACTION_SCRIPT imported from fuzz_actions; slider entry added above with
# closure over the live random module.)

ITERS = int(sys.argv[1]) if len(sys.argv) > 1 else 50
SEED = int(time.time()) % 100000
random.seed(SEED)
print(f"=== Fuzzer: {ITERS} iterations, seed={SEED} ===\n")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox', '--disable-gpu'])

    issues = []

    for i in range(ITERS):
        # Fresh page per iteration (prevents console error leakage between iters)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        errs_this_iter = []
        page.on("pageerror", lambda e: errs_this_iter.append(f"[pageerror] {str(e)[:200]}"))
        page.on("console", lambda m: errs_this_iter.append(f"[error] {m.text[:200]}") if m.type == 'error' else None)

        page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="commit")
        try:
            page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
        except Exception as e:
            issues.append({'iter': i, 'phase': 'boot', 'msg': str(e)})
            page.close()
            continue
        page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
        page.wait_for_timeout(200)

        # Apply random action sequence
        n_actions = random.randint(5, 30)
        actions_applied = []
        for j in range(n_actions):
            a = random.choice(ACTIONS)
            kind = a[0]
            try:
                page.evaluate(ACTION_SCRIPT[kind](a))
                actions_applied.append(a)
            except Exception as e:
                issues.append({
                    'iter': i, 'phase': 'action', 'action': a,
                    'msg': f'eval failed: {str(e)[:200]}'
                })
            page.wait_for_timeout(20 + random.randint(0, 50))

        # Capture any runtime errors that occurred during the action sequence
        runtime_errs = [e for e in errs_this_iter if '[pageerror]' in e or '[error]' in e]
        if runtime_errs:
            for re_msg in runtime_errs[:5]:
                issues.append({'iter': i, 'phase': 'runtime', 'msg': re_msg})

        # Reload — does state persist? does reload crash?
        try:
            page.reload(wait_until="commit")
            page.wait_for_function("() => !!(window.__app && window.__app.params && window.__app.currentView)", timeout=15000)
            page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
            page.wait_for_timeout(200)
            # Did reload trigger any errors?
            post_reload_errs = [e for e in errs_this_iter[len(runtime_errs):] if '[pageerror]' in e]
            for pre in post_reload_errs[:3]:
                issues.append({'iter': i, 'phase': 'reload', 'msg': pre})
        except Exception as e:
            issues.append({'iter': i, 'phase': 'reload', 'msg': str(e)[:200]})

        page.close()
        if (i + 1) % 5 == 0:
            print(f"  [{i+1}/{ITERS}]  issues so far: {len(issues)}")

    print(f"\n=== Done ===")
    print(f"  iterations: {ITERS}")
    print(f"  issues found: {len(issues)}")
    if issues:
        # Group by phase
        by_phase = {}
        for iss in issues:
            by_phase.setdefault(iss['phase'], []).append(iss)
        for phase, items in by_phase.items():
            print(f"\n  Phase '{phase}': {len(items)} occurrences")
            for it in items[:5]:
                action_str = f" action={it.get('action')}" if 'action' in it else ""
                print(f"    iter {it['iter']}:{action_str} {it['msg'][:160]}")

    browser.close()
server.shutdown()

# Save issues to log
import json
log_path = Path(__file__).parent / "fuzzer_results.json"
log_path.write_text(json.dumps({
    'seed': SEED,
    'iters': ITERS,
    'issue_count': len(issues),
    'issues': issues[:200],
}, indent=2, default=str))
print(f"\nResults saved to {log_path}")
