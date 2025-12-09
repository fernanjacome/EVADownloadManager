import React, { useEffect } from "react";
import ScreenSelector from "./ScreenSelector";
import ScreenViewer from "./ScreenViewer";
import "./screens.css";
import { FaFolderOpen, FaPlay, FaPowerOff } from "react-icons/fa";

export default function ScreensPanel({
  screensFolder,
  setScreensFolder,
  screensFolderInput,
  setScreensFolderInput,
  screensList,
  selectedScreen,
  onSelectScreen,
  setScreensList,
}) {
  const handleSelectFolder = async () => {
    const folder = await window.electronAPI.openFolderDialog();
    if (folder) setScreensFolderInput(folder);
  };

  const handleLoadFolder = async () => {
    const path = screensFolderInput?.trim();
    if (!path) return;

    await window.electronAPI.clearStaticServerCache();

    onSelectScreen(null);
    setScreensList([]);
    setScreensFolder(null);

    await new Promise((res) => setTimeout(res, 100));

    setScreensFolder(path);
  };

  const handleResetAll = async () => {
    await window.electronAPI.clearStaticServerCache();

    // Reset UI
    setScreensFolderInput("");
    setScreensFolder(null);
    setScreensList([]);
    onSelectScreen(null);
  };

  return (
    <div className="screens-layout">
      <div className="screens-sidebar">
        {/* Selector de carpeta con input + botones */}
        <div className="folder-selector">
          <input
            className="folder-input"
            type="text"
            value={screensFolderInput}
            placeholder="Ruta de pantallas..."
            onChange={(e) => setScreensFolderInput(e.target.value)}
          />

          {/* Seleccionar carpeta */}
          <button className="folder-btn" onClick={handleSelectFolder}>
            <FaFolderOpen />
          </button>

          {/* Cargar carpeta */}
          <button
            className="folder-btn load-btn"
            onClick={handleLoadFolder}
            title="Cargar carpeta"
          >
            <FaPlay />
          </button>

          {/* 🔥 Limpiar todo */}
          <button
            className="folder-btn danger-btn"
            onClick={handleResetAll}
            title="Eliminar todo y apagar servidor"
          >
            <FaPowerOff />
          </button>
        </div>

        <ScreenSelector
          screens={screensList}
          selected={selectedScreen}
          onSelect={onSelectScreen}
        />
      </div>

      <div className="screens-viewer-area">
        {!screensFolder && (
          <p className="screens-info">Selecciona o ingresa una carpeta.</p>
        )}

        {screensFolder && !selectedScreen && (
          <p className="screens-info">Selecciona una pantalla del listado.</p>
        )}

        {screensFolder && selectedScreen && (
          <ScreenViewer
            folder={screensFolder}
            resource={selectedScreen.resource}
          />
        )}
      </div>
    </div>
  );
}
