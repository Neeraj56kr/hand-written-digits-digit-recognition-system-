/* ================================================================
   Neural Digit Vision — Frontend Logic
   Canvas drawing, file upload, and prediction API integration.
   ================================================================ */

(function () {
    "use strict";

    // ── DOM refs ────────────────────────────────────────────
    const canvas         = document.getElementById("draw-canvas");
    const ctx            = canvas.getContext("2d");
    const btnClear       = document.getElementById("btn-clear");
    const btnPredCanvas  = document.getElementById("btn-predict-canvas");
    const btnPredUpload  = document.getElementById("btn-predict-upload");
    const btnRemoveFile  = document.getElementById("btn-remove-file");
    const tabDraw        = document.getElementById("tab-draw");
    const tabUpload      = document.getElementById("tab-upload");
    const drawArea       = document.getElementById("draw-area");
    const uploadArea     = document.getElementById("upload-area");
    const dropZone       = document.getElementById("drop-zone");
    const fileInput      = document.getElementById("file-input");
    const uploadPreview  = document.getElementById("upload-preview");
    const previewImg     = document.getElementById("preview-img");
    const resultPlaceholder = document.getElementById("result-placeholder");
    const resultLoading  = document.getElementById("result-loading");
    const resultContent  = document.getElementById("result-content");
    const predictedNum   = document.getElementById("predicted-number");
    const predictedConf  = document.getElementById("predicted-confidence");
    const probChart      = document.getElementById("probability-chart");

    let uploadedFile = null;

    // ══════════════════════════════════════════════════════════
    //  TABS
    // ══════════════════════════════════════════════════════════
    function switchTab(tab) {
        const isDraw = tab === "draw";
        tabDraw.classList.toggle("active", isDraw);
        tabUpload.classList.toggle("active", !isDraw);
        tabDraw.setAttribute("aria-selected", isDraw);
        tabUpload.setAttribute("aria-selected", !isDraw);
        drawArea.classList.toggle("hidden", !isDraw);
        uploadArea.classList.toggle("hidden", isDraw);
    }
    tabDraw.addEventListener("click",   () => switchTab("draw"));
    tabUpload.addEventListener("click", () => switchTab("upload"));

    // ══════════════════════════════════════════════════════════
    //  CANVAS DRAWING
    // ══════════════════════════════════════════════════════════
    let drawing = false;
    let lastX = 0, lastY = 0;

    // Initialise canvas
    function clearCanvas() {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        showPlaceholder();
    }
    clearCanvas();

    ctx.lineWidth   = 16;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.strokeStyle = "#1a1d2e";

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top)  * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY,
        };
    }

    function startDraw(e) {
        e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        lastX = pos.x;
        lastY = pos.y;
    }
    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
    }
    function stopDraw() { drawing = false; }

    canvas.addEventListener("mousedown",  startDraw);
    canvas.addEventListener("mousemove",  draw);
    canvas.addEventListener("mouseup",    stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove",  draw,      { passive: false });
    canvas.addEventListener("touchend",   stopDraw);

    btnClear.addEventListener("click", clearCanvas);

    // ══════════════════════════════════════════════════════════
    //  FILE UPLOAD
    // ══════════════════════════════════════════════════════════
    function handleFile(file) {
        if (!file || !file.type.startsWith("image/")) return;
        uploadedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            previewImg.src = ev.target.result;
            uploadPreview.classList.remove("hidden");
            dropZone.classList.add("hidden");
            btnPredUpload.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        handleFile(e.dataTransfer.files[0]);
    });

    btnRemoveFile.addEventListener("click", () => {
        uploadedFile = null;
        fileInput.value = "";
        previewImg.src = "";
        uploadPreview.classList.add("hidden");
        dropZone.classList.remove("hidden");
        btnPredUpload.disabled = true;
        showPlaceholder();
    });

    // ══════════════════════════════════════════════════════════
    //  RESULT UI HELPERS
    // ══════════════════════════════════════════════════════════
    function showPlaceholder() {
        resultPlaceholder.classList.remove("hidden");
        resultLoading.classList.add("hidden");
        resultContent.classList.add("hidden");
    }
    function showLoading() {
        resultPlaceholder.classList.add("hidden");
        resultLoading.classList.remove("hidden");
        resultContent.classList.add("hidden");
    }
    function showResult(data) {
        resultPlaceholder.classList.add("hidden");
        resultLoading.classList.add("hidden");
        resultContent.classList.remove("hidden");

        // Predicted digit
        predictedNum.textContent = data.predicted_digit;
        // Re-trigger animation
        predictedNum.style.animation = "none";
        void predictedNum.offsetWidth; // reflow
        predictedNum.style.animation = "";

        // Confidence
        predictedConf.textContent = (data.confidence * 100).toFixed(1) + "% confidence";

        // Build probability bars
        buildProbBars(data.probabilities, data.predicted_digit);
    }

    function buildProbBars(probs, best) {
        // Keep the title
        const title = probChart.querySelector(".chart-title");
        probChart.innerHTML = "";
        probChart.appendChild(title);

        probs.forEach((p, i) => {
            const row   = document.createElement("div");
            row.className = "prob-row";

            const label = document.createElement("span");
            label.className = "prob-label";
            label.textContent = i;

            const track = document.createElement("div");
            track.className = "prob-bar-track";

            const fill  = document.createElement("div");
            fill.className = "prob-bar-fill" + (i === best ? " best" : "");

            const value = document.createElement("span");
            value.className = "prob-value";
            value.textContent = (p * 100).toFixed(1) + "%";

            track.appendChild(fill);
            row.appendChild(label);
            row.appendChild(track);
            row.appendChild(value);
            probChart.appendChild(row);

            // Animate bar fill after a tiny delay per row
            requestAnimationFrame(() => {
                setTimeout(() => {
                    fill.style.width = (p * 100).toFixed(1) + "%";
                }, i * 50);
            });
        });
    }

    // ══════════════════════════════════════════════════════════
    //  PREDICT API CALLS
    // ══════════════════════════════════════════════════════════
    async function predictFromCanvas() {
        showLoading();
        const dataURL = canvas.toDataURL("image/png");
        try {
            const resp = await fetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: dataURL }),
            });
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            showResult(data);
        } catch (err) {
            alert("Prediction failed: " + err.message);
            showPlaceholder();
        }
    }

    async function predictFromFile() {
        if (!uploadedFile) return;
        showLoading();
        const fd = new FormData();
        fd.append("file", uploadedFile);
        try {
            const resp = await fetch("/predict", {
                method: "POST",
                body: fd,
            });
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            showResult(data);
        } catch (err) {
            alert("Prediction failed: " + err.message);
            showPlaceholder();
        }
    }

    btnPredCanvas.addEventListener("click", predictFromCanvas);
    btnPredUpload.addEventListener("click", predictFromFile);

})();
