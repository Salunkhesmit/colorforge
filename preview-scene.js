/* ColorForge — toggleable 3D preview.
   Runs ONLY when start() is called by the studio; stops on stop(). */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

let renderer = null, scene = null, cam = null;
let group = null, mesh = null, wire = null, core = null, stars = null;
let tex = null, tc = null, tctx = null;

let running = false;
let raf = 0, prev = 0, auto = 0;
let tx = 0, ty = 0, curX = 0, curY = 0;
let lastPainted = "";
let burstFn = null;

const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

function init(canvas) {
    if (renderer) return true;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas, antialias: true, alpha: true,
            preserveDrawingBuffer: true,   // needed for PNG export
            powerPreference: "low-power",
        });
    } catch (e) {
        renderer = null;
        return false;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.06);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    cam.position.set(0, 0.4, 6);

    /* lights */
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 3, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xaaccff, 1.2);
    rim.position.set(-4, -2, -3); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    /* texture */
    tc = document.createElement("canvas");
    tc.width = tc.height = 1024;
    tctx = tc.getContext("2d");
    tex = new THREE.CanvasTexture(tc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    /* group + meshes */
    group = new THREE.Group();
    scene.add(group);

    const geo = new THREE.IcosahedronGeometry(1.5, 32);
    const mat = new THREE.MeshPhysicalMaterial({
        map: tex, roughness: 0.16, metalness: 0.08,
        clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4,
    });
    mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    const wGeo = new THREE.IcosahedronGeometry(1.55, 2);
    const wMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, wireframe: true,
        transparent: true, opacity: 0.07,
    });
    wire = new THREE.Mesh(wGeo, wMat);
    group.add(wire);

    const cGeo = new THREE.SphereGeometry(0.92, 32, 24);
    const cMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.08,
    });
    core = new THREE.Mesh(cGeo, cMat);
    group.add(core);

    /* stars */
    const starGeo = new THREE.BufferGeometry();
    const N = 500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 22;
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: 0xffffff, size: 0.035, transparent: true, opacity: 0.6,
    }));
    scene.add(stars);

    /* pointer parallax on the canvas */
    canvas.addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        tx = ny * 0.4;
        ty = nx * 0.6;
    });

    /* drag-to-orbit */
    let dragging = false, lastX = 0, lastY = 0, dragX = 0, dragY = 0;
    canvas.addEventListener("pointerdown", (e) => {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("pointercancel", () => { dragging = false; });
    canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        dragX += (e.clientX - lastX) * 0.008;
        dragY += (e.clientY - lastY) * 0.008;
        lastX = e.clientX; lastY = e.clientY;
    });

    /* resize */
    const resize = () => {
        const w = canvas.parentElement.clientWidth || 1;
        const h = canvas.parentElement.clientHeight || 1;
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas.parentElement);
    resize();

    /* animation loop */
    const frame = (ms) => {
        const dt = Math.min(0.05, (ms - prev) / 1000 || 0);
        prev = ms;
        if (!calm) auto += dt * 0.22;

        mesh.rotation.y = auto;
        wire.rotation.y = auto * 0.65;
        wire.rotation.x = auto * 0.35;
        core.rotation.y = -auto * 1.6;
        stars.rotation.y = auto * 0.08;

        group.rotation.y = dragX + ty;
        group.rotation.x = dragY + tx;
        curX += (tx - curX) * 0.06;
        curY += (ty - curY) * 0.06;
        group.rotation.x = dragY + curX;
        group.rotation.y = dragX + curY;

        renderer.render(scene, cam);
    };
    const loop = (ms) => {
        raf = 0;
        if (!running || document.hidden) return;
        frame(ms);
        raf = requestAnimationFrame(loop);
    };
    burstFn = () => {
        if (!running || !window.anime || calm) return;
        window.anime({ targets: mesh.scale, x: [0.85, 1], y: [0.85, 1], z: [0.85, 1], duration: 900, easing: "easeOutElastic(1,.6)" });
    };

    /* state sync (only repaints the texture — the loop is stopped when closed) */
    document.addEventListener("cf:state", (e) => {
        const st = e.detail;
        if (!st || !running) return;
        const sig = JSON.stringify(st);
        if (sig === lastPainted) return;
        lastPainted = sig;
        window.paintGradient(tctx, tc.width, tc.height, st);
        tex.needsUpdate = true;
    });
    document.addEventListener("cf:burst", () => burstFn?.());

    return true;
}

function start(state) {
    if (!renderer) return false;
    running = true;
    prev = performance.now();
    if (state) {
        window.paintGradient(tctx, tc.width, tc.height, state);
        tex.needsUpdate = true;
        lastPainted = JSON.stringify(state);
    }
    if (!raf) raf = requestAnimationFrame(function tick(ms) {
        raf = 0;
        if (!running || document.hidden) return;
        // recompute frame + schedule
        const loop = (ms) => {
            raf = 0;
            if (!running || document.hidden) return;
            const dt = Math.min(0.05, (ms - prev) / 1000 || 0);
            prev = ms;
            if (!calm) auto += dt * 0.22;
            mesh.rotation.y = auto;
            wire.rotation.y = auto * 0.65;
            wire.rotation.x = auto * 0.35;
            core.rotation.y = -auto * 1.6;
            stars.rotation.y = auto * 0.08;
            curX += (tx - curX) * 0.06;
            curY += (ty - curY) * 0.06;
            group.rotation.x = curX;
            group.rotation.y = curY;
            renderer.render(scene, cam);
            raf = requestAnimationFrame(loop);
        };
        loop(ms);
    });
    return true;
}

function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
}

function resize() {
    if (!renderer) return;
    const canvas = renderer.domElement;
    const w = canvas.parentElement.clientWidth || 1;
    const h = canvas.parentElement.clientHeight || 1;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
}

function snapshot() {
    if (!renderer) return null;
    return renderer.domElement.toDataURL("image/png");
}

/* expose API for the classic script */
window.ColorForgePreview = {
    init, start, stop, resize, snapshot,
    isReady: () => !!renderer,
};