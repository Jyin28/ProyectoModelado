"""control_alimentacion.py - Balanza (HX711) y sonda de temperatura (DS18B20) del biberon.

Todo es no bloqueante: actualizar() se llama en cada vuelta del ciclo principal.
Sin actuadores: no calienta, no enfria ni suministra alimento (CA-23.4).
SIN PROBAR EN HARDWARE.

  - pesar(toma_id, momento) pone en marcha un pesaje y vuelve enseguida con
    {"pendiente": True}. Cuando termina, deja UN evento: peso_alimentacion con los
    gramos, o peso_alimentacion_fallido con el motivo. Nunca inventa un peso.
  - Cada ALIMENTACION_INTERVALO_TEMP_S mide la temperatura y deja un evento
    temperatura_biberon. Si la sonda no responde, no se informa nada.
  - Al encender toma el cero (tara) con la balanza vacia si
    ALIMENTACION_TARA_AL_INICIAR esta activo. El factor de calibracion se guarda
    en un archivo propio (no comparte el del colchon).

Los comandos lanzan ValueError("codigo") si no se pueden aceptar.
"""
import logica_alimentacion as logica
import logica_colchon as base

MAX_EVENTOS = 8


class ControlAlimentacion:
    def __init__(self, sensor, termometro, cfg, almacen=None):
        """sensor: listo()/leer() (HX711). termometro: convertir()/leer() en C, o None
        si no hay sonda. almacen (opcional): cargar() -> factor o None; guardar(factor)."""
        self._sensor = sensor
        self._termometro = termometro
        self._cfg = cfg
        self.calibracion = base.Calibracion()
        self._almacen = almacen
        if almacen is not None:
            self.calibracion.factor = almacen.cargar()
        self._captura = None
        self._tara_pendiente = bool(cfg.ALIMENTACION_TARA_AL_INICIAR)
        self._eventos = []
        self._ultima_temp_ms = None
        self._convirtiendo_desde = None
        self.temperatura_c = None
        self.ultimo_resultado = None

    # ---------------- consultas ----------------

    def estado(self, ahora_ms=None):
        return {"calibrado": self.calibracion.calibrada,
                "captura": self._captura["tipo"] if self._captura else None,
                "temperatura_c": self.temperatura_c,
                "sonda": self._termometro is not None,
                "ultimo_resultado": self.ultimo_resultado}

    def sacar_eventos(self):
        """Entrega y vacia los eventos pendientes de informar: [{"tipo", "datos", "ms"}].

        "ms" es time.ticks_ms() de cuando se midio. Tipos: peso_alimentacion,
        peso_alimentacion_fallido y temperatura_biberon.
        """
        eventos = self._eventos
        self._eventos = []
        return eventos

    # ---------------- comandos ----------------

    def pesar(self, toma_id, momento, ahora_ms):
        """Pesa para una toma (orden feeding_weigh). El resultado llega como evento."""
        if not logica.toma_id_valido(toma_id):
            raise ValueError("parametro_invalido:toma_id")
        if not logica.momento_valido(momento):
            raise ValueError("parametro_invalido:momento")
        if self._captura is not None:
            raise ValueError("captura_en_curso")
        if not self.calibracion.calibrada:
            # Sin tara o factor no hay gramos: se informa, no se inventa.
            self._anotar_fallo(toma_id, momento, logica.MOTIVO_SIN_CALIBRACION, ahora_ms)
            return {"pendiente": True, "momento": momento}
        self._iniciar_captura("peso", ahora_ms, toma_id=toma_id, momento=momento)
        return {"pendiente": True, "momento": momento}

    def tarar(self, ahora_ms):
        """Mide el cero con la balanza vacia (uso local)."""
        if self._captura is not None:
            raise ValueError("captura_en_curso")
        self._iniciar_captura("tara", ahora_ms)
        return {"pendiente": True, "accion": "tara"}

    def calibrar(self, peso_g, ahora_ms):
        """Con la pesa conocida colocada: calcula el factor cuentas/gramo (uso local)."""
        if not base.numero_valido(peso_g) or peso_g <= 0:
            raise ValueError("peso_invalido")
        if self.calibracion.tara is None:
            raise ValueError("falta_tara")
        if self._captura is not None:
            raise ValueError("captura_en_curso")
        self._iniciar_captura("calibrar", ahora_ms, peso_g=peso_g)
        return {"pendiente": True, "accion": "calibrar"}

    def captura_activa(self):
        return self._captura is not None

    def apagar(self):
        self._captura = None
        self._convirtiendo_desde = None

    # ---------------- ciclo ----------------

    def actualizar(self, ahora_ms):
        if self._captura is None and self._tara_pendiente:
            self._tara_pendiente = False
            self._iniciar_captura("tara", ahora_ms)
        if self._captura is not None:
            self._paso_captura(ahora_ms)
        self._paso_temperatura(ahora_ms)

    def _iniciar_captura(self, tipo, ahora_ms, **extra):
        self._captura = {"tipo": tipo, "n": 0, "suma": 0, "inicio": ahora_ms}
        self._captura.update(extra)
        if tipo != "peso":
            self.ultimo_resultado = None

    def _fallar_captura(self, ahora_ms):
        c = self._captura
        self._captura = None
        if c["tipo"] == "peso":
            self._anotar_fallo(c["toma_id"], c["momento"], logica.MOTIVO_SIN_LECTURA, ahora_ms)
        else:
            self.ultimo_resultado = {"ok": False, "accion": c["tipo"], "error": "lectura_invalida"}

    def _paso_captura(self, ahora_ms):
        c = self._captura
        if base.diferencia_ms(ahora_ms, c["inicio"]) >= self._cfg.ALIMENTACION_CAPTURA_TIMEOUT_MS:
            self._fallar_captura(ahora_ms)
            return
        if not self._sensor.listo():
            return                          # se reintenta en la vuelta siguiente
        try:
            crudo = self._sensor.leer()
        except OSError:
            crudo = None
        if not base.numero_valido(crudo):
            self._fallar_captura(ahora_ms)
            return
        c["suma"] += crudo
        c["n"] += 1
        if c["n"] >= self._cfg.ALIMENTACION_MUESTRAS_PESO:
            self._terminar_captura(ahora_ms)

    def _terminar_captura(self, ahora_ms):
        c = self._captura
        self._captura = None
        promedio = c["suma"] / c["n"]
        tipo = c["tipo"]
        if tipo == "peso":
            gramos, motivo = logica.evaluar_peso(
                self.calibracion.a_gramos(promedio), c["momento"],
                self._cfg.ALIMENTACION_PESO_MIN_G, self._cfg.ALIMENTACION_PESO_MAX_G)
            if gramos is None:
                self._anotar_fallo(c["toma_id"], c["momento"], motivo, ahora_ms)
            else:
                self._anotar("peso_alimentacion", ahora_ms,
                             {"toma_id": c["toma_id"], "momento": c["momento"], "gramos": gramos})
            return
        try:
            if tipo == "tara":
                self.calibracion.fijar_tara(promedio)
                self.ultimo_resultado = {"ok": True, "accion": tipo, "tara_crudo": promedio}
            else:
                self.calibracion.calibrar(promedio, c["peso_g"],
                                          self._cfg.ALIMENTACION_CALIBRACION_DELTA_MIN)
                res = {"ok": True, "accion": tipo, "factor": self.calibracion.factor}
                if self._almacen is not None:
                    res["guardado"] = bool(self._almacen.guardar(self.calibracion.factor))
                self.ultimo_resultado = res
        except ValueError as error:
            self.ultimo_resultado = {"ok": False, "accion": tipo, "error": str(error)}

    def _paso_temperatura(self, ahora_ms):
        if self._termometro is None:
            return
        if self._convirtiendo_desde is None:
            if (self._ultima_temp_ms is None or base.diferencia_ms(
                    ahora_ms, self._ultima_temp_ms) >= self._cfg.ALIMENTACION_INTERVALO_TEMP_S * 1000):
                self._ultima_temp_ms = ahora_ms
                try:
                    self._termometro.convertir()
                    self._convirtiendo_desde = ahora_ms
                except (OSError, ValueError):
                    self.temperatura_c = None    # la sonda no responde: sin dato
            return
        if base.diferencia_ms(ahora_ms, self._convirtiendo_desde) < self._cfg.ALIMENTACION_CONVERSION_TEMP_MS:
            return
        inicio = self._convirtiendo_desde
        self._convirtiendo_desde = None
        try:
            lectura = self._termometro.leer()
        except (OSError, ValueError):
            lectura = None
        valor = logica.temperatura_informable(lectura)
        self.temperatura_c = valor
        if valor is not None:
            self._anotar("temperatura_biberon", inicio, {"temperatura_c": valor})

    def _anotar_fallo(self, toma_id, momento, motivo, ahora_ms):
        self._anotar("peso_alimentacion_fallido", ahora_ms,
                     {"toma_id": toma_id, "momento": momento, "motivo": motivo})

    def _anotar(self, tipo, ahora_ms, datos):
        if len(self._eventos) >= MAX_EVENTOS:
            self._eventos.pop(0)            # nunca crece sin limite
        self._eventos.append({"tipo": tipo, "datos": datos, "ms": ahora_ms})


def iniciar(cfg=None):
    """Crea el hardware real y devuelve el control. Solo se llama con la alimentacion habilitada."""
    if cfg is None:
        import config as cfg
    import setup_alimentacion
    from almacen_calibracion import AlmacenArchivo
    sensor, termometro = setup_alimentacion.crear_hardware(cfg)
    almacen = AlmacenArchivo(cfg.ARCHIVO_CALIBRACION_ALIMENTACION)
    control = ControlAlimentacion(sensor, termometro, cfg, almacen)
    if control.calibracion.factor is None:
        print("Alimentacion: sin calibracion guardada; ejecuta calibrar_alimentacion.py")
    return control
