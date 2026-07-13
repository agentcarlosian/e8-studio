# Contributing to E8 Studio

Thank you for helping improve E8 Studio.

## Before opening an issue

- Search existing issues first.
- Include the affected view, browser, operating system, and reproduction steps.
- For rendering problems, include a screenshot and any visible diagnostics.
- Report security vulnerabilities privately according to [`SECURITY.md`](SECURITY.md).

## Development

```bash
npm ci
npm run dev
```

Keep changes focused. Preserve the distinction between established mathematics, interpretation, rendering technique, and app-designed visualization.

## Verification

Run the checks relevant to your change. Before a substantial pull request, run:

```bash
npm run verify
python scripts/test_math.py
npm run smoke:mobile-v2
```

New behavior should include an automated regression check where practical. Do not commit generated `dist/` output, dependency directories, local logs, signing material, or credentials.

## Pull requests

- Explain the user-visible outcome.
- Describe verification performed.
- Call out mathematical or educational claims and their sources.
- Include before/after images for meaningful visual changes.
- Keep unrelated cleanup out of the same pull request.

By contributing, you agree that your contribution is licensed under the project’s MIT License.
