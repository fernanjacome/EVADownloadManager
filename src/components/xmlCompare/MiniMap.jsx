import React, { memo } from "react";

function MiniMap({ lines, activeIndex, onJump }) {
  const total = Math.max(lines.length, 1);
  const activeTop = `${(activeIndex / total) * 100}%`;

  return (
    <aside className="xml-minimap" title="Mapa de diferencias">
      <div className="xml-minimap-track" onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientY - rect.top) / rect.height;
        onJump?.(Math.max(0, Math.min(lines.length - 1, Math.floor(ratio * total))));
      }}>
        {lines.map((line, index) => {
          if (line.type === "equal" && index % 10 !== 0) return null;
          return (
            <button
              key={`${line.id}-${index}`}
              type="button"
              className={`xml-minimap-mark is-${line.type} ${line.moved ? "is-moved" : ""}`}
              style={{
                top: `${(index / total) * 100}%`,
                height: `${Math.max(0.22, 100 / total)}%`,
              }}
              onClick={(event) => {
                event.stopPropagation();
                onJump?.(index);
              }}
              aria-label={`Ir a linea ${index + 1}`}
            />
          );
        })}
        <div className="xml-minimap-cursor" style={{ top: activeTop }} />
      </div>
    </aside>
  );
}

export default memo(MiniMap);
