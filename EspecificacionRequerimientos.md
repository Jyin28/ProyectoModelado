# Especificación de requisitos del sistema

Versión: 0.4, 10 de octubre de 2026. Estado: DEC-01 a DEC-13 aprobadas según confirmación del equipo; aprobación integral de esta versión por registrar. Organización basada en el formato IEEE 830-1998 proporcionado por el curso. La aprobación de decisiones se distingue de la conformidad documental y de las pruebas de producto.

## 1. Introducción

### 1.1 Propósito

Definir una base verificable para que el cliente, el equipo de desarrollo y el profesor revisen el sistema inteligente de cuido y entretenimiento para bebés antes de establecer el backlog en Jira.

### 1.2 Ámbito del sistema

El sistema controla una cuna inteligente y cinco accesorios: figuras LED, colchón, kit de habitación, juego y alimentación. Una web gratuita permite operar los módulos adquiridos, consultar historial en nube y recibir avisos mediante Telegram. El producto se plantea para uso familiar y eventual venta modular; la entrega del curso es una maqueta funcional. No incluye cámara en cuna, detección de llanto, grabación de video, escucha del bebé, alimentación automática ni llamadas al 911.

### 1.3 Definiciones y abreviaturas

| Término | Significado |
| --- | --- |
| RF | Requisito funcional codificado. |
| RNF | Requisito no funcional codificado. |
| HU | Historia de usuario del borrador de backlog. |
| DEC | Decisión de alcance o comportamiento; DEC-01 a DEC-13 aprobadas según confirmación del equipo. |
| Dueño | Cuenta autorizada a compartir la configuración de un dispositivo. |
| Destinatario | Persona configurada para recibir avisos en Telegram; no implica ser dueño. |
| Toma | Sesión de alimentación con medición inicial, final y duración. |
| Rearme | Restablecimiento del monitoreo después de una alarma; distinto de silenciarla. |
| Evento | Instancia de actividad con fecha, hora, tipo y datos asociados. |

### 1.4 Referencias

- `RequerimientosFinal.md`: alcance consolidado y registro DEC-01 a DEC-13.
- `RequerimientosAudio.md` y `Material/Requerimientos chat.txt`: antecedentes de levantamiento.
- Respuestas de Alejandro compartidas por el equipo el 9 de octubre de 2026, incorporadas en la sección 8.2 del consolidado.
- `Material del profe/Instrucciones proyecto.pdf`: entregables, aprobación y calendario.
- `Material del profe/Formato IEEE.pdf`: estructura del documento.
- `Material del profe/UserStory.pdf`: ejemplo de historias con criterios de aceptación.
- `Material/RespuestasAlejandro-2026-10-09.md`: respuestas R-01 a R-09 conservadas para trazabilidad.
- `BacklogPreparado.md`: historias relacionadas uno a uno con los RF y criterios de verificación.

### 1.5 Visión general

La sección 2 describe el contexto; la sección 3 define interfaces, funciones y atributos; la sección 4 documenta decisiones, trazabilidad y aprobación. Los requisitos conservan referencias al consolidado para identificar su origen.

## 2. Descripción general

### 2.1 Perspectiva del producto

La web intercambia datos y órdenes con los dispositivos por medio del backend y consulta almacenamiento en nube. Telegram es el servicio externo de notificaciones. El colchón debe poder usarse sin comprar la cuna. Los detalles de protocolos y componentes se especificarán en arquitectura, sin imponerlos como respuestas del cliente.

### 2.2 Funciones del producto

Gestionar cuentas, bebés y dueños; controlar sensores y actuadores; programar monitoreo; alertar; capturar fotografías; registrar alimentación; entretener; conservar historial; mostrar gráficos y exportar registros.

### 2.3 Características de los usuarios

Padres, madres y otros cuidadores operan la web y Telegram. No se exige formación técnica. Los dueños comparten configuración por dispositivo; los destinatarios de avisos se gestionan aparte. El equipo y el cliente revisan los resultados de la maqueta.

### 2.4 Restricciones

Cuna por tomacorriente, sin baterías; juego comercial a baterías y maqueta con electricidad permitida. Sin UPS ni continuidad sin internet según aclaración previa. Cámara de habitación solo para fotos; puede ser un teléfono en la maqueta. No se eliminan registros. Se desarrollan todos los módulos y se permite reutilizar componentes entre incrementos. Las sustituciones de sensores se coordinan con el profesor.

### 2.5 Suposiciones y dependencias

Operación dependiente de electricidad, internet, nube y Telegram. Supabase es elección técnica del equipo, no imposición del cliente. La alimentación incorpora balanza a partir de la última respuesta. Frecuencia, reinicio y capacidad de prueba se rigen por DEC-01 a DEC-13 aprobadas. Precisión y rangos se concretan y verifican en arquitectura.

### 2.6 Requisitos futuros

No hay ampliaciones futuras comprometidas. El cierre automático al devolver el biberón está fuera del alcance según DEC-02 aprobada. La carga de nuevos audios no se incorpora sin decisión de alcance. No se posponen módulos confirmados fuera del proyecto.

## 3. Requisitos específicos

### 3.1 Interfaces externas

| ID | Interfaz | Requisito y verificación |
| --- | --- | --- |
| INT-01 | Web | Debe permitir controlar y consultar los módulos asociados mediante una interfaz común; verificar acceso a cada módulo y sección Bebés y dispositivos. |
| INT-02 | Hardware | Debe recibir movimiento, temperatura, humedad, peso, apertura y botones, y controlar luces, audios, alarma y fotografía según cada RF. El pesaje de alimentación forma parte de la interfaz. Validar mediante demostración por módulo. |
| INT-03 | Nube | Debe guardar y consultar registros y fotos; validar persistencia y asociación a bebé y dispositivo. |
| INT-04 | Telegram | Debe enviar los avisos a destinatarios configurados aun con web cerrada; verificar RF-06 y RF-07. No adjuntar fotografías. |
| INT-05 | Excel | Debe entregar datos de registros con fecha, hora y evento; verificar RF-27. Extensión .xlsx aprobada en DEC-06. |
| INT-06 | Voz | Debe transmitir voz del celular a la cuna en vivo y en un solo sentido, sin almacenar audio; verificar RF-12. |

### 3.2 Funciones

Se organizan por objetivos del cuidador. Cada RF incluye sus criterios de aceptación y enlaza con una HU. Se emplean enunciados EARS de evento, estado y condición cuando corresponda. «Base recopilada» significa que el comportamiento está en el consolidado; no significa que el documento completo haya sido aprobado. DEC-01 a DEC-13 se incorporan según la confirmación registrada en §4.1; el diseño y su verificación se realizan en las historias de arquitectura.

#### RF-01. Registrar e iniciar sesión

Cuando un cuidador envíe correo y contraseña válidos para registro, el sistema deberá crear su cuenta. Cuando ingrese credenciales de una cuenta existente, el sistema deberá iniciar la sesión si son correctas y denegarla si son incorrectas.

Origen: RequerimientosFinal, sección 5; antecedentes: A26. Historia: HU-01. Estado: base recopilada; Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-01.1:** Una cuenta registrada puede iniciar sesión con sus credenciales.
- **CA-01.2:** Las credenciales incorrectas impiden el acceso.
- **CA-01.3:** El cierre de sesión termina el acceso autenticado.
- **CA-01.4:** DEC-09 aprobada: un correo ya registrado o campos obligatorios vacíos no crean una segunda cuenta.

#### RF-02. Gestionar bebés

El sistema deberá mantener un registro separado por bebé y permitir que una misma cuenta gestione varios bebés.

Origen: RequerimientosFinal, sección 5; antecedentes: A28. Historia: HU-02. Estado: base recopilada; Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-02.1:** Dos bebés de una cuenta mantienen registros separados.
- **CA-02.2:** Es posible asociar accesorios a un bebé sin comprar la cuna.
- **CA-02.3:** DEC-09 aprobada: al crear un perfil, se exige nombre del bebé y se permite dejar vacía la fecha de nacimiento.

#### RF-03. Asociar dispositivos

Cuando un dueño asocie un dispositivo a un bebé, el sistema deberá mostrarlo entre sus módulos, permitir varios dispositivos por cuenta y limitar a una cuna por bebé. Los accesorios deberán poder asociarse sin exigir una cuna.

Origen: RequerimientosFinal, sección 5; antecedentes: A02, A26, A28. Historia: HU-03. Estado: base recopilada; Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-03.1:** Una cuenta puede asociar varios dispositivos.
- **CA-03.2:** Se respeta una cuna por bebé y se admiten accesorios independientes.
- **CA-03.3:** La interfaz presenta los módulos asociados.
- **CA-03.4:** DEC-09 aprobada: asociar una segunda cuna a un bebé se rechaza sin eliminar la asociación existente.

#### RF-04. Administrar dueños compartidos

Mientras un dispositivo tenga varios dueños, el sistema deberá ofrecerles una única configuración compartida y permitir administrar sus accesos desde Bebés y dispositivos.

Origen: RequerimientosFinal, sección 5; antecedentes: A27 y aclaración escrita sobre dueños compartidos. Historia: HU-04. Estado: base recopilada; Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-04.1:** Dos dueños consultan la misma configuración del dispositivo.
- **CA-04.2:** La sección Bebés y dispositivos ofrece Administrar dueños.
- **CA-04.3:** DEC-09 aprobada: una invitación por correo solo concede acceso tras aceptarla; retirar a un dueño revoca su acceso y conserva el historial; se impide retirar al último dueño.

#### RF-05. Reasignar una cuna

Cuando una cuna se reasigne a otro bebé, el sistema deberá asociar las actividades nuevas al nuevo bebé y conservar sin cambios la asociación de las actividades anteriores.

Origen: RequerimientosFinal, sección 5; antecedentes: A28, A29. Historia: HU-05. Estado: base recopilada; Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-05.1:** La reasignación vincula las actividades nuevas con el nuevo bebé.
- **CA-05.2:** Los registros previos conservan su bebé original.
- **CA-05.3:** La reasignación no borra registros.

#### RF-06. Configurar destinatarios de Telegram

Cuando un dueño configure destinatarios de Telegram para un dispositivo, el sistema deberá conservar la lista de destinatarios de ese dispositivo y permitir más de uno.

Origen: RequerimientosFinal, sección 3, 5; antecedentes: A08 y aclaración sobre destinatarios. Historia: HU-06. Estado: base recopilada; Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-06.1:** La sección Destinatarios de Telegram permite configurar más de un destinatario.
- **CA-06.2:** La lista pertenece al dispositivo y es compartida por sus dueños.
- **CA-06.3:** DEC-09 aprobada: un código de un solo uso vincula al destinatario; retirarlo evita futuros avisos y no modifica los dueños del dispositivo.

#### RF-07. Recibir avisos por evento

Cuando ocurra una acción o una superación de tolerancia con avisos habilitados, el sistema deberá enviar un aviso por instancia a cada destinatario configurado, aunque la web esté cerrada. Las acciones distintas no deberán agruparse.

Origen: RequerimientosFinal, sección 3; antecedentes: A08, A34 y aclaración de una notificación por instancia. Historia: HU-07. Estado: base recopilada; Decisiones aplicadas: DEC-11, DEC-13.

Criterios de aceptación:

- **CA-07.1:** Un evento habilitado genera un aviso por cada destinatario configurado.
- **CA-07.2:** Cerrar la web no impide recibir el aviso.
- **CA-07.3:** Una instancia de acción o superación de tolerancia no genera avisos repetidos; acciones distintas no se agrupan.
- **CA-07.4:** Los mensajes de fotografía no contienen la imagen.
- **CA-07.5:** DEC-13 aprobada: varias lecturas consecutivas fuera del rango producen un único aviso por episodio; volver al rango y volver a salir produce un aviso nuevo.

#### RF-08. Monitorear movimiento de la cuna

Mientras el monitoreo de movimiento de la cuna esté activo, cuando el sensor detecte movimiento, el sistema deberá registrar el evento y enviar una alerta con su hora. El monitoreo deberá activarse y desactivarse manualmente o por horario.

Origen: RequerimientosFinal, sección 2.1; antecedentes: A06, A07, A08. Historia: HU-08. Estado: base recopilada; Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-08.1:** Una detección durante el monitoreo activo queda registrada con hora.
- **CA-08.2:** La detección activa produce una alerta por Telegram con su hora.
- **CA-08.3:** Desactivar el monitoreo evita eventos y avisos de ese monitoreo.

#### RF-09. Consultar ambiente de la cuna

El sistema deberá medir la temperatura y humedad dentro de la cuna y conservar sus lecturas asociadas al bebé y dispositivo.

Origen: RequerimientosFinal, sección 2.1; antecedentes: A09, A10. Historia: HU-09. Estado: base recopilada; Decisiones aplicadas: DEC-07.

Criterios de aceptación:

- **CA-09.1:** Se muestran lecturas de temperatura y humedad del interior de la cuna.
- **CA-09.2:** Las mediciones quedan asociadas al dispositivo y al bebé.
- **CA-09.3:** DEC-07 aprobada: se muestran °C y % HR; las lecturas ambientales se toman cada 10 segundos y conservan su fecha y hora.

#### RF-10. Configurar límites ambientales

Cuando un dueño configure límites inferiores y superiores ambientales, el sistema deberá conservarlos para todos los dueños. Mientras una lectura quede fuera del rango configurado, el sistema deberá generar el aviso correspondiente según la regla de episodios.

Origen: RequerimientosFinal, sección 2.1, 3; antecedentes: A10. Historia: HU-10. Estado: base recopilada; Decisiones aplicadas: DEC-13.

Criterios de aceptación:

- **CA-10.1:** Se guardan límites inferiores y superiores para temperatura y humedad.
- **CA-10.2:** Una lectura fuera del rango configurado genera el aviso correspondiente.
- **CA-10.3:** Todos los dueños ven la misma configuración.
- **CA-10.4:** DEC-13 aprobada: si el límite inferior es mayor o igual al superior, no se guarda el cambio y se mantiene la configuración anterior.

#### RF-11. Controlar luz y audios de la cuna

Cuando el cuidador accione los controles de la lámpara de la cuna, el sistema deberá encenderla, apagarla o variar su intensidad. Cuando seleccione reproducción de un sonido pregrabado, deberá reproducirlo y registrar la actividad sin grabar al bebé.

Origen: RequerimientosFinal, sección 2.1; antecedentes: A11, A12, A31. Historia: HU-11. Estado: base recopilada; Decisiones aplicadas: DEC-08.

Criterios de aceptación:

- **CA-11.1:** La lámpara permite encendido, apagado y cambio de intensidad.
- **CA-11.2:** Se reproduce audio pregrabado sin depender de Spotify.
- **CA-11.3:** La reproducción queda como actividad sin registrar sonidos del bebé.
- **CA-11.4:** DEC-08 aprobada: se puede seleccionar, reproducir y detener un audio del catálogo pregrabado; la versión inicial no ofrece carga de archivos.

#### RF-12. Transmitir voz en vivo

Mientras el adulto transmita voz desde el celular, el sistema deberá reproducirla en vivo en el altavoz de la cuna, en un único sentido y sin guardar una grabación.

Origen: RequerimientosFinal, sección 2.1; antecedentes: A13, A69. Historia: HU-12. Estado: base recopilada; Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-12.1:** La voz se reproduce en el altavoz de la cuna durante la transmisión.
- **CA-12.2:** El canal es unidireccional; no devuelve audio del bebé.
- **CA-12.3:** Puede registrarse la actividad, pero no se almacena la voz transmitida.

#### RF-13. Programar figuras LED

Cuando un dueño active las figuras LED manualmente o por horario, el sistema deberá encenderlas y cambiar las luces con el intervalo de segundos configurado. Deberá permitir apagarlas y mantenerlas independientes de la lámpara y el colchón.

Origen: RequerimientosFinal, sección 2.2; antecedentes: A41, A42, A43, A44, A45. Historia: HU-13. Estado: base recopilada; Decisiones aplicadas: DEC-08.

Criterios de aceptación:

- **CA-13.1:** La app permite encender y apagar manualmente y por horario.
- **CA-13.2:** Se puede ajustar el número de segundos entre cambios de luces.
- **CA-13.3:** El control es independiente de la lámpara y del colchón, sin dimmer ni motor exigido.
- **CA-13.4:** DEC-08 aprobada: configurar menos de 2 segundos entre cambios se rechaza; al configurar 2 segundos, los cambios respetan ese intervalo. La intensidad física aún requiere validación de diseño.

#### RF-14. Activar monitoreo del colchón

Cuando el cuidador active el monitoreo del colchón por un tiempo configurable, el sistema deberá guardar el peso numérico de referencia del bebé y los objetos. Deberá permitir desactivar el monitoreo y funcionar sin adquirir la cuna.

Origen: RequerimientosFinal, sección 2.3; antecedentes: A14, A15, A16, A20 y aclaración sobre peso numérico. Historia: HU-14. Estado: base recopilada; Decisiones aplicadas: DEC-07, DEC-13.

Criterios de aceptación:

- **CA-14.1:** Activar guarda el peso numérico de referencia, incluidos bebé y objetos.
- **CA-14.2:** Se permite desactivar desde la aplicación.
- **CA-14.3:** El colchón funciona sin comprar la cuna inteligente.
- **CA-14.4:** No se toma una foto del peso ni se registran movimientos derivados de la balanza.
- **CA-14.5:** DEC-13 aprobada: una duración nula o negativa o una referencia de peso nula o inválida impiden activar el monitoreo; al vencer la duración válida, el monitoreo queda detenido.

#### RF-15. Detectar pérdida de peso

Mientras el monitoreo del colchón esté activo, cuando la pérdida respecto al peso de referencia supere la tolerancia porcentual configurada y cumpla el filtro acordado, el sistema deberá activar la alarma sonora del colchón, registrar el evento y enviar el aviso por Telegram.

Origen: RequerimientosFinal, sección 2.3, 3; antecedentes: A17, A18, A19 y aclaración sobre porcentaje. Historia: HU-15. Estado: base recopilada; Decisiones aplicadas: DEC-03, DEC-07.

Criterios de aceptación:

- **CA-15.1:** La tolerancia se configura como porcentaje del peso de referencia.
- **CA-15.2:** Superar la tolerancia activa sonido en el colchón y aviso en Telegram.
- **CA-15.3:** No hay alarma de monitoreo cuando está desactivado.
- **CA-15.4:** DEC-07 aprobada: con referencia de 1000 g y tolerancia del 10%, tres lecturas consecutivas de 890 g disparan la alarma; tres de 900 g no la disparan; una lectura de 890 g seguida por 1000 g no completa el filtro.

#### RF-16. Detener alarma y restablecer monitoreo

Cuando el cuidador detenga una alarma desde la app o el botón físico, el sistema deberá apagar su sonido. La app deberá permitir restablecer manualmente el monitoreo. El apagado por tiempo y el estado posterior se regirán por DEC-03 aprobada.

Origen: RequerimientosFinal, sección 2.3; antecedentes: A18 y aclaración previa de botón físico; respuesta R-06. Historia: HU-16. Estado: base recopilada; Decisiones aplicadas: DEC-03.

Criterios de aceptación:

- **CA-16.1:** La alarma activa puede detenerse con la app y el botón físico.
- **CA-16.2:** La app permite restablecer el monitoreo manualmente.
- **CA-16.3:** DEC-03 aprobada: a los 60 segundos configurados se apaga el sonido; tanto este apagado como app o botón dejan el monitoreo detenido. Una acción explícita de rearme captura una nueva referencia.

#### RF-17. Monitorear puerta y movimiento de habitación

Mientras el monitoreo de puerta o movimiento de habitación esté activo, cuando se produzca la acción correspondiente, el sistema deberá registrar el evento y enviar el aviso por Telegram sin alarma sonora local. Cada sensor deberá admitir activación manual y por horario.

Origen: RequerimientosFinal, sección 2.4; antecedentes: A46, A47, A48, A49, A58 y aclaración sobre dirección. Historia: HU-17. Estado: base recopilada; Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-17.1:** Cada sensor admite activar, desactivar y programar un rango de tiempo.
- **CA-17.2:** Abrir la puerta o detectar movimiento activo genera un evento.
- **CA-17.3:** El evento genera aviso en Telegram y no alarma sonora local.
- **CA-17.4:** No se distingue dirección de entrada o salida.
- **CA-17.5:** Si puerta y movimiento producen dos acciones durante monitoreo activo, se conservan dos eventos y dos solicitudes de fotografía.

#### RF-18. Guardar y consultar fotografías

Cuando se produzca un evento de puerta o movimiento durante su monitoreo activo, el sistema deberá tomar una fotografía por instancia, almacenarla en la nube y permitir consultarla en la web. Telegram deberá notificar el evento sin adjuntar la foto.

Origen: RequerimientosFinal, sección 2.4; antecedentes: A58, A59 y aclaración de foto por acción. Historia: HU-18. Estado: base recopilada; Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-18.1:** Un evento de puerta o movimiento durante monitoreo activo toma una fotografía.
- **CA-18.2:** La fotografía se guarda en nube y se consulta desde la app.
- **CA-18.3:** Se registra una foto por instancia de acción, sin agrupar acciones distintas.
- **CA-18.4:** La cámara no graba video y Telegram solo notifica que se tomó una foto.

#### RF-19. Utilizar el juego de cinco botones

Mientras el juego esté encendido, el sistema deberá seleccionar aleatoriamente un objetivo entre cinco botones e iluminarlo. Cuando se pulse el objetivo, deberá reproducir la recompensa; cuando se pulse otro, no deberá reproducirla. Después de pulsar un botón, deberá seleccionar otro objetivo y continuar hasta el apagado.

Origen: RequerimientosFinal, sección 2.5; antecedentes: A50, A51, A52, A53 y aclaración posterior de cinco botones. Historia: HU-19. Estado: base recopilada; Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-19.1:** Se ilumina un objetivo elegido aleatoriamente entre cinco botones.
- **CA-19.2:** Pulsar el objetivo reproduce una recompensa; pulsar otro no la reproduce.
- **CA-19.3:** Después de presionar un botón se ilumina otro objetivo aleatorio.
- **CA-19.4:** El juego continúa hasta apagarlo.

#### RF-20. Iniciar y pesar una toma

Cuando el adulto coloque el alimento o biberón en el dispositivo e inicie una toma desde la app, el sistema deberá registrar el peso inicial en gramos y la hora de inicio, y activar el temporizador.

Origen: RequerimientosFinal, sección 2.6; antecedentes: A54; respuestas R-01, R-02, R-04, que actualizan A55. Historia: HU-20. Estado: base recopilada; Decisiones aplicadas: DEC-01.

Criterios de aceptación:

- **CA-20.1:** El adulto coloca alimento o biberón sobre el dispositivo y registra el peso inicial en gramos.
- **CA-20.2:** El botón de inicio registra la hora y comienza el temporizador.
- **CA-20.3:** La toma queda asociada al bebé y dispositivo correspondientes.
- **CA-20.4:** DEC-01 aprobada: sin peso inicial válido no se inicia la toma; se informa que debe colocarse el mismo recipiente que se usará para el pesaje final.

#### RF-21. Pausar, finalizar y corregir tomas

Durante una toma, el sistema deberá permitir pausarla, finalizarla y corregirla manualmente desde la app. Al finalizar, deberá registrar el segundo pesaje en gramos y conservar la duración final. Las reglas aprobadas de cantidad, pausas y correcciones se especifican en DEC-01.

Origen: RequerimientosFinal, sección 2.6; antecedentes: A54; respuestas R-01, R-02, R-04. Historia: HU-21. Estado: base recopilada; Decisiones aplicadas: DEC-01, DEC-02.

Criterios de aceptación:

- **CA-21.1:** La app permite pausar y finalizar manualmente la toma.
- **CA-21.2:** Al finalizar se pesa de nuevo el alimento o biberón en el dispositivo, en gramos.
- **CA-21.3:** Se permite corregir la toma y consultar su duración final.
- **CA-21.4:** DEC-01 aprobada: una toma de 08:00 a 08:15, pausada de 08:05 a 08:07, conserva 13 minutos activos. Con 200 g iniciales y 150 g finales registra 50 g ingeridos. Una corrección conserva valor anterior, autor, fecha y motivo.
- **CA-21.5:** DEC-02 aprobada: devolver el biberón permite obtener su peso, pero la toma continúa hasta el cierre manual. El cierre automático queda fuera del alcance actual; requiere una solicitud de cambio.
- **CA-21.6:** DEC-01 aprobada: un peso final mayor al inicial o una lectura faltante impiden cerrar como completa; el usuario puede corregir y volver a intentar, sin registrar un consumo negativo.

#### RF-22. Programar recordatorios diarios

Cuando el cuidador programe horas de alimentación, el sistema deberá repetir diariamente los recordatorios por Telegram a las horas de la programación. La interpretación como lista diaria de horas y su zona horaria se definen en DEC-04 aprobada.

Origen: RequerimientosFinal, sección 2.6; antecedentes: A56, A61; respuesta R-05. Historia: HU-22. Estado: base recopilada; Decisiones aplicadas: DEC-04.

Criterios de aceptación:

- **CA-22.1:** La app permite configurar y modificar las horas de alimentación.
- **CA-22.2:** Los recordatorios se repiten diariamente y llegan por Telegram.
- **CA-22.3:** DEC-04 aprobada: programar 08:00 y 11:00 genera un recordatorio en cada hora todos los días, en America/Costa_Rica; no crea recordatorios en las horas intermedias.

#### RF-23. Medir temperatura del biberón

El sistema deberá medir la temperatura del biberón. Cuando esta quede fuera de los límites configurados por el cuidador, deberá emitir un aviso por Telegram. No deberá suministrar alimento ni calentar o enfriar automáticamente.

Origen: RequerimientosFinal, sección 2.6; antecedentes: A57, A62. Historia: HU-23. Estado: base recopilada; Decisiones aplicadas: DEC-07, DEC-12, DEC-13.

Criterios de aceptación:

- **CA-23.1:** El dispositivo mide la temperatura del biberón.
- **CA-23.2:** La app permite configurar los límites de frío y calor.
- **CA-23.3:** Una lectura fuera de los límites genera aviso por Telegram.
- **CA-23.4:** El dispositivo no calienta, enfría ni suministra alimento automáticamente.

#### RF-24. Conservar actividad en la nube

Cuando ocurra una actividad registrada, el sistema deberá guardarla en la nube con fecha, hora, tipo, descripción, bebé, dispositivo y datos asociados cuando correspondan, y conservarla sin eliminación del historial.

Origen: RequerimientosFinal, sección 4; antecedentes: A29, A30, A31, A63. Historia: HU-24. Estado: base recopilada; Decisiones aplicadas: DEC-13.

Criterios de aceptación:

- **CA-24.1:** Cada actividad guardada contiene fecha, hora, tipo, descripción y datos asociados cuando aplican.
- **CA-24.2:** Se conservan mediciones, movimientos, activaciones, eventos y alertas.
- **CA-24.3:** No se borran registros ni se guarda audio del bebé.
- **CA-24.4:** Una reasignación mantiene la asociación histórica original.
- **CA-24.5:** DEC-13 aprobada: recibir dos veces el mismo evento conserva un solo registro, mientras que dos eventos distintos con la misma hora se conservan por separado.

#### RF-25. Consultar historial y resumen de noche

Cuando un cuidador consulte el historial o el resumen de una noche, el sistema deberá mostrar los registros del bebé correspondiente que ya estén guardados en la nube. El resumen deberá consultarse desde la aplicación.

Origen: RequerimientosFinal, sección 4; antecedentes: A35, A39. Historia: HU-25. Estado: base recopilada; Decisiones aplicadas: DEC-05, DEC-11.

Criterios de aceptación:

- **CA-25.1:** La app consulta datos recientes ya guardados en la nube.
- **CA-25.2:** Los historiales de bebés diferentes permanecen separados.
- **CA-25.3:** El resumen nocturno se consulta en la app sin envío automático a Telegram.
- **CA-25.4:** DEC-05 aprobada: seleccionar inicio y fin de la noche muestra el resumen del intervalo elegido; un intervalo sin registros se informa como tal, sin inventar actividad.

#### RF-26. Mostrar gráficos de sensores y eventos

Cuando un cuidador consulte gráficos, el sistema deberá representar los datos o eventos de todos los sensores mediante histogramas o líneas y permitir identificar cantidad de movimientos y rangos horarios de mayor actividad.

Origen: RequerimientosFinal, sección 4; antecedentes: A32; respuesta R-03. Historia: HU-26. Estado: base recopilada; Decisiones aplicadas: DEC-05.

Criterios de aceptación:

- **CA-26.1:** Todos los sensores tienen representación de sus mediciones o eventos.
- **CA-26.2:** Se puede consultar cuántos movimientos ocurrieron y cuándo hubo más actividad.
- **CA-26.3:** DEC-05 aprobada: dos eventos a las 08:15 y 08:59 cuentan en [08:00,09:00), y uno a las 09:00 cuenta en [09:00,10:00). Las mediciones se muestran como líneas con fecha, hora y unidad.
- **CA-26.4:** DEC-05 aprobada: la gráfica distingue intervalos sin datos de intervalos con mediciones disponibles y cero eventos.

#### RF-27. Exportar datos para Excel

Cuando un cuidador exporte los datos, el sistema deberá generar un archivo para Excel con al menos fecha, hora y evento, sin formato decorativo, fotografías ni enlaces a fotografías.

Origen: RequerimientosFinal, sección 4; antecedentes: A33; respuestas R-07, R-08. Historia: HU-27. Estado: base recopilada; Decisiones aplicadas: DEC-06.

Criterios de aceptación:

- **CA-27.1:** El archivo contiene al menos fecha, hora y evento.
- **CA-27.2:** Contiene solo datos, sin formato decorativo, fotografías ni enlaces a fotografías.
- **CA-27.3:** DEC-06 aprobada: se genera un archivo .xlsx con una fila por registro del bebé y período elegidos; se incluyen las columnas definidas en DEC-06 y se dejan vacíos los campos no aplicables.
- **CA-27.4:** Los registros exportados corresponden a la información almacenada.
- **CA-27.5:** DEC-06 aprobada: el archivo de un período sin registros contiene encabezados y ninguna fila de datos; los valores de las filas coinciden con el historial.

#### RF-28. Gestionar interrupción y recuperación

Si se pierde la electricidad o la conexión a internet, el sistema deberá detener su funcionamiento conforme a la aclaración previa. Cuando el servicio se recupere, deberá seguir la política de DEC-10 aprobada.

Origen: RequerimientosFinal, sección 7; antecedentes: A37 y aclaración escrita de interrupción. Historia: HU-28. Estado: base recopilada; Decisiones aplicadas: DEC-10.

Criterios de aceptación:

- **CA-28.1:** La solución no exige UPS ni continuidad sin conexión.
- **CA-28.2:** La interrupción detiene el funcionamiento conforme a la aclaración registrada.
- **CA-28.3:** DEC-10 aprobada: tras recuperarse la conexión se conservan registros y configuración, se muestra el colchón detenido y se exige rearme con nueva referencia; los recordatorios vencidos se omiten y los futuros conservan su programación.

#### RF-29. Validar maqueta modular

La entrega académica deberá demostrar todos los módulos mediante una maqueta y documentar las restricciones físicas del producto comercial; las sustituciones de sensores deberán coordinarse previamente con el profesor.

Origen: RequerimientosFinal, sección 2, 7; antecedentes: A02, A03, A04, A40, A53, A64, A65, A67. Historia: HU-29. Estado: base recopilada; Decisiones aplicadas: DEC-12.

Criterios de aceptación:

- **CA-29.1:** La demostración contempla cuna, figuras LED, colchón, habitación, juego y alimentación con pesaje.
- **CA-29.2:** El colchón demuestra uso independiente y alimentación propia o desde la cuna.
- **CA-29.3:** El juego comercial contempla baterías; la maqueta puede usar electricidad.
- **CA-29.4:** Se documentan dimensiones, materiales y componentes; una sustitución de sensor se coordina con el profesor.

### 3.3 Requisitos de rendimiento

- **RNF-01 (aprobado por DEC-11):** con el volumen y conexión de prueba de DEC-11, el historial deberá responder en 3 segundos y el backend solicitar el envío de avisos en 5 segundos, en al menos 95 de 100 pruebas. Medir por separado la entrega externa de Telegram. La capacidad comercial permanece por definir.
- **RNF-02 (aprobado por DEC-07):** el sistema deberá tomar lecturas ambientales cada 10 segundos y de peso cada segundo, y registrar eventos cuando ocurran. Verificar las marcas de tiempo en la maqueta; cualquier cambio requerido por el sensor se tramita como cambio de la decisión aprobada.

### 3.4 Restricciones de diseño

- **RD-01 (base recopilada, §6):** la interfaz deberá ser un sitio web gratuito para los dispositivos adquiridos; verificar los controles descritos en INT-01. No se exige aplicación nativa.
- **RD-02 (decisión del equipo, §6-7):** el backend y base de datos utilizarán Supabase. La distribución de servicios, protocolos y esquema se documentará en arquitectura.
- **RD-03 (base recopilada, §2 y §7):** el diseño deberá respetar alimentación y modularidad de cada producto, cinco botones del juego y limitaciones de cámara y audio. Verificar RF-29 y la lista de componentes de arquitectura.

### 3.5 Atributos del sistema

- **RNF-03 (aprobado por DEC-09):** una cuenta que no sea dueña del dispositivo no deberá consultar sus datos o fotos ni cambiar sus controles. Verificar con dos cuentas que no compartan dispositivo, incluyendo solicitudes directas al backend. Ser destinatario de Telegram no otorga control.
- **RNF-04 (base recopilada, §4-5):** la reasignación de dispositivos no deberá borrar ni cambiar la asociación de los registros previos. Verificar RF-05 y RF-24 con dos bebés.
- **RNF-05 (base recopilada, §2.1):** no deberá almacenarse la voz transmitida ni grabarse sonidos del bebé. Verificar RF-12 y los datos persistidos después de una transmisión.
- **RNF-06 (aprobado por DEC-10):** tras una interrupción, la app deberá distinguir el monitoreo detenido del activo y no presentar lecturas inexistentes como nuevas. Verificar corte, recuperación y rearme de RF-28.
- **RNF-07 (aprobado por DEC-09):** la interfaz deberá permitir gestionar los módulos desde celular y computadora, mostrando nombres y unidades sin ocultar acciones por solapamiento. Probar las funciones principales en anchos de 360 y 1280 píxeles; navegadores concretos por acordar.
- **RNF-08 (propuesto por el equipo):** la entrega deberá incluir instrucciones de instalación y configuración, componentes utilizados y evidencia de criterios de aceptación. Verificar que otro integrante pueda reproducir la demostración siguiendo esas instrucciones. Pendiente de revisión del equipo y cliente.

### 3.6 Otros requisitos y datos

- **DAT-01:** cada actividad deberá conservar fecha, hora, tipo, descripción, bebé y dispositivo, y datos propios del evento cuando corresponda. Las fotos se vinculan a eventos de habitación; no forman parte de la exportación.
- **DAT-02 (aprobado por DEC-01):** la toma deberá conservar pesos inicial y final, gramos ingeridos, inicio, fin, pausas y duración. Una corrección deberá mantener evidencia del valor anterior, autor, fecha y motivo.
- **DAT-03 (aprobado por DEC-04 a DEC-06):** horarios, gráficos y exportación deberán usar una zona horaria consistente; se utiliza America/Costa_Rica. La representación de almacenamiento se decidirá en arquitectura.
- **DAT-04:** no deberá existir eliminación de registros del historial en los flujos del producto. Retirar un dueño o reasignar un dispositivo no equivale a eliminar registros.

## 4. Apéndices

### 4.1 Registro de decisiones

Aprobación de DEC-01 a DEC-13: confirmada por el usuario el 10 de octubre de 2026 mediante «ya las aprobo», en respuesta a la consulta sobre las 13 decisiones de Alejandro. Se registra como confirmación del equipo; no se conoce la fecha original de aprobación ni se dispone de un mensaje directo de Alejandro. Esta confirmación no acredita por sí sola la aprobación integral de la especificación, RNF-08, reuniones, retrospectivas o pruebas ejecutadas.

#### DEC-01. Tomas y cálculo de consumo

Calcular gramos como peso inicial menos final, con el mismo recipiente. Pausar excluye ese intervalo de la duración; reanudar continúa la misma toma. Exigir ambos pesos para finalizar. Si el peso final supera al inicial o falta una lectura, solicitar corrección sin inventar consumo. Conservar valor original, cambio, autor, fecha y motivo.

Historias afectadas: HU-20, HU-21. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-02. Devolución del biberón

Mantener cierre manual. Devolver el biberón permite pesarlo, pero no finaliza la toma. El cierre automático queda fuera del alcance aprobado; incorporarlo requerirá una solicitud de cambio.

Historias afectadas: HU-21. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-03. Apagado de alarma y rearme

Aplicar apagado automático del sonido a los 60 segundos, configurable. Tras detener la alarma por app, botón o tiempo, dejar monitoreo detenido y mostrar ese estado. Rearmar solo por acción explícita en la app, capturando una referencia nueva. No interpretar el silencio como reanudación automática. El valor de 60 segundos es un parámetro aprobado para la maqueta.

Historias afectadas: HU-15, HU-16. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-04. Recurrencia de alimentación

Interpretar «Diario y a cada hora de la programación» como lista diaria de horas, por ejemplo 08:00 y 11:00, en America/Costa_Rica. Enviar una vez por hora programada a cada destinatario. No añadir días de semana ni intervalos arbitrarios sin aprobación.

Historias afectadas: HU-22. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-05. Gráficos por hora

Usar histogramas de conteos de eventos con intervalos de una hora [inicio, fin) y líneas de mediciones con fecha, hora y unidad. Mostrar la zona horaria America/Costa_Rica. Diferenciar cero eventos de falta de datos. Para el resumen nocturno, permitir selección de inicio y fin del intervalo por el cuidador.

Historias afectadas: HU-25, HU-26. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-06. Archivo de Excel

Usar .xlsx con una fila por registro y encabezados simples. Columnas: fecha, hora, evento, bebe_id, dispositivo_id, descripcion, valor y unidad; para tomas: peso_inicial_g, peso_final_g, cantidad_g y duracion_s. Dejar vacíos los campos no aplicables. Exportar el período y bebé seleccionados. Excluir imágenes y sus enlaces.

Historias afectadas: HU-27. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-07. Sensores, unidades y tolerancias

Usar °C para temperatura, % HR para humedad y gramos para peso. Lecturas ambientales cada 10 segundos; lectura de peso cada segundo; registrar eventos cuando ocurren. Para demostrar la maqueta, usar como escenario de prueba una pérdida superior al 10% durante 3 lecturas consecutivas. Son parámetros de prueba, no umbrales clínicos ni valores comerciales aprobados. Validar rangos y precisión en arquitectura (HU-42); un cambio de los parámetros aprobados requiere registrar su impacto y acuerdo.

Historias afectadas: HU-09, HU-14, HU-15, HU-23. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-08. Luces y sonidos

Establecer cambios LED con intervalo mínimo configurable de 2 segundos y sin destellos abruptos. Incluir catálogo pregrabado con selección, reproducir y detener; carga de archivos fuera del alcance inicial. Intensidad física, catálogo y volumen se concretan y validan en arquitectura y demostración (HU-42, HU-11, HU-13). La aprobación de esta decisión no equivale a una medición física ya realizada.

Historias afectadas: HU-11, HU-13. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-09. Acceso, perfil y destinatarios

Exigir nombre del bebé y fecha de nacimiento opcional; vincular accesorios sin exigir cuna. Invitar dueños por correo con aceptación y retirar acceso sin borrar historial. Vincular Telegram por código de un solo uso. Evitar retirar al último dueño. Proteger consultas, fotos y controles para que solo accedan dueños autorizados.

Historias afectadas: HU-01, HU-02, HU-03, HU-04, HU-05, HU-06. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-10. Recuperación de conexión y energía

Tras recuperarse, conservar datos ya guardados y configuración; exigir reactivación manual del monitoreo del colchón con nueva referencia. Mostrar interrupción y no reconstruir mediciones inexistentes. Omitir recordatorios vencidos y ejecutar los futuros. Precisar la recuperación de horarios de los demás módulos en arquitectura, conservando el rearme manual del colchón.

Historias afectadas: HU-28. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-11. Rendimiento y capacidad de maqueta

Validar con 2 cuentas concurrentes, 2 bebés, un ejemplar de cada módulo y 1000 eventos. Objetivos de prueba: consulta de historial en 3 segundos y solicitud de envío a Telegram en 5 segundos desde la recepción del evento por el backend, en 95 de 100 pruebas con conexión disponible. La entrega externa depende de Telegram. No equivale a capacidad del producto comercial.

Historias afectadas: HU-07, HU-25. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-12. Diseño físico e interfaces

Elegir componentes, rangos y precisión de balanzas, método de temperatura del biberón, materiales, dimensiones, alimentación y protocolos en arquitectura. Validar una maqueta que incluya pesaje de alimentación y uso independiente del colchón. Documentar límites de brillo y seguridad mecánica del juguete; no sustituir un sensor sin coordinar con el profesor.

Historias afectadas: HU-23, HU-29. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

#### DEC-13. Validaciones y episodios de eventos

Exigir límites inferiores estrictamente menores a los superiores; rechazar duraciones nulas o negativas y referencias de peso nulas o inválidas. Al vencer el período configurado, detener el monitoreo. Considerar un episodio continuo de fuera de rango como una instancia: emitir un aviso al entrar en ese estado y habilitar un aviso nuevo solo al regresar al rango y volver a salir. Conservar un identificador por evento para que su reenvío no duplique registros; dos eventos distintos con igual fecha y hora sí se conservan. Estas reglas completan la definición de «una notificación por instancia» sin agrupar acciones distintas.

Historias afectadas: HU-07, HU-10, HU-14, HU-24. Estado: aprobada, según confirmación del equipo registrada el 2026-10-10.

### 4.2 Matriz de trazabilidad funcional

| Requisito | Historia | Origen en RequerimientosFinal | Decisiones aplicadas |
| --- | --- | --- | --- |
| RF-01 | HU-01 | §5 | DEC-09 |
| RF-02 | HU-02 | §5 | DEC-09 |
| RF-03 | HU-03 | §5 | DEC-09 |
| RF-04 | HU-04 | §5 | DEC-09 |
| RF-05 | HU-05 | §5 | DEC-09 |
| RF-06 | HU-06 | §3, 5 | DEC-09 |
| RF-07 | HU-07 | §3 | DEC-11, DEC-13 |
| RF-08 | HU-08 | §2.1 | Ninguna específica |
| RF-09 | HU-09 | §2.1 | DEC-07 |
| RF-10 | HU-10 | §2.1, 3 | DEC-13 |
| RF-11 | HU-11 | §2.1 | DEC-08 |
| RF-12 | HU-12 | §2.1 | Ninguna específica |
| RF-13 | HU-13 | §2.2 | DEC-08 |
| RF-14 | HU-14 | §2.3 | DEC-07, DEC-13 |
| RF-15 | HU-15 | §2.3, 3 | DEC-03, DEC-07 |
| RF-16 | HU-16 | §2.3 | DEC-03 |
| RF-17 | HU-17 | §2.4 | Ninguna específica |
| RF-18 | HU-18 | §2.4 | Ninguna específica |
| RF-19 | HU-19 | §2.5 | Ninguna específica |
| RF-20 | HU-20 | §2.6 | DEC-01 |
| RF-21 | HU-21 | §2.6 | DEC-01, DEC-02 |
| RF-22 | HU-22 | §2.6 | DEC-04 |
| RF-23 | HU-23 | §2.6 | DEC-07, DEC-12, DEC-13 |
| RF-24 | HU-24 | §4 | DEC-13 |
| RF-25 | HU-25 | §4 | DEC-05, DEC-11 |
| RF-26 | HU-26 | §4 | DEC-05 |
| RF-27 | HU-27 | §4 | DEC-06 |
| RF-28 | HU-28 | §7 | DEC-10 |
| RF-29 | HU-29 | §2, 7 | DEC-12 |

### 4.3 Aprobación y preparación para Jira

| Elemento | Estado actual | Evidencia necesaria |
| --- | --- | --- |
| Respuestas de Alejandro | Incorporadas | Texto aportado por el equipo, resumido en §8.2 del consolidado. |
| Especificación v0.4 | Cierre integral por registrar | Fecha y constancia de aprobación o cambios del cliente. |
| DEC-01 a DEC-13 | Aprobadas según confirmación del equipo | Registro de §4.1. RNF-08 mantiene su revisión específica en HU-38/HU-46. |
| Historias HU-01 a HU-47 | Backlog completo preparado | Jira/BacklogCompleto.md: épicas, criterios y tareas; prioridad y estimación por el equipo. |
| Estimaciones e incrementos | Sin estimar | Puntos acordados por el equipo y reparto del 40-60% para el primer incremento. |
| Jira | Lista preparada, sin carga externa | Usar Jira/BacklogCompleto.md. |

El calendario del documento del curso fija requerimientos el 15 de octubre, arquitectura el 29 de octubre, incrementos el 12 y 26 de noviembre, y retrospectiva el 26 de noviembre de 2026. La preparación del backlog no sustituye la aprobación de requerimientos ni la estimación del equipo.

### 4.4 Control de cambios

| Versión | Fecha de preparación | Cambios | Aprobación |
| --- | --- | --- | --- |
| 0.2 | 2026-10-09 | Incorporación de respuestas, 29 RF/HU y propuestas iniciales. | No registrada. |
| 0.3 | 2026-10-09 | Redacción EARS, criterios integrados, casos límite, fuentes R/A, DEC-13 y evidencias preparadas del sprint 1. | Pendiente de revisión del cliente. |
| 0.4 | 2026-10-10 | Registro de aprobación de las 13 DEC informada por el equipo; backlog integral de 47 historias con épicas y tareas. | DEC aprobadas; aprobación integral de versión por registrar. |

Las respuestas posteriores prevalecen sobre interpretaciones anteriores en el mismo tema. Los antecedentes no se reescriben como si hubieran contenido esas aclaraciones. Un cambio de alcance requiere registrar requisito, motivo, impacto, decisión y versión en el acta del sprint.


La lista integral vigente se encuentra en [Jira/BacklogCompleto.md](Jira/BacklogCompleto.md). Los valores físicos aún por seleccionar son entregables de arquitectura, no decisiones funcionales reabiertas.
