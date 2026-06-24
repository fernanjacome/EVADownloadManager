const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload cargado (CommonJS)");

contextBridge.exposeInMainWorld("electronAPI", {
  getMainPid: () => ipcRenderer.invoke("get-main-pid"),
  getWindowMaximized: () => ipcRenderer.invoke("get-window-maximized"),
  onWindowMaximizedChange: (callback) => {
    const listener = (_event, maximized) => callback?.(Boolean(maximized));
    ipcRenderer.on("window-maximized-changed", listener);
    return () => ipcRenderer.removeListener("window-maximized-changed", listener);
  },
  windowControl: (action) => ipcRenderer.send("window-control", action),
  openNewWindow: () => ipcRenderer.send("open-new-window"),
  openDetachedModuleWindow: (moduleKey, state) =>
    ipcRenderer.invoke("open-detached-module-window", { moduleKey, state }),
  updateModuleDockZone: (rect) => ipcRenderer.invoke("update-module-dock-zone", rect),
  dockDetachedModule: (moduleKey, point, options = {}) =>
    ipcRenderer.invoke("dock-detached-module", { moduleKey, point, ...options }),
  onDetachedModuleDocked: (callback) => {
    const listener = (_event, payload) => callback?.(payload);
    ipcRenderer.on("detached-module-docked", listener);
    return () => ipcRenderer.removeListener("detached-module-docked", listener);
  },
  onLinkedModuleStateUpdated: (callback) => {
    const listener = (_event, payload) => callback?.(payload);
    ipcRenderer.on("linked-module-state-updated", listener);
    return () => ipcRenderer.removeListener("linked-module-state-updated", listener);
  },
  requestParentNavigation: (action, payload) =>
    ipcRenderer.invoke("request-parent-navigation", { action, payload }),
  onDetachedModuleNavigation: (callback) => {
    const listener = (_event, payload) => callback?.(payload);
    ipcRenderer.on("detached-module-navigation", listener);
    return () => ipcRenderer.removeListener("detached-module-navigation", listener);
  },
  setWindowTitle: (title) => ipcRenderer.send("set-window-title", title),
  getFileInfo: (path) => ipcRenderer.invoke("get-file-info", path),
  clearAppCache: () => ipcRenderer.invoke("clear-app-cache"),
  clearApp: () => ipcRenderer.invoke("clear-app"),
  showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
  openItemLocation: (targetPath) => ipcRenderer.invoke("open-item-location", targetPath),
  getDroppedFilePath: (file) => ipcRenderer.invoke("get-dropped-file-path", file),
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  readFile: (path) => ipcRenderer.invoke("read-file", path),
  openFolderDialog: () => ipcRenderer.invoke("open-folder-dialog"),
  readFolder: (folder) => ipcRenderer.invoke("read-folder", folder),
  listScreenResources: (folder) => ipcRenderer.invoke("list-screen-resources", folder),
  readScreenResource: (folder, resource) =>
    ipcRenderer.invoke("read-screen-resource", { folderPath: folder, relativePath: resource }),
  writeScreenResource: (folder, resource, data) =>
    ipcRenderer.invoke("write-screen-resource", { folderPath: folder, relativePath: resource, data }),
  renameScreenResource: (folder, resource, newName) =>
    ipcRenderer.invoke("rename-screen-resource", { folderPath: folder, relativePath: resource, newName }),
  createScreenResource: (folder, parentPath, name, type) =>
    ipcRenderer.invoke("create-screen-resource", { folderPath: folder, parentPath, name, type }),
  searchScreenResources: (folder, query) =>
    ipcRenderer.invoke("search-screen-resources", { folderPath: folder, query }),
  trashScreenResource: (folder, resource) =>
    ipcRenderer.invoke("trash-screen-resource", { folderPath: folder, relativePath: resource }),
  copyScreenResource: (folder, sourcePath, destDir) =>
    ipcRenderer.invoke("copy-screen-resource", { folderPath: folder, sourcePath, destDir }),
  copyScreenResourceBetweenFolders: (sourceFolder, sourcePath, destFolder, destDir) =>
    ipcRenderer.invoke("copy-screen-resource-between-folders", {
      sourceFolderPath: sourceFolder,
      sourcePath,
      destFolderPath: destFolder,
      destDir,
    }),
  pasteExternalFiles: (folder, destDir, filePaths) =>
    ipcRenderer.invoke("paste-external-files", { folderPath: folder, destDir, filePaths }),
  readClipboardFiles: () =>
    ipcRenderer.invoke("read-clipboard-files"),
  openDevTools: () => ipcRenderer.invoke("open-devtools"),
  readLogFolder: (folder) => ipcRenderer.invoke("read-log-folder", folder),
  writeFile: (path, data) => ipcRenderer.invoke("write-file", { path, data }),
  startStaticServer: (folder) => ipcRenderer.invoke("start-static-server", folder),
  clearStaticServerCache: () => ipcRenderer.invoke("clear-static-cache"),
  getAppUpdateStatus: () => ipcRenderer.invoke("get-app-update-status"),
  setAppUpdateChannel: (manifestUrl) => ipcRenderer.invoke("set-app-update-channel", manifestUrl),
  checkAppUpdate: () => ipcRenderer.invoke("check-app-update"),
  installAppUpdate: () => ipcRenderer.invoke("install-app-update"),
  onUpdateDownloadProgress: (listener) => {
    const handler = (_event, data) => listener(data);
    ipcRenderer.on("update-download-progress", handler);
    return () => ipcRenderer.removeListener("update-download-progress", handler);
  },
  saveAppState: (state) => ipcRenderer.invoke("save-app-state", state),
  saveAppStateSync: (state) => ipcRenderer.sendSync("save-app-state-sync", state),
  loadAppState: () => ipcRenderer.invoke("load-app-state"),
});
