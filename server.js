import express from "express";
import * as cheerio from "cheerio";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024; 

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function parseUrl(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error("URL is required.");
  }
  let candidate = raw.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http:// and https:// URLs are supported.");
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    throw new Error("That doesn't look like a valid domain.");
  }
  return parsed;
}

async function readBodyCapped(response, maxBytes) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    return await response.text();
  }
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error("Page is too large to audit.");
    }
    chunks.push(value);
  }
  const total = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8").decode(total);
}

async function auditUrl(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = performance.now();

  let response;
  try {
    response = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PagePulse/1.0; +https://digitalheroesco.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s.`);
    }
    throw new Error(`Could not reach that URL (${err.cause?.code || err.message}).`);
  } finally {
    clearTimeout(timeout);
  }

  const responseTimeMs = Math.round(performance.now() - startedAt);
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return {
      url: targetUrl.toString(),
      httpStatus: response.status,
      responseTimeMs,
      contentType: contentType || "unknown",
      error: `Response is not HTML (content-type: ${contentType || "unknown"}). Nothing to audit.`,
    };
  }

  let html;
  try {
    html = await readBodyCapped(response, MAX_BYTES);
  } catch (err) {
    return {
      url: targetUrl.toString(),
      httpStatus: response.status,
      responseTimeMs,
      contentType,
      error: err.message,
    };
  }

  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;

  const h1Count = $("h1").length;

  const images = $("img");
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt.trim() === "") imagesMissingAlt += 1;
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.length > 0 ? bodyText.split(" ").length : 0;

  return {
    url: targetUrl.toString(),
    httpStatus: response.status,
    ok: response.ok,
    responseTimeMs,
    contentType,
    title,
    metaDescription,
    h1Count,
    imageCount: images.length,
    imagesMissingAlt,
    approxWordCount: wordCount,
  };
}

app.post("/api/audit", async (req, res) => {
  let targetUrl;
  try {
    targetUrl = parseUrl(req.body?.url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const report = await auditUrl(targetUrl);
    if (report.error) {
      return res.status(502).json(report);
    }
    return res.status(200).json(report);
  } catch (err) {
    return res.status(502).json({
      url: targetUrl.toString(),
      error: err.message || "Unexpected error auditing that URL.",
    });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Page Pulse running on http://localhost:${PORT}`);
});