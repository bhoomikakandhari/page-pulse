# Page Pulse

Audits any URL and reports HTTP status, response time, title, meta description,
H1 count, images missing `alt` text, and approximate word count. Built for the
Digital Heroes SDE task ("Build Page Pulse").

## Stack
- Node.js + Express (backend, `POST /api/audit`)
- Vanilla HTML/CSS/JS (frontend, `public/index.html`)
- Cheerio for HTML parsing

No database, no build step — one `npm install`, one `npm start`.

## Run locally
```bash
npm install
npm start
```
Then open `http://localhost:3000`.

## API
`POST /api/audit`
```json
{ "url": "https://example.com" }
```

Success (`200`):
```json
{
  "url": "https://example.com/",
  "httpStatus": 200,
  "ok": true,
  "responseTimeMs": 184,
  "contentType": "text/html; charset=UTF-8",
  "title": "Example Domain",
  "metaDescription": null,
  "h1Count": 1,
  "imageCount": 0,
  "imagesMissingAlt": 0,
  "approxWordCount": 28
}
```

Failure cases return `400` (bad input, e.g. malformed URL) or `502`
(target site unreachable, timed out after 10s, or returned a non-HTML
response) with a JSON `{ "error": "..." }` body. The server never crashes
on a bad target — every failure path is caught and returned as JSON.

## Tests
```bash
npm test
```
Runs Node's built-in test runner (`node --test`, no extra dependency needed)
against `test/audit.test.js`. Covers the parsing logic in `lib/audit.js`:

- **Happy paths:** a well-formed URL parses unchanged; a bare domain like
  `example.com` gets `https://` prepended; a full HTML page with a title,
  meta description, headings, and images extracts every field correctly.
- **Failure cases:** empty/whitespace input, non-URL garbage text, a
  non-http(s) protocol (e.g. `ftp://`), and a hostname with no dot are all
  rejected with a specific, human-readable error rather than throwing an
  unhandled exception. HTML missing a `<title>` or meta description returns
  `null` for those fields instead of crashing; an empty `<body>` returns a
  word count of `0` instead of `NaN` or a false positive.

## API contract

**`POST /api/audit`**

Request body:
```json
{ "url": "https://example.com" }
```
`url` is required. It may omit the `http(s)://` prefix (e.g. `"example.com"`
is accepted and normalized to `https://example.com`).

Response — success (`200`):
```json
{
  "url": "https://example.com/",
  "httpStatus": 200,
  "ok": true,
  "responseTimeMs": 184,
  "contentType": "text/html; charset=UTF-8",
  "title": "Example Domain",
  "metaDescription": null,
  "h1Count": 1,
  "imageCount": 0,
  "imagesMissingAlt": 0,
  "approxWordCount": 28
}
```

Response — client error (`400`): malformed/missing URL.
```json
{ "error": "That doesn't look like a valid URL." }
```

Response — upstream failure (`502`): target site unreachable, timed out
(10s), too large (>5MB), or returned a non-HTML response.
```json
{
  "url": "https://notarealsite12345.com/",
  "error": "Could not reach that URL (ENOTFOUND)."
}
```

The server never crashes on a bad target — every failure path is caught
and returned as JSON with an appropriate status code.

## Design decisions

**1. Separated pure parsing logic from the server (`lib/audit.js` vs. `server.js`).**
`parseUrl` and `extractFields` take plain inputs (a string, an HTML string)
and return plain outputs, with no `fetch`, no Express, no I/O. This means
the test suite can exercise the actual validation and extraction logic
directly and quickly, without mocking the network or spinning up a server.
The tradeoff is one extra file to navigate, but the testability is worth it
for a scoring criterion that specifically asks for correctness/error-handling
tests.

**2. Streamed and capped the response body instead of calling `response.text()` directly.**
A naive `await response.text()` would happily try to buffer an arbitrarily
large response into memory before you get to inspect it. `readBodyCapped`
reads the body in chunks and aborts once it crosses a 5MB threshold. This
trades a little extra code for protection against a slow-loris-style page
or an accidentally huge file hanging or crashing the server — a real risk
for a tool whose whole job is fetching arbitrary user-supplied URLs.

**3. Distinguished `400` vs. `502` instead of returning `500` for every failure.**
A malformed URL is the caller's fault (`400`); a target site being down,
timing out, or returning non-HTML is the target's fault, not the caller's
or this server's (`502`). Collapsing both into a generic `500` would be
simpler but semantically wrong and less useful to whoever's consuming the
API (including the frontend, which uses the distinction to decide how to
phrase the error to the user).

## What I'd change with another day
- Add a light in-memory cache (e.g. 60s TTL) so repeated audits of the same
  URL don't re-fetch and re-parse every time.
- Add a few more accessibility checks (missing `lang` attribute, heading
  order/skipped levels) rather than just alt text and H1 count.
- Add an integration-level test that actually spins up the Express app and
  hits `/api/audit` with a local test HTML fixture server, rather than only
  unit-testing the pure functions.

## Deploying (free tier)
Any Node host works. Quickest options:

**Render**
1. Push this repo to GitHub.
2. New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Deploy — Render gives you a live `https://...onrender.com` URL.

**Railway** — same idea: connect the repo, it detects Node automatically,
deploy, grab the generated public URL.

## Submission checklist (per task requirements)
- [ ] Public GitHub repo with this code
- [ ] Live deployed link (Render/Railway/etc., free tier)
- [ ] Footer credit line reading "Built for Digital Heroes Training Task,"
      linked to `digitalheroesco.com` — already in `public/index.html`
- [ ] Submit both links on Instagram to `@realshreyanshsingh`
-