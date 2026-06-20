# GEM Planner 💎
### Groceries · Expenses · Meal plans

A Progressive Web App — install it on your phone like a native app, works offline, syncs to Supabase on WiFi.

---

## Setup (one-time)

### 1. Run the database schema
- Open your Supabase project → SQL Editor
- Paste and run the entire contents of `schema.sql`
- Once done, run this to make yourself admin (replace with your email):
  ```sql
  update public.profiles set is_admin = true where email = 'your@email.com';
  ```

### 2. Add app icons (optional but recommended for PWA install)
- Create a folder called `icons/` in this project
- Add two PNG icons: `icon-192.png` (192×192px) and `icon-512.png` (512×512px)
- Use the emerald gem as the icon image

### 3. Push to GitHub Pages
- Create a new repo called `gem-planner` on GitHub
- Push all files including the `logos/` folder
- Enable GitHub Pages: Settings → Pages → Source: main branch / root
- Your app will be live at: `https://yourusername.github.io/gem-planner`

### 4. Sign in and set yourself as admin
- Open the app, sign in with your email
- Go to Supabase SQL Editor and run the admin update above
- Refresh the app — you'll now see the Admin panel under Profile

---

## Adding users (invite-only)
1. Open the app → Profile tab → Admin panel
2. Tap "+ Add user"
3. Enter their name, email and a temporary password
4. Share the app link and their credentials with them
5. They sign in and can change their password in Supabase Auth settings

---

## File structure
```
gem-planner/
  index.html          ← the entire app
  manifest.json       ← PWA install config
  sw.js               ← service worker (offline support)
  schema.sql          ← run once in Supabase SQL Editor
  logos/
    woolworths.png
    checkers.png
    pnp.jpg
    spar.jpg
    walmart.png
  icons/
    icon-192.png      ← add these for PWA icon
    icon-512.png
```

---

## Sharing with family/friends
Just send them the GitHub Pages link. They sign in with the credentials you create for them. Their data is completely separate from yours — Supabase RLS enforces this at the database level.
