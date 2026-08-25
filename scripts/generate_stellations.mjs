import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getStellation, STELLATION_NAMES } from '../src/math/stellations.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, '..', 'data', 'stellations.json');
const payload = Object.fromEntries(
  STELLATION_NAMES.map(name => [name, getStellation(name)])
);

await writeFile(outputPath, `${JSON.stringify(payload)}\n`, 'utf8');
console.log(`Stellation artifact written: data/stellations.json (${STELLATION_NAMES.length} shapes)`);
