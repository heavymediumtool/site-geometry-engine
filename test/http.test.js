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
  assert.equal(payload.version, "0.4.0");
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
  assert.equal(payload.measurements.area, 100);
  assert.equal(payload.measurements.perimeter, 40);
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

test("GET /demo/complex renders all supported demonstration objects", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/demo/complex"),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.objects.length, 6);
  assert.equal(payload.coordinateSystem.positiveY, "up");
  assert.equal(payload.coordinateSystem.equalAxisScale, true);
});


test("GET /demo/traverse returns corrected traverse diagnostics", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/demo/traverse"),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.inputMode, "length_heading_traverse");
  assert.equal(payload.traverse.correction.applied, true);
  assert.ok(payload.traverse.raw.closure.distance > 0);
  assert.ok(payload.traverse.corrected.closure.distance < 1e-7);
});


test("POST /geometry/render supports append_closing_segment without altering measured headings", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/geometry/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        traverse: {
          mode: "append_closing_segment",
          units: "ft",
          start: [0, 0],
          segments: [
            [13, 135],
            [10, 90],
            [20, 30],
            [28, 270],
          ],
        },
        objects: [],
      }),
    }),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.version, "0.4.0");
  assert.equal(payload.traverse.traverseMode, "append_closing_segment");
  assert.equal(payload.traverse.correction.applied, false);
  assert.deepEqual(
    payload.traverse.measured.segments.map(
      (segment) => segment.headingDeg,
    ),
    [135, 90, 30, 270],
  );
  assert.ok(
    Math.abs(
      payload.traverse.appendedClosingSegment.length -
        8.21511551661843,
    ) < 1e-9,
  );
});


test("GET /geometry/render.svg accepts a URL-encoded scene", async () => {
  const scene = {
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    objects: [[5, 5, 2]],
  };
  const url =
    "https://example.test/geometry/render.svg?scene=" +
    encodeURIComponent(JSON.stringify(scene));

  const response = await worker.fetch(new Request(url));

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type"),
    /image\/svg\+xml/,
  );
  assert.match(await response.text(), /<svg/);
});

test("GET /geometry/render.svg rejects invalid scene query JSON", async () => {
  const response = await worker.fetch(
    new Request(
      "https://example.test/geometry/render.svg?scene=%7B",
    ),
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(
    payload.errors[0].code,
    "scene_query_invalid_json",
  );
});
