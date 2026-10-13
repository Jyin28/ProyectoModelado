# Historias funcionales del proyecto

Versión 0.4 — 10 de octubre de 2026. Las 13 DEC están aprobadas según confirmación del equipo. El [backlog completo para Jira](Jira/BacklogCompleto.md) contiene las 11 épicas, 47 historias y 141 tareas, incluyendo Sprint 1. Este archivo conserva las 29 historias funcionales y su trazabilidad.

### HU-01. Registrar e iniciar sesión

Como cuidador, quiero registrarme e ingresar con correo y contraseña, para acceder a mis dispositivos.

- Requisito: RF-01.
- Épica: EP-03.
- Estado: por hacer; sin implementación registrada.
- Dependencias: Ninguna.
- Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-01.1:** Una cuenta registrada puede iniciar sesión con sus credenciales.
- **CA-01.2:** Las credenciales incorrectas impiden el acceso.
- **CA-01.3:** El cierre de sesión termina el acceso autenticado.
- **CA-01.4:** DEC-09 aprobada: un correo ya registrado o campos obligatorios vacíos no crean una segunda cuenta.

### HU-02. Gestionar bebés

Como cuidador, quiero mantener un registro por bebé, para separar el historial de mis hijos.

- Requisito: RF-02.
- Épica: EP-03.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-01.
- Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-02.1:** Dos bebés de una cuenta mantienen registros separados.
- **CA-02.2:** Es posible asociar accesorios a un bebé sin comprar la cuna.
- **CA-02.3:** DEC-09 aprobada: al crear un perfil, se exige nombre del bebé y se permite dejar vacía la fecha de nacimiento.

### HU-03. Asociar dispositivos

Como cuidador, quiero asociar los módulos adquiridos a cada bebé, para controlar el equipo correspondiente.

- Requisito: RF-03.
- Épica: EP-03.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-02.
- Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-03.1:** Una cuenta puede asociar varios dispositivos.
- **CA-03.2:** Se respeta una cuna por bebé y se admiten accesorios independientes.
- **CA-03.3:** La interfaz presenta los módulos asociados.
- **CA-03.4:** DEC-09 aprobada: asociar una segunda cuna a un bebé se rechaza sin eliminar la asociación existente.

### HU-04. Administrar dueños compartidos

Como cuidador, quiero administrar los dueños del dispositivo, para compartir su cuidado.

- Requisito: RF-04.
- Épica: EP-03.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03.
- Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-04.1:** Dos dueños consultan la misma configuración del dispositivo.
- **CA-04.2:** La sección Bebés y dispositivos ofrece Administrar dueños.
- **CA-04.3:** DEC-09 aprobada: una invitación por correo solo concede acceso tras aceptarla; retirar a un dueño revoca su acceso y conserva el historial; se impide retirar al último dueño.

### HU-05. Reasignar una cuna

Como cuidador, quiero reasignar una cuna a otro bebé, para reutilizarla sin mezclar historiales.

- Requisito: RF-05.
- Épica: EP-03.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03.
- Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-05.1:** La reasignación vincula las actividades nuevas con el nuevo bebé.
- **CA-05.2:** Los registros previos conservan su bebé original.
- **CA-05.3:** La reasignación no borra registros.

### HU-06. Configurar destinatarios de Telegram

Como cuidador, quiero gestionar varios destinatarios por dispositivo, para avisar a quienes cuidan al bebé.

- Requisito: RF-06.
- Épica: EP-04.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-04.
- Decisiones aplicadas: DEC-09.

Criterios de aceptación:

- **CA-06.1:** La sección Destinatarios de Telegram permite configurar más de un destinatario.
- **CA-06.2:** La lista pertenece al dispositivo y es compartida por sus dueños.
- **CA-06.3:** DEC-09 aprobada: un código de un solo uso vincula al destinatario; retirarlo evita futuros avisos y no modifica los dueños del dispositivo.

### HU-07. Recibir avisos por evento

Como cuidador, quiero recibir alertas y recordatorios en Telegram, para enterarme aunque la web esté cerrada.

- Requisito: RF-07.
- Épica: EP-04.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-06. Integración: HU-24.
- Decisiones aplicadas: DEC-11, DEC-13.

Criterios de aceptación:

- **CA-07.1:** Un evento habilitado genera un aviso por cada destinatario configurado.
- **CA-07.2:** Cerrar la web no impide recibir el aviso.
- **CA-07.3:** Una instancia de acción o superación de tolerancia no genera avisos repetidos; acciones distintas no se agrupan.
- **CA-07.4:** Los mensajes de fotografía no contienen la imagen.
- **CA-07.5:** DEC-13 aprobada: varias lecturas consecutivas fuera del rango producen un único aviso por episodio; volver al rango y volver a salir produce un aviso nuevo.

### HU-08. Monitorear movimiento de la cuna

Como cuidador, quiero activar el monitoreo manualmente o por horario, para conocer la actividad del bebé.

- Requisito: RF-08.
- Épica: EP-05.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03, HU-07. Integración: HU-24.
- Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-08.1:** Una detección durante el monitoreo activo queda registrada con hora.
- **CA-08.2:** La detección activa produce una alerta por Telegram con su hora.
- **CA-08.3:** Desactivar el monitoreo evita eventos y avisos de ese monitoreo.

### HU-09. Consultar ambiente de la cuna

Como cuidador, quiero consultar temperatura y humedad, para conocer las condiciones de la cuna.

- Requisito: RF-09.
- Épica: EP-05.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03. Integración: HU-24.
- Decisiones aplicadas: DEC-07.

Criterios de aceptación:

- **CA-09.1:** Se muestran lecturas de temperatura y humedad del interior de la cuna.
- **CA-09.2:** Las mediciones quedan asociadas al dispositivo y al bebé.
- **CA-09.3:** DEC-07 aprobada: se muestran °C y % HR; las lecturas ambientales se toman cada 10 segundos y conservan su fecha y hora.

### HU-10. Configurar límites ambientales

Como cuidador, quiero establecer límites inferiores y superiores, para recibir avisos fuera del rango elegido.

- Requisito: RF-10.
- Épica: EP-05.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-07, HU-09. Integración: HU-07, HU-09.
- Decisiones aplicadas: DEC-13.

Criterios de aceptación:

- **CA-10.1:** Se guardan límites inferiores y superiores para temperatura y humedad.
- **CA-10.2:** Una lectura fuera del rango configurado genera el aviso correspondiente.
- **CA-10.3:** Todos los dueños ven la misma configuración.
- **CA-10.4:** DEC-13 aprobada: si el límite inferior es mayor o igual al superior, no se guarda el cambio y se mantiene la configuración anterior.

### HU-11. Controlar luz y audios de la cuna

Como cuidador, quiero manejar la lámpara y audios pregrabados, para acompañar al bebé desde la app.

- Requisito: RF-11.
- Épica: EP-05.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03. Integración: HU-24.
- Decisiones aplicadas: DEC-08.

Criterios de aceptación:

- **CA-11.1:** La lámpara permite encendido, apagado y cambio de intensidad.
- **CA-11.2:** Se reproduce audio pregrabado sin depender de Spotify.
- **CA-11.3:** La reproducción queda como actividad sin registrar sonidos del bebé.
- **CA-11.4:** DEC-08 aprobada: se puede seleccionar, reproducir y detener un audio del catálogo pregrabado; la versión inicial no ofrece carga de archivos.

### HU-12. Transmitir voz en vivo

Como cuidador, quiero hablar desde el celular hacia la cuna, para hacer que el bebé escuche mi voz.

- Requisito: RF-12.
- Épica: EP-05.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03. Integración: HU-24.
- Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-12.1:** La voz se reproduce en el altavoz de la cuna durante la transmisión.
- **CA-12.2:** El canal es unidireccional; no devuelve audio del bebé.
- **CA-12.3:** Puede registrarse la actividad, pero no se almacena la voz transmitida.

### HU-13. Programar figuras LED

Como cuidador, quiero controlar las luces de las figuras, para programar el entretenimiento.

- Requisito: RF-13.
- Épica: EP-06.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03. Integración: HU-40, HU-42.
- Decisiones aplicadas: DEC-08.

Criterios de aceptación:

- **CA-13.1:** La app permite encender y apagar manualmente y por horario.
- **CA-13.2:** Se puede ajustar el número de segundos entre cambios de luces.
- **CA-13.3:** El control es independiente de la lámpara y del colchón, sin dimmer ni motor exigido.
- **CA-13.4:** DEC-08 aprobada: configurar menos de 2 segundos entre cambios se rechaza; al configurar 2 segundos, los cambios respetan ese intervalo. La intensidad física aún requiere validación de diseño.

### HU-14. Activar monitoreo del colchón

Como cuidador, quiero activar el colchón por un tiempo configurable, para vigilar cambios respecto al peso inicial.

- Requisito: RF-14.
- Épica: EP-07.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03. Integración: HU-24, HU-42.
- Decisiones aplicadas: DEC-07, DEC-13.

Criterios de aceptación:

- **CA-14.1:** Activar guarda el peso numérico de referencia, incluidos bebé y objetos.
- **CA-14.2:** Se permite desactivar desde la aplicación.
- **CA-14.3:** El colchón funciona sin comprar la cuna inteligente.
- **CA-14.4:** No se toma una foto del peso ni se registran movimientos derivados de la balanza.
- **CA-14.5:** DEC-13 aprobada: una duración nula o negativa o una referencia de peso nula o inválida impiden activar el monitoreo; al vencer la duración válida, el monitoreo queda detenido.

### HU-15. Detectar pérdida de peso

Como cuidador, quiero recibir una alarma ante pérdida significativa de peso, para advertir el cambio durante el monitoreo.

- Requisito: RF-15.
- Épica: EP-07.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-07, HU-14.
- Decisiones aplicadas: DEC-03, DEC-07.

Criterios de aceptación:

- **CA-15.1:** La tolerancia se configura como porcentaje del peso de referencia.
- **CA-15.2:** Superar la tolerancia activa sonido en el colchón y aviso en Telegram.
- **CA-15.3:** No hay alarma de monitoreo cuando está desactivado.
- **CA-15.4:** DEC-07 aprobada: con referencia de 1000 g y tolerancia del 10%, tres lecturas consecutivas de 890 g disparan la alarma; tres de 900 g no la disparan; una lectura de 890 g seguida por 1000 g no completa el filtro.

### HU-16. Detener alarma y restablecer monitoreo

Como cuidador, quiero detener la alarma y restablecer el monitoreo desde la app, para controlar el seguimiento del colchón.

- Requisito: RF-16.
- Épica: EP-07.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-15.
- Decisiones aplicadas: DEC-03.

Criterios de aceptación:

- **CA-16.1:** La alarma activa puede detenerse con la app y el botón físico.
- **CA-16.2:** La app permite restablecer el monitoreo manualmente.
- **CA-16.3:** DEC-03 aprobada: a los 60 segundos configurados se apaga el sonido; tanto este apagado como app o botón dejan el monitoreo detenido. Una acción explícita de rearme captura una nueva referencia.

### HU-17. Monitorear puerta y movimiento de habitación

Como cuidador, quiero activar los sensores de habitación manualmente o por horario, para detectar actividad en los períodos elegidos.

- Requisito: RF-17.
- Épica: EP-08.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03, HU-07. Integración: HU-24.
- Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-17.1:** Cada sensor admite activar, desactivar y programar un rango de tiempo.
- **CA-17.2:** Abrir la puerta o detectar movimiento activo genera un evento.
- **CA-17.3:** El evento genera aviso en Telegram y no alarma sonora local.
- **CA-17.4:** No se distingue dirección de entrada o salida.
- **CA-17.5:** Si puerta y movimiento producen dos acciones durante monitoreo activo, se conservan dos eventos y dos solicitudes de fotografía.

### HU-18. Guardar y consultar fotografías

Como cuidador, quiero ver las fotografías de los eventos de habitación, para consultar lo ocurrido.

- Requisito: RF-18.
- Épica: EP-08.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-17.
- Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-18.1:** Un evento de puerta o movimiento durante monitoreo activo toma una fotografía.
- **CA-18.2:** La fotografía se guarda en nube y se consulta desde la app.
- **CA-18.3:** Se registra una foto por instancia de acción, sin agrupar acciones distintas.
- **CA-18.4:** La cámara no graba video y Telegram solo notifica que se tomó una foto.

### HU-19. Utilizar el juego de cinco botones

Como cuidador, quiero ofrecer un juego con botones iluminados, para entretener al bebé con una recompensa sonora.

- Requisito: RF-19.
- Épica: EP-06.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03. Integración: HU-42.
- Decisiones aplicadas: Ninguna específica.

Criterios de aceptación:

- **CA-19.1:** Se ilumina un objetivo elegido aleatoriamente entre cinco botones.
- **CA-19.2:** Pulsar el objetivo reproduce una recompensa; pulsar otro no la reproduce.
- **CA-19.3:** Después de presionar un botón se ilumina otro objetivo aleatorio.
- **CA-19.4:** El juego continúa hasta apagarlo.

### HU-20. Iniciar y pesar una toma

Como cuidador, quiero pesar al inicio e iniciar una toma desde la app, para registrar el comienzo de la alimentación.

- Requisito: RF-20.
- Épica: EP-09.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03. Integración: HU-24, HU-42.
- Decisiones aplicadas: DEC-01.

Criterios de aceptación:

- **CA-20.1:** El adulto coloca alimento o biberón sobre el dispositivo y registra el peso inicial en gramos.
- **CA-20.2:** El botón de inicio registra la hora y comienza el temporizador.
- **CA-20.3:** La toma queda asociada al bebé y dispositivo correspondientes.
- **CA-20.4:** DEC-01 aprobada: sin peso inicial válido no se inicia la toma; se informa que debe colocarse el mismo recipiente que se usará para el pesaje final.

### HU-21. Pausar, finalizar y corregir tomas

Como cuidador, quiero gestionar una toma y registrar su peso final, para conservar cantidad y duración correctas.

- Requisito: RF-21.
- Épica: EP-09.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-20.
- Decisiones aplicadas: DEC-01, DEC-02.

Criterios de aceptación:

- **CA-21.1:** La app permite pausar y finalizar manualmente la toma.
- **CA-21.2:** Al finalizar se pesa de nuevo el alimento o biberón en el dispositivo, en gramos.
- **CA-21.3:** Se permite corregir la toma y consultar su duración final.
- **CA-21.4:** DEC-01 aprobada: una toma de 08:00 a 08:15, pausada de 08:05 a 08:07, conserva 13 minutos activos. Con 200 g iniciales y 150 g finales registra 50 g ingeridos. Una corrección conserva valor anterior, autor, fecha y motivo.
- **CA-21.5:** DEC-02 aprobada: devolver el biberón permite obtener su peso, pero la toma continúa hasta el cierre manual. El cierre automático queda fuera del alcance actual; requiere una solicitud de cambio.
- **CA-21.6:** DEC-01 aprobada: un peso final mayor al inicial o una lectura faltante impiden cerrar como completa; el usuario puede corregir y volver a intentar, sin registrar un consumo negativo.

### HU-22. Programar recordatorios diarios

Como cuidador, quiero definir horarios diarios de alimentación, para recordar las próximas tomas.

- Requisito: RF-22.
- Épica: EP-09.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-07. Integración: HU-03.
- Decisiones aplicadas: DEC-04.

Criterios de aceptación:

- **CA-22.1:** La app permite configurar y modificar las horas de alimentación.
- **CA-22.2:** Los recordatorios se repiten diariamente y llegan por Telegram.
- **CA-22.3:** DEC-04 aprobada: programar 08:00 y 11:00 genera un recordatorio en cada hora todos los días, en America/Costa_Rica; no crea recordatorios en las horas intermedias.

### HU-23. Medir temperatura del biberón

Como cuidador, quiero consultar la temperatura del biberón y configurar límites, para recibir avisos si está fuera del rango.

- Requisito: RF-23.
- Épica: EP-09.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03, HU-07. Integración: HU-24, HU-42.
- Decisiones aplicadas: DEC-07, DEC-12, DEC-13.

Criterios de aceptación:

- **CA-23.1:** El dispositivo mide la temperatura del biberón.
- **CA-23.2:** La app permite configurar los límites de frío y calor.
- **CA-23.3:** Una lectura fuera de los límites genera aviso por Telegram.
- **CA-23.4:** El dispositivo no calienta, enfría ni suministra alimento automáticamente.

### HU-24. Conservar actividad en la nube

Como cuidador, quiero guardar actividades por bebé y dispositivo, para mantener un historial permanente.

- Requisito: RF-24.
- Épica: EP-10.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-03.
- Decisiones aplicadas: DEC-13.

Criterios de aceptación:

- **CA-24.1:** Cada actividad guardada contiene fecha, hora, tipo, descripción y datos asociados cuando aplican.
- **CA-24.2:** Se conservan mediciones, movimientos, activaciones, eventos y alertas.
- **CA-24.3:** No se borran registros ni se guarda audio del bebé.
- **CA-24.4:** Una reasignación mantiene la asociación histórica original.
- **CA-24.5:** DEC-13 aprobada: recibir dos veces el mismo evento conserva un solo registro, mientras que dos eventos distintos con la misma hora se conservan por separado.

### HU-25. Consultar historial y resumen de noche

Como cuidador, quiero consultar las actividades y el resumen nocturno, para revisar lo sucedido.

- Requisito: RF-25.
- Épica: EP-10.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-24.
- Decisiones aplicadas: DEC-05, DEC-11.

Criterios de aceptación:

- **CA-25.1:** La app consulta datos recientes ya guardados en la nube.
- **CA-25.2:** Los historiales de bebés diferentes permanecen separados.
- **CA-25.3:** El resumen nocturno se consulta en la app sin envío automático a Telegram.
- **CA-25.4:** DEC-05 aprobada: seleccionar inicio y fin de la noche muestra el resumen del intervalo elegido; un intervalo sin registros se informa como tal, sin inventar actividad.

### HU-26. Mostrar gráficos de sensores y eventos

Como cuidador, quiero ver histogramas o líneas de los datos, para identificar actividad y variaciones por hora.

- Requisito: RF-26.
- Épica: EP-10.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-24.
- Decisiones aplicadas: DEC-05.

Criterios de aceptación:

- **CA-26.1:** Todos los sensores tienen representación de sus mediciones o eventos.
- **CA-26.2:** Se puede consultar cuántos movimientos ocurrieron y cuándo hubo más actividad.
- **CA-26.3:** DEC-05 aprobada: dos eventos a las 08:15 y 08:59 cuentan en [08:00,09:00), y uno a las 09:00 cuenta en [09:00,10:00). Las mediciones se muestran como líneas con fecha, hora y unidad.
- **CA-26.4:** DEC-05 aprobada: la gráfica distingue intervalos sin datos de intervalos con mediciones disponibles y cero eventos.

### HU-27. Exportar datos para Excel

Como cuidador, quiero descargar los registros en Excel, para analizarlos fuera de la aplicación.

- Requisito: RF-27.
- Épica: EP-10.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-24.
- Decisiones aplicadas: DEC-06.

Criterios de aceptación:

- **CA-27.1:** El archivo contiene al menos fecha, hora y evento.
- **CA-27.2:** Contiene solo datos, sin formato decorativo, fotografías ni enlaces a fotografías.
- **CA-27.3:** DEC-06 aprobada: se genera un archivo .xlsx con una fila por registro del bebé y período elegidos; se incluyen las columnas definidas en DEC-06 y se dejan vacíos los campos no aplicables.
- **CA-27.4:** Los registros exportados corresponden a la información almacenada.
- **CA-27.5:** DEC-06 aprobada: el archivo de un período sin registros contiene encabezados y ninguna fila de datos; los valores de las filas coinciden con el historial.

### HU-28. Gestionar interrupción y recuperación

Como cuidador, quiero conocer el estado después de perder electricidad o internet, para evitar confundir una interrupción con monitoreo activo.

- Requisito: RF-28.
- Épica: EP-11.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-14, HU-22, HU-24.
- Decisiones aplicadas: DEC-10.

Criterios de aceptación:

- **CA-28.1:** La solución no exige UPS ni continuidad sin conexión.
- **CA-28.2:** La interrupción detiene el funcionamiento conforme a la aclaración registrada.
- **CA-28.3:** DEC-10 aprobada: tras recuperarse la conexión se conservan registros y configuración, se muestra el colchón detenido y se exige rearme con nueva referencia; los recordatorios vencidos se omiten y los futuros conservan su programación.

### HU-29. Validar maqueta modular

Como cuidador, quiero comprobar todos los módulos en una maqueta, para evaluar las funciones y su independencia.

- Requisito: RF-29.
- Épica: EP-11.
- Estado: por hacer; sin implementación registrada.
- Dependencias: HU-08, HU-13, HU-16, HU-18, HU-19, HU-21, HU-23. Integración: HU-12, HU-28, HU-42, HU-43, HU-44, HU-45.
- Decisiones aplicadas: DEC-12.

Criterios de aceptación:

- **CA-29.1:** La demostración contempla cuna, figuras LED, colchón, habitación, juego y alimentación con pesaje.
- **CA-29.2:** El colchón demuestra uso independiente y alimentación propia o desde la cuna.
- **CA-29.3:** El juego comercial contempla baterías; la maqueta puede usar electricidad.
- **CA-29.4:** Se documentan dimensiones, materiales y componentes; una sustitución de sensor se coordina con el profesor.
