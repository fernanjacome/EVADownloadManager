import React, { useEffect, useRef } from "react";
import { FaRegFileCode } from "react-icons/fa";

export default function ScreenSelector({ screens, selected, onSelect }) {
  const selectedRef = useRef(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  return (
    <div className="screen-selector">
      {screens.map((scr) => {
        const isActive = selected?.resource === scr.resource;

        return (
          <div
            key={scr.resource}
            ref={isActive ? selectedRef : null}
            className={`screen-item ${isActive ? "active" : ""}`}
            onClick={() => onSelect(scr)}
          >
            <FaRegFileCode className="screen-icon" />

            <div className="screen-text">
              <div className="screen-name">{scr.resource}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
