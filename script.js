
/* ==========================================
   KOMPATIBILITAS BROWSER ANDROID
========================================== */

if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function () {
        let resolve;
        let reject;

        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        return {
            promise,
            resolve,
            reject
        };
    };
}


/* ==========================================
   KONFIGURASI PDF.JS
========================================== */

const pdfjsLib = await import(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
);

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";


/* ==========================================
   ELEMEN HTML
========================================== */

const $ = (id) => document.getElementById(id);

const listView = $("listView");
const viewerView = $("viewerView");

const documentList = $("documentList");
const searchInput = $("searchInput");
const documentCount = $("documentCount");

const emptyState = $("emptyState");
const loadError = $("loadError");

const pdfLoading = $("pdfLoading");
const pdfError = $("pdfError");
const pdfStage = $("pdfStage");


/* ==========================================
   STATE / VARIABEL
========================================== */

let documents = [];

let pdfDocument = null;
let pdfLoadingTask = null;

let currentUrl = "";

let loadingNumber = 0;
let renderTasks = [];

let resizeTimer = null;


/* ==========================================
   MANAJEMEN URL
========================================== */

function updatePdfUrl(file, method = "pushState") {

    const url = new URL(window.location.href);

    if (file) {
        url.searchParams.set("pdf", file);
    } else {
        url.searchParams.delete("pdf");
    }

    history[method]({}, "", url);

}


/* ==========================================
   MEMBACA DAFTAR JSON
========================================== */

async function loadDocuments() {

    try {

        const response = await fetch("./daftar.json", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Gagal membaca daftar.json (HTTP ${response.status}).`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(
                "Format daftar.json harus berupa array."
            );
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

        console.error("Load Documents Error:", error);

        documentCount.textContent =
            "Daftar dokumen belum dapat dimuat";

        loadError.hidden = false;

        loadError.textContent =
            `${error.message} Pastikan daftar.json tersedia di folder utama website.`;

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
                <small>Dokumen PDF · Klik untuk membaca</small>
            </span>

            <span class="card-arrow" aria-hidden="true">›</span>
        `;

        card.querySelector("strong").textContent =
            item.judul;

        card.addEventListener("click", () => {
            openPdf(item);
        });

        documentList.appendChild(card);

    });

}

searchInput.addEventListener("input", renderList);


/* ==========================================
   MENAMPILKAN PDF VIEWER
========================================== */

function showViewer() {

    document.body.classList.add("pdf-only");

    listView.hidden = true;
    viewerView.hidden = false;

    window.scrollTo(0, 0);

}


/* ==========================================
   MENGHENTIKAN PROSES PDF
========================================== */

async function disposePdf() {

    loadingNumber++;

    // Hentikan semua proses render

    renderTasks.forEach(task => {

        try {
            task.cancel();
        } catch (_) {}

    });

    renderTasks = [];

    // Hentikan proses loading

    if (pdfLoadingTask) {

        const oldTask = pdfLoadingTask;

        pdfLoadingTask = null;

        try {
            await oldTask.destroy();
        } catch (_) {}

    }

    // Hapus dokumen lama

    if (pdfDocument) {

        const oldDocument = pdfDocument;

        pdfDocument = null;

        try {
            await oldDocument.destroy();
        } catch (_) {}

    }

    pdfStage.replaceChildren();

}


/* ==========================================
   KEMBALI KE DAFTAR
========================================== */

async function showList(updateUrl = true) {

    await disposePdf();

    document.body.classList.remove("pdf-only");

    viewerView.hidden = true;
    listView.hidden = false;

    pdfLoading.hidden = true;
    pdfError.hidden = true;

    if (updateUrl) {
        updatePdfUrl(null, "replaceState");
    }

    window.scrollTo(0, 0);

}


/* ==========================================
   MEMBUKA PDF
========================================== */

async function openPdf(item, updateUrl = true) {

    if (!item || !item.file) return;

    // Perbarui URL

    if (updateUrl) {
        updatePdfUrl(item.file);
    }

    const thisLoading = ++loadingNumber;

    // Hentikan proses sebelumnya

    renderTasks.forEach(task => {
        try {
            task.cancel();
        } catch (_) {}
    });

    renderTasks = [];

    if (pdfLoadingTask) {

        const oldTask = pdfLoadingTask;

        pdfLoadingTask = null;

        try {
            await oldTask.destroy();
        } catch (_) {}

    }

    if (pdfDocument) {

        const oldDocument = pdfDocument;

        pdfDocument = null;

        try {
            await oldDocument.destroy();
        } catch (_) {}

    }

    // Periksa apakah masih merupakan proses terbaru

    if (thisLoading !== loadingNumber) return;

    // Bersihkan viewer

    pdfStage.replaceChildren();

    pdfError.hidden = true;

    pdfLoading.hidden = false;

    pdfLoading.textContent =
        "Memuat dokumen PDF...";

    pdfStage.hidden = true;

    // Tampilkan mode PDF saja

    showViewer();

    // Buat alamat file PDF

    currentUrl =
        "./pdf/" + encodeURIComponent(item.file);

    try {

        // Muat PDF

        const loadingTask = pdfjsLib.getDocument({

            url: currentUrl,

            // Kompatibilitas pengambilan file

            disableAutoFetch: false,

            disableStream: false,

            rangeChunkSize: 65536

        });

        pdfLoadingTask = loadingTask;

        const loadedDocument = await loadingTask.promise;

        // Abaikan proses lama

        if (thisLoading !== loadingNumber) {

            await loadedDocument.destroy();

            return;

        }

        pdfDocument = loadedDocument;

        pdfLoadingTask = null;

        // Sembunyikan loading

        pdfLoading.hidden = true;

        pdfStage.hidden = false;

        // Render semua halaman

        await renderAllPages(loadedDocument, thisLoading);

    } catch (error) {

        if (thisLoading !== loadingNumber) return;

        console.error("PDF Error:", error);

        pdfLoading.hidden = true;

        pdfStage.hidden = true;

        pdfError.hidden = false;

        pdfError.textContent =
            `PDF tidak dapat ditampilkan. Periksa file PDF, nama file, dan koneksi internet. Detail: ${error.message}`;

    }

}


/* ==========================================
   RENDER SEMUA HALAMAN PDF
========================================== */

async function renderAllPages(documentPdf, activeLoading) {

    if (!documentPdf) return;

    pdfStage.replaceChildren();

    const totalPages = documentPdf.numPages;

    for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber++
    ) {

        // Pastikan dokumen masih aktif

        if (
            documentPdf !== pdfDocument ||
            activeLoading !== loadingNumber
        ) {
            return;
        }

        const page = await documentPdf.getPage(pageNumber);

        if (
            documentPdf !== pdfDocument ||
            activeLoading !== loadingNumber
        ) {
            return;
        }

        // Buat pembungkus halaman

        const pageContainer = document.createElement("div");

        pageContainer.className = "pdf-page";

        // Buat canvas baru untuk setiap halaman

        const canvas = document.createElement("canvas");

        const context = canvas.getContext("2d", {
            alpha: false
        });

        if (!context) {
            throw new Error("Canvas tidak dapat dibuat.");
        }

        pageContainer.appendChild(canvas);

        pdfStage.appendChild(pageContainer);

        // Ukuran asli halaman

        const baseViewport = page.getViewport({
            scale: 1
        });

        // Sesuaikan lebar dengan layar

        const availableWidth = Math.max(
            200,
            pdfStage.clientWidth
        );

        const fitScale = Math.min(
            2,
            availableWidth / baseViewport.width
        );

        const viewport = page.getViewport({
            scale: fitScale
        });

        // Resolusi layar

        const outputScale = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        canvas.width = Math.floor(
            viewport.width * outputScale
        );

        canvas.height = Math.floor(
            viewport.height * outputScale
        );

        canvas.style.width =
            `${Math.floor(viewport.width)}px`;

        canvas.style.height =
            `${Math.floor(viewport.height)}px`;

        // Render halaman

        const renderTask = page.render({

            canvasContext: context,

            viewport: viewport,

            transform: [
                outputScale,
                0,
                0,
                outputScale,
                0,
                0
            ],

            background: "#ffffff"

        });

        renderTasks.push(renderTask);

        try {

            await renderTask.promise;

        } catch (error) {

            if (
                error.name === "RenderingCancelledException"
            ) {
                return;
            }

            throw error;

        } finally {

            renderTasks = renderTasks.filter(
                task => task !== renderTask
            );

        }

    }

    console.log(
        `Berhasil menampilkan ${totalPages} halaman PDF.`
    );

}


/* ==========================================
   MEMBUKA PDF DARI LINK LANGSUNG
========================================== */

function openPdfFromUrl() {

    const params = new URLSearchParams(
        window.location.search
    );

    const filename = params.get("pdf");

    // Tidak ada parameter PDF

    if (!filename) {

        document.body.classList.remove("pdf-only");

        viewerView.hidden = true;
        listView.hidden = false;

        return;

    }

    // Cari dokumen di daftar JSON

    const item = documents.find(doc =>
        doc.file === filename
    );

    if (item) {

        openPdf(item, false);

    } else {

        document.body.classList.remove("pdf-only");

        viewerView.hidden = true;
        listView.hidden = false;

        loadError.hidden = false;

        loadError.textContent =
            `Dokumen "${filename}" tidak ditemukan dalam daftar.json.`;

    }

}


/* ==========================================
   TOMBOL BACK BROWSER / ANDROID
========================================== */

window.addEventListener("popstate", () => {

    const params = new URLSearchParams(
        window.location.search
    );

    const filename = params.get("pdf");

    if (filename) {

        const item = documents.find(doc =>
            doc.file === filename
        );

        if (item) {

            openPdf(item, false);

            return;

        }

    }

    showList(false);

});


/* ==========================================
   PENYESUAIAN UKURAN LAYAR
========================================== */

window.addEventListener("resize", () => {

    if (!pdfDocument) return;

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {

        if (!pdfDocument) return;

        const activeDocument = pdfDocument;

        const activeLoading = loadingNumber;

        renderAllPages(
            activeDocument,
            activeLoading
        ).catch(error => {
            console.error("Resize PDF Error:", error);
        });

    }, 300);

});


/* ==========================================
   INISIALISASI WEBSITE
========================================== */

async function initializeWebsite() {

    await loadDocuments();

    openPdfFromUrl();

}

initializeWebsite();
