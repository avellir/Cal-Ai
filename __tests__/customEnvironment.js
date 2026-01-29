const NodeEnvironment = require('jest-environment-node').TestEnvironment;

// Node.js 25+ has localStorage but throws SecurityError when accessed without --localstorage-file
// We need to delete it from globalThis before any code tries to access it
try {
  // Use Object.getOwnPropertyDescriptor to check without triggering the getter
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (descriptor) {
    delete globalThis.localStorage;
  }
} catch (e) {
  // If we can't check, try to delete anyway
  try {
    delete globalThis.localStorage;
  } catch (e2) {
    // Ignore - we tried our best
  }
}

class CustomEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
  }

  async setup() {
    await super.setup();
    // Ensure localStorage is not available in the test environment
    try {
      delete this.global.localStorage;
    } catch (e) {
      // Ignore
    }
  }
}

module.exports = CustomEnvironment;
