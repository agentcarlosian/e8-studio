#!/usr/bin/env python3
"""Build isolated Vite desktop outputs for release parity testing."""
from pathlib import Path

from build_desktop_inline import write_offline_html, write_share_html
from build_offline import write_pwa_assets

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "desktop-candidate"
PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"]


def main() -> None:
    write_share_html(OUT / "e8-studio.html")
    write_offline_html(OUT / "index.html")
    write_pwa_assets(OUT, precache=PRECACHE)
    print(f"Vite candidate: {(OUT / 'e8-studio.html').stat().st_size:,} byte share file, "
          f"{(OUT / 'index.html').stat().st_size:,} byte offline/PWA/Electron HTML")


if __name__ == "__main__":
    main()
