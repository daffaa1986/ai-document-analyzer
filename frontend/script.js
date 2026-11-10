
const API = "/api";

// ==========================================
// DOM ELEMENTS
// ==========================================

const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const analyzeBtn = document.getElementById("analyzeBtn");
const selectedFile = document.getElementById("selectedFile");
const apiStatus = document.getElementById("apiStatus");

let chosenFile = null;

// ==========================================
// API RESPONSE HANDLER
// ==========================================

async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const responseText = await response.text();

    let data;

    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(
            `Server returned non-JSON response. HTTP ${response.status}: ${responseText.slice(0, 300)}`
        );
    }

    if (!response.ok) {
        throw new Error(
            data.detail || data.message || `Request failed: HTTP ${response.status}`
        );
    }

    return data;
}

// ==========================================
// FILE SELECTION
// ==========================================

function chooseFile(file) {
    if (!file) return;

    const ext = file.name.toLowerCase().split(".").pop();

    if (!["pdf", "txt"].includes(ext)) {
        return showError("Only PDF and TXT files are supported.");
    }

    if (file.size > 5 * 1024 * 1024) {
        return showError("File exceeds the 5 MB limit.");
    }

    chosenFile = file;

    selectedFile.textContent =
        `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;

    analyzeBtn.disabled = false;

    hideError();
}

fileInput.addEventListener("change", (event) => {
    chooseFile(event.target.files[0]);
});

// ==========================================
// DRAG AND DROP
// ==========================================

["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("dragging");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("dragging");
    });
});

dropzone.addEventListener("drop", (event) => {
    chooseFile(event.dataTransfer.files[0]);
});

// ==========================================
// ERROR HANDLING
// ==========================================

function showError(message) {
    const errorBox = document.getElementById("errorBox");

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function hideError() {
    document.getElementById("errorBox").classList.add("hidden");
}

// ==========================================
// LOADING STATE
// ==========================================

function setLoading(isLoading) {
    document.getElementById("emptyState")
        .classList.toggle("hidden", isLoading);

    document.getElementById("loading")
        .classList.toggle("hidden", !isLoading);

    document.getElementById("summary")
        .classList.add("hidden");

    analyzeBtn.disabled = isLoading || !chosenFile;
}

// ==========================================
// RENDER DOCUMENT SUMMARY
// ==========================================

function renderSummary(doc) {
    document.getElementById("summaryName").textContent =
        doc.filename || "Untitled document";

    document.getElementById("summaryDate").textContent =
        doc.created_at
            ? new Date(doc.created_at).toLocaleString()
            : "-";

    document.getElementById("summaryText").textContent =
        doc.summary || "No summary available.";

    document.getElementById("summary").classList.remove("hidden");

    document.getElementById("emptyState").classList.add("hidden");
}

// ==========================================
// UPLOAD AND ANALYZE DOCUMENT
// ==========================================

analyzeBtn.addEventListener("click", async () => {
    if (!chosenFile) return;

    hideError();
    setLoading(true);

    try {
        const body = new FormData();

        body.append("file", chosenFile);

        const data = await requestJson(
            `${API}/documents/upload`,
            {
                method: "POST",
                body: body
            }
        );

        // Display AI-generated summary
        renderSummary(data);

        // Refresh document history
        await loadHistory();

    } catch (error) {
        console.error("Document upload error:", error);

        showError(error.message);

        document.getElementById("emptyState")
            .classList.remove("hidden");

    } finally {
        document.getElementById("loading")
            .classList.add("hidden");

        analyzeBtn.disabled = !chosenFile;
    }
});

// ==========================================
// LOAD DOCUMENT HISTORY
// ==========================================

async function loadHistory() {
    const list = document.getElementById("historyList");

    try {
        const docs = await requestJson(`${API}/documents`);

        if (!Array.isArray(docs)) {
            throw new Error("Invalid document history response.");
        }

        if (docs.length === 0) {
            list.innerHTML =
                '<p class="muted">No documents yet. Upload your first file.</p>';

            return;
        }

        list.innerHTML = docs.map((doc) => `
            <div class="history-row">
                <div class="doc-icon">PDF</div>

                <div class="doc-info">
                    <strong title="${escapeHtml(doc.filename)}">
                        ${escapeHtml(doc.filename)}
                    </strong>

                    <span>
                        ${doc.created_at
                            ? new Date(doc.created_at).toLocaleString()
                            : "-"}
                    </span>
                </div>

                <button
                    class="view-btn"
                    data-id="${escapeHtml(doc.id)}"
                >
                    View summary
                </button>
            </div>
        `).join("");

        // Attach view summary events
        list.querySelectorAll(".view-btn").forEach((button) => {
            button.addEventListener("click", async () => {
                try {
                    hideError();

                    const documentId = button.dataset.id;

                    const documentData = await requestJson(
                        `${API}/documents/${encodeURIComponent(documentId)}`
                    );

                    renderSummary(documentData);

                } catch (error) {
                    console.error("Load document error:", error);
                    showError(error.message);
                }
            });
        });

    } catch (error) {
        console.error("History loading error:", error);

        list.innerHTML =
            '<p class="muted">Could not load document history.</p>';
    }
}

// ==========================================
// HTML ESCAPE
// ==========================================

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character];
    });
}

// ==========================================
// API HEALTH CHECK
// ==========================================

async function checkApi() {
    try {
        const data = await requestJson(`${API}/health`);

        if (data.status === "healthy") {
            apiStatus.textContent = "API online";
            apiStatus.className = "status ok";
        } else {
            apiStatus.textContent = "API degraded";
            apiStatus.className = "status bad";
        }

    } catch (error) {
        console.error("API health check error:", error);

        apiStatus.textContent = "API offline";
        apiStatus.className = "status bad";
    }
}

// ==========================================
// REFRESH HISTORY
// ==========================================

document.getElementById("refreshBtn")
    .addEventListener("click", loadHistory);

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

checkApi();
loadHistory();
