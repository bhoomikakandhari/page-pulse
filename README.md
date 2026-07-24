# Page Pulse

Audits any URL and reports HTTP status, response time, title, meta description,
H1 count, images missing `alt` text, and approximate word count. Built for the
Digital Heroes SDE task ("Build Page Pulse").

## Stack
- Node.js + Express (backend, `POST /api/audit`)
- Vanilla HTML/CSS/JS (frontend, `public/index.html`)
- Cheerio for HTML parsing

## Run locally
npm install
npm start
Then open http://localhost:3000

## API
POST /api/audit  { "url": "https://example.com" }

Success (200): JSON report with httpStatus, responseTimeMs, title,
metaDescription, h1Count, imagesMissingAlt, approxWordCount, etc.

Failure: 400 for bad input, 502 for unreachable/timeout/non-HTML target —
always JSON { "error": "..." }, server never crashes.

## Deploying
Push to GitHub → connect repo on Render or Railway → build `npm install`,
start `npm start` → get a live URL.