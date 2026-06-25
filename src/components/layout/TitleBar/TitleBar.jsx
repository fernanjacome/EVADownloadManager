import React, { useEffect, useRef, useState } from "react";
import "./TitleBar.css";
import AboutModal from "./modals/AboutModal";
import FormatModal from "./modals/FormatModal";
import TipsModal from "./modals/TipsModal";
import ValidationsModal from "./modals/ValidationsModal";
import ShortcutsModal from "./modals/ShortcutModal";
import FilesModal from "./modals/FilesModal";
import ErrorsModal from "./modals/ErrorsModal";
import XmlHelpModal from "./modals/XmlHelpModal";
import CompareHelpModal from "./modals/CompareHelpModal";
import LogsHelpModal from "./modals/LogsHelpModal";
import RemoteHelpModal from "./modals/RemoteHelpModal";
import {
  FiCode,
  FiMaximize,
  FiMinimize2,
  FiMinus,
  FiMonitor,
  FiTerminal,
  FiWifi,
  FiSettings,
} from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import {
  FaExchangeAlt,
  FaFileAlt,
  FaKeyboard,
  FaMoon,
  FaProjectDiagram,
  FaRegWindowRestore,
  FaSun,
} from "react-icons/fa";
import ScreensInfoModal from "./modals/ScreensInfoModal";
import CompilerInfoModal from "./modals/CompileInfoModal";
import FlowsInfoModal from "./modals/FlowsInfoModal";
import SnippetsModal from "./modals/SnippetsModal";
import { TbInfoCircle, TbReload } from "react-icons/tb";
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
  evaAiEnabled,
  setEvaAiEnabled,
  onOpenEvaAiSettings,
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [showModal, setShowModal] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
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

  const hoverMenu = (menu) => {
    if (activeMenu) setActiveMenu(menu);
  };

  const moduleOptions = [
    { key: "code", label: "XML" },
    { key: "compare", label: "Comparador XML" },
    { key: "flows", label: "Flujos" },
    { key: "screens", label: "Pantallas" },
    { key: "compiler", label: "Compilador" },
    { key: "remote", label: "Remoto" },
    { key: "logs", label: "Logs" },
    { key: "eva-ai", label: "EVA AI", isEvaAi: true },
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

  useEffect(() => {
    const api = window.electronAPI;
    api
      ?.getWindowMaximized?.()
      .then(setIsMaximized)
      .catch(() => {});
    return api?.onWindowMaximizedChange?.(setIsMaximized);
  }, []);

  const toggleMaximize = () => handleAction("maximize");

  return (
    <>
      <div className="title-bar">
        <div className="title-left">
          <img src="favicon.ico" alt="logo" className="title-logo" />
          <div className="menu-bar" ref={menuRef}>
            <div
              className={`menu-item ${activeMenu === "file" ? "active" : ""}`}
              onClick={() => toggleMenu("file")}
              onMouseEnter={() => hoverMenu("file")}
            >
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
                      onOpenEvaAiSettings?.();
                      closeMenus();
                    }}
                  >
                    <span>Configurar EVA AI</span>
                    <FiSettings />
                  </div>
                  <div className="dropdown-separator" />
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
                  <div className="dropdown-separator" />
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

            <div
              className={`menu-item ${activeMenu === "modules" ? "active" : ""}`}
              onClick={() => toggleMenu("modules")}
              onMouseEnter={() => hoverMenu("modules")}
            >
              Modulos
              {activeMenu === "modules" && (
                <div
                  className="dropdown"
                  onClick={(event) => event.stopPropagation()}
                >
                  {moduleOptions.map((module) => {
                    const enabled = module.isEvaAi
                      ? evaAiEnabled !== false
                      : visibleModules?.[module.key] !== false;
                    const enabledCount = Object.values(
                      visibleModules || {},
                    ).filter(Boolean).length;
                    return (
                      <div
                        key={module.key}
                        className={`dropdown-item module-toggle ${
                          !module.isEvaAi && !enabled && enabledCount === 1 ? "disabled" : ""
                        }`}
                        onClick={() => {
                          if (!module.isEvaAi && enabled && enabledCount === 1) return;
                          setActiveMenu("modules");
                          if (module.isEvaAi) {
                            setEvaAiEnabled?.((current) => !current);
                            return;
                          }
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

            <div
              className={`menu-item ${activeMenu === "help" ? "active" : ""}`}
              onClick={() => toggleMenu("help")}
              onMouseEnter={() => hoverMenu("help")}
            >
              Ayuda
              {activeMenu === "help" && (
                <div
                  className="dropdown"
                  onClick={(event) => event.stopPropagation()}
                >
                  {/* <div className="dropdown-item" onClick={() => { setShowModal("xmlhelp"); closeMenus(); }}>
                    <span>XML</span>
                    <FiCode />
                  </div>
                  <div className="dropdown-item" onClick={() => { setShowModal("comparehelp"); closeMenus(); }}>
                    <span>Comparador</span>
                    <FaExchangeAlt />
                  </div>
                  <div className="dropdown-item" onClick={() => { setShowModal("screens"); closeMenus(); }}>
                    <span>Pantallas</span>
                    <FiMonitor />
                  </div>
                  <div className="dropdown-item" onClick={() => { setShowModal("compiler"); closeMenus(); }}>
                    <span>Compilador</span>
                    <FiTerminal />
                  </div>
                  <div className="dropdown-item" onClick={() => { setShowModal("flows"); closeMenus(); }}>
                    <span>Flujos</span>
                    <FaProjectDiagram />
                  </div>
                  <div className="dropdown-item" onClick={() => { setShowModal("logshelp"); closeMenus(); }}>
                    <span>Logs</span>
                    <FaFileAlt />
                  </div>
                  <div className="dropdown-item" onClick={() => { setShowModal("remotehelp"); closeMenus(); }}>
                    <span>Remoto</span>
                    <FiWifi />
                  </div> */}
                  <div className="dropdown-separator" />
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("shortcuts");
                      closeMenus();
                    }}
                  >
                    <span>Atajos de teclado</span>
                    <FaKeyboard />
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      setShowModal("about");
                      closeMenus();
                    }}
                  >
                    <span>Version</span>
                    <TbInfoCircle />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="title-center"
          onDoubleClick={toggleMaximize}
          title="Doble clic para maximizar o restaurar"
        >
          {fileName ? `${fileName} - EVA Studio 2026` : "EVA Studio 2026"}
        </div>

        <div className="title-right" aria-label="Controles de ventana">
          <button
            className="win-btn min"
            onClick={() => handleAction("minimize")}
            title="Minimizar"
            aria-label="Minimizar ventana"
          >
            <FiMinus />
          </button>
          <button
            className="win-btn max"
            onClick={toggleMaximize}
            title={isMaximized ? "Restaurar" : "Maximizar"}
            aria-label={isMaximized ? "Restaurar ventana" : "Maximizar ventana"}
          >
            {isMaximized ? <FiMinimize2 /> : <FiMaximize />}
          </button>
          <button
            className="win-btn close"
            onClick={() => window.dispatchEvent(new Event("tryAppClose"))}
            title="Cerrar"
            aria-label="Cerrar ventana"
          >
            <IoClose />
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
      <XmlHelpModal
        isOpen={showModal === "xmlhelp"}
        onClose={() => setShowModal(null)}
      />
      <CompareHelpModal
        isOpen={showModal === "comparehelp"}
        onClose={() => setShowModal(null)}
      />
      <LogsHelpModal
        isOpen={showModal === "logshelp"}
        onClose={() => setShowModal(null)}
      />
      <RemoteHelpModal
        isOpen={showModal === "remotehelp"}
        onClose={() => setShowModal(null)}
      />
    </>
  );
}
