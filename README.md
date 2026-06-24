# EVA Studio 2026

Version: 1.3.2
Ultima actualizacion: 6 de mayo de 2026

---

## Actualizador portable (`win-unpacked`)

Desde **Version** se puede buscar, descargar y aplicar una actualización sin instalador. El proceso verifica el SHA-512 del ZIP, cierra EVA Studio, reemplaza la carpeta `win-unpacked` y abre de nuevo el ejecutable.

El canal se configura desde **Version** pegando una URL HTTPS o una ruta compartida. Si se pega una carpeta compartida, EVA Studio busca automáticamente `latest.json` dentro de ella. También se puede crear `update-config.json` en la carpeta de datos de EVA Studio (o definir `EVA_UPDATE_MANIFEST_URL` al arrancar):

```json
{
  "manifestUrl": "https://actualizaciones.ejemplo.com/eva-studio/latest.json"
}
```

Ejemplo para la carpeta compartida indicada:

```json
{
  "manifestUrl": "\\\\192.168.10.101\\Personales\\FJacome\\EVAStudio"
}
```

El manifiesto puede estar en HTTPS o en la misma carpeta compartida y debe tener este formato. El ZIP debe contener la carpeta portable con `EVA Studio 2026.exe`. Para una ruta compartida, `url` puede ser solo el nombre del ZIP.

```json
{
  "version": "1.3.2",
  "url": "EVA-Studio-2026-1.3.2-win-unpacked.zip",
  "sha512": "HASH_SHA512_EN_BASE64_O_HEX",
  "notes": "Correcciones del módulo Pantallas"
}
```

---

## Actualizaciones v1.3.2

- Menú contextual del editor de Pantallas con formateo manual y la opción de formatear al guardar.
- Nombre del recurso centrado sobre la previsualización.

---

## Actualizaciones v1.3.1

- Ctrl + Z, Ctrl + Y y Ctrl + Shift + Z ahora centran el editor de Pantallas en la línea donde se restauró o rehízo el cambio.

---

## Navegación en recursos

- Al elegir un resultado en el buscador de contenido de Pantallas, EVA Studio abre el archivo correcto y centra el editor en la línea de la coincidencia.

---

## Pantallas y ayuda

- Ayuda rediseñada para XML, Comparador, Pantallas, Compilador, Flujos, Logs, Remoto y atajos, con pasos accionables y cierre por Escape.
- Ventana Version actualizada con los cambios desde la 1.3.1.
- Pantallas: mejoras de autocompletado, validación de errores, rutas relativas, F2 para renombrar, copia entre carpetas y persistencia de pestañas.
- Actualizador portable mediante ZIP validado con SHA-512, con soporte para canales HTTPS y rutas compartidas.

---

## Actualizaciones v1.3.0 [Comparador XML]

- Nuevo modulo Comparar para revisar dos archivos XML o texto lado a lado.
- Comparacion visual estilo Beyond Compare con panel izquierdo/derecho, scroll sincronizado, minimap, filas fantasma y diferencias inline.
- Motor propio de diff con LCS, alineacion contextual, heuristicas XML por tags/atributos y deteccion de bloques movidos.
- Soporte para XML grandes con renderizado virtualizado.
- Carga de archivos por lado conservando ruta completa.
- Persistencia del estado del comparador: archivos cargados, rutas, opciones, scroll, historial y altura del registro de cambios.
- Copia de bloques entre lados, incluyendo eliminacion desde el lado fantasma cuando el bloque solo existe en el lado contrario.
- Registro inferior de cambios con restauracion individual, restaurar todo y Ctrl+Z.
- Botones por panel para guardar o vaciar el lado correspondiente.
- El guardado sincroniza el modulo XML cuando el archivo guardado es el XML abierto actualmente.
- Opciones para ignorar espacios, ignorar comentarios y comparar con sensibilidad a mayusculas.

---

## Actualizaciones v1.1.0 [EVA Studio 2026]

- Cambio de nombre EVA Download Manager -> EVA Studio 2026
  - Se agrego persistencia de estado de sesion mediante archivo en appdata.
  - Compilador ahora responde mediante WebSocket para respuesta de la consola en timepo real.
  - Nueva imagen de icono.
  - Nuevo Modulo Remoto, utilizando la tecnologia VNC y el cliente noVNC para el frontend. El backend se encarga de levantar un websocket conectado al VNC Server.
  - Se quito el modo de arrastrar archivos XML (Causaba bugs, en un futuro se podria reintegrar).
  - Se agrego al menu "Archivo" boton de Recargar ventana -> Se encarga de hacer un recarga completa, borrando el cache.
  - Se agrego al menu "Archivo" boton de Restablecer -> Restablece todos los estados a su valor por defecto y borra el cache.
  - Se quito Easter Egg de navidad.
    [PENDIENTE]
  - Agregar pantalla completa para el Remote.
  - Agregar uso de teclado optimizado (mientras el Remote Viewer tenga el foco, las teclas solo se transmitiran al viewer, no al host).
  - Agregar sistema de traslado de archivos (Solo Pages?)

## Actualizaciones v1.0.5

- Nuevo módulo: Compilar
  - Compilacion usando Extreme.EVA.Compiler.exe mediante el formulario.
  - Respuesta del .bat ejecutado visible en consola.
  - [Easter Egg] Copo navideño.

## Actualizaciones v1.0.4

- Nuevo módulo: Pantallas
- Se agregó visor de pantallas HTML independiente del XML.
- Carga una carpeta y lista automáticamente todos los .html.
- Renderiza con servidor estático para que CSS/JS funcionen correctamente.
- Botón de refresco limpia caché y recarga todo.
- Vista de 1024×768 con escalado adaptable.
- Navegación lateral de pantallas y modal informativo.

---

## Actualizaciones v1.0.3

- Ahora cualquier cambio se actualiza directamente en el archivo.
- Se agregaron tooltips para los botones.
- Se agregaron tooltips para los items del arbol de navegacion.
- Se establecio un control personalizado de la anchura del arbol de navegacion.
- Se implemento el comando Control + / para comentar/descomentar lineas o bloques de codigo.

---

## Actualizaciones v1.0.2

- En el modo dividir pantalla, el control por el sidebar ahora se realiza al editor que tenga el focus seleccionado.
  -Ahora ambos editores son editables y se sincronizan.
- Optimizacion de contraste en bordes.
- Se agrego el modo claro.
- Mejora de iconos en el TitleBar

---

## Actualizaciones v1.0.1

- Pantalla Divida.
- Correccion de bug visual en panel de configuración
- Se agrego validacion de exportación.
- Se agrego valdiacion antes de salir sin guardar cambios.
- Se agrego por defecto un download cargado.

---

## Descripción General

EVA Studio 2026 es una aplicación para gestionar archivos XML de configuración para cajeros integrados con EVA. Permite importar, editar, validar y organizar archivos XML con una interfaz moderna y funcionalidades avanzadas.

---

## Instalación y Ejecución

```sh
npm install
npm run dev           # Solo frontend
npm run electron:dev  # App completa con Electron
```

---

## Funcionalidades Principales

### Carga y gestión de archivos XML

- Importa archivos XML locales.
- Crea un archivo base (`default.xml`).
- Elimina el archivo cargado.
- Exporta el XML editado.

### Edición avanzada

- Editor de código con [CodeMirror](src/components/CodeEditor.jsx).
- Formateo automático del XML (`formatXml`).
- Panel de configuración general para editar parámetros globales.
- Restaurar archivo al estado original o al último guardado.

### Validaciones

- Verifica que el XML esté bien formado y sin errores de sintaxis.
- Controla que no existan IDs duplicados en secciones clave.
- Asegura la presencia de la estructura raíz `<Download>`.
- Notifica errores con línea y columna si corresponde.

### Navegación y búsqueda

- Barra lateral con grupos (`States`, `Screens`, `Fits`, etc.) usando [`sidebarConfig`](src/utils/sidebarConfig.js).
- Buscador en la barra lateral (Ctrl+B) y en el editor de código (Ctrl+F).
- Filtrado por atributos clave y comentarios.
- Selección de elementos para navegación rápida en el editor.

### Notificaciones

- Sistema de notificaciones para éxito, error, advertencia e información.
- Mensajes apilados y autodestructibles.

### Interfaz y usabilidad

- Paneles modales de ayuda, formato, validaciones, errores comunes, atajos y recomendaciones.
- Atajos de teclado:
  - Ctrl+B: Buscar en la barra lateral
  - Ctrl+F: Buscar en el editor
  - Ctrl+S: Guardar cambios
  - Ctrl + Wheel: Zoom en el editor
  - Ctrl + /: Comentar/descomentar lineas o bloques de codigo.
- Control de fuente del editor (aumentar, disminuir, restablecer).
- Animaciones y estilos modernos.

### Integración con Electron

- Ventana sin marco, controles personalizados (minimizar, maximizar, cerrar).
- Cambia el título de la ventana según el archivo cargado.
- Soporte para abrir múltiples ventanas.

---

## Estructura del Proyecto

- [`App.jsx`](src/App.jsx): Orquestador principal, gestiona el estado global y decide qué componentes mostrar.
- [`Header.jsx`](src/components/Header.jsx): Acciones principales y metadata del archivo.
- [`Sidebar.jsx`](src/components/Sidebar.jsx): Navegación por grupos y búsqueda.
- [`CodeEditor.jsx`](src/components/CodeEditor.jsx): Edición y búsqueda de código XML.
- [`GeneralConfigPanel.jsx`](src/components/GeneralConfigPanel.jsx): Panel para editar parámetros generales.
- [`NotificationContainer.jsx`](src/components/NotificationContainer.jsx): Muestra notificaciones.
- [`TitleBar.jsx`](src/components/TitleBar/TitleBar.jsx): Menú superior y modales de ayuda.
- [`xmlUtils.js`](src/utils/xmlUtils.js): Utilidades para parsear, serializar, formatear y validar XML.

---

## Atajos de Teclado

- Ctrl+B: Buscar en la barra lateral
- Ctrl+F: Buscar en el editor de código
- Ctrl+S: Guardar cambios
- Ctrl + (WheelUp/WheelDown): Zoom en el editor

---

## Validaciones

- Sintaxis y formato XML.
- IDs únicos en secciones clave.
- Estructura raíz `<Download>`.
- Exportación segura.

---

## Historial de Versiones

- 1.0.0
  Versión inicial con todas las funcionalidades descritas arriba.
- 1.0.1
  Versión inicial con optimización.
- 1.0.2
  Versión inicial con modo claro agregado.

---

## Autor

Fernando Jácome  
Extreme Visual Appliance

---
