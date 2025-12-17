## EVA XML MANAGER

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
