# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EVA Studio 2026** is an Electron + React desktop application for managing and editing XML configuration files for integrated point-of-sale systems (EVA). It provides a CodeMirror-based XML editor with a module system for code editing, screen previewing, compiler output, remote VNC, and flow visualization.

## Commands

```bash
npm run dev              # Vite dev server only (browser at :5173, no Electron)
npm run electron:dev     # Full app: Vite + Electron (use this for development)
npm run build            # Vite production build → dist/
npm run electron:build   # Full package → release/*.exe (NSIS installer)
npx eslint src/ --fix    # Lint and auto-fix
```

No test suite exists — validation is manual.

## Architecture

### Process Boundary

The app uses Electron's context isolation strictly. The renderer has **no Node.js access** — all file I/O, shell execution, and system calls go through IPC:

- **`electron/preload.cjs`** — exposes `window.electronAPI` (15+ methods) via `contextBridge`
- **`electron/main.js`** — IPC handlers, BrowserWindow management, Express static server for Screens module, workspace session persistence
- All IPC calls return `{ success: boolean, data?, error? }`

### State & Persistence (Two Layers)

1. **App UI state** (`useAppPersistence.js` + IPC): theme, sidebar width, view mode, editor view positions, module visibility → saved to `%APPDATA%/eva-download-manager/workspace-session.json` per window (debounced 220ms)
2. **Window geometry** (Electron main): bounds, maximized state → same JSON file, different key

State lives in `App.jsx` as 20+ `useState` hooks with a `DEFAULT_STATE` shape. State is passed down as props — no context/Redux/Zustand.

### XML Document Model

Central hook: `src/hooks/useXmlEditor.js`

Flow: load file → DOMParser → validate (unique IDs, well-formed) → serialize to string → CodeMirror edits string → validate on save → write via IPC.

Re-parses the full XML DOM on each relevant operation (no fine-grained diffing). Validation checks for duplicate IDs across all sections defined in `src/utils/sidebarConfig.js`.

### Module System

`viewMode` state in `App.jsx` switches between `"code"` | `"screens"` | `"compiler"` | `"remote"` | `"flows"`. The `visibleModules` object controls which tabs are shown. Each module is an independent panel component under `src/components/`.

### Sidebar ↔ Editor Navigation

Sidebar (`src/components/layout/Sidebar/`) parses the XML DOM using section schemas from `sidebarConfig.js` (States, Screens, Fits, Transactions, TranMaps, Errors). Clicking a sidebar item triggers a regex search in the CodeMirror content to find the element's line, then scrolls + positions the cursor. Search is real-time filtered client-side.

### Split View

Two CodeMirror instances share the same code string but maintain independent `EditorView` (view state/scroll position). The `activeEditor` flag determines which editor receives sidebar navigation.

### Flows Module

`src/components/flows/FlowsPanel.jsx` renders a canvas-based diagram of States and their Transitions extracted from the XML. Supports PNG export via `html-to-image`. Known issues: zoom blur, CPU cost of node animations.

## Key Files

| File | Role |
|------|------|
| `electron/main.js` | Main process: IPC, window, Express server, session |
| `electron/preload.cjs` | IPC bridge (`window.electronAPI`) |
| `src/App.jsx` | Root: all global state, module routing |
| `src/hooks/useXmlEditor.js` | XML CRUD, parse, validate, serialize |
| `src/hooks/useAppPersistence.js` | Load/save UI state via IPC |
| `src/utils/xmlUtils.js` | Parse, validate, format, extract helpers |
| `src/utils/sidebarConfig.js` | Schema definitions for sidebar sections |
| `src/components/layout/TitleBar/` | Menu bar, window controls, all modal dialogs |
| `public/default.xml` | Template used when creating a new XML file |

## Conventions

- **Plain JavaScript** (no TypeScript)
- **CSS**: per-component `.css` files, no Tailwind or CSS-in-JS
- **No comments** unless the WHY is non-obvious
- ESLint rule `no-unused-vars` uses a capital-letter regex bypass for intentionally unused vars
- Commit messages follow: `[NEW] V1.x.x Description` for releases
- Language: UI strings and comments are in Spanish; code identifiers in English

## Known TODOs (from `src/TODO.txt`)

- Rename "EVADownloadManager" references to "EVA Studio 2026"
- Improve snippet UX (tab navigation, preview)
- Fix zoom blur in Flows module
- Center screen list on selected screen in Screens module
- Fullscreen button for Remote module
- Keyboard input isolation for VNC viewer when focused
