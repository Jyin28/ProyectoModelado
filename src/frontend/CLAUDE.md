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
