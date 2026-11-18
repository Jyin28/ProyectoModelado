# Contrato · Límites de ambiente y episodios

Estado: **implementado y probado solo con PGlite**. Migración: `supabase/migrations/20261118000400_ordenes_modulo.sql`.

## Límites

Por módulo `cuna-ambiente-NN`. Se guardan con `public.guardar_limites(p_device_id, p_temp_min, p_temp_max, p_hum_min, p_hum_max)` (solo dueños activos) y se leen con `public.mis_limites(p_device_id)`, que devuelve `{temp_min, temp_max, hum_min, hum_max}` o `null` si no hay límites.

Reglas, validadas en la base y en la web:

- Temperatura entre -40 y 85 °C, con mínimo menor que máximo.
- Humedad entre 0 y 100 %, con mínimo menor que máximo.
- Un valor inválido se rechaza con `22023` (`limites_invalidos`) y **conserva el límite anterior**.

La app no inventa límites por defecto: sin límites guardados no hay avisos por rango.

## Episodios y avisos

Al recibir una lectura nueva (no un reenvío), `ingestar_ambiente` compara cada variable con los límites:

- Fuera de rango y sin episodio abierto: abre un episodio y registra un evento `ambiente_fuera_rango` con valor, unidad y límites; crea un aviso por destinatario de Telegram.
- Fuera de rango con episodio abierto: no avisa de nuevo (DEC-13).
- Dentro de rango: cierra el episodio. Una salida posterior abre otro y avisa otra vez.
- Temperatura y humedad tienen episodios independientes.

Limitación conocida: una lectura con hora anterior a otra ya evaluada puede cerrar un episodio antes de tiempo. No se corrigió en esta fase.
