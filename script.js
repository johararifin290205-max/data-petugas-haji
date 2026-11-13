
// ==========================================
// DATA PETUGAS HAJI
// DIRECT PDF SYSTEM
// ==========================================

const $ = (id) => document.getElementById(id);

// ==========================================
// ELEMEN HTML
// ==========================================

const listView = $("listView");
const documentList = $("documentList");
const searchInput = $("searchInput");
const documentCount = $("documentCount");
const emptyState = $("emptyState");
const loadError = $("loadError");

// ==========================================
// VARIABEL
// ==========================================

let documents = [];

// ==========================================
// MEMBUAT URL PDF ASLI
// ==========================================

function getPdfUrl(filename) {

  // Pastikan nama file valid
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
      item.judul.trim() !== "" &&
      item.file.trim() !== ""
    );

    renderList();

  } catch (error) {

    documentCount.textContent =
      "Daftar dokumen belum dapat dimuat";

    loadError.hidden = false;

    loadError.textContent =
      error.message;

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
    item.judul
      .toLocaleLowerCase("id")
      .includes(keyword)
  );

  documentList.replaceChildren();

  documentCount.textContent =
    `${filtered.length} dokumen tersedia`;

  emptyState.hidden =
    filtered.length !== 0;

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

    // Klik kartu langsung membuka PDF asli
    card.addEventListener("click", () => {

      try {

        const pdfUrl = getPdfUrl(item.file);

        window.location.href = pdfUrl;

      } catch (error) {

        alert(error.message);

      }

    });

    documentList.appendChild(card);

  });

}

// ==========================================
// PENCARIAN JUDUL
// ==========================================

searchInput.addEventListener(
  "input",
  renderList
);

// ==========================================
// MEMBUKA PDF DARI LINK LANGSUNG
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

  if (!item) {

    loadError.hidden = false;

    loadError.textContent =
      `Dokumen ${filename} tidak ditemukan dalam daftar.json.`;

    return;

  }

  try {

    const pdfUrl = getPdfUrl(item.file);

    // Langsung arahkan ke file PDF asli
    window.location.replace(pdfUrl);

  } catch (error) {

    loadError.hidden = false;
    loadError.textContent = error.message;

  }

}

// ==========================================
// INISIALISASI WEBSITE
// ==========================================

async function initializeWebsite() {

  await loadDocuments();

  // Cek apakah URL meminta PDF tertentu
  openPdfFromUrl();

}

// Jalankan website
initializeWebsite();
