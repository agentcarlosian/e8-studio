#!/usr/bin/env python3
"""Check that a built debug APK contains exactly the staged Studio web app."""
from __future__ import annotations

import argparse
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_PREFIX = "assets/public/"
ALLOWED_PUBLIC = {"index.html", "cordova.js", "cordova_plugins.js"}


def check_apk(apk: Path, staged: Path, synced: Path) -> None:
    if not apk.is_file():
        raise AssertionError(f"APK is missing: {apk}")
    staged_html = staged.read_bytes()
    if len(staged_html) < 100_000:
        raise AssertionError("staged Android HTML is unexpectedly small")
    if synced.read_bytes() != staged_html:
        raise AssertionError("Capacitor synced HTML differs from the staged build")

    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise AssertionError("APK contains duplicate ZIP entries")
        if archive.testzip() is not None:
            raise AssertionError("APK contains a corrupt ZIP entry")
        for required in ("AndroidManifest.xml", "resources.arsc"):
            if required not in names:
                raise AssertionError(f"APK is missing {required}")
        if not any(name.startswith("classes") and name.endswith(".dex") for name in names):
            raise AssertionError("APK is missing compiled Android classes")
        public = {name[len(PUBLIC_PREFIX):] for name in names if name.startswith(PUBLIC_PREFIX) and not name.endswith("/")}
        unexpected = public - ALLOWED_PUBLIC
        if "index.html" not in public:
            raise AssertionError("APK is missing assets/public/index.html")
        if unexpected:
            raise AssertionError(f"APK has unexpected public assets: {sorted(unexpected)}")
        if archive.read(PUBLIC_PREFIX + "index.html") != staged_html:
            raise AssertionError("APK embedded HTML differs from the staged build")
    print(f"APK inventory and staged HTML match: {apk}")


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="e8-apk-inventory-") as temporary:
        root = Path(temporary)
        html = b"<html>" + b"x" * 100_000 + b"</html>"
        staged = root / "staged.html"
        synced = root / "synced.html"
        apk = root / "app-debug.apk"
        staged.write_bytes(html)
        synced.write_bytes(html)

        def write_apk(*, embedded: bytes = html, extra: str | None = None) -> None:
            with zipfile.ZipFile(apk, "w") as archive:
                archive.writestr("AndroidManifest.xml", b"manifest")
                archive.writestr("resources.arsc", b"resources")
                archive.writestr("classes.dex", b"dex")
                archive.writestr(PUBLIC_PREFIX + "index.html", embedded)
                archive.writestr(PUBLIC_PREFIX + "cordova.js", b"")
                archive.writestr(PUBLIC_PREFIX + "cordova_plugins.js", b"")
                if extra:
                    archive.writestr(PUBLIC_PREFIX + extra, b"leak")

        write_apk()
        check_apk(apk, staged, synced)
        for variant in ("mismatched", "leaked"):
            write_apk(embedded=b"wrong" if variant == "mismatched" else html,
                      extra="release-manifest.json" if variant == "leaked" else None)
            try:
                check_apk(apk, staged, synced)
            except AssertionError:
                continue
            raise AssertionError(f"self-test did not reject {variant} APK")
    print("APK inventory self-test passed: mismatch and leaked asset rejected")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true", help="test the verifier with synthetic APKs")
    parser.add_argument("--apk", type=Path, default=ROOT / "android/app/build/outputs/apk/debug/app-debug.apk")
    parser.add_argument("--staged", type=Path, default=ROOT / "dist/mobile/index.html")
    parser.add_argument("--synced", type=Path, default=ROOT / "android/app/src/main/assets/public/index.html")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    else:
        check_apk(args.apk, args.staged, args.synced)


if __name__ == "__main__":
    main()
