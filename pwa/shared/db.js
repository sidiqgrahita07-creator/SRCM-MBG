import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ─── Generic helpers ───────────────────────────────────────

export const ts = () => serverTimestamp();

export async function dbAdd(col, data) {
  const ref = await addDoc(collection(db, col), { ...data, createdAt: ts() });
  return ref.id;
}

export async function dbSet(col, id, data) {
  await setDoc(doc(db, col, id), { ...data, updatedAt: ts() }, { merge: true });
}

export async function dbGet(col, id) {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function dbGetAll(col, constraints = []) {
  const q = query(collection(db, col), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function dbUpdate(col, id, data) {
  await updateDoc(doc(db, col, id), { ...data, updatedAt: ts() });
}

export async function dbDelete(col, id) {
  await deleteDoc(doc(db, col, id));
}

export function dbListen(col, constraints, callback) {
  const q = query(collection(db, col), ...constraints);
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── PO helpers ───────────────────────────────────────────

export function generatePoId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const rand = Math.random().toString(36).slice(2,5).toUpperCase();
  return `PO-${dateStr}-${rand}`;
}

export async function createPO(dapurData, items, deliveryDate, notes = '') {
  const poId = generatePoId();
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const po = {
    poId,
    dapurId: dapurData.uid,
    dapurName: dapurData.name,
    supplierId: null,   // akan diisi supplier pertama yang assign (atau hardcode uid supplier)
    status: 'draft',
    items,
    total,
    deliveryDate,
    notes,
    aiDraftNotes: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await setDoc(doc(db, 'purchase_orders', poId), po);
  return po;
}

export async function getPOsByDapur(dapurId) {
  return dbGetAll('purchase_orders', [where('dapurId', '==', dapurId), orderBy('createdAt', 'desc')]);
}

export async function getAllPOs(statusFilter = null) {
  const constraints = [orderBy('createdAt', 'desc')];
  if (statusFilter) constraints.push(where('status', '==', statusFilter));
  return dbGetAll('purchase_orders', constraints);
}

export async function updatePOStatus(poId, status, extraData = {}) {
  await dbUpdate('purchase_orders', poId, { status, ...extraData });
}

// ─── Delivery helpers ──────────────────────────────────────

export function generateDeliveryId() {
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `DLV-${Date.now()}-${rand}`;
}

export async function createDelivery(poId, dapurId, supplierId, estimasiTiba) {
  const deliveryId = generateDeliveryId();
  const data = {
    deliveryId, poId, dapurId, supplierId,
    status: 'preparing',
    statusHistory: [{ status: 'preparing', time: Date.now(), note: 'Pesanan sedang dipersiapkan' }],
    estimasiTiba,
    driverName: '', driverPhone: '', platNomor: '',
    kendala: '',
    createdAt: Date.now()
  };
  await setDoc(doc(db, 'deliveries', deliveryId), data);
  return data;
}

export async function addDeliveryStatus(deliveryId, status, note) {
  const delivery = await dbGet('deliveries', deliveryId);
  const history = delivery.statusHistory || [];
  history.push({ status, time: Date.now(), note });
  await dbUpdate('deliveries', deliveryId, { status, statusHistory: history });
}

// ─── QC helpers ────────────────────────────────────────────

export async function createQCReport(poId, dapurId, items) {
  const qcId = `QC-${poId}`;
  const data = {
    qcId, poId, dapurId,
    items,   // [{nama, qtyDipesan, qtyDiterima, kondisi, catatan, fotoUrl}]
    aiSummary: '',
    skorQC: null,
    status: 'pending_review',
    createdAt: Date.now()
  };
  await setDoc(doc(db, 'qc_reports', qcId), data);
  return data;
}

// ─── Exports re-export Firebase query helpers ──────────────
export { where, orderBy, limit, onSnapshot };
