import React from "react";
import { FaRegFileCode } from "react-icons/fa";

export default function ScreenSelector({ screens, selected, onSelect }) {
  return (
    <div className="screen-selector">
      {screens.map((scr) => {
        const isActive = selected?.resource === scr.resource;

        return (
          <div
            key={scr.resource}
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
