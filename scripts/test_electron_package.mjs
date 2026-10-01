// Assert that the unpacked Windows Electron app contains the tested offline HTML.
// Run after electron-builder --win --dir. --self-test checks the verifier itself.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function checkArchive(archivePath, htmlPath, { executablePath = null, installerPath = null, minHtmlBytes = 100_000 } = {}) {
  assert.ok(existsSync(archivePath), `Electron ASAR is missing: ${archivePath}`);
  if (executablePath) assert.ok(existsSync(executablePath) && statSync(executablePath).size > 100_000, `Electron executable is missing or empty: ${executablePath}`);
  if (installerPath) assert.ok(existsSync(installerPath) && statSync(installerPath).size > 100_000, `Electron installer is missing or empty: ${installerPath}`);
  const entries = new Set(asar.listPackage(archivePath).map(name => name.replace(/^[/\\]/, '').replaceAll('\\', '/')));
  for (const required of ['electron/main.js', 'electron/preload.js', 'dist/index.html', 'package.json']) {
    assert.ok(entries.has(required), `Electron ASAR is missing ${required}`);
  }
  const packagedDist = [...entries].filter(name => name.startsWith('dist/') && !name.endsWith('/'));
  assert.deepEqual(packagedDist, ['dist/index.html'], 'Electron ASAR includes unexpected dist artifacts');
  const expectedHtml = readFileSync(htmlPath);
  assert.ok(expectedHtml.length >= minHtmlBytes, 'offline HTML is unexpectedly small');
  const packagedHtml = asar.extractFile(archivePath, 'dist/index.html');
  assert.ok(packagedHtml.equals(expectedHtml), 'packaged HTML differs from the tested offline build');
  console.log(`Electron package inventory and HTML match: ${archivePath}`);
}

async function selfTest() {
  const temporary = mkdtempSync(path.join(tmpdir(), 'e8-electron-package-'));
  try {
    const source = path.join(temporary, 'source');
    const archive = path.join(temporary, 'app.asar');
    const html = path.join(temporary, 'index.html');
    for (const relative of ['electron/main.js', 'electron/preload.js', 'dist/index.html', 'package.json']) {
      const target = path.join(source, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, relative);
    }
    writeFileSync(html, 'dist/index.html');
    await asar.createPackage(source, archive);
    checkArchive(archive, html, { minHtmlBytes: 1 });
    mkdirSync(path.join(source, 'dist/vendor'), { recursive: true });
    writeFileSync(path.join(source, 'dist/vendor/leak.js'), 'leak');
    const leakedArchive = path.join(temporary, 'leaked.asar');
    await asar.createPackage(source, leakedArchive);
    assert.throws(() => checkArchive(leakedArchive, html, { minHtmlBytes: 1 }), /unexpected dist artifacts/);
    console.log('Electron package verifier self-test passed: vendor leak rejected');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv.includes('--self-test')) {
  await selfTest();
} else {
  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  checkArchive(
    path.join(root, 'dist-app/win-unpacked/resources/app.asar'),
    path.join(root, 'dist/index.html'),
    {
      executablePath: path.join(root, 'dist-app/win-unpacked/E8 Studio.exe'),
      installerPath: path.join(root, `dist-app/E8-Studio-${version}-Setup.exe`),
    },
  );
}
