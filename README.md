SRCM MBG — Supply Chain Management Platform
============================================

## Setup

### 1. Firebase Project
1. Buka [console.firebase.google.com](https://console.firebase.google.com)
2. Buat project baru → nama bebas (misal: `srcm-mbg`)
3. Aktifkan layanan:
   - **Authentication** → Email/Password → Enable
   - **Firestore Database** → Start in test mode (lalu apply `firestore.rules`)
   - **Realtime Database** → Start in test mode (lalu apply `database.rules.json`)
4. Project Settings → Your Apps → Add Web App
5. Copy `firebaseConfig` ke `pwa/firebase-config.js`

### 2. DeepSeek API Key
1. Daftar di [platform.deepseek.com](https://platform.deepseek.com)
2. API Keys → Create Key
3. Isi ke `pwa/firebase-config.js` pada field `DEEPSEEK_API_KEY`

### 3. Deploy ke Netlify
```bash
# Install Netlify CLI (kalau belum ada)
npm install -g netlify-cli

# Login
netlify login

# Deploy dari folder project ini
netlify deploy --dir=pwa --prod
```

## Struktur Folder

```
pwa/
├── index.html              ← Router (cek auth → redirect ke role)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker (offline)
├── firebase-config.js      ← ⚠️ WAJIB DIISI — Firebase + DeepSeek config
├── auth/
│   ├── login.html          ← Halaman login
│   └── register.html       ← Halaman daftar
├── dapur/                  ← Role: Dapur MBG
│   ├── dashboard.html      ← Dashboard + AI insight
│   ├── menu-planner.html   ← AI menu generator
│   ├── po.html             ← Purchase Order
│   ├── delivery.html       ← Tracking pengiriman (realtime)
│   ├── qc.html             ← QC barang datang + AI analysis
│   └── chat.html           ← Chat dengan supplier
├── supplier/               ← Role: Supplier (Admin)
│   ├── dashboard.html      ← Dashboard bisnis
│   ├── po-inbox.html       ← Approve/reject/counter PO
│   ├── delivery-mgmt.html  ← Update status pengiriman
│   ├── qc-review.html      ← Review hasil QC dari dapur
│   └── chat.html           ← Chat dengan semua dapur
└── shared/
    ├── auth.js             ← Firebase Auth helper
    ├── db.js               ← Firestore CRUD helper
    ├── ai.js               ← DeepSeek API wrapper + prompts
    ├── components.js       ← UI: navbar, sidebar, toast, modal
    └── style.css           ← Custom styles
```

## Roles

| Role | Akses | Register dengan |
|------|-------|----------------|
| `dapur` | Semua halaman `/dapur/` | Email biasa |
| `supplier` | Semua halaman `/supplier/` | Kode akses: `INSTECH2026` |

Ganti kode akses supplier di `pwa/auth/register.html` → `const SUPPLIER_SECRET`

## AI Features (DeepSeek)

| Fitur | Halaman |
|-------|---------|
| Generate menu + kalori + raw material | `/dapur/menu-planner.html` |
| Review PO (cek kewajaran harga) | `/dapur/po.html` |
| Analisis QC barang | `/dapur/qc.html` |
| Generate Invoice (print ke PDF) | `/supplier/po-inbox.html` |
| Generate Surat Jalan | `/supplier/po-inbox.html` |
| Chat assistant (`@ai`) | Semua halaman chat |
| Daily business insight | Dashboard dapur & supplier |

## Firestore Collections

| Collection | Isi |
|-----------|-----|
| `users/{uid}` | Data user (name, email, role) |
| `purchase_orders/{poId}` | PO (items, total, status, approval) |
| `deliveries/{deliveryId}` | Status pengiriman + timeline |
| `qc_reports/{qcId}` | Hasil QC per PO |
| `menu_plans/{uid}/{planId}` | Rencana menu tersimpan |

## Realtime Database (Chat)

```
/chats/{dapur_{dapurUid}}/messages/{msgId}
  - text, senderRole, senderName, senderId, time
```
