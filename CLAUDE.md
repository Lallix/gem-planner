# GEM Planner

Personal groceries, expenses and meal-plan PWA with receipt OCR.

- **Work / personal:** Personal
- **Port:** 5202
- **Start:** `python -m http.server 5202 --bind 127.0.0.1` (or the `gem-planner` entry in `.claude\launch.json`), then open http://127.0.0.1:5202/
- **GitHub:** https://github.com/Lallix/gem-planner (public — hosted on GitHub Pages; never commit secrets)
- **Stack:** Static HTML / JavaScript PWA (no build step), Supabase (one project and login shared by GEM, Cycle and PGV Admin; users managed in PGV Admin). Receipt OCR runs in the Supabase edge function `gem-ocr` using Claude.
- **Non-code files:** `_files\` — Excel templates in `_files\data\`, old versions (v1–v70) in `_files\archive\`. Synced by OneDrive, gitignored.
- **Secrets:** `.env` (gitignored) holds `ANTHROPIC_API_KEY`. The static site does not read it; the live key belongs in Supabase secrets.

## Rules
- Only work inside this folder. Never start another app's server.
- Use relative paths only. This folder is opened on two PCs with different Windows usernames (`GideonV` and `lalli`).
- The repo is public: never put API keys in `app.js` or any committed file. (The Supabase anon key in `app.js` is public by design.) Google Vision was removed in v73 and its Google Cloud account closed; don't reintroduce it.

## Previous discussions
Before starting work, read `_files\docs\claude-history\HANDOVER.md`: where the build stands, key decisions, and open questions from earlier Claude sessions. The full past conversations are in the same folder; search them when you need detail.
