import React from "react";
import "./AboutModal.css";

export default function CompilerInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Información del módulo de Compilación</h2>

        <ul>
          <li>
            Este módulo permite <strong>compilar el XML activo</strong> contra
            un servidor remoto.
          </li>

          <li>
            Para que la compilación funcione, en el servidor debe estar activo
            la API <strong>Extreme.EVA.APICompiler</strong>.
          </li>

          <li>
            El campo <strong>Servidor</strong> define la IP o hostname donde se
            ejecuta el compilador.
          </li>

          <li>
            El campo <strong>Puerto</strong> indica el puerto HTTP del servicio
            de compilación.
          </li>

          <li>
            El campo <strong>BAT</strong> define el nombre del archivo batch que
            se generará en el servidor.
          </li>

          <li>
            El campo <strong>ID</strong> representa el identificador único de la
            imagen a compilar.
          </li>

          <li>
            El botón <strong>Compilar</strong> envía el XML actual al servidor y
            ejecuta el proceso completo de build.
          </li>

          <li>
            Si el XML tiene cambios sin guardar, el sistema{" "}
            <strong>guarda automáticamente antes de compilar</strong>.
          </li>

          <li>
            El botón <strong>Cancelar</strong> interrumpe una compilación en
            curso.
          </li>

          <li>
            La <strong>consola lateral</strong> muestra en tiempo real la salida
            del compilador y los errores del servidor.
          </li>
        </ul>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
