import React from "react";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function ValidationsModal(props) {
  return <HelpModal {...props} title="Validaciones" icon={FaCheckCircle}
    summary="Comprueba problemas básicos antes de usar el XML en otro módulo."
    sections={[
      { title: "Qué se revisa", icon: FaCheckCircle, items: ["El XML está bien formado.", "Existe la estructura base esperada.", "No se detectan IDs duplicados en secciones clave."] },
      { title: "Qué hacer si falla", icon: FaExclamationTriangle, items: ["Ve a la línea indicada por el mensaje.", "Corrige un error a la vez y vuelve a validar.", "Revisa Flujos si el XML es válido pero no navega como esperas."] },
    ]}
    tip="La validación es una red de seguridad; no reemplaza revisar una transición nueva de principio a fin." />;
}
