// Shop page: builds the product cards from the admin portal's product list
// (or data/products.json until the admin portal has been used). See site.js.

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
// Only allow our own images or https addresses, and https payment links.
function safeImage(u) { return /^(images\/[A-Za-z0-9._\-\/]+|https:\/\/[^\s"'<>]+)$/.test(u || "") && u.indexOf("..") < 0 ? u : ""; }
function safeLink(u) { return /^https:\/\/[^\s"'<>]+$/.test(u || "") ? u : ""; }

async function showProducts() {
  const box = document.getElementById("products");
  if (!box) return;
  const products = await window.MPS.products();
  if (!products.length) {
    box.innerHTML = '<p class="empty">New play kits are on their way. Check back soon!</p>';
    return;
  }
  box.innerHTML = products.map(p => {
    const img = safeImage(p.image), link = safeLink(p.stripeLink);
    return `
    <div class="card">
      ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">` : ""}
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description)}</p>
      <p class="price">${esc(p.price)}</p>
      ${p.inStock === false
        ? `<p><strong>Sold out</strong></p>`
        : link
          ? `<a class="btn" href="${esc(link)}" rel="noopener">Buy securely</a>`
          : `<p><strong>Coming soon</strong></p>`}
    </div>`;
  }).join("");
}

showProducts();
