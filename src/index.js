/**
 * PATH: src/index.js
 * PURPOSE: Route HTTP requests into the site geometry engine.
 * TAGS: cloudflare-worker, api, routing, geometry-engine
 * ATTACHED: wrangler.jsonc, src/api/render.js
 * CALLED_BY: Cloudflare Workers runtime
 * CALLS/DEPENDS_ON: src/api/render.js, Web Fetch API
 * RUNTIME_ROLE: HTTP API entrypoint
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: Handles HTTP fetch events
 */

import {
  buildScene,
  COMPLEX_DEMO_INPUT,
  DEMO_INPUT,
  ENGINE_VERSION,
  TRAVERSE_DEMO_INPUT,
} from "./api/render.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

const SVG_HEADERS = {
  "content-type": "image/svg+xml; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function svgResponse(svg, status = 200) {
  return new Response(svg, {
    status,
    headers: SVG_HEADERS,
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

async function readJson(request) {
  try {
    return {
      ok: true,
      value: await request.json(),
    };
  } catch {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          version: ENGINE_VERSION,
          errors: [
            {
              code: "invalid_json",
              message: "Request body must contain valid JSON.",
            },
          ],
        },
        400,
      ),
    };
  }
}

async function renderRequest(request, svgOnly) {
  const parsed = await readJson(request);

  if (!parsed.ok) {
    return parsed.response;
  }

  const result = buildScene(parsed.value);

  if (!result.ok) {
    return jsonResponse(result, 400);
  }

  return svgOnly
    ? svgResponse(result.svg)
    : jsonResponse(result);
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return corsPreflight();
    }

    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/health")
    ) {
      return jsonResponse({
        ok: true,
        service: "site-geometry-engine",
        version: ENGINE_VERSION,
        phase: "traverse-input",
        endpoints: [
          "POST /geometry/render",
          "POST /geometry/render.svg",
          "GET /demo",
          "GET /demo.svg",
          "GET /demo/complex",
          "GET /demo/complex.svg",
          "GET /demo/traverse",
          "GET /demo/traverse.svg",
        ],
      });
    }

    if (
      request.method === "GET" &&
      url.pathname === "/demo"
    ) {
      return jsonResponse(buildScene(DEMO_INPUT));
    }

    if (
      request.method === "GET" &&
      url.pathname === "/demo.svg"
    ) {
      return svgResponse(buildScene(DEMO_INPUT).svg);
    }

    if (
      request.method === "GET" &&
      url.pathname === "/demo/complex"
    ) {
      return jsonResponse(buildScene(COMPLEX_DEMO_INPUT));
    }

    if (
      request.method === "GET" &&
      url.pathname === "/demo/complex.svg"
    ) {
      return svgResponse(buildScene(COMPLEX_DEMO_INPUT).svg);
    }

    if (
      request.method === "GET" &&
      url.pathname === "/demo/traverse"
    ) {
      return jsonResponse(buildScene(TRAVERSE_DEMO_INPUT));
    }

    if (
      request.method === "GET" &&
      url.pathname === "/demo/traverse.svg"
    ) {
      return svgResponse(buildScene(TRAVERSE_DEMO_INPUT).svg);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/geometry/render"
    ) {
      return renderRequest(request, false);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/geometry/render.svg"
    ) {
      return renderRequest(request, true);
    }

    return jsonResponse(
      {
        ok: false,
        error: "not_found",
        path: url.pathname,
      },
      404,
    );
  },
};
