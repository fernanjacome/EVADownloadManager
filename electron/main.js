import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";

let staticServer = null;
let staticPort = 0;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===========================================================
   🔥 PUERTO DINÁMICO PARA EVITAR BLOQUEOS
=========================================================== */
function getFreePort() {
    return 3000 + Math.floor(Math.random() * 5000);
}

/* ===========================================================
   🔥 CREA UN SERVIDOR ESTÁTICO LIMPIO Y SIN CACHE
=========================================================== */
async function startStaticServer(folderPath) {
    return new Promise((resolve, reject) => {
        try {
            // Cerrar servidor previo si existe
            if (staticServer) {
                staticServer.close();
                staticServer = null;
            }

            const app = express();
            app.use(express.static(folderPath));

            staticPort = getFreePort();

            staticServer = app.listen(staticPort, () => {
                const url = `http://localhost:${staticPort}`;
                console.log("Servidor estático iniciado:", url);
                resolve(url);
            });
        } catch (err) {
            reject(err);
        }
    });
}

/* ===========================================================
   🔥 LIMPIA TOTAL DEL SERVIDOR PARA BOTÓN PLAY
=========================================================== */
ipcMain.handle("clear-static-cache", async () => {
    if (staticServer) {
        console.log("🧹 Limpiando servidor estático...");
        await new Promise(res => staticServer.close(res));
        staticServer = null;
    }
    return true;
});

/* ===========================================================
   🔥 INICIAR SERVIDOR DESDE FRONT-END
=========================================================== */
ipcMain.handle("start-static-server", async (_, folderPath) => {
    const url = await startStaticServer(folderPath);
    return url;
});

/* ===========================================================
   🔥 LEER CARPETA Y LISTRAR HTML
=========================================================== */
ipcMain.handle("read-folder", async (_, folderPath) => {
    try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true });

        const htmlFiles = files
            .filter(f => f.isFile() && f.name.toLowerCase().endsWith(".html"))
            .map(f => ({
                id: f.name.replace(".html", ""),
                comment: "",
                resource: f.name
            }));

        return { success: true, files: htmlFiles };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/* ===========================================================
   🔥 VENTANA PRINCIPAL
=========================================================== */
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
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
        },
    });

    win.webContents.on("will-navigate", (event) => event.preventDefault());
    win.webContents.on("dragover", (event) => event.preventDefault());
    win.webContents.on("drop", (event) => event.preventDefault());

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        const indexPath = path.join(__dirname, "../dist/index.html");
        win.loadFile(indexPath);
    }

    return win;
}

/* ===========================================================
   🔥 HANDLERS GENERALES YA EXISTENTES
=========================================================== */
ipcMain.handle("write-file", async (_, { path, data }) => {
    try {
        fs.writeFileSync(path, data, "utf-8");
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("read-file", async (_, path) => {
    try {
        const data = fs.readFileSync(path, "utf-8");
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("get-dropped-file-path", async (_, file) => {
    if (file?.path) return file.path;
    return null;
});

ipcMain.handle("open-file-dialog", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "XML Files", extensions: ["xml"] }],
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("get-file-info", async (_, path) => {
    try {
        const stats = fs.statSync(path);
        return {
            success: true,
            info: {
                size: stats.size,
                lastModified: stats.mtimeMs
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("open-folder-dialog", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"]
    });

    return result.canceled ? null : result.filePaths[0];
});


/* ===========================================================
   🔥 APP READY
=========================================================== */
app.whenReady().then(() => {
    createWindow();

    ipcMain.on("open-new-window", () => createWindow());

    ipcMain.on("set-window-title", (_, title) => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) focused.setTitle(title);
    });

    ipcMain.on("window-control", (_, action) => {
        const focused = BrowserWindow.getFocusedWindow();
        if (!focused) return;

        switch (action) {
            case "minimize": focused.minimize(); break;
            case "maximize": focused.isMaximized() ? focused.unmaximize() : focused.maximize(); break;
            case "close": focused.close(); break;
        }
    });
});

/* ===========================================================
   🔥 CIERRE
=========================================================== */
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
