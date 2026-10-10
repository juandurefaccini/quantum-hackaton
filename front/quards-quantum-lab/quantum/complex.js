// Complex numbers as [re, im]. Small, dependency-free, enough for 1-3 qubits.
export const c = (re, im = 0) => [re, im];

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const scale = (a, s) => [a[0] * s, a[1] * s];
export const conj = a => [a[0], -a[1]];
export const abs2 = a => a[0] * a[0] + a[1] * a[1];
export const abs = a => Math.hypot(a[0], a[1]);
export const phase = a => Math.atan2(a[1], a[0]);
