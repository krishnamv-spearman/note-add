import 'fake-indexeddb/auto';
import fc from 'fast-check';

// test-plan §2: 100 property runs in the hook, 1,000 in CI (FC_RUNS=1000), 10,000 on main.
fc.configureGlobal({ numRuns: Number(process.env.FC_RUNS ?? 100) });

// test-plan §3: unit and component tests fail if they touch the network.
const noNetwork = (): never => {
  throw new Error('Network access is not allowed in unit tests');
};
globalThis.fetch = noNetwork;
if ('XMLHttpRequest' in globalThis) {
  (globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = class {
    constructor() {
      noNetwork();
    }
  };
}
