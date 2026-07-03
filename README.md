# @craftthingy-digital-innovation/cty-collaborative-layout-learner-web

Bilingual documentation: [Bahasa Indonesia](#bahasa-indonesia) | [English](#english)

---

## Bahasa Indonesia

Library client-side Javascript untuk menerapkan **Federated Online Layout Learning** pada pemrosesan dokumen secara kolaboratif lintas workstation komputer (seperti Paspor, KTP, Kartu Keluarga, BPJS, dll.). 

Library ini secara dinamis mendeteksi jenis dokumen (classification), menyaring kata kunci pribadi (nama, NIK, tanggal lahir), melacak interaksi klik pengguna saat memetakan hasil OCR ke kolom formulir, mempelajari letak koordinat spasial dan label jangkar (anchor text) di sekitarnya, serta menyinkronkannya ke server database terpusat untuk dipakai bersama oleh workstation lainnya.

### Instalasi
```bash
npm install @craftthingy-digital-innovation/cty-collaborative-layout-learner-web@2.0.2
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

### Panduan Integrasi Server-Side

Keamanan data terjaga penuh karena library client **tidak pernah mengakses database secara langsung**. Seluruh koordinat dikirim via REST API aman ke server backend Anda. Anda bebas menggunakan database SQL apa saja (MySQL, SQLite, Postgres, dll.) atau sekadar menyimpannya dalam file JSON lokal.

#### 1. Skema SQL Universal (Untuk Pengembang dengan Database)
Buat tabel berikut di server database Anda saat ini:
```sql
CREATE TABLE layout_templates (
    doc_type VARCHAR(100) PRIMARY KEY,
    version INT NOT NULL DEFAULT 1,
    template_data TEXT,    -- JSON templates koordinat spasial
    signature_data TEXT,   -- JSON kata kunci sidik jari dokumen
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 2. Implementasi NodeJS (Express API dengan File JSON)
Jika Anda tidak ingin membuat database baru, salin boiler-plate server Node ini:
```javascript
const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

const DATA_FILE = './layouts_data.json';
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ version: 0, templates: {}, signatures: {} }));
}

app.post('/api/sync-templates', (req, res) => {
  const clientData = req.body;
  const globalData = JSON.parse(fs.readFileSync(DATA_FILE));

  if (clientData.version > globalData.version) {
    // Gabungkan koordinat spasial menggunakan Moving Average (0.7 / 0.3)
    Object.keys(clientData.templates).forEach(docType => {
      if (!globalData.templates[docType]) {
        globalData.templates[docType] = clientData.templates[docType];
      } else {
        Object.keys(clientData.templates[docType]).forEach(field => {
          const gField = globalData.templates[docType][field];
          const cField = clientData.templates[docType][field];
          if (!gField) {
            globalData.templates[docType][field] = cField;
          } else {
            gField.relativeX = (gField.relativeX * 0.7) + (cField.relativeX * 0.3);
            gField.relativeY = (gField.relativeY * 0.7) + (cField.relativeY * 0.3);
            gField.relativeW = (gField.relativeW * 0.7) + (cField.relativeW * 0.3);
            gField.relativeH = (gField.relativeH * 0.7) + (cField.relativeH * 0.3);
            cField.keywords.forEach(kw => {
              if (!gField.keywords.includes(kw)) gField.keywords.push(kw);
            });
          }
        });
      }
    });

    // Gabungkan sidik jari dokumen
    Object.keys(clientData.signatures).forEach(docType => {
      globalData.signatures[docType] = clientData.signatures[docType];
    });

    globalData.version = clientData.version;
    fs.writeFileSync(DATA_FILE, JSON.stringify(globalData, null, 2));

    return res.json({ status: 'success', has_update: true, templates: globalData.templates, signatures: globalData.signatures, version: globalData.version });
  }

  const hasUpdate = globalData.version > clientData.version;
  res.json({
    status: 'success',
    has_update: hasUpdate,
    templates: hasUpdate ? globalData.templates : null,
    signatures: hasUpdate ? globalData.signatures : null,
    version: globalData.version
  });
});

app.listen(3000, () => console.log("Server run on port 3000"));
```

#### 3. Implementasi PHP (CodeIgniter 4 Controller)
Bagi pengembang PHP, salin logika endpoint berikut di Controller Anda:
```php
public function syncTemplates()
{
    $requestData = json_decode($this->request->getBody(), true);
    $filePath = WRITEPATH . 'layouts_data.json';
    
    if (!file_exists($filePath)) {
        file_put_contents($filePath, json_encode(['version' => 0, 'templates' => [], 'signatures' => []]));
    }
    
    $globalData = json_decode(file_get_contents($filePath), true);
    $clientVersion = $requestData['version'] ?? 0;
    
    if ($clientVersion > $globalData['version']) {
        // Agregasi templates koordinat spasial
        foreach ($requestData['templates'] as $docType => $fields) {
            if (!isset($globalData['templates'][$docType])) {
                $globalData['templates'][$docType] = $fields;
            } else {
                foreach ($fields as $field => $cConfig) {
                    if (!isset($globalData['templates'][$docType][$field])) {
                        $globalData['templates'][$docType][$field] = $cConfig;
                    } else {
                        $g = &$globalData['templates'][$docType][$field];
                        $g['relativeX'] = ($g['relativeX'] * 0.7) + ($cConfig['relativeX'] * 0.3);
                        $g['relativeY'] = ($g['relativeY'] * 0.7) + ($cConfig['relativeY'] * 0.3);
                        $g['relativeW'] = ($g['relativeW'] * 0.7) + ($cConfig['relativeW'] * 0.3);
                        $g['relativeH'] = ($g['relativeH'] * 0.7) + ($cConfig['relativeH'] * 0.3);
                        foreach ($cConfig['keywords'] as $kw) {
                            if (!in_array($kw, $g['keywords'])) {
                                $g['keywords'][] = $kw;
                            }
                        }
                    }
                }
            }
        }
        
        // Gabungkan data signatures
        foreach ($requestData['signatures'] as $docType => $sig) {
            $globalData['signatures'][$docType] = $sig;
        }
        
        $globalData['version'] = $clientVersion;
        file_put_contents($filePath, json_encode($globalData));
        
        return $this->response->setJSON([
            'status' => 'success',
            'has_update' => true,
            'templates' => $globalData['templates'],
            'signatures' => $globalData['signatures'],
            'version' => $globalData['version']
        ]);
    }
    
    $hasUpdate = $globalData['version'] > $clientVersion;
    return $this->response->setJSON([
        'status' => 'success',
        'has_update' => $hasUpdate,
        'templates' => $hasUpdate ? $globalData['templates'] : null,
        'signatures' => $hasUpdate ? $globalData['signatures'] : null,
        'version' => $globalData['version']
    ]);
}
```

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
npm install @craftthingy-digital-innovation/cty-collaborative-layout-learner-web@2.0.2
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

### Server-Side Integration Guide
Data privacy is strictly maintained because the client library **never accesses the database directly**. All coordinates are transmitted via secure REST APIs to your backend. You are free to use any SQL database (MySQL, SQLite, Postgres, etc.) or write to a local JSON file.

#### 1. Universal SQL Schema (For Database Integrations)
Create the following table inside your active database:
```sql
CREATE TABLE layout_templates (
    doc_type VARCHAR(100) PRIMARY KEY,
    version INT NOT NULL DEFAULT 1,
    template_data TEXT,    -- JSON templates of spatial coordinates
    signature_data TEXT,   -- JSON keywords representing the document signature
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 2. NodeJS Implementation (Express API with JSON File Storage)
For quick setups, copy this Node server controller boilerplate:
```javascript
const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

const DATA_FILE = './layouts_data.json';
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ version: 0, templates: {}, signatures: {} }));
}

app.post('/api/sync-templates', (req, res) => {
  const clientData = req.body;
  const globalData = JSON.parse(fs.readFileSync(DATA_FILE));

  if (clientData.version > globalData.version) {
    // Blend spatial coordinates using moving average (0.7 / 0.3)
    Object.keys(clientData.templates).forEach(docType => {
      if (!globalData.templates[docType]) {
        globalData.templates[docType] = clientData.templates[docType];
      } else {
        Object.keys(clientData.templates[docType]).forEach(field => {
          const gField = globalData.templates[docType][field];
          const cField = clientData.templates[docType][field];
          if (!gField) {
            globalData.templates[docType][field] = cField;
          } else {
            gField.relativeX = (gField.relativeX * 0.7) + (cField.relativeX * 0.3);
            gField.relativeY = (gField.relativeY * 0.7) + (cField.relativeY * 0.3);
            gField.relativeW = (gField.relativeW * 0.7) + (cField.relativeW * 0.3);
            gField.relativeH = (gField.relativeH * 0.7) + (cField.relativeH * 0.3);
            cField.keywords.forEach(kw => {
              if (!gField.keywords.includes(kw)) gField.keywords.push(kw);
            });
          }
        });
      }
    });

    // Merge document signatures
    Object.keys(clientData.signatures).forEach(docType => {
      globalData.signatures[docType] = clientData.signatures[docType];
    });

    globalData.version = clientData.version;
    fs.writeFileSync(DATA_FILE, JSON.stringify(globalData, null, 2));

    return res.json({ status: 'success', has_update: true, templates: globalData.templates, signatures: globalData.signatures, version: globalData.version });
  }

  const hasUpdate = globalData.version > clientData.version;
  res.json({
    status: 'success',
    has_update: hasUpdate,
    templates: hasUpdate ? globalData.templates : null,
    signatures: hasUpdate ? globalData.signatures : null,
    version: globalData.version
  });
});

app.listen(3000, () => console.log("Server running"));
```

#### 3. PHP Implementation (CodeIgniter 4 controller logic)
For PHP stacks, use this sync templates logic in your controller:
```php
public function syncTemplates()
{
    $requestData = json_decode($this->request->getBody(), true);
    $filePath = WRITEPATH . 'layouts_data.json';
    
    if (!file_exists($filePath)) {
        file_put_contents($filePath, json_encode(['version' => 0, 'templates' => [], 'signatures' => []]));
    }
    
    $globalData = json_decode(file_get_contents($filePath), true);
    $clientVersion = $requestData['version'] ?? 0;
    
    if ($clientVersion > $globalData['version']) {
        // Aggregate templates
        foreach ($requestData['templates'] as $docType => $fields) {
            if (!isset($globalData['templates'][$docType])) {
                $globalData['templates'][$docType] = $fields;
            } else {
                foreach ($fields as $field => $cConfig) {
                    if (!isset($globalData['templates'][$docType][$field])) {
                        $globalData['templates'][$docType][$field] = $cConfig;
                    } else {
                        $g = &$globalData['templates'][$docType][$field];
                        $g['relativeX'] = ($g['relativeX'] * 0.7) + ($cConfig['relativeX'] * 0.3);
                        $g['relativeY'] = ($g['relativeY'] * 0.7) + ($cConfig['relativeY'] * 0.3);
                        $g['relativeW'] = ($g['relativeW'] * 0.7) + ($cConfig['relativeW'] * 0.3);
                        $g['relativeH'] = ($g['relativeH'] * 0.7) + ($cConfig['relativeH'] * 0.3);
                        foreach ($cConfig['keywords'] as $kw) {
                            if (!in_array($kw, $g['keywords'])) {
                                $g['keywords'][] = $kw;
                            }
                        }
                    }
                }
            }
        }
        
        // Merge signatures data
        foreach ($requestData['signatures'] as $docType => $sig) {
            $globalData['signatures'][$docType] = $sig;
        }
        
        $globalData['version'] = $clientVersion;
        file_put_contents($filePath, json_encode($globalData));
        
        return $this->response->setJSON([
            'status' => 'success',
            'has_update' => true,
            'templates' => $globalData['templates'],
            'signatures' => $globalData['signatures'],
            'version' => $globalData['version']
        ]);
    }
    
    $hasUpdate = $globalData['version'] > $clientVersion;
    return $this->response->setJSON([
        'status' => 'success',
        'has_update' => $hasUpdate,
        'templates' => $hasUpdate ? $globalData['templates'] : null,
        'signatures' => $hasUpdate ? $globalData['signatures'] : null,
        'version' => $globalData['version']
    ]);
}
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
