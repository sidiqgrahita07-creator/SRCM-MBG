import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, limit, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { firebaseConfig } from '../firebase-config.js';

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

export const ts = () => serverTimestamp();

// ─── Generic CRUD ──────────────────────────────────────────
export async function dbAdd(col, data) {
  const ref = await addDoc(collection(db, col), { ...data, createdAt: Date.now() });
  return ref.id;
}
export async function dbSet(col, id, data) {
  await setDoc(doc(db, col, id), { ...data, updatedAt: Date.now() }, { merge: true });
}
export async function dbGet(col, id) {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export async function dbGetAll(col, constraints = []) {
  const q    = query(collection(db, col), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function dbUpdate(col, id, data) {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: Date.now() });
}
export async function dbDelete(col, id) {
  await deleteDoc(doc(db, col, id));
}
export function dbListen(col, constraints, callback) {
  const q = query(collection(db, col), ...constraints);
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// ─── Firestore query helpers re-export ─────────────────────
export { where, orderBy, limit, onSnapshot, getCountFromServer, collection };

// ══════════════════════════════════════════════════════════════
// SUPPLIER CATALOG & PRICE ENGINE
// ══════════════════════════════════════════════════════════════

/**
 * Firestore schema:
 *
 * suppliers/{supplierId}
 *   - name, phone (WA), address, wilayah, rating, verified, uid (kalau login)
 *   - joinedAt, lastPriceUpdate
 *
 * supplier_prices/{supplierId}/items/{itemId}
 *   - namaItem, satuan, harga, stokAda (bool), catatan, updatedAt
 *   (sub-collection per supplier)
 *
 * price_requests/{reqId}
 *   - supplierId, supplierPhone, token, status: pending|filled|expired
 *   - requestedAt, filledAt, items: [{nama, satuan}]  ← items yang diminta
 *
 * market_prices/{itemName}  ← aggregated view (AI-updated)
 *   - namaItem, satuan
 *   - lowestPrice, lowestSupplierId, lowestSupplierName
 *   - avgPrice, highestPrice
 *   - suppliers: [{supplierId, name, harga, updatedAt}]
 *   - lastAggregatedAt
 */

// ─── Suppliers ─────────────────────────────────────────────
export async function createSupplier(data) {
  const id = `SUP-${Date.now()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
  await setDoc(doc(db, 'suppliers', id), { ...data, verified: false, rating: 5.0, joinedAt: Date.now() });
  return id;
}

export async function getAllSuppliers() {
  return dbGetAll('suppliers', [orderBy('joinedAt', 'desc')]);
}

// ─── Supplier Prices (sub-collection) ──────────────────────
export async function setSupplierPrice(supplierId, namaItem, satuan, harga, stokAda = true, catatan = '') {
  const itemId = namaItem.toLowerCase().replace(/\s+/g, '_');
  await setDoc(
    doc(db, 'supplier_prices', supplierId, 'items', itemId),
    { namaItem, satuan, harga: +harga, stokAda, catatan, updatedAt: Date.now() },
    { merge: true }
  );
  // Update lastPriceUpdate di supplier doc
  await dbUpdate('suppliers', supplierId, { lastPriceUpdate: Date.now() });
  // Trigger aggregation
  await aggregateMarketPrice(namaItem, satuan);
}

export async function getSupplierPrices(supplierId) {
  const snap = await getDocs(collection(db, 'supplier_prices', supplierId, 'items'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Market Price Aggregation ───────────────────────────────
export async function aggregateMarketPrice(namaItem, satuan) {
  // Kumpulkan harga dari semua supplier untuk item ini
  const itemId   = namaItem.toLowerCase().replace(/\s+/g, '_');
  const suppliers = await getAllSuppliers();
  const prices    = [];

  for (const sup of suppliers) {
    const itemSnap = await getDoc(doc(db, 'supplier_prices', sup.id, 'items', itemId));
    if (itemSnap.exists() && itemSnap.data().stokAda) {
      prices.push({
        supplierId:   sup.id,
        supplierName: sup.name,
        supplierPhone: sup.phone,
        harga:        itemSnap.data().harga,
        updatedAt:    itemSnap.data().updatedAt,
        catatan:      itemSnap.data().catatan || '',
      });
    }
  }

  if (!prices.length) return;

  prices.sort((a, b) => a.harga - b.harga);
  const lowest  = prices[0];
  const avgPrice = Math.round(prices.reduce((s, p) => s + p.harga, 0) / prices.length);

  await setDoc(doc(db, 'market_prices', itemId), {
    namaItem, satuan,
    lowestPrice:      lowest.harga,
    lowestSupplierId: lowest.supplierId,
    lowestSupplierName: lowest.supplierName,
    avgPrice,
    highestPrice: prices[prices.length - 1].harga,
    suppliers:    prices,
    lastAggregatedAt: Date.now(),
  }, { merge: true });
}

export async function getMarketPrice(namaItem) {
  const itemId = namaItem.toLowerCase().replace(/\s+/g, '_');
  return dbGet('market_prices', itemId);
}

export async function getAllMarketPrices() {
  return dbGetAll('market_prices', [orderBy('namaItem')]);
}

/**
 * Cari harga termurah untuk list bahan.
 * Return: [ { namaItem, satuan, qty, bestSupplier, harga, subtotal, alternatives } ]
 */
export async function findCheapestBundle(items) {
  const result = [];
  for (const item of items) {
    const mp = await getMarketPrice(item.nama);
    if (!mp) {
      result.push({ ...item, bestSupplier: null, harga: null, subtotal: null, alternatives: [] });
      continue;
    }
    const best = mp.suppliers[0]; // sorted ascending
    result.push({
      namaItem:    item.nama,
      satuan:      item.satuan || mp.satuan,
      qty:         item.qty,
      bestSupplier: { id: best.supplierId, name: best.supplierName, phone: best.supplierPhone },
      harga:       best.harga,
      subtotal:    best.harga * item.qty,
      alternatives: mp.suppliers.slice(1, 3), // 2 alternatif termurah berikutnya
    });
  }
  return result;
}

// ─── Price Request (WA token flow) ─────────────────────────
export async function createPriceRequest(supplierId, supplierPhone, requestedItems) {
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  const reqId = `REQ-${Date.now()}-${token}`;
  await setDoc(doc(db, 'price_requests', reqId), {
    reqId, supplierId, supplierPhone, token,
    status: 'pending',
    requestedItems, // [{nama, satuan}]
    requestedAt: Date.now(),
    filledAt: null,
  });
  return { reqId, token };
}

export async function fillPriceRequest(token, prices) {
  // prices: [{namaItem, satuan, harga, stokAda, catatan}]
  const snap = await getDocs(query(collection(db, 'price_requests'), where('token', '==', token)));
  if (snap.empty) throw new Error('Token tidak valid atau sudah kadaluarsa');
  const req  = snap.docs[0];
  const data = req.data();

  // Update masing-masing harga di supplier_prices
  for (const p of prices) {
    await setSupplierPrice(data.supplierId, p.namaItem, p.satuan, p.harga, p.stokAda !== false, p.catatan || '');
  }

  // Mark request as filled
  await dbUpdate('price_requests', req.id, { status: 'filled', filledAt: Date.now() });
  return data.supplierId;
}

export async function getPendingRequests() {
  return dbGetAll('price_requests', [where('status', '==', 'pending'), orderBy('requestedAt', 'desc')]);
}

// ─── PO helpers ────────────────────────────────────────────
export function generatePoId() {
  const d   = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  return `PO-${dateStr}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}

export async function createPO(dapurData, items, deliveryDate, notes = '', targetSupplierId = null) {
  const poId  = generatePoId();
  const total = items.reduce((s, i) => s + (i.subtotal || 0), 0);
  const po    = {
    poId, dapurId: dapurData.uid, dapurName: dapurData.name,
    supplierId: targetSupplierId,
    status: 'draft', items, total, deliveryDate, notes,
    aiDraftNotes: '', createdAt: Date.now(), updatedAt: Date.now(),
    // komisi platform (dicatat untuk admin dashboard)
    platformFee: Math.round(total * 0.03), // 3% komisi
  };
  await setDoc(doc(db, 'purchase_orders', poId), po);
  return po;
}

export async function getPOsByDapur(dapurId) {
  return dbGetAll('purchase_orders', [where('dapurId', '==', dapurId), orderBy('createdAt', 'desc')]);
}
export async function getAllPOs() {
  return dbGetAll('purchase_orders', [orderBy('createdAt', 'desc')]);
}
export async function updatePOStatus(poId, status, extra = {}) {
  await dbUpdate('purchase_orders', poId, { status, ...extra });
}

// ─── Delivery helpers ──────────────────────────────────────
export function generateDeliveryId() {
  return `DLV-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}
export async function createDelivery(poId, dapurId, supplierId, estimasiTiba) {
  const deliveryId = generateDeliveryId();
  const data = {
    deliveryId, poId, dapurId, supplierId, status: 'preparing',
    statusHistory: [{ status: 'preparing', time: Date.now(), note: 'Pesanan sedang dipersiapkan' }],
    estimasiTiba, driverName: '', driverPhone: '', platNomor: '', kendala: '',
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'deliveries', deliveryId), data);
  return data;
}
export async function addDeliveryStatus(deliveryId, status, note) {
  const d       = await dbGet('deliveries', deliveryId);
  const history = [...(d.statusHistory || []), { status, time: Date.now(), note }];
  await dbUpdate('deliveries', deliveryId, { status, statusHistory: history });
}

// ─── QC helpers ────────────────────────────────────────────
export async function createQCReport(poId, dapurId, items) {
  const qcId = `QC-${poId}`;
  const data = { qcId, poId, dapurId, items, aiSummary: '', skorQC: null, status: 'pending_review', createdAt: Date.now() };
  await setDoc(doc(db, 'qc_reports', qcId), data);
  return data;
}
