figma.showUI(__html__, { width: 420, height: 600 });

/* =========================
   EXPORT IMAGE (CORE)
========================= */
async function nodeToImage(node) {
    try {
        const bytes = await node.exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 2 }
        });

        const base64 = figma.base64Encode(bytes);

        return `<img src="data:image/png;base64,${base64}" 
        style="width:${node.width}px;height:${node.height}px;object-fit:contain;"  alt=""/>`;
    } catch (e) {
        return "";
    }
}

/* =========================
   COMPLEX DETECT
========================= */
function isComplexNode(node) {
    if (node.effects && node.effects.length > 0) return true;
    if (node.fills && node.fills.length > 1) return true;
    if (node.fills && node.fills.some(f => f.type.includes("GRADIENT"))) return true;

    const types = ["VECTOR", "BOOLEAN_OPERATION", "STAR", "ELLIPSE"];
    return types.includes(node.type);
}

/* =========================
   STYLE HELPERS
========================= */
function getBackgroundAdvanced(node) {
    if (!node.fills || !node.fills.length) return "";

    const fill = node.fills[0];

    if (fill.type === "SOLID") {
        const c = fill.color;
        return `background:rgb(${c.r*255},${c.g*255},${c.b*255});`;
    }

    if (fill.type === "IMAGE") {
        return "background-size:cover;background-position:center;";
    }

    if (fill.type.includes("GRADIENT")) {
        return "background:linear-gradient(90deg,#111,#333);";
    }

    return "";
}

function getEffect(node) {
    if (!node.effects) return "";

    let style = "";

    node.effects.forEach(e => {
        if (e.type === "DROP_SHADOW") {
            style += `box-shadow:${e.offset.x}px ${e.offset.y}px ${e.radius}px rgba(0,0,0,0.3);`;
        }
    });

    return style;
}

function mapFontWeight(weight) {
    if (!weight) return "400";
    if (weight >= 700) return "700";
    if (weight >= 600) return "600";
    if (weight >= 500) return "500";
    return "400";
}

function textToHTML(node) {
    let style = "";

    style += `font-size:${node.fontSize || 14}px;`;

    if (node.fontName) {
        style += `font-family:${node.fontName.family};`;
    }

    style += `font-weight:${mapFontWeight(node.fontWeight)};`;

    if (node.textAlignHorizontal) {
        style += `text-align:${node.textAlignHorizontal.toLowerCase()};`;
    }

    return `<p style="${style};margin:0;">${node.characters || ""}</p>`;
}

function getPosition(node) {
    if (node.parent && node.parent.layoutMode === "NONE") {
        return `
            position:absolute;
            left:${Math.round(node.x)}px;
            top:${Math.round(node.y)}px;
        `;
    }
    return "";
}

/* =========================
   HTML ENGINE
========================= */
async function nodeToHTML(node) {

    if (node.type === "TEXT") return textToHTML(node);

    if (isComplexNode(node)) return await nodeToImage(node);

    let style = "";
    style += getPosition(node);
    style += getBackgroundAdvanced(node);
    style += getEffect(node);

    let children = "";

    if ("children" in node && node.children.length > 0) {
        const results = await Promise.all(
            node.children.map(child => nodeToHTML(child))
        );
        children = results.join("");
    }

    return `<div style="${style}">${children}</div>`;
}

/* =========================
   V15 IMPORT ENGINE (NEW)
========================= */
/* =========================
   GLOBAL STATE
========================= */
let PAGE_BUFFER = [];
let RENDERED = {};
let GLOBAL_WRAPPER = null;
let GLOBAL_SETTINGS = {};
let ADVANCED_MODE = false;

/* =========================
   HELPERS
========================= */


function formatFileName(name){
    return (name || "PDF Import")
        .replace(".pdf","")
        .replace(/[_-]/g," ")
        .trim();
}

function createPageWrapper(fileName){

    const section = figma.createSection();

    const now = new Date().toLocaleString();
    const cleanName = formatFileName(fileName);

    section.name = `${cleanName} by Đỗ Minh Đức ❤️ - ${now}`;

    section.x = 0;
    section.y = 0;

    section.resizeWithoutConstraints(1200, 2000);

    section.fills = [
        {
            type: "SOLID",
            color: { r: 0, g: 0, b: 0 },
            opacity: 0
        }
    ];

    return section;
}

/* =========================
   TEXT ENGINE
========================= */

function groupTextByLine(textItems){

    const lines = {};

    textItems.forEach(t=>{
        const key = Math.round(t.y / 10);

        if(!lines[key]) lines[key] = [];
        lines[key].push(t);
    });

    return Object.values(lines).map(line=>{
        return line.sort((a,b)=>a.x - b.x);
    });
}

function buildTextBlock(line){

    let text = line.map(t=>t.text).join(" ");

    if(text.trim().startsWith(".")){
        return text
            .split(".")
            .filter(Boolean)
            .map(t=>"• " + t.trim())
            .join("\n");
    }

    return text;
}

/* =========================
   PAGE RENDER
========================= */


async function renderPage(page){

    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    const frame = figma.createFrame();
    frame.name = "Page " + page.index;
    frame.resize(page.width, page.height);
    frame.layoutMode = "NONE";

    /* =========================
       🎯 CREATE LAYERS
    ========================== */

    function createLayer(name){
        const layer = figma.createFrame();
        layer.name = name;
        layer.layoutMode = "NONE";
        layer.resize(page.width, page.height);
        layer.fills = [];
        return layer;
    }

    const backgroundLayer = createLayer("background");
    const imageLayer = createLayer("image");
    const vectorLayer = createLayer("vector");
    const textLayer = createLayer("text");
    const overlayLayer = createLayer("overlay");

    frame.appendChild(backgroundLayer);
    frame.appendChild(imageLayer);
    frame.appendChild(vectorLayer);
    frame.appendChild(textLayer);
    frame.appendChild(overlayLayer);

    /* =========================
       🖼 BACKGROUND (FULL PAGE)
    ========================== */

    if (page.image) {
        try {
            const rect = figma.createRectangle();
            rect.resize(page.width, page.height);

            const base64 = page.image.split(",")[1];
            const bytes = figma.base64Decode(base64);
            const image = figma.createImage(bytes);

            rect.fills = [{
                type: "IMAGE",
                scaleMode: "FILL",
                imageHash: image.hash
            }];

            backgroundLayer.appendChild(rect);

        } catch (e) {
            console.log("Background error", e);
        }
    }

    /* =========================
       🧩 IMAGE LAYER (pattern)
    ========================== */

    if (page.patternImages && page.patternImages.length) {

        for (const p of page.patternImages) {

            try {
                const rect = figma.createRectangle();

                rect.resize(p.width, p.height);

                rect.x = Math.round(p.x);
                rect.y = Math.round(page.height - p.y - p.height);

                const base64 = p.image.split(",")[1];
                const bytes = figma.base64Decode(base64);
                const image = figma.createImage(bytes);

                rect.fills = [{
                    type: "IMAGE",
                    scaleMode: "FILL",
                    imageHash: image.hash
                }];

                imageLayer.appendChild(rect);

            } catch (e) {
                console.log("Pattern error", e);
            }
        }
    }

    /* =========================
       🔺 VECTOR LAYER (shape)
    ========================== */

    if (page.pathItems && page.pathItems.length) {

        page.pathItems.forEach(p => {

            if (p.type === "rect") {

                const rect = figma.createRectangle();

                rect.resize(p.width, p.height);
                rect.x = p.x;
                rect.y = page.height - p.y - p.height;

                rect.fills = [{
                    type: "SOLID",
                    color: { r: 0.9, g: 0.9, b: 0.9 }
                }];

                vectorLayer.appendChild(rect);
            }
        });
    }

    /* =========================
       📝 TEXT LAYER
    ========================== */

    const lines = groupTextByLine(page.textItems || []);

    lines.forEach(line => {

        const node = figma.createText();

        const t = line[0];

        node.characters = buildTextBlock(line);

        node.fontSize = t.fontSize || 12;

        node.x = t.x;
        node.y = t.y;

        node.fills = [{
            type: "SOLID",
            color: t.color || { r: 0, g: 0, b: 0 }
        }];

        textLayer.appendChild(node);
    });

    /* =========================
       ✨ OVERLAY (debug / effect)
    ========================== */

    // ví dụ overlay debug (có thể tắt)
    const overlay = figma.createRectangle();
    overlay.resize(page.width, page.height);
    overlay.fills = [{
        type: "SOLID",
        color: { r: 0, g: 0, b: 0 },
        opacity: 0 // để 0 cho trong suốt
    }];

    overlayLayer.appendChild(overlay);

    return frame;
}
/* =========================
   BATCH RENDER
========================= */

async function renderBatch(pages, settings){

    if(!GLOBAL_WRAPPER){
        GLOBAL_WRAPPER = createPageWrapper(settings.fileName);
        figma.currentPage.appendChild(GLOBAL_WRAPPER);
    }

    const GAP = 40;
    const COLS = 5;

    let maxHeightRow = 0;

    for(let i=0;i<pages.length;i++){

        const frame = await renderPage(pages[i]);

        const col = i % COLS;
        const row = Math.floor(i / COLS);

        frame.x = col * (frame.width + GAP);
        frame.y = row * (frame.height + GAP);

        GLOBAL_WRAPPER.appendChild(frame);

        maxHeightRow = Math.max(maxHeightRow, frame.height);
    }

    GLOBAL_WRAPPER.resizeWithoutConstraints(
        COLS * (pages[0].width + GAP),
        Math.ceil(pages.length / COLS) * (pages[0].height + GAP)
    );
}


/* =========================
   MAIN MESSAGE HANDLER
========================= */

figma.ui.onmessage = async (msg) => {

    /* ===== EXPORT ===== */
    if (msg.type === "export-html") {

        const nodes = figma.currentPage.selection;
        if (!nodes.length) return figma.notify("Select a frame");

        const parts = await Promise.all(nodes.map(nodeToHTML));

        figma.ui.postMessage({
            type: "html-result",
            html: parts.join("")
        });
    }

    /* ===== V15 IMPORT ===== */

    if (msg.type === "page-chunk") {


        const page = msg.page;
        const settings = msg.settings || {};

        // lưu settings
        GLOBAL_SETTINGS = settings;
        if (RENDERED[page.index]) return;

        RENDERED[page.index] = true;

        PAGE_BUFFER.push(page);
    }

    if (msg.type === "done-stream") {

        if (PAGE_BUFFER.length) {

            // sort cho chắc
            PAGE_BUFFER.sort((a, b) => a.index - b.index);

            await renderBatch(PAGE_BUFFER, GLOBAL_SETTINGS);
        }


        figma.notify("✅ Import complete");

        // reset
        PAGE_BUFFER = [];
        RENDERED = {};
        GLOBAL_WRAPPER = null;
        GLOBAL_SETTINGS = {};
    }
    if(msg.type === "advanced-mode"){
        ADVANCED_MODE = true;
        figma.notify("⚡ Advanced Mode Enabled");
    }
    if (msg.type === "preview-single") {

        const frame = await renderPage(msg.page);

        figma.currentPage.appendChild(frame);

        figma.viewport.scrollAndZoomIntoView([frame]);
    }
};