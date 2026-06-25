import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import {
  EditorView,
  keymap,
  Decoration,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import {
  SearchQuery,
  search,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
  selectMatches,
} from "@codemirror/search";
import { indentUnit, syntaxTree } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import { forEachDiagnostic, linter, lintGutter } from "@codemirror/lint";
import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  completionStatus,
  moveCompletionSelection,
  snippetCompletion,
} from "@codemirror/autocomplete";
import { indentMore, redo, undo } from "@codemirror/commands";
import { expandAbbreviation } from "@emmetio/codemirror6-plugin";
import { notepadPlus, evaXmlDark } from "../../utils/notepadPlusTheme";
import SearchBar from "../utils/SearchBar";

const FORMATTERS = {
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".js": "js",
  ".jsx": "js",
};

export const canFormatResource = (extension) =>
  Boolean(FORMATTERS[String(extension || "").toLowerCase()]);

function runHistoryCommandAndReveal(view, command) {
  if (!command(view)) return false;
  const position = view.state.selection.main.head;
  requestAnimationFrame(() => {
    view.dispatch({
      effects: EditorView.scrollIntoView(position, { y: "center" }),
    });
    view.focus();
  });
  return true;
}

export async function formatScreenResource(value, extension, options = {}) {
  const formatter = FORMATTERS[String(extension || "").toLowerCase()];
  if (!formatter) return value;
  const printWidth = Math.max(
    40,
    Math.min(180, Number.parseInt(options.printWidth, 10) || 100),
  );

  const prettier = await import("prettier/standalone");
  if (formatter === "html") {
    const [htmlPlugin, babelPlugin, estreePlugin, postcssPlugin] = await Promise.all([
      import("prettier/plugins/html"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/postcss"),
    ]);
    return prettier.format(value, {
      parser: "html",
      plugins: [htmlPlugin, babelPlugin, estreePlugin, postcssPlugin],
      printWidth,
      tabWidth: 2,
      embeddedLanguageFormatting: "auto",
    });
  }
  if (formatter === "css") {
    const plugin = await import("prettier/plugins/postcss");
    return prettier.format(value, {
      parser: "css",
      plugins: [plugin],
      printWidth,
      tabWidth: 2,
    });
  }

  const [babelPlugin, estreePlugin] = await Promise.all([
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
  ]);
  return prettier.format(value, {
    parser: "babel",
    plugins: [babelPlugin, estreePlugin],
    printWidth,
    tabWidth: 2,
    semi: true,
  });
}

function languageFor(extension) {
  switch (String(extension || "").toLowerCase()) {
    case ".html":
    case ".htm":
      return html({ autoCloseTags: true, selfClosingTags: true });
    case ".css":
    case ".scss":
      return css();
    case ".js":
    case ".jsx":
      return javascript({ jsx: true });
    case ".ts":
    case ".tsx":
      return javascript({ jsx: true, typescript: true });
    case ".json":
      return json();
    case ".xml":
    case ".svg":
      return xml();
    default:
      return [];
  }
}

const SELF_CLOSING_TAGS = new Set(["br","hr","img","input","meta","link","area","base","col","embed","source","track","wbr"]);

const HTML_TAG_SNIPPETS = [
  "div","span","p","a","ul","ol","li","h1","h2","h3","h4","h5","h6",
  "table","thead","tbody","tr","td","th","form","label","button","select","option","textarea",
  "section","article","header","footer","nav","main","aside",
  "script","style","link","meta","title",
  "img","input","br","hr",
  "video","audio","canvas","svg","iframe",
].map((tag) => {
  if (SELF_CLOSING_TAGS.has(tag)) {
    return snippetCompletion(`${tag} \${}/>`, { label: tag, type: "type", detail: `<${tag}/>`, boost: 3 });
  }
  return snippetCompletion(`${tag}>\${}</${tag}>`, { label: tag, type: "type", detail: `<${tag}>…</${tag}>`, boost: 3 });
});

const HTML_ATTR_SNIPPETS = [
  "alt",
  "class",
  "id",
  "src",
  "href",
  "style",
  "title",
  "type",
  "name",
  "value",
  "placeholder",
  "action",
  "method",
  "target",
  "rel",
  "role",
  "data-",
  "aria-label",
  "aria-hidden",
  "width",
  "height",
  "onclick",
  "onchange",
  "onsubmit",
  "onload",
  "for",
  "tabindex",
  "lang",
].map((attr) =>
  snippetCompletion(`${attr}="\${}"`, {
    label: attr,
    type: "property",
    detail: `=${'"…"'}`,
    boost: 2,
  }),
);

const CSS_PROP_SNIPPETS = [
  ["color", "color: #{};"],
  ["background", "background: #{};"],
  ["background-color", "background-color: #{};"],
  ["background-image", "background-image: url(#{});"],
  ["font-size", "font-size: #{}px;"],
  ["font-family", "font-family: #{};"],
  ["font-weight", "font-weight: #{};"],
  ["margin", "margin: #{};"],
  ["margin-top", "margin-top: #{}px;"],
  ["margin-bottom", "margin-bottom: #{}px;"],
  ["margin-left", "margin-left: #{}px;"],
  ["margin-right", "margin-right: #{}px;"],
  ["padding", "padding: #{};"],
  ["padding-top", "padding-top: #{}px;"],
  ["padding-bottom", "padding-bottom: #{}px;"],
  ["padding-left", "padding-left: #{}px;"],
  ["padding-right", "padding-right: #{}px;"],
  ["width", "width: #{};"],
  ["height", "height: #{};"],
  ["max-width", "max-width: #{};"],
  ["min-width", "min-width: #{};"],
  ["display", "display: #{};"],
  ["position", "position: #{};"],
  ["top", "top: #{}px;"],
  ["left", "left: #{}px;"],
  ["right", "right: #{}px;"],
  ["bottom", "bottom: #{}px;"],
  ["z-index", "z-index: #{};"],
  ["border", "border: 1px solid #{};"],
  ["border-radius", "border-radius: #{}px;"],
  ["box-shadow", "box-shadow: #{};"],
  ["text-align", "text-align: #{};"],
  ["text-decoration", "text-decoration: #{};"],
  ["line-height", "line-height: #{};"],
  ["letter-spacing", "letter-spacing: #{};"],
  ["overflow", "overflow: #{};"],
  ["opacity", "opacity: #{};"],
  ["cursor", "cursor: #{};"],
  ["transition", "transition: #{};"],
  ["transform", "transform: #{};"],
  ["flex", "flex: #{};"],
  ["gap", "gap: #{};"],
  ["grid-template-columns", "grid-template-columns: #{};"],
  ["justify-content", "justify-content: #{};"],
  ["align-items", "align-items: #{};"],
].map(([prop, tmpl]) =>
  snippetCompletion(tmpl.replace(/#\{}/g, "${}"), {
    label: prop,
    type: "property",
    detail: ": …;",
    boost: 2,
  }),
);

const JS_SNIPPETS = [
  snippetCompletion('console.log("${}");', {
    label: "console.log",
    detail: 'console.log("")',
    type: "function",
    boost: 4,
  }),
  snippetCompletion("console.log(${});", {
    label: "log",
    detail: "console.log()",
    type: "function",
    boost: 3,
  }),
  snippetCompletion("function ${name}(${}) {\n  ${}\n}", {
    label: "function",
    detail: "function",
    type: "keyword",
    boost: 1,
  }),
  snippetCompletion("const ${name} = ${};", {
    label: "const",
    detail: "const … = …",
    type: "keyword",
    boost: 1,
  }),
  snippetCompletion("let ${name} = ${};", {
    label: "let",
    detail: "let … = …",
    type: "keyword",
    boost: 1,
  }),
  snippetCompletion("if (${}) {\n  ${}\n}", {
    label: "if",
    detail: "if (…) {…}",
    type: "keyword",
    boost: 1,
  }),
  snippetCompletion(
    "for (let ${i} = 0; ${i} < ${}.length; ${i}++) {\n  ${}\n}",
    { label: "for", detail: "for loop", type: "keyword", boost: 1 },
  ),
  snippetCompletion("addEventListener('${}', (${e}) => {\n  ${}\n});", {
    label: "addEventListener",
    detail: "event listener",
    type: "function",
    boost: 2,
  }),
  snippetCompletion("document.querySelector('${}');", {
    label: "querySelector",
    detail: "DOM query",
    type: "function",
    boost: 2,
  }),
  snippetCompletion("document.querySelectorAll('${}');", {
    label: "querySelectorAll",
    detail: "DOM query all",
    type: "function",
    boost: 2,
  }),
  snippetCompletion("document.getElementById('${}');", {
    label: "getElementById",
    detail: "DOM by ID",
    type: "function",
    boost: 2,
  }),
];

function javascriptSnippetCompletionSource(context) {
  const before = context.matchBefore(/[\w.]*/);
  if (!before || (before.from === before.to && !context.explicit)) return null;
  return {
    from: before.from,
    options: JS_SNIPPETS,
    validFor: /^[\w.]*$/,
  };
}

function isInsideHtmlScript(doc, pos) {
  const text = doc.sliceString(0, pos).toLowerCase();
  const scriptStart = text.lastIndexOf("<script");
  const scriptEnd = text.lastIndexOf("</script");
  if (scriptStart <= scriptEnd) return false;
  const tagEnd = text.indexOf(">", scriptStart);
  return tagEnd !== -1 && tagEnd < pos;
}

function relativePathFrom(resourcePath, targetPath) {
  const fromParts = String(resourcePath || "").split("/").filter(Boolean);
  fromParts.pop();
  const targetParts = String(targetPath || "").split("/").filter(Boolean);
  let shared = 0;
  while (
    shared < fromParts.length &&
    shared < targetParts.length &&
    fromParts[shared] === targetParts[shared]
  ) {
    shared++;
  }
  return [
    ...Array(fromParts.length - shared).fill(".."),
    ...targetParts.slice(shared),
  ].join("/");
}

function relativePathCompletionSource(context, resources, resourcePath) {
  const pos = context.pos;
  const textBefore = context.state.doc.sliceString(Math.max(0, pos - 2000), pos);
  const htmlPath = textBefore.match(/\b(?:src|href)\s*=\s*(["'])([^"']*)$/i);
  const cssPath = textBefore.match(/url\(\s*(["']?)([^"')\s]*)$/i);
  const match = htmlPath || cssPath;
  if (!match) return null;

  const typedPath = match[2] || "";
  if (
    !typedPath ||
    typedPath.startsWith("/") ||
    typedPath.startsWith("#") ||
    typedPath.startsWith("//") ||
    /^(?:[a-z][a-z\d+.-]*:|data:)/i.test(typedPath)
  ) {
    return null;
  }

  const options = (resources || [])
    .filter((item) => item?.path && (item.type === "file" || item.type === "directory"))
    .map((item) => ({ item, path: relativePathFrom(resourcePath, item.path) }))
    .filter(({ path }) => path && path.startsWith(typedPath))
    .map(({ item, path }) => {
      const isDirectory = item.type === "directory";
      const apply = isDirectory && !path.endsWith("/") ? `${path}/` : path;
      const displayName = apply.replace(/\/$/, "").split("/").at(-1) || apply;
      return {
        label: apply,
        displayLabel: isDirectory ? `${displayName}/` : displayName,
        detail: isDirectory ? "carpeta" : item.extension || "archivo",
        type: isDirectory ? "folder" : "file",
        apply,
      };
    });

  if (!options.length) return null;
  return {
    from: pos - typedPath.length,
    options,
    validFor: /^[^"'()\s<>]*$/,
  };
}

function snippetCompletionSource(extension, resources, resourcePath) {
  const ext = String(extension || "").toLowerCase();
  if ([".html", ".htm"].includes(ext)) {
    return (context) => {
      const pathCompletions = relativePathCompletionSource(
        context,
        resources,
        resourcePath,
      );
      if (pathCompletions) return pathCompletions;
      if (isInsideHtmlScript(context.state.doc, context.pos)) {
        return javascriptSnippetCompletionSource(context);
      }
      const before = context.matchBefore(/[\w-]*/);
      if (!before || (before.from === before.to && !context.explicit))
        return null;
      const textBefore = context.state.doc.sliceString(
        Math.max(0, before.from - 1),
        before.from,
      );

      // The opening '<' is already in the document.  Completing from the
      // tag name (rather than from '<') lets "p" match the option and keeps
      // the snippet insertion from duplicating the opening bracket.
      if (textBefore === "<") {
        return {
          from: before.from,
          options: HTML_TAG_SNIPPETS,
          validFor: /^[\w-]*$/,
        };
      }

      const line = context.state.doc.lineAt(context.pos);
      const textOnLine = line.text.slice(0, context.pos - line.from);
      const inOpenTag = /<[\w-]+(?:\s+[^<>]*)?$/.test(textOnLine);
      return {
        from: before.from,
        options: inOpenTag ? HTML_ATTR_SNIPPETS : [],
        validFor: /^[\w-]*$/,
      };
    };
  }
  if ([".css", ".scss"].includes(ext)) {
    return (context) => {
      const pathCompletions = relativePathCompletionSource(
        context,
        resources,
        resourcePath,
      );
      if (pathCompletions) return pathCompletions;
      const before = context.matchBefore(/[\w-]*/);
      if (!before || (before.from === before.to && !context.explicit))
        return null;
      return {
        from: before.from,
        options: CSS_PROP_SNIPPETS,
        validFor: /^[\w-]*$/,
      };
    };
  }
  if ([".js", ".jsx", ".ts", ".tsx"].includes(ext)) {
    return (context) =>
      relativePathCompletionSource(context, resources, resourcePath) ||
      javascriptSnippetCompletionSource(context);
  }
  return null;
}

const KNOWN_CSS_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "font",
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "text-shadow",
  "text-indent",
  "text-overflow",
  "white-space",
  "word-break",
  "word-spacing",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "float",
  "clear",
  "z-index",
  "overflow",
  "overflow-x",
  "overflow-y",
  "visibility",
  "opacity",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-color",
  "border-width",
  "border-style",
  "border-radius",
  "border-collapse",
  "border-spacing",
  "box-shadow",
  "box-sizing",
  "outline",
  "outline-color",
  "outline-style",
  "outline-width",
  "flex",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "justify-content",
  "align-items",
  "align-self",
  "align-content",
  "order",
  "gap",
  "row-gap",
  "column-gap",
  "grid",
  "grid-template",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-column",
  "grid-row",
  "grid-area",
  "grid-gap",
  "list-style",
  "list-style-type",
  "list-style-position",
  "list-style-image",
  "table-layout",
  "vertical-align",
  "caption-side",
  "empty-cells",
  "cursor",
  "pointer-events",
  "user-select",
  "resize",
  "content",
  "counter-reset",
  "counter-increment",
  "transition",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "transform",
  "transform-origin",
  "perspective",
  "backface-visibility",
  "filter",
  "backdrop-filter",
  "mix-blend-mode",
  "clip-path",
  "mask",
  "object-fit",
  "object-position",
  "scroll-behavior",
  "overscroll-behavior",
  "scroll-snap-type",
  "scroll-snap-align",
  "appearance",
  "will-change",
  "contain",
  "isolation",
  "aspect-ratio",
  "accent-color",
  "color-scheme",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "-webkit-app-region",
  "-webkit-user-select",
  "-webkit-line-clamp",
  "-webkit-text-fill-color",
]);

const DEPRECATED_HTML = new Set([
  "font",
  "center",
  "marquee",
  "blink",
  "big",
  "strike",
  "tt",
  "u",
  "basefont",
  "applet",
  "isindex",
  "dir",
  "menu",
]);

function describeError(view, from, to) {
  const doc = view.state.doc;
  const before = doc.sliceString(Math.max(0, from - 60), from);
  const at = doc.sliceString(from, Math.min(to, from + 40));
  const after = doc.sliceString(to, Math.min(doc.length, to + 30));

  if (/['"]$/.test(before) && /^['"]/.test(after)) return null;

  const inTag = /<[\w-]+[^>]*$/.test(before);
  if (inTag) {
    if (/^\s*=/.test(at)) return "Valor de atributo inesperado";
    if (/^["']/.test(at)) return "Atributo malformado — revisar comillas";
    if (/^\s*\w/.test(at)) return `Atributo inesperado: "${at.trim().split(/[\s=>]/)[0]}"`;
    if (/^>/.test(at) || /^\/>/.test(at)) return "Tag cerrado inesperadamente";
    return "Sintaxis invalida dentro del tag";
  }

  if (/^<\/\s*$/.test(at)) return "Tag de cierre incompleto";
  if (/^</.test(at)) {
    const tag = at.match(/^<\/?(\w+)/);
    return tag ? `Tag <${tag[1]}> malformado` : "Tag malformado";
  }

  if (/[{}]/.test(at)) return "Llave sin cerrar o inesperada";
  if (/[()]/.test(at)) return "Parentesis sin cerrar o inesperado";
  if (/;/.test(at) && !inTag) return "Punto y coma inesperado";

  const text = at.trim();
  if (!text) return null;
  return `Sintaxis inesperada: "${text.slice(0, 30)}"`;
}

function treeLinter(view) {
  const raw = [];
  const tree = syntaxTree(view.state);
  if (!tree || tree.length < 2) return raw;

  tree.iterate({
    enter: (node) => {
      if (node.type.isError) {
        raw.push({ from: node.from, to: node.to });
      }
    },
  });

  if (!raw.length) return [];

  const merged = [];
  let current = { ...raw[0] };
  for (let i = 1; i < raw.length; i++) {
    const lineA = view.state.doc.lineAt(current.from).number;
    const lineB = view.state.doc.lineAt(raw[i].from).number;
    if (lineB === lineA || raw[i].from - current.to < 3) {
      current.to = Math.max(current.to, raw[i].to);
    } else {
      merged.push(current);
      current = { ...raw[i] };
    }
  }
  merged.push(current);

  const diagnostics = [];
  for (const { from, to } of merged) {
    const msg = describeError(view, from, to);
    if (!msg) continue;
    diagnostics.push({
      from,
      to: Math.max(to, from + 1),
      severity: "error",
      message: msg,
    });
  }
  return diagnostics;
}

function htmlExtraLinter(view) {
  const diagnostics = [];
  const doc = view.state.doc.toString();

  const imgRe = /<img\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(doc)) !== null) {
    if (!/\balt\s*=/i.test(m[1])) {
      diagnostics.push({
        from: m.index,
        to: m.index + m[0].length,
        severity: "warning",
        message: "<img> sin atributo alt",
      });
    }
  }

  const tagRe = /<([\w-]+)/gi;
  while ((m = tagRe.exec(doc)) !== null) {
    if (DEPRECATED_HTML.has(m[1].toLowerCase())) {
      diagnostics.push({
        from: m.index,
        to: m.index + m[0].length,
        severity: "warning",
        message: `<${m[1]}> esta deprecado`,
      });
    }
  }

  return diagnostics;
}

function htmlStructureLinter(view) {
  const diagnostics = [];
  const doc = view.state.doc.toString();
  const openTags = [];
  const rawTextTags = new Set(["script", "style", "textarea", "title"]);

  const addDiagnostic = (from, to, message) => {
    diagnostics.push({
      from,
      to: Math.max(to, from + 1),
      severity: "error",
      message,
    });
  };

  const findTagEnd = (start) => {
    let quote = null;
    for (let i = start + 1; i < doc.length; i++) {
      const char = doc[i];
      if (quote) {
        if (char === quote && doc[i - 1] !== "\\") quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        return i;
      }
    }
    return -1;
  };

  const findUnexpectedTagStart = (fragment) => {
    let quote = null;
    for (let i = 1; i < fragment.length; i++) {
      const char = fragment[i];
      if (quote) {
        if (char === quote && fragment[i - 1] !== "\\") quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === "<") {
        return i;
      }
    }
    return -1;
  };

  for (let from = 0; from < doc.length; ) {
    const start = doc.indexOf("<", from);
    if (start === -1) break;

    if (doc.startsWith("<!--", start)) {
      const commentEnd = doc.indexOf("-->", start + 4);
      if (commentEnd === -1) {
        addDiagnostic(start, doc.length, "Comentario HTML sin cerrar");
        break;
      }
      from = commentEnd + 3;
      continue;
    }

    const end = findTagEnd(start);
    const fragment = doc.slice(start, end === -1 ? doc.length : end + 1);
    const closing = fragment.match(/^<\/\s*([\w:-]+)\s*(?:>|$)/);
    const opening = fragment.match(/^<\s*([\w:-]+)/);
    const unexpectedTagStart = findUnexpectedTagStart(fragment);

    if (opening && unexpectedTagStart !== -1) {
      const name = opening[1].toLowerCase();
      const selfClosing = SELF_CLOSING_TAGS.has(name);
      addDiagnostic(
        start,
        start + unexpectedTagStart,
        `Tag <${opening[1]}> incompleto: falta > antes de otro tag`,
      );
      if (!selfClosing) {
        openTags.push({ name, original: opening[1], from: start });
      }
      from = start + unexpectedTagStart;
      continue;
    }

    if (end === -1) {
      if (closing) {
        const name = closing[1].toLowerCase();
        const last = openTags.at(-1);
        if (last?.name === name) openTags.pop();
        addDiagnostic(start, doc.length, `Tag de cierre </${closing[1]}> incompleto: falta >`);
      } else if (opening) {
        addDiagnostic(start, doc.length, `Tag <${opening[1]}> incompleto: falta >`);
      } else {
        addDiagnostic(start, doc.length, "Tag HTML incompleto");
      }
      break;
    }

    if (closing) {
      const name = closing[1].toLowerCase();
      const last = openTags.at(-1);
      if (!last) {
        addDiagnostic(start, end + 1, `Tag de cierre </${closing[1]}> sin apertura`);
      } else if (last.name !== name) {
        addDiagnostic(
          start,
          end + 1,
          `Cierre </${closing[1]}> no corresponde a <${last.original}>`,
        );
      } else {
        openTags.pop();
      }
    } else if (opening) {
      const name = opening[1].toLowerCase();
      const selfClosing = /\/\s*>$/.test(fragment) || SELF_CLOSING_TAGS.has(name);
      if (!selfClosing) {
        openTags.push({ name, original: opening[1], from: start });
        if (rawTextTags.has(name)) {
          const closeStart = doc.toLowerCase().indexOf(`</${name}`, end + 1);
          if (closeStart === -1) {
            addDiagnostic(start, end + 1, `Tag <${opening[1]}> sin cierre: falta </${opening[1]}>`);
            openTags.pop();
            break;
          }
          from = closeStart;
          continue;
        }
      }
    } else if (!/^<!/.test(fragment)) {
      addDiagnostic(start, end + 1, "Tag HTML malformado");
    }

    from = end + 1;
  }

  const orphanClose = /(^|[\s>])\/([\w:-]+)>/g;
  let orphan;
  while ((orphan = orphanClose.exec(doc)) !== null) {
    const from = orphan.index + orphan[1].length;
    addDiagnostic(from, from + orphan[0].length - orphan[1].length, `Cierre /${orphan[2]}> invalido: falta <`);
  }

  for (const tag of openTags) {
    addDiagnostic(tag.from, tag.from + tag.original.length + 1, `Tag <${tag.original}> sin cierre: falta </${tag.original}>`);
  }

  return diagnostics;
}

function cssExtraLinter(view) {
  const diagnostics = [];
  const doc = view.state.doc.toString();

  const propRe = /^\s*([\w-]+)\s*:/gm;
  let m;
  while ((m = propRe.exec(doc)) !== null) {
    const prop = m[1].toLowerCase();
    if (prop.startsWith("--")) continue;
    if (!KNOWN_CSS_PROPS.has(prop)) {
      const closest = [...KNOWN_CSS_PROPS].find(
        (k) =>
          k.startsWith(prop.slice(0, 3)) &&
          Math.abs(k.length - prop.length) <= 2,
      );
      diagnostics.push({
        from: m.index + m[0].indexOf(m[1]),
        to: m.index + m[0].indexOf(m[1]) + m[1].length,
        severity: "warning",
        message: closest
          ? `Propiedad desconocida: ${prop} (¿${closest}?)`
          : `Propiedad desconocida: ${prop}`,
      });
    }
  }

  const declRe = /[\w-]+\s*:[^;{}]*[^\s;{}]/g;
  while ((m = declRe.exec(doc)) !== null) {
    const end = m.index + m[0].length;
    const afterChar = doc[end];
    if (afterChar && afterChar !== ";" && afterChar !== "}" && afterChar !== "\n" && afterChar !== "\r") continue;
    if (afterChar === ";") continue;
    const rest = doc.slice(end).match(/^\s*(\S)/);
    if (rest && rest[1] !== "}" && rest[1] !== undefined) {
      diagnostics.push({
        from: end - 1,
        to: end,
        severity: "error",
        message: "Falta ; al final de la declaracion",
      });
    }
  }

  let braceDepth = 0;
  for (let i = 0; i < doc.length; i++) {
    if (doc[i] === "{") braceDepth++;
    if (doc[i] === "}") braceDepth--;
  }
  if (braceDepth > 0) {
    diagnostics.push({
      from: doc.length - 1,
      to: doc.length,
      severity: "error",
      message: `${braceDepth} llave(s) { sin cerrar`,
    });
  } else if (braceDepth < 0) {
    diagnostics.push({
      from: doc.length - 1,
      to: doc.length,
      severity: "error",
      message: `${-braceDepth} llave(s) } de mas`,
    });
  }

  return diagnostics;
}

function createLintExtension(extension, onDiagnostics, resourcePath) {
  const ext = String(extension || "").toLowerCase();
  if (
    ![
      ".html",
      ".htm",
      ".css",
      ".scss",
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".json",
    ].includes(ext)
  )
    return [];

  const isHtml = [".html", ".htm"].includes(ext);
  const isCss = [".css", ".scss"].includes(ext);

  return [
    lintGutter(),
    linter(
      (view) => {
        // The HTML parser emits temporary recovery nodes while attributes are
        // being edited. HTML has a stricter dedicated validator below, which
        // avoids reporting valid inline CSS such as `margin: 0 0 0 55%;`.
        const diags = isHtml ? [] : treeLinter(view);
        if (isHtml) diags.push(...htmlExtraLinter(view), ...htmlStructureLinter(view));
        if (isCss) diags.push(...cssExtraLinter(view));
        onDiagnostics?.(
          diags
            .filter((d) => d.severity === "error")
            .map((d) => ({
              from: d.from,
              to: d.to,
              line: view.state.doc.lineAt(d.from).number,
              message: d.message,
            })),
          resourcePath,
        );
        return diags;
      },
      { delay: 500 },
    ),
  ];
}

function supportsEmmet(extension) {
  return [".html", ".htm", ".css", ".scss", ".jsx", ".tsx"].includes(
    String(extension || "").toLowerCase(),
  );
}

const PATH_PATTERNS = [
  /(?:href|src)\s*=\s*["']([^"']+)["']/gi,
  /url\(\s*["']([^"']+)["']\s*\)/gi,
  /url\(\s*([^"')][^)]*?)\s*\)/gi,
];

function extractPathAtColumn(lineText, col) {
  for (const re of PATH_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(lineText)) !== null) {
      const valStart = match.index + match[0].length - match[1].length;
      const valEnd = valStart + match[1].length;
      if (col >= valStart && col <= valEnd) return match[1].trim();
    }
  }
  return null;
}

function findAllPaths(lineText) {
  const results = [];
  for (const re of PATH_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(lineText)) !== null) {
      const val = match[1].trim();
      if (
        /^[a-zA-Z]:[\\/]/.test(val) ||
        /^https?:\/\//.test(val) ||
        /^\/\//.test(val) ||
        /^data:/.test(val)
      )
        continue;
      const valStart = match.index + match[0].length - match[1].length;
      results.push({
        from: valStart,
        to: valStart + match[1].length,
        path: val,
      });
    }
  }
  return results;
}

const COLOR_RE = /#(?:[0-9a-fA-F]{3,4}){1,2}\b|(?:rgb|hsl)a?\([^)]+\)/g;

class ColorWidget extends WidgetType {
  constructor(color) {
    super();
    this.color = color;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-color-swatch";
    span.style.backgroundColor = this.color;
    return span;
  }
  eq(other) {
    return this.color === other.color;
  }
}

function colorDecorations(view) {
  const widgets = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match;
    COLOR_RE.lastIndex = 0;
    while ((match = COLOR_RE.exec(text)) !== null) {
      const pos = from + match.index;
      widgets.push(
        Decoration.widget({
          widget: new ColorWidget(match[0]),
          side: -1,
        }).range(pos),
      );
    }
  }
  return Decoration.set(widgets, true);
}

const colorPreviewPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = colorDecorations(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = colorDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const linkMark = Decoration.mark({ class: "cm-ctrl-link" });

function createCtrlLinkExtension() {
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = Decoration.none;
        this.view = view;
        this.onKeyChange = (e) => {
          if (e.key === "Control" || e.key === "Meta")
            this.updateHover(e.type === "keydown");
        };
        this.onMouseMove = (e) => {
          if (e.ctrlKey || e.metaKey) this.updateHoverAt(e);
          else if (this.decorations !== Decoration.none) {
            this.decorations = Decoration.none;
            this.view.dom.style.cursor = "";
            this.view.requestMeasure();
          }
        };
        window.addEventListener("keydown", this.onKeyChange);
        window.addEventListener("keyup", this.onKeyChange);
        view.dom.addEventListener("mousemove", this.onMouseMove);
      }
      updateHover(ctrlDown) {
        if (!ctrlDown && this.decorations !== Decoration.none) {
          this.decorations = Decoration.none;
          this.view.dom.style.cursor = "";
          this.view.requestMeasure();
        }
      }
      updateHoverAt(event) {
        const pos = this.view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        });
        if (pos === null) {
          this.clearLink();
          return;
        }
        const line = this.view.state.doc.lineAt(pos);
        const col = pos - line.from;
        const paths = findAllPaths(line.text);
        const hit = paths.find((p) => col >= p.from && col <= p.to);
        if (hit) {
          this.decorations = Decoration.set([
            linkMark.range(line.from + hit.from, line.from + hit.to),
          ]);
          this.view.dom.style.cursor = "pointer";
        } else {
          this.clearLink();
        }
        this.view.requestMeasure();
      }
      clearLink() {
        if (this.decorations !== Decoration.none) {
          this.decorations = Decoration.none;
          this.view.dom.style.cursor = "";
        }
      }
      destroy() {
        window.removeEventListener("keydown", this.onKeyChange);
        window.removeEventListener("keyup", this.onKeyChange);
        this.view.dom.removeEventListener("mousemove", this.onMouseMove);
        this.view.dom.style.cursor = "";
      }
    },
    { decorations: (v) => v.decorations },
  );
  return plugin;
}

const editorStyles = EditorView.theme({
  ".cm-selectionMatch": {
    backgroundColor: "rgba(0, 200, 150, 0.15) !important",
    borderRadius: "2px",
  },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: "rgba(0, 200, 150, 0.25)",
    outline: "1px solid rgba(0, 200, 150, 0.4)",
    borderRadius: "2px",
  },
  ".cm-tooltip-autocomplete": {
    fontFamily: "Consolas, 'Fira Code', monospace",
    fontSize: "12px",
    border: "1px solid var(--border-general)",
    borderRadius: "6px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
    maxHeight: "260px",
  },
  ".cm-tooltip-autocomplete > ul": {
    maxHeight: "260px",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "2px 8px",
    minHeight: "22px",
    display: "flex",
    alignItems: "center",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    background: "rgba(0, 200, 150, 0.15)",
    color: "inherit",
  },
  ".cm-completionIcon": {
    fontSize: "11px",
    opacity: "0.6",
    width: "16px",
    textAlign: "center",
  },
  ".cm-completionLabel": {
    flex: "1",
  },
  ".cm-completionDetail": {
    fontSize: "10px",
    opacity: "0.5",
    marginLeft: "8px",
    fontStyle: "italic",
  },
  ".cm-color-swatch": {
    display: "inline-block",
    width: "10px",
    height: "10px",
    borderRadius: "2px",
    border: "1px solid rgba(128,128,128,0.4)",
    marginRight: "3px",
    verticalAlign: "middle",
    translate: "0 -1px",
  },
  ".cm-gutters": {
    userSelect: "none",
  },
  ".cm-foldGutter .cm-gutterElement": {
    fontSize: "11px",
    color: "#999",
    padding: "0 2px",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-foldGutter .cm-gutterElement:hover": {
    color: "var(--c-principal)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "rgba(0,200,150,0.08)",
    border: "1px solid rgba(0,200,150,0.2)",
    borderRadius: "3px",
    padding: "0 6px",
    margin: "0 2px",
    color: "var(--c-principal)",
    cursor: "pointer",
  },
  ".cm-ctrl-link": {
    textDecoration: "underline",
    color: "var(--c-principal)",
    cursor: "pointer",
  },
  ".cm-lint-marker": {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    marginLeft: "2px",
  },
  ".cm-lint-marker-error": {
    content: "none",
    background: "#e05252",
  },
  ".cm-lint-marker-warning": {
    content: "none",
    background: "#d4a020",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "wavy underline #e05252",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "wavy underline #d4a020",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip-lint": {
    fontFamily: "Consolas, 'Fira Code', monospace",
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "4px",
    border: "1px solid var(--border-general)",
    background: "var(--c-fondo)",
    color: "var(--txt-normalf)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
    maxWidth: "400px",
  },
  ".cm-lintPoint::after": {
    display: "none",
  },
});

export default function ScreenResourceEditor({
  resource,
  resources = [],
  value,
  onChange,
  searchTerm = "",
  onSave,
  onFormat,
  onFormatMetrics,
  formatOnSave = false,
  onFormatOnSaveChange,
  goToLine = 0,
  onGoToLineHandled,
  onOpenPath,
  theme = "light",
  onDiagnostics,
  onDiagnosticClick,
}) {
  const editorViewRef = useRef(null);
  const formatResizeObserverRef = useRef(null);
  const goToLineHandledRef = useRef(false);
  const searchInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [pinnedDiagnostic, setPinnedDiagnostic] = useState(null);
  const [editorContextMenu, setEditorContextMenu] = useState(null);
  const [searchState, setSearchState] = useState({
    query: "",
    replaceText: "",
    matchCase: false,
    wholeWord: false,
  });
  const [searchMetrics, setSearchMetrics] = useState({
    total: 0,
    current: 0,
    allSelected: false,
  });

  const getFormatPrintWidth = useCallback((view) => {
    const contentWidth = view?.contentDOM?.clientWidth || 0;
    const charWidth = view?.defaultCharacterWidth || 8;
    if (!contentWidth || !charWidth) return 100;
    return Math.max(40, Math.min(180, Math.floor((contentWidth - 24) / charWidth)));
  }, []);

  const publishFormatMetrics = useCallback((view) => {
    onFormatMetrics?.({ printWidth: getFormatPrintWidth(view) });
  }, [getFormatPrintWidth, onFormatMetrics]);

  useEffect(() => () => formatResizeObserverRef.current?.disconnect(), []);

  useEffect(() => {
    if (!editorContextMenu) return undefined;
    const closeMenu = () => setEditorContextMenu(null);
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("blur", closeMenu);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [editorContextMenu]);

  const buildQuery = useCallback(
    (state) =>
      new SearchQuery({
        search: state.query,
        replace: state.replaceText,
        caseSensitive: state.matchCase,
        regexp: false,
        wholeWord: state.wholeWord,
      }),
    [],
  );

  const updateSearchMetrics = useCallback((view, query) => {
    if (!view || !query.search || !query.valid) {
      setSearchMetrics({ total: 0, current: 0, allSelected: false });
      return;
    }
    const cursor = query.getCursor(view.state);
    const matches = [];
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      matches.push(next.value);
    }
    if (matches.length === 0) {
      setSearchMetrics({ total: 0, current: 0, allSelected: false });
      return;
    }
    const sel = view.state.selection.main;
    let currentIdx = 0;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].from <= sel.from) currentIdx = i;
    }
    const allSelected =
      view.state.selection.ranges.length === matches.length &&
      matches.length > 1;
    setSearchMetrics({
      total: matches.length,
      current: currentIdx,
      allSelected,
    });
  }, []);

  const applySearch = useCallback(
    (state, { moveToFirst = false } = {}) => {
      const view = editorViewRef.current;
      if (!view) return;
      const query = buildQuery(state);
      view.dispatch({ effects: setSearchQuery.of(query) });
      if (moveToFirst && query.search && query.valid) {
        findNext(view);
      }
      updateSearchMetrics(view, query);
    },
    [buildQuery, updateSearchMetrics],
  );

  useEffect(() => {
    applySearch(searchState);
  }, [searchState, applySearch]);

  const nextMatch = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    findNext(view);
    updateSearchMetrics(view, buildQuery(searchState));
  }, [searchState, buildQuery, updateSearchMetrics]);

  const prevMatch = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    findPrevious(view);
    updateSearchMetrics(view, buildQuery(searchState));
  }, [searchState, buildQuery, updateSearchMetrics]);

  const replaceCurrent = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    replaceNext(view);
    updateSearchMetrics(view, buildQuery(searchState));
  }, [searchState, buildQuery, updateSearchMetrics]);

  const replaceEveryMatch = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    replaceAll(view);
    updateSearchMetrics(view, buildQuery(searchState));
  }, [searchState, buildQuery, updateSearchMetrics]);

  const selectAllOccurrences = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (searchMetrics.allSelected) {
      const main = view.state.selection.main;
      view.dispatch({ selection: { anchor: main.from, head: main.to } });
      setSearchMetrics((m) => ({ ...m, allSelected: false }));
    } else {
      selectMatches(view);
      setSearchMetrics((m) => ({ ...m, allSelected: true }));
    }
  }, [searchMetrics.allSelected]);

  const openSearchWindow = useCallback(
    (withReplace = false) => {
      const view = editorViewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      if (sel.from !== sel.to) {
        const selectedText = view.state.doc.sliceString(sel.from, sel.to);
        const next = { ...searchState, query: selectedText };
        setSearchState(next);
        setShowSearch(true);
        if (withReplace) setShowReplace(true);
        setTimeout(() => {
          applySearch(next, { moveToFirst: true });
          (withReplace ? replaceInputRef : searchInputRef).current?.focus();
        }, 0);
        return;
      }
      setShowSearch(true);
      if (withReplace) setShowReplace(true);
      setTimeout(
        () => (withReplace ? replaceInputRef : searchInputRef).current?.focus(),
        0,
      );
    },
    [searchState, applySearch],
  );

  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-s",
          run: (view) => {
            onSave?.();
            setTimeout(() => view.focus(), 50);
            setTimeout(() => view.focus(), 250);
            return true;
          },
        },
      ]),
    [onSave],
  );

  const historyNavigationKeymap = useMemo(
    () =>
      Prec.highest(keymap.of([
        { key: "Mod-z", run: (view) => runHistoryCommandAndReveal(view, undo) },
        { key: "Mod-y", run: (view) => runHistoryCommandAndReveal(view, redo) },
        { key: "Mod-Shift-z", run: (view) => runHistoryCommandAndReveal(view, redo) },
      ])),
    [],
  );

  const editorKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-f",
          run: () => {
            openSearchWindow(false);
            return true;
          },
        },
        {
          key: "Mod-h",
          run: () => {
            openSearchWindow(true);
            return true;
          },
        },
        {
          key: "F3",
          run: () => {
            nextMatch();
            return true;
          },
        },
        {
          key: "Shift-F3",
          run: () => {
            prevMatch();
            return true;
          },
        },
        {
          key: "Escape",
          run: () => {
            if (showSearch) {
              setShowSearch(false);
              setShowReplace(false);
              return true;
            }
            return false;
          },
        },
      ]),
    [openSearchWindow, nextMatch, prevMatch, showSearch],
  );

  const hasEmmet = supportsEmmet(resource.extension);

  const tabKeymap = useMemo(
    () =>
      Prec.highest(keymap.of([
        { key: "ArrowDown", run: moveCompletionSelection(true) },
        { key: "ArrowUp", run: moveCompletionSelection(false) },
        { key: "Escape", run: closeCompletion },
        {
          key: "Tab",
          run: (view) => {
            if (completionStatus(view.state) === "active") {
              return acceptCompletion(view);
            }
            if (hasEmmet && expandAbbreviation(view)) {
              return true;
            }
            return indentMore(view);
          },
        },
        {
          key: "Enter",
          run: (view) => {
            if (completionStatus(view.state) === "active") {
              return acceptCompletion(view);
            }
            return false;
          },
        },
      ])),
    [hasEmmet],
  );

  const completionSource = useMemo(
    () => snippetCompletionSource(resource.extension, resources, resource.path),
    [resource.extension, resource.path, resources],
  );

  const completionConfig = useMemo(
    () =>
      autocompletion({
        activateOnTyping: true,
        defaultKeymap: false,
        icons: true,
        maxRenderedOptions: 30,
        override: completionSource ? [completionSource] : undefined,
      }),
    [completionSource],
  );

  const ctrlClickHandler = useMemo(
    () =>
      EditorView.domEventHandlers({
        click: (event, view) => {
          if ((!event.ctrlKey && !event.metaKey) || !onOpenPath) return false;
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos === null) return false;
          const line = view.state.doc.lineAt(pos);
          const col = pos - line.from;
          const path = extractPathAtColumn(line.text, col);
          if (!path) return false;
          if (
            /^[a-zA-Z]:[\\/]/.test(path) ||
            /^https?:\/\//.test(path) ||
            /^\/\//.test(path) ||
            /^data:/.test(path)
          )
            return false;
          event.preventDefault();
          onOpenPath(path);
          return true;
        },
      }),
    [onOpenPath],
  );

  const editorContextMenuHandler = useMemo(
    () =>
      EditorView.domEventHandlers({
        contextmenu: (event) => {
          event.preventDefault();
          setEditorContextMenu({ x: event.clientX, y: event.clientY });
          return true;
        },
      }),
    [],
  );

  const ctrlLinkExt = useMemo(
    () => (onOpenPath ? createCtrlLinkExtension() : []),
    [onOpenPath],
  );

  const reportDiagnostics = useCallback(
    (diagnostics, diagnosticResourcePath) => {
      setPinnedDiagnostic((current) => {
        if (
          !current ||
          diagnosticResourcePath !== resource.path ||
          diagnostics.some(
            (diagnostic) =>
              diagnostic.line === current.line &&
              diagnostic.message === current.message,
          )
        ) {
          return current;
        }
        return null;
      });
      onDiagnostics?.(diagnostics, diagnosticResourcePath);
    },
    [onDiagnostics, resource.path],
  );

  const lintMarkerClickHandler = useMemo(
    () =>
      EditorView.domEventHandlers({
        click: (event, view) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target?.closest(".cm-lint-marker")) return false;
          const contentRect = view.contentDOM.getBoundingClientRect();
          const pos = view.posAtCoords({ x: contentRect.left + 2, y: event.clientY });
          if (pos === null) return false;
          const line = view.state.doc.lineAt(pos).number;
          let diagnostic = null;
          forEachDiagnostic(view.state, (item, from) => {
            if (!diagnostic && view.state.doc.lineAt(from).number === line) {
              diagnostic = item;
            }
          });
          if (!diagnostic) return false;
          event.preventDefault();
          event.stopPropagation();
          const detail = {
            message: diagnostic.message,
            line,
            severity: diagnostic.severity,
          };
          setPinnedDiagnostic(detail);
          onDiagnosticClick?.(detail);
          return true;
        },
      }),
    [onDiagnosticClick],
  );

  const lintExt = useMemo(
    () => createLintExtension(resource.extension, reportDiagnostics, resource.path),
    [resource.extension, resource.path, reportDiagnostics],
  );

  useEffect(() => {
    if (searchTerm && !showSearch) {
      const view = editorViewRef.current;
      if (!view) return;
      view.dispatch({
        effects: setSearchQuery.of(
          new SearchQuery({ search: searchTerm, caseSensitive: false }),
        ),
      });
    }
  }, [searchTerm, showSearch]);

  useEffect(() => {
    goToLineHandledRef.current = false;
  }, [goToLine]);

  const moveToRequestedLine = useCallback((view, lineNumber) => {
    if (!lineNumber || goToLineHandledRef.current || !view) return;
    if (view.state.doc.length === 0) return;

    const targetLine = Math.min(lineNumber, view.state.doc.lines);
    if (targetLine < 1) return;

    goToLineHandledRef.current = true;
    requestAnimationFrame(() => {
      if (editorViewRef.current !== view) return;
      const pos = view.state.doc.line(targetLine).from;
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
      view.focus();
      onGoToLineHandled?.();
    });
  }, [onGoToLineHandled]);

  useEffect(() => {
    moveToRequestedLine(editorViewRef.current, goToLine);
  }, [goToLine, moveToRequestedLine, value]);

  if (!resource?.editable) {
    return (
      <div className="screen-editor-empty">
        Selecciona un recurso de texto para editarlo.
      </div>
    );
  }

  return (
    <div className="screen-resource-editor-wrapper">
      {showSearch ? (
        <SearchBar
          query={searchState.query}
          replaceText={searchState.replaceText}
          matchCase={searchState.matchCase}
          wholeWord={searchState.wholeWord}
          showReplace={showReplace}
          total={searchMetrics.total}
          current={searchMetrics.current}
          selectAllActive={searchMetrics.allSelected}
          inputRef={searchInputRef}
          replaceInputRef={replaceInputRef}
          onQueryChange={(v) => setSearchState((s) => ({ ...s, query: v }))}
          onReplaceTextChange={(v) =>
            setSearchState((s) => ({ ...s, replaceText: v }))
          }
          onToggleReplace={() => setShowReplace((p) => !p)}
          onToggleMatchCase={() =>
            setSearchState((s) => ({ ...s, matchCase: !s.matchCase }))
          }
          onToggleWholeWord={() =>
            setSearchState((s) => ({ ...s, wholeWord: !s.wholeWord }))
          }
          onNext={nextMatch}
          onPrev={prevMatch}
          onReplaceOne={replaceCurrent}
          onReplaceAll={replaceEveryMatch}
          onSelectAll={selectAllOccurrences}
          onClose={() => {
            setShowSearch(false);
            setShowReplace(false);
          }}
          theme={theme === "dark" ? "dark" : "light"}
        />
      ) : null}
      {pinnedDiagnostic ? (
        <div className={`screen-lint-message ${pinnedDiagnostic.severity || "error"}`}>
          <span>{pinnedDiagnostic.message} (línea {pinnedDiagnostic.line})</span>
          <button
            type="button"
            onClick={() => setPinnedDiagnostic(null)}
            title="Cerrar mensaje de error"
          >
            ×
          </button>
        </div>
      ) : null}
      {editorContextMenu ? (
        <div
          className="screen-editor-context-menu"
          style={{ left: editorContextMenu.x, top: editorContextMenu.y }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={() => {
              onFormat?.({ printWidth: getFormatPrintWidth(editorViewRef.current) });
              setEditorContextMenu(null);
            }}
            disabled={!canFormatResource(resource.extension)}
          >
            Formatear
          </button>
          <label className={!canFormatResource(resource.extension) ? "disabled" : ""}>
            <input
              type="checkbox"
              checked={formatOnSave}
              disabled={!canFormatResource(resource.extension)}
              onChange={(event) => {
                onFormatOnSaveChange?.(event.target.checked);
                setEditorContextMenu(null);
              }}
            />
            Formatear al guardar
          </label>
        </div>
      ) : null}
      <CodeMirror
        key={resource.path}
        value={value}
        height="100%"
        theme={theme === "dark" ? evaXmlDark : notepadPlus}
        extensions={[
          languageFor(resource.extension),
          indentUnit.of("  "),
          EditorView.lineWrapping,
          search({ top: false }),
          completionConfig,
          historyNavigationKeymap,
          saveKeymap,
          editorKeymap,
          tabKeymap,
          ctrlClickHandler,
          editorContextMenuHandler,
          ctrlLinkExt,
          colorPreviewPlugin,
          lintMarkerClickHandler,
          lintExt,
          editorStyles,
        ]}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: true,
          autocompletion: false,
          searchKeymap: false,
          highlightSelectionMatches: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          tabSize: 2,
        }}
        onChange={onChange}
        editable={true}
        readOnly={false}
        onCreateEditor={(view) => {
          editorViewRef.current = view;
          formatResizeObserverRef.current?.disconnect();
          publishFormatMetrics(view);
          if (typeof ResizeObserver !== "undefined") {
            formatResizeObserverRef.current = new ResizeObserver(() =>
              publishFormatMetrics(view),
            );
            formatResizeObserverRef.current.observe(view.contentDOM);
          }
          moveToRequestedLine(view, goToLine);
        }}
        className="screen-resource-editor"
      />
    </div>
  );
}
