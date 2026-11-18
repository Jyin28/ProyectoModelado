"""efectos.py - Efectos del codigo funcional, como funciones puras (sin hardware).

Se pueden probar en CPython. Las usan figuras.py (patrones de LED) y
lampara.py (respiracion de la lampara).
"""


def pasos_patrones(cantidad=6):
    """Ciclo de patrones de LED del codigo funcional.

    Devuelve una lista de (indices_encendidos, duracion_ms). Al terminar la
    lista se repite desde el principio.
      1. encendido secuencial (150 ms cada LED)
      2. todos encendidos 500 ms y apagados 500 ms
      3. alternado pares/impares, 3 veces (300 ms cada fase)
      4. rebote de ida y vuelta (120 ms cada paso)
      5. encendido progresivo (200 ms por LED) y 500 ms con todos encendidos
    """
    todos = tuple(range(cantidad))
    pasos = []
    for i in todos:
        pasos.append(((i,), 150))
    pasos.append((todos, 500))
    pasos.append(((), 500))
    pares = tuple(range(0, cantidad, 2))
    impares = tuple(range(1, cantidad, 2))
    for _ in range(3):
        pasos.append((pares, 300))
        pasos.append((impares, 300))
    for i in todos:
        pasos.append(((i,), 120))
    for i in range(cantidad - 2, 0, -1):
        pasos.append(((i,), 120))
    for i in todos:
        ms = 200 if i < cantidad - 1 else 200 + 500
        pasos.append((tuple(range(i + 1)), ms))
    return pasos


def triangular_u16(ahora_ms, periodo_ms):
    """Onda triangular 0 -> 65535 -> 0 con el periodo dado (brillo de la lampara)."""
    if periodo_ms <= 0:
        return 0
    fase = ahora_ms % periodo_ms
    mitad = periodo_ms // 2
    if mitad == 0:
        return 0
    if fase < mitad:
        return fase * 65535 // mitad
    return max(0, (periodo_ms - fase) * 65535 // (periodo_ms - mitad))
