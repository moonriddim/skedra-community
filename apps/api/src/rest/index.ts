/**
 * Public REST API Router — mountet v1 unter /api/v1.
 */

import { Hono } from "hono";
import { openApiDocument } from "./openapi";
import { boardsRouter } from "./v1";

export const restApp = new Hono();

restApp.get("/openapi.json", (c) => c.json(openApiDocument));
restApp.route("/v1", boardsRouter);
