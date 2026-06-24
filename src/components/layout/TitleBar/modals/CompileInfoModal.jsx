import React from "react";
import { FaCheckCircle, FaPlayCircle, FaServer } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function CompileInfoModal(props) {
  return <HelpModal {...props} title="Compilador" icon={FaPlayCircle}
    summary="Envía el XML revisado al servicio de compilación y muestra el resultado en la consola."
    quickStart={["Guarda y valida el XML.", "Confirma servidor, puerto, BAT e ID.", "Ejecuta y revisa la consola."]}
    sections={[
      { title: "Antes de compilar", icon: FaCheckCircle, items: ["Debe existir un XML abierto y válido.", "Verifica que la API del compilador esté disponible.", "Revisa los cambios pendientes antes de ejecutar."] },
      { title: "Conexión", icon: FaServer, items: ["Servidor: equipo que ejecuta el compilador.", "Puerto: servicio de compilación configurado.", "BAT e ID: proceso e identificador de destino."] },
    ]}
    tip="Si la compilación falla, conserva el mensaje de consola: identifica con precisión el servicio o el XML que debe revisarse." />;
}
