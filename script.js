const PRODUCTS = [
  { id: 1, name: 'Prodotto 1', price: 19.90, img: '' },
  { id: 2, name: 'Prodotto 2', price: 29.90, img: '' },
  { id: 3, name: 'Prodotto 3', price: 9.90, img: '' },
  { id: 4, name: 'Prodotto 4', price: 49.90, img: '' }
];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
function render() {
  document.getElementById('products').innerHTML = PRODUCTS.map(p => 
    `<div class=product><div style=\"height:140px;background:#e2e8f0;border-radius:8px\"></div><h3>${p.name}</h3><p>€ ${p.price.toFixed(2)}</p><button data-id=${p.id}>Aggiungi</button></div>`
  ).join('');
  document.getElementById('cart-count').textContent = cart.length;
  document.getElementById('cart-list').innerHTML = cart.map(i => `<li>${i.name} — € ${i.price.toFixed(2)}</li>`).join('') || '<li>Vuoto</li>';
  localStorage.setItem('cart', JSON.stringify(cart));
}
document.getElementById('products').addEventListener('click', e => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  cart.push(PRODUCTS.find(p => p.id == btn.dataset.id)); render();
});
document.getElementById('cart-btn').onclick = () => document.getElementById('cart').classList.toggle('hidden');
document.getElementById('checkout').onclick = () => alert('Checkout demo');
render();
