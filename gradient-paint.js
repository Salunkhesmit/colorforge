/* ColorForge — shared canvas painter.
   Supports linear / radial (circle|ellipse at cx,cy) / conic (from angle at cx,cy),
   plus hard stops (adjacent stops sharing a position). */
(function () {
    const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

    window.paintGradient = function (ctx, w, h, state) {
        if (!ctx || !state || !Array.isArray(state.stops) || state.stops.length < 2) return;

        const stops = [...state.stops].sort((a, b) => a.p - b.p);
        const cx = ((state.cx ?? 50) / 100) * w;
        const cy = ((state.cy ?? 50) / 100) * h;
        const isEllipse = state.type === "radial" && state.shape === "ellipse";

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        if (isEllipse) {
            // Render a circular gradient into a transformed space so it looks elliptical.
            ctx.translate(cx, cy);
            const maxDim = Math.max(w, h);
            const sx = w / maxDim;
            const sy = h / maxDim;
            ctx.scale(sx, sy);
            const r = maxDim / 2;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            stops.forEach((s) => g.addColorStop(clamp01(s.p / 100), s.c));
            ctx.fillStyle = g;
            ctx.fillRect(-cx / sx, -cy / sy, w / sx, h / sy);
            ctx.restore();
            return;
        }

        let grad;
        if (state.type === "radial") {
            const r = Math.hypot(w, h) / 2;
            grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        } else if (state.type === "conic") {
            const start = (((state.angle ?? 0) - 90) * Math.PI) / 180;
            grad = ctx.createConicGradient(start, cx, cy);
        } else {
            const a = (((state.angle ?? 90) % 360) * Math.PI) / 180;
            const dx = Math.sin(a);
            const dy = -Math.cos(a);
            const len = Math.abs(w * dx) + Math.abs(h * dy);
            grad = ctx.createLinearGradient(
                w / 2 - (dx * len) / 2,
                h / 2 - (dy * len) / 2,
                w / 2 + (dx * len) / 2,
                h / 2 + (dy * len) / 2
            );
        }

        stops.forEach((s) => grad.addColorStop(clamp01(s.p / 100), s.c));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    };
})();