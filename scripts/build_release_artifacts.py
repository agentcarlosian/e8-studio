#!/usr/bin/env python3
"""Build and authenticate the distributable E8 Studio release artifacts."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def run(*args: str) -> None:
    print("$ " + " ".join(args))
    subprocess.run(args, cwd=ROOT, check=True)


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> int:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    version = package["version"]
    revision = git("rev-parse", "HEAD")
    commit_epoch = int(git("show", "-s", "--format=%ct", "HEAD"))
    built_at = datetime.fromtimestamp(commit_epoch, tz=timezone.utc).isoformat().replace("+00:00", "Z")

    run(sys.executable, "scripts/build_offline.py")
    run(sys.executable, "scripts/build_singlefile.py")
    run(sys.executable, "scripts/build_mobile_singlefile.py")

    artifacts = [
        DIST / "e8-studio.html",
        DIST / "e8-studio-mobile-v2.html",
        DIST / "index.html",
        DIST / "manifest.webmanifest",
        DIST / "sw.js",
    ]
    for path in artifacts:
        if not path.is_file() or path.stat().st_size == 0:
            raise SystemExit(f"Missing release artifact: {path.relative_to(ROOT)}")

    records = [
        {"path": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size, "sha256": digest(path)}
        for path in artifacts
    ]
    manifest = {"schemaVersion": 1, "product": package.get("name"), "version": version, "revision": revision,
                "builtAt": built_at, "artifacts": records}
    manifest_path = DIST / "release-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")

    zip_path = DIST / f"e8-studio-{version}-share.zip"
    zip_time = datetime.fromtimestamp(max(commit_epoch, 315532800), tz=timezone.utc)
    zip_stamp = (zip_time.year, zip_time.month, zip_time.day, zip_time.hour, zip_time.minute, zip_time.second)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in [DIST / "e8-studio.html", DIST / "e8-studio-mobile-v2.html", manifest_path]:
            info = zipfile.ZipInfo(path.name, date_time=zip_stamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(f"Release manifest: {manifest_path.relative_to(ROOT)}")
    print(f"Share bundle: {zip_path.relative_to(ROOT)} ({zip_path.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
