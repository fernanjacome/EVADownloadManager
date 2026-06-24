import { app, BrowserWindow, ipcMain, dialog, shell, clipboard, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import crypto from "crypto";
import { execFile, spawn } from "child_process";

let staticServer = null;
let staticPort = 0;
let staticFolder = null;
let isQuitting = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_SESSION_FILE = path.join(app.getPath("userData"), "workspace-session.json");
const windowContexts = new Map();
const moduleDockZones = new Map();
const linkedStateFingerprints = new Map();
let workspacePersistTimer = null;
const UPDATE_CONFIG_FILE = "update-config.json";
const pendingUpdates = new Map();
const UPDATE_LOG_FILE = path.join(app.getPath("userData"), "update-log.txt");

function updateLog(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(UPDATE_LOG_FILE, line, "utf-8");
  } catch { /* ignore */ }
}

const MODULE_LABELS = {
  code: "XML",
  compare: "Comparar",
  screens: "Pantallas",
  compiler: "Compilador",
  flows: "Flujos",
  logs: "Logs",
  remote: "Remoto",
};

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

function compareVersions(left, right) {
  const parse = (version) => String(version || "")
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length, 3);

  for (let index = 0; index < length; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) {
      return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
    }
  }

  return 0;
}

function getUpdateConfig() {
  const packagedConfigPath = path.join(__dirname, UPDATE_CONFIG_FILE);
  const userConfigPath = path.join(app.getPath("userData"), UPDATE_CONFIG_FILE);
  const packagedConfig = readJsonFile(packagedConfigPath, {});
  const userConfig = readJsonFile(userConfigPath, {});
  const envUrl = process.env.EVA_UPDATE_MANIFEST_URL || "";
  const manifestUrl = envUrl || userConfig.manifestUrl || packagedConfig.manifestUrl || "";
  const normalized = normalizeUpdateChannel(manifestUrl);

  updateLog(`getUpdateConfig: packagedConfigPath=${packagedConfigPath}`);
  updateLog(`getUpdateConfig: userConfigPath=${userConfigPath}`);
  updateLog(`getUpdateConfig: envUrl="${envUrl}" userConfig="${userConfig.manifestUrl || ""}" packagedConfig="${packagedConfig.manifestUrl || ""}"`);
  updateLog(`getUpdateConfig: manifestUrl final="${normalized}"`);

  return { manifestUrl: normalized };
}

function isNetworkSharePath(value) {
  return /^\\\\[^\\]+\\[^\\]+(?:\\|$)/.test(String(value || ""));
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUpdateChannel(value) {
  const source = String(value || "").trim();
  if (isNetworkSharePath(source) && !/\.json$/i.test(source)) {
    return path.join(source, "latest.json");
  }
  return source;
}

function getAppUpdateStatus() {
  const config = getUpdateConfig();
  const supported = process.platform === "win32";
  const configPath = path.join(app.getPath("userData"), UPDATE_CONFIG_FILE);

  updateLog(`getAppUpdateStatus: platform=${process.platform} isPackaged=${app.isPackaged} supported=${supported}`);
  updateLog(`getAppUpdateStatus: configured=${Boolean(config.manifestUrl)} manifestUrl="${config.manifestUrl}"`);

  const result = {
    currentVersion: app.getVersion(),
    configured: Boolean(config.manifestUrl),
    manifestUrl: config.manifestUrl,
    supported,
    configPath,
    message: !config.manifestUrl
      ? "Canal de actualización no configurado."
      : !supported
        ? "El actualizador portable solo funciona en Windows."
        : "Listo para buscar actualizaciones.",
  };
  updateLog(`getAppUpdateStatus: message="${result.message}"`);
  return result;
}

function validateUpdateManifest(manifest, manifestUrl) {
  updateLog(`validateUpdateManifest: manifest=${JSON.stringify(manifest)}`);
  updateLog(`validateUpdateManifest: manifestUrl="${manifestUrl}"`);

  if (!manifest || typeof manifest !== "object") {
    updateLog("validateUpdateManifest: ERROR manifiesto no es un objeto valido");
    throw new Error("El manifiesto de actualización no tiene un formato válido.");
  }

  const version = String(manifest.version || "").trim();
  const url = String(manifest.url || "").trim();
  const sha512 = String(manifest.sha512 || "").trim();
  updateLog(`validateUpdateManifest: version="${version}" url="${url}" sha512="${sha512.slice(0, 20)}..."`);

  if (!/^\d+(?:\.\d+){1,3}$/.test(version) || !url || !sha512) {
    updateLog("validateUpdateManifest: ERROR campos requeridos faltantes o version invalida");
    throw new Error("El manifiesto debe incluir version, url y sha512.");
  }

  const manifestIsShare = isNetworkSharePath(manifestUrl);
  updateLog(`validateUpdateManifest: manifestIsShare=${manifestIsShare}`);

  if (manifestIsShare) {
    const packageSource = isNetworkSharePath(url)
      ? url
      : path.resolve(path.dirname(manifestUrl), url);
    updateLog(`validateUpdateManifest: packageSource="${packageSource}"`);
    if (!/\.zip$/i.test(packageSource)) {
      updateLog("validateUpdateManifest: ERROR paquete no es ZIP");
      throw new Error("El paquete indicado no es un archivo ZIP.");
    }
    const result = { version, url: packageSource, sha512, notes: String(manifest.notes || "") };
    updateLog(`validateUpdateManifest: OK (share) result=${JSON.stringify(result)}`);
    return result;
  }

  const parsedManifestUrl = new URL(manifestUrl);
  const parsedDownloadUrl = new URL(url);
  if (parsedManifestUrl.protocol !== "https:" || parsedDownloadUrl.protocol !== "https:") {
    updateLog(`validateUpdateManifest: ERROR protocolo no HTTPS: manifest=${parsedManifestUrl.protocol} download=${parsedDownloadUrl.protocol}`);
    throw new Error("Las actualizaciones deben publicarse mediante HTTPS.");
  }
  if (!/\.zip(?:$|[?#])/i.test(parsedDownloadUrl.pathname)) {
    updateLog(`validateUpdateManifest: ERROR URL no apunta a ZIP: ${parsedDownloadUrl.pathname}`);
    throw new Error("El paquete de actualización debe ser un archivo ZIP.");
  }

  const result = { version, url: parsedDownloadUrl.toString(), sha512, notes: String(manifest.notes || "") };
  updateLog(`validateUpdateManifest: OK (https) result=${JSON.stringify(result)}`);
  return result;
}

async function fetchUpdateManifest() {
  updateLog("fetchUpdateManifest: INICIO");
  const config = getUpdateConfig();
  if (!config.manifestUrl) {
    updateLog("fetchUpdateManifest: no hay manifestUrl configurada, saliendo");
    return { ok: false, code: "not-configured", ...getAppUpdateStatus() };
  }

  if (process.platform !== "win32") {
    updateLog(`fetchUpdateManifest: plataforma no soportada: ${process.platform}`);
    return { ok: false, code: "unsupported", ...getAppUpdateStatus() };
  }

  updateLog(`fetchUpdateManifest: isPackaged=${app.isPackaged} (permitido en dev para pruebas)`);

  let response;
  let rawManifest;
  try {
    if (isNetworkSharePath(config.manifestUrl)) {
      updateLog(`fetchUpdateManifest: leyendo manifiesto de red: ${config.manifestUrl}`);
      rawManifest = JSON.parse(await fs.promises.readFile(config.manifestUrl, "utf8"));
      updateLog(`fetchUpdateManifest: manifiesto leido OK: ${JSON.stringify(rawManifest)}`);
    } else {
      updateLog(`fetchUpdateManifest: fetch HTTPS: ${config.manifestUrl}`);
      response = await fetch(config.manifestUrl, { signal: AbortSignal.timeout(15000) });
      updateLog(`fetchUpdateManifest: fetch status=${response.status}`);
    }
  } catch (err) {
    updateLog(`fetchUpdateManifest: ERROR al consultar canal: ${err.message}`);
    throw new Error("No se pudo consultar el canal de actualizaciones.");
  }
  if (response && !response.ok) {
    updateLog(`fetchUpdateManifest: ERROR respuesta HTTP ${response.status}`);
    throw new Error(`El canal de actualizaciones respondió ${response.status}.`);
  }

  const manifest = validateUpdateManifest(rawManifest || await response.json(), config.manifestUrl);
  const currentVersion = app.getVersion();
  updateLog(`fetchUpdateManifest: currentVersion=${currentVersion} manifestVersion=${manifest.version}`);
  const cmp = compareVersions(manifest.version, currentVersion);
  updateLog(`fetchUpdateManifest: compareVersions result=${cmp}`);

  if (cmp <= 0) {
    updateLog("fetchUpdateManifest: ya tienes la version mas reciente");
    return { ok: true, available: false, currentVersion, message: "Ya tienes la versión más reciente." };
  }

  updateLog(`fetchUpdateManifest: ACTUALIZACION DISPONIBLE v${manifest.version}`);
  return {
    ok: true,
    available: true,
    currentVersion,
    version: manifest.version,
    notes: manifest.notes,
    manifest,
  };
}

async function runPowerShell(args) {
  await new Promise((resolve, reject) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args], { windowsHide: true }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve();
    });
  });
}

function findPortablePayload(directory, executableName, depth = 0) {
  if (fs.existsSync(path.join(directory, executableName))) {
    return directory;
  }
  if (depth >= 2) return null;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const payload = findPortablePayload(path.join(directory, entry.name), executableName, depth + 1);
    if (payload) return payload;
  }
  return null;
}

function broadcastUpdateProgress(percent, phase) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("update-download-progress", { percent, phase });
  }
}

async function downloadPortableUpdate(manifest) {
  updateLog(`downloadPortableUpdate: INICIO url="${manifest.url}"`);
  let packageData;
  if (isNetworkSharePath(manifest.url)) {
    updateLog(`downloadPortableUpdate: leyendo ZIP desde red: ${manifest.url}`);
    const stat = await fs.promises.stat(manifest.url);
    const totalSize = stat.size;
    broadcastUpdateProgress(0, "download");
    const chunks = [];
    let received = 0;
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(manifest.url);
      stream.on("data", (chunk) => {
        chunks.push(chunk);
        received += chunk.length;
        broadcastUpdateProgress(Math.round((received / totalSize) * 100), "download");
      });
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    packageData = Buffer.concat(chunks);
    updateLog(`downloadPortableUpdate: ZIP leido, tamaño=${packageData.length} bytes`);
  } else {
    updateLog(`downloadPortableUpdate: descargando ZIP por HTTPS: ${manifest.url}`);
    const response = await fetch(manifest.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      updateLog(`downloadPortableUpdate: ERROR HTTP ${response.status}`);
      throw new Error(`No se pudo descargar la actualización (${response.status}).`);
    }
    const totalSize = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    broadcastUpdateProgress(0, "download");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (totalSize) {
        broadcastUpdateProgress(Math.round((received / totalSize) * 100), "download");
      }
    }
    packageData = Buffer.concat(chunks);
    updateLog(`downloadPortableUpdate: ZIP descargado, tamaño=${packageData.length} bytes`);
  }
  broadcastUpdateProgress(100, "verify");

  const expected = manifest.sha512.replace(/\s/g, "");
  const actualBase64 = crypto.createHash("sha512").update(packageData).digest("base64");
  const actualHex = crypto.createHash("sha512").update(packageData).digest("hex");
  updateLog(`downloadPortableUpdate: SHA512 esperado="${expected.slice(0, 30)}..."`);
  updateLog(`downloadPortableUpdate: SHA512 actualBase64="${actualBase64.slice(0, 30)}..."`);
  updateLog(`downloadPortableUpdate: SHA512 actualHex="${actualHex.slice(0, 30)}..."`);
  updateLog(`downloadPortableUpdate: matchBase64=${expected === actualBase64} matchHex=${expected.toLowerCase() === actualHex.toLowerCase()}`);

  if (expected !== actualBase64 && expected.toLowerCase() !== actualHex.toLowerCase()) {
    updateLog("downloadPortableUpdate: ERROR verificacion SHA-512 FALLIDA");
    throw new Error("La verificación SHA-512 del paquete falló. La actualización fue cancelada.");
  }
  updateLog("downloadPortableUpdate: SHA-512 verificado OK");

  const stagePath = path.join(app.getPath("temp"), `eva-studio-update-${manifest.version}-${Date.now()}`);
  const zipPath = `${stagePath}.zip`;
  updateLog(`downloadPortableUpdate: stagePath="${stagePath}" zipPath="${zipPath}"`);
  fs.mkdirSync(stagePath, { recursive: true });
  fs.writeFileSync(zipPath, packageData);
  broadcastUpdateProgress(100, "extract");
  updateLog("downloadPortableUpdate: extrayendo ZIP con Expand-Archive...");
  await runPowerShell(["-Command", `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${stagePath.replace(/'/g, "''")}' -Force`]);
  fs.unlinkSync(zipPath);
  updateLog(`downloadPortableUpdate: extraccion completada en ${stagePath}`);
  broadcastUpdateProgress(100, "done");
  return stagePath;
}

function launchPortableReplacement(installRoot, payloadPath, executableName) {
  const scriptPath = path.join(app.getPath("temp"), `eva-studio-apply-update-${Date.now()}.ps1`);
  const script = `param([int]$ProcessId, [string]$CurrentDir, [string]$PayloadDir, [string]$ExeName)
$logFile = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'eva-studio-2026\\update-replace-log.txt'
function Log($msg) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
  Add-Content -LiteralPath $logFile -Value "[$ts] $msg" -Encoding UTF8
}
Log "=== INICIO script de reemplazo ==="
Log "ProcessId=$ProcessId"
Log "CurrentDir=$CurrentDir"
Log "PayloadDir=$PayloadDir"
Log "ExeName=$ExeName"
$ErrorActionPreference = 'Stop'
try {
  Log "Esperando que proceso $ProcessId termine..."
  $waited = 0
  while (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 500
    $waited += 500
    if ($waited % 5000 -eq 0) { Log "Aun esperando... ($waited ms)" }
    if ($waited -gt 30000) { Log "TIMEOUT esperando proceso"; break }
  }
  Log "Proceso terminado (espera=$waited ms)"
  Log "Buscando procesos residuales..."
  Get-Process | Where-Object {
    try { $_.Path -and $_.Path.StartsWith($CurrentDir, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false }
  } | ForEach-Object {
    Log "Matando proceso residual: $($_.Name) PID=$($_.Id)"
    try { $_.Kill(); $_.WaitForExit(5000) } catch {}
  }
  Start-Sleep -Milliseconds 2000
  Log "Espera de 2s para liberar archivos"
  Log "Sobreescribiendo archivos con robocopy /MIR..."
  $roboArgs = @($PayloadDir, $CurrentDir, '/MIR', '/R:10', '/W:3', '/NFL', '/NDL', '/NJH', '/NJS', '/NS', '/NC')
  Log "robocopy $($roboArgs -join ' ')"
  & robocopy @roboArgs
  $roboExit = $LASTEXITCODE
  Log "robocopy exit code=$roboExit (0-7=OK, 8+=error)"
  if ($roboExit -ge 8) {
    Log "ERROR robocopy fallo (exit $roboExit)"
    throw "robocopy fallo con codigo $roboExit"
  }
  Log "Archivos actualizados OK"
  $exePath = Join-Path $CurrentDir $ExeName
  Log "Verificando exe existe: $exePath"
  if (-not (Test-Path -LiteralPath $exePath)) {
    Log "ERROR exe no encontrado en destino"
    throw "El ejecutable no se encontro en $exePath"
  }
  Log "Iniciando exe: $exePath"
  Start-Process -FilePath $exePath
  Log "Exe iniciado OK"
  Log "Limpiando payload temporal..."
  $payloadParent = Split-Path -Parent $PayloadDir
  Remove-Item -LiteralPath $payloadParent -Recurse -Force -ErrorAction SilentlyContinue
  Log "=== ACTUALIZACION COMPLETADA ==="
} catch {
  Log "ERROR: $($_.Exception.Message)"
  Log "StackTrace: $($_.ScriptStackTrace)"
} finally {
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}`;
  fs.writeFileSync(scriptPath, script, "utf8");
  updateLog(`launchPortableReplacement: scriptPath="${scriptPath}"`);
  updateLog(`launchPortableReplacement: args: PID=${process.pid} CurrentDir="${installRoot}" PayloadDir="${payloadPath}" ExeName="${executableName}"`);

  const wrapperPath = scriptPath.replace(/\.ps1$/, ".cmd");
  const wrapperContent = `@echo off\r\nstart "" /b powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" -ProcessId ${process.pid} -CurrentDir "${installRoot}" -PayloadDir "${payloadPath}" -ExeName "${executableName}"\r\n`;
  fs.writeFileSync(wrapperPath, wrapperContent, "utf8");
  updateLog(`launchPortableReplacement: wrapperPath="${wrapperPath}"`);

  const child = spawn("cmd.exe", ["/c", wrapperPath], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  updateLog(`launchPortableReplacement: wrapper CMD lanzado, PID hijo=${child.pid}`);
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

function findWindowByWorkspaceId(workspaceWindowId) {
  return BrowserWindow.getAllWindows().find((win) => {
    const context = windowContexts.get(win.id);
    return context?.workspaceWindowId === workspaceWindowId;
  });
}

function getLinkedDetachedWindows(parentWorkspaceWindowId) {
  return BrowserWindow.getAllWindows().filter((win) => {
    const context = windowContexts.get(win.id);
    return (
      context?.isDetachedModule &&
      context.parentWorkspaceWindowId === parentWorkspaceWindowId
    );
  });
}

function safeSend(win, channel, payload) {
  if (!win || win.isDestroyed() || win.webContents?.isDestroyed?.()) {
    return false;
  }

  win.webContents.send(channel, payload);
  return true;
}

function getLinkedGroupId(context) {
  return context?.isDetachedModule
    ? context.parentWorkspaceWindowId
    : context?.workspaceWindowId;
}

function extractSharedLinkedState(state) {
  if (!state) return null;

  return {
    xmlState: state.xmlState ?? null,
    compilerState: state.compilerState ?? null,
    compareState: state.compareState ?? null,
    logsState: state.logsState ?? null,
    screensFolder: state.screensFolder ?? null,
    screensFolderInput: state.screensFolderInput ?? "",
    selectedScreen: state.selectedScreen ?? null,
    screensViewState: state.screensViewState ?? null,
    flowViewState: state.flowViewState ?? null,
    editorViewState: state.editorViewState ?? null,
    xmlSuggestionSettings: state.xmlSuggestionSettings ?? null,
  };
}

function mergeSharedLinkedState(baseState, incomingState) {
  const sharedState = extractSharedLinkedState(incomingState);
  if (!sharedState) return baseState ?? null;

  return {
    ...(baseState ?? {}),
    ...sharedState,
  };
}

function restoreDetachedModulesInState(state) {
  if (!state) return state ?? null;
  if (!Array.isArray(state.detachedModules) || state.detachedModules.length === 0) {
    return {
      ...state,
      detachedModule: null,
      detachedModules: [],
    };
  }

  const visibleModules = {
    ...(state.visibleModules || {}),
  };
  state.detachedModules.forEach((moduleKey) => {
    visibleModules[moduleKey] = true;
  });

  return {
    ...state,
    visibleModules,
    detachedModule: null,
    detachedModules: [],
  };
}

function getPersistableWindowState(context) {
  return context?.isDetachedModule
    ? context?.lastState ?? null
    : restoreDetachedModulesInState(context?.lastState ?? null);
}

function shouldBroadcastLinkedState(context, state) {
  const groupId = getLinkedGroupId(context);
  if (!groupId) return false;

  const sharedState = extractSharedLinkedState(state);
  const fingerprint = JSON.stringify(sharedState);
  if (linkedStateFingerprints.get(groupId) === fingerprint) {
    return false;
  }

  linkedStateFingerprints.set(groupId, fingerprint);
  return true;
}

function broadcastLinkedState(context, state) {
  if (!context || !state) return;
  if (!shouldBroadcastLinkedState(context, state)) return;

  if (context.isDetachedModule) {
    const parent = findWindowByWorkspaceId(context.parentWorkspaceWindowId);
    const parentContext = parent ? windowContexts.get(parent.id) : null;
    if (parentContext) {
      parentContext.lastState = mergeSharedLinkedState(parentContext.lastState, state);
      upsertWorkspaceWindow({
        id: parentContext.workspaceWindowId,
        bounds: parent.getBounds(),
        isMaximized: parent.isMaximized(),
        state: parentContext.lastState,
      });
    }

    safeSend(parent, "linked-module-state-updated", {
      source: "detached",
      moduleKey: context.detachedModuleKey,
      state,
    });
    return;
  }

  getLinkedDetachedWindows(context.workspaceWindowId).forEach((win) => {
    const winContext = windowContexts.get(win.id);
    safeSend(win, "linked-module-state-updated", {
      source: "parent",
      moduleKey: winContext?.detachedModuleKey || null,
      state,
    });
  });
}

function buildWorkspaceSnapshot() {
  const workspace = readWorkspaceSession();
  const windows = BrowserWindow.getAllWindows()
    .map((win) => {
      const context = windowContexts.get(win.id);
      if (!context) return null;
      if (context.isDetachedModule) return null;

      const existing = workspace.windows.find((item) => item.id === context.workspaceWindowId);
      return {
        id: context.workspaceWindowId,
        bounds: win.getBounds(),
        isMaximized: win.isMaximized(),
        state: getPersistableWindowState(context) ?? existing?.state ?? null,
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

function schedulePersistWorkspaceSnapshot() {
  if (workspacePersistTimer) {
    clearTimeout(workspacePersistTimer);
  }

  workspacePersistTimer = setTimeout(() => {
    workspacePersistTimer = null;
    persistWorkspaceSnapshot();
  }, 350);
}

function persistAllOpenWindows() {
  if (workspacePersistTimer) {
    clearTimeout(workspacePersistTimer);
    workspacePersistTimer = null;
  }

  BrowserWindow.getAllWindows().forEach((win) => {
    const context = windowContexts.get(win.id);
    if (!context) return;
    if (context.isDetachedModule) return;

    upsertWorkspaceWindow({
      id: context.workspaceWindowId,
      bounds: win.getBounds(),
      isMaximized: win.isMaximized(),
      state: getPersistableWindowState(context),
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
      const normalizedFolder = path.resolve(folderPath);
      if (staticServer && staticFolder === normalizedFolder) {
        resolve(`http://localhost:${staticPort}`);
        return;
      }

      if (staticServer) {
        staticServer.close();
        staticServer = null;
        staticFolder = null;
      }

      const appServer = express();
      appServer.use(express.static(normalizedFolder));

      staticPort = getFreePort();
      staticServer = appServer.listen(staticPort, () => {
        staticFolder = normalizedFolder;
        resolve(`http://localhost:${staticPort}`);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function resolveScreenResource(folderPath, relativePath) {
  const root = path.resolve(folderPath);
  const target = path.resolve(root, relativePath || "");
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("El recurso debe permanecer dentro de la carpeta de pantallas.");
  }
  return target;
}

function collectScreenResources(rootFolder, currentFolder = rootFolder, resources = []) {
  const entries = fs.readdirSync(currentFolder, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  for (const entry of entries) {
    const fullPath = path.join(currentFolder, entry.name);
    const relativePath = path.relative(rootFolder, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      resources.push({ type: "directory", name: entry.name, path: relativePath });
      collectScreenResources(rootFolder, fullPath, resources);
      continue;
    }

    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    resources.push({
      type: "file",
      name: entry.name,
      path: relativePath,
      extension,
      editable: [".html", ".htm", ".css", ".scss", ".js", ".jsx", ".ts", ".tsx", ".json", ".xml", ".svg", ".txt"].includes(extension),
    });
  }

  return resources;
}

function createWindow(options = {}) {
  const workspace = readWorkspaceSession();
  const workspaceWindowId = options.workspaceWindowId || createWorkspaceWindowId();
  const isDetachedModule = Boolean(options.isDetachedModule);
  const storedWindow = workspace.windows.find((item) => item.id === workspaceWindowId) || null;
  const initialState =
    Object.prototype.hasOwnProperty.call(options, "initialState")
      ? options.initialState
      : storedWindow?.state ?? null;
  const bounds = options.bounds || storedWindow?.bounds || { width: 1200, height: 800 };

  const win = new BrowserWindow({
    ...bounds,
    parent: isDetachedModule ? undefined : options.parent || undefined,
    modal: false,
    skipTaskbar: false,
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
    isDetachedModule,
    parentWorkspaceWindowId: options.parentWorkspaceWindowId || null,
    detachedModuleKey: options.detachedModuleKey || null,
    lastState: initialState ?? storedWindow?.state ?? null,
  });

  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("dragover", (event) => event.preventDefault());
  win.webContents.on("drop", (event) => event.preventDefault());

  const persistCurrentWindow = () => {
    const context = windowContexts.get(win.id);
    if (!context) return;
    if (context.isDetachedModule) return;

    upsertWorkspaceWindow({
      id: context.workspaceWindowId,
      bounds: win.getBounds(),
      isMaximized: win.isMaximized(),
      state: getPersistableWindowState(context),
    });
  };

  win.on("focus", schedulePersistWorkspaceSnapshot);
  if (!isDetachedModule) {
    win.on("resize", schedulePersistWorkspaceSnapshot);
    win.on("move", schedulePersistWorkspaceSnapshot);
  }
  const publishMaximizedState = () => {
    persistWorkspaceSnapshot();
    safeSend(win, "window-maximized-changed", win.isMaximized());
  };
  win.on("maximize", publishMaximizedState);
  win.on("unmaximize", publishMaximizedState);
  win.webContents.on("did-finish-load", () => {
    safeSend(win, "window-maximized-changed", win.isMaximized());
  });
  win.on("close", persistCurrentWindow);
  win.on("closed", () => {
    const context = windowContexts.get(win.id);
    windowContexts.delete(win.id);
    if (context?.isDetachedModule) {
      if (isQuitting || context.suppressDockOnClose) return;

      const parent = findWindowByWorkspaceId(context.parentWorkspaceWindowId);
      if (context.detachedModuleKey) {
        safeSend(parent, "detached-module-docked", {
          moduleKey: context.detachedModuleKey,
          state: context.lastState ?? null,
        });
      }
      return;
    }

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

  if (isDetachedModule) {
    win.setSkipTaskbar(false);
  }

  if (!isDetachedModule) {
    persistWorkspaceSnapshot();
  }
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
    staticServer.closeAllConnections();
    await new Promise((resolve) => staticServer.close(resolve));
    staticServer = null;
  }
  staticFolder = null;
  return true;
});

ipcMain.handle("start-static-server", async (_, folderPath) => {
  return startStaticServer(folderPath);
});

ipcMain.handle("read-folder", async (_, folderPath) => {
  try {
    const resources = collectScreenResources(path.resolve(folderPath));
    const htmlFiles = resources
      .filter((file) => file.type === "file" && /\.html?$/i.test(file.path))
      .map((file) => ({
        id: file.path.replace(/\.html?$/i, ""),
        comment: "",
        resource: file.path,
      }));

    return { success: true, files: htmlFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("list-screen-resources", async (_, folderPath) => {
  try {
    const root = path.resolve(folderPath);
    return { success: true, resources: collectScreenResources(root) };
  } catch (error) {
    return { success: false, error: error.message, resources: [] };
  }
});

ipcMain.handle("read-screen-resource", async (_, { folderPath, relativePath }) => {
  try {
    const filePath = resolveScreenResource(folderPath, relativePath);
    const data = fs.readFileSync(filePath, "utf-8");
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("write-screen-resource", async (_, { folderPath, relativePath, data }) => {
  try {
    const filePath = resolveScreenResource(folderPath, relativePath);
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, String(data ?? ""), "utf-8");
    fs.renameSync(tempPath, filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("rename-screen-resource", async (_, { folderPath, relativePath, newName }) => {
  try {
    const sourcePath = resolveScreenResource(folderPath, relativePath);
    const safeName = String(newName || "").trim();
    if (!safeName || safeName.includes("/") || safeName.includes("\\")) {
      throw new Error("Nombre de recurso invalido.");
    }
    const targetPath = resolveScreenResource(folderPath, path.posix.join(path.posix.dirname(relativePath), safeName));
    fs.renameSync(sourcePath, targetPath);
    return { success: true, path: path.relative(path.resolve(folderPath), targetPath).replace(/\\/g, "/") };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("create-screen-resource", async (_, { folderPath, parentPath = "", name, type }) => {
  try {
    const safeName = String(name || "").trim();
    if (!safeName || safeName.includes("/") || safeName.includes("\\")) {
      throw new Error("Nombre de recurso invalido.");
    }
    const relativePath = path.posix.join(parentPath || "", safeName);
    const targetPath = resolveScreenResource(folderPath, relativePath);
    if (fs.existsSync(targetPath)) throw new Error("Ya existe un recurso con ese nombre.");

    if (type === "directory") fs.mkdirSync(targetPath, { recursive: false });
    else {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, "", "utf-8");
    }

    return { success: true, path: relativePath.replace(/\\/g, "/") };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("search-screen-resources", async (_, { folderPath, query }) => {
  try {
    if (!query?.trim()) return { success: true, results: [] };
    const root = path.resolve(folderPath);
    const resources = collectScreenResources(root);
    const lowerQuery = query.toLowerCase();
    const results = [];
    const MAX_RESULTS = 300;

    for (const resource of resources) {
      if (resource.type !== "file" || !resource.editable) continue;
      if (results.length >= MAX_RESULTS) break;
      try {
        const filePath = path.join(root, resource.path);
        const content = fs.readFileSync(filePath, "utf-8");
        const lowerContent = content.toLowerCase();
        let searchFrom = 0;
        while (results.length < MAX_RESULTS) {
          const idx = lowerContent.indexOf(lowerQuery, searchFrom);
          if (idx === -1) break;
          const line = content.slice(0, idx).split("\n").length;
          const lineStart = content.lastIndexOf("\n", idx) + 1;
          const lineEnd = content.indexOf("\n", idx + lowerQuery.length);
          const matchText = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd).trimEnd();
          results.push({
            path: resource.path,
            name: resource.name,
            line,
            text: matchText.slice(0, 300),
            extension: resource.extension,
          });
          searchFrom = idx + 1;
        }
      } catch { /* unreadable file */ }
    }
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message, results: [] };
  }
});

ipcMain.handle("read-log-folder", async (_, folderPath) => {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
      .map((entry) => {
        const fullPath = path.join(folderPath, entry.name);
        const stats = fs.statSync(fullPath);
        return {
          name: entry.name,
          path: fullPath,
          size: stats.size,
          lastModified: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.lastModified - a.lastModified);

    return { success: true, files };
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

ipcMain.handle("get-window-maximized", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return Boolean(win?.isMaximized());
});

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
  const storedContext = windowContexts.get(context.win.id);
  if (storedContext) {
    storedContext.lastState = context.lastState;
  }

  broadcastLinkedState(context, context.lastState);
  if (context.isDetachedModule) {
    return { success: true };
  }

  upsertWorkspaceWindow({
    id: context.workspaceWindowId,
    bounds: context.win.getBounds(),
    isMaximized: context.win.isMaximized(),
    state: getPersistableWindowState(context),
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

ipcMain.handle("open-detached-module-window", async (event, payload) => {
  try {
    const context = getWindowContextFromSender(event.sender);
    if (!context?.win) {
      return { success: false, error: "Ventana principal no encontrada." };
    }

    const parentBounds = context?.win?.getBounds?.();
    const moduleKey = String(payload?.moduleKey || "code");
    const initialState = payload?.state ?? null;
    const fallbackBounds = { width: 1120, height: 780 };

    const bounds = parentBounds
      ? {
          x: parentBounds.x + 72,
          y: parentBounds.y + 72,
          width: Math.max(980, Math.min(parentBounds.width, 1320)),
          height: Math.max(680, Math.min(parentBounds.height, 920)),
        }
      : fallbackBounds;

    const win = createWindow({
      parentWorkspaceWindowId: context.workspaceWindowId,
      isDetachedModule: true,
      detachedModuleKey: moduleKey,
      bounds,
      initialState,
    });

    const moduleLabel = MODULE_LABELS[moduleKey] || moduleKey;
    win.setTitle(`${moduleLabel} - EVA Studio 2026`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-module-dock-zone", (event, rect) => {
  const context = getWindowContextFromSender(event.sender);
  if (!context?.win || context.isDetachedModule) return { success: false };

  if (!rect) {
    moduleDockZones.delete(context.workspaceWindowId);
    return { success: true };
  }

  moduleDockZones.set(context.workspaceWindowId, {
    left: Number(rect.left || 0),
    top: Number(rect.top || 0),
    right: Number(rect.right || 0),
    bottom: Number(rect.bottom || 0),
  });

  return { success: true };
});

ipcMain.handle("dock-detached-module", (event, payload) => {
  const context = getWindowContextFromSender(event.sender);
  if (!context?.win || !context.isDetachedModule) {
    return { success: false, docked: false };
  }

  const moduleKey = String(payload?.moduleKey || context.detachedModuleKey || "code");
  const point = payload?.point || {};
  const force = Boolean(payload?.force);
  const zone = moduleDockZones.get(context.parentWorkspaceWindowId);
  const parent = findWindowByWorkspaceId(context.parentWorkspaceWindowId);

  const parentBounds = parent?.getBounds?.();
  const dockZone =
    zone && parentBounds
      ? {
          left: parentBounds.x + zone.left,
          top: parentBounds.y + zone.top,
          right: parentBounds.x + zone.right,
          bottom: parentBounds.y + zone.bottom,
        }
      : null;

  if (!parent) {
    return { success: true, docked: false };
  }

  if (
    !force &&
    (!dockZone ||
      point.x < dockZone.left ||
      point.x > dockZone.right ||
      point.y < dockZone.top ||
      point.y > dockZone.bottom)
  ) {
    return { success: true, docked: false };
  }

  safeSend(parent, "detached-module-docked", {
    moduleKey,
    state: context.lastState ?? null,
  });

  const storedContext = windowContexts.get(context.win.id);
  if (storedContext) {
    storedContext.suppressDockOnClose = true;
  }

  context.win.close();
  return { success: true, docked: true };
});

ipcMain.handle("request-parent-navigation", (event, payload) => {
  const context = getWindowContextFromSender(event.sender);
  if (!context?.win || !context.isDetachedModule) {
    return { success: false };
  }

  const parent = findWindowByWorkspaceId(context.parentWorkspaceWindowId);
  if (!parent || parent.isDestroyed() || parent.webContents?.isDestroyed?.()) {
    return { success: false };
  }

  safeSend(parent, "detached-module-navigation", {
    moduleKey: context.detachedModuleKey,
    action: payload?.action || null,
    payload: payload?.payload ?? null,
  });

  return { success: true };
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

function copyScreenResourceBetweenFolders({
  sourceFolderPath,
  sourcePath,
  destFolderPath,
  destDir,
}) {
  const sourceRoot = path.resolve(sourceFolderPath);
  const destRoot = path.resolve(destFolderPath);
  const sourceAbs = resolveScreenResource(sourceRoot, sourcePath);
  const baseName = path.basename(sourceAbs);
  const destParent = resolveScreenResource(destRoot, destDir || "");
  if (!fs.statSync(destParent).isDirectory()) {
    throw new Error("La carpeta de destino no existe.");
  }

  const stat = fs.statSync(sourceAbs);
  if (
    stat.isDirectory() &&
    (destParent === sourceAbs || destParent.startsWith(`${sourceAbs}${path.sep}`))
  ) {
    throw new Error("No se puede copiar una carpeta dentro de si misma.");
  }

  let targetName = baseName;
  let targetAbs = path.join(destParent, targetName);
  let counter = 1;
  while (fs.existsSync(targetAbs)) {
    const ext = path.extname(baseName);
    const stem = ext ? baseName.slice(0, -ext.length) : baseName;
    targetName = `${stem} - copia${counter > 1 ? ` ${counter}` : ""}${ext}`;
    targetAbs = path.join(destParent, targetName);
    counter++;
  }

  if (stat.isDirectory()) {
    fs.cpSync(sourceAbs, targetAbs, { recursive: true });
  } else {
    fs.copyFileSync(sourceAbs, targetAbs);
  }

  return {
    success: true,
    path: path.relative(destRoot, targetAbs).replace(/\\/g, "/"),
  };
}

ipcMain.handle("copy-screen-resource", async (_, { folderPath, sourcePath, destDir }) => {
  try {
    return copyScreenResourceBetweenFolders({
      sourceFolderPath: folderPath,
      sourcePath,
      destFolderPath: folderPath,
      destDir,
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("copy-screen-resource-between-folders", async (_, payload) => {
  try {
    return copyScreenResourceBetweenFolders(payload);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("paste-external-files", async (_, { folderPath, destDir, filePaths }) => {
  try {
    const destParent = resolveScreenResource(folderPath, destDir || "");
    let copied = 0;

    for (const src of filePaths) {
      const srcAbs = path.resolve(src);
      if (!fs.existsSync(srcAbs)) continue;

      const baseName = path.basename(srcAbs);
      let targetName = baseName;
      let targetAbs = path.join(destParent, targetName);
      let counter = 1;
      while (fs.existsSync(targetAbs)) {
        const ext = path.extname(baseName);
        const stem = ext ? baseName.slice(0, -ext.length) : baseName;
        targetName = `${stem} - copia${counter > 1 ? ` ${counter}` : ""}${ext}`;
        targetAbs = path.join(destParent, targetName);
        counter++;
      }

      const stat = fs.statSync(srcAbs);
      if (stat.isDirectory()) {
        fs.cpSync(srcAbs, targetAbs, { recursive: true });
      } else {
        fs.copyFileSync(srcAbs, targetAbs);
      }
      copied++;
    }

    return { success: true, copied };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("read-clipboard-files", async () => {
  try {
    const buf = clipboard.readBuffer("FileNameW");
    if (!buf || buf.length < 4) return { success: true, files: [] };

    const files = [];
    let start = 0;
    for (let i = 0; i < buf.length - 1; i += 2) {
      if (buf[i] === 0 && buf[i + 1] === 0) {
        if (i > start) {
          const str = buf.slice(start, i).toString("utf16le");
          if (str) files.push(str);
        }
        start = i + 2;
        if (start < buf.length - 1 && buf[start] === 0 && buf[start + 1] === 0) break;
      }
    }

    return { success: true, files };
  } catch (error) {
    return { success: false, files: [], error: error.message };
  }
});

ipcMain.handle("trash-screen-resource", async (_, { folderPath, relativePath }) => {
  try {
    const filePath = resolveScreenResource(folderPath, relativePath);
    await shell.trashItem(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-devtools", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.webContents.openDevTools({ mode: "detach" });
  return { success: true };
});

ipcMain.handle("clear-all-sessions", () => {
  clearStoredWorkspace();
  return { success: true };
});

ipcMain.handle("get-app-update-status", () => {
  updateLog("IPC get-app-update-status llamado");
  return getAppUpdateStatus();
});

ipcMain.handle("set-app-update-channel", (_event, manifestUrl) => {
  updateLog(`IPC set-app-update-channel: manifestUrl="${manifestUrl}"`);
  const value = normalizeUpdateChannel(manifestUrl);
  updateLog(`IPC set-app-update-channel: normalizado="${value}"`);

  if (value && !isNetworkSharePath(value) && !isHttpsUrl(value)) {
    updateLog(`IPC set-app-update-channel: ERROR no es HTTPS ni ruta de red`);
    return { ok: false, message: "Indica una URL HTTPS o una ruta compartida que inicie con \\\\." };
  }

  try {
    const configPath = path.join(app.getPath("userData"), UPDATE_CONFIG_FILE);
    updateLog(`IPC set-app-update-channel: guardando en ${configPath}`);
    writeJsonFile(configPath, { manifestUrl: value });
    updateLog("IPC set-app-update-channel: guardado OK");
    return { ok: true, ...getAppUpdateStatus(), message: value ? "Canal de actualización guardado." : "Canal de actualización eliminado." };
  } catch (error) {
    updateLog(`IPC set-app-update-channel: ERROR ${error.message}`);
    return { ok: false, message: error.message || "No se pudo guardar el canal de actualización." };
  }
});

ipcMain.handle("check-app-update", async (event) => {
  updateLog("IPC check-app-update: INICIO");
  pendingUpdates.delete(event.sender.id);
  try {
    const result = await fetchUpdateManifest();
    updateLog(`IPC check-app-update: resultado ok=${result.ok} available=${result.available} code=${result.code || "N/A"}`);
    if (result.available) {
      pendingUpdates.set(event.sender.id, result.manifest);
      updateLog(`IPC check-app-update: manifest guardado para senderId=${event.sender.id}`);
    }
    return result;
  } catch (error) {
    updateLog(`IPC check-app-update: ERROR ${error.message}`);
    return { ok: false, code: "check-failed", currentVersion: app.getVersion(), message: error.message };
  }
});

ipcMain.handle("install-app-update", async (event) => {
  updateLog("IPC install-app-update: INICIO");
  const manifest = pendingUpdates.get(event.sender.id);
  if (!manifest) {
    updateLog("IPC install-app-update: ERROR no hay manifest pendiente");
    return { ok: false, message: "Primero busca una actualización disponible." };
  }

  updateLog(`IPC install-app-update: manifest version=${manifest.version} url=${manifest.url}`);
  updateLog(`IPC install-app-update: isPackaged=${app.isPackaged} execPath=${process.execPath}`);

  try {
    const installRoot = path.dirname(process.execPath);
    const executableName = path.basename(process.execPath);
    updateLog(`IPC install-app-update: installRoot="${installRoot}" exe="${executableName}"`);

    fs.accessSync(path.dirname(installRoot), fs.constants.W_OK);
    updateLog("IPC install-app-update: permisos de escritura OK");

    const stagePath = await downloadPortableUpdate(manifest);
    updateLog(`IPC install-app-update: stagePath="${stagePath}"`);

    const payloadPath = findPortablePayload(stagePath, executableName);
    updateLog(`IPC install-app-update: payloadPath="${payloadPath}"`);
    if (!payloadPath) {
      updateLog(`IPC install-app-update: ERROR ZIP no contiene ${executableName}`);
      throw new Error(`El ZIP no contiene ${executableName}.`);
    }

    pendingUpdates.delete(event.sender.id);
    updateLog("IPC install-app-update: lanzando reemplazo portable...");
    launchPortableReplacement(installRoot, payloadPath, executableName);
    setTimeout(() => app.quit(), 300);
    return { ok: true, message: "Actualización preparada. EVA Studio se reiniciará en unos segundos." };
  } catch (error) {
    updateLog(`IPC install-app-update: ERROR ${error.message}`);
    return { ok: false, message: error.message };
  }
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
        if (targetWindow.isMaximized()) {
          const workArea = screen.getDisplayMatching(targetWindow.getBounds()).workArea;
          const width = Math.min(workArea.width, Math.max(820, Math.round(workArea.width * 0.7)));
          const height = Math.min(workArea.height, Math.max(560, Math.round(workArea.height * 0.7)));
          targetWindow.unmaximize();
          targetWindow.setBounds({
            width,
            height,
            x: Math.round(workArea.x + (workArea.width - width) / 2),
            y: Math.round(workArea.y + (workArea.height - height) / 2),
          });
        } else {
          targetWindow.maximize();
        }
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
