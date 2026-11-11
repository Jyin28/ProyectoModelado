# Requerimientos recopilados del audio del 29 de septiembre

**Proyecto:** Sistema inteligente de cuido y entretenimiento para bebés.  
**Fuente:** `Material/Audio 29-09.mp4`.  
**Duración:** 01:06:04.  
**Fecha de revisión:** 7 de octubre de 2026.  
**Estado:** Recopilación de la grabación completa para revisión. Este archivo separa lo expresado en el audio de las aclaraciones de `Requerimientos chat.txt`.

La recopilación se basa en una transcripción automática en español y una revisión textual de sus resultados. Los intervalos permiten localizar las intervenciones en la grabación; las frases breves citadas son lecturas de esa transcripción. Las dudas se marcan como **[AMBIGUO]**, **[LECTURA DUDOSA]** o **[SIN DEFINIR]**. No se asignan nombres a voces cuya identidad no se pudo comprobar.

## 1 Contexto y alcance

- **A01 Uso familiar y comercial.** Los dispositivos se utilizarán para una bebé de la familia del cliente y se producirán para vender al público general. **Referencia:** 00:00:00 a 00:00:30.
- **A02 Productos independientes.** La cuna y el colchón inteligente deben poder venderse y utilizarse por separado. Una persona puede comprar el colchón para una cuna que ya posee. **Referencia:** 00:06:58 a 00:07:25; 00:19:21 a 00:20:26; 00:22:53 a 00:23:38.
- **A03 Cuna completa.** El equipo propone el diseño y material de una cuna de dimensiones estándar, incluyendo los componentes solicitados. Las dimensiones exactas no quedan fijadas. **Referencia:** 00:04:28 a 00:05:33; 00:11:24 a 00:11:45. **[SIN DEFINIR]** Medidas, material y especificaciones físicas finales.
- **A04 Alimentación de la cuna.** La cuna se alimenta desde un tomacorriente y no usa baterías. **Referencia:** 00:04:55 a 00:05:33.
- **A05 Orden de desarrollo.** El cliente no establece una prioridad entre los productos; el equipo decide el orden de los incrementos. **Referencia:** 00:20:27 a 00:21:04. La prioridad del backlog deberá presentarse como propuesta del equipo, sin eliminar productos del alcance.

## 2 Cuna inteligente

- **A06 Detección de movimiento.** La cuna tiene un sensor que detecta cualquier movimiento perceptible para ese sensor. **Referencia:** 00:00:41 a 00:01:48; 00:24:12 a 00:24:27. No se pide distinguir movimientos normales de movimientos peligrosos.
- **A07 Activación del movimiento por horario.** El usuario puede habilitar el sensor durante un rango de tiempo. El horario de 18:00 a 06:00 es un ejemplo, no un horario obligatorio. **Referencia:** 00:01:01 a 00:01:18; 00:06:03 a 00:06:29.
- **A08 Alertas de movimiento a varios destinatarios.** Un movimiento detectado durante el monitoreo genera un mensaje con su hora a los destinatarios configurados; menciona padre, madre y niñera. **Referencia:** 00:01:18 a 00:01:48. **[SIN DEFINIR]** Alta de destinatarios y tratamiento de detecciones muy seguidas.
- **A09 Temperatura y humedad dentro de la cuna.** Se instalan sensores de temperatura y humedad; el sensor ambiental debe medir el entorno de la cuna. **Referencia:** 00:01:49 a 00:02:18; 00:10:40 a 00:11:45; 00:24:28 a 00:24:50.
- **A10 Umbrales ambientales configurables.** El usuario establece límites inferiores y superiores para recibir alertas cuando la lectura quede fuera del rango. Se permiten valores iniciales que luego se puedan cambiar. **Referencia:** 00:10:40 a 00:11:21; 00:15:06 a 00:16:04; 00:24:28 a 00:24:50. **[SIN DEFINIR]** Valores iniciales, unidades, resolución y frecuencia de medición. Las temperaturas mencionadas son ejemplos.
- **A11 Lámpara regulable.** Desde la aplicación se enciende y apaga la lámpara y se regula su intensidad mediante un dimmer. **Referencia:** 00:01:49 a 00:02:18; 00:24:28 a 00:24:50.
- **A12 Reproducción de sonidos.** La cuna reproduce sonidos o canciones activados por el usuario. Se aceptan audios pregrabados. **Referencia:** 00:02:19 a 00:03:55; 00:24:28 a 00:24:50. **[SIN DEFINIR]** Catálogo, carga de archivos y controles adicionales de reproducción.
- **A13 Voz del adulto hacia el bebé.** El adulto habla desde el teléfono y el bebé escucha esa voz mediante el altavoz de la cuna. La comunicación es en un solo sentido; el adulto no escucha al bebé. **Referencia:** 00:03:55 a 00:05:33. La mención confusa a un “micrófono” se aclara mediante la negación explícita del audio de retorno.
- **A69 Voz en vivo sin guardar la grabación.** Ante la alternativa de grabar primero un mensaje y enviarlo después, el profesor responde “en vivo” y rechaza guardar el audio. **Referencia:** 00:51:38 a 00:51:53, recuperada en una segunda transcripción. Se registra la actividad, no el contenido grabado de la voz.

## 3 Colchón inteligente

- **A14 Sensor de peso.** El colchón incorpora una balanza o sensor de peso para identificar una disminución que pueda indicar que se retiró al bebé. **Referencia:** 00:06:58 a 00:09:20; 00:24:51 a 00:25:18.
- **A15 Monitoreo activado por un período.** El usuario activa la vigilancia del peso durante el tiempo que estime necesario. Las dos horas de siesta son un ejemplo. **Referencia:** 00:07:51 a 00:09:20; 00:14:05 a 00:14:32.
- **A16 Captura del peso de referencia.** Al activar el monitoreo se registra el peso que hay sobre el colchón. Incluye bebé y objetos apoyados en él. **Referencia:** 00:13:32 a 00:15:39. **[AMBIGUO D01]** “Tomar una foto” y “snapshot del peso” pueden significar guardar una lectura numérica; no permiten afirmar por sí solos que se exige una fotografía.
- **A17 Disminución significativa y tolerancia.** El monitoreo compara el peso con la referencia y contempla una tolerancia para que los movimientos del bebé no produzcan la alarma de ausencia. El profesor menciona caídas del 70 u 80 por ciento como ejemplos. **Referencia:** 00:14:05 a 00:14:32; 00:16:46 a 00:18:06. **[SIN DEFINIR D02]** Fórmula y tolerancia definitivas. No se fija 70 por ciento como requisito.
- **A18 Alarma sonora y Telegram por pérdida de peso.** Durante la vigilancia, una pérdida significativa genera una alerta al teléfono y una alarma sonora local. **Referencia:** 00:07:28 a 00:09:20; 00:24:51 a 00:25:39. **Aclaración dentro del audio:** la salida sonora pertenece al **colchón**, que debe disponer de un altavoz o dispositivo de ruido propio para funcionar sin la cuna.
- **A19 Registro de eventos del colchón.** Se guardan la activación, los cambios relevantes de peso, las alertas, la fecha y hora y los datos asociados. **Referencia:** 00:21:15 a 00:22:18.
- **A20 Alimentación independiente e integrada.** El colchón puede tener alimentación directa cuando se usa solo y conectarse a la cuna cuando se compra el conjunto, para evitar dos cables externos. **Referencia:** 00:22:18 a 00:22:38. **[SIN DEFINIR]** Conector y características eléctricas; corresponden al diseño de hardware.
- **A21 Límite de la detección por peso.** El profesor no exige identificar una sustitución deliberada del bebé por otro peso equivalente. Retirar juguetes puede causar una alerta porque modifica el peso total. **Referencia:** 00:14:59 a 00:16:34. Esto define una limitación del mecanismo, no una detección adicional.
- **A22 Movimiento del colchón frente a peso.** Al inicio se habla de registrar movimiento mediante el colchón; después se resume el colchón como “solo un sensor de peso”. **Referencia:** 00:06:30 a 00:07:25; 00:19:21 a 00:20:26; 00:24:51 a 00:25:18. **[AMBIGUO D03]** No queda cerrado si se necesitan eventos de movimiento derivados del peso. No se confirma un segundo sensor de movimiento obligatorio en el colchón.

## 4 Aplicación cuentas y datos

- **A23 Aplicación para controlar y consultar.** Una interfaz permite controlar dispositivos, consultar datos y gráficos y configurar el sistema. El cliente prefiere consultar desde una página web; el profesor permite distintas tecnologías. **Referencia:** 00:06:30 a 00:06:57; 00:12:36 a 00:13:30; 00:28:10 a 00:30:28.
- **A24 Controles manuales y de tiempo.** Los dispositivos permiten encendido y apagado manual desde la aplicación y la mayoría admite programación de tiempos. **Referencia:** 00:12:36 a 00:12:57. **[SIN DEFINIR]** Comportamiento temporal concreto de cada módulo; no se impone el mismo temporizador a todos.
- **A25 Aplicación gratuita.** La aplicación se ofrece gratuitamente junto con los dispositivos. **Referencia:** 00:12:59 a 00:13:30.
- **A26 Cuentas con correo y contraseña.** Se requiere registro e ingreso mediante correo y contraseña, con dispositivos asociados a la cuenta. **Referencia:** 00:18:26 a 00:19:15; 00:28:10 a 00:28:36.
- **A27 Acceso compartido.** Se plantean varios dueños del mismo dispositivo y, como alternativa, un usuario principal con subusuarios. **Referencia:** 00:18:26 a 00:19:15. **[AMBIGUO D04]** El audio no elige definitivamente uno de los dos modelos.
- **A28 Asociación por bebé.** Los registros y dispositivos se asocian a un bebé; para gemelos se emplean cunas y colchones separados. La misma cuna se puede reasignar a un nuevo bebé. **Referencia:** 00:08:49 a 00:09:54.
- **A29 Conservación del historial anterior.** Cada registro conserva el bebé al que pertenecía en ese momento, aunque se reasigne el dispositivo. Los registros no se eliminan. **Referencia:** 00:11:57 a 00:12:36.
- **A30 Almacenamiento en la nube.** La información se guarda en la nube; el teléfono consulta la información. **Referencia:** 00:05:34 a 00:06:57. **[SIN DEFINIR]** Frecuencia de envío, almacenamiento local y comportamiento cuando no hay conexión.
- **A31 Bitácora de actividad.** Se registra la actividad de los dispositivos, incluidos eventos y activaciones, con fecha y hora y datos del evento. **Referencia:** 00:02:50 a 00:03:55; 00:12:59 a 00:13:30; 00:21:15 a 00:22:18. Registrar reproducción o activaciones no implica grabar los sonidos del bebé.
- **A32 Gráficos y actividad por horas.** Se grafican los sensores y se permite ver cuántos movimientos hubo y los rangos horarios de mayor actividad. **Referencia:** 00:02:50 a 00:03:55; 00:10:40 a 00:10:52; 00:24:12 a 00:24:27; 00:29:28 a 00:29:53. **[SIN DEFINIR]** Agrupación temporal y presentación de sensores que producen eventos, como una puerta.
- **A33 Exportación a Excel.** Los datos se pueden descargar para Excel. **Referencia:** 00:11:57 a 00:12:36. **[SIN DEFINIR]** Formato exacto y si se exportan también imágenes.

## 5 Notificaciones y límites

- **A34 Alertas al teléfono sin abrir la aplicación.** El adulto recibe las alertas aunque no esté conectado a la interfaz de consulta. Telegram es la opción preferida; como profesor permite alternativas que cumplan esa función. **Referencia:** 00:25:58 a 00:30:28.
- **A35 Consulta del resumen desde la web.** Frente a una propuesta de mandar automáticamente el resumen nocturno, el cliente prefiere entrar a la web y consultarlo. **Referencia:** 00:06:03 a 00:06:57. No se confirma un reporte nocturno automático por Telegram.
- **A36 Llamadas de emergencia fuera del alcance.** Se descarta llamar automáticamente al 911. **Referencia:** 00:27:38 a 00:27:53.
- **A37 Interrupción del sistema.** La respuesta “no funciona nada” y “no alerta ni nada” describe una condición de interrupción. **Referencia:** 00:16:05 a 00:16:34. **[LECTURA DUDOSA D05]** No se recupera con claridad la pregunta anterior, por lo que el audio por sí solo no permite atribuir la respuesta simultáneamente a electricidad e internet.

- **A38 Libertad tecnológica.** Python, una aplicación web, plataformas de nube y herramientas de generación de código se comentan como alternativas. El profesor deja libres el dispositivo de procesamiento y las tecnologías. **Referencia:** 00:30:29 a 00:32:37; 00:33:06 a 00:35:03. Los nombres de varias herramientas se reconocen de forma imperfecta, pero no se imponen como requisitos.
- **A39 Consulta de datos recientes.** Después de registrar un evento en la nube, el usuario debe poder verlo en la aplicación y recibir su notificación. **Referencia:** 00:33:33 a 00:34:39. **[SIN DEFINIR]** Latencia numérica de registro, consulta y envío.
- **A40 Demostración a escala.** Para el curso se admite una maqueta para un muñeco y componentes económicos de demostración, separando ese prototipo del diseño comercial. La entrega puede alimentar eléctricamente los módulos aunque el diseño de algún producto use baterías. **Referencia:** 00:35:12 a 00:36:27; 00:42:43 a 00:43:26; 00:44:44 a 00:44:50.
- **A63 Campos del registro de actividad.** La bitácora incluye fecha, hora, tipo de actividad y descripción. El ejemplo de guardar todo en una tabla es una sugerencia de diseño, no una estructura obligatoria de base de datos. **Referencia:** 00:52:26 a 00:52:55.
- **A64 Alcance completo para cada equipo.** Cada grupo desarrolla todos los módulos y sus historias; no se reparten los productos entre grupos diferentes. **Referencia:** 00:50:48 a 00:51:31; 00:52:57 a 00:53:27.
- **A65 Componentes comerciales frente a maqueta.** La documentación propone los componentes del producto comercial y la maqueta puede usar botones, LED y salidas sonoras económicos para demostrar las mismas funciones. Si falta un sensor, el profesor pide avisar y coordinar su sustitución antes de cambiarlo. **Referencia:** 00:53:32 a 00:56:49. No se agrega un sensor de humo al alcance por la broma o ejemplo de sustitución.
- **A66 Detección de llanto descartada.** Ante una pregunta sobre registrar si el bebé lloró, analizar video o usar micrófono, el profesor limita la implementación a los sensores ya solicitados por el costo del proyecto académico. **Referencia:** 00:09:54 a 00:10:34, recuperada en una segunda transcripción del pasaje. La bitácora de sonidos no exige capturar llanto.
- **A67 Reutilización entre incrementos.** Se permite desmontar una maqueta ya evaluada y reutilizar sus componentes para demostrar los otros módulos en el incremento siguiente. La demostración de peso puede usar una bolsa de arroz o frijoles en lugar de un bebé. **Referencia:** 01:00:04 a 01:03:19. Los 200 gramos y el 70 por ciento de ese ejemplo no fijan la configuración comercial.
- **A68 Comentarios sobre el calendario.** En los últimos minutos se comentan cuatro etapas de dos semanas y la posibilidad de negociar una extensión. No se acuerda una extensión concreta para este equipo. **Referencia:** 00:59:06 a 01:01:24; 01:04:40 a 01:05:08. Las fechas oficiales deben tomarse del documento de instrucciones entregado después.

## 6 Figuras LED para entretenimiento

- **A41 Producto de luces separado.** Se colocan figuritas con LED encima de la cuna; se registran y configuran como otro dispositivo adquirido. **Referencia:** 00:35:54 a 00:37:24.
- **A42 Velocidad de cambio de luces.** El usuario configura cuántos segundos transcurren entre cambios de las luces. Uno o dos segundos son ejemplos, no límites establecidos. **Referencia:** 00:37:24 a 00:37:45.
- **A43 Encendido programado y manual.** El usuario configura una hora de encendido y apagado, y también puede encender y apagar las luces cuando quiera desde la aplicación. No se exige un apagado automático del modo manual por un tiempo máximo fijo. **Referencia:** 00:37:24 a 00:38:14.
- **A44 Independencia y ausencia de dimmer.** El juego de LED es independiente de la lámpara de la cuna y del colchón. No se confirma que se apague automáticamente cuando el bebé deja el colchón. El profesor aclara que los LED no tienen control de intensidad. **Referencia:** 00:38:18 a 00:39:45.
- **A45 Luces suaves.** Las luces no deben resultar “muy violentas”. **Referencia:** 00:36:32 a 00:36:50. **[SIN DEFINIR D06]** Intensidad, frecuencia, transiciones y límites comprobables. La expresión no proporciona una especificación médica o eléctrica.

## 7 Kit de habitación

- **A46 Apertura de puerta.** El kit incorpora un sensor de apertura de puerta. **Referencia:** 00:38:56 a 00:39:45.
- **A58 Foto por apertura de puerta.** Abrir la puerta durante el monitoreo dispara también una foto. El sensor de puerta tiene activación manual, desactivación y un rango de tiempo programable. **Referencia:** 00:48:40 a 00:49:31. La pregunta que propone dejarlo siempre activo se responde con la aclaración del temporizador.
- **A47 Movimiento y fotografías.** Un sensor de movimiento en la habitación dispara una fotografía al detectar movimiento. **Referencia:** 00:38:56 a 00:40:30.
- **A48 Registro de eventos de habitación.** Se registra el movimiento y se menciona “cuando entra y cuando sale”. **Referencia:** 00:39:51 a 00:40:30. **[AMBIGUO D07]** No queda definido si se debe distinguir el sentido de entrada y salida de personas o solamente registrar cambios de puerta y movimiento.
- **A49 Alertas silenciosas del kit.** Los eventos generan avisos al teléfono, sin alarma sonora local en la habitación. **Referencia:** 00:39:51 a 00:40:30. **[AMBIGUO D08]** El audio no distingue inequívocamente entre silencio del dispositivo y silencio de la notificación de Telegram.
- **A59 Fotografías en la nube.** Las fotos se suben a la base de datos y se pueden consultar. Se permite usar un teléfono como cámara de demostración; no se impone resolución mínima. No se graba video. **Referencia:** 00:49:01 a 00:50:06. **[SIN DEFINIR]** Cuántas fotos genera un mismo evento y si se adjuntan también al aviso de Telegram.
- **A60 La cuna no incluye cámara.** El profesor recapitula los componentes y aclara que la cuna no tiene cámara; la cámara pertenece al kit de habitación. **Referencia:** 00:50:10 a 00:50:46.

## 8 Juego interactivo

- **A50 Botón iluminado como objetivo.** El juego elige aleatoriamente un botón y lo ilumina; el bebé obtiene una recompensa sonora al presionarlo. **Referencia:** 00:40:32 a 00:42:06. Los cinco botones mencionados son un ejemplo.
- **A51 Acierto y error.** El botón iluminado produce la recompensa; los demás botones no la producen. Se acepta un único sonido predeterminado y no se piden texturas diferenciadas. **Referencia:** 00:42:07 a 00:42:37. **[SIN DEFINIR]** Cuándo se inicia el siguiente turno y cómo se cambia de objetivo.
- **A52 Botones grandes.** En la propuesta comercial los botones son grandes y se busca que el bebé no pueda tragarlos. **Referencia:** 00:42:43 a 00:43:26. **[SIN DEFINIR]** Dimensiones y piezas seleccionadas; la maqueta puede usar componentes más sencillos.
- **A53 Baterías del juego.** El diseño del producto usa baterías. El prototipo académico puede conectarse a electricidad. **Referencia:** 00:43:27 a 00:44:50. Esta distinción resuelve las menciones iniciales a alimentación eléctrica.

## 9 Alimentación

- **A54 Inicio y temporizador.** Un botón en la aplicación registra el inicio de la alimentación y pone en marcha un temporizador para medir el tiempo desde que comienza la toma. **Referencia:** 00:45:29 a 00:45:51. **[SIN DEFINIR]** Cómo se cierra, pausa o corrige la toma.
- **A55 Cantidad ingresada por el adulto.** El adulto registra la cantidad ingerida; se mencionan gramos o mililitros. **Referencia:** 00:45:52 a 00:46:21. No se pide un sensor que mida automáticamente el consumo. **[SIN DEFINIR D09]** Unidad o unidades definitivas y si la cantidad se registra al inicio o al finalizar.
- **A56 Recordatorio de próxima alimentación.** El usuario puede programar el recordatorio de la siguiente alimentación y recibirlo por Telegram. **Referencia:** 00:45:52 a 00:46:21.
- **A57 Temperatura del biberón.** Un dispositivo físico mide la temperatura del biberón y genera alerta si está demasiado caliente o frío. **Referencia:** 00:45:52 a 00:46:51; 00:47:38 a 00:48:32. No se exige una técnica concreta de medición ni calentar o enfriar automáticamente.
- **A61 Recordatorios recurrentes por horario.** Se pueden programar horas de alimentación; el ejemplo menciona mañana, mediodía y tarde como horarios de aviso recurrentes. **Referencia:** 00:46:22 a 00:46:51. **[LECTURA DUDOSA D10]** La expresión reconocida como “por roles” y la periodicidad no se recuperan con precisión; no se crean roles de usuario a partir de ella.
- **A62 Alimentación con intervención humana.** El adulto alimenta al bebé y registra la toma; el sistema no entrega alimento automáticamente. El módulo reúne temperatura del biberón y funciones de temporizador y registro en la aplicación. **Referencia:** 00:46:57 a 00:48:32.

## 10 Dudas detectadas

| Código | Minuto o intervalo | Parte que requiere revisión | Pregunta concreta |
|---|---|---|---|
| D01 | 00:15:06 a 00:15:39 | “Foto” y “snapshot del peso” | ¿Se necesita una fotografía real o solamente guardar el peso inicial? |
| D02 | 00:16:46 a 00:18:06 | “Cambio muy fuerte” y porcentajes de ejemplo | ¿Cómo se configura y calcula la tolerancia para la alarma? |
| D03 | 00:06:30 a 00:07:25; 00:24:51 a 00:25:18 | Movimiento del colchón y resumen posterior centrado en peso | ¿Se necesitan eventos de movimiento derivados de la balanza, además de la pérdida de peso? |
| D04 | 00:18:26 a 00:19:15 | Dos modelos de usuarios | ¿Dueños compartidos o cuenta principal con subusuarios? |
| D05 | 00:16:05 a 00:16:34 | Respuesta sobre apagado con pregunta no recuperada claramente | ¿Se refiere a electricidad, internet o ambos, y a qué módulos afecta? |
| D06 | 00:36:32 a 00:36:50 | Luces “no muy violentas” | ¿Qué valores concretos de brillo y cambios de luz se aceptan? |
| D07 | 00:39:51 a 00:40:30 | “Cuando entra y cuando sale” | ¿Se necesita clasificar la dirección de personas o registrar eventos de sensores? |
| D08 | 00:39:51 a 00:40:30 | Alertas silenciosas | ¿El silencio aplica también al mensaje de Telegram o únicamente al dispositivo físico? |
| D09 | 00:45:52 a 00:46:21 | “Gramos” o “mililitros” | ¿Qué unidades y momento de captura tendrá el registro de alimentación? |
| D10 | 00:46:22 a 00:46:51 | Periodicidad de recordatorios y frase reconocida como “por roles” | ¿La programación es diaria, por días de semana o por otro intervalo? |

## 11 Expresiones coloquiales normalizadas

- **“Carajillo” o “chiquillo”:** bebé. No define edad o peso de uso.
- **“Se voló la cuna” o “se lo llevaron”:** ausencia o disminución significativa de peso; el sensor no identifica la causa.
- **“La vara de peso”:** monitoreo de peso activado por el usuario.
- **“Tirar una alerta” o “un mensajito”:** enviar una notificación.
- **“Ya cállate” o “que se duerma”:** propósito de los sonidos; no se convierte en garantía de que el bebé deje de llorar o se duerma.
- **“Foto del peso” o “snapshot”:** conserva la marca D01; no se traduce automáticamente a una imagen de cámara.
- **“Velocidad” de los LED:** intervalo en segundos entre cambios de luces; no significa un motor ni rotación de las figuras.
- **“Premio” del juego:** sonido de recompensa por pulsar el botón iluminado, no alimento u otro objeto.

## 12 Pasajes con lectura automática dudosa

- **00:00:00 a 00:00:30:** parte de la conversación familiar y una pregunta sobre el público objetivo se reconoce con palabras extrañas. La respuesta “público general” sí aparece; no se extraen restricciones de sexo o edad de la broma.
- **00:03:55 a 00:04:22:** aparecen “micrófono” y “speaker” de forma confusa. La aclaración de 00:04:55 a 00:05:33 resuelve la dirección del audio.
- **00:06:03 a 00:06:29:** la pregunta sobre programación y reporte nocturno presenta errores de reconocimiento. La respuesta siguiente confirma consulta en web y descarta el reporte nocturno como requisito cerrado.
- **00:09:54 a 00:10:34:** la primera transcripción omitió la pregunta sobre llanto, micrófono y video. La segunda lectura recupera la discusión y su exclusión, recogida en A66. Algunas palabras finales siguen poco claras; no se inventa un monto de presupuesto.
- **00:15:40 a 00:16:04:** el nombre de la herramienta y el rango térmico sugerido no se reconocen con precisión. No se incorporan nombres o temperaturas dudosas como requisitos.
- **00:16:05 a 00:16:34:** falta la condición exacta de la pregunta sobre interrupción; queda vinculada a D05.
- **00:26:58 a 00:27:23:** varias palabras de una respuesta y la pregunta anterior no se reconocen con suficiente claridad. La exclusión de llamadas al 911 se apoya en la intervención explícita posterior.
- **00:31:15 a 00:32:37; 00:33:06 a 00:35:03:** los nombres de herramientas y plataformas se transcriben con variantes extrañas. La libertad de elección sí queda explícita; no se exige una marca a partir de esas palabras.
- **00:35:12 a 00:35:51:** la pregunta sobre pérdida de conectividad no se recupera completa. La referencia a la fibra óptica indica ausencia de registro sin conexión, pero no cierra el comportamiento de la alarma local.
- **00:43:27 a 00:44:13:** hay frases interrumpidas sobre alimentación del juego. La declaración de 00:44:38 a 00:44:50 resuelve baterías para el producto y electricidad permitida para la maqueta.
- **00:46:22 a 00:46:51:** la parte que describe la periodicidad de alimentación se reconoce de forma imperfecta; queda vinculada a D10.
- **00:47:38 a 00:48:32:** se plantean formas de medir la temperatura, pero algunas palabras y líquidos de ejemplo son dudosos. Se conserva solamente la función de medir y avisar; no se elige una técnica o un líquido específico.
- **00:51:31 a 00:52:26:** la primera transcripción omitió las preguntas de los estudiantes. La segunda recupera voz en vivo y rechazo de guardar la grabación, incorporados en A69. Parte de la pregunta siguiente sobre registro de actividad sigue poco clara; la respuesta y los campos de 00:52:26 a 00:52:55 sí se recogen en A63.
- **01:03:38 a 01:04:11:** algunas palabras de los ejemplos de conexión para la demostración no se reconocen bien. La idea recuperable es usar la computadora y conectividad disponible, incluido internet del teléfono; no se impone un protocolo o cable específico.

## 13 Cobertura de revisión

Se procesó la grabación completa y se revisaron los 131 segmentos de la transcripción principal. Se volvieron a transcribir seis intervalos para recuperar preguntas o expresiones poco claras: 00:09:54 a 00:10:40, 00:13:55 a 00:16:46, 00:26:50 a 00:27:38, 00:34:55 a 00:35:54, 00:46:18 a 00:47:00 y 00:51:31 a 00:52:31.

La recopilación contiene 69 entradas, incluidas restricciones, exclusiones y condiciones de demostración académica. Las partes finales sobre calendario, reutilización de componentes y despedida se revisaron sin agregar nuevas funciones al producto. La comparación con el TXT y las preguntas de cierre están en `RequerimientosFinal.md`.
