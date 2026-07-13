import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = dirname(fileURLToPath(import.meta.url));
const WEB_OUT = resolve(ROOT, 'dist', 'web');

function canonicalDataPlugin() {
  return {
    name: 'e8-canonical-data',
    apply: 'build',
    writeBundle() {
      const destination = resolve(WEB_OUT, 'data');
      mkdirSync(destination, { recursive: true });
      cpSync(resolve(ROOT, 'data'), destination, { recursive: true });
      const mediaDestination = resolve(WEB_OUT, 'media');
      mkdirSync(mediaDestination, { recursive: true });
      cpSync(resolve(ROOT, 'assets', 'screenshots'), mediaDestination, { recursive: true });
    },
  };
}

function removeLegacyImportMapPlugin() {
  return {
    name: 'e8-remove-legacy-import-map',
    transformIndexHtml(html) {
      // Raw index.html retains the pinned CDN import map for the legacy Python
      // server and single-file builders. Vite resolves the same packages from
      // package-lock.json, so its output must not retain remote runtime imports.
      return html
        .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
        .replaceAll(' https://cdn.jsdelivr.net', '');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [removeLegacyImportMapPlugin(), canonicalDataPlugin()],
  build: {
    outDir: WEB_OUT,
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll('\\', '/');
          if (normalized.includes('/node_modules/three/')) return 'vendor-three';
          if (normalized.includes('/node_modules/chroma-js/')) return 'vendor-color';
          if (normalized.includes('/node_modules/simplex-noise/')) return 'vendor-noise';
          if (normalized.includes('/src/views/')) return 'desktop-views';
          if (normalized.includes('/src/content/')) return 'learning-content';
          return undefined;
        },
      },
    },
  },
});
