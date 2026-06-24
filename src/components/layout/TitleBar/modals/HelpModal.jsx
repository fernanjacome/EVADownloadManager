import React, { useEffect, useRef } from "react";
import { FiHelpCircle, FiX } from "react-icons/fi";
import "./HelpModal.css";

export default function HelpModal({
  isOpen,
  onClose,
  title,
  summary,
  icon: Icon = FiHelpCircle,
  quickStart = [],
  sections = [],
  shortcuts = [],
  sample,
}) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="help-overlay" onMouseDown={onClose}>
      <section
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="help-modal-header">
          <div className="help-title-block">
            <span className="help-eyebrow">Ayuda</span>
            <div className="help-title-row">
              <span className="help-icon">
                <Icon />
              </span>
              <div>
                <h2 id="help-modal-title">{title}</h2>
              </div>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="help-close-icon"
            onClick={onClose}
            aria-label="Cerrar ayuda"
            title="Cerrar (Esc)"
          >
            <FiX />
          </button>
        </header>

        <div className="help-modal-body">
          {quickStart.length > 0 ? (
            <section className="help-quickstart" aria-label="Primeros pasos">
              <h3>Cómo usarlo</h3>
              <ol>
                {quickStart.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {sections.length > 0 ? (
            <div className="help-section-grid">
              {sections.map(
                ({ title: sectionTitle, icon: SectionIcon, items }) => (
                  <section className="help-section-card" key={sectionTitle}>
                    <h3>
                      {SectionIcon ? <SectionIcon aria-hidden="true" /> : null}
                      {sectionTitle}
                    </h3>
                    <ul>
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ),
              )}
            </div>
          ) : null}

          {shortcuts.length > 0 ? (
            <section className="help-shortcuts" aria-label="Atajos">
              <h3>Atajos útiles</h3>
              <div>
                {shortcuts.map(({ keys, label }) => (
                  <p key={keys}>
                    <kbd>{keys}</kbd>
                    <span>{label}</span>
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {sample ? <pre className="help-code-sample">{sample}</pre> : null}
        </div>

        <footer className="help-modal-footer">
          <span>
            Presiona <kbd>Esc</kbd> para cerrar
          </span>
          <button type="button" onClick={onClose}>
            Entendido
          </button>
        </footer>
      </section>
    </div>
  );
}
