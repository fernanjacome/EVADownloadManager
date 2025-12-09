import React, { useEffect, useRef, useState } from "react";
import "./TitleBar.css";
import expand from "../../../assets/expand.png";
import minus from "../../../assets/minus.png";
import equis from "../../../assets/equis.png";
import AboutModal from "./modals/AboutModal";
import FormatModal from "./modals/FormatModal";
import TipsModal from "./modals/TipsModal";
import ValidationsModal from "./modals/ValidationsModal";
import ShortcutsModal from "./modals/ShortcutModal";
import FilesModal from "./modals/FilesModal";
import ErrorsModal from "./modals/ErrorsModal";
import { FiMaximize } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import { FaWindowMinimize } from "react-icons/fa6";
import { FaMoon, FaRegWindowRestore, FaSun } from "react-icons/fa";
import ScreensInfoModal from "./modals/ScreensInfoModal";
import CompilerInfoModal from "./modals/CompileInfoModal";

export default function TitleBar({
  fileName,
  theme,
  setTheme,
  snowEnabled,
  toggleSnow,
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [showModal, setShowModal] = useState(null); // 👈 ahora null | "about" | "format" | "validations" | "tips"
  const menuRef = useRef(null);
  const handleAction = (action) => {
    if (window.electronAPI) {
      window.electronAPI.windowControl(action);
    }
  };

  const toggleMenu = (menu) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleNewWindow = () => {
    if (window.electronAPI) {
      window.electronAPI.openNewWindow();
    }
    setActiveMenu(null);
  };
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="title-bar">
        {/* Logo + menú */}
        <div className="title-left">
          <img src="favicon.ico" alt="logo" className="title-logo" />
          <div className="menu-bar">
            <div className="menu-item" onClick={() => toggleMenu("file")}>
              Archivo
              {activeMenu === "file" && (
                <div className="dropdown">
                  <div className="dropdown-item" onClick={handleNewWindow}>
                    <FaRegWindowRestore />
                    Nueva ventana
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() =>
                      setTheme(theme === "dark" ? "light" : "dark")
                    }
                  >
                    {theme === "dark" ? <FaSun /> : <FaMoon />}{" "}
                    {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}{" "}
                  </div>
                </div>
              )}
            </div>

            <div className="menu-item" onClick={() => toggleMenu("help")}>
              Ayuda
              {activeMenu === "help" && (
                <div className="dropdown">
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("compiler");
                      setActiveMenu(null);
                    }}
                  >
                    Compilador
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("screens");
                      setActiveMenu(null);
                    }}
                  >
                    Pantallas
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("format");
                      setActiveMenu(null);
                    }}
                  >
                    Formato XML
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("validations");
                      setActiveMenu(null);
                    }}
                  >
                    Validaciones
                  </div>

                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("shortcuts");
                      setActiveMenu(null);
                    }}
                  >
                    Atajos de teclado
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("files");
                      setActiveMenu(null);
                    }}
                  >
                    Gestión de archivos
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("errors");
                      setActiveMenu(null);
                    }}
                  >
                    Errores comunes
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("tips");
                      setActiveMenu(null);
                    }}
                  >
                    Recomendaciones
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("about");
                      setActiveMenu(null);
                    }}
                  >
                    Versión
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 🔹 Título del archivo al centro */}
        <div className="title-center">
          {fileName
            ? `${fileName} - EVA Download Manager`
            : "EVA Download Manager"}
        </div>

        {/* Botones de control */}
        <div className="title-right">
          <button
            className="win-btn min"
            onClick={() => handleAction("minimize")}
          >
            <FaWindowMinimize
              style={{ color: theme === "dark" ? "#fff" : "#000" }}
            />
          </button>
          <button
            className="win-btn max"
            onClick={() => handleAction("maximize")}
          >
            <FiMaximize style={{ color: theme === "dark" ? "#fff" : "#000" }} />
          </button>
          <button
            className="win-btn close"
            onClick={() => window.dispatchEvent(new Event("tryAppClose"))}
          >
            <IoClose style={{ color: theme === "dark" ? "#fff" : "#000" }} />
          </button>
        </div>
      </div>

      {/* Modales (solo se muestra el seleccionado) */}
      <AboutModal
        isOpen={showModal === "about"}
        onClose={() => setShowModal(null)}
        snowEnabled={snowEnabled}
        toggleSnow={toggleSnow}
      />
      <FormatModal
        isOpen={showModal === "format"}
        onClose={() => setShowModal(null)}
      />
      <TipsModal
        isOpen={showModal === "tips"}
        onClose={() => setShowModal(null)}
      />
      <ValidationsModal
        isOpen={showModal === "validations"}
        onClose={() => setShowModal(null)}
      />
      <ShortcutsModal
        isOpen={showModal === "shortcuts"}
        onClose={() => setShowModal(false)}
      />
      <FilesModal
        isOpen={showModal === "files"}
        onClose={() => setShowModal(false)}
      />
      <ErrorsModal
        isOpen={showModal === "errors"}
        onClose={() => setShowModal(false)}
      />
      <ScreensInfoModal
        isOpen={showModal === "screens"}
        onClose={() => setShowModal(false)}
      />
      <CompilerInfoModal
        isOpen={showModal === "compiler"}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
