/**
 * shared/wa.js — Fonnte WhatsApp API wrapper
 * Docs: https://fonnte.com/api
 *
 * Setup:
 * 1. Daftar di fonnte.com
 * 2. Connect nomor WA sender
 * 3. Dapat API token → isi di firebase-config.js → FONNTE_TOKEN
 */
import { FONNTE_TOKEN, APP_URL } from '../firebase-config.js';

const FONNTE_URL = 'https://api.fonnte.com/send';

// ─── Core sender ───────────────────────────────────────────
export async function sendWA(phone, message, options = {}) {
  // Normalize phone: hilangkan +, 0 di awal → 62xxx
  const normalized = phone.replace(/\D/g, '').replace(/^0/, '62').replace(/^\+/, '');

  const body = new URLSearchParams({
    target:      normalized,
    message,
    countryCode: '62',
    ...(options.delay     ? { delay:     String(options.delay)     } : {}),
    ...(options.schedule  ? { schedule:  String(options.schedule)  } : {}),
  });

  const res = await fetch(FONNTE_URL, {
    method:  'POST',
    headers: { Authorization: FONNTE_TOKEN },
    body,
  });

  const data = await res.json();
  if (!data.status) throw new Error(`Fonnte error: ${data.reason || JSON.stringify(data)}`);

  // Simpan ke WA log di localStorage (audit trail ringan)
  logWA({ phone: normalized, message, type: options.type || 'manual', sentAt: Date.now() });
  return data;
}

// ─── WA Log (localStorage-based, nanti bisa upgrade ke Firestore) ──
function logWA(entry) {
  try {
    const logs = JSON.parse(localStorage.getItem('srcm_wa_log') || '[]');
    logs.unshift(entry);
    localStorage.setItem('srcm_wa_log', JSON.stringify(logs.slice(0, 200))); // max 200 log
  } catch {}
}

export function getWALogs() {
  try { return JSON.parse(localStorage.getItem('srcm_wa_log') || '[]'); }
  catch { return []; }
}

// ══════════════════════════════════════════════════════════════
// PESAN-PESAN TERSTANDAR
// ══════════════════════════════════════════════════════════════

/**
 * 1. Price Request — minta update harga ke supplier
 */
export async function sendPriceRequest(supplier, requestedItems, reqId, token) {
  const itemList = requestedItems.map(i => `• ${i.nama} (${i.satuan})`).join('\n');
  const formUrl  = `${APP_URL}/supplier/price-update.html?token=${token}`;

  const message =
`Halo *${supplier.name}* 👋

Kami dari *SRCM MBG Platform* ingin meminta update harga bahan berikut:

${itemList}

Mohon isi harga terbaru di link ini:
🔗 ${formUrl}

Terima kasih atas kerjasamanya 🙏
_SRCM MBG — Supply Chain Management_`;

  return sendWA(supplier.phone, message, { type: 'price_request' });
}

/**
 * 2. Notifikasi PO masuk ke supplier
 */
export async function sendPONotification(supplier, po) {
  const itemList = po.items
    .filter(i => i.supplierId === supplier.id)
    .map(i => `• ${i.namaItem}: ${i.qty} ${i.satuan} @ Rp${Number(i.harga).toLocaleString('id-ID')}`)
    .join('\n');

  const confirmUrl = `${APP_URL}/supplier/po-confirm.html?po=${po.poId}&token=${po.supplierTokens?.[supplier.id] || ''}`;

  const message =
`📋 *PURCHASE ORDER MASUK*

Dari: *${po.dapurName}*
No PO: *${po.poId}*
Tgl Kirim: *${po.deliveryDate}*

Item:
${itemList}

Total: *Rp ${Number(po.total).toLocaleString('id-ID')}*

Konfirmasi ketersediaan:
🔗 ${confirmUrl}

_SRCM MBG Platform_`;

  return sendWA(supplier.phone, message, { type: 'po_notification' });
}

/**
 * 3. Reminder H-2
 */
export async function sendReminderH2(supplier, po) {
  const itemList = po.items
    .filter(i => i.supplierId === supplier.id)
    .map(i => `• ${i.namaItem} ${i.qty} ${i.satuan}`)
    .join('\n');

  const message =
`⏰ *REMINDER — 2 Hari Lagi*

Halo *${supplier.name}*, pengingat bahwa Anda memiliki pengiriman ke *${po.dapurName}* dalam *2 hari*.

📦 Barang:
${itemList}

📅 Tanggal kirim: *${po.deliveryDate}*

Mohon pastikan barang sudah siap dan dalam kondisi baik.
_SRCM MBG Platform_`;

  return sendWA(supplier.phone, message, { type: 'reminder_h2' });
}

/**
 * 4. Reminder H-1
 */
export async function sendReminderH1(supplier, po) {
  const itemList = po.items
    .filter(i => i.supplierId === supplier.id)
    .map(i => `• ${i.namaItem} ${i.qty} ${i.satuan}`)
    .join('\n');

  const message =
`🚨 *REMINDER — BESOK KIRIM*

Halo *${supplier.name}*, pengiriman ke *${po.dapurName}* adalah *BESOK*.

📦 Barang:
${itemList}

📅 Tanggal kirim: *${po.deliveryDate}*

Mohon:
✅ Pastikan barang sudah dipacking
✅ Konfirmasi jam keberangkatan ke kami
✅ Update status di app jika sudah berangkat

_SRCM MBG Platform_`;

  return sendWA(supplier.phone, message, { type: 'reminder_h1' });
}

/**
 * 5. Reminder H-0 (hari pengiriman)
 */
export async function sendReminderH0(supplier, po) {
  const message =
`🚛 *HARI PENGIRIMAN*

Halo *${supplier.name}*, hari ini adalah jadwal pengiriman ke *${po.dapurName}*.

Mohon:
📱 Kabari jam berangkat
🚗 Update status pengiriman di link PO
📞 Hubungi dapur jika ada kendala

Terima kasih! 🙏
_SRCM MBG Platform_`;

  return sendWA(supplier.phone, message, { type: 'reminder_h0' });
}

/**
 * 6. Hasil QC ke supplier
 */
export async function sendQCResult(supplier, po, qcResult) {
  const status   = qcResult.status_keseluruhan;
  const emoji    = status === 'baik' ? '✅' : status === 'perlu_perhatian' ? '⚠️' : '❌';
  const adj      = qcResult.total_penyesuaian_invoice
    ? `\n💰 Penyesuaian invoice: Rp ${Number(qcResult.total_penyesuaian_invoice).toLocaleString('id-ID')}`
    : '';

  const message =
`${emoji} *HASIL QC — ${po.poId}*

Dari: *${po.dapurName}*
Skor QC: *${qcResult.skor_qc}/100*
Status: *${status.replace('_',' ').toUpperCase()}*

${qcResult.ringkasan}${adj}

${qcResult.rekomendasi_tindakan || ''}

_SRCM MBG Platform_`;

  return sendWA(supplier.phone, message, { type: 'qc_result' });
}

/**
 * 7. Generate WA chat link (buka WA langsung ke nomor supplier)
 * Dipakai tombol "Chat WA" di price comparison
 */
export function buildWAChatLink(supplierPhone, prefillMessage = '') {
  const normalized = supplierPhone.replace(/\D/g, '').replace(/^0/, '62');
  const encoded    = encodeURIComponent(prefillMessage);
  return `https://wa.me/${normalized}${encoded ? `?text=${encoded}` : ''}`;
}

/**
 * 8. Generate pre-filled WA message untuk negosiasi harga
 */
export function buildNegotiationMessage(dapurName, supplierName, items) {
  const itemList = items.map(i =>
    `• ${i.namaItem}: ${i.qty} ${i.satuan} (harga DB: Rp${Number(i.harga).toLocaleString('id-ID')}/${i.satuan})`
  ).join('\n');

  return `Halo Bapak/Ibu *${supplierName}*, perkenalkan saya dari *${dapurName}* melalui platform SRCM MBG.

Kami tertarik untuk order:
${itemList}

Apakah harga di atas bisa lebih baik? Kami terbuka untuk negosiasi 🙏

Terima kasih.`;
}
