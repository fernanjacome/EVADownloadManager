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
import XmlCompareView from "./components/xmlCompare/XmlCompareView";
import LogsPanel from "./components/logViewer/LogsPanel";
import { useSnowEffect } from "./hooks/useSnowEffect";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useXmlEditor } from "./hooks/useXmlEditor";
import { usePreventZoom } from "./hooks/usePreventZoom";
import { useAppPersistence } from "./hooks/useAppPersistence";
import { groupOrder } from "./utils/sidebarConfig";
import { FiMaximize, FiMinimize2 } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import { FaWindowMinimize } from "react-icons/fa6";

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
  xmlSuggestionSettings: { activation: "typing", statePreview: true },
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
  compareState: null,
  logsState: null,
  theme: "light",
  visibleModules: {
    code: true,
    compare: true,
    screens: true,
    compiler: true,
    flows: true,
    logs: true,
    remote: true,
  },
  detachedModule: null,
  detachedModules: [],
};

const MODULE_LABELS = {
  code: "XML",
  compare: "Comparar",
  screens: "Pantallas",
  compiler: "Compilador",
  flows: "Flujos",
  logs: "Logs",
  remote: "Remoto",
};

const createDetachedModuleVisibility = (moduleKey) =>
  Object.fromEntries(
    Object.keys(DEFAULT_STATE.visibleModules).map((key) => [
      key,
      key === moduleKey,
    ]),
  );

export default function App() {
  const [isRestoringWorkspace, setIsRestoringWorkspace] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [editorNavigation, setEditorNavigation] = useState(null);
  const [splitView, setSplitView] = useState(DEFAULT_STATE.splitView);
  const [activeEditor, setActiveEditor] = useState(DEFAULT_STATE.activeEditor);
  const [snowEnabled, setSnowEnabled] = useState(DEFAULT_STATE.snowEnabled);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_STATE.sidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    DEFAULT_STATE.sidebarCollapsed,
  );
  const [selectedSidebarItem, setSelectedSidebarItem] = useState(
    DEFAULT_STATE.selectedSidebarItem,
  );
  const [editorViewState, setEditorViewState] = useState(
    DEFAULT_STATE.editorViewState,
  );
  const [xmlSuggestionSettings, setXmlSuggestionSettings] = useState(
    DEFAULT_STATE.xmlSuggestionSettings,
  );
  const [viewMode, setViewMode] = useState(DEFAULT_STATE.viewMode);
  const [screensFolder, setScreensFolder] = useState(
    DEFAULT_STATE.screensFolder,
  );
  const [screensFolderInput, setScreensFolderInput] = useState(
    DEFAULT_STATE.screensFolderInput,
  );
  const [compilerState, setCompilerState] = useState(
    DEFAULT_STATE.compilerState,
  );
  const [selectedScreen, setSelectedScreen] = useState(
    DEFAULT_STATE.selectedScreen,
  );
  const [screensViewState, setScreensViewState] = useState(
    DEFAULT_STATE.screensViewState,
  );
  const [flowViewState, setFlowViewState] = useState(
    DEFAULT_STATE.flowViewState,
  );
  const [compareState, setCompareState] = useState(DEFAULT_STATE.compareState);
  const [logsState, setLogsState] = useState(DEFAULT_STATE.logsState);
  const [theme, setTheme] = useState(DEFAULT_STATE.theme);
  const [visibleModules, setVisibleModules] = useState(
    DEFAULT_STATE.visibleModules,
  );
  const [detachedModule, setDetachedModule] = useState(
    DEFAULT_STATE.detachedModule,
  );
  const [detachedModules, setDetachedModules] = useState(
    DEFAULT_STATE.detachedModules,
  );
  const restoredSidebarSelectionRef = useRef(false);
  const [flowFocusRequest, setFlowFocusRequest] = useState(null);
  const navigationSeqRef = useRef(1);

  const [collapsedGroups, setCollapsedGroups] = useState(
    Object.fromEntries(groupOrder.map((g) => [g, true])),
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
  const persistencePausedRef = useRef(false);
  const persistenceResumeTimerRef = useRef(null);
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
      compareState,
      logsState,
      visibleModules,
      detachedModule,
      detachedModules,
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
      compareState,
      logsState,
      visibleModules,
      detachedModule,
      detachedModules,
    ],
  );

  useAppPersistence({
    enabledRef: persistenceEnabledRef,
    pauseSaveRef: persistencePausedRef,

    load: async () => {
      const res = await window.electronAPI?.loadAppState?.();
      const s = res?.success ? res.data : null;

      if (s) {
        persistencePausedRef.current = true;
        if (persistenceResumeTimerRef.current) {
          clearTimeout(persistenceResumeTimerRef.current);
        }
        persistenceResumeTimerRef.current = setTimeout(() => {
          persistencePausedRef.current = false;
          persistenceResumeTimerRef.current = null;
        }, 120);

        if (s.xmlState) xml.hydrate(s.xmlState);

        setTheme(s.theme ?? DEFAULT_STATE.theme);
        setSplitView(!!s.splitView);
        setActiveEditor(s.activeEditor ?? DEFAULT_STATE.activeEditor);
        setSnowEnabled(!!s.snowEnabled);
        setEditorViewState(s.editorViewState ?? DEFAULT_STATE.editorViewState);
        setXmlSuggestionSettings(
          s.xmlSuggestionSettings ?? DEFAULT_STATE.xmlSuggestionSettings,
        );
        setSidebarWidth(s.sidebarWidth ?? DEFAULT_STATE.sidebarWidth);
        setSidebarCollapsed(
          !!(s.sidebarCollapsed ?? DEFAULT_STATE.sidebarCollapsed),
        );
        setSelectedSidebarItem(
          s.selectedSidebarItem ?? DEFAULT_STATE.selectedSidebarItem,
        );
        setViewMode(s.viewMode ?? DEFAULT_STATE.viewMode);
        setScreensFolder(s.screensFolder ?? DEFAULT_STATE.screensFolder);
        setScreensFolderInput(
          s.screensFolderInput ?? DEFAULT_STATE.screensFolderInput,
        );
        setCompilerState(s.compilerState ?? DEFAULT_STATE.compilerState);
        setSelectedScreen(s.selectedScreen ?? DEFAULT_STATE.selectedScreen);
        setScreensViewState(
          s.screensViewState ?? DEFAULT_STATE.screensViewState,
        );
        setFlowViewState(s.flowViewState ?? DEFAULT_STATE.flowViewState);
        setCompareState(s.compareState ?? DEFAULT_STATE.compareState);
        setLogsState(s.logsState ?? DEFAULT_STATE.logsState);
        const restoredDetachedModules = Array.isArray(s.detachedModules)
          ? s.detachedModules.filter((key) =>
              Object.prototype.hasOwnProperty.call(
                DEFAULT_STATE.visibleModules,
                key,
              ),
            )
          : [];
        const restoredVisibleModules = {
          ...DEFAULT_STATE.visibleModules,
          ...(s.visibleModules ?? {}),
        };
        restoredDetachedModules.forEach((key) => {
          restoredVisibleModules[key] = true;
        });

        setVisibleModules(restoredVisibleModules);
        setDetachedModule(s.detachedModule ?? DEFAULT_STATE.detachedModule);
        setDetachedModules(DEFAULT_STATE.detachedModules);
        setCollapsedGroups(
          s.collapsedGroups ??
            Object.fromEntries(groupOrder.map((g) => [g, true])),
        );
      }

      return {
        xmlState: s?.xmlState ?? xml.getPersistableState(),
        ...DEFAULT_STATE,
        ...s,
        detachedModules: DEFAULT_STATE.detachedModules,
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

  const pausePersistenceForLinkedState = () => {
    persistencePausedRef.current = true;
    if (persistenceResumeTimerRef.current) {
      clearTimeout(persistenceResumeTimerRef.current);
    }
    persistenceResumeTimerRef.current = setTimeout(() => {
      persistencePausedRef.current = false;
      persistenceResumeTimerRef.current = null;
    }, 120);
  };

  const applyDetachedModuleState = (state) => {
    if (!state) return;

    pausePersistenceForLinkedState();

    if (state.xmlState) xml.hydrate(state.xmlState);
    if (state.compilerState) setCompilerState(state.compilerState);
    if (Object.prototype.hasOwnProperty.call(state, "compareState")) {
      setCompareState(state.compareState);
    }
    if (Object.prototype.hasOwnProperty.call(state, "logsState")) {
      setLogsState(state.logsState);
    }
    if (Object.prototype.hasOwnProperty.call(state, "screensFolder")) {
      setScreensFolder(state.screensFolder ?? DEFAULT_STATE.screensFolder);
    }
    if (Object.prototype.hasOwnProperty.call(state, "screensFolderInput")) {
      setScreensFolderInput(
        state.screensFolderInput ?? DEFAULT_STATE.screensFolderInput,
      );
    }
    if (Object.prototype.hasOwnProperty.call(state, "selectedScreen")) {
      setSelectedScreen(state.selectedScreen ?? DEFAULT_STATE.selectedScreen);
    }
    if (state.screensViewState) setScreensViewState(state.screensViewState);
    if (state.flowViewState) setFlowViewState(state.flowViewState);
    if (state.editorViewState) setEditorViewState(state.editorViewState);
    if (state.xmlSuggestionSettings) {
      setXmlSuggestionSettings(state.xmlSuggestionSettings);
    }
  };

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
    if (visibleModules?.[viewMode] !== false) return;

    const fallbackMode =
      Object.entries(visibleModules).find(([, enabled]) => enabled)?.[0] ??
      DEFAULT_STATE.viewMode;
    setViewMode(fallbackMode);
  }, [viewMode, visibleModules]);

  useEffect(() => {
    if (!detachedModule) return;
    const moduleLabel = MODULE_LABELS[detachedModule] || detachedModule;
    window.electronAPI?.setWindowTitle?.(`${moduleLabel} - EVA Studio 2026`);
  }, [detachedModule]);

  const resolveXmlPosition = (target) => {
    const source = xml.code || "";
    if (!target || !source) return null;

    let regex = null;
    if (typeof target === "object" && target?.type === "param") {
      regex = new RegExp(
        `<State\\b[^>]*Id=["']${String(target.stateId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>[\\s\\S]*?<Param[^>]*Key=["']${String(target.key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
        "i",
      );
    } else if (typeof target === "object" && target?.type === "sidebar") {
      const escapedValue = String(target.value ?? "").replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      switch (target.section) {
        case "General":
          regex = new RegExp(
            `<General\\b[^>]*>[\\s\\S]*?<Param[^>]*Key=["']${escapedValue}["'][^>]*>`,
            "i",
          );
          break;
        case "State":
          regex = new RegExp(
            `<State\\b[^>]*Id=["']${escapedValue}["'][^>]*>`,
            "i",
          );
          break;
        case "Screen":
          regex = new RegExp(
            `<Screen\\b[^>]*Id=["']${escapedValue}["'][^>]*>`,
            "i",
          );
          break;
        case "Fit":
          regex = new RegExp(
            `<Fit\\b[^>]*Id=["']${escapedValue}["'][^>]*>`,
            "i",
          );
          break;
        case "Tran":
          regex = new RegExp(
            `<Tran\\b[^>]*Code=["']${escapedValue}["'][^>]*>`,
            "i",
          );
          break;
        case "TranMap":
          regex = new RegExp(
            `<TranMap\\b[^>]*Id=["']${escapedValue}["'][^>]*>`,
            "i",
          );
          break;
        case "Error":
          regex = new RegExp(
            `<Error\\b[^>]*RetCode=["']${escapedValue}["'][^>]*>`,
            "i",
          );
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

    const allowedSections = new Set([
      "State",
      "Screen",
      "Fit",
      "Tran",
      "TranMap",
      "Error",
    ]);
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
    const position = resolveXmlPosition(
      resolveSidebarTarget(selectedSidebarItem),
    );
    if (position == null) return;

    restoredSidebarSelectionRef.current = true;
    setEditorNavigation({
      seq: navigationSeqRef.current++,
      target: editorTarget,
      pos: position,
      sidebarId: selectedSidebarItem,
    });
  }, [
    xml.xmlDoc,
    xml.code,
    selectedSidebarItem,
    viewMode,
    activeEditor,
    splitView,
  ]);

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
    return () => {
      window.removeEventListener("tryAppClose", handleAppClose);
      if (persistenceResumeTimerRef.current) {
        clearTimeout(persistenceResumeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onDetachedModuleDocked?.(
      ({ moduleKey, state }) => {
        if (!moduleKey) return;
        applyDetachedModuleState(state);
        setVisibleModules((prev) => ({
          ...(prev || DEFAULT_STATE.visibleModules),
          [moduleKey]: true,
        }));
        setDetachedModules((prev) => prev.filter((key) => key !== moduleKey));
        setViewMode(moduleKey);
      },
    );

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onLinkedModuleStateUpdated?.(
      ({ source, state }) => {
        if (!state) return;
        if (source === "parent" && detachedModule) {
          applyDetachedModuleState(state);
          return;
        }
        if (source === "detached" && !detachedModule) {
          applyDetachedModuleState(state);
        }
      },
    );

    return () => unsubscribe?.();
  }, [detachedModule]);

  useEffect(() => {
    if (detachedModule) return undefined;

    const unsubscribe = window.electronAPI?.onDetachedModuleNavigation?.(
      ({ action, payload }) => {
        switch (action) {
          case "navigateToXmlTarget":
            restoredSidebarSelectionRef.current = true;
            navigateToXmlTarget(payload);
            break;
          case "openScreenForState":
            openScreenForState(payload);
            break;
          case "openScreen":
            if (!payload) return;
            setViewMode("screens");
            setSelectedScreen(payload);
            break;
          case "openFlowState":
            if (!payload?.stateId) return;
            setFlowFocusRequest({
              id: String(payload.stateId),
              seq: Date.now() + Math.random(),
            });
            setViewMode("flows");
            break;
          default:
            break;
        }
      },
    );

    return () => unsubscribe?.();
  }, [
    detachedModule,
    xml.xmlDoc,
    xml.code,
    screensList,
    activeEditor,
    splitView,
  ]);

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
    setCompareState(DEFAULT_STATE.compareState);
    setLogsState(DEFAULT_STATE.logsState);
    setTheme(DEFAULT_STATE.theme);
    setVisibleModules(DEFAULT_STATE.visibleModules);
    setDetachedModule(DEFAULT_STATE.detachedModule);
    setDetachedModules(DEFAULT_STATE.detachedModules);
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
      addNotification(
        "error",
        "No se pudo ubicar el destino exacto en el XML.",
      );
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

    const resolveScreenResource = (screenId) => {
      const screenNode = Array.from(
        xml.xmlDoc.querySelectorAll("Screens > Screen"),
      ).find((node) => node.getAttribute("Id") === screenId);
      const resourceParam = Array.from(screenNode?.children || []).find(
        (child) =>
          child.tagName === "Param" && child.getAttribute("Key") === "Resource",
      );
      return resourceParam?.textContent?.trim?.() || "";
    };

    const navigateToScreen = (resource, screenId) => {
      if (!resource) {
        addNotification(
          "info",
          `La Screen ${screenId} no tiene recurso HTML asociado.`,
        );
        return;
      }

      const resourceFile = resource.split("?")[0].trim();
      const match = screensList.find(
        (screen) =>
          String(screen.resource || "").toLowerCase() ===
          resourceFile.toLowerCase(),
      );

      if (!screensFolder) {
        addNotification(
          "info",
          "Carga una carpeta en el modulo Pantallas primero.",
        );
        return;
      }

      setViewMode("screens");
      const screenObj = match || {
        id: resourceFile.replace(/\.html?$/i, ""),
        comment: "",
        resource: resourceFile,
      };
      setSelectedScreen({ ...screenObj, resource, _nav: Date.now() });
    };

    if (
      stateOrScreenTarget &&
      typeof stateOrScreenTarget === "object" &&
      stateOrScreenTarget.screenId
    ) {
      const screenId = String(stateOrScreenTarget.screenId);
      const resource = resolveScreenResource(screenId);
      navigateToScreen(resource, screenId);
      return;
    }

    const stateId = String(stateOrScreenTarget);
    const stateNode = Array.from(
      xml.xmlDoc.querySelectorAll("States > State"),
    ).find((node) => node.getAttribute("Id") === stateId);
    if (!stateNode) {
      addNotification("error", `No se encontro el State ${stateId} en el XML.`);
      return;
    }

    const screenParam = Array.from(stateNode.children || []).find(
      (child) =>
        child.tagName === "Param" && child.getAttribute("Key") === "Screen",
    );
    const screenId = screenParam?.textContent?.trim?.();
    if (!screenId) {
      addNotification(
        "info",
        `El State ${stateId} no tiene pantalla asociada.`,
      );
      return;
    }

    const resource = resolveScreenResource(screenId);
    navigateToScreen(resource, screenId);
  };

  const requestParentNavigation = (action, payload) => {
    if (!detachedModule) return false;
    window.electronAPI?.requestParentNavigation?.(action, payload);
    return true;
  };

  const openFlowState = (stateId) => {
    if (requestParentNavigation("openFlowState", { stateId })) return;
    setFlowFocusRequest({
      id: String(stateId),
      seq: Date.now() + Math.random(),
    });
    setViewMode("flows");
  };

  const openScreenTarget = (target) => {
    if (requestParentNavigation("openScreenForState", target)) return;
    openScreenForState(target);
  };

  const selectFlowState = (target) => {
    restoredSidebarSelectionRef.current = true;
    if (requestParentNavigation("navigateToXmlTarget", target)) return;
    navigateToXmlTarget(target);
  };

  const openFlowScreen = (screen) => {
    if (!screen) return;
    if (requestParentNavigation("openScreen", screen)) return;
    setViewMode("screens");
    setSelectedScreen(screen);
  };

  const detachModule = async (moduleKey) => {
    if (
      !Object.prototype.hasOwnProperty.call(
        DEFAULT_STATE.visibleModules,
        moduleKey,
      )
    ) {
      return;
    }

    if (!window.electronAPI?.openDetachedModuleWindow) {
      addNotification(
        "error",
        "El desacople de modulos solo esta disponible en Electron.",
      );
      return;
    }

    const moduleLabel = MODULE_LABELS[moduleKey] || moduleKey;
    const detachedState = {
      ...persistedAppState,
      viewMode: moduleKey,
      visibleModules: createDetachedModuleVisibility(moduleKey),
      detachedModule: moduleKey,
      detachedModules: [],
    };

    const result = await window.electronAPI.openDetachedModuleWindow(
      moduleKey,
      detachedState,
    );

    if (!result?.success) {
      addNotification(
        "error",
        result?.error || `No se pudo desacoplar el modulo ${moduleLabel}.`,
      );
      return;
    }

    setVisibleModules((prev) => {
      const nextModules = prev || DEFAULT_STATE.visibleModules;
      const enabledCount = Object.values(nextModules).filter(Boolean).length;
      if (nextModules[moduleKey] === false || enabledCount <= 1) return prev;
      return {
        ...nextModules,
        [moduleKey]: false,
      };
    });
    setDetachedModules((prev) =>
      prev.includes(moduleKey) ? prev : [...prev, moduleKey],
    );
  };

  const renderModuleContent = (moduleKey) => {
    switch (moduleKey) {
      case "code":
        return !xml.xmlDoc ? (
          <EmptyState onLoadClick={xml.openFile} onNewClick={xml.newXml} />
        ) : (
          <div className={`editor-wrapper ${splitView ? "split" : ""}`}>
            <EditorToolbar
              viewMode="code"
              onSave={xml.saveXml}
              onRestoreOriginal={xml.restoreOriginal}
              onFormat={() => {
                const formatted = formatXml(xml.code);
                if (formatted) xml.setCode(formatted);
              }}
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
                viewMode="code"
                theme={theme}
                editorViewState={editorViewState}
                setEditorViewState={setEditorViewState}
                splitView={splitView}
                xmlDoc={xml.xmlDoc}
                suggestionSettings={xmlSuggestionSettings}
                onOpenFlowState={openFlowState}
                onOpenScreenForState={openScreenTarget}
              />

              {splitView && (
                <CodeEditor
                  code={xml.code}
                  onChange={xml.setCode}
                  navigationRequest={editorNavigation}
                  editable={true}
                  viewMode="code"
                  onFocus={(key) => setActiveEditor(key)}
                  syncKey="right"
                  theme={theme}
                  editorViewState={editorViewState}
                  setEditorViewState={setEditorViewState}
                  splitView={splitView}
                  xmlDoc={xml.xmlDoc}
                  suggestionSettings={xmlSuggestionSettings}
                  onOpenFlowState={openFlowState}
                  onOpenScreenForState={openScreenTarget}
                />
              )}
            </div>
          </div>
        );
      case "compare":
        return (
          <XmlCompareView
            currentXml={xml.code}
            currentFileName={
              xml.filePath || xml.fileInfo?.name || xml.title || "XML actual"
            }
            currentFilePath={xml.filePath}
            notify={addNotification}
            initialState={compareState}
            onStateChange={setCompareState}
            onSideSaved={({ path, text }) =>
              xml.syncExternalSave({ path, code: text })
            }
          />
        );
      case "screens":
        return (
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
            theme={theme}
          />
        );
      case "compiler":
        return (
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
        );
      case "remote":
        return <RemoteViewer apiBaseUrl="https://192.168.10.241:5007" />;
      case "logs":
        return (
          <LogsPanel
            logsState={logsState}
            onLogsStateChange={setLogsState}
            notify={addNotification}
          />
        );
      case "flows":
        return xml.xmlDoc ? (
          <FlowsPanel
            xmlDoc={xml.xmlDoc}
            focusStateId={flowFocusRequest?.id || null}
            focusStateKey={flowFocusRequest?.seq || null}
            flowViewState={flowViewState}
            onFlowViewStateChange={setFlowViewState}
            screensLoaded={!!screensFolder}
            screensList={screensList}
            onSelectState={selectFlowState}
            onOpenScreen={openFlowScreen}
          />
        ) : (
          <EmptyState onLoadClick={xml.openFile} onNewClick={xml.newXml} />
        );
      default:
        return null;
    }
  };

  const handleDockDetachedModule = async () => {
    if (!detachedModule) return;

    const result = await window.electronAPI?.dockDetachedModule?.(
      detachedModule,
      null,
      { force: true },
    );

    if (!result?.success) {
      addNotification("error", "No se pudo acoplar la ventana.");
      return;
    }

    if (!result.docked) {
      addNotification(
        "info",
        "No encontre la ventana principal para acoplar este modulo.",
      );
    }
  };

  if (isRestoringWorkspace) {
    return (
      <div className="app-loader-shell">
        <div className="app-loader-card">
          <div className="app-loader-spinner" />
          <div className="app-loader-title">Restaurando workspace</div>
          <div className="app-loader-subtitle">
            Cargando tu ultima sesion automatica...
          </div>
        </div>
      </div>
    );
  }

  if (detachedModule) {
    const moduleLabel = MODULE_LABELS[detachedModule] || detachedModule;

    return (
      <div className="detached-module-app">
        <div
          className="detached-module-bar"
          onDoubleClick={(event) => {
            if (event.target.closest("button")) return;
            window.electronAPI?.windowControl("maximize");
          }}
          title="Arrastra esta barra para mover la ventana"
        >
          <div className="detached-module-title">{moduleLabel}</div>
          <div className="detached-window-controls">
            <button
              className="detached-win-btn dock"
              onClick={(event) => {
                event.stopPropagation();
                handleDockDetachedModule();
              }}
              title="Volver a acoplar"
            >
              <FiMinimize2 />
              <span>Acoplar</span>
            </button>
            <button
              className="detached-win-btn"
              onClick={(event) => {
                event.stopPropagation();
                window.electronAPI?.windowControl("minimize");
              }}
              title="Minimizar"
            >
              <FaWindowMinimize />
            </button>
            <button
              className="detached-win-btn"
              onClick={(event) => {
                event.stopPropagation();
                window.electronAPI?.windowControl("maximize");
              }}
              title="Maximizar"
            >
              <FiMaximize />
            </button>
            <button
              className="detached-win-btn close"
              onClick={(event) => {
                event.stopPropagation();
                window.electronAPI?.windowControl("close");
              }}
              title="Cerrar"
            >
              <IoClose />
            </button>
          </div>
        </div>
        <div className="detached-module-body">
          {renderModuleContent(detachedModule)}
        </div>
        <NotificationContainer
          notifications={notifications}
          removeNotification={removeNotification}
        />
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
          compareState,
          logsState,
          visibleModules,
          detachedModule,
          detachedModules,
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
        onDetachModule={detachModule}
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
          style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
        />

        {!sidebarCollapsed && (
          <div
            className="sidebar-resizer"
            onMouseDown={startResize}
            onDoubleClick={() => setSidebarWidth(240)}
          />
        )}

        <div className="editor-wrapper full">
          {/* ======================= CODE ======================= */}
          {visibleModules.code && (
            <div
              style={{
                height: "100%",
                display: viewMode === "code" ? "block" : "none",
              }}
            >
              {!xml.xmlDoc ? (
                <EmptyState
                  onLoadClick={xml.openFile}
                  onNewClick={xml.newXml}
                />
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
                      splitView={splitView}
                      xmlDoc={xml.xmlDoc}
                      suggestionSettings={xmlSuggestionSettings}
                      onOpenFlowState={openFlowState}
                      onOpenScreenForState={openScreenTarget}
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
                        splitView={splitView}
                        xmlDoc={xml.xmlDoc}
                        suggestionSettings={xmlSuggestionSettings}
                        onOpenFlowState={openFlowState}
                        onOpenScreenForState={openScreenTarget}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================= XML COMPARE ======================= */}
          {visibleModules.compare !== false && viewMode === "compare" && (
            <div style={{ height: "100%" }}>
              <XmlCompareView
                currentXml={xml.code}
                currentFileName={
                  xml.filePath ||
                  xml.fileInfo?.name ||
                  xml.title ||
                  "XML actual"
                }
                currentFilePath={xml.filePath}
                notify={addNotification}
                initialState={compareState}
                onStateChange={setCompareState}
                onSideSaved={({ path, text }) =>
                  xml.syncExternalSave({ path, code: text })
                }
              />
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
                theme={theme}
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

          {/* ======================= LOGS ======================= */}
          {visibleModules.logs && viewMode === "logs" && (
            <div style={{ height: "100%" }}>
              <LogsPanel
                logsState={logsState}
                onLogsStateChange={setLogsState}
                notify={addNotification}
              />
            </div>
          )}

          {/* ======================= FLOWS ======================= */}
          {visibleModules.flows && (
            <div
              style={{
                height: "100%",
                display: viewMode === "flows" ? "block" : "none",
              }}
            >
              {xml.xmlDoc ? (
                <FlowsPanel
                  xmlDoc={xml.xmlDoc}
                  focusStateId={flowFocusRequest?.id || null}
                  focusStateKey={flowFocusRequest?.seq || null}
                  flowViewState={flowViewState}
                  onFlowViewStateChange={setFlowViewState}
                  screensLoaded={!!screensFolder}
                  screensList={screensList}
                  onSelectState={selectFlowState}
                  onOpenScreen={openFlowScreen}
                />
              ) : (
                <EmptyState
                  onLoadClick={xml.openFile}
                  onNewClick={xml.newXml}
                />
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
