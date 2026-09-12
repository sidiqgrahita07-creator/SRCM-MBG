// =====================================================
// FIREBASE CONFIG — isi dengan config dari Firebase Console
// Project Settings → Your Apps → Firebase SDK snippet → Config
// =====================================================
export const firebaseConfig = {
  apiKey:            "FIREBASE_API_KEY",
  authDomain:        "PROJECT.firebaseapp.com",
  projectId:         "PROJECT_ID",
  storageBucket:     "PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId:             "APP_ID",
  databaseURL:       "https://PROJECT-default-rtdb.firebaseio.com"
};

// =====================================================
// DEEPSEEK API KEY — dari platform.deepseek.com
// =====================================================
export const DEEPSEEK_API_KEY = "DEEPSEEK_API_KEY_HERE";

// =====================================================
// FONNTE (WhatsApp API) — dari fonnte.com
// Token didapat setelah connect nomor WA di dashboard Fonnte
// =====================================================
export const FONNTE_TOKEN = "FONNTE_TOKEN_HERE";

// =====================================================
// APP URL — URL production app ini (untuk link di WA)
// Ganti setelah deploy: "https://srcm-mbg.netlify.app"
// =====================================================
export const APP_URL = "https://srcm-mbg.netlify.app";

// =====================================================
// PLATFORM CONFIG
// =====================================================
export const PLATFORM_CONFIG = {
  name:           "SRCM MBG",
  managementFee:  0.03,   // 3% dari nilai transaksi
  priceUpdateDay: 1,      // 1 = Senin (hari blast WA minta update harga)
  reminderH2:     true,
  reminderH1:     true,
  reminderH0:     true,
};
