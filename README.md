# Flujo General de la Aplicación

## 1. App.jsx (Orquestador Principal)

- Mantiene en `state`:
  - `originalCode` → XML original cargado (inmutable).
  - `code` → XML editable en texto.
  - `xmlDoc` → versión parseada en `Document` para navegación.
  - `savedCode` → última versión guardada.
- Decide qué mostrar:
  - `<EmptyState />` si no hay XML cargado.
  - `<Sidebar />` y `<Editor />` si sí lo hay.
- Gestiona notificaciones globales.

---

## 2. Header.jsx

- Botones principales:
  - **Cargar XML** → dispara `onLoadClick`.
  - **Exportar** → habilitado solo si hay XML cargado.
  - **Eliminar XML** → dispara `onDeleteXml`.
- Muestra metadata del archivo cargado:
  - Nombre, tamaño, fecha de última modificación.

---

## 3. EmptyState.jsx

- Vista inicial si no hay XML cargado.
- Contiene botones sincronizados con el `Header`:
  - **Cargar XML** → usa el mismo `onLoadClick`.
  - **Nuevo XML** → reservado (aún sin lógica).
- No incluye exportación.

---

## 4. Sidebar.jsx

- Recibe `xmlDoc` (Document) desde `App`.
- Usa `sidebarConfig` para recorrer nodos (`States`, `Screens`, `Transactions`, etc.).
- Renderiza lista colapsable de elementos.
- Funcionalidades:
  - **Búsqueda** → filtra elementos (atajo `Ctrl+F`).
  - **Selección de ítems** → dispara `onSelect(id)` que `App` pasa al `Editor`.

---

## 5. Editor.jsx

- Recibe `code` (string) desde `App`.
- Usa **CodeMirror** para edición del XML.
- Funcionalidades:
  - **Guardar (`Ctrl+S`)** → valida y guarda cambios en `App`.
  - **Buscar (`Ctrl+B`)** → enfoca buscador de `Sidebar`.
  - **Formatear XML** → usa `formatXml` (indentación estándar).
  - **Restaurar archivo original**.
  - **Restaurar última versión guardada**.
- Cambios en el editor → llaman `onChange`, que actualiza `code` en `App`.

---

## 6. Notification.jsx

- Componente simple.
- Muestra mensajes de éxito, error o información.
- Controlado por el `state` de `App`.

---

# Resumen Técnico

- **App.jsx** mantiene el estado global del XML (original + editable).
- **Header / EmptyState** gestionan la carga y eliminación del XML.
- **Sidebar** permite navegar el XML parseado.
- **Editor** permite modificar el XML como texto.
- **Notification** informa los cambios al usuario.
- **Toda la lógica está centralizada en `App.jsx`.**
