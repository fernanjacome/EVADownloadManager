import React, { memo } from "react";
import InlineDiffRenderer from "./InlineDiffRenderer";

function DiffLine({
  line,
  rowIndex,
  side,
  rowHeight,
  active,
  onCopyAcross,
}) {
  const lineNumber = side === "left" ? line.leftLineNumber : line.rightLineNumber;
  const content = side === "left" ? line.leftContent : line.rightContent;
  const inlineChanges = side === "left" ? line.leftInlineChanges : line.rightInlineChanges;
  const ghost =
    (side === "left" && line.type === "inserted") ||
    (side === "right" && line.type === "deleted");
  const copyTitle = side === "left" ? "Copiar cambio hacia la derecha" : "Copiar cambio hacia la izquierda";
  const copyStart = side === "left" ? line.leftCopyStart : line.rightCopyStart;
  const canCopy = line.type !== "equal" && !line.collapsed && copyStart === rowIndex;

  return (
    <div
      className={[
        "xml-diff-line",
        `is-${line.type}`,
        active ? "is-active" : "",
        ghost ? "is-ghost" : "",
        line.collapsed ? "is-collapsed" : "",
        line.moved ? "is-moved" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height: rowHeight }}
      data-line-id={line.id}
      data-collapsed={line.collapsed ? "true" : undefined}
    >
      <div className="xml-line-number">{lineNumber || ""}</div>
      <div className="xml-copy-change-cell">
        {canCopy && (
          <button
            type="button"
            className="xml-copy-change"
            onClick={() => onCopyAcross?.(line, side, rowIndex)}
            title={copyTitle}
          >
            {side === "left" ? ">" : "<"}
          </button>
        )}
      </div>
      <pre className="xml-line-code">
        {ghost ? (
          <span className="xml-ghost-space">&nbsp;</span>
        ) : (
          <InlineDiffRenderer content={content} changes={inlineChanges || []} side={side} />
        )}
      </pre>
    </div>
  );
}

export default memo(DiffLine);
