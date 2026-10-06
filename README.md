# site-geometry-engine

Cloudflare Worker for validating, analyzing, and rendering 2D site geometry from coordinate-based inputs.

## Current status

Version: `0.0.1`

The repository-to-Cloudflare deployment connection is established and verified.

Production Worker:

`https://site-geometry-engine.allaboutstudios.workers.dev`

Health check:

`GET /health`

Current health response:

```json
{
  "ok": true,
  "service": "site-geometry-engine",
  "version": "0.0.1",
  "phase": "github-cloudflare-connection-test",
  "path": "/health"
}
```

## Planned geometry contract

The engine will accept:

- an ordered exterior boundary as 2D coordinates;
- named interior objects;
- a compact `(x, y, z)` object form where `x, y` is the object center and `z` is its nominal size;
- shape, fill, opacity, stroke, and pattern metadata.

The engine will return validated geometry metadata plus an SVG coordinate graph.

## Initial architecture

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
RENDER
  ↓
JSON + SVG
```

The coordinate model, not the SVG, will remain the source of truth.
