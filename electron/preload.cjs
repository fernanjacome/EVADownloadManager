const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload cargado (CommonJS)");

contextBridge.exposeInMainWorld("electronAPI", {
  getMainPid: () => ipcRenderer.invoke("get-main-pid"),
  windowControl: (action) => ipcRenderer.send("window-control", action),
  openNewWindow: () => ipcRenderer.send("open-new-window"),
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
  writeFile: (path, data) => ipcRenderer.invoke("write-file", { path, data }),
  startStaticServer: (folder) => ipcRenderer.invoke("start-static-server", folder),
  clearStaticServerCache: () => ipcRenderer.invoke("clear-static-cache"),
  saveAppState: (state) => ipcRenderer.invoke("save-app-state", state),
  saveAppStateSync: (state) => ipcRenderer.sendSync("save-app-state-sync", state),
  loadAppState: () => ipcRenderer.invoke("load-app-state"),
});
