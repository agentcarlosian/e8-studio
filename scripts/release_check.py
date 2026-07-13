#!/usr/bin/env python3
"""Release checklist automation for E8 Platonics Studio."""
from __future__ import annotations

import json
import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def fail(message: str) -> None:
    raise AssertionError(message)


def run(cmd: list[str]) -> None:
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def check_package_scripts() -> None:
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    scripts = pkg.get("scripts", {})
    expected = {
        "build": "python scripts/build.py",
        "build:web": "vite build",
        "verify": "python scripts/verify.py",
        "serve": "python -m http.server 8771",
        "release:check": "python scripts/release_check.py",
        "release:artifacts": "python scripts/build_release_artifacts.py",
    }
    for name, command in expected.items():
        if scripts.get(name) != command:
            fail(f"package.json script {name!r} must be {command!r}")


def check_docs_contract() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8", errors="ignore").lower()
    for needle in ["python scripts/verify.py", "six interactive views"]:
        if needle not in readme:
            fail(f"README.md is missing {needle!r}")


def check_verify_artifacts() -> None:
    summary = ROOT / "dist" / "verify" / "summary.json"
    report = ROOT / "dist" / "verify" / "summary.html"
    if not summary.exists() or not report.exists():
        fail("verification summary artifacts were not generated")
    payload = json.loads(summary.read_text(encoding="utf-8"))
    if not payload.get("ok"):
        fail("verification summary reports failure")


def check_release_artifacts() -> None:
    manifest_path = ROOT / "dist" / "release-manifest.json"
    if not manifest_path.is_file():
        fail("release manifest was not generated")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if manifest.get("schemaVersion") != 1 or manifest.get("version") != package.get("version") or manifest.get("revision") != revision:
        fail("release manifest does not identify the current version and revision")
    required = {"dist/e8-studio.html", "dist/e8-studio-mobile-v2.html", "dist/index.html", "dist/manifest.webmanifest", "dist/sw.js"}
    records = {record.get("path"): record for record in manifest.get("artifacts", [])}
    if set(records) != required:
        fail(f"release manifest artifact set differs: {set(records) ^ required}")
    for name, record in records.items():
        path = ROOT / name
        if not path.is_file() or path.stat().st_size != record.get("bytes"):
            fail(f"release artifact size mismatch: {name}")
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != record.get("sha256"):
            fail(f"release artifact checksum mismatch: {name}")
    bundle = ROOT / "dist" / f"e8-studio-{package['version']}-share.zip"
    if not bundle.is_file() or bundle.stat().st_size < 100_000:
        fail("versioned share bundle was not generated")


def check_worktree_clean() -> None:
    result = subprocess.run(
        ["git", "status", "--short"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if result.stdout.strip():
        changed = len(result.stdout.splitlines())
        fail(f"working tree is not clean ({changed} changed or untracked paths)")


def main() -> int:
    try:
        check_worktree_clean()
        check_package_scripts()
        check_docs_contract()
        run([sys.executable, "scripts/verify.py"])
        check_verify_artifacts()
        run([sys.executable, "scripts/build_release_artifacts.py"])
        check_release_artifacts()
        run([sys.executable, "scripts/test_share_artifacts.py"])
        check_worktree_clean()
    except (AssertionError, subprocess.CalledProcessError) as exc:
        print(f"RELEASE CHECK FAILED: {exc}", file=sys.stderr)
        return 1
    print("Release checklist passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
