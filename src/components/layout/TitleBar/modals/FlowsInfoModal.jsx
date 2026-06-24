import React from "react";
import { FaMousePointer, FaProjectDiagram, FaRoute } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function FlowsInfoModal(props) {
  return <HelpModal {...props} title="Flujos" icon={FaProjectDiagram}
    summary="Visualiza los states y las transiciones del XML como un diagrama navegable."
    quickStart={["Selecciona un state de inicio.", "Usa el zoom para leer las conexiones.", "Abre el XML desde el state que quieres revisar."]}
    sections={[
      { title: "Interacción", icon: FaMousePointer, items: ["Clic en un state para abrir su flujo.", "Clic derecho para ver parámetros o ir al XML.", "Ctrl + rueda ajusta el zoom del diagrama."] },
      { title: "Cómo leerlo", icon: FaRoute, items: ["Cada línea es una transición entre states.", "GoodState, ErrorState y TimeoutState son rutas comunes.", "SWITCH crea una ruta por cada ValueN / StateN."] },
    ]}
    tip="El diagrama facilita la revisión, pero el comportamiento real siempre está definido por el XML guardado." />;
}
