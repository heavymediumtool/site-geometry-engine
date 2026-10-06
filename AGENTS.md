# AGENTS.md

## Purpose

This repository is the durable source of truth for the **Site Geometry Engine**, a Cloudflare Worker that accepts coordinate-based site geometry, validates and analyzes it, and returns normalized geometry plus SVG graph output.

This file exists so future agents can recover the project's architecture, remote deployment relationship, operating rules, and verification workflow without depending on prior chat context.

## Project identity

- GitHub repository: `heavymediumtool/site-geometry-engine`
- Production branch: `main`
- Cloudflare Worker name: `site-geometry-engine`
- Production URL: `https://site-geometry-engine.allaboutstudios.workers.dev`
- Wrangler config: `wrangler.jsonc`
- Runtime entrypoint: `src/index.js`
- Current API generation: `0.1.x`

GitHub is the canonical code history. Cloudflare is the canonical deployed runtime.

## Agent operating rule

When asked to modify, inspect, test, or use this engine:

1. Inspect the current GitHub `main` branch before making assumptions.
2. Read this file and the current `README.md`.
3. Treat repository code as authoritative over remembered chat context.
4. Make focused, version-controlled changes.
5. Run the repository regression suite through Cloudflare Builds before considering a production code change complete.
6. Verify the deployed Worker after a successful build.
7. Report the commit SHA and deployed version when meaningful.

Do not overwrite newer repository changes merely because prior chat context describes an older implementation.

## Cloudflare interaction

Use the connected Cloudflare API integration when available.

Before using a Cloudflare API endpoint whose contract is not already known in the active session:

1. Search the Cloudflare OpenAPI specification.
2. Use the returned path and request schema exactly.
3. Use Cloudflare documentation for behavioral questions such as Git integration, build triggering, previews, or deployment semantics.

Do not guess Cloudflare endpoint shapes.

### Discover the current Worker configuration

Do not depend on hard-coded Cloudflare internal UUIDs in this file.

Instead, discover them from the API:

1. List Worker scripts and locate the script whose ID/name is `site-geometry-engine`.
2. Read its immutable Worker script tag.
3. Query the Worker Builds configuration and triggers using that tag.
4. Use the currently returned trigger/build identifiers.

This keeps the project recoverable even if a trigger, repository connection, or build token is replaced later.

### Source-control-first deployment

Normal production code changes should follow:

```text
edit repository
    ↓
commit to GitHub
    ↓
Cloudflare Builds clones that commit
    ↓
npm run check
    ↓
npx wrangler deploy
    ↓
verify production Worker
```

Avoid using the Worker Script upload API for ordinary code changes because it bypasses GitHub history and may be overwritten by the next repository deployment.

Direct Worker uploads are acceptable only for an explicit emergency/recovery operation, and any such change must subsequently be reconciled back into GitHub.

### Builds

The intended production build settings are:

- branch: `main`
- build command: `npm run check`
- deploy command: `npx wrangler deploy`
- root directory: `/`
- Worker name must match `site-geometry-engine`

If a GitHub-originated push does not automatically enqueue a Cloudflare build, it is acceptable to trigger the configured production build through the Cloudflare Builds API using the exact Git commit SHA.

A manually triggered build must still clone and build the GitHub commit. Do not substitute a direct script upload.

After triggering a build:

1. Read the build status.
2. Read the build logs.
3. Confirm all tests passed.
4. Confirm the deploy command succeeded.
5. Confirm the Worker reports the expected version.

## GitHub interaction

Use the connected GitHub integration when available.

Before editing:

- read the current `main` head;
- fetch the exact files being changed;
- preserve unrelated changes.

Prefer one coherent commit per logical milestone.

When moving `main`, use an expected-head/lease check when the API supports it. Never force-push over unexpected work.

The repository is public. Therefore **never commit secrets or private customer data**.

Do not commit:

- Cloudflare API tokens;
- build token secrets;
- authentication cookies;
- private customer/site datasets;
- credentials;
- private environment-variable values.

Configuration that is intentionally public, such as the Worker name and public production URL, may be documented.

## Current HTTP contract

### Health

`GET /health`

Returns service metadata, engine version, and currently advertised endpoints.

### Canonical demonstration

- `GET /demo`
- `GET /demo.svg`

Represents the canonical example:

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

The object is a diameter-2 circle centered on `(5,5)`.

### Complex demonstration

- `GET /demo/complex`
- `GET /demo/complex.svg`

Exercises the broader shape/style vocabulary.

### Render JSON + SVG

`POST /geometry/render`

Returns normalized geometry, analysis metadata, calculated bounds, warnings, overlap information, and an SVG string.

### Render SVG directly

`POST /geometry/render.svg`

Accepts the same input and returns `image/svg+xml`.

## Input model

### Boundary

Compact:

```json
{
  "boundary": [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ]
}
```

Expanded:

```json
{
  "boundary": [
    {"name": "SW", "x": 0, "y": 0},
    {"name": "SE", "x": 10, "y": 0},
    {"name": "NE", "x": 10, "y": 10},
    {"name": "NW", "x": 0, "y": 10}
  ]
}
```

Boundary coordinates are connected in supplied order and automatically closed. The caller does not need to repeat the first point.

### Objects

Compact:

```json
{
  "objects": [
    [5, 5, 2]
  ]
}
```

Compact tuples mean:

```text
[x, y, nominalSize]
```

For a circle, `nominalSize` is its diameter.

Expanded:

```json
{
  "objects": [
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
        "pattern": "solid"
      }
    }
  ]
}
```

## Supported shape vocabulary

Current shapes:

- `circle`
- `square`
- `diamond`
- `triangle`
- `hexagon`

Current patterns:

- `solid`
- `none`
- `diagonal`
- `reverse-diagonal`
- `crosshatch`
- `horizontal`
- `vertical`
- `dots`

When adding a new shape or pattern, update normalization, validation, rendering, tests, demonstrations when useful, and README documentation together.

## Geometry invariants

These are intentional contract rules and should not be casually changed:

- Positive X points right.
- Positive Y points up.
- X and Y use the same physical render scale.
- A circle must render as a circle, never an ellipse caused by unequal axis scaling.
- The normalized geometry model is the source of truth; SVG is derived output.
- Exterior points form one ordered polygon.
- Boundary polygons must have at least three valid finite points.
- Self-intersecting boundary polygons are invalid.
- Object centers must lie inside or on the boundary.
- An object whose center is valid may extend beyond the boundary; this is reported as a warning rather than rejected.
- Contact with the boundary counts as contained.
- Names supplied by the caller are retained.
- Missing boundary names are generated as `P1`, `P2`, ...
- Missing object names are generated as `O1`, `O2`, ...
- Bounds include boundary geometry and object extents.
- View bounds preserve equal axis scale and include visual padding.
- Never silently coerce missing/null coordinates to zero.

If a future request intentionally changes one of these rules, update tests and documentation in the same commit.

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

Current module responsibilities:

```text
src/
  index.js                 HTTP routing / CORS
  api/
    render.js              request-independent scene orchestration
  geometry/
    normalize.js           compact/expanded input normalization
    validate.js            contract validation
    polygon.js             polygon primitives
    shapes.js              object geometry/extents
    analyze.js             containment and overlaps
    bounds.js              geometry/view bounds
  render/
    svg.js                 coordinate graph + SVG rendering

test/
  geometry.test.js         geometry/regression tests
  http.test.js             Worker route/response tests
```

Keep these responsibilities separated. Do not turn `src/index.js` into the geometry engine.

## File documentation

New source files should begin with project traceability metadata matching the existing convention where relevant:

```text
PATH
PURPOSE
TAGS
ATTACHED
CALLED_BY
CALLS/DEPENDS_ON
RUNTIME_ROLE
STATE_OWNERSHIP
SIGNALS/EVENTS
```

Keep files small and focused enough that future agents can reason about them without loading the whole repository.

## Validation and analysis rules

Validation errors should be machine-readable objects with stable `code` values and human-readable `message` values.

Prefer a structured response such as:

```json
{
  "ok": false,
  "version": "x.y.z",
  "errors": [
    {
      "code": "object_size_invalid",
      "object": "TREE_01",
      "message": "..."
    }
  ]
}
```

Warnings are distinct from validation errors.

Examples of warnings:

- object crosses the boundary while its center remains valid.

Examples of errors:

- invalid JSON;
- fewer than three boundary points;
- non-finite coordinates;
- self-intersecting boundary;
- duplicate names;
- unsupported shape/pattern;
- nonpositive object size;
- object center outside the boundary.

## Testing requirements

`npm run check` is the production build gate and currently runs the Node test suite.

A code change is not complete merely because it looks correct.

At minimum, tests should cover affected behavior at the lowest useful layer and, for route changes, the HTTP contract.

For rendering changes, verify both:

1. machine behavior through tests; and
2. representative visual SVG output.

Never reduce coverage merely to make a build pass.

## Versioning

The engine exposes its version through the API.

For changes:

- patch: fixes/refinements that preserve the existing contract;
- minor: backward-compatible new capabilities;
- major: intentional breaking contract changes.

Keep `package.json`, the engine version constant, and relevant documentation synchronized.

## Using the Worker for user-supplied geometry

When a user provides coordinates and asks for the pipeline output, prefer running the request through the deployed Cloudflare Worker rather than reproducing the calculation only in chat.

The expected flow is:

```text
user coordinates
  ↓
POST production Worker
  ↓
normalization
  ↓
validation
  ↓
analysis
  ↓
bounds
  ↓
SVG
  ↓
return actual Worker output
```

Return useful normalized/analysis information and the rendered graph when appropriate.

If the production Worker cannot be reached, say so explicitly and distinguish any local reconstruction from actual Cloudflare output.

## Scope discipline

This repository is a geometry/rendering engine.

Do not couple unrelated estimator, pricing, regulatory, customer-management, or landscaping business logic directly into it unless the project scope is explicitly expanded.

Higher-level systems may consume this Worker as a geometry service.

## Recovery checklist for a fresh agent session

If all prior chat context is missing:

1. Open `AGENTS.md`.
2. Inspect `README.md`.
3. Inspect the current GitHub `main` head and recent commits.
4. Read `package.json` and `wrangler.jsonc`.
5. Read only the source modules relevant to the requested change.
6. Confirm the Cloudflare Worker named `site-geometry-engine` exists.
7. Discover the current Worker tag/build trigger dynamically.
8. Make and commit the smallest coherent repository change.
9. Run the configured Cloudflare build against that commit.
10. Confirm tests, deployment, and production behavior.
