# Claude Code · Rediseño móvil de Cuna Inteligente IoT

Implementa el rediseño en el frontend existente de ProyectoModelado (React, TypeScript y Vite). Una persona que usa la aplicación con una mano debe poder elegir su producto, reconocer la pieza que busca, tocarla, ajustar su valor y entender qué ocurrió.

## Antes de editar

Lee `CLAUDE.md`, `src/frontend/CLAUDE.md`, `src/frontend/PLAN.md`, `src/frontend/src/App.tsx` y `src/frontend/src/components/Layout.tsx`. Identifica las fases y los commits del plan que corresponden a las pantallas afectadas. Revisa el árbol de trabajo y compara en modo lectura las versiones de las páginas en `development` y `VersionFunc`. Conserva los cambios locales, rutas directas, permisos, banderas de funciones y contratos del checkout de trabajo. Reutiliza los servicios, hooks, paneles y pruebas que ya resuelven cada operación.

## Imagen principal de Productos

Usa la imagen ya incluida en `src/frontend/public/productos/habitacion-interactiva.png` (1672 × 941 px). En Vite su URL pública es `/productos/habitacion-interactiva.png`. Es la escena de inicio de Productos. Muéstrala completa, en su proporción original, con controles HTML superpuestos. Cada objeto abre la vista correspondiente. La selección solo navega y permite consultar los ajustes antes de enviar cualquier orden.

| Objeto visible | Centro del botón (x, y) desde arriba a la izquierda | Al tocar |
|---|---|---|
| Cuna de madera | 53 %, 48 % | Abrir la cuna en `/cuna`. |
| Colchón dentro de la cuna | 52 %, 65 % | Abrir pesaje y monitoreo en `/colchon`. |
| Luces de estrella, luna y nube | 88 %, 28 % | Abrir secuencias y tiempos en `/figuras`. |
| Sensor blanco de la pared | 36 %, 32 % | Abrir el panel de movimiento del kit en `/habitacion`. |
| Biberón sobre la cómoda | 82 %, 50 % | Abrir las tomas y la temperatura en `/alimentacion`. |

Mide los porcentajes respecto de la imagen renderizada. En celular, revisa especialmente los accesos de cuna y colchón: si las áreas de 44 px se tocan, desplaza el marcador de cuna hacia la izquierda a lo largo del barrote y conserva el del colchón sobre su superficie. Debajo ofrece los mismos cinco accesos con sus nombres. Comprueba los cinco destinos a 360 px y en escritorio.

## Recorrido principal

1. **Productos.** En celular, usa una barra inferior fija inspirada en la navegación de Instagram, con tres destinos rotulados: Productos, Historial y Usuario. Usa iconos de Gemini, resalta la sección actual y respeta el área segura y el espacio inferior del contenido. Productos abre la habitación interactiva descrita arriba. Al entrar a cualquier módulo, Productos sigue seleccionado. En escritorio adapta esos mismos destinos a una barra lateral o superior. Conserva acceso a las vistas especializadas, incluido Colchón (Pico), y el comportamiento de Atrás.
2. **Detalle del producto.** La imagen es la pieza central. Encima coloca botones HTML de al menos 44 × 44 px con el icono de la función, un nombre accesible y contraste sobre la foto. Ejemplo: al tocar la lámpara dibujada en la cabecera de la cuna, se abre «Lámpara», con nivel solicitado, control de brillo, acción «Aplicar» y estado de la orden. Tocar el dibujo solo abre el panel. En celular usa una hoja inferior con cierre visible. En escritorio, un panel junto a la imagen. Maneja foco al abrir y cerrar, tecla Escape y desplazamiento interno si hay varios ajustes.
3. **Correspondencia física.** Usa los archivos de `src/frontend/public/productos/` y `src/frontend/public/iconos/` descritos en `docs/prompts/gemini-recursos-interfaz.md`. Inspecciona el arte final. Define por producto puntos con identificador, etiqueta, icono, coordenadas porcentuales y panel asociado. Posiciónalos sobre un contenedor con la misma proporción que la imagen, evitando que el recorte o el espacio sobrante desplace los botones. Si dos funciones comparten pieza, un solo botón abre ambas opciones. Ofrece también una lista compacta «Funciones» que abra los mismos paneles y funcione aunque falte una imagen. Si falta un recurso, identifica su nombre al entregar.
4. **Aplica el patrón a cada producto integrado.** En Cuna, conecta lámpara, parlante y sensor con sus funciones disponibles. En Figuras LED, abre secuencias e intervalo desde el conjunto luminoso. En Colchón, lleva a peso, monitoreo y alarma según la vista existente. En Alimentación, el biberón abre temperatura y la base abre el flujo de pesaje de la toma. En Habitación, relaciona sensores con monitoreo y eventos. Si Juego tiene una pantalla integrada en la rama de trabajo, dale el mismo tratamiento. Una lectura abre su valor, unidad y hora de actualización. Solo ofrece ajustes respaldados por esa pantalla. Mantén visibles las alarmas activas y sus acciones urgentes aunque el panel de la pieza esté cerrado.
5. **Usuario y pantallas convencionales.** Crea una pestaña Usuario con los datos de la sesión actual, el cierre de sesión y acceso a «Bebés y dispositivos», dueños, invitaciones y Telegram según los permisos existentes. Mantén formularios, historial, gráficos, perfil y autenticación como pantallas normales, con títulos, campos y acciones legibles.

## Controles y aspecto

- **Hora.** Mejora el selector usado por `PanelHorarios`. Permite elegir hora y minutos con el dedo o escribir con teclado, muestra claramente la hora elegida y permite agregar, quitar y guardar según el flujo actual. Conserva el formato del servicio y la distinción entre programar una orden y programar un recordatorio.
- **Calendario.** En Historial, facilita escoger inicio y fin, incluidas sus horas. Muestra mes y año en español, navegación entre meses, fechas seleccionadas y resumen del intervalo antes de aplicarlo. Valida el orden del intervalo. Muestra fechas en `America/Costa_Rica` y conserva las conversiones UTC existentes; comprueba un intervalo que cruce medianoche.
- **Sliders y perillas.** Usa un deslizador para el brillo de la lámpara y una perilla para el intervalo de las figuras si el panel admite ese ajuste. La perilla debe poder operarse por arrastre, teclado y botones −/+; muestra el valor junto a su unidad. Lee mínimos, máximos y pasos de los contratos vigentes. Los cambios durante el arrastre actualizan el borrador local. Una sola acción «Aplicar» envía la orden. Distingue siempre el valor elegido, la solicitud pendiente y el valor confirmado por la Pico.
- **Botones.** Da prioridad visual a una acción por panel. Usa verbos concretos como «Guardar horario», «Iniciar toma» o «Aplicar brillo». Distingue pulsado, foco, enviando, deshabilitado y error. Evita dobles envíos y conserva el borrador si falla el guardado.
- **Acabado.** Fondo marfil, superficies claras, texto oscuro y verde petróleo como acento principal. Deja el color de alarma para estados que requieren atención, acompañado de texto. Usa tipografía legible, espacio suficiente entre controles y transiciones breves que respeten movimiento reducido. En el teléfono, el producto y sus funciones deben estar a la vista antes de cualquier texto secundario.

## Verificación y entrega

Desde `src/frontend`, ejecuta `npm run lint`, `npm run test` y `npm run build` (en PowerShell usa `npm.cmd` si corresponde). Recorre la aplicación a 360, 390, 768 y 1280 px. Verifica que la barra inferior no tape «Guardar», que un botón siga apuntando a la misma pieza tras rotar el teléfono y que se pueda completar la tarea con teclado. Prueba también el recorrido Productos → Cuna → Lámpara → ajustar → Aplicar, un horario de alimentación, un intervalo del historial y el acceso a Usuario. Comprueba en las pruebas que arrastrar no envíe órdenes y que un rechazo nunca aparezca como confirmación. Usa datos de prueba solo en tests. Indica qué verificaste en navegador y qué requeriría Supabase o una Pico conectada. Entrega el resumen, los resultados reales, el diff y un mensaje de commit propuesto.
