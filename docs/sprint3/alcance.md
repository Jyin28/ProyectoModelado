# Sprint 3 — Alcance

## Objetivo del incremento

Demostrar, en ocho días, un incremento verificable del proyecto Cuna
Inteligente IoT compuesto por cuna, colchón y figuras LED, controlados por
una sola Raspberry Pi Pico 2 W, alimentados por USB de computadora.

## Esta fase (base ejecutable)

- Estructura de carpetas para tres personas (web, backend, firmware).
- Aplicación web mínima (`apps/web`) que:
  - Muestra el nombre "Cuna Inteligente IoT".
  - Presenta las secciones Cuna, Colchón y Figuras LED.
  - Indica explícitamente que no hay datos recibidos del dispositivo.
  - Muestra seis indicadores visuales para las figuras, sin atribuirles un
    estado físico confirmado.
  - Es legible en celular y computadora.
  - Funciona sin claves de Supabase configuradas.
- Documentación de las decisiones de hardware vigentes para el Sprint 3.
- Proyecto Supabase `cuna-inteligente-dev` comprobado por lectura (sin
  tablas, sin cambios).

Esta fase no implementa autenticación, conexión real al backend, firmware
ni controles de hardware.

## Funciones posteriores (fuera de esta fase)

- Firmware de la Pico 2 W: lectura de AM2301, PIR HC-SR501, HX711 +
  celda de carga, control de LED blanco (MOSFET IRLZ44N) y de los seis LED
  comunes, buzzer activo, audio por MAX98357A.
- Ingesta de datos reales por HTTPS hacia Supabase.
- Canal de comandos definitivo por Realtime/WSS.
- Autenticación (Auth) y seguridad a nivel de fila (RLS) aplicadas a datos
  reales.
- Notificaciones por Telegram.
- Tareas programadas (pg_cron).
- Validación eléctrica completa y mapa de GPIO definitivo.

## Restricciones vigentes del hardware (Sprint 3)

- Una Pico 2 W compartida entre tres protoboards.
- Sensor ambiental AM2301 (no SHT31).
- PIR HC-SR501.
- LED blanco regulado con MOSFET IRLZ44N.
- Seis LED comunes con resistencias de 330 Ω; sin WS2812B ni conversor.
- HX711 y celda de carga de barra de 5 kg.
- Buzzer activo con transistor NPN, resistencia de 1 kΩ y botón físico.
- MAX98357A y parlante de 8 Ω / 0,5 W.
- Alimentación USB y tierra común.
- Sin condensadores externos adicionales.
- Sin almacenamiento local de lecturas durante desconexiones para reenvío
  posterior.
- Demostración mediante hotspot del teléfono.

## Pendiente de verificación (no declarado como aprobado)

- Viabilidad del firmware, TLS e I²S en la Pico 2 W.
- Revisión eléctrica completa.
- Resistencia independiente del LED blanco.
- Fijación mecánica de la celda de carga.
- Modelos exactos de cada módulo.
- Mapa de GPIO definitivo.
