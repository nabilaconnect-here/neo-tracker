# Near‑Earth Object (NEO) Tracker — Production-Ready

A polished web app to explore **NASA Near-Earth Objects (NeoWs)** for any date, with a **Risk Score + color coding**, timezone-correct logic, resilient networking, and light SRE/observability.

## Quick Start (Local)

### 1) Backend API (keeps NASA key private)
```bash
cd api
cp .env.example .env
# Edit .env and set NASA_API_KEY=<your_real_key>
npm install
npm start          # http://localhost:8787
```

### 2) Frontend (Vite + React)
```bash
cd ../web
npm install
npm run dev        # http://localhost:5173
```

The frontend dev server proxies `/api/*` to `http://localhost:8787` (see `web/vite.config.js`).

---

## What’s included

- **Features**
  - Date picker (defaults to today).
  - Table with: Name, Diameter (ft, avg of min/max), Velocity (mph), Miss Distance (mi), Hazardous (Y/N).
  - **Risk Score (0–100)** with green/amber/red chips; used in sorting and colored scatter plot.
  - “Only potentially hazardous” filter (uses NASA’s PHA boolean; independent of Risk Score).
  - Scatter chart **Diameter vs Miss Distance** with risk-band coloring and domain padding.

- **Resilience & UX**
  - AbortController + latest-request guard + input debounce.
  - Timeouts, retries with backoff/jitter (server), client circuit breaker after repeated failures.
  - Stale-while-revalidate UX: cached data renders quickly; background refresh updates the UI via an event.

- **Timezone-correct**
  - User selects a **local calendar date**; backend queries the **UTC day** NASA uses.
  - Display times (Last updated) are shown in user local time.

- **Light SRE**
  - Optional Sentry (`@sentry/node`), Slack alert on burst failures.
  - Structured logs & clear error shapes.
  - Simple in-memory rate limit to protect the proxy/quota.

---

## Environment Variables

Create `api/.env` from `.env.example`:
```
NASA_API_KEY=REPLACE_WITH_YOUR_KEY
SENTRY_DSN=
SLACK_WEBHOOK_URL=
PORT=8787
ALLOWED_ORIGINS=http://localhost:5173
```

**Do not commit secrets.** `.env` files are git-ignored. In production, set env vars in your hosting platform’s settings.

---

## API (stable contract)
`GET /api/neos?date=YYYY-MM-DD`

Response:
```json
{
  "date": "2025-10-01",
  "items": [
    {
      "id": "3542519",
      "name": "(2010 AB1)",
      "diameterFt": 1234.5,
      "speedMph": 31415.9,
      "distanceMiles": 238900.0,
      "hazardous": false,
      "nasaJplUrl": "https://...",
      "riskScore": 57
    }
  ],
  "fetchedAt": "2025-10-01T18:23:12Z",
  "cache": "MISS"
}
```

**Notes**
- Close-approach entry is chosen by **`close_approach_date === date`**, falling back to the first entry only if needed.
- Cache headers: `public, s-maxage=900, stale-while-revalidate=600`.

---

## Production

- **Build frontend**
  ```bash
  cd web && npm run build   # outputs web/dist
  ```
- Serve the SPA via any static host (and keep the API deployed separately), **or** mount `web/dist` behind the same domain on your platform and route `/api/*` to the API service.

> If you want the API to serve the SPA as well, add a static-serve snippet in `api/server.js` after the `/api` routes (commented section included).

---

## Testing

### Frontend
```bash
cd web
npm test
```

### Backend
```bash
cd api
npm test
```

What’s covered:
- **Backend:** risk scoring & normalization (date-matching).
- **Frontend:** utils (risk bands, number format), rendering + risk chips.

---

## Why “Potentially Hazardous” ≠ Risk Score

- **PHA (NASA flag):** an asteroid with **MOID ≤ 0.05 AU** and **H ≤ 22** (≈ ≥140 m). It’s about long-term monitoring.
- **Risk Score (app):** a **same-day heuristic** using size, speed, and miss distance to help you triage the list.

An info tooltip clarifies this next to the checkbox.

---

## Repo Notes

- Commit `api/.env.example`, not `api/.env`.
- Commit `package-lock.json` for reproducible installs.
- `engines` require Node 18+.


