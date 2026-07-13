// Camera state and spherical-pose mechanics. Rendering policy (cinematic path
// selection, ambient drift) stays in main; mutable camera state lives here.

export const CAMERA_DEFAULT_DISTANCE = 6;
export const CAMERA_TOUCH_DEFAULT_DISTANCE = 8.2;
export const CAMERA_MIN_DISTANCE = 0.18;
export const CAMERA_MAX_DISTANCE = 120;

export class CameraController {
  constructor() {
    this.theta = Math.PI / 6;
    this.phi = Math.PI / 3;
    this.distance = CAMERA_DEFAULT_DISTANCE;
    this.thetaTarget = this.theta;
    this.phiTarget = this.phi;
    this.distanceTarget = this.distance;
    this.thetaVelocity = 0;
    this.phiVelocity = 0;
    this.autoZoomFactor = 1;
    this.lastPath = 'manual';
    this.pathStartedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    this.baseX = 0;
    this.baseY = 0;
    this.baseZ = 0;
  }

  clampDistance(value, fallback = CAMERA_DEFAULT_DISTANCE) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(CAMERA_MIN_DISTANCE, Math.min(CAMERA_MAX_DISTANCE, number));
  }

  updateCamera(camera, target, params) {
    if (!camera || !target) return;
    const x = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.distance * Math.cos(this.phi);
    const z = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
    camera.position.set(x, y, z).add(target);
    camera.lookAt(target);
    this.baseX = x;
    this.baseY = y;
    this.baseZ = z;
    if (params) params.cameraRotation = Math.atan2(Math.sin(this.theta), Math.cos(this.theta));
  }

  syncTargets() {
    this.thetaTarget = this.theta;
    this.phiTarget = this.phi;
    this.distanceTarget = this.distance;
    this.thetaVelocity = 0;
    this.phiVelocity = 0;
  }

  applyDamping(dt, camera, target, params) {
    const damping = 0.12;
    const velocityScale = Math.pow(0.90, Math.max(1, dt * 60));
    this.thetaVelocity *= velocityScale;
    this.phiVelocity *= velocityScale;
    this.thetaTarget += this.thetaVelocity * dt;
    this.phiTarget += this.phiVelocity * dt;
    this.phiTarget = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.phiTarget));
    const before = this.theta;
    this.theta += (this.thetaTarget - this.theta) * damping;
    this.phi += (this.phiTarget - this.phi) * damping;
    this.distance += (this.distanceTarget - this.distance) * damping;
    if (params && !params.cameraOrbit && (params.cameraPath || 'manual') === 'manual') {
      params.cameraDistance = this.clampDistance(this.distanceTarget);
    }
    const moved = Math.abs(this.theta - before) > 1e-5
      || Math.abs(this.thetaTarget - this.theta) > 1e-4
      || Math.abs(this.phiTarget - this.phi) > 1e-4
      || Math.abs(this.distanceTarget - this.distance) > 1e-4
      || Math.abs(this.thetaVelocity) > 1e-5;
    if (moved) this.updateCamera(camera, target, params);
    return moved;
  }

  reset(distance, camera, target, params) {
    this.theta = Math.PI / 6;
    this.phi = Math.PI / 3;
    this.distance = this.clampDistance(distance);
    this.syncTargets();
    this.updateCamera(camera, target, params);
  }

  snapshot() {
    return { theta: this.theta, phi: this.phi, dist: this.distance };
  }

  restore(snapshot, camera, target, params) {
    this.theta = finiteClamp(snapshot?.theta, -Math.PI * 8, Math.PI * 8, Math.PI / 6);
    this.phi = finiteClamp(snapshot?.phi, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01, Math.PI / 3);
    this.distance = this.clampDistance(snapshot?.dist);
    this.syncTargets();
    this.updateCamera(camera, target, params);
  }

  applyCinematic(params, now, camera, target) {
    if (!params || !camera || !target) return false;
    const path = params.cameraPath || 'manual';
    if (path !== this.lastPath) {
      this.lastPath = path;
      this.pathStartedAt = now;
    }
    if (path === 'manual') return false;
    const elapsed = (now - this.pathStartedAt) / 1000;
    const recordingScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
    const speed = (params.cameraSpeed || 1) * recordingScale;
    if (path === 'coxeterOrbit') {
      this.theta = elapsed * 0.22 * speed;
      this.phi = Math.PI / 3 + Math.sin(elapsed * 0.35 * speed) * 0.16;
      this.distance = 5.6 + Math.sin(elapsed * 0.28 * speed) * 0.55;
    } else if (path === 'ringDive') {
      this.theta = elapsed * 0.34 * speed;
      this.phi = Math.PI / 2.25 + Math.sin(elapsed * 0.52 * speed) * 0.26;
      this.distance = 6.6 - (Math.sin(elapsed * 0.42 * speed) * 0.5 + 0.5) * 2.4;
    } else if (path === 'petrieSpiral') {
      this.theta = elapsed * 0.5 * speed;
      this.phi = Math.PI / 2.1 + Math.sin(elapsed * 0.73 * speed) * 0.32;
      this.distance = 6.2 + Math.cos(elapsed * 0.31 * speed) * 0.9;
    } else if (path === 'h4Reveal') {
      this.theta = Math.PI / 5 + elapsed * 0.18 * speed;
      this.phi = Math.PI / 3.3 + Math.sin(elapsed * 0.27 * speed) * 0.12;
      this.distance = 7.4 - Math.min(1, elapsed / 14) * 2 + Math.sin(elapsed * 0.25 * speed) * 0.25;
    }
    this.phi = Math.max(0.12, Math.min(Math.PI - 0.12, this.phi));
    this.distance = Math.max(2.4, Math.min(12, this.distance));
    this.updateCamera(camera, target, params);
    return true;
  }
}

function finiteClamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
