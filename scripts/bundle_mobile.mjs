/** Bundle the mobile ESM graph for both inline HTML targets using Vite. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  configFile: false,
  root: ROOT,
  logLevel: 'silent',
  define: { __MOBILE_INLINE_DATA_ONLY__: 'true' },
  build: {
    write: false,
    minify: false,
    target: 'es2020',
    lib: {
      entry: resolve(ROOT, 'src/mobile/main.js'),
      formats: ['es'],
      fileName: 'mobile',
    },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
if (outputs.length !== 1 || outputs[0].type !== 'chunk'
    || outputs[0].imports.length || outputs[0].dynamicImports.length) {
  throw new Error('Mobile HTML must contain exactly one self-contained JavaScript bundle.');
}
// An inline script must not contain a literal HTML end tag, even inside a string.
process.stdout.write(outputs[0].code.replaceAll('</script', '<\\/script'));
