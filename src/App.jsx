import React, { useState, useRef, useEffect } from "react";

import "./App.css";
import { formatXml } from "./utils/xmlUtils";
import TitleBar from "./components/layout/TitleBar/TitleBar";
import Header from "./components/layout/Header/Header";
import Sidebar from "./components/layout/Sidebar/Sidebar";
import EmptyState from "./components/editor/EmptyState";
import EditorToolbar from "./components/editor/EditorToolbar";
import CodeEditor from "./components/editor/CodeEditor";
import NotificationContainer from "./components/utils/NotificationContainer";
import ScreensPanel from "./components/screens/ScreensPanel";
import CompilerForm from "./components/compiler/CompilerForm";
import RemoteViewer from "./components/remote/RemoteViewer";
import { useSnowEffect } from "./hooks/useSnowEffect";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useXmlEditor } from "./hooks/useXmlEditor";
import { usePreventZoom } from "./hooks/usePreventZoom";
import { useAppPersistence } from "./hooks/useAppPersistence";
import { groupOrder } from "./utils/sidebarConfig";

const DEFAULT_STATE = {
  splitView: false,
  activeEditor: "left",
  snowEnabled: false,
  screensFolder: null,
  screensFolderInput: "",
  viewMode: "code",
  sidebarWidth: 240,
  editorViewState: { cursor: 0, scrollTop: 0 },
  compilerState: {
    batName: "",
    imageName: "",
    imageId: "",
    consoleLines: [],
  },
  theme: "dark",
};

export default function App() {
  const [notifications, setNotifications] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const [splitView, setSplitView] = useState(DEFAULT_STATE.splitView);
  const [activeEditor, setActiveEditor] = useState(DEFAULT_STATE.activeEditor);
  const [snowEnabled, setSnowEnabled] = useState(DEFAULT_STATE.snowEnabled);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_STATE.sidebarWidth);
  const [editorViewState, setEditorViewState] = useState(
    DEFAULT_STATE.editorViewState
  );
  const [viewMode, setViewMode] = useState(DEFAULT_STATE.viewMode);
  const [screensFolder, setScreensFolder] = useState(
    DEFAULT_STATE.screensFolder
  );
  const [screensFolderInput, setScreensFolderInput] = useState(
    DEFAULT_STATE.screensFolderInput
  );
  const [compilerState, setCompilerState] = useState(
    DEFAULT_STATE.compilerState
  );
  const [theme, setTheme] = useState(DEFAULT_STATE.theme);

  const [collapsedGroups, setCollapsedGroups] = useState(
    Object.fromEntries(groupOrder.map((g) => [g, true]))
  );

  const addNotification = (type, message) => {
    setNotifications((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.type === type && last.message === message) {
          return prev;
        }
      }
      return [...prev, { id: crypto.randomUUID(), type, message }];
    });
  };
  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };
  const xml = useXmlEditor({ notify: addNotification });
  const persistenceEnabledRef = useRef(false);
  useAppPersistence({
    enabledRef: persistenceEnabledRef,

    load: async () => {
      const res = await window.electronAPI?.loadAppState?.();
      const s = res?.success ? res.data : null;

      if (s) {
        if (s.xmlState) xml.hydrate(s.xmlState);

        setTheme(s.theme ?? DEFAULT_STATE.theme);
        setSplitView(!!s.splitView);
        setActiveEditor(s.activeEditor ?? DEFAULT_STATE.activeEditor);
        setSnowEnabled(!!s.snowEnabled);
        setEditorViewState(s.editorViewState ?? DEFAULT_STATE.editorViewState);
        setSidebarWidth(s.sidebarWidth ?? DEFAULT_STATE.sidebarWidth);
        setViewMode(s.viewMode ?? DEFAULT_STATE.viewMode);
        setScreensFolder(s.screensFolder ?? DEFAULT_STATE.screensFolder);
        setScreensFolderInput(
          s.screensFolderInput ?? DEFAULT_STATE.screensFolderInput
        );
        setCompilerState(s.compilerState ?? DEFAULT_STATE.compilerState);
        setCollapsedGroups(
          s.collapsedGroups ??
            Object.fromEntries(groupOrder.map((g) => [g, true]))
        );
      }

      return {
        xmlState: s?.xmlState ?? xml.getPersistableState(),
        ...DEFAULT_STATE,
        ...s,
      };
    },

    buildState: () => ({
      xmlState: xml.getPersistableState(),
      theme,
      collapsedGroups,
      splitView,
      activeEditor,
      snowEnabled,
      editorViewState,
      sidebarWidth,
      viewMode,
      screensFolder,
      screensFolderInput,
      compilerState,
    }),
  });

  useSnowEffect(snowEnabled);
  useKeyboardShortcuts();
  usePreventZoom();

  const { startResize } = useSidebarResize(setSidebarWidth);

  useEffect(() => {
    if (screensFolderInput) {
      localStorage.setItem("path_screens", screensFolderInput);
    }
  }, [screensFolderInput]);

  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("navidad.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.05;
    }

    snowEnabled
      ? audioRef.current.play().catch(() => {})
      : audioRef.current.pause();
  }, [snowEnabled]);

  // "dark" | "light"
  useEffect(() => {
    document.body.classList.toggle("light-theme", theme === "light");
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const [screensList, setScreensList] = useState([]);
  const [selectedScreen, setSelectedScreen] = useState(null);
  useEffect(() => {
    if (!screensFolder) {
      setScreensList([]);
      return;
    }

    const loadScreens = async () => {
      const result = await window.electronAPI.readFolder(screensFolder);
      if (result.success) {
        setScreensList(result.files);
      } else {
        setScreensList([]);
      }
    };

    loadScreens();
  }, [screensFolder]);

  useEffect(() => {
    const handleAppClose = () => {
      window.electronAPI?.windowControl("close");
    };

    window.addEventListener("tryAppClose", handleAppClose);
    return () => window.removeEventListener("tryAppClose", handleAppClose);
  }, []);

  const resetAppState = async () => {
    localStorage.clear();
    xml.reset();
    setSplitView(DEFAULT_STATE.splitView);
    setActiveEditor(DEFAULT_STATE.activeEditor);
    setSnowEnabled(DEFAULT_STATE.snowEnabled);
    setScreensFolder(DEFAULT_STATE.screensFolder);
    setScreensFolderInput(DEFAULT_STATE.screensFolderInput);
    setScreensList([]);
    setSelectedScreen(null);

    setViewMode(DEFAULT_STATE.viewMode);
    setSidebarWidth(DEFAULT_STATE.sidebarWidth);
    setEditorViewState(DEFAULT_STATE.editorViewState);
    setCompilerState(DEFAULT_STATE.compilerState);
    setTheme(DEFAULT_STATE.theme);

    setNotifications([]);

    await window.electronAPI?.saveAppState?.(null);
    setTimeout(() => {
      persistenceEnabledRef.current = true;
    }, 0);
  };

  console.log(xml);

  return (
    <div className="app">
      <TitleBar
        fileName={xml.fileInfo?.name}
        theme={theme}
        setTheme={setTheme}
        snowEnabled={snowEnabled}
        toggleSnow={() => setSnowEnabled((v) => !v)}
        onResetApp={resetAppState}
      />
      {snowEnabled && <div className="xmas-cable-lights" />}
      {snowEnabled && <div className="xmas-cable-lights-down" />}
      {snowEnabled && (
        <div className="santa-sleigh">
          <img src="santa.gif" alt="Santa Claus" />
        </div>
      )}
      <Header
        fileInfo={xml.fileInfo}
        filePath={xml.filePath}
        onLoadClick={xml.openFile}
        onDeleteXml={xml.reset}
        hasXml={!!xml.xmlDoc}
        viewMode={viewMode}
        setViewMode={setViewMode}
        xmlDoc={xml.xmlDoc}
        snowEnabled={snowEnabled}
        toggleSnow={() => setSnowEnabled((v) => !v)}
      />

      <div className="workspace">
        <Sidebar
          xmlDoc={xml.xmlDoc}
          collapsed={collapsedGroups}
          setCollapsed={setCollapsedGroups}
          onSelect={(id) => {
            if (viewMode !== "code") {
              setViewMode("code");
            }
            setHighlightId({ target: activeEditor, id });

            setTimeout(() => setHighlightId(null), 0);
          }}
          style={{ width: sidebarWidth }}
        />

        <div className="sidebar-resizer" onMouseDown={startResize} />

        <div className="editor-wrapper full">
          {/* ======================= CODE ======================= */}
          <div
            style={{
              display: viewMode === "code" ? "block" : "none",
              height: "100%",
            }}
          >
            {!xml.xmlDoc ? (
              <EmptyState onLoadClick={xml.openFile} onNewClick={xml.newXml} />
            ) : (
              <div className={`editor-wrapper ${splitView ? "split" : ""}`}>
                <EditorToolbar
                  viewMode={viewMode}
                  onSave={xml.saveXml}
                  onRestoreOriginal={xml.restoreOriginal}
                  onFormat={
                    viewMode === "code"
                      ? () => {
                          const formatted = formatXml(xml.code);
                          if (formatted) xml.setCode(formatted);
                        }
                      : null
                  }
                  canSave={xml.dirty}
                  canRestoreOriginal={xml.code !== xml.originalCode}
                  dirty={xml.dirty}
                  xmlDoc={xml.xmlDoc}
                  setCode={xml.setCode}
                  setNotification={addNotification}
                  markDirty={() => xml.setCode(xml.code + " ")}
                  setSplitView={setSplitView}
                  splitView={splitView}
                  theme={theme}
                  setTheme={setTheme}
                />

                <div className={`editor-div ${splitView ? "split" : ""}`}>
                  <CodeEditor
                    code={xml.code}
                    onChange={xml.setCode}
                    highlightId={highlightId}
                    onSave={xml.saveXml}
                    canSave={xml.dirty}
                    editable={true}
                    onFocus={(key) => setActiveEditor(key)}
                    syncKey="left"
                    viewMode={viewMode}
                    theme={theme}
                    editorViewState={editorViewState}
                    setEditorViewState={setEditorViewState}
                  />

                  {splitView && (
                    <CodeEditor
                      code={xml.code}
                      onChange={xml.setCode}
                      highlightId={highlightId}
                      editable={true}
                      viewMode={viewMode}
                      onFocus={(key) => setActiveEditor(key)}
                      syncKey="right"
                      theme={theme}
                      editorViewState={editorViewState}
                      setEditorViewState={setEditorViewState}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ======================= SCREENS ======================= */}
          <div
            style={{
              display: viewMode === "screens" ? "block" : "none",
              height: "100%",
            }}
          >
            <ScreensPanel
              screensFolder={screensFolder}
              setScreensFolder={setScreensFolder}
              screensFolderInput={screensFolderInput}
              setScreensFolderInput={setScreensFolderInput}
              screensList={screensList}
              selectedScreen={selectedScreen}
              onSelectScreen={setSelectedScreen}
              setScreensList={setScreensList}
            />
          </div>

          {/* ======================= COMPILER ======================= */}
          <div
            style={{
              display: viewMode === "compiler" ? "block" : "none",
              height: "100%",
            }}
          >
            <CompilerForm
              xmlCode={xml.code}
              notify={addNotification}
              hasXml={!!xml.xmlDoc}
              xmlName={xml.title}
              dirty={xml.dirty}
              onSaveXml={xml.saveXml}
              compilerState={compilerState}
              title={xml.title}
              setCompilerState={setCompilerState}
            />
          </div>

          {/* ======================= REMOTE ======================= */}
          <div
            style={{
              display: viewMode === "remote" ? "block" : "none",
              height: "100%",
            }}
          >
            <RemoteViewer apiBaseUrl="https://192.168.10.241:5007" />
          </div>
        </div>
      </div>

      <NotificationContainer
        notifications={notifications}
        removeNotification={removeNotification}
      />
    </div>
  );
}
