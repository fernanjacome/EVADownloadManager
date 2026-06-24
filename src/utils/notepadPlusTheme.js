import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

export const notepadPlusTheme = EditorView.theme(
    {
        "&": {
            color: "#000",
            backgroundColor: "#ffffff",
            fontFamily: "Consolas, 'Courier New', monospace",
            height: "100%",
        },

        ".cm-content": {
            caretColor: "#000",
        },

        // 🔹 Cursor
        "&.cm-focused .cm-cursor": {
            borderLeftColor: "#000",
        },

        // 🔹 Selección tipo Notepad++
        ".cm-selectionBackground": {
            backgroundColor: "#cce3ff !important",
        },
        "&.cm-focused .cm-selectionBackground": {
            backgroundColor: "#cce3ff !important",
        },
        "&.cm-focused ::selection": {
            backgroundColor: "#cce3ff !important",
        },

        // 🔹 Gutter (líneas)
        ".cm-gutters": {
            backgroundColor: "#f0f0f0",
            color: "#888",
            borderRight: "1px solid #ccc",
        },

        // 🔹 Línea activa
        ".cm-activeLine": {
            backgroundColor: "#f7f7f7",
        },
    },
    { dark: false }
);

// 🎨 Colores de sintaxis estilo Notepad++
export const notepadPlusHighlightStyle = HighlightStyle.define([
    { tag: t.tagName, color: "#0000ff" },
    { tag: t.attributeName, color: "#ff0000" },
    { tag: t.attributeValue, color: "#008080" },
    { tag: t.string, color: "#008080" },
    { tag: t.comment, color: "#008000", fontStyle: "italic" },
    { tag: t.number, color: "#098658" },
    { tag: t.keyword, color: "#0000ff" },
    { tag: t.operator, color: "#000" },
    { tag: t.angleBracket, color: "#808080" },
    { tag: [t.null, t.variableName, t.invalid, t.meta], color: "#333333" },
    { tag: t.propertyName, color: "#d32f2f" },
    { tag: t.className, color: "#795548" },
    { tag: t.typeName, color: "#0000ff" },
    { tag: t.color, color: "#098658" },
    { tag: t.unit, color: "#098658" },
    { tag: t.function(t.variableName), color: "#6f42c1" },
    { tag: t.punctuation, color: "#808080" },
    { tag: t.definition(t.propertyName), color: "#6f42c1" },
    { tag: [t.atom, t.bool], color: "#0000ff" },
]);

export const notepadPlus = [
    notepadPlusTheme,
    syntaxHighlighting(notepadPlusHighlightStyle),
];

export const evaXmlDarkTheme = EditorView.theme(
    {
        "&": {
            color: "#dce6e2",
            backgroundColor: "#161c1b",
            fontFamily: "Consolas, 'Courier New', monospace",
            height: "100%",
        },

        ".cm-content": {
            caretColor: "#bde7d7",
        },

        "&.cm-focused .cm-cursor": {
            borderLeftColor: "#bde7d7",
        },

        ".cm-selectionBackground": {
            backgroundColor: "rgba(0, 200, 150, 0.18) !important",
        },
        "&.cm-focused .cm-selectionBackground": {
            backgroundColor: "rgba(0, 200, 150, 0.24) !important",
        },
        "&.cm-focused ::selection": {
            backgroundColor: "rgba(0, 200, 150, 0.24) !important",
        },

        ".cm-gutters": {
            backgroundColor: "#1b2322",
            color: "#7f918c",
            borderRight: "1px solid #2d3836",
        },

        ".cm-activeLine": {
            backgroundColor: "rgba(0, 200, 150, 0.07)",
        },

        ".cm-activeLineGutter": {
            backgroundColor: "#1b2322",
        },
    },
    { dark: true }
);

export const evaXmlDarkHighlightStyle = HighlightStyle.define([
    { tag: t.tagName, color: "#77d7b4" },
    { tag: t.attributeName, color: "#cfe37f" },
    { tag: [t.attributeValue, t.string], color: "#d9b980" },
    { tag: t.comment, color: "#6e857e", fontStyle: "italic" },
    { tag: t.number, color: "#9bcfbc" },
    { tag: t.keyword, color: "#7fd0aa" },
    { tag: t.operator, color: "#dce6e2" },
    { tag: t.angleBracket, color: "#7b8d88" },
    { tag: [t.null, t.variableName, t.invalid, t.meta], color: "#c9d5d1" },
    { tag: t.propertyName, color: "#9cdcfe" },
    { tag: t.className, color: "#d7ba7d" },
    { tag: t.typeName, color: "#4ec9b0" },
    { tag: t.color, color: "#ce9178" },
    { tag: t.unit, color: "#b5cea8" },
    { tag: t.function(t.variableName), color: "#dcdcaa" },
    { tag: t.punctuation, color: "#7b8d88" },
    { tag: t.definition(t.propertyName), color: "#dcdcaa" },
    { tag: [t.atom, t.bool], color: "#569cd6" },
]);

export const evaXmlDark = [
    evaXmlDarkTheme,
    syntaxHighlighting(evaXmlDarkHighlightStyle),
];
