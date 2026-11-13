DATA PETUGAS HAJI - PETUNJUK

1. Menjalankan di komputer
   - Pastikan komputer terhubung ke internet (PDF.js dan Google Fonts menggunakan CDN).
   - Buka folder proyek di VS Code.
   - Jalankan ekstensi Live Server pada file index.html.
   - Alternatif jika Python terpasang:
       python -m http.server 8000
     Lalu buka http://localhost:8000
   - Jangan membuka index.html dengan klik dua kali (file://), karena browser biasanya memblokir fetch daftar.json dan pemuatan PDF.

2. Menambah PDF
   - Salin PDF ke folder pdf/.
   - Buka daftar.json.
   - Tambahkan objek dengan format:
       {
         "judul": "Judul dokumen baru",
         "file": "nama-file-baru.pdf"
       }
   - Pisahkan antarobjek dengan koma. Nama file harus sama persis, termasuk huruf besar/kecil.
   - Simpan, lalu muat ulang halaman.

3. Hosting gratis
   Pilihan mudah: GitHub Pages
   - Buat akun GitHub dan buat repository baru, misalnya data-petugas-haji.
   - Upload index.html, style.css, script.js, daftar.json dan seluruh isi folder pdf/.
   - Buka Settings > Pages.
   - Pada Build and deployment, pilih Deploy from a branch.
   - Pilih branch main dan folder /(root), lalu Save.
   - Tunggu proses publikasi. Alamat website akan tampil di halaman Pages.
   Catatan: repository dan PDF yang dipublikasikan bersifat publik. Jangan unggah data pribadi/sensitif tanpa izin dan pengamanan yang sesuai.

   Alternatif: Cloudflare Pages
   - Buat akun Cloudflare, buka Workers & Pages > Create > Pages.
   - Hubungkan repository GitHub yang berisi proyek ini.
   - Untuk situs statis HTML biasa, gunakan root directory / dan tanpa build command.
   - Deploy dan gunakan alamat pages.dev yang diberikan.

4. Catatan
   - PDF.js dimuat dari CDN, jadi perlu koneksi internet.
   - Fitur cari teks bekerja pada PDF yang memiliki lapisan teks. PDF hasil scan gambar memerlukan OCR agar bisa dicari.
   - Ini situs statis tanpa login/backend. Siapa pun yang memiliki alamat website dapat mengakses PDF publik.
   - Untuk hosting gratis, perhatikan batas ukuran file dan kuota layanan masing-masing.
