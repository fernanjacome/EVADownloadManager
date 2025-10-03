# EVA Download Manager

Versión: 1.0.0  
Última actualización: 2 de octubre de 2025

---

## Actualizaciones Recientes

- Panel de configuración general.
- Buscadores independientes en sidebar y editor.
- Notificaciones con detalles de error.
- Control de fuente en el editor.
- Modales de ayuda y documentación integrada.

---

## Descripción General

EVA Download Manager es una aplicación para gestionar archivos XML de configuración para cajeros integrados con EVA. Permite importar, editar, validar, exportar y organizar archivos XML con una interfaz moderna y funcionalidades avanzadas.

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

---

## Autor

Fernando Jácome  
Extreme Visual Appliance

---

## Licencia

MIT
