import { useCallback, useEffect, useRef, useState } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";
import { FaAngleLeft, FaAngleRight } from "react-icons/fa6";
import {
  FiCode,
  FiEdit,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMinus,
  FiPlus,
  FiUnlock,
  FiX,
} from "react-icons/fi";

const BASE_W = 1024;
const BASE_H = 768;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.25;
const FIT_PADDING_X = 140;
const FIT_PADDING_Y = 110;
const FIT_MAX_SCALE = 1.02;

const IMAGE_BACKGROUNDS = [
  { id: "checker", label: "Transparencia", className: "img-bg-checker" },
  { id: "white", label: "Blanco", className: "img-bg-white" },
  { id: "light", label: "Gris claro", className: "img-bg-light" },
  { id: "dark", label: "Gris oscuro", className: "img-bg-dark" },
  { id: "black", label: "Negro", className: "img-bg-black" },
];

export default function ScreenViewer({
  folder,
  resource,
  resourceType = "html",
  revision = 0,
  viewState,
  onViewStateChange,
  previewLocked = false,
  onTogglePreviewLock,
  onInspectElement,
  onClosePreview,
}) {
  const [url, setUrl] = useState("");
  const [scale, setScale] = useState(viewState?.scale ?? 1);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [imageBg, setImageBg] = useState("checker");
  const [inspectMenu, setInspectMenu] = useState(null);
  const wrapperRef = useRef(null);
  const iframeRef = useRef(null);
  const hasAutoFitRef = useRef(false);

  const applyScale = (nextScale) => {
    const safeScale = Math.max(MIN_SCALE, Math.min(nextScale, MAX_SCALE));
    setScale(safeScale);
    onViewStateChange?.((prev) => ({
      ...(prev || {}),
      scale: safeScale,
    }));
  };

  const applyFit = () => {
    if (!wrapperRef.current) return;
    const w = Math.max(wrapperRef.current.clientWidth - FIT_PADDING_X, 320);
    const h = Math.max(wrapperRef.current.clientHeight - FIT_PADDING_Y, 240);
    const scaleX = w / BASE_W;
    const scaleY = h / BASE_H;
    const fittedScale = Math.min(scaleX, scaleY, FIT_MAX_SCALE);
    applyScale(fittedScale);
  };

  const zoomIn = () => applyScale(scale + 0.1);
  const zoomOut = () => applyScale(scale - 0.1);
  const resetZoom = () => applyScale(1);

  const savedFocusRef = useRef(null);

  useEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest(".screen-fit-wrapper")) {
      savedFocusRef.current = active;
    }
    const load = async () => {
      const baseUrl = await window.electronAPI.startStaticServer(folder);
      const qIdx = resource.indexOf("?");
      const resourcePath = qIdx === -1 ? resource : resource.slice(0, qIdx);
      const resourceQuery = qIdx === -1 ? "" : resource.slice(qIdx + 1);
      const cacheBuster = `v=${revision}-${Date.now()}`;
      const queryString = resourceQuery
        ? `${resourceQuery}&${cacheBuster}`
        : cacheBuster;
      setUrl(`${baseUrl}/${resourcePath}?${queryString}`);
    };
    load();
  }, [folder, resource, revision]);

  useEffect(() => {
    const onResize = () => {
      if (!hasAutoFitRef.current) return;
      applyFit();
    };
    window.addEventListener("resize", onResize);

    let resizeObserver = null;
    if (wrapperRef.current && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => {
        if (!hasAutoFitRef.current) return;
        applyFit();
      });
      resizeObserver.observe(wrapperRef.current);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    hasAutoFitRef.current = false;
  }, [resource]);

  const handleIframeContextMenu = useCallback(
    (event) => {
      if (resourceType !== "html" || !onInspectElement) return;

      const iframe = iframeRef.current;
      if (!iframe) return;

      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;

        const iframeRect = iframe.getBoundingClientRect();
        const x = (event.clientX - iframeRect.left) / scale;
        const y = (event.clientY - iframeRect.top) / scale;

        let target = iframeDoc.elementFromPoint(x, y);
        if (
          !target ||
          target === iframeDoc.documentElement ||
          target === iframeDoc.body
        )
          return;

        event.preventDefault();

        const tag = target.tagName.toLowerCase();
        const id = target.id ? `#${target.id}` : "";
        const cls =
          target.className && typeof target.className === "string"
            ? `.${target.className.trim().split(/\s+/).join(".")}`
            : "";
        const label = `<${tag}${id}${cls}>`;

        const outerHtml = target.outerHTML || "";
        const searchSnippet = outerHtml.slice(0, 120);

        setInspectMenu({
          x: event.clientX,
          y: event.clientY,
          label,
          searchSnippet,
          tag,
        });
      } catch {
        // cross-origin iframe, ignored
      }
    },
    [resourceType, onInspectElement, scale],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || resourceType !== "html") return;

    const attach = () => {
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;
        iframeDoc.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const iframeRect = iframe.getBoundingClientRect();
          const syntheticEvent = {
            clientX: iframeRect.left + e.clientX * scale,
            clientY: iframeRect.top + e.clientY * scale,
            preventDefault: () => {},
          };
          handleIframeContextMenu(syntheticEvent);
        });
      } catch {
        // cross-origin, ignored
      }
    };

    iframe.addEventListener("load", attach);
    return () => iframe.removeEventListener("load", attach);
  }, [resourceType, handleIframeContextMenu, scale, url]);

  useEffect(() => {
    if (!inspectMenu) return;
    const close = () => setInspectMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [inspectMenu]);

  const handleInspectClick = () => {
    if (!inspectMenu) return;
    const snippet = inspectMenu.searchSnippet;
    setInspectMenu(null);

    const iframe = iframeRef.current;
    if (!iframe) {
      onInspectElement?.(inspectMenu.tag, 0);
      return;
    }

    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        onInspectElement?.(inspectMenu.tag, 0);
        return;
      }

      const html = iframeDoc.documentElement.outerHTML;
      const idx = html.indexOf(snippet.slice(0, 60));
      if (idx === -1) {
        onInspectElement?.(inspectMenu.tag, 0);
        return;
      }

      const lineNumber = html.slice(0, idx).split("\n").length;
      onInspectElement?.(inspectMenu.tag, lineNumber);
    } catch {
      onInspectElement?.(inspectMenu.tag, 0); // fallback
    }
  };

  const bgClass =
    IMAGE_BACKGROUNDS.find((b) => b.id === imageBg)?.className ||
    "img-bg-checker";
  const previewTitle = decodeURIComponent(
    String(resource || "").split("?")[0].split("/").pop() || "Vista previa",
  );

  return (
    <div className="screen-fit-wrapper" ref={wrapperRef}>
      <div className="screens-viewer-title" title={previewTitle}>
        <span>{previewTitle}</span>
      </div>
      <div
        className={`screen-fit-canvas ${resourceType === "image" ? `image-resource ${bgClass}` : ""}`}
      >
        {resourceType === "image" ? (
          <img
            className="screen-resource-image"
            src={url}
            alt={resource}
            style={{ transform: `scale(${scale})` }}
            onLoad={() => {
              hasAutoFitRef.current = true;
              applyFit();
            }}
          />
        ) : (
          <div
            className="screen-fit-inner"
            style={{ transform: `scale(${scale})` }}
          >
            <iframe
              ref={iframeRef}
              className="screen-iframe"
              src={url}
              tabIndex={-1}
              onLoad={(e) => {
                hasAutoFitRef.current = true;
                applyFit();
                if (document.activeElement === e.target) {
                  e.target.blur();
                }
                if (savedFocusRef.current && document.contains(savedFocusRef.current)) {
                  savedFocusRef.current.focus({ preventScroll: true });
                  savedFocusRef.current = null;
                }
              }}
            />
          </div>
        )}
      </div>
      <div className="screen-floating-controls">
        {toolbarVisible ? (
          <div className="screen-toolbar">
            <button
              className="screen-tool-btn icon"
              onClick={zoomOut}
              title="Alejar"
            >
              <FiMinus />
            </button>
            <button
              className="screen-tool-btn icon"
              onClick={zoomIn}
              title="Acercar"
            >
              <FiPlus />
            </button>
            <button
              className="screen-tool-btn fit"
              onClick={applyFit}
              title="Encajar"
            >
              <FaExpandArrowsAlt />
            </button>
            <button
              className="screen-tool-btn value"
              onClick={resetZoom}
              title="Zoom 100%"
            >
              100%
            </button>
            <div className="screen-zoom-readout" aria-live="polite">
              {Math.round(scale * 100)}%
            </div>
            {resourceType === "image" ? (
              <div className="screen-bg-picker">
                {IMAGE_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    className={`screen-bg-swatch ${bg.id} ${imageBg === bg.id ? "active" : ""}`}
                    onClick={() => setImageBg(bg.id)}
                    title={bg.label}
                  />
                ))}
              </div>
            ) : null}
            {resourceType === "html" ? (
              <>
                <button
                  className={`screen-tool-btn icon ${previewLocked ? "active" : ""}`}
                  onClick={onTogglePreviewLock}
                  title={
                    previewLocked
                      ? "Desbloquear vista previa"
                      : "Bloquear esta vista previa"
                  }
                >
                  {previewLocked ? <FiLock /> : <FiUnlock />}
                </button>
                <button
                  className="screen-tool-btn icon"
                  onClick={() => window.electronAPI?.openDevTools?.()}
                  title="Abrir inspector (DevTools)"
                >
                  <FiCode />
                </button>
              </>
            ) : null}
            {onClosePreview ? (
              <button
                className="screen-tool-btn icon"
                onClick={onClosePreview}
                title="Cerrar previsualización"
                aria-label="Cerrar previsualización"
              >
                <FiX />
              </button>
            ) : null}
            <button
              className="screen-tool-btn icon hide"
              onClick={() => setToolbarVisible(false)}
              title="Ocultar controles"
            >
              <FaAngleRight />
            </button>
          </div>
        ) : (
          <button
            className="screen-toolbar-reveal"
            onClick={() => setToolbarVisible(true)}
            title="Mostrar controles"
          >
            <FaAngleLeft />
          </button>
        )}
      </div>

      {inspectMenu ? (
        <div
          className="editor-context-menu screen-inspect-menu"
          style={{ left: inspectMenu.x, top: inspectMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="inspect-menu-label">{inspectMenu.label}</div>
          <button
            type="button"
            className="editor-context-item"
            onClick={handleInspectClick}
          >
            <FiEdit /> Editar en código
          </button>
        </div>
      ) : null}
    </div>
  );
}
