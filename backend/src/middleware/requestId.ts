/**
 * requestId.ts — Request ID middleware
 *
 * Responsibilities
 * ─────────────────
 * 1. Honour an upstream `X-Request-Id` header if present (e.g. from a load
 *    balancer); otherwise generate a new UUIDv4.
 * 2. Echo the ID back to the caller as the `X-Request-Id` response header.
 * 3. Attach the ID to `req.requestId` for backward-compatible access within
 *    existing Express route handlers.
 * 4. Run the rest of the request lifecycle inside an AsyncLocalStorage context
 *    so that any downstream code (services, utilities) can call `getRequestId()`
 *    without receiving the `req` object.
 */
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { requestContext } from "../requestContext";

const HEADER = "x-request-id";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  // Respect an upstream-supplied ID; fall back to a fresh UUIDv4.
  const incoming = req.headers[HEADER];
  const requestId =
    typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();

  // Attach to req for backward-compatible in-handler access.
  req.requestId = requestId;

  // Echo the definitive ID to the caller.
  res.setHeader("X-Request-Id", requestId);

  // Run the rest of the async chain inside the context store so that any
  // call to getRequestId() downstream returns this request's ID.
  requestContext.run({ requestId }, next);
}
