/**
 * PATH: src/render/svg.js
 * PURPOSE: Render analyzed scene geometry to a coordinate-preserving SVG graph.
 * TAGS: svg, rendering, graph, patterns, labels
 * ATTACHED: src/geometry/shapes.js, src/api/render.js
 * CALLED_BY: src/api/render.js
 * CALLS/DEPENDS_ON: shapes.js
 * RUNTIME_ROLE: SVG renderer
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: none
 */

import {
  objectRadius,
  objectVertices,
} from "../geometry/shapes.js";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  if (Math.abs(value) < 1e-10) {
    return "0";
  }

  return Number(value.toFixed(6)).toString();
}

function niceStep(span) {
  const rough = span / 10;
  const exponent = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / exponent;

  if (fraction <= 1) {
    return exponent;
  }

  if (fraction <= 2) {
    return 2 * exponent;
  }

  if (fraction <= 5) {
    return 5 * exponent;
  }

  return 10 * exponent;
}

function tickValues(minimum, maximum, step) {
  const values = [];
  const first = Math.ceil(minimum / step) * step;

  for (
    let value = first;
    value <= maximum + step * 1e-9;
    value += step
  ) {
    values.push(Number(value.toFixed(10)));
  }

  return values;
}

function polygonPoints(points) {
  return points
    .map((point) => `${formatNumber(point.x)},${formatNumber(point.y)}`)
    .join(" ");
}

function patternMarkup(object, patternScale) {
  if (
    object.style.pattern === "solid" ||
    object.style.pattern === "none"
  ) {
    return "";
  }

  const id = `pattern-${object._renderIndex}`;
  const size = patternScale;
  const half = size / 2;
  const fill = escapeXml(object.style.fill);
  const stroke = escapeXml(object.style.stroke);
  const opacity = formatNumber(object.style.opacity);

  const background = `<rect width="${formatNumber(size)}" height="${formatNumber(size)}" fill="${fill}" fill-opacity="${opacity}"/>`;

  let marks = "";

  switch (object.style.pattern) {
    case "diagonal":
      marks = `<path d="M ${formatNumber(-half)} ${formatNumber(size)} L ${formatNumber(size)} ${formatNumber(-half)} M 0 ${formatNumber(size + half)} L ${formatNumber(size + half)} 0" stroke="${stroke}" stroke-width="${formatNumber(size * 0.12)}"/>`;
      break;

    case "reverse-diagonal":
      marks = `<path d="M ${formatNumber(-half)} 0 L ${formatNumber(size)} ${formatNumber(size + half)} M 0 ${formatNumber(-half)} L ${formatNumber(size + half)} ${formatNumber(size)}" stroke="${stroke}" stroke-width="${formatNumber(size * 0.12)}"/>`;
      break;

    case "crosshatch":
      marks = `<path d="M ${formatNumber(-half)} ${formatNumber(size)} L ${formatNumber(size)} ${formatNumber(-half)} M 0 ${formatNumber(size + half)} L ${formatNumber(size + half)} 0 M ${formatNumber(-half)} 0 L ${formatNumber(size)} ${formatNumber(size + half)} M 0 ${formatNumber(-half)} L ${formatNumber(size + half)} ${formatNumber(size)}" stroke="${stroke}" stroke-width="${formatNumber(size * 0.1)}"/>`;
      break;

    case "horizontal":
      marks = `<path d="M 0 ${formatNumber(half)} L ${formatNumber(size)} ${formatNumber(half)}" stroke="${stroke}" stroke-width="${formatNumber(size * 0.12)}"/>`;
      break;

    case "vertical":
      marks = `<path d="M ${formatNumber(half)} 0 L ${formatNumber(half)} ${formatNumber(size)}" stroke="${stroke}" stroke-width="${formatNumber(size * 0.12)}"/>`;
      break;

    case "dots":
      marks = `<circle cx="${formatNumber(half)}" cy="${formatNumber(half)}" r="${formatNumber(size * 0.12)}" fill="${stroke}"/>`;
      break;

    default:
      break;
  }

  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${formatNumber(size)}" height="${formatNumber(size)}">${background}${marks}</pattern>`;
}

function objectFill(object) {
  if (object.style.pattern === "none") {
    return "none";
  }

  if (object.style.pattern === "solid") {
    return escapeXml(object.style.fill);
  }

  return `url(#pattern-${object._renderIndex})`;
}

function objectFillOpacity(object) {
  return object.style.pattern === "solid"
    ? formatNumber(object.style.opacity)
    : "1";
}

function renderObjectShape(object) {
  const common = [
    `fill="${objectFill(object)}"`,
    `fill-opacity="${objectFillOpacity(object)}"`,
    `stroke="${escapeXml(object.style.stroke)}"`,
    `stroke-width="${formatNumber(object.style.strokeWidth)}"`,
    `vector-effect="non-scaling-stroke"`,
  ].join(" ");

  if (object.shape === "circle") {
    return `<circle cx="${formatNumber(object.center.x)}" cy="${formatNumber(object.center.y)}" r="${formatNumber(objectRadius(object))}" ${common}/>`;
  }

  return `<polygon points="${polygonPoints(objectVertices(object))}" ${common}/>`;
}

function renderGrid(viewBounds) {
  const step = niceStep(viewBounds.width);
  const xTicks = tickValues(
    viewBounds.minX,
    viewBounds.maxX,
    step,
  );
  const yTicks = tickValues(
    viewBounds.minY,
    viewBounds.maxY,
    step,
  );

  const verticalLines = xTicks
    .map(
      (x) =>
        `<line x1="${formatNumber(x)}" y1="${formatNumber(viewBounds.minY)}" x2="${formatNumber(x)}" y2="${formatNumber(viewBounds.maxY)}"/>`,
    )
    .join("");

  const horizontalLines = yTicks
    .map(
      (y) =>
        `<line x1="${formatNumber(viewBounds.minX)}" y1="${formatNumber(y)}" x2="${formatNumber(viewBounds.maxX)}" y2="${formatNumber(y)}"/>`,
    )
    .join("");

  const axisLines = [
    viewBounds.minY <= 0 && viewBounds.maxY >= 0
      ? `<line class="axis" x1="${formatNumber(viewBounds.minX)}" y1="0" x2="${formatNumber(viewBounds.maxX)}" y2="0"/>`
      : "",
    viewBounds.minX <= 0 && viewBounds.maxX >= 0
      ? `<line class="axis" x1="0" y1="${formatNumber(viewBounds.minY)}" x2="0" y2="${formatNumber(viewBounds.maxY)}"/>`
      : "",
  ].join("");

  return {
    step,
    xTicks,
    yTicks,
    flippedMarkup: `<g class="grid">${verticalLines}${horizontalLines}${axisLines}</g>`,
  };
}

function renderTickLabels(grid, viewBounds) {
  const fontSize = Math.max(viewBounds.width / 45, 0.18);
  const xY = -viewBounds.minY - fontSize * 0.65;
  const yX = viewBounds.minX + fontSize * 0.35;

  const xLabels = grid.xTicks
    .map(
      (x) =>
        `<text x="${formatNumber(x)}" y="${formatNumber(xY)}" text-anchor="middle">${escapeXml(formatNumber(x))}</text>`,
    )
    .join("");

  const yLabels = grid.yTicks
    .map(
      (y) =>
        `<text x="${formatNumber(yX)}" y="${formatNumber(-y + fontSize * 0.35)}" text-anchor="start">${escapeXml(formatNumber(y))}</text>`,
    )
    .join("");

  return `<g class="tick-labels" font-size="${formatNumber(fontSize)}">${xLabels}${yLabels}</g>`;
}

function renderBoundaryLabels(boundary, viewBounds) {
  const fontSize = Math.max(viewBounds.width / 40, 0.2);
  const offset = fontSize * 0.55;

  return boundary
    .map(
      (point) =>
        `<g><circle cx="${formatNumber(point.x)}" cy="${formatNumber(-point.y)}" r="${formatNumber(fontSize * 0.18)}" class="point-marker"/><text x="${formatNumber(point.x + offset)}" y="${formatNumber(-point.y - offset)}" font-size="${formatNumber(fontSize)}">${escapeXml(point.name)}</text></g>`,
    )
    .join("");
}

function renderObjectLabels(objects, viewBounds) {
  const fontSize = Math.max(viewBounds.width / 38, 0.22);

  return objects
    .map(
      (object) =>
        `<text x="${formatNumber(object.center.x)}" y="${formatNumber(-object.center.y + fontSize * 0.35)}" font-size="${formatNumber(fontSize)}" text-anchor="middle" class="object-label">${escapeXml(object.name)}</text>`,
    )
    .join("");
}

export function renderSvg(scene) {
  const { boundary, objects, viewBounds } = scene;
  const renderObjects = objects.map((object, index) => ({
    ...object,
    _renderIndex: index + 1,
  }));

  const patternScale = Math.max(viewBounds.width / 50, 0.08);
  const patterns = renderObjects
    .map((object) => patternMarkup(object, patternScale))
    .join("");

  const grid = renderGrid(viewBounds);
  const boundaryPolygon = `<polygon points="${polygonPoints(boundary)}" class="boundary"/>`;
  const objectShapes = renderObjects
    .map(renderObjectShape)
    .join("");

  const svgViewBox = [
    formatNumber(viewBounds.minX),
    formatNumber(-viewBounds.maxY),
    formatNumber(viewBounds.width),
    formatNumber(viewBounds.height),
  ].join(" ");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgViewBox}" role="img" aria-label="Coordinate geometry map">`,
    `<defs>${patterns}</defs>`,
    `<style>`,
    `.grid line{stroke:#cbd5e1;stroke-width:1;vector-effect:non-scaling-stroke}.grid .axis{stroke:#64748b;stroke-width:1.5}.boundary{fill:none;stroke:#111827;stroke-width:2;vector-effect:non-scaling-stroke}.tick-labels,.object-label,text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;fill:#111827}.object-label{font-weight:700}.point-marker{fill:#111827}`,
    `</style>`,
    `<g transform="scale(1 -1)">`,
    grid.flippedMarkup,
    boundaryPolygon,
    objectShapes,
    `</g>`,
    renderTickLabels(grid, viewBounds),
    renderBoundaryLabels(boundary, viewBounds),
    renderObjectLabels(objects, viewBounds),
    `</svg>`,
  ].join("");
}
