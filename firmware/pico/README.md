# firmware/pico — Firmware único (Raspberry Pi Pico 2 W)

## Propósito

Firmware de una sola Raspberry Pi Pico 2 W, compartida entre tres
protoboards, que en el proyecto completo:

- Lee los sensores de cuna, colchón y figuras LED.
- Envía datos de ingesta al backend por HTTPS.
- Recibe comandos de control por Realtime/WSS (Supabase).
- Controla el LED blanco (MOSFET IRLZ44N) y los seis LED comunes
  (resistencias de 330 Ω, sin WS2812B ni conversor de nivel).

## Hardware previsto (Sprint 3)

- 1 × Raspberry Pi Pico 2 W, alimentada por USB de computadora, tierra común.
- Sensor ambiental AM2301 (no SHT31).
- Sensor de movimiento PIR HC-SR501.
- LED blanco regulado mediante MOSFET IRLZ44N.
- 6 × LED comunes con resistencia de 330 Ω cada uno.
- HX711 + celda de carga de barra de 5 kg.
- Buzzer activo con transistor NPN, resistencia de 1 kΩ y botón físico.
- MAX98357A + parlante de 8 Ω / 0,5 W.
- Sin condensadores externos adicionales.
- Sin almacenamiento local de lecturas durante desconexiones para reenvío
  posterior.
- Demostración mediante hotspot del teléfono.

## Estado: pendiente

No existe código de firmware todavía. Quedan pendientes de verificar:

- Viabilidad real de TLS e I²S en la Pico 2 W para este hardware.
- Revisión eléctrica completa del circuito.
- Resistencia independiente del LED blanco (fuera del MOSFET).
- Fijación mecánica de la celda de carga.
- Modelos exactos de cada módulo (AM2301, HX711, MAX98357A, etc.).
- Mapa de GPIO definitivo.

Ninguna de estas verificaciones debe considerarse aprobada hasta que se
documenten resultados reales de prueba.
