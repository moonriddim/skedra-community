import type { Database } from "@skedra/db";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
	type InstallationStatisticsConfig,
	canReceiveInstallationStatistics,
	installationReportSchema,
	recordInstallationReport,
	statisticsMonth,
} from "./lib/installation-statistics";

export function createInstallationStatisticsApp(
	db: Database,
	config: InstallationStatisticsConfig,
	now = () => new Date(),
) {
	const app = new Hono();
	// A bounded global limiter avoids collecting IPs, cookies or other identifiers.
	let windowStartedAt = 0;
	let requests = 0;
	app.use("*", async (c, next) => {
		c.header("Cache-Control", "no-store");
		if (!canReceiveInstallationStatistics(config)) return c.body(null, 404);
		const time = now().getTime();
		if (time - windowStartedAt >= 60_000) {
			windowStartedAt = time;
			requests = 0;
		}
		if (++requests > 120) {
			c.header("Retry-After", "60");
			return c.body(null, 429);
		}
		await next();
	});
	app.use("*", bodyLimit({ maxSize: 256, onError: (c) => c.body(null, 413) }));
	app.post("/", async (c) => {
		if (
			new URL(c.req.url).search ||
			c.req.header("content-type")?.split(";")[0].trim() !== "application/json"
		)
			return c.body(null, 400);
		const parsed = installationReportSchema.safeParse(
			await c.req.json().catch(() => null),
		);
		if (!parsed.success || parsed.data.month !== statisticsMonth(now()))
			return c.body(null, 400);
		try {
			await recordInstallationReport(db, parsed.data);
			return c.body(null, 204);
		} catch {
			// No request or database logging: parameters contain the monthly identifier.
			return c.body(null, 503);
		}
	});
	return app;
}
