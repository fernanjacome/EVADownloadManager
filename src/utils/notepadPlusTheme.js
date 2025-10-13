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
    { tag: t.tagName, color: "#0000ff" }, // etiquetas
    { tag: t.attributeName, color: "#ff0000" }, // atributos
    { tag: t.attributeValue, color: "#008080" }, // valores
    { tag: t.string, color: "#008080" },
    { tag: t.comment, color: "#008000", fontStyle: "italic" },
    { tag: t.number, color: "#098658" },
    { tag: t.keyword, color: "#0000ff" },
    { tag: t.operator, color: "#000" },
    { tag: t.angleBracket, color: "#808080" },
    { tag: [t.null, t.variableName, t.invalid, t.meta], color: "#333333" },
]);

export const notepadPlus = [
    notepadPlusTheme,
    syntaxHighlighting(notepadPlusHighlightStyle),
];
