"""Qards — una carta cuántica como circuito (Qiskit).

Una carta cuántica es un qubit en superposición; al jugarla (medirla) colapsa a
una de sus dos caras. Este script:

  1. arma una carta cuántica con una superposición sesgada y la mide muchas veces,
  2. le aplica una puerta X (intercambia las caras) y vuelve a medir,
  3. entrelaza dos cartas con un CNOT y muestra la correlación.

Usa **Qiskit puro** (`qiskit.quantum_info.Statevector`), sin backend ni Aer: el
estado se evalúa en Python y `sample_counts` lo muestrea. Por eso corre también
en el playground de Qollab (Pyodide), donde no hay wheels nativos.

    python -m pip install -r requirements.txt
    python qards_circuit.py

Para apuntarlo a IonQ, ver la nota al final del archivo.
"""

import math

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

SHOTS = 2000


def sample_counts(qc: QuantumCircuit, shots: int = SHOTS) -> dict:
    """Mide el circuito `shots` veces.

    Construye el `Statevector` del circuito (Python puro, sin backend) y lo
    muestrea. Muestrear el estado ES la medición: cada tirada colapsa a una cara.
    """
    return Statevector(qc).sample_counts(shots)


def show(title: str, counts: dict, shots: int = SHOTS) -> None:
    """Imprime una distribución ordenada como porcentajes."""
    print(f"\n{title}")
    for state in sorted(counts):
        n = int(counts[state])
        print(f"  |{state}>  {n:5d}  {100 * n / shots:5.1f}%")


# ---------------------------------------------------------------------------
# 1) La carta cuántica: un qubit en superposición y su medición (colapso).
# ---------------------------------------------------------------------------
# Cada carta tiene dos caras, una por cada resultado: |0> y |1>. La superposición
# se prepara con una rotación ry(theta). Para una carta con caras 80% / 20%,
# elegimos z = 0.6, con P(0) = (1+z)/2 = 0.8.
z = 0.6
theta = math.atan2(math.sqrt(1 - z * z), z)  # ángulo tal que P(0) = (1+z)/2 = 0.8

card = QuantumCircuit(1)   # un solo qubit; se mide con `sample_counts`
card.ry(theta, 0)          # prepara la superposición sobre el qubit 0

print(f"Carta cuántica — P(0) teórica = {(1 + z) / 2:.2f}")
show("Medición de la carta (2000 tiradas):", sample_counts(card))


# ---------------------------------------------------------------------------
# 2) La puerta X: intercambia las probabilidades de las dos caras.
# ---------------------------------------------------------------------------
# X aplica [[0,1],[1,0]]: cambia 0<->1 en la base de medición. No mide.
x_gate = QuantumCircuit(1)
x_gate.ry(theta, 0)   # misma superposición de antes...
x_gate.x(0)           # ...pero con X encima: las caras se dan vuelta
show("Después de la puerta X (las caras se intercambian):", sample_counts(x_gate))


# ---------------------------------------------------------------------------
# 3) El CNOT: entrelaza dos cartas (control -> target).
# ---------------------------------------------------------------------------
# Dos cartas. La primera en superposición 50/50 y la segunda en |0>. El CNOT copia
# el valor del control al target: los resultados quedan correlacionados (solo
# salen |00> y |11>, nunca |01> ni |10>).
pair = QuantumCircuit(2)
pair.ry(math.pi / 2, 0)   # carta A en superposición exacta (P(0) = 50%)
pair.cx(0, 1)             # CNOT: control = carta A, target = carta B
show("Par entrelazado (solo |00> y |11>):", sample_counts(pair))


# ---------------------------------------------------------------------------
# 4) La fase: H·Z·H ≡ X. La parte genuinamente cuántica.
# ---------------------------------------------------------------------------
# Una puerta Z no cambia las probabilidades visibles: solo mueve la fase. Esa fase
# "no se ve" hasta que una H la vuelve a mezclar; entonces H·Z·H actúa igual que X.
# Este es el lado Qiskit del test JS del repo (front/qards/tests/services.test.js):
# la misma comparación se corre contra el simulador de referencia del juego.
def hzh_is_x() -> None:
    hzh = QuantumCircuit(1)
    hzh.ry(theta, 0); hzh.h(0); hzh.z(0); hzh.h(0)
    xop = QuantumCircuit(1)
    xop.ry(theta, 0); xop.x(0)
    p_hzh = list(Statevector(hzh).probabilities())
    p_x = list(Statevector(xop).probabilities())
    assert all(abs(a - b) < 1e-9 for a, b in zip(p_hzh, p_x)), "H·Z·H debe coincidir con X"

    z_only = QuantumCircuit(1)
    z_only.ry(theta, 0); z_only.z(0)   # Z sola: la fase no cambia lo que se mide
    p_z = list(Statevector(z_only).probabilities())
    assert abs(float(p_z[0]) - (1 + z) / 2) < 1e-9, "Z sola no cambia las probabilidades"

    print("\nFase — H·Z·H ≡ X")
    print(f"  preparada  P(0) = {(1 + z) / 2:.2f}   (Z sola la deja igual: {float(p_z[0]):.2f})")
    print(f"  H·Z·H      P(0) = {float(p_hzh[0]):.2f}   X: {float(p_x[0]):.2f}   -> coinciden")


hzh_is_x()


# ---------------------------------------------------------------------------
# 5) IonQ (opcional, no verificado en este repo).
# ---------------------------------------------------------------------------
# Para correr el mismo circuito en IonQ hace falta un token. Con qiskit-ionq:
#
#     from qiskit_ionq import IonQProvider
#     provider = IonQProvider(token="TU_IONQ_API_KEY")
#     backend = provider.get_backend("ionq_simulator")   # o "ionq_qpu"
#     job = backend.run(transpile(pair, backend), shots=2000)
#     print(job.result().get_counts())
#
# En el juego, esto lo hace el adaptador `services/ionq.js` a través del proxy
# del dev-server (la key nunca llega al navegador). NO fue verificado en este
# repo: no hay token ni acceso a Qollab al momento de escribirlo.
print("\nListo. (IonQ es opcional y no está verificado en este repo.)")
