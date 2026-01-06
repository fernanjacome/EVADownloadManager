// hooks/useSidebarResize.js
import { useEffect, useRef } from "react";

export function useSidebarResize(setWidth, { min = 160, max = 500 } = {}) {
    const isResizingRef = useRef(false);

    useEffect(() => {
        const onMove = (e) => {
            if (!isResizingRef.current) return;
            setWidth(Math.min(max, Math.max(min, e.clientX)));
        };

        const onUp = () => {
            isResizingRef.current = false;
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [setWidth, min, max]);

    return {
        startResize: () => (isResizingRef.current = true),
    };
}
