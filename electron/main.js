import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        const indexPath = path.join(__dirname, "../dist/index.html");
        win.loadFile(indexPath);
    }

    return win;
}

app.whenReady().then(() => {
    createWindow();

    // Abrir nueva ventana
    ipcMain.on("open-new-window", () => {
        createWindow();
    });

    // Cambiar título de la ventana
    ipcMain.on("set-window-title", (_, title) => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) focused.setTitle(title);
    });

    // Controles de ventana (min/max/close)
    ipcMain.on("window-control", (_, action) => {
        const focused = BrowserWindow.getFocusedWindow();
        if (!focused) return;

        switch (action) {
            case "minimize":
                focused.minimize();
                break;
            case "maximize":
                focused.isMaximized() ? focused.unmaximize() : focused.maximize();
                break;
            case "close":
                focused.close();
                break;
        }
    });
});

// Cerrar cuando todas las ventanas se cierran (excepto en macOS)
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

// Reabrir en macOS al hacer click en el dock
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
