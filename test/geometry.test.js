/**
 * PATH: test/geometry.test.js
 * PURPOSE: Verify the geometry contract, containment analysis, validation, and SVG output.
 * TAGS: tests, geometry, svg, validation
 * ATTACHED: src/api/render.js
 * CALLED_BY: Node test runner, Cloudflare build pipeline
 * CALLS/DEPENDS_ON: node:test, node:assert, src/api/render.js
 * RUNTIME_ROLE: Automated regression suite
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: none
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildScene } from "../src/api/render.js";

test("renders the canonical 10x10 square with a centered diameter-2 circle", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    objects: [[5, 5, 2]],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.boundary.map(({ name, x, y }) => ({ name, x, y })),
    [
      { name: "P1", x: 0, y: 0 },
      { name: "P2", x: 10, y: 0 },
      { name: "P3", x: 10, y: 10 },
      { name: "P4", x: 0, y: 10 },
    ],
  );
  assert.equal(result.objects[0].name, "O1");
  assert.deepEqual(result.objects[0].center, { x: 5, y: 5 });
  assert.equal(result.objects[0].size, 2);
  assert.equal(result.objects[0].radius, 1);
  assert.equal(result.objects[0].centerInside, true);
  assert.equal(result.objects[0].fullyInside, true);
  assert.match(result.svg, /<circle cx="5" cy="5" r="1"/);
  assert.match(result.svg, /width="900" height="900"/);
});

test("drops an explicitly repeated closing boundary coordinate", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    objects: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.boundary.length, 4);
});

test("reports a boundary overlap without rejecting an inside object center", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    objects: [[9.5, 5, 2]],
  });

  assert.equal(result.ok, true);
  assert.equal(result.objects[0].centerInside, true);
  assert.equal(result.objects[0].fullyInside, false);
  assert.equal(result.objects[0].boundaryOverlap, true);
  assert.equal(result.warnings[0].code, "object_crosses_boundary");
});

test("rejects an object whose center lies outside the boundary", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    objects: [[12, 5, 2]],
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (error) => error.code === "object_center_outside_boundary",
    ),
  );
});

test("rejects self-intersecting boundaries", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 10],
      [0, 10],
      [10, 0],
    ],
    objects: [],
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (error) => error.code === "boundary_self_intersection",
    ),
  );
});

test("supports named styled non-circular objects", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
    objects: [
      {
        name: "BOULDER_A",
        center: [10, 10],
        size: 4,
        shape: "hexagon",
        style: {
          fill: "#777777",
          opacity: 0.5,
          stroke: "#222222",
          pattern: "crosshatch",
        },
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.objects[0].name, "BOULDER_A");
  assert.equal(result.objects[0].shape, "hexagon");
  assert.equal(result.objects[0].fullyInside, true);
  assert.match(result.svg, /pattern-1/);
  assert.match(result.svg, /BOULDER_A/);
});

test("detects exact circle-to-circle overlap depth", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
    objects: [
      { name: "A", point: [5, 5, 4] },
      { name: "B", point: [8, 5, 4] },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.overlaps.length, 1);
  assert.equal(result.overlaps[0].overlaps, true);
  assert.equal(result.overlaps[0].overlapDepth, 1);
});

test("uses equal-width and equal-height view bounds to preserve geometry scale", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [20, 0],
      [20, 5],
      [0, 5],
    ],
    objects: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.bounds.view.width, result.bounds.view.height);
});

test("treats polygonal object contact with the boundary as fully inside", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    objects: [
      {
        name: "EDGE_SQUARE",
        center: [1, 5],
        size: 2,
        shape: "square",
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.objects[0].fullyInside, true);
  assert.equal(result.objects[0].boundaryOverlap, false);
});

test("rejects null coordinates instead of coercing them to zero", () => {
  const result = buildScene({
    boundary: [
      [null, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    objects: [],
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (error) => error.code === "boundary_coordinate_invalid",
    ),
  );
});


test("accepts a closed traverse using phone-compass headings", () => {
  const result = buildScene({
    traverse: {
      units: "ft",
      start: [0, 0],
      segments: [
        [10, 0],
        [10, 90],
        [10, 180],
        [10, 270],
      ],
    },
    objects: [[5, 5, 2]],
  });

  assert.equal(result.ok, true);
  assert.equal(result.inputMode, "length_heading_traverse");
  assert.equal(result.coordinateSystem.headingConvention.zeroDeg, "north");
  assert.equal(result.coordinateSystem.headingConvention.eastDeg, 90);
  assert.equal(result.traverse.correction.applied, false);
  assert.ok(result.traverse.raw.closure.distance < 1e-10);
  assert.ok(Math.abs(result.boundary[1].x) < 1e-9);
  assert.ok(Math.abs(result.boundary[1].y - 10) < 1e-9);
  assert.ok(Math.abs(result.boundary[2].x - 10) < 1e-9);
  assert.ok(Math.abs(result.boundary[2].y - 10) < 1e-9);
});

test("corrects relative heading inconsistency while holding lengths fixed", () => {
  const result = buildScene({
    traverse: {
      units: "ft",
      segments: [
        [10, 90],
        [10, 182],
        [10, 270],
        [10, 0],
      ],
    },
    objects: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.traverse.correction.applied, true);
  assert.ok(result.traverse.raw.closure.distance > 0.3);
  assert.ok(result.traverse.corrected.closure.distance < 1e-7);
  assert.ok(result.traverse.correction.maxAbsHeadingCorrectionDeg < 2);
  assert.deepEqual(
    result.traverse.corrected.segments.map((segment) => segment.length),
    [10, 10, 10, 10],
  );
  assert.ok(
    result.warnings.some(
      (warning) =>
        warning.code === "traverse_heading_correction_applied",
    ),
  );
});

test("rejects a traverse requiring correction beyond the configured safety limit", () => {
  const result = buildScene({
    traverse: {
      segments: [
        [10, 90],
        [10, 225],
        [10, 270],
        [10, 0],
      ],
      correction: {
        maxHeadingCorrectionDeg: 5,
      },
    },
    objects: [],
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (error) =>
        error.code === "traverse_heading_correction_excessive",
    ),
  );
  assert.ok(result.traverse.candidateCorrection);
});

test("can disable traverse correction and expose the raw closure failure", () => {
  const result = buildScene({
    traverse: {
      segments: [
        [10, 90],
        [10, 182],
        [10, 270],
        [10, 0],
      ],
      correction: {
        mode: "none",
      },
    },
    objects: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "traverse_not_closed");
  assert.ok(result.traverse.raw.closure.distance > 0.3);
});

test("rejects simultaneous coordinate boundary and traverse inputs", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    traverse: {
      segments: [
        [10, 0],
        [10, 90],
        [10, 180],
        [10, 270],
      ],
    },
    objects: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "input_geometry_conflict");
});


test("append_closing_segment preserves the user's measured legs and creates one synthetic return edge", () => {
  const result = buildScene({
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
  });

  assert.equal(result.ok, true);
  assert.equal(result.traverse.traverseMode, "append_closing_segment");
  assert.equal(result.traverse.correction.applied, false);
  assert.equal(result.traverse.measuredLength, 71);
  assert.equal(result.boundary.length, 5);

  assert.deepEqual(
    result.traverse.measured.segments.map((segment) => ({
      length: segment.length,
      headingDeg: segment.headingDeg,
      correction: segment.headingCorrectionDeg,
    })),
    [
      { length: 13, headingDeg: 135, correction: 0 },
      { length: 10, headingDeg: 90, correction: 0 },
      { length: 20, headingDeg: 30, correction: 0 },
      { length: 28, headingDeg: 270, correction: 0 },
    ],
  );

  const endpoint = result.traverse.measured.end;
  assert.ok(Math.abs(endpoint.x - 1.192388155425121) < 1e-9);
  assert.ok(Math.abs(endpoint.y - 8.128119920263652) < 1e-9);

  const closing = result.traverse.appendedClosingSegment;
  assert.equal(closing.synthetic, true);
  assert.equal(closing.measured, false);
  assert.ok(Math.abs(closing.length - 8.21511551661843) < 1e-9);
  assert.ok(Math.abs(closing.headingDeg - 188.34571265783373) < 1e-9);
  assert.ok(
    Math.abs(
      result.traverse.boundaryPerimeter - 79.21511551661843,
    ) < 1e-9,
  );
  assert.deepEqual(closing.to, { x: 0, y: 0 });
  assert.equal(result.warnings.length, 0);
});

test("closeToStart is accepted as an alias for append_closing_segment", () => {
  const result = buildScene({
    traverse: {
      closeToStart: true,
      segments: [
        [10, 0],
        [10, 90],
      ],
    },
    objects: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.traverse.traverseMode, "append_closing_segment");
  assert.equal(result.boundary.length, 3);
  assert.ok(result.traverse.appendedClosingSegment);
});

test("closed_adjustable remains the default for measured closed traverses", () => {
  const result = buildScene({
    traverse: {
      segments: [
        [10, 90],
        [10, 182],
        [10, 270],
        [10, 0],
      ],
    },
    objects: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.traverse.traverseMode, "closed_adjustable");
  assert.equal(result.traverse.correction.applied, true);
  assert.ok(result.traverse.corrected.closure.distance < 1e-7);
});


test("returns deterministic boundary area, perimeter, dimensions, and edge headings", () => {
  const result = buildScene({
    boundary: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    objects: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, "0.3.0");
  assert.equal(result.measurements.units, "input-units");
  assert.equal(result.measurements.area, 100);
  assert.equal(result.measurements.perimeter, 40);
  assert.equal(result.measurements.boundingWidth, 10);
  assert.equal(result.measurements.boundingHeight, 10);
  assert.deepEqual(
    result.measurements.edges.map(({ length, headingDeg }) => ({
      length,
      headingDeg,
    })),
    [
      { length: 10, headingDeg: 90 },
      { length: 10, headingDeg: 0 },
      { length: 10, headingDeg: 270 },
      { length: 10, headingDeg: 180 },
    ],
  );
});

test("reports traverse measurement units on derived boundary quantities", () => {
  const result = buildScene({
    traverse: {
      mode: "append_closing_segment",
      units: "ft",
      start: [0, 0],
      segments: [
        [13, 143],
        [10, 90],
        [20, 30],
        [28, 270],
      ],
    },
    objects: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.measurements.units, "ft");
  assert.ok(result.measurements.area > 0);
  assert.ok(result.measurements.perimeter > 0);
  assert.equal(result.measurements.edges.length, result.boundary.length);
});
