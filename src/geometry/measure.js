/**
 * PATH: src/geometry/measure.js
 * PURPOSE: Derive deterministic boundary measurements from normalized site geometry.
 * TAGS: geometry, measurement, area, perimeter, edges, headings
 * ATTACHED: src/api/render.js, src/geometry/polygon.js
 * CALLED_BY: src/api/render.js
 * CALLS/DEPENDS_ON: polygon.js
 * RUNTIME_ROLE: Boundary quantity derivation
 * STATE_OWNERSHIP: Stateless derived geometry
 * SIGNALS/EVENTS: none
 */

import { signedPolygonArea } from "./polygon.js";

function normalizeHeadingDeg(value) {
  return ((value % 360) + 360) % 360;
}

function headingFromDelta(dx, dy) {
  return normalizeHeadingDeg(
    Math.atan2(dx, dy) * (180 / Math.PI),
  );
}

export function measureBoundary(boundary, geometryBounds, units = "input-units") {
  const edges = boundary.map((from, index) => {
    const to = boundary[(index + 1) % boundary.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    return {
      name: `E${index + 1}`,
      from: from.name,
      to: to.name,
      length: Math.hypot(dx, dy),
      headingDeg: headingFromDelta(dx, dy),
    };
  });

  return {
    units,
    area: Math.abs(signedPolygonArea(boundary)),
    perimeter: edges.reduce((sum, edge) => sum + edge.length, 0),
    boundingWidth: geometryBounds.maxX - geometryBounds.minX,
    boundingHeight: geometryBounds.maxY - geometryBounds.minY,
    edges,
  };
}
