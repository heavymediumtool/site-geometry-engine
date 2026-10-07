# site-geometry-engine

Cloudflare Worker for validating, analyzing, and rendering 2D site geometry from coordinate-based inputs.

## Status

Version: `0.3.0`

Production Worker:

`https://site-geometry-engine.allaboutstudios.workers.dev`

Health check:

`GET /health`

## API

### `POST /geometry/render`

Accepts an ordered exterior boundary and interior objects, then returns normalized geometry, deterministic boundary measurements, validation/containment metadata, overlap metadata, calculated bounds, warnings, and SVG.

Minimal input:

```json
{
  "boundary": [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ],
  "objects": [
    [5, 5, 2]
  ]
}
```

The compact object tuple is interpreted as:

`[centerX, centerY, nominalSize]`

For a circle, `nominalSize` is the diameter.

Expanded object input:

```json
{
  "name": "TREE_01",
  "center": [5, 5],
  "size": 2,
  "shape": "circle",
  "style": {
    "fill": "#4f8f5b",
    "opacity": 0.4,
    "stroke": "#1f3f26",
    "strokeWidth": 1.5,
    "pattern": "diagonal"
  }
}
```

Supported shapes:

- `circle`
- `square`
- `diamond`
- `triangle`
- `hexagon`

Supported patterns:

- `solid`
- `none`
- `diagonal`
- `reverse-diagonal`
- `crosshatch`
- `horizontal`
- `vertical`
- `dots`

### `POST /geometry/render.svg`

Accepts the same JSON contract and returns the SVG directly as `image/svg+xml`.

### `GET /demo`

Returns the canonical 10×10 boundary with a diameter-2 circle centered at `(5,5)`.

### `GET /demo.svg`

Returns the same demonstration as a 900×900 SVG coordinate graph.

### `GET /demo/complex`

Returns an irregular named boundary plus six styled objects demonstrating circles, square, diamond, triangle, hexagon, transparency, and fill patterns.

### `GET /demo/complex.svg`

Returns the complex demonstration directly as SVG.

## Geometry rules

- Exterior coordinates are connected in supplied order and automatically closed.
- The caller does not need to repeat the first boundary point at the end.
- Boundary and object names are generated as `P1`, `P2`, ... and `O1`, `O2`, ... when omitted.
- Supplied names are retained.
- Positive Y is always up in the geometry model.
- X and Y share the same rendering scale.
- Object centers must lie inside or on the boundary.
- An object may extend beyond the boundary; that produces a warning rather than invalidating the scene.
- SVG is a rendering output only. The normalized coordinate scene is the source of truth.
- Successful JSON responses include `measurements` with polygon area, boundary perimeter, bounding width/height, and per-edge length plus phone-compass heading. Traverse measurements preserve the traverse's declared units; coordinate-only inputs report `input-units`.

## Architecture

```text
INPUT
  ↓
NORMALIZE
  ↓
VALIDATE
  ↓
GEOMETRY MODEL
  ↓
ANALYZE
  ↓
BOUNDS
  ↓
RENDER
  ↓
JSON + SVG
```

Source layout:

```text
src/
  api/
    render.js
  geometry/
    analyze.js
    bounds.js
    normalize.js
    polygon.js
    shapes.js
    validate.js
  render/
    svg.js
  index.js

test/
  geometry.test.js
  http.test.js
```

## Development

Run the regression suite:

```bash
npm test
```

Deploy:

```bash
npm run deploy
```

Cloudflare Builds is connected to the GitHub `main` branch.


## Length + compass-heading traverse input

The boundary can be supplied from compass traverse measurements instead of explicit XY coordinates.

Phone-compass convention is used:

- `0°` = north
- `90°` = east
- `180°` = south
- `270°` = west
- headings increase clockwise

Compact example:

```json
{
  "traverse": {
    "units": "ft",
    "start": [0, 0],
    "segments": [
      [10, 90],
      [10, 182],
      [10, 270],
      [10, 0]
    ]
  },
  "objects": []
}
```

Each compact segment is:

```text
[length, compassHeadingDegrees]
```

Traverse input has two explicit modes:

### `closed_adjustable`

This is the default and is for a true measured closed traverse. Every supplied leg is intended to be a measured perimeter edge, including the final measured leg back toward the start.

Because field measurements rarely close perfectly, the engine keeps supplied lengths fixed and may adjust headings with an iterative least-squares closure solution.

### `append_closing_segment`

Use this when the supplied legs are measured sequentially and the instruction is to connect the final measured point back to the origin/start.

In this mode the measured lengths and headings are preserved exactly. The engine does not reinterpret the remaining distance as measurement error. Instead it computes one synthetic closing segment from the final measured point back to the starting point.

Example:

```json
{
  "traverse": {
    "mode": "append_closing_segment",
    "units": "ft",
    "start": [0, 0],
    "segments": [
      [13, 135],
      [10, 90],
      [20, 30],
      [28, 270]
    ]
  },
  "objects": []
}
```

For that example the four measured legs remain exactly 135°, 90°, 30°, and 270°. The engine appends a synthetic closing leg of about 8.2151 ft at 188.3457°. The response distinguishes `measuredLength`, `boundaryPerimeter`, the measured geometry, and `appendedClosingSegment`.

`closeToStart: true` is accepted as a convenience alias for `mode: "append_closing_segment"`.

The JSON response includes both the raw and corrected traverse:

- raw points and segment endpoints;
- raw closure vector and closure distance;
- relative closure and closure precision;
- corrected heading for every segment;
- heading correction applied to every segment;
- corrected closure error;
- maximum and RMS heading correction;
- warnings when correction is material.

Expanded segments may be named:

```json
{
  "traverse": {
    "start": [100, 200],
    "units": "ft",
    "segments": [
      {
        "name": "Front",
        "pointName": "A",
        "length": 42.6,
        "headingDeg": 86.4
      }
    ]
  }
}
```

Correction settings are optional:

```json
{
  "correction": {
    "mode": "auto",
    "warningHeadingCorrectionDeg": 3,
    "maxHeadingCorrectionDeg": 20,
    "toleranceDistance": 0.000001
  }
}
```

Set `mode` to `none` to reject a traverse that does not close instead of correcting it.

The correction system deliberately does not hide bad observations. A correction larger than the configured maximum is rejected and returned with candidate correction diagnostics so the field measurements can be checked.

### Important limitation

Closure detects relative inconsistencies between headings. It cannot detect a uniform compass bias. If every heading is wrong by the same +6°, for example, the entire polygon is simply rotated by 6° and can still close perfectly. Without an external reference direction, there is no mathematical evidence from the traverse alone that the common offset is wrong.

### Traverse demonstrations

- `GET /demo/traverse`
- `GET /demo/traverse.svg`

The demonstration intentionally includes a small heading inconsistency so the returned diagnostics show the correction process.
