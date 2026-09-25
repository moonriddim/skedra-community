import { randomUUID } from "node:crypto";
import {
	type Database,
	installationStatisticsConsent,
	installationStatisticsMonths,
	installationStatisticsReports,
	installationStatisticsState,
} from "@skedra/db";
import { and, eq, lt, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

export const INSTALLATION_STATISTICS_URL =
	"https://skedra.xyz/api/installation-statistics";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const installationReportSchema = z
	.object({
		month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
		monthlyId: z.string().uuid(),
	})
	.strict();
export type InstallationReport = z.infer<typeof installationReportSchema>;

export type InstallationStatisticsConfig = {
	SKEDRA_DEPLOYMENT_MODE: "selfhost" | "managed";
	SKEDRA_INSTALLATION_STATS_RECEIVER_ENABLED: boolean;
};

export function statisticsMonth(now = new Date()) {
	return now.toISOString().slice(0, 7);
}

export function canReceiveInstallationStatistics(
	config: InstallationStatisticsConfig,
) {
	return (
		config.SKEDRA_DEPLOYMENT_MODE === "managed" &&
		config.SKEDRA_INSTALLATION_STATS_RECEIVER_ENABLED
	);
}

/** Atomic database lease also prevents duplicate reporters across API replicas. */
export async function claimInstallationReport(
	db: Database,
	now = new Date(),
): Promise<InstallationReport | null> {
	const month = statisticsMonth(now);
	const monthlyId = randomUUID();
	return db.transaction(async (tx) => {
		const [consent] = await tx
			.select({ enabled: installationStatisticsConsent.enabled })
			.from(installationStatisticsConsent)
			.where(eq(installationStatisticsConsent.id, "default"));
		if (consent?.enabled !== true) return null;
		await tx
			.insert(installationStatisticsState)
			.values({
				id: "default",
				month,
				monthlyId,
				nextReportAt: now,
			})
			.onConflictDoNothing();
		const [report] = await tx
			.update(installationStatisticsState)
			.set({
				month,
				monthlyId: sql`case when ${installationStatisticsState.month} = ${month} then ${installationStatisticsState.monthlyId} else ${monthlyId}::uuid end`,
				nextReportAt: new Date(
					now.getTime() + DAY_MS + Math.random() * HOUR_MS,
				),
			})
			.where(
				and(
					eq(installationStatisticsState.id, "default"),
					or(
						ne(installationStatisticsState.month, month),
						lte(installationStatisticsState.nextReportAt, now),
					),
				),
			)
			.returning({
				month: installationStatisticsState.month,
				monthlyId: installationStatisticsState.monthlyId,
			});
		return report ?? null;
	});
}

export async function recordInstallationReport(
	db: Database,
	report: InstallationReport,
) {
	await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(installationStatisticsReports)
			.values(report)
			.onConflictDoNothing()
			.returning({ month: installationStatisticsReports.month });
		if (!inserted.length) return;
		await tx
			.insert(installationStatisticsMonths)
			.values({ month: report.month, installations: 1 })
			.onConflictDoUpdate({
				target: installationStatisticsMonths.month,
				set: {
					installations: sql`${installationStatisticsMonths.installations} + 1`,
				},
			});
	});
}

export async function pruneInstallationReports(db: Database, now = new Date()) {
	await db
		.delete(installationStatisticsReports)
		.where(lt(installationStatisticsReports.month, statisticsMonth(now)));
}

/** Only an explicit, persisted administrator choice can enable network traffic. */
export async function sendInstallationReport(
	db: Database,
	config: InstallationStatisticsConfig,
	options: { now?: Date; fetch?: typeof fetch; signal?: AbortSignal } = {},
) {
	if (config.SKEDRA_DEPLOYMENT_MODE !== "selfhost") return;
	const report = await claimInstallationReport(db, options.now);
	if (!report || options.signal?.aborted) return;
	const timeout = AbortSignal.timeout(5_000);
	const response = await (options.fetch ?? fetch)(INSTALLATION_STATISTICS_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"User-Agent": "Skedra-Installation-Statistics/1",
		},
		body: JSON.stringify(report),
		credentials: "omit",
		redirect: "error",
		signal: options.signal
			? AbortSignal.any([timeout, options.signal])
			: timeout,
	});
	await response.body?.cancel();
	if (response.status !== 204)
		throw new Error("Installation statistics unavailable");
}

export function startInstallationStatistics(
	db: Database,
	config: InstallationStatisticsConfig,
) {
	const controller = new AbortController();
	let running: Promise<void> | undefined;
	const tick = () => {
		if (running || controller.signal.aborted) return;
		running = (async () => {
			// Run retention even when receiving has subsequently been disabled.
			if (config.SKEDRA_DEPLOYMENT_MODE === "managed")
				await pruneInstallationReports(db);
			await sendInstallationReport(db, config, { signal: controller.signal });
		})()
			.catch(() => {
				// Never log the request, its identifier, network details, or DB errors.
				if (!controller.signal.aborted)
					console.warn(
						"[Installation statistics] Background task unavailable; will retry later.",
					);
			})
			.finally(() => {
				running = undefined;
			});
	};
	const initial = setTimeout(tick, 0);
	// Re-read consent so a saved UI choice applies without restarting the server.
	const interval = setInterval(
		tick,
		config.SKEDRA_DEPLOYMENT_MODE === "managed" ? HOUR_MS : 60_000,
	);
	initial.unref();
	interval.unref();
	return async () => {
		clearTimeout(initial);
		clearInterval(interval);
		controller.abort();
		await running;
	};
}
