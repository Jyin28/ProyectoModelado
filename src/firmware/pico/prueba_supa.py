
# prueba_supabase.py
# Prueba de conexión entre Raspberry Pi Pico 2 W y Supabase.
import sys
import time

# Las carpetas del proyecto se agregan a la ruta de busqueda para poder
# escribir "import config", "import wifi", etc. sin paquetes.
# (figuras-led lleva guion, por eso no se puede importar como paquete.)
for _carpeta in ("/colchon", "/figuras-led", "/common/communication",
                 "/common/utilities"):
    if _carpeta not in sys.path:
        sys.path.append("/pico"+ _carpeta)
        
        


import config
import eventos
import nube

print("\n========== PRUEBA SUPABASE ==========")

print("DEVICE_ID:", config.DEVICE_ID)
print("Nube habilitada:", nube.habilitada())

if not nube.habilitada():
    print("ERROR: revisa secrets.py")
    raise SystemExit

# Forzar sincronizacion NTP, aunque el reloj parezca valido.
print("\nSincronizando reloj con NTP...")

if not eventos.sincronizar_hora():
    print("ERROR: no se pudo sincronizar el reloj.")
    raise SystemExit

print("Hora UTC:", eventos.ahora_iso())

evento = eventos.crear("monitoring_started", {
    "reference_g": 1000,
    "tolerance_pct": 10,
    "duration_s": 60,
    "alarm_s": 60
})

print("\nEvento creado:")
print(evento)

nube.encolar(evento)

print("\nEnviando evento...")
resultado = nube.enviar_pendientes()

print("Resultado HTTP:", resultado)
print("Eventos pendientes:", nube.pendientes())

if resultado and nube.pendientes() == 0:
    print("PRUEBA SUPERADA")
else:
    print("PRUEBA NO CONFIRMADA")

print("\n========== FIN DE PRUEBA ==========")
