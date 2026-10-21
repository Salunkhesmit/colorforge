/* ColorForge — local color & prompt utilities.
   All algorithms run in-browser. No external API, no keys, no cost. */
(function () {
    /* ---------- conversions ---------- */
    const hexToRgb = (h) => {
        const n = h.replace("#", "");
        const f = n.length === 3 ? n.split("").map((x) => x + x).join("") : n;
        return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
    };
    const rgbToHex = ([r, g, b]) =>
        "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

    const rgbToHsl = ([r, g, b]) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return [h * 360, s * 100, l * 100];
    };

    const hslToRgb = ([h, s, l]) => {
        h = ((h % 360) + 360) % 360 / 360;
        s /= 100; l /= 100;
        const hue = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        if (s === 0) { const v = l * 255; return [v, v, v]; }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [
            hue(p, q, h + 1 / 3) * 255,
            hue(p, q, h) * 255,
            hue(p, q, h - 1 / 3) * 255,
        ];
    };

    const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));
    const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

    const rotate = (hex, deg) => {
        const [h, s, l] = hexToHsl(hex);
        return hslToHex([h + deg, s, l]);
    };

    /* ---------- harmony ---------- */
    function harmony(hex, type) {
        switch (type) {
            case "complementary": return [hex, rotate(hex, 180)];
            case "analogous":     return [rotate(hex, -30), hex, rotate(hex, 30)];
            case "triadic":       return [hex, rotate(hex, 120), rotate(hex, 240)];
            case "split":         return [hex, rotate(hex, 150), rotate(hex, 210)];
            case "tetradic":      return [hex, rotate(hex, 90), rotate(hex, 180), rotate(hex, 270)];
            case "monochromatic": {
                const [h, s, l] = hexToHsl(hex);
                return [
                    hslToHex([h, s, Math.max(15, l - 25)]),
                    hex,
                    hslToHex([h, s, Math.min(85, l + 25)]),
                ];
            }
            default: return [hex];
        }
    }

    /* ---------- prompt library (keyword → gradient) ---------- */
    const PROMPTS = [
        { keys: ["sunset", "dusk", "evening", "golden hour", "warm sky"],
          g: { type: "linear", angle: 90, stops: ["#ff7e5f", "#feb47b", "#ff9966"] } },
        { keys: ["sunrise", "dawn", "morning"],
          g: { type: "linear", angle: 90, stops: ["#ff9966", "#ff5e62", "#ffb88c"] } },
        { keys: ["ocean", "sea", "water", "wave", "underwater", "deep blue"],
          g: { type: "linear", angle: 180, stops: ["#2E3192", "#1BFFFF"] } },
        { keys: ["cyberpunk", "neon", "synthwave", "vaporwave", "tech", "futuristic"],
          g: { type: "linear", angle: 45, stops: ["#ff006e", "#8338ec", "#3a86ff"] } },
        { keys: ["forest", "nature", "jungle", "earth", "leaf"],
          g: { type: "linear", angle: 135, stops: ["#134e5e", "#71b280"] } },
        { keys: ["lavender", "purple", "dreamy", "violet", "cosmic"],
          g: { type: "linear", angle: 90, stops: ["#c471ed", "#f64f59"] } },
        { keys: ["gold", "luxury", "amber", "sunset gold", "premium"],
          g: { type: "linear", angle: 90, stops: ["#f5af19", "#f12711"] } },
        { keys: ["ice", "snow", "winter", "cold", "frost"],
          g: { type: "linear", angle: 90, stops: ["#e0eafc", "#cfdef3"] } },
        { keys: ["fire", "flame", "burn", "lava", "heat"],
          g: { type: "linear", angle: 90, stops: ["#f12711", "#f5af19"] } },
        { keys: ["mint", "fresh", "summer", "cool"],
          g: { type: "linear", angle: 90, stops: ["#a8ff78", "#78ffd6"] } },
        { keys: ["candy", "pastel", "sweet", "pink"],
          g: { type: "linear", angle: 90, stops: ["#fcb69f", "#ffecd2"] } },
        { keys: ["midnight", "dark", "night", "black", "moody"],
          g: { type: "linear", angle: 135, stops: ["#232526", "#414345"] } },
        { keys: ["galaxy", "space", "star", "universe"],
          g: { type: "conic", angle: 0, stops: ["#0f0c29", "#302b63", "#24243e"] } },
        { keys: ["minimal", "clean", "mono"],
          g: { type: "linear", angle: 90, stops: ["#f5f7fa", "#c3cfe2"] } },
    ];

    function fromPrompt(text) {
        const q = (text || "").toLowerCase().trim();
        for (const p of PROMPTS) {
            if (p.keys.some((k) => q.includes(k))) return { match: p.keys[0], g: p.g };
        }
        // Deterministic fallback: seed from string hash
        let h = 0;
        for (const c of q) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        const hue = h % 360;
        return {
            match: null,
            g: {
                type: "linear",
                angle: 45 + (h % 90),
                stops: [
                    hslToHex([hue, 80, 55]),
                    hslToHex([(hue + 60) % 360, 75, 55]),
                    hslToHex([(hue + 120) % 360, 70, 55]),
                ],
            },
        };
    }

    /* ---------- remix (harmonic jitter) ---------- */
    function remix(state, count = 4) {
        const out = [];
        for (let i = 0; i < count; i++) {
            const hShift = (Math.random() - 0.5) * 90;
            const sJit = (Math.random() - 0.5) * 20;
            const lJit = (Math.random() - 0.5) * 20;
            const stops = state.stops.map((s) => {
                const [h, sat, l] = hexToHsl(s.c);
                return {
                    c: hslToHex([h + hShift, Math.max(5, Math.min(95, sat + sJit)), Math.max(5, Math.min(95, l + lJit))]),
                    p: s.p,
                };
            });
            out.push({
                type: state.type,
                angle: (state.angle + (Math.random() - 0.5) * 90 + 360) % 360,
                cx: state.cx, cy: state.cy, shape: state.shape,
                stops,
            });
        }
        return out;
    }

    /* ---------- explain CSS ---------- */
    const compass = (deg) => {
        const d = ((deg % 360) + 360) % 360;
        const dirs = ["pointing up", "pointing up-right", "pointing right", "pointing down-right",
                      "pointing down", "pointing down-left", "pointing left", "pointing up-left"];
        return dirs[Math.round(d / 45) % 8];
    };

    function explain(state) {
        const stops = [...state.stops].sort((a, b) => a.p - b.p);
        const head = {
            linear: `Linear gradient (${state.angle}°, ${compass(state.angle)})`,
            radial: `Radial gradient (${state.shape}, centered at ${state.cx}% × ${state.cy}%)`,
            conic:  `Conic gradient (starts at ${state.angle}°, centered at ${state.cx}% × ${state.cy}%)`,
        }[state.type];

        let notes = "";
        for (let i = 1; i < stops.length; i++) {
            if (stops[i].p === stops[i - 1].p) {
                notes += `\n• Hard transition at ${stops[i].p}% between ${stops[i - 1].c} and ${stops[i].c}`;
            }
        }

        return `${head}.\n\n${stops.length} color stops:\n` +
            stops.map((s, i) => `  ${i + 1}. ${s.c}  at  ${s.p}%`).join("\n") +
            notes +
            `\n\nThe browser paints each stop in order along the gradient line, blending smoothly unless two stops share a position — those create hard edges.`;
    }

    window.Palette = {
        harmony, fromPrompt, remix, explain,
        hexToHsl, hslToHex, rotate,
    };
})();