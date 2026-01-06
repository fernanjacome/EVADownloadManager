import { useEffect, useRef } from "react";

export function useAppPersistence({
    enabledRef,
    load,
    buildState,
    debounceMs = 500,
}) {
    const lastStateRef = useRef(null);
    const saveTimeoutRef = useRef(null);

    // =====================
    // LOAD
    // =====================
    useEffect(() => {
        if (!load) return;

        (async () => {
            const loadedState = await load();
            lastStateRef.current = loadedState;
            enabledRef.current = true;
        })();
    }, []);

    // =====================
    // SNAPSHOT UPDATE
    // =====================
    useEffect(() => {
        if (!enabledRef.current) return;
        lastStateRef.current = buildState();
    });

    // =====================
    // DEBOUNCED SAVE
    // =====================
    useEffect(() => {
        if (!enabledRef.current) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            const state = lastStateRef.current;
            if (!state) return;

            if (window.electronAPI?.saveAppState) {
                window.electronAPI.saveAppState(state);
            } else {
                localStorage.setItem(
                    "app_state_fallback",
                    JSON.stringify(state)
                );
            }

            saveTimeoutRef.current = null;
        }, debounceMs);
    });
}
