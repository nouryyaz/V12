# Your admin portal

Open `admin.html` on your website (for example `https://yourname.github.io/yoursite/admin.html`). It is not linked anywhere on the site and search engines are told to ignore it. Bookmark it.

**Before the Google booking address is in `config.js`,** the portal runs in **demo mode**: type any password and look around. Changes are kept in your browser only, and show on the public pages if you open them in the same browser. Once `config.js` has your address (see SETUP-GOOGLE-BOOKING.md), everything becomes live.

## Nothing goes live until you publish
Changes to **Products** and **Website look** are saved as a **draft**. Visitors keep seeing the live site. A yellow bar at the top of the admin shows when you have unpublished changes:
- **Preview draft** opens your real website with the draft products, colours, wording and banner, marked with a "Draft preview" ribbon. Only you can see it (the link is private, expires after 30 minutes, and can't change anything). **Exit preview** in the ribbon goes back to the live view.
- **Review and publish** lists what will change in plain words, then pushes it live (the website updates within a minute).
- **Discard draft** throws the draft away.
- **Undo last publish** puts the previous live version back.

Sessions and bookings are different: they involve real families, so they save straight away. Use **Not confirmed yet** on a session to keep it from being booked until you are ready.

## What you can do

**Dashboard.** Upcoming sessions, children booked, spots open, bookings this week.

**Sessions.**
- *How many children:* every session has its own limit. Change it any time. It can't be set lower than the number already booked.
- *Pricing:* each session has its own price text, ages, venue and optional Stripe payment link, so a holiday workshop can cost more than a regular session.
- *Repeat weekly:* when creating, choose how many weeks to repeat (up to 26).
- *Not confirmed yet:* shows on the calendar but can't be booked.
- *Moving or deleting:* bookings follow a moved session. You can tick a box to email the families. Deleting a session with bookings asks first and can cancel and email everyone.

**Bookings.** See who is coming, filter by session, search, cancel or restore a booking (with an optional email to the parent), and download everything as a spreadsheet (CSV).

**Products.** Add, edit, remove, hide, mark as sold out, and move products up and down. Add a Stripe Payment Link for each. Choose a photo from your library, upload one (it is shrunk automatically and stored in your Google Drive), or paste an address. Press **Save draft**, preview, then publish.

**Website look.** Pick a colour scheme or set every colour yourself, set the six colours of the scrolling background, switch effects on or off (balloons, clouds, letter blocks, bubble cursor, pop-out, colour shift), change the headline and footer wording, and add an announcement banner. A small preview updates as you go. **Save draft** when happy, or **Reset to original**.

**Account.** Change your password.

## Safety
- The password lives in your Google script settings, never in the website files.
- Five wrong passwords in 10 minutes locks sign-in for 10 minutes.
- You are signed out after 6 hours or when you press Sign out.
- Everything you type is checked on the server before it is saved.

## Adding new admin screens later
Each screen is its own file in `admin/`. To add one, create `admin/yourthing.js` that calls `Admin.register({ id, label, icon, render })` and add one `<script>` line in `admin.html`. The same goes for the server: new actions are added in `google-apps-script/Admin.gs`.

## Updating
After changing any of the three `.gs` files in Apps Script: **Deploy**, **Manage deployments**, pencil icon, **New version**, **Deploy**. The web address stays the same.

## Good to know
- Products you have not yet saved from the portal still come from `data/products.json`. The first time you publish, they move into the **Products** tab of your Google Sheet and the portal takes over.
- Uploaded photos are set to "anyone with the link can view" in a Drive folder called *Mateology site images*, so the public site can show them.
- Customer accounts and saved orders are still to come.
