
/* ==========================================
   DATA PETUGAS HAJI
   PDF.JS 3.11.174
   KOMPATIBILITAS BROWSER ANDROID
========================================== */


/* ==========================================
   1. KONFIGURASI PDF.JS
========================================== */

const pdfjsLib = window.pdfjsLib;

if (!pdfjsLib) {
    console.error("PDF.js gagal dimuat.");

    document.addEventListener("DOMContentLoaded", () => {
        const error = document.getElementById("pdfError");

        if (error) {
            error.hidden = false;
            error.textContent =
                "Library PDF gagal dimuat. Periksa koneksi internet dan CDN PDF.js.";
        }
    });

    throw new Error("PDF.js tidak tersedia.");
}

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


/* ==========================================
   2. ELEMEN HTML
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
   3. STATE / VARIABEL
========================================== */

let documents = [];

let pdfDocument = null;
let pdfLoadingTask = null;

let currentUrl = "";

let loadingNumber = 0;

let renderTasks = [];

let resizeTimer = null;


/* ==========================================
   4. MANAJEMEN URL
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
   5. MEMBACA DAFTAR.JSON
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
   6. MENAMPILKAN DAFTAR DOKUMEN
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
   7. MENAMPILKAN MODE PDF
========================================== */

function showViewer() {

    document.body.classList.add("pdf-only");

    listView.hidden = true;

    viewerView.hidden = false;

    window.scrollTo(0, 0);

}


/* ==========================================
   8. MEMBERSIHKAN PDF LAMA
========================================== */

async function disposePdf() {

    // Batalkan seluruh render aktif

    renderTasks.forEach(task => {

        try {
            task.cancel();
        } catch (_) {}

    });

    renderTasks = [];


    // Hentikan loading PDF

    if (pdfLoadingTask) {

        const oldTask = pdfLoadingTask;

        pdfLoadingTask = null;

        try {
            await oldTask.destroy();
        } catch (_) {}

    }


    // Hancurkan dokumen lama

    if (pdfDocument) {

        const oldDocument = pdfDocument;

        pdfDocument = null;

        try {
            await oldDocument.destroy();
        } catch (_) {}

    }


    // Kosongkan tampilan

    pdfStage.replaceChildren();

}


/* ==========================================
   9. KEMBALI KE DAFTAR
========================================== */

async function showList(updateUrl = true) {

    loadingNumber++;

    await disposePdf();

    document.body.classList.remove("pdf-only");

    viewerView.hidden = true;

    listView.hidden = false;

    pdfLoading.hidden = true;

    pdfError.hidden = true;

    pdfStage.hidden = true;

    if (updateUrl) {
        updatePdfUrl(null, "replaceState");
    }

    window.scrollTo(0, 0);

}


/* ==========================================
   10. MEMBUKA PDF
========================================== */

async function openPdf(item, updateUrl = true) {

    if (!item || !item.file) return;

    // Perbarui URL browser

    if (updateUrl) {
        updatePdfUrl(item.file);
    }

    // Nomor proses aktif

    const thisLoading = ++loadingNumber;

    // Hentikan proses PDF sebelumnya

    await disposePdf();

    // Abaikan jika ada permintaan baru

    if (thisLoading !== loadingNumber) return;

    // Tampilkan viewer

    showViewer();

    // Bersihkan error dan loading

    pdfError.hidden = true;

    pdfLoading.hidden = false;

    pdfLoading.textContent =
        "Memuat dokumen PDF...";

    pdfStage.hidden = true;


    // Alamat PDF

    currentUrl =
        "./pdf/" + encodeURIComponent(item.file);


    try {

        // Mulai memuat PDF

        const loadingTask = pdfjsLib.getDocument({

            url: currentUrl,

            disableAutoFetch: false,

            disableStream: false,

            rangeChunkSize: 65536

        });

        pdfLoadingTask = loadingTask;


        // Tunggu PDF selesai dimuat

        const loadedDocument = await loadingTask.promise;


        // Periksa apakah proses masih aktif

        if (thisLoading !== loadingNumber) {

            await loadedDocument.destroy();

            return;

        }


        // Simpan dokumen aktif

        pdfDocument = loadedDocument;

        pdfLoadingTask = null;


        // Tampilkan area PDF

        pdfLoading.hidden = true;

        pdfStage.hidden = false;


        // Render seluruh halaman

        await renderAllPages(
            loadedDocument,
            thisLoading
        );


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
   11. RENDER SEMUA HALAMAN PDF
========================================== */

async function renderAllPages(
    documentPdf,
    activeLoading
) {

    if (!documentPdf) return;

    pdfStage.replaceChildren();

    const totalPages = documentPdf.numPages;


    // Render halaman satu per satu

    for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber++
    ) {

        // Validasi dokumen

        if (
            documentPdf !== pdfDocument ||
            activeLoading !== loadingNumber
        ) {
            return;
        }


        // Ambil halaman PDF

        const page = await documentPdf.getPage(pageNumber);


        if (
            documentPdf !== pdfDocument ||
            activeLoading !== loadingNumber
        ) {
            return;
        }


        // Pembungkus halaman

        const pageContainer =
            document.createElement("div");

        pageContainer.className = "pdf-page";


        // Canvas halaman

        const canvas =
            document.createElement("canvas");

        const context = canvas.getContext("2d", {
            alpha: false
        });

        if (!context) {
            throw new Error(
                "Browser tidak mendukung Canvas."
            );
        }


        pageContainer.appendChild(canvas);

        pdfStage.appendChild(pageContainer);


        // Ukuran asli PDF

        const baseViewport = page.getViewport({
            scale: 1
        });


        // Sesuaikan dengan lebar layar

        const availableWidth = Math.max(
            200,
            pdfStage.clientWidth
        );

        const fitScale = Math.min(
            1.5,
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


        // Proses render

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
   12. MEMBUKA PDF DARI LINK LANGSUNG
========================================== */

function openPdfFromUrl() {

    const params = new URLSearchParams(
        window.location.search
    );

    const filename = params.get("pdf");


    // Jika tidak ada PDF di URL

    if (!filename) {

        document.body.classList.remove("pdf-only");

        viewerView.hidden = true;

        listView.hidden = false;

        return;

    }


    // Cari dokumen

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
   13. TOMBOL BACK BROWSER / ANDROID
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
   14. PENYESUAIAN UKURAN LAYAR
========================================== */

window.addEventListener("resize", () => {

    if (!pdfDocument) return;

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(async () => {

        if (!pdfDocument) return;

        const activeDocument = pdfDocument;

        const activeLoading = loadingNumber;

        try {

            await renderAllPages(
                activeDocument,
                activeLoading
            );

        } catch (error) {

            console.error(
                "Resize PDF Error:",
                error
            );

        }

    }, 400);

});


/* ==========================================
   15. INISIALISASI WEBSITE
========================================== */

async function initializeWebsite() {

    await loadDocuments();

    openPdfFromUrl();

}


// Jalankan website

initializeWebsite();
