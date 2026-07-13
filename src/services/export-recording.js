// Browser/native export delivery and MediaRecorder orchestration.

export class ExportRecordingService {
  constructor({ toast = () => {}, onExport = () => {}, environment = globalThis } = {}) {
    this.toast = toast;
    this.onExport = onExport;
    this.environment = environment;
    this.activeRecording = null;
  }

  downloadText(text, name, type = 'text/plain') {
    return this.downloadBlob(new Blob([text], { type }), name);
  }

  async downloadBlob(blob, name, shareText = 'E8 Studio export') {
    if (!blob) return;
    this.onExport();
    const target = this.environment;
    if (target.e8desktop?.available && typeof target.e8desktop.saveBlob === 'function') {
      try {
        await target.e8desktop.saveBlob(blob, name);
        return;
      } catch (error) {
        console.warn('[export] native desktop save failed, falling back:', error);
      }
    }
    if (isCapacitorNative(target)) {
      try {
        if (await shareNativeBlob(blob, name, shareText, target)) return;
      } catch (error) {
        console.warn('[export] native share failed, falling back:', error);
        this.toast('Native share unavailable');
      }
    }
    const url = target.URL.createObjectURL(blob);
    const anchor = target.document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    target.setTimeout(() => target.URL.revokeObjectURL(url), 1000);
  }

  encodeCanvasBlob(canvas, type = 'image/png', timeoutMs = 10000) {
    const target = this.environment;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = target.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Canvas encoding timed out'));
      }, timeoutMs);
      try {
        canvas.toBlob(blob => {
          if (settled) return;
          settled = true;
          target.clearTimeout?.(timeout);
          if (blob) resolve(blob);
          else reject(new Error('Canvas encoding returned no data'));
        }, type);
      } catch (error) {
        if (!settled) {
          settled = true;
          target.clearTimeout?.(timeout);
          reject(error);
        }
      }
    });
  }

  async exportHighResPNG({ renderer, camera, scene, scale = 2 }) {
    if (!renderer) return null;
    const canvas = renderer.domElement;
    const cssWidth = canvas.clientWidth || canvas.width;
    const cssHeight = canvas.clientHeight || canvas.height;
    const oldPixelRatio = renderer.getPixelRatio();
    const oldAspect = camera.aspect;
    let blob = null;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(cssWidth * scale, cssHeight * scale, false);
      camera.aspect = cssWidth / cssHeight;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      blob = await this.encodeCanvasBlob(canvas);
    } catch (error) {
      console.error('[export] high-resolution PNG failed:', error);
      this.toast('PNG export failed; renderer restored');
    } finally {
      renderer.setPixelRatio(oldPixelRatio);
      renderer.setSize(cssWidth, cssHeight, false);
      camera.aspect = oldAspect;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    if (!blob) return null;
    await this.downloadBlob(blob, `e8_studio_${scale}x.png`);
    this.toast(`Saved ${scale}x PNG`);
    return blob;
  }

  async exportTransparentPNG({ renderer, camera, scene }) {
    if (!renderer) return null;
    const oldBackground = scene.background;
    const oldAlpha = renderer.getClearAlpha();
    let blob = null;
    try {
      scene.background = null;
      renderer.setClearAlpha(0);
      renderer.render(scene, camera);
      blob = await this.encodeCanvasBlob(renderer.domElement);
    } catch (error) {
      console.error('[export] transparent PNG failed:', error);
      this.toast('Transparent PNG failed; renderer restored');
    } finally {
      scene.background = oldBackground;
      renderer.setClearAlpha(oldAlpha);
      renderer.render(scene, camera);
    }
    if (!blob) return null;
    await this.downloadBlob(blob, 'e8_studio_transparent.png');
    this.toast('Saved transparent PNG');
    return blob;
  }

  async recordClip({ renderer, camera, params, durationSec = 8, options = {} }) {
    if (!renderer?.domElement) { this.toast('✗ no canvas'); return null; }
    if (this.activeRecording) {
      this.toast('Recording already active');
      return this.activeRecording.promise;
    }
    if (typeof MediaRecorder === 'undefined') {
      this.toast('✗ MediaRecorder not supported');
      return null;
    }
    const canvas = renderer.domElement;
    const fps = Math.max(15, Math.min(60, options.fps || 30));
    const width = options.width || 1280;
    const height = options.height || 720;
    const bitrate = options.bitrate || Math.max(10_000_000, Math.round((width * height * fps) * 1.5 / 1024) * 1000);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=h264', 'video/mp4']
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { this.toast('✗ no supported video codec'); return null; }

    const cssWidth = canvas.clientWidth || canvas.width;
    const cssHeight = canvas.clientHeight || canvas.height;
    const oldPixelRatio = renderer.getPixelRatio();
    const oldAspect = camera.aspect;
    const aspect = cssWidth / cssHeight;
    const recordWidth = width;
    const recordHeight = Math.abs((width / height) - aspect) > 0.05 ? Math.round(width / aspect) : height;
    const chunks = [];
    let canceled = false;
    let progressTimer = null;
    let stream = null;
    let recorder = null;
    let finished = null;
    let blob = null;
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(recordWidth, recordHeight, false);
      camera.aspect = recordWidth / recordHeight;
      camera.updateProjectionMatrix();
      params._recording = true;
      params._recordingMotionScale = options.motionScale ?? params._recordingMotionScale ?? 0.4;

      stream = canvas.captureStream(fps);
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
      } catch {
        recorder = new MediaRecorder(stream, { mimeType });
      }
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      finished = new Promise(resolve => { recorder.onstop = resolve; });
      const startedAt = performance.now();
      progressTimer = setInterval(() => {
        const elapsed = Math.min(durationSec, (performance.now() - startedAt) / 1000);
        this.toast(`⏺ recording ${Math.round((elapsed / durationSec) * 100)}% (${Math.max(0, durationSec - elapsed).toFixed(0)}s left)`);
      }, 500);
      this.activeRecording = {
        recorder,
        promise: finished,
        cancel() {
          canceled = true;
          if (recorder.state !== 'inactive') { recorder.requestData(); recorder.stop(); }
        },
      };
      this.toast(`⏺ recording ${durationSec}s @ ${recordWidth}×${recordHeight} ${fps}fps…`);
      recorder.start(200);
      await Promise.race([new Promise(resolve => setTimeout(resolve, durationSec * 1000)), finished]);
      if (recorder.state !== 'inactive') recorder.stop();
      await finished;
      if (!canceled) blob = new Blob(chunks, { type: mimeType });
    } catch (error) {
      console.error('[recording] clip failed:', error);
      this.toast('Recording failed; renderer restored');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      if (stream && typeof stream.getTracks === 'function') {
        for (const track of stream.getTracks()) {
          try { track.stop(); } catch {}
        }
      }
      this.activeRecording = null;
      renderer.setPixelRatio(oldPixelRatio);
      renderer.setSize(cssWidth, cssHeight, false);
      camera.aspect = oldAspect;
      camera.updateProjectionMatrix();
      params._recording = false;
      params._recordingMotionScale = 1;
    }
    if (!blob) return null;
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    await this.downloadBlob(blob, `e8_studio_${Date.now()}_${recordWidth}x${recordHeight}.${extension}`);
    this.toast(`✓ saved .${extension} (${(blob.size / 1024 / 1024).toFixed(1)}MB) ${recordWidth}×${recordHeight} @ ${fps}fps`);
    return blob;
  }

  cancelRecording() {
    if (!this.activeRecording) { this.toast('No active recording'); return false; }
    this.activeRecording.cancel();
    this.toast('Recording canceled');
    return true;
  }

  async recordAnimatedCanvas({ canvas, durationMs = 3000, fps = 30, bitrate = 16_000_000, drawFrame }) {
    if (typeof MediaRecorder === 'undefined' || !canvas?.captureStream) return null;
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) return null;
    const target = this.environment;
    const chunks = [];
    let stream = null;
    let recorder = null;
    let timer = null;
    let frame = 0;
    try {
      stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      const finished = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = event => reject(event?.error || new Error('Animated recording failed'));
      });
      timer = target.setInterval(() => drawFrame?.(frame++, canvas), 1000 / fps);
      recorder.start(100);
      await new Promise(resolve => target.setTimeout(resolve, durationMs));
      if (recorder.state !== 'inactive') recorder.stop();
      await Promise.race([
        finished,
        new Promise((_, reject) => target.setTimeout(() => reject(new Error('Recorder stop timed out')), 5000)),
      ]);
      return new Blob(chunks, { type: mimeType });
    } catch (error) {
      console.error('[recording] animated canvas failed:', error);
      this.toast('Animated export unavailable');
      return null;
    } finally {
      if (timer) target.clearInterval(timer);
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      if (stream && typeof stream.getTracks === 'function') {
        for (const track of stream.getTracks()) {
          try { track.stop(); } catch {}
        }
      }
    }
  }
}

export function isCapacitorNative(target = globalThis) {
  const capacitor = target?.Capacitor || null;
  if (!capacitor) return false;
  try {
    if (typeof capacitor.isNativePlatform === 'function') return capacitor.isNativePlatform();
    return typeof capacitor.getPlatform === 'function' && capacitor.getPlatform() !== 'web';
  } catch { return false; }
}

function blobToBase64(blob, target = globalThis) {
  return new Promise((resolve, reject) => {
    const reader = new target.FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read export blob'));
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
}

async function shareNativeBlob(blob, name, shareText, target = globalThis) {
  if (!isCapacitorNative(target)) return false;
  const Filesystem = target.Capacitor?.Plugins?.Filesystem;
  const Share = target.Capacitor?.Plugins?.Share;
  if (!Filesystem || !Share) return false;
  const safeName = String(name || 'e8-studio-export.bin').replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').slice(0, 120);
  const file = await Filesystem.writeFile({ path: safeName, data: await blobToBase64(blob, target), directory: 'CACHE', recursive: true });
  await Share.share({ title: safeName, text: shareText, url: file.uri, dialogTitle: 'Share E8 Studio export' });
  return true;
}
