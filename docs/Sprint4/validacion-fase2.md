# Validación de la fase 2 · Diseño físico y protocolo de banco

**Resultados reales de la ejecución del 2026-11-17.** Fase 2 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-33 y preparación de HU-29.

Esta fase es documental. No se ejecutó ninguna prueba física: no hay hardware ni evidencia del equipo en esta sesión.

| Dato | Valor |
|---|---|
| Rama base | `docs/fase1-linea-base` (fase 1 aún no integrada en `development`) |
| Rama de trabajo | `docs/fase2-diseno-fisico` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |
| Python | 3.15.2 |

Los commits de esta fase se listan con `git log docs/fase1-linea-base..docs/fase2-diseno-fisico`.

## 1. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| Lectura de `config.py`, `sensores.py`, `prueba_colchon.py`, `comandos.py`, `README.md` del firmware y `prueba-maqueta.md` | Confirmados los pines, frecuencias y tiempos citados en [`diseno-fisico.md`](diseno-fisico.md) |
| Script Python sobre `matriz-hu-ca.md` (cuenta cada CA expandido) | 145 criterios, 145 únicos. verificado 3, parcial 63, pendiente 79, bloqueado 0 |
| `python -m unittest discover -s src/firmware/tests` (raíz) | **171 pruebas, OK.** Sin cambios de código: confirma que la línea base sigue igual |
| `git grep` de patrones de JWT, `sb_secret_` y token de Telegram sobre `docs/Sprint4` | Sin credenciales. Las coincidencias son texto de fases anteriores que nombra los patrones |
| `git diff --stat` | Solo `docs/Sprint4/`. Sin cambios en `src/`, `supabase/` ni documentación protegida |

No se ejecutaron `npm test`, `npm run lint` ni `npm run build`: no cambió código web ni de Supabase. El resultado de la fase 1 sigue siendo la referencia.

## 2. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| Lectura del código | Que cada pin y parámetro existente citado coincide con `config.py` y los módulos | Que el cableado real use esos pines |
| Pruebas del firmware (171) | La lógica sigue intacta | GPIO, HX711, I²S ni sensores reales |
| Documentos nuevos | El diseño propuesto, el protocolo y las brechas | Que los componentes propuestos existan, sirvan o estén aprobados |

## 3. Estado de los criterios de HU-33

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-33.1 | parcial (documental) | `diseno-fisico.md` §3 y §4 | Confirmación del equipo; existencia de componentes de habitación, juego y alimentación |
| CA-33.2 | parcial (documental) | `diseno-fisico.md` §3; pruebas B1 a B8 de `protocolo-banco.md` | Mediciones del banco; norma de cunas y de juguetes cotejada |
| CA-33.3 | parcial (documental) | `diseno-fisico.md` §2, §3.3, §3.5, §7 | Coordinar sustituciones con el profesor |
| CA-33.4 | parcial (documental) | `diseno-fisico.md` §2 y §3 | Maqueta construida que lo demuestre |
| CA-33.5 | parcial (documental) | `diseno-fisico.md` §3.1 | Dimensiones de norma cotejadas; plano de la maqueta a escala |
| CA-33.6 | parcial (documental) | `diseno-fisico.md` §3.6 | Cable y conector elegidos y probados |

Ninguno se declara verificado. HU-29 sigue pendiente; esta fase solo prepara su base.

## 4. Hallazgos

1. **La prueba de pines repetidos no admite los módulos nuevos.** `src/firmware/tests/test_config_y_comandos.py:29-31` exige pines únicos entre todos los módulos. Quedan 10 GPIO libres y habitación, juego y alimentación necesitan 17. Como la Pico se conecta a un módulo por vez, la unicidad debería exigirse dentro de cada módulo. No se modificó código; lo decide quien implemente las fases 7 a 9.
2. **El colchón tiene dos mapas de pines.** Integrado (GP14 a GP17) y de banco (GP12, GP13, GP18, GP19). El de banco choca con la lámpara y las figuras. Hay que unificarlos al confirmar el mapa definitivo.
3. **Una celda de 5 kg no sirve para el colchón comercial.** La maqueta usa cargas pequeñas; el producto necesita celdas con capacidad total mucho mayor. Sin dimensionar.
4. **La prueba del botón del colchón no demuestra una pulsación.** `prueba-maqueta.md:52` dice que la línea permaneció en alto. Repetir con una pulsación registrada (discrepancia 7 de `diseno-fisico.md` §8).
5. **El método de temperatura del biberón por contacto con la pared subestima el calor del líquido.** La prueba B7 mide el error y define si se pasa a un sensor sin contacto.
6. **Sustituciones sin constancia de coordinación con el profesor.** Incluso AM2301 en lugar de SHT31, que ya figuraba en el Sprint 3.
7. **Dos correcciones a la matriz de la fase 1:** buzzer integrado en GP14 (no GP18) y PIR en `config.py:20` y `sensores.py:17`.

## 5. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Pruebas B1 a B3 | Balanza de referencia, pesas verificadas, fijación de la celda |
| Prueba P2 (voz) | MAX98357A, parlante, teléfono; ejecución presencial |
| Prueba P3 (cámara) | Autorización para crear un almacén de prueba en `cuna-inteligente-dev` |
| Pruebas B7, B9, B10 | Componentes propuestos (DS18B20, reed, botones arcade) y firmware de las fases 7 a 9 |
| Diseño físico completo | Confirmación del equipo, coordinación con el profesor y revisión eléctrica |
| Normas de cuna y de juguetes | Cotejar los valores de referencia con el texto vigente |

## 6. Archivos

Creados en `docs/Sprint4/`:

- `diseno-fisico.md`
- `protocolo-banco.md`
- `validacion-fase2.md` (este archivo)

Modificados en `docs/Sprint4/`:

- `matriz-hu-ca.md`: seis filas de CA-33.x, correcciones de CA-08.1 y CA-15.2, resumen (parcial 63, pendiente 79).
- `arquitectura.md` §8: puntos 1 y 6 remiten al protocolo de banco.

No se modificó código en `src/` ni `supabase/`. No se creó nada en `cuna-inteligente-dev`. No se modificó documentación protegida. No se hizo push.
