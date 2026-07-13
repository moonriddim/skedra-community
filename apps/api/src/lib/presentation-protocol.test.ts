import assert from "node:assert/strict";
import test from "node:test";
import {
	presentationPublisherMessageSchema,
	presentationViewerMessageSchema,
	remoteCanvasPresenceSchema,
} from "@skedra/shared";
import {
	isAuthorizedPresentationSession,
	presentationFrameAllowsAsset,
} from "./presentation";

test("presentation protocols reject malformed rendering data", () => {
	assert.equal(
		presentationPublisherMessageSchema.safeParse({
			type: "cursor",
			sequence: 1,
			cursor: { x: Number.NaN, y: 0 },
		}).success,
		false,
	);
	assert.equal(
		presentationViewerMessageSchema.safeParse({
			type: "frame",
			sessionId: "not-a-session",
			sequence: 1,
			payload: "{}",
		}).success,
		false,
	);
	assert.equal(
		presentationPublisherMessageSchema.safeParse({
			type: "camera",
			sequence: 2,
			viewId: "slide-1",
			camera: {
				centerX: 0.5,
				centerY: 0.5,
				visibleWidth: 0,
				visibleHeight: 1,
			},
		}).success,
		false,
	);
});

test("presence payloads are bounded before rendering", () => {
	const result = remoteCanvasPresenceSchema.safeParse({
		clientId: 1,
		user: {
			id: "attacker",
			name: "x".repeat(500),
			image: null,
			color: "#fff",
			role: "owner",
		},
		selection: [],
		cursor: null,
		viewport: { x: 0, y: 0, zoom: Number.POSITIVE_INFINITY },
		activeViewId: null,
		canWrite: true,
		updatedAt: Date.now(),
	});

	assert.equal(result.success, false);
});

test("presenter authorization is bound to one live session and user", () => {
	const now = new Date("2026-07-13T12:00:00.000Z");
	const presentation = {
		presentationSessionId: "11111111-1111-4111-8111-111111111111",
		presentationPresenterId: "presenter-a",
		presentationActiveUntil: new Date(now.getTime() + 60_000),
	};

	assert.equal(
		isAuthorizedPresentationSession(
			presentation,
			{
				sessionId: "11111111-1111-4111-8111-111111111111",
				presenterId: "presenter-a",
			},
			now,
		),
		true,
	);
	assert.equal(
		isAuthorizedPresentationSession(
			presentation,
			{
				sessionId: "22222222-2222-4222-8222-222222222222",
				presenterId: "presenter-a",
			},
			now,
		),
		false,
	);
	assert.equal(
		isAuthorizedPresentationSession(
			presentation,
			{
				sessionId: "11111111-1111-4111-8111-111111111111",
				presenterId: "presenter-b",
			},
			now,
		),
		false,
	);
	assert.equal(
		isAuthorizedPresentationSession(
			{ ...presentation, presentationActiveUntil: now },
			{
				sessionId: "11111111-1111-4111-8111-111111111111",
				presenterId: "presenter-a",
			},
			now,
		),
		false,
	);
});

test("presentation asset access is limited to the current live frame", () => {
	const now = new Date("2026-07-13T12:00:00.000Z");
	const assetId = "22222222-2222-4222-8222-222222222222";
	const presentation = {
		id: "11111111-1111-4111-8111-111111111111",
		presentationSessionId: "33333333-3333-4333-8333-333333333333",
		presentationActiveUntil: new Date(now.getTime() + 60_000),
		presentationFrameAssetIds: JSON.stringify([assetId]),
	};

	assert.equal(
		presentationFrameAllowsAsset(
			presentation,
			{ whiteboardId: presentation.id, assetId },
			now,
		),
		true,
	);
	assert.equal(
		presentationFrameAllowsAsset(
			presentation,
			{
				whiteboardId: presentation.id,
				assetId: "44444444-4444-4444-8444-444444444444",
			},
			now,
		),
		false,
	);
	assert.equal(
		presentationFrameAllowsAsset(
			{ ...presentation, presentationActiveUntil: now },
			{ whiteboardId: presentation.id, assetId },
			now,
		),
		false,
	);
});
