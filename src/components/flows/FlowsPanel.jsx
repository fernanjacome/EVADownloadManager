import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaExternalLinkAlt,
  FaExpandArrowsAlt,
  FaLayerGroup,
  FaMinus,
  FaPlus,
  FaSearch,
  FaRedoAlt,
  FaSlidersH,
  FaTimes,
  FaVectorSquare,
} from "react-icons/fa";
import { IoCodeSlash } from "react-icons/io5";
import "./flows.css";
import { buildFlowGraph } from "../../utils/xmlUtils";

const BASE_CARD_WIDTH = 276;
const BASE_CARD_HEIGHT = 164;
const TOP_PADDING = 28;
const LEFT_PADDING = 32;
const BASE_LEVEL_GAP = 560;
const BASE_ROW_GAP = 198;
const ROOT_EXTRA_GAP = 34;
const EDGE_LABEL_WIDTH = 112;

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

  const firstState = stateNodes.find((node) => String(node.type || "").toUpperCase() !== "END");
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
  return getStarts(graph).filter((stateId) => allowed.has(getStartCategory(nodeMap.get(stateId))));
}

function getNodeActionLetters(node) {
  return Object.keys(node.params || {})
    .filter((key) => /^Key[A-I]State$/i.test(key))
    .map((key) => key.replace(/^Key/i, "").replace(/State$/i, ""))
    .sort();
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
    )
  );
}

function getEdgeTone(label) {
  if (/ErrorState/i.test(label)) return "error";
  if (/TimeoutState/i.test(label)) return "timeout";
  if (/CancelState/i.test(label)) return "cancel";
  if (/NoMatchState/i.test(label)) return "nomatch";
  if (/GoodState/i.test(label)) return "good";
  if (/Key[A-I]State/i.test(label)) return "key";
  if (/Tran /i.test(label)) return "good";
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
    const byCategory = getStartCategoryOrder(leftNode) - getStartCategoryOrder(rightNode);
    if (byCategory !== 0) return byCategory;
    const byType = String(leftNode?.type || "").localeCompare(String(rightNode?.type || ""));
    if (byType !== 0) return byType;
    return String(leftId).localeCompare(String(rightId), undefined, { numeric: true });
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

function sanitizePersistedInstances(graph, persistedInstances) {
  if (!Array.isArray(persistedInstances) || persistedInstances.length === 0) {
    return [];
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeKeys = new Set(
    graph.edges.map((edge) => `${edge.source}::${edge.label || ""}::${edge.target}`)
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
    const parent = sanitized.find((entry) => entry.instanceId === normalized.parentInstanceId);
    if (!parent) return;

    const edgeKey = `${parent.stateId}::${normalized.incomingLabel || ""}::${normalized.stateId}`;
    if (!edgeKeys.has(edgeKey)) return;

    normalized.level = parent.level + 1;
    sanitized.push(normalized);
    acceptedIds.add(normalized.instanceId);
  });

  const parentsWithChildren = new Set(
    sanitized.filter((item) => item.parentInstanceId).map((item) => item.parentInstanceId)
  );

  return sanitized.map((item) => ({
    ...item,
    expanded: parentsWithChildren.has(item.instanceId) ? item.expanded : false,
  }));
}

function buildLayout(instances, horizontalScale, verticalScale, cardWidth, cardHeight) {
  const levelGap = Math.round(BASE_LEVEL_GAP * horizontalScale);
  const rowGap = Math.round(BASE_ROW_GAP * verticalScale);
  const rootGap = Math.max(18, Math.round(ROOT_EXTRA_GAP * verticalScale));
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
    if (previousRootCategory && root.startCategory && root.startCategory !== previousRootCategory) {
      rootCursorY += Math.max(16, Math.round(20 * verticalScale));
    }
    const y = rootCursorY;
    positionedMap.set(root.instanceId, {
      ...root,
      x: LEFT_PADDING,
      y,
    });
    previousRootCategory = root.startCategory || previousRootCategory;
    rootCursorY += rowGap + rootGap;
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
      const children = (byParent.get(parent.instanceId) || []).sort((a, b) => a.order - b.order);
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
    Math.max(...positioned.map((item) => item.y + cardHeight), 0) + TOP_PADDING + 48
  );

  return {
    positioned,
    width: canvasWidth,
    height: canvasHeight,
  };
}

function getEdgePath(source, target, cardWidth, cardHeight, labelWidth = EDGE_LABEL_WIDTH) {
  const startX = source.x + cardWidth;
  const startY = source.y + cardHeight / 2;
  const endX = target.x;
  const endY = target.y + cardHeight / 2;
  const siblingOffset = ((target.siblingIndex || 0) - ((target.siblingCount || 1) - 1) / 2) * 18;
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

function FlowScreenCard({
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
}) {
  const activeLetters = getNodeActionLetters(node);

  return (
    <button
      type="button"
      className={`flow-screen-card ${isSelected ? "selected" : ""} ${
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
            {renderHighlightedText(`State ${node.id}`, searchTerm, highlightAllMatches)}
          </span>
          <span className="flow-screen-type">
            {renderHighlightedText(node.type || "STATE", searchTerm, highlightAllMatches)}
          </span>
        </div>

        <div className="flow-screen-frame">
          <div className="flow-screen-side left">
            {["F", "G", "H", "I"].map((letter) => (
              <span key={letter} className={activeLetters.includes(letter) ? "active" : ""}>
                {letter}
              </span>
            ))}
          </div>

          <div className="flow-screen-monitor">
            <strong>
              {renderHighlightedText(node.comment || "Sin comentario", searchTerm, highlightAllMatches)}
            </strong>
            <small>
              {renderHighlightedText(
                node.screenComment || `Screen ${node.screenId || "-"}`,
                searchTerm,
                highlightAllMatches
              )}
            </small>
            {graph.startNodeIds.includes(node.id) && (
              <span className="flow-screen-chip start">Inicio</span>
            )}
            {!graph.startNodeIds.includes(node.id) && graph.endNodeIds.includes(node.id) && (
              <span className="flow-screen-chip end">Fin</span>
            )}
          </div>

          <div className="flow-screen-side right">
            {["A", "B", "C", "D"].map((letter) => (
              <span key={letter} className={activeLetters.includes(letter) ? "active" : ""}>
                {letter}
              </span>
            ))}
          </div>
        </div>

        <div className="flow-screen-footer">
          <span className="flow-screen-transition">
            {renderHighlightedText(
              instance.incomingLabel || (graph.startNodeIds.includes(node.id) ? "Start" : "State"),
              searchTerm,
              highlightAllMatches
            )}
          </span>
        </div>
      </div>
    </button>
  );
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
    Array.from(xmlDoc?.querySelectorAll?.("Screens > Screen") || []).forEach((screenNode) => {
      const screenId = screenNode.getAttribute("Id");
      const resourceParam = Array.from(screenNode.children || []).find(
        (child) => child.tagName === "Param" && child.getAttribute("Key") === "Resource"
      );
      if (!screenId || !resourceParam?.textContent) return;
      map.set(screenId, normalizeScreenResourceName(resourceParam.textContent.trim()));
    });
    return map;
  }, [xmlDoc]);

  const initialViewStateRef = useRef({
    instances: flowViewState?.instances || [],
    selectedInstanceId: flowViewState?.selectedInstanceId || null,
    horizontalScale: flowViewState?.horizontalScale ?? 1,
    verticalScale: flowViewState?.verticalScale ?? 1,
    cardScale: flowViewState?.cardScale ?? 1,
    canvasZoom: flowViewState?.canvasZoom ?? 1,
    showControls: Boolean(flowViewState?.showControls),
    showAppearance: Boolean(flowViewState?.showAppearance),
    showSearch: Boolean(flowViewState?.showSearch),
    showCanvasZoom: Boolean(flowViewState?.showCanvasZoom),
    searchTerm: flowViewState?.searchTerm ?? "",
    startCategoryFilter:
      Array.isArray(flowViewState?.startCategoryFilter) && flowViewState.startCategoryFilter.length
        ? flowViewState.startCategoryFilter
        : ["CRD*"],
    scrollLeft: flowViewState?.scrollLeft ?? 0,
    scrollTop: flowViewState?.scrollTop ?? 0,
  });

  const nextIdRef = useRef(1);
  const scrollRef = useRef(null);
  const pendingCenterRef = useRef(false);
  const pendingScrollRestoreRef = useRef(false);
  const restoredViewportRef = useRef(false);
  const skipScrollPersistRef = useRef(false);
  const lastViewSignatureRef = useRef("");
  const dragRef = useRef(null);
  const searchInputRef = useRef(null);
  const latestScrollRef = useRef({
    left: initialViewStateRef.current.scrollLeft ?? 0,
    top: initialViewStateRef.current.scrollTop ?? 0,
  });
  const [instances, setInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [horizontalScale, setHorizontalScale] = useState(initialViewStateRef.current.horizontalScale);
  const [verticalScale, setVerticalScale] = useState(initialViewStateRef.current.verticalScale);
  const [cardScale, setCardScale] = useState(initialViewStateRef.current.cardScale);
  const [canvasZoom, setCanvasZoom] = useState(initialViewStateRef.current.canvasZoom ?? 1);
  const [showLayoutPanel, setShowLayoutPanel] = useState(
    Boolean(initialViewStateRef.current.showControls || initialViewStateRef.current.showAppearance)
  );
  const [showCanvasZoom, setShowCanvasZoom] = useState(
    Boolean(initialViewStateRef.current.showCanvasZoom)
  );
  const [searchTerm, setSearchTerm] = useState(initialViewStateRef.current.searchTerm);
  const [startCategoryFilter, setStartCategoryFilter] = useState(
    initialViewStateRef.current.startCategoryFilter
  );
  const highlightAllMatches = true;
  const [inspector, setInspector] = useState(null);
  const [paramMenu, setParamMenu] = useState(null);
  const inspectorRef = useRef(null);
  const paramMenuRef = useRef(null);
  const inspectorParams = useMemo(
    () => (inspector ? Object.entries(inspector.node.params || {}) : []),
    [inspector]
  );

  const cardWidth = useMemo(() => Math.round(BASE_CARD_WIDTH * cardScale), [cardScale]);
  const cardHeight = useMemo(() => Math.round(BASE_CARD_HEIGHT * cardScale), [cardScale]);
  const scaledLayout = useMemo(
    () => buildLayout(instances, horizontalScale, verticalScale, cardWidth, cardHeight),
    [instances, horizontalScale, verticalScale, cardWidth, cardHeight]
  );
  const positionedMap = useMemo(
    () => new Map(scaledLayout.positioned.map((instance) => [instance.instanceId, instance])),
    [scaledLayout.positioned]
  );
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  const availableScreens = useMemo(
    () => new Map(screensList.map((screen) => [normalizeScreenResourceName(screen.resource), screen])),
    [screensList]
  );

  useEffect(() => {
    const restored = sanitizePersistedInstances(graph, initialViewStateRef.current.instances);
    const filteredStartIds = filterStartIdsByCategories(graph, startCategoryFilter);
    const restoredRootIds = restored
      .filter((item) => item.level === 0)
      .map((item) => item.stateId)
      .sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));
    const sortedFilteredStartIds = [...filteredStartIds].sort((left, right) =>
      String(left).localeCompare(String(right), undefined, { numeric: true })
    );
    const restoredMatchesFilter =
      restored.length > 0 &&
      restoredRootIds.length === sortedFilteredStartIds.length &&
      restoredRootIds.every((stateId, index) => stateId === sortedFilteredStartIds[index]);

    if (restored.length > 0 && restoredMatchesFilter) {
      syncNextIdRef(nextIdRef, restored);
      pendingScrollRestoreRef.current = true;
      setInstances(restored);
      setSelectedInstanceId(
        restored.some((item) => item.instanceId === initialViewStateRef.current.selectedInstanceId)
          ? initialViewStateRef.current.selectedInstanceId
          : restored[0]?.instanceId ?? null
      );
      return;
    }

    nextIdRef.current = 1;
    const initial = buildInitialInstances(graph, nextIdRef, filteredStartIds);
    pendingScrollRestoreRef.current = true;
    setInstances(initial);
    setSelectedInstanceId(initial[0]?.instanceId ?? null);
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
            startCategory: getStartCategory(graph.nodes.find((node) => node.id === targetId)),
            expanded: false,
          });

      const targetInstance = nextRoots.find((item) => item.stateId === targetId) || nextRoots[0] || null;
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
    searchTerm,
    startCategoryFilter,
    onFlowViewStateChange,
  ]);

  const setLayoutPreset = (preset) => {
    if (preset === "compacta") {
      setHorizontalScale(0.8);
      setVerticalScale(0.82);
      setCardScale(0.9);
      return;
    }
    if (preset === "amplia") {
      setHorizontalScale(1.28);
      setVerticalScale(1.18);
      setCardScale(1.12);
      return;
    }
    setHorizontalScale(1);
    setVerticalScale(1);
    setCardScale(1);
  };

  const selectedInstance = selectedInstanceId
    ? instances.find((item) => item.instanceId === selectedInstanceId) ?? null
    : null;
  const selectedNode = selectedInstance ? nodeMap.get(selectedInstance.stateId) : null;
  const selectedPositionedInstance = selectedInstanceId
    ? positionedMap.get(selectedInstanceId) ?? null
    : null;
  const startGroups = useMemo(() => {
    const roots = scaledLayout.positioned
      .filter((instance) => !instance.parentInstanceId && instance.startCategory)
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
          (item) => item.parentInstanceId === instance.parentInstanceId
        );
        if (!source || !target) return null;

        return {
          id: `${instance.parentInstanceId}-${instance.instanceId}`,
          source,
          target: {
            ...target,
            siblingIndex: siblings.findIndex((item) => item.instanceId === instance.instanceId),
            siblingCount: siblings.length,
          },
          label: instance.incomingLabel || "",
          tone: getEdgeTone(instance.incomingLabel || ""),
        };
      })
      .filter(Boolean);
  }, [scaledLayout.positioned, positionedMap]);

  const matchedInstanceIds = useMemo(() => {
    const term = String(searchTerm || "").trim().toLowerCase();
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
        : (currentIndex - 1 + matchedInstanceIds.length) % matchedInstanceIds.length;
    pendingCenterRef.current = true;
    setSelectedInstanceId(matchedInstanceIds[nextIndex]);
  };

  const centerOnSelectedInstance = (behavior = "smooth") => {
    const container = scrollRef.current;
    if (!container || !selectedPositionedInstance) return;

    const scaledCardWidth = cardWidth * canvasZoom;
    const scaledCardHeight = cardHeight * canvasZoom;
    const targetLeft =
      selectedPositionedInstance.x * canvasZoom - container.clientWidth / 2 + scaledCardWidth / 2;
    const targetTop =
      selectedPositionedInstance.y * canvasZoom - container.clientHeight / 2 + scaledCardHeight / 2;

    container.scrollTo({
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
      behavior,
    });

    latestScrollRef.current = {
      left: Math.max(0, targetLeft),
      top: Math.max(0, targetTop),
    };
  };

  const getScreenStatus = (node) => {
    const screenResource = node?.screenResource || "";
    if (!screenResource || !screensLoaded) return null;
    const normalizedResource = normalizeScreenResourceName(screenResource);
    const match =
      availableScreens.get(normalizedResource) ||
      screensList.find(
        (screen) => normalizeScreenResourceName(screen.resource) === normalizedResource
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
      screensList.find((screen) => normalizeScreenResourceName(screen.resource) === resourceName);
    if (!match) return null;
    return {
      label: match.resource,
      screen: match,
    };
  };

  const jumpToState = (node) => {
    onSelectState?.(node.id);
    setInspector(null);
  };

  const jumpToParam = (node, key) => {
    onSelectState?.({
      type: "param",
      stateId: node.id,
      key,
    });
    setInspector(null);
    setParamMenu(null);
  };

  const collapseColumn = (items, level, exceptId) => {
    const idsToRemove = new Set();
    items
      .filter((item) => item.level === level && item.instanceId !== exceptId && item.expanded)
      .forEach((item) => {
        collectDescendants(item.instanceId, items).forEach((descId) => idsToRemove.add(descId));
      });

    return items
      .filter((item) => !idsToRemove.has(item.instanceId))
      .map((item) =>
        item.level === level && item.instanceId !== exceptId ? { ...item, expanded: false } : item
      );
  };

  const toggleInstance = (instanceId) => {
    pendingCenterRef.current = true;
    setParamMenu(null);
    setInstances((prev) => {
      const current = prev.find((item) => item.instanceId === instanceId);
      if (!current) return prev;

      if (current.expanded) {
        const descendants = new Set(collectDescendants(instanceId, prev));
        return prev
          .filter((item) => !descendants.has(item.instanceId))
          .map((item) =>
            item.instanceId === instanceId ? { ...item, expanded: false } : item
          );
      }

      const outgoingEdges = graph.edges.filter((edge) => edge.source === current.stateId);
      if (outgoingEdges.length === 0) {
        return prev;
      }

      const collapsed = collapseColumn(prev, current.level, current.instanceId);
      const sameColumnCount = collapsed.filter((item) => item.level === current.level + 1).length;
      const newChildren = outgoingEdges.map((edge, index) => ({
        instanceId: `inst-${nextIdRef.current++}`,
        stateId: edge.target,
        level: current.level + 1,
        parentInstanceId: current.instanceId,
        incomingLabel: edge.label,
        order: sameColumnCount + index,
        expanded: false,
      }));

      return collapsed
        .map((item) =>
          item.instanceId === current.instanceId ? { ...item, expanded: true } : item
        )
        .concat(newChildren);
    });
    setSelectedInstanceId(instanceId);
  };

  const resetFlow = () => {
    nextIdRef.current = 1;
    const initial = buildInitialInstances(
      graph,
      nextIdRef,
      filterStartIdsByCategories(graph, startCategoryFilter)
    );
    pendingScrollRestoreRef.current = true;
    restoredViewportRef.current = false;
    latestScrollRef.current = { left: 0, top: 0 };
    setInstances(initial);
    setSelectedInstanceId(initial[0]?.instanceId ?? null);
    setInspector(null);
    setParamMenu(null);
    onFlowViewStateChange?.((prev) => ({
      ...(prev || {}),
      scrollLeft: 0,
      scrollTop: 0,
    }));
  };

  const toggleStartCategoryFilter = (category) => {
    setStartCategoryFilter((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const openInspector = (event, instance, node) => {
    setParamMenu(null);
    setSelectedInstanceId(instance.instanceId);
    setInspector({
      node,
      instance,
      x: Math.min(event.clientX + 10, window.innerWidth - 320),
      y: Math.min(event.clientY + 10, window.innerHeight - 420),
    });
  };

  useEffect(() => {
    const closeFloating = (event) => {
      if (inspectorRef.current?.contains(event.target) || paramMenuRef.current?.contains(event.target)) {
        return;
      }
      setInspector(null);
      setParamMenu(null);
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setInspector(null);
        setParamMenu(null);
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
    if (!container || !selectedPositionedInstance || !pendingCenterRef.current) return;
    pendingCenterRef.current = false;
    centerOnSelectedInstance("smooth");
  }, [selectedPositionedInstance, canvasZoom, cardWidth, cardHeight]);

  useEffect(() => {
    if (!restoredViewportRef.current || !selectedPositionedInstance) return;

    const signature = [horizontalScale, verticalScale, cardScale, canvasZoom].join("|");
    if (!lastViewSignatureRef.current) {
      lastViewSignatureRef.current = signature;
      return;
    }

    if (signature === lastViewSignatureRef.current) return;
    lastViewSignatureRef.current = signature;
    centerOnSelectedInstance("auto");
  }, [horizontalScale, verticalScale, cardScale, canvasZoom, selectedPositionedInstance]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || restoredViewportRef.current || !pendingScrollRestoreRef.current) return;

    skipScrollPersistRef.current = true;
    container.scrollTo({
      left: Math.max(0, Number(initialViewStateRef.current.scrollLeft) || 0),
      top: Math.max(0, Number(initialViewStateRef.current.scrollTop) || 0),
      behavior: "auto",
    });
    latestScrollRef.current = {
      left: container.scrollLeft,
      top: container.scrollTop,
    };
    requestAnimationFrame(() => {
      restoredViewportRef.current = true;
      pendingScrollRestoreRef.current = false;
      skipScrollPersistRef.current = false;
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
        event.target.closest(".flow-screen-card, .flow-inspector, .flows-utilitybar, .flows-subbar")
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
      container.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.startX);
      container.scrollTop = dragRef.current.scrollTop - (event.clientY - dragRef.current.startY);
    };

    const stopDrag = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      container.classList.remove("dragging-canvas");
    };

    container.addEventListener("pointerdown", handlePointerDown);
    const handleWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();

      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left + container.scrollLeft;
      const pointerY = event.clientY - rect.top + container.scrollTop;

      setCanvasZoom((prev) => {
        const next = Math.min(1.8, Math.max(0.45, Number((prev + (event.deltaY < 0 ? 0.05 : -0.05)).toFixed(2))));
        if (next === prev) return prev;

        requestAnimationFrame(() => {
          const scaleRatio = next / prev;
          const nextLeft = pointerX * scaleRatio - (event.clientX - rect.left);
          const nextTop = pointerY * scaleRatio - (event.clientY - rect.top);
          container.scrollTo({
            left: Math.max(0, nextLeft),
            top: Math.max(0, nextTop),
            behavior: "auto",
          });
          latestScrollRef.current = {
            left: Math.max(0, nextLeft),
            top: Math.max(0, nextTop),
          };
        });

        return next;
      });
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    window.addEventListener("blur", stopDrag);
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      window.removeEventListener("blur", stopDrag);
      container.classList.remove("dragging-canvas");
    };
  }, []);

  const maxVisibleLevel = Math.max(0, ...scaledLayout.positioned.map((item) => item.level), 0);
  const extraScrollableWidth = maxVisibleLevel >= 2 ? 420 + (maxVisibleLevel - 2) * 140 : 0;
  const zoomedCanvasWidth = Math.max(Math.round((scaledLayout.width + extraScrollableWidth) * canvasZoom), 720);
  const zoomedCanvasHeight = Math.max(Math.round(scaledLayout.height * canvasZoom), 360);
  const selectedStats = selectedNode
    ? {
        outgoing: graph.edges.filter((edge) => edge.source === selectedNode.id).length,
      }
    : null;
  const screenStatus = inspector ? getScreenStatus(inspector.node) : null;

  return (
    <div className="flows-panel compact-mode">
      <section className="flows-canvas-panel compact-mode">
        <div className="flows-utilitybar">
          <div className="flows-toolbar-group flows-toolbar-summary">
            <div className="flows-toolbar-caption">Flujo · {scaledLayout.positioned.length} visibles</div>
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

          <div className={`flows-toolbar-group flows-toolbar-focus ${selectedNode ? "has-selected-state" : ""}`}>
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
              <span className="selected-state-name">Selecciona un state para navegar el flujo</span>
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
            <button type="button" className="flows-tool-btn" onClick={resetFlow}>
              <FaRedoAlt />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>

        {showLayoutPanel && (
          <div className="flows-subbar">
            <div className="flow-layout-panel">
              <div className="flow-layout-block">
                <span className="flow-layout-label">Preset</span>
                <div className="flow-layout-pills">
                  <button type="button" className="flow-layout-pill" onClick={() => setLayoutPreset("compacta")}>
                    Compacta
                  </button>
                  <button type="button" className="flow-layout-pill" onClick={() => setLayoutPreset("equilibrada")}>
                    Equilibrada
                  </button>
                  <button type="button" className="flow-layout-pill" onClick={() => setLayoutPreset("amplia")}>
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
                    onChange={(event) => setCardScale(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="flow-layout-block">
                <label className="spacing-control">
                  <span>Separación horizontal</span>
                  <input
                    type="range"
                    min="0.55"
                    max="2.2"
                    step="0.05"
                    value={horizontalScale}
                    onChange={(event) => setHorizontalScale(Number(event.target.value))}
                  />
                </label>
                <label className="spacing-control">
                  <span>Separación vertical</span>
                  <input
                    type="range"
                    min="0.6"
                    max="2"
                    step="0.05"
                    value={verticalScale}
                    onChange={(event) => setVerticalScale(Number(event.target.value))}
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
                  edge.labelWidth
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
                  edge.labelWidth
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
                      edge.tranMapComment ||
                      edge.transactionComment ||
                      edge.matchedFields ||
                      edge.label
                    }
                  >
                    <span className="flow-edge-pill-main">
                      {renderHighlightedText(
                        edge.primaryLabel || edge.label,
                        searchTerm
                      )}
                    </span>
                    {edge.secondaryLabel ? (
                      <small className="flow-edge-pill-sub">
                        {renderHighlightedText(edge.secondaryLabel, searchTerm)}
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

              return (
                <div
                  key={instance.instanceId}
                  className="flow-stage-node"
                  style={{
                    left: instance.x,
                    top: instance.y,
                    width: cardWidth,
                    minHeight: cardHeight,
                    "--flow-card-scale": cardScale,
                  }}
                >
                  <FlowScreenCard
                    node={node}
                    graph={graph}
                    instance={instance}
                    isSelected={selectedInstanceId === instance.instanceId}
                    onToggle={() => toggleInstance(instance.instanceId)}
                    onInspect={(event) => openInspector(event, instance, node)}
                    cardScale={cardScale}
                    searchTerm={searchTerm}
                    highlightAllMatches={highlightAllMatches}
                    isMatchFocused={matchedInstanceIds.includes(instance.instanceId) && selectedInstanceId === instance.instanceId}
                  />
                </div>
              );
            })}
            </div>
          </div>
        </div>

        <div className={`flow-zoom-dock ${showCanvasZoom ? "open" : ""}`}>
          <button
            type="button"
            className={`flow-zoom-toggle ${showCanvasZoom ? "active" : ""}`}
            onClick={() => setShowCanvasZoom((prev) => !prev)}
            title="Zoom del canvas"
          >
            <FaExpandArrowsAlt />
            <span>Zoom</span>
          </button>
          {showCanvasZoom && (
            <div className="flow-zoom-panel">
              <button
                type="button"
                className="flow-zoom-step"
                onClick={() => setCanvasZoom((prev) => Math.max(0.45, Number((prev - 0.05).toFixed(2))))}
                title="Reducir zoom"
              >
                <FaMinus />
              </button>
              <input
                type="range"
                min="0.45"
                max="1.8"
                step="0.05"
                value={canvasZoom}
                onChange={(event) => setCanvasZoom(Number(event.target.value))}
              />
              <button
                type="button"
                className="flow-zoom-step"
                onClick={() => setCanvasZoom((prev) => Math.min(1.8, Number((prev + 0.05).toFixed(2))))}
                title="Aumentar zoom"
              >
                <FaPlus />
              </button>
              <span className="flow-zoom-value">{Math.round(canvasZoom * 100)}%</span>
            </div>
          )}
        </div>

        {inspector && (
          <div
            ref={inspectorRef}
            className="flow-inspector"
            style={{ left: inspector.x, top: inspector.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="flow-inspector-head">
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
                      const paramScreenStatus = getScreenStatusFromParam(key, value);
                      return (
                        <button
                          key={key}
                          type="button"
                          className="flow-param-row compact"
                          onClick={() => jumpToParam(inspector.node, key)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setParamMenu({
                              x: Math.min(event.clientX + 8, window.innerWidth - 220),
                              y: Math.min(event.clientY + 8, window.innerHeight - 140),
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
                    <div className="flow-param-empty">Este state no tiene parametros.</div>
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
      </section>
    </div>
  );
}
