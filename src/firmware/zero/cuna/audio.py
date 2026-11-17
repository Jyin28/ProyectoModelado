"""audio.py (ZERO) - Catalogo de audio pregrabado por el MAX98357A (I2S).

Los .wav estan en la carpeta audio/. Se reproducen con "aplay" (ALSA) en un
proceso aparte, asi que no bloquean el ciclo principal.

Funciones:
    catalogo()          nombres disponibles (archivos .wav sin la extension)
    reproducir(nombre)  empieza a sonar (detiene lo que sonaba antes)
    detener()           para el audio
    reproduciendo()     nombre que suena ahora, o None
    actualizar()        llamar en cada vuelta: detecta cuando termino el audio

Solo se aceptan nombres que esten en el catalogo (nada de rutas libres).
Volumen: el parlante es de 8 ohm y 0,5 W. Limitalo con un dispositivo softvol
(ver README) y no uses el maximo del amplificador.
"""
import os
import subprocess

import config

_estado = {"proceso": None, "nombre": None}


def catalogo():
    try:
        archivos = os.listdir(config.CARPETA_AUDIO)
    except OSError:
        return []
    return sorted(a[:-4] for a in archivos if a.lower().endswith(".wav"))


def reproducir(nombre):
    """Lanza el audio. Lanza ValueError si no existe, OSError si falta aplay."""
    if nombre not in catalogo():
        raise ValueError("audio_desconocido")
    detener()
    ruta = os.path.join(config.CARPETA_AUDIO, nombre + ".wav")
    _estado["proceso"] = subprocess.Popen(
        ["aplay", "-q", "-D", config.AUDIO_DISPOSITIVO, ruta],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    _estado["nombre"] = nombre


def detener():
    proceso = _estado["proceso"]
    if proceso is not None and proceso.poll() is None:
        proceso.terminate()
        try:
            proceso.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proceso.kill()
    _estado["proceso"] = None
    _estado["nombre"] = None


def reproduciendo():
    return _estado["nombre"]


def actualizar():
    """Si el audio ya termino, lo marca como detenido."""
    proceso = _estado["proceso"]
    if proceso is not None and proceso.poll() is not None:
        _estado["proceso"] = None
        _estado["nombre"] = None
