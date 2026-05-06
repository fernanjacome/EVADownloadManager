import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateDiffModel } from "../../diff/XmlDiffEngine";
import DiffPane, { ROW_HEIGHT } from "./DiffPane";
import MiniMap from "./MiniMap";
import Toolbar from "./Toolbar";
import ConfirmModal from "../utils/ConfirmModal";
import "./XmlCompareView.css";

const DEFAULT_OPTIONS = {
  ignoreWhitespace: false,
  ignoreComments: false,
  caseSensitive: true,
};

export default function XmlCompareView({
  currentXml = "",
  currentFileName = "XML actual",
  currentFilePath = "",
  notify,
  initialState,
  onStateChange,
  onSideSaved,
}) {
  const initialLeftText = initialState?.leftText ?? "";
  const initialRightText = initialState?.rightText ?? "";
  const initialLeftName = initialState?.leftName ?? "Izquierda sin archivo";
  const initialRightName = initialState?.rightName ?? "Derecha sin archivo";
  const initialLeftPath = initialState?.leftPath ?? "";
  const initialRightPath = initialState?.rightPath ?? "";
  const initialSavedLeftText = initialState?.savedLeftText ?? initialLeftText;
  const initialSavedRightText = initialState?.savedRightText ?? initialRightText;
  const [leftText, setLeftText] = useState(initialLeftText);
  const [rightText, setRightText] = useState(initialRightText);
  const [savedLeftText, setSavedLeftText] = useState(initialSavedLeftText);
  const [savedRightText, setSavedRightText] = useState(initialSavedRightText);
  const [leftName, setLeftName] = useState(initialLeftName);
  const [rightName, setRightName] = useState(initialRightName);
  const [leftPath, setLeftPath] = useState(initialLeftPath);
  const [rightPath, setRightPath] = useState(initialRightPath);
  const [options, setOptions] = useState(initialState?.options ?? DEFAULT_OPTIONS);
  const [activeIndex, setActiveIndex] = useState(initialState?.activeIndex ?? 0);
  const [collapseEqualBlocks, setCollapseEqualBlocks] = useState(!!initialState?.collapseEqualBlocks);
  const [changeLog, setChangeLog] = useState(initialState?.changeLog ?? []);
  const [originalSnapshot, setOriginalSnapshot] = useState(
    initialState?.originalSnapshot ?? {
      leftText: initialLeftText,
      rightText: initialRightText,
      leftName: initialLeftName,
      rightName: initialRightName,
      leftPath: initialLeftPath,
      rightPath: initialRightPath,
    },
  );
  const [scrollState, setScrollState] = useState(
    initialState?.scrollState ?? { left: 0, right: 0 },
  );
  const [changeLogHeight, setChangeLogHeight] = useState(initialState?.changeLogHeight ?? 118);
  const [showRestoreOriginalConfirm, setShowRestoreOriginalConfirm] = useState(false);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const latestTextsRef = useRef({ leftText: initialLeftText, rightText: initialRightText });
  const syncingRef = useRef(false);
  const restoredScrollRef = useRef(false);
  const fileInputRef = useRef(null);
  const pendingSideRef = useRef("left");

  const model = useMemo(() => {
    return generateDiffModel(leftText, rightText, options);
  }, [leftText, rightText, options]);

  const displayLines = useMemo(
    () => (collapseEqualBlocks ? collapseEqualRuns(model.lines) : model.lines),
    [collapseEqualBlocks, model.lines],
  );

  const annotatedLines = useMemo(() => annotateDiffBlocks(displayLines), [displayLines]);

  const diffIndexes = useMemo(
    () => annotatedLines.map((line, index) => (line.type === "equal" ? -1 : index)).filter((index) => index >= 0),
    [annotatedLines],
  );

  useEffect(() => {
    latestTextsRef.current = { leftText, rightText };
  }, [leftText, rightText]);

  useEffect(() => {
    onStateChange?.({
      leftText,
      rightText,
      savedLeftText,
      savedRightText,
      leftName,
      rightName,
      leftPath,
      rightPath,
      options,
      activeIndex,
      collapseEqualBlocks,
      changeLog,
      originalSnapshot,
      scrollState,
      changeLogHeight,
    });
  }, [
    activeIndex,
    changeLog,
    changeLogHeight,
    collapseEqualBlocks,
    leftName,
    leftPath,
    leftText,
    onStateChange,
    options,
    originalSnapshot,
    rightName,
    rightPath,
    rightText,
    savedLeftText,
    savedRightText,
    scrollState,
  ]);

  useEffect(() => {
    if (restoredScrollRef.current || !leftRef.current || !rightRef.current) return;
    leftRef.current.scrollTop = scrollState.left || 0;
    rightRef.current.scrollTop = scrollState.right || 0;
    restoredScrollRef.current = true;
  }, [scrollState.left, scrollState.right]);

  const jumpTo = useCallback((index) => {
    const safeIndex = Math.max(0, Math.min(annotatedLines.length - 1, index));
    setActiveIndex(safeIndex);
    const scrollTop = Math.max(0, safeIndex * ROW_HEIGHT - ROW_HEIGHT * 6);
    syncingRef.current = true;
    if (leftRef.current) leftRef.current.scrollTop = scrollTop;
    if (rightRef.current) rightRef.current.scrollTop = scrollTop;
    setScrollState({ left: scrollTop, right: scrollTop });
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [annotatedLines.length]);

  const handlePaneScroll = useCallback((source, scrollTop) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const target = source === "left" ? rightRef.current : leftRef.current;
    if (target && Math.abs(target.scrollTop - scrollTop) > 1) {
      target.scrollTop = scrollTop;
    }
    setScrollState({ left: scrollTop, right: scrollTop });
    setActiveIndex(Math.max(0, Math.min(annotatedLines.length - 1, Math.round(scrollTop / ROW_HEIGHT))));
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [annotatedLines.length]);

  const moveDiff = (direction) => {
    if (!diffIndexes.length) return;
    const currentSlot = diffIndexes.findIndex((index) => index >= activeIndex);
    const baseSlot = currentSlot === -1 ? diffIndexes.length - 1 : currentSlot;
    const nextSlot = (baseSlot + direction + diffIndexes.length) % diffIndexes.length;
    jumpTo(diffIndexes[nextSlot]);
  };

  const pickFile = async (side) => {
    if (window.electronAPI?.openFileDialog && window.electronAPI?.readFile) {
      const path = await window.electronAPI.openFileDialog();
      if (!path) return;
      const res = await window.electronAPI.readFile(path);
      if (!res?.success) {
        notify?.("error", "No se pudo leer el XML seleccionado.");
        return;
      }
      loadTextIntoSide(res.data, side, path, path);
      notify?.("success", `XML ${side === "left" ? "izquierdo" : "derecho"} cargado.`);
      return;
    }

    pendingSideRef.current = side;
    fileInputRef.current?.click();
  };

  const loadTextIntoSide = (text, side, name, path = "") => {
    const nextLeftText = side === "left" ? text : leftText;
    const nextRightText = side === "right" ? text : rightText;
    const nextLeftName = side === "left" ? name : leftName;
    const nextRightName = side === "right" ? name : rightName;
    const nextLeftPath = side === "left" ? path : leftPath;
    const nextRightPath = side === "right" ? path : rightPath;
    if (side === "left") {
      setLeftText(nextLeftText);
      setLeftName(nextLeftName);
      setLeftPath(nextLeftPath);
      setSavedLeftText(nextLeftText);
    } else {
      setRightText(nextRightText);
      setRightName(nextRightName);
      setRightPath(nextRightPath);
      setSavedRightText(nextRightText);
    }
    setOriginalSnapshot({
      leftText: nextLeftText,
      rightText: nextRightText,
      leftName: nextLeftName,
      rightName: nextRightName,
      leftPath: nextLeftPath,
      rightPath: nextRightPath,
    });
    setChangeLog([]);
  };

  const readFile = async (file, side) => {
    const text = await file.text();
    const path = file.path || (await window.electronAPI?.getDroppedFilePath?.(file)) || "";
    loadTextIntoSide(text, side, path || file.name, path);
    notify?.("success", `XML ${side === "left" ? "izquierdo" : "derecho"} cargado.`);
  };

  const handleSelectedFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await readFile(file, pendingSideRef.current);
  };

  const useCurrentXml = async (side = "left") => {
    if (!currentXml?.trim()) {
      notify?.("info", "No hay XML actual cargado para usar como base.");
      return;
    }
    const currentName = currentFilePath || currentFileName || "XML actual";
    if (side === "left") {
      setLeftText(currentXml);
      setSavedLeftText(currentXml);
      setLeftName(currentName);
      setLeftPath(currentFilePath || (isLikelyPath(currentName) ? currentName : ""));
    } else {
      setRightText(currentXml);
      setSavedRightText(currentXml);
      setRightName(currentName);
      setRightPath(currentFilePath || (isLikelyPath(currentName) ? currentName : ""));
    }
    setOriginalSnapshot({
      leftText: side === "left" ? currentXml : leftText,
      rightText: side === "right" ? currentXml : rightText,
      leftName: side === "left" ? currentName : leftName,
      rightName: side === "right" ? currentName : rightName,
      leftPath: side === "left" ? currentFilePath || (isLikelyPath(currentName) ? currentName : "") : leftPath,
      rightPath: side === "right" ? currentFilePath || (isLikelyPath(currentName) ? currentName : "") : rightPath,
    });
    setChangeLog([]);
  };

  const saveSideText = async (side, text, preferredPath = "") => {
    let path = preferredPath || (side === "left" ? leftPath : rightPath);
    const name = side === "left" ? leftName : rightName;

    if (!path && isLikelyPath(name)) {
      path = name;
    }

    if (!path) {
      if (!text.trim()) return true;
      path = await window.electronAPI?.showSaveDialog?.({
        defaultPath: side === "left" ? "izquierda.xml" : "derecha.xml",
        filters: [{ name: "XML", extensions: ["xml"] }],
      });
      if (!path) return false;
    }

    const res = await window.electronAPI?.writeFile?.(path, text);
    if (!res?.success) {
      notify?.("error", res?.error || "No se pudo guardar el XML.");
      return false;
    }

    if (side === "left") {
      setLeftPath(path);
      setLeftName(path);
      setSavedLeftText(text);
    } else {
      setRightPath(path);
      setRightName(path);
      setSavedRightText(text);
    }
    await onSideSaved?.({ side, path, text });
    notify?.("success", `Cambio guardado en archivo ${side === "left" ? "izquierdo" : "derecho"}.`);
    return path;
  };

  const saveBothTexts = async (nextLeftText, nextRightText) => {
    const leftSaved = await saveSideText("left", nextLeftText);
    if (!leftSaved) return false;
    const rightSaved = await saveSideText("right", nextRightText);
    return rightSaved;
  };

  const registerChange = (description, detail, previousLeftText, previousRightText) => {
    setChangeLog((prev) => [
      {
        id: crypto.randomUUID(),
        description,
        detail,
        previousLeftText,
        previousRightText,
        createdAt: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 29),
    ]);
  };

  const restoreChange = async (entry) => {
    setLeftText(entry.previousLeftText);
    setRightText(entry.previousRightText);
    setChangeLog((prev) => {
      const restoreIndex = prev.findIndex((item) => item.id === entry.id);
      return restoreIndex >= 0 ? prev.slice(restoreIndex + 1) : prev;
    });
  };

  const restoreLastChange = useCallback(() => {
    const last = changeLog[0];
    if (!last) return;
    setChangeLog((prev) => {
      if (!prev.length) return prev;
      const [, ...rest] = prev;
      return rest;
    });
    setLeftText(last.previousLeftText);
    setRightText(last.previousRightText);
  }, [changeLog]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        restoreLastChange();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [restoreLastChange]);

  const restoreAllChanges = () => {
    if (!changeLog.length) return;
    const oldest = changeLog[changeLog.length - 1];
    setLeftText(oldest.previousLeftText);
    setRightText(oldest.previousRightText);
    setChangeLog([]);
  };

  const restoreOriginalSnapshot = () => {
    setLeftText(originalSnapshot.leftText);
    setRightText(originalSnapshot.rightText);
    setLeftName(originalSnapshot.leftName);
    setRightName(originalSnapshot.rightName);
    setLeftPath(originalSnapshot.leftPath || "");
    setRightPath(originalSnapshot.rightPath || "");
    setChangeLog([]);
  };

  const clearSide = (side) => {
    if (side === "left") {
      setLeftText("");
      setLeftName("Izquierda sin archivo");
      setLeftPath("");
      setSavedLeftText("");
    } else {
      setRightText("");
      setRightName("Derecha sin archivo");
      setRightPath("");
      setSavedRightText("");
    }
    setChangeLog([]);
  };

  const copyAcross = (line, side, rowIndex) => {
    if (line.type === "equal") return;
    const blockStart = line.blockStart ?? rowIndex;
    const blockEnd = line.blockEnd ?? rowIndex;
    const rows = annotatedLines
      .slice(blockStart, blockEnd + 1)
      .map((blockLine, offset) => ({ line: blockLine, rowIndex: blockStart + offset }))
      .filter((item) => item.line && item.line.type !== "equal" && !item.line.collapsed);

    if (!rows.length) return;

    const previousLeftText = latestTextsRef.current.leftText;
    const previousRightText = latestTextsRef.current.rightText;
    let nextLeftText = previousLeftText;
    let nextRightText = previousRightText;

    if (side === "left") {
      [...rows].sort((a, b) => b.rowIndex - a.rowIndex).forEach((item) => {
        if (item.line.leftContent == null) {
          nextRightText = deleteAlignedLine(nextRightText, item.line.rightLineNumber);
        } else {
          nextRightText = applyAlignedCopy(
            nextRightText,
            item.line.rightLineNumber,
            item.line.leftContent,
            annotatedLines,
            item.rowIndex,
            "right",
          );
        }
      });
    } else {
      [...rows].sort((a, b) => b.rowIndex - a.rowIndex).forEach((item) => {
        if (item.line.rightContent == null) {
          nextLeftText = deleteAlignedLine(nextLeftText, item.line.leftLineNumber);
        } else {
          nextLeftText = applyAlignedCopy(
            nextLeftText,
            item.line.leftLineNumber,
            item.line.rightContent,
            annotatedLines,
            item.rowIndex,
            "left",
          );
        }
      });
    }

    if (nextLeftText === previousLeftText && nextRightText === previousRightText) return;

    registerChange(
      `${rows.length} cambio${rows.length === 1 ? "" : "s"} copiado${rows.length === 1 ? "" : "s"} hacia ${side === "left" ? "derecha" : "izquierda"}`,
      summarizeCopiedRows(rows, side),
      previousLeftText,
      previousRightText,
    );
    setLeftText(nextLeftText);
    setRightText(nextRightText);
  };

  return (
    <div className="xml-compare-shell">
      <input ref={fileInputRef} className="xml-file-input" type="file" accept=".xml,text/xml,*/*" onChange={handleSelectedFile} />
      <Toolbar
        options={options}
        setOptions={setOptions}
        onPickLeft={() => pickFile("left")}
        onPickRight={() => pickFile("right")}
        onUseCurrent={useCurrentXml}
        onPrev={() => moveDiff(-1)}
        onNext={() => moveDiff(1)}
        collapseEqualBlocks={collapseEqualBlocks}
        onRestoreOriginal={() => setShowRestoreOriginalConfirm(true)}
        onToggleCollapse={() => {
          setCollapseEqualBlocks((value) => !value);
          jumpTo(0);
        }}
      />

      <div className="xml-compare-body">
        <div className="xml-diff-grid">
          <DiffPane
            ref={leftRef}
            title="Izquierda"
            subtitle={leftPath || leftName}
            side="left"
            lines={annotatedLines}
            activeIndex={activeIndex}
            onScroll={handlePaneScroll}
            onDropFile={readFile}
            onCopyAcross={copyAcross}
            onSaveSide={() => saveSideText("left", leftText)}
            onClearSide={clearSide}
            canSave={!!leftText.trim() && leftText !== savedLeftText}
            canClear={!!leftText.trim()}
          />
          <div className="xml-connector-gutter" aria-hidden="true">
            {annotatedLines.slice(Math.max(0, activeIndex - 12), activeIndex + 13).map((line, localIndex) => {
              if (line.type === "equal") return null;
              return (
                <span
                  key={`connector-${line.id}-${localIndex}`}
                  className={`xml-connector is-${line.type}`}
                  style={{ top: 26 + localIndex * ROW_HEIGHT }}
                />
              );
            })}
          </div>
          <DiffPane
            ref={rightRef}
            title="Derecha"
            subtitle={rightPath || rightName}
            side="right"
            lines={annotatedLines}
            activeIndex={activeIndex}
            onScroll={handlePaneScroll}
            onDropFile={readFile}
            onCopyAcross={copyAcross}
            onSaveSide={() => saveSideText("right", rightText)}
            onClearSide={clearSide}
            canSave={!!rightText.trim() && rightText !== savedRightText}
            canClear={!!rightText.trim()}
          />
        </div>
        <MiniMap lines={annotatedLines} activeIndex={activeIndex} onJump={jumpTo} />
      </div>
      <ChangeLogPanel
        entries={changeLog}
        height={changeLogHeight}
        onResize={setChangeLogHeight}
        onRestore={restoreChange}
        onRestoreAll={restoreAllChanges}
      />
      <ConfirmModal
        isOpen={showRestoreOriginalConfirm}
        onClose={() => setShowRestoreOriginalConfirm(false)}
        onConfirm={() => {
          restoreOriginalSnapshot();
          setShowRestoreOriginalConfirm(false);
        }}
        title="Restaurar comparador"
        message="Se restauraran ambos lados al estado original cargado y se limpiara el registro de cambios."
      />
    </div>
  );
}

function applyAlignedCopy(text, lineNumber, newContent, diffLines, rowIndex, targetSide) {
  const textLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!lineNumber) {
    const insertionIndex = resolveInsertionIndex(diffLines, rowIndex, targetSide);
    if (textLines[insertionIndex] === newContent || textLines[insertionIndex - 1] === newContent) {
      return text;
    }
    textLines.splice(insertionIndex, 0, newContent);
  } else {
    if (textLines[lineNumber - 1] === newContent) return text;
    textLines[lineNumber - 1] = newContent;
  }
  return textLines.join("\n");
}

function deleteAlignedLine(text, lineNumber) {
  if (!lineNumber) return text;
  const textLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lineNumber < 1 || lineNumber > textLines.length) return text;
  textLines.splice(lineNumber - 1, 1);
  return textLines.join("\n");
}

function resolveInsertionIndex(diffLines, rowIndex, targetSide) {
  const numberKey = targetSide === "left" ? "leftLineNumber" : "rightLineNumber";

  for (let i = rowIndex + 1; i < diffLines.length; i += 1) {
    const nextLineNumber = diffLines[i]?.[numberKey];
    if (nextLineNumber) return nextLineNumber - 1;
  }

  for (let i = rowIndex - 1; i >= 0; i -= 1) {
    const previousLineNumber = diffLines[i]?.[numberKey];
    if (previousLineNumber) return previousLineNumber;
  }

  return 0;
}

function annotateDiffBlocks(lines) {
  const annotated = lines.map((line) => ({ ...line }));
  let index = 0;

  while (index < annotated.length) {
    const line = annotated[index];
    if (line.type === "equal" || line.collapsed) {
      index += 1;
      continue;
    }

    const start = index;
    let end = index;
    while (
      end + 1 < annotated.length &&
      annotated[end + 1].type !== "equal" &&
      !annotated[end + 1].collapsed
    ) {
      end += 1;
    }

    for (let i = start; i <= end; i += 1) {
      annotated[i].blockStart = start;
      annotated[i].blockEnd = end;
      annotated[i].blockId = `block-${start}-${end}`;
    }

    let leftCopyStart = annotated.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex >= start && candidateIndex <= end && candidate.leftContent != null,
    );
    let rightCopyStart = annotated.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex >= start && candidateIndex <= end && candidate.rightContent != null,
    );
    if (leftCopyStart < start) leftCopyStart = start;
    if (rightCopyStart < start) rightCopyStart = start;

    for (let i = start; i <= end; i += 1) {
      annotated[i].leftCopyStart = leftCopyStart;
      annotated[i].rightCopyStart = rightCopyStart;
    }

    index = end + 1;
  }

  return annotated;
}

function summarizeCopiedRows(rows, side) {
  const sourceKey = side === "left" ? "leftContent" : "rightContent";
  let compact = rows
    .map((item) => item.line[sourceKey])
    .filter(Boolean)
    .map((content) => content.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  if (!compact.length) {
    const targetKey = side === "left" ? "rightContent" : "leftContent";
    compact = rows
      .map((item) => item.line[targetKey])
      .filter(Boolean)
      .map((content) => content.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (!compact.length) return "Eliminar bloque sin contenido visible";
    return `Eliminar: ${compact.slice(0, 3).join(" | ")}${compact.length > 3 ? ` | ... ${compact.length - 3} lineas mas` : ""}`;
  }
  const preview = compact.slice(0, 3).join(" | ");
  const suffix = compact.length > 3 ? ` | ... ${compact.length - 3} lineas mas` : "";
  return `${preview}${suffix}`;
}

function isLikelyPath(value) {
  return /^[a-zA-Z]:[\\/]/.test(value || "") || /^\\\\/.test(value || "");
}

function ChangeLogPanel({ entries, height, onResize, onRestore, onRestoreAll }) {
  const startResize = (event) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;

    const handleMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY;
      onResize(Math.max(64, Math.min(320, startHeight + delta)));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.classList.remove("resizing-xml-log");
    };

    document.body.classList.add("resizing-xml-log");
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <section className="xml-change-log-panel" style={{ flexBasis: height }}>
      <div className="xml-change-log-resizer" onMouseDown={startResize} title="Cambiar altura del registro" />
      <div className="xml-change-log-header">
        <div>
          <strong>Registro de cambios</strong>
          <span>{entries.length ? `${entries.length} accion${entries.length === 1 ? "" : "es"}` : "Sin cambios aplicados"}</span>
        </div>
        <button type="button" className="xml-change-log-clear" onClick={onRestoreAll} disabled={!entries.length}>
          Restaurar todo
        </button>
      </div>
      <div className="xml-change-log-list">
        {entries.length ? (
          entries.map((entry) => (
            <div className="xml-change-log-item" key={entry.id}>
              <span className="xml-change-log-time">{entry.createdAt}</span>
              <span className="xml-change-log-description" title={`${entry.description}: ${entry.detail || ""}`}>
                <strong>{entry.description}</strong>
                {entry.detail && <code>{entry.detail}</code>}
              </span>
              <button type="button" onClick={() => onRestore(entry)}>
                Restaurar
              </button>
            </div>
          ))
        ) : (
          <div className="xml-change-log-empty">Los cambios copiados entre paneles apareceran aqui.</div>
        )}
      </div>
    </section>
  );
}

function collapseEqualRuns(lines) {
  const folded = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index].type !== "equal") {
      folded.push(lines[index]);
      index += 1;
      continue;
    }

    let end = index;
    while (end < lines.length && lines[end].type === "equal") end += 1;
    const count = end - index;

    if (count > 18) {
      folded.push(...lines.slice(index, index + 4));
      folded.push({
        id: `fold-${index}-${end}`,
        type: "equal",
        leftContent: `... bloque XML sin cambios colapsado (${count - 8} lineas) ...`,
        rightContent: `... bloque XML sin cambios colapsado (${count - 8} lineas) ...`,
        collapsed: true,
      });
      folded.push(...lines.slice(end - 4, end));
    } else {
      folded.push(...lines.slice(index, end));
    }

    index = end;
  }

  return folded;
}
