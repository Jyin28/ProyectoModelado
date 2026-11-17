"""logica_colchon.py - Logica pura del colchon (sin hardware, probable en CPython).

Contiene:
    Calibracion   tara + factor (cuentas por gramo). Sin factor provisional.
    Monitor       estados inactivo / activo / alarma / detenido, filtro de
                  lecturas consecutivas, duracion del monitoreo y timeout de alarma.
    Antirrebote   confirma una pulsacion estable del boton.

Todo recibe el tiempo como argumento (milisegundos de time.ticks_ms()), asi
las pruebas de escritorio no dependen de un reloj real.

Reglas (RF-14, RF-15, RF-16, DEC-03, DEC-07, DEC-13):
  - Solo se arma con referencia positiva y duracion positiva.
  - Alarma: perdida ESTRICTAMENTE mayor que la tolerancia, 3 lecturas seguidas.
    Una lectura invalida o dentro de tolerancia reinicia la cuenta.
  - La alarma se apaga por boton, comando o a los 60 s (configurable); en los
    tres casos queda DETENIDO. Reanudar exige armar de nuevo (referencia nueva).
"""
import math

# time.ticks_ms() de MicroPython da la vuelta cada 2**30 ms.
PERIODO_TICKS = 1 << 30

INACTIVO = "inactivo"
ACTIVO = "activo"
ALARMA = "alarma"
DETENIDO = "detenido"


def diferencia_ms(a, b):
    """a - b con vuelta de contador (equivale a time.ticks_diff)."""
    d = (a - b) & (PERIODO_TICKS - 1)
    if d >= PERIODO_TICKS // 2:
        d -= PERIODO_TICKS
    return d


def numero_valido(valor):
    """True si es int/float finito (rechaza None, bool, texto, NaN, inf)."""
    return (isinstance(valor, (int, float)) and not isinstance(valor, bool)
            and math.isfinite(valor))


class Calibracion:
    """Convierte lecturas crudas del HX711 a gramos.

    No hay factor por defecto: hasta completar tara y calibracion explicitas,
    a_gramos() devuelve None.
    """

    def __init__(self):
        self.tara = None      # lectura cruda sin carga
        self.factor = None    # cuentas por gramo (puede ser negativo segun el cableado)

    @property
    def calibrada(self):
        return self.tara is not None and self.factor is not None

    def fijar_tara(self, crudo):
        if not numero_valido(crudo):
            raise ValueError("lectura_invalida")
        self.tara = float(crudo)

    def calibrar(self, crudo, peso_g, delta_minimo):
        """Calcula el factor con una pesa de peso conocido sobre la celda."""
        if not numero_valido(crudo):
            raise ValueError("lectura_invalida")
        if not numero_valido(peso_g) or peso_g <= 0:
            raise ValueError("peso_invalido")
        if self.tara is None:
            raise ValueError("falta_tara")
        delta = crudo - self.tara
        if abs(delta) < delta_minimo:
            raise ValueError("sin_variacion")
        self.factor = delta / peso_g

    def a_gramos(self, crudo):
        if not self.calibrada or not numero_valido(crudo):
            return None
        return (crudo - self.tara) / self.factor


class Monitor:
    """Maquina de estados del monitoreo de perdida de peso."""

    def __init__(self, tolerancia_pct, lecturas_requeridas, alarma_max_s,
                 duracion_max_s):
        if not numero_valido(tolerancia_pct) or not 0 < tolerancia_pct < 100:
            raise ValueError("tolerancia_invalida")
        if (not isinstance(lecturas_requeridas, int) or isinstance(lecturas_requeridas, bool)
                or lecturas_requeridas < 1):
            raise ValueError("lecturas_invalidas")
        if not numero_valido(alarma_max_s) or alarma_max_s <= 0:
            raise ValueError("alarma_max_invalida")
        if not numero_valido(duracion_max_s) or duracion_max_s <= 0:
            raise ValueError("duracion_max_invalida")
        self.tolerancia_pct = tolerancia_pct
        self.lecturas_requeridas = lecturas_requeridas
        self.alarma_max_s = alarma_max_s
        self.duracion_max_s = duracion_max_s

        self.estado = INACTIVO
        self.referencia_g = None
        self.duracion_s = None
        self.inicio_ms = None
        self.alarma_inicio_ms = None
        self.consecutivas = 0
        self.invalidas = 0
        self.ultimo_peso_g = None
        self.motivo_parada = None   # duracion | timeout_alarma | boton | comando | wifi_perdido ...

    @property
    def buzzer_activo(self):
        return self.estado == ALARMA

    def validar_duracion(self, duracion_s):
        if not numero_valido(duracion_s) or duracion_s <= 0 or duracion_s > self.duracion_max_s:
            raise ValueError("duracion_invalida")

    def armar(self, referencia_g, duracion_s, ahora_ms):
        """Activa el monitoreo con una referencia NUEVA (primer armado o rearme)."""
        if self.estado in (ACTIVO, ALARMA):
            raise ValueError("monitoreo_en_curso")
        if not numero_valido(referencia_g) or referencia_g <= 0:
            raise ValueError("referencia_invalida")
        self.validar_duracion(duracion_s)
        self.estado = ACTIVO
        self.referencia_g = referencia_g
        self.duracion_s = duracion_s
        self.inicio_ms = ahora_ms
        self.alarma_inicio_ms = None
        self.consecutivas = 0
        self.invalidas = 0
        self.ultimo_peso_g = None
        self.motivo_parada = None

    def _parar(self, motivo):
        self.estado = DETENIDO
        self.motivo_parada = motivo
        self.consecutivas = 0

    def detener(self, motivo):
        """Detiene un monitoreo activo o una alarma. True si habia algo que detener."""
        if self.estado in (ACTIVO, ALARMA):
            self._parar(motivo)
            return True
        return False

    def actualizar(self, ahora_ms):
        """Aplica los vencimientos por tiempo. Devuelve el estado."""
        if self.estado == ACTIVO:
            if diferencia_ms(ahora_ms, self.inicio_ms) >= self.duracion_s * 1000:
                self._parar("duracion")
        elif self.estado == ALARMA:
            if diferencia_ms(ahora_ms, self.alarma_inicio_ms) >= self.alarma_max_s * 1000:
                self._parar("timeout_alarma")
        return self.estado

    def registrar_lectura(self, gramos, ahora_ms):
        """Procesa una lectura (None o no numerica = invalida). Devuelve el estado."""
        if self.actualizar(ahora_ms) != ACTIVO:
            return self.estado      # sin monitoreo activo no hay alarma (CA-15.3)
        if not numero_valido(gramos):
            self.invalidas += 1
            self.consecutivas = 0   # una lectura invalida rompe el filtro
            return self.estado
        self.ultimo_peso_g = gramos
        # perdida% > tolerancia  <=>  (ref - g) * 100 > tol * ref  (sin dividir)
        if (self.referencia_g - gramos) * 100 > self.tolerancia_pct * self.referencia_g:
            self.consecutivas += 1
        else:
            self.consecutivas = 0
        if self.consecutivas >= self.lecturas_requeridas:
            self.estado = ALARMA
            self.alarma_inicio_ms = ahora_ms
        return self.estado

    def resumen(self, ahora_ms):
        restante = None
        if self.estado == ACTIVO:
            transcurrido = diferencia_ms(ahora_ms, self.inicio_ms) / 1000
            restante = max(0, round(self.duracion_s - transcurrido, 1))
        return {
            "estado": self.estado,
            "referencia_g": self.referencia_g,
            "tolerancia_pct": self.tolerancia_pct,
            "duracion_s": self.duracion_s,
            "restante_s": restante,
            "consecutivas": self.consecutivas,
            "lecturas_invalidas": self.invalidas,
            "ultimo_peso_g": self.ultimo_peso_g,
            "motivo_parada": self.motivo_parada,
        }


class Antirrebote:
    """Confirma una pulsacion: nivel estable durante 'estable_ms'.

    actualizar() devuelve True UNA sola vez por pulsacion (flanco de subida
    confirmado); mantener pulsado no repite y los rebotes no cuentan.
    """

    def __init__(self, estable_ms):
        self._estable_ms = estable_ms
        self._candidato = False
        self._estable = False
        self._desde = 0

    def actualizar(self, presionado, ahora_ms):
        presionado = bool(presionado)
        if presionado != self._candidato:
            self._candidato = presionado
            self._desde = ahora_ms
            return False
        if presionado != self._estable and diferencia_ms(ahora_ms, self._desde) >= self._estable_ms:
            self._estable = presionado
            return presionado
        return False
