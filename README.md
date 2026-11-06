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

Requiere Node.js 24 y npm 11. Desde la raíz del repositorio, ejecuta en PowerShell:

```powershell
Set-Location .\src\frontend
npm.cmd ci
npm.cmd run dev
```

Abre la dirección que muestra Vite. Antes de pedir una revisión, ejecuta `npm.cmd run lint` y `npm.cmd run build` desde la misma carpeta.

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
