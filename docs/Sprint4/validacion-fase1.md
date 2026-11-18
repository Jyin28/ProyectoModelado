# Validación de la fase 1 · Línea base y contratos

**Resultados reales de la ejecución del 2026-11-17.** Fase 1 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-31 y HU-32.

| Dato | Valor |
|---|---|
| Rama base | `development`, commit `386ca9a` (Merge pull request #12) |
| Rama de trabajo | `docs/fase1-linea-base` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |
| Node.js / npm | 26.13.1 / 11.20.0 |
| Python | 3.15.2 |
| Herramientas ausentes | Supabase CLI, Docker, Deno |

Los commits de esta fase se listan con `git log 386ca9a..docs/fase1-linea-base`.

## 1. Comandos ejecutados y resultados

| Comando (directorio) | Resultado |
|---|---|
| `npm.cmd ci` (`src/frontend`) | Instaló. Informó 6 vulnerabilidades de severidad alta (ver §4). |
| `npm.cmd test` (`src/frontend`) | **14 archivos, 159 pruebas, todas pasan** (Vitest 5.1.0). Duración total 19,8 s. |
| `npm.cmd run lint` (`src/frontend`) | Sin hallazgos (oxlint). |
| `npm.cmd run build` (`src/frontend`) | Correcto. 174 módulos transformados; `dist/index.html` 0,48 kB, CSS 5,58 kB, JS 275,60 kB (87,08 kB gzip). |
| `npm.cmd run dev` + `curl http://localhost:5173/` (`src/frontend`, sin `.env.local`) | HTTP 200; título `Cuna Inteligente IoT`. Servidor detenido después. |
| `npm.cmd ci` (`supabase`) | Instaló. 0 vulnerabilidades. |
| `npm.cmd test` (`supabase`) | **29 pruebas, 29 pasan, 0 fallan** (`node --test`, PGlite). |
| `python -m unittest discover -s src/firmware/tests` (raíz) | **171 pruebas, OK** (0,115 s). |
| `git ls-files`, `git check-ignore`, `git grep` de patrones de secretos en HEAD | Solo `src/frontend/.env.example` y `src/firmware/secrets.example.py` versionados. `.env.local`, `.env.production`, `supabase/.env` y `src/firmware/secrets.py` ignorados por Git (`.gitignore` líneas 94, 95 y 127). Sin coincidencias de patrones. |
| Misma búsqueda sobre los 73 commits de todas las ramas | Sin coincidencias. Ningún `.env`, `.env.local`, `.env.production` ni `secrets.py` fue agregado alguna vez al historial. |

Los patrones buscados fueron JWT (`eyJ…`), claves `sb_secret_…` y tokens de bot de Telegram. La búsqueda no imprime valores y no sustituye una revisión humana de credenciales con otro formato.

Fallos iniciales: ninguno. Las tres suites, el lint y el build pasan en el estado de `386ca9a`.

## 2. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| Web (159 pruebas) | Lógica de pantallas, sesión, consultas y lámpara con Supabase simulado | Conexión con Supabase real; visualización en 360 y 1280 px |
| Supabase (29 pruebas) | Migraciones, RLS, RPC e ingesta con PostgreSQL en memoria | Despliegue de la Edge Function, Realtime real, hardware |
| Firmware (171 pruebas) | Lógica de comandos, colchón, audio y lámpara remota con dispositivos simulados | TLS, NTP, I²S, GPIO ni sensores reales |
| Servidor de desarrollo | La web arranca sin claves y responde | Que muestre datos reales |

Una prueba simulada acredita lógica. Una prueba física requiere evidencia del equipo.

## 3. Estado de los criterios de HU-31 y HU-32

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-31.1 | verificado (documental) | `arquitectura.md` §1, §2 y §5: componentes, responsabilidades y diagramas de componentes, ingesta y comandos | Revisión y aceptación del equipo |
| CA-31.2 | parcial | `arquitectura.md` §4 y §5. Contratos vigentes de ambiente, movimiento y lámpara | Campos finales de los contratos de colchón, figuras, audio, habitación, juego y alimentación |
| CA-31.3 | parcial | `arquitectura.md` §6: alarma del colchón (según el código), toma, episodios fuera de rango, recuperación por módulo y horarios | Comportamientos «a confirmar» de §8 |
| CA-31.4 | parcial | `arquitectura.md` §7 | Controles de HU-02 a HU-29 por implementar |
| CA-32.1 | parcial | `entorno.md`; web, pruebas de Supabase y del firmware reproducidos | Backend en la nube no reproducido en local |
| CA-32.2 | verificado (documental) | §1: HEAD e historial sin patrones; archivos reales ignorados | Revisión humana de credenciales |
| CA-32.3 | **pendiente** | Solo prueba simulada (29 pruebas PGlite) | Enviar un evento a `cuna-inteligente-dev` y leerlo; guía en `entorno.md` §5 |
| CA-32.4 | verificado (documental) | `arquitectura.md` §3: servicios, protocolos y esquema | Revisión del equipo |

## 4. Hallazgos y defectos

1. **`npm audit` en `src/frontend`: 6 vulnerabilidades de severidad alta.** Directas: `vite`, `vitest`, `@vitejs/plugin-react`. Transitivas: `fdir`, `picomatch`, `tinyglobby`. No se aplicó `npm audit fix` para no cambiar versiones sin acuerdo. No se evaluó el impacto real. Revisar antes de la entrega.
2. **Documentación desactualizada** del firmware y del plan web: ver las 10 discrepancias en `matriz-hu-ca.md`. En particular `src/firmware/README.md:213` contradice el código sobre la calibración.
3. **Funcionalidad no demostrada contra Supabase real ni hardware.** Toda la evidencia es simulada. El recorrido AM2301 → Supabase → web figura como código existente y no como verificado.
4. **Web con bloques estáticos.** `/colchon`, `/figuras` e `/historial` son marcadores sin datos ni controles. Es el estado esperado; no hay datos inventados.
5. **Versión de Node.** La documentación existente menciona Node 24. Esta fase usó Node 26.13.1 y todo pasó. No se probó con Node 24.

## 5. Resumen de la matriz

Sobre los 145 criterios del PDF: 3 verificados (documentales), 57 parciales, 85 pendientes, 0 bloqueados. Detalle por criterio en [`matriz-hu-ca.md`](matriz-hu-ca.md).

Las fases siguientes quedan así respecto a la línea base:

| Fase | Situación de partida |
|---|---|
| 2 (diseño físico, HU-33) | Sin ficha de módulos; `docs/Sprint3/alcance.md` cubre solo el Sprint 3 |
| 3 (cuentas y propiedad) | Modelo de datos y RLS existen; no hay RPC ni web de bebés, dueños ni reasignación; falta registro |
| 4 (Telegram y horarios) | Sin código |
| 5 (cuna y figuras) | Ambiente, movimiento y lámpara de extremo a extremo (simulado); figuras y audio solo locales; sin voz |
| 6 (colchón) | Lógica y pruebas de firmware completas (simuladas); sin red, web, persistencia ni aviso |
| 7 a 9 (habitación, juego, alimentación) | Sin código |
| 10 (historial, gráficos y Excel) | Sin código; `/historial` es un marcador |
| 11 y 12 | No iniciadas |

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| CA-32.3 | Acceso al proyecto Supabase de desarrollo, Supabase CLI y un token de módulo de una persona del equipo con permisos |
| Pruebas físicas (todas las fases con hardware) | Evidencia del equipo; esta fase no la reunió |
| Decisiones de `arquitectura.md` §8 | Confirmación del equipo (voz, hueco en tomas, ventanas tras corte, órdenes generalizadas, matriz de navegadores, fotos, identificadores de módulos) |
| Identificadores HU de Jira | Confirmar la correspondencia probable de HU-30 a HU-35 |

## 7. Archivos creados

Todos en `docs/Sprint4/`:

- `arquitectura.md`
- `entorno.md`
- `matriz-hu-ca.md`
- `validacion-fase1.md` (este archivo)
- `PLAN-PROYECTO.md` (ya existía sin versionar; se incorpora al repositorio sin cambios)

No se modificó código en `src/` ni `supabase/`. No se creó nada en `cuna-inteligente-dev`. No se modificó documentación protegida. No se hizo push.
