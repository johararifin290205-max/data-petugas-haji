
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

// ==========================================
// KONFIGURASI PDF.JS
// ==========================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

// ==========================================
// ELEMEN HTML
// ==========================================

const $ = (id) => document.getElementById(id);

const listView = $("listView");
const viewerView = $("viewerView");
const documentList = $("documentList");
const searchInput = $("searchInput");
const documentCount = $("documentCount");
const emptyState = $("emptyState");
const loadError = $("loadError");

// ==========================================
// STATE / VARIABEL
// ==========================================

let documents = [];
let pdfDocument = null;
let currentPage = 1;
let scale = 1;
let currentUrl = "";
let renderTask = null;

let textIndex = [];
let searchMatches = [];
let currentMatch = -1;

let loadingNumber = 0;

// ==========================================
// MANAJEMEN URL
// ==========================================

function updatePdfUrl(file, method = "pushState") {
  const url = new URL(window.location.href);

  if (file) {
    url.searchParams.set("pdf", file);
  } else {
    url.searchParams.delete("pdf");
  }

  history[method]({}, "", url);
}

// ==========================================
// MEMBACA DAFTAR JSON
// ==========================================

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
      throw new Error("Format daftar.json harus berupa array.");
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
    documentCount.textContent =
      "Daftar dokumen belum dapat dimuat";

    loadError.hidden = false;

    loadError.textContent =
      `${error.message} Pastikan website dijalankan melalui server lokal atau hosting.`;
  }
}

// ==========================================
// MENAMPILKAN DAFTAR PDF
// ==========================================

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

// ==========================================
// MEMBUKA VIEWER
// ==========================================

function showViewer() {
  listView.hidden = true;
  viewerView.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ==========================================
// MEMBERSIHKAN PDF SEBELUM DITUTUP
// ==========================================

function disposePdf() {
  loadingNumber++;

  if (renderTask) {
    try {
      renderTask.cancel();
    } catch (_) {}

    renderTask = null;
  }

  if (pdfDocument) {
    const oldDocument = pdfDocument;

    pdfDocument = null;

    oldDocument.destroy().catch(() => {});
  }

  textIndex = [];
  searchMatches = [];
  currentMatch = -1;
}

// ==========================================
// KEMBALI KE DAFTAR
// ==========================================

function showList(updateUrl = true) {
  disposePdf();

  $("searchStatus").textContent = "";
  $("pdfSearchInput").value = "";

  viewerView.hidden = true;
  listView.hidden = false;

  if (updateUrl) {
    updatePdfUrl(null, "replaceState");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

$("backButton").addEventListener("click", () => {
  showList();
});

// ==========================================
// MEMBUKA PDF
// ==========================================

async function openPdf(item, updateUrl = true) {

  if (updateUrl) {
    updatePdfUrl(item.file);
  }

  const thisLoading = ++loadingNumber;

  if (renderTask) {
    try {
      renderTask.cancel();
    } catch (_) {}

    renderTask = null;
  }

  if (pdfDocument) {
    const oldDocument = pdfDocument;
    pdfDocument = null;

    try {
      await oldDocument.destroy();
    } catch (_) {}
  }

  if (thisLoading !== loadingNumber) return;

  textIndex = [];
  searchMatches = [];
  currentMatch = -1;

  showViewer();

  $("viewerTitle").textContent = item.judul;

  $("pdfLoading").hidden = false;
  $("pdfLoading").textContent = "Memuat PDF...";

  $("pdfError").hidden = true;
  $("pdfStage").hidden = true;

  $("searchStatus").textContent = "";

  $("pdfSearchInput").value = "";

  $("downloadButton").href = "";
  $("downloadButton").removeAttribute("download");

  currentUrl =
    `./pdf/${encodeURIComponent(item.file).replace(/%2F/gi, "/")}`;

  $("downloadButton").href = currentUrl;
  $("downloadButton").download = item.file;

  try {

    const loadingTask = pdfjsLib.getDocument({
      url: currentUrl
    });

    const loadedDocument = await loadingTask.promise;

    if (thisLoading !== loadingNumber) {
      loadedDocument.destroy().catch(() => {});
      return;
    }

    pdfDocument = loadedDocument;

    currentPage = 1;
    scale = 1;

    $("pageTotal").textContent =
      `/ ${pdfDocument.numPages}`;

    $("pageNumber").value = currentPage;

    $("zoomLabel").textContent = "100%";

    $("pageInfoTop").textContent =
      `${pdfDocument.numPages} halaman`;

    $("pdfLoading").hidden = true;
    $("pdfStage").hidden = false;

    await renderPage(currentPage);

    if (thisLoading === loadingNumber) {
      buildTextIndex();
    }

  } catch (error) {

    if (thisLoading !== loadingNumber) return;

    $("pdfLoading").hidden = true;
    $("pdfError").hidden = false;

    $("pdfError").textContent =
      `PDF tidak dapat dibuka. Periksa nama file dan folder pdf/. Detail: ${error.message}`;

  }
}

// ==========================================
// MEMBUKA PDF BERDASARKAN LINK
// ==========================================

function openPdfFromUrl() {

  const params = new URLSearchParams(
    window.location.search
  );

  const filename = params.get("pdf");

  if (!filename) return;

  const item = documents.find(doc =>
    doc.file === filename
  );

  if (item) {
    openPdf(item, false);
  } else {
    $("loadError").hidden = false;

    $("loadError").textContent =
      `Dokumen "${filename}" tidak ditemukan dalam daftar.json.`;
  }
}

// ==========================================
// RENDER HALAMAN PDF
// ==========================================

async function renderPage(pageNumber) {

  if (!pdfDocument) return;

  const activeDocument = pdfDocument;

  if (renderTask) {
    try {
      renderTask.cancel();
    } catch (_) {}

    renderTask = null;
  }

  const page = await activeDocument.getPage(pageNumber);

  if (pdfDocument !== activeDocument) return;

  const canvas = $("pdfCanvas");
  const context = canvas.getContext("2d");

  const baseViewport = page.getViewport({
    scale: 1
  });

  const availableWidth = Math.max(
    280,
    $("pdfStage").clientWidth - 30
  );

  const fitScale = Math.min(
    1.5,
    availableWidth / baseViewport.width
  );

  const viewport = page.getViewport({
    scale: fitScale * scale
  });

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

  const transform = outputScale !== 1
    ? [
        outputScale, 0,
        0, outputScale,
        0, 0
      ]
    : null;

  const task = page.render({
    canvasContext: context,
    viewport,
    transform
  });

  renderTask = task;

  try {

    await task.promise;

  } catch (error) {

    if (
      error.name !== "RenderingCancelledException"
    ) {
      throw error;
    }

  } finally {

    if (renderTask === task) {
      renderTask = null;
    }

  }

  if (pdfDocument !== activeDocument) return;

  $("pageNumber").value = pageNumber;

  $("prevPage").disabled =
    pageNumber <= 1;

  $("nextPage").disabled =
    pageNumber >= activeDocument.numPages;
}

// ==========================================
// NAVIGASI HALAMAN
// ==========================================

async function changePage(nextPage) {

  if (!pdfDocument) return;

  const target = Math.min(
    pdfDocument.numPages,
    Math.max(1, nextPage)
  );

  if (target === currentPage) return;

  currentPage = target;

  try {
    await renderPage(currentPage);
  } catch (error) {
    console.error(error);
  }
}

$("prevPage").addEventListener("click", () => {
  changePage(currentPage - 1);
});

$("nextPage").addEventListener("click", () => {
  changePage(currentPage + 1);
});

$("pageNumber").addEventListener("change", () => {

  const page = Number.parseInt(
    $("pageNumber").value,
    10
  );

  changePage(
    Number.isFinite(page) ? page : 1
  );

});

// ==========================================
// ZOOM IN
// ==========================================

$("zoomIn").addEventListener("click", async () => {

  if (!pdfDocument) return;

  scale = Math.min(3, scale + 0.2);

  $("zoomLabel").textContent =
    `${Math.round(scale * 100)}%`;

  try {
    await renderPage(currentPage);
  } catch (error) {
    console.error(error);
  }

});

// ==========================================
// ZOOM OUT
// ==========================================

$("zoomOut").addEventListener("click", async () => {

  if (!pdfDocument) return;

  scale = Math.max(0.5, scale - 0.2);

  $("zoomLabel").textContent =
    `${Math.round(scale * 100)}%`;

  try {
    await renderPage(currentPage);
  } catch (error) {
    console.error(error);
  }

});

// ==========================================
// FULLSCREEN
// ==========================================

$("fullscreenButton").addEventListener("click", async () => {

  const shell = $("viewerShell");

  try {

    if (!document.fullscreenElement) {

      if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else {
        throw new Error("Fullscreen API tidak tersedia.");
      }

    } else {

      await document.exitFullscreen();

    }

  } catch (error) {

    // Fallback untuk WebView Android
    const isFullscreen =
      shell.classList.toggle("css-fullscreen");

    document.body.classList.toggle(
      "viewer-expanded",
      isFullscreen
    );

    $("searchStatus").textContent =
      isFullscreen
        ? "Mode layar penuh aktif."
        : "Mode layar penuh ditutup.";

  }

  if (pdfDocument) {
    requestAnimationFrame(() => {
      renderPage(currentPage).catch(console.error);
    });
  }

});

// ==========================================
// MEMBANGUN INDEX PENCARIAN TEKS PDF
// ==========================================

async function buildTextIndex() {

  if (!pdfDocument) return;

  const thisDocument = pdfDocument;

  textIndex = [];

  $("searchStatus").textContent =
    "Menyiapkan pencarian teks...";

  try {

    for (
      let pageNo = 1;
      pageNo <= thisDocument.numPages;
      pageNo++
    ) {

      if (pdfDocument !== thisDocument) return;

      const page = await thisDocument.getPage(pageNo);

      const content = await page.getTextContent();

      const text = content.items
        .map(item => item.str || "")
        .join(" ");

      textIndex.push({
        page: pageNo,
        text: text.toLocaleLowerCase("id")
      });

    }

    if (pdfDocument === thisDocument) {
      $("searchStatus").textContent =
        "Pencarian teks siap.";
    }

  } catch (_) {

    $("searchStatus").textContent =
      "Pencarian teks tidak dapat disiapkan untuk dokumen ini.";

  }

}

// ==========================================
// PENCARIAN TEKS PDF
// ==========================================

function runSearch(direction = 1) {

  const query = $("pdfSearchInput")
    .value
    .trim()
    .toLocaleLowerCase("id");

  if (!query) {

    $("searchStatus").textContent =
      "Masukkan kata yang ingin dicari.";

    return;
  }

  if (!textIndex.length) {

    $("searchStatus").textContent =
      "Teks PDF masih disiapkan atau tidak tersedia.";

    return;
  }

  searchMatches = [];

  textIndex.forEach(entry => {

    let start = 0;

    while (true) {

      const found = entry.text.indexOf(
        query,
        start
      );

      if (found === -1) break;

      searchMatches.push({
        page: entry.page,
        index: found
      });

      start = found + Math.max(
        1,
        query.length
      );

    }

  });

  if (!searchMatches.length) {

    currentMatch = -1;

    $("searchStatus").textContent =
      "Teks tidak ditemukan. Jika PDF berupa hasil scan/foto, diperlukan OCR agar teks dapat dicari.";

    return;
  }

  if (direction === 0) {

    currentMatch = 0;

  } else if (currentMatch < 0) {

    currentMatch = 0;

  } else {

    currentMatch =
      (
        currentMatch +
        direction +
        searchMatches.length
      ) % searchMatches.length;

  }

  const match = searchMatches[currentMatch];

  $("searchStatus").textContent =
    `Hasil ${currentMatch + 1} dari ${searchMatches.length} · Halaman ${match.page}.`;

  changePage(match.page);

}

// ==========================================
// TOMBOL PENCARIAN PDF
// ==========================================

$("pdfSearchForm").addEventListener("submit", event => {

  event.preventDefault();

  runSearch(0);

});

$("searchNext").addEventListener("click", () => {
  runSearch(1);
});

$("searchPrev").addEventListener("click", () => {
  runSearch(-1);
});

// ==========================================
// TOMBOL BACK BROWSER / ANDROID
// ==========================================

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

// ==========================================
// INISIALISASI WEBSITE
// ==========================================

async function initializeWebsite() {

  await loadDocuments();

  // Jika URL mempunyai parameter ?pdf=
  // maka dokumen langsung dibuka.
  openPdfFromUrl();

}

initializeWebsite();
