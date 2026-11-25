# Mateology Play Society Website

Static website for sensory play sessions and play kits, with a booking calendar that syncs with Google Calendar.

## How bookings work
- You add sessions in a Google Calendar. The Sessions page reads it.
- Parents book on the Sessions page. Bookings are saved to a Google Sheet, emailed to the parent and to you, and counted against the session's capacity.
- Setup guide: SETUP-GOOGLE-BOOKING.md (about 20 minutes, one time).
- Until setup is done, the Sessions page shows a preview from data/sessions.json with booking switched off.

## Files
- index.html, sessions.html, shop.html: the pages
- style.css: all styling
- booking.js: the calendar and booking form on the Sessions page
- config.js: where you paste your Google web app URL
- app.js: builds the shop from data/products.json
- google-apps-script/Code.gs: the Google script to paste into your Google Sheet
- data/products.json: shop products. Paste in your Stripe Payment Links.
- data/sessions.json: preview sessions, used only until Google booking is connected
- images/: photos, with sources and licence notes in CREDITS.txt

## Admin portal (v10)
- `admin.html` is your private control panel: sessions (own limit and price per session), bookings, products, website look, password. See SETUP-ADMIN.md.
- `admin/*.js`: one file per screen, so new screens can be added without touching the others. `admin/demo-api.js` is the pretend server used until Google is connected.
- Draft and publish: admin changes to products and the look are saved as a draft, previewed with `?preview=KEY`, then published (with undo). See SETUP-ADMIN.md.
- `site.js`: loads on every page and applies the theme, wording, banner and products you saved in the admin portal. Falls back to the built-in look and data/products.json.
- `google-apps-script/Site.gs` and `Admin.gs`: the server side. Paste all three .gs files into Apps Script.

## Updating products
Use the admin portal (Products). data/products.json is only the starting list.

## Hosting
GitHub Pages: Settings, Pages, main branch, root folder.

## Parent accounts (v12)
- `account.html`, `account.js`, `account.css`: parents sign in with an emailed code and see sessions, activity, invoices, children and email preferences. Demo mode runs while `SUPABASE_URL` in `config.js` is empty.
- `supabase/schema.sql`: the database tables and the security rules. `SETUP-PARENT-ACCOUNTS.md` is the guide.
- `.github/workflows/keepalive.yml`: keeps the free Supabase project awake.

## Coming next
Admin tools to add activity notes and invoices to families, and to copy bookings into family history.

## Animation and 3D layer (v3)

- `fun.css` and `motion.js` add the floating balloons and clouds, the tumbling 3D letter blocks on the home page, the pop-out hover on cards, buttons and photos, and the scroll pop-in.
- Each page links `fun.css` after `style.css` and loads `motion.js` last. To remove all the fun, delete those two lines from each page.
- Everything is drawn in code, so there are no extra images. People who have "reduce motion" switched on get a calm, still version.

## Scroll-through story (v4)

- `index.html` is now a scrolling story: hero, a pinned "Touch / Pour / Squish" chapter, sliding words, a trail that draws itself, kits that slide sideways, and a finale.
- `story.css` and `story.js` add that, plus the floating menu, the paint progress bar and the bubble cursor. They are linked on every page.
- The kits on the home page come from `data/products.json`, so editing a product there updates the shop and the story.
- Phones get a simpler version: the kits become a swipeable row. People with "reduce motion" switched on get no moving bubbles, cursor or drifting words.

## Glass look (v5)

- `glass.css` gives every page frosted, see-through surfaces (menu, cards, calendar, booking form, buttons, footer, 3D blocks) over soft colour glows. It is linked last on every page.
- To go back to the solid look, remove the `glass.css` line from the three pages.
- Older browsers without frosted-glass support automatically get a calmer, more solid version.

## Mateology Play Society (v8)

- The site is branded Mateology Play Society. The logo is `images/logo.png` (transparent) and `images/icon.png` (browser tab and phone icon). The logo sits in the menu, the finale and the footer on every page.
- The organisation name used in emails and the booking form is set in `google-apps-script/Code.gs` (`BUSINESS_NAME`).

## New colour scheme and scroll colours (v9)

- The colours now come from the logo: orange `#f75a2a`, yellow `#fcb50a`, olive `#899753`, blue `#6b94b9`, coral `#fc8980`, lilac `#c47ab5`, brown `#5a3620` and cream `#fbf1e0`. They are set at the top of `theme.css`.
- The soft background colours drift as you scroll, from peach to yellow, olive, blue and lilac, finishing in warm brown. The colour stops are listed at the top of `story.js` (`STOPS`).
- `theme.css` is linked last on every page. The logo is `images/logo.jpg`.
