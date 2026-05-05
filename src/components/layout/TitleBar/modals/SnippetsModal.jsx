import React, { useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { EVA_SNIPPET_DEFINITIONS } from "../../../../utils/evaSnippetData";
import "./SnippetsModal.css";

const STORAGE_KEY = "eva_user_snippets";
const SYSTEM_OVERRIDES_KEY = "eva_system_snippet_overrides";

function loadCustomSnippets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveCustomSnippets(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("eva-snippets-updated"));
}

function loadSystemOverrides() {
  try {
    const raw = localStorage.getItem(SYSTEM_OVERRIDES_KEY);
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function saveSystemOverrides(overrides) {
  localStorage.setItem(SYSTEM_OVERRIDES_KEY, JSON.stringify(overrides));
  window.dispatchEvent(new CustomEvent("eva-snippets-updated"));
}

function makeId() {
  return `snp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function matchesFilter(s, q) {
  return (
    (s.label || "").toLowerCase().includes(q) ||
    (s.detail || "").toLowerCase().includes(q) ||
    (s.template || "").toLowerCase().includes(q)
  );
}

export default function SnippetsModal({ isOpen, onClose }) {
  const [customSnippets, setCustomSnippets] = useState(() => loadCustomSnippets());
  const [systemOverrides, setSystemOverrides] = useState(() => loadSystemOverrides());
  const [activeTab, setActiveTab] = useState("custom");
  const [filterText, setFilterText] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ label: "", detail: "", template: "" });

  if (!isOpen) return null;

  const fl = filterText.toLowerCase();
  const filteredCustom = fl ? customSnippets.filter((s) => matchesFilter(s, fl)) : customSnippets;
  const filteredSystem = fl ? EVA_SNIPPET_DEFINITIONS.filter((s) => matchesFilter(s, fl)) : EVA_SNIPPET_DEFINITIONS;
  const modifiedCount = Object.keys(systemOverrides).length;
  const isNew = selectedId === "__new__";

  const selectedCustom =
    activeTab === "custom" && !isNew && selectedId
      ? customSnippets.find((s) => s.id === selectedId) || null
      : null;
  const selectedSystem =
    activeTab === "builtin" && selectedId
      ? EVA_SNIPPET_DEFINITIONS.find((s) => s.label === selectedId) || null
      : null;
  const sysOverride = selectedSystem ? systemOverrides[selectedSystem.label] || null : null;
  const effectiveSystem = selectedSystem
    ? { ...selectedSystem, ...(sysOverride || {}) }
    : null;

  const commitCustom = (list) => { setCustomSnippets(list); saveCustomSnippets(list); };
  const commitSystem = (ov) => { setSystemOverrides(ov); saveSystemOverrides(ov); };

  const handleNew = () => {
    setSelectedId("__new__");
    setEditMode(true);
    setDraft({ label: "", detail: "", template: "" });
  };

  const handleSelect = (id) => {
    setSelectedId(id);
    setEditMode(false);
  };

  const handleStartEdit = () => {
    if (activeTab === "custom" && selectedCustom) {
      setDraft({ label: selectedCustom.label, detail: selectedCustom.detail || "", template: selectedCustom.template });
      setEditMode(true);
    } else if (activeTab === "builtin" && selectedSystem) {
      const ov = systemOverrides[selectedSystem.label] || {};
      setDraft({
        label: selectedSystem.label,
        detail: ov.detail ?? selectedSystem.detail ?? "",
        template: ov.template ?? selectedSystem.template ?? "",
      });
      setEditMode(true);
    }
  };

  const handleSave = () => {
    if (!draft.template.trim()) return;
    if (isNew) {
      if (!draft.label.trim()) return;
      const item = { id: makeId(), label: draft.label.trim(), detail: draft.detail, template: draft.template };
      commitCustom([...customSnippets, item]);
      setSelectedId(item.id);
      setEditMode(false);
    } else if (activeTab === "custom" && selectedCustom) {
      commitCustom(customSnippets.map((s) => s.id === selectedId ? { ...s, ...draft } : s));
      setEditMode(false);
    } else if (activeTab === "builtin" && selectedSystem) {
      commitSystem({ ...systemOverrides, [selectedSystem.label]: { detail: draft.detail, template: draft.template } });
      setEditMode(false);
    }
  };

  const handleCancel = () => {
    if (isNew) setSelectedId(null);
    setEditMode(false);
  };

  const handleDelete = (id) => {
    commitCustom(customSnippets.filter((s) => s.id !== id));
    if (selectedId === id) { setSelectedId(null); setEditMode(false); }
  };

  const handleRestore = (label) => {
    const next = { ...systemOverrides };
    delete next[label];
    commitSystem(next);
    setEditMode(false);
  };

  const handleRestoreAll = () => { commitSystem({}); setEditMode(false); };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSelectedId(null);
    setEditMode(false);
  };

  return (
    <div className="snp-overlay" onClick={onClose}>
      <div className="snp-modal" onClick={(e) => e.stopPropagation()}>

        <div className="snp-header">
          <div className="snp-header-left">
            <h2>Snippets</h2>
          </div>
          <div className="snp-header-right">
            {activeTab === "custom" && (
              <button className="snp-btn-primary" onClick={handleNew} disabled={isNew}>
                + Nuevo
              </button>
            )}
            {activeTab === "builtin" && modifiedCount > 0 && (
              <button className="snp-btn-secondary" onClick={handleRestoreAll} title="Restaurar todos los snippets del sistema">
                Restaurar todo ({modifiedCount})
              </button>
            )}
            <button className="snp-btn-icon" onClick={onClose} title="Cerrar">
              <IoClose />
            </button>
          </div>
        </div>

        <div className="snp-tabs">
          <button
            className={`snp-tab ${activeTab === "custom" ? "active" : ""}`}
            onClick={() => handleTabSwitch("custom")}
          >
            Personalizados ({customSnippets.length})
          </button>
          <button
            className={`snp-tab ${activeTab === "builtin" ? "active" : ""}`}
            onClick={() => handleTabSwitch("builtin")}
          >
            Sistema ({EVA_SNIPPET_DEFINITIONS.length})
            {modifiedCount > 0 && <span className="snp-tab-badge">{modifiedCount}</span>}
          </button>
          <div className="snp-tabs-gap" />
          <div className="snp-filter-wrap">
            <input
              type="text"
              className="snp-filter-input"
              placeholder="Buscar..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              spellCheck={false}
            />
            {filterText && (
              <button className="snp-filter-clear" onClick={() => setFilterText("")}>×</button>
            )}
          </div>
        </div>

        <div className="snp-body">
          {/* ── Left: compact list ── */}
          <div className="snp-list">
            {activeTab === "custom" && (
              <>
                {filteredCustom.length === 0 && (
                  <div className="snp-list-empty">
                    {filterText ? "Sin resultados." : "Sin snippets."}
                  </div>
                )}
                {filteredCustom.map((snp) => (
                  <button
                    key={snp.id}
                    type="button"
                    className={`snp-list-item ${selectedId === snp.id ? "active" : ""}`}
                    onClick={() => handleSelect(snp.id)}
                  >
                    <span className="snp-list-label">{snp.label}</span>
                    {snp.detail && <span className="snp-list-detail">{snp.detail}</span>}
                  </button>
                ))}
              </>
            )}
            {activeTab === "builtin" && (
              <>
                {filteredSystem.length === 0 && (
                  <div className="snp-list-empty">Sin resultados.</div>
                )}
                {filteredSystem.map((snp) => {
                  const isOv = Boolean(systemOverrides[snp.label]);
                  return (
                    <button
                      key={snp.label}
                      type="button"
                      className={`snp-list-item ${selectedId === snp.label ? "active" : ""}`}
                      onClick={() => handleSelect(snp.label)}
                    >
                      <span className="snp-list-label">{snp.label}</span>
                      {isOv && <span className="snp-dot" title="Modificado" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* ── Right: detail / edit panel ── */}
          <div className="snp-panel">
            {/* Nothing selected */}
            {!selectedId && (
              <div className="snp-panel-empty">
                {activeTab === "custom"
                  ? "Selecciona o crea un snippet"
                  : "Selecciona un snippet del sistema"}
              </div>
            )}

            {/* New custom snippet */}
            {isNew && (
              <SnippetEditForm
                draft={draft}
                setDraft={setDraft}
                onSave={handleSave}
                onCancel={handleCancel}
                labelEditable
                isNew
              />
            )}

            {/* Custom snippet — view */}
            {selectedCustom && !editMode && (
              <div className="snp-panel-view">
                <div className="snp-panel-head">
                  <code className="snp-panel-label">{selectedCustom.label}</code>
                  <div className="snp-panel-actions">
                    <button className="snp-action-btn" onClick={handleStartEdit}>Editar</button>
                    <button className="snp-action-btn danger" onClick={() => handleDelete(selectedCustom.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
                {selectedCustom.detail && (
                  <div className="snp-panel-detail">{selectedCustom.detail}</div>
                )}
                <pre className="snp-panel-preview">{selectedCustom.template}</pre>
              </div>
            )}

            {/* Custom snippet — edit */}
            {selectedCustom && editMode && (
              <SnippetEditForm
                draft={draft}
                setDraft={setDraft}
                onSave={handleSave}
                onCancel={handleCancel}
                labelEditable
              />
            )}

            {/* System snippet — view */}
            {selectedSystem && !editMode && (
              <div className="snp-panel-view">
                <div className="snp-panel-head">
                  <code className="snp-panel-label">{selectedSystem.label}</code>
                  <div className="snp-panel-actions">
                    {sysOverride && (
                      <button className="snp-action-btn" onClick={() => handleRestore(selectedSystem.label)}>
                        Restaurar
                      </button>
                    )}
                    <button className="snp-action-btn" onClick={handleStartEdit}>Editar</button>
                    {sysOverride
                      ? <span className="snp-badge snp-badge-mod">modificado</span>
                      : <span className="snp-badge snp-badge-sys">sistema</span>
                    }
                  </div>
                </div>
                {effectiveSystem?.detail && (
                  <div className="snp-panel-detail">{effectiveSystem.detail}</div>
                )}
                <pre className="snp-panel-preview">{effectiveSystem?.template || ""}</pre>
              </div>
            )}

            {/* System snippet — edit */}
            {selectedSystem && editMode && (
              <SnippetEditForm
                draft={draft}
                setDraft={setDraft}
                onSave={handleSave}
                onCancel={handleCancel}
                labelEditable={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SnippetEditForm({ draft, setDraft, onSave, onCancel, labelEditable, isNew }) {
  return (
    <div className="snp-edit-form">
      {labelEditable && (
        <div className="snp-field">
          <label>Label</label>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
            placeholder="state:mi-estado"
            autoFocus={!!isNew}
            spellCheck={false}
          />
        </div>
      )}
      <div className="snp-field">
        <label>Descripción</label>
        <input
          type="text"
          value={draft.detail}
          onChange={(e) => setDraft((p) => ({ ...p, detail: e.target.value }))}
          placeholder="Descripción breve"
          autoFocus={!isNew && !labelEditable}
        />
      </div>
      <div className="snp-field snp-field-grow">
        <label>Template</label>
        <SnippetCodeEditor
          value={draft.template}
          onChange={(value) => setDraft((p) => ({ ...p, template: value }))}
          placeholder={`<State Id="\${id}" ...>\n  ...\n</State>`}
        />
        <p className="snp-hint">
          <code>${"texto"}</code> para campos TAB en orden de aparicion
        </p>
      </div>
      <div className="snp-edit-footer">
        <button className="snp-action-btn" onClick={onCancel}>Cancelar</button>
        <button
          className="snp-action-btn primary"
          onClick={onSave}
          disabled={!draft.template.trim() || (labelEditable && !draft.label.trim())}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function SnippetCodeEditor({ value, onChange, placeholder }) {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const lineCount = Math.max(1, String(value || "").split("\n").length);

  const handleScroll = (event) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Tab") return;

    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextValue = `${value.slice(0, start)}\t${value.slice(end)}`;

    onChange(nextValue);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.selectionStart = start + 1;
      textarea.selectionEnd = start + 1;
    });
  };

  return (
    <div className="snp-code-editor">
      <div className="snp-code-topbar">
        <span>XML</span>
      </div>
      <div className="snp-code-body">
        <div className="snp-code-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          spellCheck={false}
          wrap="off"
        />
      </div>
    </div>
  );
}
