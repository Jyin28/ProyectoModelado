# Contrato · Voz del cuidador hacia la cuna

Estado: **diseñado e implementado en el backend y el firmware con pruebas simuladas; sin probar con micrófono, red ni parlante reales**. El criterio HU-12 queda parcial hasta la prueba de banco P2.

## Principios

- La voz es solo en vivo. Nada se graba ni se guarda en la web, en Supabase ni en la Pico.
- Solo los dueños activos de la cuna envían. Solo la cuenta de la Pico de la cuna recibe.
- Solo se registra que hubo una sesión (evento `voz_inicio` y `voz_fin`), nunca audio.

## Transporte

Canal privado de Supabase Realtime `voz:<producto_id>` (por ejemplo `voz:cuna-01`). Políticas en `realtime.messages`:

- `voz_envia_dueno` (insert) y `voz_une_dueno` (select): dueños activos de un módulo `cuna` de ese producto.
- `voz_recibe_modulo` (select): la cuenta de dispositivo de ese producto (solo productos de tipo `cuna`).

Un mensaje de difusión enviado por un cliente no se guarda en `realtime.messages`. Esta suposición **no se verificó** con Supabase real.

## Mensajes (evento `voz`)

```json
{"seq": 17, "pcm": "<base64>"}
```

- Audio PCM de 16 bits con signo, little endian, mono, 8000 Hz.
- Un fragmento de 20 ms a 100 ms por mensaje: 160 a 800 muestras, 320 a 1600 bytes antes de base64.
- `seq` entero creciente desde 0 por sesión. La Pico descarta un `seq` repetido o menor que el último.
- Evento `voz_fin`: sin datos. Cierra la sesión y la Pico detiene la salida de audio.

## Límites en la Pico

- Una sesión de voz a la vez. Con audio local sonando (`audio_play`), la voz se rechaza y viceversa.
- Búfer máximo: 4 fragmentos de 100 ms. Si se llena, se descartan los más antiguos.
- Si no llega ningún fragmento en 2 s, o se pierde la conexión, la sesión se cierra.
- Volumen: el mismo tope de `AUDIO_VOLUMEN_MAX_PCT`.

## Registro de actividad

La web llama `public.registrar_actividad_voz(p_event_id, p_device_id, p_fase)` con `p_fase` igual a `inicio` o `fin` y un módulo `cuna-audio-NN`. Reenviar el mismo `p_event_id` devuelve `duplicado`.

## Pendiente de verificar (P2 y hardware)

- Retraso real de extremo a extremo y calidad con el MAX98357A y el parlante.
- Permiso de micrófono en el navegador del teléfono.
- Carga de memoria de la Pico con TLS, WebSocket y audio a la vez.
