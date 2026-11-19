# Entorno reproducible · Cuna Inteligente IoT

**Fase 1 del [plan de ejecución](PLAN-PROYECTO.md) · HU-32 (CA-32.1, CA-32.2, CA-32.3).**
Probado el 2026-11-17 sobre `development` en el commit `386ca9a` (rama de trabajo `docs/fase1-linea-base`).

Este documento reemplaza para el Sprint 4 la sección de instalación de `docs/Sprint3/entorno.md`, que solo cubre la web. Los resultados de las ejecuciones están en [validacion-fase1.md](validacion-fase1.md).

## 1. Requisitos

| Herramienta | Versión usada en la prueba | Para qué |
|---|---|---|
| Node.js | 26.13.1 | Web y pruebas de Supabase |
| npm | 11.20.0 | Dependencias |
| Python | 3.15.2 (CPython, escritorio) | Pruebas unitarias del firmware |
| Git | cualquiera reciente | Ramas |
| Supabase CLI | **no instalada en la máquina de prueba** | Solo para aplicar migraciones y desplegar `ingesta` en la nube |
| MicroPython en la Pico 2 W | no probado en esta fase | Firmware real |

Notas de versión:

- `supabase/README.md` y `docs/Sprint3/entorno.md` mencionan Node 24. Las pruebas de la web y de Supabase pasaron con Node 26.13.1. No se probó con Node 24 en esta fase.
- Las pruebas del firmware se ejecutan en CPython de escritorio con dispositivos simulados. No prueban TLS, I²S ni GPIO reales.
- No hay Docker ni Deno. Por eso no se puede reproducir en local la Edge Function como servicio; las pruebas de `supabase/` ejercitan la migración con PostgreSQL en memoria (PGlite) y el manejador HTTP.

En PowerShell use `npm.cmd` si `npm` no se reconoce.

## 2. Configuración sin credenciales

Los archivos de ejemplo están versionados. Los reales están ignorados por Git (`.gitignore:94-95` y `:127`).

| Archivo de ejemplo | Copiar a | Contenido (solo nombres de variables) |
|---|---|---|
| `src/frontend/.env.example` | `src/frontend/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_AMBIENTE_DEVICE_ID`, `VITE_LAMPARA_HABILITADA`, `VITE_LAMPARA_DEVICE_ID`, `VITE_MOVIMIENTO_HABILITADO`, `VITE_MOVIMIENTO_DEVICE_ID` |
| `src/firmware/pico/secrets.example.py` | `src/firmware/pico/secrets.py` | `WIFI_SSID`, `WIFI_PASSWORD`, `AMBIENTE_URL`, `AMBIENTE_DEVICE_ID`, `AMBIENTE_TOKEN`, `LAMPARA_SUPABASE_URL`, `LAMPARA_PUBLISHABLE_KEY`, `LAMPARA_DEVICE_ID`, `LAMPARA_AUTH_EMAIL`, `LAMPARA_AUTH_PASSWORD`, `MOVIMIENTO_DEVICE_ID`, `MOVIMIENTO_TOKEN` |

Sin `.env.local`, la web arranca en modo «Backend no configurado»: entra sin sesión y no muestra datos. Es el modo de las pruebas automáticas.

Los valores reales (URL, claves, tokens, contraseña de la cuenta de dispositivo) los gestiona cada integrante y no se escriben en el repositorio, en issues ni en documentos de entrega. La clave de servidor de Supabase nunca se usa en la web ni en la Pico: solo existe dentro de la Edge Function.

## 3. Instalar y probar

Desde la raíz del repositorio, en PowerShell:

```powershell
# Web
cd src\frontend
npm.cmd ci
npm.cmd test
npm.cmd run lint
npm.cmd run build
cd ..\..

# Backend (pruebas con PostgreSQL en memoria)
cd supabase
npm.cmd ci
npm.cmd test
cd ..

# Firmware (CPython de escritorio)
python -m unittest discover -s src/firmware/pico/tests
```

Arrancar la web:

```powershell
cd src\frontend
npm.cmd run dev   # http://localhost:5173
```

**Voz desde el teléfono (hotspot).** El navegador solo da el micrófono en `https` o en
`localhost`. Desde el portátil basta `npm.cmd run dev`. Para el teléfono, sirve la web por
https en la red local:

```powershell
npm.cmd run dev:https   # muestra «Network: https://<IP>:5173»; abre esa dirección en el teléfono
```

El certificado es autofirmado: el teléfono mostrará una advertencia que hay que aceptar (solo
la primera vez). Con `VITE_VOZ_HABILITADA=true` en `.env.local` aparece «Hablar a la cuna»
en la pestaña «Parlante». Si la dirección no es segura, el panel lo dice en lugar de pedir el
micrófono.

Resultado esperado: 14 archivos y 159 pruebas en la web, 29 pruebas en Supabase, 171 pruebas en el firmware, lint y build sin errores.

## 4. Qué demuestra y qué no cada prueba

| Prueba | Demuestra | No demuestra |
|---|---|---|
| `src/frontend` (Vitest, jsdom) | Lógica de pantallas, sesión y consultas con Supabase simulado | Conexión con un Supabase real |
| `supabase` (PGlite) | Migraciones, RLS, RPC e ingesta con PostgreSQL en memoria | Despliegue real, Realtime real, políticas sobre `realtime.messages` en la nube |
| `src/firmware/pico/tests` | Lógica de órdenes, colchón, audio y comandos con dispositivos simulados | TLS, NTP, I²S, GPIO ni sensores reales |

Una prueba simulada acredita lógica. Una prueba física requiere evidencia del equipo.

## 5. Guía manual para CA-32.3 (dispositivo de prueba → backend → persistencia)

**Estado: pendiente.** Requiere el proyecto Supabase de desarrollo (`cuna-inteligente-dev`, referencia en `supabase/README.md`), acceso del integrante responsable del backend y un token propio. Claude Code no ejecuta estos pasos ni lee credenciales: `CLAUDE.md` prohíbe crear tablas, funciones, usuarios o datos en ese proyecto sin pedido explícito.

Ejecuta una persona del equipo con acceso:

1. Instala Supabase CLI y ejecuta `supabase login` y `supabase link` con la referencia del proyecto (ver `supabase/README.md`, sección «Preparar el proyecto de desarrollo»).
2. `supabase db push --dry-run`, revisa el plan y luego `supabase db push`. Después `supabase functions deploy ingesta`.
3. Crea en Authentication un usuario de prueba y anota su UUID.
4. Genera un token de módulo y calcula su SHA-256 sin escribirlo en el repositorio (comandos en `supabase/README.md`, paso 3). Guarda el token solo en `src/firmware/pico/secrets.py` o en una variable de entorno de tu sesión.
5. En el editor SQL, ejecuta el bloque de provisión de `supabase/README.md` (paso 4): inserta el módulo con el hash, el dueño y un bebé de prueba con asignación anterior a la primera medición.
6. Envía un evento de prueba, por ejemplo con `curl` desde PowerShell. Pon la URL y el token en variables de entorno de tu sesión, no en el comando guardado:

   ```powershell
   $body = '{"event_id":"<uuid-v4-nuevo>","device_id":"cuna-ambiente-01","tipo":"ambiente","ts":"<UTC ahora, formato 2026-11-17T16:04:10Z>","datos":{"temperatura_c":24.3,"humedad_pct":52.1}}'
   curl.exe -s -o NUL -w "%{http_code}" -X POST $env:AMBIENTE_URL -H "Content-Type: application/json" -H "Authorization: Bearer $env:AMBIENTE_TOKEN" --data-raw $body
   ```

7. Resultados esperados:

   | Acción | Esperado |
   |---|---|
   | Primer envío | `201` |
   | Mismo `event_id` otra vez | `409` y una sola fila |
   | Token incorrecto | `401` |
   | `ts` anterior a la asignación del bebé | `422` |
   | Consulta con el usuario dueño en la web (`VITE_*` configuradas) | Se ve temperatura, humedad y hora de `America/Costa_Rica` |
   | Consulta con un usuario sin acceso | No obtiene la fila |

8. Registra en `validacion-fase1.md`: fecha, commit, versión de la función desplegada, códigos HTTP observados, captura o descripción de la fila persistida y de la vista web. Marca CA-32.3 como verificado solo con esa evidencia. Si se repite con una Pico real, anota también el módulo y la red usada.

No dejes tokens ni el hash en capturas, historial de terminal compartido o documentos.

## 6. Comprobación de secretos (CA-32.2)

La revisión de esta fase está en [validacion-fase1.md](validacion-fase1.md). Para repetirla sin imprimir valores:

```powershell
git ls-files | Select-String -Pattern '(^|/)(\.env|secrets)'
git check-ignore -v src/frontend/.env.local src/firmware/pico/secrets.py
git grep -l -I -E "eyJ[A-Za-z0-9_-]{20,}\.|sb_secret_[A-Za-z0-9]{10,}"
```

Solo deben aparecer `src/frontend/.env.example` y `src/firmware/pico/secrets.example.py` como archivos versionados, ambos con nombres de variables y sin valores.

## 7. Problemas conocidos del entorno

- `npm audit` en `src/frontend` informa 6 vulnerabilidades de severidad alta, todas en herramientas de desarrollo y compilación (`vite`, `vitest`, `@vitejs/plugin-react` y las transitivas `fdir`, `picomatch`, `tinyglobby`). No se evaluó su impacto real; conviene revisar `npm audit` antes de la entrega. No se aplicó `npm audit fix` para no cambiar versiones sin acuerdo.
- Sin Supabase CLI, Docker ni Deno no se puede levantar el backend local. La reproducción completa depende del proyecto en la nube.
