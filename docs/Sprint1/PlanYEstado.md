# Plan y estado del Sprint 1: requerimientos

Objetivo: preparar y revisar una especificación verificable del sistema, con alcance, historias iniciales priorizadas y criterios de aceptación, y obtener la aprobación del cliente.

Período de referencia del curso: primeras dos semanas desde el 1 de octubre de 2026. Entrega de requerimientos: 15 de octubre de 2026. No se fijan horarios de reuniones ni responsables nominales sin información del equipo.

## Trabajo del sprint

| ID | Actividad | Resultado verificable | Estado |
| --- | --- | --- | --- |
| S1-01 | Recopilar antecedentes y respuestas | Fuentes originales y respuestas R-01 a R-09 conservadas. | Preparado. |
| S1-02 | Documentar levantamiento | Minuta reconstruida con fuentes y datos pendientes. | Preparado; falta validar datos de asistentes. |
| S1-03 | Consolidar alcance | Seis módulos y restricciones en RequerimientosFinal. | Preparado. |
| S1-04 | Redactar especificación | Secciones IEEE, RF/RNF/interfaces/datos y criterios integrados. | Preparado, versión 0.4; DEC aprobadas según confirmación del equipo. |
| S1-05 | Identificar y priorizar historias | 47 HU organizadas en 11 épicas y 141 tareas; 29 HU funcionales conservadas. | Preparado para revisión. |
| S1-06 | Definir aceptación y trazabilidad | Casos funcionales y no funcionales enlazados a requisitos y fuentes. | Preparado; pruebas de producto no ejecutadas. |
| S1-07 | Revisar consistencia documental | Informe de control de calidad. | Revisión documental realizada. |
| S1-08 | Revisar con el cliente | Agenda y registro de decisiones preparados. | DEC aprobadas según confirmación del equipo del 10/10; acta de reunión no disponible. |
| S1-09 | Obtener aprobación | Constancia sobre una versión identificada. | Aprobación integral de versión por registrar; DEC aprobadas. |
| S1-10 | Registrar revisión y retrospectiva | Acta y preguntas preparadas. | Sesiones y resultados pendientes. |

## Criterio de cierre del sprint

La preparación documental queda completa cuando cada función tiene fuente y criterios, las propuestas están identificadas, las historias tienen una prioridad justificada y la revisión está preparada. El sprint solo puede declararse aprobado cuando se registre la decisión del cliente sobre una versión concreta y se resuelvan o acepten explícitamente sus pendientes. No se confunde la revisión de documentos con pruebas exitosas del producto.

## Priorización inicial propuesta

P1: acceso, asociaciones, persistencia, notificaciones y monitoreo del colchón, porque habilitan la operación compartida y el aviso central del producto. P2: sensores, habitación, alimentación y consulta/exportación para completar el seguimiento. P3: controles de entretenimiento, voz y verificación integrada. Todos permanecen obligatorios dentro del alcance; P3 indica orden propuesto, no exclusión.

La sección «Orden de trabajo y entregas» del backlog integral detalla la secuencia propuesta. No se reservan historias para incrementos ni se desarrollan funcionalidades en este sprint. La estimación y planificación de implementación se realizarán con el equipo cuando corresponda.

## Riesgos de requerimientos y tratamiento

| Riesgo | Efecto | Tratamiento preparado |
| --- | --- | --- |
| Interpretar apagado como rearme automático | Comportamiento del colchón ambiguo | DEC-03 y escenario de rearme. |
| Omitir balanza de alimentación | Alcance incompleto | RF-20, RF-21 y respuestas R-02/R-04. |
| Dar por aprobados ejemplos numéricos | Compromisos sin acuerdo | Parámetros aprobados en DEC; límites físicos por validar en arquitectura. |
| Confundir pérdida de internet con operación autónoma | Contradicción funcional | RF-28 y revisión de DEC-10. |
| Usar dos copias distintas del repositorio | Entrega con versiones inconsistentes | Documentación de trabajo en la raíz; copia anidada excluida. |
| Presentar un acta reconstruida como firmada | Evidencia de curso inexacta | Estado explícito y campos por validar. |

## Límite del trabajo preparado

Esta carpeta corresponde al primer sprint. Arquitectura, infraestructura, lista de compra, programación, pruebas ejecutadas de hardware/software y entrega de incrementos pertenecen a etapas posteriores. Los escenarios escritos aquí describen cómo aceptar los requerimientos; no registran su ejecución.

## Actualización del 10 de octubre de 2026

Aprobación de DEC-01 a DEC-13: confirmada por el usuario el 10 de octubre de 2026 mediante «ya las aprobo», en respuesta a la consulta sobre las 13 decisiones de Alejandro. Se registra como confirmación del equipo; no se conoce la fecha original de aprobación ni se dispone de un mensaje directo de Alejandro. Esta confirmación no acredita por sí sola la aprobación integral de la especificación, RNF-08, reuniones, retrospectivas o pruebas ejecutadas.

El [backlog integral](../Jira/BacklogCompleto.md) refleja S1-01 a S1-10 como HU-30 a HU-39. Se conservan estados parciales: minuta pendiente de validar datos, backlog pendiente de estimar, aprobación integral y retrospectiva pendientes de evidencia. La preparación de historias de arquitectura e implementación no significa que ese trabajo se haya ejecutado en Sprint 1.
