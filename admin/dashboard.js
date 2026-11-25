/* Dashboard: the numbers you care about, and what is coming up. */
(function () {
  var A = window.Admin, h = A.h;
  function stat(n, label, go) {
    return h("a", { class: "stat", href: "#/" + go }, h("b", { text: String(n) }), h("span", { text: label }));
  }
  A.register({ id: "dashboard", label: "Dashboard", icon: "🏠", render: function (root) {
    root.appendChild(h("h2", { text: "Hello 👋" }));
    var box = h("div", { class: "card-box" }, h("p", { class: "muted", text: "Loading…" }));
    root.appendChild(box);
    A.call("adminOverview").then(function (r) {
      A.clear(box);
      if (!r.ok) { box.appendChild(h("p", { class: "error", text: r.error })); return; }
      var s = r.stats;
      box.appendChild(h("div", { class: "stats" },
        stat(s.upcomingSessions, "upcoming sessions", "sessions"),
        stat(s.childrenBooked, "children booked in", "bookings"),
        stat(s.spotsLeft, "spots still open", "sessions"),
        stat(s.bookingsThisWeek, "bookings this week", "bookings"),
        stat(s.products, "products in the shop", "products")));
      box.appendChild(h("h3", { text: "Coming up" }));
      if (!r.nextSessions.length) box.appendChild(h("p", { class: "muted", text: "No sessions yet. Create your first one under Sessions." }));
      r.nextSessions.forEach(function (x) {
        var pct = Math.min(100, Math.round(x.booked / x.capacity * 100));
        box.appendChild(h("a", { class: "row-card", href: "#/sessions" },
          h("div", {}, h("strong", { text: A.fmtDate(x.date) + " · " + A.fmtTime(x.start) }), h("small", { text: x.venue || "Venue to be confirmed" }),
            x.status === "potential" ? h("span", { class: "tag warn", text: "Not confirmed" }) : null),
          h("div", { class: "meter-wrap" }, h("div", { class: "meter" }, h("i", { style: "width:" + pct + "%" })), h("small", { text: x.booked + " of " + x.capacity + " children" }))));
      });
      box.appendChild(h("div", { class: "quick" },
        h("a", { class: "btn primary", href: "#/sessions", text: "+ New session" }),
        h("a", { class: "btn", href: "#/products", text: "Manage products" }),
        h("a", { class: "btn", href: "#/theme", text: "Change the look" })));
    });
  } });
})();
