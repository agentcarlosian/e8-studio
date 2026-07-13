#!/usr/bin/env python3
"""Runtime smoke the two self-contained files recipients actually receive."""
from __future__ import annotations

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def check(page, path: Path, ready: str, state_expression: str) -> None:
    page_errors: list[str] = []
    console_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.goto(path.resolve().as_uri(), wait_until="commit", timeout=30_000)
    page.wait_for_function(ready, timeout=30_000)
    state = page.evaluate(state_expression)
    if not state.get("ready") or page_errors or console_errors:
        raise AssertionError(f"{path.name} failed: state={state}, page={page_errors}, console={console_errors}")
    print(f"Share artifact passed: {path.name} ({state})")


def main() -> int:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
        entry = browser.new_page(viewport={"width": 1400, "height": 900})
        entry.goto((ROOT / "index.html").resolve().as_uri(), wait_until="commit", timeout=30_000)
        entry.wait_for_url((ROOT / "dist" / "e8-studio.html").resolve().as_uri(), timeout=30_000)
        entry.wait_for_function("() => !!window.__app?.params", timeout=30_000)
        entry_state = entry.evaluate("() => ({ title: document.title, brand: document.querySelector('.brand')?.textContent.trim(), ready: !!window.__app?.params, topViewButtons: document.querySelectorAll('header .tab').length, headerHeight: document.querySelector('header')?.getBoundingClientRect().height })")
        if entry_state != {"title": "E8 Studio", "brand": "E8 Studio", "ready": True, "topViewButtons": 0, "headerHeight": 36}:
            raise AssertionError(f"Root file entry failed: {entry_state}")
        print(f"Root file entry passed: {entry_state}")
        entry.close()
        desktop = browser.new_page(viewport={"width": 1400, "height": 900})
        check(
            desktop,
            ROOT / "dist" / "e8-studio.html",
            "() => !!window.__app?.params && !!document.querySelector('canvas')",
            "() => ({ ready: !!window.__app?.params, view: window.__app?.params?.view, canvas: !!document.querySelector('canvas') })",
        )
        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        check(
            mobile,
            ROOT / "dist" / "e8-studio-mobile-v2.html",
            "() => !!window.__mobileApp && window.__mobileApp.getMetrics().renderCount > 0",
            "() => ({ ready: !!window.__mobileApp, view: window.__mobileApp?.getState().modelMode, renders: window.__mobileApp?.getMetrics().renderCount })",
        )
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
