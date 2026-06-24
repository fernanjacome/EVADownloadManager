import { useEffect, useRef, useState } from "react";
import "./RemoteViewer.css";
import Spinner from "../utils/Spinner";
import { MdCancel, MdOutlineError } from "react-icons/md";
import { FaLink } from "react-icons/fa6";

const API_BASE = "https://192.168.10.241:5007";

export default function RemoteViewer() {
  const [ipInput, setIpInput] = useState("");
  const [selectedIp, setSelectedIp] = useState(null);
  const [source, setSource] = useState(null); // "input" | "recent"
  const [activeIndex, setActiveIndex] = useState(-1);

  const BASE_W = 1024;
  const BASE_H = 768;
  const viewportRef = useRef(null);

  const [scale, setScale] = useState(1);

  const [conexion, setConexion] = useState(null);
  const [vncUrl, setVncUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const isConnected = Boolean(vncUrl);
  const isBusy = loading || isConnected;
  const [connectedTarget, setConnectedTarget] = useState(null);
  const abortRef = useRef(null);

  const iframeRef = useRef(null);

  const [recentIps, setRecentIps] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vnc_recent_ips")) || [];
    } catch {
      return [];
    }
  });
  const isValidIp = (ip) =>
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(
      ip,
    );
  const resolveIp = () => {
    if (source === "recent") return selectedIp;
    if (source === "input") return ipInput.trim();
    return null;
  };
  const sendKey = async (key) => {
    try {
      await fetch(`${API_BASE}/api/vnc/send-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          target: connectedTarget,
        }),
      });
    } catch {}
  };

  const applyFit = () => {
    if (!viewportRef.current) return;

    const w = viewportRef.current.clientWidth;
    const h = viewportRef.current.clientHeight;

    const scaleX = w / BASE_W;
    const scaleY = h / BASE_H;

    setScale(Math.min(scaleX, scaleY));
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.2));
  const resetZoom = () => setScale(1);

  useEffect(() => {
    if (!conexion) return;

    applyFit();
    window.addEventListener("resize", applyFit);

    return () => window.removeEventListener("resize", applyFit);
  }, [conexion]);

  const connect = async () => {
    const targetIp = resolveIp();

    if (!targetIp) {
      setError("Debe seleccionar o ingresar una IP.");
      return;
    }

    if (!isValidIp(targetIp)) {
      setError("La IP ingresada no tiene un formato válido.");
      return;
    }

    setLoading(true);
    setError(null);
    setVncUrl(null);
    setConnectedTarget(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Guardar en recientes SOLO si viene del input
    if (source === "input") {
      setRecentIps((prev) => {
        const next = [targetIp, ...prev.filter((x) => x !== targetIp)].slice(
          0,
          5,
        );
        localStorage.setItem("vnc_recent_ips", JSON.stringify(next));
        return next;
      });
    }

    try {
      const ownerPid = await window.electronAPI.getMainPid();

      if (!ownerPid) {
        setError("No se pudo obtener el PID principal de Electron.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/vnc/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: targetIp,
          ownerPid,
        }),

        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("REMOTE_OFFLINE");

      const data = await res.json();
      setVncUrl(data.url);
      setConnectedTarget(targetIp);
      setConexion(true);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setConexion(false);
      setError(
        `No se pudo conectar al equipo ${targetIp}. El servidor VNC no responde.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!vncUrl) return; // guardia

    setConexion(false);
    abortRef.current?.abort();

    try {
      await fetch(`${API_BASE}/api/vnc/disconnect`, { method: "POST" });
    } catch (_) {}

    setVncUrl(null);
    setConnectedTarget(null);
  };

  const shouldShowDropdown = showRecent && !isBusy && recentIps.length > 0;

  return (
    <div
      className={`remote-viewer ${isConnected ? "is-connected" : "is-disconnected"}`}
    >
      <div className="remote-toolbar">
        {!isConnected && (
          <>
            <div className="remote-connect-heading">
              <span className="remote-connect-icon">
                <FaLink />
              </span>
              <div>
                <h3>Conectar VNC</h3>
                <p>Ingresa la IP del equipo que deseas abrir.</p>
              </div>
            </div>
            <div className="remote-input-wrapper remote-service-field">
              <label htmlFor="remote-target-ip">IP del equipo</label>
              <input
                ref={inputRef}
                id="remote-target-ip"
                className="remote-input"
                value={ipInput}
                onFocus={() => {
                  setShowRecent(true);
                  setActiveIndex(0);
                }}
                onBlur={(e) => {
                  const next = e.relatedTarget;

                  // 🔥 Si el foco va al dropdown, NO cerrar
                  if (dropdownRef.current?.contains(next)) return;

                  setShowRecent(false);
                  setActiveIndex(-1);
                }}
                onChange={(e) => {
                  const value = e.target.value;

                  setIpInput(value);
                  setSource("input");
                  setSelectedIp(null);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (!shouldShowDropdown) {
                    // ENTER conecta directo si no hay dropdown
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (isValidIp(ipInput) && !isBusy) {
                        setSource("input");
                        setSelectedIp(null);
                        setShowRecent(false);
                        setActiveIndex(-1);
                        connect();
                      }
                    }
                    return;
                  }

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((prev) => {
                      const next = prev < recentIps.length - 1 ? prev + 1 : 0;
                      const ip = recentIps[next];

                      setIpInput(ip); // 🔥 se copia al input
                      setSelectedIp(ip);
                      setSource("recent");

                      return next;
                    });
                  }

                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((prev) => {
                      const next = prev > 0 ? prev - 1 : recentIps.length - 1;
                      const ip = recentIps[next];

                      setIpInput(ip); // 🔥 se copia al input
                      setSelectedIp(ip);
                      setSource("recent");

                      return next;
                    });
                  }

                  if (e.key === "Enter") {
                    e.preventDefault();

                    const value = ipInput.trim();
                    if (isValidIp(value) && !isBusy) {
                      setShowRecent(false);
                      setActiveIndex(-1);
                      connect(); // 🔥 ENTER SIEMPRE CONECTA
                    }
                  }

                  if (e.key === "Escape") {
                    setShowRecent(false);
                    setActiveIndex(-1);
                  }
                }}
                disabled={isBusy}
              />
              {shouldShowDropdown && (
                <div
                  ref={dropdownRef}
                  className="remote-recent-dropdown"
                  tabIndex={-1}
                >
                  <div className="dropdown-title">Conexiones recientes</div>

                  {recentIps.map((r, index) => (
                    <div
                      key={r}
                      className={`dropdown-item ${
                        index === activeIndex ? "active" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIpInput(r);
                        setSelectedIp(r);
                        setSource("recent");
                        setShowRecent(false);
                        setActiveIndex(-1);
                        setError(null);
                      }}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`remote-btn primary remote-connect-btn ${loading ? "is-waiting" : ""}`}
              onClick={() => {
                if (loading) {
                  abortRef.current?.abort();
                  setError(null);
                  return;
                }
                connect();
              }}
              disabled={!loading && !resolveIp()}
            >
              {loading ? <MdCancel /> : <FaLink />}
              {loading ? "Cancelar" : "Conectar"}
            </button>
          </>
        )}
        {isConnected && (
          <>
            <div className="remote-pill">
              Conectado a: <span>{connectedTarget}</span>
            </div>
            <button
              className={`remote-btn danger`}
              onClick={!isConnected ? connect : disconnect}
              disabled={!isConnected}
            >
              Desconectar
            </button>
          </>
        )}
      </div>
      <div className="remote-area">
        {loading && (
          <div style={{ width: "100%" }} className="remote-center">
            <Spinner />
          </div>
        )}

        {error && (
          <div style={{ width: "100%" }} className="remote-status error">
            <MdOutlineError />
            <strong>No se pudo establecer conexión</strong>
            <div style={{ marginTop: 4, fontSize: 13 }}>{error}</div>
          </div>
        )}

        {conexion && (
          <div className="remote-viewport" ref={viewportRef}>
            <div className="remote-canvas">
              <div
                className="remote-inner"
                style={{ transform: `scale(${scale})` }}
              >
                <iframe
                  ref={iframeRef}
                  src={vncUrl}
                  title="VNC Viewer"
                  className="remote-frame"
                  allow="fullscreen"
                  allowFullScreen
                />
              </div>
            </div>

            {/* 🔧 TOOLBAR DE ZOOM */}
            <div className="remote-zoom-toolbar">
              <button onClick={resetZoom}>100%</button>
              <button onClick={applyFit}>Encajar</button>
              <button onClick={zoomOut}>−</button>
              <button onClick={zoomIn}>+</button>
              <span>{Math.round(scale * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
