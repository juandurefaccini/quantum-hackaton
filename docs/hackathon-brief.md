# Quards — Brief del hackathon (Qollab × IonQ)

Documento de la tarea de entrega. Es el pedido que originó la carpeta `examples/` y los docs técnicos
de este repo. No describe el juego (eso es [`idea.md`](idea.md) y [`ARCHITECTURE.md`](ARCHITECTURE.md));
describe **qué se entrega al hackathon y por qué**.

## Contexto

Quards es un UNO cuántico 1v1 (persona vs IA), en JS vanilla con estética tipo Balatro. Cada carta
cuántica es un qubit con dos caras posibles (`|0⟩` y `|1⟩`); se mide recién al jugarla. Hay puertas
X/Z/H/CNOT (gratis, antes de jugar), entrelazado entre cartas y un "ojo" espía. El colapso pasa por un
puerto cuántico con tres adaptadores: `referencia` (local), `ionq` y `qiskit`.

## Requisitos de Qollab (Creative Challenge)

- Usar el framework **Qiskit**.
- Repo **público open source**, listado en Qollab con **ejemplos ejecutables**.
- Documentación suficiente para que otros entiendan, **repliquen o extiendan** el proyecto.
- **Accesibilidad básica** (contraste, tipografía legible).
- Público al menos **12 meses**.
- Código y docs bajo **licencia MIT**.
- Incluir **exactamente** esta atribución:

  > This effort is supported via compute credits from Qollab and IonQ.

## Criterios de evaluación (referencia iQuHACK/IonQ)

Utilidad del concepto · mérito técnico · creatividad · relevancia · comunicación.

## Entregables

| # | Entregable | Estado |
| :- | :-- | :-- |
| 1 | [`README.md`](../README.md) (inglés) — gancho, "Play it now", reglas, tabla cuántica, ejemplo Qiskit, motores, layout, aprendizaje, remix, licencia + atribución | ✅ (GIF **placeholder**) |
| 2 | [`README.es.md`](../README.es.md) (español) | ✅ |
| 3 | `docs/` — [`gates.md`](gates.md), [`quantum-concepts.md`](quantum-concepts.md), [`determinism.md`](determinism.md), [`engines.md`](engines.md), [`known-issues.md`](known-issues.md), [`roadmap.md`](roadmap.md) | ✅ |
| 4 | [`examples/quards_circuit.ipynb`](../examples/quards_circuit.ipynb) (+ `.py` y `requirements.txt` fijados) | ✅ (ejecutado) |
| 5 | `LICENSE` (MIT), topics, `.gitignore` | ✅ |

## Criterios de aceptación

- Alguien con el repo recién clonado puede **jugar** y **correr el notebook** siguiendo solo el README.
- Cada afirmación técnica está respaldada por el código o **marcada como no verificada**.
- Toda tabla de puertas fue **comprobada contra el simulador**.
- **Sin enlaces rotos**.
- **Atribución** de Qollab/IonQ y **licencia MIT** presentes.

## Lagunas declaradas

Ver [`known-issues.md`](known-issues.md) y [`engines.md`](engines.md). En resumen:

- Adaptadores **`ionq`** y **`qiskit`**: **no verificados** en este repo (sin key ni acceso a Qollab).
- **Notebook**: verificado localmente con `Statevector` (sin Aer). Falta correrlo en el **playground de
  Qollab (Pyodide)** para confirmar que las versiones fijadas coinciden con las forks parchadas de Qiskit.
- **`assets/demo.gif`**: placeholder (instrucciones para grabarlo en [`../assets/`](../assets/README.md)).
