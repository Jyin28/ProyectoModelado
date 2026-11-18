# Validación de la fase 3 · Cuentas, bebés y propiedad histórica

**Resultados reales de la ejecución del 2026-11-17.** Fase 3 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-01 a HU-05 y base de HU-24.

| Dato | Valor |
|---|---|
| Rama base | `docs/fase2-diseno-fisico` |
| Rama de trabajo | `feat/fase3-cuentas` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |
| Node.js / Python | 26.13.1 / 3.15.2 |

Los commits de la fase se listan con `git log docs/fase2-diseno-fisico..feat/fase3-cuentas`.

## 1. Qué se construyó

**Base de datos** (`supabase/migrations/20261118000100_cuentas_propiedad.sql`, solo archivo local; no se aplicó a `cuna-inteligente-dev`):

- `bebes` gana `fecha_nacimiento` (opcional) y `creado_por`; `tutores_bebe` permite gestionar un bebé que aún no tiene módulo.
- `dispositivos` gana `tipo` (seis productos), `producto_id` (agrupa los módulos lógicos de un mismo producto físico; la cuna tiene ambiente, movimiento y lámpara) y `codigo_reclamo_sha256` (código de un solo uso).
- RPC para `authenticated`: `crear_bebe`, `mis_bebes`, `mis_dispositivos`, `reclamar_dispositivo`, `asignar_dispositivo`, `duenos_de`, `invitar_dueno`, `revocar_invitacion`, `mis_invitaciones`, `aceptar_invitacion`, `retirar_dueno`.
- Ninguna tabla nueva concede escritura ni borrado a un rol de API.

**Web** (`src/frontend`): `/registro`, `/bebes` («Bebés y dispositivos»), servicio `services/cuentas.ts`, `auth.registrarse`, enlace «Crear cuenta» en el login y entrada de navegación nueva.

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npm.cmd test` (`supabase`) | **39 pruebas, 39 pasan** (29 previas + 10 de `cuentas.test.mjs`) |
| `npm.cmd test` (`src/frontend`) | **17 archivos, 186 pruebas, todas pasan** (159 previas + 27 nuevas) |
| `npm.cmd run lint` (`src/frontend`) | Sin hallazgos |
| `npm.cmd run build` (`src/frontend`) | Correcto; 185 módulos |
| `python -m unittest discover -s src/firmware/tests` | 171 pruebas, OK (sin cambios de firmware) |
| `git grep` de patrones de JWT, `sb_secret_` y token de bot sobre lo agregado | Sin coincidencias |

Las pruebas existentes que fijaban la lista de navegación (cuatro enlaces) se actualizaron a cinco.

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `cuentas.test.mjs` (PGlite) | Lógica de las RPC, RLS y permisos con roles simulados | Supabase Auth real, el JWT con el correo verificado, concurrencia real |
| Pruebas web | Pantallas, validaciones y traducción de errores con servicios simulados | Conexión con Supabase real; visualización a 360 y 1280 px |

## 4. Estado de los criterios

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-01.1 a CA-01.3 | parcial (S) | Sin cambios respecto a la fase 1 | Prueba con Supabase Auth real |
| CA-01.4 | parcial (S) | `auth.registrarse`, `paginaRegistro.test.tsx`: campos vacíos no llegan al servidor, correo repetido (con error o con `identities` vacío) se rechaza | Prueba con Supabase Auth real y confirmación por correo configurada |
| CA-02.1 | parcial (S) | `cuentas.test.mjs`: dos bebés separados por cuenta | Vista de historial por bebé (fase 10) |
| CA-02.2 | parcial (S) | Un colchón se asigna a un bebé sin cuna | |
| CA-02.3 | parcial (S) | Nombre obligatorio, fecha opcional y no futura, en RPC y en web | |
| CA-03.1 | parcial (S) | `reclamar_dispositivo` con código de un solo uso | El alta física del módulo y de su código la sigue haciendo un administrador |
| CA-03.2, CA-03.4 | parcial (S) | Una cuna por bebé vía `producto_id`; la segunda se rechaza con `23505` sin tocar la primera | Confirmar con el equipo que «una cuna» equivale a un `producto_id` |
| CA-03.3 | parcial (S) | `/bebes` lista los módulos asociados con su bebé | |
| CA-04.1 | parcial (S) | Dos dueños leen por RLS la misma fila | Configuración compartida de módulos futuros |
| CA-04.2 | parcial (S) | «Administrar dueños» en cada módulo | |
| CA-04.3 | parcial (S) | Invitación solo concede acceso al aceptarla; retirar revoca y conserva filas; no se retira al último dueño; reinvitar a un retirado reactiva | **Envío del correo de invitación no existe** (sin SMTP): la persona ve la invitación al iniciar sesión con ese correo. La carrera de dos retiros simultáneos se resolvió con bloqueo de filas pero no se probó (PGlite es de una sola conexión) |
| CA-05.1 a CA-05.3 | parcial (S) | Reasignación con vigencia: lecturas antes y después quedan con su bebé; `delete` y `update` rechazados con `42501` | Prueba con Supabase real |
| CA-24.4, CA-24.7 | parcial (S) | Los mismos casos de reasignación y retiro | Cobertura de todos los tipos de evento (fase 10) |

Ninguno se declara verificado: toda la evidencia es simulada.

## 5. Decisiones tomadas

- **Una cuna por bebé** se modela con `producto_id`: los tres módulos lógicos de la cuna comparten producto; dos productos distintos de tipo `cuna` no pueden estar asignados al mismo bebé a la vez. Es una interpretación; el equipo debe confirmarla.
- **Reclamo de módulos por código**: el usuario final no puede crear dispositivos ni leer tokens. El código se entrega con el producto y se guarda solo su hash.
- **Invitación por correo** se resuelve dentro de la aplicación (el invitado la ve y acepta), comparando el correo del JWT. No se envía correo. Requiere que Supabase Auth emita el correo verificado.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Aplicar la migración | Autorización para tocar `cuna-inteligente-dev` (regla permanente) |
| Registro real y correo de invitación | Auth con confirmación por correo y SMTP configurados |
| Alta de módulos y de sus códigos de reclamo | Procedimiento de administrador (SQL manual documentado en `supabase/README.md`; pendiente agregar el código) |

## 7. Archivos

Creados: `supabase/migrations/20261118000100_cuentas_propiedad.sql`, `supabase/tests/cuentas.test.mjs`, `src/frontend/src/{models/cuentas.ts, services/cuentas.ts, hooks/useCuentas.ts, pages/PaginaBebesDispositivos.tsx, pages/PaginaRegistro.tsx, pages/cuentas.css}`, cinco componentes (`FormularioBebe`, `ReclamarModulo`, `AdministrarDuenos`, `TarjetaModulo`, `InvitacionesPendientes`) y tres archivos de prueba web.

Modificados: `supabase/package.json`, `src/frontend/src/{App.tsx, components/Layout.tsx, components/ProveedorServicios.tsx, pages/PaginaLogin.tsx, services/auth.ts, services/noConfigurado.ts, services/tipos.ts, utils/tiempo.ts}` y pruebas existentes (`rutas`, `noConfigurado`, `auth`, `sesion`).

No se creó nada en `cuna-inteligente-dev`. No se modificó documentación protegida. No se hizo push.
