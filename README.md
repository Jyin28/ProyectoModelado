# Cuna Inteligente IoT

Maqueta académica de un sistema de monitoreo y asistencia para bebés. El Sprint 3 se enfoca en la cuna, el colchón y las figuras LED, controlados por una Raspberry Pi Pico 2 W.

La base web muestra los tres módulos y sus estados iniciales. El primer avance funcional será mostrar en la web una lectura real de temperatura y humedad del AM2301 mediante Supabase.

## Estructura del repositorio

| Área | Contenido |
| --- | --- |
| [Web](src/frontend/) | Aplicación React, TypeScript y Vite. |
| [Firmware](src/firmware/) | Organización por módulos para el firmware de la Pico. |
| [Supabase](supabase/) | Espacio para las migraciones, políticas y funciones del backend. |
| [Integraciones](src/backend/) | Carpetas reservadas para código de integración. El backend previsto para el Sprint 3 es Supabase. |
| [Contratos compartidos](src/shared/contracts/) | Espacio para los formatos acordados entre web, firmware y backend. |
| [Documentación](docs/) | Requerimientos, decisiones, entregables y guías. |

## Ejecutar la web

### Requisitos

- Node.js 24 y npm 11.
- Git. En PowerShell usa `npm.cmd` si `npm` no se reconoce; en Git Bash basta `npm`.

### Pasos

Desde la raíz del repositorio, en PowerShell:

```powershell
Set-Location .\src\frontend
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Abre la dirección que muestra Vite (normalmente `http://localhost:5173`). Después de cambiar `.env.local`, reinicia `npm.cmd run dev`.

Sin completar `.env.local` la web arranca igual en **modo sin backend**: el banner dice «Backend no configurado», no se pide inicio de sesión y no se muestra ningún dato ni control que parezca operar hardware. Para trabajar con datos reales completa las dos primeras variables de la tabla.

### Variables de entorno (`src/frontend/.env.local`)

`.env.local` no se sube al repositorio. Nunca copies en él la clave de servicio (`service_role`): la web solo usa la clave publicable.

| Variable | Para qué sirve | Por defecto |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Dirección del proyecto Supabase. | vacía (modo sin backend) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable del proyecto. | vacía (modo sin backend) |
| `VITE_AMBIENTE_DEVICE_ID`, `VITE_LAMPARA_DEVICE_ID`, `VITE_MOVIMIENTO_DEVICE_ID`, `VITE_FIGURAS_DEVICE_ID`, `VITE_AUDIO_DEVICE_ID`, `VITE_COLCHON_DEVICE_ID`, `VITE_HABITACION_DEVICE_ID`, `VITE_ALIMENTACION_DEVICE_ID` | Identificador de cada módulo. | `cuna-<módulo>-01` |
| `VITE_CUNA_PRODUCTO_ID` | Producto de la cuna. | `cuna-01` |
| `VITE_TELEGRAM_BOT` | Usuario del bot (sin `@`) para ofrecer el enlace de vinculación. | vacía |

Las siguientes banderas activan controles que **operan hardware real**. Solo el valor exacto `true` las activa; vacías o con otro valor, esos controles no aparecen. Actívalas únicamente cuando exista el backend y la Pico configurada.

| Bandera | Qué activa |
| --- | --- |
| `VITE_ORDENES_HABILITADAS` | Figuras LED, audio, monitoreo de movimiento, controles del colchón, sensores de la habitación y pesaje de la alimentación. |
| `VITE_LAMPARA_HABILITADA` | Control de la lámpara en `/cuna`. |
| `VITE_MOVIMIENTO_HABILITADO` | Panel «Último movimiento» en `/cuna`. |
| `VITE_VOZ_HABILITADA` | Voz del cuidador en vivo (usa el micrófono del navegador). |
| `VITE_CAMARA_HABILITADA` | Pantalla `/habitacion/camara`, que usa un teléfono como cámara de la habitación. |

### Comandos

Desde `src/frontend`:

| Comando | Qué hace |
| --- | --- |
| `npm.cmd run dev` | Servidor de desarrollo con recarga. |
| `npm.cmd run build` | Comprueba los tipos y genera `dist/`. |
| `npm.cmd run preview` | Sirve `dist/` para revisar la versión compilada. |
| `npm.cmd run lint` | Revisa el código con oxlint. |
| `npm.cmd test` | Pruebas con Vitest. |

### Pantallas

| Ruta | Contenido |
| --- | --- |
| `/login`, `/registro` | Inicio de sesión y registro (con backend configurado). |
| `/cuna` | Temperatura, humedad, lámpara, movimiento, audio y voz. |
| `/bebes` | Bebés, dispositivos, dueños y destinatarios de Telegram. |
| `/colchon`, `/figuras`, `/habitacion`, `/habitacion/camara`, `/alimentacion` | Un módulo por pantalla. |
| `/historial` | Historial por bebé, resumen nocturno, gráficos y exportación a Excel. |

### Otras pruebas

```powershell
# Backend (PGlite, sin tocar ningún proyecto Supabase)
Set-Location .\supabase
npm.cmd ci
npm.cmd test

# Firmware (Python de escritorio, sin hardware); desde la raíz
python -m unittest discover -s src/firmware/tests
```

Las migraciones de `supabase/migrations/` son archivos locales: **no se aplican al proyecto Supabase real sin autorización del equipo**. Antes de pedir una revisión ejecuta `npm.cmd run lint`, `npm.cmd run build` y `npm.cmd test` en `src/frontend`.

La documentación del Sprint 4 (validaciones por fase, matriz de criterios, guion de demostración y cierre) está en [docs/Sprint4/](docs/Sprint4/).

## Trabajo por fases

1. Acordar el formato de lectura ambiental y cómo se identifica la Pico.
2. Preparar la lectura del sensor, la recepción en Supabase y la pantalla web.
3. Comprobar el recorrido completo con una lectura real y registrar la evidencia.
4. Incorporar los controles y los demás módulos por incrementos.

Cada tarea parte de `development` en su propia rama y se integra mediante un pull request hacia `development`. `main` reúne las entregas estables. El [reparto del equipo](docs/Sprint3/equipo.md) identifica las responsabilidades de web, backend y firmware.

## Documentos del proyecto

- [Alcance del Sprint 3](docs/Sprint3/alcance.md), [instalación en Windows](docs/Sprint3/entorno.md) y [validación de la base web](docs/Sprint3/validacion-base.md).
- [Entrega del Sprint 1](docs/Sprint1/README.md) y [entregable PDF](docs/Sprint1/EntregableSprint1.pdf).
- [Requerimientos consolidados](docs/Requerimientos/RequerimientosFinal.md), [especificación](docs/Requerimientos/EspecificacionRequerimientos.md) y [análisis del audio](docs/Requerimientos/RequerimientosAudio.md).
- [Backlog de Jira](docs/Jira/BacklogCompleto.md), [historias funcionales](docs/Jira/BacklogPreparado.md) y [decisiones aprobadas](docs/Jira/DecisionesAprobadas.md).
- [Material del curso](docs/Material%20del%20profe/).
