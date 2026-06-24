import React from "react";
import { FaCode, FaMousePointer, FaSearch } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function XmlHelpModal(props) {
  return (
    <HelpModal
      {...props}
      title="Editor XML"
      icon={FaCode}
      summary="Edita la configuración EVA con navegación, búsqueda y validaciones."
      quickStart={[
        "Abre un XML desde Archivo.",
        "Navega por una sección desde el panel lateral.",
        "Guarda y revisa las validaciones.",
      ]}
      sections={[
        {
          title: "Edición",
          icon: FaCode,
          items: [
            "Resaltado de sintaxis y autocompletado.",
            "Snippets para bloques de XML frecuentes.",
            "Validación de IDs duplicados al guardar.",
          ],
        },
        {
          title: "Navegación",
          icon: FaMousePointer,
          items: [
            "Ctrl + clic en una referencia para saltar.",
            "Selecciona una sección del panel lateral.",
            "Mantén el foco en el editor para usar sus atajos.",
          ],
        },
      ]}
      shortcuts={[
        { keys: "Ctrl + F", label: "Buscar" },
        { keys: "Ctrl + S", label: "Guardar" },
        { keys: "Ctrl + /", label: "Comentar" },
        { keys: "Ctrl + clic", label: "Ir a referencia" },
      ]}
      tip="Guarda antes de cambiar de módulo si necesitas que Flujos o Compilador lean la última versión."
    />
  );
}
