# BracketologyBuilder (v27) — Cloudflare Pages + D1 + KV

This folder is **deploy-ready** for Cloudflare Pages (drag-and-drop upload).

## What you get
- ESPN-inspired dark bracket UI (mobile + desktop)
- Your seed/team list in `data.js` (easy manual edits)
- Optional **Accounts + Saved Brackets** using:
  - **D1** (database) for users + saved brackets + feature requests
  - **KV** for login sessions (cookies)

If you **don’t** set up D1/KV yet, the bracket still works in-browser (local autosave).
When you do set up D1/KV, users can sign in and sync across devices (same account).

Privacy note:
- Users will only see their own saved brackets when signed in.
- As the site admin, you can still view brackets by ID/share link (useful for featuring picks).

---

## 1) Create D1 database (Cloudflare dashboard)
1. Cloudflare → **Workers & Pages** → **D1** → **Create database**
2. Name it: `bracketologybuilder` (or anything)
3. After it’s created, open it and run the SQL from `schema.sql` (tab: “Console” / “Query”).
   - **Important:** sign-up/login can auto-create the basic `users` table, but you should still run `schema.sql`
     so saved brackets, challenges, groups, and admin tools have their tables.

## 2) Create KV namespace (for sessions)
1. Cloudflare → **Workers & Pages** → **KV** → **Create namespace**
2. Name it: `bracketologybuilder-sessions`

## 3) Bind DB + KV to your Pages project
Cloudflare → **Workers & Pages** → your Pages project → **Settings** → **Functions**

### Bindings
Add:
- **D1 Database binding**
  - Variable name: `DB`
  - Select your D1 database
- **KV Namespace binding**
  - Variable name: `SESSIONS`
  - Select your KV namespace

### Environment variables
Add:
- `ADMIN_EMAIL` = your email (this unlocks the simple admin feed tools)

## 4) Deploy
- Cloudflare Pages → your project → **Upload assets** (drag the whole folder) → Deploy

## 5) Test
- Visit your site
- Click **Sign in** (top right) to create/login
- Click **Save** to save to your account
- Click **My Brackets** to load an older bracket ID

Tip: the login cookie is marked **Secure**, so authentication only persists over **HTTPS**
(Cloudflare Pages preview + production are HTTPS). If you test over plain HTTP,
the browser will not store the session cookie.

---

## Notes
- Login uses a **Secure** cookie (`bb_sess`). It will only persist on **HTTPS** (Cloudflare Pages preview + production are HTTPS).
- Public share links use `?id=BRACKET_ID` for now.
- Later we can add prettier URLs like `/b/abc123` with a small router.


v35 additions:
- Private groups are free by default (max 6 members). Group creator can upgrade max size to paid tiers:
  7–12 $5, 13–25 $10, 26–50 $25, 51+ $50 (one-time organizer fee per tournament).
  Configure external checkout link base (optional):
    GROUP_UPGRADE_CHECKOUT_URL_BASE=https://your-checkout-link
  The app will open this link when creator selects a paid tier.

- Affiliate CTA after joining a group (optional, dismissible):
  Set AFFILIATE_JOIN_GROUP_URL to your partner link.

- Public config endpoint:
  GET /api/public returns the above URLs for the frontend.

Env vars (Pages):
- SITE_DOMAIN=bracketologybuilder.com
- SITE_NAME=Bracketology Builder
- AFFILIATE_JOIN_GROUP_URL=...
- GROUP_UPGRADE_CHECKOUT_URL_BASE=...
