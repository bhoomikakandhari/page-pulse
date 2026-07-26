import * as cheerio from "cheerio";

/**
 * Validate and normalize a user-supplied URL string.
 * Pure function: no network access, no side effects — easy to unit test.
 *
 * @param {string} raw - whatever the user typed
 * @returns {URL} a validated URL object
 * @throws {Error} with a human-readable message if the input is invalid
 */
export function parseUrl(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error("URL is required.");
  }

  let candidate = raw.trim();
  const hasAnyScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate);
  if (!hasAnyScheme) {
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

/**
 * Extract the audit fields from a raw HTML string.
 * Pure function: takes HTML in, returns a plain data object out.
 * No fetch, no timing, no I/O — this is what makes it unit-testable
 * without mocking the network.
 *
 * @param {string} html - the full HTML body of a fetched page
 * @returns {{
 *   title: string|null,
 *   metaDescription: string|null,
 *   h1Count: number,
 *   imageCount: number,
 *   imagesMissingAlt: number,
 *   approxWordCount: number
 * }}
 */
export function extractFields(html) {
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
  const approxWordCount = bodyText.length > 0 ? bodyText.split(" ").length : 0;

  return {
    title,
    metaDescription,
    h1Count,
    imageCount: images.length,
    imagesMissingAlt,
    approxWordCount,
  };
}