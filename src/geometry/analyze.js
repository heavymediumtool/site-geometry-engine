/**
 * PATH: src/geometry/analyze.js
 * PURPOSE: Analyze normalized objects relative to the boundary and one another.
 * TAGS: geometry, analysis, containment, overlap
 * ATTACHED: src/geometry/polygon.js, src/geometry/shapes.js
 * CALLED_BY: src/api/render.js
 * CALLS/DEPENDS_ON: polygon.js, shapes.js
 * RUNTIME_ROLE: Scene analysis
 * STATE_OWNERSHIP: Produces derived geometry metadata
 * SIGNALS/EVENTS: none
 */

import {
  minimumDistanceToPolygonBoundary,
  pointInPolygon,
  polygonEdgesIntersect,
} from "./polygon.js";
import {
  objectRadius,
  objectVertices,
} from "./shapes.js";

function polygonObjectFullyInside(object, boundary) {
  const vertices = objectVertices(object);

  if (!vertices.every((vertex) => pointInPolygon(vertex, boundary))) {
    return false;
  }

  return !polygonEdgesIntersect(vertices, boundary);
}

export function analyzeObject(object, boundary) {
  const centerInside = pointInPolygon(object.center, boundary);

  let fullyInside = false;

  if (centerInside && object.shape === "circle") {
    fullyInside =
      minimumDistanceToPolygonBoundary(object.center, boundary) +
        1e-9 >=
      objectRadius(object);
  } else if (centerInside) {
    fullyInside = polygonObjectFullyInside(object, boundary);
  }

  return {
    ...object,
    radius: object.shape === "circle" ? objectRadius(object) : undefined,
    centerInside,
    fullyInside,
    boundaryOverlap: centerInside && !fullyInside,
  };
}

export function analyzeObjects(objects, boundary) {
  return objects.map((object) => analyzeObject(object, boundary));
}

export function circleOverlaps(first, second) {
  if (first.shape !== "circle" || second.shape !== "circle") {
    return null;
  }

  const distance = Math.hypot(
    first.center.x - second.center.x,
    first.center.y - second.center.y,
  );

  const totalRadius = objectRadius(first) + objectRadius(second);
  const overlapDepth = Math.max(0, totalRadius - distance);

  return {
    a: first.name,
    b: second.name,
    overlaps: overlapDepth > 0,
    overlapDepth,
  };
}

export function analyzePairwiseOverlaps(objects) {
  const results = [];

  for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < objects.length;
      secondIndex += 1
    ) {
      const result = circleOverlaps(
        objects[firstIndex],
        objects[secondIndex],
      );

      if (result) {
        results.push(result);
      }
    }
  }

  return results;
}
