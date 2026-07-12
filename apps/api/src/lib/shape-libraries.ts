/**
 * Veröffentlichte Shape-Bibliotheken (Community-Pakete auf der Skedra-Domain).
 */

import {
	type Database,
	librarySubmissions,
	publishedShapeLibraries,
} from "@skedra/db";
import {
	SKEDRA_LIBRARY_LICENSE,
	SKEDRA_LIB_TYPE,
	type SkedraLibraryFile,
	isValidLibrarySlug,
	normalizeLibrarySlug,
	skedraLibrarySchema,
} from "@skedra/shared";
import { and, desc, eq } from "drizzle-orm";
import { env } from "../env";

export type LibrarySubmissionStatus = "pending" | "approved" | "rejected";
export type LibraryCatalogMode = "local" | "remote";

export interface PublicShapeLibraryEntry {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	author: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
	itemCount: number;
	license: typeof SKEDRA_LIBRARY_LICENSE;
}

function trimUrl(value?: string | null) {
	const trimmed = value?.trim();
	return trimmed ? trimmed.replace(/\/$/, "") : null;
}

function getRemoteCatalogBaseUrl() {
	return trimUrl(env.SKEDRA_LIBRARY_CATALOG_API_URL);
}

export function getLibraryCatalogConfig() {
	const remoteBaseUrl = getRemoteCatalogBaseUrl();
	const submitBaseUrl =
		env.SKEDRA_LIBRARY_CATALOG_MODE === "remote" && remoteBaseUrl
			? remoteBaseUrl
			: (trimUrl(env.APP_URL) ?? "http://localhost:5174");
	const submitUrl =
		env.SKEDRA_LIBRARY_SUBMIT_URL?.trim() ||
		`${submitBaseUrl}/login?redirect=${encodeURIComponent("/library")}`;

	return {
		mode: env.SKEDRA_LIBRARY_CATALOG_MODE as LibraryCatalogMode,
		canSubmit: env.SKEDRA_LIBRARY_CATALOG_MODE === "local" || !!remoteBaseUrl,
		submitUrl,
	};
}

async function fetchRemoteCatalog(path: string) {
	const baseUrl = getRemoteCatalogBaseUrl();
	if (!baseUrl) throw new Error("REMOTE_CATALOG_NOT_CONFIGURED");

	const response = await fetch(`${baseUrl}${path}`, {
		headers: { accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error(`REMOTE_CATALOG_FETCH_FAILED_${response.status}`);
	}
	return response;
}

export function parseLibraryContent(content: string): SkedraLibraryFile {
	const json = JSON.parse(content) as unknown;
	const parsed = skedraLibrarySchema.safeParse(json);
	if (!parsed.success || parsed.data.type !== SKEDRA_LIB_TYPE) {
		throw new Error("INVALID_LIBRARY_CONTENT");
	}
	return parsed.data;
}

function countLibraryItems(content: string) {
	try {
		return parseLibraryContent(content).items.length;
	} catch {
		return 0;
	}
}

function buildLibraryContent(input: {
	authorName: string;
	name: string;
	description?: string;
	file: SkedraLibraryFile;
}) {
	return JSON.stringify({
		...input.file,
		type: SKEDRA_LIB_TYPE,
		name: input.name,
		description: input.description,
		author: input.authorName,
		license: SKEDRA_LIBRARY_LICENSE,
		source: "skedra",
	});
}

export async function listPublicShapeLibraries(
	db: Database,
): Promise<PublicShapeLibraryEntry[]> {
	const rows = await db
		.select()
		.from(publishedShapeLibraries)
		.orderBy(desc(publishedShapeLibraries.updatedAt));

	return rows.map((row) => {
		return {
			id: row.id,
			slug: row.slug,
			name: row.name,
			description: row.description,
			author: row.author,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			itemCount: countLibraryItems(row.content),
			license: SKEDRA_LIBRARY_LICENSE,
		};
	});
}

export async function listConfiguredPublicShapeLibraries(db: Database) {
	if (env.SKEDRA_LIBRARY_CATALOG_MODE === "remote") {
		const response = await fetchRemoteCatalog("/api/libraries");
		return (await response.json()) as PublicShapeLibraryEntry[];
	}

	return listPublicShapeLibraries(db);
}

export async function listUserShapeLibraries(db: Database, userId: string) {
	const publishedRows = await db
		.select()
		.from(publishedShapeLibraries)
		.where(eq(publishedShapeLibraries.userId, userId))
		.orderBy(desc(publishedShapeLibraries.updatedAt));

	const submissionRows = await db
		.select()
		.from(librarySubmissions)
		.where(eq(librarySubmissions.userId, userId))
		.orderBy(desc(librarySubmissions.updatedAt));

	return {
		published: publishedRows.map((row) => ({
			id: row.id,
			slug: row.slug,
			name: row.name,
			description: row.description,
			status: "published" as const,
			itemCount: countLibraryItems(row.content),
			updatedAt: row.updatedAt,
		})),
		submissions: submissionRows.map((row) => ({
			id: row.id,
			slug: row.slug,
			name: row.name,
			description: row.description,
			status: row.status as LibrarySubmissionStatus,
			reviewNote: row.reviewNote,
			itemCount: countLibraryItems(row.content),
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			reviewedAt: row.reviewedAt,
		})),
	};
}

export async function getPublishedLibraryBySlug(db: Database, slug: string) {
	const normalized = normalizeLibrarySlug(slug);
	if (!isValidLibrarySlug(normalized)) return null;

	const rows = await db
		.select()
		.from(publishedShapeLibraries)
		.where(eq(publishedShapeLibraries.slug, normalized))
		.limit(1);

	return rows[0] ?? null;
}

export async function getConfiguredPublishedLibraryFile(
	db: Database,
	slug: string,
) {
	const normalized = normalizeLibrarySlug(slug);
	if (!isValidLibrarySlug(normalized)) return null;

	if (env.SKEDRA_LIBRARY_CATALOG_MODE === "remote") {
		const response = await fetchRemoteCatalog(
			`/api/libraries/${encodeURIComponent(normalized)}.skedralib`,
		);
		const json = await response.json();
		const parsed = skedraLibrarySchema.safeParse(json);
		if (!parsed.success || parsed.data.type !== SKEDRA_LIB_TYPE) {
			throw new Error("INVALID_LIBRARY_CONTENT");
		}
		return { ...parsed.data, license: SKEDRA_LIBRARY_LICENSE };
	}

	const row = await getPublishedLibraryBySlug(db, normalized);
	return row
		? {
				...parseLibraryContent(row.content),
				license: SKEDRA_LIBRARY_LICENSE,
			}
		: null;
}

export async function submitShapeLibraryForReview(
	db: Database,
	input: {
		userId?: string;
		authorName: string;
		submitterName?: string;
		submitterEmail?: string;
		sourceInstanceUrl?: string;
		slug: string;
		name: string;
		description?: string;
		licenseAccepted: true;
		file: SkedraLibraryFile;
	},
) {
	const slug = normalizeLibrarySlug(input.slug);
	if (!isValidLibrarySlug(slug)) {
		throw new Error("INVALID_SLUG");
	}

	if (input.file.items.length === 0) {
		throw new Error("EMPTY_LIBRARY");
	}

	const existing = await getPublishedLibraryBySlug(db, slug);
	if (existing && (!input.userId || existing.userId !== input.userId)) {
		throw new Error("SLUG_TAKEN");
	}

	const content = buildLibraryContent(input);
	const now = new Date();
	const pending = input.userId
		? await db.query.librarySubmissions.findFirst({
				where: and(
					eq(librarySubmissions.userId, input.userId),
					eq(librarySubmissions.slug, slug),
					eq(librarySubmissions.status, "pending"),
				),
			})
		: null;

	if (pending) {
		const [updated] = await db
			.update(librarySubmissions)
			.set({
				name: input.name,
				description: input.description ?? null,
				author: input.authorName,
				submitterName: input.submitterName ?? input.authorName,
				submitterEmail: input.submitterEmail ?? null,
				sourceInstanceUrl: input.sourceInstanceUrl ?? null,
				content,
				updatedAt: now,
			})
			.where(eq(librarySubmissions.id, pending.id))
			.returning();

		if (!updated) throw new Error("SUBMISSION_NOT_FOUND");
		return updated;
	}

	const [submission] = await db
		.insert(librarySubmissions)
		.values({
			userId: input.userId ?? null,
			slug,
			name: input.name,
			description: input.description ?? null,
			author: input.authorName,
			submitterName: input.submitterName ?? input.authorName,
			submitterEmail: input.submitterEmail ?? null,
			sourceInstanceUrl: input.sourceInstanceUrl ?? null,
			content,
			updatedAt: now,
		})
		.returning();

	if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
	return submission;
}

export async function submitConfiguredShapeLibraryForReview(
	db: Database,
	input: {
		userId: string;
		authorName: string;
		submitterName?: string;
		submitterEmail?: string;
		slug: string;
		name: string;
		description?: string;
		licenseAccepted: true;
		file: SkedraLibraryFile;
	},
) {
	if (env.SKEDRA_LIBRARY_CATALOG_MODE !== "remote") {
		return submitShapeLibraryForReview(db, input);
	}

	const baseUrl = getRemoteCatalogBaseUrl();
	if (!baseUrl) throw new Error("REMOTE_CATALOG_NOT_CONFIGURED");

	const response = await fetch(`${baseUrl}/api/libraries/submissions`, {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			slug: input.slug,
			name: input.name,
			description: input.description,
			authorName: input.authorName,
			submitterName: input.submitterName ?? input.authorName,
			submitterEmail: input.submitterEmail,
			sourceInstanceUrl: trimUrl(env.APP_URL),
			licenseAccepted: true,
			file: input.file,
		}),
	});

	if (response.status === 409) throw new Error("SLUG_TAKEN");
	if (response.status === 400) throw new Error("INVALID_LIBRARY");
	if (!response.ok) throw new Error("REMOTE_SUBMISSION_FAILED");

	return (await response.json()) as {
		id: string;
		slug: string;
		name: string;
		status: LibrarySubmissionStatus;
	};
}

export async function listPendingLibrarySubmissions(db: Database) {
	const rows = await db.query.librarySubmissions.findMany({
		where: eq(librarySubmissions.status, "pending"),
		orderBy: desc(librarySubmissions.createdAt),
		with: {
			submitter: {
				columns: { id: true, name: true, email: true },
			},
		},
	});

	return rows.map((row) => ({
		id: row.id,
		slug: row.slug,
		name: row.name,
		description: row.description,
		author: row.author,
		status: row.status as LibrarySubmissionStatus,
		itemCount: countLibraryItems(row.content),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		sourceInstanceUrl: row.sourceInstanceUrl,
		submitter: row.submitter
			? {
					id: row.submitter.id,
					name: row.submitter.name,
					email: row.submitter.email,
				}
			: row.submitterName || row.submitterEmail
				? {
						id: null,
						name: row.submitterName,
						email: row.submitterEmail,
					}
				: null,
	}));
}

export async function approveLibrarySubmission(
	db: Database,
	input: { id: string; reviewerId: string },
) {
	const submission = await db.query.librarySubmissions.findFirst({
		where: eq(librarySubmissions.id, input.id),
	});
	if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
	if (submission.status !== "pending")
		throw new Error("SUBMISSION_ALREADY_REVIEWED");

	const slug = normalizeLibrarySlug(submission.slug);
	const existing = await getPublishedLibraryBySlug(db, slug);
	const now = new Date();
	const licensedContent = JSON.stringify({
		...parseLibraryContent(submission.content),
		license: SKEDRA_LIBRARY_LICENSE,
	});

	if (existing) {
		if (!submission.userId || existing.userId !== submission.userId)
			throw new Error("SLUG_TAKEN");

		await db
			.update(publishedShapeLibraries)
			.set({
				name: submission.name,
				description: submission.description,
				author: submission.author,
				content: licensedContent,
				updatedAt: now,
			})
			.where(eq(publishedShapeLibraries.id, existing.id));
	} else {
		await db.insert(publishedShapeLibraries).values({
			userId: submission.userId ?? input.reviewerId,
			slug,
			name: submission.name,
			description: submission.description,
			author: submission.author,
			content: licensedContent,
			updatedAt: now,
		});
	}

	const [reviewed] = await db
		.update(librarySubmissions)
		.set({
			status: "approved",
			reviewedById: input.reviewerId,
			reviewedAt: now,
			updatedAt: now,
		})
		.where(eq(librarySubmissions.id, input.id))
		.returning();

	if (!reviewed) throw new Error("SUBMISSION_NOT_FOUND");
	return reviewed;
}

export async function rejectLibrarySubmission(
	db: Database,
	input: { id: string; reviewerId: string; note?: string },
) {
	const now = new Date();
	const [reviewed] = await db
		.update(librarySubmissions)
		.set({
			status: "rejected",
			reviewNote: input.note?.trim() || null,
			reviewedById: input.reviewerId,
			reviewedAt: now,
			updatedAt: now,
		})
		.where(
			and(
				eq(librarySubmissions.id, input.id),
				eq(librarySubmissions.status, "pending"),
			),
		)
		.returning();

	if (!reviewed) throw new Error("SUBMISSION_NOT_FOUND");
	return reviewed;
}

export async function deletePublishedShapeLibrary(
	db: Database,
	userId: string,
	id: string,
) {
	const result = await db
		.delete(publishedShapeLibraries)
		.where(
			and(
				eq(publishedShapeLibraries.id, id),
				eq(publishedShapeLibraries.userId, userId),
			),
		)
		.returning({ id: publishedShapeLibraries.id });

	return result.length > 0;
}
