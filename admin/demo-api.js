/* Demo mode: a pretend server that lives in your browser, used while BOOKING_API_URL is empty.
   It behaves like the real admin backend (same requests, same answers) so you can try everything.
   Changes are kept in this browser only and also show on the public pages when opened here. */
(function () {
  "use strict";
  var KEY = "mps-demo-admin";
  var mem = null;
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function seed() {
    var s = [], day = new Date();
    for (var i = 0; i < 4; i++) {
      var d = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 6 + i * 7);
      s.push({ id: "demo" + i, key: "demo" + i + "|" + iso(d), title: "Mateology Play Session", date: iso(d), start: "09:30", end: "11:00",
        venue: ["Merrylands Community Centre", "Parramatta Library Room", "Granville Community Hall", "Merrylands Community Centre"][i],
        capacity: [20, 12, 16, 20][i], price: i === 1 ? "$25 per child" : "$18 per child", ages: "1 to 4 years", pay: "", about: "Bring a towel and a change of clothes.", status: i === 3 ? "potential" : "confirmed" });
    }
    var b = [
      ["SP-DEMO1", s[0], "Jess Carter", "jess@example.org", "0412 000 111", 2, "Mia (2), Leo (4)", ""],
      ["SP-DEMO2", s[0], "Priya Nair", "priya@example.org", "0422 000 222", 1, "Arjun (3)", "Nut allergy"],
      ["SP-DEMO3", s[1], "Tom Reilly", "tom@example.org", "0433 000 333", 3, "Three little ones", ""]];
    return { sessions: s, bookings: b.map(function (r) { return { ref: r[0], bookedAt: new Date().toISOString(), key: r[1].key, date: r[1].date, title: r[1].title, venue: r[1].venue,
      name: r[2], email: r[3], phone: r[4], children: r[5], childDetails: r[6], notes: r[7], status: "confirmed" }; }), products: null, settings: null };
  }
  function load() {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (!mem) mem = seed();
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  function booked(st, key) { return st.bookings.filter(function (b) { return b.key === key && b.status === "confirmed"; }).reduce(function (n, b) { return n + b.children; }, 0); }
  function view(st, s) { return Object.assign({}, s, { booked: booked(st, s.key), past: s.date < iso(new Date()) }); }
  function text(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n); }
  var HEX = /^#[0-9a-fA-F]{6}$/;

  function changes(st) {
    var out = [];
    if (st.productsDraft) {
      var live = st.products;
      if (!live) out.push("Products: your product list moves into the portal (" + st.productsDraft.length + " products)");
      else {
        var lm = {}, dm = {};
        live.forEach(function (p) { lm[p.id] = p; }); st.productsDraft.forEach(function (p) { dm[p.id] = p; });
        st.productsDraft.forEach(function (p) { if (!lm[p.id]) out.push("Product added: " + p.name); else if (JSON.stringify(lm[p.id]) !== JSON.stringify(p)) out.push("Product changed: " + p.name); });
        live.forEach(function (p) { if (!dm[p.id]) out.push("Product removed: " + p.name); });
        if (!out.length) out.push("Product order changed");
      }
    }
    if (st.settingsDraft) {
      var d = st.settingsDraft, l = st.settings || {}, df = function (a, b) { return JSON.stringify(a || null) !== JSON.stringify(b || null); }, n = out.length;
      if (df(d.colors, l.colors)) out.push("Brand colours changed");
      if (df(d.scroll, l.scroll)) out.push("Scrolling background colours changed");
      if (df(d.effects, l.effects)) out.push("Fun effects changed");
      if (df(d.text, l.text)) out.push("Website wording changed");
      if (df(d.announcement, l.announcement)) out.push("Announcement banner changed");
      if (out.length === n) out.push("Website look: no visible difference");
    }
    return out;
  }
  function status() { var st = load(); return { productsDraft: !!st.productsDraft, settingsDraft: !!st.settingsDraft, hasDraft: !!(st.productsDraft || st.settingsDraft), canUndo: !!st.prev, changes: changes(st) }; }

  var routes = {
    adminLogin: function (b) { return b.password ? { ok: true, token: "demo-token", expiresInSeconds: 21600, businessName: "Mateology Play Society" } : { ok: false, error: "Please type a password (anything works in demo mode)." }; },
    adminLogout: function () { return { ok: true }; },
    adminChangePassword: function (b) { return b.next && b.next.length >= 10 ? { ok: true } : { ok: false, error: "Please choose a password with at least 10 characters." }; },
    adminSessions: function () { var st = load(); return { ok: true, sessions: st.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (s) { return view(st, s); }) }; },
    adminOverview: function () {
      var st = load(), up = st.sessions.map(function (s) { return view(st, s); }).filter(function (s) { return !s.past; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      return { ok: true, stats: { upcomingSessions: up.length, childrenBooked: up.reduce(function (n, s) { return n + s.booked; }, 0),
        spotsLeft: up.filter(function (s) { return s.status === "confirmed"; }).reduce(function (n, s) { return n + Math.max(0, s.capacity - s.booked); }, 0),
        bookingsThisWeek: st.bookings.filter(function (b) { return b.status === "confirmed"; }).length, products: (st.productsDraft || st.products || []).length || 3 }, nextSessions: up.slice(0, 5) };
    },
    adminSaveSession: function (b) {
      var st = load(), s = b.session || {};
      var title = text(s.title, 90); if (!title) return { ok: false, error: "Please give the session a title." };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || "")) return { ok: false, error: "Please pick a date." };
      if (!s.start || !s.end) return { ok: false, error: "Please set a start and end time." };
      if (String(s.end) <= String(s.start)) return { ok: false, error: "The end time must be after the start time." };
      var cap = Math.floor(Number(s.capacity)); if (!(cap >= 1 && cap <= 500)) return { ok: false, error: "The number of children must be between 1 and 500." };
      var pay = text(s.pay, 300); if (pay && !/^https:\/\/\S+$/.test(pay)) return { ok: false, error: "The payment link must start with https://" };
      var d = { title: title, date: s.date, start: s.start, end: s.end, venue: text(s.venue, 120), capacity: cap, price: text(s.price, 60), ages: text(s.ages, 60), pay: pay, about: text(s.about, 400), status: s.status === "potential" ? "potential" : "confirmed" };
      if (!s.key) {
        if (s.date <= iso(new Date())) return { ok: false, error: "Please pick a date and time in the future." };
        var n = Math.max(1, Math.min(26, Math.floor(b.repeatWeeks) || 1));
        for (var i = 0; i < n; i++) {
          var p = s.date.split("-"), dt = new Date(+p[0], +p[1] - 1, +p[2] + i * 7), id = "demo" + Date.now() + i;
          st.sessions.push(Object.assign({ id: id, key: id + "|" + iso(dt) }, d, { date: iso(dt) }));
        }
        save(); return { ok: true, created: n, sessions: routes.adminSessions().sessions };
      }
      var cur = st.sessions.filter(function (x) { return x.key === s.key; })[0];
      if (!cur) return { ok: false, error: "That session could not be found. It may have been deleted." };
      var bk = booked(st, cur.key);
      if (cap < bk) return { ok: false, error: bk + " children are already booked. Set the limit to at least " + bk + ", or cancel some bookings first." };
      var oldKey = cur.key; Object.assign(cur, d); cur.key = cur.id + "|" + d.date;
      st.bookings.forEach(function (x) { if (x.key === oldKey) { x.key = cur.key; x.date = d.date; x.venue = d.venue; x.title = d.title; } });
      save(); return { ok: true, notified: b.notify ? bk && st.bookings.filter(function (x) { return x.key === cur.key && x.status === "confirmed"; }).length : 0, sessions: routes.adminSessions().sessions };
    },
    adminDeleteSession: function (b) {
      var st = load(), s = st.sessions.filter(function (x) { return x.key === b.key; })[0];
      if (!s) return { ok: false, error: "That session could not be found." };
      var bk = booked(st, s.key);
      if (bk && !b.confirm) return { ok: false, needsConfirm: true, booked: bk, error: bk + " children are booked." };
      var emailed = 0;
      st.bookings.forEach(function (x) { if (x.key === s.key && x.status === "confirmed") { x.status = "cancelled"; emailed++; } });
      st.sessions = st.sessions.filter(function (x) { return x !== s; }); save();
      return { ok: true, notified: b.notify ? emailed : 0, sessions: routes.adminSessions().sessions };
    },
    adminBookings: function (b) { var st = load(); return { ok: true, bookings: st.bookings.filter(function (x) { return !b.key || x.key === b.key; }).slice().reverse() }; },
    adminUpdateBooking: function (b) {
      var st = load(), bk = st.bookings.filter(function (x) { return x.ref === b.ref; })[0];
      if (!bk) return { ok: false, error: "That booking could not be found." };
      var status = b.status === "cancelled" ? "cancelled" : "confirmed";
      if (status === "confirmed" && bk.status === "cancelled") {
        var s = st.sessions.filter(function (x) { return x.key === bk.key; })[0];
        if (s && booked(st, s.key) + bk.children > s.capacity) return { ok: false, error: "There is not enough room left in that session to restore this booking." };
      }
      bk.status = status; save(); return { ok: true, notified: b.notify ? 1 : 0, booking: bk };
    },
    adminProducts: function () { var st = load(); var cur = st.productsDraft || st.products; return { ok: true, managed: !!cur, products: cur || [] }; },
    adminSaveProducts: function (b) {
      if (!Array.isArray(b.products)) return { ok: false, error: "Products must be a list." };
      var out = [], seen = {};
      for (var i = 0; i < b.products.length; i++) {
        var p = b.products[i], name = text(p.name, 80), price = text(p.price, 20);
        if (!name) return { ok: false, error: "Product " + (i + 1) + " needs a name." };
        if (!price) return { ok: false, error: "\"" + name + "\" needs a price, like $29.00." };
        var img = text(p.image, 400), link = text(p.stripeLink, 400);
        if (img && !(/^images\/[A-Za-z0-9._\-\/]+$/.test(img) || /^https:\/\/\S+$/.test(img)) || /\.\./.test(img)) return { ok: false, error: "\"" + name + "\" has an image address that is not allowed." };
        if (link && !/^https:\/\/\S+$/.test(link)) return { ok: false, error: "\"" + name + "\" has a payment link that does not start with https://" };
        var id = (p.id || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item", base = id, n = 2;
        while (seen[id]) id = base + "-" + n++;
        seen[id] = 1;
        out.push({ id: id, name: name, description: text(p.description, 300), price: price, image: img, stripeLink: link, inStock: p.inStock !== false, visible: p.visible !== false });
      }
      var st = load(); st.productsDraft = out; save(); return { ok: true, products: out, status: status() };
    },
    adminSettings: function () { var st = load(); return { ok: true, settings: st.settingsDraft || st.settings }; },
    adminDraftStatus: function () { return { ok: true, status: status() }; },
    adminPreviewLink: function () { return { ok: true, token: "demo-preview", expiresInSeconds: 1800 }; },
    adminDiscardDraft: function () { var st = load(); st.productsDraft = null; st.settingsDraft = null; save(); return { ok: true, status: status() }; },
    adminPublish: function () {
      var st = load();
      if (!st.productsDraft && !st.settingsDraft) return { ok: false, error: "There is nothing to publish." };
      st.prev = { products: st.products || null, settings: st.settings || null, hadProducts: !!st.productsDraft, hadSettings: !!st.settingsDraft };
      if (st.productsDraft) { st.products = st.productsDraft; st.productsDraft = null; }
      if (st.settingsDraft) { st.settings = st.settingsDraft; st.settingsDraft = null; }
      save(); return { ok: true, status: status() };
    },
    adminUndoPublish: function () {
      var st = load(); if (!st.prev) return { ok: false, error: "There is nothing to undo." };
      if (st.prev.hadProducts) st.products = st.prev.products;
      if (st.prev.hadSettings) st.settings = st.prev.settings;
      st.prev = null; save(); return { ok: true, status: status() };
    },
    adminSaveSettings: function (b) {
      var s = b.settings || {}, c = s.colors || {};
      for (var k in c) if (!HEX.test(c[k])) return { ok: false, error: "The colour for \"" + k + "\" is not a valid colour." };
      if (!Array.isArray(s.scroll) || s.scroll.length !== 6 || !s.scroll.every(function (x) { return HEX.test(x); })) return { ok: false, error: "The scrolling background needs exactly 6 valid colours." };
      var a = s.announcement || {}; if (a.link && !/^https:\/\/\S+$/.test(a.link)) return { ok: false, error: "The announcement link must start with https://" };
      var st = load(); st.settingsDraft = s; save(); return { ok: true, settings: s, status: status() };
    },
    adminUpload: function () { return { ok: false, error: "Photo uploads work once your Google booking address is connected. For now, pick one of the photos in the library." }; }
  };

  window.AdminDemo = {
    handle: function (body) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          if (body.action !== "adminLogin" && body.token !== "demo-token") return resolve({ ok: false, error: "Please sign in again.", needsLogin: true });
          var fn = routes[body.action];
          resolve(fn ? fn(body) : { ok: false, error: "Unknown request." });
        }, 120);
      });
    }
  };
})();
