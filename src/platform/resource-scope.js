// Owns disposable resources created by one view instance. This module is kept
// free of DOM and renderer imports so view lifecycle policy can be tested
// independently of Three.js and reused by future platform shells.
export class ResourceScope {
  constructor({ onDisposeError = () => {} } = {}) {
    this.resources = new Set();
    this.disposed = false;
    this.onDisposeError = onDisposeError;
  }

  track(resource) {
    if (!resource) return resource;
    if (this.disposed) {
      this.disposeResource(resource);
      return resource;
    }
    this.resources.add(resource);
    return resource;
  }

  release(resource) {
    this.resources.delete(resource);
    return resource;
  }

  get size() {
    return this.resources.size;
  }

  disposeResource(resource) {
    try {
      if (resource && typeof resource.dispose === 'function') resource.dispose();
    } catch (error) {
      this.onDisposeError(error, resource);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources) this.disposeResource(resource);
    this.resources.clear();
  }
}

export function createResourceScope(options) {
  return new ResourceScope(options);
}
