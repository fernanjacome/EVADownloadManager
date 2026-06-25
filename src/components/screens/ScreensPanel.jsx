import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ScreenSelector from "./ScreenSelector";
import ScreenViewer from "./ScreenViewer";
import ScreenResourceEditor, {
  canFormatResource,
  formatScreenResource,
} from "./ScreenResourceEditor";
import "./screens.css";
import {
  FaChevronDown,
  FaChevronRight,
  FaFolderOpen,
  FaPlay,
  FaSave,
  FaUndo,
} from "react-icons/fa";
import {
  FaBolt,
  FaCode,
  FaRotateRight,
  FaStop,
  FaTrashCan,
} from "react-icons/fa6";
import {
  FiAlertTriangle,
  FiClipboard,
  FiCopy,
  FiExternalLink,
  FiFile,
  FiFilePlus,
  FiFolderPlus,
  FiRefreshCw,
  FiScissors,
  FiSearch,
  FiX,
} from "react-icons/fi";

const STORAGE_KEY = "screens_panel_state";

const normalizeResource = (value) =>
  String(value || "")
    .split("?")[0]
    .replace(/\\/g, "/");

const getParentPath = (value) =>
  String(value || "")
    .split("/")
    .slice(0, -1)
    .join("/");

const getExtension = (resource) =>
  String(resource?.extension || "").toLowerCase();
const isHtmlResource = (resource) =>
  [".html", ".htm"].includes(getExtension(resource));
const isImageResource = (resource) =>
  [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg"].includes(
    getExtension(resource),
  );

function resolvePath(basePath, relativePath) {
  const clean = relativePath.split("?")[0].split("#")[0];
  const baseDir = basePath.split("/").slice(0, -1).join("/");
  const parts = (baseDir ? `${baseDir}/${clean}` : clean).split("/");
  const normalized = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.join("/");
}

function remapRenamedPath(value, sourcePath, targetPath) {
  if (!value) return value;
  if (value === sourcePath) return targetPath;
  if (value.startsWith(`${sourcePath}/`)) {
    return `${targetPath}${value.slice(sourcePath.length)}`;
  }
  return value;
}

function loadPersistedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export default function ScreensPanel({
  screensFolder,
  setScreensFolder,
  screensFolderInput,
  setScreensFolderInput,
  selectedScreen,
  onSelectScreen,
  screensViewState,
  onScreensViewStateChange,
  setScreensList,
  theme,
  onAiContextChange,
  refreshToken,
}) {
  const saved = useRef(loadPersistedState());

  const [showRecent, setShowRecent] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contentSearchMode, setContentSearchMode] = useState(false);
  const [contentSearchResults, setContentSearchResults] = useState([]);
  const [contentSearching, setContentSearching] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [sidebarWidth, setSidebarWidth] = useState(
    () => saved.current.sidebarWidth || 300,
  );
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [editMode, setEditMode] = useState(
    () => saved.current.editMode ?? false,
  );
  const [livePreview, setLivePreview] = useState(
    () => saved.current.livePreview ?? false,
  );
  const [formatOnSave, setFormatOnSave] = useState(
    () => saved.current.formatOnSave ?? false,
  );
  const [resourceRevision, setResourceRevision] = useState(0);
  const [previewLocked, setPreviewLocked] = useState(false);
  const [lockedPreviewResource, setLockedPreviewResource] = useState(null);
  const [treeCollapseToken, setTreeCollapseToken] = useState(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [goToLine, setGoToLine] = useState(0);
  const [goToResourcePath, setGoToResourcePath] = useState(null);
  const [editorWidth, setEditorWidth] = useState(
    () => saved.current.editorWidth || null,
  );
  const [previewOverride, setPreviewOverride] = useState(null);
  const [inlineCreate, setInlineCreate] = useState(null);
  const inlineCreateIdRef = useRef(0);
  const [inlineRename, setInlineRename] = useState(null);
  const inlineRenameIdRef = useRef(0);
  const [treeRevealTarget, setTreeRevealTarget] = useState(null);
  const [selectedPaths, setSelectedPaths] = useState(() => new Set());
  const [clipboardPaths, setClipboardPaths] = useState([]);
  const [clipboardSourceFolder, setClipboardSourceFolder] = useState(null);
  const [clipboardCut, setClipboardCut] = useState(false);
  const [errorPaths, setErrorPaths] = useState(() => new Map());
  const [errorFilterActive, setErrorFilterActive] = useState(false);
  const [activeDiagnosticIndex, setActiveDiagnosticIndex] = useState(0);
  const [folderActionBusy, setFolderActionBusy] = useState(false);

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const contextMenuRef = useRef(null);
  const resizeRef = useRef(null);
  const editorResizeRef = useRef(null);
  const saveTimerRef = useRef(null);
  const saveRequestRef = useRef(0);
  const formatPrintWidthRef = useRef(100);
  const syncedScreenResourceRef = useRef(null);
  const contentSearchTimerRef = useRef(null);
  const persistTimerRef = useRef(null);
  const persistedScreensStateRef = useRef(null);
  const tabsRestoredRef = useRef(false);

  const [recentFolders, setRecentFolders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("screens_recent_folders")) || [];
    } catch {
      return [];
    }
  });

  // --- Persistence ---
  useEffect(() => {
    clearTimeout(persistTimerRef.current);
    const state = {
      editMode,
      livePreview,
      formatOnSave,
      sidebarWidth,
      editorWidth,
      openTabStates: openTabs.map((tab) => ({
        path: tab.path,
        name: tab.name,
        extension: tab.extension,
        editable: tab.editable,
        pinned: tab.pinned,
        code: tab.code,
        originalCode: tab.originalCode,
        dirty: Boolean(tab.dirty),
        status: tab.status || "",
      })),
      selectedResourcePath: selectedResource?.path || null,
    };
    persistedScreensStateRef.current = state;
    persistTimerRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 600);
    return () => clearTimeout(persistTimerRef.current);
  }, [
    editMode,
    livePreview,
    formatOnSave,
    sidebarWidth,
    editorWidth,
    openTabs,
    selectedResource,
  ]);

  useEffect(() => {
    const flush = () => {
      if (persistedScreensStateRef.current) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(persistedScreensStateRef.current),
        );
      }
    };
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  // --- Memos ---
  const filteredResources = useMemo(() => {
    if (contentSearchMode) return resources;
    const resourcesWithErrors = errorFilterActive
      ? resources.filter((resource) =>
          resource.type === "directory"
            ? [...errorPaths.keys()].some((path) => path.startsWith(`${resource.path}/`))
            : errorPaths.has(resource.path),
        )
      : resources;
    const query = searchTerm.trim().toLowerCase();
    if (!query) return resourcesWithErrors;
    const matched = new Set();
    resourcesWithErrors.forEach((resource) => {
      if (resource.path.toLowerCase().includes(query)) {
        matched.add(resource);
        if (resource.type !== "directory") {
          const parts = resource.path.split("/");
          for (let i = 1; i < parts.length; i++) {
            const dirPath = parts.slice(0, i).join("/");
            const dir = resourcesWithErrors.find(
              (r) => r.path === dirPath && r.type === "directory",
            );
            if (dir) matched.add(dir);
          }
        }
      }
    });
    if (matched.size === 0) {
      return resourcesWithErrors.filter((resource) =>
        resource.path.toLowerCase().includes(query),
      );
    }
    return resourcesWithErrors.filter((r) => matched.has(r));
  }, [resources, searchTerm, contentSearchMode, errorFilterActive, errorPaths]);

  const activeTab = useMemo(
    () =>
      openTabs.find((tab) => tab.path === selectedResource?.path) ||
      openTabs.at(-1) ||
      null,
    [openTabs, selectedResource?.path],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!screensFolder) {
        onAiContextChange?.(null);
        return;
      }
      onAiContextChange?.({
        folder: screensFolder,
        resourceCount: resources.filter((resource) => resource.type === "file").length,
        name: activeTab?.name || "",
        path: activeTab?.path || "",
        code: activeTab?.editable ? activeTab.code : "",
      });
    }, 260);
    return () => clearTimeout(timer);
  }, [activeTab?.code, activeTab?.editable, activeTab?.name, activeTab?.path, onAiContextChange, resources, screensFolder]);

  const contentResultsGrouped = useMemo(() => {
    const groups = new Map();
    contentSearchResults.forEach((result) => {
      if (!groups.has(result.path)) {
        groups.set(result.path, {
          path: result.path,
          name: result.name,
          extension: result.extension,
          matches: [],
        });
      }
      groups.get(result.path).matches.push(result);
    });
    return [...groups.values()];
  }, [contentSearchResults]);

  // --- Core helpers ---
  const updateTab = useCallback((resourcePath, updater) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) =>
        tab.path === resourcePath ? { ...tab, ...updater(tab) } : tab,
      ),
    );
  }, []);

  const loadResources = useCallback(async (folder) => {
    if (!folder || !window.electronAPI?.listScreenResources) {
      setResources([]);
      return [];
    }
    const result = await window.electronAPI.listScreenResources(folder);
    const loaded = result?.success ? result.resources || [] : [];
    setResources(loaded);
    return loaded;
  }, []);

  const openEditorTab = useCallback(
    async (resource, { pinned = false } = {}) => {
      if (!resource?.editable || !screensFolder) return;

      let alreadyLoaded = false;
      setOpenTabs((tabs) => {
        const existing = tabs.find((tab) => tab.path === resource.path);
        if (existing) {
          alreadyLoaded = true;
          if (pinned && !existing.pinned) {
            return tabs.map((t) => t.path === resource.path ? { ...t, pinned: true } : t);
          }
          return tabs;
        }
        const filtered = pinned ? tabs : tabs.filter((tab) => tab.pinned);
        return [
          ...filtered,
          { ...resource, code: "", dirty: false, status: "Cargando...", pinned },
        ];
      });

      if (alreadyLoaded) return;

      const result = await window.electronAPI.readScreenResource(
        screensFolder,
        resource.path,
      );
      const loadedCode = result?.success ? result.data || "" : "";
      setOpenTabs((tabs) =>
        tabs.map((tab) =>
          tab.path === resource.path && tab.originalCode === undefined
            ? { ...tab, code: loadedCode, originalCode: loadedCode, dirty: false, status: result?.success ? "" : result?.error || "Error al leer." }
            : tab,
        ),
      );
    },
    [screensFolder],
  );

  const selectResource = useCallback(
    (resource) => {
      if (!resource) return;
      setSelectedResource(resource);
      setSelectedPaths(new Set());
      if (resource.type === "directory") return;
      openEditorTab(resource, { pinned: false });

      if (isHtmlResource(resource)) {
        if (!previewLocked) {
          syncedScreenResourceRef.current = resource.path;
          onSelectScreen({
            id: resource.path.replace(/\.html?$/i, ""),
            comment: "",
            resource: resource.path,
          });
        }
      } else if (!isImageResource(resource) && resource.editable) {
        setEditMode(true);
      }
    },
    [onSelectScreen, openEditorTab, previewLocked],
  );

  const pinResource = useCallback(
    (resource) => {
      if (!resource || resource.type !== "file") return;
      setSelectedResource(resource);
      setSelectedPaths(new Set());
      openEditorTab(resource, { pinned: true });

      if (isHtmlResource(resource)) {
        if (!previewLocked) {
          syncedScreenResourceRef.current = resource.path;
          onSelectScreen({
            id: resource.path.replace(/\.html?$/i, ""),
            comment: "",
            resource: resource.path,
          });
        }
      } else if (!isImageResource(resource) && resource.editable) {
        setEditMode(true);
      }
    },
    [onSelectScreen, openEditorTab, previewLocked],
  );

  // --- Effects ---
  useEffect(() => {
    if (!screensFolder) {
      syncedScreenResourceRef.current = null;
      setResources([]);
      setSelectedResource(null);
      setOpenTabs([]);
      setPreviewLocked(false);
      setLockedPreviewResource(null);
      setErrorPaths(new Map());
      setErrorFilterActive(false);
      setContentSearchResults([]);
      tabsRestoredRef.current = false;
      return;
    }
    loadResources(screensFolder);
  }, [screensFolder, loadResources]);

  useEffect(() => {
    if (!refreshToken || !screensFolder) return;
    loadResources(screensFolder);
    setOpenTabs((tabs) => {
      for (const tab of tabs) {
        window.electronAPI.readScreenResource(screensFolder, tab.path).then((result) => {
          if (!result?.success) return;
          setOpenTabs((current) => current.map((t) => t.path === tab.path ? { ...t, code: result.data || "", originalCode: result.data || "", dirty: false, status: "" } : t));
        });
      }
      return tabs;
    });
  }, [refreshToken, screensFolder, loadResources]);

  // Restore tabs after resources load
  useEffect(() => {
    if (tabsRestoredRef.current || !resources.length || !screensFolder) return;
    tabsRestoredRef.current = true;

    const persisted = loadPersistedState();
    const persistedTabs = persisted.openTabStates || persisted.openTabPaths || [];
    if (!persistedTabs.length) return;

    const toRestore = persistedTabs
      .map((info) => ({
        info,
        resource: resources.find(
          (r) => r.path === info.path && r.type === "file",
        ),
        pinned: info.pinned ?? true,
      }))
      .filter((item) => item.resource?.editable);

    if (!toRestore.length) return;

    (async () => {
      for (const item of toRestore) {
        await openEditorTab(item.resource, { pinned: item.pinned });
        if (
          item.info.dirty &&
          typeof item.info.code === "string" &&
          typeof item.info.originalCode === "string"
        ) {
          setOpenTabs((tabs) =>
            tabs.map((tab) =>
              tab.path === item.resource.path
                ? {
                    ...tab,
                    code: item.info.code,
                    originalCode: item.info.originalCode,
                    dirty: true,
                    status: item.info.status || "",
                  }
                : tab,
            ),
          );
        }
      }
      if (persisted.selectedResourcePath) {
        const sel = resources.find(
          (r) => r.path === persisted.selectedResourcePath,
        );
        if (sel) setSelectedResource(sel);
      }
    })();
  }, [resources, screensFolder, openEditorTab]);

  useEffect(() => {
    if (previewLocked || !selectedScreen?.resource || !resources.length) return;
    const resourcePath = normalizeResource(selectedScreen.resource);
    const navKey = `${resourcePath}:${selectedScreen._nav || 0}`;
    if (syncedScreenResourceRef.current === navKey) return;

    syncedScreenResourceRef.current = navKey;
    const fromXmlModule = Boolean(selectedScreen._nav);
    const resource = resources.find(
      (item) => item.type === "file" && item.path === resourcePath,
    );
    if (resource) {
      setPreviewOverride(null);
      if (fromXmlModule) {
        setEditMode(true);
        const existingTab = openTabs.find((t) => t.path === resource.path);
        if (existingTab) {
          setSelectedResource(existingTab);
          if (!existingTab.pinned) updateTab(existingTab.path, () => ({ pinned: true }));
        } else {
          setSelectedResource(resource);
          openEditorTab(resource, { pinned: true });
        }
      } else {
        setSelectedResource(resource);
        openEditorTab(resource, { pinned: false });
      }
    }
  }, [
    resources,
    selectedResource?.path,
    selectedScreen,
    openEditorTab,
    previewLocked,
  ]);

  useEffect(() => {
    if (!showSearch) return;
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [showSearch]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (resizeRef.current) {
        setSidebarWidth(
          Math.max(220, Math.min(560, event.clientX - resizeRef.current.left)),
        );
      }
      if (editorResizeRef.current) {
        const rect = editorResizeRef.current.container.getBoundingClientRect();
        setEditorWidth(
          Math.max(280, Math.min(event.clientX - rect.left, rect.width - 280)),
        );
      }
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      editorResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", handleMouseMove);
    window.addEventListener("pointerup", handleMouseUp);
    window.addEventListener("pointercancel", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      window.removeEventListener("pointermove", handleMouseMove);
      window.removeEventListener("pointerup", handleMouseUp);
      window.removeEventListener("pointercancel", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    clearTimeout(contentSearchTimerRef.current);
    const query = searchTerm.trim();
    if (!contentSearchMode || !query || !screensFolder) {
      setContentSearchResults([]);
      setContentSearching(false);
      return;
    }
    setContentSearching(true);
    contentSearchTimerRef.current = setTimeout(async () => {
      const result = await window.electronAPI.searchScreenResources(
        screensFolder,
        query,
      );
      setContentSearchResults(result?.success ? result.results || [] : []);
      setContentSearching(false);
    }, 400);
    return () => clearTimeout(contentSearchTimerRef.current);
  }, [searchTerm, screensFolder, contentSearchMode]);

  // --- Save ---
  const saveTab = useCallback(
    async (tab) => {
      if (!tab?.dirty || !screensFolder) return;
      const saveId = ++saveRequestRef.current;
      const resourcePath = tab.path;
      let codeToSave = tab.code;

      if (formatOnSave && canFormatResource(tab.extension)) {
        updateTab(resourcePath, () => ({ status: "Formateando..." }));
        try {
          codeToSave = await formatScreenResource(tab.code, tab.extension, {
            printWidth: formatPrintWidthRef.current,
          });
        } catch (error) {
          updateTab(resourcePath, () => ({
            status: `No se pudo formatear: ${error.message || "error de sintaxis"}`,
          }));
        }
      }

      if (saveId !== saveRequestRef.current) return;
      updateTab(resourcePath, () => ({
        code: codeToSave,
        status: "Guardando...",
      }));
      const result = await window.electronAPI.writeScreenResource(
        screensFolder,
        resourcePath,
        codeToSave,
      );
      if (saveId !== saveRequestRef.current) return;
      updateTab(resourcePath, (t) => ({
        dirty: !result?.success,
        originalCode: result?.success ? codeToSave : t.originalCode,
        status: result?.success
          ? "Guardado"
          : result?.error || "No se pudo guardar.",
      }));
      if (result?.success) setResourceRevision((c) => c + 1);
    },
    [formatOnSave, screensFolder, updateTab],
  );

  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    if (!livePreview || !activeTab?.dirty) return undefined;
    saveTimerRef.current = setTimeout(() => saveTab(activeTab), 350);
    return () => clearTimeout(saveTimerRef.current);
  }, [activeTab, livePreview, saveTab]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  // --- Handlers ---
  const handleSelectFolder = async () => {
    const folder = await window.electronAPI.openFolderDialog();
    if (folder) setScreensFolderInput(folder);
  };

  const pushRecentFolder = (folderPath) => {
    const name = folderPath.split(/[\\/]/).pop();
    setRecentFolders((prev) => {
      const next = [
        { name, path: folderPath, lastUsedAt: Date.now() },
        ...prev.filter((item) => item.path !== folderPath),
      ].slice(0, 5);
      localStorage.setItem("screens_recent_folders", JSON.stringify(next));
      return next;
    });
  };

  const resetFolder = async () => {
    if (!screensFolder || folderActionBusy) return;
    const currentFolder = screensFolder;
    setFolderActionBusy(true);
    try {
      await window.electronAPI.clearStaticServerCache();
      const [loadedResources, folderResult] = await Promise.all([
        loadResources(currentFolder),
        window.electronAPI.readFolder(currentFolder),
      ]);
      setScreensList(folderResult?.success ? folderResult.files || [] : []);
      const refreshedSelection = loadedResources.find(
        (resource) => resource.path === selectedResource?.path,
      );
      if (refreshedSelection) setSelectedResource(refreshedSelection);
      else if (selectedResource?.path) {
        setSelectedResource(null);
        onSelectScreen(null);
      }
      setResourceRevision((revision) => revision + 1);
    } finally {
      setFolderActionBusy(false);
    }
  };

  const handleLoadFolder = async () => {
    const folderPath = screensFolderInput?.trim();
    if (!folderPath) return;
    await window.electronAPI.clearStaticServerCache();
    onSelectScreen(null);
    setScreensList([]);
    setSelectedResource(null);
    setOpenTabs([]);
    setPreviewLocked(false);
    setLockedPreviewResource(null);
    setScreensFolder(folderPath);
    pushRecentFolder(folderPath);
  };

  const handleStopServer = async () => {
    if (!screensFolder || folderActionBusy) return;
    if (
      openTabs.some((t) => t.dirty) &&
      !(await window.electronAPI.showConfirm("Hay cambios sin guardar. ¿Deseas cerrar la carpeta?"))
    )
      return;
    setFolderActionBusy(true);
    try {
      await window.electronAPI.clearStaticServerCache();
      setScreensFolder(null);
      setScreensList([]);
      onSelectScreen(null);
      setSelectedResource(null);
      setOpenTabs([]);
      setPreviewLocked(false);
      setLockedPreviewResource(null);
    } finally {
      setFolderActionBusy(false);
    }
  };

  const toggleEditMode = useCallback(
    (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (!screensFolder || folderActionBusy) return;
      setEditMode((current) => !current);
    },
    [screensFolder, folderActionBusy],
  );

  const handleFormatResource = async (options = {}) => {
    if (!activeTab || !canFormatResource(activeTab.extension)) return;
    try {
      updateTab(activeTab.path, () => ({ status: "Formateando..." }));
      const formatted = await formatScreenResource(
        activeTab.code,
        activeTab.extension,
        { printWidth: options.printWidth || formatPrintWidthRef.current },
      );
      saveRequestRef.current += 1;
      updateTab(activeTab.path, (tab) => ({
        code: formatted,
        originalCode: tab.originalCode,
        dirty: formatted !== tab.originalCode,
        status: "",
      }));
    } catch (error) {
      updateTab(activeTab.path, () => ({
        status: `No se pudo formatear: ${error.message || "error de sintaxis"}`,
      }));
    }
  };

  const previewResource = previewOverride
    ? previewOverride.path
    : previewLocked
      ? lockedPreviewResource
      : isImageResource(selectedResource)
        ? selectedResource.path
        : isHtmlResource(selectedResource)
          ? selectedResource.path
          : selectedScreen?.resource || null;
  const previewSourceResource = previewOverride
    ? resources.find((r) => r.path === previewOverride.path)
    : previewLocked
      ? resources.find((r) => r.path === lockedPreviewResource)
      : selectedResource;
  const previewType = isImageResource(previewSourceResource) ? "image" : "html";
  const hasOpenTabs = openTabs.length > 0;
  const isCodeResource = Boolean(
    selectedResource?.editable &&
    !isHtmlResource(selectedResource) &&
    !isImageResource(selectedResource),
  );
  const showEditorPane = isCodeResource || (editMode && hasOpenTabs);
  const showPreviewPane = Boolean(previewResource);
  const workbenchMode =
    showEditorPane && showPreviewPane
      ? "editing"
      : showEditorPane
        ? "code-only"
        : "preview-only";
  const dirtyPaths = useMemo(
    () => new Set(openTabs.filter((t) => t.dirty).map((t) => t.path)),
    [openTabs],
  );

  const errorFilesCount = errorPaths.size;
  const errorDiagnosticsCount = useMemo(
    () =>
      [...errorPaths.values()].reduce(
        (total, diagnostics) => total + diagnostics.length,
        0,
      ),
    [errorPaths],
  );
  const errorDirPaths = useMemo(() => {
    const dirs = new Set();
    for (const filePath of errorPaths.keys()) {
      const parts = filePath.split("/");
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join("/"));
      }
    }
    return dirs;
  }, [errorPaths]);

  const activeTabDiagnostics = useMemo(
    () => (activeTab ? errorPaths.get(activeTab.path) || [] : []),
    [activeTab, errorPaths],
  );

  useEffect(() => {
    setActiveDiagnosticIndex(0);
  }, [activeTab?.path]);

  useEffect(() => {
    setActiveDiagnosticIndex((index) =>
      Math.min(index, Math.max(activeTabDiagnostics.length - 1, 0)),
    );
  }, [activeTabDiagnostics.length]);

  const navigateActiveDiagnostic = useCallback(
    (direction) => {
      if (!activeTabDiagnostics.length) return;
      const next =
        (activeDiagnosticIndex + direction + activeTabDiagnostics.length) %
        activeTabDiagnostics.length;
      setActiveDiagnosticIndex(next);
      setGoToResourcePath(activeTab?.path || null);
      setGoToLine(activeTabDiagnostics[next].line);
    },
    [activeDiagnosticIndex, activeTab?.path, activeTabDiagnostics],
  );

  useEffect(() => {
    if (errorFilterActive && errorPaths.size === 0) {
      setErrorFilterActive(false);
    }
  }, [errorFilterActive, errorPaths]);

  const handleEditorChange = (value) => {
    if (!activeTab) return;
    saveRequestRef.current += 1;
    updateTab(activeTab.path, (tab) => {
      if (tab.originalCode === undefined) return { code: value };
      const isDirty = value !== tab.originalCode;
      const updates = { code: value, dirty: isDirty, status: "" };
      if (isDirty && !tab.pinned) updates.pinned = true;
      return updates;
    });
  };

  const closeTabs = async (paths) => {
    const pathSet = new Set(paths);
    const hasPending = openTabs.some((t) => pathSet.has(t.path) && t.dirty);
    if (
      hasPending &&
      !(await window.electronAPI.showConfirm("Hay cambios sin guardar. ¿Deseas cerrar los archivos seleccionados?"))
    )
      return;
    const remaining = openTabs.filter((t) => !pathSet.has(t.path));
    setOpenTabs(remaining);
    setErrorPaths((previous) => {
      const next = new Map(previous);
      for (const path of [...next.keys()]) {
        if ([...pathSet].some((closedPath) => path === closedPath || path.startsWith(`${closedPath}/`))) {
          next.delete(path);
        }
      }
      return next;
    });
    if (selectedResource?.path && pathSet.has(selectedResource.path)) {
      setSelectedResource(remaining.at(-1) || null);
    }
  };

  const closeEditorTab = (event, resourcePath) => {
    event.stopPropagation();
    closeTabs([resourcePath]);
  };

  const togglePreviewLock = () => {
    if (previewLocked) {
      setPreviewLocked(false);
      setLockedPreviewResource(null);
      return;
    }
    if (!previewResource || previewType !== "html") return;
    setLockedPreviewResource(previewResource);
    setPreviewLocked(true);
  };

  const openContextMenu = (event, target, area) => {
    event.preventDefault();
    const padding = 8;
    setContextMenu({
      x: Math.max(padding, Math.min(event.clientX, window.innerWidth - 220)),
      y: Math.max(padding, Math.min(event.clientY, window.innerHeight - 220)),
      target,
      area,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const refreshResources = useCallback(async () => {
    await loadResources(screensFolder);
    setTreeCollapseToken((v) => v + 1);
  }, [loadResources, screensFolder]);

  const startInlineRename = (resource) => {
    closeContextMenu();
    if (!resource?.path) return;
    inlineRenameIdRef.current += 1;
    setInlineRename({
      path: resource.path,
      parentPath: getParentPath(resource.path),
      name: resource.name,
      type: resource.type,
      id: inlineRenameIdRef.current,
    });
  };

  const confirmInlineRename = async (name) => {
    const rename = inlineRename;
    setInlineRename(null);
    if (!rename || !name?.trim() || name.trim() === rename.name) {
      if (rename?.path) {
        setTreeRevealTarget({ path: rename.path, id: Date.now() });
      }
      return;
    }

    const result = await window.electronAPI.renameScreenResource(
      screensFolder,
      rename.path,
      name.trim(),
    );
    if (!result?.success || !result.path) {
      await window.electronAPI.showAlert(result?.error || "No se pudo renombrar el recurso.");
      return;
    }

    const targetPath = result.path;
    const remap = (path) => remapRenamedPath(path, rename.path, targetPath);

    setSelectedPaths((paths) => new Set([...paths].map(remap)));
    setLockedPreviewResource((path) => remap(path));
    setPreviewOverride((preview) =>
      preview
        ? {
            ...preview,
            path: remap(preview.path),
            previousResource: preview.previousResource
              ? { ...preview.previousResource, path: remap(preview.previousResource.path) }
              : preview.previousResource,
          }
        : preview,
    );
    setErrorPaths((previous) => {
      const next = new Map();
      previous.forEach((diagnostics, path) => next.set(remap(path), diagnostics));
      return next;
    });
    if (syncedScreenResourceRef.current) {
      syncedScreenResourceRef.current = remap(syncedScreenResourceRef.current);
    }

    const refreshed = await loadResources(screensFolder);
    const refreshedByPath = new Map(refreshed.map((resource) => [resource.path, resource]));
    setOpenTabs((tabs) =>
      tabs.map((tab) => {
        const path = remap(tab.path);
        const resource = refreshedByPath.get(path);
        return {
          ...tab,
          path,
          name: resource?.name || (tab.path === rename.path ? name.trim() : tab.name),
          extension: resource?.extension || tab.extension,
          editable: resource?.editable ?? tab.editable,
        };
      }),
    );
    const selectedPath = remap(selectedResource?.path);
    const refreshedSelection = refreshedByPath.get(selectedPath);
    if (refreshedSelection) {
      setSelectedResource(refreshedSelection);
      if (isHtmlResource(refreshedSelection) && !previewLocked) {
        onSelectScreen({
          id: refreshedSelection.path.replace(/\.html?$/i, ""),
          comment: "",
          resource: refreshedSelection.path,
        });
      }
    }
    setTreeRevealTarget({ path: targetPath, id: Date.now() });
  };

  const createResource = (parentPath, type) => {
    closeContextMenu();
    inlineCreateIdRef.current += 1;
    setInlineCreate({ parentPath: parentPath || "", type: type || "file", id: inlineCreateIdRef.current });
  };

  const confirmInlineCreate = async (name) => {
    if (!inlineCreate || !name?.trim()) {
      setInlineCreate(null);
      return;
    }
    const creation = inlineCreate;
    setInlineCreate(null);
    const result = await window.electronAPI.createScreenResource(
      screensFolder,
      creation.parentPath,
      name.trim(),
      creation.type,
    );
    if (!result?.success) {
      console.warn("No se pudo crear el recurso:", result?.error);
      return;
    }
    const refreshed = await loadResources(screensFolder);
    const createdResource = refreshed.find((resource) => resource.path === result.path);
    setTreeRevealTarget({ path: result.path, id: Date.now() });
    if (creation.type !== "file" || !createdResource) return;

    setSelectedResource(createdResource);
    setSelectedPaths(new Set());
    setEditMode(true);
    await openEditorTab(createdResource, { pinned: true });
  };

  const deleteResources = async (paths) => {
    closeContextMenu();
    const label = paths.length === 1 ? paths[0] : `${paths.length} elementos`;
    if (!(await window.electronAPI.showConfirm(`¿Enviar "${label}" a la papelera de reciclaje?`)))
      return;
    const failed = [];
    for (const p of paths) {
      const result = await window.electronAPI.trashScreenResource(
        screensFolder,
        p,
      );
      if (!result?.success) failed.push(p);
    }
    if (failed.length) {
      await window.electronAPI.showAlert(`No se pudieron eliminar: ${failed.join(", ")}`);
    }
    closeTabs(paths);
    setSelectedPaths(new Set());
    await refreshResources();
  };

  const openInExplorer = (resource) => {
    closeContextMenu();
    if (!screensFolder || !resource?.path) return;
    const fullPath = `${screensFolder.replace(/\//g, "\\")}\\${resource.path.replace(/\//g, "\\")}`;
    window.electronAPI.openItemLocation(fullPath);
  };

  const handleMultiSelect = useCallback((resource) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(resource.path)) next.delete(resource.path);
      else next.add(resource.path);
      return next;
    });
  }, []);

  const handleCopyResources = useCallback((pathsOverride) => {
    const paths =
      pathsOverride?.length > 0
        ? pathsOverride
        : selectedPaths.size > 0
          ? [...selectedPaths]
          : selectedResource?.path
            ? [selectedResource.path]
            : [];
    if (!paths.length) return;
    setClipboardPaths(paths);
    setClipboardSourceFolder(screensFolder);
    setClipboardCut(false);
  }, [screensFolder, selectedPaths, selectedResource]);

  const handleCutResources = useCallback((pathsOverride) => {
    const paths =
      pathsOverride?.length > 0
        ? pathsOverride
        : selectedPaths.size > 0
          ? [...selectedPaths]
          : selectedResource?.path
            ? [selectedResource.path]
            : [];
    if (!paths.length) return;
    setClipboardPaths(paths);
    setClipboardSourceFolder(screensFolder);
    setClipboardCut(true);
  }, [screensFolder, selectedPaths, selectedResource]);

  const handlePasteResources = useCallback(async (destinationPath) => {
    if (!screensFolder || !clipboardSourceFolder || !clipboardPaths.length) return;
    const destDir = destinationPath ??
      (selectedResource?.type === "directory"
        ? selectedResource.path
        : getParentPath(selectedResource?.path));

    const copiedPaths = [];
    const failedPaths = [];

    for (const sourcePath of clipboardPaths) {
      const result = await window.electronAPI.copyScreenResourceBetweenFolders(
        clipboardSourceFolder,
        sourcePath,
        screensFolder,
        destDir || "",
      );
      if (result?.success) copiedPaths.push(sourcePath);
      else failedPaths.push(sourcePath);
    }

    if (clipboardCut && copiedPaths.length) {
      for (const sourcePath of copiedPaths) {
        await window.electronAPI.trashScreenResource(
          clipboardSourceFolder,
          sourcePath,
        );
      }
      setClipboardPaths([]);
      setClipboardSourceFolder(null);
      setClipboardCut(false);
    }
    if (failedPaths.length) {
      console.warn("No se pudieron pegar:", failedPaths.join(", "));
    }
    await refreshResources();
  }, [
    screensFolder,
    clipboardSourceFolder,
    selectedResource,
    clipboardPaths,
    clipboardCut,
    refreshResources,
  ]);

  useEffect(() => {
    const handler = (e) => {
      if (!screensFolder) return;
      const inEditor = e.target.closest(
        ".screen-resource-editor-wrapper, .cm-editor, input, textarea",
      );

      if (e.key === "F12" && !inEditor) {
        e.preventDefault();
        window.electronAPI?.openDevTools?.();
        return;
      }

      if (e.key === "Delete" && !inEditor) {
        const paths =
          selectedPaths.size > 0
            ? [...selectedPaths]
            : selectedResource?.path
              ? [selectedResource.path]
              : [];
        if (paths.length) {
          e.preventDefault();
          deleteResources(paths);
        }
        return;
      }

      if (e.key === "F2" && !inEditor && selectedResource?.path) {
        e.preventDefault();
        startInlineRename(selectedResource);
        return;
      }

      if (!(e.ctrlKey || e.metaKey) || inEditor) return;

      if (e.key === "c") {
        e.preventDefault();
        handleCopyResources();
      } else if (e.key === "x") {
        e.preventDefault();
        handleCutResources();
      } else if (e.key === "v") {
        e.preventDefault();
        if (clipboardPaths.length > 0) handlePasteResources();
      } else if (e.key === "n") {
        e.preventDefault();
        createResource(
          selectedResource?.type === "directory"
            ? selectedResource.path
            : getParentPath(selectedResource?.path),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    handleCopyResources,
    handleCutResources,
    handlePasteResources,
    screensFolder,
    selectedResource,
    selectedPaths,
    clipboardPaths,
    startInlineRename,
  ]);

  const handleContentResultClick = (result) => {
    const resource = resources.find(
      (r) => r.path === result.path && r.type === "file",
    );
    if (!resource) return;
    setSelectedResource(resource);
    openEditorTab(resource, { pinned: false });
    setEditMode(true);
    setGoToResourcePath(result.path);
    setGoToLine(result.line);

    if (isHtmlResource(resource) && !previewLocked) {
      syncedScreenResourceRef.current = resource.path;
      onSelectScreen({
        id: resource.path.replace(/\.html?$/i, ""),
        comment: "",
        resource: resource.path,
      });
    }
  };

  const handlePreviewInspect = useCallback(
    (tag, line) => {
      if (!selectedResource || !isHtmlResource(selectedResource)) return;
      openEditorTab(selectedResource, { pinned: true });
      setEditMode(true);
      if (line > 0) {
        setGoToResourcePath(selectedResource.path);
        setGoToLine(line);
      }
    },
    [selectedResource, openEditorTab],
  );

  const handleOpenPath = useCallback(
    (relativePath) => {
      if (!activeTab || !screensFolder) return;
      if (
        /^[a-zA-Z]:[\\/]/.test(relativePath) ||
        /^https?:\/\//.test(relativePath)
      )
        return;
      const resolved = resolvePath(activeTab.path, relativePath);
      const resource = resources.find(
        (r) => r.path === resolved && r.type === "file",
      );
      if (!resource) return;

      if (isImageResource(resource) || !resource.editable) {
        setPreviewOverride({
          path: resource.path,
          previousResource: selectedResource,
        });
        return;
      }

      setSelectedResource(resource);
      openEditorTab(resource, { pinned: false });
      if (isHtmlResource(resource) && !previewLocked) {
        syncedScreenResourceRef.current = resource.path;
        onSelectScreen({
          id: resource.path.replace(/\.html?$/i, ""),
          comment: "",
          resource: resource.path,
        });
      }
    },
    [
      activeTab,
      screensFolder,
      resources,
      openEditorTab,
      previewLocked,
      onSelectScreen,
    ],
  );

  const handleDiagnostics = useCallback((diagnostics = [], resourcePath) => {
    if (!resourcePath) return;
    const p = resourcePath;
    setErrorPaths((prev) => {
      const previous = prev.get(p) || [];
      const unchanged =
        previous.length === diagnostics.length &&
        previous.every(
          (diagnostic, index) =>
            diagnostic.from === diagnostics[index].from &&
            diagnostic.to === diagnostics[index].to &&
            diagnostic.message === diagnostics[index].message,
        );
      if (unchanged) return prev;
      const next = new Map(prev);
      if (diagnostics.length > 0) next.set(p, diagnostics);
      else next.delete(p);
      return next;
    });
  }, []);

  const toggleGroupCollapse = (path) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const frame = requestAnimationFrame(() => {
      const rect = contextMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      const padding = 8;
      const x = Math.max(padding, Math.min(contextMenu.x, window.innerWidth - rect.width - padding));
      const y = Math.max(padding, Math.min(contextMenu.y, window.innerHeight - rect.height - padding));
      if (x !== contextMenu.x || y !== contextMenu.y) {
        setContextMenu((current) => current ? { ...current, x, y } : current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [contextMenu]);

  const handleSearchInput = (event) => {
    setSearchTerm(event.target.value);
    if (contentSearchMode) {
      event.target.style.height = "auto";
      event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
    }
  };

  const searchPlaceholder = contentSearchMode
    ? "Buscar en archivos..."
    : "Filtrar recursos...";

  return (
    <div className={`screens-layout ${editMode ? "editing" : ""}`}>
      <header className="screens-project-bar">
        <div className="project-label">
          <FaFolderOpen />
        </div>
        <div className="folder-selector">
          <input
            ref={inputRef}
            className="folder-input"
            type="text"
            value={screensFolderInput || ""}
            disabled={!!screensFolder}
            placeholder="Carpeta de pantallas..."
            onFocus={() => {
              if (!screensFolder) {
                setShowRecent(true);
                setActiveIndex(0);
              }
            }}
            onBlur={(event) => {
              if (!dropdownRef.current?.contains(event.relatedTarget)) {
                setShowRecent(false);
                setActiveIndex(-1);
              }
            }}
            onChange={(event) => {
              setScreensFolderInput(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={(event) => {
              if (!showRecent || !recentFolders.length) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const dir = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((c) => {
                  const next =
                    (c + dir + recentFolders.length) % recentFolders.length;
                  setScreensFolderInput(recentFolders[next].path);
                  return next;
                });
              }
              if (event.key === "Enter") {
                event.preventDefault();
                setShowRecent(false);
                handleLoadFolder();
              }
              if (event.key === "Escape") setShowRecent(false);
            }}
          />
          {showRecent && recentFolders.length ? (
            <div
              ref={dropdownRef}
              className="screens-recent-dropdown"
              tabIndex={-1}
            >
              <div className="dropdown-title">Carpetas recientes</div>
              {recentFolders.map((folder, index) => (
                <button
                  type="button"
                  key={folder.path}
                  className={`dropdown-item ${index === activeIndex ? "active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setScreensFolderInput(folder.path);
                    setShowRecent(false);
                  }}
                >
                  <strong>{folder.name}</strong>
                  <span className="dropdown-sub">{folder.path}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="project-folder-actions">
          <button
            type="button"
            className="folder-btn project-action"
            onClick={handleSelectFolder}
            title="Seleccionar carpeta"
            disabled={!!screensFolder}
          >
            <FaFolderOpen />
            <span>Elegir</span>
          </button>
          {!screensFolder ? (
            <button
              type="button"
              className="folder-btn project-action load-btn"
              onClick={handleLoadFolder}
              title="Cargar carpeta"
            >
              <FaPlay />
              <span>Cargar</span>
            </button>
          ) : (
            <button
              type="button"
              className="folder-btn project-action danger-btn"
              onClick={handleStopServer}
              title="Cerrar carpeta"
              disabled={folderActionBusy}
            >
              <FaStop />
              <span>Cerrar</span>
            </button>
          )}
        </div>
        <div className="project-bar-spacer" />
        <button
          type="button"
          className={`folder-btn project-action ${livePreview ? "live-active" : ""}`}
          onClick={() => setLivePreview((c) => !c)}
          title="Guardar y actualizar al escribir"
          disabled={!screensFolder || folderActionBusy}
        >
          <FaBolt />
          <span>{livePreview ? "Live ON" : "Live"}</span>
        </button>
        {activeTab ? (
          <span className="project-bar-status">
            {activeTab.dirty
              ? "Cambios pendientes"
              : activeTab.status || (livePreview ? "Tiempo real" : "Guardado manual")}
          </span>
        ) : null}
      </header>

      <div className="screens-content">
        <aside className="screens-sidebar" style={{ width: sidebarWidth }}>
          <div className="screens-icon-toolbar">
            <button
              type="button"
              className="screens-icon-btn"
              onClick={() =>
                createResource(
                  selectedResource?.type === "directory"
                    ? selectedResource.path
                    : getParentPath(selectedResource?.path),
                )
              }
              disabled={!screensFolder}
              title="Nuevo archivo (Ctrl+N)"
            >
              <FiFilePlus />
            </button>
            <button
              type="button"
              className="screens-icon-btn"
              onClick={() =>
                createResource(
                  selectedResource?.type === "directory"
                    ? selectedResource.path
                    : getParentPath(selectedResource?.path),
                  "directory",
                )
              }
              disabled={!screensFolder}
              title="Nueva carpeta"
            >
              <FiFolderPlus />
            </button>
            <button
              type="button"
              className={`screens-icon-btn ${showSearch ? "active" : ""}`}
              onClick={() => setShowSearch((c) => !c)}
              title="Buscar"
            >
              <FiSearch />
            </button>
            <button
              type="button"
              className="screens-icon-btn"
              onClick={resetFolder}
              disabled={!screensFolder || folderActionBusy}
              title="Recargar carpeta"
            >
              <FiRefreshCw />
            </button>
            <div className="screens-icon-toolbar-spacer" />
            {editMode && errorFilesCount > 0 ? (
              <button
                type="button"
                className={`screens-error-badge ${errorFilterActive ? "active" : ""}`}
                onClick={() => setErrorFilterActive((active) => !active)}
                title={
                  errorFilterActive
                    ? "Quitar filtro de archivos con errores"
                    : `Mostrar ${errorFilesCount} archivo(s) con ${errorDiagnosticsCount} error(es)`
                }
              >
                <FiAlertTriangle /> {errorDiagnosticsCount}
              </button>
            ) : null}
            <button
              type="button"
              className={`screens-icon-btn ${editMode ? "active" : ""}`}
              onClick={toggleEditMode}
              disabled={!screensFolder || folderActionBusy}
              title={editMode ? "Modo editor activo" : "Activar modo editor"}
            >
              <FaCode />
            </button>
          </div>

          {showSearch ? (
            <div
              className={`screens-search-box ${contentSearchMode ? "multiline" : ""}`}
            >
              <FiSearch className="screens-search-icon" />
              {contentSearchMode ? (
                <textarea
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={handleSearchInput}
                  placeholder={searchPlaceholder}
                  rows={1}
                />
              ) : (
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={handleSearchInput}
                  placeholder={searchPlaceholder}
                />
              )}
              <button
                type="button"
                className={`screens-search-mode-btn ${contentSearchMode ? "active" : ""}`}
                onClick={() => setContentSearchMode((c) => !c)}
                title={
                  contentSearchMode
                    ? "Buscar en contenido (activo)"
                    : "Buscar en contenido"
                }
                disabled={!screensFolder}
              >
                <FiFile />
              </button>
              {searchTerm ? (
                <button
                  type="button"
                  className="screens-search-clear"
                  onClick={() => {
                    setSearchTerm("");
                    setContentSearchResults([]);
                    if (searchInputRef.current)
                      searchInputRef.current.style.height = "";
                  }}
                  title="Limpiar"
                >
                  <FiX />
                </button>
              ) : null}
            </div>
          ) : null}

          {showSearch && contentSearchMode ? (
            <div className="content-search-results">
              {contentSearching ? (
                <div className="content-search-status">Buscando...</div>
              ) : null}
              {!contentSearching &&
              searchTerm.trim() &&
              contentSearchResults.length === 0 ? (
                <div className="content-search-status">Sin resultados</div>
              ) : null}
              {contentResultsGrouped.map((group) => {
                const isCollapsed = collapsedGroups.has(group.path);
                return (
                  <div key={group.path} className="content-search-group">
                    <button
                      type="button"
                      className="content-search-file"
                      onClick={() => toggleGroupCollapse(group.path)}
                    >
                      <span className="content-search-chevron">
                        {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
                      </span>
                      <span className="content-search-file-name">
                        {group.path}
                      </span>
                      <span className="content-search-count">
                        {group.matches.length}
                      </span>
                    </button>
                    {!isCollapsed
                      ? group.matches.map((match) => (
                          <button
                            key={`${match.path}:${match.line}`}
                            type="button"
                            className="content-search-match"
                            onClick={() => handleContentResultClick(match)}
                            title={`${match.path}:${match.line}`}
                          >
                            <span className="content-search-line">
                              {match.line}
                            </span>
                            <span className="content-search-text">
                              {match.text}
                            </span>
                          </button>
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <ScreenSelector
              resources={filteredResources}
              selectedResource={selectedResource}
              selectedPaths={selectedPaths}
              onSelect={selectResource}
              onDoubleClick={pinResource}
              onMultiSelect={handleMultiSelect}
              onShiftSelect={(paths) => setSelectedPaths(new Set(paths))}
              filterActive={Boolean((searchTerm.trim() || errorFilterActive) && !contentSearchMode)}
              folderKey={screensFolder}
              collapseAllToken={treeCollapseToken}
              dirtyPaths={dirtyPaths}
              errorPaths={errorPaths}
              errorDirPaths={errorDirPaths}
              inlineCreate={inlineCreate}
              onInlineCreateConfirm={confirmInlineCreate}
              onInlineCreateCancel={() => setInlineCreate(null)}
              inlineRename={inlineRename}
              onInlineRenameConfirm={confirmInlineRename}
              onInlineRenameCancel={() => setInlineRename(null)}
              revealPath={treeRevealTarget}
              onContextMenu={(event, resource) =>
                openContextMenu(event, resource, "tree")
              }
            />
          )}
        </aside>

        <div
          className="screens-sidebar-resizer"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            resizeRef.current = {
              left:
                event.currentTarget.parentElement?.getBoundingClientRect()
                  ?.left ?? 0,
            };
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            event.currentTarget.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          }}
          onDoubleClick={() => setSidebarWidth(300)}
        />

        <main className="screens-viewer-area">
          {!screensFolder ? (
            <p className="screens-info">Selecciona una carpeta de recursos.</p>
          ) : null}
          {screensFolder && !selectedResource ? (
            <p className="screens-info">
              Selecciona un recurso para visualizarlo o editarlo.
            </p>
          ) : null}
          {screensFolder && selectedResource ? (
            <div
              className={`screens-workbench ${workbenchMode}`}
              style={
                workbenchMode === "editing" && editorWidth
                  ? {
                      gridTemplateColumns: `${editorWidth}px auto minmax(0, 1fr)`,
                    }
                  : undefined
              }
            >
              {showEditorPane ? (
                <section className="screen-editor-pane">
                  <header className="screen-editor-header">
                    <div
                      className="screen-editor-tabs"
                      role="tablist"
                      aria-label="Archivos abiertos"
                    >
                      {openTabs.map((tab) => (
                        <div
                          key={tab.path}
                          className={`screen-editor-tab ${tab.path === activeTab?.path ? "active" : ""} ${!tab.pinned ? "preview" : ""}`}
                          onContextMenu={(e) => openContextMenu(e, tab, "tab")}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedResource(tab)}
                            onDoubleClick={() =>
                              updateTab(tab.path, () => ({ pinned: true }))
                            }
                            title={tab.path}
                          >
                            {tab.name}
                          </button>
                          {(() => {
                            const tabHasErrors = errorPaths.has(tab.path);
                            const showIndicator = tab.dirty || tabHasErrors;
                            return (
                              <button
                                type="button"
                                className={`screen-editor-tab-close ${showIndicator ? "has-indicator" : ""}`}
                                onClick={(e) => closeEditorTab(e, tab.path)}
                                title={`Cerrar ${tab.name}`}
                              >
                                {showIndicator ? (
                                  <span className="screen-tab-indicators">
                                    {tab.dirty ? (
                                      <span
                                        className="screen-tab-dirty"
                                        aria-label="Cambios sin guardar"
                                      />
                                    ) : null}
                                    {tabHasErrors ? (
                                      <span
                                        className="screen-tab-error"
                                        aria-label="Errores de sintaxis"
                                      >
                                        !
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                                <FiX className="screen-tab-close-icon" />
                              </button>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                    <div className="screen-editor-actions">
                      <button
                        type="button"
                        className="screen-editor-save"
                        onClick={() => saveTab(activeTab)}
                        disabled={!activeTab?.dirty}
                        title="Guardar archivo (Ctrl+S)"
                      >
                        <FaSave />
                      </button>
                      {activeTabDiagnostics.length > 0 ? (
                        <div className="screen-error-nav" aria-label="Navegación de errores">
                          <button
                            type="button"
                            onClick={() => navigateActiveDiagnostic(-1)}
                            title="Error anterior"
                          >
                            &#x25B2;
                          </button>
                          <span className="screen-error-nav-label">
                            ! {activeDiagnosticIndex + 1}/{activeTabDiagnostics.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigateActiveDiagnostic(1)}
                            title="Error siguiente"
                          >
                            &#x25BC;
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </header>
                  {activeTab && activeTab.originalCode !== undefined ? (
                    <ScreenResourceEditor
                      resource={activeTab}
                      resources={resources}
                      value={activeTab.code}
                      onChange={handleEditorChange}
                      onSave={() => saveTab(activeTab)}
                      onFormat={handleFormatResource}
                      onFormatMetrics={({ printWidth }) => {
                        formatPrintWidthRef.current = printWidth;
                      }}
                      formatOnSave={formatOnSave}
                      onFormatOnSaveChange={setFormatOnSave}
                      goToLine={
                        goToResourcePath && goToResourcePath !== activeTab.path
                          ? 0
                          : goToLine
                      }
                      onGoToLineHandled={() => {
                        setGoToLine(0);
                        setGoToResourcePath(null);
                      }}
                      onOpenPath={handleOpenPath}
                      onDiagnostics={handleDiagnostics}
                      theme={theme}
                    />
                  ) : (
                    <div className="screen-editor-empty">
                      {activeTab?.status ||
                        "Selecciona un recurso de texto para editarlo."}
                    </div>
                  )}
                </section>
              ) : null}
              {showEditorPane && showPreviewPane ? (
                <div
                  className="screens-editor-resizer"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    editorResizeRef.current = {
                      container: event.currentTarget.parentElement,
                    };
                    document.body.style.cursor = "col-resize";
                    document.body.style.userSelect = "none";
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    event.preventDefault();
                  }}
                  onDoubleClick={() => setEditorWidth(null)}
                />
              ) : null}
              {showPreviewPane ? (
                <section className="screen-preview-pane">
                  {previewResource ? (
                    <>
                      <ScreenViewer
                        folder={screensFolder}
                        resource={previewResource}
                        resourceType={previewType}
                        revision={resourceRevision}
                        viewState={screensViewState}
                        onViewStateChange={onScreensViewStateChange}
                        previewLocked={previewLocked}
                        onTogglePreviewLock={togglePreviewLock}
                        onInspectElement={handlePreviewInspect}
                        onClosePreview={
                          previewType === "image"
                            ? () => {
                                if (previewOverride) {
                                  setPreviewOverride(null);
                                } else {
                                  setSelectedResource(null);
                                  setSelectedPaths(new Set());
                                }
                              }
                            : undefined
                        }
                      />
                    </>
                  ) : (
                    <div className="screen-editor-empty">
                      Este recurso no tiene una vista previa disponible.
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>

      {contextMenu?.area === "tab" ? (
        <div
          ref={contextMenuRef}
          className="editor-context-menu screen-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              if (!contextMenu.target.pinned)
                updateTab(contextMenu.target.path, () => ({ pinned: true }));
              closeContextMenu();
            }}
          >
            {contextMenu.target.pinned ? "Fijada" : "Fijar pestaña"}
          </button>
          <div className="editor-context-separator compact" />
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              closeTabs([contextMenu.target.path]);
              closeContextMenu();
            }}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              closeTabs(
                openTabs
                  .filter((t) => t.path !== contextMenu.target.path)
                  .map((t) => t.path),
              );
              closeContextMenu();
            }}
          >
            Cerrar otros
          </button>
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              closeTabs(openTabs.map((t) => t.path));
              closeContextMenu();
            }}
          >
            Cerrar todos
          </button>
        </div>
      ) : null}

      {contextMenu?.area === "tree" ? (
        <div
          ref={contextMenuRef}
          className="editor-context-menu screen-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.target?.path ? (
            <button
              type="button"
              className="editor-context-item"
              onClick={() => openInExplorer(contextMenu.target)}
            >
              <FiExternalLink /> Abrir en explorador
            </button>
          ) : null}
          {contextMenu.target?.path ? (
            <button
              type="button"
              className="editor-context-item"
              onClick={() => startInlineRename(contextMenu.target)}
            >
              {contextMenu.target.type === "directory"
                ? "Renombrar carpeta"
                : "Renombrar"}
            </button>
          ) : null}
          <div className="editor-context-separator compact" />
          {contextMenu.target?.path ? (
            <button
              type="button"
              className="editor-context-item"
              onClick={() => {
                const paths =
                  selectedPaths.size > 0 && selectedPaths.has(contextMenu.target.path)
                    ? [...selectedPaths]
                    : [contextMenu.target.path];
                handleCopyResources(paths);
                closeContextMenu();
              }}
            >
              <FiCopy /> Copiar
            </button>
          ) : null}
          {contextMenu.target?.path ? (
            <button
              type="button"
              className="editor-context-item"
              onClick={() => {
                const paths =
                  selectedPaths.size > 0 && selectedPaths.has(contextMenu.target.path)
                    ? [...selectedPaths]
                    : [contextMenu.target.path];
                handleCutResources(paths);
                closeContextMenu();
              }}
            >
              <FiScissors /> Cortar
            </button>
          ) : null}
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              handlePasteResources(
                contextMenu.target?.type === "directory"
                  ? contextMenu.target.path
                  : getParentPath(contextMenu.target?.path),
              );
              closeContextMenu();
            }}
            disabled={!clipboardPaths.length || !clipboardSourceFolder}
          >
            <FiClipboard /> Pegar
          </button>
          <div className="editor-context-separator compact" />
          <button
            type="button"
            className="editor-context-item"
            onClick={() =>
              createResource(
                contextMenu.target?.type === "directory"
                  ? contextMenu.target.path
                  : getParentPath(contextMenu.target?.path),
              )
            }
          >
            Nuevo archivo
          </button>
          <button
            type="button"
            className="editor-context-item"
            onClick={() =>
              createResource(
                contextMenu.target?.type === "directory"
                  ? contextMenu.target.path
                  : getParentPath(contextMenu.target?.path),
                "directory",
              )
            }
          >
            Nueva carpeta
          </button>
          {contextMenu.target?.path ? (
            <>
              <div className="editor-context-separator compact" />
              <button
                type="button"
                className="editor-context-item danger"
                onClick={() => {
                  const paths =
                    selectedPaths.size > 0 &&
                    selectedPaths.has(contextMenu.target.path)
                      ? [...selectedPaths]
                      : [contextMenu.target.path];
                  deleteResources(paths);
                }}
              >
                <FaTrashCan />{" "}
                {selectedPaths.size > 1 &&
                selectedPaths.has(contextMenu.target.path)
                  ? `Eliminar ${selectedPaths.size} elementos`
                  : "Eliminar"}
              </button>
            </>
          ) : null}
          <div className="editor-context-separator compact" />
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              setTreeCollapseToken((v) => v + 1);
              closeContextMenu();
            }}
          >
            Cerrar todas las carpetas
          </button>
        </div>
      ) : null}

    </div>
  );
}
