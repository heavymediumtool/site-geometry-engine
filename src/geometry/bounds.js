/**
 * PATH: src/geometry/bounds.js
 * PURPOSE: Calculate geometry and padded view bounds while preserving equal X/Y scale.
 * TAGS: geometry, bounds, viewport
 * ATTACHED: src/geometry/shapes.js, src/render/svg.js
 * CALLED_BY: src/api/render.js
 * CALLS/DEPENDS_ON: shapes.js
 * RUNTIME_ROLE: Viewport calculation
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: none
 */

import { objectExtents } from "./shapes.js";

function includeBounds(target, extents) {
  target.minX = Math.min(target.minX, extents.minX);
  target.maxX = Math.max(target.maxX, extents.maxX);
  target.minY = Math.min(target.minY, extents.minY);
  target.maxY = Math.max(target.maxY, extents.maxY);
}

export function calculateGeometryBounds(boundary, objects) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const point of boundary) {
    includeBounds(bounds, {
      minX: point.x,
      maxX: point.x,
      minY: point.y,
      maxY: point.y,
    });
  }

  for (const object of objects) {
    includeBounds(bounds, objectExtents(object));
  }

  return bounds;
}

export function calculateViewBounds(geometryBounds, paddingRatio = 0.08) {
  const width = geometryBounds.maxX - geometryBounds.minX;
  const height = geometryBounds.maxY - geometryBounds.minY;
  const span = Math.max(width, height, 1);
  const paddedSpan = span * (1 + paddingRatio * 2);

  const centerX =
    (geometryBounds.minX + geometryBounds.maxX) / 2;
  const centerY =
    (geometryBounds.minY + geometryBounds.maxY) / 2;

  return {
    minX: centerX - paddedSpan / 2,
    maxX: centerX + paddedSpan / 2,
    minY: centerY - paddedSpan / 2,
    maxY: centerY + paddedSpan / 2,
    width: paddedSpan,
    height: paddedSpan,
  };
}
