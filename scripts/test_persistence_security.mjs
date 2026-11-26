import assert from 'node:assert/strict';
import { applyConfig } from '../src/state/persistence.js';

const target = {
  view: 'bloom',
  shape: 'icosahedron',
  dynkin: 'E8',
  poly4d: '600cell',
  cameraBookmarks: {},
  fxByView: {},
};

// Arrays and objects MUST NOT bypass SAFE_STRING on string enum keys.
applyConfig(target, {
  shape: ['<img src=x onerror=alert(1)>'],
  dynkin: { toString: '<svg onload=alert(1)>' },
  poly4d: ['<style>body{display:none}</style>'],
  view: ['<b>spoof</b>'],
  __proto__: { polluted: true },
  cameraBookmarks: {
    '1': { pos: [1, 2, 3], label: '<script>x</script>', ok: 'view-1' },
    '<bad>': { pos: [0, 0, 0] },
  },
  fxByView: {
    bloom: 'glow',
    evil: '<img src=x>',
  },
});

assert.equal(target.shape, 'icosahedron', 'Array payload must not overwrite shape');
assert.equal(target.dynkin, 'E8', 'Object payload must not overwrite dynkin');
assert.equal(target.poly4d, '600cell', 'Array payload must not overwrite poly4d');
assert.equal(target.view, 'bloom', 'Array payload must not overwrite view');
assert.equal(({}).polluted, undefined, 'Prototype pollution must be blocked');
assert.deepEqual(target.cameraBookmarks, { '1': { pos: [1, 2, 3], ok: 'view-1' } });
assert.deepEqual(target.fxByView, { bloom: 'glow' });

// Valid primitives and string-array keys still apply cleanly.
applyConfig(target, {
  shape: 'dodecahedron',
  bloomAmount: 0.5,
  autoRotate: true,
  autoSliders: ['e8MorphT', '<img src=x>', 123],
});
assert.equal(target.shape, 'dodecahedron');
assert.equal(target.bloomAmount, 0.5);
assert.equal(target.autoRotate, true);
assert.deepEqual(target.autoSliders, ['e8MorphT']);

console.log('persistence security OK');
