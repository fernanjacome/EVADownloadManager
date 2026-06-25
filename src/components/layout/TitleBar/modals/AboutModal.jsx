import React, { useEffect, useState } from "react";
import { FaDownload, FaInfoCircle, FaSync } from "react-icons/fa";
import "./AboutModal.css";

const PHASE_LABELS = {
  download: "Descargando",
  verify: "Verificando",
  extract: "Extrayendo",
  done: "Listo",
};

export default function AboutModal({ isOpen, onClose }) {
  const [updateState, setUpdateState] = useState({
    currentVersion: "1.3.3",
    message: "Consultando actualizaciones...",
    loading: false,
    available: false,
  });
  const [channelInput, setChannelInput] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const cleanup = window.electronAPI?.onUpdateDownloadProgress?.((data) => {
      setDownloadProgress(data);
    });
    return () => cleanup?.();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const api = window.electronAPI;
    if (!api?.getAppUpdateStatus) {
      setUpdateState((current) => ({
        ...current,
        message: "Actualizaciones no disponibles en esta ejecucion.",
      }));
      return;
    }
    api
      .getAppUpdateStatus()
      .then((status) => {
        setUpdateState({ ...status, loading: false, available: false });
        setChannelInput(status.manifestUrl || "");
      })
      .catch(() =>
        setUpdateState((current) => ({
          ...current,
          message: "No se pudo leer el canal de actualizaciones.",
        })),
      );
  }, [isOpen]);

  const checkForUpdate = async () => {
    if (!window.electronAPI?.checkAppUpdate) return;
    setUpdateState((current) => ({
      ...current,
      loading: true,
      message: "Buscando actualizaciones...",
    }));
    if (window.electronAPI?.setAppUpdateChannel) {
      const saved = await window.electronAPI.setAppUpdateChannel(channelInput);
      if (!saved.ok) {
        setUpdateState((current) => ({ ...current, ...saved, loading: false }));
        return;
      }
      setChannelInput(saved.manifestUrl || "");
    }
    const result = await window.electronAPI.checkAppUpdate();
    setUpdateState({ ...result, loading: false });
  };

  const installUpdate = async () => {
    if (!window.electronAPI?.installAppUpdate) return;
    setDownloadProgress({ percent: 0, phase: "download" });
    setUpdateState((current) => ({
      ...current,
      loading: true,
      message: "Descargando actualizacion...",
    }));
    const result = await window.electronAPI.installAppUpdate();
    if (!result.ok) setDownloadProgress(null);
    setUpdateState((current) => ({
      ...current,
      ...result,
      loading: !result.ok,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className="about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="about-header">
          <FaInfoCircle className="about-icon" />
          <div>
            <h2 id="about-title">
              Version {updateState.currentVersion || "1.3.3"}
            </h2>
          </div>
        </div>

        <div className="about-body">
          <section className="about-section about-update-card">
            <div>
              <h3>Actualizaciones</h3>
              <p className="about-update-status" role="status">
                {updateState.message}
                {updateState.available
                  ? ` — Disponible: v${updateState.version}`
                  : null}
              </p>
              {downloadProgress ? (
                <div className="about-progress-container">
                  <div className="about-progress-bar">
                    <div
                      className={`about-progress-fill ${downloadProgress.phase !== "download" ? "indeterminate" : ""}`}
                      style={
                        downloadProgress.phase === "download"
                          ? { width: `${downloadProgress.percent}%` }
                          : undefined
                      }
                    />
                  </div>
                  <span className="about-progress-label">
                    {PHASE_LABELS[downloadProgress.phase] ||
                      downloadProgress.phase}
                    {downloadProgress.phase === "download"
                      ? ` ${downloadProgress.percent}%`
                      : "..."}
                  </span>
                </div>
              ) : null}
              <label className="about-update-label" htmlFor="update-channel">
                Canal de actualizacion
              </label>
              <div className="about-update-input-row">
                <input
                  id="update-channel"
                  className="about-update-input"
                  value={channelInput}
                  onChange={(event) => setChannelInput(event.target.value)}
                  placeholder="\\\\192.168.10.101\\Personales\\FJacome\\EVAStudio"
                  spellCheck="false"
                />
              </div>
            </div>
            <div className="about-update-actions">
              {updateState.available ? (
                <button
                  type="button"
                  className="about-update-button"
                  onClick={installUpdate}
                  disabled={updateState.loading}
                  title={`Descargar actualizacion ${updateState.version}`}
                  aria-label={`Descargar actualizacion ${updateState.version}`}
                >
                  <FaDownload />
                </button>
              ) : (
                <button
                  type="button"
                  className="about-update-button"
                  onClick={checkForUpdate}
                  title="Buscar actualizacion"
                  aria-label="Buscar actualizacion"
                >
                  <FaSync
                    className={
                      updateState.loading ? "about-update-spinner" : ""
                    }
                  />
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="about-footer">
          <p className="about-version">
            Version {updateState.currentVersion || "1.3.3"}
          </p>
          <p className="about-signature">Extreme Visual Appliance</p>
        </div>
        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
