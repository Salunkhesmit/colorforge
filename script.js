/* ColorForge — state-driven gradient studio */
const $ = (id) => document.getElementById(id);
const content = $("content"), editor = $("cssEditor");
const btns = [$("myButton"), $("myButton2")];
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- bridge helpers ---------- */
const burst = () => document.dispatchEvent(new CustomEvent("cf:burst"));
const publish = (state) => {
    window.__cfState = structuredClone(state);
    document.dispatchEvent(new CustomEvent("cf:state", { detail: window.__cfState }));
};

/* ---------- utilities ---------- */
const hexValues = () => "#" + Array.from({ length: 6 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const setButtonColor = (button, hex) => {
    button.style.background = `color-mix(in srgb, ${hex} 85%, transparent)`;
    const isLight = lum(hex) > 0.55;
    button.style.color = isLight ? "#0f0f18" : "#ffffff";
    button.style.textShadow = isLight ? "none" : "0 1px 3px rgba(0,0,0,0.4)";
};

/* ---------- state ---------- */
const DIRS = {
    "to top": 0, "to top right": 45, "to right": 90, "to bottom right": 135,
    "to bottom": 180, "to bottom left": 225, "to left": 270, "to top left": 315,
};

const mk = (type, angle, ...cs) => ({
    type, angle,
    cx: 50, cy: 50, shape: "circle",
    stops: cs.map((c, i) => ({ c, p: Math.round((i * 100) / (cs.length - 1)) })),
});

const PRESETS = [
    mk("linear", 90, "#f5af19", "#f12711"),
    mk("linear", 135, "#667eea", "#764ba2"),
    mk("linear", 90, "#11998e", "#38ef7d"),
    mk("linear", 180, "#fc466b", "#3f5efb"),
    mk("conic", 0, "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff0000"),
    { ...mk("radial", 0, "#fff1eb", "#ace0f9"), shape: "ellipse", cx: 40, cy: 40 },
    mk("linear", 45, "#0f2027", "#2c5364", "#203a43"),
];

let S = structuredClone(PRESETS[0]);

const snap = (s = S) => JSON.stringify(s);
const sorted = (s) => [...s.stops].sort((a, b) => a.p - b.p);

const cssFor = (s) => {
    const a = sorted(s).map((x) => `${x.c} ${x.p}%`).join(", ");
    if (s.type === "radial") {
        const c = `at ${s.cx ?? 50}% ${s.cy ?? 50}%`;
        const shape = s.shape === "ellipse" ? `ellipse ${c}` : `circle ${c}`;
        return `radial-gradient(${shape}, ${a})`;
    }
    if (s.type === "conic") {
        const c = `at ${s.cx ?? 50}% ${s.cy ?? 50}%`;
        return `conic-gradient(from ${s.angle}deg ${c}, ${a})`;
    }
    return `linear-gradient(${s.angle}deg, ${a})`;
};

const normalize = (s) => {
    if (!s) return null;
    const out = {
        type: ["linear", "radial", "conic"].includes(s.type) ? s.type : "linear",
        angle: (((+s.angle % 360) + 360) % 360) || 90,
        cx: Math.max(0, Math.min(100, Number(s.cx ?? 50))),
        cy: Math.max(0, Math.min(100, Number(s.cy ?? 50))),
        shape: s.shape === "ellipse" ? "ellipse" : "circle",
        stops: [],
    };
    if (Array.isArray(s.stops)) {
        out.stops = s.stops
            .filter((x) => x && /^#[0-9a-f]{6}$/i.test(x.c) && Number.isFinite(+x.p))
            .map((x) => ({ c: x.c.toLowerCase(), p: Math.max(0, Math.min(100, Math.round(+x.p))) }));
    }
    return out.stops.length >= 2 && out.stops.length <= 8 ? out : null;
};

/* ---------- history ---------- */
let undoS = [], redoS = [], last = snap(), timer;
const commitNow = () => {
    clearTimeout(timer);
    if (snap() !== last) {
        undoS.push(last);
        last = snap();
        redoS = [];
        if (undoS.length > 100) undoS.shift();
    }
    updateHistoryUI();
};
const commit = () => { clearTimeout(timer); timer = setTimeout(commitNow, 400); };
const restore = (from, to) => {
    commitNow();
    if (!from.length) return;
    to.push(snap());
    S = JSON.parse(from.pop());
    last = snap();
    render();
};
const updateHistoryUI = () => {
    $("undoBtn").disabled = !undoS.length;
    $("redoBtn").disabled = !redoS.length;
};

/* ---------- color buttons ---------- */
btns.forEach((b, k) => b.addEventListener("click", () => {
    S.stops[k ? S.stops.length - 1 : 0].c = hexValues();
    render(); commit();
}));

/* ---------- rows & render ---------- */
function rows() {
    $("stops").innerHTML = S.stops.map((s, i) => `<div class="stop-row" data-i="${i}">
        <input type="color" value="${s.c}" aria-label="Stop ${i + 1} color">
        <input type="range" class="form-range" min="0" max="100" value="${s.p}" aria-label="Stop ${i + 1} position">
        <span class="pos">${s.p}%</span>
        <button class="tool" ${S.stops.length < 3 ? "disabled" : ""} aria-label="Remove stop"><i class="fa-solid fa-xmark"></i></button></div>`).join("");
}

const chips = (el, list, onPick) => {
    el.innerHTML = "";
    list.forEach((g) => {
        const b = document.createElement("button");
        b.className = "chip";
        b.style.backgroundImage = cssFor(g);
        b.setAttribute("aria-label", "Load gradient");
        b.onclick = () => { S = structuredClone(g); render(); commit(); pulse(content); burst(); };
        el.appendChild(b);
    });
};

function render({ rows: r = true, editor: e = true } = {}) {
    const bg = cssFor(S), n = S.stops.length - 1;
    content.style.backgroundImage = bg;
    content.style.setProperty("--c1", S.stops[0].c);
    content.style.setProperty("--c2", S.stops[n].c);
    if (e) { editor.value = `background-image: ${bg};`; editor.classList.remove("is-invalid"); }

    [0, n].forEach((i, k) => {
        const c = S.stops[i].c;
        btns[k].innerText = c;
        setButtonColor(btns[k], c);
    });

    const light = S.stops.reduce((a, s) => a + lum(s.c), 0) / S.stops.length > 0.55;
    content.classList.toggle("ui-light", light);
    content.classList.toggle("ui-dark", !light);

    document.querySelectorAll(".direction-btn").forEach((b) =>
        b.classList.toggle("active", S.type === "linear" && DIRS[b.dataset.direction] === S.angle));
    document.querySelectorAll("#typeGroup .tool").forEach((b) =>
        b.classList.toggle("active", b.dataset.type === S.type));
    document.querySelectorAll("#shapeGroup .tool").forEach((b) =>
        b.classList.toggle("active", b.dataset.shape === S.shape));

    $("angle").value = S.angle;
    $("angleVal").textContent = S.angle + "°";
    $("centerX").value = S.cx; $("centerXVal").textContent = S.cx + "%";
    $("centerY").value = S.cy; $("centerYVal").textContent = S.cy + "%";

    $("directionSection").classList.toggle("is-hidden", S.type !== "linear");
    $("angleSection").classList.toggle("is-hidden", S.type === "radial");
    $("radialSection").classList.toggle("is-hidden", S.type !== "radial");
    $("centerSection").classList.toggle("is-hidden", S.type === "linear");

    if (r) rows();
    else document.querySelectorAll(".stop-row").forEach((row, i) => {
        const c = row.querySelector("[type=color]");
        if (c && S.stops[i] && c.value !== S.stops[i].c) c.value = S.stops[i].c;
        const range = row.querySelector("[type=range]");
        const pos = row.querySelector(".pos");
        if (range && S.stops[i]) { range.value = S.stops[i].p; pos.textContent = S.stops[i].p + "%"; }
    });

    cards.forEach(({ el, g }) => {
        const on = snap(g) === snap();
        el.classList.toggle("selected", on);
        el.setAttribute("aria-pressed", on);
    });

    const fav = favs.some((f) => snap(f) === snap());
    $("favBtn").querySelector("i").className = fav ? "fa-solid fa-heart" : "fa-regular fa-heart";
    updateHistoryUI();

    publish(S);
}

/* ---------- controls ---------- */
$("typeGroup").addEventListener("click", (e) => {
    const t = e.target.closest("[data-type]");
    if (t) { S.type = t.dataset.type; render({ rows: false }); commit(); }
});
$("shapeGroup").addEventListener("click", (e) => {
    const t = e.target.closest("[data-shape]");
    if (t) { S.shape = t.dataset.shape; render({ rows: false }); commit(); }
});
document.querySelectorAll(".direction-btn").forEach((b) => b.addEventListener("click", () => {
    S.type = S.type === "radial" ? "linear" : S.type;
    S.angle = DIRS[b.dataset.direction];
    render({ rows: false }); commit();
}));
$("angle").addEventListener("input", (e) => { S.angle = +e.target.value; render({ rows: false }); commit(); });
$("centerX").addEventListener("input", (e) => { S.cx = +e.target.value; render({ rows: false }); commit(); });
$("centerY").addEventListener("input", (e) => { S.cy = +e.target.value; render({ rows: false }); commit(); });

$("stops").addEventListener("input", (e) => {
    const row = e.target.closest(".stop-row"), i = +row.dataset.i;
    if (e.target.type === "color") S.stops[i].c = e.target.value;
    else { S.stops[i].p = +e.target.value; row.querySelector(".pos").textContent = e.target.value + "%"; }
    render({ rows: false }); commit();
});
$("stops").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || S.stops.length < 3) return;
    S.stops.splice(+b.closest(".stop-row").dataset.i, 1);
    render(); commit();
});

$("addStop").addEventListener("click", () => {
    if (S.stops.length >= 8) return toast("Maximum 8 stops", true);
    const s = sorted(S);
    let gap = 0, p = 50;
    for (let i = 1; i < s.length; i++) if (s[i].p - s[i - 1].p > gap) {
        gap = s[i].p - s[i - 1].p;
        p = Math.round((s[i].p + s[i - 1].p) / 2);
    }
    S.stops.splice(S.stops.length - 1, 0, { c: hexValues(), p });
    render(); commit();
});

$("addHardStop").addEventListener("click", () => {
    if (S.stops.length >= 7) return toast("Need room for two stops", true);
    const s = sorted(S);
    let best = 1, bestGap = 0;
    for (let i = 1; i < s.length; i++) {
        const gap = s[i].p - s[i - 1].p;
        if (gap > bestGap) { bestGap = gap; best = i; }
    }
    if (bestGap < 4) return toast("Gaps too small for hard stop", true);
    const mid = Math.round((s[best].p + s[best - 1].p) / 2);
    S.stops.splice(S.stops.length - 1, 0,
        { c: s[best - 1].c, p: mid },
        { c: s[best].c, p: mid });
    render(); commit();
    toast("Hard-stop pair added — give each half its own color");
});

$("undoBtn").onclick = () => restore(undoS, redoS);
$("redoBtn").onclick = () => restore(redoS, undoS);
$("randBtn").onclick = () => {
    const n = 2 + Math.floor(Math.random() * 3);
    S = mk(
        ["linear", "radial", "conic"][Math.floor(Math.random() * 3)],
        15 * Math.floor(Math.random() * 24),
        ...Array.from({ length: n }, hexValues)
    );
    render(); commit(); pulse(content); burst();
};

/* ---------- live CSS editor ---------- */
const hex6 = (h) => (h.length === 4 ? "#" + [...h.slice(1)].map((x) => x + x).join("") : h).toLowerCase();

function parseCss(t) {
    const m = t.trim().match(/^(?:background(?:-image)?\s*:\s*)?(linear|radial|conic)-gradient\((.*)\)\s*;?$/is);
    if (!m) return null;
    const parts = m[2].split(/,(?![^(]*\))/).map((x) => x.trim());

    let angle = S.angle, cx = 50, cy = 50, shape = "circle";

    while (parts.length && !/^#/.test(parts[0])) {
        const head = parts.shift();
        const chunks = head.split(/\s+at\s+/i);
        const preAt = chunks[0].trim();
        const postAt = chunks[1];

        if (postAt) {
            const m2 = postAt.match(/^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/i);
            if (m2) { cx = +m2[1]; cy = +m2[2]; }
        }

        const fromM = preAt.match(/^from\s+(-?\d+(?:\.\d+)?)deg$/i);
        const degM = preAt.match(/^(-?\d+(?:\.\d+)?)deg$/i);
        if (fromM) angle = +fromM[1];
        else if (degM) angle = +degM[1];
        else if (DIRS[preAt.toLowerCase()] !== undefined) angle = DIRS[preAt.toLowerCase()];
        else if (/^circle$/i.test(preAt)) shape = "circle";
        else if (/^ellipse$/i.test(preAt)) shape = "ellipse";
    }

    const stops = [];
    for (const part of parts) {
        const s = part.match(/^(#[0-9a-f]{6}|#[0-9a-f]{3})(?:\s+(\d+(?:\.\d+)?)%)?$/i);
        if (!s) return null;
        stops.push({ c: hex6(s[1]), p: s[2] === undefined ? null : Math.round(+s[2]) });
    }
    if (stops.length < 2 || stops.length > 8) return null;
    stops.forEach((s, i) => { if (s.p === null) s.p = Math.round((i * 100) / (stops.length - 1)); });

    return normalize({ type: m[1].toLowerCase(), angle, cx, cy, shape, stops });
}
editor.addEventListener("input", () => {
    const s = parseCss(editor.value);
    editor.classList.toggle("is-invalid", !s);
    if (s) { S = s; render({ editor: false }); commit(); }
});
editor.addEventListener("blur", () => {
    if (editor.classList.contains("is-invalid")) toast("Invalid CSS — edit not applied", true);
});

/* ---------- copy / export ---------- */
let toastTimer;
function toast(msg, error = false) {
    const t = $("toast");
    $("toastText").textContent = msg;
    t.classList.toggle("error", error);
    t.querySelector("i").className = error ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-check";
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}
function myFunction() {
    navigator.clipboard.writeText(editor.value.trim())
        .then(() => toast("Code copied to clipboard"))
        .catch(() => toast("Copy failed — select text and copy manually", true));
}
const download = (name, blobOrText, type) => {
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("exportCssBtn").onclick = () => {
    download("gradient.css", `.gradient {\n  background-image: ${cssFor(S)};\n}\n`, "text/css");
    toast("CSS exported");
};

/* ---------- export modal ---------- */
const modal = $("exportModal");
const openExport = () => {
    modal.hidden = false;
    $("export3DGo").disabled = $("previewOverlay").hidden;
};
const closeExport = () => { modal.hidden = true; };
$("openExport").onclick = openExport;
$("closeExport").onclick = closeExport;
modal.addEventListener("click", (e) => { if (e.target === modal) closeExport(); });

document.querySelectorAll("#sizePicker button").forEach((b) => {
    b.onclick = () => {
        $("customW").value = b.dataset.w;
        $("customH").value = b.dataset.h;
        document.querySelectorAll("#sizePicker button").forEach((x) => x.classList.toggle("active", x === b));
    };
});

$("exportBgGo").onclick = () => {
    const w = Math.max(64, Math.min(8192, +$("customW").value || 1920));
    const h = Math.max(64, Math.min(8192, +$("customH").value || 1080));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    paintGradient(ctx, w, h, S);
    c.toBlob((blob) => {
        download(`colorforge-${w}x${h}.png`, blob, "image/png");
        toast(`Exported ${w}×${h} PNG`);
        closeExport();
    }, "image/png");
};

$("export3DGo").onclick = () => {
    const api = window.ColorForgePreview;
    if (!api || !api.snapshot) { toast("Open 3D preview first", true); return; }
    const dataUrl = api.snapshot();
    if (!dataUrl) { toast("Preview not ready", true); return; }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "colorforge-3d.png";
    a.click();
    toast("3D preview exported");
};

/* ---------- AI Help Modal ---------- */
const aiModal = $("aiHelpModal");
$("openAiHelp").onclick = () => {
    aiModal.hidden = false;
    if (window.anime && !calm) {
        anime({ targets: ".ai-help-card", scale: [0.92, 1], opacity: [0, 1], duration: 400, easing: "easeOutBack" });
    }
};
$("closeAiHelp").onclick = () => { aiModal.hidden = true; };
aiModal.addEventListener("click", (e) => { if (e.target === aiModal) aiModal.hidden = true; });

/* ---------- Master ESC key handler (closes all overlays) ---------- */
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (!aiModal.hidden) aiModal.hidden = true;
        if (!modal.hidden) closeExport();
        if (!$("previewOverlay").hidden) togglePreview(false);
    }
});

/* ---------- favorites (in-memory only) ---------- */
let favs = [];
const saveFavs = () => chips($("favs"), favs);   // no persistence by design
$("favBtn").onclick = () => {
    const i = favs.findIndex((f) => snap(f) === snap());
    if (i >= 0) favs.splice(i, 1); else favs.push(structuredClone(S));
    saveFavs(); render({ rows: false });
};

/* ---------- JSON import / export ---------- */
$("exportJsonBtn").onclick = () => {
    download("colorforge-gradients.json",
        JSON.stringify({ app: "ColorForge", gradients: [...favs, S] }, null, 2),
        "application/json");
    toast("Presets exported");
};
$("importJsonBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async (e) => {
    try {
        const data = JSON.parse(await e.target.files[0].text());
        const src = Array.isArray(data) ? data : data.gradients || [];
        const ok = src.map(normalize).filter(Boolean);
        if (!ok.length) throw new Error("none");
        ok.forEach((g) => { if (!favs.some((f) => snap(f) === snap(g))) favs.push(g); });
        saveFavs(); render({ rows: false });
        toast(`Imported ${ok.length} gradient(s)`);
    } catch (err) { toast("Invalid preset file", true); }
    e.target.value = "";
};

/* ---------- AI / local studio ---------- */
const aiOut = $("aiOutput");
const aiShow = (html) => { aiOut.innerHTML = html; aiOut.classList.add("show"); };

$("promptGo").onclick = () => {
    const text = $("promptInput").value;
    const { match, g } = Palette.fromPrompt(text);
    // Convert the plain gradient into a full state
    S = mk(g.type, g.angle || 90, ...g.stops);
    if (g.stops.length > 2) {
        S.stops = g.stops.map((c, i) => ({ c, p: Math.round((i * 100) / (g.stops.length - 1)) }));
    }
    render(); commit(); pulse(content); burst();
    aiShow(
        (match ? `<strong>Matched:</strong> ${match}` : `<strong>No exact match —</strong> generated deterministically from your prompt's hash.`) +
        `\n\nApplied a ${g.type} gradient with ${g.stops.length} stops.`
    );
};

$("harmonyBtn").onclick = () => {
    const base = S.stops[0].c;
    const types = ["complementary", "analogous", "triadic", "split", "tetradic", "monochromatic"];
    let html = `<strong>Base:</strong> ${base}\n\n`;
    for (const t of types) {
        html += `<strong>${t}:</strong> ${Palette.harmony(base, t).join(" · ")}\n`;
    }
    aiShow(html);
};

$("remixBtn").onclick = () => {
    const variants = Palette.remix(S, 4);
    favs.length = 0;  // refill favorites with variants for one-click try
    variants.forEach((v) => favs.push(v));
    saveFavs();
    aiShow(`<strong>Generated ${variants.length} remixes</strong> — click any chip in the Favorites row to apply. Each shifts hue ±45°, saturation ±10, lightness ±10 from your current stops.`);
};

$("explainBtn").onclick = () => {
    aiShow(Palette.explain(S).replace(/&/g, "&amp;").replace(/</g, "&lt;"));
};

/* ---------- 3D preview toggle ---------- */
const overlay = $("previewOverlay");
let previewActive = false;
const togglePreview = (force) => {
    const next = typeof force === "boolean" ? force : !previewActive;
    if (next === previewActive) return;
    previewActive = next;

    if (next) {
        overlay.hidden = false;
        const api = window.ColorForgePreview;
        if (!api) {
            toast("3D preview loading…", false);
            // retry once module is loaded (modules defer)
            const wait = () => {
                if (window.ColorForgePreview) {
                    window.ColorForgePreview.init($("previewCanvas"));
                    window.ColorForgePreview.start(window.__cfState || S);
                    $("export3DGo").disabled = false;
                } else setTimeout(wait, 80);
            };
            wait();
        } else {
            if (!api.isReady()) api.init($("previewCanvas"));
            api.start(window.__cfState || S);
            $("export3DGo").disabled = false;
        }
        $("toggle3D").classList.add("active");
        $("toggle3D").setAttribute("aria-pressed", "true");
        $("toggle3D").querySelector("span").textContent = "Close 3D";
        document.body.style.overflow = "hidden";
    } else {
        window.ColorForgePreview?.stop?.();
        overlay.hidden = true;
        $("toggle3D").classList.remove("active");
        $("toggle3D").setAttribute("aria-pressed", "false");
        $("toggle3D").querySelector("span").textContent = "3D Preview";
        $("export3DGo").disabled = true;
        document.body.style.overflow = "";
    }
};
$("toggle3D").onclick = () => togglePreview();
$("closePreview").onclick = () => togglePreview(false);

/* ---------- landing transition ---------- */
const enterBtn = $("enterBtn");
if (enterBtn) {
    document.body.style.overflow = "hidden";
    enterBtn.onclick = () => {
        if (window.anime && !calm) {
            anime({
                targets: ".landing-content",
                opacity: [1, 0], translateY: [0, -30],
                duration: 550, easing: "easeInCubic",
            });
            const landingCam = window.__cfLandingScene?.getCamera?.();
            if (landingCam) anime({ targets: landingCam.position, z: [8, 14], duration: 1200, easing: "easeInCubic" });
        }
        setTimeout(() => {
            $("landing").classList.add("fade-out");
            setTimeout(() => {
                $("landing").hidden = true;
                window.__cfLandingScene?.stop?.();
                document.body.style.overflow = "";
            }, 800);
        }, 350);
    };
}

/* ---------- motion extras ---------- */
const pulse = (el) => { if (window.anime && !calm) anime({ targets: el, scale: [0.985, 1], duration: 350, easing: "easeOutBack" }); };

if (window.anime && !calm) {
    anime({ targets: ".studio-bar, .panel", opacity: [0, 1], translateY: [16, 0], delay: anime.stagger(90), duration: 600, easing: "easeOutCubic" });
}
if (!calm) {
    document.querySelectorAll(".panel").forEach((p) => p.addEventListener("mousemove", (e) => {
        const r = p.getBoundingClientRect();
        p.style.setProperty("--mx", e.clientX - r.left + "px");
        p.style.setProperty("--my", e.clientY - r.top + "px");
    }));
}

/* ---------- reset studio (internal refresh, not browser reload) ---------- */
$("resetBtn").onclick = () => {
    if (!confirm("Reset the studio to defaults?\n\nThis clears your current gradient, undo history, favorites, and AI output. The 3D preview will close if it's open.")) {
        return;
    }

    // 1. Close the 3D preview if open (frees the RAF loop)
    if (previewActive) togglePreview(false);

    // 2. Reset state — reassign S, preserve array references
    S = structuredClone(PRESETS[0]);
    last = snap();
    undoS.length = 0;
    redoS.length = 0;
    favs.length = 0;
    clearTimeout(timer);

    // 3. Clear AI panel
    $("aiOutput").innerHTML = "";
    $("aiOutput").classList.remove("show");
    $("promptInput").value = "";

    // 4. Rebuild favorites row (empty)
    chips($("favs"), favs);

    // 5. Full re-render (updates bg, editor, pickers, buttons, history, publishes to 3D)
    render();

    // 6. Back to top
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });

    toast("Studio reset to defaults");
};

/* ---------- style gallery ---------- */
const G = (type, angle, stops, o = {}) => ({
    type, angle, cx: o.cx ?? 50, cy: o.cy ?? 50, shape: o.shape ?? "circle",
    stops: stops.map(([c, p]) => ({ c, p })),
});
const GALLERY = [
    ["Multiple Colors", G("linear", 90, [["#f12711", 0], ["#f5af19", 25], ["#2ecc71", 50], ["#3498db", 75], ["#9b59b6", 100]])],
    ["Color Stops", G("linear", 90, [["#f12711", 0], ["#f5af19", 20], ["#1e90ff", 80]])],
    ["Hard Stop", G("linear", 90, [["#f5af19", 0], ["#f5af19", 50], ["#f12711", 50], ["#f12711", 100]])],
    ["Radial", G("radial", 0, [["#fff1a8", 0], ["#f12711", 100]], { shape: "ellipse" })],
    ["Radial Circle", G("radial", 0, [["#a8edea", 0], ["#667eea", 100]])],
    ["Radial Multiple", G("radial", 0, [["#ffffff", 0], ["#f5af19", 30], ["#f12711", 60], ["#2d0a4e", 100]])],
    ["Radial Position", G("radial", 0, [["#ffffff", 0], ["#fc466b", 45], ["#3f5efb", 100]], { cx: 20, cy: 30 })],
    ["Exact Position", G("linear", 135, [["#11998e", 10], ["#38ef7d", 35], ["#f5af19", 62], ["#f12711", 90]])],
    ["Conic", G("conic", 0, [["#ff0000", 0], ["#ffff00", 25], ["#00ff88", 50], ["#0088ff", 75], ["#ff0000", 100]])],
];
const cards = [];
GALLERY.forEach(([name, g]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card-g";
    b.innerHTML = `<span class="sw" style="background-image:${cssFor(g)}"></span>${name}`;
    b.onclick = () => { S = structuredClone(g); render(); commit(); pulse(b); pulse(content); burst(); };
    $("gallery").appendChild(b);
    cards.push({ el: b, g });
});

/* ---------- init ---------- */
chips($("presets"), PRESETS);
chips($("favs"), favs);
render();
