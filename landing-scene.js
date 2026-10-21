/* ColorForge — landing 3D scene.
   Layered gradient planes, particle field, fog, subtle camera drift. */
import * as THREE from "three";

const canvas = document.getElementById("landingCanvas");
if (canvas) {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer = null;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch (e) {
        canvas.style.background = "radial-gradient(circle at 50% 40%, #131327, #050510)";
    }

    if (renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050510, 0.055);

        const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
        cam.position.set(0, 0, 8);

        /* texture shared by all planes */
        const tc = document.createElement("canvas");
        tc.width = tc.height = 512;
        const tctx = tc.getContext("2d");
        const tex = new THREE.CanvasTexture(tc);
        tex.colorSpace = THREE.SRGBColorSpace;

        const paint = (state) => {
            if (!state) return;
            window.paintGradient(tctx, 512, 512, state);
            tex.needsUpdate = true;
        };
        paint(window.__cfState);

        /* planes drifting at different depths */
        const planes = [];
        for (let i = 0; i < 6; i++) {
            const size = 4 + Math.random() * 4;
            const geo = new THREE.PlaneGeometry(size, size);
            const mat = new THREE.MeshBasicMaterial({
                map: tex, transparent: true,
                opacity: 0.10 + Math.random() * 0.08,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, -2 - i * 3);
            mesh.rotation.z = Math.random() * Math.PI * 2;
            scene.add(mesh);
            planes.push({ mesh, drift: 0.05 + Math.random() * 0.1, phase: Math.random() * 100 });
        }

        /* particle field */
        const starGeo = new THREE.BufferGeometry();
        const N = 700;
        const positions = new Float32Array(N * 3);
        for (let i = 0; i < N * 3; i++) positions[i] = (Math.random() - 0.5) * 50;
        starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const starMat = new THREE.PointsMaterial({
            color: 0xffffff, size: 0.045, transparent: true, opacity: 0.55,
        });
        const stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);

        let raf = 0, prev = 0, running = true;

        const frame = (ms) => {
            const dt = Math.min(0.05, (ms - prev) / 1000 || 0);
            prev = ms;
            if (!calm) {
                for (const p of planes) {
                    p.mesh.position.y += Math.sin(ms * 0.0003 + p.phase) * 0.004;
                    p.mesh.rotation.z += dt * p.drift * 0.1;
                }
                stars.rotation.y += dt * 0.02;
                cam.position.x = Math.sin(ms * 0.0002) * 0.35;
                cam.position.y = Math.cos(ms * 0.00015) * 0.25;
                cam.lookAt(0, 0, 0);
            }
            renderer.render(scene, cam);
        };

        const loop = (ms) => {
            raf = 0;
            if (!running || document.hidden) return;
            frame(ms);
            raf = requestAnimationFrame(loop);
        };

        const resize = () => {
            const w = canvas.clientWidth || window.innerWidth;
            const h = canvas.clientHeight || window.innerHeight;
            renderer.setSize(w, h, false);
            cam.aspect = w / h;
            cam.updateProjectionMatrix();
        };
        window.addEventListener("resize", resize);
        resize();

        document.addEventListener("cf:state", (e) => paint(e.detail));

        window.__cfLandingScene = {
            stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
            start() { if (!running) { running = true; prev = performance.now(); raf = requestAnimationFrame(loop); } },
            getCamera: () => cam,
        };

        prev = performance.now();
        raf = requestAnimationFrame(loop);
    }
}