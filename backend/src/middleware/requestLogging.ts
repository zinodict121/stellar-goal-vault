/**
 * requestLogging.ts
 *
 * Thin access-log middleware. Emits one structured log line per request after
 * the response has been sent. The request ID is injected automatically via the
 * AsyncLocalStorage context set by requestIdMiddleware — no `req` threading needed.
 *
 * NOTE: This file is kept for reference / alternative wiring. The primary access
 * log is already emitted by the inline `res.on("finish")` handler in index.ts.
 * Mount this middleware instead if you prefer a single, dedicated module.
 */
import { NextFunction, Request, Response } from "express";
import { logRequest } from "../logger";
import { normalizeLogLevel } from "../logger";

type RequestWithId = Request & { requestId?: string };

export function requestLoggingMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    logRequest(
      {
        // requestId is supplied for backward-compat; the logger also gets it
        // automatically from the AsyncLocalStorage context.
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl || req.path,
        status: res.statusCode,
        durationMs,
      },
      normalizeLogLevel(process.env.LOG_LEVEL),
    );
  });

  next();
}
