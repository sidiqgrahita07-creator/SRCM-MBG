// =====================================================
// FIREBASE CONFIG — isi dengan config dari Firebase Console
// Project Settings → Your Apps → Firebase SDK snippet → Config
// =====================================================
export const firebaseConfig = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "PROJECT.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
  databaseURL: "https://PROJECT-default-rtdb.firebaseio.com"
};

// =====================================================
// DEEPSEEK API KEY — dari platform.deepseek.com
// Untuk production: simpan di Netlify env vars, jangan push ke GitHub publik
// =====================================================
export const DEEPSEEK_API_KEY = "DEEPSEEK_API_KEY_HERE";
