# site-geometry-engine

Cloudflare Worker for validating, analyzing, and rendering 2D site geometry from coordinate-based inputs.

## Status

Version: `0.2.0`

Production Worker:

`https://site-geometry-engine.allaboutstudios.workers.dev`

Health check:

`GET /health`

## API

### `POST /geometry/render`

Accepts an ordered exterior boundary and interior objects, then returns normalized geometry, validation/containment metadata, overlap metadata, calculated bounds, warnings, and SVG.

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

The boundary can now be supplied as a closed traverse instead of explicit XY coordinates.

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

The segments must represent every edge of the closed area, including the final measured leg back toward the starting point. Because field measurements rarely close perfectly, the engine keeps the supplied lengths fixed and adjusts headings with an iterative least-squares closure solution.

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
