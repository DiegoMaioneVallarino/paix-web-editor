# Pairtial · Wireframe editor 0.1
Extrae el ZIP y abre **Pairtial.html** para trabajar sin conexión. Incluye una compilación de React y el núcleo de wireframes de Paix.js. Para desarrollar con Node 22 y CMD:
```cmd
npm ci
npm run dev
```
`npm run build` comprueba TypeScript, genera dist y actualiza el HTML autónomo.

## Editor visual
La barra superior reúne selección, filas, columnas, cortes, cuadrícula, cortes centrados, margen interior y capas. El último botón abre el panel del proyecto. El lienzo oscuro muestra la composición actual y las divisiones pendientes aparecen en violeta. En una cuadrícula puedes ajustar columnas y filas por separado.

Usa los botones de móvil y escritorio para cambiar las dimensiones. Arrastra la pestaña derecha, la inferior o la esquina para ajustar el dispositivo. Con el foco en una pestaña, las flechas ajustan un píxel y Mayús + flecha ajusta diez. Abre el panel inferior para recorrer el árbol de izquierda a derecha, crear, guardar, rotar o escribir un tamaño exacto. La barra izquierda abre la jerarquía, el código y Smart Colors. La pestaña Capas Z del lateral derecho enumera las capas superpuestas por grupo. Selecciona una para editarla en el lienzo. La paleta modifica la vista del editor durante la sesión. El archivo .paix y la exportación React describen la estructura.

## Gestos
1. Activa Corte vertical y haz clic en main. Mueve el puntero sin mantener el botón presionado. Otro clic congela la división. Elige px, Izquierda y escribe 240.
   Para una columna o fila central, la distancia del puntero al centro determina la mitad de su ancho o alto. Haz clic para fijarla y pulsa Aplicar.
2. Pulsa Aplicar. Elige Filas, haz clic en la segunda celda y sube un paso la rueda. Aplica para crear tres filas. Arrastra la etiqueta ↔ Valor o escribe para ajustar con precisión.
3. Cambia Ancho para probar el comportamiento responsive. Guarda el archivo .paix y ábrelo de nuevo. El ejemplo Editorial reproduce esta estructura.
4. Esc cancela el borrador. Enter aplica. Ctrl+Z deshace una edición confirmada. La pestaña Código .paix permite editar y validar el mismo documento.
5. Exportar React descarga un componente TSX independiente. Colócalo en un contenedor con ancho y alto definidos. Sus áreas vacías sirven para montar tu contenido.

## DSL
El parser Chevrotain, el AST y WireframeRenderer proceden de paix-editor-fixes. La edición visual admite filas, columnas, cuadrícula, cortes simples y centrados, margen interior y capas con áreas nombradas. El editor rechaza instrucciones fuera de este subconjunto. La extensión opcional `@end` tras la medida fija el segundo lado. Para leerla en otro proyecto Paix hay que incorporar el cambio al lexer, gramática, AST y renderer. Los cortes por el primer lado usan la sintaxis existente.

```text
wireframe "Editorial"
main slice vertical 240px > "lateral" "contenido"
contenido slice rows 3 > "cabecera" "articulo" "pie"
```

Los PNG de las herramientas proceden de la carpeta neowebcore del prototipo. El guardado en archivo incluye el wireframe confirmado. El zoom del navegador, la selección, el historial y las dimensiones del dispositivo pertenecen a la sesión de edición. La última fuente confirmada se almacena localmente si el navegador lo permite.
"# paix-web-editor" 
