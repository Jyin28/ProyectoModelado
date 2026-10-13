# Decisiones aprobadas para el backlog

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

## Qué se cerró y qué se ejecuta después

Las 13 decisiones ya no bloquean la redacción de las historias. DEC-07, DEC-08 y DEC-12 autorizan reglas y trabajo de diseño: HU-42 concreta componentes, rangos, precisión, brillo, volumen y dimensiones con evidencia; HU-40 define protocolos y recuperación de horarios. No se dan por fabricados ni probados. RNF-08 y la aprobación integral de versión se registran en HU-38; las sesiones reales del Sprint 1, en HU-39.
