import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deflateSync } from "node:zlib";
import type { Database, whiteboards } from "@skedra/db";
import { encryptText } from "@skedra/shared/server-crypto";

process.env.SKEDRA_DEPLOYMENT_MODE = "selfhost";
process.env.AUTH_SECRET = "presentation-tests-secret-at-least-32-chars";
process.env.DATA_ENCRYPTION_SECRET =
	"presentation-tests-data-secret-at-least-32-chars";
const { whiteboardRouter } = await import("../trpc/routers/whiteboard");
const { encodePresentationPreview, presentationPreviewPngSchema } =
	await import("./presentation-preview");
const { createPresentationSharePages } = await import(
	"./presentation-share-pages"
);
const { getPresentationShareAccess } = await import("./presentation");
const { getYjsEncryptionOptions } = await import("./yjs-encryption");

const boardId = "11111111-1111-4111-8111-111111111111";
const token = "anonymous-presentation-token-123456";
const fixture = () =>
	({
		id: boardId,
		name: 'Growth Plan <script>alert("x")</script>',
		encryptionMode: "server",
		presentationShareToken: token,
		presentationShareEnabled: true,
		presentationSharePresenceEnabled: true,
		presentationShareAccessMode: "always",
		archivedAt: null,
		presentationActiveUntil: null,
		presentationPreviewPng: null,
		presentationPreviewVersion: null,
	}) as typeof whiteboards.$inferSelect;

function database(board = fixture()) {
	return {
		query: {
			whiteboards: { findFirst: async () => board },
			whiteboardE2eeUpdates: {
				findMany: async () => [
					{
						id: "22222222-2222-4222-8222-222222222222",
						clientId: "owner-client",
						createdAt: new Date(),
						update: encryptText(
							"saved-board-update",
							getYjsEncryptionOptions(),
						),
					},
				],
			},
		},
	} as unknown as Database;
}
const anonymous = (db: Database) =>
	whiteboardRouter.createCaller({
		db,
		headers: new Headers(),
		user: null,
		session: null,
	});

test("an anonymous always-active presentation can load the saved board and cannot write", async () => {
	const caller = anonymous(database());
	const access = await caller.getPresentationAccess({ shareToken: token });
	assert.equal(access.whiteboardId, boardId);
	assert.equal(access.isPresentationActive, false);
	const rows = await caller.listServerUpdates({
		whiteboardId: boardId,
		presentationShareToken: token,
	});
	assert.equal(rows[0].update, "saved-board-update");
	await assert.rejects(
		caller.appendServerUpdate({
			whiteboardId: boardId,
			presentationShareToken: token,
			clientId: "guest-client",
			update: "test-update",
		}),
		{ code: "FORBIDDEN" },
	);
	await assert.rejects(
		caller.compactServerUpdates({
			whiteboardId: boardId,
			presentationShareToken: token,
			clientId: "guest-client",
			update: "test-update",
			upToId: "22222222-2222-4222-8222-222222222222",
		}),
		{ code: "FORBIDDEN" },
	);
	await assert.rejects(
		caller.listServerUpdates({
			whiteboardId: "33333333-3333-4333-8333-333333333333",
			presentationShareToken: token,
		}),
		{ code: "FORBIDDEN" },
	);
});

test("live-only links never grant access to the underlying board document", async () => {
	const board = fixture();
	board.presentationShareAccessMode = "presentation-only";
	board.presentationActiveUntil = new Date(Date.now() + 60_000);
	const caller = anonymous(database(board));
	assert.equal(
		(await caller.getPresentationAccess({ shareToken: token }))
			.isPresentationActive,
		true,
	);
	await assert.rejects(
		caller.listServerUpdates({
			whiteboardId: boardId,
			presentationShareToken: token,
		}),
		{ code: "FORBIDDEN" },
	);
	board.presentationActiveUntil = null;
	await assert.rejects(caller.getPresentationAccess({ shareToken: token }), {
		code: "FORBIDDEN",
	});
});

test("anonymous E2EE viewers can fetch ciphertext but cannot write even with the board key", async () => {
	const board = fixture();
	board.encryptionMode = "e2ee";
	board.e2eeKeyHash = "a".repeat(64);
	const caller = anonymous(database(board));
	const rows = await caller.listE2eeUpdates({
		whiteboardId: boardId,
		presentationShareToken: token,
	});
	assert.equal(rows.length, 1);
	const input = {
		whiteboardId: boardId,
		presentationShareToken: token,
		clientId: "guest-client",
		keyHash: board.e2eeKeyHash,
		update: "encrypted-update",
	};
	await assert.rejects(caller.appendE2eeUpdate(input), { code: "FORBIDDEN" });
	await assert.rejects(
		caller.compactE2eeUpdates({
			...input,
			upToId: "22222222-2222-4222-8222-222222222222",
		}),
		{ code: "FORBIDDEN" },
	);
});

test("disabled and archived links stop anonymous reads", async () => {
	for (const changes of [
		{ presentationShareEnabled: false },
		{ archivedAt: new Date() },
	]) {
		const caller = anonymous(database(Object.assign(fixture(), changes)));
		await assert.rejects(caller.getPresentationAccess({ shareToken: token }), {
			code: "NOT_FOUND",
		});
		await assert.rejects(
			caller.listServerUpdates({
				whiteboardId: boardId,
				presentationShareToken: token,
			}),
		);
	}
});

// A valid bounded PNG fixture, with CRCs, for the image response tests.
function crc32(bytes: Buffer) {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++)
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}
function pngFixture() {
	const chunk = (type: string, data: Buffer) => {
		const content = Buffer.concat([Buffer.from(type), data]);
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(content));
		return Buffer.concat([length, content, crc]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(1200);
	header.writeUInt32BE(630, 4);
	header[8] = 8;
	header[9] = 6;
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(Buffer.alloc((1200 * 4 + 1) * 630))),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

test("messenger HTML and PNG work without a session and disappear on revocation", async () => {
	const board = fixture();
	const png = pngFixture();
	Object.assign(board, encodePresentationPreview(png.toString("base64")));
	assert.notEqual(
		board.presentationPreviewPng,
		png.toString("base64"),
		"stored preview must be encrypted",
	);
	const shell = await readFile(
		new URL("../../../web/index.html", import.meta.url),
		"utf8",
	);
	const app = createPresentationSharePages({
		appUrl: "https://skedra.xyz",
		getAccess: (token) => getPresentationShareAccess(database(board), token),
		loadShell: async () => shell,
		loadPreview: async () => board.presentationPreviewPng,
	});
	const page = await app.request(`/${token}/page`);
	assert.equal(page.status, 200);
	assert.equal(page.headers.get("cache-control"), "no-store");
	const html = await page.text();
	assert.match(html, /Growth Plan &lt;script&gt;/);
	assert.doesNotMatch(
		html,
		/<script>alert|readme\/skedra-whiteboard.png|rel="canonical"|data-skedra-alternate|application\/ld\+json/,
	);
	assert.match(
		html,
		/property="og:image" content="https:\/\/skedra.xyz\/api\/presentations\//,
	);
	assert.match(
		html,
		/src="\/src\/main.tsx"/,
		"must preserve the SPA entry point",
	);
	assert.equal((html.match(/property="og:title"/g) ?? []).length, 1);
	const image = await app.request(`/${token}/preview.png?v=old-version`);
	assert.equal(image.status, 200);
	assert.equal(image.headers.get("content-type"), "image/png");
	assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
	board.presentationShareAccessMode = "presentation-only";
	board.presentationActiveUntil = new Date(Date.now() + 60_000);
	assert.equal((await app.request(`/${token}/preview.png`)).status, 404);
	assert.doesNotMatch(
		await (await app.request(`/${token}/page`)).text(),
		/property="og:image"/,
	);
	board.presentationShareEnabled = false;
	assert.equal(
		(await app.request(`/${token}/preview.png?v=old-version`)).status,
		404,
	);
	const revoked = await app.request(`/${token}/page`);
	assert.equal(revoked.status, 404);
	assert.doesNotMatch(await revoked.text(), /Growth Plan|property="og:image"/);
});

test("preview uploads reject executable formats and oversized raster dimensions", () => {
	assert.equal(
		presentationPreviewPngSchema.safeParse(
			Buffer.from('<svg onload="alert(1)" />').toString("base64"),
		).success,
		false,
	);
	const png = pngFixture();
	png.writeUInt32BE(100_000, 16);
	assert.equal(
		presentationPreviewPngSchema.safeParse(png.toString("base64")).success,
		false,
	);
});
