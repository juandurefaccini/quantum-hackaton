// AUTOPRUEBA DE LA PARTE CUÁNTICA, para correr dentro de Qollab.
// Desde main.js:
//     import { autotest } from './quantum/autotest.js';
//     console.log(await autotest(backend));
// Comprueba que Qiskit se comporta como espera el juego. Hace UNA sola ejecución en el backend.
import { probabilidadQubit, probabilidadesFaseGrupo, medirGrupo } from './qiskit.js';

const cerca = (a, b) => Math.abs(a - b) < 1e-6;

export async function autotest(backend) {
  const resultados = [];
  const chequear = (nombre, ok, detalle = '') => resultados.push(`${ok ? 'OK  ' : 'FALLA'} ${nombre} ${detalle}`);
  const grupo = (qubits, ops) => ({ qubits, ops });
  const p = async (qubits, ops, q = 0) => probabilidadQubit(grupo(qubits, ops), q);

  const theta = 1.0;
  const base = await p(1, [['ry', theta, 0]]);
  chequear('ry fija la probabilidad', cerca(base[0], Math.cos(theta / 2) ** 2), `P(0)=${base[0].toFixed(3)}`);

  const x = await p(1, [['ry', theta, 0], ['x', 0]]);
  chequear('X invierte la probabilidad', cerca(x[0], base[1]) && cerca(x[1], base[0]));

  const z = await p(1, [['ry', theta, 0], ['z', 0]]);
  chequear('Z sola no cambia la probabilidad', cerca(z[0], base[0]));

  const seguraH = await p(1, [['h', 0]]);
  chequear('H sobre una carta segura da 50/50', cerca(seguraH[0], 0.5));

  const hzh = await p(1, [['ry', theta, 0], ['h', 0], ['z', 0], ['h', 0]]);
  chequear('H, Z, H equivale a X', cerca(hzh[0], base[1]));

  const cnot = await p(2, [['x', 0], ['ry', theta, 1], ['cx', 0, 1]], 1);
  chequear('CNOT con control seguro en 1 invierte al target', cerca(cnot[0], base[1]));

  const bell = await p(2, [['h', 0], ['cx', 0, 1]], 1);
  chequear('Un par de Bell da 50/50 en cada carta', cerca(bell[0], 0.5));

  // Fase: ry(theta) deja x = sin(theta) > 0 (ket +); con Z pasa a ket −
  const fp = (await probabilidadesFaseGrupo(grupo(1, [['ry', theta, 0]])))[0];
  const fm = (await probabilidadesFaseGrupo(grupo(1, [['ry', theta, 0], ['z', 0]])))[0];
  chequear('Z invierte la fase', cerca(fp[0], (1 + Math.sin(theta)) / 2) && cerca(fp[0], fm[1]), `P(+)=${fp[0].toFixed(3)} → ${fm[0].toFixed(3)}`);

  const ryNeg = await probabilidadesFaseGrupo(grupo(1, [['ry', -theta, 0]]));
  chequear('ry con ángulo negativo da fase −', cerca(ryNeg[0][1], (1 + Math.sin(theta)) / 2));

  // Orden de bits de la medición real: X sobre el qubit 1 tiene que dar [0, 1]
  const bits = await medirGrupo(grupo(2, [['x', 1]]), backend);
  chequear('medirGrupo lee bien el orden de los qubits', bits[0] === 0 && bits[1] === 1, `bits=[${bits}]`);

  return resultados.join('\n');
}
