import React from "react";
import { FaFileAlt, FaFolderOpen } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function LogsHelpModal(props) {
  return <HelpModal {...props} title="Visor de logs" icon={FaFileAlt}
    summary="Consulta archivos de registro sin alterar su contenido."
    quickStart={["Selecciona la carpeta de logs.", "Elige un archivo en la lista.", "Busca el evento y conserva el contexto."]}
    sections={[
      { title: "Lectura", icon: FaFileAlt, items: ["El visor trabaja en modo solo lectura.", "Muestra archivos de texto plano.", "Usa la búsqueda para ubicar fechas, IDs o errores."] },
      { title: "Actualización", icon: FaFolderOpen, items: ["Recarga la carpeta para ver archivos nuevos.", "Cambia de archivo sin modificar el origen.", "Mantén la carpeta raíz del servicio correcta."] },
    ]}
    tip="Cuando investigues un error, revisa unas líneas antes y después del mensaje para no perder la causa real." />;
}
