
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
// VARIABEL
// ==========================================

let documents = [];
let pdfDocument = null;
let loadingTask = null;
let renderVersion = 0;

// ==========================================
// CSS VIEWER PDF MINIMALIS
// ==========================================

function installViewerStyle() {

  if ($("purePdfStyle")) return;

  const style = document.createElement("style");

  style.id = "purePdfStyle";

  style.textContent = `
    body.pdf-only {
      margin: 0 !important;
      padding: 0 !important;
      background: #e9ece9 !important;
      overflow-x: hidden !important;
    }

    body.pdf-only * {
      visibility: hidden !important;
    }

    body.pdf-only #viewerView,
    body.pdf-only #viewerView * {
      visibility: visible !important;
    }

    body.pdf-only #viewerView {
      display: block !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 999999 !important;
      width: 100vw !important;
      height: 100dvh !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #e9ece9 !important;
      box-sizing: border-box !important;
    }

    body.pdf-only #viewerView[hidden] {
      display: block !important;
    }

    .pure-pdf-container {
      width: 100%;
      min-height: 100%;
      padding: 12px 0;
      box-sizing: border-box;
    }

    .pure-pdf-page {
      display: flex;
      justify-content: center;
      width: 100%;
      margin: 0 auto 12px;
      padding: 0;
      box-sizing: border-box;
    }

    .pure-pdf-page canvas {
      display: block;
      max-width: 100%;
      height: auto;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
    }

    .pure-pdf-message {
      padding: 35px 20px;
      text-align: center;
      color: #555;
      font: 16px Arial, sans-serif;
    }

    @media (min-width: 768px) {
      .pure-pdf-container {
        padding: 20px;
      }

      .pure-pdf-page {
        margin-bottom: 20px;
      }
    }
  `;

  document.head.appendChild(style);
}

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
// MEMBUAT URL PDF
// ==========================================

function getPdfUrl(filename) {

  if (
    typeof filename !== "string" ||
    !filename.trim() ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new Error("Nama file PDF tidak valid.");
  }

  return new URL(
    "./pdf/" + encodeURIComponent(filename),
    window.location.href
  ).href;
}

// ==========================================
// MEMBACA DAFTAR.JSON
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

    documentCount.textContent =
      "Daftar dokumen belum dapat dimuat";

    loadError.hidden = false;
    loadError.textContent = error.message;

  }
}

// ==========================================
// MENAMPILKAN DAFTAR DOKUMEN
// ==========================================

function renderList() {

  const keyword = searchInput.value
    .trim()
    .toLocaleLowerCase("id");

  const filtered = documents.filter(item =>
    item.judul.toLocaleLowerCase("id")
      .includes(keyword)
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
// MEMBERSIHKAN PDF SEBELUM MEMBUKA BARU
// ==========================================

async function disposePdf() {

  if (loadingTask) {

    try {
      await loadingTask.destroy();
    } catch (_) {}

    loadingTask = null;
  }

  if (pdfDocument) {

    try {
      await pdfDocument.destroy();
    } catch (_) {}

    pdfDocument = null;
  }

}

// ==========================================
// MENAMPILKAN PESAN DI VIEWER
// ==========================================

function showMessage(message) {

  viewerView.hidden = false;

  viewerView.innerHTML = `
    <div class="pure-pdf-message"></div>
  `;

  viewerView.querySelector(
    ".pure-pdf-message"
  ).textContent = message;

}

// ==========================================
// MEMBUKA PDF
// ==========================================

async function openPdf(item, updateUrl = true) {

  const version = ++renderVersion;

  if (updateUrl) {
    updatePdfUrl(item.file);
  }

  document.body.classList.add("pdf-only");

  listView.hidden = true;
  viewerView.hidden = false;

  viewerView.innerHTML = `
    <div class="pure-pdf-message">
      Memuat dokumen PDF...
    </div>
  `;

  await disposePdf();

  if (version !== renderVersion) return;

  try {

    const pdfUrl = getPdfUrl(item.file);

    const task = pdfjsLib.getDocument({
      url: pdfUrl
    });

    loadingTask = task;

    const documentPdf = await task.promise;

    if (version !== renderVersion) {
      documentPdf.destroy().catch(() => {});
      return;
    }

    pdfDocument = documentPdf;
    loadingTask = null;

    await renderAllPages(documentPdf, version);

  } catch (error) {

    if (version !== renderVersion) return;

    console.error("PDF Error:", error);

    showMessage(
      "PDF tidak dapat ditampilkan. Periksa file PDF, nama file, dan koneksi internet. Detail: " +
      error.message
    );

  }

}

// ==========================================
// RENDER SELURUH HALAMAN PDF
// ==========================================

async function renderAllPages(documentPdf, version) {

  // Pertahankan pesan loading sampai halaman pertama selesai dirender.
  const loadingMessage = viewerView.querySelector(".pure-pdf-message");

  const container = document.createElement("div");

  container.className = "pure-pdf-container";

  viewerView.appendChild(container);

  for (
    let pageNumber = 1;
    pageNumber <= documentPdf.numPages;
    pageNumber++
  ) {

    if (
      version !== renderVersion ||
      pdfDocument !== documentPdf
    ) {
      return;
    }

    const page = await documentPdf.getPage(pageNumber);

    const baseViewport = page.getViewport({
      scale: 1
    });

    const availableWidth = Math.max(
      280,
      Math.min(
        window.innerWidth - 20,
        1200
      )
    );

    const fitScale =
      availableWidth / baseViewport.width;

    const viewport = page.getViewport({
      scale: fitScale
    });

    const outputScale = Math.min(
      window.devicePixelRatio || 1,
      1.5
    );

    const canvas = document.createElement("canvas");

    const context = canvas.getContext("2d");

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

    const pageWrapper = document.createElement("div");

    pageWrapper.className = "pure-pdf-page";

    pageWrapper.appendChild(canvas);

    container.appendChild(pageWrapper);

    const renderTask = page.render({
      canvasContext: context,
      viewport: viewport,
      transform: outputScale !== 1
        ? [
            outputScale, 0,
            0, outputScale,
            0, 0
          ]
        : null
    });

    await renderTask.promise;

    if (pageNumber === 1 && loadingMessage) {
      loadingMessage.remove();
    }

  }

}

// ==========================================
// MEMBUKA PDF BERDASARKAN LINK QR CODE
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

    showMessage(
      "Dokumen tidak ditemukan dalam daftar.json."
    );

  }

}

// ==========================================
// KEMBALI KE DAFTAR
// ==========================================

async function showList(updateUrl = true) {

  // Batalkan proses render yang mungkin masih berjalan.
  renderVersion++;

  await disposePdf();

  document.body.classList.remove("pdf-only");

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

// ==========================================
// TOMBOL KEMBALI JIKA MASIH ADA DI HTML
// ==========================================

if ($("backButton")) {

  $("backButton").addEventListener("click", () => {
    showList();
  });

}

// ==========================================
// TOMBOL BACK BROWSER
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

  installViewerStyle();

  await loadDocuments();

  openPdfFromUrl();

}

initializeWebsite();
