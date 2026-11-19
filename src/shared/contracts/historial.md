# Contrato · Historial por bebé y exportación

Estado: **implementado y probado solo con PGlite y dobles de la web**. Migración: `supabase/migrations/20261118000800_historial.sql` (solo archivo local; no se aplicó a `cuna-inteligente-dev`).

El historial es una consulta de lectura. No crea, modifica ni borra nada. La web usa la misma respuesta para el resumen, los gráficos, la lista y el Excel, de modo que los cuatro coinciden con lo almacenado.

## Función

`public.historial_bebe(p_bebe_id uuid, p_desde timestamptz, p_hasta timestamptz) returns jsonb`

- Solo para `authenticated`. Exige que la persona pueda ver al bebé (`cuna_private.puede_ver_bebe`: tutor del bebé, o dueña activa de un módulo que hoy lo tiene asignado). Sin sesión, bebé ajeno y bebé inexistente dan el mismo error `no_autorizado` (42501).
- El intervalo es `[desde, hasta)`: incluye `desde` y excluye `hasta`. `desde` debe ser anterior a `hasta` y el intervalo no puede pasar de 31 días; si no, `intervalo_invalido` (22023).
- El filtro es por `bebe_id` del registro, no por módulo. Un módulo reasignado a otro bebé no mezcla historiales: cada registro conserva el bebé con el que se guardó (CA-25.2 y CA-34.4).
- Tope de **20000 registros** por respuesta. Si hay más, `truncado = true` y se devuelven los más antiguos del intervalo. La web avisa y no exporta un resultado parcial.

## Respuesta

```json
{
  "ahora": "2026-11-19T12:00:00Z",
  "desde": "2026-11-19T01:00:00Z",
  "hasta": "2026-11-19T13:00:00Z",
  "truncado": false,
  "registros": [
    {
      "registro_id": "uuid o uuid:temperatura",
      "ts": "2026-11-19T03:30:15Z",
      "tipo": "toma_completa",
      "bebe_id": "uuid",
      "device_id": "cuna-alimentacion-01",
      "descripcion": "Toma completada",
      "valor": 60,
      "unidad": "g",
      "toma": { "peso_inicial_g": 250, "peso_final_g": 190, "cantidad_g": 60, "duracion_s": 900 },
      "foto": null
    }
  ]
}
```

Orden: `ts`, luego un orden fijo entre los registros que comparten instante (temperatura antes que humedad) y por último `registro_id`.

## Qué reúne

| Origen | Registros | `tipo` |
|---|---|---|
| `public.eventos` | uno por evento | el del evento (`puerta`, `movimiento`, `toma_completa`, `foto_tomada`, `alarma_colchon`…) |
| `public.lecturas_ambiente` | **dos** por lectura | `temperatura_ambiente` (°C) y `humedad_ambiente` (% HR); `registro_id` termina en `:temperatura` o `:humedad` |
| `public.eventos_movimiento` | uno, solo si su `event_id` no está en `eventos` | `movimiento` |

Un movimiento que está en `eventos` y en `eventos_movimiento` se cuenta una sola vez.

## Tomas y fotos

- `toma` es `null` salvo en los eventos cuyo `datos.toma_id` apunta a una toma del mismo bebé. Sus cuatro campos salen de `public.tomas` en el momento de la consulta: si una corrección auditada cambió el peso final, el historial muestra la cantidad corregida. En `toma_completa`, `valor` es la cantidad ingerida de la toma. `duracion_s` es la duración activa que calcula el servidor (sin pausas).
- `foto` es `{estado, ruta, motivo}` solo cuando el evento tiene una foto **y** quien consulta es dueña activa de ese módulo. Una tutora que no es dueña recibe el evento con `foto = null`. La imagen se abre con una URL firmada de 60 s (`services/habitacion.ts: urlFoto`); la ruta nunca va al Excel.

## Exportación .xlsx (DEC-06, HU-27)

La web genera el archivo con `write-excel-file` en el navegador, a partir de los registros ya consultados. No hay endpoint de exportación.

Encabezados, en este orden, y una fila por registro:

`fecha`, `hora`, `evento`, `bebe_id`, `dispositivo_id`, `descripcion`, `valor`, `unidad`, `peso_inicial_g`, `peso_final_g`, `cantidad_g`, `duracion_s`

- `fecha` (AAAA-MM-DD) y `hora` (HH:MM:SS) son de `America/Costa_Rica`.
- `evento` es el `tipo`. Los campos que no aplican quedan vacíos; las cuatro últimas columnas solo se llenan en eventos de toma.
- Sin formato decorativo, sin fotos y sin enlaces. Un período sin registros genera solo la fila de encabezados.
- Nombre: `historial-<bebé>-<fecha de inicio>.xlsx`.

## Intervalos por hora (CA-26.3 y CA-26.4)

La web agrupa los eventos por hora de reloj de Costa Rica en intervalos `[inicio, fin)`: 08:15 y 08:59 cuentan en `[08:00, 09:00)` y 09:00 en `[09:00, 10:00)`. Las mediciones no se cuentan como eventos. Una hora sin ningún registro es «Sin datos»; una con mediciones y sin eventos es «0».

## Errores

| Mensaje del servidor | Texto fijo en la web |
|---|---|
| `no_autorizado` | No tienes permiso para esta operación. |
| `intervalo_invalido` | El intervalo no es válido: el inicio debe ser anterior al fin y abarcar como máximo 31 días. |
| cualquier otro | No se pudo completar la operación. Intenta de nuevo. |
| respuesta con forma inesperada | No se pudo consultar el historial. |
