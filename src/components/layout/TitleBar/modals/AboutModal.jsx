import React from "react";
import { FaInfoCircle } from "react-icons/fa";
import "./AboutModal.css";

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <FaInfoCircle className="about-icon" />
          <h2>Version</h2>
        </div>

        <div className="about-body">
          <p>
            <strong>EVA Studio 2026</strong> te permite trabajar el XML, revisar
            el flujo, ver las pantallas y compilar, todo sin estar saltando
            entre varias herramientas.
          </p>
          <p>
            La idea es simple: cargas un download, lo editas, navegas entre sus
            <code>states</code>, visualizas los <code>screens</code> y validas
            con el flujo.
          </p>

          <section className="about-section about-release-card">
            <div className="about-release-heading">
              <span className="about-release-badge">Nuevo</span>
              <div>
                <h3>Version 1.2.4</h3>
                <p>Flujos, navegación XML y ayuda de escritura</p>
              </div>
            </div>

            <div className="about-release-grid">
              <div>
                <h4>Nuevo módulo de Flujos</h4>
                <ul>
                  <li>Mapa visual del recorrido: pantalla, tecla, buffer y siguiente state.</li>
                  <li>SELECT y PIN se muestran como pantallas de cajero.</li>
                  <li>SET, SETWHEN y SWITCH muestran qué buffer guarda o evalúa el flujo.</li>
                  <li>SEND permite escoger la transacción sin abrir todos los caminos a la vez.</li>
                  <li>TranMap explica el camino por OperationCode y campos como TrxType o AccType.</li>
                  <li>Navegación rápida al inicio, final, origen, destino y exportación PNG.</li>
                </ul>
              </div>

              <div>
                <h4>Editor XML más cómodo</h4>
                <ul>
                  <li>Snippets para crear estructuras EVA comunes con menos escritura manual.</li>
                  <li>Sugerencias automáticas o con Ctrl + Espacio, según preferencia.</li>
                  <li>Plegar/desplegar bloques como States y Screens desde el menú contextual.</li>
                  <li>Ctrl + click navega a states y screens referenciados.</li>
                  <li>Reconoce parámetros como GoodState, NextStateContinue, Chip, Track y Screen.</li>
                  <li>Búsqueda y reemplazo más directo para editar el XML diario.</li>
                </ul>
              </div>
            </div>

            <p className="about-release-note">
              La idea: entender más rápido por qué el cajero llega a una
              pantalla y qué condición hizo continuar el flujo.
            </p>
          </section>
        </div>

        <div className="about-footer">
          <p className="about-version">Version 1.2.4</p>
          <p className="about-signature">Extreme Visual Appliance</p>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
