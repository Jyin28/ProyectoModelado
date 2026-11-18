# Contexto: planificación del frontend (Persona A) — Cuna Inteligente IoT

Estado al 11 de noviembre de 2026. Resume **cómo se planificó el frontend** en un chat anterior. Complementa `contexto-actual.md` (contexto general del proyecto, hardware, requisitos y backend), que sigue vigente. Hasta este punto **no se ha implementado nada** del plan: solo se planificó.

## 1. Quién soy y qué me toca

- Soy Jacky, **Persona A (web)** del proyecto académico Cuna Inteligente IoT (curso Principios de Modelado, TEC, 2026).
- Responsabilidades: `src/frontend` (acceso, pantallas, lecturas, controles, conexión, historial), preparar los archivos de audio WAV y apoyar las pruebas.
- Persona B: Supabase, contratos, Telegram e integración. Persona C: firmware de la Pico 2 W.
- Trabajo con Claude Code en Windows + PowerShell (`npm.cmd`), con el plan Claude Pro.

## 2. Estado real del repositorio (difiere de `contexto-actual.md`)

Copia local: `C:\Users\jacky\OneDrive\Documents\AA CE\ProyectoModelado`.

- La web está en **`src/frontend`** (no en `apps/web`). Stack: React 19, TypeScript ~7, Vite 8 y oxlint. Scripts: dev, build, lint y preview. Todavía no hay tests.
- Ya existen `src/frontend/src/{assets,components,hooks,models,pages,services}` (vacías, con `.gitkeep`) y `src/frontend/tests/`.
- `App.tsx` es una página única con las secciones Cuna, Colchón y Figuras LED, el aviso "no hay datos" y seis indicadores "Sin datos".
- `.env.example` define `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, vacías.
- `src/shared/contracts/` está vacía y pertenece a B. `src/backend/` tiene carpetas reservadas; el backend real será Supabase.
- **Flujo Git del repositorio (`CLAUDE.md` de la raíz):** cada tarea parte de `development` en su propia rama y entra mediante un PR hacia `development`; `main` reúne las entregas estables. **No** se usan las ramas `codex/...` de `contexto-actual.md`. La copia local solo tenía `main`: hay que traer `development` primero.
- El `CLAUDE.md` de la raíz prohíbe:
  - mostrar mediciones inventadas o controles que aparenten operar hardware sin integración real;
  - tocar la documentación académica;
  - crear cosas en Supabase sin pedido explícito;
  - mostrar secretos;
  - hacer push sin aprobación.
- **Comandos provisionales que ya usa el firmware** (`src/firmware/common/utilities/comandos.py`):
  - Orden: `{command_id, command, params}`.
  - Confirmación: `{command_id, command, ok, result | error}`.
  - Comandos: `lamp_set {level 0–100}`, `led_set {index 0–5, on}`, `led_all {on}`, `led_sequence {name, step_s ≥ 2}`, `led_stop {}` y `get_status {}`.
  - Aún no existen comandos de colchón ni de audio.

## 3. Flujo de trabajo acordado con Claude Code

**Un commit es una sesión:**

1. `/clear` al empezar cada tarea.
2. **Modo plan siempre**, en los cinco commits de la fase 0. Revisar el plan antes de aprobarlo; si falla algo, corregirlo en el chat y pedir el plan de nuevo.
3. Implementar dando contexto con `@archivo` en vez de dejar que Claude explore todo el repositorio.
4. Verificar con lint + build + test y revisar a mano a 360 px y a 1280 px.
5. Revisar `git diff --staged`; Claude propone el mensaje del commit y yo hago el commit.

En los primeros commits, aprobar con revisión manual de cada cambio, no con aceptación automática.

Estructura de cada prompt: objetivo, contexto (`@archivos`), requisitos, trabajo concreto, restricciones, límites de modificación, pruebas, documentación, cierre y mensaje de commit.

| Configuración | ¿Va en un commit? |
|---|---|
| `src/frontend/CLAUDE.md` (reglas de la web) | Sí, commit 1 |
| `/verificar` (`.claude/commands/verificar.md`: lint, build y test con resumen) | Sí, commit 1. Alternativa pendiente de decidir: guardarlo solo para mí en `C:\Users\jacky\.claude\commands\` para no afectar al equipo |
| `.claude/settings.local.json` (permitir `npm.cmd run *` y git status/diff/add/commit; **prohibir `git push`**) | No, es personal. Comprobar con `git check-ignore -v .claude/settings.local.json` |
| Modelo | No. Sonnet para implementar; Opus, si el plan lo permite, solo para planificar lo complejo |
| MCP de Supabase | No. Solo para consultar |
| Tipos generados con `supabase gen types typescript` | Sí, más adelante, cuando B cree las tablas |

**Reglas del `src/frontend/CLAUDE.md`:**

- Todo en español.
- Fechas en UTC (ISO 8601), mostradas en America/Costa_Rica.
- Nunca datos inventados en la interfaz: "Sin datos" o "Desactualizado". Los datos de ejemplo solo existen en los tests.
- Todo Supabase pasa por `src/services/`.
- Carpetas: `pages/`, `components/`, `hooks/`, `models/`, `services/` y `utils/`. Un componente por archivo.
- Solo la clave publicable; nunca la clave de servicio.
- Cada cambio pasa lint, build y test.
- Diseño responsivo a 360 px y a 1280 px.

## 4. Plan de commits del frontend

Estrategia clave: avanzar sin depender de B y de C usando una **capa de servicios con interfaz**. Los datos de prueba existen solo en Vitest. Sin `.env.local`, la web muestra "Backend no configurado".

Ramas: una por fase, no una por commit (`feature/web-fundaciones`, `feature/web-auth`, `feature/web-ambiente`, etc.), cada una desde `development`.

### Fase 0: fundaciones (sin dependencias). Rama `feature/web-fundaciones`

1. `chore(web): agrega Vitest, reglas del frontend y comando verificar`
   - Vitest + Testing Library + jsdom, en versiones compatibles con Vite 8 y React 19.
   - Scripts `test` y `test:watch`.
   - Prueba mínima de App.
   - `src/frontend/CLAUDE.md` y `/verificar`.
   - README actualizado.
2. `feat(web): agrega rutas y estructura de pantallas`
   - Paquete `react-router`, no `react-router-dom`.
   - Rutas `/login` (solo un texto de "pendiente"), `/cuna`, `/colchon`, `/figuras` y `/historial`; `/` redirige a `/cuna`; `*` muestra "No encontrada".
   - `Layout` con navegación y enlace activo, apta para celular.
   - Mover el contenido actual de `App.tsx` a las páginas.
   - Tests con MemoryRouter.
   - Anotar que el hosting estático debe redirigir todas las rutas a `index.html`.
3. `feat(web): agrega componentes de estado de lectura y conexión`
   - `utils/tiempo.ts`: `formatearHoraCR` con `Intl` y `America/Costa_Rica`, `antiguedadSegundos`, `describirAntiguedad`, `estaDesactualizado` (null cuenta como desactualizado) y manejo de fechas inválidas.
   - `hooks/useAhora`.
   - `TarjetaLectura`: estados Sin datos / Actual / Desactualizado, distinguibles sin color.
   - `BannerConexion`: `sin-configurar | conectando | conectado | desconectado`.
   - En la página Cuna, temperatura y humedad con valor `null`.
   - Tests de límites, del cambio de día UTC→CR y con fake timers.
4. `feat(web): propone tipos del contrato para la web`
   - `models/contrato.ts`, marcado PROVISIONAL: `LecturaAmbiental`, `EventoMovimiento`, `LecturaPeso`, `Modulo`, una unión de comandos idéntica a la del firmware, `Comando`, `Confirmacion` y `EstadoComando` (`pendiente | confirmado | error | sin-respuesta`).
   - No inventar comandos de colchón ni de audio.
   - `models/validarComando.ts` con tests de límites.
   - `docs/Sprint3/contrato-web-propuesta.md`, con preguntas para B: tablas, identidad del dispositivo, cómo llegan las confirmaciones y tiempo de espera.
   - No tocar `src/shared/contracts/`.
5. `feat(web): agrega cliente Supabase y capa de servicios`
   - `@supabase/supabase-js` y tipado de las variables de entorno.
   - `services/supabase.ts`: crea el cliente solo si existen las dos variables; si no, `null` y `backendConfigurado = false`.
   - `services/tipos.ts` con las interfaces `ServicioLecturas`, `ServicioComandos` y `ServicioAuth`; las suscripciones devuelven una función para cancelar.
   - `services/noConfigurado.ts`, que nunca devuelve datos.
   - Proveedor y `hooks/useServicios`.
   - Banner: "Backend no configurado" sin variables; "Integración pendiente" con variables.
   - No consultar tablas.
   - Para este commit **no se necesita nada del equipo**. Solo para ver el banner configurado hace falta la clave publicable, que se pide a B por mensaje privado. La URL es `https://tlbwsdnqhwvuvgjcxgsg.supabase.co`.

**Qué revisar en cada plan:**

| Commit | Revisar |
|---|---|
| 1 | Versiones compatibles; no tocar nada fuera de `src/frontend/` y `.claude/` |
| 2 | `react-router`; mover el contenido sin borrarlo; navegación móvil |
| 3 | `Intl` en vez de restar 6 horas a mano; `null` en las páginas |
| 4 | Nombres idénticos a `comandos.py`; sin comandos inventados; no tocar `shared/` |
| 5 | Sin tablas, sin escribir con el MCP y sin mostrar claves; funcionar sin `.env.local` |

### Fase 1: acceso (requiere que B active Auth y dé un usuario de prueba)

6. Inicio y cierre de sesión con Supabase Auth; rutas protegidas.
7. Mostrar el bebé y el dispositivo del usuario (RLS).

### Fase 2: recorrido AM2301 → web (requiere tablas y respuestas al contrato)

8. Temperatura y humedad reales: última lectura + Realtime, antigüedad visible y "desactualizado" cuando pasan más de 10 s sin lecturas.

### Fase 3: primer control

9. Hook `useComando`: pendiente → confirmado / error / sin respuesta.
10. Lámpara: encender, apagar y regular de 0 a 100.

### Fase 4

11. Movimiento (PIR) y habilitar el monitoreo.
12. Seis figuras LED: individual, todas y secuencias con intervalo ≥ 2 s.

### Fase 5: colchón (planificar con calma)

13. Peso en vivo, captura de referencia y configuración de duración y tolerancia con validación.
14. Monitoreo, alarma, parada y rearme. Toda parada deja el monitoreo detenido; el rearme exige una referencia nueva.

### Fase 6

15. Catálogo de audio pregrabado (seleccionar, reproducir, detener) y preparación de los WAV PCM cortos.
16. Historial simple con horas de Costa Rica.

### Fase 7

17. Estados de desconexión y recuperación: colchón detenido después de reconectar.
18. `docs/Sprint3/validacion-web.md` con evidencia real.

## 5. Push y PR

- Pedir al equipo, una sola vez, permiso para subir libremente las ramas `feature/web-*`. La integración siempre será por PR revisado. Si no lo dan, subir solo al final de cada fase.
- Si hay permiso, subir al terminar cada día, como respaldo: el repositorio está en OneDrive y OneDrive puede sincronizar mal `.git`.
- Subir **después del commit 4** para que B vea pronto `contrato-web-propuesta.md`.
- Antes de cada push: `git status` (sin `.env.local` ni archivos ajenos), `git log --oneline origin/development..HEAD` y `/verificar`.
- El push lo hago yo, no Claude: `git push -u origin feature/web-fundaciones`.
- El PR se abre al terminar el commit 5, con **base `development`**. La descripción incluye los commits y las comprobaciones manuales a 360 px y 1280 px. Lo revisa B o C.

## 6. Primeros pasos y pendientes con el equipo

Para empezar:

```powershell
git fetch origin
git switch -c feature/web-fundaciones origin/development
```

Si `origin/development` no existe, preguntar al equipo; no crearla desde `main`.

Pedir a los compañeros:

1. A B: invitación a la organización de Supabase, al menos con lectura.
2. A B, antes de la fase 1: Auth activado y un usuario de prueba.
3. A B, antes de la fase 2: respuestas al contrato, sobre todo los nombres de las tablas.
4. A B y C, antes del commit 9: la forma definitiva del comando, de la confirmación y del tiempo de espera.

**Siguiente paso:** ejecutar el commit 1 de la fase 0. Si el próximo chat debe escribir prompts, que use la estructura de la sección 3 y el detalle de la sección 4.
