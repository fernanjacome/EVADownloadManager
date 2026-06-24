import React, { useEffect, useRef, useState } from "react";
import { groupOrder, sidebarConfig } from "../../../utils/sidebarConfig";
import "./Sidebar.css";
import {
  FaAngleLeft,
  FaAngleRight,
  FaChevronDown,
  FaChevronRight,
  FaCogs,
  FaDesktop,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaProjectDiagram,
  FaPuzzlePiece,
  FaSearch,
  FaSitemap,
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
  sidebarCollapsed,
  setSidebarCollapsed,
  selectedItem,
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
        if (sidebarCollapsed) {
          setSidebarCollapsed?.(false);
          setTimeout(() => searchInputRef.current?.focus(), 0);
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  useEffect(() => {
    if (!xmlDoc) return;

    setCollapsed((prev) => {
      const newState = { ...prev };
      if (!searchTerm) {
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
  }, [searchTerm, xmlDoc, setCollapsed]);

  if (sidebarCollapsed) {
    return (
      <button
        type="button"
        className="sidebar-expand-fab"
        onClick={() => setSidebarCollapsed?.(false)}
        title="Expandir arbol XML"
      >
        <FaAngleRight />
      </button>
    );
  }

  return (
    <aside
      className="sidebar"
      style={style}
    >
      <div className="sidebar-topbar">
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

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed?.((prev) => !prev)}
          title="Colapsar arbol XML"
        >
          <FaAngleLeft />
        </button>
      </div>

      {!xmlDoc ? (
        <div className="empty-state">
          <h2 style={{ width: "60%" }}>No hay XML cargado</h2>
        </div>
      ) : (
        <>
          {groupOrder.map((group) => {
            const config = sidebarConfig[group];
            const section = xmlDoc.querySelector(group);
            if (!section) return null;

            let children = Array.from(section.children).filter(
              (child) => child.tagName === config.childTag
            );

            if (searchTerm) {
              const term = searchTerm.toLowerCase();
              const groupMatches = group.toLowerCase().includes(term);

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

              if (children.length === 0 && groupMatches) {
                children = Array.from(section.children).filter(
                  (child) => child.tagName === config.childTag
                );
              }
            }

            if (children.length === 0) return null;

            return (
              <div key={group} className="sidebar-group">
                <div className="sidebar-title" onClick={() => toggleGroup(group)} title={config.label}>
                  <div className="sidebar-title-main">
                    <span className="sidebar-icon">{groupIcons[group]}</span>
                    {!sidebarCollapsed && (
                      <span className="sidebar-title-label">
                        {config.label} ({children.length})
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="sidebar-chevron">
                      {collapsed[group] ? <FaChevronRight /> : <FaChevronDown />}
                    </span>
                  )}
                </div>

                {!sidebarCollapsed && !collapsed[group] && (
                  <ul className="sidebar-list">
                    {children.map((child, idx) => {
                      if (group === "General") {
                        const key = child.getAttribute("Key");
                        return (
                          <li
                            key={`${group}-${key}-${idx}`}
                            className={`sidebar-item ${selectedItem === `General-${key}` ? "active" : ""}`}
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
                          key={`${group}-${idVal || `idx${idx}`}`}
                          className={`sidebar-item ${
                            selectedItem === `${config.childTag}-${idVal || `idx${idx}`}` ? "active" : ""
                          }`}
                          onClick={() =>
                            onSelect(`${config.childTag}-${idVal || `idx${idx}`}`)
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
