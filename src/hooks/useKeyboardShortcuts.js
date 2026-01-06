import { useEffect } from "react";

export function useKeyboardShortcuts() {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Bloquear zoom del navegador / electron
            if (
                (e.ctrlKey || e.metaKey) &&
                (e.key === "+" ||
                    e.key === "-" ||
                    e.key === "=" ||
                    e.key === "0")
            ) {
                e.preventDefault();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);
}
