import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseUrl, extractFields } from "../lib/audit.js";

describe("parseUrl", () => {
  test("happy path: a well-formed https URL parses unchanged", () => {
    const result = parseUrl("https://example.com/page");
    assert.equal(result.href, "https://example.com/page");
    assert.equal(result.protocol, "https:");
  });

  test("happy path: a bare domain gets https:// prepended", () => {
    const result = parseUrl("example.com");
    assert.equal(result.protocol, "https:");
    assert.equal(result.hostname, "example.com");
  });

  test("failure case: empty string is rejected", () => {
    assert.throws(() => parseUrl(""), /URL is required/);
  });

  test("failure case: whitespace-only string is rejected", () => {
    assert.throws(() => parseUrl("   "), /URL is required/);
  });

  test("failure case: garbage text is rejected as invalid", () => {
    assert.throws(() => parseUrl("not a url at all"), /doesn't look like a valid/i);
  });

  test("failure case: non-http(s) protocol is rejected", () => {
    assert.throws(() => parseUrl("ftp://example.com"), /Only http:\/\/ and https:\/\//);
  });

  test("failure case: hostname with no dot is rejected", () => {
    assert.throws(() => parseUrl("https://localhost"), /valid domain/);
  });
});

describe("extractFields", () => {
  test("happy path: extracts title, meta description, H1s, alt text, word count", () => {
    const html = `
      <html>
        <head>
          <title>  Test Page  </title>
          <meta name="description" content="A page for testing.">
        </head>
        <body>
          <h1>Welcome</h1>
          <h1>Second heading</h1>
          <img src="a.png" alt="a decorative image">
          <img src="b.png" alt="">
          <img src="c.png">
          <p>Some short body copy here for word counting.</p>
        </body>
      </html>
    `;
    const result = extractFields(html);

    assert.equal(result.title, "Test Page"); // whitespace trimmed
    assert.equal(result.metaDescription, "A page for testing.");
    assert.equal(result.h1Count, 2);
    assert.equal(result.imageCount, 3);
    assert.equal(result.imagesMissingAlt, 2); // empty alt + missing alt attr both count
    assert.ok(result.approxWordCount > 0);
  });

  test("failure/edge case: missing title and meta description return null, not throw", () => {
    const html = `<html><body><h1>No head tags here</h1></body></html>`;
    const result = extractFields(html);

    assert.equal(result.title, null);
    assert.equal(result.metaDescription, null);
    assert.equal(result.h1Count, 1);
  });

  test("failure/edge case: empty body produces zero word count, not a crash", () => {
    const html = `<html><head><title>Empty</title></head><body></body></html>`;
    const result = extractFields(html);

    assert.equal(result.approxWordCount, 0);
    assert.equal(result.imageCount, 0);
    assert.equal(result.imagesMissingAlt, 0);
  });
});