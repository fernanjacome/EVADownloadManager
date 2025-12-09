import React, { useState, useEffect, useRef, use } from "react";
import "./compiler.css";
import { PiPaintBrushHouseholdBold } from "react-icons/pi";
import { FaGear } from "react-icons/fa6";

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

  useEffect(() => saveCfg("compiler_server", server), [server]);
  useEffect(() => saveCfg("compiler_port", port), [port]);

  const baseUrl = `http://${server}:${port}`;
  useEffect(() => {
    setBatName(title);
    setImageName(title);
  }, [title]);

  // -----------------------------
  // 🧠 Estado elevado (NO local)
  // -----------------------------
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

    try {
      const body = {
        BatName: batName,
        ImageName: imageName,
        ImageId: imageId,
        XmlContent: xmlCode,
      };

      log("info", "Enviando petición al servidor...");

      const resp = await fetch(`${baseUrl}/api/compiler/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      log("info", `HTTP Status = ${resp.status}`);

      const data = await resp.json();

      if (!resp.ok) {
        log("error", data.error);
        notify("error", "Error: " + data.error);
      } else {
        log("info", "Compilación finalizada en el servidor.");
      }

      log("info", "Salida del compilador:");

      if (data.output) {
        data.output.split("\n").forEach((line) => {
          const clean = line.trim();
          if (!clean) return;

          const filtered = clean.replace(/presione una tecla.*/i, "").trim();
          if (filtered) log("output", filtered);
        });
      }

      if (data.error) {
        data.error.split("\n").forEach((line) => {
          const clean = line.trim();
          if (clean) log("error", clean);
        });
      }
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

  // -----------------------------
  // UI
  // -----------------------------
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
            <div className="input-group server">
              <label>Servidor</label>
              <input
                value={server}
                onChange={(e) => setServer(e.target.value)}
              />
            </div>

            <div className="input-group puerto">
              <label>Puerto</label>
              <input value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label>BAT</label>
              <input
                value={batName}
                onChange={(e) => setBatName(e.target.value)}
              />
              <span>.bat</span>
            </div>
            <div className="input-group">
              <label>ID</label>
              <input
                type="number"
                value={imageId}
                onChange={(e) => setImageId(e.target.value)}
              />
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
        <div className="console-header">Consola</div>

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
