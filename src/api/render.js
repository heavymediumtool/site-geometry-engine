/**
 * PATH: src/api/render.js
 * PURPOSE: Orchestrate normalization, validation, analysis, bounds, warnings, and SVG rendering.
 * TAGS: api, geometry, orchestration, render
 * ATTACHED: src/geometry/*, src/render/svg.js
 * CALLED_BY: src/index.js, test/geometry.test.js
 * CALLS/DEPENDS_ON: normalize.js, validate.js, analyze.js, bounds.js, svg.js
 * RUNTIME_ROLE: Geometry render service boundary
 * STATE_OWNERSHIP: Owns assembled response model for one request
 * SIGNALS/EVENTS: none
 */

import { analyzeObjects, analyzePairwiseOverlaps } from "../geometry/analyze.js";
import {
  calculateGeometryBounds,
  calculateViewBounds,
} from "../geometry/bounds.js";
import { normalizeSceneInput } from "../geometry/normalize.js";
import { validateScene } from "../geometry/validate.js";
import { renderSvg } from "../render/svg.js";

export const ENGINE_VERSION = "0.1.0";

function warningsFromObjects(objects) {
  return objects
    .filter((object) => object.boundaryOverlap)
    .map((object) => ({
      code: "object_crosses_boundary",
      object: object.name,
      message: `Object "${object.name}" is centered inside the boundary but extends beyond it.`,
    }));
}

export function buildScene(rawInput) {
  const normalized = normalizeSceneInput(rawInput);
  const errors = validateScene(normalized);

  if (errors.length > 0) {
    return {
      ok: false,
      version: ENGINE_VERSION,
      errors,
    };
  }

  const objects = analyzeObjects(
    normalized.objects,
    normalized.boundary,
  );
  const overlaps = analyzePairwiseOverlaps(objects);
  const geometryBounds = calculateGeometryBounds(
    normalized.boundary,
    objects,
  );
  const viewBounds = calculateViewBounds(geometryBounds);

  const result = {
    ok: true,
    version: ENGINE_VERSION,
    bounds: {
      geometry: geometryBounds,
      view: viewBounds,
    },
    boundary: normalized.boundary,
    objects,
    overlaps,
    warnings: warningsFromObjects(objects),
  };

  return {
    ...result,
    svg: renderSvg({
      boundary: result.boundary,
      objects: result.objects,
      viewBounds,
    }),
  };
}

export const DEMO_INPUT = Object.freeze({
  boundary: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  objects: [
    {
      name: "O1",
      point: [5, 5, 2],
      shape: "circle",
      style: {
        fill: "#4f8f5b",
        opacity: 0.4,
        pattern: "solid",
      },
    },
  ],
});
