// Static imports only. Qollab bundles the files reachable through static
// imports; a file referenced only by a dynamic import() is not emitted, so
// `import('./fake-source.js')` fails there (it resolves against Qollab's own
// base). We import both adapters statically and pick at call time based on
// whether Qollab injected its `backend` global.
import * as qiskitSource from './qiskit-source.js';
import * as fakeSource from './fake-source.js';

export function loadSource() {
  if (typeof backend !== 'undefined') return { ...qiskitSource, kind: 'qiskit' };
  return { ...fakeSource, kind: 'fake' };
}
