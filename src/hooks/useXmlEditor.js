import { useState, useMemo } from "react";
import { serializeXML, validateUniqueIds } from "../utils/xmlUtils";

export function useXmlEditor({ notify }) {
    const [xmlDoc, setXmlDoc] = useState(null);
    const [code, setCode] = useState("");
    const [savedCode, setSavedCode] = useState("");
    const [originalCode, setOriginalCode] = useState("");
    const [filePath, setFilePath] = useState(null);
    const [fileInfo, setFileInfo] = useState(null);
    const [title, setTitle] = useState("");

    const dirty = useMemo(() => code !== savedCode, [code, savedCode]);

    /* =========================
       Helpers
    ========================== */
    const updateWindowTitle = (name = "") => {
        if (window.electronAPI?.setWindowTitle) {
            window.electronAPI.setWindowTitle(
                name ? `${name} - EVA Studio 2026` : "EVA Studio 2026"
            );
        }
    };

    const hydrate = (state) => {
        if (!state) return;

        setCode(state.code || "");
        setSavedCode(state.savedCode || "");
        setOriginalCode(state.originalCode || "");
        setFilePath(state.filePath || null);
        setFileInfo(state.fileInfo || null);
        setTitle(state.title || "");

        if (state.code) {
            try {
                const doc = new DOMParser().parseFromString(state.code, "text/xml");
                setXmlDoc(doc);
            } catch {
                setXmlDoc(null);
            }
        }

        updateWindowTitle(state.title);
    };

    const getPersistableState = () => ({
        code,
        savedCode,
        originalCode,
        filePath,
        fileInfo,
        title,
    });

    /* =========================
       Core XML Logic
    ========================== */
    const loadXml = (doc, file = null) => {
        const errors = validateUniqueIds(doc);
        if (errors.length) {
            notify("error", "IDs duplicados:\n" + errors.join("\n"));
            return false;
        }

        const serialized = serializeXML(doc);
        setXmlDoc(doc);
        setCode(serialized);
        setOriginalCode(serialized);
        setSavedCode(serialized);

        if (file) {
            setFilePath(file.path || null);
            setFileInfo({
                name: file.name,
                size: (file.size / 1024).toFixed(1) + " KB",
                lastModified: new Date(file.lastModified).toLocaleString(),
            });
            setTitle(file.name.replace(/\.[^/.]+$/, ""));
            updateWindowTitle(file.name);
        }

        notify("success", "XML cargado correctamente.");
        return true;
    };

    /* =========================
       New XML
    ========================== */
    const newXml = async () => {
        try {
            const url = new URL("../../public/default.xml", import.meta.url).pathname;
            const text = await fetch(`file://${url}`).then((r) => r.text());

            const doc = new DOMParser().parseFromString(text, "text/xml");
            loadXml(doc, {
                name: "default.xml",
                size: text.length,
                lastModified: Date.now(),
            });
        } catch {
            notify("error", "No se pudo crear el XML base.");
        }
    };

    /* =========================
       Open / Save
    ========================== */
    const openFile = async () => {
        const path = await window.electronAPI.openFileDialog();
        if (!path) return;

        const info = await window.electronAPI.getFileInfo(path);
        const res = await window.electronAPI.readFile(path);
        if (!res.success) return notify("error", "No se pudo leer el archivo");

        const doc = new DOMParser().parseFromString(res.data, "text/xml");
        loadXml(doc, {
            name: path.split("\\").pop(),
            size: info.info.size,
            lastModified: info.info.lastModified,
            path,
        });
    };

    const saveXml = async () => {
        const doc = new DOMParser().parseFromString(code, "text/xml");
        if (doc.getElementsByTagName("parsererror")[0]) {
            notify("error", "XML inválido");
            return false;
        }

        const errors = validateUniqueIds(doc);
        if (errors.length) {
            notify("error", "IDs duplicados:\n" + errors.join("\n"));
            return false;
        }

        let path = filePath;

        const info = await window.electronAPI.getFileInfo(path);
        if (!path) {
            path = await window.electronAPI.showSaveDialog({
                defaultPath: "archivo.xml",
                filters: [{ name: "XML", extensions: ["xml"] }],
            });
            if (!path) return false;
            setFilePath(path);
        }

        const res = await window.electronAPI.writeFile(path, code);
        if (!res.success) {
            notify("error", res.error);
            return false;
        }

        setSavedCode(code);
        setXmlDoc(doc);
        setFileInfo({
            name: path.split("\\").pop(),
            size: (info.info.size / 1024).toFixed(1) + " KB",
            lastModified: new Date(info.info.lastModified).toLocaleString(),
        });
        setTitle(path.split("\\").pop().replace(/\.[^/.]+$/, ""));

        updateWindowTitle(path.split("\\").pop());
        notify("success", "Archivo guardado correctamente");
        return true;
    };

    /* =========================
       Drag & Drop
    ========================== */
    const handleFileDrop = async (file) => {
        if (!file?.path) return;

        const info = await window.electronAPI.getFileInfo(file.path);
        const res = await window.electronAPI.readFile(file.path);
        if (!res.success) return;

        const doc = new DOMParser().parseFromString(res.data, "text/xml");
        loadXml(doc, {
            name: file.path.split("\\").pop(),
            size: info.info.size,
            lastModified: info.info.lastModified,
            path: file.path,
        });
    };

    const reset = () => {
        setXmlDoc(null);
        setCode("");
        setSavedCode("");
        setOriginalCode("");
        setFilePath(null);
        setFileInfo(null);
        setTitle("");
        updateWindowTitle();
    };

    return {
        xmlDoc,
        code,
        setCode,
        dirty,
        fileInfo,
        filePath,
        title,
        openFile,
        saveXml,
        restoreOriginal: () => {
            setCode(originalCode);
            setXmlDoc(new DOMParser().parseFromString(originalCode, "text/xml"));
            notify("info", "Restaurado al original");
        },
        reset,
        hydrate,
        getPersistableState,
        newXml,
        handleFileDrop,
    };
}
