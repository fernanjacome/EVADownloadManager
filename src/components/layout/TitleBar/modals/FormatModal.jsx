import React from "react";
import { FaCode, FaLayerGroup } from "react-icons/fa";
import HelpModal from "./HelpModal";

const sample = `<?xml version="1.0" encoding="utf-8"?>
<Download>
  <States>...</States>
  <Screens>...</Screens>
  <Fits>...</Fits>
  <General>...</General>
  <Transactions>...</Transactions>
  <TranMap>...</TranMap>
  <Errors>...</Errors>
</Download>`;

export default function FormatModal(props) {
  return <HelpModal {...props} title="Formato XML" icon={FaCode}
    summary="Estructura mínima esperada para un download EVA."
    sections={[
      { title: "Estructura", icon: FaLayerGroup, items: ["Download es el nodo raíz.", "Mantén las secciones principales dentro del mismo nodo.", "Cierra cada tag antes de guardar."] },
      { title: "Revisión", icon: FaCode, items: ["Usa sangría consistente para detectar cierres faltantes.", "Valida IDs y referencias entre secciones.", "Revisa el flujo después de cambios estructurales."] },
    ]}
    sample={sample}
    tip="Una estructura limpia reduce errores de navegación y hace más fácil comparar versiones." />;
}
