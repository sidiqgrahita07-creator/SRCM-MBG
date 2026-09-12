# SRCM MBG — AI-Powered Supply Chain Management Platform

> **Untuk Hermes:** Gunakan plan ini task-by-task. Selesaikan satu task penuh sebelum lanjut berikutnya.

**Goal:** Membangun PWA B2B untuk menghubungkan dapur MBG (user/pembeli) dengan supplier (admin/Sidiq), dilengkapi AI berbasis DeepSeek untuk otomasi menu, kalkulasi raw material, PO, QC, tracking, dan dokumen ERP.

**Architecture:**
- Frontend: PWA (HTML + Tailwind CDN + Vanilla JS — modular, satu folder per fitur)
- Backend: Firebase Auth + Firestore + Realtime Database (chat)
- AI: DeepSeek API (chat-completion endpoint)
- Hosting: Netlify (auto-deploy dari folder `pwa/`)
- Role: 2 role — `dapur` (MBG user) dan `supplier` (Sidiq/admin)

**Tech Stack:**
- HTML5/CSS3/JS (ES6 modules, no bundler)
- Tailwind CSS CDN
- Firebase v10 (modular SDK via CDN)
- DeepSeek API (`https://api.deepseek.com/v1/chat/completions`)
- Netlify (hosting + env vars via Netlify config)

**Struktur Folder:**
```
pwa/
├── index.html              ← landing/login router
├── manifest.json
├── sw.js                   ← service worker (PWA offline)
├── firebase-config.js      ← config Firebase (gitignored atau env inject)
├── auth/
│   ├── login.html
│   └── register.html
├── dapur/                  ← halaman untuk role dapur
│   ├── dashboard.html
│   ├── menu-planner.html   ← AI menu + kalori + raw material
│   ├── po.html             ← buat & lihat PO
│   ├── delivery.html       ← tracking pengiriman
│   ├── qc.html             ← QC barang datang
│   └── chat.html           ← chat dengan supplier
├── supplier/               ← halaman untuk role supplier
│   ├── dashboard.html
│   ├── po-inbox.html       ← terima & approval PO
│   ├── delivery-mgmt.html  ← update status pengiriman
│   ├── qc-review.html      ← review hasil QC
│   └── chat.html           ← chat dengan dapur
├── shared/
│   ├── auth.js             ← auth helper (login/logout/role check)
│   ├── db.js               ← Firestore CRUD helpers
│   ├── ai.js               ← DeepSeek API wrapper
│   ├── components.js       ← navbar, sidebar, toast reusable
│   └── style.css           ← custom CSS tambahan
└── assets/
    └── logo.png
```

---

## FASE 1 — Foundation & Auth

### Task 1: Setup folder struktur + PWA manifest

**Objective:** Buat skeleton folder dan file PWA dasar

**Files:**
- Create: `pwa/manifest.json`
- Create: `pwa/sw.js`
- Create: `pwa/firebase-config.js`
- Create: `pwa/shared/auth.js`
- Create: `pwa/shared/db.js`
- Create: `pwa/shared/ai.js`
- Create: `pwa/shared/components.js`
- Create: `pwa/shared/style.css`

**Langkah:**

1. Buat `pwa/manifest.json`:
```json
{
  "name": "SRCM MBG — Supply Chain Manager",
  "short_name": "SRCM MBG",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#16a34a",
  "icons": [
    { "src": "/assets/logo.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/logo.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

2. Buat `pwa/sw.js` (basic caching):
```js
const CACHE = 'srcm-v1';
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE)));
self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(r => r || fetch(e.request))
));
```

3. Buat `pwa/firebase-config.js` — placeholder yang bisa diisi config Firebase:
```js
// Isi dengan config dari Firebase Console -> Project Settings -> Your Apps
export const firebaseConfig = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "PROJECT.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
  databaseURL: "https://PROJECT.firebaseio.com"
};

// DeepSeek API Key — isi di sini atau via Netlify env
export const DEEPSEEK_API_KEY = "DEEPSEEK_API_KEY_HERE";
```

---

### Task 2: Halaman Login & Register

**Objective:** Auth flow lengkap dengan Firebase Auth + role assignment ke Firestore

**Files:**
- Create: `pwa/index.html` (router — cek auth lalu redirect ke role masing-masing)
- Create: `pwa/auth/login.html`
- Create: `pwa/auth/register.html`
- Create: `pwa/shared/auth.js`

**Design:** Dark theme, hijau aksen (`green-600`), card center, logo atas.

**`pwa/shared/auth.js`:**
```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return getUserData(cred.user.uid);
}

export async function register(email, password, name, role = 'dapur') {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const userData = { name, email, role, createdAt: Date.now(), uid: cred.user.uid };
  await setDoc(doc(db, 'users', cred.user.uid), userData);
  return userData;
}

export async function getUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function logout() {
  await signOut(auth);
  window.location.href = '/auth/login.html';
}

export function requireAuth(requiredRole) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async user => {
      if (!user) { window.location.href = '/auth/login.html'; return; }
      const data = await getUserData(user.uid);
      if (requiredRole && data.role !== requiredRole) {
        window.location.href = `/${data.role}/dashboard.html`;
        return;
      }
      resolve(data);
    });
  });
}
```

**`pwa/index.html`** (router):
```html
<!DOCTYPE html><html><head>
<script type="module">
  import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
  import { auth, getUserData } from './shared/auth.js';
  onAuthStateChanged(auth, async user => {
    if (!user) return window.location.href = '/auth/login.html';
    const data = await getUserData(user.uid);
    window.location.href = `/${data.role}/dashboard.html`;
  });
</script>
</head><body>Memuat...</body></html>
```

---

### Task 3: Shared Components & Style

**Objective:** Navbar, sidebar, toast notification, loading spinner — reusable di semua halaman

**Files:**
- Create: `pwa/shared/components.js`
- Create: `pwa/shared/style.css`

**`pwa/shared/components.js`:**
```js
export function renderNavbar(title, role) {
  return `
  <nav class="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="text-green-400 font-bold text-lg">🏭 SRCM MBG</span>
      <span class="text-slate-400 text-sm">${title}</span>
    </div>
    <div class="flex items-center gap-3">
      <span id="user-name" class="text-slate-300 text-sm"></span>
      <span class="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">${role}</span>
      <button onclick="import('../shared/auth.js').then(m=>m.logout())" 
        class="text-slate-400 hover:text-red-400 text-sm">Keluar</button>
    </div>
  </nav>`;
}

export function renderSidebar(role) {
  const menuDapur = [
    ['📊 Dashboard', '/dapur/dashboard.html'],
    ['🍽️ Menu Planner', '/dapur/menu-planner.html'],
    ['📋 Purchase Order', '/dapur/po.html'],
    ['🚚 Pengiriman', '/dapur/delivery.html'],
    ['✅ QC Barang', '/dapur/qc.html'],
    ['💬 Chat Supplier', '/dapur/chat.html'],
  ];
  const menuSupplier = [
    ['📊 Dashboard', '/supplier/dashboard.html'],
    ['📬 Inbox PO', '/supplier/po-inbox.html'],
    ['🚛 Kelola Pengiriman', '/supplier/delivery-mgmt.html'],
    ['🔍 Review QC', '/supplier/qc-review.html'],
    ['💬 Chat Dapur', '/supplier/chat.html'],
  ];
  const menu = role === 'dapur' ? menuDapur : menuSupplier;
  const active = window.location.pathname;
  return `<aside class="w-56 bg-slate-900 min-h-screen border-r border-slate-700 py-4">
    ${menu.map(([label, href]) => `
      <a href="${href}" class="flex items-center gap-2 px-4 py-2.5 text-sm
        ${active.includes(href) ? 'bg-green-900 text-green-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
        transition-colors">${label}</a>
    `).join('')}
  </aside>`;
}

export function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg
    ${type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function showLoading(show = true) {
  const id = 'global-loader';
  if (show) {
    const d = document.createElement('div');
    d.id = id;
    d.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center';
    d.innerHTML = '<div class="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>';
    document.body.appendChild(d);
  } else {
    document.getElementById(id)?.remove();
  }
}
```

---

## FASE 2 — Core AI Features (DeepSeek)

### Task 4: DeepSeek AI Wrapper

**Objective:** Satu wrapper yang dipakai semua fitur AI

**Files:**
- Create: `pwa/shared/ai.js`

**`pwa/shared/ai.js`:**
```js
import { DEEPSEEK_API_KEY } from '../firebase-config.js';

const BASE_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

export async function askAI(systemPrompt, userMessage, options = {}) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
      response_format: options.json ? { type: 'json_object' } : undefined
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

// Khusus streaming (untuk chat realtime)
export async function askAIStream(systemPrompt, userMessage, onChunk) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      temperature: 0.7
    })
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const json = line.slice(6);
      if (json === '[DONE]') break;
      try {
        const chunk = JSON.parse(json).choices[0].delta.content;
        if (chunk) onChunk(chunk);
      } catch {}
    }
  }
}
```

---

### Task 5: AI Menu Planner

**Objective:** User input kebutuhan (jumlah porsi, jenis menu, constraint kalori/budget) → AI generate rencana menu + kalori + raw material list + estimasi harga

**Files:**
- Create: `pwa/dapur/menu-planner.html`

**Alur UI:**
1. Form input: jumlah porsi, tanggal hidang, tipe menu (sarapan/makan siang/makan malam), preferensi (bergizi/ekonomis/premium), max kalori/porsi
2. Klik "Generate Menu" → AI proses
3. Output card per menu: nama menu, kalori/porsi, bahan-bahan (nama, qty per porsi, total qty, estimasi harga satuan)
4. Tombol "Buat PO dari menu ini" → auto-populate ke halaman PO

**System prompt untuk AI:**
```
Kamu adalah AI perencana menu untuk MBG (Makan Bergizi Gratis). 
Berikan respons HANYA dalam format JSON yang valid.
Format output:
{
  "menu": [
    {
      "nama": "Nasi Ayam Goreng",
      "waktu_hidang": "Makan Siang",
      "kalori_per_porsi": 520,
      "harga_estimasi_per_porsi": 15000,
      "bahan": [
        { "nama": "Beras", "qty_per_porsi_gram": 150, "total_gram": 15000, "harga_per_kg": 14000, "subtotal": 210000 }
      ]
    }
  ],
  "total_raw_material": [
    { "nama": "Beras", "total_gram": 15000, "total_kg": 15, "harga_per_kg": 14000, "total_harga": 210000 }
  ],
  "total_biaya_estimasi": 3750000,
  "catatan": "..."
}
```

**Setelah output:** Simpan ke Firestore `menu_plans/{uid}/{planId}` supaya bisa di-load ulang dan jadi dasar PO.

---

### Task 6: AI Purchase Order Generator

**Objective:** Dari raw material list (hasil menu planner atau manual), AI buat draft PO formal yang siap di-approve

**Files:**
- Create: `pwa/dapur/po.html`
- Update: `pwa/shared/db.js` (tambah PO CRUD)

**Firestore schema PO:**
```js
// Collection: purchase_orders/{poId}
{
  poId: "PO-20260912-001",
  dapurId: "uid-dapur",
  dapurName: "Dapur MBG Cimahi",
  supplierId: "uid-supplier",
  status: "draft" | "pending_approval" | "approved" | "rejected" | "delivered" | "qc_done",
  items: [
    { nama: "Beras", satuan: "kg", qty: 15, harga_satuan: 14000, subtotal: 210000 }
  ],
  total: 210000,
  deliveryDate: "2026-09-15",
  notes: "...",
  aiDraftNotes: "...",     // AI analysis
  createdAt: timestamp,
  approvedAt: timestamp,
  approvedBy: "supplier-uid"
}
```

**Alur:**
1. Dari menu planner → "Buat PO" → halaman PO dengan data pre-filled
2. User bisa edit qty/harga manual
3. AI review PO: cek kelengkapan, flag item yang harga tidak wajar, suggest substitusi
4. Submit → status jadi `pending_approval` → notif ke supplier
5. Riwayat PO: list semua PO dengan status chip berwarna

---

## FASE 3 — Supplier Side

### Task 7: Dashboard Supplier + PO Inbox

**Objective:** Supplier lihat semua PO masuk, bisa approve/reject/counter, lihat summary bisnis

**Files:**
- Create: `pwa/supplier/dashboard.html`
- Create: `pwa/supplier/po-inbox.html`

**Dashboard supplier cards:**
- Total PO bulan ini (count + nilai rupiah)
- PO pending approval
- Pengiriman hari ini
- Revenue month-to-date

**PO Inbox:**
- List PO dengan filter: pending / approved / semua
- Klik PO → detail lengkap (item, qty, total, catatan dapur)
- Tombol: ✅ Approve | ❌ Reject (+ alasan) | ✏️ Counter (ubah qty/harga)
- Setelah approve → otomatis generate dokumen surat jalan + invoice (AI draft)

**AI untuk dokumen:**
System prompt: generate surat jalan dan invoice dalam format teks formal dari data PO JSON yang diberikan.

---

## FASE 4 — Delivery & QC

### Task 8: Tracking Pengiriman

**Objective:** Supplier update status pengiriman → dapur bisa monitor realtime

**Files:**
- Create: `pwa/supplier/delivery-mgmt.html`
- Create: `pwa/dapur/delivery.html`

**Firestore schema delivery:**
```js
// Collection: deliveries/{deliveryId}
{
  deliveryId: "DLV-001",
  poId: "PO-001",
  dapurId: "uid",
  supplierId: "uid",
  status: "preparing" | "in_transit" | "arrived" | "partial",
  statusHistory: [
    { status: "preparing", time: timestamp, note: "Sedang packing" },
    { status: "in_transit", time: timestamp, note: "Keluar gudang 08:30" },
  ],
  estimasiTiba: "2026-09-15 11:00",
  driverName: "Budi",
  driverPhone: "081234...",
  platNomor: "B 1234 AB",
  kendala: "",
  createdAt: timestamp
}
```

**Dapur view:** Timeline progress dengan icon + waktu setiap status update (realtime Firestore listener).

---

### Task 9: QC System

**Objective:** Ketika barang datang, dapur lakukan QC item per item → supplier lihat hasilnya

**Files:**
- Create: `pwa/dapur/qc.html`
- Create: `pwa/supplier/qc-review.html`

**QC Form (per item PO):**
- Nama item | Qty dipesan | Qty diterima | Kondisi (Baik/Rusak/Kurang) | Catatan | Foto (upload ke Firebase Storage)
- Submit → AI generate summary QC: "Dari 5 item, 4 sesuai. Beras 2kg kurang dari 15kg yang dipesan. Disarankan kredit invoice Rp 28.000."

**AI QC Analysis prompt:**
```
Kamu quality control analyst. Analisis hasil QC berikut dan berikan:
1. Summary kondisi keseluruhan (baik/perlu perhatian/bermasalah)
2. Item yang bermasalah + dampak ke invoice
3. Rekomendasi tindakan (kredit, retur, dll)
4. Skor QC (0-100)
Format: JSON
```

---

## FASE 5 — Chat & ERP Documents

### Task 10: Realtime Chat (Firebase Realtime DB)

**Objective:** Chat langsung antara dapur dan supplier, bisa kirim foto & file

**Files:**
- Create: `pwa/dapur/chat.html`
- Create: `pwa/supplier/chat.html`

**Firebase Realtime DB schema:**
```
/chats/{chatId}/messages/{msgId}
  - senderId, senderName, senderRole
  - text, type (text/image/file), fileUrl
  - timestamp
  - read: {uid: true}
```

**Features:**
- List kontak di sidebar (untuk supplier: semua dapur yang punya PO aktif)
- Badge unread count
- AI bisa disummon dengan `@ai` di chat → AI menjawab dalam konteks supply chain
- Tempel PO langsung di chat (card preview clickable)

---

### Task 11: ERP Documents & Laporan

**Objective:** AI auto-generate semua dokumen ERP dari data transaksi, bisa di-download PDF

**Files:**
- Create: `pwa/supplier/dashboard.html` (update — tambah tab Laporan)

**Dokumen yang bisa di-generate AI:**
1. **Invoice** dari PO approved
2. **Surat Jalan** dari delivery
3. **Berita Acara QC** dari hasil QC
4. **Laporan Bulanan Transaksi** (ringkasan semua PO, delivery, QC bulan ini)
5. **Estimasi Kebutuhan Bahan Bulan Depan** (AI prediksi dari riwayat menu plan)

**Cara generate PDF:** Print-to-PDF via `window.print()` dengan CSS `@media print` yang clean, atau pakai library `html2pdf.js` via CDN.

---

## FASE 6 — Polish & Deploy

### Task 12: Dashboard Dapur (Summary)

**Objective:** Halaman utama dapur dengan ringkasan status hari ini

**Files:**
- Create: `pwa/dapur/dashboard.html`

**Cards:**
- Status PO aktif (berapa pending, berapa approved)
- Rencana menu hari ini
- Pengiriman hari ini (status realtime)
- Quick action buttons: "+ Buat Menu Plan", "+ Buat PO", "Lihat Chat"
- AI insight harian: "Berdasarkan riwayat, kebutuhan beras minggu ini ±45kg. Pertimbangkan order lebih awal karena libur nasional."

---

### Task 13: Netlify Deploy

**Objective:** App live di Netlify, Firebase rules, Firestore indexes

**Files:**
- Create: `netlify.toml`
- Create: `firestore.rules`
- Create: `database.rules.json`

**`netlify.toml`:**
```toml
[build]
  publish = "pwa"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**`firestore.rules`:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    // PO: dapur bisa buat/baca milik sendiri; supplier bisa baca semua
    match /purchase_orders/{poId} {
      allow create: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'dapur';
      allow read: if request.auth != null;
      allow update: if request.auth != null;
    }
    // Delivery & QC: semua authenticated user bisa baca; update sesuai role
    match /deliveries/{id} { allow read, write: if request.auth != null; }
    match /qc_reports/{id} { allow read, write: if request.auth != null; }
    match /menu_plans/{uid}/{planId} { allow read, write: if request.auth.uid == uid; }
  }
}
```

---

## Ringkasan Fase & Estimasi

| Fase | Task | Scope |
|------|------|-------|
| 1 | 1-3 | Foundation, Auth, UI Components |
| 2 | 4-6 | AI Wrapper, Menu Planner, PO Generator |
| 3 | 7 | Supplier Dashboard + PO Approval |
| 4 | 8-9 | Delivery Tracking + QC System |
| 5 | 10-11 | Chat + ERP Documents |
| 6 | 12-13 | Dashboard Dapur + Deploy |

**Teknologi tambahan yang perlu disiapkan:**
- [ ] Firebase project baru → dapat `firebaseConfig`
- [ ] DeepSeek API key (dari platform.deepseek.com)
- [ ] Netlify account (sudah ada dari CacingResearch)
- [ ] Firebase Storage diaktifkan (untuk foto QC)
- [ ] Firebase Realtime Database diaktifkan (untuk chat)

**Catatan Keamanan:**
- DEEPSEEK_API_KEY jangan di-hardcode ke file yang di-push ke GitHub publik
- Gunakan Netlify environment variables untuk inject API key saat build
- Atau pakai Firebase Cloud Functions sebagai proxy (lebih aman tapi tambah kompleksitas)
- Untuk MVP pilot 1-5 dapur: hardcode dulu di firebase-config.js yang di-.gitignore

---

*Plan ini dibuat 12 September 2026. Update plan kalau ada perubahan requirement.*
