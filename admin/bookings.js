/* Bookings: who is coming, cancel or restore, export to a spreadsheet file. */
(function () {
  var A = window.Admin, h = A.h;
  function csvCell(v) { v = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }

  A.register({ id: "bookings", label: "Bookings", icon: "🧒", render: function (root) {
    var all = [], sessions = [], key = A.query.key || "", q = "", st = "all";
    var table = h("div", {});
    var sel = h("select", { "aria-label": "Show bookings for", onchange: function () { key = sel.value; load(); } }, h("option", { value: "", text: "All sessions" }));
    var search = h("input", { type: "search", placeholder: "Search name, email, child…", "aria-label": "Search bookings", oninput: function () { q = search.value.toLowerCase(); draw(); } });
    var stSel = h("select", { "aria-label": "Status filter", onchange: function () { st = stSel.value; draw(); } },
      h("option", { value: "all", text: "All" }), h("option", { value: "confirmed", text: "Confirmed" }), h("option", { value: "cancelled", text: "Cancelled" }));
    function visible() {
      return all.filter(function (b) {
        if (st !== "all" && b.status !== st) return false;
        return !q || [b.name, b.email, b.phone, b.childDetails, b.ref, b.venue].join(" ").toLowerCase().indexOf(q) > -1;
      });
    }
    function draw() {
      A.clear(table);
      var rows = visible();
      var kids = rows.filter(function (b) { return b.status === "confirmed"; }).reduce(function (n, b) { return n + b.children; }, 0);
      table.appendChild(h("p", { class: "muted", text: rows.length + " bookings · " + kids + " children confirmed" }));
      if (!rows.length) table.appendChild(h("div", { class: "empty-state" }, h("p", { text: "No bookings to show." })));
      rows.forEach(function (b) {
        var cancelled = b.status === "cancelled";
        table.appendChild(h("div", { class: "row-card" + (cancelled ? " past" : "") },
          h("div", { class: "grow" },
            h("strong", { text: b.name + " · " + b.children + (b.children === 1 ? " child" : " children") }),
            h("small", { text: A.fmtDate(b.date.slice(0, 10)) + " · " + b.venue }),
            h("small", { text: b.email + (b.phone ? " · " + b.phone : "") }),
            b.childDetails ? h("small", { text: "Children: " + b.childDetails }) : null,
            b.notes ? h("small", { text: "Notes: " + b.notes }) : null,
            h("div", {}, h("span", { class: "tag " + (cancelled ? "bad" : "good"), text: cancelled ? "Cancelled" : "Confirmed" }), h("span", { class: "tag", text: b.ref }))),
          h("div", { class: "row-actions" },
            h("button", { class: "btn small" + (cancelled ? "" : " danger-o"), type: "button", text: cancelled ? "Restore" : "Cancel booking", onclick: function () { change(b, cancelled ? "confirmed" : "cancelled"); } }))));
      });
    }
    function change(b, status) {
      var notify = h("input", { type: "checkbox", checked: true });
      A.dialog({ title: status === "cancelled" ? "Cancel this booking?" : "Restore this booking?",
        body: h("div", {}, h("p", { text: b.name + " · " + b.children + " children · " + A.fmtDate(b.date.slice(0, 10)) }),
          h("label", { class: "check" }, notify, h("span", { text: "Email " + b.email + " to let them know" }))),
        buttons: [{ label: "Back", value: false }, { label: status === "cancelled" ? "Cancel booking" : "Restore", kind: status === "cancelled" ? "danger" : "primary", value: true }] }).then(function (yes) {
        if (!yes) return;
        A.call("adminUpdateBooking", { ref: b.ref, status: status, notify: notify.checked }).then(function (r) {
          if (r.ok) { A.toast(status === "cancelled" ? "Booking cancelled" : "Booking restored"); load(); } else A.toast(r.error, "bad");
        });
      });
    }
    function exportCsv() {
      var head = ["Reference", "Booked at", "Session date", "Venue", "Parent", "Email", "Phone", "Children", "Child details", "Notes", "Status"];
      var lines = [head.map(csvCell).join(",")].concat(visible().map(function (b) {
        return [b.ref, b.bookedAt, b.date, b.venue, b.name, b.email, b.phone, b.children, b.childDetails, b.notes, b.status].map(csvCell).join(",");
      }));
      var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "bookings.csv" });
      document.body.appendChild(a); a.click(); a.remove();
    }
    function load() {
      A.call("adminBookings", key ? { key: key } : {}).then(function (r) {
        if (!r.ok) { A.clear(table); table.appendChild(h("p", { class: "error", text: r.error })); return; }
        all = r.bookings; draw();
      });
    }
    root.appendChild(h("div", { class: "page-head" }, h("h2", { text: "Bookings" }), h("button", { class: "btn", type: "button", text: "Download as spreadsheet (CSV)", onclick: exportCsv })));
    root.appendChild(h("div", { class: "filters" }, sel, stSel, search));
    root.appendChild(table);
    A.call("adminSessions").then(function (r) {
      if (r.ok) r.sessions.slice().reverse().forEach(function (s) {
        sel.appendChild(h("option", { value: s.key, text: A.fmtDate(s.date) + " · " + (s.venue || s.title) }));
      });
      sel.value = key;
    });
    load();
  } });
})();
