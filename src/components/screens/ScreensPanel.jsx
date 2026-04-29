import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenSelector from "./ScreenSelector";
import ScreenViewer from "./ScreenViewer";
import "./screens.css";
import { FaFolderOpen, FaPlay } from "react-icons/fa";
import { FaRotateRight, FaStop } from "react-icons/fa6";
import { FiSearch, FiX } from "react-icons/fi";

export default function ScreensPanel({
  screensFolder,
  setScreensFolder,
  screensFolderInput,
  setScreensFolderInput,
  screensList,
  selectedScreen,
  onSelectScreen,
  screensViewState,
  onScreensViewStateChange,
  setScreensList,
}) {
  const [showRecent, setShowRecent] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const resizeRef = useRef(null);
  const [recentFolders, setRecentFolders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("screens_recent_folders")) || [];
    } catch {
      return [];
    }
  });
  const shouldShowDropdown = showRecent && recentFolders.length > 0;
  const filteredScreens = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return screensList;

    return screensList.filter((screen) =>
      String(screen.resource || "").toLowerCase().includes(query)
    );
  }, [screensList, searchTerm]);

  useEffect(() => {
    if (!showSearch) return;
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [showSearch]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!resizeRef.current) return;
      const nextWidth = Math.max(220, Math.min(520, event.clientX - resizeRef.current.left));
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleSelectFolder = async () => {
    const folder = await window.electronAPI.openFolderDialog();
    if (folder) setScreensFolderInput(folder);
  };

  const handleResetAll = async () => {
    if (!screensFolder) return;

    const currentFolder = screensFolder;

    await window.electronAPI.clearStaticServerCache();

    // Reset UI interno
    onSelectScreen(null);
    setScreensList([]);
    setScreensFolder(null);

    // 🔁 Forzar recarga
    await new Promise((res) => setTimeout(res, 100));
    setScreensFolder(currentFolder);
  };

  const pushRecentFolder = (path) => {
    const name = path.split(/[\\/]/).pop();

    setRecentFolders((prev) => {
      const next = [
        { name, path, lastUsedAt: Date.now() },
        ...prev.filter((f) => f.path !== path),
      ].slice(0, 5);

      localStorage.setItem("screens_recent_folders", JSON.stringify(next));

      return next;
    });
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

    // 🔥 guardar en historial
    pushRecentFolder(path);
  };
  const handleResetServer = async () => {
    if (!screensFolder) return;

    const currentFolder = screensFolder;

    await window.electronAPI.clearStaticServerCache();

    // reset visual
    onSelectScreen(null);
    setScreensList([]);
    setScreensFolder(null);

    // 🔁 recarga forzada
    await new Promise((res) => setTimeout(res, 100));
    setScreensFolder(currentFolder);
  };

  const handleStopServer = async () => {
    if (!screensFolder) return;

    await window.electronAPI.clearStaticServerCache();

    // apagar server
    setScreensFolder(null);
    setScreensList([]);
    onSelectScreen(null);

    // opcional: dejar input vacío
    // setScreensFolderInput("");
  };

  return (
    <div className="screens-layout">
      <div className="screens-sidebar" style={{ width: sidebarWidth }}>
        {/* Selector de carpeta con input + botones */}
        <div className="folder-selector">
          <input
            ref={inputRef}
            className="folder-input"
            type="text"
            value={screensFolderInput || ""}
            disabled={!!screensFolder}
            placeholder="Ruta de pantallas..."
            onFocus={() => {
              if (screensFolder) return;
              setShowRecent(true);
              setActiveIndex(0);
            }}
            onBlur={(e) => {
              const next = e.relatedTarget;
              if (dropdownRef.current?.contains(next)) return;

              setShowRecent(false);
              setActiveIndex(-1);
            }}
            onChange={(e) => {
              setScreensFolderInput(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={(e) => {
              if (!showRecent || recentFolders.length === 0) return;

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => {
                  const next = prev < recentFolders.length - 1 ? prev + 1 : 0;
                  setScreensFolderInput(recentFolders[next].path);
                  return next;
                });
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => {
                  const next = prev > 0 ? prev - 1 : recentFolders.length - 1;
                  setScreensFolderInput(recentFolders[next].path);
                  return next;
                });
              }

              if (e.key === "Enter") {
                e.preventDefault();
                setShowRecent(false);
                setActiveIndex(-1);
                handleLoadFolder();
              }

              if (e.key === "Escape") {
                setShowRecent(false);
                setActiveIndex(-1);
              }
            }}
          />
          {shouldShowDropdown && (
            <div
              ref={dropdownRef}
              className="screens-recent-dropdown"
              tabIndex={-1}
            >
              <div className="dropdown-title">Carpetas recientes</div>

              {recentFolders.map((f, index) => (
                <div
                  key={f.path}
                  className={`dropdown-item ${
                    index === activeIndex ? "active" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setScreensFolderInput(f.path);
                    setShowRecent(false);
                    setActiveIndex(-1);
                  }}
                >
                  <strong>{f.name}</strong>
                  <div className="dropdown-sub">{f.path}</div>
                </div>
              ))}
            </div>
          )}

          {/* Seleccionar carpeta */}
          <button className="folder-btn" onClick={handleSelectFolder}>
            <FaFolderOpen />
          </button>

          {/* Cargar carpeta */}
          <button
            className={`folder-btn ${
              screensFolder ? "danger-btn" : "load-btn"
            }`}
            onClick={screensFolder ? handleResetServer : handleLoadFolder}
            title={screensFolder ? "Resetear servidor" : "Cargar carpeta"}
          >
            {screensFolder ? <FaRotateRight /> : <FaPlay />}
          </button>

          {/* 🔥 Limpiar todo */}
          <button
            className="folder-btn danger-btn"
            onClick={handleStopServer}
            title="Apagar servidor"
            disabled={!screensFolder}
          >
            <FaStop />
          </button>
        </div>

        <div className="screens-tools-row">
          <button
            type="button"
            className={`screens-search-toggle ${showSearch ? "active" : ""}`}
            onClick={() => {
              setShowSearch((prev) => {
                const next = !prev;
                if (!next) {
                  setSearchTerm("");
                }
                return next;
              });
            }}
            title="Buscar pantalla"
          >
            <FiSearch />
            <span>Buscar</span>
          </button>

          {showSearch ? (
            <div className="screens-search-box">
              <FiSearch className="screens-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Filtrar pantallas..."
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="screens-search-clear"
                  onClick={() => setSearchTerm("")}
                  title="Limpiar"
                >
                  <FiX />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <ScreenSelector
          screens={filteredScreens}
          selected={selectedScreen}
          onSelect={onSelectScreen}
        />
      </div>

      <div
        className="screens-sidebar-resizer"
        onMouseDown={(event) => {
          const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
          resizeRef.current = {
            left: bounds?.left ?? 0,
          };
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
          event.preventDefault();
        }}
      />

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
            viewState={screensViewState}
            onViewStateChange={onScreensViewStateChange}
          />
        )}
      </div>
    </div>
  );
}
