# Contrato · Alimentación (tomas, balanza y temperatura del biberón)

Estado: **implementado y probado solo con PGlite y dobles de firmware y web**. Migración: `supabase/migrations/20261118000700_alimentacion.sql` (solo archivo local; no se aplicó a `cuna-inteligente-dev`). La orden `feeding_weigh` está en [ordenes.md](ordenes.md).

El módulo de alimentación es separado (`cuna-alimentacion-NN`). Tiene una celda de carga con HX711 y una sonda DS18B20. **Solo pesa y mide la temperatura**: no calienta, no enfría y no suministra alimento (CA-23.4). La web conduce la toma; la Pico pesa cuando se lo piden y el peso llega como evento, nunca en la respuesta de la orden.

## Flujo de una toma

```
crear_toma ─► preparando ─ pedir_peso_toma(inicial) ─► (evento de peso)
              │ iniciar_toma (exige peso inicial)
              ▼
           en_curso ⇄ pausada        (pausar_toma / reanudar_toma)
              │ finalizar_toma
              ▼
          por_cerrar ─ pedir_peso_toma(final) ─► (evento de peso)
              │ cerrar_toma (exige peso final válido)
              ▼
           completa   (ingerido_g = inicial − final)

preparando ─ cancelar_toma ─► cancelada
```

Solo hay una toma abierta por módulo (`toma_abierta`). La toma se crea para el bebé vigente del módulo (`sin_bebe_asignado` si no hay).

| Función (dueño activo) | Efecto | Errores |
|---|---|---|
| `crear_toma(p_toma_id uuid, p_device_id text)` | Crea la toma en `preparando`. Un reintento idéntico devuelve la misma toma. | `toma_abierta` (55000), `toma_id_en_uso` (23505), `sin_bebe_asignado` |
| `pedir_peso_toma(p_toma_id, p_momento, p_command_id)` | Crea la orden `feeding_weigh {toma_id, momento}` (vence en 15 s) y borra el último fallo de pesaje. Devuelve la orden (`command_id`, `estado`, `creado_en`, `vence_en`), **sin peso**. | `momento_invalido`, `command_id_requerido`, `estado_toma_invalido`, `command_id_en_uso` |
| `iniciar_toma(p_toma_id)` | `preparando` → `en_curso`; fija `inicio`. | `toma_sin_peso_inicial`, `estado_toma_invalido` |
| `pausar_toma` / `reanudar_toma` | Abre o cierra una pausa. | `estado_toma_invalido` |
| `finalizar_toma` | Cierra la pausa abierta, fija `fin` y pasa a `por_cerrar`. | `estado_toma_invalido` |
| `cerrar_toma` | Calcula `ingerido_g` y pasa a `completa`. | `toma_incompleta` (falta el peso final o es mayor que el inicial: nunca hay consumo negativo), `estado_toma_invalido` |
| `cancelar_toma` | Solo desde `preparando`. | `estado_toma_invalido` |
| `corregir_toma(p_toma_id, p_campo, p_valor, p_motivo)` | Cambia `peso_inicial_g` o `peso_final_g` y deja una corrección auditada; recalcula `ingerido_g` si la toma estaba completa. | `correccion_invalida`, `motivo_invalido` (vacío o más de 200), `estado_toma_invalido` |
| `mis_tomas(p_device_id, p_limite)` | `{ahora, tomas[]}`, de la más reciente a la más antigua. | `no_autorizado` |

Todas las funciones devuelven la toma como JSON, salvo `pedir_peso_toma` y `mis_tomas`. `no_autorizado` (`42501`) cubre sesión ausente, toma o módulo inexistente y quien no es dueño activo. `estado_toma_invalido` y `toma_abierta` son `55000`, `toma_id_en_uso` es `23505` y el resto de errores de validación son `22023`.

### Forma de la toma

```json
{ "id": "uuid", "device_id": "cuna-alimentacion-01", "bebe_id": "uuid",
  "estado": "preparando|en_curso|pausada|por_cerrar|completa|cancelada",
  "peso_inicial_g": 200, "peso_final_g": 150, "ingerido_g": 50,
  "peso_error": null, "creada_en": "...", "inicio": "...", "fin": "...",
  "duracion_activa_s": 780,
  "pausas": [{ "inicio": "...", "fin": "..." }],
  "correcciones": [{ "campo": "peso_final_g", "valor_anterior": 160, "valor_nuevo": 150,
                     "motivo": "balanza movida", "creada_en": "...", "propia": true }] }
```

- `duracion_activa_s` = `fin` (o `ahora`) − `inicio` − pausas, calculada en el servidor con su hora (CA-21.4: 08:00-08:15 con pausa 08:05-08:07 son 13 min). La web suma lo transcurrido desde que llegó la consulta solo mientras la toma está `en_curso`.
- `ingerido_g` solo existe con la toma `completa`. Un pesaje de **control** nunca cambia la toma (CA-21.5).
- `peso_error` es el último fallo de pesaje sin resolver: `sin_lectura` o `sin_calibracion`. Lo borra el siguiente pesaje pedido o recibido.
- Una corrección **no expone quién la hizo**: `propia` dice si fue la persona que consulta (la web muestra «Tú» u «Otro dueño»). El valor anterior se conserva siempre.
- Las tablas `tomas`, `pausas_toma` y `correcciones_toma` no tienen permisos directos para `authenticated`: todo pasa por las funciones.

## Eventos (Pico → Ingesta)

`POST /functions/v1/ingesta` con la credencial del módulo `cuna-alimentacion-NN`.

| `tipo` | `datos` | Efecto |
|---|---|---|
| `peso_alimentacion` | `{toma_id, momento, gramos}` | `inicial` (toma en `preparando`) y `final` (toma en `por_cerrar`) fijan el peso y exigen gramos > 0; `control` (`en_curso`, `pausada` o `por_cerrar`) solo queda como evento y puede ser 0. Máximo 5000 g. |
| `peso_alimentacion_fallido` | `{toma_id, momento, motivo}` con `motivo` en `sin_lectura` o `sin_calibracion` | Fija `peso_error`; el peso no cambia. |
| `temperatura_biberon` | `{temperatura_c}` entre -55 y 125 | Evento con valor en °C; evalúa los límites. |

- Cualquier clave de más, un momento incompatible con el estado de la toma, una toma de otro módulo o un número fuera de rango se rechaza con `400 evento_invalido`.
- Duplicados, `id_reutilizado` y `sin_asignacion` se tratan igual que en [habitacion.md](habitacion.md).
- La Pico conserva a lo sumo 8 eventos y los reintenta con el mismo `event_id`.
- La Pico nunca informa 85,0 °C (valor de arranque del DS18B20) ni lecturas fuera de rango: esas lecturas no se envían.

## Temperatura y límites del biberón

`guardar_limites_biberon(p_device_id, p_temp_min, p_temp_max)` y `mis_limites_biberon(p_device_id)` guardan por módulo `{temp_min, temp_max}` (entre -10 y 100, mínimo menor que máximo; `limites_invalidos` o `limite_invalido`, `22023`). Sin límites guardados no hay avisos y `mis_limites_biberon` devuelve `null`.

Al salir del rango se abre un episodio y se avisa por Telegram **una vez**: «Biberón por debajo del límite» o «Biberón por encima del límite». Frío y calor son episodios distintos: pasar de un lado al otro vuelve a avisar. Volver al rango cierra el episodio. Cruzar el límite deja además el evento `biberon_fuera_rango`.

La web consulta la última lectura cada 10 s. Sin lectura muestra «Sin datos»; con una lectura de más de 120 s (la Pico mide cada 30 s) muestra «Desactualizado» y su hora. No se calcula ni se rellena ningún valor.

## Recordatorios (HU-22)

Reusan el horario `recordatorio_alimentacion` ([ordenes.md](ordenes.md)): a cada hora, de `America/Costa_Rica`, se registra el aviso «Recordatorio de alimentación» por Telegram. Es solo un aviso: no crea ninguna orden para la Pico.

## Pendiente

- Celda de carga, HX711 y DS18B20 reales: calibración con una pesa conocida, estabilidad de lectura y fijación mecánica del recipiente.
- Botón físico de inicio (CA-20.2): no se implementó; la toma se inicia desde la web.
- Prueba con un servidor Supabase real y Telegram real (los avisos se probaron con dobles).
