import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/** Assigns a request identifier (incoming X-Request-Id or generated UUID) and
 * echoes it back so that logs, audit events and support tickets correlate. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.trim() !== "" ? incoming : randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
