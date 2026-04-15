# INKWELL — Tattoo Booking Backend
### Full-stack setup guide (Supabase + Resend + Vercel)

---

## What you're deploying

```
/
├── api/
│   └── book.js          ← Vercel serverless function
├── public/
│   └── index.html       ← Your booking form
├── supabase-schema.sql  ← Run once in Supabase
├── .env.example         ← Copy to .env.local for local dev
├── package.json
└── vercel.json
```

Submissions flow: **Form → Vercel API → Supabase (stored) + Resend (emailed)**

---

## Step 1 — Supabase (database)

1. Go to **[supabase.com](https://supabase.com)** → Create a free account
2. Click **New Project** → name it `inkwell` → set a DB password → Create
3. Wait ~2 minutes for it to spin up
4. In the left sidebar → **SQL Editor** → **New Query**
5. Paste the entire contents of `supabase-schema.sql` → click **Run**
6. Go to **Project Settings → API**
7. Copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role** key (under "Project API Keys", click reveal) → this is your `SUPABASE_SERVICE_KEY`

> ⚠️ Use the **service_role** key in your API — NOT the anon key. Never expose it in frontend code.

---

## Step 2 — Resend (email)

1. Go to **[resend.com](https://resend.com)** → Create a free account
2. Go to **API Keys** → **Create API Key** → name it `inkwell-bookings`
3. Copy the key → this is your `RESEND_API_KEY`
4. **To send from your own domain** (recommended):
   - Go to **Domains** → **Add Domain** → follow the DNS instructions
   - Update the two `from:` addresses in `api/book.js` to use your domain
5. **To test without a domain first:**
   - Resend lets you send from `onboarding@resend.dev` while in sandbox mode
   - Change both `from:` lines in `api/book.js` to `'Inkwell <onboarding@resend.dev>'`
   - You can only send to your own email address in sandbox mode

---

## Step 3 — Vercel (hosting + API)

1. Push this folder to a **GitHub repo** (go to github.com → New repo → upload files)
2. Go to **[vercel.com](https://vercel.com)** → sign up with GitHub
3. Click **Add New Project** → import your repo
4. Before clicking Deploy, go to **Environment Variables** and add:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | your Supabase service role key |
| `RESEND_API_KEY` | your Resend API key |
| `ARTIST_EMAIL` | your inbox (where booking alerts go) |

5. Click **Deploy** — done ✦

Your live URL will be something like `https://inkwell-booking.vercel.app`

---

## Step 4 — Update the form URL (only if using a separate frontend)

If you host the HTML on a different domain than Vercel, update this line in `public/index.html`:

```js
const API_URL = '/api/book';
// Change to your full Vercel URL:
const API_URL = 'https://inkwell-booking.vercel.app/api/book';
```

If the HTML is in this same repo (served by Vercel), `/api/book` works as-is.

---

## Local development

```bash
npm install -g vercel      # install Vercel CLI
cp .env.example .env.local # fill in your keys
npm install
vercel dev                 # starts local server at localhost:3000
```

---

## Viewing submissions

In Supabase → **Table Editor** → **bookings** — all submissions appear here in real time. You can:
- Filter by `status` to track progress
- Change `status` from `new` → `confirmed` / `declined`
- Export as CSV

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 500 error on submit | Check Vercel function logs (Vercel dashboard → Deployments → Functions) |
| Emails not arriving | Check Resend dashboard → Logs for delivery errors |
| DB insert failing | Make sure you ran the SQL schema and used the service_role key |
| CORS error | Check the `Access-Control-Allow-Origin` header in `api/book.js` — set it to your frontend domain |
