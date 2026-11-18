# Plan de ejecución · Cuna Inteligente IoT

**Meta:** entregar y demostrar los seis módulos de la especificación, con trazabilidad desde la acción física hasta su registro y consulta. Fuente de aceptación: *EntregableSprint1 (1).pdf*, 15 páginas, HU-01 a HU-35 y DAT-01 a DAT-04. El repositorio incluye la especificación de consulta en `docs/Sprint1/EntregableSprint1.pdf`. Usar los identificadores del PDF al cruzar con Jira, donde algunas historias técnicas tienen otra numeración.

## Punto de partida y forma de trabajo

Base revisada: `development`, commit `386ca9a`. Supabase ya tiene migraciones de ambiente, comandos y confirmación de lámpara, eventos de movimiento y la función `ingesta`. En `src/frontend` existen login y páginas de cuna, figuras, colchón e historial. En `src/firmware` existen el selector de módulo, control de lámpara, figuras, audio y lógica de calibración y alarma del colchón. La maqueta del Sprint 3 usa una Pico 2 W conectada a una protoboard por vez. La presencia de una página o un controlador acredita código existente; su aceptación requiere evidencia del recorrido completo.

**Instrucción para Claude Code:** ejecutá la fase indicada desde el estado vigente de `development`. Para cada HU, consultá sus CA en la especificación y las decisiones DEC-01 a DEC-13 en `docs/Jira/DecisionesAprobadas.md`. Conservá los comportamientos ya comprobados. Al terminar, registrá commit, archivos modificados, comandos, resultados y CA pendientes. Usá los estados pendiente, parcial, verificado o bloqueado; para los bloqueos indicá el recurso o decisión que falta. Una prueba simulada acredita lógica; una prueba física requiere evidencia del equipo. Las fases son incrementos propuestos, no fechas comprometidas.

## 1. Establecer la línea base y los contratos · HU-31 y HU-32

- [ ] Comparar las 35 historias con rutas de la web, migraciones, funciones, firmware y pruebas. Inventariar también discrepancias entre el plan histórico del Sprint 3 y el código integrado.
- [ ] Reproducir la web y Supabase de desarrollo con configuración de ejemplo. Correr `npm test`, `npm run lint` y `npm run build` en `src/frontend`, `npm test` en `supabase` y `python -m unittest discover -s src/firmware/tests` desde la raíz. Registrar dependencias y fallos iniciales.
- [ ] Documentar productor y consumidor de cada evento/comando, identidad del dispositivo, bebé asociado en el instante del evento, hora, unidad, reintentos, errores y confirmación física. Definir estados de alarma, toma y horarios tras cortes.
- **Salida:** matriz HU/CA con evidencia o brecha, arquitectura actualizada e instrucciones reproducibles. Comprobar un envío desde dispositivo de prueba hasta lectura persistida.

## 2. Cerrar el diseño físico y comprobar interfaces · HU-33 y preparación de HU-29

- [ ] Preparar ficha de cada módulo con componentes, conexiones, alimentación, dimensiones, materiales y límites. Cubrir ambas balanzas con rango, precisión y calibración, cámara de habitación, cinco botones, brillo, volumen y método de temperatura del biberón.
- [ ] Distinguir el diseño comercial de la maqueta USB. Documentar dimensiones estándar de cuna, alimentación independiente o compartida del colchón, baterías del juego comercial y conexión por cable del módulo de alimentación. Coordinar sustituciones de sensores con el profesor.
- **Salida:** mapa de conexiones y protocolo de banco para seis módulos. Hacer primero pruebas de voz, cámara y pesaje que podrían condicionar la arquitectura. Registrar qué requiere componentes o intervención presencial.

## 3. Cuentas, bebés y propiedad histórica · HU-01 a HU-05 y base de HU-24

- [ ] Completar registro, sesión, perfiles, asociación de accesorios independientes, invitación por correo, aceptación y revocación. Impedir eliminar al último dueño.
- [ ] Implementar reasignación con vigencia temporal y políticas de acceso en Supabase. Conservar la asociación original de eventos y fotos. Aplicar permisos tanto a consultas como a comandos.
- **Salida:** dos cuentas y dos bebés de prueba permiten demostrar acceso compartido, revocación y reasignación. Verificar que el historial anterior continúa vinculado al bebé correcto.

## 4. Eventos, Telegram y horarios compartidos · HU-06, HU-07 y HU-24

- [ ] Crear registro persistente con identificador único por evento, destinatarios por dispositivo y vinculación Telegram con código de un uso. Separar permisos de control y recepción de avisos.
- [ ] Ejecutar horarios en America/Costa_Rica desde el servicio aunque la web esté cerrada. Registrar intentos, fallos y reintentos por evento y destinatario. Un evento reenviado conserva su identidad; dos eventos distintos con la misma hora se guardan ambos.
- **Salida:** probar con dos destinatarios, un reenvío y un destinatario desvinculado. Comprobar persistencia y aviso con la web cerrada mediante cuentas de prueba configuradas.

## 5. Completar cuna y figuras · HU-08 a HU-13

- [ ] Conectar activación manual y por horario del PIR al registro y aviso con hora. Verificar AM2301 cada 10 s en °C y % HR. Validar mínimo < máximo y emitir un aviso por episodio fuera de rango hasta que regrese al rango.
- [ ] Recorrer web → comando → dispositivo → confirmación para lámpara regulable, selección/reproducción/parada de audio y figuras independientes. Implementar horarios y velocidad de los seis LED con intervalo mínimo de 2 s.
- [ ] Implementar voz en vivo desde el celular al altavoz. Registrar solo actividad permitida y cerrar la transmisión al terminar o desconectarse.
- **Salida:** demostrar cada control con el módulo conectado. Probar también un comando sin confirmación, un segundo episodio ambiental y pérdida de conexión durante la voz.

## 6. Integrar el colchón independiente · HU-14 a HU-16

- [ ] Conectar la lógica existente de HX711, calibración y buzzer con configuración web, persistencia, control y avisos. Al activar, validar duración positiva, tolerancia y referencia válida. Medir cada segundo y detener al vencer el período.
- **Salida:** con pesos de prueba, demostrar pérdida superior al 10 % durante tres lecturas consecutivas, alarma local y aviso. Repetir parada por botón, web y temporizador (60 s configurable). Verificar monitoreo detenido tras cada parada y rearme explícito con referencia nueva.

## 7. Implementar el kit de habitación · HU-17 y HU-18

- [ ] Integrar apertura de puerta y movimiento con ventanas de monitoreo y control manual. Durante monitoreo activo asociar evento, fotografía privada y aviso de captura por Telegram. La maqueta admite teléfono como cámara.
- **Salida:** disparar cada sensor dentro y fuera del horario. Verificar consulta de imagen por dueño, denegación a otra cuenta, aviso sin imagen y estado visible si falla la captura.

## 8. Implementar el juego · HU-19

- [ ] Conectar cinco botones y sus luces. Elegir objetivo aleatorio, leer una pulsación por acción física, premiar el acierto con sonido y seleccionar el siguiente objetivo tras cada pulsación hasta apagar.
- **Salida:** demostrar acierto, error, cambio de objetivo y apagado. Registrar tamaño y fijación de botones y alimentación utilizada en la maqueta.

## 9. Implementar alimentación · HU-20 a HU-23

- [ ] Integrar balanza y sensor de temperatura del biberón. Guardar gramos iniciales y finales del mismo recipiente. Modelar inicio, pausa, reanudación y cierre manual. Excluir pausas de la duración y calcular consumo por diferencia.
- [ ] Solicitar corrección si falta peso o el final supera el inicial. Conservar original, nuevo valor, autor, fecha y motivo. Devolver el biberón permite pesar y mantiene la toma abierta.
- [ ] Agregar lista diaria editable de horas y avisos por temperatura fuera de límites. Reutilizar planificador, episodios y destinatarios de fase 4.
- **Salida:** completar una toma con pausa y corrección auditada, verificar ambos extremos de temperatura y comprobar una entrega por hora programada y destinatario.

## 10. Historial, resumen nocturno, gráficos y Excel · HU-24 a HU-27

- [ ] Unificar actividad por bebé, dispositivo, tipo y período. Permitir elegir inicio y fin de la noche incluso al cruzar medianoche. Mostrar fotos autorizadas desde los eventos de habitación.
- [ ] Mostrar eventos por hora en intervalos [inicio, fin) y mediciones como líneas con fecha, hora y unidad. Diferenciar cero eventos de un intervalo sin lecturas.
- [ ] Exportar .xlsx para el bebé y período elegidos, una fila por registro con columnas de DEC-06 y campos adicionales de tomas. Excluir fotos y enlaces.
- **Salida:** usar datos conocidos con cambio de día, hueco y reasignación. Conciliar registros, gráficos y filas de Excel. Revisar DAT-01 a DAT-04 en la página 15.

## 11. Recuperación, rendimiento, privacidad y uso web · HU-28, HU-30, HU-34 y HU-35

- [ ] Cortar Wi-Fi y energía durante monitoreo y programación. Verificar configuración e historial conservados, huecos visibles, rearme manual del colchón y omisión de recordatorios vencidos. Probar el siguiente horario futuro.
- [ ] Medir con 2 cuentas concurrentes, 2 bebés, un ejemplar por módulo y 1000 eventos. Registrar 100 consultas y 100 solicitudes de aviso. Al menos 95 de cada serie deben cumplir historial ≤3 s y solicitud a Telegram ≤5 s desde recepción del evento en backend. Medir aparte periodicidad ambiental y de peso.
- [ ] Verificar permisos desde web y API sobre datos, fotos y controles, revocación y ausencia de audio guardado. Recorrer cuentas, configuración, controles, historial y exportación a 360 y 1280 px. Registrar navegador, versión y dispositivo.
- **Salida:** tabla de resultados medidos y defectos reproducibles. Corregir fallos y repetir los casos afectados.

## 12. Demostración modular y cierre · HU-29 y aceptación integral

- [ ] Preparar guion y datos de prueba para cuna, figuras, colchón independiente, habitación, juego y alimentación. Indicar cuándo cambiar de protoboard, qué acción realiza el adulto, qué respuesta física observar y qué registro debe aparecer.
- [ ] Ejecutar el guion con hardware y cuentas de demostración. Reunir evidencias por CA, arquitectura final, materiales, calibraciones, instrucciones de arranque y limitaciones. Registrar aceptación del equipo/cliente cuando ocurra.
- **Salida:** cada CA cuenta con resultado, evidencia y versión probada o con una excepción identificada. Una fase bloqueada por hardware queda abierta aunque pase su simulación.

**Dependencias:** la fase 1 fija contratos y la 2 habilita banco físico. La fase 3 habilita propiedad y la 4 habilita avisos. Con esas bases, las fases 5 a 9 se pueden distribuir por módulo. La fase 10 puede comenzar con eventos de prueba y debe reconciliar datos reales al cerrar. Ejecutar 11 y 12 sobre el mismo incremento integrado.

## Índice de aceptación del PDF

| Historia | Criterios a comprobar | Fase principal |
|---|---|---|
| HU-01 | CA-01.1 a CA-01.4 | 3 |
| HU-02 | CA-02.1 a CA-02.3 | 3 |
| HU-03 | CA-03.1 a CA-03.4 | 3 |
| HU-04 | CA-04.1 a CA-04.3 | 3 |
| HU-05 | CA-05.1 a CA-05.3 | 3 |
| HU-06 | CA-06.1 a CA-06.3 | 4 |
| HU-07 | CA-07.1 a CA-07.5 | 4 |
| HU-08 | CA-08.1 a CA-08.3 | 5 |
| HU-09 | CA-09.1 a CA-09.3 | 5 |
| HU-10 | CA-10.1 a CA-10.4 | 5 |
| HU-11 | CA-11.1 a CA-11.4 | 5 |
| HU-12 | CA-12.1 a CA-12.3 | 5 |
| HU-13 | CA-13.1 a CA-13.4 | 5 |
| HU-14 | CA-14.1 a CA-14.5 | 6 |
| HU-15 | CA-15.1 a CA-15.4 | 6 |
| HU-16 | CA-16.1 a CA-16.3 | 6 |
| HU-17 | CA-17.1 a CA-17.5 | 7 |
| HU-18 | CA-18.1 a CA-18.4 | 7 |
| HU-19 | CA-19.1 a CA-19.5 | 8 |
| HU-20 | CA-20.1 a CA-20.4 | 9 |
| HU-21 | CA-21.1 a CA-21.7 | 9 |
| HU-22 | CA-22.1 a CA-22.4 | 9 |
| HU-23 | CA-23.1 a CA-23.4 | 9 |
| HU-24 | CA-24.1 a CA-24.7 | 10 |
| HU-25 | CA-25.1 a CA-25.4 | 10 |
| HU-26 | CA-26.1 a CA-26.4 | 10 |
| HU-27 | CA-27.1 a CA-27.5 | 10 |
| HU-28 | CA-28.1 a CA-28.4 | 11 |
| HU-29 | CA-29.1 a CA-29.4 | 12 |
| HU-30 | CA-30.1 a CA-30.4 | 11 |
| HU-31 | CA-31.1 a CA-31.4 | 1 |
| HU-32 | CA-32.1 a CA-32.4 | 1 |
| HU-33 | CA-33.1 a CA-33.6 | 2 |
| HU-34 | CA-34.1 a CA-34.5 | 11 |
| HU-35 | CA-35.1 a CA-35.3 | 11 |
