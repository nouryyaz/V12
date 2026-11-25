/* Admin core: tiny DOM helper, API client, toasts, dialogs and the module registry.
   To add a new admin screen, create admin/yourthing.js that calls Admin.register({...})
   and add one <script> line to admin.html. Nothing else needs to change. */
(function () {
  "use strict";
  var Admin = window.Admin = { modules: [], user: null };

  /* ---------- DOM helper (text only, never innerHTML, so nothing typed can run as code) ---------- */
  Admin.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
  var h = Admin.h;
  Admin.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------- API ---------- */
  var TOKEN_KEY = "mps-admin-token";
  function getToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return Admin._tok || ""; } }
  function setToken(t) { Admin._tok = t; try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  Admin.hasToken = function () { return !!getToken(); };
  Admin.demo = window.__ADMIN_DEMO === true || typeof BOOKING_API_URL !== "string" || !BOOKING_API_URL;

  Admin.call = function (action, payload) {
    var body = Object.assign({}, payload || {}, { action: action, token: getToken() });
    var p = Admin.demo && window.AdminDemo
      ? window.AdminDemo.handle(body)
      : fetch(BOOKING_API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })
          .then(function (r) { return r.json(); });
    return p.then(function (res) {
      if (res && res.needsLogin) { setToken(""); Admin.showLogin(res.error); }
      return res;
    }, function () { return { ok: false, error: "Could not reach the server. Check your internet and try again." }; });
  };
  Admin.login = function (password) {
    return Admin.call("adminLogin", { password: password }).then(function (r) { if (r.ok) setToken(r.token); return r; });
  };
  Admin.logout = function () { return Admin.call("adminLogout").then(function () { setToken(""); }); };

  /* ---------- Toasts and dialogs ---------- */
  Admin.toast = function (msg, kind) {
    var box = document.getElementById("toasts");
    var t = h("div", { class: "toast " + (kind || "ok"), role: "status", text: msg });
    box.appendChild(t);
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 400); }, kind === "bad" ? 6000 : 3000);
  };

  /** Shows a dialog. opts: {title, body (node), buttons:[{label, kind, value}]}; resolves with the clicked value. */
  Admin.dialog = function (opts) {
    return new Promise(function (resolve) {
      var back = h("div", { class: "modal-back" });
      var box = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": opts.title });
      function close(v) { back.remove(); document.removeEventListener("keydown", onKey); resolve(v); }
      function onKey(e) { if (e.key === "Escape") close(null); }
      box.appendChild(h("h3", { text: opts.title }));
      if (opts.body) box.appendChild(opts.body);
      var row = h("div", { class: "modal-actions" });
      (opts.buttons || [{ label: "OK", kind: "primary", value: true }]).forEach(function (b) {
        row.appendChild(h("button", { type: "button", class: "btn " + (b.kind || ""), text: b.label, onclick: function () { close(b.value); } }));
      });
      box.appendChild(row);
      back.appendChild(box);
      back.addEventListener("click", function (e) { if (e.target === back) close(null); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(back);
      var first = row.querySelector(".primary, .danger") || row.querySelector("button");
      if (first) first.focus();
    });
  };
  Admin.confirm = function (title, text, yes, danger) {
    return Admin.dialog({ title: title, body: h("p", { text: text }),
      buttons: [{ label: "Cancel", value: false }, { label: yes || "Yes", kind: danger ? "danger" : "primary", value: true }] });
  };

  /* ---------- Form fields ---------- */
  Admin.field = function (label, input, hint) {
    return h("label", { class: "field" }, h("span", { class: "lab", text: label }), input, hint ? h("small", { text: hint }) : null);
  };
  Admin.busy = function (btn, promise) {
    btn.disabled = true;
    var old = btn.textContent; btn.textContent = "Saving…";
    var done = function () { btn.disabled = false; btn.textContent = old; };
    promise.then(done, done);
    return promise;
  };

  /* ---------- Modules ---------- */
  Admin.register = function (m) { Admin.modules.push(m); };
  Admin.fmtDate = function (iso) {
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  };
  Admin.fmtTime = function (hhmm) {
    var p = String(hhmm).split(":"), hr = +p[0], m = p[1];
    return ((hr + 11) % 12 + 1) + ":" + m + (hr < 12 ? "am" : "pm");
  };
  Admin.today = function () { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
})();
(function () {
  var A = window.Admin;
  A.imgSrc = function (u) { return /^images\//.test(u || "") ? u : (/^https:\/\//.test(u || "") ? u : ""); };
})();
