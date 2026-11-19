"""monitoreo.py - Monitoreo del colchon: filtro, alarma, parada y rearme.

Estados:  "stopped" (detenido)  ->  "monitoring"  ->  "alarm"  ->  "stopped"

Reglas (del documento de contexto):
  * La referencia (gramos, con la carga apoyada) se captura desde la web
    ANTES de iniciar. Cada vez que el monitoreo se detiene, la referencia
    se borra: para volver a empezar hace falta una referencia NUEVA (rearme).
  * Alarma = TRES lecturas seguidas por debajo de referencia * (1 - tolerancia).
    Con referencia 1000 g y tolerancia 10 %: 890 g x3 dispara; 900 g x3 no.
    Una lectura en el umbral o por encima reinicia el conteo.
  * Toda parada de alarma (web, boton, temporizador) deja el monitoreo detenido.
  * El monitoreo termina solo al vencer su duracion.
  * Si el HX711 deja de responder varias veces seguidas, se detiene.

Funciones:
    capturar_referencia()                  promedia lecturas y guarda la referencia
    iniciar(duracion_s, tolerancia_pct, alarma_s)
    procesar_lectura(gramos)               llamar con cada lectura de peso (1 por segundo)
    vigilar()                              llamar en CADA vuelta: boton y temporizadores
    detener(motivo)                        motivos: web, button, timer, duration, sensor, connection
    estado() / activo() / resumen()
    tomar_eventos()                        eventos nuevos para mandar a la nube
"""
import time

import config
import eventos
import peso
import setup_colchon

DETENIDO = "stopped"
MONITOREANDO = "monitoring"
ALARMA = "alarm"

_s = {
    "estado": DETENIDO,
    "referencia_g": None,      # None = falta capturar (o ya se uso)
    "tolerancia_pct": 0,
    "duracion_s": 0,
    "alarma_s": 0,
    "inicio_ms": 0,
    "inicio_alarma_ms": 0,
    "cuenta": 0,               # lecturas bajas seguidas
    "fallos": 0,               # lecturas sin respuesta seguidas
}
_eventos = []


def _evento(tipo, datos=None):
    try:
        _eventos.append(eventos.crear(tipo, datos))
    except RuntimeError:
        # Sin hora UTC no se pueden crear eventos; eso no debe impedir parar la alarma.
        print("Sin hora UTC: no se registra el evento", tipo)
        return
    while len(_eventos) > 20:
        _eventos.pop(0)


def tomar_eventos():
    """Devuelve los eventos nuevos y vacia la lista."""
    nuevos = _eventos[:]
    del _eventos[:]
    return nuevos


def notificar_inactivo(motivo="idle"):
    """Emite un evento de monitoreo detenido para sincronizar con la nube."""
    _evento("monitoring_stopped", {"reason": motivo})


def estado():
    return _s["estado"]


def activo():
    return _s["estado"] != DETENIDO


def resumen():
    return {"state": _s["estado"], "reference_g": _s["referencia_g"],
            "consecutive_low": _s["cuenta"]}


def umbral_g():
    """Peso mínimo permitido según la referencia fijada o la de configuración."""
    ref = _s["referencia_g"] if _s["referencia_g"] is not None else config.PESO_REFERENCIA_G
    tol = _s["tolerancia_pct"] if _s["tolerancia_pct"] > 0 else config.TOLERANCIA_PESO_PCT
    return ref * (1 - tol / 100)


def capturar_referencia():
    """Captura el peso de referencia actual con la carga apoyada o usa el de configuración."""
    if activo():
        raise ValueError("monitoreo_activo")

    lectura = peso.leer_peso() if peso.tiene_tara() else None
    if lectura is not None and lectura > 10:
        _s["referencia_g"] = round(lectura, 1)
    else:
        _s["referencia_g"] = config.PESO_REFERENCIA_G

    print("Referencia guardada:", _s["referencia_g"], "g")
    return _s["referencia_g"]


def fijar_referencia(gramos):
    """Establece manualmente el peso de referencia (en gramos)."""
    if activo():
        raise ValueError("monitoreo_activo")
    if gramos <= 0:
        raise ValueError("peso_invalido")
    _s["referencia_g"] = round(float(gramos), 1)
    print("Referencia fijada manualmente:", _s["referencia_g"], "g")
    return _s["referencia_g"]


def iniciar(duracion_s, tolerancia_pct, alarma_s):
    """Empieza a monitorear con la referencia capturada. Si no se capturo antes, la toma del peso actual."""
    if activo():
        raise ValueError("monitoreo_activo")
    if _s["referencia_g"] is None:
        capturar_referencia()
    if duracion_s <= 0 or alarma_s <= 0:
        raise ValueError("fuera_de_rango")
    if tolerancia_pct <= 0 or tolerancia_pct >= 100:
        raise ValueError("fuera_de_rango")

    _s["tolerancia_pct"] = tolerancia_pct
    _s["duracion_s"] = duracion_s
    _s["alarma_s"] = alarma_s
    _s["inicio_ms"] = time.ticks_ms()
    _s["cuenta"] = 0
    _s["fallos"] = 0
    setup_colchon.button_clear()              # una pulsacion anterior no debe detener este monitoreo
    _s["estado"] = MONITOREANDO
    _evento("monitoring_started", {
        "reference_g": _s["referencia_g"], "tolerance_pct": tolerancia_pct,
        "duration_s": duracion_s, "alarm_s": alarma_s})
    print("Monitoreo iniciado. Referencia: %.1f g, umbral: %.1f g"
          % (_s["referencia_g"], umbral_g()))


def emitir_latido():
    """Repite monitoring_started para que la web sepa que la Pico sigue monitoreando.

    Solo en estado "monitoring". En alarma NO: la web toma el estado del ultimo evento, y un
    monitoring_started la haria mostrar "monitoreando" con el buzzer todavia sonando.
    Devuelve True si emitio el evento.
    """
    if _s["estado"] != MONITOREANDO:
        return False
    _evento("monitoring_started", {
        "reference_g": _s["referencia_g"], "tolerance_pct": _s["tolerancia_pct"],
        "duration_s": _s["duracion_s"], "alarm_s": _s["alarma_s"]})
    return True


def procesar_lectura(gramos):
    """Evalua una lectura (gramos, o None si fallo). Solo actua si se monitorea."""
    if _s["estado"] != MONITOREANDO:
        return

    if gramos is None:
        _s["fallos"] += 1
        if _s["fallos"] >= config.FALLOS_LECTURA_MAX:
            detener("sensor")
        return
    _s["fallos"] = 0

    if gramos < umbral_g():
        _s["cuenta"] += 1
    else:
        _s["cuenta"] = 0                      # volver al umbral reinicia el conteo

    if _s["cuenta"] >= setup_colchon.REQUIRED_READINGS:
        _disparar(gramos)


def _disparar(gramos):
    _s["estado"] = ALARMA
    _s["inicio_alarma_ms"] = time.ticks_ms()
    setup_colchon.buzzer_on()
    _evento("alarm_started", {"weight_g": gramos,
                              "reference_g": _s["referencia_g"],
                              "threshold_g": umbral_g()})
    print("ALARMA: %.1f g bajo el umbral de %.1f g" % (gramos, umbral_g()))


def vigilar():
    """Boton y temporizadores. Llamar en cada vuelta del ciclo (no bloquea)."""
    if _s["estado"] == DETENIDO:
        setup_colchon.button_clear()          # sin nada que detener, la pulsacion se descarta
        return
    ahora = time.ticks_ms()
    if _s["estado"] == ALARMA:
        if time.ticks_diff(ahora, _s["inicio_alarma_ms"]) >= _s["alarma_s"] * 1000:
            detener("timer")
            return
    elif time.ticks_diff(ahora, _s["inicio_ms"]) >= _s["duracion_s"] * 1000:
        detener("duration")
        return
    if setup_colchon.button_pressed():
        en_alarma = _s["estado"] == ALARMA
        detener("button")
        if en_alarma:
            print("Alarma detenida con el boton")


def detener(motivo):
    """Apaga la alarma y detiene el monitoreo. Borra la referencia (hay que rearmar).

    Devuelve True si habia algo que detener.
    """
    setup_colchon.buzzer_off()                # siempre, por seguridad
    if _s["estado"] == DETENIDO:
        return False
    if _s["estado"] == ALARMA:
        _evento("alarm_stopped", {"reason": motivo})
    _evento("monitoring_stopped", {"reason": motivo})
    print("Monitoreo detenido:", motivo)
    _s["estado"] = DETENIDO
    _s["referencia_g"] = None
    _s["cuenta"] = 0
    _s["fallos"] = 0
    return True
