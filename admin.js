/* Vivenz'Orto — gestionale: login, CRUD prodotti, prenotazioni e alert scorte (storage condiviso con la homepage) */
'use strict';

const PRODUCT_KEYS = ['vz_products', 'shop_products', 'products', 'admin_products'];
const PKEY = PRODUCT_KEYS.find(k => localStorage.getItem(k)) || 'vz_products';
const OKEY = 'vz_orders';
const SKEY = 'vz_admin';
const PASS = 'admin';

const esc  = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const eur  = n => (+n).toFixed(2).replace('.', ',') + ' €';
const kg   = n => (+n).toFixed(1).replace('.', ',') + ' kg';
const read  = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let products = read(PKEY, []);
let editingId = null;

const $ = s => document.querySelector(s);

/* ---------- Toast ---------- */
let tId;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(tId);
  tId = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Login / logout ---------- */
$('#login-form').addEventListener('submit', e => {
  e.preventDefault();
  if ($('#pass').value === PASS) {
    sessionStorage.setItem(SKEY, '1');
    openPanel();
    toast('Bentornato nell\'orto! 🌱');
  } else {
    $('#pass').value = '';
    const g = $('#gate');
    g.classList.remove('shake');
    void g.offsetWidth; // riavvia l'animazione
    g.classList.add('shake');
    toast('Password errata, riprova');
  }
});

$('#logout').addEventListener('click', () => {
  sessionStorage.removeItem(SKEY);
  $('#panel').classList.add('hidden');
  $('#gate').classList.remove('hidden');
  toast('Sessione chiusa');
});

function openPanel() {
  $('#gate').classList.add('hidden');
  $('#panel').classList.remove('hidden');
  renderAll();
}

/* ---------- Alert scorte ---------- */
function renderAlerts() {
  const low = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.threshold ?? 3));
  const out = products.filter(p => (p.stock ?? 0) <= 0);
  $('#alerts').innerHTML = [
    ...low.map(p => `<div class="alert-banner low">⚠️ <strong>${esc(p.name)}</strong>: restano solo ${kg(p.stock)}</div>`),
    ...out.map(p => `<div class="alert-banner out">⛔ <strong>${esc(p.name)}</strong>: terminato in homepage</div>`)
  ].join('');
}

/* ---------- Prenotazioni ---------- */
function renderOrders() {
  const orders = read(OKEY, []).slice().reverse();
  const box = $('#orders');
  if (!orders.length) {
    box.innerHTML = '<div class="empty">Nessuna prenotazione: appena un cliente conferma la compare qui 🧺</div>';
    return;
  }
  box.innerHTML = orders.map(o => {
    const d = new Date(o.date).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
    return `<div class="order">
      <div class="order-head">
        <strong>📦 #${String(o.id).slice(-4)}</strong>
        <span class="when">${esc(d)}</span>
        <button class="icon-btn" data-del-order="${o.id}" aria-label="Elimina prenotazione">🗑</button>
      </div>
      <ul class="order-items">
        ${o.items.map(it => `<li><span>${esc(it.name)}</span><span class="qty">${kg(it.kg)} × ${eur(it.price)}</span><strong>${eur(it.total)}</strong></li>`).join('')}
      </ul>
      <p class="order-total">Totale ritiro: <strong>${eur(o.total)}</strong></p>
    </div>`;
  }).join('');
}

$('#orders').addEventListener('click', e => {
  const b = e.target.closest('[data-del-order]');
  if (!b) return;
  write(OKEY, read(OKEY, []).filter(o => o.id !== +b.dataset.delOrder));
  renderOrders();
  toast('Prenotazione eliminata');
});

/* ---------- Prodotti (tabella con barra scorte) ---------- */
function renderProducts() {
  const box = $('#plist');
  if (!products.length) {
    box.innerHTML = '<div class="empty">Nessun prodotto: aggiungi il primo raccolto con il modulo qui sopra 🌾</div>';
    return;
  }
  box.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Prodotto</th><th>Prezzo</th><th>Disponibilità</th><th>Azioni</th></tr></thead>
    <tbody>${products.map(p => {
      const th = p.threshold ?? 3, st = p.stock ?? 0;
      const pct = Math.min(100, th > 0 ? (st / (th * 3)) * 100 : (st > 0 ? 100 : 0));
      const cls = st <= 0 ? 'out' : (st <= th ? 'low' : '');
      return `<tr class="${st <= 0 ? 'out-row' : (st <= th ? 'alert-row' : '')}">
        <td><span class="p-emoji">${esc(p.emoji || '🌿')}</span>${esc(p.name)}</td>
        <td><strong>${eur(p.price)}</strong><small>/kg</small></td>
        <td>
          <div class="bar ${cls}"><span style="width:${pct}%"></span></div>
          <small>${kg(st)}</small>
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${p.id}" aria-label="Modifica ${esc(p.name)}">✏️</button>
            <button class="icon-btn" data-del="${p.id}" aria-label="Elimina ${esc(p.name)}">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

$('#plist').addEventListener('click', e => {
  const ed = e.target.closest('[data-edit]');
  const de = e.target.closest('[data-del]');
  if (ed) {
    const p = products.find(x => x.id === +ed.dataset.edit);
    if (!p) return;
    const f = $('#p-form');
    f.emoji.value = p.emoji || '';
    f.name.value = p.name;
    f.desc.value = p.desc || '';
    f.price.value = p.price;
    f.available.value = p.stock ?? 0;
    f.threshold.value = p.threshold ?? 3;
    editingId = p.id;
    $('#form-title').textContent = '✏️ Modifica: ' + p.name;
    $('#cancel-edit').classList.remove('hidden');
    $('#form-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (de) {
    const p = products.find(x => x.id === +de.dataset.del);
    if (p && confirm(`Eliminare "${p.name}" dalla vetrina?`)) {
      products = products.filter(x => x.id !== p.id);
      write(PKEY, products);
      if (editingId === p.id) resetForm();
      renderAll();
      toast('Prodotto eliminato');
    }
  }
});

/* ---------- Form crea/modifica ---------- */
$('#p-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const data = {
    emoji: f.emoji.value.trim() || '🌿',
    name: f.name.value.trim(),
    desc: f.desc.value.trim(),
    price: +(+f.price.value).toFixed(2),
    stock: Math.max(0, +(+f.available.value).toFixed(1)),
    threshold: +(+f.threshold.value).toFixed(1)
  };
  if (!data.name) return;
  if (editingId) {
    const i = products.findIndex(x => x.id === editingId);
    if (i > -1) products[i] = { ...products[i], ...data };
  } else {
    products.push({ id: Date.now(), ...data });
  }
  write(PKEY, products);
  resetForm();
  renderAll();
  toast('Prodotto salvato ✓');
});

$('#cancel-edit').addEventListener('click', resetForm);

function resetForm() {
  $('#p-form').reset();
  editingId = null;
  $('#form-title').textContent = '➕ Nuovo prodotto';
  $('#cancel-edit').classList.add('hidden');
}

function renderAll() { renderAlerts(); renderOrders(); renderProducts(); }

/* ---------- Avvio ---------- */
if (!localStorage.getItem(PKEY)) write(PKEY, products);
if (sessionStorage.getItem(SKEY)) openPanel();
window.addEventListener('storage', e => { if (e.key === OKEY) renderOrders(); });
