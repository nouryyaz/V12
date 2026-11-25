# Parent accounts: set-up guide (about 25 minutes, one time)

Parents sign in with a code emailed to them (no passwords), then see their sessions, what their children explored, invoices, and their email preferences. Data lives in your own free Supabase project. Your project address and public key are already in `config.js`.

## What is stored, and how it is protected
- **Where:** your Supabase project, in a Postgres database that is encrypted at rest and in transit. Nothing about parents is kept in the website files or in Google Sheets.
- **Who can see it:** a signed-in parent can only ever receive rows that belong to their own family. This is enforced by the database itself (Row Level Security), not just by the website, so editing the website code can't get around it. Signed-out visitors can read nothing.
- **What parents can change:** their name and phone, their children's first names and birth years, and their email preference. They cannot create or change sessions, notes or invoices, so nobody can fake a record.
- **What we keep about children:** first name and birth year only. No health or allergy information is collected here.
- **Card details:** never touch this site. Payment happens on Stripe.
- **Keys:** the *publishable* key in `config.js` is meant to be public. The *secret / service role* key must never go in the website, in chat, or on GitHub. (When we connect the admin portal to this database, that key goes only into your Google script's private settings.)
- **Marketing:** off until the parent turns it on. The database records when they agreed or left. Booking confirmations and invoices still go out because they relate to a booking.
- **Deleting:** a parent can delete their account themselves. Their details are removed. Invoices stay as business records (kept for tax) but are no longer linked to them.

## Steps

### 1. Create the tables
1. In Supabase, open **SQL Editor**, then **New query**.
2. Open `supabase/schema.sql` from the website folder, copy everything, paste it in, and click **Run**. It should say "Success".
3. Open **Table Editor**. You should see `families`, `children`, `attendances`, `activity_notes`, `invoices` and `marketing_prefs`, each with a "RLS enabled" label.

### 2. Make the emails show a code
By default Supabase emails a link. We want a code.
1. Go to **Authentication**, then **Email Templates**.
2. Open **Magic Link**. Replace the message body with:
   ```
   <h2>Your Mateology sign-in code</h2>
   <p>Type this code on the website to sign in:</p>
   <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>It works once and expires soon. If you didn't ask for it, you can ignore this email.</p>
   ```
3. Open **Confirm signup** and paste the same body. Save both. (New parents get the second one, returning parents the first.)

### 3. Set up email sending (needed before real parents can sign in)
Supabase's built-in email sender is only for testing: it is heavily limited and can only send to your own team's addresses. Real parents need your own email service. Free options:
- **Gmail** (simplest if you use Google): turn on 2-step verification, create an **App password**, then in Supabase go to **Authentication, Emails, SMTP Settings**, enable custom SMTP with host `smtp.gmail.com`, port `465`, your Gmail address as username, the app password as password. About 500 emails a day.
- **Brevo** (300 a day free) or **Resend** (3,000 a month free, needs your own domain) also work. Each shows the exact SMTP details in its dashboard.

Set the sender name to **Mateology Play Society**.

### 4. Tell Supabase your website address
**Authentication**, then **URL Configuration**: set **Site URL** to your website address (for example `https://nouryyaz.github.io/Sensory-play/`).

### 5. Keep the free project awake
Free Supabase projects pause after about a week with no activity. The file `.github/workflows/keepalive.yml` pings it twice a week. In your GitHub repository go to **Settings, Secrets and variables, Actions, New repository secret** and add:
- `SUPABASE_URL`: your project address
- `SUPABASE_ANON_KEY`: the publishable key
(Both are public values, but secrets keep them tidy.) Then open the **Actions** tab and run **Keep Supabase awake** once to check it succeeds.

### 6. Upload and test
1. Upload the new website files to GitHub (including `config.js`, `account.html`, `account.js`, `account.css`).
2. Open `account.html` on your live site, enter your own email, and type the code you receive.
3. You should see your account with empty lists. Add a child, switch the email preference on and off, reload to check you stay signed in, then sign out.
4. In Supabase **Table Editor**, `families` should show your row and `marketing_prefs` should show `email_opt_in` matching your last choice.

## Before you invite parents
- Add a **privacy policy** page that says what you collect (name, email, phone, children's first names and birth years, session history), why, that it is stored with Supabase (note the region you chose), how to delete it, and how to contact you. I can draft one for you to check with a professional.
- I'm not a lawyer. Australian privacy and spam rules apply to a business holding families' details, so it's worth a quick professional look.

## What comes next
Right now parents can sign in and manage their own details, but sessions, activity notes and invoices only appear once you add them. The next step connects the admin portal so you can: add an activity note per child after each session, create invoices, and copy confirmed bookings into each family's history. That step uses the secret key, kept only inside your Google script settings.
