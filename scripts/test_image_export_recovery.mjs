import assert from 'node:assert/strict';
import { ExportRecordingService } from '../src/services/export-recording.js';

const originalError = console.error;
console.error = () => {};
try {
  const messages = [];
  const sizes = [];
  const canvas = {
    clientWidth: 640,
    clientHeight: 360,
    toBlob() { throw new Error('encoder crashed'); },
  };
  let pixelRatio = 2;
  let clearAlpha = 1;
  let renders = 0;
  const renderer = {
    domElement: canvas,
    getPixelRatio: () => pixelRatio,
    setPixelRatio(value) { pixelRatio = value; sizes.push(['dpr', value]); },
    setSize(width, height) { sizes.push(['size', width, height]); },
    getClearAlpha: () => clearAlpha,
    setClearAlpha(value) { clearAlpha = value; },
    render() { renders += 1; },
  };
  const camera = { aspect: 640 / 360, updateProjectionMatrix() {} };
  const background = { color: 'original' };
  const scene = { background };
  const service = new ExportRecordingService({ toast: message => messages.push(message) });

  assert.equal(await service.exportHighResPNG({ renderer, camera, scene, scale: 3 }), null);
  assert.equal(pixelRatio, 2);
  assert.equal(camera.aspect, 640 / 360);
  assert.deepEqual(sizes.at(-1), ['size', 640, 360]);
  assert.match(messages.at(-1), /renderer restored/);

  assert.equal(await service.exportTransparentPNG({ renderer, camera, scene }), null);
  assert.equal(scene.background, background);
  assert.equal(clearAlpha, 1);
  assert.ok(renders >= 4);
  assert.match(messages.at(-1), /renderer restored/);
} finally {
  console.error = originalError;
}

console.log('Image export recovery tests passed.');
