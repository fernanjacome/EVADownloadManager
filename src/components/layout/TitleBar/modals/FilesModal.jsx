import React from "react";
import { FaFileImport, FaSave, FaTrash } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function FilesModal(props) {
  return <HelpModal {...props} title="Archivos" icon={FaFileImport}
    summary="Carga, guarda y organiza el XML abierto en esta ventana."
    quickStart={["Importa un XML o crea uno nuevo.", "Edita y guarda los cambios.", "Usa Restablecer solo si quieres limpiar la sesión."]}
    sections={[
      { title: "Acciones", icon: FaFileImport, items: ["Importar carga un XML desde disco.", "Guardar escribe los cambios en el archivo.", "Eliminar limpia el XML de esta ventana."] },
      { title: "Sesión", icon: FaSave, items: ["El workspace se restaura al abrir EVA Studio.", "Cada ventana conserva su propio estado.", "Guarda antes de distribuir una copia."] },
      { title: "Limpieza", icon: FaTrash, items: ["Restablecer no es una forma de guardar.", "Verifica los cambios pendientes antes de limpiar.", "Usa una copia si necesitas experimentar."] },
    ]}
    tip="Mantén una copia versionada del XML antes de cambios que afecten muchos states." />;
}
