import React, { useState, useRef, useEffect, useMemo } from "react";

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
import FlowsPanel from "./components/flows/FlowsPanel";
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
  sidebarCollapsed: false,
  selectedSidebarItem: null,
  editorViewState: { cursor: 0, scrollTop: 0 },
  xmlSuggestionSettings: { activation: "typing" },
  compilerState: {
    batName: "",
    imageName: "",
    imageId: "",
    consoleLines: [],
  },
  selectedScreen: null,
  screensViewState: { scale: 1 },
  flowViewState: {
    instances: [],
    selectedInstanceId: null,
    horizontalScale: 1,
    verticalScale: 1,
    cardScale: 1,
    canvasZoom: 1,
    showControls: false,
    showAppearance: false,
    showSearch: false,
    showCanvasZoom: false,
    showSideExits: false,
    autoFocusOnExpand: true,
    searchTerm: "",
    scrollLeft: 0,
    scrollTop: 0,
  },
  theme: "light",
  visibleModules: {
    code: true,
    screens: true,
    compiler: true,
    flows: true,
    remote: true,
  },
};

export default function App() {
  const [isRestoringWorkspace, setIsRestoringWorkspace] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [editorNavigation, setEditorNavigation] = useState(null);
  const [splitView, setSplitView] = useState(DEFAULT_STATE.splitView);
  const [activeEditor, setActiveEditor] = useState(DEFAULT_STATE.activeEditor);
  const [snowEnabled, setSnowEnabled] = useState(DEFAULT_STATE.snowEnabled);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_STATE.sidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(DEFAULT_STATE.sidebarCollapsed);
  const [selectedSidebarItem, setSelectedSidebarItem] = useState(DEFAULT_STATE.selectedSidebarItem);
  const [editorViewState, setEditorViewState] = useState(
    DEFAULT_STATE.editorViewState
  );
  const [xmlSuggestionSettings, setXmlSuggestionSettings] = useState(
    DEFAULT_STATE.xmlSuggestionSettings
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
  const [selectedScreen, setSelectedScreen] = useState(DEFAULT_STATE.selectedScreen);
  const [screensViewState, setScreensViewState] = useState(DEFAULT_STATE.screensViewState);
  const [flowViewState, setFlowViewState] = useState(DEFAULT_STATE.flowViewState);
  const [theme, setTheme] = useState(DEFAULT_STATE.theme);
  const [visibleModules, setVisibleModules] = useState(
    DEFAULT_STATE.visibleModules
  );
  const restoredSidebarSelectionRef = useRef(false);
  const [flowFocusRequest, setFlowFocusRequest] = useState(null);
  const navigationSeqRef = useRef(1);

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
  const persistedAppState = useMemo(
    () => ({
      xmlState: xml.getPersistableState(),
      theme,
      collapsedGroups,
      splitView,
      activeEditor,
      snowEnabled,
      editorViewState,
      xmlSuggestionSettings,
      sidebarWidth,
      sidebarCollapsed,
      selectedSidebarItem,
      viewMode,
      screensFolder,
      screensFolderInput,
      compilerState,
      selectedScreen,
      screensViewState,
      flowViewState,
      visibleModules,
    }),
    [
      xml,
      theme,
      collapsedGroups,
      splitView,
      activeEditor,
      snowEnabled,
      editorViewState,
      xmlSuggestionSettings,
      sidebarWidth,
      sidebarCollapsed,
      selectedSidebarItem,
      viewMode,
      screensFolder,
      screensFolderInput,
      compilerState,
      selectedScreen,
      screensViewState,
      flowViewState,
      visibleModules,
    ]
  );

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
        setXmlSuggestionSettings(
          s.xmlSuggestionSettings ?? DEFAULT_STATE.xmlSuggestionSettings
        );
        setSidebarWidth(s.sidebarWidth ?? DEFAULT_STATE.sidebarWidth);
        setSidebarCollapsed(!!(s.sidebarCollapsed ?? DEFAULT_STATE.sidebarCollapsed));
        setSelectedSidebarItem(s.selectedSidebarItem ?? DEFAULT_STATE.selectedSidebarItem);
        setViewMode(s.viewMode ?? DEFAULT_STATE.viewMode);
        setScreensFolder(s.screensFolder ?? DEFAULT_STATE.screensFolder);
        setScreensFolderInput(
          s.screensFolderInput ?? DEFAULT_STATE.screensFolderInput
        );
        setCompilerState(s.compilerState ?? DEFAULT_STATE.compilerState);
        setSelectedScreen(s.selectedScreen ?? DEFAULT_STATE.selectedScreen);
        setScreensViewState(s.screensViewState ?? DEFAULT_STATE.screensViewState);
        setFlowViewState(s.flowViewState ?? DEFAULT_STATE.flowViewState);
        setVisibleModules(s.visibleModules ?? DEFAULT_STATE.visibleModules);
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
    state: persistedAppState,
    debounceMs: 220,
    onLoaded: () => {
      setIsRestoringWorkspace(false);
    },
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

  useEffect(() => {
    if (visibleModules[viewMode]) return;

    const fallbackMode =
      Object.entries(visibleModules).find(([, enabled]) => enabled)?.[0] ??
      DEFAULT_STATE.viewMode;
    setViewMode(fallbackMode);
  }, [viewMode, visibleModules]);

  const resolveXmlPosition = (target) => {
    const source = xml.code || "";
    if (!target || !source) return null;

    let regex = null;
    if (typeof target === "object" && target?.type === "param") {
      regex = new RegExp(
        `<State\\b[^>]*Id=["']${String(target.stateId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>[\\s\\S]*?<Param[^>]*Key=["']${String(target.key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
        "i"
      );
    } else if (typeof target === "object" && target?.type === "sidebar") {
      const escapedValue = String(target.value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      switch (target.section) {
        case "General":
          regex = new RegExp(
            `<General\\b[^>]*>[\\s\\S]*?<Param[^>]*Key=["']${escapedValue}["'][^>]*>`,
            "i"
          );
          break;
        case "State":
          regex = new RegExp(`<State\\b[^>]*Id=["']${escapedValue}["'][^>]*>`, "i");
          break;
        case "Screen":
          regex = new RegExp(`<Screen\\b[^>]*Id=["']${escapedValue}["'][^>]*>`, "i");
          break;
        case "Fit":
          regex = new RegExp(`<Fit\\b[^>]*Id=["']${escapedValue}["'][^>]*>`, "i");
          break;
        case "Tran":
          regex = new RegExp(`<Tran\\b[^>]*Code=["']${escapedValue}["'][^>]*>`, "i");
          break;
        case "TranMap":
          regex = new RegExp(`<TranMap\\b[^>]*Id=["']${escapedValue}["'][^>]*>`, "i");
          break;
        case "Error":
          regex = new RegExp(`<Error\\b[^>]*RetCode=["']${escapedValue}["'][^>]*>`, "i");
          break;
        default:
          break;
      }
    } else {
      const stateId = String(target).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(`<State\\b[^>]*Id=["']${stateId}["'][^>]*>`, "i");
    }

    const match = source.match(regex);
    return match?.index ?? null;
  };

  const resolveSidebarTarget = (itemId) => {
    if (!itemId) return null;
    if (itemId.startsWith("General-")) {
      return {
        type: "sidebar",
        section: "General",
        value: itemId.slice(8),
      };
    }

    const [section, ...rest] = String(itemId).split("-");
    const value = rest.join("-");
    if (!section || !value) return null;

    const allowedSections = new Set(["State", "Screen", "Fit", "Tran", "TranMap", "Error"]);
    if (!allowedSections.has(section)) return null;

    return {
      type: "sidebar",
      section,
      value,
    };
  };

  useEffect(() => {
    if (!xml.xmlDoc || !selectedSidebarItem) return;
    if (restoredSidebarSelectionRef.current) return;
    if (viewMode !== "code") return;

    const editorTarget = splitView ? activeEditor : "left";
    const position = resolveXmlPosition(resolveSidebarTarget(selectedSidebarItem));
    if (position == null) return;

    restoredSidebarSelectionRef.current = true;
    setEditorNavigation({
      seq: navigationSeqRef.current++,
      target: editorTarget,
      pos: position,
      sidebarId: selectedSidebarItem,
    });
  }, [xml.xmlDoc, xml.code, selectedSidebarItem, viewMode, activeEditor, splitView]);

  const [screensList, setScreensList] = useState([]);
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
    setSidebarCollapsed(DEFAULT_STATE.sidebarCollapsed);
    setSelectedSidebarItem(DEFAULT_STATE.selectedSidebarItem);
    setEditorViewState(DEFAULT_STATE.editorViewState);
    setXmlSuggestionSettings(DEFAULT_STATE.xmlSuggestionSettings);
    setCompilerState(DEFAULT_STATE.compilerState);
    setSelectedScreen(DEFAULT_STATE.selectedScreen);
    setScreensViewState(DEFAULT_STATE.screensViewState);
    setFlowViewState(DEFAULT_STATE.flowViewState);
    setTheme(DEFAULT_STATE.theme);
    setVisibleModules(DEFAULT_STATE.visibleModules);
    setFlowFocusRequest(null);
    setEditorNavigation(null);
    restoredSidebarSelectionRef.current = false;

    setNotifications([]);

    await window.electronAPI?.saveAppState?.(null);
    setTimeout(() => {
      persistenceEnabledRef.current = true;
    }, 0);
  };

  console.log(xml);

  const getEffectiveEditorTarget = () => (splitView ? activeEditor : "left");

  const navigateToXmlTarget = (target) => {
    const editorTarget = getEffectiveEditorTarget();
    const position = resolveXmlPosition(target);
    if (position == null) {
      addNotification("error", "No se pudo ubicar el destino exacto en el XML.");
      return;
    }

    setViewMode("code");

    if (typeof target === "object" && target?.type === "param") {
      const sidebarId = `State-${target.stateId}`;
      setSelectedSidebarItem(sidebarId);
      setEditorNavigation({
        seq: navigationSeqRef.current++,
        target: editorTarget,
        pos: position,
        sidebarId,
      });
      return;
    }

    if (typeof target === "object" && target?.type === "sidebar") {
      const sidebarId =
        target.section === "General"
          ? `General-${target.value}`
          : `${target.section}-${target.value}`;
      setSelectedSidebarItem(sidebarId);
      setEditorNavigation({
        seq: navigationSeqRef.current++,
        target: editorTarget,
        pos: position,
        sidebarId,
      });
      return;
    }

    const sidebarId = `State-${target}`;
    setSelectedSidebarItem(sidebarId);
    setEditorNavigation({
      seq: navigationSeqRef.current++,
      target: editorTarget,
      pos: position,
      sidebarId,
    });
  };

  const openScreenForState = (stateOrScreenTarget) => {
    if (!xml.xmlDoc) return;

    if (
      stateOrScreenTarget &&
      typeof stateOrScreenTarget === "object" &&
      stateOrScreenTarget.screenId
    ) {
      const screenId = String(stateOrScreenTarget.screenId);
      const screenNode = Array.from(xml.xmlDoc.querySelectorAll("Screens > Screen")).find(
        (node) => node.getAttribute("Id") === screenId
      );
      const resourceParam = Array.from(screenNode?.children || []).find(
        (child) => child.tagName === "Param" && child.getAttribute("Key") === "Resource"
      );
      const resource = resourceParam?.textContent?.trim?.();
      if (!resource) {
        addNotification("info", `La Screen ${screenId} no tiene recurso HTML asociado.`);
        return;
      }

      const match = screensList.find(
        (screen) => String(screen.resource || "").toLowerCase() === String(resource).toLowerCase()
      );
      if (!match) {
        addNotification("info", `La pantalla ${resource} no esta cargada en el modulo Pantallas.`);
        return;
      }

      setViewMode("screens");
      setSelectedScreen(match);
      return;
    }

    const stateId = String(stateOrScreenTarget);

    const stateNode = Array.from(xml.xmlDoc.querySelectorAll("States > State")).find(
      (node) => node.getAttribute("Id") === stateId
    );
    if (!stateNode) {
      addNotification("error", `No se encontro el State ${stateId} en el XML.`);
      return;
    }

    const screenParam = Array.from(stateNode.children || []).find(
      (child) => child.tagName === "Param" && child.getAttribute("Key") === "Screen"
    );
    const screenId = screenParam?.textContent?.trim?.();
    if (!screenId) {
      addNotification("info", `El State ${stateId} no tiene pantalla asociada.`);
      return;
    }

    const screenNode = Array.from(xml.xmlDoc.querySelectorAll("Screens > Screen")).find(
      (node) => node.getAttribute("Id") === screenId
    );
    const resourceParam = Array.from(screenNode?.children || []).find(
      (child) => child.tagName === "Param" && child.getAttribute("Key") === "Resource"
    );
    const resource = resourceParam?.textContent?.trim?.();
    if (!resource) {
      addNotification("info", `La Screen ${screenId} no tiene recurso HTML asociado.`);
      return;
    }

    const match = screensList.find(
      (screen) => String(screen.resource || "").toLowerCase() === String(resource).toLowerCase()
    );
    if (!match) {
      addNotification("info", `La pantalla ${resource} no esta cargada en el modulo Pantallas.`);
      return;
    }

    setViewMode("screens");
    setSelectedScreen(match);
  };

  if (isRestoringWorkspace) {
    return (
      <div className="app-loader-shell">
        <div className="app-loader-card">
          <div className="app-loader-spinner" />
          <div className="app-loader-title">Restaurando workspace</div>
          <div className="app-loader-subtitle">Cargando tu ultima sesion automatica...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TitleBar
        fileName={xml.fileInfo?.name}
        theme={theme}
        setTheme={setTheme}
        snowEnabled={snowEnabled}
        toggleSnow={() => setSnowEnabled((v) => !v)}
        onResetApp={resetAppState}
        visibleModules={visibleModules}
        setVisibleModules={setVisibleModules}
        getCurrentAppState={() => ({
          xmlState: xml.getPersistableState(),
          theme,
          collapsedGroups,
          splitView,
          activeEditor,
          snowEnabled,
          editorViewState,
          xmlSuggestionSettings,
          sidebarWidth,
          sidebarCollapsed,
          selectedSidebarItem,
          viewMode,
          screensFolder,
          screensFolderInput,
          compilerState,
          selectedScreen,
          screensViewState,
          flowViewState,
          visibleModules,
        })}
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
        visibleModules={visibleModules}
        xmlDoc={xml.xmlDoc}
        snowEnabled={snowEnabled}
        toggleSnow={() => setSnowEnabled((v) => !v)}
      />

      <div className="workspace">
        <Sidebar
          xmlDoc={xml.xmlDoc}
          collapsed={collapsedGroups}
          setCollapsed={setCollapsedGroups}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          selectedItem={selectedSidebarItem}
          onSelect={(id) => {
            restoredSidebarSelectionRef.current = true;
            setSelectedSidebarItem(id);
            const navigationTarget = resolveSidebarTarget(id);
            if (!navigationTarget) {
              setViewMode("code");
              return;
            }
            const position = resolveXmlPosition(navigationTarget);
            if (position == null) return;
            setViewMode("code");
            setEditorNavigation({
              seq: navigationSeqRef.current++,
              target: getEffectiveEditorTarget(),
              pos: position,
              sidebarId: id,
            });
          }}
          style={{ width: sidebarCollapsed ? 54 : sidebarWidth }}
        />

        {!sidebarCollapsed && <div className="sidebar-resizer" onMouseDown={startResize} />}

        <div className="editor-wrapper full">
          {/* ======================= CODE ======================= */}
          {visibleModules.code && viewMode === "code" && (
            <div style={{ height: "100%" }}>
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
                  suggestionSettings={xmlSuggestionSettings}
                  setSuggestionSettings={setXmlSuggestionSettings}
                />

                <div className={`editor-div ${splitView ? "split" : ""}`}>
                  <CodeEditor
                    code={xml.code}
                    onChange={xml.setCode}
                    navigationRequest={editorNavigation}
                    onSave={xml.saveXml}
                    canSave={xml.dirty}
                    editable={true}
                    onFocus={(key) => setActiveEditor(key)}
                    syncKey="left"
                    viewMode={viewMode}
                    theme={theme}
                    editorViewState={editorViewState}
                    setEditorViewState={setEditorViewState}
                    xmlDoc={xml.xmlDoc}
                    suggestionSettings={xmlSuggestionSettings}
                    onOpenFlowState={(stateId) => {
                      setFlowFocusRequest({
                        id: String(stateId),
                        seq: Date.now() + Math.random(),
                      });
                      setViewMode("flows");
                    }}
                    onOpenScreenForState={openScreenForState}
                  />

                  {splitView && (
                    <CodeEditor
                      code={xml.code}
                      onChange={xml.setCode}
                      navigationRequest={editorNavigation}
                      editable={true}
                      viewMode={viewMode}
                      onFocus={(key) => setActiveEditor(key)}
                      syncKey="right"
                      theme={theme}
                      editorViewState={editorViewState}
                      setEditorViewState={setEditorViewState}
                      xmlDoc={xml.xmlDoc}
                      suggestionSettings={xmlSuggestionSettings}
                      onOpenFlowState={(stateId) => {
                        setFlowFocusRequest({
                          id: String(stateId),
                          seq: Date.now() + Math.random(),
                        });
                        setViewMode("flows");
                      }}
                      onOpenScreenForState={openScreenForState}
                    />
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          {/* ======================= SCREENS ======================= */}
          {visibleModules.screens && viewMode === "screens" && (
            <div style={{ height: "100%" }}>
            <ScreensPanel
              screensFolder={screensFolder}
              setScreensFolder={setScreensFolder}
              screensFolderInput={screensFolderInput}
              setScreensFolderInput={setScreensFolderInput}
              screensList={screensList}
              selectedScreen={selectedScreen}
              onSelectScreen={setSelectedScreen}
              screensViewState={screensViewState}
              onScreensViewStateChange={setScreensViewState}
              setScreensList={setScreensList}
            />
            </div>
          )}

          {/* ======================= COMPILER ======================= */}
          {visibleModules.compiler && viewMode === "compiler" && (
            <div style={{ height: "100%" }}>
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
          )}

          {/* ======================= REMOTE ======================= */}
          {visibleModules.remote && viewMode === "remote" && (
            <div style={{ height: "100%" }}>
            <RemoteViewer apiBaseUrl="https://192.168.10.241:5007" />
            </div>
          )}

          {/* ======================= FLOWS ======================= */}
          {visibleModules.flows && viewMode === "flows" && (
            <div style={{ height: "100%" }}>
            {xml.xmlDoc ? (
              <FlowsPanel
                xmlDoc={xml.xmlDoc}
                focusStateId={flowFocusRequest?.id || null}
                focusStateKey={flowFocusRequest?.seq || null}
                flowViewState={flowViewState}
                onFlowViewStateChange={setFlowViewState}
                screensLoaded={!!screensFolder}
                screensList={screensList}
                onSelectState={(target) => {
                  restoredSidebarSelectionRef.current = true;
                  navigateToXmlTarget(target);
                }}
                onOpenScreen={(screen) => {
                  if (!screen) return;
                  setViewMode("screens");
                  setSelectedScreen(screen);
                }}
              />
            ) : (
              <EmptyState onLoadClick={xml.openFile} onNewClick={xml.newXml} />
            )}
            </div>
          )}
        </div>
      </div>

      <NotificationContainer
        notifications={notifications}
        removeNotification={removeNotification}
      />
    </div>
  );
}
