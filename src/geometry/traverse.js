/**
 * PATH: src/geometry/traverse.js
 * PURPOSE: Convert closed-traverse length/compass-heading observations into a corrected boundary.
 * TAGS: geometry, traverse, compass, survey, closure-adjustment
 * ATTACHED: src/api/render.js, test/geometry.test.js
 * CALLED_BY: src/api/render.js
 * CALLS/DEPENDS_ON: none
 * RUNTIME_ROLE: Traverse normalization and heading-only closure adjustment
 * STATE_OWNERSHIP: Produces raw/corrected traverse diagnostics and boundary coordinates
 * SIGNALS/EVENTS: none
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const DEFAULT_MAX_ITERATIONS = 30;
const DEFAULT_MAX_HEADING_CORRECTION_DEG = 20;
const DEFAULT_WARNING_HEADING_CORRECTION_DEG = 3;
const MATRIX_EPSILON = 1e-18;

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

function normalizeHeadingDeg(value) {
  const number = toFiniteNumber(value);
  if (!Number.isFinite(number)) {
    return Number.NaN;
  }

  return ((number % 360) + 360) % 360;
}

function shortestAngleDifferenceDeg(to, from) {
  let difference = normalizeHeadingDeg(to) - normalizeHeadingDeg(from);

  if (difference > 180) {
    difference -= 360;
  }

  if (difference <= -180) {
    difference += 360;
  }

  return difference;
}

function normalizeStart(rawStart) {
  if (rawStart === undefined) {
    return { x: 0, y: 0 };
  }

  if (Array.isArray(rawStart)) {
    return {
      x: toFiniteNumber(rawStart[0]),
      y: toFiniteNumber(rawStart[1]),
    };
  }

  const start =
    rawStart && typeof rawStart === "object" ? rawStart : {};

  return {
    x: toFiniteNumber(start.x),
    y: toFiniteNumber(start.y),
  };
}

function normalizeSegments(rawSegments) {
  if (!Array.isArray(rawSegments)) {
    return [];
  }

  return rawSegments.map((rawSegment, index) => {
    if (Array.isArray(rawSegment)) {
      return {
        name: `S${index + 1}`,
        pointName: `P${index + 1}`,
        length: toFiniteNumber(rawSegment[0]),
        inputHeadingDeg: normalizeHeadingDeg(rawSegment[1]),
      };
    }

    const segment =
      rawSegment && typeof rawSegment === "object" ? rawSegment : {};

    return {
      name: String(segment.name ?? `S${index + 1}`),
      pointName: String(segment.pointName ?? `P${index + 1}`),
      length: toFiniteNumber(segment.length),
      inputHeadingDeg: normalizeHeadingDeg(
        segment.headingDeg ?? segment.heading,
      ),
    };
  });
}

function displacement(length, headingRad) {
  return {
    dx: length * Math.sin(headingRad),
    dy: length * Math.cos(headingRad),
  };
}

function closureFromHeadings(segments, headingsRad) {
  let dx = 0;
  let dy = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const next = displacement(
      segments[index].length,
      headingsRad[index],
    );
    dx += next.dx;
    dy += next.dy;
  }

  return {
    dx,
    dy,
    distance: Math.hypot(dx, dy),
  };
}

function buildSegmentGeometry(segments, headingsRad, start) {
  let cursor = { ...start };
  const points = [];
  const outputSegments = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const vector = displacement(segment.length, headingsRad[index]);
    const from = { ...cursor };
    const to = {
      x: from.x + vector.dx,
      y: from.y + vector.dy,
    };

    points.push({
      name: segment.pointName,
      x: from.x,
      y: from.y,
    });

    outputSegments.push({
      name: segment.name,
      pointName: segment.pointName,
      length: segment.length,
      inputHeadingDeg: segment.inputHeadingDeg,
      headingDeg: normalizeHeadingDeg(
        headingsRad[index] * RAD_TO_DEG,
      ),
      headingCorrectionDeg: shortestAngleDifferenceDeg(
        headingsRad[index] * RAD_TO_DEG,
        segment.inputHeadingDeg,
      ),
      from,
      to,
    });

    cursor = to;
  }

  return {
    points,
    segments: outputSegments,
    end: cursor,
  };
}

function solveHeadingClosure(
  segments,
  initialHeadingsRad,
  toleranceDistance,
) {
  const headings = [...initialHeadingsRad];
  let iterations = 0;

  for (
    ;
    iterations < DEFAULT_MAX_ITERATIONS;
    iterations += 1
  ) {
    const closure = closureFromHeadings(segments, headings);

    if (closure.distance <= toleranceDistance) {
      return {
        ok: true,
        headings,
        iterations,
        closure,
      };
    }

    let m11 = 0;
    let m12 = 0;
    let m22 = 0;
    const derivatives = [];

    for (let index = 0; index < segments.length; index += 1) {
      const { length } = segments[index];
      const heading = headings[index];
      const dX = length * Math.cos(heading);
      const dY = -length * Math.sin(heading);

      derivatives.push({ dX, dY });
      m11 += dX * dX;
      m12 += dX * dY;
      m22 += dY * dY;
    }

    const determinant = m11 * m22 - m12 * m12;

    if (Math.abs(determinant) <= MATRIX_EPSILON) {
      return {
        ok: false,
        code: "traverse_heading_solution_singular",
        message:
          "Heading-only closure adjustment is singular for this traverse geometry.",
        iterations,
        closure,
      };
    }

    const inverseClosureX =
      (m22 * closure.dx - m12 * closure.dy) / determinant;
    const inverseClosureY =
      (-m12 * closure.dx + m11 * closure.dy) / determinant;

    const delta = derivatives.map(
      ({ dX, dY }) =>
        -(dX * inverseClosureX + dY * inverseClosureY),
    );

    let scale = 1;
    let accepted = false;

    while (scale >= 1 / 1024) {
      const candidate = headings.map(
        (heading, index) => heading + delta[index] * scale,
      );
      const candidateClosure = closureFromHeadings(
        segments,
        candidate,
      );

      if (candidateClosure.distance < closure.distance) {
        for (
          let index = 0;
          index < headings.length;
          index += 1
        ) {
          headings[index] = candidate[index];
        }

        accepted = true;
        break;
      }

      scale /= 2;
    }

    if (!accepted) {
      return {
        ok: false,
        code: "traverse_heading_solution_stalled",
        message:
          "Heading-only closure adjustment could not reduce the traverse closure error.",
        iterations,
        closure,
      };
    }
  }

  const closure = closureFromHeadings(segments, headings);

  return {
    ok: closure.distance <= toleranceDistance,
    code: "traverse_heading_solution_not_converged",
    message:
      "Heading-only closure adjustment did not converge within the iteration limit.",
    headings,
    iterations,
    closure,
  };
}

function validateTraverse(start, segments) {
  const errors = [];

  if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) {
    errors.push({
      code: "traverse_start_invalid",
      message:
        "Traverse start must contain finite x and y coordinates.",
    });
  }

  if (segments.length < 3) {
    errors.push({
      code: "traverse_too_small",
      message:
        "Traverse must contain at least three boundary segments.",
    });
  }

  for (const segment of segments) {
    if (!Number.isFinite(segment.length) || segment.length <= 0) {
      errors.push({
        code: "traverse_length_invalid",
        segment: segment.name,
        message: `Traverse segment "${segment.name}" must have a length greater than zero.`,
      });
    }

    if (!Number.isFinite(segment.inputHeadingDeg)) {
      errors.push({
        code: "traverse_heading_invalid",
        segment: segment.name,
        message: `Traverse segment "${segment.name}" must have a finite compass heading in degrees.`,
      });
    }
  }

  if (errors.length === 0) {
    const perimeter = segments.reduce(
      (sum, segment) => sum + segment.length,
      0,
    );
    const longest = Math.max(
      ...segments.map((segment) => segment.length),
    );

    if (longest >= perimeter - longest - 1e-9) {
      errors.push({
        code: "traverse_lengths_cannot_form_area",
        message:
          "The supplied lengths cannot form a nondegenerate closed polygon while keeping every length fixed.",
      });
    }
  }

  return errors;
}

function correctionSettings(rawCorrection, perimeter) {
  const correction =
    rawCorrection && typeof rawCorrection === "object"
      ? rawCorrection
      : {};
  const rawMode = String(correction.mode ?? "auto").toLowerCase();
  const mode =
    rawMode === "none" ? "none" : "heading_least_squares";

  const toleranceCandidate = toFiniteNumber(
    correction.toleranceDistance,
  );
  const maxCandidate = toFiniteNumber(
    correction.maxHeadingCorrectionDeg,
  );
  const warningCandidate = toFiniteNumber(
    correction.warningHeadingCorrectionDeg,
  );

  return {
    mode,
    toleranceDistance:
      Number.isFinite(toleranceCandidate) &&
      toleranceCandidate > 0
        ? toleranceCandidate
        : Math.max(perimeter * 1e-9, 1e-8),
    maxHeadingCorrectionDeg:
      Number.isFinite(maxCandidate) && maxCandidate > 0
        ? maxCandidate
        : DEFAULT_MAX_HEADING_CORRECTION_DEG,
    warningHeadingCorrectionDeg:
      Number.isFinite(warningCandidate) && warningCandidate >= 0
        ? warningCandidate
        : DEFAULT_WARNING_HEADING_CORRECTION_DEG,
  };
}

function closurePrecision(perimeter, closureDistance) {
  if (closureDistance <= 1e-12) {
    return null;
  }

  return perimeter / closureDistance;
}

export function buildBoundaryFromTraverse(rawTraverse) {
  const traverse =
    rawTraverse && typeof rawTraverse === "object"
      ? rawTraverse
      : {};
  const start = normalizeStart(traverse.start);
  const segments = normalizeSegments(traverse.segments);
  const errors = validateTraverse(start, segments);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const units = String(traverse.units ?? "input-units");
  const perimeter = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const settings = correctionSettings(
    traverse.correction,
    perimeter,
  );
  const rawHeadingsRad = segments.map(
    (segment) => segment.inputHeadingDeg * DEG_TO_RAD,
  );
  const rawClosure = closureFromHeadings(
    segments,
    rawHeadingsRad,
  );
  const rawGeometry = buildSegmentGeometry(
    segments,
    rawHeadingsRad,
    start,
  );

  let correctedHeadingsRad = rawHeadingsRad;
  let iterations = 0;

  if (rawClosure.distance > settings.toleranceDistance) {
    if (settings.mode === "none") {
      return {
        ok: false,
        errors: [
          {
            code: "traverse_not_closed",
            message:
              "Traverse does not close within tolerance and correction mode is disabled.",
          },
        ],
        traverse: {
          units,
          start,
          perimeter,
          raw: {
            ...rawGeometry,
            closure: rawClosure,
            relativeClosure: rawClosure.distance / perimeter,
            closurePrecision: closurePrecision(
              perimeter,
              rawClosure.distance,
            ),
          },
        },
      };
    }

    const solved = solveHeadingClosure(
      segments,
      rawHeadingsRad,
      settings.toleranceDistance,
    );

    if (!solved.ok) {
      return {
        ok: false,
        errors: [
          {
            code: solved.code,
            message: solved.message,
          },
        ],
        traverse: {
          units,
          start,
          perimeter,
          raw: {
            ...rawGeometry,
            closure: rawClosure,
            relativeClosure: rawClosure.distance / perimeter,
            closurePrecision: closurePrecision(
              perimeter,
              rawClosure.distance,
            ),
          },
        },
      };
    }

    correctedHeadingsRad = solved.headings;
    iterations = solved.iterations;
  }

  const correctedGeometry = buildSegmentGeometry(
    segments,
    correctedHeadingsRad,
    start,
  );
  const correctedClosure = closureFromHeadings(
    segments,
    correctedHeadingsRad,
  );
  const corrections = correctedGeometry.segments.map(
    (segment) => segment.headingCorrectionDeg,
  );
  const maxAbsCorrectionDeg = Math.max(
    ...corrections.map((value) => Math.abs(value)),
  );
  const rmsCorrectionDeg = Math.sqrt(
    corrections.reduce(
      (sum, value) => sum + value * value,
      0,
    ) / corrections.length,
  );

  if (
    maxAbsCorrectionDeg >
    settings.maxHeadingCorrectionDeg + 1e-9
  ) {
    return {
      ok: false,
      errors: [
        {
          code: "traverse_heading_correction_excessive",
          message: `Closing this traverse requires a heading correction of ${maxAbsCorrectionDeg.toFixed(3)}°, exceeding the configured ${settings.maxHeadingCorrectionDeg.toFixed(3)}° limit. Recheck the field observations or explicitly raise the limit.`,
        },
      ],
      traverse: {
        units,
        start,
        perimeter,
        raw: {
          ...rawGeometry,
          closure: rawClosure,
          relativeClosure: rawClosure.distance / perimeter,
          closurePrecision: closurePrecision(
            perimeter,
            rawClosure.distance,
          ),
        },
        candidateCorrection: {
          mode: settings.mode,
          iterations,
          maxAbsHeadingCorrectionDeg: maxAbsCorrectionDeg,
          rmsHeadingCorrectionDeg: rmsCorrectionDeg,
          segments: correctedGeometry.segments,
          closure: correctedClosure,
        },
      },
    };
  }

  const warnings = [];

  if (rawClosure.distance > settings.toleranceDistance) {
    warnings.push({
      code: "traverse_heading_correction_applied",
      message: `Traverse closure required heading adjustment. Raw closure error ${rawClosure.distance.toFixed(4)} ${units}; corrected closure error ${correctedClosure.distance.toExponential(3)} ${units}.`,
    });
  }

  if (
    maxAbsCorrectionDeg >
    settings.warningHeadingCorrectionDeg
  ) {
    warnings.push({
      code: "traverse_large_heading_correction",
      message: `At least one heading changed by more than ${settings.warningHeadingCorrectionDeg.toFixed(3)}°. Recheck the listed segment corrections before relying on the map for layout.`,
    });
  }

  return {
    ok: true,
    boundary: correctedGeometry.points,
    warnings,
    traverse: {
      units,
      inputMode: "length_heading_traverse",
      headingConvention: {
        zeroDeg: "north",
        eastDeg: 90,
        southDeg: 180,
        westDeg: 270,
        increases: "clockwise",
      },
      start,
      perimeter,
      raw: {
        ...rawGeometry,
        closure: rawClosure,
        relativeClosure: rawClosure.distance / perimeter,
        closurePrecision: closurePrecision(
          perimeter,
          rawClosure.distance,
        ),
      },
      correction: {
        mode: settings.mode,
        assumption:
          "segment lengths are held fixed; minimize total squared heading change subject to traverse closure",
        toleranceDistance: settings.toleranceDistance,
        maxHeadingCorrectionDeg:
          settings.maxHeadingCorrectionDeg,
        warningHeadingCorrectionDeg:
          settings.warningHeadingCorrectionDeg,
        iterations,
        maxAbsHeadingCorrectionDeg: maxAbsCorrectionDeg,
        rmsHeadingCorrectionDeg: rmsCorrectionDeg,
        applied:
          rawClosure.distance > settings.toleranceDistance,
        limitations: [
          "A uniform compass bias rotates the entire traverse and cannot be detected from closure alone.",
          "Closure does not uniquely identify which individual heading observation is wrong; corrections are the minimum-squared-change solution.",
        ],
      },
      corrected: {
        ...correctedGeometry,
        closure: correctedClosure,
        relativeClosure:
          correctedClosure.distance / perimeter,
        closurePrecision: closurePrecision(
          perimeter,
          correctedClosure.distance,
        ),
      },
    },
  };
}
