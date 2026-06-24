import React from "react";
import { FaFolderOpen, FaImages, FaSyncAlt } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function ScreensInfoModal(props) {
  return <HelpModal {...props} title="Pantallas" icon={FaImages}
    summary="Explora, edita y previsualiza los recursos HTML, CSS, JavaScript e imágenes de una carpeta."
    quickStart={["Selecciona la carpeta raíz del proyecto.", "Abre un recurso desde el árbol.", "Guarda o previsualiza el resultado."]}
    sections={[
      { title: "Editor", icon: FaImages, items: ["Autocompletado HTML y JavaScript en el editor.", "Indicadores por pestaña para cambios y errores.", "F2 cambia el nombre del recurso seleccionado."] },
      { title: "Recursos", icon: FaFolderOpen, items: ["Puedes copiar y pegar archivos entre carpetas cargadas.", "Las rutas relativas sugieren recursos de la carpeta.", "Las imágenes y GIF se abren en previsualización."] },
      { title: "Refrescar", icon: FaSyncAlt, items: ["Úsalo tras editar archivos fuera de EVA Studio.", "Recarga la lista y limpia la caché de la vista.", "Los errores se muestran solo en el archivo que los contiene."] },
    ]}
    shortcuts={[{ keys: "Ctrl + S", label: "Guardar recurso" }, { keys: "F2", label: "Renombrar" }, { keys: "Tab", label: "Aceptar sugerencia" }]}
    tip="Los cambios no guardados permanecen marcados en naranja; revísalos antes de recargar la carpeta." />;
}
