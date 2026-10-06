/**
 * PATH: src/geometry/polygon.js
 * PURPOSE: Provide polygon area, containment, distance, and intersection primitives.
 * TAGS: geometry, polygon, containment, intersections
 * ATTACHED: src/geometry/validate.js, src/geometry/analyze.js
 * CALLED_BY: src/geometry/validate.js, src/geometry/analyze.js
 * CALLS/DEPENDS_ON: none
 * RUNTIME_ROLE: Deterministic geometry primitives
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: none
 */

const EPSILON = 1e-9;

export function signedPolygonArea(points) {
  let sum = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return sum / 2;
}

function cross(a, b, c) {
  return (
    (b.x - a.x) * (c.y - a.y) -
    (b.y - a.y) * (c.x - a.x)
  );
}

export function pointOnSegment(point, a, b) {
  if (Math.abs(cross(a, b, point)) > EPSILON) {
    return false;
  }

  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  );
}

export function segmentsProperlyIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  return (
    ((abC > EPSILON && abD < -EPSILON) ||
      (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) ||
      (cdA < -EPSILON && cdB > EPSILON))
  );
}

export function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  if (
    ((abC > EPSILON && abD < -EPSILON) ||
      (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) ||
      (cdA < -EPSILON && cdB > EPSILON))
  ) {
    return true;
  }

  return (
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b) ||
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d)
  );
}

export function polygonSelfIntersects(points) {
  const edgeCount = points.length;

  for (let i = 0; i < edgeCount; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % edgeCount];

    for (let j = i + 1; j < edgeCount; j += 1) {
      const c = points[j];
      const d = points[(j + 1) % edgeCount];

      const sameEdge = i === j;
      const adjacent =
        (i + 1) % edgeCount === j || (j + 1) % edgeCount === i;

      if (sameEdge || adjacent) {
        continue;
      }

      if (segmentsIntersect(a, b, c, d)) {
        return true;
      }
    }
  }

  return false;
}

export function pointInPolygon(point, polygon) {
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];

    if (pointOnSegment(point, a, b)) {
      return true;
    }
  }

  let inside = false;

  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];

    const straddles =
      current.y > point.y !== previous.y > point.y;

    if (!straddles) {
      continue;
    }

    const crossingX =
      ((previous.x - current.x) * (point.y - current.y)) /
        (previous.y - current.y) +
      current.x;

    if (point.x < crossingX) {
      inside = !inside;
    }
  }

  return inside;
}

export function distancePointToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) /
        lengthSquared,
    ),
  );

  const projection = {
    x: a.x + t * dx,
    y: a.y + t * dy,
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function minimumDistanceToPolygonBoundary(point, polygon) {
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    minimum = Math.min(
      minimum,
      distancePointToSegment(point, a, b),
    );
  }

  return minimum;
}

export function polygonEdgesIntersect(first, second) {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const a = first[firstIndex];
    const b = first[(firstIndex + 1) % first.length];

    for (
      let secondIndex = 0;
      secondIndex < second.length;
      secondIndex += 1
    ) {
      const c = second[secondIndex];
      const d = second[(secondIndex + 1) % second.length];

      if (segmentsIntersect(a, b, c, d)) {
        return true;
      }
    }
  }

  return false;
}

export function polygonEdgesProperlyIntersect(first, second) {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const a = first[firstIndex];
    const b = first[(firstIndex + 1) % first.length];

    for (
      let secondIndex = 0;
      secondIndex < second.length;
      secondIndex += 1
    ) {
      const c = second[secondIndex];
      const d = second[(secondIndex + 1) % second.length];

      if (segmentsProperlyIntersect(a, b, c, d)) {
        return true;
      }
    }
  }

  return false;
}
