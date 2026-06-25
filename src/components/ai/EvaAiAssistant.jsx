import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowUp,
  FiCheck,
  FiCode,
  FiCopy,
  FiCpu,
  FiLayers,
  FiLayout,
  FiMessageCircle,
  FiMoreHorizontal,
  FiRefreshCw,
  FiSettings,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { formatScreenResource } from "../screens/ScreenResourceEditor";
import "./evaAi.css";

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content: "Lista. Pregunta directamente qué necesitas revisar o cambiar.",
};

const CONTEXT_OPTIONS = ["XML", "PANTALLAS", "GENERAL"];
const DEFAULT_PANEL_SIZE = { width: 390, height: 560 };

function extensionForCodeBlock(language, code) {
  const normalized = String(language || "").toLowerCase();
  if (["html", "htm"].includes(normalized) || /^\s*</.test(code))
    return ".html";
  if (["css", "scss"].includes(normalized)) return ".css";
  if (["js", "javascript", "jsx", "ts", "typescript"].includes(normalized))
    return ".js";
  return null;
}

async function formatAssistantCodeBlocks(content) {
  const matcher = /```([\w+-]*)\s*\n([\s\S]*?)```/g;
  let result = "";
  let cursor = 0;
  let match;
  while ((match = matcher.exec(content))) {
    result += content.slice(cursor, match.index);
    const extension = extensionForCodeBlock(match[1], match[2]);
    let code = match[2];
    if (extension) {
      try {
        code = await formatScreenResource(code, extension, { printWidth: 100 });
      } catch {
        /* Preserve code when it is intentionally incomplete. */
      }
    }
    result += `\`\`\`${match[1] || ""}\n${code.trim()}\n\`\`\``;
    cursor = matcher.lastIndex;
  }
  return result ? `${result}${content.slice(cursor)}` : content;
}

function renderMarkdownInline(text, keyPrefix) {
  const tokens = [];
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) tokens.push(text.slice(cursor, match.index));
    if (match[2])
      tokens.push(
        <strong key={`${keyPrefix}-b-${match.index}`}>{match[2]}</strong>,
      );
    else if (match[4])
      tokens.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[4]}</em>);
    else if (match[6])
      tokens.push(
        <code
          className="eva-ai-inline-code"
          key={`${keyPrefix}-c-${match.index}`}
        >
          {match[6]}
        </code>,
      );
    cursor = pattern.lastIndex;
  }
  if (cursor < text.length) tokens.push(text.slice(cursor));
  return tokens.length ? tokens : [text];
}

function FormattedText({ text, keyPrefix }) {
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    elements.push(
      <ul className="eva-ai-list" key={`${keyPrefix}-ul-${elements.length}`}>
        {listItems}
      </ul>,
    );
    listItems = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const listMatch = line.match(/^(\s*[-*])\s+(.+)/);
    if (listMatch) {
      listItems.push(
        <li key={`${keyPrefix}-li-${i}`}>
          {renderMarkdownInline(listMatch[2], `${keyPrefix}-${i}`)}
        </li>,
      );
    } else {
      flushList();
      if (line.trim() === "") {
        elements.push(<br key={`${keyPrefix}-br-${i}`} />);
      } else {
        elements.push(
          <span key={`${keyPrefix}-ln-${i}`}>
            {renderMarkdownInline(line, `${keyPrefix}-${i}`)}
            {i < lines.length - 1 ? "\n" : ""}
          </span>,
        );
      }
    }
  }
  flushList();
  return elements;
}

const HIGHLIGHT_RULES = {
  html: [
    { pattern: /(<!--[\s\S]*?-->)/g, cls: "hl-comment" },
    {
      pattern: /(&lt;\/?)([\w-]+)/g,
      replace: (_, br, tag) => `${br}<span class="hl-tag">${tag}</span>`,
    },
    {
      pattern: /\b([\w-]+)(=)/g,
      replace: (_, attr, eq) => `<span class="hl-attr">${attr}</span>${eq}`,
    },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: "hl-string" },
  ],
  css: [
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: "hl-comment" },
    {
      pattern: /([.#]?[\w-]+)(\s*\{)/g,
      replace: (_, sel, br) => `<span class="hl-tag">${sel}</span>${br}`,
    },
    {
      pattern: /([\w-]+)(\s*:)/g,
      replace: (_, prop, colon) =>
        `<span class="hl-attr">${prop}</span>${colon}`,
    },
    { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: "hl-string" },
    { pattern: /(#[0-9a-fA-F]{3,8})\b/g, cls: "hl-number" },
    {
      pattern: /\b(\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?)\b/g,
      cls: "hl-number",
    },
  ],
  js: [
    { pattern: /(\/\/.*$)/gm, cls: "hl-comment" },
    { pattern: /(\/\*[\s\S]*?\*\/)/g, cls: "hl-comment" },
    {
      pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
      cls: "hl-string",
    },
    {
      pattern:
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this|true|false|null|undefined|try|catch|throw|typeof|instanceof)\b/g,
      cls: "hl-keyword",
    },
    { pattern: /\b(\d+(?:\.\d+)?)\b/g, cls: "hl-number" },
  ],
};

function highlightCode(code, language) {
  const lang = String(language || "").toLowerCase();
  const key = ["html", "htm", "xml", "svg"].includes(lang)
    ? "html"
    : ["css", "scss"].includes(lang)
      ? "css"
      : ["js", "javascript", "jsx", "ts", "typescript"].includes(lang)
        ? "js"
        : null;
  if (!key) return null;
  let escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const placeholders = [];
  for (const rule of HIGHLIGHT_RULES[key]) {
    if (rule.cls) {
      escaped = escaped.replace(rule.pattern, (m) => {
        const id = `\x00${placeholders.length}\x00`;
        placeholders.push(`<span class="${rule.cls}">${m}</span>`);
        return id;
      });
    } else if (rule.replace) {
      escaped = escaped.replace(rule.pattern, (...args) => {
        const id = `\x00${placeholders.length}\x00`;
        placeholders.push(rule.replace(...args));
        return id;
      });
    }
  }
  for (let i = 0; i < placeholders.length; i += 1)
    escaped = escaped.replace(`\x00${i}\x00`, placeholders[i]);
  return escaped;
}

function MessageBody({ content, onCopy, copiedCodeId, messageId }) {
  const matcher = /```([\w+-]*)\s*\n([\s\S]*?)```/g;
  const nodes = [];
  let cursor = 0;
  let match;
  let blockIndex = 0;
  while ((match = matcher.exec(content))) {
    if (match.index > cursor)
      nodes.push(
        <span className="eva-ai-message-text" key={`text-${cursor}`}>
          <FormattedText
            text={content.slice(cursor, match.index)}
            keyPrefix={`${messageId}-t${cursor}`}
          />
        </span>,
      );
    const codeId = `${messageId}-${blockIndex++}`;
    const rawCode = match[2];
    const lang = match[1];
    const highlighted = highlightCode(rawCode.trim(), lang);
    nodes.push(
      <section className="eva-ai-code-block" key={codeId}>
        <header>
          <span>{(lang || "código").toUpperCase()}</span>
          <button
            type="button"
            onClick={() => onCopy(rawCode, codeId)}
            title="Copiar código"
          >
            {copiedCodeId === codeId ? <FiCheck /> : <FiCopy />}
          </button>
        </header>
        {highlighted ? (
          <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
        ) : (
          <pre>
            <code>{rawCode.trim()}</code>
          </pre>
        )}
      </section>,
    );
    cursor = matcher.lastIndex;
  }
  if (cursor < content.length || nodes.length === 0)
    nodes.push(
      <span className="eva-ai-message-text" key={`text-${cursor}`}>
        <FormattedText
          text={content.slice(cursor)}
          keyPrefix={`${messageId}-t${cursor}`}
        />
      </span>,
    );
  return nodes;
}

function createXmlOverview(code, name) {
  if (!code) return "No hay XML cargado.";
  try {
    const doc = new DOMParser().parseFromString(code, "text/xml");
    if (doc.querySelector("parsererror"))
      return `XML ${name || "actual"}: contiene un error de sintaxis.`;
    const root = doc.documentElement;
    const counts = new Map();
    [...doc.querySelectorAll("*")].forEach((element) => {
      counts.set(element.tagName, (counts.get(element.tagName) || 0) + 1);
    });
    const primary = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([tag, count]) => `${tag}: ${count}`)
      .join(", ");
    const flowNodes = [
      ...doc.querySelectorAll("State, Screen, Tran, TranMap, Fit, Transition"),
    ]
      .slice(0, 90)
      .map((element) => {
        const id = ["Id", "Code", "Key", "Name", "Screen", "NextState", "State"]
          .map((attribute) => element.getAttribute(attribute))
          .find(Boolean);
        return `${element.tagName}${id ? `(${id})` : ""}`;
      });
    return [
      `Archivo: ${name || "XML actual"}. Raíz: <${root.tagName}>.`,
      `Elementos principales: ${primary || "sin elementos"}.`,
      flowNodes.length
        ? `Nodos de flujo: ${flowNodes.join(", ")}.`
        : "No se detectaron nodos State/Screen/Tran/TranMap/Fit/Transition.",
    ].join("\n");
  } catch {
    return `XML ${name || "actual"}: no se pudo resumir; EVA puede buscar fragmentos concretos.`;
  }
}

function buildContext(mode, xmlContext, screenContext) {
  const normalizedMode = CONTEXT_OPTIONS.includes(mode) ? mode : "XML";
  const context = { mode: normalizedMode };
  if (
    (normalizedMode === "XML" || normalizedMode === "GENERAL") &&
    xmlContext?.code
  ) {
    context.xml = {
      name: xmlContext.name || "XML actual",
      overview: createXmlOverview(xmlContext.code, xmlContext.name),
      content: xmlContext.code,
    };
  }
  if (
    (normalizedMode === "PANTALLAS" || normalizedMode === "GENERAL") &&
    screenContext?.folder
  ) {
    context.screens = {
      folder: screenContext.folder,
      resourceCount: screenContext.resourceCount || 0,
      activePath: screenContext.path || "",
      activeCode: screenContext.code || "",
    };
  }
  return context;
}

const CONTEXT_ICONS = { XML: FiCode, PANTALLAS: FiLayout, GENERAL: FiLayers };

export default function EvaAiAssistant({
  enabled,
  settings,
  xmlContext,
  screenContext,
  chatKey,
  savedChat,
  activeModule,
  onChatChange,
  onChatClear,
  onOpenSettings,
  onOpenResource,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [contextMode, setContextMode] = useState(
    activeModule === "screens" ? "PANTALLAS" : "XML",
  );
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [sending, setSending] = useState(false);
  const [panelSize, setPanelSize] = useState(DEFAULT_PANEL_SIZE);
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const hydratedKeyRef = useRef(null);
  const resizeRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const configured = Boolean(
    settings?.endpoint && settings?.model && settings?.apiKey,
  );
  const selectedContext = useMemo(
    () => buildContext(contextMode, xmlContext, screenContext),
    [contextMode, xmlContext, screenContext],
  );

  useEffect(() => {
    if (!chatKey || hydratedKeyRef.current === chatKey) return;
    hydratedKeyRef.current = chatKey;
    setMessages(
      savedChat?.messages?.length ? savedChat.messages : [WELCOME_MESSAGE],
    );
    setContextMode(
      CONTEXT_OPTIONS.includes(savedChat?.contextMode)
        ? savedChat.contextMode
        : activeModule === "screens"
          ? "PANTALLAS"
          : "XML",
    );
    setOpen(Boolean(savedChat?.open));
    setPanelSize(savedChat?.panelSize || DEFAULT_PANEL_SIZE);
    setInput("");
  }, [activeModule, chatKey, savedChat]);

  useEffect(() => {
    if (!chatKey || hydratedKeyRef.current !== chatKey || sending) return;
    onChatChange?.(chatKey, {
      messages: messages.slice(-12),
      contextMode,
      open,
      panelSize,
    });
  }, [chatKey, contextMode, messages, onChatChange, open, panelSize, sending]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  useEffect(() => {
    const stopResize = () => {
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const moveResize = (event) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const maxWidth = Math.min(720, Math.max(340, window.innerWidth - 32));
      const maxHeight = Math.min(760, Math.max(360, window.innerHeight - 98));
      setPanelSize({
        width: resize.axis.includes("x")
          ? Math.max(
              340,
              Math.min(maxWidth, resize.width - (event.clientX - resize.x)),
            )
          : resize.width,
        height: resize.axis.includes("y")
          ? Math.max(
              360,
              Math.min(maxHeight, resize.height - (event.clientY - resize.y)),
            )
          : resize.height,
      });
    };
    window.addEventListener("pointermove", moveResize);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", stopResize);
    return () => {
      window.removeEventListener("pointermove", moveResize);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      window.removeEventListener("blur", stopResize);
    };
  }, []);

  if (!enabled || !chatKey) return null;

  const conversationCount = messages.filter((m) => m.id !== "welcome").length;
  const contextLong = conversationCount >= 20;

  const sendMessage = async (overrideContent) => {
    const content = (overrideContent || input).trim();
    if (!content || sending) return;
    if (!configured) {
      setOpen(true);
      onOpenSettings?.();
      return;
    }

    const userMessage = { id: crypto.randomUUID(), role: "user", content };
    let nextMessages = [...messages, userMessage];
    if (nextMessages.filter((m) => m.id !== "welcome").length > 10) {
      nextMessages = [
        WELCOME_MESSAGE,
        ...nextMessages.filter((m) => m.id !== "welcome").slice(-6),
      ];
    }
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    const result = await window.electronAPI?.chatWithEvaAi?.({
      messages: nextMessages
        .filter((message) => message.id !== "welcome")
        .map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
      context: selectedContext,
    });
    const answer = result?.success
      ? await formatAssistantCodeBlocks(result.content)
      : result?.error || "No se pudo conectar con EVA.";
    setSending(false);
    setMessages((current) => [
      ...current,
      result?.success
        ? {
            id: crypto.randomUUID(),
            role: "assistant",
            content: answer,
            stats: result.stats,
          }
        : {
            id: crypto.randomUUID(),
            role: "assistant",
            error: true,
            content: answer,
          },
    ]);
    if (result?.actions?.length) {
      for (const action of result.actions) {
        if (action.type === "open_resource") onOpenResource?.(action.path);
      }
    }
  };

  const resetChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setContextMode(activeModule === "screens" ? "PANTALLAS" : "XML");
    setPanelSize(DEFAULT_PANEL_SIZE);
    setCopiedCodeId(null);
    onChatClear?.(chatKey);
  };

  const startResize = (event, axis) => {
    if (event.button !== 0) return;
    resizeRef.current = {
      axis,
      x: event.clientX,
      y: event.clientY,
      ...panelSize,
    };
    document.body.style.cursor =
      axis === "x" ? "ew-resize" : axis === "y" ? "ns-resize" : "nwse-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const copyCode = async (code, codeId) => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopiedCodeId(codeId);
      setTimeout(
        () =>
          setCopiedCodeId((current) => (current === codeId ? null : current)),
        1300,
      );
    } catch {
      setCopiedCodeId(null);
    }
  };

  return (
    <div className={`eva-ai ${open ? "is-open" : ""}`}>
      {open ? (
        <section
          className="eva-ai-panel"
          aria-label="EVA"
          style={{ width: panelSize.width, height: panelSize.height }}
        >
          <div
            className="eva-ai-resize-handle horizontal"
            onPointerDown={(event) => startResize(event, "x")}
            onDoubleClick={() => setPanelSize(DEFAULT_PANEL_SIZE)}
            title="Arrastra para cambiar el ancho; doble clic para restaurar"
          />
          <div
            className="eva-ai-resize-handle vertical"
            onPointerDown={(event) => startResize(event, "y")}
            onDoubleClick={() => setPanelSize(DEFAULT_PANEL_SIZE)}
            title="Arrastra para cambiar el alto; doble clic para restaurar"
          />
          <div
            className="eva-ai-resize-handle diagonal"
            onPointerDown={(event) => startResize(event, "xy")}
            onDoubleClick={() => setPanelSize(DEFAULT_PANEL_SIZE)}
            title="Arrastra para cambiar el tamaño; doble clic para restaurar"
          />
          <header
            className="eva-ai-header"
            onDoubleClick={() => setPanelSize(DEFAULT_PANEL_SIZE)}
            title="Doble clic para restaurar el tamaño"
          >
            <div className="eva-ai-title">
              <span className="eva-ai-title-icon">
                <FiCpu />
              </span>
              <div>
                <strong>EVA</strong>
                <small>{configured ? settings.model : "Sin conexión"}</small>
              </div>
            </div>
            <div className="eva-ai-header-actions">
              <button
                type="button"
                onClick={() => {
                  const text = messages
                    .filter((m) => m.id !== "welcome")
                    .map(
                      (m) =>
                        `[${m.role === "user" ? "Tú" : "EVA"}]\n${m.content}`,
                    )
                    .join("\n\n");
                  if (text) copyCode(text, "full-chat");
                }}
                title="Copiar conversación"
              >
                {copiedCodeId === "full-chat" ? <FiCheck /> : <FiCopy />}
              </button>
              {/* <button type="button" onClick={resetChat} title="Nuevo chat">
                <FiRefreshCw />
              </button> */}
              <button
                type="button"
                onClick={onOpenSettings}
                title="Configurar EVA"
              >
                <FiSettings />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Cerrar EVA"
              >
                <FiX />
              </button>
            </div>
          </header>

          <div className="eva-ai-context-row">
            <div className="eva-ai-context-pills">
              {CONTEXT_OPTIONS.map((opt) => {
                const Icon = CONTEXT_ICONS[opt];
                const disabled =
                  opt === "XML"
                    ? !xmlContext?.code
                    : opt === "PANTALLAS"
                      ? !screenContext?.folder
                      : !xmlContext?.code && !screenContext?.folder;
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`eva-ai-context-pill ${contextMode === opt ? "active" : ""}`}
                    disabled={disabled}
                    onClick={() => setContextMode(opt)}
                  >
                    <Icon />
                    {opt}
                  </button>
                );
              })}
            </div>
            {(contextMode === "PANTALLAS" || contextMode === "GENERAL") &&
            screenContext?.path ? (
              <span
                className="eva-ai-active-resource"
                title={screenContext.path}
              >
                {screenContext.path.split("/").pop()}
              </span>
            ) : contextMode === "XML" && xmlContext?.name ? (
              <span className="eva-ai-active-resource" title={xmlContext.name}>
                {xmlContext.name}
              </span>
            ) : null}
          </div>

          <div className="eva-ai-messages" ref={listRef} aria-live="polite">
            {!configured ? (
              <div className="eva-ai-setup-card">
                <FiSettings />
                <div>
                  <strong>Conecta EVA</strong>
                  <p>Indica el modelo Gemini y tu clave para empezar.</p>
                </div>
                <button type="button" onClick={onOpenSettings}>
                  Configurar
                </button>
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                className={`eva-ai-message ${message.role} ${message.error ? "error" : ""}`}
                key={message.id}
              >
                {message.role === "assistant" ? <FiCpu /> : null}
                <div className="eva-ai-message-content">
                  <MessageBody
                    content={message.content}
                    onCopy={copyCode}
                    copiedCodeId={copiedCodeId}
                    messageId={message.id}
                  />
                  {message.id !== "welcome" ? (
                    <button
                      type="button"
                      className="eva-ai-copy-message"
                      onClick={() =>
                        copyCode(message.content, `msg-${message.id}`)
                      }
                      title="Copiar mensaje"
                    >
                      {copiedCodeId === `msg-${message.id}` ? (
                        <FiCheck />
                      ) : (
                        <FiCopy />
                      )}
                    </button>
                  ) : null}
                  {message.stats ? (
                    <span className="eva-ai-msg-stats">
                      {(message.stats.ms / 1000).toFixed(1)}s ·{" "}
                      {message.stats.tokensIn + message.stats.tokensOut} tok
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {sending ? (
              <div className="eva-ai-thinking">
                <FiMoreHorizontal /> Pensando
              </div>
            ) : null}
          </div>

          <footer className="eva-ai-composer">
            {contextLong ? (
              <button
                type="button"
                className="eva-ai-context-warn"
                onClick={resetChat}
              >
                {conversationCount} mensajes — Reiniciar chat
              </button>
            ) : null}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Pregunta a EVA..."
              rows={2}
            />
            <div className="eva-ai-composer-actions">
              <button
                type="button"
                className="eva-ai-clear"
                onClick={resetChat}
                title="Nuevo chat"
              >
                <FiRefreshCw />
              </button>
              <span></span>
              <button
                type="button"
                className="eva-ai-send"
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                title={configured ? "Enviar" : "Configurar EVA"}
              >
                <FiArrowUp />
              </button>
            </div>
          </footer>
        </section>
      ) : null}
      <button
        type="button"
        className="eva-ai-fab"
        onClick={() => setOpen((current) => !current)}
        title="Abrir EVA"
        aria-label="Abrir EVA"
      >
        <FiMessageCircle />
      </button>
    </div>
  );
}
