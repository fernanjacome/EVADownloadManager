import React, { useEffect, useRef, useState } from "react";
import {
  FaFileAlt,
  FaLink,
  FaNotEqual,
  FaProjectDiagram,
  FaTrash,
  FaUpload,
} from "react-icons/fa";
import "./Header.css";
import ConfirmModal from "../../utils/ConfirmModal";
import { MdScreenshotMonitor } from "react-icons/md";
import { IoBuild, IoCodeSlash } from "react-icons/io5";

export default function Header({
  fileInfo,
  filePath,
  onLoadClick,
  onDeleteXml,
  hasXml,
  viewMode,
  setViewMode,
  visibleModules,
  onDetachModule,
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [draggingModule, setDraggingModule] = useState(null);
  const modeSwitchRef = useRef(null);


  const moduleButtons = [
    { key: "code", label: "XML", icon: <IoCodeSlash /> },
    { key: "compare", label: "Comparar", icon: <FaNotEqual /> },
    { key: "screens", label: "Pantallas", icon: <MdScreenshotMonitor /> },
    { key: "compiler", label: "Compilador", icon: <IoBuild /> },
    { key: "flows", label: "Flujos", icon: <FaProjectDiagram /> },
    { key: "logs", label: "Logs", icon: <FaFileAlt /> },
    { key: "remote", label: "Remoto", icon: <FaLink />, className: "remote" },
  ];

  const handleModuleDragStart = (event, moduleKey) => {
    setDraggingModule(moduleKey);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `eva-module:${moduleKey}`);
    event.dataTransfer.setDragImage(
      event.currentTarget,
      event.currentTarget.offsetWidth / 2,
      event.currentTarget.offsetHeight / 2
    );
  };

  const handleModuleDragEnd = (event, moduleKey) => {
    const modeSwitch = event.currentTarget.closest(".mode-switch");
    const bounds = modeSwitch?.getBoundingClientRect();
    const { clientX, clientY } = event;
    const droppedOutsideWindow = clientX === 0 && clientY === 0;
    const droppedOutsideRow =
      !bounds ||
      droppedOutsideWindow ||
      clientX < bounds.left ||
      clientX > bounds.right ||
      clientY < bounds.top ||
      clientY > bounds.bottom;

    setDraggingModule(null);

    if (droppedOutsideRow) {
      onDetachModule?.(moduleKey);
    }
  };

  useEffect(() => {
    const updateDockZone = () => {
      const rect = modeSwitchRef.current?.getBoundingClientRect?.();
      if (!rect) return;

      window.electronAPI?.updateModuleDockZone?.({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      });
    };

    updateDockZone();
    window.addEventListener("resize", updateDockZone);
    window.addEventListener("scroll", updateDockZone, true);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateDockZone)
        : null;
    if (modeSwitchRef.current && observer) {
      observer.observe(modeSwitchRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateDockZone);
      window.removeEventListener("scroll", updateDockZone, true);
      observer?.disconnect();
      window.electronAPI?.updateModuleDockZone?.(null);
    };
  }, [visibleModules]);

  return (
    <header className="header-bar">
      <div className="header-title">
        <div className="header-title-group">
          {/* <FaRegSnowflake
            className={`xmas-icon ${snowEnabled ? "active" : ""}`}
            title="Feliz navidad 2025"
            onClick={toggleSnow}
          /> */}

          <h2 className="header-title-text">EVA Studio 2026</h2>
        </div>
        {fileInfo ? (
          <div className="header-file-info">
            <span>
              <strong>Archivo:</strong> {filePath}
            </span>
          </div>
        ) : (
          <span className="header-filename">Ningún archivo cargado</span>
        )}
      </div>

      <div className="header-actions">
        <button className="header-btn" onClick={onLoadClick}>
          <FaUpload /> Importar
        </button>
        {/* <button className="header-btn" disabled={!hasXml} onClick={onExport}>
          <FaFileExport /> Exportar
        </button> */}
        <button
          className="header-btn header-btn-danger"
          onClick={() => setShowConfirmDelete(true)}
          disabled={!hasXml}
        >
          <FaTrash /> Eliminar
        </button>
        <div className="mode-switch" ref={modeSwitchRef}>
          {moduleButtons.map((moduleButton) => {
            if (visibleModules?.[moduleButton.key] === false) return null;

            return (
              <button
                key={moduleButton.key}
                className={`mode-btn ${moduleButton.className || ""} ${
                  viewMode === moduleButton.key ? "active" : ""
                } ${draggingModule === moduleButton.key ? "dragging" : ""}`}
                draggable
                title="Arrastra fuera de la fila para desacoplar este modulo"
                onClick={() => setViewMode(moduleButton.key)}
                onDragStart={(event) =>
                  handleModuleDragStart(event, moduleButton.key)
                }
                onDragEnd={(event) =>
                  handleModuleDragEnd(event, moduleButton.key)
                }
              >
                {moduleButton.icon}
                {moduleButton.label}
              </button>
            );
          })}
        </div>

        <ConfirmModal
          isOpen={showConfirmDelete}
          onClose={() => setShowConfirmDelete(false)}
          onConfirm={onDeleteXml}
          title="Eliminar archivo"
          message="¿Seguro que quieres eliminar este archivo XML de la aplicación?"
        />
      </div>
    </header>
  );
}
