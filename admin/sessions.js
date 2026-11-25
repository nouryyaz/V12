/* Sessions: create, edit, move and cancel sessions. Every session has its own limit, price and details. */
(function () {
  var A = window.Admin, h = A.h;

  function blank() {
    return { title: "Mateology Play Session", date: "", start: "09:30", end: "11:00", venue: "", capacity: 20, price: "", ages: "", pay: "", about: "", status: "confirmed" };
  }

  function editor(session, onDone) {
    var isNew = !session.key;
    var s = Object.assign({}, session);
    var f = {};
    function inp(k, type, attrs) { f[k] = h("input", Object.assign({ type: type || "text", value: s[k] == null ? "" : s[k] }, attrs || {})); return f[k]; }
    var form = h("div", { class: "form-grid" },
      A.field("Title", inp("title", "text", { maxlength: 90 })),
      A.field("Venue", inp("venue", "text", { maxlength: 120, placeholder: "e.g. Merrylands Community Centre" })),
      A.field("Date", inp("date", "date", isNew ? { min: A.today() } : {})),
      h("div", { class: "two" }, A.field("Starts", inp("start", "time")), A.field("Ends", inp("end", "time"))),
      A.field("How many children can come?", inp("capacity", "number", { min: 1, max: 500, step: 1 }),
        s.booked ? s.booked + " already booked, so the limit can't go lower than that." : "You can change this any time."),
      A.field("Price for this session", inp("price", "text", { maxlength: 60, placeholder: "e.g. $18 per child" }), "Shown on the booking page. Leave blank for free."),
      A.field("Ages", inp("ages", "text", { maxlength: 60, placeholder: "e.g. 1 to 4 years" })),
      A.field("Payment link (optional)", inp("pay", "url", { placeholder: "https://buy.stripe.com/…" }), "A Stripe Payment Link for this session's price."),
      A.field("Notes for families", (f.about = h("textarea", { rows: 3, maxlength: 400, text: s.about || "" })), "e.g. What to wear, what to bring."),
      A.field("Status", (f.status = h("select", {}, h("option", { value: "confirmed", text: "Confirmed: families can book" }), h("option", { value: "potential", text: "Not confirmed yet: shown but can't be booked" }))))
    );
    f.status.value = s.status;
    var weeks = null, notify = h("input", { type: "checkbox" });
    var extras = h("div", { class: "extras" });
    if (isNew) {
      weeks = h("input", { type: "number", min: 1, max: 26, value: 1 });
      extras.appendChild(A.field("Repeat weekly for how many weeks?", weeks, "1 creates just this session. 10 creates ten sessions, one a week."));
    } else if (s.booked) {
      extras.appendChild(h("label", { class: "check" }, notify, h("span", { text: "Email the " + s.booked + " booked children's families about this change" })));
    }
    var err = h("p", { class: "error", role: "alert" });
    var save = h("button", { class: "btn primary", type: "button", text: isNew ? "Create session" : "Save changes" });
    save.addEventListener("click", function () {
      var data = Object.assign({}, session, {
        title: f.title.value, venue: f.venue.value, date: f.date.value, start: f.start.value, end: f.end.value,
        capacity: Number(f.capacity.value), price: f.price.value, ages: f.ages.value, pay: f.pay.value, about: f.about.value, status: f.status.value });
      err.textContent = "";
      A.busy(save, A.call("adminSaveSession", { session: data, repeatWeeks: weeks ? Number(weeks.value) || 1 : undefined, notify: notify.checked })).then(function (r) {
        if (!r.ok) { err.textContent = r.error; return; }
        A.toast(isNew ? (r.created > 1 ? r.created + " sessions created" : "Session created") : "Saved" + (r.notified ? " · " + r.notified + " family emails sent" : ""));
        onDone();
      });
    });
    return h("section", { class: "card-box editor" },
      h("h3", { text: isNew ? "New session" : "Edit session" }), form, extras, err,
      h("div", { class: "actions" }, save, h("button", { class: "btn", type: "button", text: "Cancel", onclick: onDone })));
  }

  function remove(s, onDone) {
    A.call("adminDeleteSession", { key: s.key }).then(function (r) {
      if (r.ok) { A.toast("Session deleted"); onDone(); return; }
      if (!r.needsConfirm) { A.toast(r.error, "bad"); return; }
      var notify = h("input", { type: "checkbox", checked: true });
      A.dialog({ title: "This session has bookings",
        body: h("div", {}, h("p", { text: r.booked + " children are booked. Deleting cancels all of their bookings." }),
          h("label", { class: "check" }, notify, h("span", { text: "Email those families to let them know" }))),
        buttons: [{ label: "Keep session", value: false }, { label: "Delete and cancel bookings", kind: "danger", value: true }] }).then(function (yes) {
        if (!yes) return;
        A.call("adminDeleteSession", { key: s.key, confirm: true, notify: notify.checked }).then(function (r2) {
          if (r2.ok) { A.toast("Deleted" + (r2.notified ? " · " + r2.notified + " families emailed" : "")); onDone(); } else A.toast(r2.error, "bad");
        });
      });
    });
  }

  A.register({ id: "sessions", label: "Sessions", icon: "📅", render: function (root) {
    var showPast = false;
    var list = h("div", {});
    var holder = h("div", {});
    function load() {
      A.clear(holder); A.clear(list);
      list.appendChild(h("p", { class: "muted", text: "Loading…" }));
      A.call("adminSessions").then(function (r) {
        A.clear(list);
        if (!r.ok) { list.appendChild(h("p", { class: "error", text: r.error })); return; }
        var rows = r.sessions.filter(function (s) { return showPast || !s.past; });
        if (!rows.length) list.appendChild(h("div", { class: "empty-state" }, h("p", { text: "No sessions here yet." })));
        rows.forEach(function (s) {
          var pct = Math.min(100, Math.round(s.booked / s.capacity * 100));
          list.appendChild(h("div", { class: "row-card" + (s.past ? " past" : "") },
            h("div", { class: "grow" },
              h("strong", { text: A.fmtDate(s.date) + " · " + A.fmtTime(s.start) + " to " + A.fmtTime(s.end) }),
              h("small", { text: (s.venue || "Venue to be confirmed") + (s.price ? " · " + s.price : "") + (s.ages ? " · " + s.ages : "") }),
              h("div", {}, s.status === "potential" ? h("span", { class: "tag warn", text: "Not confirmed" }) : null, s.past ? h("span", { class: "tag", text: "Finished" }) : null)),
            h("div", { class: "meter-wrap" }, h("div", { class: "meter" + (pct >= 100 ? " full" : "") }, h("i", { style: "width:" + pct + "%" })),
              h("small", { text: s.booked + " of " + s.capacity + " children" })),
            h("div", { class: "row-actions" },
              h("button", { class: "btn small", type: "button", text: "Edit", onclick: function () { open(s); } }),
              h("a", { class: "btn small", href: "#/bookings?key=" + encodeURIComponent(s.key), text: "Bookings" }),
              h("button", { class: "btn small danger-o", type: "button", text: "Delete", onclick: function () { remove(s, load); } }))));
        });
      });
    }
    function open(s) {
      A.clear(holder);
      holder.appendChild(editor(s, function () { A.clear(holder); load(); }));
      holder.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    root.appendChild(h("div", { class: "page-head" }, h("h2", { text: "Sessions" }),
      h("div", {}, h("label", { class: "check" }, h("input", { type: "checkbox", onchange: function (e) { showPast = e.target.checked; load(); } }), h("span", { text: "Show finished" })),
        h("button", { class: "btn primary", type: "button", text: "+ New session", onclick: function () { open(blank()); } }))));
    root.appendChild(holder); root.appendChild(list);
    load();
  } });
})();
