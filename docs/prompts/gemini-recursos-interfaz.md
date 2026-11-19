# Gemini · Imágenes e iconos para Cuna Inteligente IoT

Si usas Gemini en el navegador, pega el bloque A y una fila de la tabla por turno. Descarga cada imagen en la carpeta indicada. Después pega el bloque B para los iconos. Si usas Gemini con acceso al repositorio, pídele que escriba los archivos directamente en esas rutas. Las dos carpetas parten de la raíz de ProyectoModelado.

## A. Imágenes de producto

> Genera una sola imagen de catálogo del producto descrito en la fila que adjunto. Se usará como superficie interactiva en una aplicación para personas que cuidan a un bebé. Al tocar una pieza, la aplicación abrirá sus controles. Por eso cada pieza importante debe distinguirse incluso cuando toda la imagen mida 320 px de ancho. Si adjunto una foto de la maqueta, respeta sus piezas y su distribución. Si solo adjunto la descripción, crea una representación conceptual coherente con ella.
>
> Usa encuadre horizontal 4:3, idealmente 1200 × 900 px, vista de tres cuartos ligeramente elevada, objeto completo centrado con un margen de alrededor del 10 %. Fondo liso marfil, luz suave desde arriba a la izquierda y una sombra de contacto corta. Materiales mates, madera clara cuando corresponda y pequeños acentos verde petróleo. Mantén esta dirección en toda la serie. Usa la primera imagen aprobada como referencia de iluminación y encuadre para las siguientes.
>
> Deja espacio alrededor de las zonas indicadas para que la aplicación superponga botones. Entrega la imagen limpia de texto, flechas, marcas de agua, iconos y pantallas de aplicación. Evita personas y accesorios decorativos. Entrega un archivo individual en PNG o WebP. Después de la imagen indica por escrito dónde quedó cada pieza, medida en porcentajes desde la esquina superior izquierda de la imagen completa.

Guarda los archivos en `src/frontend/public/productos/`. Los nombres de la tabla son nombres base. Conserva la extensión del formato descargado.

| Nombre | Descripción para adjuntar al bloque A |
|---|---|
| `cuna` | Cuna vacía de madera clara con una pequeña lámpara en la cabecera izquierda, rejilla de parlante en el lateral derecho y módulo sensor en el exterior de la cabecera. Haz visibles las tres piezas desde el mismo ángulo. Deja el centro despejado. |
| `figuras-led` | Accesorio independiente que se coloca encima de la cuna. Muestra el conjunto completo con seis puntos de luz difusa distribuidos entre las figuras. Deja un margen amplio cerca del soporte para los accesos de secuencia y tiempo. |
| `colchon` | Colchón infantil rectangular visto en diagonal, con superficie de pesaje despejada y pequeño módulo exterior con botón físico. Se debe distinguir fácilmente el colchón del módulo. |
| `habitacion` | Vista sencilla de un rincón de habitación con el kit de monitoreo. Distribuye los sensores que aparecen en la referencia del proyecto; si la forma exacta se desconoce, usa carcasas discretas. Deja despejadas las zonas donde se consultarán sus eventos. |
| `alimentacion` | Base de pesaje con biberón de pie y zona de medición de temperatura visible. Separa visualmente la botella y la plataforma para que cada una pueda tener un acceso táctil. |
| `juego` | Juguete interactivo de sobremesa con cinco botones grandes y una salida de sonido. Haz reconocibles los cinco botones en una sola vista. La aplicación utilizará esta imagen cuando la rama incluya el módulo. |

## B. Iconos funcionales

> Crea una familia original de iconos para la misma aplicación. Devuélveme el código SVG de cada archivo, con su nombre y un bloque independiente. Usa viewBox de 24 × 24, fondo transparente, trazo de 1.8 a 2 unidades, extremos redondos y siluetas que se distingan a 24 px. Usa currentColor para el trazo. Solo geometría vectorial estática, sin fuentes, imágenes incrustadas, scripts, estilos remotos ni referencias externas. Cada icono debe expresar una sola idea. La aplicación agregará el rótulo y el indicador de selección.
>
> Entrega estos archivos. Para navegación: productos.svg (cuna de perfil), historial.svg (reloj con flecha), usuario.svg (silueta de persona). Para las piezas: lampara.svg (bombilla), audio.svg (parlante), voz.svg (micrófono), movimiento.svg (sensor con ondas), ambiente.svg (termómetro con gota), peso.svg (balanza), figuras.svg (estrellas), temperatura.svg (termómetro), alarma.svg (campana), horario.svg (reloj), calendario.svg (hoja mensual), toma.svg (biberón). Mantén el mismo peso visual en toda la familia.

Guarda cada bloque como archivo `.svg` en `src/frontend/public/iconos/`. Conserva los nombres para que Claude pueda asociarlos con las pestañas y las piezas.
