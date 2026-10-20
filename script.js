// Intro Element Timer (guarded — #intro is currently commented out)
const introEl = document.getElementById("intro");
if (introEl) {
    setTimeout(() => {
        introEl.remove();
        document.body.style.overflow = "auto";
    }, 3000);
}

// Random Hex Value  (your logic, unchanged)
let btn1 = document.getElementById('myButton');
let btn2 = document.getElementById('myButton2');
let copyDiv = document.querySelector(".copyCode");
let rgb1 = "#f5af19";
let rgb2 = "#f12711";
let direction = "to right"; // current gradient direction

const hexValues = () => {
    let myHexValues = "0123456789abcdef";
    let hex = '#';
    for (let i = 0; i < 6; i++) {
        hex = hex + myHexValues[Math.floor(Math.random() *16)];
    }
    return hex;
};

// Perceived brightness of a HEX — used for adaptive UI contrast
const lum = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Button keeps its own colour but text stays readable on any HEX
const setButtonColor = (button, hex) => {
    button.style.background = `color-mix(in srgb, ${hex} 85%, transparent)`;
    const isLight = lum(hex) > 0.55;
    button.style.color = isLight ? "#0f0f18" : "#ffffff";
    button.style.textShadow = isLight ? "none" : "0 1px 3px rgba(0,0,0,0.4)";
};

setButtonColor(btn1, rgb1);
setButtonColor(btn2, rgb2);

// Pickers — sized to viewport so they always fit fully (wheel + hue slider)
const pickerW = window.innerWidth < 520 ? 150 : 180;
const colorPicker1 = new iro.ColorPicker("#picker1", {
    width: pickerW,
    color: "#f5af19"
});
const colorPicker2 = new iro.ColorPicker("#picker2", {
    width: pickerW,
    color: "#f12711"
});

// Single sync point — colours + direction drive gradient, code and UI contrast
const content = document.getElementById("content");
const updateGradient = () => {
    content.style.backgroundImage = `linear-gradient(${direction}, ${rgb1}, ${rgb2})`;
    content.style.setProperty("--c1", rgb1);
    content.style.setProperty("--c2", rgb2);
    copyDiv.innerHTML = `background-image: linear-gradient(${direction}, ${rgb1}, ${rgb2});`;

    // Adaptive contrast: pick light or dark UI depending on gradient brightness
    const avg = (lum(rgb1) + lum(rgb2)) / 2;
    const light = avg > 0.55;
    content.classList.toggle("ui-light", light);
    content.classList.toggle("ui-dark", !light);
};

// Random HEX  →  colour button  →  picker  →  gradient  →  CSS  (your chain, unchanged)
const handleButton1 = () => {
    rgb1 = hexValues();
    console.log(rgb1);
    btn1.innerText = rgb1;
    colorPicker1.color = rgb1;
    setButtonColor(btn1, rgb1);
    updateGradient();
};
const handleButton2 = () => {
    rgb2 = hexValues();
    console.log(rgb2);
    btn2.innerText = rgb2;
    colorPicker2.color = rgb2;
    setButtonColor(btn2, rgb2);
    updateGradient();
};
btn1.addEventListener("click", handleButton1);
btn2.addEventListener("click", handleButton2);

// Copy (same function name — custom toast instead of alert)
function myFunction() {
    let copyText = document.getElementById("copyCodeText");
    navigator.clipboard.writeText(copyText.innerText.trim());
    showToast();
}

// Color Pickers  →  button  →  gradient  →  CSS  (your chain, unchanged)
colorPicker1.on("color:change", function(color) {
    rgb1 = color.hexString;
    btn1.innerText = rgb1;
    setButtonColor(btn1, rgb1);
    updateGradient();
});
colorPicker2.on("color:change", function(color) {
    rgb2 = color.hexString;
    btn2.innerText = rgb2;
    setButtonColor(btn2, rgb2);
    updateGradient();
});

// Gradient Direction Buttons
document.querySelectorAll(".direction-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        direction = btn.dataset.direction;
        const current = document.querySelector(".direction-btn.active");
        if (current) current.classList.remove("active");
        btn.classList.add("active");
        updateGradient();
    });
});

// Copy Toast
let toastTimer;
function showToast() {
    const toast = document.getElementById("toast");
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}

// Subtle 3D tilt on the code card
const codeCard = document.getElementById("copyCodeText");
codeCard.addEventListener("mousemove", (e) => {
    const rect = codeCard.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    codeCard.style.transform = `perspective(700px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
});
codeCard.addEventListener("mouseleave", () => {
    codeCard.style.transform = "";
});

// Initial paint
updateGradient();