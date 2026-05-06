import { useMemo, useState } from "react";

export function useVirtualRows(totalRows, rowHeight, overscan = 10) {
  const [viewport, setViewport] = useState({ height: 0, scrollTop: 0 });

  const range = useMemo(() => {
    const visibleCount = Math.ceil(viewport.height / rowHeight);
    const start = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan);
    const end = Math.min(totalRows, start + visibleCount + overscan * 2 + 1);
    return {
      start,
      end,
      offsetTop: start * rowHeight,
      totalHeight: totalRows * rowHeight,
    };
  }, [overscan, rowHeight, totalRows, viewport.height, viewport.scrollTop]);

  return { viewport, setViewport, range };
}
