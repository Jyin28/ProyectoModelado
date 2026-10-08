# Proyecto: Sistema inteligente de cuido y entretenimiento para bebés

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
- Luces suaves, sin cambios violentos. Los límites concretos están pendientes.
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
- Una disminución significativa durante el monitoreo activo genera una alarma sonora local y una alerta por Telegram.
- La alarma sonora está en el **colchón**, con un altavoz o dispositivo de ruido propio. 
- Se registran la activación, los eventos de peso y las alertas con fecha y hora.
- Puede alimentarse directamente cuando se utiliza solo y conectarse a la alimentación de la cuna cuando se compra el conjunto, para evitar dos cables externos.
- Retirar objetos del colchón también puede generar una alerta, porque cambia el peso total.
- No se exige detectar que alguien sustituya deliberadamente al bebé por un objeto de peso equivalente.
- Se registra un valor numerico del peso, no es una foto real.
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
- Temporizador para medir el tiempo desde que empieza la alimentación.*
- El adulto ingresa manualmente la cantidad ingerida; no se pide un sensor que mida automáticamente el consumo.
- Se usarán gramos para medir la cantidad de alimento.
- Recordatorio de la siguiente alimentación y programación de horarios recurrentes.
- Los recordatorios llegan por Telegram.
- Sensor de temperatura del biberón, con aviso si está muy frío o muy caliente según los límites configurados.
- La forma concreta de medir esa temperatura queda a elección del diseño.
- La alimentación requiere intervención del adulto. No se pide que el dispositivo suministre comida, caliente o enfríe automáticamente.
- La aplicacion web finaliza, pausa, corrige/modifica las tomas, y ajusta la periodicidad de los recordatorios y registra la duración final.

## 3. Alertas

- Todas las alertas y recordatorios se envían a Telegram.
- Un dispositivo puede tener varios destinatarios: padre, madre, niñera u otras personas configuradas.
- Los avisos deben llegar al teléfono aunque el usuario no tenga abierto el sitio web.
- Las alertas habituales son silenciosas. La pérdida significativa de peso durante el monitoreo del colchón es la única que produce una alarma sonora local.
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
- Se puede consultar cuántos movimientos hubo y los rangos de horas en que el bebé fue más activo.
- Los datos se pueden exportar a un archivo compatible con Excel.
- Los registros nunca se borran.
- Los datos recientes deben poder consultarse después de guardarse en la nube.
- El resumen de la noche se consulta desde la aplicación; no se pidió enviarlo automáticamente por Telegram.
- **Pendiente:** frecuencia de medición y registro, agrupación de los gráficos, formato de exportación.

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
- una sección «Bebés y dispositivos» en la web, con dos opciones por dispositivo: «Administrar dueños» y «Destinatarios de Telegram» permite administrar los dispositivos.

## 6. Aplicación

- Sitio web.
- Supabase como base de batos/ backend.
- Aplicación gratuita con los dispositivos.
- Una sola interfaz para controlar y consultar los módulos adquiridos.
- Encendido y apagado, tiempos, actividades, umbrales y configuración de avisos a Telegram desde la aplicación.
- Consulta de historial, gráficos, fotografías y registros de alimentación.
- Exportación de datos para Excel.
- Transmisión de voz en vivo desde el celular hacia la cuna.

## 7. Notas técnicas y de la maqueta

- El equipo puede elegir el lenguaje, dispositivos de procesamiento, plataforma de nube y herramientas de desarrollo.
- Se han considerado herramientas de IA como Lovable, Antigravity o Claude, y Supabase para la nube. Son opciones, no requisitos impuestos por el cliente.
- Se usara un sitio web como aplicacion.
- La sugerencia de guardar las actividades en una sola tabla no obliga a usar ese esquema.
- La documentación del producto comercial propone dimensiones, materiales y componentes adecuados al diseño.
- Para la entrega académica se permite una maqueta a escala con componentes económicos que demuestren las funciones solicitadas.
- La maqueta puede usar alimentación eléctrica aunque el producto comercial, como el juego, esté pensado para baterías.
- Si falta un sensor y se necesita sustituirlo, se coordina con el profesor antes de cambiarlo.
- Cada grupo desarrolla todos los módulos. El equipo decide el orden de los incrementos.
- Se pueden reutilizar componentes de una maqueta que ya haya sido evaluada para demostrar los módulos siguientes.
- Los horarios, temperaturas, porcentajes de pérdida de peso y cantidades de botones o LED mencionados como ejemplos no quedan fijados como valores obligatorios.

## 8. Aclaraciones y dudas pendientes

### 8.1 Respuestas ya recopiladas en el TXT

1. **Corte de electricidad o internet:** no se pide UPS ni respaldo. La respuesta escrita es: “NO, se apaga el sistema”. Queda pendiente precisar el comportamiento local cuando se pierde solo internet.
2. **Interfaz:** sitio web.
3. **Activación de movimiento en cuna y habitación:** manual y por horario.
4. **Modelo de cuentas:** dueños compartidos, con una configuración común.
5. **Botón correcto del juego:** el que tiene el color iluminado. El audio añade selección aleatoria del botón objetivo.
6. **Sonidos en el historial:** no se detectan sonidos del bebé.

### 8.2 Dudas de interpretación que siguen abiertas

1. **Foto del peso:** ¿se necesita una fotografía real o basta guardar el peso inicial? El TXT y el uso de “snapshot” en el audio admiten interpretaciones distintas. Referencia: 00:15:06 a 00:15:39. R/ Se registra el valor del peso, no una foto literal.
2. **Alarma de peso:** ¿la tolerancia será una diferencia de peso o un porcentaje respecto al inicial? ¿Cómo se evitan alarmas por movimiento y cómo se detiene o restablece la alarma? Referencia: 00:16:46 a 00:18:06. R/ La tolerancia es por porcentajes, se detiene por la app y hay un boton fisico para la alarma.
3. **Movimiento en el colchón:** ¿solo se vigila pérdida de peso o también se registran movimientos derivados de la balanza? Referencias: 00:06:30 a 00:07:25 y 00:24:51 a 00:25:18. R/ No se registran los movimientos derivados.
4. **Pérdida de internet:** ¿se detienen también los módulos locales o solo nube y Telegram? ¿Sigue funcionando la alarma sonora del colchón? ¿Qué ocurre con datos pendientes y con el reinicio? La respuesta del TXT agrupa electricidad e internet; la pregunta del audio no se recupera con claridad. R/ Si se pierde la coneccion se mueren todos los sistemas, incluidos los servicios de nube de telegram.
5. **Entrada y salida de la habitación:** ¿hay que distinguir la dirección de las personas o basta registrar apertura de puerta y movimiento? Referencia: 00:39:51 a 00:40:30. R/ No se hace distinción.
6. **Avisos silenciosos:** ¿el silencio incluye la notificación de Telegram en el teléfono o únicamente las alarmas de los dispositivos? Referencia: 00:39:51 a 00:40:30. R/ Las notificaciones no necesitan ser silenciosas.
7. **Alimentación:** ¿se registra cantidad en gramos, mililitros o ambos? ¿Al inicio o al final? ¿Los horarios se repiten diariamente, por días de semana o de otra forma? La frase sobre periodicidad no se entiende con precisión. Referencias: 00:45:52 a 00:46:51.
8. **Fotografías:** ¿también se envían por Telegram o solo se consultan desde la aplicación? ¿Cómo se tratan los disparos simultáneos de puerta y movimiento? R/ No se envian las fotos, una notificacion por accion.

### 8.3 Detalles que todavía no quedaron definidos

- Valores iniciales, unidades, tolerancias y frecuencia de lectura de los sensores. R/ Recomendaciones de ChatGPT
- Límites concretos de brillo y cambios de luces para las figuras LED. R/ Recomendaciones de ChatGPT
- Catálogo de audios, carga de archivos y controles de reproducción. R/ Dadas por el usuario o predeterminadas por definir
- Cantidad de botones y avance entre turnos del juego. R/ Son 5 botones, al presionar un boton se enciende otro aleatoriamente, continua infinitamente hasta que se apague el juguete.
- Cierre, pausa y corrección de las tomas de alimentación.*
- Forma de invitar y retirar dueños y de vincular destinatarios de Telegram. R/ Una sección «Bebés y dispositivos» en la web, con dos opciones por dispositivo: «Administrar dueños» y «Destinatarios de Telegram» permite administrar los dispositivos.
- Datos del perfil del bebé y aplicación de la regla de una cuna por bebé cuando solo se compra un accesorio. R/ Se pueden asignar dispositivos.
- Repetición o agrupación de alertas, intervalo entre fotografías y tiempos de respuesta. R/ No se agrupa ninguna notificacion, una foto pór instancia, el menor tiempo de respuesta posible.
- Presentación de gráficos y agrupación por horas.*
- Formato de exportación para Excel e inclusión de fotografías o enlaces. R/ Para la base de datos de usara supabase