## EVA XML MANAGER

[06/05/2026]

- Version 1.3.0.
- Se agrego el modulo Comparar con comparacion lado a lado, minimap, scroll sincronizado, diferencias inline y bloques fantasma.
- Se agrego motor propio de diferencias con LCS, alineacion contextual y heuristicas XML.
- Se agrego persistencia del estado del comparador y registro de cambios con restauracion.
- Se agrego guardado por panel y sincronizacion con el modulo XML cuando corresponde.

[30/04/2026 - 10:41PM]

- Se agrego boton para expotrar a PNG el flujo desplegado en el modulo de flujos.

[30/04/2026]

- Version 1.2.3
- Se agrego snippets para modulo xml
- Se agrego menu para personalizar snippets
- Se agrego cuadro de sugerencias
- Se agrego navegacion entre states dentro del xml, con contrl + click

[29/04/2026 - 7:58PM]

- Version 1.2.2
- Se agrego menu contextual con click derecho en modulo xml
- Se agrego opcion para plegar/desplegar en modulo xml

[29/04/2026 - 7:33PM]

- Version 1.2.1
- Se mejoro cards y nodos en el modulo de flujos

[29/04/2026]

- Version 1.2.0
- Se agrego modulo de flujos

[17/12/2025]
Corregir arrastre de archivos.
Implementar guardado de sesión y boton para cerrar nodos.

[10/12/2025]
No es viable un modulo de conexion remota desde 0.
Probablemente haga uso de ThightVNC para este proposito.

[9/12/2025]
Probando conexion remota
{
"type": "CHAT | LOG | COMMAND | CONTROL | FRAME",
"from": "ID_DEL_CLIENTE",
"to": "ID_DESTINO | null",
"payload": {}
}

[26/9/2025]
-Se agrego control de guardado con Cntrl+S y busqueda con Cntrl+F
-Se agrego un buscador en el sidebar que busca y filtra respecto las keys principales y comments

-Se agrego una diferenciacion entre el modo lectura y edicion

-Se agrego un componente de notifiacion para uso del XML

-Se agregaron 2 botones para restaurar el archivo
--Desde el ultimo cambio guardado
--Archivo original

[26/9/2025]
-Se agrego botones para controlar la fuente del editor de codigo.

[30/9/2025]
-Se agrego panel de configuracion general (GeneralConfigPanel).
-Se cambio de Ctrl + F -> a Ctrl + B para acceder al buscador del sidebar.
-Se creo un buscador para el editor de codigo (SearchBar).
-Ctrl + F ahora abre SearchBar.
-Notifiaciones ahora alertan linea y columna en caso de error en validacion del XML.
