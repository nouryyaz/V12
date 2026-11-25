/**
 * Mateology Play Society: site content (products and theme)
 *
 * Products live in a "Products" tab of your Google Sheet. Theme settings live in the script's
 * private properties. The admin portal edits both. The public website reads them through
 * doGet (?action=site). Nothing in here needs editing.
 */

const PRODUCT_HEADERS = ["id", "name", "description", "price", "image", "stripeLink", "inStock", "visible"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const COLOUR_KEYS = ["orange", "pink", "sun", "lime", "teal", "sky", "purple", "ink", "cream"];
const EFFECT_KEYS = ["balloons", "clouds", "cubes", "cursor", "pop", "scrollColours"];
const TEXT_LIMITS = {
  heroEyebrow: 60, heroWord1: 16, heroWord2: 16, heroWord3: 16, heroLead: 200,
  finaleLead: 160, footerTagline: 80
};

/* ---------- Public: what the website loads ---------- */

function siteData_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("site");
  if (cached) return cached;
  const managed = isProductsManaged_();
  const products = managed
    ? readProducts_().filter(function (p) { return p.visible; }).map(function (p) {
        return { id: p.id, name: p.name, description: p.description, price: p.price,
                 image: p.image, stripeLink: p.stripeLink, inStock: p.inStock };
      })
    : null;   // null = never saved from the admin portal, so the site uses data/products.json
  const payload = JSON.stringify({ ok: true, products: products, settings: readSettings_(), generated: new Date().toISOString() });
  cache.put("site", payload, 60);
  return payload;
}

/* ---------- Products ---------- */

function getSpreadsheet_() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

const TAB_LIVE = "Products", TAB_DRAFT = "Products (draft)", TAB_PREV = "Products (previous)";

function getProductSheet_(name) {
  name = name || TAB_LIVE;
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(PRODUCT_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function isProductsManaged_() {
  return PropertiesService.getScriptProperties().getProperty("PRODUCTS_MANAGED") === "yes";
}

function toBool_(v) {
  return v === true || /^(true|yes|1)$/i.test(String(v).trim());
}

function readProducts_(name) {
  const sheet = getProductSheet_(name);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, PRODUCT_HEADERS.length).getValues()
    .filter(function (r) { return String(r[1]).trim() !== ""; })
    .map(function (r) {
      return {
        id: String(r[0]), name: String(r[1]), description: String(r[2]), price: String(r[3]),
        image: String(r[4]), stripeLink: String(r[5]), inStock: toBool_(r[6]), visible: toBool_(r[7])
      };
    });
}

function cleanText_(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function slug_(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";
}

/** Returns { ok, products } with every field checked, or { ok:false, error }. */
function validateProducts_(list) {
  if (!Array.isArray(list)) return { ok: false, error: "Products must be a list." };
  if (list.length > 60) return { ok: false, error: "That is more products than this shop can hold (60)." };
  const seen = {};
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i] || {};
    const name = cleanText_(p.name, 80);
    if (!name) return { ok: false, error: "Product " + (i + 1) + " needs a name." };
    const price = cleanText_(p.price, 20);
    if (!price) return { ok: false, error: "\"" + name + "\" needs a price, like $29.00." };
    const image = cleanText_(p.image, 400);
    if (image && !/^(images\/[A-Za-z0-9._\-\/]+|https:\/\/[^\s"'<>]+)$/.test(image) || /\.\./.test(image)) {
      return { ok: false, error: "\"" + name + "\" has an image address that is not allowed." };
    }
    const stripeLink = cleanText_(p.stripeLink, 400);
    if (stripeLink && !/^https:\/\/[^\s"'<>]+$/.test(stripeLink)) {
      return { ok: false, error: "\"" + name + "\" has a payment link that does not start with https://" };
    }
    let id = slug_(p.id || name);
    let n = 2;
    while (seen[id]) { id = slug_(p.id || name) + "-" + n++; }
    seen[id] = true;
    out.push({
      id: id, name: name, description: cleanText_(p.description, 300), price: price,
      image: image, stripeLink: stripeLink, inStock: p.inStock !== false, visible: p.visible !== false
    });
  }
  return { ok: true, products: out };
}

function writeProductsTo_(products, name) {
  const sheet = getProductSheet_(name);
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, PRODUCT_HEADERS.length).clearContent();
  if (products.length) {
    const rows = products.map(function (p) {
      return [p.id, cell_(p.name), cell_(p.description), cell_(p.price), p.image, p.stripeLink, p.inStock, p.visible];
    });
    sheet.getRange(2, 1, rows.length, PRODUCT_HEADERS.length).setValues(rows);
  }
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
function delProp_(k) { PropertiesService.getScriptProperties().deleteProperty(k); }

function hasProductsDraft_() { return prop_("PRODUCTS_DRAFT") === "yes"; }
function hasSettingsDraft_() { return !!prop_("SITE_SETTINGS_DRAFT"); }

/** What the admin screens edit: the draft if there is one, otherwise what is live. */
function readProductsForEdit_() { return hasProductsDraft_() ? readProducts_(TAB_DRAFT) : readProducts_(TAB_LIVE); }
function readSettingsForEdit_() { return hasSettingsDraft_() ? parseJson_(prop_("SITE_SETTINGS_DRAFT")) : readSettings_(); }

function parseJson_(raw) { try { return raw ? JSON.parse(raw) : null; } catch (err) { return null; } }

function saveProductsDraft_(products) {
  writeProductsTo_(products, TAB_DRAFT);
  setProp_("PRODUCTS_DRAFT", "yes");
}

function saveSettingsDraft_(settings) {
  setProp_("SITE_SETTINGS_DRAFT", JSON.stringify(settings));
}

/** What the website shows when someone opens a valid preview link. Never cached. */
function sitePreviewData_() {
  const products = (hasProductsDraft_() || isProductsManaged_())
    ? readProductsForEdit_().filter(function (p) { return p.visible; }).map(function (p) {
        return { id: p.id, name: p.name, description: p.description, price: p.price,
                 image: p.image, stripeLink: p.stripeLink, inStock: p.inStock };
      })
    : null;
  return JSON.stringify({ ok: true, preview: true, products: products, settings: readSettingsForEdit_(), generated: new Date().toISOString() });
}

function previewTokenValid_(tok) {
  return !!tok && /^[0-9a-f-]{60,80}$/.test(String(tok)) && CacheService.getScriptCache().get("prv:" + tok) === "1";
}

/* ---------- Draft, publish, undo ---------- */

function productKey_(p) { return JSON.stringify([p.name, p.description, p.price, p.image, p.stripeLink, p.inStock, p.visible]); }

/** Plain-language list of what publishing would change. */
function describeChanges_() {
  const lines = [];
  if (hasProductsDraft_()) {
    const draft = readProducts_(TAB_DRAFT);
    const live = isProductsManaged_() ? readProducts_(TAB_LIVE) : null;
    if (live === null) lines.push("Products: your product list moves into the portal (" + draft.length + " products)");
    else {
      const liveById = {}, draftById = {};
      live.forEach(function (p) { liveById[p.id] = p; });
      draft.forEach(function (p) { draftById[p.id] = p; });
      draft.forEach(function (p) {
        if (!liveById[p.id]) lines.push("Product added: " + p.name);
        else if (productKey_(liveById[p.id]) !== productKey_(p)) lines.push("Product changed: " + p.name);
      });
      live.forEach(function (p) { if (!draftById[p.id]) lines.push("Product removed: " + p.name); });
      const order = function (l) { return l.map(function (p) { return p.id; }).filter(function (id) { return liveById[id] && draftById[id]; }).join(","); };
      if (order(live) !== order(draft) && !lines.length) lines.push("Product order changed");
    }
  }
  if (hasSettingsDraft_()) {
    const d = parseJson_(prop_("SITE_SETTINGS_DRAFT")), l = readSettings_() || {};
    const diff = function (a, b) { return JSON.stringify(a || null) !== JSON.stringify(b || null); };
    if (diff(d.colors, l.colors)) lines.push("Brand colours changed");
    if (diff(d.scroll, l.scroll)) lines.push("Scrolling background colours changed");
    if (diff(d.effects, l.effects)) lines.push("Fun effects changed");
    if (diff(d.text, l.text)) lines.push("Website wording changed");
    if (diff(d.announcement, l.announcement)) lines.push("Announcement banner changed");
    if (!lines.length || (!diff(d.colors, l.colors) && !diff(d.scroll, l.scroll) && !diff(d.effects, l.effects) && !diff(d.text, l.text) && !diff(d.announcement, l.announcement))) {
      if (!hasProductsDraft_()) lines.push("Website look: no visible difference");
    }
  }
  return lines;
}

function draftStatus_() {
  return { productsDraft: hasProductsDraft_(), settingsDraft: hasSettingsDraft_(), hasDraft: hasProductsDraft_() || hasSettingsDraft_(),
           canUndo: prop_("CAN_UNDO") === "yes", changes: describeChanges_() };
}

function publishDraft_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!hasProductsDraft_() && !hasSettingsDraft_()) return { ok: false, error: "There is nothing to publish." };
    const cache = CacheService.getScriptCache();
    // Keep the current live version so it can be put back.
    delProp_("PREV_PRODUCTS"); delProp_("PREV_SETTINGS"); delProp_("PREV_MANAGED");
    if (hasProductsDraft_()) {
      writeProductsTo_(readProducts_(TAB_LIVE), TAB_PREV);
      setProp_("PREV_PRODUCTS", "yes");
      setProp_("PREV_MANAGED", isProductsManaged_() ? "yes" : "no");
      writeProductsTo_(readProducts_(TAB_DRAFT), TAB_LIVE);
      setProp_("PRODUCTS_MANAGED", "yes");
      delProp_("PRODUCTS_DRAFT");
    }
    if (hasSettingsDraft_()) {
      setProp_("PREV_SETTINGS", prop_("SITE_SETTINGS") || "none");
      setProp_("SITE_SETTINGS", prop_("SITE_SETTINGS_DRAFT"));
      delProp_("SITE_SETTINGS_DRAFT");
    }
    setProp_("CAN_UNDO", "yes");
    cache.remove("site");
    return { ok: true, status: draftStatus_() };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function discardDraft_() {
  delProp_("PRODUCTS_DRAFT"); delProp_("SITE_SETTINGS_DRAFT");
  return { ok: true, status: draftStatus_() };
}

function undoPublish_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (prop_("CAN_UNDO") !== "yes") return { ok: false, error: "There is nothing to undo." };
    if (prop_("PREV_PRODUCTS") === "yes") {
      writeProductsTo_(readProducts_(TAB_PREV), TAB_LIVE);
      setProp_("PRODUCTS_MANAGED", prop_("PREV_MANAGED") === "yes" ? "yes" : "no");
    }
    const ps = prop_("PREV_SETTINGS");
    if (ps) { if (ps === "none") delProp_("SITE_SETTINGS"); else setProp_("SITE_SETTINGS", ps); }
    delProp_("PREV_PRODUCTS"); delProp_("PREV_SETTINGS"); delProp_("PREV_MANAGED"); delProp_("CAN_UNDO");
    CacheService.getScriptCache().remove("site");
    return { ok: true, status: draftStatus_() };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ---------- Theme and site settings ---------- */

function readSettings_() {
  const raw = PropertiesService.getScriptProperties().getProperty("SITE_SETTINGS");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

/** Keeps only known settings, each checked. Anything unexpected is dropped. */
function sanitizeSettings_(s) {
  s = s || {};
  const out = { preset: cleanText_(s.preset, 30), colors: {}, scroll: [], effects: {}, text: {}, announcement: {} };
  const colors = s.colors || {};
  for (let i = 0; i < COLOUR_KEYS.length; i++) {
    const k = COLOUR_KEYS[i];
    if (!HEX_RE.test(String(colors[k] || ""))) return { ok: false, error: "The colour for \"" + k + "\" is not a valid colour." };
    out.colors[k] = String(colors[k]).toLowerCase();
  }
  const scroll = Array.isArray(s.scroll) ? s.scroll : [];
  if (scroll.length !== 6 || !scroll.every(function (c) { return HEX_RE.test(String(c)); })) {
    return { ok: false, error: "The scrolling background needs exactly 6 valid colours." };
  }
  out.scroll = scroll.map(function (c) { return String(c).toLowerCase(); });
  const fx = s.effects || {};
  EFFECT_KEYS.forEach(function (k) { out.effects[k] = fx[k] !== false; });
  const text = s.text || {};
  Object.keys(TEXT_LIMITS).forEach(function (k) { out.text[k] = cleanText_(text[k], TEXT_LIMITS[k]); });
  const a = s.announcement || {};
  const link = cleanText_(a.link, 300);
  if (link && !/^https:\/\/[^\s"'<>]+$/.test(link)) return { ok: false, error: "The announcement link must start with https://" };
  out.announcement = {
    enabled: a.enabled === true, text: cleanText_(a.text, 140), link: link, linkLabel: cleanText_(a.linkLabel, 30)
  };
  return { ok: true, settings: out };
}


