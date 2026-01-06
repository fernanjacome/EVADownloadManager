// Sidebar.jsx
import React, { useState, useEffect, useRef } from "react";
import { groupOrder, sidebarConfig } from "../../../utils/sidebarConfig";
import "./Sidebar.css";
import {
  FaCogs,
  FaProjectDiagram,
  FaDesktop,
  FaPuzzlePiece,
  FaExchangeAlt,
  FaSitemap,
  FaExclamationTriangle,
  FaSearch,
} from "react-icons/fa";

const groupIcons = {
  General: <FaCogs />,
  States: <FaProjectDiagram />,
  Screens: <FaDesktop />,
  Fits: <FaPuzzlePiece />,
  Transactions: <FaExchangeAlt />,
  TranMaps: <FaSitemap />,
  Errors: <FaExclamationTriangle />,
};

export default function Sidebar({
  xmlDoc,
  onSelect,
  style,
  setCollapsed,
  collapsed,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef(null);

  const toggleGroup = (group) => {
    setCollapsed((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Expandir/cerrar según búsqueda ---
  useEffect(() => {
    if (!xmlDoc) return; // evitar errores cuando no hay XML

    setCollapsed((prev) => {
      const newState = { ...prev };
      if (!searchTerm) {
        // groupOrder.forEach((g) => (newState[g] = true));
        // return newState;
        return prev;
      }
      const term = searchTerm.toLowerCase();
      groupOrder.forEach((group) => {
        const config = sidebarConfig[group];
        const section = xmlDoc.querySelector(group);
        if (!section) return;
        const children = Array.from(section.children).filter(
          (child) => child.tagName === config.childTag
        );
        const hasMatch =
          group.toLowerCase().includes(term) ||
          children.some((child) => {
            const idVal = child.getAttribute(config.idAttr) || "";
            const comment = child.getAttribute("Comment") || "";
            const key = child.getAttribute("Key") || "";
            const code = child.getAttribute("Code") || "";
            const text = child.textContent || "";
            return (
              idVal.toLowerCase().includes(term) ||
              comment.toLowerCase().includes(term) ||
              key.toLowerCase().includes(term) ||
              code.toLowerCase().includes(term) ||
              text.toLowerCase().includes(term)
            );
          });
        newState[group] = !hasMatch;
      });
      return newState;
    });
  }, [searchTerm, xmlDoc]);

  return (
    <aside className="sidebar" style={style}>
      {!xmlDoc ? (
        // 🔹 Estado vacío cuando no hay XML
        <div className="empty-state">
          <h2 style={{ width: "60%" }}>No hay XML cargado</h2>
        </div>
      ) : (
        <>
          {/* 🔹 Buscador */}
          <div className="sidebar-search">
            <div className="search-box">
              <FaSearch className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
              />
            </div>
          </div>

          {/* 🔹 Grupos */}
          {groupOrder.map((group) => {
            const config = sidebarConfig[group];
            const section = xmlDoc.querySelector(group);
            if (!section) return null;

            let children = Array.from(section.children).filter(
              (child) => child.tagName === config.childTag
            );

            // 🔹 Filtrado
            if (searchTerm) {
              const term = searchTerm.toLowerCase();
              const groupMatches = group.toLowerCase().includes(term); // ✅ Coincidencia por nombre de grupo

              children = children.filter((child) => {
                const idVal = child.getAttribute(config.idAttr) || "";
                const comment = child.getAttribute("Comment") || "";
                const key = child.getAttribute("Key") || "";
                const code = child.getAttribute("Code") || "";
                const type = child.getAttribute("Type") || "";
                const text = child.textContent || "";
                return (
                  idVal.toLowerCase().includes(term) ||
                  comment.toLowerCase().includes(term) ||
                  key.toLowerCase().includes(term) ||
                  code.toLowerCase().includes(term) ||
                  type.toLowerCase().includes(term) ||
                  text.toLowerCase().includes(term)
                );
              });

              // ✅ Si no hay hijos pero el grupo coincide con la búsqueda, mantenlo
              if (children.length === 0 && groupMatches) {
                children = Array.from(section.children).filter(
                  (child) => child.tagName === config.childTag
                );
              }
            }

            if (children.length === 0) return null;

            return (
              <div key={group} className="sidebar-group">
                <div
                  className="sidebar-title"
                  onClick={() => toggleGroup(group)}
                >
                  <span className="sidebar-icon">{groupIcons[group]}</span>
                  {config.label} ({children.length})
                </div>
                {!collapsed[group] && (
                  <ul className="sidebar-list">
                    {children.map((child, idx) => {
                      if (group === "General") {
                        const key = child.getAttribute("Key");
                        return (
                          <li
                            key={`${group}-${key}-${idx}`}
                            className="sidebar-item"
                            onClick={() => onSelect(`General-${key}`)}
                          >
                            {key}
                          </li>
                        );
                      }
                      const idVal = child.getAttribute(config.idAttr);
                      const comment =
                        child.getAttribute("Comment") || "No Comment";
                      return (
                        <li
                          key={`${group}-${idVal || `idx${idx}`}`}
                          className="sidebar-item"
                          onClick={() =>
                            onSelect(
                              `${config.childTag}-${idVal || `idx${idx}`}`
                            )
                          }
                          title={comment}
                        >
                          [{config.childTag}] {idVal} - {comment}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
    </aside>
  );
}
