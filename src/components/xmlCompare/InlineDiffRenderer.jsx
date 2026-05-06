import React from "react";

export default function InlineDiffRenderer({ content = "", changes = [], side = "left" }) {
  if (!changes.length) return <span>{content || "\u00a0"}</span>;

  const nodes = [];
  let cursor = 0;
  const sorted = [...changes].sort((a, b) => a.start - b.start);

  sorted.forEach((change, index) => {
    if (change.start > cursor) {
      nodes.push(<span key={`text-${index}-${cursor}`}>{content.slice(cursor, change.start)}</span>);
    }
    nodes.push(
      <mark
        key={`mark-${index}-${change.start}`}
        className={`xml-inline-change ${change.type} ${side}`}
      >
        {content.slice(change.start, change.end)}
      </mark>,
    );
    cursor = Math.max(cursor, change.end);
  });

  if (cursor < content.length) {
    nodes.push(<span key={`tail-${cursor}`}>{content.slice(cursor)}</span>);
  }

  return <>{nodes}</>;
}
