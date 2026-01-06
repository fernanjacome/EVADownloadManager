import { useEffect, useRef } from "react";

export function useSnowEffect(enabled) {
    const audioRef = useRef(null);

    // 🎄 audio
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio("navidad.mp3");
            audioRef.current.loop = true;
            audioRef.current.volume = 0.05;
        }

        if (enabled) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => { });
        } else {
            audioRef.current.pause();
        }
    }, [enabled]);

    // ❄️ canvas + body class
    useEffect(() => {
        document.body.classList.toggle("xmas-lights-active", enabled);

        const existing = document.getElementById("snow-canvas");
        if (existing) existing.remove();

        if (!enabled) return;

        const snow = document.createElement("canvas");
        snow.id = "snow-canvas";
        document.body.appendChild(snow);

        const ctx = snow.getContext("2d");
        let w = (snow.width = window.innerWidth);
        let h = (snow.height = window.innerHeight);

        const onResize = () => {
            w = snow.width = window.innerWidth;
            h = snow.height = window.innerHeight;
        };

        window.addEventListener("resize", onResize);

        const flakes = Array.from({ length: 90 }).map(() => ({
            x: Math.random() * w,
            y: Math.random() * -h,
            r: Math.random() * 3 + 1.5,
            d: Math.random() * 1.5 + 0.5,
            drift: Math.random() * 0.8 - 0.4,
            phase: Math.random() * Math.PI * 2,
            opacity: Math.random() * 0.5 + 0.4,
        }));

        const drawSnowflake = (x, y, r, alpha) => {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = "#4AD6B3";
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (let i = 0; i < 6; i++) {
                ctx.moveTo(x, y);
                ctx.lineTo(
                    x + r * Math.cos((i * Math.PI) / 3),
                    y + r * Math.sin((i * Math.PI) / 3)
                );
            }

            ctx.stroke();
            ctx.restore();
        };

        const move = () => {
            flakes.forEach((f) => {
                f.y += f.d;
                f.phase += 0.01;
                f.x += Math.sin(f.phase) * 0.3 + f.drift;

                if (f.y > h) {
                    f.y = Math.random() * -100;
                    f.x = Math.random() * w;
                }
                if (f.x > w) f.x = 0;
                if (f.x < 0) f.x = w;
            });
        };

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            flakes.forEach((f) =>
                drawSnowflake(f.x, f.y, f.r, f.opacity)
            );
            move();
            requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener("resize", onResize);
            snow.remove();
        };
    }, [enabled]);
}
