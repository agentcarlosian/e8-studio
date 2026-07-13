import assert from 'node:assert/strict';
import { ExportRecordingService, isCapacitorNative } from '../src/services/export-recording.js';

function browserEnvironment(overrides = {}) {
  const events = { clicked: [], revoked: [] };
  const environment = {
    URL: {
      createObjectURL: () => 'blob:test-export',
      revokeObjectURL: url => events.revoked.push(url),
    },
    document: {
      createElement: () => ({
        href: '', download: '',
        click() { events.clicked.push({ href: this.href, download: this.download }); },
      }),
    },
    setTimeout: callback => { callback(); return 1; },
    ...overrides,
  };
  return { environment, events };
}

const desktop = browserEnvironment({
  e8desktop: { available: true, saveBlob: async () => { throw new Error('native save failed'); } },
});
const desktopMessages = [];
const originalWarn = console.warn;
console.warn = () => {};
const desktopService = new ExportRecordingService({
  environment: desktop.environment,
  toast: message => desktopMessages.push(message),
});
await desktopService.downloadBlob(new Blob(['svg']), 'diagram.svg');
console.warn = originalWarn;
assert.deepEqual(desktop.events.clicked, [{ href: 'blob:test-export', download: 'diagram.svg' }]);
assert.deepEqual(desktop.events.revoked, ['blob:test-export']);

let filesystemWrite = null;
let shareRequest = null;
class FakeFileReader {
  readAsDataURL() {
    this.result = 'data:application/octet-stream;base64,ZXhwb3J0';
    queueMicrotask(() => this.onload?.());
  }
}
const capacitor = browserEnvironment({
  FileReader: FakeFileReader,
  Capacitor: {
    getPlatform: () => 'android',
    Plugins: {
      Filesystem: { writeFile: async request => { filesystemWrite = request; return { uri: 'cache://export' }; } },
      Share: { share: async request => { shareRequest = request; } },
    },
  },
});
assert.equal(isCapacitorNative(capacitor.environment), true);
const capacitorService = new ExportRecordingService({ environment: capacitor.environment });
await capacitorService.downloadBlob(new Blob(['export']), '../unsafe:name.obj', 'Geometry export');
assert.equal(filesystemWrite.path, '.._unsafe_name.obj');
assert.equal(filesystemWrite.data, 'ZXhwb3J0');
assert.equal(shareRequest.url, 'cache://export');
assert.equal(shareRequest.text, 'Geometry export');
assert.equal(capacitor.events.clicked.length, 0);

console.log('Export delivery tests passed.');
