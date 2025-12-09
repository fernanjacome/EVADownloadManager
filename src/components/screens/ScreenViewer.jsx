import { useEffect, useState } from "react";

export default function ScreenViewer({ folder, resource }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const load = async () => {
      const baseUrl = await window.electronAPI.startStaticServer(folder);
      const finalUrl = `${baseUrl}/${resource}?v=${Date.now()}`;
      setUrl(finalUrl);
    };

    load();
  }, [folder, resource]);

  return (
    <div className="screen-frame-wrapper">
      <iframe className="screen-iframe" src={url} />
    </div>
  );
}
