/* Admin shell: sign-in screen, menu and screen switching. */
(function () {
  "use strict";
  var A = window.Admin, h = A.h;
  var app = document.getElementById("app");
  var current = null;

  A.showLogin = function (msg) {
    A.clear(app);
    var pw = h("input", { type: "password", autocomplete: "current-password", required: true, "aria-label": "Admin password", placeholder: "Admin password" });
    var err = h("p", { class: "error", role: "alert", text: msg || "" });
    var btn = h("button", { class: "btn primary", type: "submit", text: "Sign in" });
    var form = h("form", { class: "login-card", onsubmit: function (e) {
      e.preventDefault();
      err.textContent = "";
      A.busy(btn, A.login(pw.value)).then(function (r) {
        if (r.ok) { pw.value = ""; A.start(); } else { err.textContent = r.error || "Could not sign in."; pw.select(); }
      });
    } },
      h("img", { src: "images/icon.png", alt: "", class: "login-logo" }),
      h("h1", { text: "Mateology admin" }),
      h("p", { class: "muted", text: A.demo ? "Demo mode: type anything to look around. Nothing is sent anywhere." : "Sign in to manage sessions, products and your website." }),
      pw, err, btn);
    app.appendChild(h("div", { class: "login-wrap" }, form));
    pw.focus();
  };

  /* ---------- Draft bar: unpublished changes, preview, publish, discard, undo ---------- */
  A.refreshDraftBar = function (status) {
    var bar = document.getElementById("draftbar");
    if (!bar) return;
    var draw = function (st) {
      A.clear(bar);
      if (!st) return;
      bar.className = st.hasDraft ? "on" : (st.canUndo ? "undo" : "");
      if (st.hasDraft) {
        bar.appendChild(h("div", { class: "grow" }, h("strong", { text: "You have unpublished changes" }), h("small", { text: "Visitors can't see them yet. Preview the draft, then publish when it looks right." })));
        bar.appendChild(h("div", { class: "bar-actions" },
          h("button", { class: "btn small", type: "button", text: "Preview draft ↗", onclick: A.openPreview }),
          h("button", { class: "btn small primary", type: "button", text: "Review and publish", onclick: function () { A.reviewPublish(st); } }),
          h("button", { class: "btn small danger-o", type: "button", text: "Discard draft", onclick: discard })));
      } else if (st.canUndo) {
        bar.appendChild(h("div", { class: "grow" }, h("strong", { text: "Your changes are live." })));
        bar.appendChild(h("div", { class: "bar-actions" }, h("button", { class: "btn small", type: "button", text: "Undo last publish", onclick: undo })));
      }
    };
    if (status) draw(status); else A.call("adminDraftStatus").then(function (r) { draw(r.ok ? r.status : null); });
  };
  A.openPreview = function () {
    var w = window.open("", "_blank");
    A.call("adminPreviewLink").then(function (r) {
      if (!r.ok) { if (w) w.close(); A.toast(r.error, "bad"); return; }
      var url = new URL("index.html", location.href); url.search = "?preview=" + encodeURIComponent(r.token);
      if (w) w.location.href = url.href; else A.toast("Your browser blocked the preview window. Allow pop-ups for this page and try again.", "bad");
    });
  };
  A.reviewPublish = function (st) {
    A.dialog({ title: "Publish to the live site?",
      body: h("div", {}, h("p", { text: "These changes will go live for every visitor:" }), h("ul", { class: "changes" }, st.changes.map(function (c) { return h("li", { text: c }); })),
        h("p", { class: "muted", text: "You can undo the last publish afterwards." })),
      buttons: [{ label: "Not yet", value: false }, { label: "Preview first", value: "preview" }, { label: "Publish now", kind: "primary", value: true }] }).then(function (v) {
      if (v === "preview") A.openPreview();
      if (v !== true) return;
      A.call("adminPublish").then(function (r) {
        if (!r.ok) { A.toast(r.error, "bad"); return; }
        A.toast("Published. Your website updates within a minute."); A.refreshDraftBar(r.status); render();
      });
    });
  };
  function discard() {
    A.confirm("Discard the draft?", "Your unpublished changes will be thrown away. The live site stays exactly as it is.", "Discard draft", true).then(function (y) {
      if (y) A.call("adminDiscardDraft").then(function (r) { if (r.ok) { A.toast("Draft discarded"); A.refreshDraftBar(r.status); render(); } else A.toast(r.error, "bad"); });
    });
  }
  function undo() {
    A.confirm("Undo the last publish?", "The live site goes back to how it was before your last publish.", "Undo publish", true).then(function (y) {
      if (y) A.call("adminUndoPublish").then(function (r) { if (r.ok) { A.toast("Put back the previous version"); A.refreshDraftBar(r.status); render(); } else A.toast(r.error, "bad"); });
    });
  }

  A.go = function (id) { location.hash = "#/" + id; };

  function render() {
    var raw = location.hash.replace(/^#\//, "").split("?");
    var id = raw[0] || A.modules[0].id;
    A.query = {};
    (raw[1] || "").split("&").forEach(function (kv) { if (!kv) return; var p = kv.split("="); try { A.query[p[0]] = decodeURIComponent(p[1] || ""); } catch (e) {} });
    var mod = A.modules.filter(function (m) { return m.id === id; })[0] || A.modules[0];
    current = mod;
    var main = document.getElementById("view");
    if (!main) return;
    Array.prototype.forEach.call(document.querySelectorAll(".menu a"), function (a) { a.classList.toggle("on", a.dataset.id === mod.id); });
    A.clear(main);
    document.title = mod.label + " | Mateology admin";
    window.scrollTo(0, 0);
    try { mod.render(main); } catch (e) { main.appendChild(h("p", { class: "error", text: "This screen hit a problem. Please reload the page." })); if (window.console) console.error(e); }
  }

  A.start = function () {
    A.clear(app);
    var menu = h("nav", { class: "menu", "aria-label": "Admin menu" },
      A.modules.map(function (m) { return h("a", { href: "#/" + m.id, "data-id": m.id }, h("span", { class: "ico", "aria-hidden": "true", text: m.icon }), h("span", { text: m.label })); }));
    var side = h("aside", { class: "side" },
      h("div", { class: "brand" }, h("img", { src: "images/icon.png", alt: "" }), h("div", {}, h("strong", { text: "Mateology" }), h("small", { text: A.demo ? "Demo mode" : "Admin" }))),
      menu,
      h("div", { class: "side-foot" },
        h("a", { href: "index.html", target: "_blank", rel: "noopener", text: "View website ↗" }),
        h("button", { class: "btn small", type: "button", text: "Sign out", onclick: function () { A.logout().then(function () { A.showLogin(); }); } })));
    app.appendChild(h("div", { class: "shell" }, side, h("div", { class: "content" }, h("div", { id: "draftbar" }), h("main", { id: "view", tabindex: "-1" }))));
    render();
    A.refreshDraftBar();
  };

  window.addEventListener("hashchange", function () { if (document.getElementById("view")) render(); });
  window.addEventListener("load", function () { A.hasToken() ? A.start() : A.showLogin(); });
  // The session screen only trusts the server: if the saved token has expired the first call sends us back to sign-in.
})();
