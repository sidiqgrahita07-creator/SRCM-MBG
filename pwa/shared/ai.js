import { DEEPSEEK_API_KEY } from '../firebase-config.js';

const BASE_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL    = 'deepseek-chat';

/**
 * Panggil DeepSeek API — single response
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {{ json?: boolean, temperature?: number, max_tokens?: number }} options
 * @returns {Promise<string>}
 */
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
        { role: 'user',   content: userMessage  }
      ],
      temperature:     options.temperature  ?? 0.7,
      max_tokens:      options.max_tokens   ?? 2000,
      response_format: options.json ? { type: 'json_object' } : undefined
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Panggil DeepSeek API — streaming (untuk chat realtime)
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {(chunk: string) => void} onChunk dipanggil per token
 * @returns {Promise<string>} full response
 */
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
        { role: 'user',   content: userMessage  }
      ],
      stream:      true,
      temperature: 0.7,
      max_tokens:  2000
    })
  });

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      try {
        const chunk = JSON.parse(raw).choices?.[0]?.delta?.content;
        if (chunk) { full += chunk; onChunk(chunk); }
      } catch {}
    }
  }
  return full;
}

// ─── Prompt presets ────────────────────────────────────────

export const PROMPTS = {

  MENU_PLANNER: `Kamu adalah AI perencana menu untuk program MBG (Makan Bergizi Gratis) Indonesia.
Tugas: Buat rencana menu sesuai input user.
WAJIB balas HANYA dengan JSON valid, tanpa teks lain.
Format output WAJIB:
{
  "menu": [
    {
      "nama": "Nasi Ayam Goreng",
      "waktu_hidang": "Makan Siang",
      "kalori_per_porsi": 520,
      "protein_gram": 28,
      "karbohidrat_gram": 65,
      "lemak_gram": 14,
      "harga_estimasi_per_porsi": 15000,
      "bahan": [
        {
          "nama": "Beras",
          "qty_per_porsi_gram": 150,
          "total_gram": 15000,
          "harga_per_kg": 14000,
          "subtotal": 210000
        }
      ]
    }
  ],
  "total_raw_material": [
    {
      "nama": "Beras",
      "total_gram": 15000,
      "total_kg": 15,
      "harga_per_kg": 14000,
      "total_harga": 210000
    }
  ],
  "total_biaya_estimasi": 3750000,
  "catatan": "Rekomendasi dan catatan nutrisi singkat"
}`,

  PO_REVIEW: `Kamu adalah AI procurement analyst untuk supply chain MBG.
Tugasmu: Review Purchase Order berikut dan berikan analisis singkat.
Balas dalam format JSON:
{
  "status": "ok" | "perhatian" | "masalah",
  "catatan": "ringkasan singkat",
  "flags": ["item atau kondisi yang perlu diperhatikan"],
  "saran": "saran konkret jika ada masalah"
}`,

  QC_ANALYSIS: `Kamu adalah quality control analyst untuk pengiriman bahan makanan MBG.
Analisis hasil QC berikut. Balas HANYA JSON valid:
{
  "status_keseluruhan": "baik" | "perlu_perhatian" | "bermasalah",
  "skor_qc": 85,
  "ringkasan": "Penjelasan singkat kondisi keseluruhan",
  "item_bermasalah": [
    {
      "nama": "nama bahan",
      "masalah": "deskripsi masalah",
      "dampak_invoice": 28000,
      "rekomendasi": "kredit/retur/abaikan"
    }
  ],
  "total_penyesuaian_invoice": 28000,
  "rekomendasi_tindakan": "Tindakan yang disarankan"
}`,

  ERP_INVOICE: `Kamu adalah asisten ERP untuk perusahaan supplier bahan makanan.
Buat invoice formal dalam Bahasa Indonesia berdasarkan data PO yang diberikan.
Format teks yang rapi, bisa langsung dicetak.
Sertakan: nomor invoice, tanggal, data supplier, data pembeli, tabel item, subtotal, PPN (11%), total.`,

  ERP_SURAT_JALAN: `Kamu adalah asisten ERP. Buat surat jalan pengiriman barang yang formal dan ringkas
berdasarkan data yang diberikan. Sertakan: nomor surat, tanggal, pengirim, penerima, tabel barang,
supir, plat nomor, tanda tangan placeholder.`,

  CHAT_ASSISTANT: `Kamu adalah asisten AI untuk platform supply chain MBG (Makan Bergizi Gratis).
Bantu pengguna dengan pertanyaan seputar: menu, bahan makanan, PO, pengiriman, QC, dan dokumen.
Jawab dalam Bahasa Indonesia yang ramah dan profesional. Jika ada @ai di pesan, itu artinya user memanggilmu.`,

  DAILY_INSIGHT: `Kamu adalah AI analyst supply chain MBG. Berikan insight harian singkat dalam Bahasa Indonesia
berdasarkan data yang diberikan. Fokus pada: pola kebutuhan bahan, efisiensi biaya, potensi penghematan.
Maksimal 3 poin insight, to the point.`
};
