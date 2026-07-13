// Circuit breaker for one view's per-frame update callback. A transient error
// is recorded and retried; repeated consecutive errors suspend only that
// callback while the renderer and UI keep running.
export class FrameHealthController {
  constructor({ failureLimit = 3, onFailure = () => {}, onTrip = () => {} } = {}) {
    this.failureLimit = Math.max(1, Math.floor(failureLimit));
    this.onFailure = onFailure;
    this.onTrip = onTrip;
    this.reset(null);
  }

  reset(viewId) {
    this.viewId = viewId || null;
    this.consecutiveFailures = 0;
    this.totalFailures = 0;
    this.tripped = false;
    this.lastError = null;
  }

  run(callback) {
    if (this.tripped || typeof callback !== 'function') return false;
    try {
      callback();
      this.consecutiveFailures = 0;
      return true;
    } catch (error) {
      this.consecutiveFailures += 1;
      this.totalFailures += 1;
      this.lastError = error;
      this.onFailure(error, this.snapshot());
      if (this.consecutiveFailures >= this.failureLimit) {
        this.tripped = true;
        this.onTrip(error, this.snapshot());
      }
      return false;
    }
  }

  snapshot() {
    return {
      viewId: this.viewId,
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.totalFailures,
      tripped: this.tripped,
      lastError: this.lastError ? String(this.lastError.message || this.lastError) : null,
    };
  }
}
