import React from "react";
import { FaMousePointer, FaProjectDiagram, FaRoute } from "react-icons/fa";
import "./AboutModal.css";

export default function FlowsInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal module-help-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Flujos</h2>

        <div className="about-body module-help-body">
          <p className="about-intro">
            Este modulo representa el recorrido del XML de forma visual. Su idea es ayudarte
            a seguir ramas, entender conexiones y ubicar estados sin tener que leer todo el
            archivo linea por linea.
          </p>

          <div className="about-module-grid">
            <div className="about-section">
              <h3 className="about-section-title">
                <FaProjectDiagram className="about-section-icon" />
                <span>Como se determina un inicio</span>
              </h3>
              <ul>
                <li>Un state se toma como inicio cuando ningun otro state lo apunta como destino.</li>
                <li>Si el state es de tipo <code>END</code>, no se muestra como inicio aunque no tenga entradas.</li>
                <li>Los inicios se agrupan por tipo para facilitar la lectura del flujo.</li>
              </ul>
            </div>

            <div className="about-section">
              <h3 className="about-section-title">
                <FaRoute className="about-section-icon" />
                <span>Como se conectan los estados</span>
              </h3>
              <ul>
                <li>Cualquier parametro que termina en <code>State</code> normalmente genera una salida.</li>
                <li>Ejemplos comunes: <code>GoodState</code>, <code>ErrorState</code>, <code>TimeoutState</code> y <code>KeyDState</code>.</li>
                <li>En <code>SWITCH</code>, los pares <code>ValueN</code> y <code>StateN</code> forman ramas con su propia etiqueta.</li>
                <li>Tambien se consideran casos como <code>Chip</code>, <code>Track</code>, <code>TranMap</code> y continuaciones desde <code>Transactions</code>.</li>
              </ul>
            </div>
          </div>

          <div className="about-section about-section-wide">
            <h3 className="about-section-title">
              <FaMousePointer className="about-section-icon" />
              <span>Como usarlo</span>
            </h3>
            <ol className="about-steps">
              <li>Elige que grupos de inicio quieres ver.</li>
              <li>Abre una rama con click izquierdo sobre el state.</li>
              <li>Usa click derecho para revisar parametros o navegar al XML y a Pantallas.</li>
              <li>Si cambias el zoom o la vista, el modulo intenta mantener el state activo como referencia.</li>
            </ol>
          </div>

          <p className="about-note">
            El flujo es una ayuda visual. El XML sigue siendo la fuente principal cuando necesitas revisar el detalle exacto.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
