// Sidebar.jsx
import React, { useState, useEffect, useRef } from "react";
import { sidebarConfig } from "../utils/sidebarConfig";
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

const groupOrder = [
  "General",
  "States",
  "Screens",
  "Fits",
  "Transactions",
  "TranMaps",
  "Errors",
];

const groupIcons = {
  General: <FaCogs />,
  States: <FaProjectDiagram />,
  Screens: <FaDesktop />,
  Fits: <FaPuzzlePiece />,
  Transactions: <FaExchangeAlt />,
  TranMaps: <FaSitemap />,
  Errors: <FaExclamationTriangle />,
};

export default function Sidebar({ xmlDoc, onSelect }) {
  if (!xmlDoc) return <aside className="sidebar">Sin XML cargado</aside>;

  const [collapsed, setCollapsed] = useState(
    Object.fromEntries(groupOrder.map((g) => [g, true]))
  );
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef(null);

  const toggleGroup = (group) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // --- Atajo Ctrl+F ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Expandir/cerrar según búsqueda ---
  useEffect(() => {
    setCollapsed((prev) => {
      const newState = { ...prev };
      if (!searchTerm) {
        groupOrder.forEach((g) => (newState[g] = true)); // todos cerrados si no hay búsqueda
        return newState;
      }
      const term = searchTerm.toLowerCase();
      groupOrder.forEach((group) => {
        const config = sidebarConfig[group];
        const section = xmlDoc.querySelector(group);
        if (!section) return;
        const children = Array.from(section.children).filter(
          (child) => child.tagName === config.childTag
        );
        const hasMatch = children.some((child) => {
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
        newState[group] = !hasMatch; // expandir si hay match
      });
      return newState;
    });
  }, [searchTerm, xmlDoc]);

  return (
    <aside className="sidebar">
      {/* 🔹 Buscador */}
      <div className="sidebar-search">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar en todo..."
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

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          children = children.filter((child) => {
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
        }

        if (children.length === 0) return null;

        return (
          <div key={group} className="sidebar-group">
            <div className="sidebar-title" onClick={() => toggleGroup(group)}>
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
                        key={idx}
                        className="sidebar-item"
                        onClick={() => onSelect(`General-${key}`)}
                      >
                        {key}
                      </li>
                    );
                  }
                  const idVal = child.getAttribute(config.idAttr);
                  const comment = child.getAttribute("Comment") || "No Comment";
                  return (
                    <li
                      key={idx}
                      className="sidebar-item"
                      onClick={() =>
                        onSelect(`${config.childTag}-${idVal || `idx${idx}`}`)
                      }
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
    </aside>
  );
}
