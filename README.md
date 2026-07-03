# @craftthingy-digital-innovation/cty-collaborative-layout-learner-web

Bilingual documentation: [Bahasa Indonesia](#bahasa-indonesia) | [English](#english)

---

## Bahasa Indonesia

Library client-side Javascript untuk menerapkan **Federated Online Layout Learning** pada pemrosesan dokumen secara kolaboratif lintas workstation komputer (seperti Paspor, KTP, Kartu Keluarga, BPJS, dll.). 

Library ini secara dinamis mendeteksi jenis dokumen (classification), menyaring kata kunci pribadi (nama, NIK, tanggal lahir), melacak interaksi klik pengguna saat memetakan hasil OCR ke kolom formulir, mempelajari letak koordinat spasial dan label jangkar (anchor text) di sekitarnya, serta menyinkronkannya ke server database terpusat untuk dipakai bersama oleh workstation lainnya.

### Instalasi
```bash
npm install @craftthingy-digital-innovation/cty-collaborative-layout-learner-web@2.0.1
```

### Cara Penggunaan Client-Side (Frontend)
```javascript
import { CollaborativeLayoutLearner } from '@craftthingy-digital-innovation/cty-collaborative-layout-learner-web';

const learner = new CollaborativeLayoutLearner({
  storageKey: 'document_layouts',
  syncInterval: 10000 // Sinkronisasi otomatis ke server setiap 10 detik
});

// 1. Jalankan sinkronisasi background dengan server
learner.startSync('http://my-api-server.com/api');

// 2. Event listener untuk Hot-Reload templat ter-update dari server
learner.on('sync-success', ({ templates, version }) => {
  console.log("Model Layout Teragregasi Diperbarui ke Versi:", version);
});

// 3. Deteksi tipe dokumen secara otomatis (Zero-Configuration)
// Memindai kata statis di area atas (header 20%) & mencocokkan kemiripan sidik jari (Jaccard similarity).
// Jika dokumen baru tidak dikenal, otomatis menghasilkan ID hash baru (misal: 'doc_hash_9a8f2c').
const docType = learner.detectDocType(allOcrWords, imageWidth, imageHeight);
console.log("Tipe Dokumen Terdeteksi:", docType);

// 4. Lakukan Prediksi / Pengisian Otomatis dari ingatan templat spasial
const predictions = learner.predict(docType, allOcrWords, imageWidth, imageHeight);
console.log("Saran Auto-Fill:", predictions); // Contoh: { nama_pemohon: 'BUDI', no_paspor: 'A123' }

// 5. Belajar dari Klik Koreksi Pengguna
// Panggil fungsi ini setiap kali user mengklik kotak teks OCR untuk mengisi kolom formulir
div.addEventListener('click', () => {
  learner.learn(
    docType,
    activeFieldName, // Nama kolom (e.g., 'nama_pemohon', 'no_paspor')
    clickedWord.text,
    clickedWord.box,
    allOcrWords,
    imageWidth,
    imageHeight
  );
});

// 6. Menyempurnakan Sidik Jari Dokumen (Pembersihan Nama/Tanggal)
// Panggil saat dokumen berhasil disimpan untuk menyaring dan menghapus data dinamis yang berubah-ubah
learner.refineSignature(docType, allOcrWords, imageWidth, imageHeight);
```

### Panduan Integrasi Server-Side (PHP CodeIgniter / NodeJS)
Untuk melengkapi sinkronisasi kolaboratif, server Anda harus menyediakan satu endpoint POST `/sync-templates`.

Sisi server menerima payload JSON:
```json
{
  "version": 12,
  "templates": { ... },
  "signatures": { ... }
}
```
Jika nomor versi payload client lebih tinggi, server menggabungkan koordinat rasio kotak ($x,y$) dari templat baru menggunakan **Rata-rata Bergerak (Moving Average)**, melakukan *upsert* ke database, menaikkan nomor versi global, lalu mengembalikannya sebagai respons sukses agar diunduh oleh client lain.

### Keamanan & Pemulihan Mandiri Algoritma (Self-Healing)
Library ini dilengkapi dengan mekanisme proteksi bawaan untuk melindungi integritas model dari kesalahan manusia (human error):
1. **Peredam Salah Klik (Moving Average Dampening):** Koreksi koordinat dilakukan secara gradual menggunakan *exponential moving average* `(Lama * 0.7) + (Baru * 0.3)`. Salah klik satu kali tidak akan merusak posisi hotspot.
2. **Pengaman Salah Dokumen (Jaccard Guard Threshold):** Metode `refineSignature(...)` hanya menerapkan pembaruan sidik jari jika irisan kata statis menghasilkan minimal 3 kata unik. Jika user salah men-submit Kartu Keluarga ke tipe Paspor, sistem otomatis mengabaikan pembaruan tersebut demi melindungi templat Paspor yang asli.
3. **Mekanisme Reset Memori:** Jika data templat lokal telanjur kacau, Anda bisa menghapus instansiasi memori untuk tipe dokumen tersebut secara manual:
   ```javascript
   delete learner.templates[docType];
   delete learner.signatures[docType];
   learner.save();
   ```

---

## English

A client-side JavaScript SDK to orchestrate **Federated Online Layout Learning** for collaborative document processing workflows across client workstations (supporting Passports, National IDs, Family Cards, BPJS, etc.).

This library dynamically classifies document types, filters out dynamic personal values (names, birthdates, IDs), tracks user click behaviors when mapping OCR output to form inputs, trains itself on spatial locations and surrounding anchor text labels, and syncs layouts with a central database server to distribute layout intelligence.

### Installation
```bash
npm install @craftthingy-digital-innovation/cty-collaborative-layout-learner-web@2.0.1
```

### Client-Side JavaScript Usage
```javascript
import { CollaborativeLayoutLearner } from '@craftthingy-digital-innovation/cty-collaborative-layout-learner-web';

const learner = new CollaborativeLayoutLearner({
  storageKey: 'document_layouts',
  syncInterval: 10000 // Sync with database server every 10 seconds
});

// 1. Start background federated syncing
learner.startSync('http://my-api-server.com/api');

// 2. Listen for layout updates from server (Dynamic Hot-Reloading)
learner.on('sync-success', ({ templates, version }) => {
  console.log("Layout Templates Synced to Version:", version);
});

// 3. Automatically classify document type (Zero-Configuration)
// Scans static keywords in the top 20% header area using Jaccard Similarity.
// If unrecognized, auto-generates a dynamic hash ID (e.g. 'doc_hash_9a8f2c').
const docType = learner.detectDocType(allOcrWords, imageWidth, imageHeight);
console.log("Detected Doc Type:", docType);

// 4. Automatically Predict & Auto-Fill Form from spatial coordinates
const predictions = learner.predict(docType, allOcrWords, imageWidth, imageHeight);
console.log("Auto-Fill Suggestions:", predictions); // e.g. { nama_pemohon: 'BUDI', no_paspor: 'A123' }

// 5. Learn from User Clicks (Feedback Correction Loop)
// Trigger this whenever the user manually maps an OCR bounding box to a form field
div.addEventListener('click', () => {
  learner.learn(
    docType,
    activeFieldName, // Input column name (e.g., 'nama_pemohon', 'no_paspor')
    clickedWord.text,
    clickedWord.box,
    allOcrWords,
    imageWidth,
    imageHeight
  );
});

// 6. Refine Document Signature (Remove dynamic names/dates)
// Trigger upon successful submission to filter and intersect keywords, stripping out transient inputs
learner.refineSignature(docType, allOcrWords, imageWidth, imageHeight);
```

### Algorithmic Safety & Self-Healing
Built-in protection layers guard the learned model templates against manual operator mistakes (human error):
1. **Exponential Moving Average Dampening:** Coordinate updates are adjusted gradually using the formula `(Old * 0.7) + (New * 0.3)`. A single accidental click will not drastically displace the search hotspots.
2. **Document Signature Guard (Jaccard Guard):** The `refineSignature(...)` method only applies signature updates if the word intersection produces at least 3 unique keywords. If a user accidentally submits a completely different document (e.g., submitting a Family Card into a Passport flow), the system discards the update, preserving the integrity of the Passport model.
3. **Template Memory Reset:** To force a clean re-learning cycle for a corrupted layout format, clear the local templates manually:
   ```javascript
   delete learner.templates[docType];
   delete learner.signatures[docType];
   learner.save();
   ```

