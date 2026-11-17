# CLAUDE.md — Frontend (src/frontend)

Reglas permanentes de la web. Complementan el `CLAUDE.md` de la raíz.

## Idioma
- Todo el código y los textos de la interfaz van en español.

## Fechas
- Las fechas se reciben en UTC (ISO 8601) y se muestran en `America/Costa_Rica`.

## Datos reales
- Nunca mostrar lecturas, estados ni confirmaciones inventadas. Sin dato real se
  muestra "Sin datos" o "Desactualizado".
- Los datos de ejemplo solo existen dentro de los tests.
- No mostrar controles que aparenten operar hardware si no hay integración real.

## Supabase y secretos
- Toda comunicación con Supabase pasa por `src/services/`; los componentes no
  importan `supabase-js`.
- Nunca usar la clave de servicio de Supabase; solo la clave publicable, leída
  desde `.env.local`.

## Estructura
- `src/pages/` — pantallas.
- `src/components/` — piezas reutilizables.
- `src/hooks/` — hooks.
- `src/models/` — tipos.
- `src/services/` — acceso a servicios externos.
- `src/utils/` — funciones auxiliares.
- `tests/` — pruebas.

## Convenciones
- Un componente por archivo, con nombre en PascalCase.
- Los hooks llevan el prefijo `use`.

## Calidad
- Cada cambio debe pasar lint, build y test (`/verificar`).
- Diseño responsivo, legible a 360 px y a 1280 px.
- Las pruebas automáticas no reemplazan la verificación real: no declarar nada probado con Supabase o la Pico si no se comprobó.

## Plan y contratos
- El plan de la web está en `src/frontend/PLAN.md`; cada prompt cita su fase y commit.
- `src/shared/contracts/*.md` manda sobre `src/models/contrato.ts`. Si difieren, se corrige el modelo, nunca el contrato.
- Los comandos y sus parámetros son idénticos a `src/firmware/common/utilities/comandos.py`; no inventar comandos.

## Controles de hardware
- Nada de estado optimista: un control muestra el estado nuevo solo con una confirmación real (`ok: true`).
- Todo control muestra con texto los estados de su contrato (p. ej. `lampara.md`: solicitud registrada, enviada, confirmada por la Pico, error, sin respuesta).
- Las lecturas de ambiente se consultan cada 10 s (sin Realtime) y se marcan como desactualizadas a los 30 s.

## Forma de trabajar
- No hacer commit ni push: mostrar el diff y proponer el mensaje (Conventional Commits, alcance `web`).
- No modificar `src/shared/`, `supabase/` ni `src/firmware/`: son de B y C.
