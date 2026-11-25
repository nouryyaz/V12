/**
 * Mateology Play Society: admin portal backend
 *
 * Every function here is behind a password. The admin page (admin.html) signs in with the
 * password you put in Project Settings, then uses a short-lived token for everything else.
 * Nothing in here needs editing.
 */

const ADMIN_TOKEN_SECONDS = 6 * 60 * 60;   // stay signed in for 6 hours
const ADMIN_MAX_FAILS = 5;                 // wrong passwords allowed per 10 minutes
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function adminRoute_(b) {
  try {
    const action = String(b.action);
    if (action === "adminLogin") return adminLogin_(b);
    const guard = requireAdmin_(b);
    if (guard) return guard;
    switch (action) {
      case "adminLogout": CacheService.getScriptCache().remove("adm:" + b.token); return { ok: true };
      case "adminOverview": return adminOverview_();
      case "adminSessions": return { ok: true, sessions: adminListSessions_() };
      case "adminSaveSession": return adminSaveSession_(b);
      case "adminDeleteSession": return adminDeleteSession_(b);
      case "adminBookings": return adminBookings_(b);
      case "adminUpdateBooking": return adminUpdateBooking_(b);
      case "adminProducts": return { ok: true, managed: isProductsManaged_() || hasProductsDraft_(), products: readProductsForEdit_() };
      case "adminSaveProducts": return adminSaveProducts_(b);
      case "adminSettings": return { ok: true, settings: readSettingsForEdit_() };
      case "adminDraftStatus": return { ok: true, status: draftStatus_() };
      case "adminPublish": return publishDraft_();
      case "adminDiscardDraft": return discardDraft_();
      case "adminUndoPublish": return undoPublish_();
      case "adminPreviewLink": return adminPreviewLink_();
      case "adminSaveSettings": return adminSaveSettings_(b);
      case "adminUpload": return adminUpload_(b);
      case "adminChangePassword": return adminChangePassword_(b);
      default: return { ok: false, error: "Unknown request." };
    }
  } catch (err) {
    console.error("admin failed: " + err);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}

/* ---------- Sign in ---------- */

function sameText_(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function adminLogin_(b) {
  const cache = CacheService.getScriptCache();
  const stored = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!stored || stored.length < 10) {
    return { ok: false, error: "The admin password has not been set up yet. See the setup guide." };
  }
  const fails = parseInt(cache.get("admfail") || "0", 10);
  if (fails >= ADMIN_MAX_FAILS) {
    return { ok: false, error: "Too many wrong passwords. Please wait 10 minutes and try again." };
  }
  if (!sameText_(b.password || "", stored)) {
    cache.put("admfail", String(fails + 1), 600);
    return { ok: false, error: "That password is not right." };
  }
  cache.remove("admfail");
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  cache.put("adm:" + token, "1", ADMIN_TOKEN_SECONDS);
  return { ok: true, token: token, expiresInSeconds: ADMIN_TOKEN_SECONDS, businessName: CONFIG.BUSINESS_NAME };
}

function requireAdmin_(b) {
  const t = String(b.token || "");
  if (t.length < 32 || !CacheService.getScriptCache().get("adm:" + t)) {
    return { ok: false, error: "Please sign in again.", needsLogin: true };
  }
  return null;
}

function adminChangePassword_(b) {
  const props = PropertiesService.getScriptProperties();
  if (!sameText_(b.current || "", props.getProperty("ADMIN_PASSWORD") || "")) {
    return { ok: false, error: "Your current password is not right." };
  }
  const next = String(b.next || "");
  if (next.length < 10) return { ok: false, error: "Please choose a password with at least 10 characters." };
  props.setProperty("ADMIN_PASSWORD", next);
  return { ok: true };
}

/* ---------- Sessions ---------- */

function findEventByKey_(key) {
  const ts = parseInt(String(key).split("|")[1], 10);
  if (!ts) return null;
  const id = String(key).split("|")[0];
  const found = getCalendar_().getEvents(new Date(ts - 1000), new Date(ts + 61000))
    .filter(function (ev) { return ev.getId() === id; });
  return found[0] || null;
}

function adminSession_(ev, bookedMap) {
  const tz = CONFIG.TIMEZONE;
  const d = parseDescription_(ev.getDescription());
  const key = sessionKey_(ev);
  const title = ev.getTitle() || "";
  const potential = d.status === "potential" || /\b(tbc|potential|pencilled)\b/i.test(title);
  return {
    id: ev.getId(), key: key, title: title,
    date: Utilities.formatDate(ev.getStartTime(), tz, "yyyy-MM-dd"),
    start: Utilities.formatDate(ev.getStartTime(), tz, "HH:mm"),
    end: Utilities.formatDate(ev.getEndTime(), tz, "HH:mm"),
    venue: ev.getLocation() || "", capacity: d.capacity || CONFIG.DEFAULT_CAPACITY,
    booked: bookedMap[key] || 0, price: d.price, ages: d.ages, pay: d.pay,
    status: potential ? "potential" : "confirmed", about: d.about,
    past: ev.getEndTime().getTime() < Date.now()
  };
}

function adminListSessions_() {
  const now = Date.now();
  const events = getCalendar_().getEvents(new Date(now - 30 * 86400000), new Date(now + 365 * 86400000));
  const booked = countBooked_(readRows_(getSheet_()));
  return events
    .sort(function (a, b) { return a.getStartTime() - b.getStartTime(); })
    .map(function (ev) { return adminSession_(ev, booked); });
}

function adminOverview_() {
  const sessions = adminListSessions_();
  const upcoming = sessions.filter(function (s) { return !s.past; });
  const rows = readRows_(getSheet_()).filter(function (r) { return String(r[COL.STATUS]).toLowerCase().trim() !== "cancelled"; });
  const week = Date.now() - 7 * 86400000;
  return {
    ok: true,
    stats: {
      upcomingSessions: upcoming.length,
      childrenBooked: upcoming.reduce(function (n, s) { return n + s.booked; }, 0),
      spotsLeft: upcoming.filter(function (s) { return s.status === "confirmed"; })
        .reduce(function (n, s) { return n + Math.max(0, s.capacity - s.booked); }, 0),
      bookingsThisWeek: rows.filter(function (r) { return new Date(r[COL.BOOKED_AT]).getTime() >= week; }).length,
      products: readProductsForEdit_().length
    },
    nextSessions: upcoming.slice(0, 5)
  };
}

/** Returns { ok, data } with every field checked, or { ok:false, error }. */
function validateSession_(s) {
  s = s || {};
  const title = cleanText_(s.title, 80);
  if (!title) return { ok: false, error: "Please give the session a title." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.date))) return { ok: false, error: "Please pick a date." };
  if (!/^\d{2}:\d{2}$/.test(String(s.start)) || !/^\d{2}:\d{2}$/.test(String(s.end))) {
    return { ok: false, error: "Please set a start and end time." };
  }
  if (String(s.end) <= String(s.start)) return { ok: false, error: "The end time must be after the start time." };
  const capacity = parseInt(s.capacity, 10);
  if (!(capacity >= 1 && capacity <= 500)) return { ok: false, error: "The number of children must be between 1 and 500." };
  const pay = cleanText_(s.pay, 300);
  if (pay && !/^https:\/\/[^\s"'<>]+$/.test(pay)) return { ok: false, error: "The payment link must start with https://" };
  let about = cleanText_(s.about, 300);
  if (/^(capacity|price|ages|pay|status|booked)\s*[:=]/i.test(about)) about = "Note: " + about;
  const status = s.status === "potential" ? "potential" : "confirmed";
  let finalTitle = title;
  if (status === "confirmed") finalTitle = cleanText_(title.replace(/\b(tbc|potential|pencilled)\b/gi, ""), 80) || title;
  else if (!/\b(tbc|potential|pencilled)\b/i.test(title)) finalTitle = cleanText_(title, 80);
  return {
    ok: true,
    data: {
      title: finalTitle, date: String(s.date), start: String(s.start), end: String(s.end),
      venue: cleanText_(s.venue, 120), capacity: capacity, price: cleanText_(s.price, 40),
      ages: cleanText_(s.ages, 40), pay: pay, about: about, status: status
    }
  };
}

function buildDescription_(d, booked) {
  const lines = ["capacity: " + d.capacity];
  if (d.price) lines.push("price: " + d.price);
  if (d.ages) lines.push("ages: " + d.ages);
  if (d.pay) lines.push("pay: " + d.pay);
  if (d.status === "potential") lines.push("status: potential");
  if (d.about) lines.push(d.about);
  if (booked != null) lines.push("Booked: " + booked + " of " + d.capacity);
  return lines.join("\n");
}

function parseWhen_(date, time) {
  return Utilities.parseDate(date + " " + time, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
}

function adminSaveSession_(b) {
  const v = validateSession_(b.session);
  if (!v.ok) return v;
  const d = v.data;
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const start = parseWhen_(d.date, d.start);
    const end = parseWhen_(d.date, d.end);
    const sheet = getSheet_();
    const rows = readRows_(sheet);
    const bookedMap = countBooked_(rows);

    if (!b.session.key) {   // create (optionally repeating weekly)
      if (start.getTime() <= Date.now()) return { ok: false, error: "Please pick a date and time in the future." };
      const weeks = Math.min(26, Math.max(1, parseInt(b.repeatWeeks, 10) || 1));
      const cal = getCalendar_();
      let created = 0;
      for (let i = 0; i < weeks; i++) {
        const s2 = new Date(start.getTime() + i * 7 * 86400000);
        const e2 = new Date(end.getTime() + i * 7 * 86400000);
        cal.createEvent(d.title, s2, e2, { location: d.venue, description: buildDescription_(d, 0) });
        created++;
      }
      cache.remove("sessions");
      return { ok: true, created: created, sessions: adminListSessions_() };
    }

    const ev = findEventByKey_(b.session.key);
    if (!ev) return { ok: false, error: "That session could not be found. It may have been deleted." };
    const oldKey = sessionKey_(ev);
    const booked = bookedMap[oldKey] || 0;
    if (d.capacity < booked) {
      return { ok: false, error: booked + " children are already booked. Set the limit to at least " + booked + ", or cancel some bookings first." };
    }
    const before = adminSession_(ev, bookedMap);
    ev.setTitle(d.title);
    ev.setTime(start, end);
    ev.setLocation(d.venue);
    ev.setDescription(buildDescription_(d, booked));
    const newKey = sessionKey_(ev);
    if (newKey !== oldKey && rows.length) {   // the session moved, so bookings must follow it
      let changed = false;
      rows.forEach(function (r) {
        if (String(r[COL.KEY]) === oldKey) {
          r[COL.KEY] = newKey; r[COL.DATE] = d.date; r[COL.TITLE] = cell_(d.title); r[COL.VENUE] = cell_(d.venue);
          changed = true;
        }
      });
      if (changed) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }
    cache.remove("sessions");
    let notified = 0;
    const movedOrVenue = before.date !== d.date || before.start !== d.start || before.end !== d.end || before.venue !== d.venue;
    if (b.notify === true && movedOrVenue && booked > 0) {
      notified = notifyBooked_(newKey, "Update to your " + d.title + " booking",
        "The details for your booking have changed.\n\nSession: " + d.title + "\nDate: " + d.date +
        "\nTime: " + d.start + " to " + d.end + "\nVenue: " + (d.venue || "to be confirmed") +
        "\n\nIf this no longer suits you, just reply to this email.\n\n" + CONFIG.BUSINESS_NAME);
    }
    return { ok: true, notified: notified, sessions: adminListSessions_() };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function adminDeleteSession_(b) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ev = findEventByKey_(b.key);
    if (!ev) return { ok: false, error: "That session could not be found." };
    const key = sessionKey_(ev);
    const sheet = getSheet_();
    const rows = readRows_(sheet);
    const booked = countBooked_(rows)[key] || 0;
    if (booked > 0 && b.confirm !== true) {
      return { ok: false, needsConfirm: true, booked: booked,
               error: booked + " children are booked into this session. Confirm to cancel it and all of those bookings." };
    }
    const title = ev.getTitle(), when = Utilities.formatDate(ev.getStartTime(), CONFIG.TIMEZONE, "EEEE d MMMM yyyy");
    let notified = 0;
    if (booked > 0) {
      if (b.notify === true) {
        notified = notifyBooked_(key, "Cancelled: " + title + ", " + when,
          "We're sorry, but this session has been cancelled.\n\nSession: " + title + "\nDate: " + when +
          "\n\nPlease reply to this email if you have any questions.\n\n" + CONFIG.BUSINESS_NAME);
      }
      rows.forEach(function (r) { if (String(r[COL.KEY]) === key) r[COL.STATUS] = "cancelled"; });
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }
    ev.deleteEvent();
    CacheService.getScriptCache().remove("sessions");
    return { ok: true, notified: notified, sessions: adminListSessions_() };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** Emails each family with a confirmed booking for the session once. Returns how many were sent. */
function notifyBooked_(key, subject, body) {
  const emails = {};
  readRows_(getSheet_()).forEach(function (r) {
    if (String(r[COL.KEY]) === key && String(r[COL.STATUS]).toLowerCase().trim() !== "cancelled") {
      emails[String(r[COL.EMAIL]).toLowerCase()] = String(r[COL.NAME]);
    }
  });
  const list = Object.keys(emails);
  if (list.length > MailApp.getRemainingDailyQuota()) return 0;
  let sent = 0;
  list.forEach(function (email) {
    try {
      MailApp.sendEmail({ to: email, subject: subject, body: "Hi " + emails[email] + ",\n\n" + body,
                          name: CONFIG.BUSINESS_NAME, replyTo: CONFIG.OWNER_EMAIL });
      sent++;
    } catch (err) { console.error("Notice email failed: " + err); }
  });
  return sent;
}

/* ---------- Bookings ---------- */

function bookingFromRow_(r) {
  return {
    ref: String(r[COL.REF]), bookedAt: new Date(r[COL.BOOKED_AT]).toISOString(), key: String(r[COL.KEY]),
    date: String(r[COL.DATE]), title: String(r[COL.TITLE]), venue: String(r[COL.VENUE]),
    name: String(r[COL.NAME]), email: String(r[COL.EMAIL]), phone: String(r[COL.PHONE]),
    children: Number(r[COL.CHILDREN]) || 0, childDetails: String(r[COL.CHILD_DETAILS]),
    notes: String(r[COL.NOTES]),
    status: String(r[COL.STATUS]).toLowerCase().trim() === "cancelled" ? "cancelled" : "confirmed"
  };
}

function adminBookings_(b) {
  let list = readRows_(getSheet_()).map(bookingFromRow_);
  if (b.key) list = list.filter(function (x) { return x.key === String(b.key); });
  list.sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : (x.bookedAt < y.bookedAt ? 1 : -1); });
  return { ok: true, bookings: list.slice(0, 1000) };
}

function adminUpdateBooking_(b) {
  const status = b.status === "cancelled" ? "cancelled" : "confirmed";
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheet_();
    const rows = readRows_(sheet);
    const idx = rows.findIndex(function (r) { return String(r[COL.REF]) === String(b.ref); });
    if (idx < 0) return { ok: false, error: "That booking could not be found." };
    const row = rows[idx];
    if (status === "confirmed" && String(row[COL.STATUS]).toLowerCase().trim() === "cancelled") {
      const ev = findEventByKey_(String(row[COL.KEY]));
      if (ev) {
        const info = adminSession_(ev, countBooked_(rows));
        if (info.booked + Number(row[COL.CHILDREN]) > info.capacity) {
          return { ok: false, error: "There is not enough room left in that session to restore this booking." };
        }
      }
    }
    sheet.getRange(idx + 2, COL.STATUS + 1).setValue(status);
    row[COL.STATUS] = status;
    const key = String(row[COL.KEY]);
    const ev2 = findEventByKey_(key);
    if (ev2) {
      const d = parseDescription_(ev2.getDescription());
      updateBookedLine_(ev2, countBooked_(rows)[key] || 0, d.capacity || CONFIG.DEFAULT_CAPACITY);
    }
    CacheService.getScriptCache().remove("sessions");
    let notified = 0;
    if (b.notify === true && status === "cancelled") {
      try {
        MailApp.sendEmail({
          to: String(row[COL.EMAIL]), subject: "Your booking has been cancelled: " + String(row[COL.TITLE]),
          body: "Hi " + String(row[COL.NAME]) + ",\n\nYour booking (" + String(row[COL.REF]) + ") for " +
                String(row[COL.TITLE]) + " on " + String(row[COL.DATE]) + " has been cancelled.\n\n" +
                "Please reply to this email if you have any questions.\n\n" + CONFIG.BUSINESS_NAME,
          name: CONFIG.BUSINESS_NAME, replyTo: CONFIG.OWNER_EMAIL
        });
        notified = 1;
      } catch (err) { console.error("Cancel email failed: " + err); }
    }
    return { ok: true, notified: notified, booking: bookingFromRow_(row) };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ---------- Products and theme ---------- */

function adminSaveProducts_(b) {
  const v = validateProducts_(b.products);
  if (!v.ok) return v;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    saveProductsDraft_(v.products);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
  return { ok: true, products: v.products, status: draftStatus_() };
}

function adminSaveSettings_(b) {
  const v = sanitizeSettings_(b.settings);
  if (!v.ok) return v;
  saveSettingsDraft_(v.settings);
  return { ok: true, settings: v.settings, status: draftStatus_() };
}

/** A short-lived key that lets the website show the draft. It cannot change anything. */
function adminPreviewLink_() {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put("prv:" + token, "1", 1800);
  return { ok: true, token: token, expiresInSeconds: 1800 };
}

/* ---------- Image upload (product photos) ---------- */

function adminUpload_(b) {
  const mime = String(b.mime || "");
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { ok: false, error: "Please choose a JPG, PNG or WebP photo." };
  const data = String(b.data || "");
  if (!data || data.length > MAX_IMAGE_BYTES * 1.4) return { ok: false, error: "That photo is too large. Please choose one under 3 MB." };
  const bytes = Utilities.base64Decode(data);
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "That photo is too large. Please choose one under 3 MB." };
  const u = function (i) { return (bytes[i] + 256) % 256; };
  const isJpeg = u(0) === 0xff && u(1) === 0xd8 && u(2) === 0xff;
  const isPng = u(0) === 0x89 && u(1) === 0x50 && u(2) === 0x4e && u(3) === 0x47;
  const isWebp = u(0) === 0x52 && u(1) === 0x49 && u(8) === 0x57 && u(9) === 0x45;
  if (!(isJpeg || isPng || isWebp)) return { ok: false, error: "That file does not look like a real photo." };
  const name = cleanText_(b.name, 60).replace(/[^A-Za-z0-9._\- ]/g, "") || "photo";
  const folders = DriveApp.getFoldersByName("Mateology site images");
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Mateology site images");
  const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000" };
}
