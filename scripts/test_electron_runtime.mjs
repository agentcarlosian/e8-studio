// Smoke the actual unpacked Windows app after electron-builder packages it.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executablePath = path.join(root, 'dist-app/win-unpacked/E8 Studio.exe');
assert.ok(existsSync(executablePath), `Build the Windows Electron package first: ${executablePath}`);

const app = await _electron.launch({ executablePath, args: ['--headless'], timeout: 60_000 });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.waitForFunction(
    () => !!window.__app && (!!window.__app.currentView || !!document.querySelector('#render-fallback:not(.hidden)')),
    null, { timeout: 60_000 },
  );
  const initial = await page.evaluate(() => ({
    protocol: location.protocol,
    view: window.__app?.currentView?.name,
    fallback: !!document.querySelector('#render-fallback:not(.hidden)'),
    canvas2DLink: !!document.querySelector('#render-fallback [data-act="openCanvas2DStudio"]'),
  }));
  assert.equal(initial.protocol, 'file:', initial);
  if (initial.view) {
    assert.equal(initial.view, 'e8coxeter', initial);
    await app.context().setOffline(true);
    assert.equal(await page.evaluate(() => window.__app.switchView('polytope')), true);
    await page.waitForFunction(() => window.__app.currentView?.name === 'polytope4d');
    await page.evaluate(() => window.__app.openLearningCenter('meet-e8'));
    assert.equal(await page.locator('#learning-lesson-title').innerText(), 'What am I looking at?');
    console.log('Electron runtime passed: offline 4D view and beginner lesson.');
  } else {
    assert.ok(initial.fallback, initial);
    assert.equal(initial.canvas2DLink, false, 'packaged app offered a missing Canvas2D sibling');
    if (process.argv.includes('--expect-webgl')) {
      throw new Error('Electron first view did not render with WebGL on this host');
    }
    console.log('Electron runtime passed: clear no-WebGL fallback without a missing sibling link.');
  }
  assert.deepEqual(errors, [], 'Electron renderer raised a page error');
} finally {
  await app.close();
}
