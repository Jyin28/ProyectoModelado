# Plan de validación de requerimientos

Estado: escenarios preparados durante el sprint 1. Ninguna prueba de producto se ha ejecutado. DEC-01 a DEC-13 aprobadas según confirmación del equipo del 10/10/2026; RNF-08 conserva revisión específica. Los escenarios no se han ejecutado.

## Funciones

Cada RF-01 a RF-29 incluye los criterios CA correspondientes en la especificación. Para revisión de requerimientos, leer el escenario al cliente, confirmar el resultado esperado y registrar cambios en el acta. Para ejecución futura, registrar fecha, versión de producto, datos utilizados, resultado real, evidencia y responsable.

## Atributos, interfaces, restricciones y datos

### PV-RNF-01

- Requisito: RNF-01. Base: DEC-11.
- Preparación: Carga de DEC-11, 100 consultas y 100 eventos con conexión disponible.
- Acción: Medir desde solicitud hasta historial visible; para aviso, desde recepción backend hasta solicitud a Telegram.
- Resultado esperado: Al menos 95/100 cumplen 3 s y 5 s respectivamente; entrega externa se mide aparte.
- Estado de ejecución: no ejecutado.

### PV-RNF-02

- Requisito: RNF-02. Base: DEC-07.
- Preparación: Sensores y reloj disponibles en maqueta.
- Acción: Comparar marcas de tiempo de lecturas ambientales y de peso.
- Resultado esperado: Períodos de 10 s y 1 s respectivamente según DEC aprobada.
- Estado de ejecución: no ejecutado.

### PV-RNF-03

- Requisito: RNF-03. Base: DEC-09.
- Preparación: Dos cuentas sin dispositivos compartidos.
- Acción: Intentar consultar historial/fotos y ejecutar controles ajenos desde web y solicitud directa.
- Resultado esperado: Se deniega el acceso; ninguna acción modifica el dispositivo ajeno.
- Estado de ejecución: no ejecutado.

### PV-RNF-04

- Requisito: RNF-04. Base: Base recopilada.
- Preparación: Cuna con registros de un bebé A y bebé B sin registros.
- Acción: Reasignar la cuna a B y registrar actividad nueva.
- Resultado esperado: Datos antiguos siguen en A; nuevos pertenecen a B; no se elimina ninguno.
- Estado de ejecución: no ejecutado.

### PV-RNF-05

- Requisito: RNF-05. Base: Base recopilada.
- Preparación: Transmisión de voz iniciada y almacenamiento accesible a revisión.
- Acción: Transmitir, detener y revisar datos persistidos.
- Resultado esperado: Solo se conserva la actividad; no existe grabación de voz ni audio del bebé.
- Estado de ejecución: no ejecutado.

### PV-RNF-06

- Requisito: RNF-06. Base: DEC-10.
- Preparación: Colchón activo y datos guardados.
- Acción: Interrumpir conexión y recuperar.
- Resultado esperado: No aparecen lecturas fabricadas y el monitoreo se muestra detenido hasta rearme.
- Estado de ejecución: no ejecutado.

### PV-RNF-07

- Requisito: RNF-07. Base: DEC-09.
- Preparación: Anchos de 360 y 1280 píxeles.
- Acción: Recorrer cuentas, controles, historial y exportación.
- Resultado esperado: Nombres, unidades y acciones quedan visibles sin solapamientos; navegadores por acordar.
- Estado de ejecución: no ejecutado.

### PV-RNF-08

- Requisito: RNF-08. Base: Propuesta RNF-08.
- Preparación: Versión de entrega e instrucciones disponibles.
- Acción: Otro integrante reproduce la demostración siguiendo las instrucciones.
- Resultado esperado: Puede completar la demostración y localizar evidencia de criterios.
- Estado de ejecución: no ejecutado.

### PV-INT-01

- Requisito: INT-01. Base: RF-03, RF-04, RF-06.
- Preparación: Cuenta con los módulos asociados.
- Acción: Recorrer la interfaz y Bebés y dispositivos.
- Resultado esperado: Se accede a los controles y consultas de cada módulo.
- Estado de ejecución: no ejecutado.

### PV-INT-02

- Requisito: INT-02. Base: RF-08 a RF-23, RF-29.
- Preparación: Una entrada y salida por tipo de hardware definido.
- Acción: Provocar movimiento, apertura, peso, temperatura, humedad y botón; accionar luces y audio.
- Resultado esperado: Se obtiene el comportamiento definido por el RF correspondiente.
- Estado de ejecución: no ejecutado.

### PV-INT-03

- Requisito: INT-03. Base: RF-18, RF-24.
- Preparación: Evento y fotografía nuevos.
- Acción: Guardar y volver a consultar desde la aplicación.
- Resultado esperado: Se recuperan con asociación correcta a bebé/dispositivo.
- Estado de ejecución: no ejecutado.

### PV-INT-04

- Requisito: INT-04. Base: RF-06, RF-07.
- Preparación: Dos destinatarios configurados.
- Acción: Cerrar la web y producir un evento habilitado.
- Resultado esperado: Ambos reciben el aviso; no contiene fotografía.
- Estado de ejecución: no ejecutado.

### PV-INT-05

- Requisito: INT-05. Base: RF-27, DEC-06.
- Preparación: Registros disponibles.
- Acción: Descargar y abrir exportación en Excel.
- Resultado esperado: Filas de datos legibles con fecha, hora y evento, sin imágenes o enlaces de fotos.
- Estado de ejecución: no ejecutado.

### PV-INT-06

- Requisito: INT-06. Base: RF-12.
- Preparación: Celular y cuna disponibles.
- Acción: Hablar desde el celular y finalizar transmisión.
- Resultado esperado: La cuna reproduce la voz en vivo sin audio de retorno ni grabación.
- Estado de ejecución: no ejecutado.

### PV-RD-01

- Requisito: RD-01. Base: Base recopilada.
- Preparación: Interfaz publicada para la demostración futura.
- Acción: Usar controles desde navegador.
- Resultado esperado: La solución opera como sitio web gratuito con los dispositivos.
- Estado de ejecución: no ejecutado.

### PV-RD-02

- Requisito: RD-02. Base: Decisión técnica del equipo.
- Preparación: Configuración de backend de la implementación futura.
- Acción: Revisar configuración y persistencia.
- Resultado esperado: La base de datos/backend utiliza Supabase conforme a elección del equipo.
- Estado de ejecución: no ejecutado.

### PV-RD-03

- Requisito: RD-03. Base: RF-29.
- Preparación: Diseño y maqueta futuros.
- Acción: Comparar alimentación, cinco botones y modularidad con alcance.
- Resultado esperado: Se respetan las restricciones listadas; sustituciones tienen coordinación registrada.
- Estado de ejecución: no ejecutado.

### PV-DAT-01

- Requisito: DAT-01. Base: RF-24.
- Preparación: Evento guardado y fotografía de habitación.
- Acción: Consultar sus atributos y asociación.
- Resultado esperado: Fecha, hora, tipo, descripción, bebé, dispositivo y datos aplicables están presentes.
- Estado de ejecución: no ejecutado.

### PV-DAT-02

- Requisito: DAT-02. Base: DEC-01.
- Preparación: Toma finalizada con 200 g iniciales y 150 g finales.
- Acción: Corregir el peso final a 140 g.
- Resultado esperado: La cantidad cambia de 50 g a 60 g y se conserva evidencia del valor anterior y su corrección.
- Estado de ejecución: no ejecutado.

### PV-DAT-03

- Requisito: DAT-03. Base: DEC-04, DEC-05, DEC-06.
- Preparación: Evento de límite de hora y recordatorio diario.
- Acción: Comparar historial, gráfico, aviso y exportación.
- Resultado esperado: La representación usa la misma zona America/Costa_Rica.
- Estado de ejecución: no ejecutado.

### PV-DAT-04

- Requisito: DAT-04. Base: RF-04, RF-05, RF-24.
- Preparación: Dispositivo con registros.
- Acción: Retirar un dueño y reasignar el dispositivo.
- Resultado esperado: Los registros permanecen; ningún flujo elimina el historial.
- Estado de ejecución: no ejecutado.
