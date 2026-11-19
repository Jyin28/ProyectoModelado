# Validación de la fase 12 · Demostración modular y cierre

**Resultados reales de la ejecución del 2026-11-18.** Fase 12 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-29 y cierre.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase11-recuperacion` |
| Rama de trabajo | `feat/fase12-cierre` (commits locales, sin push) |

## 1. Qué se entrega

- [`guion-demostracion.md`](guion-demostracion.md): guion por módulo, cambio de protoboard, preparación de cuentas sin crearlas, tabla de resultados vacía (B1 a B10, P2, P3 y cuatro pruebas de integración), limitaciones y remisión a materiales y dimensiones.
- [`cierre.md`](cierre.md): estado final, pendientes y decisiones por confirmar.
- `README.md` de la raíz: instrucciones completas para ejecutar la web (requisitos, variables, banderas de hardware, comandos, pantallas y pruebas); `src/frontend/README.md` con la lista de variables al día.
- Matriz: CA-29.1 a CA-29.4 pasan de pendiente a parcial (prueba D).

## 2. Qué NO se hizo

Esta fase **no ejecutó el guion**: no hay hardware, cuentas de demostración ni acceso autorizado al Supabase real en esta sesión. Por eso la tabla de resultados del guion está vacía y CA-29.1 a CA-29.4 quedan en **parcial, con evidencia de documento (D)**, no verificados. La salida que pide el plan («cada CA con resultado, evidencia y versión probada o con una excepción») queda abierta hasta que el equipo ejecute el guion.

## 3. Verificación

Ver §2 de [`validacion-fase11.md`](validacion-fase11.md): las tres suites, el lint y el build se ejecutaron al cerrar la fase 11 y esta fase solo cambia documentación. La ejecución final se repite al preparar la PR (resultado en el cuerpo de la PR).

Los comandos del README se comprobaron contra `package.json` de `src/frontend` y de `supabase`: `dev`, `build`, `preview`, `lint` y `test` existen. `npm.cmd run dev` no se arrancó en un navegador.

## 4. Estado de los criterios

Total 145: 3 verificados (documentales), 139 parciales, 3 pendientes (CA-32.3, CA-35.1, CA-35.3), 0 bloqueados.
