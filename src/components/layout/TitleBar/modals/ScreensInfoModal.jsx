import React from "react";
import "./AboutModal.css";
import {
  FaRegImages,
  FaFolderOpen,
  FaPlay,
  FaCheckCircle,
} from "react-icons/fa";

export default function ScreensInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Información del módulo de Pantallas</h2>

        <ul>
          <li>
            El módulo renderiza <strong>todas las pantallas HTML</strong>{" "}
            ubicadas en la carpeta seleccionada.
          </li>

          <li>
            Usa el botón para seleccionar la carpeta donde se encuentran las
            pantallas.
          </li>

          <li>
            El botón <strong>▶</strong> realiza un{" "}
            <strong>refresco total</strong>: limpia caché, reinicia el servidor
            estático y recarga todos los archivos.
          </li>

          <li>
            Si cambias la ruta manualmente, presiona <strong>▶</strong> para
            evitar errores por archivos previos.
          </li>

          <li>
            Los recursos (CSS, JS, imágenes) cargan correctamente porque se
            sirven desde un
            <strong> servidor Express</strong> interno, tal como en un navegador
            real.
          </li>

          <li>
            El visor utiliza la resolución estandar de un ATM real de{" "}
            <code>1024×768</code>.
          </li>

          <li>
            La lista lateral muestra cada archivo HTML individual, sin depender
            del XML.
          </li>

          <li>
            Si no cargan estilos, revisa rutas relativas como:{" "}
            <code>./css/styles.css</code>.
          </li>
        </ul>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
