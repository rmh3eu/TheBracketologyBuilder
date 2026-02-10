# BracketologyBuilder Auth — Setup (Cloudflare Pages)

This build uses **session-cookie auth**:
- Cookie name: `bb_sess` (HttpOnly, Secure, SameSite=Lax)
- Sessions stored in **KV** binding: `SESSIONS`
- Users stored in **D1** binding: `DB`

## 1) Required Bindings (no terminal)
Cloudflare Dashboard → Workers & Pages → (your Pages project) → Settings → Functions → Bindings

Add:
1. **D1 Database**
   - Variable name: `DB`
   - Select your D1 database
2. **KV Namespace**
   - Variable name: `SESSIONS`
   - Select/create your KV namespace

If bindings are missing, the API will return helpful errors like `MISSING_DB` or `MISSING_SESSIONS`.

## 2) Database Schema
This build will auto-create the `users` table if it doesn't exist.
For the full app schema (brackets, groups, etc.), run `schema.sql` in:
Cloudflare → D1 → your database → Console → paste `schema.sql` → Run

## 3) Test Checklist
- Sign up creates user
- Login sets cookie and `/api/me` returns user
- Logout clears cookie and `/api/me` returns null
- "My Brackets" and saving requires sign-in and works after login
