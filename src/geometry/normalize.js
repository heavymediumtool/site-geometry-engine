/**
 * PATH: src/geometry/normalize.js
 * PURPOSE: Normalize compact and expanded geometry inputs into one canonical scene model.
 * TAGS: geometry, normalization, input-contract
 * ATTACHED: src/api/render.js, src/geometry/validate.js
 * CALLED_BY: src/api/render.js
 * CALLS/DEPENDS_ON: none
 * RUNTIME_ROLE: Input canonicalization
 * STATE_OWNERSHIP: Produces immutable-by-convention normalized scene data
 * SIGNALS/EVENTS: none
 */

export const SUPPORTED_SHAPES = Object.freeze([
  "circle",
  "square",
  "diamond",
  "triangle",
  "hexagon",
]);

export const SUPPORTED_PATTERNS = Object.freeze([
  "solid",
  "none",
  "diagonal",
  "reverse-diagonal",
  "crosshatch",
  "horizontal",
  "vertical",
  "dots",
]);

const DEFAULT_STYLE = Object.freeze({
  fill: "#4f8f5b",
  opacity: 0.4,
  stroke: "#1f3f26",
  strokeWidth: 1.5,
  pattern: "solid",
});

function toFiniteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return Number.NaN;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function normalizeBoundary(rawBoundary) {
  if (!Array.isArray(rawBoundary)) {
    return [];
  }

  const normalized = rawBoundary.map((rawPoint, index) => {
    if (Array.isArray(rawPoint)) {
      return {
        name: `P${index + 1}`,
        x: toFiniteNumber(rawPoint[0]),
        y: toFiniteNumber(rawPoint[1]),
      };
    }

    const point = rawPoint && typeof rawPoint === "object" ? rawPoint : {};
    return {
      name: String(point.name ?? `P${index + 1}`),
      x: toFiniteNumber(point.x),
      y: toFiniteNumber(point.y),
    };
  });

  if (
    normalized.length >= 2 &&
    samePoint(normalized[0], normalized[normalized.length - 1])
  ) {
    normalized.pop();
  }

  return normalized;
}

function normalizeStyle(rawStyle) {
  const style = rawStyle && typeof rawStyle === "object" ? rawStyle : {};

  return {
    fill: String(style.fill ?? DEFAULT_STYLE.fill),
    opacity:
      style.opacity === undefined
        ? DEFAULT_STYLE.opacity
        : toFiniteNumber(style.opacity),
    stroke: String(style.stroke ?? DEFAULT_STYLE.stroke),
    strokeWidth:
      style.strokeWidth === undefined
        ? DEFAULT_STYLE.strokeWidth
        : toFiniteNumber(style.strokeWidth),
    pattern: String(style.pattern ?? DEFAULT_STYLE.pattern).toLowerCase(),
  };
}

function normalizeExpandedObject(rawObject, index) {
  const object =
    rawObject && typeof rawObject === "object" && !Array.isArray(rawObject)
      ? rawObject
      : {};

  const pointTuple = Array.isArray(object.point) ? object.point : null;
  const centerTuple = Array.isArray(object.center) ? object.center : null;

  const x = toFiniteNumber(
    pointTuple?.[0] ?? centerTuple?.[0] ?? object.x,
  );
  const y = toFiniteNumber(
    pointTuple?.[1] ?? centerTuple?.[1] ?? object.y,
  );
  const size = toFiniteNumber(
    pointTuple?.[2] ?? object.size ?? object.diameter,
  );

  return {
    name: String(object.name ?? `O${index + 1}`),
    center: { x, y },
    size,
    shape: String(object.shape ?? "circle").toLowerCase(),
    style: normalizeStyle(object.style),
  };
}

export function normalizeObjects(rawObjects) {
  if (!Array.isArray(rawObjects)) {
    return [];
  }

  return rawObjects.map((rawObject, index) => {
    if (Array.isArray(rawObject)) {
      return {
        name: `O${index + 1}`,
        center: {
          x: toFiniteNumber(rawObject[0]),
          y: toFiniteNumber(rawObject[1]),
        },
        size: toFiniteNumber(rawObject[2]),
        shape: "circle",
        style: normalizeStyle(null),
      };
    }

    return normalizeExpandedObject(rawObject, index);
  });
}

export function normalizeSceneInput(rawInput) {
  const input =
    rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
      ? rawInput
      : {};

  return {
    boundary: normalizeBoundary(input.boundary),
    objects: normalizeObjects(input.objects),
  };
}
