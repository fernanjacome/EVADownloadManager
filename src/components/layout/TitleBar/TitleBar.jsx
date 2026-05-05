import React, { useEffect, useRef, useState } from "react";
import "./TitleBar.css";
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
import FlowsInfoModal from "./modals/FlowsInfoModal";
import SnippetsModal from "./modals/SnippetsModal";
import { TbReload } from "react-icons/tb";
import { GiLargePaintBrush } from "react-icons/gi";
import {
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdOutlineTextSnippet,
} from "react-icons/md";

export default function TitleBar({
  fileName,
  theme,
  setTheme,
  snowEnabled,
  toggleSnow,
  onResetApp,
  visibleModules,
  setVisibleModules,
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const menuRef = useRef(null);

  const handleAction = (action) => {
    window.electronAPI?.windowControl(action);
  };

  const toggleMenu = (menu) => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const closeMenus = () => {
    setActiveMenu(null);
  };

  const moduleOptions = [
    { key: "code", label: "XML" },
    { key: "flows", label: "Flujos" },
    { key: "screens", label: "Pantallas" },
    { key: "compiler", label: "Compilador" },
    { key: "remote", label: "Remoto" },
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="title-bar">
        <div className="title-left">
          <img src="favicon.ico" alt="logo" className="title-logo" />
          <div className="menu-bar" ref={menuRef}>
            <div className="menu-item" onClick={() => toggleMenu("file")}>
              Archivo
              {activeMenu === "file" && (
                <div
                  className="dropdown"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      window.electronAPI?.openNewWindow?.();
                      closeMenus();
                    }}
                  >
                    <span>Nueva ventana</span>
                    <FaRegWindowRestore />
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("snippets");
                      closeMenus();
                    }}
                  >
                    <span>Gestionar snippets</span>
                    <MdOutlineTextSnippet />
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setTheme(theme === "dark" ? "light" : "dark");
                      closeMenus();
                    }}
                  >
                    <span>
                      {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
                    </span>
                    {theme === "dark" ? <FaSun /> : <FaMoon />}
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={async () => {
                      closeMenus();
                      await window.electronAPI?.clearAppCache?.();
                    }}
                  >
                    <span>Recargar ventana</span>
                    <TbReload />
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={async () => {
                      closeMenus();
                      await onResetApp();
                    }}
                  >
                    <span>Restablecer esta ventana</span>
                    <GiLargePaintBrush />
                  </div>
                </div>
              )}
            </div>

            <div className="menu-item" onClick={() => toggleMenu("modules")}>
              Modulos
              {activeMenu === "modules" && (
                <div
                  className="dropdown"
                  onClick={(event) => event.stopPropagation()}
                >
                  {moduleOptions.map((module) => {
                    const enabled = visibleModules?.[module.key] !== false;
                    const enabledCount = Object.values(
                      visibleModules || {},
                    ).filter(Boolean).length;
                    return (
                      <div
                        key={module.key}
                        className={`dropdown-item module-toggle ${
                          !enabled && enabledCount === 1 ? "disabled" : ""
                        }`}
                        onClick={() => {
                          if (enabled && enabledCount === 1) return;
                          setActiveMenu("modules");
                          setVisibleModules((prev) => ({
                            ...prev,
                            [module.key]: !enabled,
                          }));
                        }}
                      >
                        <span>{module.label}</span>
                        {enabled ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="menu-item" onClick={() => toggleMenu("help")}>
              Ayuda
              {activeMenu === "help" && (
                <div
                  className="dropdown"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("compiler");
                      closeMenus();
                    }}
                  >
                    Compilador
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("screens");
                      closeMenus();
                    }}
                  >
                    Pantallas
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("flows");
                      closeMenus();
                    }}
                  >
                    Flujos
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("format");
                      closeMenus();
                    }}
                  >
                    Formato XML
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("validations");
                      closeMenus();
                    }}
                  >
                    Validaciones
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("shortcuts");
                      closeMenus();
                    }}
                  >
                    Atajos de teclado
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("files");
                      closeMenus();
                    }}
                  >
                    Gestion de archivos
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("errors");
                      closeMenus();
                    }}
                  >
                    Errores comunes
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("tips");
                      closeMenus();
                    }}
                  >
                    Recomendaciones
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("about");
                      closeMenus();
                    }}
                  >
                    Version
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="title-center">
          {fileName ? `${fileName} - EVA Studio 2026` : "EVA Studio 2026"}
        </div>

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
        onClose={() => setShowModal(null)}
      />
      <FilesModal
        isOpen={showModal === "files"}
        onClose={() => setShowModal(null)}
      />
      <ErrorsModal
        isOpen={showModal === "errors"}
        onClose={() => setShowModal(null)}
      />
      <ScreensInfoModal
        isOpen={showModal === "screens"}
        onClose={() => setShowModal(null)}
      />
      <CompilerInfoModal
        isOpen={showModal === "compiler"}
        onClose={() => setShowModal(null)}
      />
      <FlowsInfoModal
        isOpen={showModal === "flows"}
        onClose={() => setShowModal(null)}
      />
      <SnippetsModal
        isOpen={showModal === "snippets"}
        onClose={() => setShowModal(null)}
      />
    </>
  );
}
