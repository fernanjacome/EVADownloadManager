const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ Preload cargado (CommonJS)");

contextBridge.exposeInMainWorld("electronAPI", {
    windowControl: (action) => ipcRenderer.send("window-control", action),
    openNewWindow: () => ipcRenderer.send("open-new-window"),
    setWindowTitle: (title) => ipcRenderer.send("set-window-title", title),
    getFileInfo: (path) => ipcRenderer.invoke("get-file-info", path),

    getDroppedFilePath: (file) => ipcRenderer.invoke("get-dropped-file-path", file),
    openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
    readFile: (path) => ipcRenderer.invoke("read-file", path),
    writeFile: (path, data) => ipcRenderer.invoke("write-file", { path, data }),

});
