/**
 * Express-to-tRPC Adapter
 *
 * Converts Express-style route handlers into tRPC procedures.
 * This allows seed code written for Express to be exposed through
 * the existing tRPC router infrastructure.
 *
 * Usage:
 *   import { wrapExpressHandler, createTrpcRouter } from './expressToTrpc';
 *   const strictRouter = createTrpcRouter({
 *     convert: wrapExpressHandler(strictConvertHandler),
 *   });
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpressRequest {
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  headers: Record<string, string>;
  user?: Record<string, unknown>;
}

export interface ExpressResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

export type ExpressHandler = (
  req: ExpressRequest,
  res: ExpressResponseHelper
) => Promise<void>;

/**
 * Helper that mimics Express res object for capturing responses
 */
class ExpressResponseHelper {
  statusCode = 200;
  body: unknown = null;
  headers: Record<string, string> = {};
  private _sent = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(data: unknown): this {
    this.body = data;
    this._sent = true;
    return this;
  }

  send(data: unknown): this {
    this.body = data;
    this._sent = true;
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }

  get sent(): boolean {
    return this._sent;
  }
}

// ---------------------------------------------------------------------------
// Adapter functions
// ---------------------------------------------------------------------------

/**
 * Wraps an Express-style handler into a function that can be used
 * as a tRPC mutation/query resolver.
 */
export function wrapExpressHandler(handler: ExpressHandler) {
  return async (input: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
  }, ctx?: { user?: Record<string, unknown> }) => {
    const req: ExpressRequest = {
      body: input.body || {},
      query: input.query || {},
      params: input.params || {},
      headers: {},
      user: ctx?.user,
    };

    const res = new ExpressResponseHelper();
    await handler(req, res);

    if (res.statusCode >= 400) {
      throw new Error(
        typeof res.body === "object" && res.body !== null
          ? (res.body as any).error || (res.body as any).message || JSON.stringify(res.body)
          : String(res.body)
      );
    }

    return res.body;
  };
}

/**
 * Creates a tRPC mutation procedure from an Express POST handler.
 */
export function expressPostToMutation(handler: ExpressHandler) {
  return protectedProcedure
    .input(
      z.object({
        body: z.record(z.string(), z.unknown()).optional(),
        query: z.record(z.string(), z.unknown()).optional(),
        params: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return wrapExpressHandler(handler)(input, { user: ctx.user as any });
    });
}

/**
 * Creates a tRPC query procedure from an Express GET handler.
 */
export function expressGetToQuery(handler: ExpressHandler) {
  return protectedProcedure
    .input(
      z.object({
        query: z.record(z.string(), z.unknown()).optional(),
        params: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return wrapExpressHandler(handler)(
        { ...input, body: {} },
        { user: ctx.user as any }
      );
    });
}

/**
 * Batch-converts a map of Express handlers into a tRPC router.
 */
export function createTrpcRouterFromExpress(routes: {
  queries?: Record<string, ExpressHandler>;
  mutations?: Record<string, ExpressHandler>;
}) {
  const procedures: Record<string, any> = {};

  if (routes.queries) {
    for (const [name, handler] of Object.entries(routes.queries)) {
      procedures[name] = expressGetToQuery(handler);
    }
  }

  if (routes.mutations) {
    for (const [name, handler] of Object.entries(routes.mutations)) {
      procedures[name] = expressPostToMutation(handler);
    }
  }

  return router(procedures);
}

// ---------------------------------------------------------------------------
// Service factory adapter
// ---------------------------------------------------------------------------

/**
 * Replaces the Express service-factory from the seed code.
 * Instead of creating an Express app, it creates tRPC procedures
 * that can be mounted on the existing appRouter.
 */
export interface ServiceRouteConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: ExpressHandler;
  requireAuth?: boolean;
}

export function convertServiceRoutes(routes: ServiceRouteConfig[]) {
  const queries: Record<string, ExpressHandler> = {};
  const mutations: Record<string, ExpressHandler> = {};

  for (const route of routes) {
    // Convert path to a tRPC-friendly name
    const name = route.path
      .replace(/^\/api\/v1\//, "")
      .replace(/\//g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    if (route.method === "GET") {
      queries[name] = route.handler;
    } else {
      mutations[name] = route.handler;
    }
  }

  return createTrpcRouterFromExpress({ queries, mutations });
}
