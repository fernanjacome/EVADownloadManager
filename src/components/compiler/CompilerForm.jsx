import React, { useState, useEffect, useRef } from "react";
import "./compiler.css";
import { PiPaintBrushHouseholdBold } from "react-icons/pi";
import { FaBug, FaGear, FaLink, FaList, FaPlay } from "react-icons/fa6";
import { GrPowerReset } from "react-icons/gr";
import { MdCancel } from "react-icons/md";
import Spinner from "../utils/Spinner";

export default function CompilerForm({
  xmlCode,
  notify,
  hasXml,
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
  const [autoConnect, setAutoConnect] = useState(false);

  const saveCfg = (key, value) => localStorage.setItem(key, value);

  const [server, setServer] = useState(
    loadCfg("compiler_server", "192.168.10.241")
  );
  const [port, setPort] = useState(loadCfg("compiler_port", "5007"));
  const [tls, setTLS] = useState(loadCfg("compiler_tls", "https"));
  const [statusWS, setStatusWS] = useState("disconnected");
  const [imagenes, setImagenes] = useState([]);
  const [loadingImagenes, setLoadingImagenes] = useState(false);

  const wsRef = useRef(null);
  const normalizeBatName = (name) => {
    if (!name) return "";
    return name.trim().replace(/\s+/g, "_");
  };

  const extractImageName = (desc) => {
    if (!desc) return "";

    // Quita: "EMV:Imagen <numero> "
    return desc.replace(/^.*?Imagen\s+\d+\s+/i, "").trim();
  };

  const connectWS = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = tls === "https" ? "wss" : "ws";
    const wsUrl = `${protocol}://${server}:${port}/ws`;

    setStatusWS("connecting");
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send("FRONTEND_COMPILER");
        setStatusWS("connected");
      };

      ws.onmessage = (msg) => {
        console.log("WS RAW:", msg.data);

        let data;
        try {
          data = JSON.parse(msg.data);
        } catch {
          log("output", msg.data);
          return;
        }

        log("output", JSON.stringify(data.Payload.text));
      };

      // ws.onerror = (e) => {
      //   setStatusWS("disconnected");
      //   log("error", e);
      //   console.log(e);
      // };

      ws.onclose = () => {
        setStatusWS("disconnected");
        log("", "[WebSocket cerrado]");
      };
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);
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
  const getImagenes = async () => {
    try {
      setLoadingImagenes(true);

      const resp = await fetch(`${baseUrl}/api/eva-image/configs`);
      if (!resp.ok) throw new Error("Error cargando imágenes");

      const data = await resp.json();
      setImagenes(data);
    } catch (e) {
      notify("error", "No se pudo cargar la lista de imágenes");
      setImagenes("");
      console.error(e);
    } finally {
      setLoadingImagenes(false);
    }
  };

  // -----------------------------
  // 🔥 COMPILACIÓN
  // -----------------------------
  const handleCompile = async () => {
    if (!hasXml) {
      notify(
        "warning",
        "Debes cargar un archivo XML en el editor antes de compilar."
      );
      return;
    }
    if (!xmlCode || !xmlCode.trim()) {
      notify("error", "El contenido XML está vacío o no es válido.");
      return;
    }
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
      const finalBatName = normalizeBatName(batName);

      const resp = await fetch(`${baseUrl}/api/compiler/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          BatName: finalBatName,
          ImageName: finalBatName,
          ImageId: Number(imageId),
          XmlContent: xmlCode,
        }),
        signal: controller.signal,
      });

      log("info", `HTTP Status = ${resp.status}`);

      if (!resp.ok) {
        log("error", "Hubo un error al intentar conectarse al servidor.");
        notify("error", "Hubo un error al intentar conectarse al servidor.");
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

  function ImagenList({ items, onSelect, selectedId, loading }) {
    if (loading) {
      return (
        <div
          style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            alignItems: "center",
            height: "100%",
          }}
        >
          <div className="img-loading">Cargando imágenes...</div>
          <Spinner />
        </div>
      );
    }

    if (!items.length) {
      return <div className="img-empty">No hay imágenes disponibles</div>;
    }

    return (
      <div className="img-list">
        <div className={`img-item header`}>
          <div className="img-id">Id</div>
          <div className="img-desc"> Descripción</div>
        </div>
        {items.map((img) => (
          <div
            key={img.atmConfID}
            className={`img-item ${
              selectedId === img.atmConfID ? "selected" : ""
            }`}
            onClick={() => onSelect(img)}
          >
            <div className="img-id">#{img.atmConfID}</div>
            <div className="img-desc">{img.confDescription}</div>
          </div>
        ))}
      </div>
    );
  }

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
                onChange={(e) => setBatName(normalizeBatName(e.target.value))}
                title="Nombre del .bat que se generara"
              />
              <span>.bat</span>
            </div>
          </div>
        </div>
        <div className="button-row">
          <button
            className={"compile-btn"}
            onClick={() => {
              getImagenes();
            }}
          >
            <FaList />
            Listar imagenes
          </button>
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
            disabled={loading || !hasXml}
            title={
              !hasXml
                ? "Carga un XML en el editor para poder compilar"
                : "Iniciar compilación"
            }
          >
            <FaPlay />
            {loading ? "Compilando..." : "Compilar"}
          </button>
        </div>
        <ImagenList
          items={imagenes}
          loading={loadingImagenes}
          selectedId={imageId}
          onSelect={(img) => {
            const cleanName = extractImageName(img.confDescription);
            const batSafeName = normalizeBatName(cleanName);

            setBatName(batSafeName);
            setImageName(batSafeName);
            setImageId(img.atmConfID);

            log("info", `Imagen seleccionada: ${batSafeName}`);
          }}
        />
      </div>

      {/* ================= PANEL DERECHO ================= */}
      <div className="compiler-console">
        <div className="console-header">
          <h3>Consola</h3>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {statusWS === "connecting" && (
              <button
                className="stop-btn"
                title="Cancelar conexión"
                onClick={() => {
                  wsRef.current?.close();
                  wsRef.current = null;
                  setStatusWS("disconnected");
                  log("", "Conexión WebSocket cancelada.");
                }}
              >
                <MdCancel />
              </button>
            )}
            <button
              className={
                statusWS === "connected"
                  ? "stop-btn"
                  : statusWS === "disconnected"
                  ? "play-btn"
                  : "wait"
              }
              title={
                statusWS === "connected"
                  ? "Desconectar WebSocket"
                  : "Conectar WebSocket"
              }
              onClick={() => {
                if (statusWS === "connected" || statusWS === "connecting") {
                  wsRef.current?.close();
                  wsRef.current = null;
                  setStatusWS("disconnected");
                  log("info", "WebSocket desconectado manualmente.");
                } else {
                  connectWS();
                }
              }}
            >
              {statusWS === "connected" ? <MdCancel /> : <FaLink />}
            </button>

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
