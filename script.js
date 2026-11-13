
/* ==========================================
   DATA PETUGAS HAJI
   MODE: DOWNLOAD PDF LANGSUNG
========================================== */

const $ = (id) => document.getElementById(id);

const listView = $("listView");
const viewerView = $("viewerView");
const documentList = $("documentList");
const searchInput = $("searchInput");
const documentCount = $("documentCount");
const emptyState = $("emptyState");
const loadError = $("loadError");

let documents = [];

/* ==========================================
   MEMUAT DAFTAR DOKUMEN
========================================== */

async function loadDocuments() {
    try {
        const response = await fetch("./daftar.json", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Gagal memuat daftar dokumen.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Format daftar.json tidak valid.");
        }

        documents = data.filter(item =>
            item &&
            typeof item.judul === "string" &&
            typeof item.file === "string" &&
            item.judul.trim() &&
            item.file.trim()
        );

        renderList();

    } catch (error) {
        console.error(error);

        documentCount.textContent =
            "Daftar dokumen gagal dimuat";

        loadError.hidden = false;
        loadError.textContent = error.message;
    }
}

/* ==========================================
   MENAMPILKAN DAFTAR DOKUMEN
========================================== */

function renderList() {
    const keyword = searchInput.value
        .trim()
        .toLocaleLowerCase("id");

    const filtered = documents.filter(item =>
        item.judul.toLocaleLowerCase("id").includes(keyword)
    );

    documentList.replaceChildren();

    documentCount.textContent =
        `${filtered.length} dokumen tersedia`;

    emptyState.hidden = filtered.length !== 0;

    filtered.forEach(item => {
        const card = document.createElement("button");

        card.type = "button";
        card.className = "document-card";

        card.innerHTML = `
            <span class="pdf-icon">PDF</span>

            <span class="card-copy">
                <strong></strong>
                <small>Dokumen PDF · Klik untuk mengunduh</small>
            </span>

            <span class="card-arrow" aria-hidden="true">↓</span>
        `;

        card.querySelector("strong").textContent =
            item.judul;

        card.addEventListener("click", () => {
            downloadPdf(item);
        });

        documentList.appendChild(card);
    });
}

/* ==========================================
   DOWNLOAD PDF LANGSUNG
========================================== */

function downloadPdf(item) {
    if (!item || !item.file) return;

    const link = document.createElement("a");

    link.href = "./pdf/" +
        item.file.split("/").map(part =>
            encodeURIComponent(part)
        ).join("/");

    link.download = item.file.split("/").pop();

    link.style.display = "none";

    document.body.appendChild(link);

    link.click();

    link.remove();
}

/* ==========================================
   PENCARIAN DOKUMEN
========================================== */

searchInput.addEventListener("input", renderList);

/* ==========================================
   INISIALISASI
========================================== */

async function initializeWebsite() {
    if (listView) listView.hidden = false;
    if (viewerView) viewerView.hidden = true;

    document.body.classList.remove("pdf-only");

    await loadDocuments();
}

initializeWebsite();
