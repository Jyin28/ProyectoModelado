# Proyecto: Sistema inteligente de cuido y entretenimiento para bebés

> Revisión del 10 de octubre de 2026. DEC-01 a DEC-13 aprobadas según confirmación del equipo. La aprobación integral de la versión y los resultados de las pruebas se registran por separado.

## 1. Contexto del cliente

- Cliente: Alejandro Quesada, de Cartago, Costa Rica.
- Familia: esposa, dos hijas y una tercera bebé en camino.
- Objetivo: dispositivos que faciliten la etapa de bebé mediante cuido, monitoreo y entretenimiento.
- Uso doble: para su propia hija y para producir y vender en masa al público general.
- El sistema es modular: la cuna es el producto principal y los accesorios se pueden vender por separado.

## 2. Productos del sistema

### 2.1 Cuna inteligente (producto principal)

- Dimensiones de cuna estándar. El equipo propone el material y el diseño.
- Alimentación por tomacorriente, sin baterías.
- Sensor de movimiento que detecta cualquier movimiento perceptible para el sensor.
- El monitoreo de movimiento se activa y desactiva manualmente o por horario desde la aplicación.
- Durante el monitoreo activo, las detecciones quedan registradas y se envía una alerta a Telegram con la hora del movimiento.
- Sensores de temperatura y humedad dentro de la cuna.
- Límites inferiores y superiores configurables para avisar si las lecturas quedan fuera del rango elegido.
- Luz regulable con dimmer: encendido, apagado e intensidad controlados desde la aplicación.
- Reproductor de sonidos y canciones pregrabadas. No se necesita Spotify.
- Altavoz para que el adulto le hable al bebé en vivo desde el celular.
- La voz viaja en un solo sentido: el bebé escucha al adulto; el adulto no escucha al bebé.
- La voz es en vivo, no se guarda como grabación. Sí se puede registrar la actividad de transmisión.
- La cuna no incluye cámara ni detección de llanto.

### 2.2 Figuras con luces LED encima de la cuna (se venden por separado)

- Figuras con luces para entretener al bebé.
- Luces suaves, sin cambios violentos. El intervalo mínimo aprobado es de 2 segundos; la intensidad física se concreta en arquitectura.
- Velocidad configurable desde la aplicación: cuántos segundos pasan entre cambios de luces.
- Horarios de encendido y apagado programables.
- Encendido y apagado manual desde la aplicación en cualquier momento.
- Son independientes de la lámpara regulable y del colchón.
- No tienen dimmer ni control de intensidad como la lámpara de la cuna.
- No se exige que se apaguen automáticamente cuando se retira al bebé del colchón.
- La velocidad se refiere a los cambios de luces; no se pidió un motor para mover las figuras.

### 2.3 Colchón inteligente (se vende por separado)

- Sensor de peso o balanza.
- Puede utilizarse sin comprar la cuna inteligente, por ejemplo, en una cuna que la familia ya tenga.
- El usuario activa el monitoreo durante un tiempo configurable y puede desactivarlo.
- Al activarlo se guarda el peso de referencia de lo que hay sobre el colchón, incluidos el bebé y los objetos apoyados en él.
- Se compara el peso con esa referencia y se contempla una tolerancia para los cambios producidos por el movimiento del bebé.
- La tolerancia se configura como porcentaje respecto al peso de referencia.
- Una disminución significativa durante el monitoreo activo genera una alarma sonora local y una alerta por Telegram.
- La alarma sonora está en el **colchón**, con un altavoz o dispositivo de ruido propio. 
- La alarma se puede detener desde la aplicación o con el botón físico ya acordado. Alejandro también permite que se apague después de un tiempo; se aprueba una duración predeterminada de 60 segundos, configurable.
- El monitoreo puede restablecerse manualmente desde la aplicación. Apagar el sonido no define por sí solo si se reanuda el monitoreo: la secuencia de rearme y la captura de una nueva referencia se definen en DEC-03.
- Se registran la activación, los eventos de peso y las alertas con fecha y hora.
- Puede alimentarse directamente cuando se utiliza solo y conectarse a la alimentación de la cuna cuando se compra el conjunto, para evitar dos cables externos.
- Retirar objetos del colchón también puede generar una alerta, porque cambia el peso total.
- No se exige detectar que alguien sustituya deliberadamente al bebé por un objeto de peso equivalente.
- Se registra un valor numérico del peso, no es una foto real.
- No se necesita registrar movimientos derivados de la balanza, solo un cambio brusco de peso.

### 2.4 Kit de habitación (se vende por separado)

- Sensor de apertura de puerta.
- Sensor de movimiento en la habitación.
- Monitoreo con activación manual y por horario. El sensor de puerta también permite activar, desactivar y programar un rango de tiempo.
- Al abrir la puerta o detectar movimiento durante el monitoreo activo, se toma una fotografía y se registra el evento.
- Se envían alertas por Telegram, sin alarma sonora local en la habitación.
- Las fotografías se guardan en la nube y se pueden consultar desde la aplicación.
- La cámara solo toma fotos; no graba video.
- Para la maqueta se puede usar un teléfono como cámara. El profesor no fija una resolución mínima.
- Las fotografías no se envían por Telegram, solo una notificación de que se tomó.
- No se necesita especificar la dirección de las personas, solo registrar si se abrió.

### 2.5 Juego interactivo (se vende por separado)

- Panel con botones para que el bebé interactúe.
- Se selecciona aleatoriamente un botón y se ilumina para indicar cuál debe presionar el bebé.
- Si presiona el botón iluminado, se reproduce un sonido de recompensa.
- Si presiona otro botón, no recibe la recompensa sonora.
- Puede utilizarse un único sonido predeterminado.
- No se piden texturas diferentes para los botones.
- Los botones del producto comercial deben ser grandes y no poder ser tragados por el bebé; las dimensiones y componentes se proponen en el diseño.
- Funciona con baterías en el producto comercial. La maqueta académica puede alimentarse con electricidad.
- Son 5 botones, al presionar un boton se enciende otro aleatoriamente, continua infinitamente hasta que se apague el juguete.

### 2.6 Sistema inteligente de alimentación (se vende por separado)

- Se conecta al sistema por cable, según el resumen escrito.
- Botón en la aplicación para registrar el inicio de una toma.
- Temporizador para medir el tiempo desde que empieza la alimentación.
- El adulto coloca el alimento o biberón en el dispositivo para registrar su peso al inicio y al final de cada toma. El diseño debe incluir la medición de peso; esta respuesta sustituye la interpretación anterior de registro exclusivamente manual.
- Los pesos y la cantidad ingerida se expresan en gramos. Se acuerda calcular la cantidad como peso inicial menos peso final, usando el mismo recipiente en ambas mediciones (DEC-01).
- La aplicación permite finalizar, pausar y corregir las tomas manualmente y registrar su duración final. Las reglas de pausa, reanudación y conservación de correcciones se definen en DEC-01.
- Alejandro menciona como posibilidad detener la toma al devolver el biberón al dispositivo. DEC-02 aprobada excluye el cierre automático del alcance actual.
- Los recordatorios se repiten diariamente a cada hora programada. Se interpreta como una lista de horas del día, no necesariamente un aviso cada 60 minutos; esta interpretación queda aprobada en DEC-04.
- Los recordatorios llegan por Telegram.
- Sensor de temperatura del biberón, con aviso si está muy frío o muy caliente según los límites configurados.
- La forma concreta de medir esa temperatura queda a elección del diseño.
- La alimentación requiere intervención del adulto. No se pide que el dispositivo suministre comida, caliente o enfríe automáticamente.
- La aplicación permite ajustar las horas programadas de los recordatorios.

## 3. Alertas

- Todas las alertas y recordatorios se envían a Telegram.
- Un dispositivo puede tener varios destinatarios: padre, madre, niñera u otras personas configuradas.
- Los avisos deben llegar al teléfono aunque el usuario no tenga abierto el sitio web.
- La pérdida significativa de peso durante el monitoreo del colchón es la única que produce una alarma sonora local. Las notificaciones de Telegram no necesitan ser silenciosas, según la aclaración previa.
- La reproducción de música, la voz del adulto y la recompensa del juego son funciones de audio, no alarmas.
- Los sensores de valores medidos tienen umbrales configurables. Para los sensores de eventos se configuran los períodos de monitoreo y avisos correspondientes.
- Se pueden ofrecer valores iniciales para los umbrales, pero el usuario debe poder cambiarlos.
- No se incluyen llamadas automáticas al 911.
- Solo una notificacion por superación de tolerancia o por instancia de acción.

## 4. Datos, historial y nube

- Los dispositivos recolectan los datos y los envían a la nube.
- Los registros y las fotografías del kit se almacenan en la nube. El teléfono consulta esa información.
- Se conserva un historial de actividad por bebé y dispositivo.
- Se registran movimientos, mediciones, activaciones, eventos de los módulos y alertas.
- Cada actividad incluye fecha, hora, tipo, descripción y datos asociados cuando corresponda.
- No se detectan ni se graban sonidos del bebé para el historial.
- Registrar que se reprodujo un sonido o se transmitió voz no implica guardar una grabación.
- Todos los sensores se muestran en gráficos de sus datos o eventos.
- Alejandro admite histogramas o líneas. El equipo establece histogramas para contar eventos por hora y líneas para mediciones; la agrupación aprobada usa intervalos de una hora [inicio, fin) (DEC-05).
- Se puede consultar cuántos movimientos hubo y los rangos de horas en que el bebé fue más activo.
- Los datos se exportan en un archivo de Excel sin formato decorativo, solo datos. Se aprueba usar la extensión `.xlsx` (DEC-06).
- El archivo contiene como mínimo fecha, hora y evento; las columnas adicionales dependen de la información almacenada y se definen en DEC-06.
- La exportación incluye únicamente datos de los registros, sin fotografías ni enlaces a fotografías. Las fotografías siguen disponibles en la aplicación.
- Los registros nunca se borran.
- Los datos recientes deben poder consultarse después de guardarse en la nube.
- El resumen de la noche se consulta desde la aplicación; no se pidió enviarlo automáticamente por Telegram.
- **Aprobado en DEC-04 a DEC-07:** frecuencia de medición y registro, agrupación temporal exacta, extensión del archivo y columnas adicionales. El tipo de gráfico, la exportación de datos para Excel y la exclusión de fotografías ya tienen respuesta.

## 5. Bebés, cunas y cuentas

- Registro e ingreso con correo y contraseña.
- Cada cuenta puede tener varios dispositivos asociados.
- Un registro por bebé y una cuna por bebé, según el resumen escrito.
- Para bebés distintos, incluidos gemelos, se mantienen registros y dispositivos separados.
- Si nace otro bebé, la cuna puede reasignarse al nuevo bebé.
- Los registros anteriores conservan la asociación con el bebé al que pertenecían; su historial no se borra ni se mezcla con el nuevo.
- Un mismo dispositivo puede estar asociado a varias cuentas dueñas.
- Se utiliza el modelo de **dueños compartidos con una sola configuración por dispositivo**, según la respuesta del TXT.
- La configuración es común para todas las cuentas dueñas del dispositivo.
- La venta independiente del colchón permite usarlo sin adquirir una cuna inteligente.
- Una sección «Bebés y dispositivos» en la web, con dos opciones por dispositivo: «Administrar dueños» y «Destinatarios de Telegram» permite administrar los dispositivos.

## 6. Aplicación

- Sitio web.
- Supabase como base de datos/backend, elección técnica del equipo.
- Aplicación gratuita con los dispositivos.
- Una sola interfaz para controlar y consultar los módulos adquiridos.
- Encendido y apagado, tiempos, actividades, umbrales y configuración de avisos a Telegram desde la aplicación.
- Consulta de historial, gráficos, fotografías y registros de alimentación.
- Exportación de datos para Excel.
- Transmisión de voz en vivo desde el celular hacia la cuna.

## 7. Notas técnicas y de la maqueta

- El equipo puede elegir el lenguaje, dispositivos de procesamiento, plataforma de nube y herramientas de desarrollo.
- Se han considerado herramientas de IA como Lovable, Antigravity o Claude, y Supabase para la nube. Son opciones, no requisitos impuestos por el cliente.
- Se usará un sitio web como aplicación.
- La sugerencia de guardar las actividades en una sola tabla no obliga a usar ese esquema.
- La documentación del producto comercial propone dimensiones, materiales y componentes adecuados al diseño.
- Para la entrega académica se permite una maqueta a escala con componentes económicos que demuestren las funciones solicitadas.
- La maqueta puede usar alimentación eléctrica aunque el producto comercial, como el juego, esté pensado para baterías.
- Si falta un sensor y se necesita sustituirlo, se coordina con el profesor antes de cambiarlo.
- Cada grupo desarrolla todos los módulos. El equipo decide el orden de los incrementos.
- Se pueden reutilizar componentes de una maqueta que ya haya sido evaluada para demostrar los módulos siguientes.
- Los horarios, temperaturas, porcentajes de pérdida de peso y cantidades de LED mencionados como ejemplos no quedan fijados como valores obligatorios. Los cinco botones del juego sí quedaron definidos en una aclaración posterior.
- Según la aclaración previa, sin electricidad o sin conexión a internet se detiene el funcionamiento del sistema, incluidos los módulos locales; no se exige UPS ni operación sin conexión. El comportamiento al recuperarse se propone en DEC-10.

## 8. Aclaraciones, propuestas y aprobación

### 8.1 Aclaraciones anteriores consolidadas (antecedentes)

- El peso del colchón es un valor numérico, no una fotografía. La tolerancia se expresa en porcentaje; hay detención desde la app y botón físico.
- No se registran movimientos derivados de la balanza del colchón ni se distingue entrada de salida en la habitación.
- Las fotos se consultan en la app; Telegram recibe una notificación por acción, sin adjuntar la foto. No se agrupan acciones distintas.
- El juego tiene cinco botones y avanza a otro objetivo aleatorio al presionar un botón, hasta apagarlo.
- Los dueños comparten una sola configuración. La sección «Bebés y dispositivos» incluye «Administrar dueños» y «Destinatarios de Telegram».
- Sin electricidad o internet el sistema deja de funcionar; la política de recuperación quedó posteriormente aprobada en DEC-10.

### 8.2 Respuestas nuevas de Alejandro (registro histórico del 9 de octubre)

La columna de asuntos abiertos refleja el levantamiento de esa fecha. Su resolución actual aparece en §8.3; no constituye una lista vigente de DEC pendientes.

| Tema | Respuesta incorporada | Lo que no quedó cerrado |
| --- | --- | --- |
| Unidad de alimentación | Gramos. | Precisión y rango de la balanza. |
| Pesaje | Al inicio y al final, colocando alimento o biberón en el dispositivo. | Cálculo, validaciones y tratamiento del recipiente. |
| Control de tomas | Finalización, pausa y corrección manual desde la aplicación. | Duración de pausas y reglas de corrección; cierre por devolución mencionado como posibilidad. |
| Recordatorios | Diarios y a cada hora programada. | Confirmar interpretación como lista de horas. |
| Gráficos | Histogramas o líneas. | Agregación horaria y selección de gráfico por variable. |
| Colchón | Restablecimiento manual desde la app; también menciona apagado por tiempo. | Separar apagado de sonido de rearme, duración y referencia. |
| Exportación | Excel, sin formato, mínimo fecha, hora y evento. Solo datos. | Extensión y columnas complementarias. |
| Criterio del equipo | El equipo puede proponer; Alejandro decidirá si aprueba. | Ninguna propuesta se considera aprobada por esta autorización. |

Fuente: respuestas de Alejandro aportadas por el equipo en la conversación del 9 de octubre de 2026; no se conoce la fecha original de envío de Alejandro.

### 8.3 Decisiones aprobadas

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

### 8.4 Backlog completo para Jira

El [backlog completo](Jira/BacklogCompleto.md) contiene épicas, historias y tareas de todo el proyecto, incluido el sprint 1. Los criterios DEC ya se incorporan como decisiones aprobadas. La selección y validación de componentes corresponde a arquitectura conforme a DEC-12. Estimaciones, responsables, distribución por puntos y cierre formal de entregas se registran cuando se realicen; no impiden preparar el backlog. No se ha realizado ninguna carga en Jira.
