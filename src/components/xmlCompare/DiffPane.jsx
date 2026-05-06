import React, { forwardRef, memo, useLayoutEffect, useRef } from "react";
import { useVirtualRows } from "../../hooks/useVirtualRows";
import DiffLine from "./DiffLine";
import { FaSave } from "react-icons/fa";

const ROW_HEIGHT = 22;

const DiffPane = forwardRef(function DiffPane(
  {
    title,
    subtitle,
    side,
    lines,
    activeIndex,
    onScroll,
    onViewport,
    onDropFile,
    onCopyAcross,
    onSaveSide,
    onClearSide,
    canSave,
    canClear,
  },
  ref,
) {
  const viewportRef = useRef(null);
  const { setViewport, range } = useVirtualRows(lines.length, ROW_HEIGHT, 18);
  const visibleLines = lines.slice(range.start, range.end);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => {
      const next = { height: node.clientHeight, scrollTop: node.scrollTop };
      setViewport(next);
      onViewport?.(side, next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onViewport, setViewport, side]);

  const setRefs = (node) => {
    viewportRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const handleScroll = (event) => {
    const node = event.currentTarget;
    const next = { height: node.clientHeight, scrollTop: node.scrollTop };
    setViewport(next);
    onViewport?.(side, next);
    onScroll?.(side, node.scrollTop);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onDropFile?.(file, side);
  };

  return (
    <section
      className={`xml-diff-pane xml-diff-pane-${side}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="xml-pane-titlebar">
        <div className="xml-pane-titletext">
          <strong>{title}</strong>
          <span title={subtitle}>{subtitle}</span>
        </div>
        <div className="xml-pane-title-actions">
          <button
            type="button"
            className="xml-pane-save-btn"
            onClick={() => onSaveSide?.(side)}
            disabled={!canSave}
            title={`Guardar ${title}`}
          >
            <FaSave />
          </button>
          <button
            type="button"
            className="xml-pane-clear-btn"
            onClick={() => onClearSide?.(side)}
            disabled={!canClear}
            title={`Vaciar ${title}`}
          >
            X
          </button>
        </div>
      </div>
      <div className="xml-pane-scroll" ref={setRefs} onScroll={handleScroll}>
        <div className="xml-virtual-space" style={{ height: range.totalHeight }}>
          <div className="xml-virtual-window" style={{ transform: `translateY(${range.offsetTop}px)` }}>
            {visibleLines.map((line, offset) => {
              const rowIndex = range.start + offset;
              return (
                <DiffLine
                  key={`${side}-${line.id}-${rowIndex}`}
                  line={line}
                  rowIndex={rowIndex}
                  side={side}
                  rowHeight={ROW_HEIGHT}
                  active={rowIndex === activeIndex}
                  onCopyAcross={onCopyAcross}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
});

export { ROW_HEIGHT };
export default memo(DiffPane);
