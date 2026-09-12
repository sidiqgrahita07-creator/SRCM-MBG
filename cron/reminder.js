/**
 * SRCM MBG — Cron Reminder
 * Jalankan di VPS setiap hari jam 07:00 pagi:
 *   node cron/reminder.js
 *
 * Setup crontab:
 *   0 7 * * * /usr/bin/node /path/to/SRCM-MBG/cron/reminder.js >> /var/log/srcm-reminder.log 2>&1
 *
 * Env vars yang dibutuhkan (.env di root atau export di server):
 *   FIREBASE_SERVICE_ACCOUNT=/path/to/serviceAccountKey.json
 *   FONNTE_TOKEN=xxx
 *   APP_URL=https://srcm-mbg.netlify.app
 */

const admin    = require('firebase-admin');
const fetch    = require('node-fetch');
const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ── Init Firebase Admin ────────────────────────────────────
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
const APP_URL      = process.env.APP_URL || 'https://srcm-mbg.netlify.app';

// ── WA sender via Fonnte ───────────────────────────────────
async function sendWA(phone, message, type = 'reminder') {
  const normalized = phone.replace(/\D/g, '').replace(/^0/, '62');
  console.log(`[WA] → ${normalized} [${type}]`);

  const res = await fetch('https://api.fonnte.com/send', {
    method:  'POST',
    headers: { Authorization: FONNTE_TOKEN },
    body:    new URLSearchParams({ target: normalized, message, countryCode: '62' }),
  });
  const data = await res.json();
  if (!data.status) console.error(`[WA] Error: ${data.reason}`);
  else console.log(`[WA] ✓ Sent to ${normalized}`);

  // Log ke Firestore
  await db.collection('wa_logs').add({ phone: normalized, message, type, sentAt: Date.now() });
}

// ── Ambil PO yang perlu reminder ───────────────────────────
async function getPOsForReminder(targetDate) {
  // targetDate = string 'YYYY-MM-DD'
  const snap = await db.collection('purchase_orders')
    .where('deliveryDate', '==', targetDate)
    .where('status', 'in', ['approved', 'in_transit', 'preparing'])
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Ambil supplier ─────────────────────────────────────────
async function getSupplier(supplierId) {
  if (!supplierId) return null;
  const snap = await db.collection('suppliers').doc(supplierId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// ── Format tanggal YYYY-MM-DD ──────────────────────────────
function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ── Reminder H-2 ──────────────────────────────────────────
async function runH2() {
  const target = dateStr(2);
  console.log(`\n[H-2] Checking PO for delivery date: ${target}`);
  const pos = await getPOsForReminder(target);
  console.log(`[H-2] Found ${pos.length} PO(s)`);

  for (const po of pos) {
    const supplier = await getSupplier(po.supplierId);
    if (!supplier?.phone) { console.log(`[H-2] Skip PO ${po.poId} — no supplier phone`); continue; }

    const itemList = (po.items||[]).map(i => `• ${i.namaItem||i.nama} ${i.qty} ${i.satuan}`).join('\n');
    const msg =
`⏰ *REMINDER — 2 Hari Lagi*

Halo *${supplier.name}*, pengingat pengiriman ke *${po.dapurName}* dalam *2 hari*.

📦 Barang:
${itemList}

📅 Tanggal kirim: *${po.deliveryDate}*

Mohon pastikan barang sudah siap & dalam kondisi baik.
_SRCM MBG Platform_`;

    await sendWA(supplier.phone, msg, 'reminder_h2');
    await new Promise(r => setTimeout(r, 1500)); // delay 1.5s antar WA
  }
}

// ── Reminder H-1 ──────────────────────────────────────────
async function runH1() {
  const target = dateStr(1);
  console.log(`\n[H-1] Checking PO for delivery date: ${target}`);
  const pos = await getPOsForReminder(target);
  console.log(`[H-1] Found ${pos.length} PO(s)`);

  for (const po of pos) {
    const supplier = await getSupplier(po.supplierId);
    if (!supplier?.phone) continue;

    const itemList = (po.items||[]).map(i => `• ${i.namaItem||i.nama} ${i.qty} ${i.satuan}`).join('\n');
    const msg =
`🚨 *REMINDER — BESOK KIRIM!*

Halo *${supplier.name}*, pengiriman ke *${po.dapurName}* adalah *BESOK*.

📦 Barang:
${itemList}

📅 Tanggal kirim: *${po.deliveryDate}*

Mohon:
✅ Pastikan barang sudah dipacking
✅ Kabari jam keberangkatan besok
✅ Update status di app setelah berangkat

_SRCM MBG Platform_`;

    await sendWA(supplier.phone, msg, 'reminder_h1');
    await new Promise(r => setTimeout(r, 1500));
  }
}

// ── Reminder H-0 ──────────────────────────────────────────
async function runH0() {
  const target = dateStr(0);
  console.log(`\n[H-0] Checking PO for delivery date: ${target}`);
  const pos = await getPOsForReminder(target);
  console.log(`[H-0] Found ${pos.length} PO(s)`);

  for (const po of pos) {
    const supplier = await getSupplier(po.supplierId);
    if (!supplier?.phone) continue;

    const msg =
`🚛 *HARI PENGIRIMAN — ${po.poId}*

Halo *${supplier.name}*, hari ini jadwal pengiriman ke *${po.dapurName}*.

Mohon:
📱 Kabari jam berangkat via WA ini
🔗 Update status: ${APP_URL}/supplier/po-confirm.html?po=${po.poId}
📞 Hubungi dapur jika ada kendala

Terima kasih! 🙏
_SRCM MBG Platform_`;

    await sendWA(supplier.phone, msg, 'reminder_h0');
    await new Promise(r => setTimeout(r, 1500));
  }
}

// ── Price request mingguan (tiap Senin = day 1) ────────────
async function runWeeklyPriceRequest() {
  const dayOfWeek = new Date().getDay(); // 0=Minggu, 1=Senin
  if (dayOfWeek !== 1) {
    console.log('[PRICE] Bukan hari Senin, skip price request blast');
    return;
  }

  console.log('\n[PRICE] Senin — blast price request ke semua supplier');
  const suppSnap = await db.collection('suppliers').get();
  const suppliers = suppSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`[PRICE] ${suppliers.length} supplier ditemukan`);

  const STANDARD_ITEMS = [
    'Beras','Ayam Broiler','Ikan Lele','Telur Ayam','Tahu','Tempe',
    'Kangkung','Bayam','Wortel','Kentang','Tomat',
    'Bawang Merah','Bawang Putih','Cabai Rawit','Minyak Goreng',
    'Gula Pasir','Garam','Tepung Terigu',
  ];

  for (const sup of suppliers) {
    // Generate token
    const token = Math.random().toString(36).slice(2,10).toUpperCase();
    const reqId = `REQ-${Date.now()}-${token}`;

    // Simpan request ke Firestore
    const requestedItems = (sup.bahanItems?.length ? sup.bahanItems : STANDARD_ITEMS.map(n => ({ nama: n, satuan: 'kg' })));
    await db.collection('price_requests').doc(reqId).set({
      reqId, supplierId: sup.id, supplierPhone: sup.phone, token,
      status: 'pending', requestedItems, requestedAt: Date.now(), filledAt: null,
    });

    const itemList = requestedItems.slice(0,8).map(i => `• ${i.nama}`).join('\n');
    const formUrl  = `${APP_URL}/supplier/price-update.html?token=${token}`;

    const msg =
`Halo *${sup.name}* 👋

Kami dari *SRCM MBG Platform* meminta update harga minggu ini:

${itemList}
${requestedItems.length > 8 ? `...dan ${requestedItems.length - 8} bahan lainnya` : ''}

Mohon isi harga terbaru:
🔗 ${formUrl}

Terima kasih 🙏
_SRCM MBG — Update harga rutin setiap Senin_`;

    await sendWA(sup.phone, msg, 'price_request');
    await db.collection('suppliers').doc(sup.id).update({ lastRequestSentAt: Date.now() });
    await new Promise(r => setTimeout(r, 2000));
  }
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`SRCM MBG Cron Reminder — ${new Date().toLocaleString('id-ID')}`);
  console.log('='.repeat(50));

  try {
    await runWeeklyPriceRequest();
    await runH2();
    await runH1();
    await runH0();
    console.log('\n✅ Semua reminder selesai diproses');
  } catch(e) {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  }
  process.exit(0);
}

main();
