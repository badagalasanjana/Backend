# 🐞 BugDiary — Debugging Learning Journal (MERN)

Beginners often fix errors without recording the cause, so they hit the same mistakes again.
BugDiary is a searchable journal for **error messages, attempted fixes, root causes and lessons learned**.

**Differentiating feature:** as you type a new error message, BugDiary suggests **related past entries**
whose error keywords match (for example `TypeError`, `ECONNREFUSED`, `map`), ranked by a weighted
match score and showing the fix you used last time.

## Tech stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 (Vite), React Router, responsive CSS (mobile, tablet, desktop, dark mode) |
| Backend  | Node.js, Express 4 REST API, express-validator, central error handling |
| Database | MongoDB with Mongoose (text index for search, keyword index for suggestions) |

## Project structure

```
server/
  src/
    app.js                 Express app (middleware, routes, error handling)
    server.js              Starts the DB connection and the HTTP server
    config/db.js           MongoDB connection (falls back to in-memory MongoDB)
    models/Entry.js        Mongoose schema, text index, keyword extraction hook
    controllers/           Request handlers (CRUD, search, stats, related/suggest)
    routes/entryRoutes.js  REST routes
    middleware/            Validation rules and error handler
    utils/keywords.js      Keyword extraction and similarity scoring
    seed.js, seedData.js   Sample data
  tests/api.test.js        API integration tests (node:test)
client/
  src/
    api/entries.js         Fetch wrapper for the REST API
    pages/                 Journal list, entry detail, create/edit form, 404
    components/ui.jsx      Badges, tags, alerts, related-entry cards
    index.css              Responsive styles
```

## Running locally

Requires Node.js 18 or newer.

```bash
cd server
npm install
cp .env.example .env        # set MONGODB_URI to your local MongoDB or Atlas
npm run seed                # optional: load sample entries
npm run dev                 # API on http://localhost:5000
```

In a second terminal:

```bash
cd client
npm install
npm run dev                 # UI on http://localhost:5173 (proxies /api to :5000)
```

**No MongoDB installed?** Leave `MONGODB_URI` empty (or skip creating `.env`). The server then starts an
in-memory MongoDB and loads sample entries. Data is lost when the server stops.

If the API runs on another port, start the client with `API_TARGET=http://localhost:5001 npm run dev`.

**Single-server mode:** run `npm run build` in `client/`. The Express server then serves the built UI as well,
so everything is available at http://localhost:5000.

**Tests:** `cd server && npm test` runs 8 API integration tests against an in-memory MongoDB.

## REST API

Base URL: `/api/entries`

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/` | List entries. Query: `q` (full-text search), `status` (`open`/`resolved`), `tag`, `page`, `limit` (max 50) |
| POST   | `/` | Create an entry |
| GET    | `/stats` | Totals plus the most-used tags |
| POST   | `/suggest` | `{ errorMessage, tags?, excludeId? }` returns related past entries for an unsaved error |
| GET    | `/:id` | Get one entry |
| GET    | `/:id/related` | Related past entries for a saved entry |
| PUT    | `/:id` | Update an entry (partial updates allowed) |
| DELETE | `/:id` | Delete an entry (204) |

### Entry fields

| Field | Type | Rules |
|-------|------|-------|
| `title` | string | required, 3–150 chars |
| `errorMessage` | string | required, 3–5000 chars |
| `language` | string | optional, max 50 |
| `context`, `rootCause`, `solution`, `lessonsLearned` | string | optional, max 3000 |
| `attemptedFixes` | string[] | max 20 items, each max 500 |
| `tags` | string[] | max 10, each max 30, lowercased and de-duplicated |
| `status` | `open` / `resolved` | a resolved entry must have a `solution` |

### Error responses

All errors are JSON: `{ "message": "...", "errors": [{ "field": "...", "message": "..." }] }`

| Status | When |
|--------|------|
| 400 | Validation failed, malformed JSON, or invalid id |
| 404 | Entry or route not found |
| 413 | Request body too large |
| 500 | Unexpected server error (details are logged, not exposed) |

## How related entries are found

1. When an entry is saved, keywords are extracted from its error message and tags. Paths, URLs, line
   numbers and common filler words are dropped, and everything is lowercased.
2. For a new error, the same extraction runs and MongoDB finds candidates sharing any keyword (indexed `$in`).
3. Each candidate is scored by weighted overlap. Error class names (`TypeError`, `SyntaxError`), errno codes
   (`ECONNREFUSED`, `EADDRINUSE`) and HTTP status codes count three times as much as ordinary words.
4. Entries scoring at least 20% are returned, best first, with the keywords that matched.
