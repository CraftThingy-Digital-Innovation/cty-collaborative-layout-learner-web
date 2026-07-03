# @craftthingy-digital-innovation/cty-collaborative-layout-learner-web

Bilingual documentation: [Bahasa Indonesia](#bahasa-indonesia) | [English](#english)

---

## Bahasa Indonesia

Library client-side Javascript untuk menerapkan **Federated Online Layout Learning** pada pemrosesan dokumen (seperti paspor, KTP, dll.). 

Library ini melacak interaksi klik pengguna saat mencocokkan hasil OCR ke kolom input formulir, mempelajari letak koordinat spasial dan label jangkar (anchor text) di sekitarnya secara otomatis, lalu menyinkronkannya ke server database secara terpusat agar bisa digunakan bersama oleh komputer workstation lainnya.

### Instalasi
```bash
npm install @craftthingy-digital-innovation/cty-collaborative-layout-learner-web
```

### Cara Penggunaan Client-Side
```javascript
import { CollaborativeLayoutLearner } from '@craftthingy-digital-innovation/cty-collaborative-layout-learner-web';

const learner = new CollaborativeLayoutLearner({
  storageKey: 'paspor_layouts',
  syncInterval: 10000 // Sinkronisasi ke server setiap 10 detik
});

// 1. Jalankan sinkronisasi background dengan server
learner.startSync('http://my-api-server.com');

// 2. Menerima data templat update dari server (Hot-Reload)
learner.on('sync-success', ({ templates, version }) => {
  console.log("Model Layout Diperbarui ke Versi:", version);
});

// 3. Melakukan Prediksi / Pengisian Otomatis saat paspor di-scan
const predictions = learner.predict(
  'paspor_indonesia', 
  allOcrWords,      // Array kata terdeteksi [{ text, box }]
  imageWidth, 
  imageHeight
);
console.log("Saran Auto-Fill:", predictions); // Output: { nama_pemohon: 'BUDI', no_paspor: 'A123' }

// 4. Belajar dari Klik Pengguna (Umpan Balik Koreksi)
// Panggil fungsi ini setiap kali user mengklik kotak di layar untuk mengisi form
learner.learn(
  'paspor_indonesia',
  'nama_pemohon',
  clickedWord.text,
  clickedWord.box,
  allOcrWords,
  imageWidth,
  imageHeight
);
```

### Panduan Integrasi Server-Side (PHP CodeIgniter / NodeJS)
Untuk melengkapi sinkronisasi kolaboratif, server Anda harus menyediakan satu endpoint POST `http://my-api-server.com/sync-templates`. 

Tugas server adalah membandingkan nomor versi templat yang dikirim oleh client. Jika versi client lebih tinggi, gabungkan koordinat relatif dengan rumus **Rata-rata Bergerak (Moving Average)**, lalu simpan ke database dan bagikan ke client lainnya.

---

## English

A client-side JavaScript library to orchestrate **Federated Online Layout Learning** for document processing workflows (such as passports, national IDs, etc.).

This SDK records user click interactions when mapping OCR bounding boxes to form columns, automatically trains itself on spatial locations and surrounding anchor text labels, and pushes learned templates to a central database server to share layout intelligence across all active workstations.

### Installation
```bash
npm install @craftthingy-digital-innovation/cty-collaborative-layout-learner-web
```

### Usage
```javascript
import { CollaborativeLayoutLearner } from '@craftthingy-digital-innovation/cty-collaborative-layout-learner-web';

const learner = new CollaborativeLayoutLearner({
  storageKey: 'paspor_layouts',
  syncInterval: 10000 // Sync with server every 10 seconds
});

// 1. Start background federated syncing
learner.startSync('http://my-api-server.com');

// 2. Event listener for background layout updates (Hot-Reload)
learner.on('sync-success', ({ templates, version }) => {
  console.log("Layout Templates Updated to Version:", version);
});

// 3. Automatically Predict / Auto-Fill Form from new OCR Scan
const predictions = learner.predict(
  'paspor_indonesia', 
  allOcrWords,      // Array of words detected [{ text, box }]
  imageWidth, 
  imageHeight
);
console.log("Auto-Fill Suggestions:", predictions); // Output: { nama_pemohon: 'BUDI', no_paspor: 'A123' }

// 4. Learn from User Clicks (Feedback Correction Loop)
// Trigger this whenever the user manually maps an OCR bounding box to a form field
learner.learn(
  'paspor_indonesia',
  'nama_pemohon',
  clickedWord.text,
  clickedWord.box,
  allOcrWords,
  imageWidth,
  imageHeight
);
```
