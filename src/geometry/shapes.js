/**
 * PATH: src/geometry/shapes.js
 * PURPOSE: Convert normalized scene objects into geometry primitives and extents.
 * TAGS: geometry, shapes, extents
 * ATTACHED: src/geometry/analyze.js, src/geometry/bounds.js, src/render/svg.js
 * CALLED_BY: src/geometry/analyze.js, src/geometry/bounds.js, src/render/svg.js
 * CALLS/DEPENDS_ON: none
 * RUNTIME_ROLE: Canonical shape geometry
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: none
 */

function regularPolygonVertices(center, radius, sides, startAngleRadians) {
  const vertices = [];

  for (let index = 0; index < sides; index += 1) {
    const angle =
      startAngleRadians + (index * Math.PI * 2) / sides;

    vertices.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }

  return vertices;
}

export function objectRadius(object) {
  return object.size / 2;
}

export function objectVertices(object) {
  const radius = objectRadius(object);

  switch (object.shape) {
    case "square":
      return [
        { x: object.center.x - radius, y: object.center.y - radius },
        { x: object.center.x + radius, y: object.center.y - radius },
        { x: object.center.x + radius, y: object.center.y + radius },
        { x: object.center.x - radius, y: object.center.y + radius },
      ];

    case "diamond":
      return [
        { x: object.center.x, y: object.center.y + radius },
        { x: object.center.x + radius, y: object.center.y },
        { x: object.center.x, y: object.center.y - radius },
        { x: object.center.x - radius, y: object.center.y },
      ];

    case "triangle":
      return regularPolygonVertices(
        object.center,
        radius,
        3,
        Math.PI / 2,
      );

    case "hexagon":
      return regularPolygonVertices(
        object.center,
        radius,
        6,
        0,
      );

    default:
      return [];
  }
}

export function objectExtents(object) {
  const radius = objectRadius(object);

  if (object.shape === "circle") {
    return {
      minX: object.center.x - radius,
      maxX: object.center.x + radius,
      minY: object.center.y - radius,
      maxY: object.center.y + radius,
    };
  }

  const vertices = objectVertices(object);
  return {
    minX: Math.min(...vertices.map((point) => point.x)),
    maxX: Math.max(...vertices.map((point) => point.x)),
    minY: Math.min(...vertices.map((point) => point.y)),
    maxY: Math.max(...vertices.map((point) => point.y)),
  };
}
