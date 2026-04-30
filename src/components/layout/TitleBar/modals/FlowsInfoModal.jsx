import React from "react";
import { FaMousePointer, FaProjectDiagram, FaRoute } from "react-icons/fa";
import "./AboutModal.css";

export default function FlowsInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className="about-modal module-help-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Flujos</h2>

        <div className="about-body module-help-body">
          {/* 1. QUE ES */}
          <p className="about-intro">
            Aquí puedes ver el flujo del XML como un diagrama interactivo. Cada
            bloque es un <strong>state</strong> y cada línea representa cómo se
            mueve la ejecución entre ellos.
          </p>

          {/* 2. COMO USAR (PRIMERO, NO AL FINAL) */}
          <div className="about-section about-section-wide">
            <h3 className="about-section-title">
              <FaMousePointer className="about-section-icon" />
              <span>Uso rápido</span>
            </h3>

            <ol className="about-steps">
              <li>
                Haz <strong>click</strong> en un state para abrir su flujo.
              </li>
              <li>
                Usa <strong>click derecho</strong> para ver parámetros o navegar
                al XML.
              </li>
              <li>
                Activa <code>Excepciones</code> para ver errores, cancelaciones
                o timeouts.
              </li>
              <li>
                Usa el zoom y el scroll para moverte en el flujo. Con{" "}
                <code>Ctrl + Click Derecho</code> puedes navegar libremente por
                el canva y <code>Ctrl + Rueda del mouse</code> puedes controlar
                el zoom.{" "}
              </li>
            </ol>
          </div>

          {/* 3. COMO LEER EL DIAGRAMA */}
          <div className="about-module-grid">
            <div className="about-section">
              <h3 className="about-section-title">
                <FaProjectDiagram className="about-section-icon" />
                <span>Puntos de inicio</span>
              </h3>
              <ul>
                <li>Son los states que no reciben ninguna entrada.</li>
                <li>Se agrupan por tipo para facilitar la lectura.</li>
                <li>
                  Los states <code>END</code> no se muestran como inicio.
                </li>
              </ul>
            </div>

            <div className="about-section">
              <h3 className="about-section-title">
                <FaRoute className="about-section-icon" />
                <span>Conexiones</span>
              </h3>
              <ul>
                <li>Cada línea indica una transición entre states.</li>
                <li>
                  Ejemplos comunes:
                  <code>GoodState</code>, <code>ErrorState</code>,{" "}
                  <code>TimeoutState</code>.
                </li>
                <li>
                  En <code>SWITCH</code>, cada ValueN/StateN genera una ruta
                  distinta.
                </li>
                <li>
                  En SEND se generan al asociar un TrxType al codigo de
                  <code>Transactions</code> y <code>TranMap</code>.
                </li>
              </ul>
            </div>
          </div>

          {/* 4. NOTA FINAL*/}
          <p className="about-note">
            Este diagrama es una ayuda visual. El comportamiento real siempre
            está definido en el XML.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
