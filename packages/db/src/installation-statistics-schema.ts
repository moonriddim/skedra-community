import {
	boolean,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

/** No row means no decision. Never turn absence into implicit consent. */
export const installationStatisticsConsent = pgTable(
	"installation_statistics_consent",
	{
		id: text("id").primaryKey(),
		enabled: boolean("enabled").notNull(),
		decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
	},
);

/** Local singleton: never transmit the scheduling state or a permanent identifier. */
export const installationStatisticsState = pgTable(
	"installation_statistics_state",
	{
		id: text("id").primaryKey(),
		month: text("month").notNull(),
		monthlyId: uuid("monthly_id").notNull(),
		nextReportAt: timestamp("next_report_at", { withTimezone: true }).notNull(),
	},
);

/** Central deduplication set. Previous months are deleted, not linked together. */
export const installationStatisticsReports = pgTable(
	"installation_statistics_reports",
	{
		month: text("month").notNull(),
		monthlyId: uuid("monthly_id").notNull(),
	},
	(table) => [primaryKey({ columns: [table.month, table.monthlyId] })],
);

/** The only installation-statistics table readable by the Metrics role. */
export const installationStatisticsMonths = pgTable(
	"installation_statistics_months",
	{
		month: text("month").primaryKey(),
		installations: integer("installations").notNull(),
	},
);
