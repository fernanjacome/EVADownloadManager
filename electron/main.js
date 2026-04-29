import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import crypto from "crypto";

let staticServer = null;
let staticPort = 0;
let isQuitting = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_SESSION_FILE = path.join(app.getPath("userData"), "workspace-session.json");
const windowContexts = new Map();

app.commandLine.appendSwitch("ignore-certificate-errors");

function readJsonFile(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function createWorkspaceWindowId() {
  return crypto.randomUUID();
}

function normalizeWorkspaceSession(data) {
  return {
    updatedAt: data?.updatedAt || 0,
    lastFocusedWindowId: data?.lastFocusedWindowId || null,
    windows: Array.isArray(data?.windows)
      ? data.windows
          .filter((item) => item && item.id)
          .map((item) => ({
            id: item.id,
            bounds: item.bounds || null,
            isMaximized: Boolean(item.isMaximized),
            state: item.state ?? null,
          }))
      : [],
  };
}

function readWorkspaceSession() {
  return normalizeWorkspaceSession(readJsonFile(WORKSPACE_SESSION_FILE, null));
}

function writeWorkspaceSession(session) {
  try {
    const normalized = normalizeWorkspaceSession(session);
    if (normalized.windows.length === 0) {
      const existing = readWorkspaceSession();
      if (existing.windows.length > 0) {
        normalized.windows = existing.windows;
        normalized.lastFocusedWindowId =
          normalized.lastFocusedWindowId || existing.lastFocusedWindowId || null;
      }
    }

    writeJsonFile(WORKSPACE_SESSION_FILE, normalized);
  } catch (error) {
    console.error("No se pudo guardar el workspace:", error);
  }
}

function upsertWorkspaceWindow(entry) {
  const workspace = readWorkspaceSession();
  const nextWindows = workspace.windows.filter((item) => item.id !== entry.id);
  nextWindows.push({
    id: entry.id,
    bounds: entry.bounds || null,
    isMaximized: Boolean(entry.isMaximized),
    state: entry.state ?? null,
  });

  writeWorkspaceSession({
    ...workspace,
    updatedAt: Date.now(),
    windows: nextWindows,
  });
}

function removeWorkspaceWindow(windowId) {
  const workspace = readWorkspaceSession();
  writeWorkspaceSession({
    ...workspace,
    updatedAt: Date.now(),
    windows: workspace.windows.filter((item) => item.id !== windowId),
  });
}

function clearStoredWorkspace() {
  try {
    if (fs.existsSync(WORKSPACE_SESSION_FILE)) {
      fs.unlinkSync(WORKSPACE_SESSION_FILE);
    }
  } catch (error) {
    console.error("No se pudo limpiar el workspace:", error);
  }
}

function getWindowContextFromSender(sender) {
  const win = BrowserWindow.fromWebContents(sender);
  if (!win) return null;

  const context = windowContexts.get(win.id);
  if (!context) return null;

  return { win, ...context };
}

function buildWorkspaceSnapshot() {
  const workspace = readWorkspaceSession();
  const windows = BrowserWindow.getAllWindows()
    .map((win) => {
      const context = windowContexts.get(win.id);
      if (!context) return null;

      const existing = workspace.windows.find((item) => item.id === context.workspaceWindowId);
      return {
        id: context.workspaceWindowId,
        bounds: win.getBounds(),
        isMaximized: win.isMaximized(),
        state: context.lastState ?? existing?.state ?? null,
      };
    })
    .filter(Boolean);

  const focused = BrowserWindow.getFocusedWindow();
  const lastFocusedWindowId = focused
    ? windowContexts.get(focused.id)?.workspaceWindowId ?? null
    : workspace.lastFocusedWindowId || null;

  return {
    updatedAt: Date.now(),
    lastFocusedWindowId,
    windows,
  };
}

function persistWorkspaceSnapshot({ allowEmpty = false } = {}) {
  const snapshot = buildWorkspaceSnapshot();
  if (!allowEmpty && snapshot.windows.length === 0) {
    return;
  }
  writeWorkspaceSession(snapshot);
}

function persistAllOpenWindows() {
  BrowserWindow.getAllWindows().forEach((win) => {
    const context = windowContexts.get(win.id);
    if (!context) return;

    upsertWorkspaceWindow({
      id: context.workspaceWindowId,
      bounds: win.getBounds(),
      isMaximized: win.isMaximized(),
      state: context.lastState ?? null,
    });
  });

  persistWorkspaceSnapshot();
}

function getFreePort() {
  return 3000 + Math.floor(Math.random() * 5000);
}

async function startStaticServer(folderPath) {
  return new Promise((resolve, reject) => {
    try {
      if (staticServer) {
        staticServer.close();
        staticServer = null;
      }

      const appServer = express();
      appServer.use(express.static(folderPath));

      staticPort = getFreePort();
      staticServer = appServer.listen(staticPort, () => {
        resolve(`http://localhost:${staticPort}`);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function createWindow(options = {}) {
  const workspace = readWorkspaceSession();
  const workspaceWindowId = options.workspaceWindowId || createWorkspaceWindowId();
  const storedWindow = workspace.windows.find((item) => item.id === workspaceWindowId) || null;
  const initialState =
    Object.prototype.hasOwnProperty.call(options, "initialState")
      ? options.initialState
      : storedWindow?.state ?? null;
  const bounds = options.bounds || storedWindow?.bounds || { width: 1200, height: 800 };

  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    backgroundColor: "#1e1e1e",
    icon: path.join(__dirname, "../public/favicon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      allowFileAccess: true,
      sandbox: false,
      additionalArguments: [`--eva-workspace-window-id=${workspaceWindowId}`],
    },
  });

  windowContexts.set(win.id, {
    workspaceWindowId,
    lastState: initialState ?? storedWindow?.state ?? null,
  });

  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("dragover", (event) => event.preventDefault());
  win.webContents.on("drop", (event) => event.preventDefault());

  const persistCurrentWindow = () => {
    const context = windowContexts.get(win.id);
    if (!context) return;

    upsertWorkspaceWindow({
      id: context.workspaceWindowId,
      bounds: win.getBounds(),
      isMaximized: win.isMaximized(),
      state: context.lastState ?? null,
    });
  };

  win.on("focus", persistWorkspaceSnapshot);
  win.on("resize", persistWorkspaceSnapshot);
  win.on("move", persistWorkspaceSnapshot);
  win.on("maximize", persistWorkspaceSnapshot);
  win.on("unmaximize", persistWorkspaceSnapshot);
  win.on("close", persistCurrentWindow);
  win.on("closed", () => {
    const context = windowContexts.get(win.id);
    windowContexts.delete(win.id);

    if (!context) return;
    if (isQuitting) return;

    const remainingWindows = BrowserWindow.getAllWindows().filter(
      (openWindow) => openWindow.id !== win.id
    );

    if (remainingWindows.length > 0) {
      removeWorkspaceWindow(context.workspaceWindowId);
      persistWorkspaceSnapshot();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  if (options.isMaximized || storedWindow?.isMaximized) {
    win.maximize();
  }

  persistWorkspaceSnapshot();
  return win;
}

function openInitialWorkspace() {
  const workspace = readWorkspaceSession();
  if (workspace.windows.length > 0) {
    workspace.windows.forEach((windowState) => {
      createWindow({
        workspaceWindowId: windowState.id,
        bounds: windowState.bounds || undefined,
        isMaximized: windowState.isMaximized,
        initialState: windowState.state ?? null,
      });
    });
    return;
  }

  createWindow();
}

ipcMain.handle("clear-static-cache", async () => {
  if (staticServer) {
    await new Promise((resolve) => staticServer.close(resolve));
    staticServer = null;
  }
  return true;
});

ipcMain.handle("start-static-server", async (_, folderPath) => {
  return startStaticServer(folderPath);
});

ipcMain.handle("read-folder", async (_, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath, { withFileTypes: true });
    const htmlFiles = files
      .filter((file) => file.isFile() && file.name.toLowerCase().endsWith(".html"))
      .map((file) => ({
        id: file.name.replace(".html", ""),
        comment: "",
        resource: file.name,
      }));

    return { success: true, files: htmlFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("write-file", async (_, { path: filePath, data }) => {
  try {
    fs.writeFileSync(filePath, data, "utf-8");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("read-file", async (_, filePath) => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-dropped-file-path", async (_, file) => {
  return file?.path || null;
});

ipcMain.handle("get-main-pid", () => process.pid);

ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "XML Files", extensions: ["xml"] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("get-file-info", async (_, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      success: true,
      info: {
        size: stats.size,
        lastModified: stats.mtimeMs,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-folder-dialog", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

function writeWorkspaceStateFromSender(sender, state) {
  const context = getWindowContextFromSender(sender);
  if (!context) {
    return { success: false, error: "Ventana no encontrada." };
  }

  context.lastState = state ?? null;
  upsertWorkspaceWindow({
    id: context.workspaceWindowId,
    bounds: context.win.getBounds(),
    isMaximized: context.win.isMaximized(),
    state: context.lastState,
  });
  return { success: true };
}

ipcMain.handle("save-app-state", async (event, state) => {
  try {
    return writeWorkspaceStateFromSender(event.sender, state);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.on("save-app-state-sync", (event, state) => {
  try {
    event.returnValue = writeWorkspaceStateFromSender(event.sender, state);
  } catch (error) {
    event.returnValue = { success: false, error: error.message };
  }
});

ipcMain.handle("load-app-state", async (event) => {
  try {
    const context = getWindowContextFromSender(event.sender);
    if (!context) {
      return { success: false, error: "Ventana no encontrada." };
    }

    const workspace = readWorkspaceSession();
    const entry = workspace.windows.find((item) => item.id === context.workspaceWindowId) || null;
    return {
      success: true,
      data: context.lastState ?? entry?.state ?? null,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("clear-app-cache", async (event) => {
  const context = getWindowContextFromSender(event.sender);
  const win = context?.win;
  if (!win) return false;

  await win.webContents.session.clearCache();
  win.webContents.reloadIgnoringCache();
  return true;
});

ipcMain.handle("clear-app", async (event) => {
  const context = getWindowContextFromSender(event.sender);
  const win = context?.win;
  if (!win) return false;

  const session = win.webContents.session;
  await session.clearCache();
  await session.clearStorageData({
    storages: [
      "localstorage",
      "sessionstorage",
      "indexdb",
      "cachestorage",
      "serviceworkers",
      "websql",
    ],
  });

  win.webContents.reloadIgnoringCache();
  return true;
});

ipcMain.handle("show-save-dialog", async (_, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog(options);
  return canceled ? null : filePath;
});

ipcMain.handle("open-item-location", async (_event, targetPath) => {
  if (!targetPath) return { success: false, error: "Ruta no valida." };
  shell.showItemInFolder(targetPath);
  return { success: true };
});

ipcMain.handle("clear-all-sessions", () => {
  clearStoredWorkspace();
  return { success: true };
});

app.whenReady().then(() => {
  openInitialWorkspace();

  ipcMain.on("open-new-window", () => createWindow());

  ipcMain.on("set-window-title", (event, title) => {
    const context = getWindowContextFromSender(event.sender);
    context?.win?.setTitle(title);
  });

  ipcMain.on("window-control", (event, action) => {
    const context = getWindowContextFromSender(event.sender);
    const targetWindow = context?.win;
    if (!targetWindow) return;

    switch (action) {
      case "minimize":
        targetWindow.minimize();
        break;
      case "maximize":
        targetWindow.isMaximized() ? targetWindow.unmaximize() : targetWindow.maximize();
        break;
      case "close":
        targetWindow.close();
        break;
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  persistAllOpenWindows();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    openInitialWorkspace();
  }
});
