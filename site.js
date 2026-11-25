/* Site settings loader. Loads first on every page.
   Reads what you set in the admin portal (theme, text, announcement, products) from your
   Google Apps Script web app, remembers it in the browser so pages paint instantly, and
   falls back to the built-in look and data/products.json if the web app is not set up yet. */
(function () {
  "use strict";
  var KEY = "mps-site-v1";
  var root = document.documentElement;
  var HEX = /^#[0-9a-fA-F]{6}$/;
  var api = (typeof BOOKING_API_URL === "string" && BOOKING_API_URL) ? BOOKING_API_URL : "";
  var state = { products: null, settings: null };

  /* Draft preview: the admin opens the site with ?preview=KEY. We remember it for this tab only. */
  var preview = "";
  try {
    var m = /[?&]preview=([A-Za-z0-9-]{1,100})/.exec(location.search);
    if (m) { sessionStorage.setItem("mps-preview", m[1]); history.replaceState(null, "", location.pathname + location.hash); }
    preview = sessionStorage.getItem("mps-preview") || "";
  } catch (e) {}

  function previewRibbon() {
    if (!preview || document.getElementById("mps-preview")) return;
    var r = document.createElement("div");
    r.id = "mps-preview";
    var t = document.createElement("span");
    t.textContent = "Draft preview: only you can see this. Visitors still see the live site.";
    var x = document.createElement("a");
    x.href = location.pathname;
    x.textContent = "Exit preview";
    x.addEventListener("click", function () { try { sessionStorage.removeItem("mps-preview"); } catch (e) {} });
    r.appendChild(t); r.appendChild(x);
    document.body.appendChild(r);
  }

  function store(get, val) {
    try { if (get) return JSON.parse(localStorage.getItem(KEY) || "null"); localStorage.setItem(KEY, JSON.stringify(val)); } catch (e) {}
    return null;
  }

  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /* ---------- Apply theme, effects and text ---------- */
  function apply(s) {
    if (!s || typeof s !== "object") return;
    var c = s.colors || {};
    Object.keys(c).forEach(function (k) { if (HEX.test(c[k])) root.style.setProperty("--" + k, c[k]); });
    if (Array.isArray(s.scroll) && s.scroll.length === 6 && s.scroll.every(function (h) { return HEX.test(h); })) window.MPS_SCROLL = s.scroll;
    var fx = s.effects || {};
    ["balloons", "clouds", "cubes", "cursor", "pop", "scrollColours"].forEach(function (k) {
      root.setAttribute("data-fx-" + k.toLowerCase(), fx[k] === false ? "off" : "on");
    });
    var t = s.text || {};
    $all("[data-setting]").forEach(function (el) {
      var v = t[el.getAttribute("data-setting")];
      if (typeof v === "string" && v.trim()) el.textContent = v;
    });
    var h = document.querySelector("h2.mega[data-words]");
    if (h) h.setAttribute("aria-label", $all("h2.mega[data-words] .w[data-setting]").map(function (w) { return w.textContent; }).join(" "));
    banner(s.announcement);
    document.dispatchEvent(new CustomEvent("mps:settings", { detail: s }));
  }

  function banner(a) {
    var el = document.getElementById("mps-announce");
    if (!a || !a.enabled || !a.text) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "mps-announce";
      el.setAttribute("role", "status");
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.textContent = "";
    var span = document.createElement("span");
    span.textContent = a.text;
    el.appendChild(span);
    if (a.link && /^https:\/\//.test(a.link)) {
      var l = document.createElement("a");
      l.href = a.link;
      l.textContent = a.linkLabel || "Find out more";
      el.appendChild(l);
    }
  }

  /* ---------- Products ---------- */
  function fallbackProducts() {
    return fetch("data/products.json").then(function (r) { return r.json(); }).catch(function () { return []; });
  }

  var ready = new Promise(function (resolve) {
    var cached = preview ? null : store(true);
    if (cached && cached.settings) { state.settings = cached.settings; apply(cached.settings); }
    if (!api) {
      // Demo mode: show whatever was set in the admin demo, in this browser only.
      try {
        var demo = JSON.parse(localStorage.getItem("mps-demo-admin") || "null");
        if (demo) {
          var prods = preview ? (demo.productsDraft || demo.products) : demo.products;
          var sets = preview ? (demo.settingsDraft || demo.settings) : demo.settings;
          if (Array.isArray(prods)) state.products = prods.filter(function (p) { return p.visible !== false; });
          if (sets) { state.settings = sets; apply(sets); }
        }
      } catch (e) {}
      resolve(state); return;
    }
    pull().then(function () { resolve(state); });
  });

  function pull() {
    return Promise.race([
      fetch(api + (api.indexOf("?") > -1 ? "&" : "?") + "action=site" + (preview ? "&preview=" + encodeURIComponent(preview) : ""), { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) return;
          state.products = Array.isArray(d.products) ? d.products : null;
          if (d.settings) { state.settings = d.settings; apply(d.settings); }
          if (!preview) store(false, { settings: d.settings || null });
        })
        .catch(function () {}),
      new Promise(function (res) { setTimeout(res, 6000); })
    ]);
  }

  window.MPS = {
    ready: ready,
    /** Resolves with the list of products to show (admin-managed, or data/products.json). */
    products: function () {
      return ready.then(function () { return state.products || fallbackProducts(); });
    },
    apply: apply,
    /** Fetches the latest settings and products again. */
    refresh: function () { return api ? pull() : Promise.resolve(); }
  };

  // Settings for the elements already on the page (text fields need the DOM).
  function first() { previewRibbon(); if (state.settings) apply(state.settings); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", first); else first();
})();
