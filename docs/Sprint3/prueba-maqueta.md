# Prueba de la maqueta del Sprint 3

Usar la Pico 2 W, alimentación USB, el hotspot del teléfono y cargas de
prueba. El equipo de circuitos confirma el cableado y el mapa de GPIO antes
de habilitar salidas. Registrar cada resultado con la rama o el commit que
se cargó a la placa.

## Preparar la prueba

- **A, web:** iniciar sesión con el cuidador de prueba y abrir Cuna.
  Mantener los paneles opcionales desactivados hasta la prueba de su módulo.
  [Configuración de la web](../../src/frontend/README.md)
- **B, Supabase:** verificar que `ingesta` está activa, que el cuidador tiene
  acceso al módulo de ambiente y que la cuenta de dispositivo de la lámpara
  está vinculada a su módulo. Para PIR, aplicar primero la migración de
  movimiento, registrar el módulo y desplegar la versión correspondiente de
  `ingesta`. [Contratos](../../src/shared/contracts/)
- **C, firmware:** cargar los archivos conservando la estructura de carpetas.
  Usar el `secrets.py` local para los datos de Wi-Fi y las credenciales de
  cada módulo. Conservar fuera de Git ese archivo. [Configuración de la Pico](../../src/firmware/README.md)

## Evidencia esperada

| Prueba | Resultado que se debe observar |
| --- | --- |
| Ambiente | La consola muestra una medición real y `HTTP 201`. Cuna muestra los mismos valores y la hora de medición. Tras interrumpir el envío, el dato anterior se marca desactualizado. Al reconectar aparece una medición nueva. |
| Lámpara | La Pico se suscribe al canal privado. Al solicitar una intensidad en la prueba controlada, cambia la luz y la web muestra la confirmación de la Pico. Verificar apagado, nivel intermedio y pérdida de conexión. |
| PIR | Con el monitoreo habilitado, un flanco de detección llega como evento y aparece su hora en Cuna. Con el monitoreo desactivado, una detección no crea un evento. |
| Seis figuras LED | La demo local enciende las seis salidas y ejecuta la secuencia. Verificar cada LED y el apagado final. |
| Colchón | Ejecutar primero el [menú del colchón](../../src/firmware/README.md#procedimiento-de-calibración-con-pesas-conocidas) con el montaje aislado. Con la celda calibrada usando una pesa conocida, registrar la referencia, demostrar el filtro de tres lecturas, detener el buzzer con el botón y rearmar con una referencia nueva. |
| Audio | Reproducir y detener el sonido de prueba, con volumen digital conservador y cableado verificado. Comprobar que se siguen leyendo sensores y que se mantienen los controles locales. |

Las pruebas en la computadora cubren reglas y mensajes con datos de prueba.
La negociación WSS en la Pico, TLS 1.3, la carga eléctrica y el efecto físico
se registran por separado cuando el equipo pueda comprobarlos en la maqueta.

## Resultado del montaje independiente del colchón

La Pico leyó el HX711 por DT en GP13 y SCK en GP12. Se completó la tara y
se usó un mouse como carga de prueba con una masa estimada. Al retirarlo,
el firmware pasó a alarma tras tres lecturas bajo el umbral. La medición en
gramos requiere calibración con una pesa conocida.

Con PWM a 2 kHz en GP18 se escucharon los tonos del buzzer pasivo. La Pico
confirmó GP18 en bajo al apagarlos. El ruido residual sigue presente y
requiere revisar el montaje. GP19 permaneció en alto durante la prueba
del botón.
