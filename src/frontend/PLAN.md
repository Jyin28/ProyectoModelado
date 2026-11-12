# Plan — Frontend de Cuna Inteligente IoT (Persona A)

Actualizado el 12 nov 2026 (CR), según `origin/development` (`34d7993`, PR #8). Cubre **solo la parte web**. Si algo difiere, manda el repo y los contratos de `src/shared/contracts/`. El reparto del equipo está en `docs/Sprint3/equipo.md`.

## 1. Resumen

- **Qué se evalúa**: incremento de producto (70 pts) en dos entregas de 35: **12 nov** y **26 nov**. El 26 nov el software debe cumplir los criterios de aceptación de `docs/Jira/BacklogPreparado.md`, con evidencia. También se entregan backlog actualizado y retrospectiva (5 pts).
- **Alcance vigente** (`docs/Sprint3/alcance.md`): cuna, colchón y figuras LED controlados por una Pico 2 W.
- **Roles**: A = web (`src/frontend`). B = Supabase, contratos, Telegram e integración. C = firmware de la Pico.
- **Stack**: React 19, TS ~7, Vite 8, react-router 8, Vitest 5, supabase-js 2. Windows + PowerShell (`npm.cmd`).

## 2. Reglas que no se rompen

- Nada de datos inventados ni controles que finjan operar hardware. Sin datos: «Sin datos» / «Desactualizado». Datos de ejemplo solo en tests.
- Nada de estado optimista: un control cambia de estado solo con confirmación real (`ok: true`) y muestra con texto los estados de su contrato (p. ej. `lampara.md`: solicitud registrada, enviada, confirmada por la Pico, error, sin respuesta).
- Supabase solo desde `src/services/`; solo la clave publicable; nunca secretos en el repo.
- `src/shared/contracts/*.md` manda sobre `src/models/contrato.ts`. Comandos idénticos a `src/firmware/common/utilities/comandos.py`; no inventar comandos.
- No modificar `src/shared/`, `supabase/`, `src/firmware/` ni la documentación académica.
- Fechas en UTC (ISO), mostradas en `America/Costa_Rica` con `Intl`.
- Responsivo a 360 px y 1280 px. Todo en español.
- Claude no hace commit ni push: muestra el diff y propone el mensaje (Conventional Commits, alcance `web`).
- Las pruebas no reemplazan la verificación real: no declarar nada probado con Supabase o la Pico si no se comprobó.

## 3. Lo que ya existe (no rehacer)

| Pieza | Dónde | Implementado | Verificado |
|---|---|---|---|
| Vitest, rutas, `Layout`, `TarjetaLectura`, `BannerConexion`, `utils/tiempo.ts`, `models/contrato.ts`, `validarComando`, cliente Supabase y capa de servicios | Fase 0 (PR #6) | Sí | Solo con tests |
| Auth: `services/auth.ts`, `ProveedorSesion`, `RutaProtegida`, `useSesion`, login con formulario, «Cerrar sesión» | PR #6 (B) | Sí | No, falta Supabase real |
| Última lectura de ambiente: `services/lecturas.ts`, `useUltimaAmbiental` (polling 10 s, desactualizado a 30 s) | PR #6 (B) | Sí | No |
| Lámpara: `PanelLampara`, `useLampara`, `services/lampara.ts` (RPC `solicitar_lampara`, polling 2 s de `public.ordenes_lampara`), tras `VITE_LAMPARA_HABILITADA=true` | PR #8 (B) | Sí | No, falta Supabase real y Pico |

Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_AMBIENTE_DEVICE_ID` (def. `cuna-ambiente-01`), `VITE_LAMPARA_HABILITADA`, `VITE_LAMPARA_DEVICE_ID` (def. `cuna-lampara-01`).

## 4. Contratos que usa la web

| Contrato | Dueño | Dónde | Estado |
|---|---|---|---|
| Ambiente | B | `src/shared/contracts/ambiente.md` | Vigente |
| Lámpara | B (canal), C (firmware) | `src/shared/contracts/lampara.md` | Vigente |
| Figuras LED | B y C | `figuras.md` (no existe) | Pendiente (H2) |
| Movimiento, peso, colchón, audio | B y C | — | Pendiente (H3) |

Leyenda de fases: 🟢 no depende de nadie · 🟡 depende de B/C · ⭐ imprescindible para la nota.

## 5. Fases

### Fase 1 — Plan y documentación al día · `docs/web-plan` · 12 nov · 🟢
- **Commit 6** `docs(web): agrega el plan y actualiza las reglas y el README de la web`. Solo `PLAN.md`, `CLAUDE.md`, `models/contrato.ts` (comentarios), `contrato-web-propuesta.md` y `README.md`. Sin código ni tests.
- Después: push, PR a `development` y mensaje a B sobre el reparto.

### Fase 2 — Verificación real de acceso y ambiente · 13 nov · 🟡⭐
Espera H1: despliegue, usuario de prueba y clave. Sin rama salvo fallos (`fix/web-<tema>`, un commit `fix(web): …`).
- `.env.local` desde `.env.example` (comprobar con `git check-ignore -v .env.local`).
- Casos manuales a 360/1280 px, con capturas y hora: redirección sin sesión, contraseña incorrecta, login correcto, sesión tras recarga, cerrar sesión, lectura «Actual», «Desactualizado» tras >30 s, modo offline, usuario sin acceso → «Sin datos», sin `.env.local` → banner «Backend no configurado».
- Si la Pico no envía aún: hacer los casos de auth y banner; anotar los demás como pendientes con motivo.
- Criterios: HU-01 CA-01.1–01.3, HU-09 CA-09.1/09.3, HU-11 CA-11.1 (si la Pico de lámpara está lista).

### Fase 3 — Historial de ambiente · `feature/web-historial` · 13–16 nov · 🟢⭐
`public.lecturas_ambiente` y su RLS ya existen.
- **Commit 7** `feat(web): consulta el historial de ambiente en Supabase`: `obtenerHistorialAmbiental(dispositivoId, desde, hasta)` en `services/lecturas.ts`. Mismo mapeo que `obtenerUltimaAmbiental`; `ts >= desde && ts < hasta`; orden ascendente; paginado con `.range()` de 1000 hasta 10 000 filas con indicador de truncado; descarta filas inválidas; error seguro. Tests: vacío, una página, varias, truncado, fila inválida, error.
- **Commit 8** `feat(web): muestra el historial de ambiente por intervalo`: conversión CR↔UTC en `utils/tiempo.ts` (con cambio de día); `useHistorialAmbiental` (consulta al pulsar, descarta respuestas viejas); `PaginaHistorial` con inicio/fin, atajos «Última hora» / «Últimas 24 h», validación (inicio < fin, sin futuro), tabla paginada de 50, «Sin registros en este intervalo», aviso de truncado, mín/máx/promedio. Sin backend/sesión explica qué falta.
- **Commit 9** (candidata HU-26) `feat(web): grafica temperatura y humedad del intervalo`: huecos >30 s como cortes (CA-26.4). Librería compatible con React 19 o SVG propio.
- **Commit 10** (candidata HU-27) `feat(web): exporta el historial de ambiente a Excel`: columnas de DEC-06 (`docs/Requerimientos/`); intervalo vacío → solo encabezados (CA-27.5).
- Criterios: HU-25 CA-25.1/25.4, HU-26 CA-26.3/26.4, HU-27 CA-27.1–27.5.

### Fase 4 — Figuras LED y movimiento · `feature/web-figuras` · 17–18 nov · 🟡
Espera H2 (`figuras.md`).
- **Commit 11** `feat(web): controla las seis figuras LED`: patrón de la lámpara (`services/figuras.ts`, `hooks/useFiguras.ts`, `PanelFiguras`); `validarComando` para `led_set {index 0–5, on}`, `led_all {on}`, `led_sequence {name, step_s ≥ 2}`, `led_stop {}`. CA-13.1 (manual), 13.2, 13.4. Sin contrato no se envía nada.
- **Commit 12** `feat(web): muestra el movimiento de la cuna`: solo si existen tabla y comando (HU-08 CA-08.1/08.3).

### Fase 5 — Colchón · `feature/web-colchon` · 19–22 nov · 🟡
Espera H3. Planificar con Opus en modo plan antes de empezar.
- **Commit 13**: peso en vivo.
- **Commit 14**: `validarConfigColchon` (duración > 0, tolerancia > 0, referencia válida; DEC-13), captura de referencia y activación (CA-14.1, 14.2, 14.5).
- **Commit 15**: alarma. «Detener alarma» deja el monitoreo detenido; «Rearmar» exige referencia nueva (CA-16.1–16.3; DEC-03).

### Fase 6 — Audio, recuperación y evidencia · `feature/web-cierre` · 23–26 nov · 🟡 + ⭐
- Fuera de la web: WAV PCM cortos; formato (frecuencia, bits, mono) y carpeta acordados con C.
- **Commit 16**: catálogo de audio (seleccionar, reproducir, detener) con los comandos de B y C (HU-11 CA-11.2/11.4).
- **Commit 17**: interrupción y recuperación; al reconectar, el colchón se ve detenido (HU-28 CA-28.3).
- **Commit 18** ⭐ `docs(web): registra la validación del incremento web`: `docs/Sprint3/validacion-web.md` con evidencia de las fases 2–6 (fecha, capturas), separando verificado de pendiente, al estilo de `validacion-base.md`. **Nunca se recorta.**

**Si hay atraso, recortar en este orden:** 17 → 16 → 12 → 10 → 9.

## 6. Dudas abiertas

| # | Duda | Para | Supuesto mientras tanto |
|---|---|---|---|
| 1 | Reparto de la web de aquí en adelante | B | A: historial, gráfico, exportación, figuras, colchón, audio. B avisa antes de tocar `src/frontend` |
| 2 | ¿Migraciones aplicadas, `ingesta` desplegada, usuario de prueba con `cuna-ambiente-01` y `cuna-lampara-01`? (H1, 13 nov) | B | No; la fase 2 espera |
| 3 | ¿Registro (`signUp`, CA-01.4)? | B | Solo login |
| 4 | Vista/RPC «mis módulos» (HU-03 CA-03.3) | B | `VITE_AMBIENTE_DEVICE_ID` |
| 5 | Contrato `figuras.md` (¿mismo patrón que lámpara? ¿nombres `chase`, `alternate`, `blink_all`?) (H2, 14 nov) | B y C | No se implementa envío |
| 6 | Comandos y estado de colchón y audio (H3, 18 nov) | B y C | Fases 5 y 6 esperan |
| 7 | Alcance del Sprint 4 | Equipo/profesor | Ver §9 |
| 8 | LED «por horario» (CA-13.1) | B | Solo manual |

Hito **H5 (23 nov)**: congelamiento de funciones.

## 7. Calendario

| Fecha | Trabajo |
|---|---|
| Jue 12 | Fase 1 + demo Sprint 3 |
| Vie 13 | Fase 2 (si B desplegó) |
| Vie 13 – Lun 16 | Fase 3 |
| Mar 17 – Mié 18 | Fase 4 |
| Jue 19 – Dom 22 | Fase 5 |
| Lun 23 | Fase 6 (audio, recuperación) |
| Mar 24 – Jue 26 | Commit 18, correcciones, retrospectiva, PR `development → main` |

## 8. Flujo de trabajo

- **Un commit = una sesión**: `/clear` → modo plan → revisar plan → implementar con `@archivos` → `/verificar` (lint + build + test) → revisar a 360 y 1280 px → `git diff --staged` → Claude propone mensaje, A hace el commit.
- Estructura de cada prompt: fase y commit de este plan, «Lee primero: @…», tarea, «No hagas», «Terminado cuando».
- Una rama por fase, desde `development` sin heredar upstream:

  ```powershell
  git fetch origin
  git switch --no-track -c feature/web-<nombre> origin/development
  git push -u origin feature/web-<nombre>   # primer push (lo hace A)
  ```

- Al empezar cada sesión: `git fetch origin` + `git rebase origin/development`; revisar si B tocó `src/frontend`.
- Antes de push: `git status` (sin `.env.local`), `git log --oneline origin/development..HEAD`, `/verificar`.
- Conflictos en `src/shared/`, `supabase/` o `src/firmware/`: no se resuelven aquí; avisar a B o C.
- PR a `development` con commits, capturas 360/1280 px y criterios cubiertos; lo revisa B o C.

## 9. Candidatas Sprint 4 (fuera del alcance actual)

HU-26 completa (movimiento por hora), HU-10 (límites ambientales, inferior < superior), HU-27 para todos los sensores, HU-02/HU-03 (bebés y dispositivos), HU-06 (destinatarios de Telegram).

## 10. Checklist de cierre (26 nov)

- [ ] PR de la web fusionados en `development`; `development → main` revisado
- [ ] `/verificar` en verde en `development`
- [ ] Clonar + `npm.cmd ci` + `npm.cmd run dev` funciona con y sin `.env.local`
- [ ] Sin secretos en el historial (`git log -p | Select-String service_role` vacío)
- [ ] Cada criterio demostrado con hardware real o marcado pendiente con motivo
- [ ] Ningún dato inventado en ninguna pantalla
- [ ] 360 y 1280 px revisados en todas las pantallas
- [ ] `docs/Sprint3/validacion-web.md` con evidencia real
- [ ] README de `src/frontend` actualizado (variables, rutas, estado real)
- [ ] Historias de la web actualizadas en Jira/backlog
- [ ] Aporte a la retrospectiva
