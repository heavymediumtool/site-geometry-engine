/**
 * PATH: src/index.ts
 * PURPOSE: Cloudflare Worker entrypoint and initial deployment/connection health endpoint.
 * TAGS: cloudflare-worker, api, health, geometry-engine
 * ATTACHED: wrangler.jsonc, package.json
 * CALLED_BY: Cloudflare Workers runtime
 * CALLS/DEPENDS_ON: Web Fetch API
 * RUNTIME_ROLE: HTTP API entrypoint
 * STATE_OWNERSHIP: Stateless
 * SIGNALS/EVENTS: Handles HTTP fetch events
 */

export interface Env {}

interface HealthResponse {
  ok: true;
  service: "site-geometry-engine";
  version: "0.0.1";
  phase: "github-cloudflare-connection-test";
  path: string;
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      const payload: HealthResponse = {
        ok: true,
        service: "site-geometry-engine",
        version: "0.0.1",
        phase: "github-cloudflare-connection-test",
        path: url.pathname,
      };

      return Response.json(payload, {
        headers: {
          "cache-control": "no-store",
        },
      });
    }

    return Response.json(
      {
        ok: false,
        error: "not_found",
        path: url.pathname,
      },
      { status: 404 },
    );
  },
} satisfies ExportedHandler<Env>;
