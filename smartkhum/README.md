# SmartKhum (ស្មាតឃុំ)

Connects villagers → AI classification → live map/dashboard → authority action, in 4 stages.

## Stack
- **Frontend:** HTML, CSS, vanilla JavaScript (no build step) + Leaflet.js for the map
- **Backend:** Ruby + Sinatra
- **Database:** SQLite (via the `sqlite3` gem)

## Project structure
```
smartkhum/
├── app.rb                 # Sinatra app: routes, DB access, AI classification logic
├── db/
│   ├── schema.sql          # issues + feedback tables
│   └── smartkhum.db        # created on first run
├── views/
│   ├── index.erb            # Stage 1 — villager report form (voice/photo/GPS)
│   ├── dashboard.erb        # Stage 3 — map & live stats
│   └── authority.erb        # Stage 4 — authority/NGO case ledger
└── public/
    ├── css/style.css
    └── js/{main,dashboard,authority}.js
```

## Setup

You need Ruby 3.x with the `sinatra`, `sinatra-contrib`, and `sqlite3` gems.

**Ubuntu/Debian (apt — easiest, no internet needed beyond apt repos):**
```bash
sudo apt-get install -y ruby ruby-sinatra ruby-sinatra-contrib ruby-sqlite3
```

**Or via RubyGems:**
```bash
gem install sinatra sinatra-contrib sqlite3 rackup puma
```

## Run it

```bash
cd smartkhum
ruby -r./app -e "SmartKhum.init_db!"   # first time only — creates db/smartkhum.db
ruby app.rb                             # starts the server on http://localhost:4567
```

Then open:
- `http://localhost:4567/` — report an issue (villager view)
- `http://localhost:4567/dashboard` — map & live stats
- `http://localhost:4567/authority` — authority/NGO case management

## How the "AI Engine" (Stage 2) works right now

`classify()` in `app.rb` simulates the NLP step with Khmer + English keyword
matching: it picks a **category** (water / road / health / environment / other)
and a **priority** (High / Medium / Low) from the free-text description. This
keeps the full pipeline — submit → classify → map → authority — working
end-to-end today.

To upgrade it to real AI later, swap the body of `classify()` for a call to a
speech-to-text + NLP service (e.g. the Anthropic API, Google Cloud Speech, or
a local Khmer ASR model) and keep the same `{ category:, priority: }` return
shape — nothing else in the app needs to change.

## API reference

| Method | Path                          | Purpose                                  |
|--------|-------------------------------|-------------------------------------------|
| POST   | `/api/issues`                 | Submit + auto-classify a new issue        |
| GET    | `/api/issues`                 | List issues (filters: category, priority, status) |
| GET    | `/api/stats`                  | Totals by status / category / priority    |
| PATCH  | `/api/issues/:id/status`      | Authority updates a case's status         |
| POST   | `/api/issues/:id/feedback`    | Authority sends feedback to the reporter  |
| GET    | `/api/issues/:id/feedback`    | Read feedback thread for a case           |

## Notes
- Voice input uses the browser's built-in **Web Speech API** (`km-KH` locale) — no server-side audio processing needed for the prototype.
- Photos are captured client-side, downscaled, and sent as base64 — swap for real file storage (S3, etc.) before production use.
- The map and Google Fonts load from public CDNs (unpkg.com, fonts.googleapis.com) — make sure the deployment environment allows outbound access to those, or self-host them.
