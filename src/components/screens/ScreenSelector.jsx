import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaChevronDown,
  FaChevronRight,
  FaCode,
  FaCss3,
  FaFile,
  FaFileAlt,
  FaFileImage,
  FaFolder,
  FaFolderOpen,
  FaFont,
  FaHtml5,
  FaJs,
} from "react-icons/fa";

const pathParts = (value) => String(value || "").split("/").filter(Boolean);

function buildTree(resources) {
  const root = { children: new Map() };

  resources.forEach((resource) => {
    const parts = pathParts(resource.path);
    let branch = root;
    parts.forEach((part, index) => {
      if (!branch.children.has(part)) {
        branch.children.set(part, {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          type: index === parts.length - 1 ? resource.type : "directory",
          resource: index === parts.length - 1 ? resource : null,
          children: new Map(),
        });
      }
      branch = branch.children.get(part);
      if (index === parts.length - 1 && resource.type === "directory") branch.type = "directory";
    });
  });

  return root;
}

function fileIcon(extension) {
  switch (String(extension || "").toLowerCase()) {
    case ".html":
    case ".htm":
      return { icon: <FaHtml5 />, type: "html" };
    case ".css":
    case ".scss":
      return { icon: <FaCss3 />, type: "css" };
    case ".js":
    case ".jsx":
    case ".ts":
    case ".tsx":
      return { icon: <FaJs />, type: "js" };
    case ".json":
      return { icon: <FaCode />, type: "json" };
    case ".xml":
      return { icon: <FaCode />, type: "xml" };
    case ".svg":
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".webp":
      return { icon: <FaFileImage />, type: "image" };
    case ".woff":
    case ".woff2":
    case ".ttf":
      return { icon: <FaFont />, type: "font" };
    case ".txt":
      return { icon: <FaFileAlt />, type: "text" };
    default:
      return { icon: <FaFile />, type: "file" };
  }
}

function InlineInput({
  depth,
  isDirectory,
  existingNames,
  initialValue = "",
  placeholder,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);
  const doneRef = useRef(false);
  const [value, setValue] = useState(initialValue);
  const isDuplicate = value.trim() && existingNames.has(value.trim().toLowerCase());

  useEffect(() => {
    setTimeout(() => {
      ref.current?.focus();
      if (initialValue) ref.current?.select();
    }, 0);
  }, []);

  const finish = (name) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (name && !existingNames.has(name.toLowerCase())) onConfirm(name);
    else onCancel();
  };

  return (
    <div className="screen-tree-row screen-tree-inline" style={{ paddingLeft: `${8 + depth * 16}px` }}>
      <span className="screen-tree-toggle" />
      <span className={`screen-tree-icon ${isDirectory ? "folder" : "file-file"}`}>
        {isDirectory ? <FaFolderOpen /> : <FaFile />}
      </span>
      <input
        ref={ref}
        className={`screen-tree-inline-input ${isDuplicate ? "duplicate" : ""}`}
        value={value}
        onChange={(e) => { e.stopPropagation(); setValue(e.target.value); }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); finish(value.trim()); }
          if (e.key === "Escape") { e.preventDefault(); finish(null); }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onBlur={() => setTimeout(() => finish(value.trim()), 0)}
        placeholder={placeholder || (isDirectory ? "nombre-carpeta" : "nombre-archivo.html")}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export default function ScreenSelector({
  resources,
  selectedResource,
  selectedPaths,
  onSelect,
  onDoubleClick,
  onMultiSelect,
  onShiftSelect,
  filterActive = false,
  folderKey,
  collapseAllToken = 0,
  dirtyPaths = new Set(),
  errorPaths,
  errorDirPaths,
  onContextMenu,
  inlineCreate,
  onInlineCreateConfirm,
  onInlineCreateCancel,
  inlineRename,
  onInlineRenameConfirm,
  onInlineRenameCancel,
  revealPath,
}) {
  const tree = useMemo(() => buildTree(resources), [resources]);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const directoryPaths = useMemo(
    () => resources.filter((resource) => resource.type === "directory").map((resource) => resource.path),
    [resources],
  );

  useEffect(() => {
    setCollapsed(new Set(directoryPaths));
  }, [folderKey, directoryPaths]);

  useEffect(() => {
    if (!collapseAllToken) return;
    setCollapsed(new Set(directoryPaths));
  }, [collapseAllToken, directoryPaths]);

  useEffect(() => {
    if (!inlineCreate) return;
    if (inlineCreate.parentPath) {
      setCollapsed((c) => {
        const next = new Set(c);
        next.delete(inlineCreate.parentPath);
        return next;
      });
    }
  }, [inlineCreate]);

  useEffect(() => {
    const path = revealPath?.path;
    if (!path) return;
    const parts = pathParts(path);
    setCollapsed((current) => {
      const next = new Set(current);
      for (let i = 1; i < parts.length; i++) {
        next.delete(parts.slice(0, i).join("/"));
      }
      return next;
    });
  }, [revealPath]);

  useEffect(() => {
    if (!selectedResource?.path) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(".screen-selector .screen-tree-row.active")
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedResource?.path, collapsed, tree]);

  const toggle = (resourcePath) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(resourcePath)) next.delete(resourcePath);
      else {
        directoryPaths
          .filter((path) => path === resourcePath || path.startsWith(`${resourcePath}/`))
          .forEach((path) => next.add(path));
      }
      return next;
    });
  };

  const filePaths = useMemo(() =>
    resources.filter((r) => r.type === "file").map((r) => r.path),
    [resources],
  );

  const handleClick = (event, node) => {
    const item = node.resource || { type: node.type, path: node.path, name: node.name };

    if ((event.ctrlKey || event.metaKey) && onMultiSelect) {
      onMultiSelect(item);
      return;
    }

    if (node.type === "directory") {
      onSelect(item);
      toggle(node.path);
      return;
    }

    if (event.shiftKey && onShiftSelect && selectedResource) {
      const fromIdx = filePaths.indexOf(selectedResource.path);
      const toIdx = filePaths.indexOf(node.path);
      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        onShiftSelect(filePaths.slice(start, end + 1));
        return;
      }
    }
    onSelect(node.resource);
  };

  const inlineParent = inlineCreate?.parentPath ?? null;
  const inlineType = inlineCreate?.type ?? "file";

  const getSiblingNames = (parentPath, excludedName = "") => {
    const prefix = parentPath ? `${parentPath}/` : "";
    const names = new Set();
    resources.forEach((r) => {
      if (prefix && r.path.startsWith(prefix)) {
        const rest = r.path.slice(prefix.length);
        if (!rest.includes("/") && rest.toLowerCase() !== excludedName.toLowerCase()) {
          names.add(rest.toLowerCase());
        }
      } else if (!prefix) {
        const first = r.path.split("/")[0];
        if (first.toLowerCase() !== excludedName.toLowerCase()) {
          names.add(first.toLowerCase());
        }
      }
    });
    return names;
  };

  const createSiblingNames = useMemo(
    () =>
      inlineCreate
        ? getSiblingNames(inlineCreate.parentPath)
        : new Set(),
    [inlineCreate, resources],
  );

  const renameSiblingNames = useMemo(
    () =>
      inlineRename
        ? getSiblingNames(inlineRename.parentPath, inlineRename.name)
        : new Set(),
    [inlineRename, resources],
  );

  const renderInlineInput = (depth) => {
    if (!inlineCreate) return null;
    return (
      <InlineInput
        key={inlineCreate.id || 0}
        depth={depth}
        isDirectory={inlineType === "directory"}
        existingNames={createSiblingNames}
        onConfirm={onInlineCreateConfirm}
        onCancel={onInlineCreateCancel}
      />
    );
  };

  const renderNodes = (nodes, depth = 0) =>
    [...nodes.values()]
      .sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name, undefined, { numeric: true });
        return a.type === "directory" ? -1 : 1;
      })
      .map((node) => {
        const isDirectory = node.type === "directory";
        const isCollapsed = !filterActive && collapsed.has(node.path);
        const isSelected = selectedResource?.path === node.path;
        const isMultiSelected = selectedPaths?.has(node.path);
        const hasErrors = isDirectory ? errorDirPaths?.has(node.path) : errorPaths?.has(node.path);
        const hasChildren = node.children.size > 0;

        if (inlineRename?.path === node.path) {
          return (
            <React.Fragment key={node.path}>
              <InlineInput
                key={inlineRename.id || node.path}
                depth={depth}
                isDirectory={isDirectory}
                existingNames={renameSiblingNames}
                initialValue={node.name}
                placeholder={node.name}
                onConfirm={onInlineRenameConfirm}
                onCancel={onInlineRenameCancel}
              />
              {isDirectory && !isCollapsed ? renderNodes(node.children, depth + 1) : null}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={node.path}>
            <button
              type="button"
              className={`screen-tree-row ${isSelected ? "active" : ""} ${isMultiSelected ? "multi-selected" : ""} ${hasErrors ? "has-errors" : ""}`}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
              onClick={(e) => handleClick(e, node)}
              onDoubleClick={() => (!isDirectory && onDoubleClick?.(node.resource))}
              onContextMenu={(event) => {
                event.preventDefault();
                onContextMenu?.(event, node.resource || {
                  type: "directory",
                  path: node.path,
                  name: node.name,
                });
              }}
              title={node.path}
            >
              {depth > 0 ? (
                <span className="screen-tree-guides" aria-hidden="true">
                  {Array.from({ length: depth }, (_, index) => (
                    <i key={index} style={{ left: `${8 + index * 16 + 5}px` }} />
                  ))}
                </span>
              ) : null}
              <span className="screen-tree-toggle">
                {isDirectory && hasChildren ? isCollapsed ? <FaChevronRight /> : <FaChevronDown /> : null}
              </span>
              <span className={`screen-tree-icon ${isDirectory ? "folder" : `file-${fileIcon(node.resource?.extension).type}`}`}>
                {isDirectory ? isCollapsed ? <FaFolder /> : <FaFolderOpen /> : fileIcon(node.resource?.extension).icon}
              </span>
              <span className="screen-tree-name">{node.name}</span>
              {!isDirectory && dirtyPaths.has(node.path) ? <span className="screen-tree-dirty" aria-label="Cambios sin guardar" /> : null}
            </button>
            {isDirectory && !isCollapsed ? (
              <>
                {inlineParent === node.path ? renderInlineInput(depth + 1) : null}
                {renderNodes(node.children, depth + 1)}
              </>
            ) : null}
          </React.Fragment>
        );
      });

  return (
    <div
      className="screen-selector"
      onContextMenu={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          onContextMenu?.(event, { type: "directory", path: "", name: "Carpeta" });
        }
      }}
    >
      {inlineParent === "" ? renderInlineInput(0) : null}
      {renderNodes(tree.children)}
    </div>
  );
}
