import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

// Init Firebase (singleton guard)
let _app, _auth, _db;
function getApp() {
  if (!_app) {
    try {
      _app = initializeApp(firebaseConfig);
    } catch (e) {
      // already initialized
      const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      _app = getApp();
    }
  }
  return _app;
}

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ─────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────

/** Login dengan email+password, return userData dari Firestore */
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return getUserData(cred.user.uid);
}

/** Register user baru; role default 'dapur' */
export async function register(email, password, name, role = 'dapur') {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const userData = {
    uid: cred.user.uid,
    name,
    email,
    role,          // 'dapur' | 'admin'
    createdAt: Date.now()
  };
  await setDoc(doc(db, 'users', cred.user.uid), userData);
  return userData;
}

/** Ambil data user dari Firestore */
export async function getUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/** Logout dan redirect ke login */
export async function logout() {
  await signOut(auth);
  window.location.href = '/auth/login.html';
}

/**
 * Guard halaman — cek auth + role.
 * Panggil di top setiap halaman dapur/supplier.
 * @param {string|null} requiredRole 'dapur' | 'supplier' | null (any)
 * @returns {Promise<{uid, name, email, role}>}
 */
export function requireAuth(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async user => {
      if (!user) {
        window.location.href = '/auth/login.html';
        return;
      }
      const data = await getUserData(user.uid);
      if (!data) {
        window.location.href = '/auth/login.html';
        return;
      }
      if (requiredRole && data.role !== requiredRole) {
        // redirect ke dashboard role yang benar
        const roleHome = { dapur: '/dapur/dashboard.html', admin: '/admin/dashboard.html' };
        window.location.href = roleHome[data.role] || '/auth/login.html';
        return;
      }
      resolve(data);
    });
  });
}
