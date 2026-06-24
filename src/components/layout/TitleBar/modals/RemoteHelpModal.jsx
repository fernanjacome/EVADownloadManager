import React from "react";
import { FaDesktop, FaPlug } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function RemoteHelpModal(props) {
  return <HelpModal {...props} title="Remoto (VNC)" icon={FaDesktop}
    summary="Conéctate a un equipo remoto para observar o controlar la sesión VNC."
    quickStart={["Indica IP y puerto del servidor VNC.", "Ingresa la contraseña si se requiere.", "Conecta y espera la pantalla remota."]}
    sections={[
      { title: "Conexión", icon: FaPlug, items: ["El equipo remoto debe tener VNC activo.", "Usa una IP y puerto accesibles desde tu red.", "La contraseña es opcional según el servidor."] },
      { title: "Sesión", icon: FaDesktop, items: ["Puedes interactuar con el escritorio remoto.", "La sesión se cierra al cambiar de módulo.", "Si no carga, valida red, IP, puerto y credenciales."] },
    ]}
    tip="Evita abrir dos sesiones contra el mismo equipo si otra persona está realizando una operación crítica." />;
}
