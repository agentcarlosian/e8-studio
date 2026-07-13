#!/usr/bin/env python3
"""Phone-viewport launch and local-growth smoke checks.

This stays local/offline: no analytics, no network services, no social APIs.
It loads the desktop Studio in a phone-sized viewport and verifies it can boot,
recover, and persist learning/reward state. (The dedicated Mobile V2 Canvas-2D
shell — src/mobile/ — is exercised by smoke_mobile_v2.py; this test covers the
desktop responsive path on a phone-sized screen.)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from verify import start_server, find_chromium_executable  # noqa: E402


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{(' -- ' + detail) if detail and not ok else ''}")
    if not ok:
        raise AssertionError(f"{name}: {detail}")


def main() -> int:
    print("Building dist...")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True,
                   stdout=subprocess.DEVNULL)

    from playwright.sync_api import sync_playwright
    httpd, base = start_server()
    exe = find_chromium_executable()
    try:
        with sync_playwright() as p:
            launch = {
                "headless": True,
                "args": ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
                         "--enable-unsafe-swiftshader"],
            }
            if exe:
                launch["executable_path"] = exe
            browser = p.chromium.launch(**launch)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
                device_scale_factor=3,
            )
            page = context.new_page()
            console_errs: list[str] = []
            page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errs.append(str(e)))
            page.goto(f"{base}/dist/index.html", wait_until="commit", timeout=20000)
            page.wait_for_function(
                "() => !!(window.__app && window.__app.startupMetrics && window.__app.startupMetrics.firstFrameMs !== null)",
                timeout=20000,
            )

            params = page.evaluate("() => window.__app.params")
            metrics = page.evaluate("() => window.__app.startupMetrics")
            check("phone launch defaults to E8 Coxeter", params["view"] == "e8coxeter", str(params.get("view")))
            check("phone launch disables heavy FX", params["fxMode"] == "none", str(params.get("fxMode")))
            check("phone launch avoids heavy SDF first", metrics["firstView"] != "raymarched", str(metrics))
            check("first frame metric recorded", 0 <= metrics["firstFrameMs"] < 5000, str(metrics))

            # Desktop control panel renders its sections (the responsive path
            # keeps the sidebar reachable on phone-width screens). The old
            # mobile-v1 bottom rail / Explore / Learn tab buttons no longer
            # exist — Mobile V2 (src/mobile/) has its own Canvas-2D shell.
            panel_state = page.evaluate("""() => {
              const panel = document.getElementById('panel');
              const body = document.getElementById('ps-body');
              const learn = body?.querySelector('[data-section="learn"]');
              return {
                panelPresent: !!panel,
                bodyPresent: !!body,
                learnSectionPresent: !!learn,
              };
            }""")
            check("control panel present", panel_state["panelPresent"], str(panel_state))
            check("learn section rendered", panel_state["learnSectionPresent"], str(panel_state))

            page.evaluate("() => window.__app.showRenderFallbackForTest()")
            check("fallback poster can show", page.locator("#render-fallback:not(.hidden)").count() == 1)
            page.evaluate("() => window.__app.enableReducedMode()")
            reduced = page.evaluate("() => ({ reduced: window.__app.params.reducedMode, quality: window.__app.params.mobileQuality })")
            check("reduced mode persists in params", reduced == {"reduced": True, "quality": "low"}, str(reduced))

            quiz = page.evaluate("() => window.__app.completeQuiz('platonic-foundations', 3, 3)")
            progress = page.evaluate("() => window.__app.progress")
            check("quiz pass records progress", bool(progress["quiz"]["platonic-foundations"]["passedAt"]), str(quiz))
            check("quiz unlocks cosmetic background", "coxeter-night" in progress["unlocked"]["backgrounds"], str(progress["unlocked"]))

            page.evaluate("() => window.__app.claimDailyFact()")
            daily = page.evaluate("() => window.__app.progress.daily")
            check("daily fact records local date", bool(daily["lastCompletedDate"]) and daily["streak"] >= 1, str(daily))

            postcard = page.evaluate("() => window.__app.getPostcardPreviewInfo()")
            check("postcard preview is 9:16", postcard == {"width": 1080, "height": 1920}, str(postcard))
            check("no console errors during phone smoke", len(console_errs) == 0, str(console_errs[:2]))
            browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    print("\nPhone-first launch smoke passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
