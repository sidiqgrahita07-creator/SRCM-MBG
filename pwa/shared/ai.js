import { DEEPSEEK_API_KEY } from '../firebase-config.js';

const BASE_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL    = 'deepseek-chat';

export async function askAI(systemPrompt, userMessage, options = {}) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  }
      ],
      temperature:     options.temperature ?? 0.7,
      max_tokens:      options.max_tokens   ?? 2500,
      response_format: options.json ? { type: 'json_object' } : undefined
    })
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content;
}

export async function askAIStream(systemPrompt, userMessage, onChunk) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: MODEL, stream: true, temperature: 0.7, max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  }
      ]
    })
  });
  const reader = res.body.getReader();
  const dec    = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      try { const c = JSON.parse(raw).choices?.[0]?.delta?.content; if (c) { full += c; onChunk(c); } } catch {}
    }
  }
  return full;
}

// ══════════════════════════════════════════════════════════════
// PROMPT PRESETS
// ══════════════════════════════════════════════════════════════
export const PROMPTS = {

  // ── Menu dari input user (custom dish) ─────────────────────
  MENU_CUSTOM: `Kamu adalah ahli gizi dan chef untuk program MBG (Makan Bergizi Gratis) Indonesia.
User akan memberi nama/jenis hidangan yang diinginkan. Tugas kamu:
1. Breakdown bahan-bahan yang dibutuhkan untuk hidangan tersebut
2. Hitung kalori, protein, karbo, lemak per porsi
3. Estimasi harga per porsi berdasarkan harga pasar Indonesia 2025-2026

WAJIB balas HANYA JSON valid:
{
  "menu": [
    {
      "nama": "Nasi Ayam Goreng",
      "waktu_hidang": "Makan Siang",
      "kalori_per_porsi": 520,
      "protein_gram": 30,
      "karbohidrat_gram": 60,
      "lemak_gram": 14,
      "harga_estimasi_per_porsi": 15000,
      "bahan": [
        {
          "nama": "Beras",
          "qty_per_porsi_gram": 150,
          "total_gram": 15000,
          "satuan": "kg",
          "harga_referensi_per_kg": 14000,
          "subtotal": 210000
        }
      ]
    }
  ],
  "total_raw_material": [
    {
      "nama": "Beras",
      "satuan": "kg",
      "total_kg": 15,
      "harga_referensi_per_kg": 14000,
      "total_harga": 210000
    }
  ],
  "total_biaya_estimasi": 1780000,
  "catatan_nutrisi": "Catatan singkat tentang kandungan gizi"
}`,

  // ── Rekomendasi menu berdasarkan harga pasar DB ─────────────
  MENU_CHEAPEST: `Kamu adalah ahli procurement dan gizi untuk program MBG Indonesia.
User akan memberikan data harga pasar terkini dari database supplier dan parameter menu.
Tugas kamu: Rekomendasikan menu yang PALING EKONOMIS namun tetap memenuhi standar gizi MBG.

Prioritaskan bahan yang harganya sedang murah di database.
Standar MBG: min 400 kcal/porsi, protein min 15g, ada karbohidrat + sayuran.

WAJIB balas HANYA JSON valid (format sama dengan MENU_CUSTOM).
Tambahkan field "alasan_pilihan" di setiap menu: kenapa menu ini dipilih berdasarkan harga pasar.`,

  // ── Review PO ──────────────────────────────────────────────
  PO_REVIEW: `Kamu adalah AI procurement analyst untuk supply chain MBG.
Review Purchase Order berikut. Balas JSON:
{
  "status": "ok"|"perhatian"|"masalah",
  "catatan": "ringkasan",
  "flags": ["hal yang perlu diperhatikan"],
  "saran": "saran konkret"
}`,

  // ── QC Analysis ────────────────────────────────────────────
  QC_ANALYSIS: `Kamu adalah quality control analyst untuk pengiriman bahan makanan MBG.
Analisis hasil QC. Balas HANYA JSON:
{
  "status_keseluruhan": "baik"|"perlu_perhatian"|"bermasalah",
  "skor_qc": 85,
  "ringkasan": "...",
  "item_bermasalah": [
    { "nama": "...", "masalah": "...", "dampak_invoice": 28000, "rekomendasi": "kredit/retur/abaikan" }
  ],
  "total_penyesuaian_invoice": 28000,
  "rekomendasi_tindakan": "..."
}`,

  // ── ERP Invoice ────────────────────────────────────────────
  ERP_INVOICE: `Kamu adalah asisten ERP untuk perusahaan supplier bahan makanan.
Buat invoice formal dalam Bahasa Indonesia berdasarkan data PO.
Format teks rapi, bisa langsung dicetak.
Sertakan: nomor invoice, tanggal, data supplier, data pembeli, tabel item, subtotal, PPN 11%, management fee platform, total.`,

  // ── Surat Jalan ────────────────────────────────────────────
  ERP_SURAT_JALAN: `Kamu adalah asisten ERP. Buat surat jalan pengiriman barang yang formal dan ringkas.
Sertakan: nomor surat, tanggal, pengirim, penerima, tabel barang, supir, plat, tanda tangan placeholder.`,

  // ── Route recommendation ───────────────────────────────────
  ROUTE_RECOMMEND: `Kamu adalah asisten logistik untuk pengiriman bahan makanan MBG.
Diberikan list supplier dengan koordinat dan barang yang harus dijemput.
Rekomendasikan urutan kunjungan yang PALING EFISIEN (jarak terpendek, tapi prioritaskan bahan yang mudah rusak dijemput terakhir).
Balas JSON:
{
  "urutan": [
    {
      "urutan_ke": 1,
      "supplier": "Nama Supplier",
      "alamat": "...",
      "barang": ["Beras 15kg", "Tepung 5kg"],
      "alasan": "Dekat dari gudang, bahan tahan lama"
    }
  ],
  "total_estimasi_km": 23.5,
  "tips_logistik": "Saran praktis pengiriman hari ini"
}`,

  // ── Chat assistant ─────────────────────────────────────────
  CHAT_ASSISTANT: `Kamu adalah asisten AI untuk platform supply chain MBG (Makan Bergizi Gratis).
Bantu dengan pertanyaan seputar: menu, bahan makanan, harga pasar, PO, supplier, pengiriman, QC, dan dokumen.
Jawab Bahasa Indonesia ramah dan profesional. Jika ada @ai di pesan, itu artinya user memanggilmu.`,

  // ── Daily insight ──────────────────────────────────────────
  DAILY_INSIGHT: `Kamu adalah AI analyst supply chain MBG. Berikan insight harian singkat Bahasa Indonesia
berdasarkan data. Fokus: pola kebutuhan bahan, efisiensi biaya, potensi penghematan, supplier terbaik minggu ini.
Maksimal 3 poin, to the point.`,

  // ── WA message generator ───────────────────────────────────
  WA_PRICE_REQUEST: `Buat pesan WhatsApp singkat, ramah, dan profesional dalam Bahasa Indonesia
untuk meminta update harga bahan makanan kepada supplier.
Sertakan: sapaan nama supplier, nama platform (SRCM MBG), list bahan yang diminta harganya, dan instruksi isi form via link.
Maksimal 5 baris, mudah dibaca di HP.`,

  WA_PO_NOTIF: `Buat pesan WhatsApp singkat untuk memberitahu supplier bahwa ada Purchase Order masuk.
Sertakan: nomor PO, nama dapur, list barang + qty, tanggal pengiriman, link konfirmasi.
Ramah, profesional, maksimal 8 baris.`,
};
