import React from "react";
import { FaExclamationTriangle, FaRoute } from "react-icons/fa";
import HelpModal from "./HelpModal";

export default function ErrorsModal(props) {
  return <HelpModal {...props} title="Errores comunes" icon={FaExclamationTriangle}
    summary="Un orden simple para diagnosticar errores de XML, flujos y pantallas."
    quickStart={["Lee el mensaje y ubica su línea.", "Corrige la estructura o referencia indicada.", "Valida y revisa el flujo afectado."]}
    sections={[
      { title: "XML", icon: FaExclamationTriangle, items: ["Línea y columna suelen indicar estructura mal cerrada.", "IDs repetidos producen referencias ambiguas.", "Valida después de cada corrección importante."] },
      { title: "Navegación", icon: FaRoute, items: ["Revisa el state destino y la transición.", "Confirma que la pantalla HTML existe en la carpeta cargada.", "Usa Flujos para seguir la ruta real."] },
    ]}
    tip="No corrijas varios mensajes a ciegas: el primer error de sintaxis puede provocar muchos errores secundarios." />;
}
