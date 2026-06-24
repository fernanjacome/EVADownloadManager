import React from "react";
import { FaLightbulb, FaSave } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function TipsModal(props) {
  return <HelpModal {...props} title="Recomendaciones" icon={FaLightbulb}
    summary="Una rutina breve para trabajar con cambios de forma segura."
    quickStart={["Guarda una copia antes de cambios grandes.", "Edita y valida una sección por vez.", "Revisa Flujos y Pantallas antes de compilar."]}
    sections={[
      { title: "Buenas prácticas", icon: FaSave, items: ["Usa comentarios claros en los states complejos.", "Evita cambiar IDs sin revisar sus referencias.", "Guarda con frecuencia durante una edición larga."] },
      { title: "Diagnóstico", icon: FaLightbulb, items: ["Primero revisa la validación de XML.", "Después sigue el recorrido en Flujos.", "Confirma que las pantallas referenciadas existen."] },
    ]}
    tip="Cambios pequeños, guardados y verificables son mucho más fáciles de revertir y explicar." />;
}
