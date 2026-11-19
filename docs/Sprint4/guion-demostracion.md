# Guion de la demostración modular (HU-29)

**Estado: guion preparado, no ejecutado.** Nadie ha corrido este guion con hardware ni con el Supabase real. Todas las columnas de resultado están vacías a propósito: las llena el equipo durante la demostración. Fase 12 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md). Criterios: CA-29.1 a CA-29.4.

## 1. Reglas de la demostración

1. **Una sola Pico, un módulo por vez.** Se conecta una protoboard, se prueba, se desconecta y se pasa a la siguiente. La Pico no controla varios módulos a la vez (`docs/Sprint3/alcance.md`).
2. **Cambio de módulo.** Para cada módulo: desconectar la Pico del USB, cambiar la protoboard, poner el valor de `MODULO` en `src/firmware/pico/common/utilities/config.py` (`"cuna"`, `"figuras"`, `"colchon"`, `"habitacion"`, `"juego"` o `"alimentacion"`), copiar el firmware a la Pico, conectarla y esperar el mensaje de arranque. Un módulo inválido o sin cablear no genera lecturas falsas: solo se inicializa lo del módulo elegido.
3. **Una cuenta de dispositivo por producto.** `secrets.py` de la Pico lleva las claves `ORDENES_*` del producto del módulo que se conecta (ver `src/firmware/pico/secrets.example.py`). **No se escriben credenciales en este documento ni en el repositorio.**
4. **Red.** Hotspot del teléfono. Fijar el nombre y la clave solo en `secrets.py`.
5. **Sin datos inventados.** Si un módulo no responde, se anota el resultado como fallido o bloqueado; no se simula una respuesta en la web.
6. **Cableado revisado antes de energizar.** La revisión eléctrica sigue pendiente ([`diseno-fisico.md`](diseno-fisico.md) §3 y [`protocolo-banco.md`](protocolo-banco.md) regla 3). No conectar un módulo cuyo cableado no se haya revisado con multímetro.

## 2. Preparación (antes de la demostración)

### 2.1 Cuentas y datos de prueba

Estos pasos los hace una persona con acceso autorizado al proyecto Supabase de desarrollo. **El repositorio no crea cuentas ni datos** (regla del proyecto).

| Qué | Cantidad | Para qué |
|---|---|---|
| Cuenta de persona adulta (dueña) | 2 | La dueña opera todo. La segunda comprueba que otra cuenta con acceso ve lo mismo, y que una cuenta sin acceso no ve nada |
| Cuenta sin ningún módulo asociado | 1 | Comprobar la privacidad (HU-34) |
| Bebé de prueba | 2 (por ejemplo «Luna» y «Mateo») | Comprobar que cada bebé ve solo lo suyo |
| Cuenta de dispositivo por producto | 1 por producto (`cuna-01`, `figuras-01`, `colchon-01`, `habitacion-01`, `alimentacion-01`) | La Pico inicia sesión con ella |
| Destinatarios de Telegram | 1 o 2 | Recibir los avisos; se vinculan desde la pantalla «Bebés y dispositivos» |

Orden sugerido: crear las cuentas, registrar cada módulo y reclamarlo con su código desde la web, asociar cada módulo a un bebé, vincular Telegram y guardar los límites de ambiente.

### 2.2 Variables de la web

Copiar `src/frontend/.env.example` a `.env.local` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Para que los controles actúen sobre hardware real, poner a `true` solo las banderas de los módulos que se vayan a demostrar: `VITE_ORDENES_HABILITADAS`, `VITE_LAMPARA_HABILITADA`, `VITE_MOVIMIENTO_HABILITADO`, `VITE_VOZ_HABILITADA` y `VITE_CAMARA_HABILITADA`. Con una bandera apagada, los controles de ese módulo no se muestran. Detalle en el [README](../../README.md).

### 2.3 Banderas del firmware

En `config.py`, activar solo lo que esté cableado y revisado: `MONITOREO_MOVIMIENTO_HABILITADO`, `COLCHON_HABILITADO`, `AUDIO_HABILITADO`, `HABITACION_HABILITADO`, `JUEGO_HABILITADO`, `ALIMENTACION_HABILITADO`.

### 2.4 Verificación previa

- `npm.cmd run dev` abre la web, se inicia sesión y se ve el bebé elegido.
- `/historial` responde (aunque esté vacío).
- La Pico imprime «Ordenes: estado informado al servidor» tras unirse al canal.

## 3. Guion por módulo

En cada módulo: **adulto** = acción en la web o con la mano; **respuesta física** = lo que se debe observar; **registro** = lo que debe aparecer en la web.

### 3.1 Cuna · `MODULO = "cuna"` · CA-29.1

| Paso | Adulto | Respuesta física | Registro que debe aparecer |
|---|---|---|---|
| 1 | Abrir `/cuna` | — | Última lectura de temperatura (°C) y humedad (% HR) con fecha y hora de Costa Rica; «Desactualizado» si pasan 30 s sin lectura |
| 2 | Guardar límites en la web y calentar o humedecer el sensor hasta salir de rango | — | Un aviso en Telegram por episodio fuera de rango, y un registro en el historial |
| 3 | Mover la lámpara a 0, 25, 50 y 100 % | Brillo escalonado | Estado de la lámpara confirmado por la Pico |
| 4 | Activar el monitoreo de movimiento y pasar la mano frente al PIR | — | Un evento de movimiento por detección y su aviso; con el monitoreo apagado, ninguno |
| 5 | Reproducir el tono y detenerlo | Sonido suave; silencio al detener | Registro del audio en el historial |
| 6 | Voz en vivo (solo si se probó la prueba P2 del banco) | Voz del adulto por el parlante | Dos registros: inicio y fin de la sesión. **No se guarda audio** |

### 3.2 Figuras LED · `MODULO = "figuras"` · CA-29.1

| Paso | Adulto | Respuesta física | Registro |
|---|---|---|---|
| 1 | Abrir `/figuras` y encender los seis LED | Los seis encienden | Orden confirmada |
| 2 | Elegir `chase`, `alternate` y `blink_all` con intervalo de 2 s o más | Cambio de luces sin destellos bruscos | Secuencia en curso visible |
| 3 | Detener | Todos apagados | Estado «sin secuencia» |
| 4 | Programar un horario y esperar la hora | Encendido en el minuto exacto | Orden generada por el horario |

### 3.3 Colchón independiente · `MODULO = "colchon"` · CA-29.1 y CA-29.2

Se demuestra **sin la cuna**: la Pico y el colchón solos, con su propia alimentación USB (en la maqueta) y su propio producto.

| Paso | Adulto | Respuesta física | Registro |
|---|---|---|---|
| 1 | Poner el peso de referencia, calibrar con una masa conocida y activar el monitoreo desde `/colchon` | La Pico mide la referencia | «Monitoreo activo» con la referencia medida por la Pico |
| 2 | Quitar peso por encima de la tolerancia y mantenerlo | Alarma sonora tras las lecturas consecutivas | «ALARMA» y su aviso en Telegram |
| 3 | Detener con el botón, con la web y dejando vencer la alarma | Alarma apagada | «Detenido» con el motivo (botón, app o temporizador) |
| 4 | Desconectar el USB y volver a conectarlo | — | «Detenido al reiniciarse o reconectarse el módulo»; **armar de nuevo exige una referencia nueva** |
| 5 | Cortar el Wi-Fi con el monitoreo activo | La alarma se apaga y el monitoreo se detiene | «Detenido por pérdida de WiFi» al volver la red |

**Alimentación del colchón (CA-29.2):** en la demostración, por USB. Producto comercial: alimentación propia o tomada de la cuna, con el conector aún sin definir ([`diseno-fisico.md`](diseno-fisico.md) §3.3).

### 3.4 Habitación · `MODULO = "habitacion"` · CA-29.1

| Paso | Adulto | Respuesta física | Registro |
|---|---|---|---|
| 1 | Activar el monitoreo de puerta y el de movimiento en `/habitacion` | — | Estado de cada sensor confirmado |
| 2 | Abrir la puerta (imán del sensor reed) | — | Evento «Puerta» con su aviso y una solicitud de foto |
| 3 | Pasar frente al PIR | — | Evento «Movimiento en la habitación» con su aviso |
| 4 | Abrir `/habitacion/camara` en el teléfono que hace de cámara | El teléfono sube la foto pendiente | Foto visible solo para quienes son dueños, con el botón «Ver foto» |
| 5 | Apagar un sensor y repetir | — | Sin evento con el monitoreo apagado |

### 3.5 Juego de cinco botones · `MODULO = "juego"` · CA-29.1 y CA-29.3

El juego funciona **solo en la Pico, sin Wi-Fi** y no genera registros en la web (decisión de la fase 8).

| Paso | Adulto | Respuesta física | Registro |
|---|---|---|---|
| 1 | Conectar la Pico con la protoboard del juego | Se enciende el LED objetivo | Ninguno en la web |
| 2 | Pulsar el botón correcto | Recompensa; cambia el objetivo | — |
| 3 | Pulsar uno incorrecto | Sin recompensa; el objetivo se mantiene | — |

**Alimentación (CA-29.3):** el producto comercial funciona con baterías; la maqueta puede usar electricidad (USB).

### 3.6 Alimentación con pesaje · `MODULO = "alimentacion"` · CA-29.1

| Paso | Adulto | Respuesta física | Registro |
|---|---|---|---|
| 1 | Programar un recordatorio y esperar su hora | — | Aviso de Telegram en la hora local de Costa Rica |
| 2 | En `/alimentacion` iniciar una toma y pedir el peso inicial con el biberón en la balanza | La Pico mide | Peso inicial de la toma |
| 3 | Pedir un peso de control y luego el peso final | La Pico mide | Pesos de la toma, gramos ingeridos y duración |
| 4 | Ver la temperatura del biberón | — | Valor con fecha y hora (solo si la sonda existe) |
| 5 | Abrir `/historial` y exportar | — | Fila de la toma con `peso_inicial_g`, `peso_final_g`, `cantidad_g` y `duracion_s` en el Excel |

## 4. Cierre de la demostración

1. Abrir `/historial`, elegir un bebé y la noche de la demostración: el resumen y los gráficos deben mostrar lo que pasó, con las horas en Costa Rica.
2. Descargar el Excel y revisar que tenga una fila por registro y las columnas en el orden acordado.
3. Con la cuenta sin acceso, comprobar que no ve ningún dato ni foto.
4. Anotar el resultado de cada fila de la sección 5.

## 5. Tabla de resultados (se llena durante la demostración)

| ID | Módulo o prueba | Criterios | Estado | Fecha | Versión probada | Evidencia | Responsable |
|---|---|---|---|---|---|---|---|
| B1 a B3 | Pesaje: linealidad, repetibilidad y alarma | CA-14.1, CA-15.4, CA-20.1, CA-21.2 | | | | | |
| B4 | Cuna: AM2301 cada 10 s | CA-09.1, CA-09.3, CA-30.3 | | | | | |
| B5 | Cuna: PIR con monitoreo activo y apagado | CA-08.1, CA-08.3 | | | | | |
| B6 | Cuna: lámpara a 0, 25, 50 y 100 % | CA-11.1, CA-33.2 | | | | | |
| B7 | Alimentación: temperatura del biberón | CA-23.1, CA-23.3 | | | | | |
| B8 | Figuras: seis LED a 2 s o más | CA-13.3, CA-13.4 | | | | | |
| B9 | Habitación: reed y PIR | CA-17.1, CA-17.2, CA-17.4 | | | | | |
| B10 | Juego: cinco botones y LED | CA-19.1 a CA-19.5 | | | | | |
| P2 | Voz en vivo | CA-12.1 a CA-12.3, CA-34.5 | | | | | |
| P3 | Cámara y fotografía | CA-18.1 a CA-18.4, CA-07.4 | | | | | |
| D1 | Recorrido AM2301 a Supabase y web | CA-32.3 | | | | | |
| D2 | Reinicio de la Pico: el estado se informa y el colchón exige armar de nuevo | CA-28.3, CA-28.4 | | | | | |
| D3 | Rendimiento con la red real (100 consultas y 100 avisos) | CA-30.1, CA-30.2 | | | | | |
| D4 | Web a 360 y 1280 px | CA-35.1, CA-35.3 | | | | | |

Estados posibles: aprobado, fallido, bloqueado (con el recurso que falta) o excepción identificada. La evidencia es un registro de consola, una captura o una foto con fecha.

## 6. Limitaciones conocidas

- Nada del hardware se ha probado con evidencia; las pruebas existentes usan dobles ([`validacion-fase11.md`](validacion-fase11.md)).
- El disparador de aviso inmediato a Telegram (migración `20261118001000`) no se ha ejecutado; sin él los avisos salen con el trabajo programado de cada minuto, que no cumple los 5 s de HU-30.
- La conexión TLS y el audio I²S en la Pico no están verificados.
- La celda de carga necesita una fijación rígida que aún no existe.
- El juego no tiene registros en la web.
- El Excel no se ha abierto en Excel real ni la web en un navegador a 360 px.

## 7. Materiales, dimensiones y componentes (CA-29.4)

Las dimensiones, los materiales, la lista de componentes, los mapas de conexión y las sustituciones pendientes con el profesor están en [`diseno-fisico.md`](diseno-fisico.md) (§2 a §4 y §7). Cualquier sustitución de un sensor se coordina con el profesor antes de la demostración. Las cifras de ese documento son objetivos de diseño, no mediciones.
