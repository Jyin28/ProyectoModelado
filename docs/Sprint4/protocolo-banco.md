# Protocolo de banco · Cuna Inteligente IoT

**Fase 2 del [plan de ejecución](PLAN-PROYECTO.md) · preparación de HU-29 y comprobación de interfaces de HU-33.**
Base: rama `docs/fase1-linea-base`. Fecha: 2026-11-17.

Este protocolo define cómo comprobar en banco cada módulo descrito en [`diseno-fisico.md`](diseno-fisico.md). **Ninguna prueba de este documento se ejecutó.** Cada una queda en estado `pendiente`. Una prueba solo pasa a `verificado` cuando el equipo adjunta la evidencia indicada. Una prueba simulada acredita lógica; una prueba física requiere evidencia del equipo.

## 1. Reglas del banco

1. **Un módulo por vez.** Desconectar la Pico del USB antes de cambiar de protoboard. Editar `MODULO` en `src/firmware/common/utilities/config.py`, copiar el archivo a la Pico y reiniciar (`docs/Sprint3/prueba-maqueta.md:3-7`).
2. **Registrar la versión.** Anotar la rama y el commit cargados en la placa.
3. **Cableado revisado primero.** Antes de energizar, otra persona del equipo revisa el montaje contra el mapa de [`diseno-fisico.md`](diseno-fisico.md) §4. Esta revisión **no** sustituye la revisión eléctrica pendiente de `alcance.md:59-66`.
4. **Credenciales fuera del repositorio.** El `secrets.py` real permanece local y no se copia a ninguna evidencia.
5. **Evidencia mínima por prueba:** fecha y hora, nombre de quien ejecutó, commit, foto del montaje, registro de consola en texto y, cuando aplique, video corto. Guardar en una carpeta del equipo; no subir fotos de personas ni credenciales.
6. **Un criterio no medido no se declara aprobado.** Si falta un instrumento, la prueba queda `bloqueada` y se anota el recurso que falta.

## 2. Orden de ejecución

El plan pide empezar por las pruebas que podrían condicionar la arquitectura: pesaje, voz y cámara. El resto sigue por módulo.

| Orden | Prueba | Módulo | Por qué va antes |
|---|---|---|---|
| 1 | B1 a B3 Pesaje | Colchón y alimentación | Fija rango y precisión; decide la celda de la balanza de alimentación |
| 2 | P2 Voz en vivo | Cuna | Decide el transporte (`arquitectura.md` §8.1) |
| 3 | P3 Cámara | Habitación | Decide el mecanismo de fotos (`arquitectura.md` §8.6) |
| 4 | B4 a B10 | Resto | Verificación por módulo |

## 3. Pruebas prioritarias

### B1 a B3 · Pesaje (HX711 y celda de carga)

- **Criterios:** CA-33.1, CA-33.2, CA-14.1, CA-15.4, CA-20.1, CA-21.2, CA-30.3. Prueba de apoyo para CA-30.4 (peso cada segundo).
- **Material:**
  - Pico 2 W, HX711 y celda de barra de 5 kg (colchón); celda de 1 kg propuesta (alimentación), si existe.
  - Pesas de masa conocida (por ejemplo 100 g, 200 g, 500 g, 1000 g) y una balanza de referencia para verificarlas. **Si no hay balanza de referencia, la prueba queda bloqueada.**
  - Fijación rígida de la celda (pendiente según `alcance.md:64`).
- **Montaje:** colchón con el mapa del banco (DT GP13, SCK GP12) y el menú `src/firmware/colchon/prueba_colchon.py`. Alimentación con celda de 1 kg y pines GP17 / GP16 solo cuando haya firmware (fase 9); mientras tanto, la misma prueba con el menú existente sirve para caracterizar la celda.
- **B1, linealidad y calibración.**
  1. Celda fija y sin carga. Opción 2 del menú (tara).
  2. Colocar una pesa verificada. Opción 7 (calibrar) con su masa en gramos (`README.md:265-279`).
  3. Retirar la pesa y colocar las demás una por una. Opción 1 (leer peso) tres veces por pesa.
  4. Anotar lectura, error absoluto y error relativo.
  - **Esperado:** error ≤ ±10 g en el rango de 0 a 5000 g de la celda (objetivo propuesto de `diseno-fisico.md` §3.3). Un error mayor no «falla» la historia; se registra y se decide con el equipo.
- **B2, repetibilidad y deriva.** Con 500 g fijos, registrar 60 lecturas consecutivas a una por segundo (`config.py:51`). Anotar mínimo, máximo, desviación y deriva de la tara a los 10 minutos. Registrar los tiempos entre lecturas para CA-30.3.
- **B3, escenario de alarma (CA-15.4).** Con referencia de 1000 g y tolerancia del 10 %:

  | Secuencia | Resultado esperado |
  |---|---|
  | 890 g, 890 g, 890 g | Alarma |
  | 900 g, 900 g, 900 g | Sin alarma |
  | 890 g, 1000 g, 890 g | Sin alarma (el filtro se reinicia) |

  Repetir las paradas por botón físico, por `mattress_stop` y por el vencimiento de la alarma (60 s). Después de cada parada, verificar que `mattress_status` indica monitoreo detenido y que armar de nuevo exige una referencia nueva.
- **Evidencia:** registro de consola completo, foto del montaje, tabla de errores.
- **Qué queda abierto:** la prueba del 2026-10 con un «mouse» de masa estimada (`prueba-maqueta.md:46`) no es una medición. No se reutiliza como evidencia.

### P2 · Voz en vivo (celular a parlante de la cuna)

- **Criterios:** CA-12.1, CA-12.2, CA-12.3, CA-34.5, CA-33.4. Decide `arquitectura.md` §8.1.
- **Pregunta que responde:** ¿puede la Pico 2 W recibir audio por red y reproducirlo por el MAX98357A sin cortes, y con qué transporte?
- **Material:** Pico con el módulo de cuna y audio habilitado (`AUDIO_HABILITADO = True` solo para esta prueba, en una copia local de `config.py`), MAX98357A, parlante de 8 Ω / 0,5 W, teléfono, cronómetro, hotspot.
- **Pasos:**
  1. Prueba previa de audio local: reproducir el tono de 500 Hz del firmware y comprobar volumen conservador (10 %, tope 25 %). Medir con un sonómetro o aplicación si hay uno; anotar la distancia. Este paso confirma I²S, que `README.md:204-207` deja sin verificar.
  2. Enviar desde el teléfono una señal de audio de prueba (tono o palabras leídas) por cada transporte candidato: (a) WSS por Realtime de Supabase, (b) conexión directa en la red local. Un transporte solo se considera si cabe el audio (por ejemplo, PCM de 16 kHz a 16 bits son 32 kB/s).
  3. Mantener 30 s de transmisión. Anotar cortes audibles, latencia aproximada (grabar con otro teléfono la voz y el parlante y medir el desfase) y memoria libre de la Pico.
  4. Cortar la conexión a mitad de la transmisión. Confirmar que el audio se detiene.
  5. Revisar que no exista ninguna escritura de audio (almacenamiento de la Pico, base de datos o Storage).
- **Pasa si:** 30 s continuos sin cortes que impidan entender, parada al desconectar y ningún audio almacenado. Documentar la latencia medida.
- **Si falla:** registrar el motivo (memoria, TLS, ancho de banda) y volver a decidir el diseño con el equipo antes de la fase 5. No inventar una alternativa sin prueba.
- **Evidencia:** video con audio, anotación de latencia, registro de consola, resultado de la revisión de almacenamiento.
- **Limitación conocida:** MicroPython 1.28 habilita TLS 1.2 y no TLS 1.3 (`README.md:107-109`). Si el transporte exige TLS 1.3, la prueba lo registra.

### P3 · Cámara y fotografía

- **Criterios:** CA-18.1, CA-18.2, CA-18.3, CA-18.4, CA-07.4. Decide `arquitectura.md` §8.6.
- **Pregunta que responde:** ¿la maqueta puede asociar una fotografía privada a un evento de habitación, y quién la toma?
- **Opciones:** (a) el teléfono sube la foto a Storage cuando el celular recibe la orden; (b) una cámara conectada al módulo. La maqueta admite un teléfono como cámara (`docs/Requerimientos/RequerimientosFinal.md:70-71`).
- **Pasos para (a):**
  1. Con un evento de prueba, el teléfono toma una foto y la sube a un almacén privado de prueba. **Crear ese almacén en `cuna-inteligente-dev` requiere pedido explícito**, así que esta parte queda bloqueada hasta que el equipo lo autorice.
  2. Medir el tiempo entre el evento y la foto disponible.
  3. Comprobar que otra cuenta no puede abrir la foto (CA-34.1).
  4. Comprobar que el mensaje de Telegram no contiene la imagen (CA-07.4) y que no se guarda video (CA-18.4).
- **Pasa si:** foto vinculada al evento correcto, acceso solo del dueño y ausencia de video.
- **Evidencia:** captura de la foto con el identificador del evento, tiempos, resultado de la denegación.

## 4. Pruebas por módulo

Cada una exige el cableado revisado (regla 3) y registra evidencia (regla 5).

| ID | Módulo | Prueba | Criterios | Resultado esperado | Componente o recurso |
|---|---|---|---|---|---|
| B4 | Cuna | AM2301: lecturas cada 10 s con marcas de tiempo; comparar contra un termohigrómetro de referencia | CA-09.1, CA-09.3, CA-30.3 | Intervalo de 10 s entre lecturas; unidades °C y % HR; diferencia con la referencia anotada | AM2301 y termohigrómetro de referencia |
| B5 | Cuna | PIR: movimiento con monitoreo habilitado y deshabilitado; observar flancos falsos al encender | CA-08.1, CA-08.3 | Un evento por flanco con el monitoreo activo; ninguno con él apagado | PIR HC-SR501 |
| B6 | Cuna | Lámpara: niveles 0, 25, 50, 100 %; con osciloscopio o multímetro, corriente de la compuerta y del LED; confirmar resistencia independiente | CA-11.1, CA-33.2 | Brillo escalonado; corriente dentro de los límites del LED | MOSFET IRLZ44N, multímetro |
| B7 | Alimentación | Temperatura del biberón: la sonda contra un termómetro de referencia a unos 5 °C, 37 °C y 60 °C en un recipiente de prueba; probar con y sin aislante | CA-23.1, CA-23.3, CA-33.2 | Error anotado por punto; decisión entre contacto y sin contacto | DS18B20 (propuesta) y termómetro de referencia |
| B8 | Figuras | Seis LED con intervalo de 2 s; comprobar que no hay cambios más rápidos; medir brillo con una aplicación de luxómetro a distancia fija | CA-13.3, CA-13.4 | Cambio cada 2 s o más; transiciones sin destellos bruscos; brillo anotado | Seis LED con 330 Ω |
| B9 | Habitación | Reed y PIR dentro y fuera del horario de monitoreo | CA-17.1, CA-17.2, CA-17.4 | Evento al abrir o al detectar movimiento durante monitoreo; ninguno fuera | Reed y PIR (propuesta) |
| B10 | Juego | Cinco botones y LED: acierto, error, cambio de objetivo y apagado; medir diámetro de botón y probar que no se desprende | CA-19.1 a CA-19.5 | Recompensa solo en acierto; nuevo objetivo tras cada pulsación | Botones arcade (propuesta) |

Las pruebas B4 a B6 y B8 usan firmware existente. B7, B9 y B10 requieren firmware que todavía no existe (fases 7 a 9); mientras tanto se pueden caracterizar los componentes con un script de prueba aparte, sin integrarlo.

## 5. Qué requiere componentes o presencia

| Recurso | Pruebas que bloquea | Quién |
|---|---|---|
| Balanza de referencia y pesas verificadas | B1 a B3 | Equipo, presencial |
| Celda de 1 kg y HX711 adicional | Balanza de alimentación | Compra o préstamo, por confirmar |
| MAX98357A, parlante y teléfono | P2 | Equipo, presencial |
| Autorización para crear un almacén de pruebas en `cuna-inteligente-dev` | P3 (parte con Storage) | Persona del equipo con permisos |
| DS18B20, termómetro de referencia | B7 | Compra, por confirmar |
| Reed, botones arcade | B9, B10 | Compra, por confirmar |
| Profesor | Sustituciones de [`diseno-fisico.md`](diseno-fisico.md) §7 | Coordinación |
| Equipo de circuitos | Revisión eléctrica y mapa definitivo | Equipo de circuitos |

## 6. Plantilla de registro de evidencia

Copiar una por prueba ejecutada.

```
Prueba: <ID y nombre>
Fecha y hora:
Ejecutó:
Commit cargado en la Pico:
Módulo (MODULO):
Instrumentos y su referencia:
Montaje (pines usados):
Pasos ejecutados (marcar desvíos):
Resultado medido:
Resultado esperado cumplido: sí / no / parcial
Evidencia adjunta (ruta o enlace del equipo):
Observaciones y defectos:
Estado: verificado / parcial / bloqueado
```

## 6.1 Registro de resultados

| ID | Estado | Fecha | Evidencia |
|---|---|---|---|
| B1 a B3 | pendiente | — | — |
| P2 | pendiente | — | — |
| P3 | pendiente | — | — |
| B4 a B10 | pendiente | — | — |
