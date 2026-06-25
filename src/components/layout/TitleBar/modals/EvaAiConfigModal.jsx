import { useEffect, useState } from "react";
import {
  FiCheck,
  FiCopy,
  FiCpu,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiLock,
  FiSave,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import "./EvaAiConfigModal.css";

const EMPTY_SETTINGS = {
  endpoint: "",
  model: "",
  apiKey: "",
  systemPrompt: "",
};

const PROVIDERS = [
  {
    id: "gemini",
    label: "Google Gemini",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"],
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      "google/gemini-2.0-flash-exp:free",
      "deepseek/deepseek-chat-v3-0324:free",
      "meta-llama/llama-4-maverick:free",
    ],
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "groq",
    label: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile", "gemma2-9b-it"],
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1-nano"],
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    endpoint: "https://api.anthropic.com/v1/messages",
    models: ["claude-sonnet-4-5-20250514", "claude-haiku-3-5-20241022"],
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Requiere formato Anthropic, no compatible con OpenAI directamente.",
  },
  {
    id: "custom",
    label: "Personalizado",
    endpoint: "",
    models: [],
    keyUrl: "",
  },
];

function detectProvider(endpoint) {
  if (!endpoint) return "gemini";
  const match = PROVIDERS.find(
    (p) => p.id !== "custom" && p.endpoint === endpoint,
  );
  return match ? match.id : "custom";
}

export default function EvaAiConfigModal({
  isOpen,
  onClose,
  settings,
  onSaved,
}) {
  const [draft, setDraft] = useState(EMPTY_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDraft({ ...EMPTY_SETTINGS, ...(settings || {}) });
    setError("");
    setShowKey(false);
    setShowLogs(false);
    setLogs("");
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const update = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const loadLogs = async () => {
    setShowLogs(true);
    setLoadingLogs(true);
    const result = await window.electronAPI?.getEvaAiLogs?.();
    setLoadingLogs(false);
    setLogs(
      result?.success
        ? result.content
        : result?.error || "No se pudo leer el registro.",
    );
  };
  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setLogsCopied(true);
      setTimeout(() => setLogsCopied(false), 1300);
    } catch {
      /* clipboard unavailable */
    }
  };
  const clearLogs = async () => {
    await window.electronAPI?.clearEvaAiLogs?.();
    loadLogs();
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await window.electronAPI?.saveEvaAiSettings?.(draft);
    setSaving(false);
    if (!result?.success) {
      setError(result?.error || "No se pudo guardar la configuración.");
      return;
    }
    onSaved?.(result.settings);
    onClose();
  };

  return (
    <div className="eva-ai-config-overlay" onMouseDown={onClose}>
      <form
        className="eva-ai-config-modal"
        onSubmit={save}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="eva-ai-config-heading">
            <span>
              <FiCpu />
            </span>
            <div>
              <h2>EVA</h2>
              <p>Conexión del asistente</p>
            </div>
          </div>
          <div className="eva-ai-config-header-actions">
            <button
              type="button"
              className="eva-ai-config-log-button"
              onClick={loadLogs}
              title="Ver registro técnico de EVA"
            >
              <FiFileText />
            </button>
            <button type="button" onClick={onClose} title="Cerrar">
              <FiX />
            </button>
          </div>
        </header>

        <div className="eva-ai-config-body">
          {showLogs ? (
            <div className="eva-ai-config-logs">
              <div>
                <strong>Registro técnico</strong>
                <span className="eva-ai-config-logs-actions">
                  <button
                    type="button"
                    onClick={copyLogs}
                    title="Copiar registro"
                  >
                    {logsCopied ? <FiCheck /> : <FiCopy />}
                  </button>
                  <button
                    type="button"
                    onClick={clearLogs}
                    title="Limpiar registro"
                  >
                    <FiTrash2 />
                  </button>
                  <button type="button" onClick={loadLogs}>
                    Actualizar
                  </button>
                </span>
              </div>
              <pre>{loadingLogs ? "Leyendo registro..." : logs}</pre>
            </div>
          ) : null}
          {(() => {
            const providerId = detectProvider(draft.endpoint);
            const provider =
              PROVIDERS.find((p) => p.id === providerId) || PROVIDERS.at(-1);
            const isCustom = providerId === "custom";
            return (
              <>
                <label>
                  Proveedor
                  <select
                    value={providerId}
                    onChange={(event) => {
                      const next = PROVIDERS.find(
                        (p) => p.id === event.target.value,
                      );
                      if (next)
                        setDraft((c) => ({
                          ...c,
                          endpoint: next.endpoint,
                          model: next.models[0] || c.model,
                        }));
                    }}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {isCustom ? (
                  <label>
                    Endpoint
                    <input
                      value={draft.endpoint}
                      onChange={(event) =>
                        update("endpoint", event.target.value)
                      }
                      placeholder="https://api.ejemplo.com/v1/chat/completions"
                      spellCheck="false"
                    />
                  </label>
                ) : null}
                <label>
                  Modelo
                  <input
                    value={draft.model}
                    onChange={(event) => update("model", event.target.value)}
                    placeholder="ID del modelo"
                    spellCheck="false"
                  />
                  {provider.note ? (
                    <small className="eva-ai-config-warn">
                      {provider.note}
                    </small>
                  ) : null}
                </label>
                <label>
                  Clave del API
                  <span className="eva-ai-key-input">
                    <FiLock />
                    <input
                      value={draft.apiKey}
                      onChange={(event) => update("apiKey", event.target.value)}
                      placeholder="Pega tu clave"
                      type={showKey ? "text" : "password"}
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((current) => !current)}
                      title={showKey ? "Ocultar clave" : "Mostrar clave"}
                    >
                      {showKey ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </span>
                  {provider.keyUrl ? (
                    <small>
                      Obtén tu clave en{" "}
                      <a
                        href={provider.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="eva-ai-config-link"
                      >
                        {
                          provider.keyUrl
                            .replace(/^https?:\/\//, "")
                            .split("/")[0]
                        }
                      </a>
                    </small>
                  ) : null}
                </label>
                <label>
                  Instrucciones base <em>opcional</em>
                  <textarea
                    value={draft.systemPrompt}
                    onChange={(event) =>
                      update("systemPrompt", event.target.value)
                    }
                    placeholder="Por ejemplo: responde en español y propone cambios pequeños."
                    rows={3}
                  />
                </label>
              </>
            );
          })()}
          {error ? <p className="eva-ai-config-error">{error}</p> : null}
        </div>

        <footer>
          <button
            type="button"
            className="eva-ai-config-cancel"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="eva-ai-config-save"
            disabled={saving}
          >
            <FiSave /> {saving ? "Guardando" : "Guardar conexión"}
          </button>
        </footer>
      </form>
    </div>
  );
}
