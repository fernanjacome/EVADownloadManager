import React, { useEffect, useMemo, useRef, useState } from "react";
import "./compiler.css";
import { PiPaintBrushHouseholdBold } from "react-icons/pi";
import {
  FaBolt,
  FaGear,
  FaLink,
  FaList,
  FaPlay,
  FaRotateRight,
  FaServer,
  FaTerminal,
} from "react-icons/fa6";
import { MdCancel } from "react-icons/md";
import Spinner from "../utils/Spinner";
import { FaArrowCircleDown } from "react-icons/fa";

const COMMANDS = [
  {
    cmd: 3,
    label: "Recargar configuracion",
    hint: "Carga el nuevo download en el cajero",
  },
  { cmd: 8, label: "En servicio", hint: "Deja el ATM operativo" },
  { cmd: 2, label: "Fuera de servicio", hint: "Retira el ATM de operacion" },
  { cmd: 9, label: "Deshabilitar", hint: "Deshabilita el ATM" },
  { cmd: 4, label: "Cambiar llave", hint: "Solicita cambio de llave" },
  { cmd: 11, label: "Desconectar", hint: "Cierra la sesion del ATM" },
  { cmd: 21, label: "Reiniciar", hint: "Reinicia el cajero" },
];

const loadCfg = (key, def) =>
  localStorage.getItem(key) !== null ? localStorage.getItem(key) : def;

const saveCfg = (key, value) => localStorage.setItem(key, value);

const cleanServiceIp = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return new URL(text).hostname.trim();
  } catch {
    return text
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
  }
};

const defaultServiceIp = () => {
  const savedIp = cleanServiceIp(loadCfg("compiler_service_ip", ""));
  if (savedIp) return savedIp;

  const savedUrl = cleanServiceIp(loadCfg("compiler_service_url", ""));
  if (savedUrl) return savedUrl;

  return cleanServiceIp(loadCfg("compiler_server", "192.168.10.241"));
};

const cleanPort = (value) => {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) ? text : "5007";
};

const defaultServicePort = () =>
  cleanPort(loadCfg("compiler_service_port", loadCfg("compiler_port", "5007")));

const buildServiceUrl = (ip, port) =>
  `https://${cleanServiceIp(ip) || "192.168.10.241"}:${cleanPort(port)}`;

const buildEchelonUrl = (ip) =>
  `https://${cleanServiceIp(ip) || "192.168.10.241"}:9433`;

const normalizeUrl = (value, fallback) => {
  const text = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  return text || fallback;
};

const toWsUrl = (url) =>
  `${normalizeUrl(url, "https://192.168.10.241:5007")
    .replace(/^https:/i, "wss:")
    .replace(/^http:/i, "ws:")}/ws`;

const normalizeBatName = (name) => {
  if (!name) return "";
  return name.trim().replace(/\s+/g, "_");
};

const extractImageName = (desc) => {
  if (!desc) return "";
  return desc.replace(/^.*?Imagen\s+\d+\s+/i, "").trim();
};

const getAtmId = (atm) =>
  atm?.atmId || atm?.AtmId || atm?.id || atm?.ID || atm?.ATMCajero || "";
const getAtmConfId = (atm) => atm?.atmConfID ?? atm?.ATMConfID ?? "";
const getAtmDescription = (atm) => atm?.description || atm?.Description || "";
const getAtmIp = (atm) => atm?.ip || atm?.Ip || "";
const getAtmEnabled = (atm) => Boolean(atm?.enabled ?? atm?.Enabled);
const getAtmState = (atm) => atm?.state ?? atm?.State ?? "";

const normalizeAtmItems = (data) => {
  const source =
    Array.isArray(data?.items) && data.items.length
      ? data.items
      : Array.isArray(data?.raw?.Data)
        ? data.raw.Data
        : Array.isArray(data?.Data)
          ? data.Data
          : [];

  return source
    .map((atm) => ({
      ...atm,
      atmId: String(getAtmId(atm)).trim(),
      ip: String(getAtmIp(atm)).trim(),
      description: String(getAtmDescription(atm)).trim(),
      atmConfID: getAtmConfId(atm),
      enabled: getAtmEnabled(atm),
      state: getAtmState(atm),
    }))
    .filter((atm) => atm.atmId);
};

function ConsoleLine({ line }) {
  const item =
    typeof line === "string"
      ? { type: "output", time: "", source: "APP", message: line }
      : {
          type: line.type || "output",
          time: line.time || "",
          source: line.source || "APP",
          message: line.message || line.msg || "",
        };

  return (
    <div className={`console-line ${item.type}`}>
      <span className="console-time">{item.time}</span>
      <span className="console-source">{item.source}</span>
      <span className="console-message">{item.message}</span>
    </div>
  );
}

function ImagenList({ items, onSelect, selectedId, loading }) {
  if (loading) {
    return (
      <div className="compiler-loading-block">
        <div className="img-loading">Cargando imagenes...</div>
        <Spinner />
      </div>
    );
  }

  if (!items.length) {
    return <div className="img-empty">No hay imagenes disponibles</div>;
  }

  return (
    <div className="img-list">
      <div className="img-item header">
        <div className="img-id">Id</div>
        <div className="img-desc">Descripcion</div>
      </div>
      {items.map((img) => (
        <button
          type="button"
          key={img.atmConfID}
          className={`img-item ${String(selectedId) === String(img.atmConfID) ? "selected" : ""}`}
          onClick={() => onSelect(img)}
        >
          <div className="img-id">#{img.atmConfID}</div>
          <div className="img-desc">{img.confDescription}</div>
        </button>
      ))}
    </div>
  );
}

export default function CompilerForm({
  xmlCode,
  notify,
  hasXml,
  xmlName,
  title,
  dirty,
  onSaveXml,
  compilerState,
  setCompilerState,
}) {
  const [serviceIp, setServiceIp] = useState(defaultServiceIp);
  const [servicePort, setServicePort] = useState(defaultServicePort);
  const [statusWS, setStatusWS] = useState("disconnected");
  const [imagenes, setImagenes] = useState([]);
  const [loadingImagenes, setLoadingImagenes] = useState(false);
  const [atms, setAtms] = useState([]);
  const [loadingAtms, setLoadingAtms] = useState(false);
  const [atmSearch, setAtmSearch] = useState("");
  const [commandCmd, setCommandCmd] = useState(
    Number(loadCfg("compiler_command_cmd", "3")),
  );
  const [busyAction, setBusyAction] = useState("");
  const [abortCtrl, setAbortCtrl] = useState(null);

  const wsRef = useRef(null);
  const consoleRef = useRef(null);
  const baseUrl = buildServiceUrl(serviceIp, servicePort);

  const {
    batName = xmlName,
    imageName = xmlName,
    imageId = "",
    consoleLines = [],
    selectedAtms = [],
  } = compilerState || {};

  const setBatName = (value) =>
    setCompilerState((state) => ({ ...state, batName: value }));
  const setImageName = (value) =>
    setCompilerState((state) => ({ ...state, imageName: value }));
  const setImageId = (value) =>
    setCompilerState((state) => ({ ...state, imageId: value }));
  const setSelectedAtms = (value) =>
    setCompilerState((state) => ({ ...state, selectedAtms: value }));
  const setConsoleLines = (updater) =>
    setCompilerState((state) => {
      const current = state.consoleLines || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...state, consoleLines: next.slice(-800) };
    });

  const ts = () => new Date().toLocaleTimeString();
  const log = (type, message, source = "APP") => {
    setConsoleLines((prev) => [...prev, { type, time: ts(), source, message }]);
  };
  const clearConsole = () => setConsoleLines([]);

  const selectedCommand =
    COMMANDS.find((item) => item.cmd === Number(commandCmd)) || COMMANDS[0];
  const selectedAtmSet = useMemo(() => new Set(selectedAtms), [selectedAtms]);
  const filteredAtms = useMemo(() => {
    const query = atmSearch.trim().toLowerCase();
    if (!query) return atms;
    return atms.filter((atm) =>
      [getAtmId(atm), getAtmDescription(atm), getAtmIp(atm), getAtmConfId(atm)]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [atms, atmSearch]);

  useEffect(
    () => saveCfg("compiler_service_ip", cleanServiceIp(serviceIp)),
    [serviceIp],
  );
  useEffect(
    () => saveCfg("compiler_service_port", cleanPort(servicePort)),
    [servicePort],
  );
  useEffect(
    () => saveCfg("compiler_command_cmd", String(commandCmd)),
    [commandCmd],
  );

  useEffect(() => {
    setBatName(title);
    setImageName(title);
  }, [title]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (statusWS !== "connected") return;
    getImagenes();
    getAtms();
  }, [statusWS]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLines]);

  const connectWS = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = toWsUrl(baseUrl);

    setStatusWS("connecting");
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send("FRONTEND_COMPILER");
        setStatusWS("connected");
        log("info", `WebSocket conectado a ${wsUrl}`, "WS");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          const text = data?.Payload?.text ?? data?.payload?.text ?? msg.data;
          const type = String(data?.Type || data?.type || "OUT").toLowerCase();
          log(
            type === "err" ? "error" : "output",
            String(text),
            data?.From || "COMPILER",
          );
        } catch {
          log("output", msg.data, "COMPILER");
        }
      };

      ws.onerror = () => {
        setStatusWS("disconnected");
        log("error", "No se pudo conectar al WebSocket del compilador.", "WS");
      };

      ws.onclose = () => {
        setStatusWS("disconnected");
        log("info", "WebSocket cerrado.", "WS");
      };
    } catch (error) {
      setStatusWS("disconnected");
      log("error", error.message || "Error abriendo WebSocket.", "WS");
    }
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || text || `HTTP ${response.status}`,
      );
    }
    return data;
  };

  const getImagenes = async () => {
    try {
      setLoadingImagenes(true);
      const data = await requestJson(`${baseUrl}/api/eva-image/configs`);
      setImagenes(Array.isArray(data) ? data : []);
      log(
        "info",
        `Imagenes cargadas: ${Array.isArray(data) ? data.length : 0}`,
      );
    } catch (error) {
      notify?.("error", "No se pudo cargar la lista de imagenes");
      setImagenes([]);
      log("error", error.message, "API");
    } finally {
      setLoadingImagenes(false);
    }
  };

  const getAtms = async () => {
    try {
      setLoadingAtms(true);
      const params = new URLSearchParams({
        apiBaseUrl: buildEchelonUrl(serviceIp),
      });
      const data = await requestJson(
        `${baseUrl}/api/atm-config/atms?${params}`,
      );
      const items = normalizeAtmItems(data);
      setAtms(items);
      log("info", `Cajeros cargados: ${items.length}`, "ATM");
    } catch (error) {
      notify?.("error", "No se pudo cargar la lista de cajeros");
      setAtms([]);
      log("error", error.message, "ATM");
    } finally {
      setLoadingAtms(false);
    }
  };

  const handleCompile = async () => {
    if (!hasXml) {
      notify?.(
        "warning",
        "Debes cargar un XML en el editor antes de compilar.",
      );
      return;
    }
    if (!xmlCode || !xmlCode.trim()) {
      notify?.("error", "El contenido XML esta vacio o no es valido.");
      return;
    }
    if (!batName || !imageName || !imageId) {
      notify?.("error", "Completa ConfID y BAT antes de compilar.");
      return;
    }

    setBusyAction("compile");
    const controller = new AbortController();
    setAbortCtrl(controller);
    try {
      if (dirty) {
        log("info", "Guardando XML antes de compilar...");
        await onSaveXml();
      }

      const finalBatName = normalizeBatName(batName);
      log(
        "info",
        `Compilando ${finalBatName}.bat con ConfID ${imageId}`,
        "BUILD",
      );

      const data = await requestJson(`${baseUrl}/api/compiler/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          BatName: finalBatName,
          ImageName: finalBatName,
          ImageId: Number(imageId),
          XmlContent: xmlCode,
        }),
      });

      log("info", data?.message || "Compilacion finalizada.", "BUILD");
      notify?.("success", "Compilacion finalizada.");
      getImagenes();
    } catch (error) {
      if (error.name === "AbortError") {
        log("error", "Compilacion cancelada por el usuario.", "BUILD");
      } else {
        log(
          "error",
          error.message || "Error de conexion con el servidor.",
          "BUILD",
        );
        notify?.("error", "No se pudo completar la compilacion.");
      }
    } finally {
      setBusyAction("");
      setAbortCtrl(null);
    }
  };

  const handleCancelCompile = () => {
    abortCtrl?.abort();
    setBusyAction("");
    setAbortCtrl(null);
  };

  const assignConfig = async () => {
    if (!imageId) {
      notify?.("warning", "Selecciona un ConfID antes de asociar cajeros.");
      return false;
    }
    if (!selectedAtms.length) {
      notify?.("warning", "Selecciona al menos un cajero.");
      return false;
    }

    setBusyAction("assign");
    try {
      for (const atmId of selectedAtms) {
        await requestJson(`${baseUrl}/api/atm-config/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atmId, confId: Number(imageId) }),
        });
        log("info", `${atmId} asociado a ConfID ${imageId}`, "ATM");
      }
      notify?.("success", "Configuracion asociada.");
      await getAtms();
      return true;
    } catch (error) {
      log("error", error.message, "ATM");
      notify?.("error", "No se pudo asociar la configuracion.");
      return false;
    } finally {
      setBusyAction("");
    }
  };

  const sendCommand = async (cmd = commandCmd) => {
    if (!selectedAtms.length) {
      notify?.("warning", "Selecciona al menos un cajero.");
      return false;
    }

    setBusyAction("command");
    try {
      const data = await requestJson(`${baseUrl}/api/atm-config/send-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          atmIds: selectedAtms,
          cmd: Number(cmd),
          devName: "ATM",
          apiBaseUrl: buildEchelonUrl(serviceIp),
        }),
      });

      log(
        "info",
        `Comando ${cmd} enviado a ${selectedAtms.join(", ")} via ${data?.source || "EVAAPI"}`,
        "ATM",
      );
      notify?.("success", "Comando enviado.");
      return true;
    } catch (error) {
      log("error", error.message, "ATM");
      notify?.("error", "No se pudo enviar el comando.");
      return false;
    } finally {
      setBusyAction("");
    }
  };

  const assignAndReload = async () => {
    const assigned = await assignConfig();
    if (assigned) await sendCommand(3);
  };

  const toggleAtm = (atmId) => {
    const next = selectedAtmSet.has(atmId)
      ? selectedAtms.filter((item) => item !== atmId)
      : [...selectedAtms, atmId];
    setSelectedAtms(next);
  };

  const selectedImage = imagenes.find(
    (img) => String(img.atmConfID) === String(imageId),
  );
  const selectImage = (nextImageId) => {
    const img = imagenes.find(
      (item) => String(item.atmConfID) === String(nextImageId),
    );
    setImageId(nextImageId);
    if (!img) return;

    const cleanName = extractImageName(img.confDescription);
    const batSafeName = normalizeBatName(cleanName);
    setBatName(batSafeName);
    setImageName(batSafeName);
    log(
      "info",
      `Imagen seleccionada: #${img.atmConfID} ${batSafeName}`,
      "BUILD",
    );
  };

  if (statusWS !== "connected") {
    return (
      <div className="compiler-gate">
        <div className="compiler-card compiler-gate-card">
          <div className="form-title">
            <FaServer />
            <h3>Conectar Extreme Server</h3>
          </div>
          <div className="compiler-gate-body">
            <div className="input-group service-ip">
              <label>IP del servicio</label>
              <input
                value={serviceIp}
                onChange={(event) => setServiceIp(event.target.value)}
                placeholder="192.168.10.241"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && statusWS === "disconnected")
                    connectWS();
                }}
              />
            </div>
            <div className="input-group service-port">
              <label>Puerto</label>
              <input
                value={servicePort}
                onChange={(event) => setServicePort(event.target.value)}
                placeholder="5007"
                inputMode="numeric"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && statusWS === "disconnected")
                    connectWS();
                }}
              />
            </div>
            <button
              className={`compile-btn compiler-gate-connect ${statusWS === "connecting" ? "is-waiting" : ""}`}
              onClick={() => {
                if (statusWS === "connecting") {
                  wsRef.current?.close();
                  wsRef.current = null;
                  setStatusWS("disconnected");
                  return;
                }
                connectWS();
              }}
            >
              {statusWS === "connecting" ? <MdCancel /> : <FaLink />}
              {statusWS === "connecting" ? "Cancelar" : "Conectar"}
            </button>
          </div>
          <div className="compiler-gate-foot">
            <span>{baseUrl}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="compiler-layout">
      <section className="compiler-workspace">
        <div className="compiler-card compiler-flow-card">
          <div className="compiler-panel-head flow-head">
            <div>
              <h3>
                <FaGear />
                Compilador
              </h3>
            </div>
          </div>

          <div className="flow-setup">
            <div className="input-group image-select">
              <label>Download</label>
              <select
                value={imageId}
                onChange={(event) => selectImage(event.target.value)}
              >
                <option value="">Selecciona un download</option>
                {imagenes.map((img) => (
                  <option key={img.atmConfID} value={img.atmConfID}>
                    #{img.atmConfID} - {img.confDescription}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="compile-btn secondary compact"
              onClick={getImagenes}
              disabled={loadingImagenes}
            >
              <FaRotateRight /> {loadingImagenes ? "Cargando..." : "Obtener"}
            </button>
            <div className="input-group id">
              <label>ConfID</label>
              <input
                type="number"
                value={imageId}
                onChange={(event) => setImageId(event.target.value)}
              />
            </div>
            <div className="input-group bat">
              <label>Nombre</label>
              <input
                value={batName}
                onChange={(event) => {
                  const value = normalizeBatName(event.target.value);
                  setBatName(value);
                  setImageName(value);
                }}
              />
              <span>.bat</span>
            </div>
            <button
              className="compile-btn secondary"
              onClick={handleCancelCompile}
              disabled={busyAction !== "compile"}
            >
              <MdCancel /> Cancelar
            </button>
            <button
              className="compile-btn"
              onClick={handleCompile}
              disabled={busyAction === "compile" || !hasXml}
            >
              <FaPlay />
              {busyAction === "compile" ? "Compilando..." : "Compilar"}
            </button>
          </div>

          <div className="atm-toolbar">
            <div className="input-group atm-search">
              <label>Buscar cajero</label>
              <input
                value={atmSearch}
                onChange={(event) => setAtmSearch(event.target.value)}
                placeholder="Buscar por ID o IP"
              />
            </div>
            <span className="atm-count" aria-live="polite">
              {loadingAtms ? "Cargando..." : `${filteredAtms.length} cajeros`}
            </span>
            <button
              className="compile-btn secondary"
              onClick={() => {
                const visibleIds = filteredAtms
                  .map((atm) => getAtmId(atm))
                  .filter(Boolean);
                const allVisibleSelected =
                  visibleIds.length > 0 &&
                  visibleIds.every((atmId) => selectedAtmSet.has(atmId));
                setSelectedAtms(allVisibleSelected ? [] : visibleIds);
              }}
              disabled={!filteredAtms.length}
            >
              {filteredAtms.length > 0 &&
              filteredAtms.every((atm) => selectedAtmSet.has(getAtmId(atm)))
                ? "Limpiar"
                : "Seleccionar visibles"}
            </button>
            <button
              className="compile-btn secondary"
              onClick={getAtms}
              disabled={loadingAtms}
              title="Actualizar cajeros"
            >
              <FaRotateRight />
              {loadingAtms ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div className="atm-table">
            <div className="atm-table-head">
              <span></span>
              <span>ID</span>
              <span>IP</span>
              <span>Descripcion</span>
              <span>ConfID</span>
            </div>
            {loadingAtms ? (
              <div className="compiler-loading-block">
                <span>Cargando cajeros...</span>
                <Spinner />
              </div>
            ) : filteredAtms.length ? (
              filteredAtms.map((atm) => {
                const atmId = getAtmId(atm);
                const checked = selectedAtmSet.has(atmId);
                return (
                  <button
                    type="button"
                    key={atmId}
                    className={`atm-row ${checked ? "selected" : ""}`}
                    onClick={() => toggleAtm(atmId)}
                  >
                    <span className="atm-check"></span>
                    <strong className="atm-id">{atmId}</strong>
                    <span className="atm-ip">{getAtmIp(atm) || "-"}</span>
                    <span className="atm-desc">
                      {getAtmDescription(atm) || "Sin descripcion"}
                    </span>
                    <span className="atm-conf">{getAtmConfId(atm) || "-"}</span>
                  </button>
                );
              })
            ) : (
              <div className="img-empty">
                No se encontraron cajeros para este servicio.
              </div>
            )}
          </div>

          <div className="atm-actions">
            <div className="input-group command-select">
              <label>Comando</label>
              <select
                value={commandCmd}
                onChange={(event) => setCommandCmd(Number(event.target.value))}
              >
                {COMMANDS.map((item) => (
                  <option key={item.cmd} value={item.cmd}>
                    {item.cmd} - {item.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="compile-btn secondary"
              onClick={assignConfig}
              disabled={!selectedAtms.length || !imageId || Boolean(busyAction)}
            >
              Asociar ConfID
            </button>
            <button
              className="compile-btn secondary"
              onClick={() => sendCommand(commandCmd)}
              disabled={!selectedAtms.length || Boolean(busyAction)}
            >
              Enviar comando
            </button>
            <button
              className="compile-btn primary-action"
              onClick={assignAndReload}
              disabled={!selectedAtms.length || !imageId || Boolean(busyAction)}
            >
              Asociar y recargar
            </button>
          </div>
        </div>
      </section>

      <aside className="compiler-console">
        <div className="console-header">
          <div>
            <h3>
              <FaTerminal /> Consola
            </h3>
            <span>{baseUrl}</span>
          </div>
          <button
            className="console-disconnect"
            title="Desconectar StudioService"
            onClick={() => {
              wsRef.current?.close();
              wsRef.current = null;
              setStatusWS("disconnected");
              log("info", "StudioService desconectado manualmente.", "WS");
            }}
          >
            <MdCancel />
          </button>
        </div>

        <div className="console-output" ref={consoleRef}>
          {consoleLines.length ? (
            consoleLines.map((line, index) => (
              <ConsoleLine key={index} line={line} />
            ))
          ) : (
            <div className="console-empty">
              <FaServer />
              <span>
                La salida de compilacion, asociacion y comandos aparecera aqui.
              </span>
            </div>
          )}
        </div>

        <button
          className="compile-btn clear-btn"
          title="Limpiar consola"
          onClick={clearConsole}
        >
          <PiPaintBrushHouseholdBold />
        </button>
      </aside>
    </div>
  );
}
