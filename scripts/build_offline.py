#!/usr/bin/env python3
"""Build a fully-offline dist/index.html for the desktop (Electron) app.

The standard `build.py` inlines all local JS/CSS/data but leaves three CDN
imports in place (three.js, chroma-js, simplex-noise). That's fine for a
browser with internet, but an offline desktop app must not phone home.

This script:
  1. Runs the standard build (produces dist/index.html with CDN imports).
  2. Downloads each CDN dependency into vendor/ (cached — only fetched once).
  3. Rewrites dist/index.html to reference the vendored local files via the
     relative path, so the dist works with no network at all.

The vendored copies are ES modules stored as vendor/<pkg>.js so they're easy
to audit and update. They're committed to the repo so the offline build is
deterministic and doesn't depend on a CDN being up.

Usage:
  python scripts/build_offline.py
"""
from __future__ import annotations

import json
import math
import sys
import urllib.request
from pathlib import Path

from build import harden_csp  # re-pin CSP hashes after the offline rewrites

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor"          # source cache (committed, audit-friendly)
DIST_VENDOR = ROOT / "dist" / "vendor"  # where dist/index.html loads from
DIST_INDEX = ROOT / "dist" / "index.html"

# The exact CDN URLs the dist build writes (see scripts/build.py). Keeping them
# in sync here means an offline build produces a drop-in replacement.
CDN_DEPS = [
    # (url, local_filename)
    ("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", "three.module.js"),
    ("https://cdn.jsdelivr.net/npm/chroma-js@2.4.2/+esm", "chroma-js.js"),
    ("https://cdn.jsdelivr.net/npm/simplex-noise@4.0.3/+esm", "simplex-noise.js"),
]
# lil-gui is also a CDN import in dev (index.html importmap), but the dist build
# doesn't actually use it — the studio's ControlPanel replaces lil-gui. So we
# only need to vendor the three deps above for the dist to be fully offline.


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "e8-studio-build"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def vendor_deps() -> dict[str, Path]:
    """Download each CDN dep into vendor/ (cache) + dist/vendor/ (runtime).

    dist/index.html loads deps from ./vendor/X.js, which resolves to
    dist/vendor/X.js. We write to both locations: vendor/ is the committed
    source-of-truth; dist/vendor/ is what the built dist actually serves.
    Returns url -> dist-relative path.
    """
    VENDOR.mkdir(exist_ok=True)
    DIST_VENDOR.mkdir(exist_ok=True)
    mapping = {}
    for url, filename in CDN_DEPS:
        cache = VENDOR / filename
        if cache.exists() and cache.stat().st_size > 1000:
            print(f"  cached: {filename} ({cache.stat().st_size:,} bytes)")
        else:
            print(f"  fetching: {url}")
            data = fetch(url)
            cache.write_bytes(data)
            print(f"  wrote: {filename} ({len(data):,} bytes)")
        # Copy into dist/vendor/ so the built dist is fully self-contained.
        runtime = DIST_VENDOR / filename
        runtime.write_bytes(cache.read_bytes())
        mapping[url] = runtime
    return mapping


def rewrite_dist(mapping: dict[str, Path]) -> None:
    """Replace CDN URLs in dist/index.html with relative vendor/ paths,
    and inject the PWA manifest + service-worker registration."""
    html = DIST_INDEX.read_text(encoding="utf-8")
    changed = 0
    for url, local in mapping.items():
        # The dist build writes the CDN URLs as bare string literals in the
        # inline module script. Replace the exact URL string with a relative
        # path to the vendored copy.
        rel = "./vendor/" + local.name
        if url in html:
            html = html.replace(url, rel)
            changed += 1
    print(f"  rewrote {changed} CDN URL(s) to vendored local paths")

    # PWA: inject web app manifest link + service worker registration so the
    # offline dist is installable + works offline on mobile. These are no-ops
    # when served from file:// (Electron loadFile); they only activate under
    # http(s) — which is the PWA / Capacitor packaging context.
    manifest = '<link rel="manifest" href="./manifest.webmanifest">'
    if manifest not in html:
        html = html.replace("</head>", f"  {manifest}\n</head>", 1)
        print("  injected PWA manifest link")
    sw_register = (
        "if ('serviceWorker' in navigator) {\n"
        "  window.addEventListener('load', function () {\n"
        "    navigator.serviceWorker.register('./sw.js').catch(function(e){\n"
        "      console.warn('[pwa] SW registration failed:', e);\n"
        "    });\n"
        "  });\n"
        "}\n"
    )
    if "serviceWorker" not in html:
        html = html.replace("</body>", f"  <script>\n{sw_register}  </script>\n</body>", 1)
        print("  injected service-worker registration")

    # Re-pin the CSP: vendoring rewrote the inline module (its hash changed) and
    # we just injected an inline SW-registration script that needs its own hash.
    html = harden_csp(html)
    print("  re-hardened CSP (rehashed inline scripts)")
    # newline='\n' so the on-disk bytes match the hashed (LF) script bodies.
    DIST_INDEX.write_text(html, encoding="utf-8", newline="\n")


# PWA cache version — bump when the dist's cached asset set changes so clients
# fetch a fresh copy instead of serving a stale service-worker cache.
PWA_CACHE = "e8-studio-v1"

# Core assets the service worker precaches so the app loads with no network.
PWA_PRECACHE = [
    "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
    "./vendor/three.module.js", "./vendor/chroma-js.js", "./vendor/simplex-noise.js",
]

PWA_MANIFEST = {
    "name": "E8 ⇄ Platonics Studio",
    "short_name": "E8 Studio",
    "description": "Interactive E8 root system and Platonic-solid visualization.",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "any",
    "background_color": "#07070c",
    "theme_color": "#07070c",
    "icons": [
        {"src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
        {"src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable"},
        # Raster fallbacks (optional) — produced by scripts/gen_pwa_icons.py.
        {"src": "./icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "./icon-512.png", "sizes": "512x512", "type": "image/png"},
    ],
}

def _pwa_icon_svg() -> str:
    """A self-contained icon with a decorative 12-dot ring."""
    dots = "".join(
        f'    <circle cx="{256 + 170 * math.cos(i * math.pi / 6):.1f}" '
        f'cy="{256 + 170 * math.sin(i * math.pi / 6):.1f}" r="11"/>\n'
        for i in range(12)
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n'
        '  <rect width="512" height="512" rx="96" fill="#07070c"/>\n'
        '  <g fill="none" stroke="#f0a04b" stroke-width="3" opacity="0.5">\n'
        '    <circle cx="256" cy="256" r="170"/>\n'
        '    <circle cx="256" cy="256" r="110"/>\n'
        '  </g>\n'
        f'  <g fill="#f4d27a">\n{dots}  </g>\n'
        '  <circle cx="256" cy="256" r="16" fill="#fff"/>\n'
        '</svg>\n'
    )


def write_pwa_assets() -> None:
    """Write the manifest, service worker, and icon the dist references.

    build_offline injects <link rel=manifest> + a SW registration into the dist
    HTML, but those files have to exist or the PWA silently no-ops (manifest +
    sw.js 404, no offline cache). This generates them so `npm run pwa` produces a
    genuinely installable, offline-capable build with no extra tooling.
    """
    (ROOT / "dist").mkdir(exist_ok=True)
    (DIST_INDEX.parent / "manifest.webmanifest").write_text(
        json.dumps(PWA_MANIFEST, indent=2), encoding="utf-8")
    (DIST_INDEX.parent / "icon.svg").write_text(_pwa_icon_svg(), encoding="utf-8")

    precache = json.dumps(PWA_PRECACHE)
    sw = f"""// sw.js — generated by scripts/build_offline.py. Cache-first service worker
// for the offline E8 Studio PWA. Bump CACHE in build_offline.py to invalidate.
const CACHE = {PWA_CACHE!r};
const PRECACHE = {precache};

self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
}});

self.addEventListener('activate', (e) => {{
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
}});

self.addEventListener('fetch', (e) => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {{
      // Runtime-cache same-origin successful responses for subsequent offline loads.
      if (resp.ok && new URL(e.request.url).origin === self.location.origin) {{
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }}
      return resp;
    }}).catch(() => caches.match('./index.html')))
  );
}});
"""
    (DIST_INDEX.parent / "sw.js").write_text(sw, encoding="utf-8")
    print("  wrote manifest.webmanifest, sw.js, icon.svg")


def main() -> int:
    print("[1/4] Standard build (inlines local JS/CSS/data)...")
    import subprocess
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True)

    print("[2/4] Vendoring CDN dependencies into vendor/...")
    mapping = vendor_deps()

    print("[3/4] Rewriting dist to use vendored deps (offline)...")
    rewrite_dist(mapping)

    print("[4/4] Writing PWA assets (manifest, service worker, icon)...")
    write_pwa_assets()

    size = DIST_INDEX.stat().st_size
    print(f"\nOffline dist written: {DIST_INDEX.relative_to(ROOT)} ({size:,} chars)")
    print("The dist now references only local files — no network needed.")
    print("Launch via: npm run electron:dev")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
