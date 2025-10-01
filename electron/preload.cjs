// preload.js (CommonJS)
const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ Preload cargado (CommonJS)");

contextBridge.exposeInMainWorld("electronAPI", {
    windowControl: (action) => ipcRenderer.send("window-control", action),
    openNewWindow: () => ipcRenderer.send("open-new-window"),
    setWindowTitle: (title) => ipcRenderer.send("set-window-title", title)
});
