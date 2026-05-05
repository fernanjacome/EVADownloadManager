import { useEffect, useRef, useState } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";
import { FiMinus, FiPlus } from "react-icons/fi";

const BASE_W = 1024;
const BASE_H = 768;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.25;
const FIT_PADDING_X = 140;
const FIT_PADDING_Y = 110;
const FIT_MAX_SCALE = 1.02;

export default function ScreenViewer({ folder, resource, viewState, onViewStateChange }) {
  const [url, setUrl] = useState("");
  const [scale, setScale] = useState(viewState?.scale ?? 1);
  const wrapperRef = useRef(null);
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

  useEffect(() => {
    const load = async () => {
      const baseUrl = await window.electronAPI.startStaticServer(folder);
      const qIdx = resource.indexOf('?');
      const resourcePath = qIdx === -1 ? resource : resource.slice(0, qIdx);
      const resourceQuery = qIdx === -1 ? '' : resource.slice(qIdx + 1);
      const cacheBuster = `v=${Date.now()}`;
      const queryString = resourceQuery ? `${resourceQuery}&${cacheBuster}` : cacheBuster;
      setUrl(`${baseUrl}/${resourcePath}?${queryString}`);
    };

    load();
  }, [folder, resource]);

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

  return (
    <div className="screen-fit-wrapper" ref={wrapperRef}>
      <div className="screen-toolbar">
        <div className="screen-toolbar-group">
          <button className="screen-tool-btn icon" onClick={zoomOut} title="Alejar">
            <FiMinus />
          </button>
          <button className="screen-tool-btn icon" onClick={zoomIn} title="Acercar">
            <FiPlus />
          </button>
          <button className="screen-tool-btn fit" onClick={applyFit} title="Encajar pantalla">
            <FaExpandArrowsAlt />
            <span>Encajar</span>
          </button>
          <button className="screen-tool-btn value" onClick={resetZoom} title="Zoom 100%">
            100%
          </button>
          <div className="screen-zoom-readout" aria-live="polite">
            {Math.round(scale * 100)}%
          </div>
        </div>
      </div>

      <div className="screen-fit-canvas">
        <div className="screen-fit-inner" style={{ transform: `scale(${scale})` }}>
          <iframe
            className="screen-iframe"
            src={url}
            onLoad={() => {
              hasAutoFitRef.current = true;
              applyFit();
            }}
          />
        </div>
      </div>
    </div>
  );
}
