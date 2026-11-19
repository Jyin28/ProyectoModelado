# Cierre del Sprint 4

**Estado del 2026-11-18.** Resume lo que el repositorio contiene al terminar las fases 3 a 12 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md). El detalle por criterio está en [`matriz-hu-ca.md`](matriz-hu-ca.md).

## 1. Resultado en una frase

Todo el software de las 35 historias está implementado y probado con dobles (PGlite, Python de escritorio, Vitest). **Ningún criterio de hardware ni de Supabase real está comprobado**: ningún criterio funcional figura como verificado.

## 2. Estado de los 145 criterios

| Estado | Criterios | Qué significa |
|---|---|---|
| verificado | 3 | CA-31.1, CA-32.2 y CA-32.4, solo con evidencia documental |
| parcial | 139 | Hay código y pruebas simuladas; falta la prueba real |
| pendiente | 3 | CA-32.3 (recorrido real AM2301 a Supabase y web), CA-35.1 y CA-35.3 (recorrido en navegador a 360 y 1280 px) |
| bloqueado | 0 | Ninguno se intentó probar y quedó bloqueado; los bloqueos aparecen al ejecutar el guion |

## 3. Qué hay por área

| Área | Contenido | Pruebas |
|---|---|---|
| Backend (`supabase/`) | 14 migraciones locales: ambiente, lámpara, movimiento, cuentas y propiedad, avisos y Telegram, órdenes por módulo, colchón, habitación, alimentación, historial, recuperación, notificador inmediato | 184 pruebas con PGlite; medición de rendimiento aparte |
| Web (`src/frontend/`) | Cuna, bebés y dispositivos, colchón, figuras, habitación y cámara, alimentación, historial con gráficos y Excel | 434 pruebas con Vitest; lint y build sin errores |
| Firmware (`src/firmware/pico/`) | Cuna, figuras, colchón, habitación, juego y alimentación; órdenes remotas, voz, recuperación al conectar | 378 pruebas con Python de escritorio |
| Colchón (`src/firmware/pico/colchon/`) | Versión de Kevin (la de `Documentos\pico`), ahora el único colchón del firmware; `main.py` lo atiende con `ciclo_colchon()` | Sin pruebas versionadas de `monitoreo.py` y `peso.py` |
| Contratos (`src/shared/contracts/`) | Ingesta, órdenes, voz, habitación, alimentación, historial | — |

## 4. Qué falta y quién lo desbloquea

| Pendiente | Qué se necesita |
|---|---|
| Aplicar las migraciones al Supabase de desarrollo y repetir las mediciones | Acceso autorizado a `cuna-inteligente-dev`; Supabase CLI o permiso para aplicar SQL |
| Disparador de aviso inmediato (`20261118001000`) | Verificarlo con `pg_net` y Vault reales; sin él los avisos salen cada minuto, y HU-30 pide 5 s |
| Pruebas de banco B1 a B10, P2 y P3 | Pico, componentes, balanza de referencia, pesas, multímetro y fijación de la celda ([`protocolo-banco.md`](protocolo-banco.md)) |
| Revisión eléctrica y confirmación de componentes | El equipo ([`diseno-fisico.md`](diseno-fisico.md) §3 y §7) |
| TLS y audio I²S en la Pico | Una Pico con el firmware cargado |
| Ejecutar el guion de demostración | Cuentas de demostración, protoboards cableadas y el equipo presente ([`guion-demostracion.md`](guion-demostracion.md)) |
| Recorrido de la web a 360 y 1280 px | Una persona con un navegador (lista en [`validacion-fase11.md`](validacion-fase11.md) §6) |
| Abrir el Excel en Excel real | Una persona con Excel |
| Cotejar dimensiones con las normas y coordinar sustituciones | El equipo y el profesor |
| Aceptación del equipo y del cliente | Cuando ocurra; no se registra antes |

## 5. Decisiones que conviene confirmar

- Hueco de 30 minutos que corta una línea en los gráficos del historial ([`validacion-fase10.md`](validacion-fase10.md) §5).
- Tope de 20000 registros por consulta de historial y de 31 días por intervalo.
- Disparador con `pg_net` como mecanismo de aviso inmediato ([`validacion-fase11.md`](validacion-fase11.md) §5).
- Correspondencia HU-30 a HU-35 con Jira (sin confirmar; ver la matriz).
- Que el juego no genere registros en la web (decisión de la fase 8).

## 6. Cómo arrancar

README de la raíz, sección «Ejecutar la web». Para la demostración, [`guion-demostracion.md`](guion-demostracion.md).
