import React, { useState, useEffect, useRef } from "react";
import "./compiler.css";
import { PiPaintBrushHouseholdBold } from "react-icons/pi";
import { FaGear } from "react-icons/fa6";
import { GrPowerReset } from "react-icons/gr";

export default function CompilerForm({
  xmlCode,
  notify,
  xmlName,
  title,
  dirty,
  onSaveXml,
  compilerState,
  setCompilerState, // ✅ FALTABA
}) {
  // -----------------------------
  // 🔧 Configuración persistente
  // -----------------------------
  const loadCfg = (key, def) =>
    localStorage.getItem(key) !== null ? localStorage.getItem(key) : def;

  const saveCfg = (key, value) => localStorage.setItem(key, value);

  const [server, setServer] = useState(
    loadCfg("compiler_server", "192.168.10.241")
  );
  const [port, setPort] = useState(loadCfg("compiler_port", "5007"));
  const [tls, setTLS] = useState(loadCfg("compiler_tls", "https"));
  const [statusWS, setStatusWS] = useState("connecting");

  const retryTimerRef = useRef(null);
  const wsRef = useRef(null);

  const connectWS = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = tls === "https" ? "wss" : "ws";
    const wsUrl = `${protocol}://${server}:${port}/ws`;

    setStatusWS("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send("FRONTEND_COMPILER");
      setStatusWS("connected");
    };

    ws.onmessage = (msg) => {
      let data;

      try {
        data = JSON.parse(msg.data);
      } catch {
        log("output", msg.data);
        return;
      }

      const type = data.Type || data.type || "output";
      const text = data.Payload?.text || data.payload?.text || "";

      if (!text.trim()) return;

      log(type.toLowerCase(), text);
    };

    // ws.onerror = () => {
    //   setStatusWS("disconnected");
    //   log("error", "[WebSocket error]");
    // };

    ws.onclose = () => {
      setStatusWS("disconnected");
      log("error", "[WebSocket cerrado]");
    };
  };

  useEffect(() => {
    connectWS();

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [server, port, tls]);

  const retryConnection = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    connectWS();
  };

  useEffect(() => saveCfg("compiler_server", server), [server]);
  useEffect(() => saveCfg("compiler_port", port), [port]);
  useEffect(() => saveCfg("compiler_tls", tls), [tls]);

  const baseUrl = `${tls}://${server}:${port}`;
  useEffect(() => {
    setBatName(title);
    setImageName(title);
  }, [title]);

  const {
    batName = xmlName,
    imageName = xmlName,
    imageId = "",
    consoleLines = [],
  } = compilerState || {};

  const setBatName = (v) => setCompilerState((s) => ({ ...s, batName: v }));

  const setImageName = (v) => setCompilerState((s) => ({ ...s, imageName: v }));

  const setImageId = (v) => setCompilerState((s) => ({ ...s, imageId: v }));

  const setConsoleLines = (updater) =>
    setCompilerState((s) => ({
      ...s,
      consoleLines:
        typeof updater === "function" ? updater(s.consoleLines || []) : updater,
    }));

  // -----------------------------
  // Control de ejecución
  // -----------------------------
  const [loading, setLoading] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState(null);
  const consoleRef = useRef(null);
  const ts = () => new Date().toLocaleTimeString();

  const log = (type, msg) => {
    const line = `${ts()} - ${msg}`;
    setConsoleLines((prev) => [...prev, { type, msg: line }]);
  };

  const clearConsole = () => setConsoleLines([]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLines]);

  // -----------------------------
  // 🔥 COMPILACIÓN
  // -----------------------------
  const handleCompile = async () => {
    if (!batName || !imageName || !imageId) {
      notify("error", "Completa todos los campos.");
      return;
    }

    if (dirty) {
      log("info", "Guardando cambios antes de compilar...");
      await onSaveXml();
      log("info", "XML guardado.");
    }

    const controller = new AbortController();
    setAbortCtrl(controller);
    setLoading(true);

    log("info", "Iniciando compilación...");
    log("info", `BatName = ${batName}`);
    log("info", `ImageName = ${imageName}`);
    log("info", `ImageId = ${imageId}`);
    log("info", `Servidor → ${baseUrl}`);
    log("info", "Enviando petición al servidor...");

    try {
      const body = {
        BatName: batName,
        ImageName: imageName,
        ImageId: imageId,
        XmlContent: xmlCode,
      };

      const resp = await fetch(`${baseUrl}/api/compiler/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      log("info", `HTTP Status = ${resp.status}`);

      if (!resp.ok) {
        const err = await resp.text();
        log("error", err);
        notify("error", err);
      }

      // ✅ YA NO SE LEE output NI error AQUÍ
      // TODO se recibe por WebSocket
    } catch (err) {
      if (err.name === "AbortError") {
        log("error", "Proceso abortado.");
      } else {
        log("error", "Error de conexión con el servidor.");
      }
    }

    setLoading(false);
    setAbortCtrl(null);
  };

  const handleCancel = () => {
    if (abortCtrl) {
      abortCtrl.abort();
      log("error", "Compilación cancelada por el usuario.");
    }
    setLoading(false);
    setAbortCtrl(null);
  };

  return (
    <div className="compiler-layout">
      {/* ================= PANEL IZQUIERDO ================= */}
      <div className="compiler-form">
        <div className="form-title">
          <FaGear />
          <h3>Parametros de compilación</h3>
        </div>
        <div className="compiler-form-group">
          <div className="form-row">
            <div className="input-group tls">
              <label>TLS</label>
              <select
                value={tls}
                onChange={(e) => setTLS(e.target.value)}
                title="Utilizar HTTP o HTTPS"
              >
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </div>
            <div className="input-group server">
              <label>Servidor</label>
              <input
                value={server}
                onChange={(e) => setServer(e.target.value)}
                title="Servidor donde se ejecutara el .bat"
              />
            </div>

            <div className="input-group puerto">
              <label>Puerto</label>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                title="Puerto de el servidor donde se ejecutara el .bat"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group id">
              <label>ConfID</label>
              <input
                type="number"
                value={imageId}
                onChange={(e) => setImageId(e.target.value)}
                title="Identificador de la imagen a compilar"
              />
            </div>
            <div className="input-group bat">
              <label>BAT</label>
              <input
                value={batName}
                onChange={(e) => setBatName(e.target.value)}
                title="Nombre del .bat que se generara"
              />
              <span>.bat</span>
            </div>
          </div>
        </div>

        <div className="button-row">
          <button
            className="compile-btn cancel-btn"
            onClick={handleCancel}
            disabled={!loading}
          >
            Cancelar
          </button>
          <button
            className="compile-btn"
            onClick={handleCompile}
            disabled={loading}
          >
            {loading ? "Compilando..." : "Compilar"}
          </button>
        </div>
      </div>

      {/* ================= PANEL DERECHO ================= */}
      <div className="compiler-console">
        <div className="console-header">
          <h3>Consola</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
            {statusWS === "disconnected" && (
              <button className="retry-btn" onClick={retryConnection}>
                <GrPowerReset />
              </button>
            )}

            <p
              className={`pill ${
                statusWS === "connected"
                  ? "connected"
                  : statusWS === "connecting"
                  ? "connecting"
                  : "disconnected"
              }`}
            >
              {statusWS === "connected"
                ? "Conectado"
                : statusWS === "connecting"
                ? "Conectando..."
                : "Desconectado"}
            </p>
          </div>
        </div>

        <div className="console-output" ref={consoleRef}>
          {consoleLines.map((line, idx) => (
            <div key={idx} className={`console-line ${line.type}`}>
              {line.msg}
            </div>
          ))}
        </div>

        <button
          className="compile-btn clear-btn"
          title="Limpiar consola"
          onClick={clearConsole}
        >
          <PiPaintBrushHouseholdBold />
        </button>
      </div>
    </div>
  );
}
