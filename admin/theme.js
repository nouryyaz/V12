/* Theme: colours, the scrolling background, effects, wording and the announcement banner. */
(function () {
  var A = window.Admin, h = A.h;
  var NAMES = { orange: "Main (buttons, menu)", pink: "Pink", sun: "Sunshine", lime: "Leaf green", teal: "Olive", sky: "Sky blue", purple: "Purple", ink: "Text", cream: "Page background" };
  var KEYS = Object.keys(NAMES);
  var EFFECTS = { balloons: "Floating balloons", clouds: "Drifting clouds", cubes: "3D letter blocks", cursor: "Bubble cursor", pop: "Pop-out on hover", scrollColours: "Background colours shift as you scroll" };
  var TEXTS = [
    ["heroEyebrow", "Small line above the headline", 60], ["heroWord1", "Headline word 1", 16], ["heroWord2", "Headline word 2", 16], ["heroWord3", "Headline word 3", 16],
    ["heroLead", "Intro under the headline", 200], ["finaleLead", "Closing line (bottom of home page)", 160], ["footerTagline", "Footer line", 80]];
  var DEFAULTS = {
    preset: "mateology",
    colors: { orange: "#f75a2a", pink: "#fc8980", sun: "#fcb50a", lime: "#a3b66a", teal: "#899753", sky: "#6b94b9", purple: "#c47ab5", ink: "#5a3620", cream: "#fbf1e0" },
    scroll: ["#f8ab87", "#fcd36a", "#b9c98e", "#97b9db", "#d8a6dd", "#fcc9bf"],
    effects: { balloons: true, clouds: true, cubes: true, cursor: true, pop: true, scrollColours: true },
    text: { heroEyebrow: "", heroWord1: "", heroWord2: "", heroWord3: "", heroLead: "", finaleLead: "", footerTagline: "" },
    announcement: { enabled: false, text: "", link: "", linkLabel: "" }
  };
  var PRESETS = {
    mateology: { label: "Mateology (logo)", colors: DEFAULTS.colors, scroll: DEFAULTS.scroll },
    ocean: { label: "Ocean", colors: { orange: "#1f8fb8", pink: "#7fd1d9", sun: "#ffc857", lime: "#7cc6a4", teal: "#2f7f86", sky: "#4a8fe0", purple: "#8f7ae0", ink: "#1f3a4d", cream: "#eef8fb" }, scroll: ["#a9dbe8", "#ffe29a", "#b5e3cc", "#9ec3f2", "#c9bdf2", "#bfe9ef"] },
    berry: { label: "Berry", colors: { orange: "#d63a76", pink: "#f58fb0", sun: "#ffb84d", lime: "#9bc27a", teal: "#7f9a52", sky: "#7a8fe0", purple: "#a24fc4", ink: "#4a2340", cream: "#fff0f5" }, scroll: ["#f7a8c4", "#ffd29a", "#d4e3a8", "#b3bdf2", "#dcaaf0", "#ffc4d6"] },
    meadow: { label: "Meadow", colors: { orange: "#e8742a", pink: "#f29a8a", sun: "#f5c542", lime: "#7fb069", teal: "#4f8a5b", sky: "#6fb1c8", purple: "#b58ad0", ink: "#2f4a2a", cream: "#f6f6e6" }, scroll: ["#c9e3a4", "#fbe08a", "#a6d9b0", "#a9d4e3", "#dcc4ea", "#f6d7a8"] },
    sunset: { label: "Sunset", colors: { orange: "#ef4b2b", pink: "#ff8a8a", sun: "#ffb000", lime: "#b5b94a", teal: "#9a8a3c", sky: "#7a8ecb", purple: "#b05aa8", ink: "#5a2a1e", cream: "#fff1e2" }, scroll: ["#ffb199", "#ffd68a", "#e8d38a", "#c3a9d8", "#f1a2c4", "#ffbfa6"] }
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(s) {
    var d = clone(DEFAULTS); s = s || {};
    ["colors", "effects", "text", "announcement"].forEach(function (k) { Object.assign(d[k], s[k] || {}); });
    if (Array.isArray(s.scroll) && s.scroll.length === 6) d.scroll = s.scroll.slice();
    d.preset = s.preset || "mateology";
    return d;
  }

  A.register({ id: "theme", label: "Website look", icon: "🎨", render: function (root) {
    var S = clone(DEFAULTS), dirty = false;
    var save = h("button", { class: "btn primary", type: "button", text: "Save draft", disabled: true });
    var body = h("div", {}), prev = h("div", { class: "mini" });
    function mark(v) { dirty = v; save.disabled = !v; save.textContent = v ? "Save draft" : "Draft saved"; }
    function drawPreview() {
      KEYS.forEach(function (k) { prev.style.setProperty("--" + k, S.colors[k]); });
      var sc = S.scroll;
      prev.style.setProperty("--grad", "linear-gradient(90deg," + sc.concat([sc[0]]).join(",") + ")");
      prev.style.setProperty("--a", sc[0]); prev.style.setProperty("--b", sc[5]);
      prev.querySelector(".m-eyebrow").textContent = S.text.heroEyebrow || "Sensory play sessions for kids";
      prev.querySelector(".m-words").textContent = [S.text.heroWord1 || "Messy.", S.text.heroWord2 || "Wonderful.", S.text.heroWord3 || "Play."].join(" ");
      var ann = prev.querySelector(".m-ann");
      ann.hidden = !(S.announcement.enabled && S.announcement.text);
      ann.textContent = S.announcement.text;
      prev.classList.toggle("fx-balloons", S.effects.balloons);
      prev.classList.toggle("fx-clouds", S.effects.clouds);
    }
    prev.appendChild(h("div", { class: "m-ann", hidden: true }));
    prev.appendChild(h("div", { class: "m-bar" }, h("b", { text: "Mateology" }), h("span", { class: "m-nav" }, h("i", { text: "Home" }), h("i", { text: "Sessions" }), h("i", { text: "Play Kits" }))));
    prev.appendChild(h("div", { class: "m-hero" }, h("small", { class: "m-eyebrow" }), h("div", { class: "m-words" }), h("div", { class: "m-btns" }, h("span", { class: "m-btn a", text: "Book a session" }), h("span", { class: "m-btn b", text: "Shop play kits" })),
      h("span", { class: "m-balloon" }), h("span", { class: "m-cloud" })));
    prev.appendChild(h("div", { class: "m-cards" }, h("div", { class: "m-card" }, h("b", { text: "Rainbow Rice Kit" }), h("span", { text: "$29.00" })), h("div", { class: "m-card" }, h("b", { text: "Pom-Pom Kit" }), h("span", { text: "$22.00" }))));
    prev.appendChild(h("div", { class: "m-strip", title: "How the background colours drift as people scroll" }));

    function colourInput(get, set) {
      var c = h("input", { type: "color", value: get(), "aria-label": "Pick a colour" });
      var t = h("input", { type: "text", value: get(), maxlength: 7, class: "hex", "aria-label": "Colour code" });
      c.addEventListener("input", function () { t.value = c.value; set(c.value); });
      t.addEventListener("input", function () { if (/^#[0-9a-fA-F]{6}$/.test(t.value)) { c.value = t.value.toLowerCase(); set(t.value.toLowerCase()); } });
      return h("span", { class: "colour" }, c, t);
    }
    function section(title, hint, content) { return h("section", { class: "card-box" }, h("h3", { text: title }), hint ? h("p", { class: "muted", text: hint }) : null, content); }
    function change() { S.preset = "custom"; mark(true); drawPreview(); }

    function build() {
      A.clear(body);
      var presets = h("div", { class: "presets" }, Object.keys(PRESETS).map(function (id) {
        var p = PRESETS[id];
        return h("button", { type: "button", class: "preset" + (S.preset === id ? " on" : ""), onclick: function () {
          S.colors = clone(p.colors); S.scroll = p.scroll.slice(); S.preset = id; mark(true); build(); drawPreview();
        } }, h("span", { class: "sw", style: "background:linear-gradient(90deg," + p.scroll.join(",") + ")" }), h("span", { text: p.label }));
      }));
      body.appendChild(section("Colour scheme", "Start from a ready-made look, then fine-tune below.", presets));
      body.appendChild(section("Brand colours", "Used for buttons, headings, balloons and blocks.", h("div", { class: "colour-grid" }, KEYS.map(function (k) {
        return h("div", { class: "colour-row" }, h("span", { text: NAMES[k] }), colourInput(function () { return S.colors[k]; }, function (v) { S.colors[k] = v; change(); }));
      }))));
      body.appendChild(section("Scrolling background", "These six soft colours blend into each other as visitors scroll down the home page.", h("div", { class: "colour-grid" }, S.scroll.map(function (_, i) {
        return h("div", { class: "colour-row" }, h("span", { text: "Stop " + (i + 1) }), colourInput(function () { return S.scroll[i]; }, function (v) { S.scroll[i] = v; change(); }));
      }))));
      body.appendChild(section("Fun effects", "Turn off anything you find distracting. Visitors who prefer less motion already get a calmer site.", h("div", { class: "checks" }, Object.keys(EFFECTS).map(function (k) {
        return h("label", { class: "check" }, h("input", { type: "checkbox", checked: S.effects[k], onchange: function (e) { S.effects[k] = e.target.checked; mark(true); drawPreview(); } }), h("span", { text: EFFECTS[k] }));
      }))));
      body.appendChild(section("Wording", "Leave a box empty to keep the original wording.", h("div", { class: "form-grid" }, TEXTS.map(function (t) {
        return A.field(t[1], h("input", { type: "text", value: S.text[t[0]], maxlength: t[2], oninput: function (e) { S.text[t[0]] = e.target.value; mark(true); drawPreview(); } }));
      }))));
      var a = S.announcement;
      body.appendChild(section("Announcement banner", "A bar across the top of every page. Good for holiday dates or new sessions.", h("div", { class: "form-grid" },
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: a.enabled, onchange: function (e) { a.enabled = e.target.checked; mark(true); drawPreview(); } }), h("span", { text: "Show the banner" })),
        A.field("Message", h("input", { type: "text", value: a.text, maxlength: 140, oninput: function (e) { a.text = e.target.value; mark(true); drawPreview(); } })),
        A.field("Link address (optional)", h("input", { type: "url", value: a.link, placeholder: "https://…", oninput: function (e) { a.link = e.target.value; mark(true); } })),
        A.field("Link button text", h("input", { type: "text", value: a.linkLabel, maxlength: 30, placeholder: "Find out more", oninput: function (e) { a.linkLabel = e.target.value; mark(true); } })))));
    }

    save.addEventListener("click", function () {
      A.busy(save, A.call("adminSaveSettings", { settings: S })).then(function (r) {
        if (!r.ok) { A.toast(r.error, "bad"); return; }
        S = merge(r.settings); mark(false); A.toast("Draft saved. Preview it, then publish when ready."); A.refreshDraftBar(r.status);
      });
    });
    window.onbeforeunload = function () { return dirty ? "You have unsaved changes to the website look." : undefined; };
    var reset = h("button", { class: "btn", type: "button", text: "Reset to original", onclick: function () {
      A.confirm("Reset the look?", "This puts back the original Mateology colours, effects and wording. Press Save draft to keep the change.", "Reset", true).then(function (y) {
        if (y) { S = clone(DEFAULTS); mark(true); build(); drawPreview(); }
      });
    } });
    root.appendChild(h("div", { class: "page-head" }, h("h2", { text: "Website look" }), h("div", {}, reset, save)));
    root.appendChild(h("div", { class: "theme-layout" }, body, h("div", { class: "theme-side" }, h("h3", { text: "Preview" }), prev, h("p", { class: "muted", text: "A simplified preview. The real site has all the movement." }))));
    A.call("adminSettings").then(function (r) {
      S = merge(r && r.ok ? r.settings : null); mark(false); build(); drawPreview();
    });
  } });
})();
