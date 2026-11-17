"""control_colchon.py - Une la logica del colchon con HX711, buzzer y boton.

Todo es no bloqueante: actualizar() se llama en cada vuelta del ciclo
principal y vuelve enseguida. Los comandos (tara, calibrar, armar, ...) solo
ponen en marcha la accion; las capturas se completan en las vueltas
siguientes y su resultado queda en 'ultimo_resultado' (visible en estado()).

Los comandos lanzan ValueError("codigo") si no se pueden aceptar. Esta
logica no usa red: la red solo aparece como el booleano 'wifi_ok'.
SIN PROBAR EN HARDWARE.
"""
import logica_colchon as logica
from logica_colchon import ACTIVO, ALARMA, DETENIDO, INACTIVO


def copiar_config(modulo, **cambios):
    """Copia los valores en MAYUSCULAS de config.py y aplica cambios (para pruebas)."""
    class _Cfg:
        pass

    cfg = _Cfg()
    for nombre in dir(modulo):
        if nombre.isupper():
            setattr(cfg, nombre, getattr(modulo, nombre))
    for nombre in cambios:
        setattr(cfg, nombre, cambios[nombre])
    return cfg


class ControlColchon:
    def __init__(self, sensor, buzzer, boton, cfg):
        """sensor: listo()/leer(); buzzer: value(v); boton: value()."""
        self._sensor = sensor
        self._buzzer = buzzer
        self._boton = boton
        self._cfg = cfg
        self.calibracion = logica.Calibracion()
        self.monitor = logica.Monitor(cfg.COLCHON_TOLERANCIA_PCT,
                                      cfg.COLCHON_LECTURAS_REQUERIDAS,
                                      cfg.COLCHON_ALARMA_MAX_S,
                                      cfg.COLCHON_MONITOREO_MAX_S)
        self._antirrebote = logica.Antirrebote(cfg.COLCHON_ANTIRREBOTE_MS)
        self._wifi_ok = False
        self._captura = None
        self._ultimo_muestreo = None
        self._pendiente_desde = None
        self._prueba_buzzer_ms = None
        self._buzzer_encendido = False
        self._duracion_s = cfg.COLCHON_MONITOREO_S
        self.ultimo_resultado = None
        self.pulsaciones = 0
        self._escribir_buzzer(False)        # arranque seguro: apagado

    # ---------------- consultas ----------------

    def en_alarma(self):
        return self.monitor.estado == ALARMA

    def captura_activa(self):
        return self._captura is not None

    def estado(self, ahora_ms):
        datos = self.monitor.resumen(ahora_ms)
        datos["calibrado"] = self.calibracion.calibrada
        datos["buzzer"] = self._buzzer_encendido
        datos["captura"] = self._captura["tipo"] if self._captura else None
        datos["requiere_wifi"] = bool(self._cfg.COLCHON_REQUIERE_WIFI)
        datos["ultimo_resultado"] = self.ultimo_resultado
        return datos

    # ---------------- comandos locales ----------------

    def tara(self, ahora_ms):
        """Mide la carga actual como cero (retirar todo peso de la celda)."""
        self._exigir_sin_monitoreo()
        self._iniciar_captura("tara", ahora_ms)
        return {"pendiente": True, "accion": "tara"}

    def calibrar(self, peso_g, ahora_ms):
        """Con la pesa conocida colocada: calcula el factor cuentas/gramo."""
        self._exigir_sin_monitoreo()
        if not logica.numero_valido(peso_g) or peso_g <= 0:
            raise ValueError("peso_invalido")
        if self.calibracion.tara is None:
            raise ValueError("falta_tara")
        self._iniciar_captura("calibrar", ahora_ms, peso_g=peso_g)
        return {"pendiente": True, "accion": "calibrar"}

    def leer_peso(self, ahora_ms):
        """Promedia unas lecturas y las deja en ultimo_resultado (crudo y gramos)."""
        self._exigir_sin_monitoreo()
        self._iniciar_captura("leer", ahora_ms)
        return {"pendiente": True, "accion": "leer"}

    def armar(self, duracion_s, ahora_ms):
        """Captura la referencia ACTUAL y activa el monitoreo."""
        if self.monitor.estado in (ACTIVO, ALARMA):
            raise ValueError("monitoreo_en_curso")
        return self._armar("armar", duracion_s, ahora_ms)

    def rearmar(self, duracion_s, ahora_ms):
        """Despues de DETENIDO: nueva referencia y nuevo monitoreo (accion explicita)."""
        if self.monitor.estado != DETENIDO:
            raise ValueError("no_detenido")
        return self._armar("rearmar", duracion_s, ahora_ms)

    def detener(self, ahora_ms):
        """Detiene monitoreo/alarma, apaga el buzzer y cancela capturas."""
        detenido = self.monitor.detener("comando")
        self._captura = None
        self._prueba_buzzer_ms = None
        self._sincronizar_buzzer(ahora_ms)
        return {"detenido": detenido, "estado": self.monitor.estado}

    def buzzer_prueba(self, encender, ahora_ms):
        """Prueba manual del buzzer; se apaga sola tras COLCHON_ALARMA_MAX_S."""
        self._prueba_buzzer_ms = ahora_ms if encender else None
        self._sincronizar_buzzer(ahora_ms)
        return {"buzzer": self._buzzer_encendido}

    def apagar(self):
        """Salida segura (fin del programa o fallo): buzzer apagado, monitoreo detenido."""
        self.monitor.detener("apagado")
        self._captura = None
        self._prueba_buzzer_ms = None
        self._escribir_buzzer(False)

    # ---------------- ciclo ----------------

    def actualizar(self, ahora_ms, wifi_ok):
        """Una vuelta del ciclo principal. No bloquea."""
        self._wifi_ok = bool(wifi_ok)
        cfg = self._cfg

        pres = (self._boton.value() == 0) == bool(cfg.BOTON_ACTIVO_BAJO)
        if self._antirrebote.actualizar(pres, ahora_ms):
            self.pulsaciones += 1
            self.monitor.detener("boton")       # el boton solo detiene
            self._prueba_buzzer_ms = None

        # Arquitectura 4.4: sin WiFi, tanto en monitoreo como en alarma, se
        # detiene (el buzzer se apaga en _sincronizar_buzzer) y exige rearme.
        if (cfg.COLCHON_REQUIERE_WIFI and not self._wifi_ok
                and self.monitor.estado in (ACTIVO, ALARMA)):
            self.monitor.detener("wifi_perdido")

        self.monitor.actualizar(ahora_ms)

        if self._captura is not None:
            self._paso_captura(ahora_ms)
        elif self.monitor.estado == ACTIVO:
            self._muestrear(ahora_ms)

        self._sincronizar_buzzer(ahora_ms)
        return self.monitor.estado

    # ---------------- internos ----------------

    def _exigir_sin_monitoreo(self):
        if self.monitor.estado in (ACTIVO, ALARMA):
            raise ValueError("monitoreo_en_curso")

    def _armar(self, tipo, duracion_s, ahora_ms):
        if duracion_s is None:
            duracion_s = self._duracion_s
        self.monitor.validar_duracion(duracion_s)       # DEC-13
        if not self.calibracion.calibrada:
            raise ValueError("sin_calibracion")
        if self._cfg.COLCHON_REQUIERE_WIFI and not self._wifi_ok:
            raise ValueError("sin_wifi")
        self._iniciar_captura(tipo, ahora_ms, duracion_s=duracion_s)
        return {"pendiente": True, "accion": tipo}

    def _iniciar_captura(self, tipo, ahora_ms, **extra):
        if self._captura is not None:
            raise ValueError("captura_en_curso")
        self.ultimo_resultado = None
        self._captura = {"tipo": tipo, "n": 0, "suma": 0, "inicio": ahora_ms}
        self._captura.update(extra)

    def _fallar_captura(self, codigo):
        tipo = self._captura["tipo"]
        self._captura = None
        self.ultimo_resultado = {"ok": False, "accion": tipo, "error": codigo}

    def _paso_captura(self, ahora_ms):
        c = self._captura
        if logica.diferencia_ms(ahora_ms, c["inicio"]) >= self._cfg.COLCHON_CAPTURA_TIMEOUT_MS:
            self._fallar_captura("captura_sin_respuesta")
            return
        if not self._sensor.listo():
            return                          # se salta; se reintenta en la vuelta siguiente
        try:
            crudo = self._sensor.leer()
        except OSError:
            crudo = None
        if not logica.numero_valido(crudo):
            self._fallar_captura("lectura_invalida")
            return
        c["suma"] += crudo
        c["n"] += 1
        if c["n"] >= self._cfg.COLCHON_MUESTRAS_CAPTURA:
            self._terminar_captura(ahora_ms)

    def _terminar_captura(self, ahora_ms):
        c = self._captura
        self._captura = None
        tipo = c["tipo"]
        promedio = c["suma"] / c["n"]
        try:
            if tipo == "tara":
                self.calibracion.fijar_tara(promedio)
                res = {"ok": True, "accion": tipo, "tara_crudo": promedio}
            elif tipo == "calibrar":
                self.calibracion.calibrar(promedio, c["peso_g"],
                                          self._cfg.COLCHON_CALIBRACION_DELTA_MIN)
                res = {"ok": True, "accion": tipo, "factor": self.calibracion.factor}
            elif tipo == "leer":
                res = {"ok": True, "accion": tipo, "crudo": promedio,
                       "peso_g": self.calibracion.a_gramos(promedio),
                       "calibrado": self.calibracion.calibrada}
            else:                           # armar / rearmar
                if self._cfg.COLCHON_REQUIERE_WIFI and not self._wifi_ok:
                    raise ValueError("sin_wifi")
                referencia = self.calibracion.a_gramos(promedio)
                self.monitor.armar(referencia, c["duracion_s"], ahora_ms)
                self._duracion_s = c["duracion_s"]
                self._ultimo_muestreo = ahora_ms
                self._pendiente_desde = None
                res = {"ok": True, "accion": tipo, "referencia_g": referencia}
        except ValueError as error:
            res = {"ok": False, "accion": tipo, "error": str(error)}
        self.ultimo_resultado = res

    def _muestrear(self, ahora_ms):
        """Una lectura por COLCHON_INTERVALO_MS; si el HX711 no esta listo, salta."""
        cfg = self._cfg
        if logica.diferencia_ms(ahora_ms, self._ultimo_muestreo) < cfg.COLCHON_INTERVALO_MS:
            return
        if self._sensor.listo():
            try:
                crudo = self._sensor.leer()
            except OSError:
                crudo = None
            self._ultimo_muestreo = ahora_ms
            self._pendiente_desde = None
            self.monitor.registrar_lectura(self.calibracion.a_gramos(crudo), ahora_ms)
        elif self._pendiente_desde is None:
            self._pendiente_desde = ahora_ms
        elif logica.diferencia_ms(ahora_ms, self._pendiente_desde) >= cfg.COLCHON_ESPERA_LISTO_MS:
            # Sensor mudo demasiado tiempo: cuenta como lectura invalida.
            self._ultimo_muestreo = ahora_ms
            self._pendiente_desde = None
            self.monitor.registrar_lectura(None, ahora_ms)

    def _sincronizar_buzzer(self, ahora_ms):
        prueba = False
        if self._prueba_buzzer_ms is not None:
            limite = self._cfg.COLCHON_ALARMA_MAX_S * 1000
            if logica.diferencia_ms(ahora_ms, self._prueba_buzzer_ms) >= limite:
                self._prueba_buzzer_ms = None
            else:
                prueba = True
        self._escribir_buzzer(self.monitor.buzzer_activo or prueba)

    def _escribir_buzzer(self, encendido):
        self._buzzer.value(1 if encendido else 0)
        self._buzzer_encendido = bool(encendido)


def iniciar(cfg=None):
    """Crea el hardware real y devuelve el control. Solo se llama con el colchon habilitado."""
    if cfg is None:
        import config as cfg
    import setup_colchon
    sensor, buzzer, boton = setup_colchon.crear_hardware(cfg)
    return ControlColchon(sensor, buzzer, boton, cfg)
