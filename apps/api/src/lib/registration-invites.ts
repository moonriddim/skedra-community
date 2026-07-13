import { randomBytes } from "node:crypto";
import {
	type Database,
	complimentaryAccessGrants,
	instanceSettings,
	registrationInvites,
	teamMembers,
	teamRoles,
	users,
	whiteboardMembers,
} from "@skedra/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import postgres from "postgres";
import { env } from "../env";
import { membershipValuesFromTeamRole } from "./board-member-access";

const INVITE_TTL_DAYS = 7;
const REGISTRATION_ADVISORY_LOCK_ID = 1_905_202_606;
const registrationLockClients = new Set<ReturnType<typeof postgres>>();
let registrationLockQueue: Promise<void> = Promise.resolve();
let registrationLocksClosing = false;

export type RegistrationMode = "open" | "invite" | "closed";

/** Serializes the first-user check and account creation across API instances. */
export function withRegistrationLock<T>(
	operation: () => Promise<T>,
): Promise<T> {
	const result = registrationLockQueue.then(async () => {
		if (registrationLocksClosing) {
			throw new Error(
				"Registration is unavailable while the server shuts down.",
			);
		}
		return runWithRegistrationLock(operation);
	});
	registrationLockQueue = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}

async function runWithRegistrationLock<T>(operation: () => Promise<T>) {
	const client = postgres(env.DATABASE_URL, {
		max: 1,
		connect_timeout: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
		connection: {
			application_name: "skedra-registration-lock",
			statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
		},
	});
	registrationLockClients.add(client);
	let locked = false;
	try {
		await client.unsafe("select pg_advisory_lock($1)", [
			REGISTRATION_ADVISORY_LOCK_ID,
		]);
		locked = true;
		return await operation();
	} finally {
		if (locked) {
			await client
				.unsafe("select pg_advisory_unlock($1)", [
					REGISTRATION_ADVISORY_LOCK_ID,
				])
				.catch(() => undefined);
		}
		registrationLockClients.delete(client);
		await client.end({ timeout: 1 }).catch(() => undefined);
	}
}

export async function closeRegistrationLocks() {
	registrationLocksClosing = true;
	const clients = [...registrationLockClients];
	registrationLockClients.clear();
	await Promise.allSettled(clients.map((client) => client.end({ timeout: 1 })));
}

export function normalizeInviteEmail(email: string) {
	return email.trim().toLowerCase();
}

export function buildRegistrationInviteUrl(input: {
	token: string;
	email: string;
	redirect?: string;
}) {
	const url = new URL("/register", env.APP_URL);
	url.searchParams.set("invite", input.token);
	url.searchParams.set("email", input.email);
	if (input.redirect) url.searchParams.set("redirect", input.redirect);
	return url.toString();
}

export async function hasAnyUser(db: Database) {
	const existing = await db.query.users.findFirst({
		columns: { id: true },
	});
	return !!existing;
}

export async function createRegistrationInvite(
	db: Database,
	input: {
		email: string;
		invitedById: string;
		purpose?: "app" | "team" | "board";
		teamId?: string;
		teamRoleId?: string | null;
		workspaceRole?: "member" | "admin";
		whiteboardId?: string;
		whiteboardTeamRoleId?: string | null;
	},
) {
	const email = normalizeInviteEmail(input.email);
	const token = randomBytes(32).toString("hex");
	const expiresAt = new Date(
		Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
	);

	const [invite] = await db
		.insert(registrationInvites)
		.values({
			email,
			token,
			purpose: input.purpose ?? "app",
			invitedById: input.invitedById,
			teamId: input.teamId,
			teamRoleId: input.teamRoleId ?? null,
			workspaceRole: input.workspaceRole ?? "member",
			whiteboardId: input.whiteboardId,
			whiteboardTeamRoleId: input.whiteboardTeamRoleId ?? null,
			expiresAt,
		})
		.returning();

	return invite;
}

export async function findValidRegistrationInvite(
	db: Database,
	input: { email: string; token?: string | null },
) {
	const token = input.token;
	if (!token) return null;
	const email = normalizeInviteEmail(input.email);

	return db.query.registrationInvites.findFirst({
		where: and(
			eq(registrationInvites.email, email),
			eq(registrationInvites.token, token),
			isNull(registrationInvites.acceptedAt),
			gt(registrationInvites.expiresAt, new Date()),
		),
	});
}

export async function canSignUpWithEmail(
	db: Database,
	input: {
		email: string;
		token?: string | null;
		mode: RegistrationMode;
	},
) {
	const firstUser = !(await hasAnyUser(db));
	if (firstUser) return { allowed: true as const, firstUser, invite: null };
	if (input.mode === "open")
		return { allowed: true as const, firstUser, invite: null };
	if (input.mode === "closed")
		return { allowed: false as const, firstUser, invite: null };

	const invite = await findValidRegistrationInvite(db, input);
	return { allowed: !!invite, firstUser, invite };
}

export async function completeRegistrationInvite(
	db: Database,
	input: { email: string; token?: string | null },
) {
	const token = input.token;
	if (!token) return null;
	const email = normalizeInviteEmail(input.email);

	return db.transaction(async (tx) => {
		const user = await tx.query.users.findFirst({
			where: eq(users.email, email),
		});
		if (!user) return null;

		// Claim the invite first. The conditional UPDATE serializes concurrent
		// accept attempts; all following writes roll back together on failure.
		const acceptedAt = new Date();
		const [invite] = await tx
			.update(registrationInvites)
			.set({ acceptedAt })
			.where(
				and(
					eq(registrationInvites.email, email),
					eq(registrationInvites.token, token),
					isNull(registrationInvites.acceptedAt),
					gt(registrationInvites.expiresAt, acceptedAt),
				),
			)
			.returning();
		if (!invite) return null;

		if (
			invite.complimentaryAccessReason &&
			invite.complimentaryAccessGrantedByEmail
		) {
			await tx.insert(complimentaryAccessGrants).values({
				userId: user.id,
				reason: invite.complimentaryAccessReason,
				expiresAt: invite.complimentaryAccessExpiresAt,
				grantedByEmail: invite.complimentaryAccessGrantedByEmail,
			});
		}

		if (invite.teamId) {
			const memberValues = {
				teamId: invite.teamId,
				userId: user.id,
				roleId: invite.teamRoleId,
				workspaceRole: invite.workspaceRole,
			};

			if (invite.purpose === "board") {
				await tx.insert(teamMembers).values(memberValues).onConflictDoNothing();
			} else {
				await tx
					.insert(teamMembers)
					.values(memberValues)
					.onConflictDoUpdate({
						target: [teamMembers.teamId, teamMembers.userId],
						set: {
							roleId: invite.teamRoleId,
							workspaceRole: invite.workspaceRole,
						},
					});
			}
		}

		if (invite.whiteboardId) {
			if (!invite.whiteboardTeamRoleId) {
				throw new Error("Board invite no longer has an assignable role.");
			}
			const role = await tx.query.teamRoles.findFirst({
				where: eq(teamRoles.id, invite.whiteboardTeamRoleId),
			});
			if (!role) {
				throw new Error("Board invite role no longer exists.");
			}
			const memberValues = membershipValuesFromTeamRole(role.id);
			await tx
				.insert(whiteboardMembers)
				.values({
					whiteboardId: invite.whiteboardId,
					userId: user.id,
					...memberValues,
				})
				.onConflictDoUpdate({
					target: [whiteboardMembers.whiteboardId, whiteboardMembers.userId],
					set: memberValues,
				});
		}

		return invite;
	});
}

export async function assignFirstUserAsInstanceAdmin(
	db: Database,
	userId: string,
) {
	await db
		.insert(instanceSettings)
		.values({ id: "default" })
		.onConflictDoNothing();

	const [updated] = await db
		.update(instanceSettings)
		.set({ adminUserId: userId, updatedAt: new Date() })
		.where(
			and(
				eq(instanceSettings.id, "default"),
				isNull(instanceSettings.adminUserId),
				sql`${userId} = (
					select ${users.id}
					from ${users}
					order by ${users.createdAt} asc, ${users.id} asc
					limit 1
				)`,
			),
		)
		.returning();

	return (
		updated ??
		(await db.query.instanceSettings.findFirst({
			where: eq(instanceSettings.id, "default"),
		}))
	);
}
