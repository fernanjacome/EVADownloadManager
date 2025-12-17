import { useEffect, useState, useRef } from "react";

const BASE_W = 1024;
const BASE_H = 768;

export default function ScreenViewer({ folder, resource }) {
  const [url, setUrl] = useState("");
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef(null);

  const applyFit = () => {
    if (!wrapperRef.current) return;

    const w = wrapperRef.current.clientWidth;
    const h = wrapperRef.current.clientHeight;

    const scaleX = w / BASE_W;
    const scaleY = h / BASE_H;

    setScale(Math.min(scaleX, scaleY));
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.2));
  const resetZoom = () => setScale(1);

  useEffect(() => {
    const load = async () => {
      const baseUrl = await window.electronAPI.startStaticServer(folder);
      const finalUrl = `${baseUrl}/${resource}?v=${Date.now()}`;
      setUrl(finalUrl);
    };

    load();
  }, [folder, resource]);

  useEffect(() => {
    applyFit();
    window.addEventListener("resize", applyFit);
    return () => window.removeEventListener("resize", applyFit);
  }, []);

  return (
    <div className="screen-fit-wrapper" ref={wrapperRef}>
      {/* ✅ ÁREA DE VISUALIZACIÓN */}
      <div className="screen-fit-canvas">
        <div
          className="screen-fit-inner"
          style={{ transform: `scale(${scale})` }}
        >
          <iframe className="screen-iframe" src={url} />
        </div>
      </div>
      <div className="screen-toolbar">
        <button className="screen-tool-btn" onClick={resetZoom}>
          100%
        </button>
        <button className="screen-tool-btn" onClick={applyFit}>
          Encajar
        </button>
        <button className="screen-tool-btn" onClick={zoomOut}>
          −
        </button>
        <button className="screen-tool-btn" onClick={zoomIn}>
          +
        </button>

        <div style={{ fontSize: 11, opacity: 0.7, marginLeft: "5px" }}>
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}
