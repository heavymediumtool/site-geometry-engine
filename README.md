# site-geometry-engine

Cloudflare Worker for validating, analyzing, and rendering 2D site geometry from coordinate-based inputs.

## Status

Version: `0.1.0`

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
