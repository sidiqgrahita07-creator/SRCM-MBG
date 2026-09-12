/**
 * Shared UI components — navbar, sidebar, toast, loader, modal
 * Import fungsi yang dibutuhkan per halaman.
 */

// ─────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────
export function renderNavbar(title, userData) {
  const roleLabel = userData.role === 'dapur' ? '🍽️ Dapur' : '🏭 Supplier';
  return `
  <nav class="bg-slate-900 border-b border-slate-700 px-5 py-3 flex items-center justify-between sticky top-0 z-40 no-print">
    <div class="flex items-center gap-3">
      <a href="/${userData.role}/dashboard.html" class="text-green-400 font-bold text-base tracking-tight">⛓️ SRCM MBG</a>
      <span class="text-slate-600">|</span>
      <span class="text-slate-400 text-sm">${title}</span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-slate-200 text-sm font-medium">${userData.name}</span>
      <span class="chip chip-approved text-xs">${roleLabel}</span>
      <button id="btn-logout"
        class="text-slate-500 hover:text-red-400 text-xs border border-slate-700 px-3 py-1 rounded transition-colors">
        Keluar
      </button>
    </div>
  </nav>`;
}

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────
export function renderSidebar(role) {
  const menuDapur = [
    { icon: '📊', label: 'Dashboard',      href: '/dapur/dashboard.html'   },
    { icon: '🍽️', label: 'Menu Planner',   href: '/dapur/menu-planner.html'},
    { icon: '📋', label: 'Purchase Order', href: '/dapur/po.html'          },
    { icon: '🚚', label: 'Pengiriman',     href: '/dapur/delivery.html'    },
    { icon: '✅', label: 'QC Barang',      href: '/dapur/qc.html'          },
    { icon: '💬', label: 'Chat Supplier',  href: '/dapur/chat.html'        },
  ];
  const menuSupplier = [
    { icon: '📊', label: 'Dashboard',         href: '/supplier/dashboard.html'    },
    { icon: '📬', label: 'Inbox PO',          href: '/supplier/po-inbox.html'     },
    { icon: '🚛', label: 'Kelola Pengiriman', href: '/supplier/delivery-mgmt.html'},
    { icon: '🔍', label: 'Review QC',         href: '/supplier/qc-review.html'    },
    { icon: '💬', label: 'Chat Dapur',        href: '/supplier/chat.html'         },
  ];
  const menu = role === 'dapur' ? menuDapur : menuSupplier;
  const active = window.location.pathname;

  return `
  <aside class="w-52 bg-slate-900 min-h-[calc(100vh-57px)] border-r border-slate-800 py-3 flex-shrink-0 no-print">
    ${menu.map(m => {
      const isActive = active.endsWith(m.href) || active === m.href;
      return `<a href="${m.href}"
        class="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
          ${isActive ? 'bg-green-950 text-green-300 border-r-2 border-green-500 font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
        <span>${m.icon}</span><span>${m.label}</span>
      </a>`;
    }).join('')}
  </aside>`;
}

// ─────────────────────────────────────────────────────────────
// Page layout helper — inject navbar + sidebar ke #app
// ─────────────────────────────────────────────────────────────
export function initLayout(title, userData, mainHtml) {
  document.documentElement.className = 'bg-slate-950 text-slate-100';
  document.body.style.margin = '0';
  document.getElementById('app').innerHTML = `
    ${renderNavbar(title, userData)}
    <div class="flex">
      ${renderSidebar(userData.role)}
      <main class="flex-1 p-6 min-h-[calc(100vh-57px)] overflow-y-auto page-fade">
        ${mainHtml}
      </main>
    </div>`;

  // Wire logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if (!confirm('Yakin mau keluar?')) return;
    const { logout } = await import('./auth.js');
    await logout();
  });
}

// ─────────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────────
export function showToast(msg, type = 'success', duration = 3500) {
  const colors = {
    success: 'bg-green-700 text-white',
    error:   'bg-red-700 text-white',
    warning: 'bg-yellow-700 text-white',
    info:    'bg-blue-700 text-white',
  };
  const t = document.createElement('div');
  t.className = `fixed top-5 right-5 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl
    transition-all ${colors[type] || colors.success}`;
  t.style.animation = 'pageFade 0.2s ease';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, duration);
}

// ─────────────────────────────────────────────────────────────
// Loading overlay
// ─────────────────────────────────────────────────────────────
export function showLoading(show = true, msg = 'Memproses...') {
  const id = 'global-loader';
  if (show) {
    if (document.getElementById(id)) return;
    const d = document.createElement('div');
    d.id = id;
    d.className = 'fixed inset-0 bg-black/70 z-[200] flex flex-col items-center justify-center gap-4';
    d.innerHTML = `
      <div class="spinner"></div>
      <p class="text-slate-300 text-sm">${msg}</p>`;
    document.body.appendChild(d);
  } else {
    document.getElementById(id)?.remove();
  }
}

// ─────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────
export function openModal(id, html) {
  closeModal(id);
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'fixed inset-0 bg-black/70 z-[150] flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
      ${html}
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(id); });
  document.body.appendChild(overlay);
}

export function closeModal(id) {
  document.getElementById(id)?.remove();
}

// ─────────────────────────────────────────────────────────────
// Status chip helper
// ─────────────────────────────────────────────────────────────
export function statusChip(status) {
  const labels = {
    draft:           'Draft',
    pending_approval:'Menunggu Approval',
    approved:        'Disetujui',
    rejected:        'Ditolak',
    delivered:       'Terkirim',
    qc_done:         'QC Selesai',
    preparing:       'Dipersiapkan',
    in_transit:      'Dalam Pengiriman',
    arrived:         'Tiba',
    partial:         'Tiba Sebagian',
  };
  return `<span class="chip chip-${status}">${labels[status] || status}</span>`;
}

// ─────────────────────────────────────────────────────────────
// Format currency
// ─────────────────────────────────────────────────────────────
export function formatRp(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

export function formatDate(ts) {
  if (!ts) return '-';
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(ts) {
  if (!ts) return '-';
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
