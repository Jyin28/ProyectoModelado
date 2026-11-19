# Plan de ejecución · Cuna Inteligente IoT

**Meta:** entregar y demostrar los seis módulos de la especificación, con trazabilidad desde la acción física hasta su registro y consulta.

**Fuente de aceptación:** *EntregableSprint1 (1).pdf* (copia idéntica en `docs/Sprint1/EntregableSprint1.pdf`), 15 páginas, HU-01 a HU-35 y DAT-01 a DAT-04. Este plan incluye el texto completo de cada criterio de aceptación (CA) bajo su fase. **No hace falta releer el PDF** para ejecutar una fase; consultarlo solo si hay duda de transcripción. Usar los identificadores del PDF al cruzar con Jira, donde algunas historias técnicas tienen otra numeración.

## Punto de partida y forma de trabajo

Base revisada: `development`, commit `386ca9a`. Supabase ya tiene migraciones de ambiente, comandos y confirmación de lámpara, eventos de movimiento y la función `ingesta`. En `src/frontend` existen login y páginas de cuna, figuras, colchón e historial. En `src/firmware/pico` existen el selector de módulo, control de lámpara, figuras, audio y lógica de calibración y alarma del colchón. La maqueta del Sprint 3 usa una Pico 2 W conectada a una protoboard por vez. La presencia de una página o un controlador acredita código existente; su aceptación requiere evidencia del recorrido completo.

**Instrucción para Claude Code:** ejecutá la fase indicada desde el estado vigente de `development`. Para cada HU, usá los CA de este documento y las decisiones DEC-01 a DEC-13 en `docs/Jira/DecisionesAprobadas.md`. Conservá los comportamientos ya comprobados. Al terminar, registrá commit, archivos modificados, comandos, resultados y CA pendientes. Usá los estados pendiente, parcial, verificado o bloqueado; para los bloqueos indicá el recurso o decisión que falta. Una prueba simulada acredita lógica; una prueba física requiere evidencia del equipo. Las fases son incrementos propuestos, no fechas comprometidas.

## Contexto de la especificación

**Producto.** Sistema inteligente de cuido y entretenimiento para bebés (TEC, Principios de Modelado en Ingeniería, cliente Alejandro Quesada, profesor Diego Andrés Mora Rojas). Controla una cuna inteligente y cinco accesorios: figuras LED, colchón, kit de habitación, juego y alimentación. Web gratuita para operar los módulos adquiridos, consultar historial en nube y recibir avisos por Telegram. Uso familiar y eventual venta modular. Seis módulos: cuna, figuras LED, colchón, habitación, juego, alimentación.

**Perspectiva.** La web intercambia datos y órdenes con los dispositivos por medio del backend y consulta almacenamiento en nube. Telegram es el servicio externo de avisos. El colchón debe poder usarse sin comprar la cuna. Protocolos y componentes se definen en arquitectura, no los impone el cliente.

**Funciones.** Gestionar cuentas, bebés y dueños; controlar sensores y actuadores; programar monitoreo; alertar; capturar fotografías; registrar alimentación; entretener; conservar historial; mostrar gráficos y exportar registros.

**Usuarios.** Padres, madres y otros cuidadores operan web y Telegram, sin formación técnica. Los dueños comparten configuración por dispositivo; los destinatarios de avisos se gestionan aparte. El equipo y el cliente revisan los resultados de la maqueta.

**Restricciones (2.4).** Cuna por tomacorriente, sin baterías. Juego comercial a baterías; la maqueta puede usar electricidad. Sin UPS ni continuidad sin internet. Cámara de habitación solo para fotos (puede ser un teléfono en la maqueta). No se eliminan registros. Se desarrollan todos los módulos y se permite reutilizar componentes entre incrementos. Las sustituciones de sensores se coordinan con el profesor.

**Suposiciones (2.5).** Operación dependiente de electricidad, internet, nube y Telegram. Supabase es elección técnica del equipo. La alimentación incorpora balanza. El equipo define frecuencia, reinicio y capacidad de prueba. Precisión y rangos se concretan y verifican en arquitectura. **Requisitos futuros (2.6):** ninguno comprometido.

**Definiciones.** *Dueño*: cuenta autorizada a compartir la configuración de un dispositivo. *Destinatario*: persona configurada para recibir avisos en Telegram; no implica ser dueño. *Toma*: sesión de alimentación con medición inicial, final y duración. *Rearme*: restablecimiento del monitoreo tras una alarma; distinto de silenciarla. *Evento*: instancia de actividad con fecha, hora, tipo y datos asociados.

**Interfaces externas (3.1).**

| Código | Alcance | Vinculado a |
|---|---|---|
| INT-01 | Web común para controlar y consultar los módulos asociados y gestionar bebés y dispositivos | HU-01 a HU-29; HU-35; CA-31.4 |
| INT-02 | Sensores de movimiento, temperatura, humedad, peso, apertura y botones; controles de luces, audio, alarma y fotografía; incluye pesaje de alimentación | HU-08 a HU-23; HU-29; HU-33 |
| INT-03 | Persistencia y consulta de registros y fotografías en la nube, asociados a bebé y dispositivo | HU-18, HU-24, HU-25; CA-24.6 |
| INT-04 | Telegram para avisos a los destinatarios configurados, con la web cerrada y sin adjuntar fotografías | HU-06, HU-07, HU-22; CA-07.2 y CA-07.4 |
| INT-05 | Exportación .xlsx con fecha, hora y evento y datos aplicables; sin fotos ni enlaces a fotos | HU-27; CA-27.1 a CA-27.5 |
| INT-06 | Transmisión de voz en vivo del celular a la cuna, un solo sentido y sin almacenar audio | HU-12; CA-12.1 a CA-12.3 |

**Reglas de datos (3.6).**

| Regla | Historia | Criterios |
|---|---|---|
| DAT-01 Actividades y fotografías | HU-24 y HU-18 | CA-24.1 a CA-24.6; CA-18.1 a CA-18.4 |
| DAT-02 Tomas y correcciones | HU-21 | CA-21.1 a CA-21.7 |
| DAT-03 Zona horaria consistente | HU-22, HU-26, HU-27 | CA-22.3; CA-22.4; CA-26.3; CA-27.3 |
| DAT-04 Conservación del historial | HU-24, HU-05, HU-34 | CA-24.7; CA-05.1 a CA-05.3; CA-34.3 |

**Clasificación.** RF = requisito funcional, RNF = no funcional (calidad). HU-31 a HU-33 son historias técnicas de restricciones de diseño (RD-01 a RD-03); no acreditan que arquitectura o maqueta estén construidas. RNF-01/02 = HU-30; RNF-03 a RNF-05 = HU-34; RNF-06 = HU-28; RNF-07 = HU-35.

---

## 1. Establecer la línea base y los contratos · HU-31 y HU-32

- [ ] Comparar las 35 historias con rutas de la web, migraciones, funciones, firmware y pruebas. Inventariar también discrepancias entre el plan histórico del Sprint 3 y el código integrado.
- [ ] Reproducir la web y Supabase de desarrollo con configuración de ejemplo. Correr `npm test`, `npm run lint` y `npm run build` en `src/frontend`, `npm test` en `supabase` y `python -m unittest discover -s src/firmware/pico/tests` desde la raíz. Registrar dependencias y fallos iniciales.
- [ ] Documentar productor y consumidor de cada evento/comando, identidad del dispositivo, bebé asociado en el instante del evento, hora, unidad, reintentos, errores y confirmación física. Definir estados de alarma, toma y horarios tras cortes.
- **Salida:** matriz HU/CA con evidencia o brecha, arquitectura actualizada e instrucciones reproducibles. Comprobar un envío desde dispositivo de prueba hasta lectura persistida.

**HU-31 Diseñar arquitectura e interfaces** (historia técnica)
- CA-31.1: Se documentan web, Supabase, hardware, Telegram, fotos y voz, con responsabilidades y diagramas.
- CA-31.2: Se definen contratos de eventos, identidad, fecha/hora, errores y asociaciones históricas.
- CA-31.3: Se definen estados de toma, alarma y recuperación, incluida la política de horarios de cada módulo después de un corte.
- CA-31.4: La interfaz es un sitio web gratuito para operar los dispositivos adquiridos y contiene los controles de las historias HU-01 a HU-29. No se exige una aplicación nativa.

**HU-32 Preparar entorno e infraestructura** (historia técnica)
- CA-32.1: El entorno ejecuta web, backend y almacenamiento con configuración documentada.
- CA-32.2: Las credenciales no aparecen en repositorio ni en archivos públicos de entrega.
- CA-32.3: Se comprueba comunicación de un dispositivo de prueba con el backend y persistencia.
- CA-32.4: El backend y la base de datos utilizan Supabase. La distribución de servicios, los protocolos y el esquema se documentan en arquitectura.

## 2. Cerrar el diseño físico y comprobar interfaces · HU-33 y preparación de HU-29

- [ ] Preparar ficha de cada módulo con componentes, conexiones, alimentación, dimensiones, materiales y límites. Cubrir ambas balanzas con rango, precisión y calibración, cámara de habitación, cinco botones, brillo, volumen y método de temperatura del biberón.
- [ ] Distinguir el diseño comercial de la maqueta USB. Documentar dimensiones estándar de cuna, alimentación independiente o compartida del colchón, baterías del juego comercial y conexión por cable del módulo de alimentación. Coordinar sustituciones de sensores con el profesor.
- **Salida:** mapa de conexiones y protocolo de banco para seis módulos. Hacer primero pruebas de voz, cámara y pesaje que podrían condicionar la arquitectura. Registrar qué requiere componentes o intervención presencial.

**HU-33 Definir y validar diseño físico de maqueta** (historia técnica; integra con HU-13, 14, 19, 20, 23)
- CA-33.1: La lista de componentes incluye ambas balanzas, sensores, cámara, luces, audio, botones y alimentación.
- CA-33.2: Se documentan rango, precisión, calibración, método de temperatura del biberón, dimensiones, materiales, brillo, volumen y seguridad mecánica del juguete, y se verifica su viabilidad para la maqueta.
- CA-33.3: Se respetan cinco botones, colchón independiente y restricciones de alimentación; toda sustitución tiene coordinación con el profesor.
- CA-33.4: El diseño respeta la alimentación y modularidad de cada producto, los cinco botones del juego y los límites de cámara y audio del alcance aprobado. La maqueta y la lista de componentes permiten comprobarlo.
- CA-33.5: El diseño de la cuna comercial utiliza dimensiones de cuna estándar y documenta los materiales y componentes propuestos. La maqueta académica puede construirse a escala.
- CA-33.6: El módulo de alimentación se conecta al sistema por cable. El diseño documenta la conexión y los componentes utilizados.

## 3. Cuentas, bebés y propiedad histórica · HU-01 a HU-05 y base de HU-24

- [ ] Completar registro, sesión, perfiles, asociación de accesorios independientes, invitación por correo, aceptación y revocación. Impedir eliminar al último dueño.
- [ ] Implementar reasignación con vigencia temporal y políticas de acceso en Supabase. Conservar la asociación original de eventos y fotos. Aplicar permisos tanto a consultas como a comandos.
- **Salida:** dos cuentas y dos bebés de prueba permiten demostrar acceso compartido, revocación y reasignación. Verificar que el historial anterior continúa vinculado al bebé correcto.

**HU-01 Registrar e iniciar sesión** (RF-01; correo y contraseña)
- CA-01.1: Una cuenta registrada puede iniciar sesión con sus credenciales.
- CA-01.2: Las credenciales incorrectas impiden el acceso.
- CA-01.3: El cierre de sesión termina el acceso autenticado.
- CA-01.4: Un correo ya registrado o campos obligatorios vacíos no crean una segunda cuenta.

**HU-02 Gestionar bebés** (RF-02; un registro por bebé para separar historiales)
- CA-02.1: Dos bebés de una cuenta mantienen registros separados.
- CA-02.2: Es posible asociar accesorios a un bebé sin comprar la cuna.
- CA-02.3: Al crear un perfil, se exige nombre del bebé y se permite dejar vacía la fecha de nacimiento.

**HU-03 Asociar dispositivos** (RF-03)
- CA-03.1: Una cuenta puede asociar varios dispositivos.
- CA-03.2: Se respeta una cuna por bebé y se admiten accesorios independientes.
- CA-03.3: La interfaz presenta los módulos asociados.
- CA-03.4: Asociar una segunda cuna a un bebé se rechaza sin eliminar la asociación existente.

**HU-04 Administrar dueños compartidos** (RF-04; incluye RNF-03)
- CA-04.1: Dos dueños consultan la misma configuración del dispositivo.
- CA-04.2: La sección Bebés y dispositivos ofrece Administrar dueños.
- CA-04.3: Una invitación por correo solo concede acceso tras aceptarla; retirar a un dueño revoca su acceso y conserva el historial; se impide retirar al último dueño.

**HU-05 Reasignar una cuna** (RF-05; incluye RNF-04; reutilizar sin mezclar historiales)
- CA-05.1: La reasignación vincula las actividades nuevas con el nuevo bebé.
- CA-05.2: Los registros previos conservan su bebé original.
- CA-05.3: La reasignación no borra registros.

## 4. Eventos, Telegram y horarios compartidos · HU-06, HU-07 y HU-24

- [ ] Crear registro persistente con identificador único por evento, destinatarios por dispositivo y vinculación Telegram con código de un uso. Separar permisos de control y recepción de avisos.
- [ ] Ejecutar horarios en America/Costa_Rica desde el servicio aunque la web esté cerrada. Registrar intentos, fallos y reintentos por evento y destinatario. Un evento reenviado conserva su identidad; dos eventos distintos con la misma hora se guardan ambos.
- **Salida:** probar con dos destinatarios, un reenvío y un destinatario desvinculado. Comprobar persistencia y aviso con la web cerrada mediante cuentas de prueba configuradas.

**HU-06 Configurar destinatarios de Telegram** (RF-06; varios por dispositivo)
- CA-06.1: La sección Destinatarios de Telegram permite configurar más de un destinatario.
- CA-06.2: La lista pertenece al dispositivo y es compartida por sus dueños.
- CA-06.3: Un código de un solo uso vincula al destinatario; retirarlo evita futuros avisos y no modifica los dueños del dispositivo.

**HU-07 Recibir avisos por evento** (RF-07; alertas y recordatorios con la web cerrada; integra HU-24)
- CA-07.1: Un evento habilitado genera un aviso por cada destinatario configurado.
- CA-07.2: Cerrar la web no impide recibir el aviso.
- CA-07.3: Una instancia de acción o superación de tolerancia no genera avisos repetidos; acciones distintas no se agrupan.
- CA-07.4: Los mensajes de fotografía no contienen la imagen.
- CA-07.5: Varias lecturas consecutivas fuera del rango producen un único aviso por episodio; volver al rango y volver a salir produce un aviso nuevo.

**HU-24 Conservar actividad en la nube** (RF-24; incluye RNF-04; base en esta fase, cierre en fase 10)
- CA-24.1: Cada actividad guardada contiene fecha, hora, tipo, descripción y datos asociados cuando aplican.
- CA-24.2: Se conservan mediciones, movimientos, activaciones, eventos y alertas.
- CA-24.3: No se borran registros ni se guarda audio del bebé.
- CA-24.4: Una reasignación mantiene la asociación histórica original.
- CA-24.5: Recibir dos veces el mismo evento conserva un solo registro, mientras que dos eventos distintos con la misma hora se conservan por separado.
- CA-24.6: Cada actividad conserva fecha, hora, tipo, descripción, bebé, dispositivo y los datos propios del evento cuando corresponden. Las fotografías están vinculadas a eventos de habitación y no forman parte de la exportación.
- CA-24.7: Ningún flujo del producto elimina registros del historial. Retirar un dueño o reasignar un dispositivo conserva los registros.

## 5. Completar cuna y figuras · HU-08 a HU-13

- [ ] Conectar activación manual y por horario del PIR al registro y aviso con hora. Verificar AM2301 cada 10 s en °C y % HR. Validar mínimo < máximo y emitir un aviso por episodio fuera de rango hasta que regrese al rango.
- [ ] Recorrer web → comando → dispositivo → confirmación para lámpara regulable, selección/reproducción/parada de audio y figuras independientes. Implementar horarios y velocidad de los seis LED con intervalo mínimo de 2 s.
- [ ] Implementar voz en vivo desde el celular al altavoz. Registrar solo actividad permitida y cerrar la transmisión al terminar o desconectarse.
- **Salida:** demostrar cada control con el módulo conectado. Probar también un comando sin confirmación, un segundo episodio ambiental y pérdida de conexión durante la voz.

**HU-08 Monitorear movimiento de la cuna** (RF-08; manual o por horario; integra HU-24)
- CA-08.1: Una detección durante el monitoreo activo queda registrada con hora.
- CA-08.2: La detección activa produce una alerta por Telegram con su hora.
- CA-08.3: Desactivar el monitoreo evita eventos y avisos de ese monitoreo.

**HU-09 Consultar ambiente de la cuna** (RF-09; incluye RNF-02; integra HU-24)
- CA-09.1: Se muestran lecturas de temperatura y humedad del interior de la cuna.
- CA-09.2: Las mediciones quedan asociadas al dispositivo y al bebé.
- CA-09.3: Se muestran °C y % HR; las lecturas ambientales se toman cada 10 segundos y conservan su fecha y hora.

**HU-10 Configurar límites ambientales** (RF-10; integra HU-07, HU-09)
- CA-10.1: Se guardan límites inferiores y superiores para temperatura y humedad.
- CA-10.2: Una lectura fuera del rango configurado genera el aviso correspondiente.
- CA-10.3: Todos los dueños ven la misma configuración.
- CA-10.4: Si el límite inferior es mayor o igual al superior, no se guarda el cambio y se mantiene la configuración anterior.

**HU-11 Controlar luz y audios de la cuna** (RF-11; lámpara y audios pregrabados; integra HU-24)
- CA-11.1: La lámpara permite encendido, apagado y cambio de intensidad.
- CA-11.2: Se reproduce audio pregrabado sin depender de Spotify.
- CA-11.3: La reproducción queda como actividad sin registrar sonidos del bebé.
- CA-11.4: Se puede seleccionar, reproducir y detener un audio del catálogo pregrabado; la versión inicial no ofrece carga de archivos.

**HU-12 Transmitir voz en vivo** (RF-12; incluye RNF-05; celular → cuna; integra HU-24)
- CA-12.1: La voz se reproduce en el altavoz de la cuna durante la transmisión.
- CA-12.2: El canal es unidireccional; no devuelve audio del bebé.
- CA-12.3: Puede registrarse la actividad, pero no se almacena la voz transmitida.

**HU-13 Programar figuras LED** (RF-13; integra HU-31, HU-33)
- CA-13.1: La app permite encender y apagar manualmente y por horario.
- CA-13.2: Se puede ajustar el número de segundos entre cambios de luces.
- CA-13.3: El control es independiente de la lámpara y del colchón, sin dimmer ni motor exigido.
- CA-13.4: Configurar menos de 2 segundos entre cambios se rechaza; al configurar 2 segundos, los cambios respetan ese intervalo. Las luces son suaves y las transiciones no producen destellos abruptos. La intensidad física se concreta y verifica en arquitectura.

## 6. Integrar el colchón independiente · HU-14 a HU-16

- [ ] Conectar la lógica existente de HX711, calibración y buzzer con configuración web, persistencia, control y avisos. Al activar, validar duración positiva, tolerancia y referencia válida. Medir cada segundo y detener al vencer el período.
- **Salida:** con pesos de prueba, demostrar pérdida superior al 10 % durante tres lecturas consecutivas, alarma local y aviso. Repetir parada por botón, web y temporizador (60 s configurable). Verificar monitoreo detenido tras cada parada y rearme explícito con referencia nueva.

**HU-14 Activar monitoreo del colchón** (RF-14; duración configurable; integra HU-24, HU-33)
- CA-14.1: Activar guarda el peso numérico de referencia, incluidos bebé y objetos.
- CA-14.2: Se permite desactivar desde la aplicación.
- CA-14.3: El colchón funciona sin comprar la cuna inteligente.
- CA-14.4: No se toma una foto del peso ni se registran movimientos derivados de la balanza.
- CA-14.5: Una duración nula o negativa o una referencia de peso nula o inválida impiden activar el monitoreo; al vencer la duración válida, el monitoreo queda detenido.

**HU-15 Detectar pérdida de peso** (RF-15)
- CA-15.1: La tolerancia se configura como porcentaje del peso de referencia.
- CA-15.2: Superar la tolerancia activa sonido en el colchón y aviso en Telegram.
- CA-15.3: No hay alarma de monitoreo cuando está desactivado.
- CA-15.4: Con referencia de 1000 g y tolerancia del 10 %, tres lecturas consecutivas de 890 g disparan la alarma; tres de 900 g no la disparan; una lectura de 890 g seguida por 1000 g no completa el filtro.

**HU-16 Detener alarma y restablecer monitoreo** (RF-16)
- CA-16.1: La alarma activa puede detenerse con la app y el botón físico.
- CA-16.2: La app permite restablecer el monitoreo manualmente.
- CA-16.3: La duración predeterminada del sonido es de 60 segundos y el usuario puede modificarla desde la aplicación. El sonido se apaga al cumplirse la duración seleccionada; tanto este apagado como la detención desde la app o el botón físico dejan el monitoreo detenido. Una acción explícita de rearme captura una nueva referencia.

## 7. Implementar el kit de habitación · HU-17 y HU-18

- [ ] Integrar apertura de puerta y movimiento con ventanas de monitoreo y control manual. Durante monitoreo activo asociar evento, fotografía privada y aviso de captura por Telegram. La maqueta admite teléfono como cámara.
- **Salida:** disparar cada sensor dentro y fuera del horario. Verificar consulta de imagen por dueño, denegación a otra cuenta, aviso sin imagen y estado visible si falla la captura.

**HU-17 Monitorear puerta y movimiento de habitación** (RF-17; manual o por horario; integra HU-24)
- CA-17.1: Cada sensor admite activar, desactivar y programar un rango de tiempo.
- CA-17.2: Abrir la puerta o detectar movimiento activo genera un evento.
- CA-17.3: El evento genera aviso en Telegram y no alarma sonora local.
- CA-17.4: No se distingue dirección de entrada o salida.
- CA-17.5: Si puerta y movimiento producen dos acciones durante monitoreo activo, se conservan dos eventos y dos solicitudes de fotografía.

**HU-18 Guardar y consultar fotografías** (RF-18)
- CA-18.1: Un evento de puerta o movimiento durante monitoreo activo toma una fotografía.
- CA-18.2: La fotografía se guarda en nube y se consulta desde la app.
- CA-18.3: Se registra una foto por instancia de acción, sin agrupar acciones distintas.
- CA-18.4: La cámara no graba video y Telegram solo notifica que se tomó una foto.

## 8. Implementar el juego · HU-19

- [ ] Conectar cinco botones y sus luces. Elegir objetivo aleatorio, leer una pulsación por acción física, premiar el acierto con sonido y seleccionar el siguiente objetivo tras cada pulsación hasta apagar.
- **Salida:** demostrar acierto, error, cambio de objetivo y apagado. Registrar tamaño y fijación de botones y alimentación utilizada en la maqueta.

**HU-19 Utilizar el juego de cinco botones** (RF-19; integra HU-33)
- CA-19.1: Se ilumina un objetivo elegido aleatoriamente entre cinco botones.
- CA-19.2: Pulsar el objetivo reproduce una recompensa; pulsar otro no la reproduce.
- CA-19.3: Después de presionar un botón se ilumina otro objetivo aleatorio.
- CA-19.4: El juego continúa hasta apagarlo.
- CA-19.5: En el producto comercial, los cinco botones son grandes y no pueden ser tragados por el bebé; sus dimensiones y componentes se documentan en el diseño.

## 9. Implementar alimentación · HU-20 a HU-23

- [ ] Integrar balanza y sensor de temperatura del biberón. Guardar gramos iniciales y finales del mismo recipiente. Modelar inicio, pausa, reanudación y cierre manual. Excluir pausas de la duración y calcular consumo por diferencia.
- [ ] Solicitar corrección si falta peso o el final supera el inicial. Conservar original, nuevo valor, autor, fecha y motivo. Devolver el biberón permite pesar y mantiene la toma abierta.
- [ ] Agregar lista diaria editable de horas y avisos por temperatura fuera de límites. Reutilizar planificador, episodios y destinatarios de fase 4.
- **Salida:** completar una toma con pausa y corrección auditada, verificar ambos extremos de temperatura y comprobar una entrega por hora programada y destinatario.

**HU-20 Iniciar y pesar una toma** (RF-20; integra HU-24, HU-33)
- CA-20.1: El adulto coloca alimento o biberón sobre el dispositivo y registra el peso inicial en gramos.
- CA-20.2: El botón de inicio registra la hora y comienza el temporizador.
- CA-20.3: La toma queda asociada al bebé y dispositivo correspondientes.
- CA-20.4: Sin peso inicial válido no se inicia la toma; se informa que debe colocarse el mismo recipiente que se usará para el pesaje final.

**HU-21 Pausar, finalizar y corregir tomas** (RF-21; DAT-02)
- CA-21.1: La app permite pausar, reanudar y finalizar manualmente la toma. Reanudar continúa la misma toma y los intervalos de pausa no se suman a su duración activa.
- CA-21.2: Al finalizar se pesa de nuevo el alimento o biberón en el dispositivo, en gramos.
- CA-21.3: Se permite corregir la toma y consultar su duración final.
- CA-21.4: La cantidad ingerida, en gramos, se calcula como peso inicial menos peso final, usando el mismo recipiente en ambas mediciones. Ejemplos: una toma de 08:00 a 08:15, pausada de 08:05 a 08:07, conserva 13 minutos activos; con 200 g iniciales y 150 g finales registra 50 g ingeridos. Una corrección conserva valor anterior, autor, fecha y motivo.
- CA-21.5: Devolver el biberón permite obtener su peso, pero la toma continúa hasta el cierre manual. El cierre automático queda fuera del alcance actual; requiere una solicitud de cambio.
- CA-21.6: Un peso final mayor al inicial o una lectura faltante impiden cerrar como completa; el usuario puede corregir y volver a intentar, sin registrar un consumo negativo.
- CA-21.7: La toma conserva pesos inicial y final, gramos ingeridos, inicio, fin, pausas y duración. Toda corrección mantiene el valor anterior, autor, fecha y motivo.

**HU-22 Programar recordatorios diarios** (RF-22; integra HU-03)
- CA-22.1: La app permite configurar y modificar las horas de alimentación.
- CA-22.2: Los recordatorios se repiten diariamente y llegan por Telegram.
- CA-22.3: Programar 08:00 y 11:00 genera un recordatorio en cada hora todos los días, en America/Costa_Rica; no crea recordatorios en las horas intermedias.
- CA-22.4: Los horarios de recordatorios, gráficos y exportación usan la zona horaria America/Costa_Rica de forma consistente. La representación de almacenamiento se define en arquitectura.

**HU-23 Medir temperatura del biberón** (RF-23; integra HU-24, HU-33)
- CA-23.1: El dispositivo mide la temperatura del biberón.
- CA-23.2: La app permite configurar los límites de frío y calor.
- CA-23.3: Una lectura fuera de los límites genera aviso por Telegram.
- CA-23.4: El dispositivo no calienta, enfría ni suministra alimento automáticamente.

## 10. Historial, resumen nocturno, gráficos y Excel · HU-24 a HU-27

- [ ] Unificar actividad por bebé, dispositivo, tipo y período. Permitir elegir inicio y fin de la noche incluso al cruzar medianoche. Mostrar fotos autorizadas desde los eventos de habitación.
- [ ] Mostrar eventos por hora en intervalos [inicio, fin) y mediciones como líneas con fecha, hora y unidad. Diferenciar cero eventos de un intervalo sin lecturas.
- [ ] Exportar .xlsx para el bebé y período elegidos, una fila por registro con columnas de DEC-06 y campos adicionales de tomas. Excluir fotos y enlaces.
- **Salida:** usar datos conocidos con cambio de día, hueco y reasignación. Conciliar registros, gráficos y filas de Excel. Revisar DAT-01 a DAT-04.

HU-24: ver CA-24.1 a CA-24.7 en la fase 4 (se cierra aquí con datos reales).

**HU-25 Consultar historial y resumen de noche** (RF-25)
- CA-25.1: La app consulta datos recientes ya guardados en la nube.
- CA-25.2: Los historiales de bebés diferentes permanecen separados.
- CA-25.3: El resumen nocturno se consulta en la app sin envío automático a Telegram.
- CA-25.4: Seleccionar inicio y fin de la noche muestra el resumen del intervalo elegido; un intervalo sin registros se informa como tal, sin inventar actividad.

**HU-26 Mostrar gráficos de sensores y eventos** (RF-26)
- CA-26.1: Todos los sensores tienen representación de sus mediciones o eventos.
- CA-26.2: Se puede consultar cuántos movimientos ocurrieron y cuándo hubo más actividad.
- CA-26.3: Los eventos se representan mediante histogramas de conteos por hora y las mediciones mediante líneas con fecha, hora y unidad. Dos eventos a las 08:15 y 08:59 cuentan en [08:00,09:00), y uno a las 09:00 cuenta en [09:00,10:00).
- CA-26.4: La gráfica distingue intervalos sin datos de intervalos con mediciones disponibles y cero eventos.

**HU-27 Exportar datos para Excel** (RF-27)
- CA-27.1: El archivo contiene al menos fecha, hora y evento.
- CA-27.2: Contiene solo datos, sin formato decorativo, fotografías ni enlaces a fotografías.
- CA-27.3: Se genera un archivo .xlsx con una fila por registro del bebé y período elegidos y encabezados simples: `fecha`, `hora`, `evento`, `bebe_id`, `dispositivo_id`, `descripcion`, `valor` y `unidad`. Para las tomas se incluyen además `peso_inicial_g`, `peso_final_g`, `cantidad_g` y `duracion_s`. Los campos no aplicables se dejan vacíos.
- CA-27.4: Los registros exportados corresponden a la información almacenada.
- CA-27.5: El archivo de un período sin registros contiene encabezados y ninguna fila de datos; los valores de las filas coinciden con el historial.

## 11. Recuperación, rendimiento, privacidad y uso web · HU-28, HU-30, HU-34 y HU-35

- [ ] Cortar Wi-Fi y energía durante monitoreo y programación. Verificar configuración e historial conservados, huecos visibles, rearme manual del colchón y omisión de recordatorios vencidos. Probar el siguiente horario futuro.
- [ ] Medir con 2 cuentas concurrentes, 2 bebés, un ejemplar por módulo y 1000 eventos. Registrar 100 consultas y 100 solicitudes de aviso. Al menos 95 de cada serie deben cumplir historial ≤3 s y solicitud a Telegram ≤5 s desde recepción del evento en backend. Medir aparte periodicidad ambiental y de peso.
- [ ] Verificar permisos desde web y API sobre datos, fotos y controles, revocación y ausencia de audio guardado. Recorrer cuentas, configuración, controles, historial y exportación a 360 y 1280 px. Registrar navegador, versión y dispositivo.
- **Salida:** tabla de resultados medidos y defectos reproducibles. Corregir fallos y repetir los casos afectados.

**HU-28 Gestionar interrupción y recuperación** (RF-28; incluye RNF-06)
- CA-28.1: La solución no exige UPS ni continuidad sin conexión.
- CA-28.2: La interrupción detiene el funcionamiento conforme a la aclaración registrada.
- CA-28.3: Tras recuperarse la conexión se conservan registros y configuración, se muestra el colchón detenido y se exige rearme con nueva referencia; los recordatorios vencidos se omiten y los futuros conservan su programación.
- CA-28.4: Después de una interrupción, la aplicación distingue el monitoreo detenido del activo y no presenta lecturas inexistentes como nuevas. Se comprueba el corte, recuperación y rearme definidos en CA-28.3.

**HU-30 Verificar rendimiento y periodicidad** (RNF-01 y RNF-02; tiempos y carga de la maqueta; la entrega externa de Telegram se mide aparte)
- CA-30.1: La prueba usa 2 cuentas concurrentes, 2 bebés, un ejemplar de cada módulo y 1000 eventos.
- CA-30.2: Al menos 95 de 100 consultas de historial cumplen 3 segundos y 95 de 100 solicitudes de envío a Telegram cumplen 5 segundos desde recepción backend; entrega externa se mide aparte.
- CA-30.3: Se comprueban lecturas ambientales cada 10 s y peso cada 1 s; los resultados incluyen tiempos y condiciones.
- CA-30.4: Las lecturas ambientales se toman cada 10 segundos, las lecturas de peso cada segundo y los eventos se registran cuando ocurren. Las marcas de tiempo de la maqueta permiten comprobarlo; cualquier cambio impuesto por el sensor se tramita como cambio del alcance.

**HU-34 Verificar acceso y privacidad integral** (RNF-03, RNF-04 y RNF-05)
- CA-34.1: Web y solicitudes directas deniegan datos, fotos y controles de dispositivos ajenos.
- CA-34.2: Revocar un dueño elimina acceso; ser destinatario de Telegram no otorga control.
- CA-34.3: Reasignar o revocar conserva registros, y una transmisión no almacena audio.
- CA-34.4: Al reasignar un dispositivo a otro bebé, los registros anteriores conservan su asociación original y las actividades nuevas se vinculan al nuevo bebé; no se elimina ningún registro.
- CA-34.5: No se almacena la voz transmitida ni se graban sonidos del bebé. Tras una transmisión se conserva únicamente la actividad permitida, según HU-12.

**HU-35 Verificar uso desde celular y computadora** (RNF-07)
- CA-35.1: Los recorridos de cuentas, configuración, controles, historial y exportación funcionan a 360 y 1280 píxeles sin solapamientos.
- CA-35.2: Nombres, unidades y estados se muestran claramente.
- CA-35.3: Se registra navegador, versión y dispositivo de prueba; la matriz de compatibilidad se acuerda en arquitectura.

## 12. Demostración modular y cierre · HU-29 y aceptación integral

- [ ] Preparar guion y datos de prueba para cuna, figuras, colchón independiente, habitación, juego y alimentación. Indicar cuándo cambiar de protoboard, qué acción realiza el adulto, qué respuesta física observar y qué registro debe aparecer.
- [ ] Ejecutar el guion con hardware y cuentas de demostración. Reunir evidencias por CA, arquitectura final, materiales, calibraciones, instrucciones de arranque y limitaciones. Registrar aceptación del equipo/cliente cuando ocurra.
- **Salida:** cada CA cuenta con resultado, evidencia y versión probada o con una excepción identificada. Una fase bloqueada por hardware queda abierta aunque pase su simulación.

**HU-29 Validar maqueta modular** (RF-29; integra HU-12, HU-28, HU-33, HU-34, HU-35, HU-30)
- CA-29.1: La demostración contempla cuna, figuras LED, colchón, habitación, juego y alimentación con pesaje.
- CA-29.2: El colchón demuestra uso independiente y alimentación propia o desde la cuna.
- CA-29.3: El juego comercial contempla baterías; la maqueta puede usar electricidad.
- CA-29.4: Se documentan dimensiones, materiales y componentes; una sustitución de sensor se coordina con el profesor.

---

**Dependencias:** la fase 1 fija contratos y la 2 habilita banco físico. La fase 3 habilita propiedad y la 4 habilita avisos. Con esas bases, las fases 5 a 9 se pueden distribuir por módulo. La fase 10 puede comenzar con eventos de prueba y debe reconciliar datos reales al cerrar. Ejecutar 11 y 12 sobre el mismo incremento integrado.

## Índice de aceptación

| Historia | Criterios | Fase principal |
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
| HU-24 | CA-24.1 a CA-24.7 | 4 (base) y 10 (cierre) |
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
