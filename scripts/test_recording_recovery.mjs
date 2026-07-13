import assert from 'node:assert/strict';
import { ExportRecordingService } from '../src/services/export-recording.js';

const originalMediaRecorder = globalThis.MediaRecorder;
const originalConsoleError = console.error;
const makeHarness = captureStream => {
  const sizes = [];
  const renderer = {
    domElement: { clientWidth: 640, clientHeight: 360, captureStream },
    getPixelRatio: () => 2,
    setPixelRatio: value => sizes.push(['dpr', value]),
    setSize: (width, height) => sizes.push(['size', width, height]),
  };
  return {
    renderer,
    camera: { aspect: 640 / 360, updateProjectionMatrix() {} },
    params: { _recording: false, _recordingMotionScale: 1 },
    sizes,
    messages: [],
  };
};

globalThis.MediaRecorder = class {
  static isTypeSupported() { return true; }
};

try {
  console.error = () => {};
  const captureFailure = makeHarness(() => { throw new Error('capture unavailable'); });
  const service = new ExportRecordingService({ toast: message => captureFailure.messages.push(message) });
  assert.equal(await service.recordClip({
    renderer: captureFailure.renderer,
    camera: captureFailure.camera,
    params: captureFailure.params,
    durationSec: 0.001,
  }), null);
  assert.equal(captureFailure.params._recording, false);
  assert.equal(captureFailure.params._recordingMotionScale, 1);
  assert.equal(captureFailure.camera.aspect, 640 / 360);
  assert.deepEqual(captureFailure.sizes.at(-2), ['dpr', 2]);
  assert.deepEqual(captureFailure.sizes.at(-1), ['size', 640, 360]);
  assert.equal(service.activeRecording, null);
  assert.match(captureFailure.messages.at(-1), /renderer restored/);

  globalThis.MediaRecorder = class {
    static isTypeSupported() { return true; }
    constructor() { throw new Error('codec initialization failed'); }
  };
  let trackStopped = false;
  const constructorFailure = makeHarness(() => ({ getTracks: () => [{ stop: () => { trackStopped = true; } }] }));
  const secondService = new ExportRecordingService({ toast: message => constructorFailure.messages.push(message) });
  assert.equal(await secondService.recordClip({
    renderer: constructorFailure.renderer,
    camera: constructorFailure.camera,
    params: constructorFailure.params,
    durationSec: 0.001,
  }), null);
  assert.equal(trackStopped, true);
  assert.equal(constructorFailure.params._recording, false);
  assert.equal(secondService.activeRecording, null);
  let animatedTrackStopped = false;
  const animatedCanvas = {
    captureStream: () => ({ getTracks: () => [{ stop: () => { animatedTrackStopped = true; } }] }),
  };
  assert.equal(await secondService.recordAnimatedCanvas({
    canvas: animatedCanvas, durationMs: 1, drawFrame() {},
  }), null);
  assert.equal(animatedTrackStopped, true);

  class SuccessfulRecorder {
    static isTypeSupported() { return true; }
    constructor() { this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    requestData() {}
    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['frame'], { type: 'video/webm' }) });
      queueMicrotask(() => this.onstop?.());
    }
  }
  globalThis.MediaRecorder = SuccessfulRecorder;
  let successfulTrackStopped = false;
  const success = makeHarness(() => ({ getTracks: () => [{ stop: () => { successfulTrackStopped = true; } }] }));
  const successService = new ExportRecordingService({ toast: message => success.messages.push(message) });
  let downloadedBlob = null;
  successService.downloadBlob = async blob => { downloadedBlob = blob; };
  const result = await successService.recordClip({
    renderer: success.renderer, camera: success.camera, params: success.params, durationSec: 0.001,
  });
  assert.equal(result, downloadedBlob);
  assert.ok(result.size > 0);
  assert.equal(successfulTrackStopped, true);
  assert.equal(success.params._recording, false);

  let canceledTrackStopped = false;
  const canceled = makeHarness(() => ({ getTracks: () => [{ stop: () => { canceledTrackStopped = true; } }] }));
  const cancelService = new ExportRecordingService({ toast: message => canceled.messages.push(message) });
  const recordingPromise = cancelService.recordClip({
    renderer: canceled.renderer, camera: canceled.camera, params: canceled.params, durationSec: 1,
  });
  assert.equal(cancelService.cancelRecording(), true);
  assert.equal(await recordingPromise, null);
  assert.equal(canceledTrackStopped, true);
  assert.equal(canceled.params._recording, false);
  assert.equal(cancelService.activeRecording, null);
} finally {
  console.error = originalConsoleError;
  if (originalMediaRecorder === undefined) delete globalThis.MediaRecorder;
  else globalThis.MediaRecorder = originalMediaRecorder;
}

console.log('Recording recovery tests passed.');
