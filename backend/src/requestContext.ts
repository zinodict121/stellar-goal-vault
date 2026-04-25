/**
 * requestContext.ts
 *
 * Provides a per-request AsyncLocalStorage store so that any code running
 * within a request's async call chain can read the current request ID without
 * receiving the Express `req` object as a parameter.
 *
 * Usage (middleware):
 *   requestContext.run({ requestId: "…" }, next);
 *
 * Usage (anywhere in the call chain):
 *   import { getRequestId } from "./requestContext";
 *   const id = getRequestId(); // string | undefined
 */
import { AsyncLocalStorage } from "async_hooks";

export interface RequestStore {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

/**
 * Returns the request ID for the currently-executing async context, or
 * `undefined` when called outside of a request (e.g. during startup logging).
 */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
