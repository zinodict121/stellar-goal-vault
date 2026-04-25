import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLogLine,
  logError,
  logRequest,
  normalizeLogLevel,
  shouldLog,
} from "./logger";
import { requestContext } from "./requestContext";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates valid JSON log lines with stable metadata", () => {
    const line = createLogLine(
      "info",
      "http_request",
      { method: "GET", path: "/api/health", status: 200, durationMs: 12.34 },
      new Date("2026-04-22T20:00:00.000Z"),
    );

    expect(JSON.parse(line)).toEqual({
      timestamp: "2026-04-22T20:00:00.000Z",
      level: "info",
      event: "http_request",
      method: "GET",
      path: "/api/health",
      status: 200,
      durationMs: 12.34,
    });
  });

  it("logs requests as JSON with method, path, status, and duration", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logRequest(
      {
        requestId: "req-123",
        method: "POST",
        path: "/api/campaigns",
        status: 201,
        durationMs: 18.567,
      },
      "info",
    );

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));

    expect(payload).toMatchObject({
      level: "info",
      event: "http_request",
      requestId: "req-123",
      method: "POST",
      path: "/api/campaigns",
      status: 201,
      durationMs: 18.57,
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.message).toContain("POST /api/campaigns 201");
  });

  it("logs errors with the message and stack", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = new Error("Boom");

    logError(err, { event: "request_error", path: "/api/campaigns", status: 500 }, "info");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(errorSpy.mock.calls[0][0]));

    expect(payload).toMatchObject({
      level: "error",
      event: "request_error",
      message: "Boom",
      path: "/api/campaigns",
      status: 500,
      errorName: "Error",
    });
    expect(payload.stack).toContain("Boom");
  });

  it("filters logs using the configured log level", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logRequest(
      {
        method: "GET",
        path: "/api/health",
        status: 200,
        durationMs: 5,
      },
      "warn",
    );

    expect(infoSpy).not.toHaveBeenCalled();
    expect(normalizeLogLevel("ERROR")).toBe("error");
    expect(normalizeLogLevel("invalid")).toBe("info");
    expect(shouldLog("error", "warn")).toBe(true);
    expect(shouldLog("info", "warn")).toBe(false);
  });

  // ── AsyncLocalStorage context injection ──────────────────────────────────────

  it("automatically injects requestId from the async context when no field is provided", () => {
    const CONTEXT_ID = "ctx-auto-injected-id";

    let line!: string;
    requestContext.run({ requestId: CONTEXT_ID }, () => {
      line = createLogLine(
        "info",
        "service_action",
        { detail: "something happened" },
        new Date("2026-04-22T20:00:00.000Z"),
      );
    });

    const payload = JSON.parse(line);
    expect(payload.requestId).toBe(CONTEXT_ID);
    expect(payload.detail).toBe("something happened");
  });

  it("lets an explicit requestId field override the async context value", () => {
    const CONTEXT_ID = "ctx-id-that-should-be-overridden";
    const EXPLICIT_ID = "explicit-caller-supplied-id";

    let line!: string;
    requestContext.run({ requestId: CONTEXT_ID }, () => {
      line = createLogLine(
        "warn",
        "audit_event",
        { requestId: EXPLICIT_ID, reason: "caller-supplied wins" },
        new Date("2026-04-22T20:00:00.000Z"),
      );
    });

    const payload = JSON.parse(line);
    expect(payload.requestId).toBe(EXPLICIT_ID);
  });

  it("omits requestId from log lines when called outside of any request context", () => {
    // Simulate startup logging (no AsyncLocalStorage context active).
    const line = createLogLine(
      "info",
      "server_started",
      { port: 3000 },
      new Date("2026-04-22T20:00:00.000Z"),
    );

    const payload = JSON.parse(line);
    expect(payload.requestId).toBeUndefined();
    expect(payload.port).toBe(3000);
  });
});

