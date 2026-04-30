import { sidebarConfig } from "./sidebarConfig";

/**
 * Convierte un string XML en un Document
 */
export function parseXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    // Verificar errores de parseo
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Error al parsear el XML");
    }

    return xmlDoc;
}

/**
 * Convierte un Document XML de nuevo a string
 */
export function serializeXML(xmlDoc) {
    const serializer = new XMLSerializer();
    let xmlString = serializer.serializeToString(xmlDoc);

    // Asegurar encabezado
    if (!xmlString.startsWith("<?xml")) {
        xmlString = '<?xml version="1.0" encoding="utf-8"?>\n' + xmlString;
    }
    return xmlString;
}

export function formatXml(xmlString) {
    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlString, "application/xml");

        if (xml.getElementsByTagName("parsererror").length > 0) {
            return null;
        }

        const xslt = `
      <xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
        <xsl:output method="xml" indent="yes" encoding="UTF-8"/>
        <xsl:strip-space elements="*"/>
        <xsl:template match="@*|node()">
          <xsl:copy>
            <xsl:apply-templates select="@*|node()"/>
          </xsl:copy>
        </xsl:template>
      </xsl:stylesheet>
    `;
        const xsltDoc = parser.parseFromString(xslt, "application/xml");
        const processor = new XSLTProcessor();
        processor.importStylesheet(xsltDoc);
        const resultDoc = processor.transformToDocument(xml);

        let result = new XMLSerializer().serializeToString(resultDoc);

        // Encabezado explícito
        if (!result.startsWith("<?xml")) {
            result = '<?xml version="1.0" encoding="utf-8"?>\n' + result;
        }
        return result;
    } catch {
        return null;
    }
}

/**
 * Valida que los IDs dentro de cada esquema sean únicos
 * @returns {Array} lista de errores encontrados
 */
export function validateUniqueIds(xmlDoc) {
    const errors = [];

    Object.entries(sidebarConfig).forEach(([key, cfg]) => {
        const parent = xmlDoc.querySelector(key);
        if (!parent) return;

        const seen = new Map();

        Array.from(parent.getElementsByTagName(cfg.childTag)).forEach((el) => {
            const id = el.getAttribute(cfg.idAttr);
            if (!id) return;

            if (seen.has(id)) {
                errors.push(
                    `[${cfg.label}] ID duplicado "${id}" en elementos <${cfg.childTag}>`
                );
            } else {
                seen.set(id, true);
            }
        });
    });

    return errors;
}

/**
 * Extrae nodos con un selector CSS simple
 * Ejemplo: extractNodes(xmlDoc, "States > State")
 */
export function extractNodes(xmlDoc, selector) {
    return Array.from(xmlDoc.querySelectorAll(selector));
}

function getParamMap(node) {
    const params = {};

    Array.from(node?.children || []).forEach((child) => {
        if (child.tagName !== "Param") return;
        const key = child.getAttribute("Key");
        if (!key) return;
        params[key] = child.textContent?.trim?.() ?? "";
    });

    return params;
}

function toNumericComparable(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : value;
}

function compareIds(a, b) {
    const aVal = toNumericComparable(a);
    const bVal = toNumericComparable(b);

    if (typeof aVal === "number" && typeof bVal === "number") {
        return aVal - bVal;
    }

    return String(a).localeCompare(String(b));
}

function getScreenMap(xmlDoc) {
    const screens = new Map();
    const screenNodes = Array.from(xmlDoc.querySelectorAll("Screens > Screen"));

    screenNodes.forEach((screen) => {
        const id = screen.getAttribute("Id");
        if (!id) return;

        const params = getParamMap(screen);
        screens.set(id, {
            id,
            comment: screen.getAttribute("Comment") || "",
            resource: params.Resource || "",
            entryControl: params.EntryControl || "",
        });
    });

    return screens;
}

function getStateTransitions(stateNode) {
    const params = getParamMap(stateNode);
    const stateType = String(stateNode.getAttribute("Type") || "").toUpperCase();

    return Array.from(stateNode.children || [])
        .filter((child) => child.tagName === "Param")
        .map((param) => {
            const key = param.getAttribute("Key") || "";
            const target = param.textContent?.trim?.() ?? "";
            if ((key === "Chip" || key === "Track") && stateType === "CRDSRC") {
                return {
                    key,
                    target,
                    displayLabel: key,
                };
            }
            const numberedMatch = key.match(/^State(\d+)$/i);
            if (numberedMatch) {
                const valueKey = `Value${numberedMatch[1]}`;
                const valueLabel = params[valueKey]?.trim?.() || key;
                return {
                    key,
                    target,
                    displayLabel: valueLabel,
                };
            }

            return {
                key,
                target,
                displayLabel: key,
            };
        })
        .filter((param) => {
            if (!param.key || !param.target) return false;
            return /State$/i.test(param.key) || /^State\d+$/i.test(param.key) || param.key === "Chip" || param.key === "Track";
        });
}

function getTransactions(xmlDoc) {
    return Array.from(xmlDoc.querySelectorAll("Transactions > Tran"))
        .map((tranNode) => {
            const params = getParamMap(tranNode);
            const operCodeKey = params.OperCodeKey || tranNode.getAttribute("OperCodeKey") || "";
            const nextState = params.NextStateContinue || "";
            return {
                code: tranNode.getAttribute("Code") || "",
                comment: tranNode.getAttribute("Comment") || "",
                operCodeKey,
                nextState,
                params,
                paramsList: Object.entries(params).map(([key, value]) => ({ key, value })),
            };
        })
        .filter((tran) => tran.operCodeKey && tran.nextState);
}

function getTranMaps(xmlDoc) {
    return Array.from(xmlDoc.querySelectorAll("TranMaps > TranMap"))
        .map((tranMapNode) => {
            const params = getParamMap(tranMapNode);
            const fields = [];

            for (let index = 1; index <= 20; index++) {
                const fieldName = params[`FieldName${index}`]?.trim?.() || "";
                const fieldValue = params[`FieldValue${index}`]?.trim?.() || "";
                if (!fieldName) continue;
                fields.push({
                    name: fieldName,
                    value: fieldValue,
                });
            }

            return {
                id: tranMapNode.getAttribute("Id") || "",
                comment: tranMapNode.getAttribute("Comment") || "",
                operationCodeKey: params.OperationCodeKey || "",
                params: Object.entries(params).map(([key, value]) => ({ key, value })),
                fields,
            };
        })
        .filter((tranMap) => tranMap.operationCodeKey);
}

function buildReverseAdjacency(edges) {
    const reverse = new Map();

    edges.forEach((edge) => {
        if (!reverse.has(edge.target)) {
            reverse.set(edge.target, []);
        }
        reverse.get(edge.target).push(edge.source);
    });

    return reverse;
}

function getAncestorSetValues(stateId, stateById, reverseAdjacency) {
    const collected = new Map();
    const queue = [stateId];
    const visited = new Set(queue);

    while (queue.length > 0) {
        const currentId = queue.shift();
        const parents = reverseAdjacency.get(currentId) || [];

        parents.forEach((parentId) => {
            if (visited.has(parentId)) return;
            visited.add(parentId);
            queue.push(parentId);

            const parentNode = stateById.get(parentId);
            if (!parentNode || String(parentNode.type || "").toUpperCase() !== "SET") {
                return;
            }

            const buffName = parentNode.params?.BuffName?.trim?.();
            const buffValue = parentNode.params?.BuffValue?.trim?.();
            if (!buffName || !buffValue) return;

            if (!collected.has(buffName)) {
                collected.set(buffName, new Set());
            }
            collected.get(buffName).add(buffValue);
        });
    }

    return collected;
}

function getMatchedTranMap(tranMapsByOperCode, ancestorSetValues) {
    const matched = [];

    tranMapsByOperCode.forEach((tranMaps, operCodeKey) => {
        tranMaps.forEach((tranMap) => {
            if (!tranMap.fields.length) return;

            const matchesAllFields = tranMap.fields.every((field) => {
                const candidateValues = ancestorSetValues.get(field.name);
                if (!candidateValues || candidateValues.size === 0) return false;
                if (!field.value) return true;
                return candidateValues.has(field.value);
            });

            if (!matchesAllFields) return;

            matched.push({
                operCodeKey,
                tranMap,
            });
        });
    });

    return matched;
}

function buildTransactionEdgeLabelMeta({ bufferName, bufferValue, tran, tranMap = null }) {
    const transactionParams = tran.paramsList || Object.entries(tran.params || {}).map(([key, value]) => ({ key, value }));
    const matchedFields = tranMap?.fields?.length
        ? tranMap.fields
            .map((field) => (field.value ? `${field.name}=${field.value}` : field.name))
            .join(" · ")
        : bufferName && bufferValue
          ? `${bufferName}=${bufferValue}`
          : "";

    if (tranMap) {
        return {
            label: `TranMap ${tranMap.id || "?"}`,
            primaryLabel: `TranMap ${tranMap.id || "?"}`,
            secondaryLabel: matchedFields || tranMap.operationCodeKey,
            labelWidth: 176,
            sourceKind: "tranmap-continuation",
            operCodeKey: tran.operCodeKey,
            tranMapId: tranMap.id || "",
            tranMapComment: tranMap.comment || "",
            tranMapOperationCodeKey: tranMap.operationCodeKey || "",
            tranMapParams: tranMap.params || [],
            tranMapFields: tranMap.fields || [],
            transactionOperCodeKey: tran.operCodeKey,
            transactionNextState: tran.nextState || "",
            transactionParams,
            matchedFields,
        };
    }

    return {
        label: `Tran ${tran.operCodeKey}`,
        primaryLabel: `Tran ${tran.code || tran.operCodeKey}`,
        secondaryLabel: matchedFields,
        labelWidth: matchedFields ? 168 : 132,
        sourceKind: "transaction-continuation",
        operCodeKey: tran.operCodeKey,
        transactionOperCodeKey: tran.operCodeKey,
        transactionNextState: tran.nextState || "",
        transactionParams,
        matchedFields,
    };
}

function getTransactionContinuationEdges(stateById, baseEdges, transactions, tranMaps) {
    if (transactions.length === 0) return [];

    const reverseAdjacency = buildReverseAdjacency(baseEdges);
    const transactionByOperCode = new Map();
    const tranMapsByOperCode = new Map();

    transactions.forEach((tran) => {
        const key = String(tran.operCodeKey).trim();
        if (!key) return;
        if (!transactionByOperCode.has(key)) {
            transactionByOperCode.set(key, []);
        }
        transactionByOperCode.get(key).push(tran);
    });

    tranMaps.forEach((tranMap) => {
        const key = String(tranMap.operationCodeKey).trim();
        if (!key) return;
        if (!tranMapsByOperCode.has(key)) {
            tranMapsByOperCode.set(key, []);
        }
        tranMapsByOperCode.get(key).push(tranMap);
    });

    const derivedEdges = [];
    const seen = new Set();

    Array.from(stateById.values()).forEach((node) => {
        if (String(node.type || "").toUpperCase() !== "SEND") return;

        const usedBuffers = Object.entries(node.params || {})
            .filter(([key, value]) => /^Buffer\d+$/i.test(key) && String(value || "").trim())
            .map(([, value]) => String(value).trim());

        if (usedBuffers.length === 0) return;

        const ancestorSetValues = getAncestorSetValues(node.id, stateById, reverseAdjacency);
        const matchedTranMaps = getMatchedTranMap(tranMapsByOperCode, ancestorSetValues);
        const matchedTranMapKeys = new Set(matchedTranMaps.map((item) => item.operCodeKey));

        matchedTranMaps.forEach(({ operCodeKey, tranMap }) => {
            const matches = transactionByOperCode.get(operCodeKey) || [];
            matches.forEach((tran) => {
                const edgeId = `${node.id}-tranmap-${tranMap.id || operCodeKey}-${tran.code || operCodeKey}-${tran.nextState}`;
                if (seen.has(edgeId)) return;
                seen.add(edgeId);

                const labelMeta = buildTransactionEdgeLabelMeta({ tran, tranMap });

                derivedEdges.push({
                    id: edgeId,
                    source: node.id,
                    target: tran.nextState,
                    ...labelMeta,
                    transactionCode: tran.code,
                    transactionComment: tran.comment,
                });
            });
        });

        usedBuffers.forEach((bufferName) => {
            const values = ancestorSetValues.get(bufferName);
            if (!values || values.size === 0) return;

            values.forEach((bufferValue) => {
                const matches = transactionByOperCode.get(bufferValue) || [];
                matches.forEach((tran) => {
                    if (matchedTranMapKeys.has(tran.operCodeKey)) return;
                    const edgeId = `${node.id}-tran-${tran.code || tran.operCodeKey}-${tran.nextState}`;
                    if (seen.has(edgeId)) return;
                    seen.add(edgeId);

                    const labelMeta = buildTransactionEdgeLabelMeta({
                        bufferName,
                        bufferValue,
                        tran,
                    });

                    derivedEdges.push({
                        id: edgeId,
                        source: node.id,
                        target: tran.nextState,
                        ...labelMeta,
                        transactionCode: tran.code,
                        transactionComment: tran.comment,
                    });
                });
            });
        });
    });

    return derivedEdges;
}

function getExternalReferences(xmlDoc) {
    const refs = [];

    Array.from(xmlDoc.querySelectorAll("General > Param")).forEach((param) => {
        const key = param.getAttribute("Key") || "";
        const target = param.textContent?.trim?.() ?? "";
        if (/State/i.test(key) && target) {
            refs.push({
                sourceType: "General",
                sourceId: "General",
                sourceLabel: key,
                key,
                target,
            });
        }
    });

    Array.from(xmlDoc.querySelectorAll("Transactions > Tran")).forEach((tran) => {
        const code = tran.getAttribute("Code") || "";
        const comment = tran.getAttribute("Comment") || "";

        Array.from(tran.children || []).forEach((child) => {
            if (child.tagName !== "Param") return;
            const key = child.getAttribute("Key") || "";
            const target = child.textContent?.trim?.() ?? "";
            if (/State$/i.test(key) && target) {
                refs.push({
                    sourceType: "Transaction",
                    sourceId: code,
                    sourceLabel: comment || `Tran ${code}`,
                    key,
                    target,
                });
            }
        });
    });

    Array.from(xmlDoc.querySelectorAll("Errors > Error")).forEach((errorNode) => {
        const retCode = errorNode.getAttribute("RetCode") || "";
        const comment = errorNode.getAttribute("Comment") || "";

        Array.from(errorNode.children || []).forEach((child) => {
            if (child.tagName !== "Param") return;
            const key = child.getAttribute("Key") || "";
            const target = child.textContent?.trim?.() ?? "";
            if (/State$/i.test(key) && target) {
                refs.push({
                    sourceType: "Error",
                    sourceId: retCode,
                    sourceLabel: comment || `Error ${retCode}`,
                    key,
                    target,
                });
            }
        });
    });

    return refs.sort((a, b) => compareIds(a.target, b.target));
}

function buildLevels(nodes, edges, preferredRootId) {
    const levelById = new Map();
    const adjacency = new Map();
    const indegree = new Map();

    nodes.forEach((node) => {
        adjacency.set(node.id, []);
        indegree.set(node.id, 0);
    });

    edges.forEach((edge) => {
        if (!adjacency.has(edge.source)) return;
        adjacency.get(edge.source).push(edge.target);
        if (indegree.has(edge.target)) {
            indegree.set(edge.target, indegree.get(edge.target) + 1);
        }
    });

    const roots = nodes
        .filter((node) => indegree.get(node.id) === 0)
        .sort((a, b) => compareIds(a.id, b.id))
        .map((node) => node.id);

    if (preferredRootId && adjacency.has(preferredRootId)) {
        const idx = roots.indexOf(preferredRootId);
        if (idx >= 0) {
            roots.splice(idx, 1);
        }
        roots.unshift(preferredRootId);
    }

    const orderedStarts = roots.length
        ? roots
        : nodes.sort((a, b) => compareIds(a.id, b.id)).map((node) => node.id);

    orderedStarts.forEach((startId) => {
        if (levelById.has(startId)) return;

        const queue = [{ id: startId, level: 0 }];
        levelById.set(startId, 0);

        while (queue.length > 0) {
            const current = queue.shift();
            const targets = adjacency.get(current.id) || [];

            targets.forEach((targetId) => {
                const nextLevel = current.level + 1;
                const previousLevel = levelById.get(targetId);

                if (previousLevel == null || nextLevel < previousLevel) {
                    levelById.set(targetId, nextLevel);
                    queue.push({ id: targetId, level: nextLevel });
                }
            });
        }
    });

    const levels = new Map();
    nodes.forEach((node) => {
        const level = levelById.get(node.id) ?? 0;
        if (!levels.has(level)) {
            levels.set(level, []);
        }
        levels.get(level).push(node);
    });

    Array.from(levels.values()).forEach((group) =>
        group.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === "state" ? -1 : 1;
            }
            return compareIds(a.id, b.id);
        })
    );

    return levels;
}

export function buildFlowGraph(xmlDoc) {
    if (!xmlDoc) {
        return {
            nodes: [],
            edges: [],
            levels: [],
            externalReferences: [],
            warnings: [],
            startNodeIds: [],
            endNodeIds: [],
        };
    }

    const screens = getScreenMap(xmlDoc);
    const transactions = getTransactions(xmlDoc);
    const tranMaps = getTranMaps(xmlDoc);
    const stateNodes = Array.from(xmlDoc.querySelectorAll("States > State"));
    const stateById = new Map();

    stateNodes.forEach((stateNode) => {
        const id = stateNode.getAttribute("Id");
        if (!id) return;

        const params = getParamMap(stateNode);
        const screen = screens.get(params.Screen);

        stateById.set(id, {
            id,
            kind: "state",
            type: stateNode.getAttribute("Type") || "",
            comment: stateNode.getAttribute("Comment") || "",
            screenId: params.Screen || "",
            screenComment: screen?.comment || "",
            screenResource: screen?.resource || "",
            params,
        });
    });

    const unresolvedTargets = new Set();

    const baseEdges = [];

    stateNodes.forEach((stateNode) => {
        const source = stateNode.getAttribute("Id");
        if (!source) return;

        getStateTransitions(stateNode).forEach(({ key, target, displayLabel }) => {
            baseEdges.push({
                id: `${source}-${key}-${target}`,
                source,
                target,
                label: displayLabel || key,
                transitionKey: key,
                sourceKind: "state",
            });
        });
    });

    const transactionEdges = getTransactionContinuationEdges(
        stateById,
        baseEdges,
        transactions,
        tranMaps
    );
    const edges = [...baseEdges, ...transactionEdges];

    edges.forEach((edge) => {
        if (!stateById.has(edge.target)) {
            unresolvedTargets.add(edge.target);
        }
    });

    unresolvedTargets.forEach((target) => {
        stateById.set(target, {
            id: target,
            kind: "missing",
            type: "UNRESOLVED",
            comment: "Estado referenciado pero no definido en <States>",
            screenId: "",
            screenComment: "",
            screenResource: "",
            params: {},
        });
    });

    const nodes = Array.from(stateById.values()).sort((a, b) => compareIds(a.id, b.id));
    const levels = buildLevels(nodes, edges, stateById.has("0") ? "0" : nodes[0]?.id);

    const positionedNodes = [];
    const xGap = 300;
    const yGap = 148;
    const startX = 48;
    const startY = 36;

    Array.from(levels.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([level, group]) => {
            group.forEach((node, index) => {
                positionedNodes.push({
                    ...node,
                    level,
                    x: startX + level * xGap,
                    y: startY + index * yGap,
                });
            });
        });

    const positionedById = new Map(positionedNodes.map((node) => [node.id, node]));

    const positionedEdges = edges
        .map((edge) => {
            const source = positionedById.get(edge.source);
            const target = positionedById.get(edge.target);
            if (!source || !target) return null;

            return {
                ...edge,
                sourceNode: source,
                targetNode: target,
            };
        })
        .filter(Boolean);

    const externalReferences = getExternalReferences(xmlDoc).map((ref) => ({
        ...ref,
        resolved: positionedById.has(ref.target),
    }));

    const warnings = [];

    if (unresolvedTargets.size > 0) {
        warnings.push({
            type: "missing-states",
            message: `Se encontraron ${unresolvedTargets.size} estados referenciados pero no definidos.`,
            items: Array.from(unresolvedTargets).sort(compareIds),
        });
    }

    const unresolvedExternalTargets = externalReferences
        .filter((ref) => !stateById.has(ref.target) || positionedById.get(ref.target)?.kind === "missing")
        .map((ref) => ref.target);

    if (unresolvedExternalTargets.length > 0) {
        warnings.push({
            type: "external-missing-states",
            message: "Hay referencias externas desde General/Transactions/Errors hacia estados no definidos.",
            items: Array.from(new Set(unresolvedExternalTargets)).sort(compareIds),
        });
    }

    const outgoingCount = new Map();
    const incomingCount = new Map();

    positionedNodes.forEach((node) => {
        outgoingCount.set(node.id, 0);
        incomingCount.set(node.id, 0);
    });

    positionedEdges.forEach((edge) => {
        outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
        if (edge.sourceKind === "state") {
            incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
        }
    });

    const startNodeIds = positionedNodes
        .filter((node) => node.kind === "state" && (incomingCount.get(node.id) || 0) === 0)
        .map((node) => node.id)
        .sort(compareIds);

    const endNodeIds = positionedNodes
        .filter((node) => node.kind === "state" && (outgoingCount.get(node.id) || 0) === 0)
        .map((node) => node.id)
        .sort(compareIds);

    return {
        nodes: positionedNodes,
        edges: positionedEdges,
        levels: Array.from(levels.keys()).sort((a, b) => a - b),
        externalReferences,
        warnings,
        startNodeIds,
        endNodeIds,
    };
}
