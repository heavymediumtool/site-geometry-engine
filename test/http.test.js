/**
 * PATH: test/http.test.js
 * PURPOSE: Verify the Worker HTTP routes and response content types.
 * TAGS: tests, http, api, cloudflare-worker
 * ATTACHED: src/index.js
 * CALLED_BY: Node test runner, Cloudflare build pipeline
 * CALLS/DEPENDS_ON: node:test, node:assert, src/index.js
 * RUNTIME_ROLE: HTTP contract regression suite
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: none
 */

import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

test("GET /demo returns the canonical rendered scene", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/demo"),
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type"),
    /application\/json/,
  );

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.version, "0.1.0");
  assert.equal(payload.objects[0].radius, 1);
});

test("POST /geometry/render returns analyzed JSON and SVG", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/geometry/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        boundary: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        objects: [[5, 5, 2]],
      }),
    }),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.match(payload.svg, /<svg/);
});

test("POST /geometry/render.svg returns image/svg+xml", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/geometry/render.svg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        boundary: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        objects: [[5, 5, 2]],
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type"),
    /image\/svg\+xml/,
  );
  assert.match(await response.text(), /<svg/);
});

test("invalid JSON returns a structured 400 response", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/geometry/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.errors[0].code, "invalid_json");
});
