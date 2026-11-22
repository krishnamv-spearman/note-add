import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// React Router's data routers build Request objects with jsdom's AbortSignal, which Node's
// Request (undici) rejects. Test-only shim: drop the signal; navigation is never aborted here.
const NodeRequest = globalThis.Request;
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal) {
      const { signal: _ignored, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
};
