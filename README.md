# Anivexa Site

A full anime streaming site: **React** frontend, **Django** backend, powered by the **Anivexa API** (Node) for episodes and stream links and **AniList** for the catalog.

```
anivexa-site/
  api/        Anivexa API (your uploaded zip, unchanged) - Node, port 4000
  backend/    Django + DRF - port 8000
  frontend/   React + Vite - port 5173
```

How a request flows: the browser talks only to Django. Django asks AniList for catalog data, asks the Anivexa API for episodes and streams, and proxies video so sources that require a Referer header still play.

## Run it locally (3 terminals)

**1. Anivexa API** (Node 18+)
```bash
cd api
npm install
cp .env.example .env
node server.js            # http://localhost:4000
```

**2. Django backend** (Python 3.10+)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser                       # optional, for /admin
python manage.py runserver                             # http://localhost:8000
```

**3. React frontend** (Node 18+)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev                                            # http://localhost:5173
```

Open http://localhost:5173.

## Features

**Browsing**
- Spotlight carousel: swipe, auto-advance with progress bar, pauses on hover, and the whole page glows in the current poster's color
- Home shelves: trending, top airing, popular, most favorited, just completed, newly added, movies
- **Top 10** by day / week / month, ranked by real episode starts on your site (falls back to AniList trending until you have traffic)
- Browse with filters: genre (multi), type, status, season, year, sort, plus pagination and shareable URLs
- Live search suggestions with posters, and the `/` key focuses the search box
- Weekly airing schedule in your local time zone with countdowns
- Anime pages: synopsis, facts, trailer, characters, related titles, recommendations, next-episode countdown

**Watching**
- 13 sources from the Anivexa API, merged into one episode list. If a source fails, the player **automatically tries the next one**, then the next server
- Sub / dub switch (disabled for episodes that don't have it), source and server pickers
- HLS (hls.js), MP4 and embed support; quality selector, playback speed, subtitles (WebVTT)
- **Skip intro** button and optional auto-skip, auto-play next episode with a 5-second cancelable countdown
- Resume where you stopped; watched episodes are checked off; filler episodes are marked
- Keyboard: Space/K play, arrows seek, J/L +-10s, M mute, F fullscreen, N/P next/previous
- Focus mode dims the page around the player

**Accounts**
- Register / sign in with username or email (JWT with automatic refresh)
- Continue watching, My list (watching / plan / completed / on hold / dropped), favorites, history
- Guests keep progress in their browser; it syncs to the account when they sign in
- Comments and replies per anime and per episode, with delete for your own comments
- Profile settings: change username, email, password

## Releasing it (with a database)

**1. Create a PostgreSQL database** on any host (Supabase, Neon, Railway, Render, or Postgres on your own VPS). Copy its connection string:

```
postgres://USER:PASSWORD@HOST:5432/DBNAME
```

**2. Deploy the Django backend** (Railway, Render, Fly.io or a VPS). Environment variables:

```
DJANGO_SECRET_KEY=<long random string>
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=api.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
CSRF_TRUSTED_ORIGINS=https://api.yourdomain.com
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
ANIVEXA_API_URL=https://your-node-api-host
```

Build and start commands:

```bash
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate                # creates every table in your database
gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 3 --timeout 120
```

Run `python manage.py createsuperuser` once (the host's shell/console) to get into `/admin`.

**3. Deploy the Anivexa API** (the `api/` folder) on a VPS or Railway/Render: `npm install && node server.js`. Keep it private if you can; only Django needs to reach it.

**4. Build and host the frontend.**

```bash
cd frontend
VITE_API_URL=https://api.yourdomain.com/api npm run build
```

Upload `frontend/dist/` to Netlify, Cloudflare Pages, Vercel or Nginx. Add a single-page-app rewrite so every path serves `index.html` (Netlify: `/*  /index.html  200`).

**5. Check it:** open `https://api.yourdomain.com/api/home/` (should return JSON), then register an account on the site and confirm the user shows up in `/admin`.

Moving data from your local SQLite: `python manage.py dumpdata --exclude contenttypes --exclude auth.permission -o data.json`, point `DATABASE_URL` at Postgres, run `migrate`, then `python manage.py loaddata data.json`.

- Set `REDIS_URL` if you run more than one worker so caches are shared.
- Back up your Postgres database; user accounts, lists and comments live only there.

## Things to know

- Streams come from third-party providers through the Anivexa API, and the Anivexa API depends on AniList being reachable. Provider sites change often, so individual sources will break from time to time; the auto-fallback is there for that reason.
- AnimeOnsen is left out of the player because it only serves DASH.
- Before making the site public, check the copyright and DMCA rules that apply where you host it and where your viewers are. The footer already states that no files are stored on your servers.
