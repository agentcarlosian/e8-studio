/** Compile the desktop ESM graph into one script for file:// HTML builds. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  configFile: false,
  root: ROOT,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    target: 'es2020',
    lib: {
      entry: resolve(ROOT, 'src/main.js'),
      formats: ['es'],
      fileName: 'desktop',
    },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
if (outputs.length !== 1 || outputs[0].type !== 'chunk'
    || outputs[0].imports.length
    // Rolldown may record an inlined dynamic module as referring to its own
    // output chunk. Runtime import() expressions would still need a sidecar.
    || outputs[0].dynamicImports.some(id => id !== outputs[0].fileName)
    || /\bimport\s*\(/.test(outputs[0].code)) {
  throw new Error('Desktop HTML must contain exactly one self-contained JavaScript bundle: '
    + JSON.stringify(outputs.map(o => ({ type: o.type, fileName: o.fileName,
      imports: o.imports, dynamicImports: o.dynamicImports }))));
}
process.stdout.write(outputs[0].code.replace(/<\/script/gi, '<\\/script'));
