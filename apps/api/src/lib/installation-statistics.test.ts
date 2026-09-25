import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
	type Database,
	installationStatisticsConsent,
	installationStatisticsMonths,
	installationStatisticsReports,
	installationStatisticsState,
} from "@skedra/db";
import { drizzle } from "drizzle-orm/pglite";
import { Hono } from "hono";
import { createInstallationStatisticsApp } from "../installation-statistics";
import { instanceRouter } from "../trpc/routers/instance";
import {
	INSTALLATION_STATISTICS_URL,
	type InstallationStatisticsConfig,
	claimInstallationReport,
	pruneInstallationReports,
	recordInstallationReport,
	sendInstallationReport,
	statisticsMonth,
} from "./installation-statistics";
import {
	getInstallationStatisticsStatus,
	saveInstallationStatisticsChoice,
} from "./installation-statistics-consent";

const selfhost: InstallationStatisticsConfig = {
	SKEDRA_DEPLOYMENT_MODE: "selfhost",
	SKEDRA_INSTALLATION_STATS_RECEIVER_ENABLED: false,
};
const managed: InstallationStatisticsConfig = {
	...selfhost,
	SKEDRA_DEPLOYMENT_MODE: "managed",
	SKEDRA_INSTALLATION_STATS_RECEIVER_ENABLED: true,
};
const now = new Date("2026-09-25T12:00:00Z");
const id = "34ab816a-d6dc-4f3b-bb70-012c891ed2e8";

async function database(consent: boolean | null = true) {
	const pg = new PGlite();
	const migration = await readFile(
		new URL("../../../../deploy/db/selfhost-migrations.sql", import.meta.url),
		"utf8",
	);
	const tables = migration
		.split(
			"-- Installation statistics are opt-in and separate from product analytics.",
		)[1]
		.split("-- End installation statistics tables.")[0];
	await pg.exec(tables);
	await pg.exec(tables); // Production migrations run on every container startup.
	await pg.exec(
		"create table instance_settings (id text primary key, admin_user_id text); insert into instance_settings values ('default', 'admin')",
	);
	const db = drizzle(pg, {
		schema: {
			installationStatisticsConsent,
			installationStatisticsState,
			installationStatisticsReports,
			installationStatisticsMonths,
		},
	}) as unknown as Database;
	if (consent !== null)
		await db
			.insert(installationStatisticsConsent)
			.values({ id: "default", enabled: consent, decidedAt: now });
	return { pg, db, migration };
}

test("undecided and opted-out installations send nothing and allocate no ID; managed never accesses local state", async (t) => {
	const forbidden = new Proxy({} as Database, {
		get() {
			throw new Error("unexpected DB access");
		},
	});
	const fetchStub: typeof fetch = async () => {
		throw new Error("unexpected network access");
	};
	const { pg, db } = await database(null);
	t.after(() => pg.close());
	await sendInstallationReport(db, selfhost, { fetch: fetchStub });
	assert.equal((await db.select().from(installationStatisticsState)).length, 0);
	await saveInstallationStatisticsChoice(db, "admin", "selfhost", false, true);
	await sendInstallationReport(db, selfhost, { fetch: fetchStub });
	assert.equal((await db.select().from(installationStatisticsState)).length, 0);
	await sendInstallationReport(forbidden, managed, { fetch: fetchStub });
});

test("admin choice is explicit, persistent, revocable without restart, and protected from stale setup tabs", async (t) => {
	const { pg, db } = await database(null);
	t.after(() => pg.close());
	assert.equal(
		(await getInstallationStatisticsStatus(db, "admin", "selfhost")).choice,
		null,
	);
	assert.equal(
		(
			await saveInstallationStatisticsChoice(
				db,
				"admin",
				"selfhost",
				false,
				true,
			)
		).choice,
		false,
	);
	assert.equal(
		(
			await saveInstallationStatisticsChoice(
				db,
				"admin",
				"selfhost",
				true,
				true,
			)
		).choice,
		false,
	);
	assert.equal(
		(await getInstallationStatisticsStatus(db, "admin", "selfhost")).choice,
		false,
	);
	await saveInstallationStatisticsChoice(db, "admin", "selfhost", true, false);
	let sent = 0;
	const fetchStub: typeof fetch = async () => {
		sent++;
		return new Response(null, { status: 204 });
	};
	await sendInstallationReport(db, selfhost, { now, fetch: fetchStub });
	assert.equal(sent, 1);
	await saveInstallationStatisticsChoice(db, "admin", "selfhost", false, false);
	await sendInstallationReport(db, selfhost, {
		now: new Date("2026-10-02T00:00:00Z"),
		fetch: fetchStub,
	});
	assert.equal(sent, 1);
	assert.equal(
		(await db.select().from(installationStatisticsState))[0].month,
		"2026-09",
	);
});

test("only the assigned instance admin can decide; API requires authentication and an explicit boolean", async (t) => {
	const { pg, db } = await database(null);
	t.after(() => pg.close());
	const forbidden = (error: unknown) =>
		error instanceof Error && "code" in error && error.code === "FORBIDDEN";
	assert.equal(
		(await getInstallationStatisticsStatus(db, "member", "selfhost")).isAdmin,
		false,
	);
	await assert.rejects(
		saveInstallationStatisticsChoice(db, "member", "selfhost", true, false),
		forbidden,
	);
	await assert.rejects(
		saveInstallationStatisticsChoice(db, "admin", "managed", true, false),
		forbidden,
	);
	assert.equal(
		(await getInstallationStatisticsStatus(db, "admin", "managed")).available,
		false,
	);
	const caller = (userId: string | null) =>
		instanceRouter.createCaller({
			db,
			user: userId ? { id: userId } : null,
			session: userId ? { id: "session" } : null,
		} as Parameters<typeof instanceRouter.createCaller>[0]);
	await assert.rejects(
		caller(null).getInstallationStatistics(),
		(error: unknown) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "UNAUTHORIZED",
	);
	await assert.rejects(
		caller("member").setInstallationStatistics({
			enabled: true,
			initialSetup: false,
		}),
		forbidden,
	);
	await assert.rejects(
		caller("admin").setInstallationStatistics({ initialSetup: true } as {
			enabled: boolean;
			initialSetup: boolean;
		}),
	);
	await assert.rejects(
		caller("admin").setInstallationStatistics({
			enabled: null,
			initialSetup: true,
		} as unknown as { enabled: boolean; initialSetup: boolean }),
	);
	assert.equal(
		(
			await caller("admin").setInstallationStatistics({
				enabled: false,
				initialSetup: true,
			})
		).choice,
		false,
	);
	await pg.exec("update instance_settings set admin_user_id = null");
	await assert.rejects(
		saveInstallationStatisticsChoice(db, "member", "selfhost", true, false),
		forbidden,
	);
});

test("reports survive restarts, are leased daily, rotate at UTC month boundary and contain only two fields", async (t) => {
	const { pg, db } = await database();
	t.after(() => pg.close());
	const requests: { url: string; options: RequestInit }[] = [];
	const fetchStub: typeof fetch = async (url, options) => {
		requests.push({ url: String(url), options: options ?? {} });
		return new Response(null, { status: 204 });
	};
	await sendInstallationReport(db, selfhost, { now, fetch: fetchStub });
	await sendInstallationReport(db, selfhost, { now, fetch: fetchStub });
	assert.equal(requests.length, 1);
	const first = JSON.parse(String(requests[0].options.body));
	assert.deepEqual(Object.keys(first).sort(), ["month", "monthlyId"]);
	assert.equal(requests[0].url, INSTALLATION_STATISTICS_URL);
	assert.equal(requests[0].options.redirect, "error");
	assert.equal(requests[0].options.credentials, "omit");
	assert.deepEqual(requests[0].options.headers, {
		"Content-Type": "application/json",
		"User-Agent": "Skedra-Installation-Statistics/1",
	});
	await sendInstallationReport(db, selfhost, {
		now: new Date("2026-09-27T12:00:00Z"),
		fetch: fetchStub,
	});
	assert.deepEqual(JSON.parse(String(requests[1].options.body)), first);
	await sendInstallationReport(db, selfhost, {
		now: new Date("2026-09-30T23:59:59Z"),
		fetch: fetchStub,
	});
	await sendInstallationReport(db, selfhost, {
		now: new Date("2026-10-01T00:00:00Z"),
		fetch: fetchStub,
	});
	const october = JSON.parse(String(requests[3].options.body));
	assert.equal(october.month, "2026-10");
	assert.notEqual(october.monthlyId, first.monthlyId);
	const rows = await db.select().from(installationStatisticsState);
	assert.equal(rows.length, 1);
	assert.equal(rows[0].monthlyId, october.monthlyId);
	assert.equal(
		statisticsMonth(new Date("2026-10-01T00:30:00+02:00")),
		"2026-09",
	);
});

test("independent installations get unrelated IDs; failed sends cannot trigger a retry storm", async (t) => {
	const { pg, db } = await database();
	t.after(() => pg.close());
	const first = await claimInstallationReport(db, now);
	assert.ok(first);
	await db.delete(installationStatisticsState);
	const second = await claimInstallationReport(db, now);
	assert.notEqual(second?.monthlyId, first.monthlyId);
	const later = new Date("2026-09-27T12:00:00Z");
	let attempts = 0;
	const fetchStub: typeof fetch = async () => {
		attempts++;
		throw new Error("offline");
	};
	await assert.rejects(
		sendInstallationReport(db, selfhost, { now: later, fetch: fetchStub }),
	);
	await sendInstallationReport(db, selfhost, { now: later, fetch: fetchStub });
	assert.equal(attempts, 1);
});

test("receiver validates payload, deduplicates, keeps only monthly totals after retention and bounds requests", async (t) => {
	const { pg, db } = await database();
	t.after(() => pg.close());
	let clock = now;
	const app = new Hono().route(
		"/api/installation-statistics",
		createInstallationStatisticsApp(db, managed, () => clock),
	);
	const request = (
		body: unknown,
		path = "/api/installation-statistics",
		contentType = "application/json",
	) =>
		app.request(path, {
			method: "POST",
			headers: {
				"Content-Type": contentType,
				Cookie: "private-cookie",
				"X-Real-IP": "192.0.2.1",
			},
			body: JSON.stringify(body),
		});
	const report = { month: "2026-09", monthlyId: id };
	for (let i = 0; i < 2; i++) {
		const response = await request(report);
		assert.equal(response.status, 204);
		assert.equal(response.headers.get("set-cookie"), null);
		assert.equal(response.headers.get("cache-control"), "no-store");
	}
	assert.deepEqual(await db.select().from(installationStatisticsMonths), [
		{ month: "2026-09", installations: 1 },
	]);
	assert.deepEqual(await db.select().from(installationStatisticsReports), [
		report,
	]);
	for (const payload of [
		{ ...report, email: "private@example.com" },
		{ ...report, users: 10 },
		{ ...report, month: "2026-08" },
		{ ...report, monthlyId: "invalid" },
		null,
	])
		assert.equal((await request(payload)).status, 400);
	assert.equal(
		(await request(report, "/api/installation-statistics?secret=123")).status,
		400,
	);
	assert.equal((await request(report, undefined, "text/plain")).status, 400);
	assert.equal(
		(await request({ ...report, extra: "x".repeat(300) })).status,
		413,
	);
	assert.equal(
		(
			await app.request("/api/installation-statistics", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{",
			})
		).status,
		400,
	);
	clock = new Date("2026-10-01T00:00:00Z");
	assert.equal(
		(
			await request({
				month: "2026-10",
				monthlyId: "14ab816a-d6dc-4f3b-bb70-012c891ed2e8",
			})
		).status,
		204,
	);
	await pruneInstallationReports(db, clock);
	assert.equal(
		(await db.select().from(installationStatisticsReports)).length,
		1,
	);
	assert.equal(
		(await db.select().from(installationStatisticsMonths)).length,
		2,
	);
	for (let i = 0; i < 119; i++)
		assert.equal(
			(await request({ month: "2026-10", monthlyId: id })).status,
			204,
		);
	const limited = await request(report);
	assert.equal(limited.status, 429);
	assert.equal(limited.headers.get("retry-after"), "60");
	clock = new Date(clock.getTime() + 60_000);
	assert.equal(
		(await request({ month: "2026-10", monthlyId: id })).status,
		204,
	);
});

test("receiver is unavailable on selfhost and disabled managed servers", async () => {
	for (const config of [
		{ ...selfhost, SKEDRA_INSTALLATION_STATS_RECEIVER_ENABLED: true },
		{ ...managed, SKEDRA_INSTALLATION_STATS_RECEIVER_ENABLED: false },
	]) {
		const app = createInstallationStatisticsApp({} as Database, config);
		assert.equal(
			(await app.request("/", { method: "POST", body: "{}" })).status,
			404,
		);
	}
});

test("aggregate update is atomic with deduplication and Metrics reads no identifiers", async (t) => {
	const { pg, db, migration } = await database();
	t.after(() => pg.close());
	await pg.exec(`create table users(id text); create table sessions(id text); create table whiteboard_e2ee_updates(id text); create table growth_events(id text);
		create role skedra_ops_metrics; create role custom_metrics;
		grant select on users, sessions, whiteboard_e2ee_updates to custom_metrics;`);
	await pg.exec(
		migration.slice(
			migration.indexOf(
				"-- Managed upgrades can add the analytics read privilege",
			),
		),
	);
	for (const role of ["skedra_ops_metrics", "custom_metrics"]) {
		const privileges = await pg.query<{
			aggregate: boolean;
			raw: boolean;
			local: boolean;
		}>(
			`select
			has_table_privilege($1, 'installation_statistics_months', 'SELECT') as aggregate,
			has_table_privilege($1, 'installation_statistics_reports', 'SELECT') as raw,
			has_table_privilege($1, 'installation_statistics_state', 'SELECT') as local`,
			[role],
		);
		assert.deepEqual(privileges.rows[0], {
			aggregate: true,
			raw: false,
			local: false,
		});
	}
	await pg.exec(
		"alter table installation_statistics_months add constraint force_failure check (installations < 1)",
	);
	const report = { month: statisticsMonth(), monthlyId: id };
	await assert.rejects(recordInstallationReport(db, report));
	assert.equal(
		(await db.select().from(installationStatisticsReports)).length,
		0,
	);
	await pg.exec(
		"alter table installation_statistics_months drop constraint force_failure",
	);
	await recordInstallationReport(db, report);
	await recordInstallationReport(db, report);
	// The Metrics query belongs to the managed deployment and is not part of the
	// Community export (deploy/managed is excluded there).
	const summarySqlUrl = new URL(
		"../../../../deploy/managed/monitoring/ops-metrics/installations.sql",
		import.meta.url,
	);
	if (!existsSync(summarySqlUrl)) {
		t.diagnostic("Managed Metrics query not present; skipping summary check.");
		return;
	}
	const summarySql = await readFile(summarySqlUrl, "utf8");
	await pg.exec("set role skedra_ops_metrics");
	const summary = await pg.query<{ json_build_object: unknown }>(summarySql);
	assert.deepEqual(summary.rows[0].json_build_object, {
		month: statisticsMonth(),
		installations: 1,
	});
});
