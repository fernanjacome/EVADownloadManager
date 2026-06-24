import { useEffect, useRef } from "react";

export function useAppPersistence({
    enabledRef,
    pauseSaveRef,
    load,
    state,
    debounceMs = 500,
    onLoaded,
}) {
    const lastStateRef = useRef(null);
    const lastSerializedRef = useRef("");
    const saveTimeoutRef = useRef(null);

    const flushSave = () => {
        const state = lastStateRef.current;
        if (!state) return;

        if (window.electronAPI?.saveAppStateSync) {
            window.electronAPI.saveAppStateSync(state);
        } else if (window.electronAPI?.saveAppState) {
            window.electronAPI.saveAppState(state);
        } else {
            localStorage.setItem(
                "app_state_fallback",
                JSON.stringify(state)
            );
        }
    };

    // =====================
    // LOAD
    // =====================
    useEffect(() => {
        if (!load) return;

        (async () => {
            const loadedState = await load();
            lastStateRef.current = loadedState;
            lastSerializedRef.current = JSON.stringify(loadedState ?? null);
            enabledRef.current = true;
            onLoaded?.(loadedState);
        })();
    }, []);

    useEffect(() => {
        if (!enabledRef.current) return;
        if (state == null) return;

        const serializedState = JSON.stringify(state);
        if (serializedState === lastSerializedRef.current) {
            return;
        }

        lastStateRef.current = state;
        lastSerializedRef.current = serializedState;

        if (pauseSaveRef?.current) {
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            flushSave();
            saveTimeoutRef.current = null;
        }, debounceMs);
    }, [state, debounceMs]);

    useEffect(() => {
        const handleFlush = () => {
            if (!enabledRef.current) return;
            if (pauseSaveRef?.current) return;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }

            if (state != null) {
                lastStateRef.current = state;
                lastSerializedRef.current = JSON.stringify(state);
            }

            flushSave();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                handleFlush();
            }
        };

        window.addEventListener("beforeunload", handleFlush);
        window.addEventListener("pagehide", handleFlush);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("beforeunload", handleFlush);
            window.removeEventListener("pagehide", handleFlush);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            handleFlush();
        };
    }, [state]);
}
