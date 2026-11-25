/* Account: change the admin password. */
(function () {
  var A = window.Admin, h = A.h;
  A.register({ id: "account", label: "Account", icon: "🔒", render: function (root) {
    var cur = h("input", { type: "password", autocomplete: "current-password" });
    var nxt = h("input", { type: "password", autocomplete: "new-password", minlength: 10 });
    var rep = h("input", { type: "password", autocomplete: "new-password" });
    var err = h("p", { class: "error", role: "alert" });
    var btn = h("button", { class: "btn primary", type: "button", text: "Change password", onclick: function () {
      err.textContent = "";
      if (nxt.value.length < 10) { err.textContent = "Please choose at least 10 characters. A few random words works well."; return; }
      if (nxt.value !== rep.value) { err.textContent = "The two new passwords don't match."; return; }
      A.busy(btn, A.call("adminChangePassword", { current: cur.value, next: nxt.value })).then(function (r) {
        if (r.ok) { cur.value = nxt.value = rep.value = ""; A.toast("Password changed"); } else err.textContent = r.error;
      });
    } });
    root.appendChild(h("h2", { text: "Account" }));
    root.appendChild(h("section", { class: "card-box narrow" }, h("h3", { text: "Change your password" }), h("div", { class: "form-grid" },
      A.field("Current password", cur), A.field("New password", nxt, "At least 10 characters."), A.field("New password again", rep), err, h("div", { class: "actions" }, btn))));
    if (A.demo) root.appendChild(h("p", { class: "note", text: "You are in demo mode, so nothing here is saved to Google. Once your booking web address is in config.js, this screen becomes live." }));
  } });
})();
