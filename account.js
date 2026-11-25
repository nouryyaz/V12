/* Parent account page: sign in with an emailed code, then see sessions, activity, invoices,
   children and email preferences. Talks to Supabase over plain web requests (no extra libraries).
   Every row is protected on the server: a parent can only ever receive their own family's data.
   While SUPABASE_URL is empty this page runs in demo mode with pretend data. */
(function () {
  "use strict";
  var root = document.getElementById("acct");
  if (!root) return;
  var URLBASE = (typeof SUPABASE_URL === "string" ? SUPABASE_URL : "").replace(/\/+$/, "");
  var KEY = typeof SUPABASE_ANON_KEY === "string" ? SUPABASE_ANON_KEY : "";
  var DEMO = !URLBASE || !KEY;
  var SKEY = "mps-parent-session";
  var session = null, me = null, data = {}, tab = "sessions";

  /* ---------- tiny safe DOM helper (text only) ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === "class") el.className = v; else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v; else if (v === true) el.setAttribute(k, ""); else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(el, x); }); else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c))); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function money(c) { return "$" + (Number(c) / 100).toFixed(2); }
  function day(d) { var p = String(d).slice(0, 10).split("-"); if (p.length !== 3) return d; return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
  function todayIso() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  /* ---------- Supabase over fetch ---------- */
  function saveSession(s) { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} }
  function loadSession() { try { return JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
  function hdr(auth) { var x = { apikey: KEY, "Content-Type": "application/json" }; if (auth) x.Authorization = "Bearer " + auth; return x; }
  function toSession(j) { return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user && j.user.id, email: j.user && j.user.email }; }

  function fresh() {
    if (!session) return Promise.reject(new Error("signed-out"));
    if (session.expires - Date.now() > 60000) return Promise.resolve(session.access);
    return fetch(URLBASE + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: hdr(), body: JSON.stringify({ refresh_token: session.refresh }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("signed-out")); })
      .then(function (j) { var s = toSession(j); s.uid = s.uid || session.uid; s.email = s.email || session.email; saveSession(s); return s.access; });
  }
  function rest(method, path, body, extra) {
    return fresh().then(function (tok) {
      var hh = hdr(tok); if (extra) Object.keys(extra).forEach(function (k) { hh[k] = extra[k]; });
      return fetch(URLBASE + "/rest/v1/" + path, { method: method, headers: hh, body: body ? JSON.stringify(body) : undefined });
    }).then(function (r) {
      if (r.status === 401) { saveSession(null); throw new Error("signed-out"); }
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.message || "Something went wrong. Please try again."); });
      return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  var api = DEMO ? demoApi() : {
    sendCode: function (email) {
      return fetch(URLBASE + "/auth/v1/otp", { method: "POST", headers: hdr(), body: JSON.stringify({ email: email, create_user: true }) })
        .then(function (r) { if (r.ok) return; return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(r.status === 429 ? "Too many tries. Please wait a minute and try again." : (j.msg || j.message || "We couldn't send the code. Please check the email address and try again.")); }); });
    },
    verify: function (email, code) {
      return fetch(URLBASE + "/auth/v1/verify", { method: "POST", headers: hdr(), body: JSON.stringify({ type: "email", email: email, token: code }) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("That code didn't work. It may have expired. Please try again.")); })
        .then(function (j) { saveSession(toSession(j)); });
    },
    signOut: function () {
      var tok = session && session.access; saveSession(null);
      return tok ? fetch(URLBASE + "/auth/v1/logout", { method: "POST", headers: hdr(tok) }).catch(function () {}) : Promise.resolve();
    },
    load: function () {
      var u = session.uid, f = "family_id=eq." + encodeURIComponent(u);
      return Promise.all([
        rest("GET", "families?select=*&id=eq." + encodeURIComponent(u)),
        rest("GET", "children?select=*&" + f + "&order=created_at"),
        rest("GET", "attendances?select=*&" + f + "&order=session_date.desc"),
        rest("GET", "activity_notes?select=*&" + f + "&order=session_date.desc"),
        rest("GET", "invoices?select=*&" + f + "&order=issued_at.desc"),
        rest("GET", "marketing_prefs?select=*&" + f)
      ]).then(function (a) { return { family: (a[0] || [])[0] || { email: session.email }, children: a[1] || [], attendances: a[2] || [], notes: a[3] || [], invoices: a[4] || [], prefs: (a[5] || [])[0] || { email_opt_in: false } }; });
    },
    saveProfile: function (p) { return rest("PATCH", "families?id=eq." + encodeURIComponent(session.uid), p, { Prefer: "return=minimal" }); },
    addChild: function (c) { return rest("POST", "children", { family_id: session.uid, first_name: c.first_name, birth_year: c.birth_year }, { Prefer: "return=minimal" }); },
    removeChild: function (id) { return rest("DELETE", "children?id=eq." + encodeURIComponent(id) + "&family_id=eq." + encodeURIComponent(session.uid), null, { Prefer: "return=minimal" }); },
    setMarketing: function (on) { return rest("PATCH", "marketing_prefs?family_id=eq." + encodeURIComponent(session.uid), { email_opt_in: on }, { Prefer: "return=minimal" }); },
    deleteAccount: function () { return rest("POST", "rpc/delete_my_account", {}); }
  };

  /* ---------- Demo mode: pretend data kept in memory ---------- */
  function demoApi() {
    var d = null, t = todayIso();
    function plus(n) { var x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
    function seed(email) {
      d = { family: { email: email, parent_name: "", phone: "" }, children: [{ id: "c1", first_name: "Mia", birth_year: 2023 }, { id: "c2", first_name: "Leo", birth_year: 2021 }],
        attendances: [{ id: "a1", session_date: plus(6), session_title: "Mateology Play Session", venue: "Merrylands Community Centre", status: "booked", child_id: "c1", booking_ref: "SP-DEMO1" },
          { id: "a2", session_date: plus(-8), session_title: "Mateology Play Session", venue: "Parramatta Library Room", status: "attended", child_id: "c1", booking_ref: "SP-DEMO0" },
          { id: "a3", session_date: plus(-15), session_title: "Mateology Play Session", venue: "Merrylands Community Centre", status: "attended", child_id: "c2", booking_ref: "SP-DEMO9" }],
        notes: [{ id: "n1", session_date: plus(-8), child_id: "c1", activity: "Rainbow rice scooping", note: "Mia loved pouring and listening to the sound. Great focus today!" },
          { id: "n2", session_date: plus(-15), child_id: "c2", activity: "Sand and shells", note: "Leo built a tower and counted the shells out loud." }],
        invoices: [{ id: "i1", number: "MPS-0007", issued_at: plus(-8), description: "Play session, 1 child", amount_cents: 1800, status: "paid" },
          { id: "i2", number: "MPS-0009", issued_at: plus(-1), description: "Play session, 2 children", amount_cents: 3600, status: "unpaid", pay_url: "https://buy.stripe.com/replace-me" }],
        prefs: { email_opt_in: false } };
    }
    return {
      sendCode: function (email) { return /.+@.+\..+/.test(email) ? Promise.resolve() : Promise.reject(new Error("Please check the email address.")); },
      verify: function (email, code) { if (!code) return Promise.reject(new Error("Please enter the code.")); seed(email); saveSession({ access: "demo", refresh: "demo", expires: Date.now() + 36e5, uid: "demo", email: email }); return Promise.resolve(); },
      signOut: function () { saveSession(null); d = null; return Promise.resolve(); },
      load: function () { if (!d) seed(session.email); return Promise.resolve(JSON.parse(JSON.stringify(d))); },
      saveProfile: function (p) { Object.assign(d.family, p); return Promise.resolve(); },
      addChild: function (c) { d.children.push({ id: "c" + Date.now(), first_name: c.first_name, birth_year: c.birth_year }); return Promise.resolve(); },
      removeChild: function (id) { d.children = d.children.filter(function (x) { return x.id !== id; }); return Promise.resolve(); },
      setMarketing: function (on) { d.prefs = { email_opt_in: on, opted_in_at: on ? new Date().toISOString() : d.prefs.opted_in_at, opted_out_at: on ? null : new Date().toISOString() }; return Promise.resolve(); },
      deleteAccount: function () { saveSession(null); d = null; return Promise.resolve(); }
    };
  }

  /* ---------- Screens ---------- */
  function demoBanner() { return DEMO ? h("p", { class: "acct-demo", text: "Demo mode: any email and code will do, and the sessions, notes and invoices below are pretend." }) : null; }

  function signIn(msg) {
    clear(root);
    var email = h("input", { type: "email", id: "em", autocomplete: "email", required: true, placeholder: "you@example.com", inputmode: "email" });
    var err = h("p", { class: "acct-error", role: "alert", text: msg || "" });
    var btn = h("button", { class: "acct-btn primary", type: "submit", text: "Email me a code" });
    var form = h("form", { class: "acct-form", novalidate: true, onsubmit: function (e) {
      e.preventDefault(); err.textContent = "";
      var v = email.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { err.textContent = "Please enter a valid email address."; return; }
      btn.disabled = true;
      api.sendCode(v).then(function () { enterCode(v); }, function (x) { err.textContent = x.message; btn.disabled = false; });
    } }, h("label", { for: "em" }, "Your email", email), btn, err);
    root.appendChild(h("div", { class: "acct-card narrow" }, demoBanner(), h("h2", { text: "Parent sign in" }),
      h("p", { text: "See your sessions, what your little ones have explored, and your invoices. We'll email you a code, so there's no password to remember." }), form,
      h("p", { class: "acct-muted", text: "New here? Use the same email you book with and your account is made automatically." })));
    email.focus();
  }

  function enterCode(emailAddr) {
    clear(root);
    var code = h("input", { type: "text", id: "cd", class: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 10, required: true, "aria-label": "Sign-in code" });
    var err = h("p", { class: "acct-error", role: "alert" });
    var btn = h("button", { class: "acct-btn primary", type: "submit", text: "Sign in" });
    var resend = h("button", { class: "acct-btn", type: "button", text: "Send a new code", onclick: function () {
      resend.disabled = true; api.sendCode(emailAddr).then(function () { err.textContent = ""; err.className = "acct-ok"; err.textContent = "A new code is on its way."; setTimeout(function () { resend.disabled = false; }, 30000); }, function (x) { err.className = "acct-error"; err.textContent = x.message; resend.disabled = false; });
    } });
    var form = h("form", { class: "acct-form", onsubmit: function (e) {
      e.preventDefault(); err.className = "acct-error"; err.textContent = "";
      var v = code.value.replace(/\s+/g, "");
      if (!/^\d{6,10}$/.test(v) && !DEMO) { err.textContent = "Please type the number from your email."; return; }
      btn.disabled = true;
      api.verify(emailAddr, v).then(start, function (x) { err.textContent = x.message; btn.disabled = false; code.select(); });
    } }, h("label", { for: "cd" }, "Code from your email", code), btn);
    root.appendChild(h("div", { class: "acct-card narrow" }, demoBanner(), h("h2", { text: "Check your email" }),
      h("p", { text: "We sent a code to " + emailAddr + ". It can take a minute. Check your junk folder too." }), form, err,
      h("div", { class: "acct-actions" }, resend, h("button", { class: "acct-btn", type: "button", text: "Use a different email", onclick: function () { signIn(); } }))));
    code.focus();
  }

  function start() {
    clear(root); root.appendChild(h("p", { text: "Loading your account…" }));
    api.load().then(function (d) { data = d; me = d.family; dashboard(); }, function (e) {
      if (e && e.message === "signed-out") signIn("Please sign in again."); else { clear(root); root.appendChild(h("div", { class: "acct-card" }, h("p", { class: "acct-error", text: (e && e.message) || "We couldn't load your account." }), h("button", { class: "acct-btn", type: "button", text: "Try again", onclick: start }))); }
    });
  }

  function childName(id) { var c = (data.children || []).filter(function (x) { return x.id === id; })[0]; return c ? c.first_name : ""; }
  function empty(t) { return h("p", { class: "acct-muted", text: t }); }
  var TABS = [["sessions", "My sessions"], ["activity", "Activity"], ["invoices", "Invoices"], ["children", "My children"], ["prefs", "Preferences"], ["account", "Account"]];

  function dashboard() {
    clear(root);
    var name = (me.parent_name || "").trim();
    add(root, demoBanner());
    root.appendChild(h("h2", { text: name ? "Hi " + name + " 👋" : "Welcome back 👋" }));
    var tabs = h("div", { class: "acct-tabs", role: "tablist" }), panel = h("div", { role: "tabpanel" });
    TABS.forEach(function (t) {
      tabs.appendChild(h("button", { type: "button", role: "tab", "aria-selected": String(tab === t[0]), text: t[1], onclick: function () { tab = t[0]; dashboard(); } }));
    });
    root.appendChild(tabs); root.appendChild(panel);
    ({ sessions: viewSessions, activity: viewActivity, invoices: viewInvoices, children: viewChildren, prefs: viewPrefs, account: viewAccount })[tab](panel);
  }

  function statusTag(s) { return h("span", { class: "acct-tag " + (s === "attended" ? "good" : s === "cancelled" ? "bad" : "warn"), text: s === "attended" ? "Attended" : s === "cancelled" ? "Cancelled" : "Booked" }); }

  function viewSessions(p) {
    var t = todayIso(), all = data.attendances || [];
    var up = all.filter(function (a) { return a.session_date >= t && a.status !== "cancelled"; }).reverse(), past = all.filter(function (a) { return !(a.session_date >= t && a.status !== "cancelled"); });
    function row(a) { return h("div", { class: "acct-row" }, h("div", {}, h("strong", { text: day(a.session_date) }), h("small", { text: (a.venue || "") + (childName(a.child_id) ? " · " + childName(a.child_id) : "") })), statusTag(a.status)); }
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Coming up" }), up.length ? up.map(row) : empty("Nothing booked yet."), h("p", {}, h("a", { class: "acct-btn primary", href: "sessions.html", text: "Book a session" }))));
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Previous sessions" }), past.length ? past.map(row) : empty("Your past sessions will show here.")));
  }

  function viewActivity(p) {
    var notes = data.notes || [];
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "What your little ones have explored" }),
      notes.length ? notes.map(function (n) {
        return h("div", { class: "acct-row" }, h("div", {}, h("strong", { text: n.activity }), h("small", { text: day(n.session_date) + (childName(n.child_id) ? " · " + childName(n.child_id) : "") }), n.note ? h("p", { class: "acct-note", text: n.note }) : null));
      }) : empty("After each session we add what your little one explored here.")));
  }

  function viewInvoices(p) {
    var inv = data.invoices || [];
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Invoices" }),
      inv.length ? inv.map(function (i) {
        var pay = i.status === "unpaid" && /^https:\/\//.test(i.pay_url || "");
        return h("div", { class: "acct-row" }, h("div", {}, h("strong", { text: i.number }), h("small", { text: day(i.issued_at) + " · " + i.description })),
          h("div", { class: "acct-actions" }, h("span", { class: "amt", text: money(i.amount_cents) }), h("span", { class: "acct-tag " + (i.status === "paid" ? "good" : i.status === "refunded" ? "" : "warn"), text: i.status === "paid" ? "Paid" : i.status === "refunded" ? "Refunded" : "Unpaid" }),
            pay ? h("a", { class: "acct-btn primary", href: i.pay_url, rel: "noopener", text: "Pay now" }) : null));
      }) : empty("Your invoices will show here."),
      h("p", { class: "acct-muted", text: "Payments are handled securely by Stripe. We never see or store your card details." })));
  }

  function viewChildren(p) {
    var nm = h("input", { type: "text", id: "kn", maxlength: 40, required: true, autocomplete: "off" });
    var yr = h("input", { type: "number", id: "ky", min: 2000, max: new Date().getFullYear(), placeholder: "e.g. 2023" });
    var err = h("p", { class: "acct-error", role: "alert" });
    var btn = h("button", { class: "acct-btn primary", type: "submit", text: "Add child" });
    var form = h("form", { class: "acct-form", onsubmit: function (e) {
      e.preventDefault(); err.textContent = "";
      var n = nm.value.trim(), y = yr.value ? parseInt(yr.value, 10) : null;
      if (!n) { err.textContent = "Please add a first name."; return; }
      if (y !== null && (y < 2000 || y > new Date().getFullYear())) { err.textContent = "Please check the birth year."; return; }
      btn.disabled = true;
      api.addChild({ first_name: n, birth_year: y }).then(refresh, function (x) { err.textContent = x.message; btn.disabled = false; });
    } }, h("label", { for: "kn" }, "First name", nm), h("label", { for: "ky" }, "Birth year (optional)", yr), btn, err);
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "My children" }),
      (data.children || []).length ? data.children.map(function (c) {
        return h("div", { class: "acct-row" }, h("div", {}, h("strong", { text: c.first_name }), c.birth_year ? h("small", { text: "Born " + c.birth_year }) : null),
          h("button", { class: "acct-btn", type: "button", "aria-label": "Remove " + c.first_name, text: "Remove", onclick: function () {
            if (window.confirm("Remove " + c.first_name + "? Past notes about them stay in your account without a name.")) api.removeChild(c.id).then(refresh);
          } }));
      }) : empty("Add your children so their sessions and notes show under their name."), h("p", { class: "acct-muted", text: "We only keep a first name and birth year." })));
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Add a child" }), form));
  }

  function viewPrefs(p) {
    var on = !!(data.prefs && data.prefs.email_opt_in), msg = h("p", { role: "status", class: "acct-ok" });
    var cb = h("input", { type: "checkbox", id: "mk", checked: on, onchange: function () {
      cb.disabled = true; msg.className = "acct-ok"; msg.textContent = "";
      api.setMarketing(cb.checked).then(function () { data.prefs = Object.assign({}, data.prefs, { email_opt_in: cb.checked }); msg.textContent = cb.checked ? "Thanks! You'll hear about new sessions and play kits." : "Done. You won't get marketing emails."; cb.disabled = false; },
        function (x) { cb.checked = !cb.checked; msg.className = "acct-error"; msg.textContent = x.message; cb.disabled = false; });
    } });
    var nm = h("input", { type: "text", id: "pn", maxlength: 80, value: me.parent_name || "", autocomplete: "name" });
    var ph = h("input", { type: "tel", id: "pp", maxlength: 30, value: me.phone || "", autocomplete: "tel" });
    var perr = h("p", { class: "acct-ok", role: "status" });
    var form = h("form", { class: "acct-form", onsubmit: function (e) {
      e.preventDefault(); perr.className = "acct-ok"; perr.textContent = "";
      api.saveProfile({ parent_name: nm.value.trim(), phone: ph.value.trim() }).then(function () { me.parent_name = nm.value.trim(); me.phone = ph.value.trim(); perr.textContent = "Saved."; }, function (x) { perr.className = "acct-error"; perr.textContent = x.message; });
    } }, h("label", { for: "pn" }, "Your name", nm), h("label", { for: "pp" }, "Phone", ph), h("div", {}, h("button", { class: "acct-btn primary", type: "submit", text: "Save" })), perr);
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Email preferences" }),
      h("label", { class: "acct-check", for: "mk" }, cb, h("span", { text: "Send me news about new sessions, play kits and offers" })), msg,
      h("p", { class: "acct-muted", text: "Off unless you turn it on. You'll still get booking confirmations and invoices, because those are about your bookings. You can change this any time" + (data.prefs && data.prefs.opted_in_at && on ? ". You agreed on " + day(data.prefs.opted_in_at) + "." : "."), })));
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Your details" }), h("p", { class: "acct-muted", text: "Signed in as " + (me.email || "") + "." }), form));
  }

  function viewAccount(p) {
    var conf = h("input", { type: "text", id: "dl", autocomplete: "off", "aria-label": "Type DELETE to confirm" });
    var err = h("p", { class: "acct-error", role: "alert" });
    var del = h("button", { class: "acct-btn danger", type: "button", text: "Delete my account", onclick: function () {
      if (conf.value.trim() !== "DELETE") { err.textContent = "Please type DELETE to confirm."; return; }
      del.disabled = true;
      api.deleteAccount().then(function () { saveSession(null); signIn(); root.insertBefore(h("p", { class: "acct-ok", text: "Your account and details have been deleted." }), root.firstChild); }, function (x) { err.textContent = x.message; del.disabled = false; });
    } });
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Sign out" }), h("p", { class: "acct-muted", text: "On a shared computer, always sign out." }),
      h("button", { class: "acct-btn", type: "button", text: "Sign out", onclick: function () { api.signOut().then(function () { tab = "sessions"; signIn(); }); } })));
    p.appendChild(h("section", { class: "acct-card" }, h("h3", { text: "Delete my account" }),
      h("p", { text: "This permanently removes your sign-in, children, session history, activity notes and preferences. Invoices are kept as business records (we're required to keep them) but are no longer linked to you." }),
      h("label", { class: "acct-form", for: "dl" }, "Type DELETE to confirm", conf), del, err));
  }

  function refresh() { api.load().then(function (d) { data = d; me = d.family; dashboard(); }, function () { start(); }); }

  session = loadSession();
  if (session) start(); else signIn();
})();
