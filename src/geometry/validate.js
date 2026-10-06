/**
 * PATH: src/geometry/validate.js
 * PURPOSE: Validate the normalized scene contract before geometric analysis or rendering.
 * TAGS: geometry, validation, contract
 * ATTACHED: src/geometry/normalize.js, src/geometry/polygon.js
 * CALLED_BY: src/api/render.js
 * CALLS/DEPENDS_ON: normalize.js constants, polygon.js primitives
 * RUNTIME_ROLE: Input validation gate
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: none
 */

import {
  SUPPORTED_PATTERNS,
  SUPPORTED_SHAPES,
} from "./normalize.js";
import {
  pointInPolygon,
  polygonSelfIntersects,
  signedPolygonArea,
} from "./polygon.js";

function finitePoint(point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function findDuplicateNames(items) {
  const counts = new Map();

  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

export function validateScene(scene) {
  const errors = [];

  if (scene.boundary.length < 3) {
    errors.push({
      code: "boundary_too_small",
      message: "Boundary must contain at least three points.",
    });
  }

  scene.boundary.forEach((point, index) => {
    if (!finitePoint(point)) {
      errors.push({
        code: "boundary_coordinate_invalid",
        message: `Boundary point ${point.name || `#${index + 1}`} must contain finite x and y coordinates.`,
      });
    }
  });

  if (
    scene.boundary.length >= 3 &&
    scene.boundary.every(finitePoint)
  ) {
    if (polygonSelfIntersects(scene.boundary)) {
      errors.push({
        code: "boundary_self_intersection",
        message: "Boundary edges must not self-intersect.",
      });
    } else if (Math.abs(signedPolygonArea(scene.boundary)) <= 1e-9) {
      errors.push({
        code: "boundary_zero_area",
        message: "Boundary must enclose a nonzero area.",
      });
    }
  }

  const duplicateBoundaryNames = findDuplicateNames(scene.boundary);
  for (const name of duplicateBoundaryNames) {
    errors.push({
      code: "boundary_name_duplicate",
      message: `Boundary point name "${name}" is duplicated.`,
    });
  }

  const duplicateObjectNames = findDuplicateNames(scene.objects);
  for (const name of duplicateObjectNames) {
    errors.push({
      code: "object_name_duplicate",
      message: `Object name "${name}" is duplicated.`,
    });
  }

  for (const object of scene.objects) {
    if (!finitePoint(object.center)) {
      errors.push({
        code: "object_center_invalid",
        object: object.name,
        message: `Object "${object.name}" must contain finite center coordinates.`,
      });
    }

    if (!Number.isFinite(object.size) || object.size <= 0) {
      errors.push({
        code: "object_size_invalid",
        object: object.name,
        message: `Object "${object.name}" must have a size greater than zero.`,
      });
    }

    if (!SUPPORTED_SHAPES.includes(object.shape)) {
      errors.push({
        code: "object_shape_unsupported",
        object: object.name,
        message: `Object "${object.name}" uses unsupported shape "${object.shape}".`,
      });
    }

    if (!SUPPORTED_PATTERNS.includes(object.style.pattern)) {
      errors.push({
        code: "object_pattern_unsupported",
        object: object.name,
        message: `Object "${object.name}" uses unsupported pattern "${object.style.pattern}".`,
      });
    }

    if (
      !Number.isFinite(object.style.opacity) ||
      object.style.opacity < 0 ||
      object.style.opacity > 1
    ) {
      errors.push({
        code: "object_opacity_invalid",
        object: object.name,
        message: `Object "${object.name}" opacity must be between 0 and 1.`,
      });
    }

    if (
      !Number.isFinite(object.style.strokeWidth) ||
      object.style.strokeWidth < 0
    ) {
      errors.push({
        code: "object_stroke_width_invalid",
        object: object.name,
        message: `Object "${object.name}" strokeWidth must be zero or greater.`,
      });
    }

    if (
      scene.boundary.length >= 3 &&
      scene.boundary.every(finitePoint) &&
      finitePoint(object.center) &&
      !pointInPolygon(object.center, scene.boundary)
    ) {
      errors.push({
        code: "object_center_outside_boundary",
        object: object.name,
        message: `Object "${object.name}" center lies outside the boundary.`,
      });
    }
  }

  return errors;
}
