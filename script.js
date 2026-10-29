/* Vivenz'Orto — homepage: catalogo dal gestionale (localStorage) + prenotazione in 3 step (riepilogo → dati → conferma) con scalamento automatico delle scorte */
'use strict';

// Contratto storage condiviso con admin.html: { id, name, desc, emoji, price (€/kg), stock (kg) }
const PRODUCT_KEYS = ['vz_products', 'shop_products', 'products', 'admin_products'];
const PKEY = PRODUCT_KEYS.find(k => localStorage.getItem(k)) || 'vz_products';
const OKEY = 'vz_orders';
const CKEY = 'vz_cart';
const MKEY = 'vz_me';    // dati cliente salvati per precompilare le prossime prenotazioni
const LOW_KG = 3;   // soglia "ultimi kg", stesso criterio degli alert del pannello admin
const STEP  = 0.5;  // step di prenotazione in kg

// Catalogo iniziale di esempio: l'admin lo sostituisce dal gestionale
const SEED = [
  { id: 1, name: 'Pomodori San Marzano', emoji: '🍅', desc: 'Raccolti a mano, maturazione naturale al sole.', price: 3.50, stock: 18 },
  { id: 2, name: 'Zucchine romanesche',  emoji: '🥒', desc: 'Fiori attaccati, croccanti, raccolte di stamattina.', price: 2.80, stock: 6 },
  { id: 3, name: 'Patate a buccia rossa',emoji: '🥔', desc: 'Da terreno vulcanico, sapore intenso e farinoso.', price: 1.90, stock: 40 },
  { id: 4, name: 'Cipolle dorate',       emoji: '🧅', desc: 'Dolci e croccanti, perfette anche agrodolce.', price: 2.20, stock: 3 },
  { id: 5, name: 'Peperoni gialli',      emoji: '🫑', desc: 'Carnosi e dolci, arrostiti sono una delizia.', price: 3.90, stock: 9 },
  { id: 6, name: 'Cavolo nero',          emoji: '🥬', desc: 'Foglie freschissime, ideale per la ribollita.', price: 2.50, stock: 12 }
];

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const eur = n => n.toFixed(2).replace('.', ',') + ' €';
const kg  = n => n.toFixed(1).replace('.', ',') + ' kg';
const r1  = v => Math.round(v * 10) / 10; // arrotonda a 0,1
const read  = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const validPhone = v => /^[+\d][\d\s.\-()/]{4,}$/.test(v.trim());
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

if (!localStorage.getItem(PKEY)) write(PKEY, SEED);
let products = read(PKEY, SEED);
let cart = read(CKEY, []);
const qty = new Map(); // kg selezionati per ogni card

const $ = s => document.querySelector(s);
const inCart     = id => cart.find(i => i.id === id);
const reservedKg = id => inCart(id)?.kg || 0;
const dispKg     = p  => Math.max(0, r1((p.stock ?? 0) - reservedKg(p.id)));
const saveCart   = () => write(CKEY, cart);

function render() {
  $('#products').innerHTML = products.map((p, i) => {
    const free = dispKg(p);
    const out  = free <= 0;
    const low  = !out && free <= LOW_KG;
    const q    = qty.get(p.id) ?? STEP;
    return `
    <article class="product ${out ? 'soldout' : ''}" style="--i:${i}">
      ${low || out ? `<span class="badge ${out ? 'out' : ''}">${out ? 'Terminato' : 'Ultimi kg'}</span>` : ''}
      <div class="sym">${esc(p.emoji || '🌿')}</div>
      <h3>${esc(p.name)}</h3>
      <p class="desc">${esc(p.desc || '')}</p>
      <p class="price">${eur(p.price)}<small> /kg</small></p>
      <p class="stock">Disponibili: <strong>${kg(free)}</strong></p>
      <div class="stepper">
        <button data-act="dec" data-id="${p.id}" aria-label="Riduci kg">−</button>
        <span class="kg">${kg(q)}</span>
        <button data-act="inc" data-id="${p.id}" aria-label="Aumenta kg">+</button>
      </div>
      <button class="product-add" data-act="add" data-id="${p.id}">Prenota</button>
    </article>`;
  }).join('');
  renderCart();
}

function renderCart() {
  $('#cart-count').textContent = cart.length;
  const list = $('#cart-list');
  if (!cart.length) {
    list.innerHTML = '<li><small>Nessun prodotto prenotato: scegli dal raccolto qui sopra 🌱</small></li>';
    $('#cart-total').textContent = '';
    $('#checkout').disabled = true;
    return;
  }
  list.innerHTML = cart.map(i => {
    const p = products.find(x => x.id === i.id);
    if (!p) return '';
    return `<li>
      <span>${esc(p.name)}<br><small>${kg(i.kg)} × ${eur(p.price)}/kg</small></span>
      <span style="display:flex;gap:.4rem;align-items:center">
        <button class="mini" data-cart="dec" data-id="${i.id}" aria-label="Riduci kg nel carrello">−</button>
        <strong>${eur(i.kg * p.price)}</strong>
        <button class="mini" data-cart="del" data-id="${i.id}" aria-label="Rimuovi dal carrello">✕</button>
      </span></li>`;
  }).join('');
  $('#cart-total').textContent = 'Totale: ' + eur(cartTotal());
  $('#checkout').disabled = false;
}

const cartTotal = () => cart.reduce((s, i) => {
  const p = products.find(x => x.id === i.id);
  return p ? s + i.kg * p.price : s;
}, 0);

// --- Interazioni griglia prodotti ---
$('#products').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const p = products.find(x => x.id === +b.dataset.id);
  if (!p) return;
  const free = dispKg(p);
  const maxStep = Math.max(STEP, r1(Math.floor(free / STEP) * STEP));
  const q = qty.get(p.id) ?? STEP;

  if (b.dataset.act === 'add') {
    if (q > free) return toast('Quantità non disponibile, riduci i kg');
    const line = inCart(p.id);
    line ? line.kg = r1(line.kg + q) : cart.push({ id: p.id, kg: q });
    qty.set(p.id, STEP);
    saveCart(); render();
    toast(`${p.name}: ${kg(q)} aggiunti alla prenotazione`);
  } else {
    const next = b.dataset.act === 'inc' ? Math.min(maxStep, r1(q + STEP)) : Math.max(STEP, r1(q - STEP));
    qty.set(p.id, next);
    render();
  }
});

// --- Interazioni carrello ---
$('#cart').addEventListener('click', e => {
  const b = e.target.closest('button[data-cart]');
  if (!b) return;
  const line = inCart(+b.dataset.id);
  if (!line) return;
  if (b.dataset.cart === 'del') cart = cart.filter(i => i.id !== line.id);
  else { line.kg = r1(line.kg - STEP); if (line.kg <= 0) cart = cart.filter(i => i.id !== line.id); }
  saveCart(); render();
});

/* ---------- Checkout in 3 step: riepilogo → dati cliente → conferma ---------- */
function showStep(step) {
  const data = step === 'data', done = step === 'done';
  $('#cart-view').classList.toggle('hidden', data || done);
  $('#step-data').classList.toggle('hidden', !data);
  $('#step-done').classList.toggle('hidden', !done);
  $('#cart-title').textContent = done ? 'Confermato ✓' : (data ? 'I tuoi dati' : 'Il tuo ritiro');
  if (data) prefillCustomer();
}

$('#checkout').addEventListener('click', () => {
  if (!cart.length) return;
  $('#step-total').textContent = eur(cartTotal());
  showStep('data');
});

$('#back-cart').addEventListener('click', () => showStep('cart'));

function prefillCustomer() {
  const me = read(MKEY, null);
  const f = $('#cust-form');
  if (me) {
    f.elements.fname.value = me.name || '';
    f.elements.lname.value = me.surname || '';
    f.elements.phone.value = me.phone || '';
    f.elements.email.value = me.email || '';
  }
  f.querySelectorAll('label.bad').forEach(l => l.classList.remove('bad'));
}

$('#cust-form').addEventListener('input', e => {
  const lab = e.target.closest('label');
  if (lab) { lab.classList.remove('bad'); e.target.setAttribute('aria-invalid', 'false'); }
});

$('#cust-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const data = {
    name:    f.elements.fname.value.trim(),
    surname: f.elements.lname.value.trim(),
    phone:   f.elements.phone.value.trim(),
    email:   f.elements.email.value.trim(),
    notes:   f.elements.notes.value.trim()
  };
  const checks = {
    fname:  data.name.length >= 2,
    lname:  data.surname.length >= 2,
    phone:  validPhone(data.phone),
    email:  validEmail(data.email)
  };
  let firstBad = null;
  Object.entries(checks).forEach(([k, ok]) => {
    const el = f.elements[k];
    el.closest('label').classList.toggle('bad', !ok);
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (!ok && !firstBad) firstBad = el;
  });
  if (firstBad) {
    firstBad.focus();
    firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return toast('Controlla i campi evidenziati in rosso');
  }

  // Riepilogo per la schermata di conferma (prima di svuotare il carrello)
  const recap = cart.map(i => {
    const p = products.find(x => x.id === i.id);
    return p ? { name: p.name, kg: i.kg } : null;
  }).filter(Boolean);
  const orderTotal = r1(cartTotal());
  const orderId = Date.now();

  // Scala le scorte e registra l'ordine (con contatti) per il gestionale
  cart.forEach(i => {
    const p = products.find(x => x.id === i.id);
    if (p) p.stock = Math.max(0, r1(p.stock - i.kg));
  });
  const orders = read(OKEY, []);
  orders.push({
    id: orderId,
    date: new Date().toISOString(),
    customer: data,
    items: cart.map(i => {
      const p = products.find(x => x.id === i.id);
      // pid = id prodotto: consente al gestionale di ripristinare le scorte se l'ordine viene eliminato
      return p ? { pid: p.id, name: p.name, kg: i.kg, price: p.price, total: r1(i.kg * p.price) } : null;
    }).filter(Boolean),
    total: orderTotal
  });
  write(OKEY, orders);
  write(PKEY, products);   // aggiornamento immediato delle disponibilità
  write(MKEY, data);       // precompila la prossima prenotazione

  // Svuota carrello e mostra la conferma
  cart = []; qty.clear(); saveCart(); render();
  f.elements.notes.value = '';
  $('#done-msg').textContent = `Codice #${String(orderId).slice(-4)} — ti aspettiamo in orto, ${data.name}!`;
  $('#done-recap').innerHTML = recap.map(r =>
    `<li><span>${esc(r.name)}</span><strong>${kg(r.kg)}</strong></li>`).join('');
  $('#done-total').textContent = eur(orderTotal);
  showStep('done');
  toast(`Grazie ${data.name}! Prenotazione confermata 🌱`);
});

$('#done-close').addEventListener('click', () => {
  $('#cart').classList.add('hidden');
  showStep('cart');
});

// --- Apertura/chiusura pannello carrello ---
$('#cart-btn').onclick = () => {
  const c = $('#cart');
  // se riapro dopo una conferma, riparto dal riepilogo
  if (c.classList.contains('hidden') && !$('#step-done').classList.contains('hidden')) showStep('cart');
  c.classList.toggle('hidden');
};
$('#cart-close').onclick = () => $('#cart').classList.add('hidden');
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#cart').classList.add('hidden'); });

// --- Toast ---
let tId;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(tId);
  tId = setTimeout(() => t.classList.remove('show'), 2600);
}

// Se l'admin modifica prodotti in un'altra scheda, la homepage si aggiorna da sola
window.addEventListener('storage', e => {
  if (e.key === PKEY) { products = read(PKEY, products); render(); }
});

render();
