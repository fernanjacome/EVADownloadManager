export type DiffType = "equal" | "modified" | "inserted" | "deleted";

export type InlineChangeType = "added" | "removed";

export interface InlineChange {
  start: number;
  end: number;
  type: InlineChangeType;
}

export interface DiffLine {
  id: string;
  leftLineNumber?: number;
  rightLineNumber?: number;
  leftContent?: string;
  rightContent?: string;
  type: DiffType;
  leftInlineChanges?: InlineChange[];
  rightInlineChanges?: InlineChange[];
  inlineChanges?: InlineChange[];
  moved?: boolean;
  collapsed?: boolean;
  groupId?: string;
}

export interface XmlToken {
  index: number;
  lineNumber: number;
  raw: string;
  normalized: string;
  compareKey: string;
  nodeKey: string;
  isComment: boolean;
  isBlank: boolean;
  tagName?: string;
}

export interface DiffBlock {
  id: string;
  type: DiffType;
  start: number;
  end: number;
}

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreComments: boolean;
  caseSensitive: boolean;
}

export interface DiffModel {
  lines: DiffLine[];
  blocks: DiffBlock[];
  stats: {
    equal: number;
    modified: number;
    inserted: number;
    deleted: number;
    moved: number;
    total: number;
  };
  options: DiffOptions;
  generatedAt: string;
}

export interface ParsedXml {
  text: string;
  lines: string[];
  doc: Document | null;
  parserError?: string;
}
