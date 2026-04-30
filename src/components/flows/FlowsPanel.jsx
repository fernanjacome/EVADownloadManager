import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBullseye,
  FaCreditCard,
  FaEquals,
  FaExternalLinkAlt,
  FaExpandArrowsAlt,
  FaKeyboard,
  FaLayerGroup,
  FaMapMarkerAlt,
  FaMinus,
  FaPaperPlane,
  FaPlus,
  FaRandom,
  FaSearch,
  FaRedoAlt,
  FaSitemap,
  FaSlidersH,
  FaTimes,
  FaVectorSquare,
} from "react-icons/fa";
import { IoCodeSlash } from "react-icons/io5";
import "./flows.css";
import { buildFlowGraph } from "../../utils/xmlUtils";

const BASE_CARD_WIDTH = 276;
const BASE_CARD_HEIGHT = 178;
const TOP_PADDING = 28;
const LEFT_PADDING = 32;
const BASE_LEVEL_GAP = 585;
const BASE_ROW_GAP = 232;
const ROOT_EXTRA_GAP = 12;
const EDGE_LABEL_WIDTH = 112;
const NATURAL_CANVAS_ZOOM = 1.15;
const SIDE_EXIT_KEYS = new Set([
  "ErrorState",
  "TimeoutState",
  "CancelState",
  "NoMatchState",
]);
const SEND_CHOOSER_LIMIT = 8;

function normalizeScreenResourceName(value) {
  return String(value || "")
    .trim()
    .replace(/\.html?$/i, "")
    .toLowerCase();
}

function getStarts(graph) {
  const startIds = graph.startNodeIds?.length ? graph.startNodeIds : [];
  const stateNodes = graph.nodes.filter((node) => node.kind === "state");
  const nodeMap = new Map(stateNodes.map((node) => [node.id, node]));
  const endIds = new Set(graph.endNodeIds || []);

  const filtered = startIds.filter((id) => {
    const node = nodeMap.get(id);
    if (!node) return false;
    if (endIds.has(id)) return false;
    if (String(node.type || "").toUpperCase() === "END") return false;
    return true;
  });

  if (filtered.length) {
    return filtered;
  }

  const firstState = stateNodes.find(
    (node) => String(node.type || "").toUpperCase() !== "END",
  );
  return firstState ? [firstState.id] : [];
}

function getStartCategory(node) {
  const type = String(node?.type || "").toUpperCase();
  if (type.startsWith("CRD")) return "CRD*";
  if (type === "SET") return "SET";
  if (type === "SWITCH") return "SWITCH";
  if (type === "SELECT") return "SELECT";
  return "OTROS";
}

function getStartCategoryOrder(node) {
  const category = getStartCategory(node);
  if (category === "CRD*") return 0;
  if (category === "SET") return 1;
  if (category === "SWITCH") return 2;
  if (category === "SELECT") return 3;
  return 4;
}

function getStartCategoryTone(category) {
  if (category === "CRD*") return "crd";
  if (category === "SET") return "set";
  if (category === "SWITCH") return "switch";
  if (category === "SELECT") return "select";
  return "other";
}

function filterStartIdsByCategories(graph, categories) {
  const allowed = new Set(categories || []);
  if (allowed.size === 0) return [];

  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  return getStarts(graph).filter((stateId) =>
    allowed.has(getStartCategory(nodeMap.get(stateId))),
  );
}

function getNodeActionLetters(node) {
  return Object.keys(node.params || {})
    .filter((key) => /^Key[A-I]State$/i.test(key))
    .map((key) => key.replace(/^Key/i, "").replace(/State$/i, ""))
    .sort();
}

function isSideExitEdge(edgeOrLabel) {
  const key =
    typeof edgeOrLabel === "string"
      ? edgeOrLabel
      : edgeOrLabel?.transitionKey || edgeOrLabel?.label || "";
  return SIDE_EXIT_KEYS.has(String(key));
}

function isSendContinuationEdge(edge) {
  return (
    edge?.sourceKind === "tranmap-continuation" ||
    edge?.sourceKind === "transaction-continuation"
  );
}

function getTranMapConditionText(edge) {
  const fields = edge?.tranMapFields || [];
  if (fields.length) {
    return fields
      .map((field) => `${field.name || "Campo"}=${field.value || "-"}`)
      .join(" | ");
  }
  return edge?.matchedFields || "";
}

function normalizeFlowValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function flowValuesMatch(left, right) {
  const a = normalizeFlowValue(left);
  const b = normalizeFlowValue(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
}

function getEdgeFieldForBuffer(edge, buffer) {
  return (edge?.tranMapFields || []).find((field) =>
    flowValuesMatch(field.name, buffer),
  );
}

function getSendFlowSuggestion(edge, sendInstance, instances, nodeMap) {
  if (!sendInstance) return null;

  const byId = new Map(instances.map((item) => [item.instanceId, item]));
  const seenBuffers = new Set();
  let current = byId.get(sendInstance.parentInstanceId);
  let depth = 0;

  while (current && depth < 40) {
    const node = nodeMap.get(current.stateId);
    const params = node?.params || {};
    const type = String(node?.type || "").toUpperCase();

    if (type === "SET") {
      const buffer = params.BuffName || params.Buffer || "";
      const value = params.BuffValue || params.Value || "";
      const normalizedBuffer = normalizeFlowValue(buffer);

      if (normalizedBuffer && !seenBuffers.has(normalizedBuffer)) {
        seenBuffers.add(normalizedBuffer);

        const matchedField = getEdgeFieldForBuffer(edge, buffer);
        const matchesField =
          matchedField && flowValuesMatch(matchedField.value, value);
        const matchesText =
          flowValuesMatch(buffer, "TrxType") &&
          String(edge.matchedFields || "")
            .toLowerCase()
            .includes("trxtype") &&
          flowValuesMatch(edge.matchedFields, value);

        if (matchesField || matchesText) {
          return {
            score: 100 - depth,
            label: "del flujo",
            reason: `${buffer || "Buffer"}=${value || "-"}`,
          };
        }

        if (matchedField || flowValuesMatch(buffer, "TrxType")) {
          return null;
        }
      }
    }

    current = byId.get(current.parentInstanceId);
    depth += 1;
  }

  return null;
}

function getStateVisualKind(node) {
  const type = String(node?.type || "").toUpperCase();
  if (type === "SELECT") return "screen";
  if (type === "SET") return "set";
  if (type === "SETWHEN") return "setwhen";
  if (type === "ENTRY" || type === "PIN") return "entry";
  if (type === "SWITCH") return "switch";
  if (type === "SEND") return "send";
  if (type.startsWith("CRD")) return "card";
  if (type === "END") return "end";
  return "state";
}

function getStateVisualIcon(kind) {
  if (kind === "set") return FaEquals;
  if (kind === "setwhen") return FaSitemap;
  if (kind === "switch") return FaRandom;
  if (kind === "send") return FaPaperPlane;
  if (kind === "entry") return FaKeyboard;
  if (kind === "card") return FaCreditCard;
  return FaVectorSquare;
}

function getStatePrimaryDetail(node) {
  const params = node?.params || {};
  const type = String(node?.type || "").toUpperCase();

  if (params.BuffName && params.BuffValue) {
    return `${params.BuffName} = ${params.BuffValue}`;
  }

  if (type === "SETWHEN") {
    return [params.WhenBuffer, params.SetBuffer].filter(Boolean).join(" -> ");
  }

  if (type === "SWITCH") {
    return params.Buffer || params.BuffName || params.SwitchBuffer || "";
  }

  if ((type === "ENTRY" || type === "PIN") && params.Buffer) {
    return params.Buffer;
  }

  return "";
}

function getOperationContentFlags(node) {
  const detail = getStatePrimaryDetail(node);
  return {
    hasStateComment: Boolean(node?.comment),
    hasScreenComment: Boolean(node?.screenId && node?.screenComment),
    hasDetail: Boolean(detail),
  };
}

function getNodeShapeMetrics(node, cardWidth, cardHeight, cardScale) {
  const kind = getStateVisualKind(node);
  if (kind === "screen") {
    return {
      kind,
      left: 0,
      top: 0,
      width: cardWidth,
      height: cardHeight,
    };
  }

  const content = getOperationContentFlags(node);
  const isSparse =
    !content.hasStateComment && !content.hasScreenComment && !content.hasDetail;
  const shapeByKind = {
    set: { width: 244, height: isSparse ? 86 : 132 },
    setwhen: { width: 244, height: isSparse ? 86 : 132 },
    switch: { width: 244, height: isSparse ? 86 : 132 },
    send: { width: 244, height: isSparse ? 86 : 132 },
    card: { width: 244, height: isSparse ? 86 : 132 },
    entry: { width: 244, height: isSparse ? 98 : 124 },
    end: { width: 244, height: isSparse ? 86 : 132 },
    state: { width: 244, height: isSparse ? 86 : 132 },
  };
  const base = shapeByKind[kind] || shapeByKind.state;
  const width = Math.round(base.width * cardScale);
  const height = Math.round(base.height * cardScale);

  return {
    kind,
    left: Math.round((cardWidth - width) / 2),
    top: Math.round((cardHeight - height) / 2),
    width,
    height,
  };
}

function getEdgeContextLabel(edge, nodeMap) {
  const transitionKey = String(edge?.transitionKey || edge?.label || "");
  const stateMatch = transitionKey.match(/^State(\d+)$/i);
  if (stateMatch) {
    return `Value${stateMatch[1]} -> State ${edge?.targetStateId || "-"}`;
  }

  const keyMatch = transitionKey.match(/^Key([A-I])State$/i);
  if (keyMatch) {
    return `Key${keyMatch[1].toUpperCase()}State -> State ${edge?.targetStateId || "-"}`;
  }

  return `${transitionKey || edge?.primaryLabel || edge?.label || "Salida"} -> State ${
    edge?.targetStateId || "-"
  }`;
}

function getFloatingPositionFromNode(event, width, height, margin = 8) {
  const rect = event.currentTarget?.getBoundingClientRect?.();
  const minX = Math.max(margin, (rect?.left ?? event.clientX) + margin);
  const maxX = Math.min(
    window.innerWidth - width - margin,
    (rect?.right ?? event.clientX) - width - margin,
  );
  const minY = Math.max(margin, (rect?.top ?? event.clientY) + margin);
  const maxY = Math.min(
    window.innerHeight - height - margin,
    (rect?.bottom ?? event.clientY) - height - margin,
  );

  return {
    x:
      maxX >= minX
        ? Math.min(Math.max(event.clientX + margin, minX), maxX)
        : Math.min(
            Math.max(event.clientX + margin, margin),
            window.innerWidth - width - margin,
          ),
    y:
      maxY >= minY
        ? Math.min(Math.max(event.clientY + margin, minY), maxY)
        : Math.min(
            Math.max(event.clientY + margin, margin),
            window.innerHeight - height - margin,
          ),
  };
}

function clampFloatingPosition(x, y, width, height, margin = 8) {
  return {
    x: Math.min(
      Math.max(x, margin),
      Math.max(margin, window.innerWidth - width - margin),
    ),
    y: Math.min(
      Math.max(y, margin),
      Math.max(margin, window.innerHeight - height - margin),
    ),
  };
}

function getVisibleEdges(graph, showSideExits) {
  if (showSideExits) return graph.edges;
  return graph.edges.filter((edge) => !isSideExitEdge(edge));
}

function getStateActionSummary(node) {
  const params = node?.params || {};
  const type = String(node?.type || "").toUpperCase();

  if (type === "SET") {
    return `${params.BuffName || "Buffer"} = ${params.BuffValue || "-"}`;
  }

  if (type === "SETWHEN") {
    const when = params.WhenBuffer || "";
    const set = params.SetBuffer || "";
    return [when, set].filter(Boolean).join(" -> ");
  }

  if (type === "SELECT") {
    return params.Buffer || "";
  }

  if (type === "ENTRY") {
    return params.Buffer ? `Captura valor en ${params.Buffer}` : "";
  }

  if (type === "PIN") {
    if (params.MinLen && params.MaxLen)
      return `PIN ${params.MinLen}-${params.MaxLen} digitos`;
    return "Captura PIN";
  }

  if (type === "SWITCH") {
    return `Evalua ${params.Buffer || params.BuffName || params.SwitchBuffer || "valor"}`;
  }

  if (type === "CRDSRC") {
    return "Lee tarjeta";
  }

  if (type.startsWith("CRD")) {
    return "Lee tarjeta";
  }

  if (type === "SEND") {
    return "";
  }

  if (type === "END") {
    return "";
  }

  return params.GoodState ? `Continua a ${params.GoodState}` : "";
}

function getReadableEdgeLabel(edge) {
  const key = String(
    edge?.incomingTransitionKey || edge?.transitionKey || edge?.label || "",
  );
  const primary =
    edge?.primaryLabel || edge?.incomingPrimaryLabel || edge?.label || "";
  const secondary = edge?.secondaryLabel || edge?.incomingSecondaryLabel || "";

  if (edge?.sourceKind === "tranmap-continuation") {
    return {
      primaryLabel: primary || `TranMap ${edge.tranMapId || "?"}`,
      secondaryLabel:
        secondary || edge.matchedFields || edge.tranMapComment || "",
    };
  }

  if (edge?.sourceKind === "transaction-continuation") {
    return {
      primaryLabel:
        primary || `Tran ${edge.transactionCode || edge.operCodeKey || ""}`,
      secondaryLabel:
        secondary || edge.matchedFields || edge.transactionComment || "",
    };
  }

  const keyMatch = key.match(/^Key([A-I])State$/i);
  if (keyMatch) {
    return {
      primaryLabel: `Tecla ${keyMatch[1].toUpperCase()}`,
      secondaryLabel: "",
    };
  }

  const sideLabels = {
    GoodState: "OK",
    ErrorState: "Error",
    TimeoutState: "Timeout",
    CancelState: "Cancelar",
    NoMatchState: "No match",
  };

  if (sideLabels[key]) {
    return {
      primaryLabel: sideLabels[key],
      secondaryLabel: "",
    };
  }

  return {
    primaryLabel: primary,
    secondaryLabel: secondary,
  };
}

function renderHighlightedText(text, term, highlightAll = true) {
  const source = String(text || "");
  const normalized = String(term || "").trim();
  if (!normalized) return source;
  if (!highlightAll) return source;

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = source.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === normalized.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="flow-highlight">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
}

function getEdgeTone(label) {
  if (/ErrorState/i.test(label)) return "error";
  if (/TimeoutState/i.test(label)) return "timeout";
  if (/CancelState/i.test(label)) return "cancel";
  if (/NoMatchState/i.test(label)) return "nomatch";
  if (/GoodState/i.test(label)) return "good";
  if (/Key[A-I]State/i.test(label)) return "key";
  if (/Tran(Map)? /i.test(label)) return "good";
  return "default";
}

function getChildren(instanceId, allInstances) {
  return allInstances.filter((item) => item.parentInstanceId === instanceId);
}

function collectDescendants(instanceId, allInstances, visited = new Set()) {
  if (visited.has(instanceId)) {
    return [];
  }

  visited.add(instanceId);
  const children = getChildren(instanceId, allInstances);
  const ids = [];

  children.forEach((child) => {
    if (visited.has(child.instanceId)) {
      return;
    }

    ids.push(child.instanceId);
    ids.push(...collectDescendants(child.instanceId, allInstances, visited));
  });

  return ids;
}

function syncNextIdRef(nextIdRef, items) {
  const maxId = items.reduce((maxValue, item) => {
    const match = String(item.instanceId || "").match(/^inst-(\d+)$/);
    if (!match) return maxValue;
    return Math.max(maxValue, Number(match[1]));
  }, 0);

  nextIdRef.current = maxId + 1;
}

function buildInitialInstances(graph, nextIdRef, startsOverride = null) {
  const starts = startsOverride ?? getStarts(graph);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const orderedStarts = [...starts].sort((leftId, rightId) => {
    const leftNode = nodeMap.get(leftId);
    const rightNode = nodeMap.get(rightId);
    const byCategory =
      getStartCategoryOrder(leftNode) - getStartCategoryOrder(rightNode);
    if (byCategory !== 0) return byCategory;
    const byType = String(leftNode?.type || "").localeCompare(
      String(rightNode?.type || ""),
    );
    if (byType !== 0) return byType;
    return String(leftId).localeCompare(String(rightId), undefined, {
      numeric: true,
    });
  });

  return orderedStarts.map((stateId, index) => ({
    instanceId: `inst-${nextIdRef.current++}`,
    stateId,
    level: 0,
    parentInstanceId: null,
    incomingLabel: null,
    order: index,
    startCategory: getStartCategory(nodeMap.get(stateId)),
    expanded: false,
  }));
}

function sanitizePersistedInstances(
  graph,
  persistedInstances,
  showSideExits = false,
) {
  if (!Array.isArray(persistedInstances) || persistedInstances.length === 0) {
    return [];
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const availableEdges = getVisibleEdges(graph, showSideExits);
  const edgeKeys = new Set(
    availableEdges.map(
      (edge) => `${edge.source}::${edge.label || ""}::${edge.target}`,
    ),
  );
  const acceptedIds = new Set();
  const sanitized = [];

  persistedInstances.forEach((item, index) => {
    if (!item || !nodeIds.has(item.stateId)) return;

    const normalized = {
      instanceId: String(item.instanceId || `inst-restored-${index}`),
      stateId: String(item.stateId),
      level: Number.isFinite(item.level) ? item.level : 0,
      parentInstanceId: item.parentInstanceId || null,
      incomingLabel: item.incomingLabel || null,
      incomingPrimaryLabel: item.incomingPrimaryLabel || null,
      incomingSecondaryLabel: item.incomingSecondaryLabel || null,
      incomingLabelWidth: Number.isFinite(item.incomingLabelWidth)
        ? item.incomingLabelWidth
        : null,
      incomingSourceKind: item.incomingSourceKind || null,
      incomingTransitionKey: item.incomingTransitionKey || null,
      order: Number.isFinite(item.order) ? item.order : index,
      startCategory: item.startCategory || null,
      expanded: Boolean(item.expanded),
    };

    if (!normalized.parentInstanceId) {
      normalized.level = 0;
      sanitized.push(normalized);
      acceptedIds.add(normalized.instanceId);
      return;
    }

    if (!acceptedIds.has(normalized.parentInstanceId)) return;
    const parent = sanitized.find(
      (entry) => entry.instanceId === normalized.parentInstanceId,
    );
    if (!parent) return;

    const edgeKey = `${parent.stateId}::${normalized.incomingLabel || ""}::${normalized.stateId}`;
    if (!edgeKeys.has(edgeKey)) return;

    normalized.level = parent.level + 1;
    sanitized.push(normalized);
    acceptedIds.add(normalized.instanceId);
  });

  const parentsWithChildren = new Set(
    sanitized
      .filter((item) => item.parentInstanceId)
      .map((item) => item.parentInstanceId),
  );

  return sanitized.map((item) => ({
    ...item,
    expanded: parentsWithChildren.has(item.instanceId) ? item.expanded : false,
  }));
}

function getRootInstanceId(item, itemById) {
  let current = item;
  const visited = new Set();

  while (current?.parentInstanceId && !visited.has(current.instanceId)) {
    visited.add(current.instanceId);
    current = itemById.get(current.parentInstanceId);
  }

  return current?.instanceId || item?.instanceId || null;
}

function reconcileInstancesForStarts({
  graph,
  currentInstances,
  persistedInstances,
  startIds,
  showSideExits,
  nextIdRef,
}) {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const allowedStartIds = new Set(startIds);
  const source = currentInstances.length
    ? sanitizePersistedInstances(graph, currentInstances, showSideExits)
    : sanitizePersistedInstances(graph, persistedInstances, showSideExits);

  const itemById = new Map(source.map((item) => [item.instanceId, item]));
  const kept = source.filter((item) => {
    const rootId = getRootInstanceId(item, itemById);
    const root = rootId ? itemById.get(rootId) : null;
    return root && allowedStartIds.has(root.stateId);
  });

  const existingRootStateIds = new Set(
    kept.filter((item) => !item.parentInstanceId).map((item) => item.stateId),
  );
  const rootsCount = kept.filter((item) => !item.parentInstanceId).length;
  const additions = startIds
    .filter((stateId) => !existingRootStateIds.has(stateId))
    .map((stateId, index) => ({
      instanceId: `inst-${nextIdRef.current++}`,
      stateId,
      level: 0,
      parentInstanceId: null,
      incomingLabel: null,
      order: rootsCount + index,
      startCategory: getStartCategory(nodeMap.get(stateId)),
      expanded: false,
    }));

  const nextItems = kept
    .concat(additions)
    .map((item, index) =>
      item.parentInstanceId ? item : { ...item, order: index },
    );
  const rootOrder = new Map(
    nextItems
      .filter((item) => !item.parentInstanceId)
      .sort((left, right) => {
        const leftNode = nodeMap.get(left.stateId);
        const rightNode = nodeMap.get(right.stateId);
        const byCategory =
          getStartCategoryOrder(leftNode) - getStartCategoryOrder(rightNode);
        if (byCategory !== 0) return byCategory;
        return String(left.stateId).localeCompare(
          String(right.stateId),
          undefined,
          {
            numeric: true,
          },
        );
      })
      .map((item, index) => [item.instanceId, index]),
  );
  const orderedItems = nextItems.map((item) =>
    item.parentInstanceId
      ? item
      : { ...item, order: rootOrder.get(item.instanceId) ?? item.order },
  );

  syncNextIdRef(nextIdRef, orderedItems);
  return orderedItems;
}

function buildLayout(
  instances,
  horizontalScale,
  verticalScale,
  cardWidth,
  cardHeight,
) {
  const levelGap = Math.round(BASE_LEVEL_GAP * horizontalScale);
  const rowGap = Math.round(BASE_ROW_GAP * verticalScale);
  const rootGap = Math.max(18, Math.round(ROOT_EXTRA_GAP * verticalScale));
  const rootRowGap = Math.max(
    cardHeight + rootGap,
    Math.round((BASE_CARD_HEIGHT + ROOT_EXTRA_GAP) * verticalScale),
  );
  const sorted = [...instances].sort((a, b) => {
    if (a.level === b.level) {
      return a.order - b.order;
    }
    return a.level - b.level;
  });

  const positionedMap = new Map();
  const byParent = new Map();
  const lastBottomByLevel = new Map();

  sorted.forEach((instance) => {
    if (!instance.parentInstanceId) return;
    if (!byParent.has(instance.parentInstanceId)) {
      byParent.set(instance.parentInstanceId, []);
    }
    byParent.get(instance.parentInstanceId).push(instance);
  });

  let rootCursorY = TOP_PADDING + 24;
  const roots = sorted.filter((instance) => !instance.parentInstanceId);
  let previousRootCategory = null;
  roots.forEach((root) => {
    if (
      previousRootCategory &&
      root.startCategory &&
      root.startCategory !== previousRootCategory
    ) {
      rootCursorY += Math.max(16, Math.round(20 * verticalScale));
    }
    const y = rootCursorY;
    positionedMap.set(root.instanceId, {
      ...root,
      x: LEFT_PADDING,
      y,
    });
    previousRootCategory = root.startCategory || previousRootCategory;
    rootCursorY += rootRowGap;
    lastBottomByLevel.set(0, y + cardHeight);
  });

  const maxLevel = Math.max(0, ...sorted.map((item) => item.level));
  for (let level = 1; level <= maxLevel; level++) {
    const parents = sorted
      .filter((item) => item.level === level - 1)
      .sort((a, b) => {
        const posA = positionedMap.get(a.instanceId);
        const posB = positionedMap.get(b.instanceId);
        return (posA?.y ?? 0) - (posB?.y ?? 0);
      });

    parents.forEach((parent) => {
      const parentPos = positionedMap.get(parent.instanceId);
      const children = (byParent.get(parent.instanceId) || []).sort(
        (a, b) => a.order - b.order,
      );
      if (!parentPos || children.length === 0) return;

      const groupHeight = (children.length - 1) * rowGap;
      let startY = parentPos.y + cardHeight / 2 - groupHeight / 2;
      startY = Math.max(TOP_PADDING, startY);

      const lastBottom = lastBottomByLevel.get(level);
      const minSpacing = Math.max(18, Math.round(18 * verticalScale));
      if (lastBottom != null && startY < lastBottom + minSpacing) {
        startY = lastBottom + minSpacing;
      }

      children.forEach((child, childIndex) => {
        const y = startY + childIndex * rowGap;
        positionedMap.set(child.instanceId, {
          ...child,
          x: LEFT_PADDING + level * levelGap,
          y,
        });
        lastBottomByLevel.set(level, y + cardHeight);
      });
    });
  }

  const positioned = Array.from(positionedMap.values());
  const canvasWidth =
    Math.max(1, ...positioned.map((item) => item.level)) * levelGap +
    cardWidth +
    LEFT_PADDING * 2;
  const canvasHeight = Math.max(
    360,
    Math.max(...positioned.map((item) => item.y + cardHeight), 0) +
      TOP_PADDING +
      48,
  );

  return {
    positioned,
    width: canvasWidth,
    height: canvasHeight,
  };
}

function getEdgePath(
  source,
  target,
  cardWidth,
  cardHeight,
  labelWidth = EDGE_LABEL_WIDTH,
) {
  const sourceBounds = source.bounds || {
    left: 0,
    top: 0,
    width: cardWidth,
    height: cardHeight,
  };
  const targetBounds = target.bounds || {
    left: 0,
    top: 0,
    width: cardWidth,
    height: cardHeight,
  };
  const startX = source.x + sourceBounds.left + sourceBounds.width;
  const startY = source.y + sourceBounds.top + sourceBounds.height / 2;
  const endX = target.x + targetBounds.left;
  const endY = target.y + targetBounds.top + targetBounds.height / 2;
  const siblingOffset =
    ((target.siblingIndex || 0) - ((target.siblingCount || 1) - 1) / 2) * 18;
  const elbowOffset = Math.max(96, Math.min(150, (endX - startX) * 0.32));
  const midX = startX + elbowOffset + siblingOffset;
  const beforeEndX = endX - 18;
  const labelCenterX = midX + (beforeEndX - midX) / 2;
  const safeLabelWidth = Math.max(EDGE_LABEL_WIDTH, labelWidth);
  const labelStartX = labelCenterX - safeLabelWidth / 2;
  const labelEndX = labelCenterX + safeLabelWidth / 2;

  return {
    startX,
    startY,
    midX,
    endY,
    beforeEndX,
    labelStartX,
    labelEndX,
    labelWidth: safeLabelWidth,
  };
}

function isScreenParamKey(key) {
  return /^(Screen|SelScreen)$/i.test(String(key || ""));
}

function NodeBadges({ node, graph, hiddenExitCount }) {
  return (
    <div className="flow-node-badges">
      {graph.startNodeIds.includes(node.id) && (
        <span className="flow-screen-chip start">Inicio</span>
      )}
      {!graph.startNodeIds.includes(node.id) &&
        graph.endNodeIds.includes(node.id) && (
          <span className="flow-screen-chip end">Fin</span>
        )}
      {hiddenExitCount > 0 && (
        <span className="flow-side-exit-chip" title="Excepciones ocultas">
          +{hiddenExitCount}
        </span>
      )}
    </div>
  );
}

function SelectStateCard({
  node,
  graph,
  instance,
  isSelected,
  onToggle,
  onInspect,
  cardScale,
  searchTerm,
  highlightAllMatches,
  isMatchFocused,
  hiddenExitCount,
}) {
  const activeLetters = getNodeActionLetters(node);
  const actionSummary = getStateActionSummary(node);

  return (
    <button
      type="button"
      className={`flow-select-node ${isSelected ? "selected" : ""} ${
        instance.expanded ? "expanded" : ""
      } ${isMatchFocused ? "match-focused" : ""}`}
      onClick={onToggle}
      onContextMenu={(event) => {
        event.preventDefault();
        onInspect(event);
      }}
      title="Click para abrir o cerrar esta rama"
      style={{ "--flow-card-scale": cardScale }}
    >
      <div className="flow-screen-shell">
        <div className="flow-screen-idbar">
          <span className="flow-screen-id">
            {renderHighlightedText(
              `State ${node.id}`,
              searchTerm,
              highlightAllMatches,
            )}
          </span>
          <span className="flow-screen-type">
            {renderHighlightedText(
              node.type || "STATE",
              searchTerm,
              highlightAllMatches,
            )}
          </span>
        </div>

        <div className="flow-screen-frame">
          <div className="flow-screen-side left">
            {["F", "G", "H", "I"].map((letter) => (
              <span
                key={letter}
                className={activeLetters.includes(letter) ? "active" : ""}
              >
                {letter}
              </span>
            ))}
          </div>

          <div className="flow-screen-monitor">
            <strong>
              {renderHighlightedText(
                node.comment || "Sin comentario",
                searchTerm,
                highlightAllMatches,
              )}
            </strong>
            <small>
              {renderHighlightedText(
                node.screenComment || `Screen ${node.screenId || "-"}`,
                searchTerm,
                highlightAllMatches,
              )}
            </small>
            {actionSummary && (
              <span className="flow-screen-action">
                {renderHighlightedText(
                  actionSummary,
                  searchTerm,
                  highlightAllMatches,
                )}
              </span>
            )}
            <NodeBadges node={node} graph={graph} hiddenExitCount={0} />
          </div>

          <div className="flow-screen-side right">
            {["A", "B", "C", "D"].map((letter) => (
              <span
                key={letter}
                className={activeLetters.includes(letter) ? "active" : ""}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>

        <div className="flow-screen-footer">
          <span className="flow-screen-transition">
            {renderHighlightedText(
              instance.incomingLabel ||
                (graph.startNodeIds.includes(node.id) ? "Start" : "State"),
              searchTerm,
              highlightAllMatches,
            )}
          </span>
          {hiddenExitCount > 0 && (
            <span className="flow-side-exit-chip" title="Excepciones ocultas">
              +{hiddenExitCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function OperationStateNode({
  node,
  graph,
  instance,
  isSelected,
  onToggle,
  onInspect,
  cardScale,
  searchTerm,
  highlightAllMatches,
  isMatchFocused,
  hiddenExitCount,
}) {
  const visualKind = getStateVisualKind(node);
  const VisualIcon = getStateVisualIcon(visualKind);
  const primaryDetail = getStatePrimaryDetail(node);
  const stateComment = node.comment || "";
  const screenComment =
    node.screenId && node.screenComment ? node.screenComment : "";
  const isSparse = !stateComment && !screenComment && !primaryDetail;

  return (
    <button
      type="button"
      className={`flow-op-node kind-${visualKind} ${isSparse ? "sparse" : ""} ${isSelected ? "selected" : ""} ${
        instance.expanded ? "expanded" : ""
      } ${isMatchFocused ? "match-focused" : ""}`}
      onClick={onToggle}
      onContextMenu={(event) => {
        event.preventDefault();
        onInspect(event);
      }}
      title="Click para abrir o cerrar esta rama"
      style={{ "--flow-card-scale": cardScale }}
    >
      <div className="flow-op-shape">
        <div className="flow-op-meta">
          <span>
            {renderHighlightedText(
              `${node.type || "STATE"} - State ${node.id}`,
              searchTerm,
              highlightAllMatches,
            )}
          </span>
        </div>
        <span className="flow-op-symbol" aria-hidden="true">
          <VisualIcon />
        </span>
        {stateComment && (
          <strong>
            {renderHighlightedText(
              stateComment,
              searchTerm,
              highlightAllMatches,
            )}
          </strong>
        )}
        {screenComment && (
          <em>
            {renderHighlightedText(
              screenComment,
              searchTerm,
              highlightAllMatches,
            )}
          </em>
        )}
        {primaryDetail && (
          <small>
            {renderHighlightedText(
              primaryDetail,
              searchTerm,
              highlightAllMatches,
            )}
          </small>
        )}
        {visualKind === "entry" && (
          <span className="flow-entry-pad" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <i key={index} />
            ))}
          </span>
        )}
        <NodeBadges
          node={node}
          graph={graph}
          hiddenExitCount={hiddenExitCount}
        />
      </div>
    </button>
  );
}

function FlowNodeCard(props) {
  const visualKind = getStateVisualKind(props.node);
  if (visualKind === "screen") {
    return <SelectStateCard {...props} />;
  }
  return <OperationStateNode {...props} />;
}

export default function FlowsPanel({
  xmlDoc,
  focusStateId,
  focusStateKey,
  flowViewState,
  onFlowViewStateChange,
  onSelectState,
  onOpenScreen,
  screensLoaded = false,
  screensList = [],
}) {
  const START_FILTER_OPTIONS = ["CRD*", "SET", "SWITCH", "SELECT", "OTROS"];
  const graph = useMemo(() => buildFlowGraph(xmlDoc), [xmlDoc]);
  const screenResourceById = useMemo(() => {
    const map = new Map();
    Array.from(xmlDoc?.querySelectorAll?.("Screens > Screen") || []).forEach(
      (screenNode) => {
        const screenId = screenNode.getAttribute("Id");
        const resourceParam = Array.from(screenNode.children || []).find(
          (child) =>
            child.tagName === "Param" &&
            child.getAttribute("Key") === "Resource",
        );
        if (!screenId || !resourceParam?.textContent) return;
        map.set(
          screenId,
          normalizeScreenResourceName(resourceParam.textContent.trim()),
        );
      },
    );
    return map;
  }, [xmlDoc]);

  const initialViewStateRef = useRef({
    instances: flowViewState?.instances || [],
    selectedInstanceId: flowViewState?.selectedInstanceId || null,
    horizontalScale: flowViewState?.horizontalScale ?? 1,
    verticalScale: flowViewState?.verticalScale ?? 1,
    cardScale: flowViewState?.cardScale ?? 1,
    canvasZoom: flowViewState?.canvasZoom ?? NATURAL_CANVAS_ZOOM,
    showControls: Boolean(flowViewState?.showControls),
    showAppearance: Boolean(flowViewState?.showAppearance),
    showSearch: Boolean(flowViewState?.showSearch),
    showCanvasZoom: Boolean(flowViewState?.showCanvasZoom),
    showSideExits: Boolean(flowViewState?.showSideExits),
    autoFocusOnExpand: flowViewState?.autoFocusOnExpand ?? true,
    searchTerm: flowViewState?.searchTerm ?? "",
    startCategoryFilter:
      Array.isArray(flowViewState?.startCategoryFilter) &&
      flowViewState.startCategoryFilter.length
        ? flowViewState.startCategoryFilter
        : ["CRD*"],
    scrollLeft: flowViewState?.scrollLeft ?? 0,
    scrollTop: flowViewState?.scrollTop ?? 0,
  });

  const nextIdRef = useRef(1);
  const scrollRef = useRef(null);
  const pendingCenterRef = useRef(false);
  const pendingFocusModeRef = useRef("center");
  const pendingCategoryFocusRef = useRef(null);
  const pendingScrollRestoreRef = useRef(false);
  const restoredViewportRef = useRef(false);
  const skipScrollPersistRef = useRef(false);
  const skipScrollPersistTimerRef = useRef(null);
  const lastViewSignatureRef = useRef("");
  const dragRef = useRef(null);
  const searchInputRef = useRef(null);
  const canvasZoomRef = useRef(
    initialViewStateRef.current.canvasZoom ?? NATURAL_CANVAS_ZOOM,
  );
  const zoomFrameRef = useRef(null);
  const lastPointerRef = useRef(null);
  const floatingDragRef = useRef(null);
  const latestScrollRef = useRef({
    left: initialViewStateRef.current.scrollLeft ?? 0,
    top: initialViewStateRef.current.scrollTop ?? 0,
  });
  const [instances, setInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [horizontalScale, setHorizontalScale] = useState(
    initialViewStateRef.current.horizontalScale,
  );
  const [verticalScale, setVerticalScale] = useState(
    initialViewStateRef.current.verticalScale,
  );
  const [cardScale, setCardScale] = useState(
    initialViewStateRef.current.cardScale,
  );
  const [canvasZoom, setCanvasZoom] = useState(
    initialViewStateRef.current.canvasZoom ?? NATURAL_CANVAS_ZOOM,
  );
  const [showLayoutPanel, setShowLayoutPanel] = useState(
    Boolean(
      initialViewStateRef.current.showControls ||
      initialViewStateRef.current.showAppearance,
    ),
  );
  const [showCanvasZoom, setShowCanvasZoom] = useState(
    Boolean(initialViewStateRef.current.showCanvasZoom),
  );
  const [showSideExits, setShowSideExits] = useState(
    initialViewStateRef.current.showSideExits,
  );
  const [autoFocusOnExpand, setAutoFocusOnExpand] = useState(
    initialViewStateRef.current.autoFocusOnExpand,
  );
  const [searchTerm, setSearchTerm] = useState(
    initialViewStateRef.current.searchTerm,
  );
  const [startCategoryFilter, setStartCategoryFilter] = useState(
    initialViewStateRef.current.startCategoryFilter,
  );
  const highlightAllMatches = true;
  const [inspector, setInspector] = useState(null);
  const [paramMenu, setParamMenu] = useState(null);
  const [edgeMenu, setEdgeMenu] = useState(null);
  const [sendMenu, setSendMenu] = useState(null);
  const inspectorRef = useRef(null);
  const paramMenuRef = useRef(null);
  const edgeMenuRef = useRef(null);
  const sendMenuRef = useRef(null);
  const inspectorParams = useMemo(
    () => (inspector ? Object.entries(inspector.node.params || {}) : []),
    [inspector],
  );

  useEffect(() => {
    canvasZoomRef.current = canvasZoom;
  }, [canvasZoom]);

  const cardWidth = useMemo(
    () => Math.round(BASE_CARD_WIDTH * cardScale),
    [cardScale],
  );
  const cardHeight = useMemo(
    () => Math.round(BASE_CARD_HEIGHT * cardScale),
    [cardScale],
  );
  const scaledLayout = useMemo(
    () =>
      buildLayout(
        instances,
        horizontalScale,
        verticalScale,
        cardWidth,
        cardHeight,
      ),
    [instances, horizontalScale, verticalScale, cardWidth, cardHeight],
  );
  const positionedMap = useMemo(
    () =>
      new Map(
        scaledLayout.positioned.map((instance) => [
          instance.instanceId,
          instance,
        ]),
      ),
    [scaledLayout.positioned],
  );
  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const visibleEdges = useMemo(
    () => getVisibleEdges(graph, showSideExits),
    [graph, showSideExits],
  );

  const availableScreens = useMemo(
    () =>
      new Map(
        screensList.map((screen) => [
          normalizeScreenResourceName(screen.resource),
          screen,
        ]),
      ),
    [screensList],
  );

  useEffect(() => {
    const filteredStartIds = filterStartIdsByCategories(
      graph,
      startCategoryFilter,
    );

    setInstances((prev) => {
      const isInitialLoad = prev.length === 0;
      const reconciled = reconcileInstancesForStarts({
        graph,
        currentInstances: prev,
        persistedInstances: initialViewStateRef.current.instances,
        startIds: filteredStartIds,
        showSideExits,
        nextIdRef,
      });

      if (isInitialLoad) {
        pendingScrollRestoreRef.current = true;
      }

      const categoryToFocus = pendingCategoryFocusRef.current;
      const categoryMatch = categoryToFocus
        ? reconciled.find(
            (item) =>
              !item.parentInstanceId &&
              getStartCategory(nodeMap.get(item.stateId)) === categoryToFocus,
          )
        : null;
      if (categoryMatch) {
        pendingCategoryFocusRef.current = null;
        pendingFocusModeRef.current = "as-start";
        pendingCenterRef.current = true;
      }

      setSelectedInstanceId((currentSelected) => {
        if (categoryMatch) return categoryMatch.instanceId;
        if (reconciled.some((item) => item.instanceId === currentSelected)) {
          return currentSelected;
        }
        if (
          reconciled.some(
            (item) =>
              item.instanceId ===
              initialViewStateRef.current.selectedInstanceId,
          )
        ) {
          return initialViewStateRef.current.selectedInstanceId;
        }
        return reconciled[0]?.instanceId ?? null;
      });
      return reconciled;
    });
  }, [graph, startCategoryFilter]);

  useEffect(() => {
    if (!focusStateId) return;
    const targetId = String(focusStateId);
    if (!graph.nodes.some((node) => node.id === targetId)) return;

    pendingCenterRef.current = true;
    pendingScrollRestoreRef.current = false;
    restoredViewportRef.current = true;
    setInstances((prev) => {
      const visibleMatch = prev.find((item) => item.stateId === targetId);
      if (visibleMatch) {
        setSelectedInstanceId(visibleMatch.instanceId);
        return prev;
      }

      const roots = prev.filter((item) => item.level === 0);
      const nextRoots = roots.some((item) => item.stateId === targetId)
        ? roots
        : roots.concat({
            instanceId: `inst-${nextIdRef.current++}`,
            stateId: targetId,
            level: 0,
            parentInstanceId: null,
            incomingLabel: null,
            order: roots.length,
            startCategory: getStartCategory(
              graph.nodes.find((node) => node.id === targetId),
            ),
            expanded: false,
          });

      const targetInstance =
        nextRoots.find((item) => item.stateId === targetId) ||
        nextRoots[0] ||
        null;
      setSelectedInstanceId(targetInstance?.instanceId ?? null);
      syncNextIdRef(nextIdRef, nextRoots);
      return nextRoots;
    });
  }, [focusStateId, focusStateKey, graph.nodes]);

  useEffect(() => {
    if (!onFlowViewStateChange) return;
    onFlowViewStateChange((prev) => ({
      ...(prev || {}),
      instances,
      selectedInstanceId,
      horizontalScale,
      verticalScale,
      cardScale,
      canvasZoom,
      showControls: showLayoutPanel,
      showAppearance: false,
      showSearch: false,
      showCanvasZoom,
      showSideExits,
      autoFocusOnExpand,
      searchTerm,
      startCategoryFilter,
      scrollLeft: latestScrollRef.current.left,
      scrollTop: latestScrollRef.current.top,
    }));
  }, [
    instances,
    selectedInstanceId,
    horizontalScale,
    verticalScale,
    cardScale,
    canvasZoom,
    showLayoutPanel,
    showCanvasZoom,
    showSideExits,
    autoFocusOnExpand,
    searchTerm,
    startCategoryFilter,
    onFlowViewStateChange,
  ]);

  const setLayoutPreset = (preset) => {
    if (preset === "compacta") {
      setHorizontalScale(0.95);
      setVerticalScale(0.95);
      setCardScale(0.96);
      return;
    }
    if (preset === "amplia") {
      setHorizontalScale(1.38);
      setVerticalScale(1.28);
      setCardScale(1.08);
      return;
    }
    setHorizontalScale(1.12);
    setVerticalScale(1.08);
    setCardScale(1);
  };

  const selectedInstance = selectedInstanceId
    ? (instances.find((item) => item.instanceId === selectedInstanceId) ?? null)
    : null;
  const selectedNode = selectedInstance
    ? nodeMap.get(selectedInstance.stateId)
    : null;
  const selectedPositionedInstance = selectedInstanceId
    ? (positionedMap.get(selectedInstanceId) ?? null)
    : null;
  const startGroups = useMemo(() => {
    const roots = scaledLayout.positioned
      .filter(
        (instance) => !instance.parentInstanceId && instance.startCategory,
      )
      .sort((a, b) => a.y - b.y);

    const groups = [];
    let current = null;

    roots.forEach((instance) => {
      if (!current || current.category !== instance.startCategory) {
        if (current) groups.push(current);
        current = {
          id: `${instance.startCategory}-${instance.instanceId}`,
          category: instance.startCategory,
          top: instance.y,
          bottom: instance.y + cardHeight,
        };
        return;
      }

      current.bottom = Math.max(current.bottom, instance.y + cardHeight);
    });

    if (current) groups.push(current);

    return groups.map((group) => ({
      ...group,
      tone: getStartCategoryTone(group.category),
      x: Math.max(6, LEFT_PADDING - 24),
      width: cardWidth + 48,
      y: Math.max(8, group.top - 20),
      height: Math.max(cardHeight + 40, group.bottom - group.top + 40),
    }));
  }, [scaledLayout.positioned, cardHeight, cardWidth]);

  const edgesToRender = useMemo(() => {
    return scaledLayout.positioned
      .filter((instance) => instance.parentInstanceId)
      .map((instance) => {
        const source = positionedMap.get(instance.parentInstanceId);
        const target = positionedMap.get(instance.instanceId);
        const siblings = scaledLayout.positioned.filter(
          (item) => item.parentInstanceId === instance.parentInstanceId,
        );
        if (!source || !target) return null;
        const edgeMeta = graph.edges.find(
          (edge) =>
            edge.source === source.stateId &&
            edge.target === target.stateId &&
            edge.label === (instance.incomingLabel || ""),
        );
        const readable = getReadableEdgeLabel({
          ...edgeMeta,
          label: instance.incomingLabel || edgeMeta?.label || "",
          primaryLabel:
            instance.incomingPrimaryLabel || edgeMeta?.primaryLabel || "",
          secondaryLabel:
            instance.incomingSecondaryLabel || edgeMeta?.secondaryLabel || "",
          sourceKind: instance.incomingSourceKind || edgeMeta?.sourceKind || "",
          incomingTransitionKey: instance.incomingTransitionKey,
        });

        return {
          id: `${instance.parentInstanceId}-${instance.instanceId}`,
          source: {
            ...source,
            bounds: getNodeShapeMetrics(
              nodeMap.get(source.stateId),
              cardWidth,
              cardHeight,
              cardScale,
            ),
          },
          target: {
            ...target,
            bounds: getNodeShapeMetrics(
              nodeMap.get(target.stateId),
              cardWidth,
              cardHeight,
              cardScale,
            ),
            siblingIndex: siblings.findIndex(
              (item) => item.instanceId === instance.instanceId,
            ),
            siblingCount: siblings.length,
          },
          label: instance.incomingLabel || "",
          primaryLabel: readable.primaryLabel,
          secondaryLabel: readable.secondaryLabel,
          labelWidth:
            instance.incomingLabelWidth ||
            edgeMeta?.labelWidth ||
            EDGE_LABEL_WIDTH,
          tone: getEdgeTone(
            instance.incomingTransitionKey ||
              edgeMeta?.transitionKey ||
              instance.incomingLabel ||
              "",
          ),
          meta: {
            ...edgeMeta,
            sourceStateId: source.stateId,
            targetStateId: target.stateId,
            label: instance.incomingLabel || edgeMeta?.label || "",
            primaryLabel: readable.primaryLabel,
            secondaryLabel: readable.secondaryLabel,
            transitionKey:
              instance.incomingTransitionKey || edgeMeta?.transitionKey || "",
            sourceKind:
              instance.incomingSourceKind || edgeMeta?.sourceKind || "",
          },
        };
      })
      .filter(Boolean);
  }, [
    graph.edges,
    scaledLayout.positioned,
    positionedMap,
    nodeMap,
    cardWidth,
    cardHeight,
    cardScale,
  ]);

  const matchedInstanceIds = useMemo(() => {
    const term = String(searchTerm || "")
      .trim()
      .toLowerCase();
    if (!term) return [];

    return scaledLayout.positioned
      .filter((instance) => {
        const node = nodeMap.get(instance.stateId);
        if (!node) return false;
        const haystack = [
          node.id,
          node.type,
          node.comment,
          node.screenComment,
          node.screenId,
          getStateActionSummary(node),
          instance.incomingLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .map((instance) => instance.instanceId);
  }, [searchTerm, scaledLayout.positioned, nodeMap]);

  const currentMatchIndex = useMemo(() => {
    if (!matchedInstanceIds.length || !selectedInstanceId) return -1;
    return matchedInstanceIds.indexOf(selectedInstanceId);
  }, [matchedInstanceIds, selectedInstanceId]);

  const moveToMatchedInstance = (direction) => {
    if (!matchedInstanceIds.length) return;
    const currentIndex = currentMatchIndex >= 0 ? currentMatchIndex : 0;
    const nextIndex =
      direction > 0
        ? (currentIndex + 1) % matchedInstanceIds.length
        : (currentIndex - 1 + matchedInstanceIds.length) %
          matchedInstanceIds.length;
    pendingFocusModeRef.current = "center";
    pendingCenterRef.current = true;
    setSelectedInstanceId(matchedInstanceIds[nextIndex]);
  };

  const temporarilySkipScrollPersist = (duration = 260) => {
    skipScrollPersistRef.current = true;
    if (skipScrollPersistTimerRef.current) {
      window.clearTimeout(skipScrollPersistTimerRef.current);
    }
    skipScrollPersistTimerRef.current = window.setTimeout(() => {
      skipScrollPersistRef.current = false;
      skipScrollPersistTimerRef.current = null;
    }, duration);
  };

  const zoomCanvasAt = (nextZoom, point = lastPointerRef.current) => {
    const container = scrollRef.current;
    if (!container) return;

    const prevZoom = canvasZoomRef.current || NATURAL_CANVAS_ZOOM;
    const next = Math.min(2, Math.max(0.55, Number(nextZoom.toFixed(2))));
    if (next === prevZoom) return;

    const rect = container.getBoundingClientRect();
    const pointerX = Math.max(
      0,
      Math.min(point?.x ?? rect.width / 2, rect.width),
    );
    const pointerY = Math.max(
      0,
      Math.min(point?.y ?? rect.height / 2, rect.height),
    );
    const contentX = (container.scrollLeft + pointerX) / prevZoom;
    const contentY = (container.scrollTop + pointerY) / prevZoom;
    const nextLeft = Math.max(0, contentX * next - pointerX);
    const nextTop = Math.max(0, contentY * next - pointerY);

    canvasZoomRef.current = next;
    temporarilySkipScrollPersist(220);

    if (zoomFrameRef.current) {
      cancelAnimationFrame(zoomFrameRef.current);
    }

    zoomFrameRef.current = requestAnimationFrame(() => {
      setCanvasZoom(next);
      requestAnimationFrame(() => {
        container.scrollTo({
          left: nextLeft,
          top: nextTop,
          behavior: "auto",
        });
        latestScrollRef.current = {
          left: nextLeft,
          top: nextTop,
        };
        zoomFrameRef.current = null;
      });
    });
  };

  const focusOnSelectedInstance = (mode = "center", behavior = "smooth") => {
    const container = scrollRef.current;
    if (!container || !selectedPositionedInstance) return;

    const selectedBounds = getNodeShapeMetrics(
      selectedNode,
      cardWidth,
      cardHeight,
      cardScale,
    );
    const selectedCenterX =
      selectedPositionedInstance.x +
      selectedBounds.left +
      selectedBounds.width / 2;
    const selectedCenterY =
      selectedPositionedInstance.y +
      selectedBounds.top +
      selectedBounds.height / 2;
    const targetLeft =
      mode === "as-start"
        ? (selectedPositionedInstance.x + selectedBounds.left) * canvasZoom - 42
        : selectedCenterX * canvasZoom - container.clientWidth / 2;
    const targetTop = selectedCenterY * canvasZoom - container.clientHeight / 2;
    const nextLeft = Math.max(0, targetLeft);
    const nextTop = Math.max(0, targetTop);

    temporarilySkipScrollPersist(behavior === "smooth" ? 420 : 120);
    container.scrollTo({
      left: nextLeft,
      top: nextTop,
      behavior,
    });

    latestScrollRef.current = {
      left: nextLeft,
      top: nextTop,
    };
  };

  const centerCurrentView = () => {
    if (!selectedInstanceId && scaledLayout.positioned[0]?.instanceId) {
      pendingFocusModeRef.current = "center";
      pendingCenterRef.current = true;
      setSelectedInstanceId(scaledLayout.positioned[0].instanceId);
      return;
    }

    pendingFocusModeRef.current = "center";
    focusOnSelectedInstance("center", "smooth");
  };

  const getScreenStatus = (node) => {
    const screenResource = node?.screenResource || "";
    if (!screenResource || !screensLoaded) return null;
    const normalizedResource = normalizeScreenResourceName(screenResource);
    const match =
      availableScreens.get(normalizedResource) ||
      screensList.find(
        (screen) =>
          normalizeScreenResourceName(screen.resource) === normalizedResource,
      );

    if (!match) return null;
    return {
      label: match.resource,
      screen: match,
    };
  };

  const getScreenStatusFromParam = (key, value) => {
    if (!isScreenParamKey(key) || !screensLoaded || !value) return null;
    const resourceName = screenResourceById.get(String(value).trim());
    if (!resourceName) return null;
    const match =
      availableScreens.get(resourceName) ||
      screensList.find(
        (screen) =>
          normalizeScreenResourceName(screen.resource) === resourceName,
      );
    if (!match) return null;
    return {
      label: match.resource,
      screen: match,
    };
  };

  const jumpToState = (node) => {
    onSelectState?.(node.id);
    setInspector(null);
    setSendMenu(null);
  };

  const jumpToTranMap = (tranMapId) => {
    if (tranMapId === null || tranMapId === undefined || tranMapId === "")
      return;
    onSelectState?.({
      type: "sidebar",
      section: "TranMap",
      value: tranMapId,
    });
    setEdgeMenu(null);
    setSendMenu(null);
  };

  const jumpToTran = (tranCode) => {
    if (tranCode === null || tranCode === undefined || tranCode === "") return;
    onSelectState?.({
      type: "sidebar",
      section: "Tran",
      value: tranCode,
    });
    setEdgeMenu(null);
    setSendMenu(null);
  };

  const jumpToParam = (node, key) => {
    onSelectState?.({
      type: "param",
      stateId: node.id,
      key,
    });
    setInspector(null);
    setParamMenu(null);
    setSendMenu(null);
  };

  const collapseColumn = (items, level, exceptId) => {
    const idsToRemove = new Set();
    items
      .filter(
        (item) =>
          item.level === level && item.instanceId !== exceptId && item.expanded,
      )
      .forEach((item) => {
        collectDescendants(item.instanceId, items).forEach((descId) =>
          idsToRemove.add(descId),
        );
      });

    return items
      .filter((item) => !idsToRemove.has(item.instanceId))
      .map((item) =>
        item.level === level && item.instanceId !== exceptId
          ? { ...item, expanded: false }
          : item,
      );
  };

  const appendEdgesToInstance = (instanceId, edgesToAppend) => {
    pendingFocusModeRef.current = "as-start";
    pendingCenterRef.current = autoFocusOnExpand;
    setInstances((prev) => {
      const current = prev.find((item) => item.instanceId === instanceId);
      if (!current) return prev;

      const collapsed = collapseColumn(prev, current.level, current.instanceId);
      const sameColumnCount = collapsed.filter(
        (item) => item.level === current.level + 1,
      ).length;
      const existingChildKeys = new Set(
        collapsed
          .filter((item) => item.parentInstanceId === current.instanceId)
          .map((item) => `${item.incomingLabel || ""}::${item.stateId}`),
      );
      const newChildren = edgesToAppend
        .filter((edge) => {
          const key = `${edge.label || ""}::${edge.target}`;
          if (existingChildKeys.has(key)) return false;
          existingChildKeys.add(key);
          return true;
        })
        .map((edge, index) => ({
          instanceId: `inst-${nextIdRef.current++}`,
          stateId: edge.target,
          level: current.level + 1,
          parentInstanceId: current.instanceId,
          incomingLabel: edge.label,
          incomingPrimaryLabel: edge.primaryLabel || edge.label,
          incomingSecondaryLabel: edge.secondaryLabel || "",
          incomingLabelWidth: edge.labelWidth || null,
          incomingSourceKind: edge.sourceKind || null,
          incomingTransitionKey: edge.transitionKey || null,
          order: sameColumnCount + index,
          expanded: false,
        }));

      return collapsed
        .map((item) =>
          item.instanceId === current.instanceId
            ? { ...item, expanded: true }
            : item,
        )
        .concat(newChildren);
    });
    setSelectedInstanceId(instanceId);
  };

  const toggleInstance = (instanceId, event) => {
    pendingFocusModeRef.current = "as-start";
    pendingCenterRef.current = autoFocusOnExpand;
    setParamMenu(null);
    setEdgeMenu(null);
    setSendMenu(null);

    const current = instances.find((item) => item.instanceId === instanceId);
    const currentNode = current ? nodeMap.get(current.stateId) : null;
    const outgoingEdges = current
      ? visibleEdges.filter((edge) => edge.source === current.stateId)
      : [];
    const sendContinuationEdges = outgoingEdges
      .filter(isSendContinuationEdge)
      .map((edge) => ({
        ...edge,
        sendSuggestion: getSendFlowSuggestion(
          edge,
          current,
          instances,
          nodeMap,
        ),
      }))
      .sort(
        (left, right) =>
          (right.sendSuggestion?.score || 0) -
          (left.sendSuggestion?.score || 0),
      );

    if (
      current &&
      !current.expanded &&
      String(currentNode?.type || "").toUpperCase() === "SEND" &&
      sendContinuationEdges.length > SEND_CHOOSER_LIMIT
    ) {
      pendingFocusModeRef.current = "center";
      pendingCenterRef.current = false;
      const position = getFloatingPositionFromNode(event, 390, 430, 8);
      setSelectedInstanceId(instanceId);
      setSendMenu({
        instanceId,
        stateId: current.stateId,
        count: sendContinuationEdges.length,
        edges: sendContinuationEdges,
        query: "",
        x: position.x,
        y: position.y,
      });
      return;
    }

    if (!current || outgoingEdges.length === 0) {
      setSelectedInstanceId(instanceId);
      return;
    }

    if (current.expanded) {
      setInstances((prev) => {
        const descendants = new Set(collectDescendants(instanceId, prev));
        return prev
          .filter((item) => !descendants.has(item.instanceId))
          .map((item) =>
            item.instanceId === instanceId
              ? { ...item, expanded: false }
              : item,
          );
      });
      setSelectedInstanceId(instanceId);
      return;
    }

    appendEdgesToInstance(instanceId, outgoingEdges);
  };

  const toggleExceptionRoutes = () => {
    setShowSideExits((prev) => {
      const next = !prev;

      if (next) {
        setInstances((items) => {
          const additions = [];
          const existingChildKeys = new Set(
            items
              .filter((item) => item.parentInstanceId)
              .map(
                (item) =>
                  `${item.parentInstanceId}::${item.incomingLabel || ""}::${item.stateId}`,
              ),
          );

          items
            .filter((item) => item.expanded)
            .forEach((item) => {
              const sideEdges = graph.edges.filter(
                (edge) => edge.source === item.stateId && isSideExitEdge(edge),
              );
              sideEdges.forEach((edge) => {
                const childKey = `${item.instanceId}::${edge.label || ""}::${edge.target}`;
                if (existingChildKeys.has(childKey)) return;
                existingChildKeys.add(childKey);
                additions.push({
                  instanceId: `inst-${nextIdRef.current++}`,
                  stateId: edge.target,
                  level: item.level + 1,
                  parentInstanceId: item.instanceId,
                  incomingLabel: edge.label,
                  incomingPrimaryLabel: edge.primaryLabel || edge.label,
                  incomingSecondaryLabel: edge.secondaryLabel || "",
                  incomingLabelWidth: edge.labelWidth || null,
                  incomingSourceKind: edge.sourceKind || null,
                  incomingTransitionKey: edge.transitionKey || null,
                  order:
                    items.filter(
                      (candidate) => candidate.level === item.level + 1,
                    ).length + additions.length,
                  expanded: false,
                });
              });
            });

          return additions.length ? items.concat(additions) : items;
        });
      } else {
        setInstances((items) => {
          const idsToRemove = new Set();
          items
            .filter((item) =>
              isSideExitEdge(item.incomingTransitionKey || item.incomingLabel),
            )
            .forEach((item) => {
              idsToRemove.add(item.instanceId);
              collectDescendants(item.instanceId, items).forEach((descId) =>
                idsToRemove.add(descId),
              );
            });

          const nextItems = items
            .filter((item) => !idsToRemove.has(item.instanceId))
            .map((item) => {
              if (!item.expanded) return item;
              const stillHasChildren = items.some(
                (candidate) =>
                  candidate.parentInstanceId === item.instanceId &&
                  !idsToRemove.has(candidate.instanceId),
              );
              return stillHasChildren ? item : { ...item, expanded: false };
            });

          setSelectedInstanceId((selected) =>
            nextItems.some((item) => item.instanceId === selected)
              ? selected
              : (nextItems[0]?.instanceId ?? null),
          );
          return nextItems;
        });
      }

      return next;
    });
  };

  const resetFlow = () => {
    nextIdRef.current = 1;
    const initial = buildInitialInstances(
      graph,
      nextIdRef,
      filterStartIdsByCategories(graph, startCategoryFilter),
    );
    pendingScrollRestoreRef.current = true;
    restoredViewportRef.current = false;
    latestScrollRef.current = { left: 0, top: 0 };
    setInstances(initial);
    setSelectedInstanceId(initial[0]?.instanceId ?? null);
    setInspector(null);
    setParamMenu(null);
    setEdgeMenu(null);
    setSendMenu(null);
    onFlowViewStateChange?.((prev) => ({
      ...(prev || {}),
      scrollLeft: 0,
      scrollTop: 0,
    }));
  };

  const toggleStartCategoryFilter = (category) => {
    setStartCategoryFilter((prev) => {
      const isActive = prev.includes(category);
      if (!isActive) {
        pendingCategoryFocusRef.current = category;
      }
      return isActive
        ? prev.filter((item) => item !== category)
        : [...prev, category];
    });
  };

  const openInspector = (event, instance, node) => {
    setParamMenu(null);
    setEdgeMenu(null);
    setSendMenu(null);
    setSelectedInstanceId(instance.instanceId);
    const { x, y } = getFloatingPositionFromNode(event, 320, 420, 8);
    setInspector({
      node,
      instance,
      x,
      y,
    });
  };

  const startFloatingDrag = (event, menuRef, setMenu) => {
    if (event.button !== 0) return;
    if (event.target.closest?.("button, input, textarea, select, a")) return;

    const rect = menuRef.current?.getBoundingClientRect?.();
    if (!rect) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    floatingDragRef.current = {
      setMenu,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  useEffect(() => {
    const moveFloatingMenu = (event) => {
      const drag = floatingDragRef.current;
      if (!drag) return;

      const next = clampFloatingPosition(
        event.clientX - drag.offsetX,
        event.clientY - drag.offsetY,
        drag.width,
        drag.height,
      );
      drag.setMenu((current) => (current ? { ...current, ...next } : current));
    };

    const stopFloatingDrag = () => {
      floatingDragRef.current = null;
    };

    window.addEventListener("pointermove", moveFloatingMenu);
    window.addEventListener("pointerup", stopFloatingDrag);
    window.addEventListener("pointercancel", stopFloatingDrag);
    window.addEventListener("blur", stopFloatingDrag);
    return () => {
      window.removeEventListener("pointermove", moveFloatingMenu);
      window.removeEventListener("pointerup", stopFloatingDrag);
      window.removeEventListener("pointercancel", stopFloatingDrag);
      window.removeEventListener("blur", stopFloatingDrag);
    };
  }, []);

  useEffect(() => {
    const closeFloating = (event) => {
      if (
        inspectorRef.current?.contains(event.target) ||
        paramMenuRef.current?.contains(event.target) ||
        edgeMenuRef.current?.contains(event.target) ||
        sendMenuRef.current?.contains(event.target)
      ) {
        return;
      }
      setInspector(null);
      setParamMenu(null);
      setEdgeMenu(null);
      setSendMenu(null);
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setInspector(null);
        setParamMenu(null);
        setEdgeMenu(null);
        setSendMenu(null);
      }
    };

    window.addEventListener("pointerdown", closeFloating);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", closeFloating);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !selectedPositionedInstance || !pendingCenterRef.current)
      return;
    pendingCenterRef.current = false;
    focusOnSelectedInstance(pendingFocusModeRef.current, "smooth");
  }, [selectedPositionedInstance, cardWidth, cardHeight]);

  useEffect(() => {
    if (!restoredViewportRef.current || !selectedPositionedInstance) return;

    const signature = [horizontalScale, verticalScale, cardScale].join("|");
    if (!lastViewSignatureRef.current) {
      lastViewSignatureRef.current = signature;
      return;
    }

    if (signature === lastViewSignatureRef.current) return;
    lastViewSignatureRef.current = signature;
    focusOnSelectedInstance("center", "auto");
  }, [horizontalScale, verticalScale, cardScale, selectedPositionedInstance]);

  useEffect(() => {
    const container = scrollRef.current;
    if (
      !container ||
      restoredViewportRef.current ||
      !pendingScrollRestoreRef.current
    )
      return;

    skipScrollPersistRef.current = true;
    const targetLeft = Math.max(
      0,
      Number(initialViewStateRef.current.scrollLeft) || 0,
    );
    const targetTop = Math.max(
      0,
      Number(initialViewStateRef.current.scrollTop) || 0,
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.scrollTo({
          left: targetLeft,
          top: targetTop,
          behavior: "auto",
        });
        latestScrollRef.current = {
          left: targetLeft,
          top: targetTop,
        };
      });
      restoredViewportRef.current = true;
      pendingScrollRestoreRef.current = false;
      temporarilySkipScrollPersist(80);
    });
  }, [scaledLayout.width, scaledLayout.height]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !onFlowViewStateChange) return;

    const persistScroll = () => {
      latestScrollRef.current = {
        left: container.scrollLeft,
        top: container.scrollTop,
      };
      onFlowViewStateChange((prev) => ({
        ...(prev || {}),
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      }));
    };

    const handleScroll = () => {
      if (skipScrollPersistRef.current) return;
      persistScroll();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      persistScroll();
      container.removeEventListener("scroll", handleScroll);
    };
  }, [onFlowViewStateChange]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handlePointerDown = (event) => {
      if (!event.ctrlKey || event.button !== 0) return;
      if (
        event.target.closest(
          ".flow-select-node, .flow-op-node, .flow-inspector, .flows-utilitybar, .flows-subbar",
        )
      ) {
        return;
      }

      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      container.classList.add("dragging-canvas");
      event.preventDefault();
    };

    const handlePointerMove = (event) => {
      if (!dragRef.current) return;
      container.scrollLeft =
        dragRef.current.scrollLeft - (event.clientX - dragRef.current.startX);
      container.scrollTop =
        dragRef.current.scrollTop - (event.clientY - dragRef.current.startY);
    };

    const stopDrag = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      container.classList.remove("dragging-canvas");
    };

    container.addEventListener("pointerdown", handlePointerDown);
    const rememberPointer = (event) => {
      const rect = container.getBoundingClientRect();
      lastPointerRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handleWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      rememberPointer(event);

      const step = event.deltaY < 0 ? 0.05 : -0.05;
      zoomCanvasAt((canvasZoomRef.current || 1) + step, lastPointerRef.current);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    window.addEventListener("blur", stopDrag);
    container.addEventListener("pointermove", rememberPointer, {
      passive: true,
    });
    container.addEventListener("pointerdown", rememberPointer, {
      passive: true,
    });
    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", rememberPointer);
      container.removeEventListener("pointerdown", rememberPointer);
      container.removeEventListener("wheel", handleWheel, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      window.removeEventListener("blur", stopDrag);
      if (skipScrollPersistTimerRef.current) {
        window.clearTimeout(skipScrollPersistTimerRef.current);
        skipScrollPersistTimerRef.current = null;
      }
      if (zoomFrameRef.current) {
        cancelAnimationFrame(zoomFrameRef.current);
        zoomFrameRef.current = null;
      }
      container.classList.remove("dragging-canvas");
    };
  }, []);

  const maxVisibleLevel = Math.max(
    0,
    ...scaledLayout.positioned.map((item) => item.level),
    0,
  );
  const extraScrollableWidth =
    maxVisibleLevel >= 2 ? 420 + (maxVisibleLevel - 2) * 140 : 0;
  const zoomedCanvasWidth = Math.max(
    Math.round((scaledLayout.width + extraScrollableWidth) * canvasZoom),
    720,
  );
  const zoomedCanvasHeight = Math.max(
    Math.round(scaledLayout.height * canvasZoom),
    360,
  );
  const selectedStats = selectedNode
    ? {
        outgoing: visibleEdges.filter((edge) => edge.source === selectedNode.id)
          .length,
      }
    : null;
  const screenStatus = inspector ? getScreenStatus(inspector.node) : null;
  const filteredSendEdges = sendMenu
    ? sendMenu.edges.filter((edge) => {
        const query = String(sendMenu.query || "")
          .trim()
          .toLowerCase();
        if (!query) return true;
        return [
          edge.tranMapId,
          edge.tranMapComment,
          edge.tranMapOperationCodeKey,
          edge.transactionComment,
          edge.targetStateId,
          edge.matchedFields,
          getTranMapConditionText(edge),
          edge.sendSuggestion?.reason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
    : [];

  return (
    <div className="flows-panel compact-mode">
      <section className="flows-canvas-panel compact-mode">
        <div className="flows-utilitybar">
          <div className="flows-toolbar-group flows-toolbar-summary">
            <div className="flows-toolbar-caption">
              Flujo · {scaledLayout.positioned.length} visibles
            </div>
            <label className="flows-start-search">
              <FaSearch />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar"
              />
              <button
                type="button"
                className="flows-search-btn"
                onClick={() => moveToMatchedInstance(-1)}
                title="Anterior"
                disabled={!matchedInstanceIds.length}
              >
                {"<"}
              </button>
              <button
                type="button"
                className="flows-search-btn"
                onClick={() => moveToMatchedInstance(1)}
                title="Siguiente"
                disabled={!matchedInstanceIds.length}
              >
                {">"}
              </button>
            </label>
            <div className="flows-group-filter">
              {START_FILTER_OPTIONS.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`flows-group-pill ${startCategoryFilter.includes(category) ? "active" : ""}`}
                  onClick={() => toggleStartCategoryFilter(category)}
                  title={`Mostrar ${category}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`flows-toolbar-group flows-toolbar-focus ${selectedNode ? "has-selected-state" : ""}`}
          >
            {selectedNode ? (
              <>
                <span className="flows-toolbar-readout selected-state-pill">
                  {selectedInstance?.incomingLabel || "State"} {selectedNode.id}
                </span>
                <span className="flows-toolbar-readout flows-focus-chip">
                  &middot; {selectedStats?.outgoing} salida(s)
                </span>
              </>
            ) : (
              <span className="selected-state-name">
                Selecciona un state para navegar el flujo
              </span>
            )}
          </div>

          <div className="flows-toolbar-group flows-toolbar-actions">
            <button
              type="button"
              className={`flows-tool-btn ${showLayoutPanel ? "active" : ""}`}
              onClick={() => setShowLayoutPanel((prev) => !prev)}
            >
              <FaSlidersH />
              <span>Vista</span>
            </button>
            <button
              type="button"
              className={`flows-tool-btn ${showSideExits ? "active" : ""}`}
              onClick={toggleExceptionRoutes}
              title="Mostrar u ocultar ErrorState, TimeoutState, CancelState y NoMatchState"
            >
              <FaLayerGroup />
              <span>Excepciones</span>
            </button>
            <button
              type="button"
              className="flows-tool-btn"
              onClick={resetFlow}
            >
              <FaRedoAlt />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>

        {showLayoutPanel && (
          <div className="flows-subbar">
            <div className="flow-layout-panel">
              <div className="flow-layout-block">
                <label className="flow-layout-check">
                  <input
                    type="checkbox"
                    checked={autoFocusOnExpand}
                    onChange={(event) =>
                      setAutoFocusOnExpand(event.target.checked)
                    }
                  />
                  <span>Centrado automático</span>
                </label>
              </div>
              <div className="flow-layout-block">
                <span className="flow-layout-label">Preset</span>
                <div className="flow-layout-pills">
                  <button
                    type="button"
                    className="flow-layout-pill"
                    onClick={() => setLayoutPreset("compacta")}
                  >
                    Compacta
                  </button>
                  <button
                    type="button"
                    className="flow-layout-pill"
                    onClick={() => setLayoutPreset("equilibrada")}
                  >
                    Equilibrada
                  </button>
                  <button
                    type="button"
                    className="flow-layout-pill"
                    onClick={() => setLayoutPreset("amplia")}
                  >
                    Amplia
                  </button>
                </div>
              </div>

              <div className="flow-layout-block">
                <label className="spacing-control">
                  <FaVectorSquare />
                  <span>Tamaño cards</span>
                  <input
                    type="range"
                    min="0.82"
                    max="1.45"
                    step="0.02"
                    value={cardScale}
                    onChange={(event) =>
                      setCardScale(Number(event.target.value))
                    }
                  />
                </label>
              </div>

              <div className="flow-layout-block">
                <label className="spacing-control">
                  <span>Separación horizontal</span>
                  <input
                    type="range"
                    min="0.75"
                    max="2.2"
                    step="0.05"
                    value={horizontalScale}
                    onChange={(event) =>
                      setHorizontalScale(Number(event.target.value))
                    }
                  />
                </label>
                <label className="spacing-control">
                  <span>Separación vertical</span>
                  <input
                    type="range"
                    min="0.85"
                    max="2"
                    step="0.05"
                    value={verticalScale}
                    onChange={(event) =>
                      setVerticalScale(Number(event.target.value))
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="flow-canvas-scroll" ref={scrollRef}>
          <div
            className="flow-canvas-zoom-shell"
            style={{
              width: zoomedCanvasWidth,
              height: zoomedCanvasHeight,
            }}
          >
            <div
              className="flow-canvas-stage"
              style={{
                width: Math.max(scaledLayout.width + extraScrollableWidth, 720),
                height: Math.max(scaledLayout.height, 360),
                transform: `scale(${canvasZoom})`,
                transformOrigin: "top left",
              }}
            >
              <svg
                className="flow-canvas-svg"
                width={Math.max(scaledLayout.width + extraScrollableWidth, 720)}
                height={Math.max(scaledLayout.height, 360)}
              >
                <defs>
                  <marker
                    id="flow-arrow"
                    viewBox="0 0 10 10"
                    refX="8.4"
                    refY="5"
                    markerWidth="5.8"
                    markerHeight="5.8"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#5f6f8a" />
                  </marker>
                </defs>

                {edgesToRender.map((edge) => {
                  const path = getEdgePath(
                    edge.source,
                    edge.target,
                    cardWidth,
                    cardHeight,
                    edge.labelWidth,
                  );
                  return (
                    <g key={edge.id}>
                      <path
                        d={`M ${path.startX} ${path.startY} H ${path.midX}`}
                        className="flow-stage-edge tone-root"
                      />
                      <path
                        d={`M ${path.midX} ${path.startY} V ${path.endY} H ${path.labelStartX}`}
                        className={`flow-stage-edge tone-${edge.tone}`}
                      />
                      <path
                        d={`M ${path.labelEndX} ${path.endY} H ${path.beforeEndX}`}
                        className={`flow-stage-edge tone-${edge.tone}`}
                        markerEnd="url(#flow-arrow)"
                      />
                    </g>
                  );
                })}
              </svg>

              <div className="flow-edge-label-layer">
                {edgesToRender.map((edge) => {
                  const path = getEdgePath(
                    edge.source,
                    edge.target,
                    cardWidth,
                    cardHeight,
                    edge.labelWidth,
                  );
                  return (
                    <div
                      key={`${edge.id}-label`}
                      className={`flow-edge-pill tone-${edge.tone} ${
                        edge.secondaryLabel ? "has-secondary" : ""
                      }`}
                      style={{
                        left: path.labelStartX,
                        top: path.endY - (edge.secondaryLabel ? 20 : 13),
                        width: path.labelWidth,
                      }}
                      title={
                        edge.meta?.tranMapComment ||
                        edge.meta?.transactionComment ||
                        edge.meta?.matchedFields ||
                        edge.label
                      }
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setInspector(null);
                        setParamMenu(null);
                        setSendMenu(null);
                        setEdgeMenu({
                          x: Math.min(
                            event.clientX + 8,
                            window.innerWidth - 396,
                          ),
                          y: Math.min(
                            event.clientY + 8,
                            window.innerHeight - 420,
                          ),
                          edge: edge.meta,
                        });
                      }}
                    >
                      <span className="flow-edge-pill-main">
                        {renderHighlightedText(
                          edge.primaryLabel || edge.label,
                          searchTerm,
                        )}
                      </span>
                      {edge.secondaryLabel ? (
                        <small className="flow-edge-pill-sub">
                          {renderHighlightedText(
                            edge.secondaryLabel,
                            searchTerm,
                          )}
                        </small>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flow-start-group-layer">
                {startGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`flow-start-group-block tone-${group.tone}`}
                    style={{
                      left: group.x,
                      top: group.y,
                      width: group.width,
                      height: group.height,
                    }}
                  />
                ))}
              </div>

              {scaledLayout.positioned.map((instance) => {
                const node = nodeMap.get(instance.stateId);
                if (!node) return null;
                const hiddenExitCount = showSideExits
                  ? 0
                  : graph.edges.filter(
                      (edge) => edge.source === node.id && isSideExitEdge(edge),
                    ).length;

                return (
                  <div
                    key={instance.instanceId}
                    className="flow-stage-node"
                    style={{
                      left: instance.x,
                      top: instance.y,
                      width: cardWidth,
                      height: cardHeight,
                      "--flow-card-scale": cardScale,
                    }}
                  >
                    <FlowNodeCard
                      node={node}
                      graph={graph}
                      instance={instance}
                      isSelected={selectedInstanceId === instance.instanceId}
                      onToggle={(event) =>
                        toggleInstance(instance.instanceId, event)
                      }
                      onInspect={(event) =>
                        openInspector(event, instance, node)
                      }
                      cardScale={cardScale}
                      searchTerm={searchTerm}
                      highlightAllMatches={highlightAllMatches}
                      isMatchFocused={
                        matchedInstanceIds.includes(instance.instanceId) &&
                        selectedInstanceId === instance.instanceId
                      }
                      hiddenExitCount={hiddenExitCount}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flow-zoom-dock">
          <div className="flow-zoom-panel">
            <button
              type="button"
              className="flow-zoom-step"
              onClick={() =>
                zoomCanvasAt((canvasZoomRef.current || canvasZoom) - 0.05)
              }
              title="Reducir zoom"
            >
              <FaMinus />
            </button>
            <input
              type="range"
              min="0.55"
              max="2"
              step="0.05"
              value={canvasZoom}
              onChange={(event) => zoomCanvasAt(Number(event.target.value))}
              title="Zoom"
            />
            <button
              type="button"
              className="flow-zoom-step"
              onClick={() =>
                zoomCanvasAt((canvasZoomRef.current || canvasZoom) + 0.05)
              }
              title="Aumentar zoom"
            >
              <FaPlus />
            </button>
            <button
              type="button"
              className="flow-zoom-action"
              onClick={() => zoomCanvasAt(NATURAL_CANVAS_ZOOM)}
              title="Restablecer zoom"
            >
              100%
            </button>
            <button
              type="button"
              className="flow-zoom-step"
              onClick={centerCurrentView}
              title="Centrar seleccion"
            >
              <FaExpandArrowsAlt />
            </button>
            <span className="flow-zoom-value">
              {Math.round((canvasZoom / NATURAL_CANVAS_ZOOM) * 100)}%
            </span>
          </div>
        </div>

        {inspector && (
          <div
            ref={inspectorRef}
            className="flow-inspector"
            style={{ left: inspector.x, top: inspector.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className="flow-inspector-head"
              onPointerDown={(event) =>
                startFloatingDrag(event, inspectorRef, setInspector)
              }
            >
              <div>
                <strong>
                  State {inspector.node.id} - {inspector.node.type}
                </strong>
                <span>{inspector.node.comment || "Sin comentario"}</span>
              </div>
              <button
                type="button"
                className="flow-inspector-close"
                onClick={() => {
                  setInspector(null);
                  setParamMenu(null);
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div className="flow-inspector-body">
              <div className="flow-inspector-actions">
                <button
                  type="button"
                  className="flow-screen-preview-btn ready"
                  onClick={() => jumpToState(inspector.node)}
                >
                  <span className="flow-screen-preview-main">
                    <IoCodeSlash />
                    Ir al XML
                  </span>
                </button>
              </div>

              {screenStatus && (
                <div className="flow-inspector-actions">
                  <button
                    type="button"
                    className="flow-screen-preview-btn ready"
                    onClick={() => {
                      onOpenScreen?.(screenStatus.screen);
                      setInspector(null);
                    }}
                  >
                    <span className="flow-screen-preview-main">
                      <FaExternalLinkAlt />
                      Ir a {screenStatus.label}
                    </span>
                  </button>
                </div>
              )}

              <section className="flow-inspector-section">
                <h4>
                  <FaLayerGroup /> Parametros
                </h4>
                <div className="flow-inspector-list compact">
                  {inspectorParams.length > 0 ? (
                    inspectorParams.map(([key, value]) => {
                      const paramScreenStatus = getScreenStatusFromParam(
                        key,
                        value,
                      );
                      return (
                        <button
                          key={key}
                          type="button"
                          className="flow-param-row compact"
                          onClick={() => jumpToParam(inspector.node, key)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setSendMenu(null);
                            setParamMenu({
                              x: Math.min(
                                event.clientX + 8,
                                window.innerWidth - 220,
                              ),
                              y: Math.min(
                                event.clientY + 8,
                                window.innerHeight - 140,
                              ),
                              node: inspector.node,
                              key,
                              value,
                              screenStatus: paramScreenStatus,
                            });
                          }}
                        >
                          <span>{key}</span>
                          <strong>{value || "-"}</strong>
                        </button>
                      );
                    })
                  ) : (
                    <div className="flow-param-empty">
                      Este state no tiene parametros.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {paramMenu && (
          <div
            ref={paramMenuRef}
            className="flow-inspector flow-param-menu"
            style={{ left: paramMenu.x, top: paramMenu.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="flow-inspector-body">
              <div className="flow-inspector-actions">
                <button
                  type="button"
                  className="flow-screen-preview-btn ready"
                  onClick={() => jumpToParam(paramMenu.node, paramMenu.key)}
                >
                  <span className="flow-screen-preview-main">
                    <IoCodeSlash />
                    Ir al XML
                  </span>
                </button>
              </div>
              {paramMenu.screenStatus && (
                <div className="flow-inspector-actions">
                  <button
                    type="button"
                    className="flow-screen-preview-btn ready"
                    onClick={() => {
                      onOpenScreen?.(paramMenu.screenStatus.screen);
                      setParamMenu(null);
                      setInspector(null);
                    }}
                  >
                    <span className="flow-screen-preview-main">
                      <FaExternalLinkAlt />
                      Ir a {paramMenu.screenStatus.label}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {edgeMenu && (
          <div
            ref={edgeMenuRef}
            className="flow-inspector flow-edge-menu"
            style={{ left: edgeMenu.x, top: edgeMenu.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className="flow-inspector-head"
              onPointerDown={(event) =>
                startFloatingDrag(event, edgeMenuRef, setEdgeMenu)
              }
            >
              <div>
                <strong>
                  {edgeMenu.edge?.sourceKind === "tranmap-continuation"
                    ? `TranMap ${edgeMenu.edge?.tranMapId || "-"}`
                    : "Salida de flujo"}
                </strong>
                <span>
                  State {edgeMenu.edge?.sourceStateId} {"->"} State{" "}
                  {edgeMenu.edge?.targetStateId}
                </span>
              </div>
              <button
                type="button"
                className="flow-inspector-close"
                onClick={() => setEdgeMenu(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="flow-inspector-body">
              <div className="flow-edge-explain">
                {edgeMenu.edge?.sourceKind === "tranmap-continuation" ? (
                  <div className="flow-edge-stack">
                    <div className="flow-tranmap-card compact">
                      <div className="flow-tranmap-title">
                        <strong>
                          {edgeMenu.edge?.tranMapComment || "Sin comentario"}
                        </strong>
                        <span>TranMap {edgeMenu.edge?.tranMapId || "-"}</span>
                      </div>
                      {(edgeMenu.edge?.tranMapParams || []).length ? (
                        edgeMenu.edge.tranMapParams.map((param, index) => (
                          <div
                            className="flow-tranmap-rule"
                            key={`${param.key}-${index}`}
                          >
                            <span>{param.key || `Param ${index + 1}`}</span>
                            <strong>{param.value || "-"}</strong>
                          </div>
                        ))
                      ) : (
                        <div className="flow-tranmap-rule muted">
                          <span>Parametros</span>
                          <strong>-</strong>
                        </div>
                      )}
                      <div className="flow-tranmap-destination">
                        <span>Continua</span>
                        <strong>
                          State {edgeMenu.edge?.targetStateId || "-"}
                        </strong>
                      </div>
                    </div>
                    <div className="flow-tranmap-card compact transaction">
                      <div className="flow-tranmap-title">
                        <strong>
                          {edgeMenu.edge?.transactionComment ||
                            "Transaccion asociada"}
                        </strong>
                        <span>
                          Tran{" "}
                          {edgeMenu.edge?.transactionCode ||
                            edgeMenu.edge?.transactionOperCodeKey ||
                            "-"}
                        </span>
                      </div>
                      {(edgeMenu.edge?.transactionParams || []).length ? (
                        edgeMenu.edge.transactionParams.map((param, index) => (
                          <div
                            className="flow-tranmap-rule"
                            key={`tran-${param.key}-${index}`}
                          >
                            <span>{param.key || `Param ${index + 1}`}</span>
                            <strong>{param.value || "-"}</strong>
                          </div>
                        ))
                      ) : (
                        <div className="flow-tranmap-rule muted">
                          <span>Parametros</span>
                          <strong>-</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flow-edge-route-card">
                    <strong>
                      {getEdgeContextLabel(edgeMenu.edge, nodeMap)}
                    </strong>
                  </div>
                )}
              </div>

              {edgeMenu.edge?.sourceKind === "tranmap-continuation" ? (
                <div className="flow-inspector-actions split">
                  <button
                    type="button"
                    className="flow-screen-preview-btn ready"
                    disabled={!edgeMenu.edge?.transactionCode}
                    onClick={() => jumpToTran(edgeMenu.edge?.transactionCode)}
                  >
                    <span className="flow-screen-preview-main">
                      <FaExternalLinkAlt />
                      Ir al Tran
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flow-screen-preview-btn ready primary"
                    onClick={() => jumpToTranMap(edgeMenu.edge?.tranMapId)}
                  >
                    <span className="flow-screen-preview-main">
                      <FaExternalLinkAlt />
                      Ir al TranMap
                    </span>
                  </button>
                </div>
              ) : (
                <div className="flow-inspector-actions split">
                  <button
                    type="button"
                    className="flow-screen-preview-btn ready"
                    onClick={() => {
                      onSelectState?.(edgeMenu.edge?.sourceStateId);
                      setEdgeMenu(null);
                    }}
                  >
                    <span className="flow-screen-preview-main">
                      <FaMapMarkerAlt />
                      Ir al origen
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flow-screen-preview-btn ready"
                    onClick={() => {
                      onSelectState?.(edgeMenu.edge?.targetStateId);
                      setEdgeMenu(null);
                    }}
                  >
                    <span className="flow-screen-preview-main">
                      <FaBullseye />
                      Ir al destino
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {sendMenu && (
          <div
            ref={sendMenuRef}
            className="flow-inspector flow-send-menu"
            style={{ left: sendMenu.x, top: sendMenu.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className="flow-inspector-head"
              onPointerDown={(event) =>
                startFloatingDrag(event, sendMenuRef, setSendMenu)
              }
            >
              <div>
                <strong>SEND State {sendMenu.stateId}</strong>
                <span>{sendMenu.count} continuaciones por TranMap</span>
              </div>
              <button
                type="button"
                className="flow-inspector-close"
                onClick={() => setSendMenu(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="flow-inspector-body">
              <label className="flow-send-filter">
                <FaSearch />
                <input
                  type="text"
                  value={sendMenu.query}
                  onChange={(event) =>
                    setSendMenu((current) =>
                      current
                        ? { ...current, query: event.target.value }
                        : current,
                    )
                  }
                  placeholder="Filtrar TranMap o campo"
                />
              </label>

              <div className="flow-send-list">
                {filteredSendEdges.length ? (
                  filteredSendEdges.map((edge, index) => {
                    const conditionText = getTranMapConditionText(edge);
                    return (
                      <button
                        key={`${edge.tranMapId || edge.id}-${edge.targetStateId}-${index}`}
                        type="button"
                        className="flow-send-option"
                        onClick={() => {
                          appendEdgesToInstance(sendMenu.instanceId, [edge]);
                          setSendMenu(null);
                        }}
                      >
                        <span className="flow-send-option-top">
                          <span className="flow-send-option-title">
                            <strong>TranMap {edge.tranMapId || "-"}</strong>
                            {edge.sendSuggestion && (
                              <em title={edge.sendSuggestion.reason}>
                                {edge.sendSuggestion.label}
                              </em>
                            )}
                          </span>
                          <small className="flow-send-state-corner">
                            State {edge.targetStateId || "-"}
                          </small>
                        </span>
                        <span className="flow-send-option-comment">
                          {edge.tranMapComment ||
                            edge.transactionComment ||
                            "Sin comentario"}
                        </span>
                        <span className="flow-send-option-meta">
                          {edge.tranMapOperationCodeKey || "-"}
                          {conditionText ? ` | ${conditionText}` : ""}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="flow-param-empty">
                    No hay continuaciones con ese filtro.
                  </div>
                )}
              </div>

              <div className="flow-inspector-actions">
                <button
                  type="button"
                  className="flow-screen-preview-btn ready"
                  onClick={() => {
                    appendEdgesToInstance(sendMenu.instanceId, sendMenu.edges);
                    setSendMenu(null);
                  }}
                >
                  <span className="flow-screen-preview-main">
                    <FaLayerGroup />
                    Mostrar todas
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
