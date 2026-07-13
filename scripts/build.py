#!/usr/bin/env python3
"""Build a single-file inlined index.html that works from file:// (no fetch needed).

Reads all the JS sources, inlines the JSON data, and produces dist/index.html.

Usage:
  python scripts/build.py
"""
import os, json, re, sys, pathlib, hashlib, base64

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist' / 'index.html'

# Files to inline (relative to project root)
HTML_FILE   = ROOT / 'index.html'
JS_FILES    = [
    # NOTE: main.js MUST come LAST. The build rewrites cross-module imports to
    # `window.__modules['X']` lookups, but main.js references several imports at
    # top-level (the VIEWS array captures the view factories; the SHIFT_PRESETS /
    # PALETTE_PRESETS / BLEND_MODES assignments read from palettes.js). Those
    # lookups resolve to `undefined` unless the exporting modules have already
    # run and registered their exports. In ESM (dev) live bindings make order
    # irrelevant; in this concatenated build, main.js must execute after every
    # module it imports from.
    ROOT / 'src' / 'state' / 'persistence.js',
    ROOT / 'src' / 'state' / 'progress.js',
    ROOT / 'src' / 'state' / 'presets.js',
    ROOT / 'src' / 'state' / 'gallery.js',
    ROOT / 'src' / 'state' / 'view-transition.js',
    ROOT / 'src' / 'state' / 'camera.js',
    ROOT / 'src' / 'platform' / 'resource-scope.js',
    ROOT / 'src' / 'platform' / 'frame-health.js',
    ROOT / 'src' / 'fx' / 'fx-shader.js',
    ROOT / 'src' / 'fx' / 'fx-runtime.js',
    ROOT / 'src' / 'fx' / 'fx-branches.js',
    ROOT / 'src' / 'fx' / 'fx-line-shader.js',
    ROOT / 'src' / 'fx' / 'bg-runtime.js',
    ROOT / 'src' / 'fx' / 'mandelbox.js',
    ROOT / 'src' / 'ui' / 'palettes.js',
    ROOT / 'src' / 'ui' / 'backgrounds.js',
    ROOT / 'src' / 'ui' / 'panel.js',
    ROOT / 'src' / 'ui' / 'theme.js',
    ROOT / 'src' / 'ui' / 'tour.js',
    ROOT / 'src' / 'content' / 'glossary.js',
    ROOT / 'src' / 'content' / 'sources.js',
    ROOT / 'src' / 'ui' / 'essays.js',
    ROOT / 'src' / 'content' / 'essays.js',
    ROOT / 'src' / 'content' / 'learning.js',
    ROOT / 'src' / 'content' / 'curriculum.js',
    ROOT / 'src' / 'state' / 'learning-service.js',
    ROOT / 'src' / 'services' / 'export-recording.js',
    ROOT / 'src' / 'math' / 'rotations.js',
    ROOT / 'src' / 'math' / 'morph.js',
    ROOT / 'src' / 'math' / 'stellations.js',
    ROOT / 'src' / 'math' / 'cartan.js',
    ROOT / 'src' / 'math' / 'weyl.js',
    ROOT / 'src' / 'math' / 'brackets.js',
    ROOT / 'src' / 'views' / 'platonic.view.js',
    ROOT / 'src' / 'views' / 'dynkin.view.js',
    ROOT / 'src' / 'views' / 'polytope4d.view.js',
    ROOT / 'src' / 'views' / 'sixhundred.view.js',
    ROOT / 'src' / 'views' / 'e8coxeter.view.js',
    ROOT / 'src' / 'views' / 'bloom.view.js',
    ROOT / 'src' / 'views' / 'raymarched-e8.view.js',
    ROOT / 'src' / 'main.js',
]

DATA_FILES = [
    ROOT / 'data' / 'e8.json',
    ROOT / 'data' / 'e8_math.json',
    ROOT / 'data' / 'platonic.json',
    ROOT / 'data' / 'polytopes4d.json',
    ROOT / 'data' / 'dynkin.json',
    ROOT / 'data' / 'mckay.json',
    ROOT / 'data' / 'mckay_subsets.json',
]

LOCAL_IMPORT_RE = re.compile(
    r"^import\s+(?:[^'\"]+?\s+from\s+)?['\"](\.{1,2}/[^'\"]+)['\"];?",
    re.M,
)

def resolve_js_import(source_file, specifier):
    """Resolve a relative JS import to an absolute Path."""
    target = (source_file.parent / specifier).resolve()
    if target.suffix:
        return target
    return target.with_suffix('.js')

def validate_js_file_list():
    """Fail fast if a source file imports a local module not in JS_FILES."""
    known = {f.resolve() for f in JS_FILES}
    missing = []
    for f in JS_FILES:
        body = f.read_text(encoding='utf-8')
        for spec in LOCAL_IMPORT_RE.findall(body):
            target = resolve_js_import(f, spec)
            if target not in known:
                missing.append((f.relative_to(ROOT), spec, target.relative_to(ROOT)))
    if missing:
        lines = ['ERROR: JS_FILES is missing local imports required for dist build:']
        for src, spec, target in missing:
            lines.append(f'  {src} imports {spec} -> {target}')
        sys.exit('\n'.join(lines))

def parse_named_imports(import_string):
    """Return (exported_name, local_name) pairs from an ESM named import list."""
    pairs = []
    for raw in import_string.split(','):
        part = raw.strip()
        if not part:
            continue
        bits = re.split(r'\s+as\s+', part, maxsplit=1)
        if len(bits) == 2:
            pairs.append((bits[0].strip(), bits[1].strip()))
        else:
            pairs.append((part, part))
    return pairs

def main():
    validate_js_file_list()
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # Read source HTML
    html = HTML_FILE.read_text(encoding='utf-8')

    # Inline ALL CSS files so the dist build is fully standalone
    for css_name in ['style.css', 'panel-extra.css', 'panel-v2.css']:
        css_file = ROOT / 'src' / 'assets' / css_name
        if css_file.exists():
            css_text = css_file.read_text(encoding='utf-8')
            html = html.replace(
                f'<link rel="stylesheet" href="src/assets/{css_name}">',
                f'<style>\n/* {css_name} */\n{css_text}\n</style>'
            )

    # Read JS modules and inline them. Each module body is wrapped in its own
    # `{ ... }` block scope so helpers like mul4 (declared inside multiple views)
    # don't collide. Cross-module references (colorAt, etc.) become window.__modules lookups.
    js_inlined = []
    for f in JS_FILES:
        body = f.read_text(encoding='utf-8')
        # Find imported names from non-CDN paths — rewrite them to window.__modules lookups.
        # CDN imports (three, chroma-js, simplex-noise) will be replaced by top-level ESM imports.
        # Skip names that are already prefixed with `window.` (those are intentional globals).
        # The tricky part: a regex \bSYMBOL\b will match the symbol inside `window.SYMBOL`.
        # To avoid that, scan for member accesses explicitly: skip if preceded by '.' or 'window.'.
        imports = re.findall(r"^import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"];?", body, re.M)
        for imp_str, _from in imports:
            for exported_name, local_name in parse_named_imports(imp_str):
                if local_name and local_name != '*':
                    # Replace whole-word occurrences that are NOT preceded by '.' or 'window.'
                    # Pattern: not preceded by '.' or 'window.' — use negative lookbehind
                    pattern = r'(?<![.\w])' + re.escape(local_name) + r'\b'
                    body = re.sub(pattern, f'window.__modules[{exported_name!r}]', body)
        # Find namespace imports: import * as FOO from '...'
        # Skip names that already start with window.
        ns_imports = re.findall(r"^import\s*\*\s*as\s+(\w+)\s*from\s*['\"]([^'\"]+)['\"];?", body, re.M)
        for sym, _from in ns_imports:
            # Replace whole-word occurrences that are NOT preceded by '.' or word chars
            pattern = r'(?<![.\w])' + re.escape(sym) + r'\b'
            body = re.sub(pattern, f'window.__modules[{sym!r}]', body)
        # Find default imports: import foo from '...'
        default_imports = re.findall(r"^import\s+(\w+)\s+from\s*['\"]([^'\"]+)['\"];?", body, re.M)
        for sym, _from in default_imports:
            # Skip if already handled by destructured/namespace patterns
            if not any(local == sym for imp_str, _ in imports for _, local in parse_named_imports(imp_str)):
                pattern = r'(?<![.\w])' + re.escape(sym) + r'\b'
                body = re.sub(pattern, f'window.__modules[{sym!r}]', body)
        # Strip all import lines (CDN ones are replaced at the top; local ones are now lookups)
        body = re.sub(r'^import .*$', '', body, flags=re.M)
        # Identify exported symbols and register them in window.__modules
        exports = re.findall(r'^export\s+(?:function|const|class|let|var)\s+([A-Za-z_$][\w$]*)', body, re.M)
        attach = '\n'.join(f'  window.__modules[{n!r}] = {n};' for n in exports)
        # Strip `export` keyword from declarations (we attach to window.__modules instead).
        # Wrapping in {} would make the exports syntactically invalid since they're inside a block.
        # Also strip aggregate `export { foo, bar }` re-exports.
        body_no_export = re.sub(r'^export\s+(?=(?:function|const|class|let|var))', '', body, flags=re.M)
        body_no_export = re.sub(r'^export\s*\{[^}]*\};?\s*$', '', body_no_export, flags=re.M)
        js_inlined.append(
            f'// ============ {f.relative_to(ROOT)} ============\n'
            f'{{\n{body_no_export}\n{attach}\n}}'
        )
    js_blob = '\n\n'.join(js_inlined)

    # Inline JSON data as a single global INLINE_DATA object
    # Use `window.INLINE_DATA = ...` explicitly so it's available globally.
    # (var/const inside <script type="module"> are module-scoped, not window-scoped)
    data_blob = 'window.INLINE_DATA = {\n'
    for i, f in enumerate(DATA_FILES):
        d = json.loads(f.read_text(encoding='utf-8'))
        key = f.stem
        comma = ',' if i < len(DATA_FILES) - 1 else ''
        data_blob += f'  {key!r}: {json.dumps(d)}{comma}\n'
    data_blob += '};\n'

    # Replace the module script tag (which currently has src="src/main.js") with our
    # single inline script that contains all data + all modules concatenated.
    pattern = re.compile(r'<script type="module" src="src/main\.js"></script>')
    m = pattern.search(html)
    if not m:
        # Fallback: any module script with no src
        pattern = re.compile(r'<script type="module">\s*</script>')
        m = pattern.search(html)
        if not m:
            sys.exit('ERROR: Could not find module script tag in index.html')
    new_script = (
        '<script type="module">\n'
        'import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";\n'
        'import chroma from "https://cdn.jsdelivr.net/npm/chroma-js@2.4.2/+esm";\n'
        'import * as simplexNoise from "https://cdn.jsdelivr.net/npm/simplex-noise@4.0.3/+esm";\n'
        'window.__modules = window.__modules || {};\n'
        'window.__modules.THREE = THREE;\n'
        'window.__modules.chroma = chroma;\n'
        'window.__modules.simplexNoise = simplexNoise;\n'
        '\n' + data_blob + '\n' + js_blob + '\n</script>'
    )
    new_html = html[:m.start()] + new_script + html[m.end():]

    guard_against_mangled_methods(new_html)
    new_html = harden_csp(new_html)

    # newline='\n' is REQUIRED: harden_csp hashes the in-memory (LF) script
    # bodies, but Windows would otherwise write CRLF, so the browser would hash
    # different bytes and the CSP would block every inline script.
    OUT.write_text(new_html, encoding='utf-8', newline='\n')
    print(f'Wrote {OUT.relative_to(ROOT)} ({len(new_html):,} chars)')


# ── CSP: hash every inline <script> so script-src can drop 'unsafe-inline' ──
# The dist embeds inline scripts (importmap, error handler, the concatenated
# module). Rather than allow ALL inline scripts ('unsafe-inline', which defeats
# CSP's XSS protection), we pin each by its SHA-256 hash. build_offline.py calls
# harden_csp() again after its rewrites (the module hash changes when CDN URLs
# are vendored, and it injects a SW-registration script).
INLINE_SCRIPT_RE = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.S)
_HTML_COMMENT_RE = re.compile(r'<!--.*?-->', re.S)

def csp_script_hashes(html):
    """Return a CSP source token (`'sha256-…'`) for every inline <script>.

    A real <script> opening tag inside an HTML comment (e.g. the explanatory
    comment above the CSP meta mentions `<script>`) must be skipped — the browser
    doesn't execute it. We hash the FULL script body though; we deliberately do
    NOT strip comments from the source, because the inlined JS contains literal
    `<!-- … -->` sequences (in essay/template text) that are part of a script's
    real content and would change its hash if removed."""
    comment_spans = [(m.start(), m.end()) for m in _HTML_COMMENT_RE.finditer(html)]
    in_comment = lambda pos: any(s <= pos < e for s, e in comment_spans)
    tokens = []
    for m in INLINE_SCRIPT_RE.finditer(html):
        if in_comment(m.start()):
            continue
        digest = hashlib.sha256(m.group(1).encode('utf-8')).digest()
        tokens.append("'sha256-" + base64.b64encode(digest).decode('ascii') + "'")
    return tokens

CSP_META_RE = re.compile(
    r'(<meta http-equiv="Content-Security-Policy" content=")(.*?)(">)', re.S)

def harden_csp(html):
    """Rewrite the CSP's script-src to 'self' + per-inline-script hashes + the
    pinned CDN + file: (for the offline/Electron dist), with NO 'unsafe-inline'.

    Scoped to the CSP <meta> element's content so it can't accidentally match
    the word "script-src" elsewhere (e.g. in the explanatory comment above it)."""
    hashes = ' '.join(csp_script_hashes(html))
    src = f"script-src 'self' {hashes} https://cdn.jsdelivr.net file:;"

    def fix(m):
        content, k = re.subn(r"script-src[^;]*;", src, m.group(2), count=1)
        if k == 0:
            print('  WARNING: no script-src directive inside CSP meta')
        return m.group(1) + content + m.group(3)

    new_html, n = CSP_META_RE.subn(fix, html, count=1)
    if n == 0:
        print('  WARNING: no CSP meta found to harden')
    return new_html


# The import-rewrite replaces bare identifiers with window.__modules['X'] lookups
# by regex. Its known footgun: if a class/object METHOD is named the same as an
# imported symbol, the method definition gets mangled into
# `window.__modules['name'](…) { … }`, which is invalid JS and breaks the whole
# dist (the build itself stays silent — the error only surfaces at load time).
# This guard fails the build loudly instead, naming the colliding symbol.
MANGLED_METHOD_RE = re.compile(r"window\.__modules\[(['\"])([\w$]+)\1\]\s*\([^()]*\)\s*\{")
# Comments may legitimately contain the mangled form as documentation (main.js
# explains this very footgun), so strip comments before scanning. We can't strip
# string literals — the detector relies on the ['name'] index, which is itself a
# string — but a mangled method definition never lives inside a string.
_COMMENTS_RE = re.compile(r"/\*[\s\S]*?\*/|//[^\n]*")

def guard_against_mangled_methods(html):
    scannable = _COMMENTS_RE.sub(' ', html)
    hits = sorted({m.group(2) for m in MANGLED_METHOD_RE.finditer(scannable)})
    if hits:
        sys.exit(
            'ERROR: build.py import-rewrite mangled a method definition.\n'
            f'  Colliding symbol(s): {", ".join(hits)}\n'
            '  A method shares a name with an imported symbol, so it was rewritten\n'
            "  to `window.__modules['name'](…) { … }` (invalid JS). Rename the\n"
            '  method so it no longer collides with the import, then rebuild.'
        )

if __name__ == '__main__':
    main()
