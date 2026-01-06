import { useEffect } from "react";

// hooks/usePreventZoom.js
export function usePreventZoom() {
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) {
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);
}
