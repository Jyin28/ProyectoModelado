# Diseño físico de la maqueta · Cuna Inteligente IoT

**Fase 2 del [plan de ejecución](PLAN-PROYECTO.md) · HU-33 (CA-33.1 a CA-33.6) y preparación de HU-29.**
Base: rama `docs/fase1-linea-base`. Fecha: 2026-11-17.

Este documento reúne los componentes, conexiones, alimentación, rangos, precisión y límites de los seis módulos. Distingue tres niveles de certeza. No acredita que algo esté construido, cableado ni medido.

| Marca | Significado |
|---|---|
| **Existe** | Hay código en `src/firmware/pico/` que usa el componente o el pin. No implica prueba física con evidencia. |
| **Bancada** | El equipo reportó una prueba en banco (`docs/Sprint3/prueba-maqueta.md`). No hay registro reproducible versionado. |
| **Propuesta** | Candidato de esta fase. **Sin confirmar con el equipo ni con el profesor.** No está comprado ni probado. |

Los valores de rango y precisión marcados «objetivo» son metas de diseño para medir en el banco ([`protocolo-banco.md`](protocolo-banco.md)). No son mediciones. Las cifras de hojas de datos y normas citadas de memoria deben cotejarse con el documento original antes de usarse en la entrega.

## 1. Reglas comunes

- **Una Pico 2 W por vez.** Se conecta a un módulo; `MODULO` en `src/firmware/pico/common/utilities/config.py:16` elige cuál. El firmware solo inicializa lo de ese módulo.
- **Maqueta:** alimentación por USB de computadora, tierra común, sin condensadores externos adicionales, red por hotspot del teléfono (`docs/Sprint3/alcance.md:43-57`).
- **GPIO reservados al chip Wi-Fi:** GP23, GP24, GP25 y GP29 (`config.py:4,83`).
- **Sin UPS** ni continuidad sin internet (CA-28.1). La interrupción detiene el funcionamiento.
- **Mapa vigente es provisional.** El propio `config.py:3` dice que los pines son provisionales y deben confirmarse con el equipo de circuitos. `alcance.md:59-66` deja pendientes la revisión eléctrica, la resistencia del LED blanco, la fijación de la celda de carga, los modelos exactos y el mapa definitivo.
- **Mecánica de eventos:** todo sensor que genera eventos los envía por la ingesta con `event_id` y `ts` UTC (ver [`arquitectura.md`](arquitectura.md) §4). Este documento no cambia contratos.

## 2. Resumen por módulo: producto comercial y maqueta

| Módulo | Alimentación comercial | Alimentación maqueta | Estado de componentes |
|---|---|---|---|
| Cuna | Tomacorriente, sin baterías (`docs/Requerimientos/RequerimientosFinal.md:18`) | USB de computadora | Existe en firmware; sin prueba física con evidencia |
| Figuras LED | Por definir (accesorio independiente) | USB | Existe en firmware |
| Colchón | Alimentación propia si se usa solo, o desde la cuna para evitar dos cables externos (`docs/Requerimientos/RequerimientosFinal.md:56`; conector sin definir) | USB | Existe en firmware; banco parcial |
| Habitación | Por definir | USB | **Propuesta**; sin código |
| Juego | Baterías (`docs/Requerimientos/RequerimientosFinal.md:83`) | USB; la maqueta puede usar electricidad (CA-29.3) | **Propuesta**; sin código |
| Alimentación | Conexión por cable al sistema (CA-33.6) | USB, cable de datos/energía hacia la Pico | **Propuesta**; sin código |

## 3. Fichas por módulo

### 3.1 Cuna (`MODULO = "cuna"`)

| Función | Componente | Pin / bus | Parámetros | Estado |
|---|---|---|---|---|
| Temperatura y humedad | AM2301, leído con `dht.DHT22` | GP2 (`config.py:19`; `sensores.py:14`) | Una lectura cada 10 s (`config.py:87`, DEC-07); °C y % HR | Existe. Verificar que sea AM2301 de un hilo y no AM2301B (I²C): `sensores.py:13` lo advierte |
| Movimiento | PIR HC-SR501 | GP3, entrada digital, 1 = movimiento (`config.py:20`; `sensores.py:17`) | Un evento por flanco de subida; el calentamiento inicial puede dar flancos falsos | Existe. Monitoreo apagado por defecto (`config.py:28`) |
| Lámpara | LED blanco + MOSFET IRLZ44N | GP13, compuerta (`config.py:21`) | PWM 1000 Hz (`config.py:31`); nivel 0 a 100 % | Existe. Resistencia independiente del LED sin verificar (`alcance.md:63`) |
| Audio | MAX98357A + parlante 8 Ω / 0,5 W | I²S: BCLK GP6, WS GP7 (BCLK + 1), DIN GP8 (`config.py:71-73`) | 16 kHz, 16 bits, mono; volumen 10 %, tope 25 %; tono de 500 Hz sintetizado, sin catálogo | Existe, apagado por defecto. Potencia real en el parlante sin medir (`README.md:204-207`) |
| Voz en vivo | Mismo amplificador y parlante | Por definir | Un sentido, celular a cuna; sin almacenar | **Propuesta.** Depende de la prueba P2 del banco |

**Dimensiones y materiales (cuna comercial, CA-33.5).** La especificación pide dimensiones de cuna estándar, con material y diseño propuestos por el equipo (`docs/Requerimientos/RequerimientosFinal.md:17`; `docs/Requerimientos/RequerimientosAudio.md:15` lo marca «SIN DEFINIR»). Referencias a cotejar con la norma vigente antes de fijarlas:

| Dato | Referencia propuesta | Estado |
|---|---|---|
| Colchón interior | Aprox. 130 × 70 cm (norma estadounidense de cunas de tamaño completo) o 120 × 60 cm / 140 × 70 cm (norma europea) | Por confirmar contra el texto de la norma |
| Separación entre barrotes | Máx. aprox. 6 cm | Por confirmar |
| Material | Madera maciza sin tratamientos tóxicos, laterales con barrotes; electrónica fuera del alcance del bebé | **Propuesta** |
| Maqueta | Escala reducida; la electrónica va en protoboard (CA-33.5) | **Propuesta** |

### 3.2 Figuras LED (`MODULO = "figuras"`)

| Función | Componente | Pin | Parámetros | Estado |
|---|---|---|---|---|
| Seis luces | 6 LED comunes, cada uno con resistencia de 330 Ω | GP18, GP19, GP20, GP21, GP22, GP26 (`config.py:22`) | Salidas de encendido/apagado, sin dimmer ni motor (CA-13.3); intervalo mínimo 2 s (`config.py:33`, DEC-08); secuencias `chase`, `alternate`, `blink_all` | Existe |

- **Brillo y seguridad (CA-33.2).** Los GPIO de la Pico operan a 3,3 V. Con 330 Ω y una caída directa típica de 2 V, la corriente estimada es de unos 4 mA por LED y unos 24 mA con los seis encendidos (cálculo de esta fase, no medición). El valor real depende del LED. Falta la revisión eléctrica (`alcance.md:59-66`) y verificar con multímetro que no se supera el límite de corriente de cada GPIO ni el total del chip según la hoja de datos de la RP2350. El límite de brillo se fija midiendo, no por cálculo.
- **Sin destellos abruptos (CA-13.4).** Intervalo mínimo de 2 s entre cambios. La intensidad física se concreta y verifica en el banco (prueba B8).
- **Comercial:** los LED de la figura quedan dentro de una carcasa difusora, sin partes desmontables pequeñas. **Propuesta.**

### 3.3 Colchón independiente (`MODULO = "colchon"`)

| Función | Componente | Pin integrado (propuesto) | Pin del banco | Parámetros | Estado |
|---|---|---|---|---|---|
| Peso | HX711 + celda de carga de barra de 5 kg | DT GP17, SCK GP16 (`config.py:42-43`) | DT GP13, SCK GP12 (`prueba_colchon.py:116`) | Canal A, ganancia 128, 24 bits; una lectura por segundo (`config.py:51`); 10 muestras promediadas para tara y referencia | Existe; banco: 10 muestras crudas válidas y una tara (`prueba-maqueta.md:45-48`) |
| Alarma sonora | Buzzer pasivo, transistor NPN, resistencia de 1 kΩ | GP14 (`config.py:44`) | GP18 (`prueba_colchon.py:117`) | PWM 2000 Hz (`config.py:45`) | Existe; banco: tono audible, ruido residual sin resolver |
| Botón físico | Pulsador a GND con pull-up interno | GP15 (`config.py:46`) | GP19 | Activo bajo; antirrebote de 50 ms (`config.py:58`) | Existe; banco: la línea se mantuvo en alto, sin registro de una pulsación detectada |

- **Calibración (CA-33.2).** No hay factor por defecto. Se calibra con una pesa de masa verificada con otra balanza (`README.md:265-279`). El factor se guarda en `calibracion.json`; la tara no se guarda. El rango de masa aceptado al calibrar es 0 a 5000 g (`comandos.py:146`).
- **Rango y precisión.** Rango: 0 a 5000 g (capacidad de la celda). Precisión objetivo: ±10 g con carga estática, **propuesta**. Con una referencia de 1000 g, la tolerancia de 10 % equivale a 100 g, de modo que ±10 g deja un margen de diez a uno frente al umbral de alarma. Se mide con las pruebas B1 a B3. El firmware no tiene dato de precisión; `README.md:276` dice que la diferencia observada la mide el equipo.
- **Límite del banco frente al producto.** Una celda de 5 kg no sostiene un colchón con bebé. La maqueta usa cargas de prueba pequeñas. El diseño comercial necesita un conjunto de celdas con capacidad total mucho mayor (por ejemplo, cuatro celdas, una por esquina). **Propuesta;** sin dimensionar.
- **Fijación de la celda:** pendiente (`alcance.md:64`).
- **Independencia (CA-33.3).** El colchón funciona sin la cuna; su alimentación es propia o compartida con la cuna (conector sin definir).

### 3.4 Habitación (**propuesta completa**, sin código)

| Función | Componente candidato | Pin propuesto | Parámetros | Estado |
|---|---|---|---|---|
| Apertura de puerta | Sensor magnético tipo reed (por ejemplo MC-38) | GP4, entrada con pull-up | Abierta = contacto abierto | Propuesta |
| Movimiento de habitación | PIR HC-SR501 | GP5, entrada | Igual que el PIR de la cuna | Propuesta. El PIR ya existe como componente, no como módulo |
| Cámara | Teléfono del equipo | — | Solo fotografías, sin video; sin resolución mínima (`docs/Requerimientos/RequerimientosAudio.md:89`) | Propuesta; mecanismo pendiente (`arquitectura.md` §8.6) |
| Alarma local | Ninguna | — | El evento solo genera aviso en Telegram (CA-17.3) | Requisito |

### 3.5 Juego de cinco botones (**propuesta completa**, sin código)

| Función | Componente candidato | Pines propuestos | Parámetros | Estado |
|---|---|---|---|---|
| Botones | 5 pulsadores arcade grandes | GP2, GP3, GP4, GP5, GP6; entradas con pull-up | Una pulsación por acción física | Propuesta |
| Luces | 5 LED con resistencia de 330 Ω, uno por botón | GP7, GP8, GP9, GP10, GP11 | Se ilumina solo el objetivo | Propuesta |
| Recompensa | Buzzer pasivo con NPN y 1 kΩ, como en el colchón | GP14 | Tono distinto para acierto | Propuesta |

- **Cinco botones fijos:** `docs/Requerimientos/RequerimientosFinal.md:85,172` los fija; `docs/Requerimientos/RequerimientosAudio.md:94` (A50) los llama ejemplo. Se toma el valor fijo.
- **Seguridad mecánica (CA-19.5, CA-33.2).** Producto comercial: diámetro mínimo propuesto de 30 mm y piezas fijadas de modo que no se desprendan; ninguna pieza debe caber en un cilindro de prueba para partes pequeñas (norma de juguetes aplicable, por confirmar). Es un requisito de diseño, no una verificación.
- **Alimentación:** comercial a baterías (por ejemplo, 3 pilas AA, **propuesta**); maqueta por USB (CA-29.3).
- **Conflicto con la cuna:** GP2 y GP3 coinciden con AM2301 y PIR de la cuna. Aceptable solo porque la Pico se conecta a un módulo por vez (ver §5).

### 3.6 Alimentación (**propuesta completa**, sin código)

| Función | Componente candidato | Pin propuesto | Parámetros | Estado |
|---|---|---|---|---|
| Balanza | HX711 + celda de carga de barra de 1 kg | DT GP17, SCK GP16 (reutiliza `colchon/hx711.py`) | Gramos. Rango 0 a 1000 g. Precisión objetivo ±2 g | Propuesta. El rango debe cubrir biberón lleno y recipiente |
| Temperatura del biberón | Sonda DS18B20 sellada (1-Wire) con resistencia de 4,7 kΩ | GP4 | Rango de la sonda aprox. −55 a 125 °C; exactitud de hoja de datos aprox. ±0,5 °C | Propuesta. Método por contacto con la pared; ver nota |
| Botón de inicio | Pulsador a GND con pull-up | GP15 | Registra hora e inicia el temporizador (CA-20.2) | Propuesta |
| Conexión al sistema | Cable USB (datos y energía) a la Pico | — | CA-33.6: el módulo se conecta por cable | Propuesta |

- **Método de temperatura (CA-33.2, DEC-12).** Sin definir por el cliente (`docs/Requerimientos/RequerimientosAudio.md:104`). Opciones: (a) sonda pegada a la pared exterior, con aislante; mide la pared, no el líquido, y subestima el calor; (b) sonda sumergida, más exacta pero con problemas de higiene y seguridad; (c) sensor infrarrojo sin contacto (por ejemplo MLX90614, I²C), con incertidumbre por emisividad del material. **Se propone (a) para la maqueta** por simplicidad, y la prueba B7 mide el error frente a un termómetro de referencia a unos 5 °C, 37 °C y 60 °C. Si el error excede el aceptable para los límites de frío y calor, se pasa a (c). El dispositivo no calienta ni enfría (CA-23.4).
- **Mismo recipiente (CA-20.4, CA-21.4).** La balanza debe permitir tara con el recipiente puesto y detectar que la medición final se hace sobre el mismo recipiente.
- **Rangos de temperatura de aviso:** los define el cuidador desde la app (CA-23.2); este documento no fija valores clínicos (DEC-07).

## 4. Mapas de conexión

### 4.1 Mapa integrado vigente (existe en `config.py`)

| GPIO | Módulo | Función |
|---|---|---|
| 2 | cuna | AM2301 |
| 3 | cuna | PIR |
| 6, 7, 8 | cuna | I²S BCLK, WS, DIN |
| 13 | cuna | Compuerta del MOSFET (lámpara) |
| 14 | colchón | Buzzer (base del NPN) |
| 15 | colchón | Botón |
| 16, 17 | colchón | HX711 SCK, DT |
| 18, 19, 20, 21, 22, 26 | figuras | Seis LED |
| 23, 24, 25, 29 | — | Reservados al Wi-Fi |

### 4.2 Mapas propuestos para los módulos nuevos

| GPIO | Habitación | Juego | Alimentación |
|---|---|---|---|
| 2 | — | Botón 1 | — |
| 3 | — | Botón 2 | — |
| 4 | Sensor reed (puerta) | Botón 3 | Sonda DS18B20 |
| 5 | PIR | Botón 4 | — |
| 6 | — | Botón 5 | — |
| 7, 8, 9, 10, 11 | — | LED 1 a 5 | — |
| 14 | — | Buzzer | — |
| 15 | — | — | Botón de inicio |
| 16 | — | — | HX711 SCK |
| 17 | — | — | HX711 DT |

Cada columna es un módulo y no repite pines dentro de sí. Los pines coinciden con los de otros módulos (por ejemplo GP2 y GP3 con AM2301 y PIR de la cuna); es aceptable solo porque la Pico se conecta a un módulo por vez (ver §5). Los GPIO libres hoy son GP0, GP1, GP4, GP5, GP9 a GP12, GP27 y GP28.

Estos pines son propuestas. Quedan sujetos a revisión eléctrica y a la decisión del equipo de circuitos.

## 5. Hallazgo: la prueba de pines repetidos no admite los módulos nuevos

`src/firmware/pico/tests/test_config_y_comandos.py:29-31` exige que `config.py` no tenga pines repetidos entre todos los módulos. La Pico 2 W ofrece 26 GPIO utilizables (GP0 a GP22 y GP26 a GP28). La configuración vigente ya usa 16. Quedan 10 libres: GP0, GP1, GP4, GP5, GP9, GP10, GP11, GP12, GP27 y GP28. Los tres módulos nuevos necesitan 17 pines. **No caben sin repetir.**

Como la Pico se conecta a un módulo por vez, repetir un GPIO entre módulos no genera conflicto real. La prueba debería comprobar la unicidad dentro de cada módulo. Cambiar esa prueba es trabajo de código y queda fuera de esta fase. Debe decidirlo quien implemente las fases 7 a 9.

## 6. Cobertura de CA-33.1 a CA-33.6

| CA | Qué cubre este documento | Estado | Qué falta |
|---|---|---|---|
| CA-33.1 | Lista de componentes de los seis módulos, con ambas balanzas, sensores, cámara, luces, audio, botones y alimentación (§3) | parcial | Confirmación del equipo y compra o existencia de los componentes propuestos |
| CA-33.2 | Rango, precisión objetivo, calibración, método de temperatura, brillo, volumen y seguridad mecánica (§3). Dimensiones y materiales solo como propuesta | parcial | Mediciones del banco para verificar viabilidad; norma de cunas y de juguetes cotejada |
| CA-33.3 | Cinco botones, colchón independiente y alimentación por módulo (§2, §3.3, §3.5). Las sustituciones listadas abajo aún no están coordinadas | parcial | Coordinación con el profesor |
| CA-33.4 | Alimentación y modularidad (§2); cinco botones (§3.5); límites de cámara (solo fotos) y audio | parcial | Comprobación sobre una maqueta construida |
| CA-33.5 | Referencias de dimensiones y materiales de la cuna (§3.1) | parcial | Valores de norma cotejados y plano de la maqueta a escala |
| CA-33.6 | Conexión por cable del módulo de alimentación (§3.6) | parcial | Cable y conector elegidos y probados |

Ninguno queda **verificado**. Todos son documentales y dependen de componentes o de pruebas presenciales.

## 7. Sustituciones y consultas pendientes con el profesor

La regla de coordinar toda sustitución de sensores aparece en `docs/Requerimientos/RequerimientosFinal.md:169,275`, DEC-12 y `docs/Jira/BacklogCompleto.md:354,361`. Ninguna de las siguientes tiene constancia de consulta en el repositorio.

| Elemento | Situación | Acción |
|---|---|---|
| AM2301 en lugar de SHT31 | Aparece en `alcance.md:46` sin registro de coordinación | Confirmar y registrar la respuesta |
| Teléfono como cámara | Permitido por `docs/Requerimientos/RequerimientosFinal.md:70-71` para la maqueta | Confirmar que cubre CA-18.1 |
| Celda de 1 kg para la balanza | Propuesta | Coordinar |
| DS18B20 y método por contacto | Propuesta | Coordinar |
| Pulsadores arcade del juego | Propuesta | Coordinar |
| Alarma del colchón (no en la cuna) | El chat original la ponía en la cuna; los requisitos finales, en el colchón | Registrar |

## 8. Discrepancias de hardware detectadas

| # | Documento | Dice | Realidad | Acción |
|---|---|---|---|---|
| 1 | `src/firmware/pico/README.md:37` | Carpetas `alimentacion/`, `habitacion/`, `juego/` vacías | No existen en `src/firmware/pico/` | Corregir el README al implementar |
| 2 | `matriz-hu-ca.md` (CA-15.2) | Buzzer en GP18 | GP18 es el pin del banco; el integrado usa GP14 (`config.py:44`) | Corregido en la matriz de esta fase |
| 3 | `matriz-hu-ca.md` (CA-08.1) | PIR en `sensores.py:30` | El pin está en `config.py:20` y se crea en `sensores.py:17` | Corregido en la matriz |
| 4 | `prueba_colchon.py` y `config.py` | Mapa de banco GP12, 13, 18 y 19 frente a mapa integrado GP14 a 17 | Dos mapas distintos para el mismo módulo; el banco choca con lámpara y figuras | Unificar al confirmar el mapa definitivo |
| 5 | `src/shared/contracts/ambiente.md:65` | Espera TLS 1.3 | El firmware usa TLS 1.2 (`README.md:107`) | Resolver en la fase 11 |
| 6 | `docs/Requerimientos/RequerimientosAudio.md:94` frente a `docs/Requerimientos/RequerimientosFinal.md:85` | Cinco botones «ejemplo» frente a cinco fijos | — | Se toma cinco fijos |
| 7 | `prueba-maqueta.md:52` | El botón GP19 «permaneció en alto» | Describe el reposo; no demuestra una pulsación detectada | Repetir la prueba con pulsación y registro |

## 9. Fuentes

- Especificación: `docs/Sprint1/EntregableSprint1.pdf` (HU-33, CA-33.1 a CA-33.6), reproducida en [`PLAN-PROYECTO.md`](PLAN-PROYECTO.md).
- Decisiones: `docs/Jira/DecisionesAprobadas.md` (DEC-07, DEC-08, DEC-12).
- Alcance del Sprint 3: `docs/Sprint3/alcance.md`, `docs/Sprint3/prueba-maqueta.md`.
- Código: `src/firmware/pico/common/utilities/config.py`, `src/firmware/pico/common/sensors/sensores.py`, `src/firmware/pico/colchon/`.
- Requisitos: `docs/Requerimientos/RequerimientosFinal.md`, `docs/Requerimientos/RequerimientosAudio.md`.
