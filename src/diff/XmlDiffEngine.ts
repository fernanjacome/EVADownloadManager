import type {
  DiffBlock,
  DiffLine,
  DiffModel,
  DiffOptions,
  InlineChange,
  ParsedXml,
  XmlToken,
} from "./types";

const DEFAULT_OPTIONS: DiffOptions = {
  ignoreWhitespace: false,
  ignoreComments: false,
  caseSensitive: true,
};

const POPULAR_TOKEN_LIMIT = 160;
const LOCAL_MATCH_WINDOW = 10;

type MatchPair = { left: number; right: number };

export function parseXml(input: string): ParsedXml {
  const text = normalizeNewlines(input ?? "");
  const lines = text.length ? text.split("\n") : [];

  if (!text.trim()) {
    return { text, lines, doc: null };
  }

  try {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const parserError = doc.getElementsByTagName("parsererror")[0];
    return {
      text,
      lines,
      doc: parserError ? null : doc,
      parserError: parserError?.textContent || undefined,
    };
  } catch (error) {
    return {
      text,
      lines,
      doc: null,
      parserError: error instanceof Error ? error.message : "XML invalido",
    };
  }
}

export function tokenizeXml(input: string, options: Partial<DiffOptions> = {}): XmlToken[] {
  const resolved = resolveOptions(options);
  const parsed = parseXml(input);

  return parsed.lines
    .map((raw, index) => {
      const normalized = normalizeLine(raw, resolved);
      const isComment = /^\s*<!--/.test(raw);
      const tagName = extractTagName(raw);
      const nodeKey = buildNodeKey(raw, normalized, tagName);

      return {
        index,
        lineNumber: index + 1,
        raw,
        normalized,
        compareKey: buildCompareKey(normalized, isComment, resolved),
        nodeKey,
        isComment,
        isBlank: normalized.length === 0,
        tagName,
      };
    })
    .filter((token) => !(resolved.ignoreComments && token.isComment));
}

export function computeLCS(left: XmlToken[], right: XmlToken[]): MatchPair[] {
  const rightPositions = new Map<string, number[]>();
  const rightCounts = new Map<string, number>();

  right.forEach((token, index) => {
    if (!token.compareKey) return;
    rightCounts.set(token.compareKey, (rightCounts.get(token.compareKey) || 0) + 1);
    if (!rightPositions.has(token.compareKey)) rightPositions.set(token.compareKey, []);
    rightPositions.get(token.compareKey)?.push(index);
  });

  const tails: number[] = [];
  const links: Array<{ left: number; right: number; prev: unknown } | null> = [];

  left.forEach((token, leftIndex) => {
    const positions = rightPositions.get(token.compareKey);
    const count = rightCounts.get(token.compareKey) || 0;
    if (!positions || count > POPULAR_TOKEN_LIMIT) return;

    for (let p = positions.length - 1; p >= 0; p -= 1) {
      const rightIndex = positions[p];
      const slot = lowerBound(tails, rightIndex);
      const node = {
        left: leftIndex,
        right: rightIndex,
        prev: slot > 0 ? links[slot - 1] : null,
      };

      tails[slot] = rightIndex;
      links[slot] = node;
    }
  });

  const matches: MatchPair[] = [];
  let cursor = links[tails.length - 1] as
    | { left: number; right: number; prev: unknown }
    | null
    | undefined;

  while (cursor) {
    matches.push({ left: cursor.left, right: cursor.right });
    cursor = cursor.prev as typeof cursor;
  }

  return matches.reverse();
}

export function alignBlocks(
  left: XmlToken[],
  right: XmlToken[],
  matches: MatchPair[],
  options: Partial<DiffOptions> = {},
): DiffLine[] {
  const resolved = resolveOptions(options);
  const lines: DiffLine[] = [];
  let leftCursor = 0;
  let rightCursor = 0;

  const appendSegment = (leftEnd: number, rightEnd: number) => {
    lines.push(...alignUnmatchedSegment(left, right, leftCursor, leftEnd, rightCursor, rightEnd, resolved));
  };

  matches.forEach((match) => {
    appendSegment(match.left, match.right);
    lines.push({
      id: `eq-${left[match.left].lineNumber}-${right[match.right].lineNumber}`,
      leftLineNumber: left[match.left].lineNumber,
      rightLineNumber: right[match.right].lineNumber,
      leftContent: left[match.left].raw,
      rightContent: right[match.right].raw,
      type: "equal",
    });
    leftCursor = match.left + 1;
    rightCursor = match.right + 1;
  });

  appendSegment(left.length, right.length);
  markMovedBlocks(lines);
  return lines;
}

export function generateDiffModel(
  leftText: string,
  rightText: string,
  options: Partial<DiffOptions> = {},
): DiffModel {
  const resolved = resolveOptions(options);
  const left = tokenizeXml(leftText, resolved);
  const right = tokenizeXml(rightText, resolved);
  const matches = computeLCS(left, right);
  const lines = alignBlocks(left, right, matches, resolved);
  const blocks = buildBlocks(lines);
  const stats = lines.reduce(
    (acc, line) => {
      acc[line.type] += 1;
      if (line.moved) acc.moved += 1;
      acc.total += 1;
      return acc;
    },
    { equal: 0, modified: 0, inserted: 0, deleted: 0, moved: 0, total: 0 },
  );

  return {
    lines,
    blocks,
    stats,
    options: resolved,
    generatedAt: new Date().toISOString(),
  };
}

function alignUnmatchedSegment(
  left: XmlToken[],
  right: XmlToken[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  options: DiffOptions,
): DiffLine[] {
  const rows: DiffLine[] = [];
  let li = leftStart;
  let ri = rightStart;

  while (li < leftEnd || ri < rightEnd) {
    if (li >= leftEnd) {
      rows.push(insertedLine(right[ri]));
      ri += 1;
      continue;
    }

    if (ri >= rightEnd) {
      rows.push(deletedLine(left[li]));
      li += 1;
      continue;
    }

    if (left[li].compareKey === right[ri].compareKey) {
      rows.push(equalLine(left[li], right[ri]));
      li += 1;
      ri += 1;
      continue;
    }

    const directScore = lineSimilarity(left[li], right[ri], options);
    if (directScore >= 0.5) {
      rows.push(modifiedLine(left[li], right[ri]));
      li += 1;
      ri += 1;
      continue;
    }

    const best = findBestLocalMatch(left, right, li, leftEnd, ri, rightEnd, options);
    if (best && best.score >= 0.58) {
      while (ri < best.right) {
        rows.push(insertedLine(right[ri]));
        ri += 1;
      }
      while (li < best.left) {
        rows.push(deletedLine(left[li]));
        li += 1;
      }
      rows.push(modifiedLine(left[li], right[ri]));
      li += 1;
      ri += 1;
      continue;
    }

    const leftAhead = findExactAhead(left[li].compareKey, right, ri + 1, rightEnd);
    const rightAhead = findExactAhead(right[ri].compareKey, left, li + 1, leftEnd);

    if (leftAhead !== -1 && (rightAhead === -1 || leftAhead - ri <= rightAhead - li)) {
      rows.push(insertedLine(right[ri]));
      ri += 1;
    } else if (rightAhead !== -1) {
      rows.push(deletedLine(left[li]));
      li += 1;
    } else {
      rows.push(deletedLine(left[li]));
      rows.push(insertedLine(right[ri]));
      li += 1;
      ri += 1;
    }
  }

  return rows;
}

function findBestLocalMatch(
  left: XmlToken[],
  right: XmlToken[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  options: DiffOptions,
) {
  let best: { left: number; right: number; score: number } | null = null;
  const leftLimit = Math.min(leftEnd, leftStart + LOCAL_MATCH_WINDOW);
  const rightLimit = Math.min(rightEnd, rightStart + LOCAL_MATCH_WINDOW);

  for (let li = leftStart; li < leftLimit; li += 1) {
    for (let ri = rightStart; ri < rightLimit; ri += 1) {
      const score = lineSimilarity(left[li], right[ri], options);
      if (!best || score > best.score) {
        best = { left: li, right: ri, score };
      }
    }
  }

  return best;
}

function findExactAhead(compareKey: string, tokens: XmlToken[], start: number, end: number) {
  for (let i = start; i < Math.min(end, start + LOCAL_MATCH_WINDOW); i += 1) {
    if (tokens[i].compareKey === compareKey) return i;
  }
  return -1;
}

function equalLine(left: XmlToken, right: XmlToken): DiffLine {
  return {
    id: `eq-${left.lineNumber}-${right.lineNumber}`,
    leftLineNumber: left.lineNumber,
    rightLineNumber: right.lineNumber,
    leftContent: left.raw,
    rightContent: right.raw,
    type: "equal",
  };
}

function modifiedLine(left: XmlToken, right: XmlToken): DiffLine {
  const inline = computeInlineChanges(left.raw, right.raw);
  return {
    id: `mod-${left.lineNumber}-${right.lineNumber}`,
    leftLineNumber: left.lineNumber,
    rightLineNumber: right.lineNumber,
    leftContent: left.raw,
    rightContent: right.raw,
    type: "modified",
    leftInlineChanges: inline.left,
    rightInlineChanges: inline.right,
    inlineChanges: inline.left,
  };
}

function deletedLine(left: XmlToken): DiffLine {
  return {
    id: `del-${left.lineNumber}`,
    leftLineNumber: left.lineNumber,
    leftContent: left.raw,
    type: "deleted",
  };
}

function insertedLine(right: XmlToken): DiffLine {
  return {
    id: `ins-${right.lineNumber}`,
    rightLineNumber: right.lineNumber,
    rightContent: right.raw,
    type: "inserted",
  };
}

function computeInlineChanges(left: string, right: string): { left: InlineChange[]; right: InlineChange[] } {
  const leftParts = splitInlineTokens(left);
  const rightParts = splitInlineTokens(right);
  const lcs = computeStringLcs(leftParts.map((p) => p.value), rightParts.map((p) => p.value));
  const leftMatched = new Set(lcs.map((pair) => pair.left));
  const rightMatched = new Set(lcs.map((pair) => pair.right));

  return {
    left: mergeInlineRanges(
      leftParts
        .filter((_, index) => !leftMatched.has(index))
        .map((part) => ({ start: part.start, end: part.end, type: "removed" as const })),
    ),
    right: mergeInlineRanges(
      rightParts
        .filter((_, index) => !rightMatched.has(index))
        .map((part) => ({ start: part.start, end: part.end, type: "added" as const })),
    ),
  };
}

function computeStringLcs(left: string[], right: string[]): MatchPair[] {
  if (left.length * right.length > 25000) {
    return greedyTokenMatches(left, right);
  }

  const dp = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const pairs: MatchPair[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      pairs.push({ left: i, right: j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

function greedyTokenMatches(left: string[], right: string[]): MatchPair[] {
  const used = new Set<number>();
  const pairs: MatchPair[] = [];
  left.forEach((value, leftIndex) => {
    const rightIndex = right.findIndex((candidate, index) => !used.has(index) && candidate === value);
    if (rightIndex >= 0) {
      used.add(rightIndex);
      pairs.push({ left: leftIndex, right: rightIndex });
    }
  });
  return pairs.sort((a, b) => a.left - b.left || a.right - b.right);
}

function splitInlineTokens(value: string) {
  const parts: Array<{ value: string; start: number; end: number }> = [];
  const pattern = /([A-Za-z_:-]+|\d+|\s+|.)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    parts.push({ value: match[0], start: match.index, end: match.index + match[0].length });
  }
  return parts;
}

function mergeInlineRanges(changes: InlineChange[]): InlineChange[] {
  if (changes.length === 0) return changes;
  const sorted = [...changes].sort((a, b) => a.start - b.start);
  const merged: InlineChange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (last.type === current.type && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged.filter((change) => change.end > change.start);
}

function markMovedBlocks(lines: DiffLine[]) {
  const deleted = collectContentRuns(lines, "deleted");
  const inserted = collectContentRuns(lines, "inserted");
  const insertedMap = new Map(inserted.map((run) => [run.signature, run]));

  deleted.forEach((run) => {
    const match = insertedMap.get(run.signature);
    if (!match || run.signature.length < 12) return;
    for (let i = run.start; i <= run.end; i += 1) {
      lines[i].moved = true;
    }
    for (let i = match.start; i <= match.end; i += 1) {
      lines[i].moved = true;
    }
  });
}

function collectContentRuns(lines: DiffLine[], type: "deleted" | "inserted") {
  const runs: Array<{ start: number; end: number; signature: string }> = [];
  let start = -1;
  let content: string[] = [];

  lines.forEach((line, index) => {
    if (line.type === type) {
      if (start === -1) start = index;
      content.push((type === "deleted" ? line.leftContent : line.rightContent) || "");
      return;
    }

    if (start !== -1) {
      runs.push({ start, end: index - 1, signature: content.map((item) => item.trim()).join("\n") });
      start = -1;
      content = [];
    }
  });

  if (start !== -1) {
    runs.push({ start, end: lines.length - 1, signature: content.map((item) => item.trim()).join("\n") });
  }

  return runs;
}

function buildBlocks(lines: DiffLine[]): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  let current: DiffBlock | null = null;

  lines.forEach((line, index) => {
    if (line.type === "equal") {
      current = null;
      return;
    }

    if (current && current.type === line.type && current.end === index - 1) {
      current.end = index;
      return;
    }

    current = {
      id: `block-${blocks.length + 1}`,
      type: line.type,
      start: index,
      end: index,
    };
    blocks.push(current);
  });

  return blocks;
}

function lineSimilarity(left: XmlToken, right: XmlToken, options: DiffOptions) {
  if (left.tagName && right.tagName && left.tagName !== right.tagName) {
    return 0.12;
  }

  const a = options.ignoreWhitespace ? left.normalized : left.raw.trim();
  const b = options.ignoreWhitespace ? right.normalized : right.raw.trim();
  if (a === b) return 1;
  if (!a || !b) return 0;

  const attrScore = attributeSimilarity(a, b);
  const charScore = diceCoefficient(a, b);
  const nodeBoost = left.nodeKey && left.nodeKey === right.nodeKey ? 0.18 : 0;
  return Math.min(1, charScore * 0.68 + attrScore * 0.22 + nodeBoost);
}

function attributeSimilarity(left: string, right: string) {
  const leftAttrs = extractAttributes(left);
  const rightAttrs = extractAttributes(right);
  if (leftAttrs.size === 0 && rightAttrs.size === 0) return 0;
  let hits = 0;
  leftAttrs.forEach((value, key) => {
    if (rightAttrs.get(key) === value) hits += 1;
  });
  return hits / Math.max(leftAttrs.size, rightAttrs.size, 1);
}

function extractAttributes(line: string) {
  const attrs = new Map<string, string>();
  const pattern = /([\w:-]+)\s*=\s*(".*?"|'.*?')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    attrs.set(match[1], match[2]);
  }
  return attrs;
}

function diceCoefficient(left: string, right: string) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size && !b.size) return 1;
  let overlap = 0;
  a.forEach((count, key) => {
    overlap += Math.min(count, b.get(key) || 0);
  });
  const total = [...a.values()].reduce((sum, value) => sum + value, 0) + [...b.values()].reduce((sum, value) => sum + value, 0);
  return total ? (2 * overlap) / total : 0;
}

function bigrams(value: string) {
  const map = new Map<string, number>();
  const source = value.length > 1 ? value : `${value} `;
  for (let i = 0; i < source.length - 1; i += 1) {
    const key = source.slice(i, i + 2);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function buildCompareKey(normalized: string, isComment: boolean, options: DiffOptions) {
  if (options.ignoreComments && isComment) return "";
  return options.caseSensitive ? normalized : normalized.toLowerCase();
}

function buildNodeKey(raw: string, normalized: string, tagName?: string) {
  const idMatch = raw.match(/\b(?:Id|ID|id|Key|Code|RetCode|Name)\s*=\s*["']([^"']+)["']/);
  if (tagName && idMatch) return `${tagName}:${idMatch[1]}`;
  return tagName ? `${tagName}:${normalized.slice(0, 32)}` : normalized.slice(0, 32);
}

function normalizeLine(line: string, options: DiffOptions) {
  let value = line.replace(/\r/g, "");
  value = options.ignoreWhitespace ? value.replace(/\s+/g, " ").trim() : value.trimEnd();
  return options.caseSensitive ? value : value.toLowerCase();
}

function extractTagName(line: string) {
  const match = line.match(/^\s*<\/?\s*([A-Za-z_][\w:.-]*)/);
  return match?.[1];
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function lowerBound(values: number[], target: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (values[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function resolveOptions(options: Partial<DiffOptions>): DiffOptions {
  return { ...DEFAULT_OPTIONS, ...options };
}
