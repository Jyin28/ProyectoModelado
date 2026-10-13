# Backlog completo del proyecto para Jira

Versión 1.0 — 10 de octubre de 2026. **11 épicas, 47 historias y 141 tareas.** Incluye todo el alcance documentado y el trabajo del sprint 1. HU-01 a HU-29 conservan los códigos originales; HU-30 a HU-47 completan requerimientos, arquitectura, calidad y entregas.

## Estado y uso

Aprobación de DEC-01 a DEC-13: confirmada por el usuario el 10 de octubre de 2026 mediante «ya las aprobo», en respuesta a la consulta sobre las 13 decisiones de Alejandro. Se registra como confirmación del equipo; no se conoce la fecha original de aprobación ni se dispone de un mensaje directo de Alejandro. Esta confirmación no acredita por sí sola la aprobación integral de la especificación, RNF-08, reuniones, retrospectivas o pruebas ejecutadas.

Esta es la lista integral preparada para cargar. No hay cambios realizados en Jira. «Realizada documentalmente» describe trabajo con archivos verificables, no aprobación total del sprint ni software implementado. Los demás estados se basan en la evidencia disponible. No se inventan responsables, puntos ni fechas efectivas.

Cada bloque de historia contiene descripción, épica, dependencias, criterios y tres tareas con resultado verificable. El equipo asigna estimaciones y responsables al planificar. Las dependencias de integración indican qué debe estar disponible para aceptar una historia, no obligan a trabajar en serie. HU-40/HU-41 habilitan la implementación; HU-42 habilita las historias de hardware. Se puede desarrollar con contratos o simulaciones, pero la aceptación de hardware necesita la maqueta.

Las tareas se presentan como trabajo hijo de cada historia. Si la configuración de Jira usa «Sub-task» para hijos de una Story, utilizar ese tipo; los códigos T permiten mantener la relación si el proyecto necesita otro esquema. No se incluyen claves reales de Jira ni se presupone una configuración del proyecto.

## Épicas e índice de historias

| Épica | Objetivo | Historias |
| --- | --- | --- |
| EP-01 — Requerimientos y Sprint 1 | Consolidar las necesidades, especificación, aceptación y evidencias del primer sprint. | HU-30, HU-31, HU-32, HU-33, HU-34, HU-35, HU-36, HU-37, HU-38, HU-39 |
| EP-02 — Arquitectura y preparación técnica | Definir una solución construible y reproducible para los seis módulos. | HU-40, HU-41, HU-42 |
| EP-03 — Cuentas, bebés y dispositivos | Gestionar acceso, asociaciones y propiedad compartida sin perder historial. | HU-01, HU-02, HU-03, HU-04, HU-05 |
| EP-04 — Notificaciones por Telegram | Vincular destinatarios y entregar un aviso por instancia de evento. | HU-06, HU-07 |
| EP-05 — Cuna inteligente | Monitorear ambiente y movimiento, controlar luz/audio y transmitir voz. | HU-08, HU-09, HU-10, HU-11, HU-12 |
| EP-06 — Figuras LED y juego interactivo | Ofrecer luces programables y juego de cinco botones con recompensa. | HU-13, HU-19 |
| EP-07 — Colchón independiente | Vigilar pérdida de peso, emitir alarma y rearmar explícitamente. | HU-14, HU-15, HU-16 |
| EP-08 — Habitación y fotografías | Detectar actividad y consultar una fotografía por acción. | HU-17, HU-18 |
| EP-09 — Alimentación | Registrar pesajes y tomas, recordar horarios y medir temperatura. | HU-20, HU-21, HU-22, HU-23 |
| EP-10 — Historial, gráficos y exportación | Conservar y consultar datos por bebé y exportarlos a Excel. | HU-24, HU-25, HU-26, HU-27 |
| EP-11 — Calidad, integración y entregas | Verificar seguridad, recuperación, experiencia, rendimiento y entregas académicas. | HU-28, HU-29, HU-43, HU-44, HU-45, HU-46, HU-47 |

## Orden de trabajo y entregas

1. Registrar el trabajo ya realizado del sprint 1 (EP-01) y completar sus pendientes reales.
2. Definir arquitectura y entorno (EP-02); después acceso, asociaciones, persistencia y notificaciones.
3. Implementar todos los módulos según dependencias y reparto acordado; ejecutar calidad junto con cada incremento.
4. Completar integración, entregas y retrospectiva (EP-11).

Fechas del curso conservadas en la especificación: requerimientos 15/10/2026, arquitectura 29/10/2026, incrementos 12/11/2026 y 26/11/2026, retrospectiva 26/11/2026. No se asignan sprints de desarrollo automáticamente. El primer incremento debe representar 40–60% de los puntos de los dos incrementos de implementación; las historias documentales de Sprint 1 no se usan para inflar ese porcentaje.

## EP-01. Requerimientos y Sprint 1

Consolidar las necesidades, especificación, aceptación y evidencias del primer sprint.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-30. Recopilar fuentes y respuestas

Como equipo, quiero conservar los antecedentes del cliente, para trazar el origen de los requisitos.

- **Épica:** EP-01.
- **Origen:** S1-01; RequerimientosAudio.md; Material/RespuestasAlejandro-2026-10-09.md.
- **Estado documentado:** Realizada documentalmente.
- **Evidencia actual:** Archivos de fuentes y respuestas conservados; no implica nueva escucha del audio.
- **Dependencias:** Ninguna.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-30.1:** El audio, resumen y respuestas R-01 a R-09 están identificados y accesibles.
- **CA-30.2:** Las respuestas posteriores se distinguen de las interpretaciones iniciales.

**Tareas de la historia**

- **T-30.1 — Inventariar fuentes y fechas disponibles.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-30.2 — Conservar respuestas R-01 a R-09 sin alterar su redacción.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-30.3 — Enlazar fuentes con el consolidado.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-31. Documentar el levantamiento

Como equipo, quiero contar con una minuta verificable, para conservar alcance y acuerdos de la sesión.

- **Épica:** EP-01.
- **Origen:** S1-02; Sprint1/MinutaLevantamiento.md.
- **Estado documentado:** En curso.
- **Evidencia actual:** Minuta reconstruida preparada; validación de datos históricos pendiente.
- **Dependencias:** HU-30.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-31.1:** La minuta identifica objetivo, temas, fuentes y aclaraciones posteriores.
- **CA-31.2:** Asistentes, modalidad y datos faltantes se completan con evidencia del equipo.
- **CA-31.3:** Una minuta reconstruida no se presenta como acta firmada.

**Tareas de la historia**

- **T-31.1 — Reconstruir temas y acuerdos desde las fuentes.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-31.2 — Validar asistentes, modalidad y datos históricos faltantes.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-31.3 — Incorporar evidencia y emitir minuta validada.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-32. Consolidar alcance y exclusiones

Como cliente, quiero tener documentados los seis módulos y sus límites, para verificar qué incluye el proyecto.

- **Épica:** EP-01.
- **Origen:** S1-03; RequerimientosFinal.md.
- **Estado documentado:** Realizada documentalmente.
- **Evidencia actual:** RequerimientosFinal.md actualizado; cierre integral se gestiona en HU-38.
- **Dependencias:** HU-30.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-32.1:** Se incluyen cuna, figuras LED, colchón, habitación, juego y alimentación con pesaje.
- **CA-32.2:** Se documentan independencia, alimentación y restricciones de cámara, audio y operación sin conexión.

**Tareas de la historia**

- **T-32.1 — Consolidar funciones de los seis módulos.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-32.2 — Documentar exclusiones y restricciones de la maqueta.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-32.3 — Incorporar respuestas y vincular DEC aprobadas.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-33. Especificar requisitos verificables

Como equipo, quiero documentar RF, RNF, interfaces y datos, para diseñar y verificar el sistema con una referencia común.

- **Épica:** EP-01.
- **Origen:** S1-04; EspecificacionRequerimientos.md.
- **Estado documentado:** Realizada documentalmente.
- **Evidencia actual:** EspecificacionRequerimientos.md v0.4 preparada; aceptación integral separada en HU-38.
- **Dependencias:** HU-32.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-33.1:** La especificación incluye RF-01 a RF-29, RNF-01 a RNF-08, INT-01 a INT-06, RD-01 a RD-03 y DAT-01 a DAT-04.
- **CA-33.2:** Cada RF tiene origen, historia y criterios identificados.
- **CA-33.3:** La versión identifica decisiones aprobadas y propuestas adicionales.

**Tareas de la historia**

- **T-33.1 — Redactar funciones, interfaces, datos y atributos.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-33.2 — Incorporar criterios y trazabilidad por requisito.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-33.3 — Versionar el documento con aprobación de DEC informada.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-34. Organizar backlog integral y prioridad

Como equipo, quiero tener épicas, historias y tareas del proyecto completo, para planificar y cargar Jira sin omitir el sprint 1.

- **Épica:** EP-01.
- **Origen:** S1-05; Jira/BacklogCompleto.md.
- **Estado documentado:** En curso.
- **Evidencia actual:** Jerarquía preparada en esta entrega; estimación y reparto pendientes.
- **Dependencias:** HU-33.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-34.1:** Todas las historias pertenecen a una épica y contienen criterios y tareas.
- **CA-34.2:** Los 29 RF mantienen sus códigos HU y el sprint 1 aparece completo.
- **CA-34.3:** El equipo acuerda prioridades y estimaciones; el primer incremento representa 40–60% de los puntos de los dos incrementos de implementación.

**Tareas de la historia**

- **T-34.1 — Preparar jerarquía completa y conservar códigos existentes.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-34.2 — Validar prioridades y estimar con el equipo.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-34.3 — Asignar historias a incrementos según puntos y dependencias.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-35. Preparar aceptación y trazabilidad

Como equipo, quiero tener escenarios vinculados a los requisitos, para comprobar cada compromiso sin confundir diseño con ejecución.

- **Épica:** EP-01.
- **Origen:** S1-06; Sprint1/PlanValidacion.md.
- **Estado documentado:** Realizada documentalmente.
- **Evidencia actual:** Criterios y 21 escenarios PV preparados; ejecución corresponde a historias de producto/calidad.
- **Dependencias:** HU-33.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-35.1:** Los criterios funcionales y escenarios PV cubren atributos, interfaces, restricciones y datos.
- **CA-35.2:** Se define el registro futuro de versión, resultado, fecha, evidencia y responsable.
- **CA-35.3:** Los escenarios preparados no se presentan como pruebas ejecutadas.

**Tareas de la historia**

- **T-35.1 — Enlazar RF y criterios CA.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-35.2 — Preparar escenarios PV de requisitos transversales.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-35.3 — Definir formato para evidencias y resultados futuros.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-36. Revisar consistencia documental

Como equipo, quiero detectar contradicciones e identificadores faltantes, para entregar requisitos e historias coherentes.

- **Épica:** EP-01.
- **Origen:** S1-07; Sprint1/ControlCalidad.md.
- **Estado documentado:** Realizada documentalmente.
- **Evidencia actual:** Control histórico del 9 de octubre y verificación de esta entrega.
- **Dependencias:** HU-33, HU-35.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-36.1:** RF y HU funcionales se corresponden y sus criterios coinciden.
- **CA-36.2:** Las 13 DEC están trazadas y su aprobación no se confunde con pruebas.
- **CA-36.3:** Las observaciones y límites de la revisión se conservan.

**Tareas de la historia**

- **T-36.1 — Comprobar identificadores y referencias.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-36.2 — Revisar criterios entre especificación y backlog.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-36.3 — Registrar resultados y limitaciones documentales.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-37. Registrar resolución de decisiones

Como equipo, quiero conservar el resultado de DEC-01 a DEC-13, para cerrar las ambigüedades reportadas.

- **Épica:** EP-01.
- **Origen:** S1-08; confirmación del usuario de 2026-10-10; Jira/DecisionesAprobadas.md.
- **Estado documentado:** Realizada documentalmente.
- **Evidencia actual:** Usuario confirmó «ya las aprobo» el 2026-10-10; no consta acta de reunión.
- **Dependencias:** HU-32.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-37.1:** Las 13 DEC figuran aprobadas según confirmación del equipo.
- **CA-37.2:** Se conserva el texto acordado y se actualizan los criterios afectados.
- **CA-37.3:** No se inventan fecha original, asistentes ni acta de la revisión.

**Tareas de la historia**

- **T-37.1 — Registrar confirmación y su alcance.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-37.2 — Incorporar las 13 decisiones a criterios vigentes.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-37.3 — Separar decisiones cerradas de ejecución de arquitectura.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-38. Formalizar aprobación integral de requerimientos

Como cliente, quiero identificar la versión y anexos que acepto, para establecer una línea base verificable.

- **Épica:** EP-01.
- **Origen:** S1-09; Sprint1/RevisionYAprobacion.md; RNF-08.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-33, HU-34, HU-37.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-38.1:** Se registra aceptación de una versión identificada y sus anexos o los IDs aceptados parcialmente.
- **CA-38.2:** Se registra expresamente el resultado de RNF-08, fuera de las 13 DEC.
- **CA-38.3:** El acta distingue aprobación integral de confirmación de DEC.

**Tareas de la historia**

- **T-38.1 — Identificar versión 0.4 y anexos de backlog.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-38.2 — Registrar alcance de aprobación integral y RNF-08.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-38.3 — Guardar evidencia de cierre formal sin atribuir una fecha no conocida.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-39. Registrar revisión y retrospectiva del Sprint 1

Como equipo, quiero documentar los resultados reales del sprint, para mejorar el trabajo siguiente y conservar evidencia académica.

- **Épica:** EP-01.
- **Origen:** S1-10; Sprint1/RevisionYAprobacion.md.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-30 a HU-38, según su estado.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Sprint 1 de requerimientos; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-39.1:** Se registran fecha, participantes, entregables revisados y pendientes reales.
- **CA-39.2:** La retrospectiva incluye acciones concretas con responsable y seguimiento.
- **CA-39.3:** Las reuniones pendientes no se marcan realizadas por existir una plantilla.

**Tareas de la historia**

- **T-39.1 — Realizar y documentar revisión del Sprint 1.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-39.2 — Realizar retrospectiva y acordar mejoras.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-39.3 — Guardar actas y actualizar estados según evidencia.** Resultado: documento o registro actualizado y enlazado a esta historia.

## EP-02. Arquitectura y preparación técnica

Definir una solución construible y reproducible para los seis módulos.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-40. Diseñar arquitectura e interfaces

Como equipo, quiero definir componentes de software, datos y comunicación, para implementar los seis módulos de forma consistente.

- **Épica:** EP-02.
- **Origen:** RD-01, RD-02, INT-01 a INT-06, DAT-01 a DAT-04; entrega de arquitectura.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-33, HU-37.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Etapa de arquitectura; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-40.1:** Se documentan web, Supabase, hardware, Telegram, fotos y voz, con responsabilidades y diagramas.
- **CA-40.2:** Se definen contratos de eventos, identidad, fecha/hora, errores y asociaciones históricas.
- **CA-40.3:** Se definen estados de toma, alarma y recuperación, incluida la política de horarios de cada módulo después de un corte.

**Tareas de la historia**

- **T-40.1 — Documentar componentes, flujos y esquema de datos.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-40.2 — Definir contratos y máquinas de estados con DEC aplicadas.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-40.3 — Revisar arquitectura contra todos los RF/RNF y preparar entrega.** Resultado: documento o registro actualizado y enlazado a esta historia.

### HU-41. Preparar entorno e infraestructura

Como equipo, quiero tener un entorno configurado y reproducible, para desarrollar y demostrar la solución integrada.

- **Épica:** EP-02.
- **Origen:** RD-02; INT-03; soporte de RNF-08.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-40.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Etapa de arquitectura; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-41.1:** El entorno ejecuta web, backend y almacenamiento con configuración documentada.
- **CA-41.2:** Las credenciales no aparecen en repositorio ni en archivos públicos de entrega.
- **CA-41.3:** Se comprueba comunicación de un dispositivo de prueba con el backend y persistencia.

**Tareas de la historia**

- **T-41.1 — Preparar repositorio, entorno y configuración de web/Supabase.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-41.2 — Configurar almacenamiento, migraciones y conexión de dispositivos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-41.3 — Ejecutar prueba de comunicación y documentar instalación.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-42. Definir y validar diseño físico de maqueta

Como equipo, quiero elegir componentes y documentar sus límites, para construir los módulos aprobados.

- **Épica:** EP-02.
- **Origen:** DEC-07, DEC-08, DEC-12; RD-03; RF-29.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-40.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Etapa de arquitectura; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-42.1:** La lista de componentes incluye ambas balanzas, sensores, cámara, luces, audio, botones y alimentación.
- **CA-42.2:** Se documentan rango, precisión, calibración, método de temperatura del biberón, dimensiones, materiales, brillo y volumen elegidos y se verifica su viabilidad para la maqueta.
- **CA-42.3:** Se respetan cinco botones, colchón independiente y restricciones de alimentación; toda sustitución tiene coordinación con el profesor.
- **CA-42.4:** La aprobación de DEC-12 no se presenta como validación física ya realizada ni como certificación comercial.

**Tareas de la historia**

- **T-42.1 — Seleccionar componentes y producir planos, conexiones y lista de materiales.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-42.2 — Caracterizar sensores, brillo, volumen y diseño mecánico con evidencia.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-42.3 — Registrar límites de maqueta y coordinar sustituciones antes de ejecutarlas.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-03. Cuentas, bebés y dispositivos

Gestionar acceso, asociaciones y propiedad compartida sin perder historial.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-01. Registrar e iniciar sesión

Como cuidador, quiero registrarme e ingresar con correo y contraseña, para acceder a mis dispositivos.

- **Épica:** EP-03.
- **Origen:** RF-01; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** Ninguna.
- **Decisiones aplicadas:** DEC-09.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-01.1:** Una cuenta registrada puede iniciar sesión con sus credenciales.
- **CA-01.2:** Las credenciales incorrectas impiden el acceso.
- **CA-01.3:** El cierre de sesión termina el acceso autenticado.
- **CA-01.4:** DEC-09 aprobada: un correo ya registrado o campos obligatorios vacíos no crean una segunda cuenta.

**Tareas de la historia**

- **T-01.1 — Configurar registro, ingreso y cierre de sesión con Supabase.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-01.2 — Construir formularios con validación de campos y correo duplicado.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-01.3 — Verificar credenciales válidas, inválidas y acceso tras cerrar sesión.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-02. Gestionar bebés

Como cuidador, quiero mantener un registro por bebé, para separar el historial de mis hijos.

- **Épica:** EP-03.
- **Origen:** RF-02; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-01.
- **Decisiones aplicadas:** DEC-09.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-02.1:** Dos bebés de una cuenta mantienen registros separados.
- **CA-02.2:** Es posible asociar accesorios a un bebé sin comprar la cuna.
- **CA-02.3:** DEC-09 aprobada: al crear un perfil, se exige nombre del bebé y se permite dejar vacía la fecha de nacimiento.

**Tareas de la historia**

- **T-02.1 — Crear perfiles con nombre obligatorio y nacimiento opcional.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-02.2 — Construir selección y edición de bebés con historial separado.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-02.3 — Verificar dos bebés de una cuenta y accesorios sin cuna.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-03. Asociar dispositivos

Como cuidador, quiero asociar los módulos adquiridos a cada bebé, para controlar el equipo correspondiente.

- **Épica:** EP-03.
- **Origen:** RF-03; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-02.
- **Decisiones aplicadas:** DEC-09.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-03.1:** Una cuenta puede asociar varios dispositivos.
- **CA-03.2:** Se respeta una cuna por bebé y se admiten accesorios independientes.
- **CA-03.3:** La interfaz presenta los módulos asociados.
- **CA-03.4:** DEC-09 aprobada: asociar una segunda cuna a un bebé se rechaza sin eliminar la asociación existente.

**Tareas de la historia**

- **T-03.1 — Implementar asociación de módulos a bebé y cuenta.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-03.2 — Mostrar módulos y rechazar segunda cuna sin alterar la primera.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-03.3 — Verificar múltiples dispositivos y asociación de accesorios independientes.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-04. Administrar dueños compartidos

Como cuidador, quiero administrar los dueños del dispositivo, para compartir su cuidado.

- **Épica:** EP-03.
- **Origen:** RF-04; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03.
- **Decisiones aplicadas:** DEC-09.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-04.1:** Dos dueños consultan la misma configuración del dispositivo.
- **CA-04.2:** La sección Bebés y dispositivos ofrece Administrar dueños.
- **CA-04.3:** DEC-09 aprobada: una invitación por correo solo concede acceso tras aceptarla; retirar a un dueño revoca su acceso y conserva el historial; se impide retirar al último dueño.

**Tareas de la historia**

- **T-04.1 — Implementar invitación por correo y aceptación del dueño.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-04.2 — Implementar revocación y protección del último dueño con configuración común.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-04.3 — Verificar acceso antes y después de aceptar o revocar, preservando historial.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-05. Reasignar una cuna

Como cuidador, quiero reasignar una cuna a otro bebé, para reutilizarla sin mezclar historiales.

- **Épica:** EP-03.
- **Origen:** RF-05; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03.
- **Decisiones aplicadas:** DEC-09.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-05.1:** La reasignación vincula las actividades nuevas con el nuevo bebé.
- **CA-05.2:** Los registros previos conservan su bebé original.
- **CA-05.3:** La reasignación no borra registros.

**Tareas de la historia**

- **T-05.1 — Implementar reasignación de cuna y validar destino sin otra cuna.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-05.2 — Preservar bebé original en eventos anteriores y actualizar solo eventos nuevos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-05.3 — Verificar reasignación entre dos bebés y conservación del historial.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-04. Notificaciones por Telegram

Vincular destinatarios y entregar un aviso por instancia de evento.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-06. Configurar destinatarios de Telegram

Como cuidador, quiero gestionar varios destinatarios por dispositivo, para avisar a quienes cuidan al bebé.

- **Épica:** EP-04.
- **Origen:** RF-06; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-04.
- **Decisiones aplicadas:** DEC-09.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-06.1:** La sección Destinatarios de Telegram permite configurar más de un destinatario.
- **CA-06.2:** La lista pertenece al dispositivo y es compartida por sus dueños.
- **CA-06.3:** DEC-09 aprobada: un código de un solo uso vincula al destinatario; retirarlo evita futuros avisos y no modifica los dueños del dispositivo.

**Tareas de la historia**

- **T-06.1 — Implementar vinculación de Telegram mediante código de un solo uso.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-06.2 — Construir lista compartida de destinatarios por dispositivo y retiro.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-06.3 — Verificar dos destinatarios, código no reutilizable y retiro sin cambiar dueños.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-07. Recibir avisos por evento

Como cuidador, quiero recibir alertas y recordatorios en Telegram, para enterarme aunque la web esté cerrada.

- **Épica:** EP-04.
- **Origen:** RF-07; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-06. Integración: HU-24.
- **Decisiones aplicadas:** DEC-11, DEC-13.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-07.1:** Un evento habilitado genera un aviso por cada destinatario configurado.
- **CA-07.2:** Cerrar la web no impide recibir el aviso.
- **CA-07.3:** Una instancia de acción o superación de tolerancia no genera avisos repetidos; acciones distintas no se agrupan.
- **CA-07.4:** Los mensajes de fotografía no contienen la imagen.
- **CA-07.5:** DEC-13 aprobada: varias lecturas consecutivas fuera del rango producen un único aviso por episodio; volver al rango y volver a salir produce un aviso nuevo.

**Tareas de la historia**

- **T-07.1 — Integrar envío de eventos habilitados a cada destinatario.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-07.2 — Implementar episodios de umbral e identificación de envíos para evitar duplicados.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-07.3 — Verificar web cerrada, acciones distintas, retorno al rango y mensajes sin fotografía.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-05. Cuna inteligente

Monitorear ambiente y movimiento, controlar luz/audio y transmitir voz.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-08. Monitorear movimiento de la cuna

Como cuidador, quiero activar el monitoreo manualmente o por horario, para conocer la actividad del bebé.

- **Épica:** EP-05.
- **Origen:** RF-08; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03, HU-07. Integración: HU-24.
- **Decisiones aplicadas:** Ninguna específica.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-08.1:** Una detección durante el monitoreo activo queda registrada con hora.
- **CA-08.2:** La detección activa produce una alerta por Telegram con su hora.
- **CA-08.3:** Desactivar el monitoreo evita eventos y avisos de ese monitoreo.

**Tareas de la historia**

- **T-08.1 — Integrar sensor de movimiento de la cuna y estado de monitoreo.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-08.2 — Implementar activación manual y horarios con registro y aviso.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-08.3 — Verificar detección activa con hora y ausencia de registros al desactivar.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-09. Consultar ambiente de la cuna

Como cuidador, quiero consultar temperatura y humedad, para conocer las condiciones de la cuna.

- **Épica:** EP-05.
- **Origen:** RF-09; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03. Integración: HU-24.
- **Decisiones aplicadas:** DEC-07.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-09.1:** Se muestran lecturas de temperatura y humedad del interior de la cuna.
- **CA-09.2:** Las mediciones quedan asociadas al dispositivo y al bebé.
- **CA-09.3:** DEC-07 aprobada: se muestran °C y % HR; las lecturas ambientales se toman cada 10 segundos y conservan su fecha y hora.

**Tareas de la historia**

- **T-09.1 — Integrar lectura ambiental en °C y % HR cada 10 segundos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-09.2 — Mostrar y persistir lecturas con bebé, dispositivo y fecha/hora.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-09.3 — Verificar unidades, asociación y periodicidad de lecturas.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-10. Configurar límites ambientales

Como cuidador, quiero establecer límites inferiores y superiores, para recibir avisos fuera del rango elegido.

- **Épica:** EP-05.
- **Origen:** RF-10; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-07, HU-09. Integración: HU-07, HU-09.
- **Decisiones aplicadas:** DEC-13.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-10.1:** Se guardan límites inferiores y superiores para temperatura y humedad.
- **CA-10.2:** Una lectura fuera del rango configurado genera el aviso correspondiente.
- **CA-10.3:** Todos los dueños ven la misma configuración.
- **CA-10.4:** DEC-13 aprobada: si el límite inferior es mayor o igual al superior, no se guarda el cambio y se mantiene la configuración anterior.

**Tareas de la historia**

- **T-10.1 — Construir edición de límites inferiores y superiores compartidos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-10.2 — Rechazar límites invertidos o iguales y detectar episodios fuera de rango.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-10.3 — Verificar conservación de configuración y una alerta por episodio.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-11. Controlar luz y audios de la cuna

Como cuidador, quiero manejar la lámpara y audios pregrabados, para acompañar al bebé desde la app.

- **Épica:** EP-05.
- **Origen:** RF-11; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03. Integración: HU-24.
- **Decisiones aplicadas:** DEC-08.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-11.1:** La lámpara permite encendido, apagado y cambio de intensidad.
- **CA-11.2:** Se reproduce audio pregrabado sin depender de Spotify.
- **CA-11.3:** La reproducción queda como actividad sin registrar sonidos del bebé.
- **CA-11.4:** DEC-08 aprobada: se puede seleccionar, reproducir y detener un audio del catálogo pregrabado; la versión inicial no ofrece carga de archivos.

**Tareas de la historia**

- **T-11.1 — Implementar encendido, apagado e intensidad de lámpara.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-11.2 — Integrar selección, reproducción y detención de catálogo pregrabado.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-11.3 — Verificar controles físicos y registro de reproducción sin audio del bebé.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-12. Transmitir voz en vivo

Como cuidador, quiero hablar desde el celular hacia la cuna, para hacer que el bebé escuche mi voz.

- **Épica:** EP-05.
- **Origen:** RF-12; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03. Integración: HU-24.
- **Decisiones aplicadas:** Ninguna específica.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-12.1:** La voz se reproduce en el altavoz de la cuna durante la transmisión.
- **CA-12.2:** El canal es unidireccional; no devuelve audio del bebé.
- **CA-12.3:** Puede registrarse la actividad, pero no se almacena la voz transmitida.

**Tareas de la historia**

- **T-12.1 — Integrar captura autorizada de micrófono y transmisión hacia la cuna.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-12.2 — Implementar inicio, detención y registro de actividad sin grabación.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-12.3 — Verificar voz en vivo, ausencia de retorno y ausencia de audio almacenado.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-06. Figuras LED y juego interactivo

Ofrecer luces programables y juego de cinco botones con recompensa.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-13. Programar figuras LED

Como cuidador, quiero controlar las luces de las figuras, para programar el entretenimiento.

- **Épica:** EP-06.
- **Origen:** RF-13; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03. Integración: HU-40, HU-42.
- **Decisiones aplicadas:** DEC-08.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-13.1:** La app permite encender y apagar manualmente y por horario.
- **CA-13.2:** Se puede ajustar el número de segundos entre cambios de luces.
- **CA-13.3:** El control es independiente de la lámpara y del colchón, sin dimmer ni motor exigido.
- **CA-13.4:** DEC-08 aprobada: configurar menos de 2 segundos entre cambios se rechaza; al configurar 2 segundos, los cambios respetan ese intervalo. La intensidad física aún requiere validación de diseño.

**Tareas de la historia**

- **T-13.1 — Implementar control manual y horarios de figuras LED.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-13.2 — Aplicar intervalo configurable mínimo de 2 segundos e independencia de controles.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-13.3 — Verificar intervalos, rechazo de valores menores e independencia de lámpara y colchón.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-19. Utilizar el juego de cinco botones

Como cuidador, quiero ofrecer un juego con botones iluminados, para entretener al bebé con una recompensa sonora.

- **Épica:** EP-06.
- **Origen:** RF-19; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03. Integración: HU-42.
- **Decisiones aplicadas:** Ninguna específica.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-19.1:** Se ilumina un objetivo elegido aleatoriamente entre cinco botones.
- **CA-19.2:** Pulsar el objetivo reproduce una recompensa; pulsar otro no la reproduce.
- **CA-19.3:** Después de presionar un botón se ilumina otro objetivo aleatorio.
- **CA-19.4:** El juego continúa hasta apagarlo.

**Tareas de la historia**

- **T-19.1 — Construir panel y selección aleatoria de objetivo entre cinco botones.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-19.2 — Implementar recompensa por acierto y cambio de objetivo tras cada pulsación.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-19.3 — Verificar acierto, error, nuevo objetivo y funcionamiento hasta apagar.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-07. Colchón independiente

Vigilar pérdida de peso, emitir alarma y rearmar explícitamente.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-14. Activar monitoreo del colchón

Como cuidador, quiero activar el colchón por un tiempo configurable, para vigilar cambios respecto al peso inicial.

- **Épica:** EP-07.
- **Origen:** RF-14; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03. Integración: HU-24, HU-42.
- **Decisiones aplicadas:** DEC-07, DEC-13.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-14.1:** Activar guarda el peso numérico de referencia, incluidos bebé y objetos.
- **CA-14.2:** Se permite desactivar desde la aplicación.
- **CA-14.3:** El colchón funciona sin comprar la cuna inteligente.
- **CA-14.4:** No se toma una foto del peso ni se registran movimientos derivados de la balanza.
- **CA-14.5:** DEC-13 aprobada: una duración nula o negativa o una referencia de peso nula o inválida impiden activar el monitoreo; al vencer la duración válida, el monitoreo queda detenido.

**Tareas de la historia**

- **T-14.1 — Integrar balanza y captura de referencia numérica con bebé y objetos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-14.2 — Implementar duración positiva, activación y detención de monitoreo independiente.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-14.3 — Verificar referencia inválida, vencimiento y uso sin cuna.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-15. Detectar pérdida de peso

Como cuidador, quiero recibir una alarma ante pérdida significativa de peso, para advertir el cambio durante el monitoreo.

- **Épica:** EP-07.
- **Origen:** RF-15; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-07, HU-14.
- **Decisiones aplicadas:** DEC-03, DEC-07.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-15.1:** La tolerancia se configura como porcentaje del peso de referencia.
- **CA-15.2:** Superar la tolerancia activa sonido en el colchón y aviso en Telegram.
- **CA-15.3:** No hay alarma de monitoreo cuando está desactivado.
- **CA-15.4:** DEC-07 aprobada: con referencia de 1000 g y tolerancia del 10%, tres lecturas consecutivas de 890 g disparan la alarma; tres de 900 g no la disparan; una lectura de 890 g seguida por 1000 g no completa el filtro.

**Tareas de la historia**

- **T-15.1 — Implementar tolerancia porcentual y filtro de tres lecturas de peso.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-15.2 — Integrar alarma sonora del colchón y evento para Telegram.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-15.3 — Verificar referencia 1000 g, 890 g frente a 900 g y reinicio del filtro.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-16. Detener alarma y restablecer monitoreo

Como cuidador, quiero detener la alarma y restablecer el monitoreo desde la app, para controlar el seguimiento del colchón.

- **Épica:** EP-07.
- **Origen:** RF-16; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-15.
- **Decisiones aplicadas:** DEC-03.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-16.1:** La alarma activa puede detenerse con la app y el botón físico.
- **CA-16.2:** La app permite restablecer el monitoreo manualmente.
- **CA-16.3:** DEC-03 aprobada: a los 60 segundos configurados se apaga el sonido; tanto este apagado como app o botón dejan el monitoreo detenido. Una acción explícita de rearme captura una nueva referencia.

**Tareas de la historia**

- **T-16.1 — Implementar apagado de alarma por app, botón y temporizador configurable de 60 s.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-16.2 — Implementar estado detenido y rearme explícito con nueva referencia.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-16.3 — Verificar las tres vías de apagado y que silenciar no reactive el monitoreo.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-08. Habitación y fotografías

Detectar actividad y consultar una fotografía por acción.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-17. Monitorear puerta y movimiento de habitación

Como cuidador, quiero activar los sensores de habitación manualmente o por horario, para detectar actividad en los períodos elegidos.

- **Épica:** EP-08.
- **Origen:** RF-17; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03, HU-07. Integración: HU-24.
- **Decisiones aplicadas:** Ninguna específica.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-17.1:** Cada sensor admite activar, desactivar y programar un rango de tiempo.
- **CA-17.2:** Abrir la puerta o detectar movimiento activo genera un evento.
- **CA-17.3:** El evento genera aviso en Telegram y no alarma sonora local.
- **CA-17.4:** No se distingue dirección de entrada o salida.
- **CA-17.5:** Si puerta y movimiento producen dos acciones durante monitoreo activo, se conservan dos eventos y dos solicitudes de fotografía.

**Tareas de la historia**

- **T-17.1 — Integrar sensores de puerta y movimiento de habitación.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-17.2 — Implementar activación y horarios independientes con evento y solicitud de foto.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-17.3 — Verificar dos acciones distintas, monitoreo apagado y ausencia de alarma local.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-18. Guardar y consultar fotografías

Como cuidador, quiero ver las fotografías de los eventos de habitación, para consultar lo ocurrido.

- **Épica:** EP-08.
- **Origen:** RF-18; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-17.
- **Decisiones aplicadas:** Ninguna específica.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-18.1:** Un evento de puerta o movimiento durante monitoreo activo toma una fotografía.
- **CA-18.2:** La fotografía se guarda en nube y se consulta desde la app.
- **CA-18.3:** Se registra una foto por instancia de acción, sin agrupar acciones distintas.
- **CA-18.4:** La cámara no graba video y Telegram solo notifica que se tomó una foto.

**Tareas de la historia**

- **T-18.1 — Integrar captura y almacenamiento de fotografía por evento de habitación.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-18.2 — Construir consulta autorizada de fotos vinculadas al evento.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-18.3 — Verificar dos eventos con dos fotos, persistencia y ausencia de video o adjuntos en Telegram.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-09. Alimentación

Registrar pesajes y tomas, recordar horarios y medir temperatura.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-20. Iniciar y pesar una toma

Como cuidador, quiero pesar al inicio e iniciar una toma desde la app, para registrar el comienzo de la alimentación.

- **Épica:** EP-09.
- **Origen:** RF-20; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03. Integración: HU-24, HU-42.
- **Decisiones aplicadas:** DEC-01.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-20.1:** El adulto coloca alimento o biberón sobre el dispositivo y registra el peso inicial en gramos.
- **CA-20.2:** El botón de inicio registra la hora y comienza el temporizador.
- **CA-20.3:** La toma queda asociada al bebé y dispositivo correspondientes.
- **CA-20.4:** DEC-01 aprobada: sin peso inicial válido no se inicia la toma; se informa que debe colocarse el mismo recipiente que se usará para el pesaje final.

**Tareas de la historia**

- **T-20.1 — Integrar balanza de alimentación y peso inicial en gramos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-20.2 — Implementar inicio de toma con temporizador y asociación a bebé/dispositivo.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-20.3 — Verificar rechazo de peso inválido y aviso de utilizar el mismo recipiente.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-21. Pausar, finalizar y corregir tomas

Como cuidador, quiero gestionar una toma y registrar su peso final, para conservar cantidad y duración correctas.

- **Épica:** EP-09.
- **Origen:** RF-21; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-20.
- **Decisiones aplicadas:** DEC-01, DEC-02.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-21.1:** La app permite pausar y finalizar manualmente la toma.
- **CA-21.2:** Al finalizar se pesa de nuevo el alimento o biberón en el dispositivo, en gramos.
- **CA-21.3:** Se permite corregir la toma y consultar su duración final.
- **CA-21.4:** DEC-01 aprobada: una toma de 08:00 a 08:15, pausada de 08:05 a 08:07, conserva 13 minutos activos. Con 200 g iniciales y 150 g finales registra 50 g ingeridos. Una corrección conserva valor anterior, autor, fecha y motivo.
- **CA-21.5:** DEC-02 aprobada: devolver el biberón permite obtener su peso, pero la toma continúa hasta el cierre manual. El cierre automático queda fuera del alcance actual; requiere una solicitud de cambio.
- **CA-21.6:** DEC-01 aprobada: un peso final mayor al inicial o una lectura faltante impiden cerrar como completa; el usuario puede corregir y volver a intentar, sin registrar un consumo negativo.

**Tareas de la historia**

- **T-21.1 — Implementar pausa, reanudación y cierre manual con segundo pesaje.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-21.2 — Calcular duración activa y consumo y auditar correcciones con motivo.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-21.3 — Verificar 13 minutos y 50 g del ejemplo, pesos inválidos y devolución sin cierre automático.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-22. Programar recordatorios diarios

Como cuidador, quiero definir horarios diarios de alimentación, para recordar las próximas tomas.

- **Épica:** EP-09.
- **Origen:** RF-22; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-07. Integración: HU-03.
- **Decisiones aplicadas:** DEC-04.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-22.1:** La app permite configurar y modificar las horas de alimentación.
- **CA-22.2:** Los recordatorios se repiten diariamente y llegan por Telegram.
- **CA-22.3:** DEC-04 aprobada: programar 08:00 y 11:00 genera un recordatorio en cada hora todos los días, en America/Costa_Rica; no crea recordatorios en las horas intermedias.

**Tareas de la historia**

- **T-22.1 — Implementar programación diaria de horas en America/Costa_Rica.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-22.2 — Integrar recordatorio por hora y destinatario con posibilidad de modificar horarios.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-22.3 — Verificar 08:00 y 11:00 sin avisos intermedios y sin duplicación.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-23. Medir temperatura del biberón

Como cuidador, quiero consultar la temperatura del biberón y configurar límites, para recibir avisos si está fuera del rango.

- **Épica:** EP-09.
- **Origen:** RF-23; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03, HU-07. Integración: HU-24, HU-42.
- **Decisiones aplicadas:** DEC-07, DEC-12, DEC-13.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-23.1:** El dispositivo mide la temperatura del biberón.
- **CA-23.2:** La app permite configurar los límites de frío y calor.
- **CA-23.3:** Una lectura fuera de los límites genera aviso por Telegram.
- **CA-23.4:** El dispositivo no calienta, enfría ni suministra alimento automáticamente.

**Tareas de la historia**

- **T-23.1 — Integrar sensor de temperatura del biberón elegido en HU-42.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-23.2 — Construir límites configurables y evento de alerta por episodio fuera de rango.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-23.3 — Verificar lectura en °C y límites sin calentar, enfriar ni suministrar alimento.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-10. Historial, gráficos y exportación

Conservar y consultar datos por bebé y exportarlos a Excel.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-24. Conservar actividad en la nube

Como cuidador, quiero guardar actividades por bebé y dispositivo, para mantener un historial permanente.

- **Épica:** EP-10.
- **Origen:** RF-24; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-03.
- **Decisiones aplicadas:** DEC-13.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-24.1:** Cada actividad guardada contiene fecha, hora, tipo, descripción y datos asociados cuando aplican.
- **CA-24.2:** Se conservan mediciones, movimientos, activaciones, eventos y alertas.
- **CA-24.3:** No se borran registros ni se guarda audio del bebé.
- **CA-24.4:** Una reasignación mantiene la asociación histórica original.
- **CA-24.5:** DEC-13 aprobada: recibir dos veces el mismo evento conserva un solo registro, mientras que dos eventos distintos con la misma hora se conservan por separado.

**Tareas de la historia**

- **T-24.1 — Implementar persistencia de actividad y asociaciones históricas.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-24.2 — Implementar identificador de evento y conservación sin eliminación de historial.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-24.3 — Verificar reenvío idéntico, eventos distintos a la misma hora y reasignación.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-25. Consultar historial y resumen de noche

Como cuidador, quiero consultar las actividades y el resumen nocturno, para revisar lo sucedido.

- **Épica:** EP-10.
- **Origen:** RF-25; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-24.
- **Decisiones aplicadas:** DEC-05, DEC-11.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-25.1:** La app consulta datos recientes ya guardados en la nube.
- **CA-25.2:** Los historiales de bebés diferentes permanecen separados.
- **CA-25.3:** El resumen nocturno se consulta en la app sin envío automático a Telegram.
- **CA-25.4:** DEC-05 aprobada: seleccionar inicio y fin de la noche muestra el resumen del intervalo elegido; un intervalo sin registros se informa como tal, sin inventar actividad.

**Tareas de la historia**

- **T-25.1 — Construir consulta de historial por bebé, dispositivo y período.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-25.2 — Implementar resumen nocturno con inicio y fin seleccionables.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-25.3 — Verificar aislamiento de bebés, intervalo vacío y consulta sin envío automático a Telegram.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-26. Mostrar gráficos de sensores y eventos

Como cuidador, quiero ver histogramas o líneas de los datos, para identificar actividad y variaciones por hora.

- **Épica:** EP-10.
- **Origen:** RF-26; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-24.
- **Decisiones aplicadas:** DEC-05.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-26.1:** Todos los sensores tienen representación de sus mediciones o eventos.
- **CA-26.2:** Se puede consultar cuántos movimientos ocurrieron y cuándo hubo más actividad.
- **CA-26.3:** DEC-05 aprobada: dos eventos a las 08:15 y 08:59 cuentan en [08:00,09:00), y uno a las 09:00 cuenta en [09:00,10:00). Las mediciones se muestran como líneas con fecha, hora y unidad.
- **CA-26.4:** DEC-05 aprobada: la gráfica distingue intervalos sin datos de intervalos con mediciones disponibles y cero eventos.

**Tareas de la historia**

- **T-26.1 — Construir histogramas por hora y líneas con fecha, hora y unidad.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-26.2 — Cubrir sensores y distinguir cero eventos de ausencia de datos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-26.3 — Verificar bordes 08:59/09:00 y correspondencia entre gráficos e historial.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-27. Exportar datos para Excel

Como cuidador, quiero descargar los registros en Excel, para analizarlos fuera de la aplicación.

- **Épica:** EP-10.
- **Origen:** RF-27; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-24.
- **Decisiones aplicadas:** DEC-06.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-27.1:** El archivo contiene al menos fecha, hora y evento.
- **CA-27.2:** Contiene solo datos, sin formato decorativo, fotografías ni enlaces a fotografías.
- **CA-27.3:** DEC-06 aprobada: se genera un archivo .xlsx con una fila por registro del bebé y período elegidos; se incluyen las columnas definidas en DEC-06 y se dejan vacíos los campos no aplicables.
- **CA-27.4:** Los registros exportados corresponden a la información almacenada.
- **CA-27.5:** DEC-06 aprobada: el archivo de un período sin registros contiene encabezados y ninguna fila de datos; los valores de las filas coinciden con el historial.

**Tareas de la historia**

- **T-27.1 — Implementar selección de bebé y período para exportación .xlsx.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-27.2 — Generar columnas de DEC-06 dejando campos no aplicables vacíos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-27.3 — Verificar archivo con Excel, exactitud de filas y archivo vacío con encabezados sin fotos ni enlaces.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

## EP-11. Calidad, integración y entregas

Verificar seguridad, recuperación, experiencia, rendimiento y entregas académicas.

**Cierre de la épica:** todas sus historias satisfacen sus criterios y tienen evidencia; los pendientes de aprobación formal se resuelven en las historias indicadas.

### HU-28. Gestionar interrupción y recuperación

Como cuidador, quiero conocer el estado después de perder electricidad o internet, para evitar confundir una interrupción con monitoreo activo.

- **Épica:** EP-11.
- **Origen:** RF-28; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-14, HU-22, HU-24.
- **Decisiones aplicadas:** DEC-10.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-28.1:** La solución no exige UPS ni continuidad sin conexión.
- **CA-28.2:** La interrupción detiene el funcionamiento conforme a la aclaración registrada.
- **CA-28.3:** DEC-10 aprobada: tras recuperarse la conexión se conservan registros y configuración, se muestra el colchón detenido y se exige rearme con nueva referencia; los recordatorios vencidos se omiten y los futuros conservan su programación.

**Tareas de la historia**

- **T-28.1 — Detectar interrupción de conexión/energía y presentar estado del dispositivo.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-28.2 — Recuperar configuración, detener colchón y omitir recordatorios vencidos.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-28.3 — Verificar corte y retorno sin datos fabricados ni rearme automático.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-29. Validar maqueta modular

Como cuidador, quiero comprobar todos los módulos en una maqueta, para evaluar las funciones y su independencia.

- **Épica:** EP-11.
- **Origen:** RF-29; EspecificacionRequerimientos.md v0.4.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** No hay implementación ni pruebas de producto registradas.
- **Dependencias:** HU-08, HU-13, HU-16, HU-18, HU-19, HU-21, HU-23. Integración: HU-12, HU-28, HU-42, HU-43, HU-44, HU-45.
- **Decisiones aplicadas:** DEC-12.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-29.1:** La demostración contempla cuna, figuras LED, colchón, habitación, juego y alimentación con pesaje.
- **CA-29.2:** El colchón demuestra uso independiente y alimentación propia o desde la cuna.
- **CA-29.3:** El juego comercial contempla baterías; la maqueta puede usar electricidad.
- **CA-29.4:** Se documentan dimensiones, materiales y componentes; una sustitución de sensor se coordina con el profesor.

**Tareas de la historia**

- **T-29.1 — Integrar demostración de cuna, LED, colchón, habitación, juego y alimentación.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-29.2 — Demostrar independencia y alimentación del colchón y documentar maqueta física.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-29.3 — Ejecutar recorrido de aceptación por módulo y registrar resultados y sustituciones autorizadas.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-43. Verificar acceso y privacidad integral

Como cuidador, quiero que solo los dueños autorizados consulten y controlen mis dispositivos, para proteger datos, fotos y configuraciones.

- **Épica:** EP-11.
- **Origen:** RNF-03, RNF-04, RNF-05; DAT-04; DEC-09.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-04, HU-05, HU-06, HU-12, HU-18, HU-24.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-43.1:** Web y solicitudes directas deniegan datos, fotos y controles de dispositivos ajenos.
- **CA-43.2:** Revocar un dueño elimina acceso; ser destinatario de Telegram no otorga control.
- **CA-43.3:** Reasignar o revocar conserva registros, y una transmisión no almacena audio.

**Tareas de la historia**

- **T-43.1 — Revisar reglas de acceso en datos, fotos y controles.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-43.2 — Ejecutar pruebas con cuentas separadas, compartidas y revocadas.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-43.3 — Verificar conservación histórica y ausencia de grabaciones.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-44. Verificar uso desde celular y computadora

Como cuidador, quiero operar los módulos desde pantallas pequeñas y grandes, para usar la web sin perder controles o unidades.

- **Épica:** EP-11.
- **Origen:** RNF-07; INT-01; DEC-09.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-01 a HU-27 en los recorridos que se demuestren.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-44.1:** Los recorridos de cuentas, configuración, controles, historial y exportación funcionan a 360 y 1280 píxeles sin solapamientos.
- **CA-44.2:** Nombres, unidades y estados se muestran claramente.
- **CA-44.3:** Se registra navegador, versión y dispositivo de prueba; la matriz de compatibilidad se acuerda en arquitectura.

**Tareas de la historia**

- **T-44.1 — Definir matriz de navegadores y recorridos de prueba.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-44.2 — Adaptar presentación y estados a celular y computadora.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-44.3 — Ejecutar recorridos y guardar evidencia de correcciones.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-45. Verificar rendimiento y periodicidad

Como equipo, quiero medir los objetivos aprobados de la maqueta, para comprobar que consultas, avisos y lecturas cumplen sus tiempos.

- **Épica:** EP-11.
- **Origen:** RNF-01, RNF-02; DEC-07, DEC-11.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-07, HU-09, HU-14, HU-23, HU-25.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-45.1:** La prueba usa 2 cuentas concurrentes, 2 bebés, un ejemplar de cada módulo y 1000 eventos.
- **CA-45.2:** Al menos 95 de 100 consultas de historial cumplen 3 segundos y 95 de 100 solicitudes de envío a Telegram cumplen 5 segundos desde recepción backend; entrega externa se mide aparte.
- **CA-45.3:** Se comprueban lecturas ambientales cada 10 s y peso cada 1 s; los resultados incluyen tiempos y condiciones.

**Tareas de la historia**

- **T-45.1 — Preparar datos y medición de carga aprobada.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-45.2 — Medir consultas, solicitud a Telegram y periodicidad.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-45.3 — Registrar resultados y corregir incumplimientos antes del cierre.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-46. Entregar y demostrar los dos incrementos

Como cliente, quiero recibir incrementos verificables y documentación de uso, para evaluar el proyecto completo y reproducir su demostración.

- **Épica:** EP-11.
- **Origen:** RNF-08 (propuesta adicional); RF-29; calendario del curso registrado en especificación §4.3.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-34, HU-38, HU-40 a HU-45; historias incluidas en cada incremento.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-46.1:** Se documenta reparto por puntos: primer incremento entre 40% y 60% de los puntos de implementación, segundo con el resto.
- **CA-46.2:** Cada incremento conserva versión, historias, pruebas, demostración y resultado de revisión; todos los módulos quedan cubiertos al finalizar el segundo.
- **CA-46.3:** La entrega incluye instalación, configuración, componentes, uso y evidencia; otro integrante reproduce la demostración.
- **CA-46.4:** Se registran defectos y se verifica su corrección antes de marcar aceptada la entrega.

**Tareas de la historia**

- **T-46.1 — Preparar y demostrar incremento 1 con versión y evidencias.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-46.2 — Preparar y demostrar incremento 2 con cobertura total.** Resultado: componente o configuración verificable que realiza lo descrito, integrado con los requisitos de esta historia.
- **T-46.3 — Entregar manuales e instrucciones y verificar reproducción por otro integrante.** Resultado: evidencia del resultado y de los casos indicados, asociada a esta historia.

### HU-47. Cerrar el proyecto y registrar retrospectiva final

Como equipo, quiero conservar resultados y mejoras del proyecto, para cerrar la entrega con trazabilidad del trabajo realizado.

- **Épica:** EP-11.
- **Origen:** Calendario del curso; cierre académico.
- **Estado documentado:** Por hacer.
- **Evidencia actual:** Sin ejecución registrada.
- **Dependencias:** HU-46.
- **Decisiones aplicadas:** No aplica salvo referencias indicadas.
- **Planificación:** Incremento por asignar; responsable y estimación por acordar.

**Criterios de aceptación**

- **CA-47.1:** Se registra retrospectiva final con participantes, resultados y acciones.
- **CA-47.2:** Se concilian historias entregadas, defectos y aceptación real con Jira.
- **CA-47.3:** Se conserva un índice de documentos, versiones y evidencias del proyecto.

**Tareas de la historia**

- **T-47.1 — Realizar retrospectiva final y registrar acuerdos.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-47.2 — Conciliar estados y pendientes con evidencia de entrega.** Resultado: documento o registro actualizado y enlazado a esta historia.
- **T-47.3 — Consolidar índice final de documentación y demostraciones.** Resultado: documento o registro actualizado y enlazado a esta historia.

## Criterio común de terminado

Una historia de producto se termina cuando satisface sus criterios, está integrada, respeta autorización e historial y tiene resultados verificables con versión, fecha y responsable. Un escenario escrito no es una prueba aprobada. Las historias documentales se verifican mediante sus archivos y registros; una ceremonia o aprobación necesita evidencia de que ocurrió.

## Cobertura de requisitos transversales

| Requisitos | Historias responsables |
| --- | --- |
| RF-01 a RF-29 | HU-01 a HU-29, correspondencia uno a uno |
| RNF-01 / RNF-02 | HU-45; implementación HU-07, HU-09, HU-14, HU-23, HU-25 |
| RNF-03 / RNF-04 / RNF-05 | HU-43; HU-04, HU-05, HU-12, HU-18, HU-24 |
| RNF-06 | HU-28 |
| RNF-07 | HU-44 |
| RNF-08 | HU-38 (aceptación específica), HU-41 y HU-46 (realización) |
| INT-01 a INT-06 | HU-40; HU-03, HU-06, HU-07, HU-08 a HU-23, HU-24, HU-27, HU-29 |
| RD-01 / RD-02 / RD-03 | HU-40, HU-41, HU-42, HU-29 |
| DAT-01 / DAT-02 / DAT-03 / DAT-04 | HU-24, HU-21, HU-22/HU-26/HU-27, HU-04/HU-05/HU-43 |
| S1-01 a S1-10 | HU-30 a HU-39, correspondencia uno a uno |
| Arquitectura, incrementos y retrospectiva | HU-40 a HU-42, HU-46, HU-47 |

Los códigos de las tareas permiten dividir la ejecución; no añaden funciones fuera del alcance. Los componentes, rangos físicos y precisión todavía requieren selección y medición en HU-42 conforme a DEC-12 aprobada.
