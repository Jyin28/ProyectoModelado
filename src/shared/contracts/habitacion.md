# Contrato · Habitación (puerta, movimiento y fotografías)

Estado: **implementado y probado solo con PGlite y dobles de firmware y web**. Migración: `supabase/migrations/20261118000600_habitacion.sql` (solo archivo local; no se aplicó a `cuna-inteligente-dev`). La orden `room_monitor_set` está en [ordenes.md](ordenes.md).

La habitación es un módulo separado (`cuna-habitacion-NN`) con un sensor de puerta (reed) y un PIR. Cada uno tiene su propio monitoreo, apagado por defecto. No hay alarma sonora local (CA-17.3), no se distingue entrar de salir (CA-17.4) y no hay video (CA-18.4).

## Monitoreo (web → Pico)

`room_monitor_set {sensor: "puerta" | "movimiento", enabled: boolean}`. Cuando la Pico confirma, `estado_de_modulo` trae `monitoreo_puerta` o `monitoreo_movimiento`. Sin confirmación previa el estado está vacío y la web muestra «Sin confirmación de la Pico».

Horarios (hora de `America/Costa_Rica`, minuto exacto, una vez por día): `habitacion_puerta_activar`, `habitacion_puerta_desactivar`, `habitacion_movimiento_activar` y `habitacion_movimiento_desactivar`. El rango de monitoreo es la hora de activar y la de desactivar. Un horario vencido no se recupera.

## Eventos (Pico → Ingesta)

`POST /functions/v1/ingesta` con la credencial del módulo `cuna-habitacion-NN`. Cuerpo:

```json
{ "event_id": "uuid v4", "device_id": "cuna-habitacion-01", "tipo": "puerta",
  "ts": "2026-11-18T14:15:00Z", "datos": {} }
```

| `tipo` | `datos` | Aviso por Telegram | Foto |
|---|---|---|---|
| `puerta` | `{}` | Sí: «Se abrió la puerta de la habitación» | Una solicitud |
| `movimiento_habitacion` | `{}` | Sí: «Se detectó movimiento en la habitación» | Una solicitud |

- Cualquier clave en `datos`, un tipo desconocido o un identificador de dispositivo distinto de `cuna-habitacion-NN` se rechaza con `400 evento_invalido`.
- Si el monitoreo **de ese sensor** está confirmado como apagado, responde `409 monitoreo_inactivo` y no se guarda nada (sin reintento). Sin estado confirmado el evento se acepta, igual que con el PIR de la cuna.
- Puerta y movimiento durante el monitoreo son dos eventos y dos solicitudes de foto, aunque tengan la misma hora (CA-17.5). No se agrupan acciones distintas (CA-18.3).
- El mismo `event_id` con los mismos datos responde `409 evento_duplicado` y no repite aviso ni foto; con otros datos, `400 id_reutilizado`. Sin bebé asignado a esa hora, `422 sin_asignacion`.
- La Pico conserva a lo sumo 8 eventos, los reintenta con el mismo `event_id` durante 5 minutos y calcula la hora real del evento al enviarlo.

## Fotografías

Cada evento nuevo crea una fila en `public.fotos` con `estado = 'pendiente'`, el `bebe_id` del evento y la hora de solicitud. La fila nunca se borra ni cambia de evento o de bebé. Los dueños activos del módulo la leen (RLS); nadie escribe en la tabla directamente.

| `estado` | Significado | Campos |
|---|---|---|
| `pendiente` | Falta que una cámara suba la imagen | `ruta` y `motivo` nulos |
| `guardada` | La imagen está en el almacén | `ruta` obligatoria |
| `fallida` | No se tomó o no se subió | `motivo`: `camara_no_disponible` o `carga_fallida` |

**Cámara de la maqueta: el teléfono** (decisión de la fase 7; prueba P3 de [`protocolo-banco.md`](../../../docs/Sprint4/protocolo-banco.md) sin ejecutar). Una persona dueña abre `/habitacion/camara` (con `VITE_CAMARA_HABILITADA=true`), toma la foto y la web:

1. sube la imagen a `fotos-habitacion/<device_id>/<event_id>.<jpg|png>` sin sobrescribir;
2. llama `public.registrar_foto(p_event_id, p_ruta)`.

`registrar_foto` exige ser dueño, que la ruta sea exactamente la del evento, que el objeto exista y que la foto no esté ya guardada con otra ruta. Pasa la foto a `guardada` y registra el evento `foto_tomada` (texto fijo «Se tomó una fotografía», `datos {evento_id}`) con aviso por Telegram. Un reintento idéntico responde `duplicado` y no repite el aviso. Una foto `fallida` se puede reintentar. Si no se pudo tomar, `public.marcar_foto_fallida(p_event_id, p_motivo)` deja el estado visible; rechaza una foto ya guardada (`55000`).

**Telegram nunca recibe la imagen ni su ruta** (CA-07.4, CA-18.4): el texto del aviso sale de `eventos.descripcion`, nunca de `datos`.

## Almacén `fotos-habitacion`

Privado, solo `image/jpeg` e `image/png`, hasta 5 MiB. Políticas en `storage.objects`:

- Leer: dueño activo del dispositivo que nombra el primer segmento de la ruta.
- Subir: lo mismo y, además, solo si la foto de ese evento está `pendiente` o `fallida`.
- No hay políticas de actualización ni de borrado: una foto subida no se modifica ni se elimina (CA-24.7).

La web obtiene un enlace temporal de 60 s (`createSignedUrl`) para mostrar una foto. Retirar a un dueño le quita el acceso y conserva las fotos.

## Errores del RPC

| Código | Causa |
|---|---|
| `42501` `no_autorizado` | Sin sesión, foto inexistente o quien llama no es dueño activo (un solo error para todos los casos). |
| `22023` | `foto_invalida` (ruta distinta de la del evento), `foto_no_subida` (el objeto no existe) o `motivo_invalido`. |
| `55000` | `foto_ya_resuelta`. |

## Pendiente

- Prueba P3 con el teléfono y un almacén real, que requiere autorización para crear el bucket en `cuna-inteligente-dev`.
- Reed, PIR y cableado reales; tiempo entre el evento y la foto disponible.
- Un evento cuya foto nunca se sube queda `pendiente`: la web lo muestra así y no inventa un resultado.
