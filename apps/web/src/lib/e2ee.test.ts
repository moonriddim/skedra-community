import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
	createE2eeKeyHash,
	createEncryptedUserE2eeIdentity,
	decryptBoardKeyFromRecipientEnvelope,
	encryptBoardKeyForRecipient,
	generateE2eeKey,
	reencryptUserE2eeIdentity,
	unlockOrCreateUserE2eeIdentity,
	unlockUserE2eeIdentity,
} from "./e2ee";

test("board key recipient envelopes are bound to board, recipient, and key hash", async () => {
	const boardId = randomUUID();
	const recipientUserId = "user-recipient";
	const boardKey = generateE2eeKey();
	const keyHash = await createE2eeKeyHash(boardKey);
	const identity = await createEncryptedUserE2eeIdentity(
		"recipient@example.com",
		"correct horse battery staple",
	);

	const envelope = await encryptBoardKeyForRecipient({
		boardKey,
		recipientPublicKey: identity.unlockedIdentity.publicKey,
		boardId,
		recipientUserId,
		keyHash,
	});

	const recoveredKey = await decryptBoardKeyFromRecipientEnvelope(
		envelope,
		identity.unlockedIdentity,
		{ boardId, recipientUserId },
	);

	assert.equal(recoveredKey, boardKey);
});

test("board key recipient envelopes reject another board binding", async () => {
	const boardId = randomUUID();
	const recipientUserId = "user-recipient";
	const boardKey = generateE2eeKey();
	const keyHash = await createE2eeKeyHash(boardKey);
	const identity = await createEncryptedUserE2eeIdentity(
		"recipient@example.com",
		"correct horse battery staple",
	);
	const envelope = await encryptBoardKeyForRecipient({
		boardKey,
		recipientPublicKey: identity.unlockedIdentity.publicKey,
		boardId,
		recipientUserId,
		keyHash,
	});

	await assert.rejects(
		() =>
			decryptBoardKeyFromRecipientEnvelope(
				envelope,
				identity.unlockedIdentity,
				{
					boardId: randomUUID(),
					recipientUserId,
				},
			),
		/another board/u,
	);
});

test("board key recipient envelopes reject mismatched key hashes before storing", async () => {
	const identity = await createEncryptedUserE2eeIdentity(
		"recipient@example.com",
		"correct horse battery staple",
	);

	await assert.rejects(
		() =>
			encryptBoardKeyForRecipient({
				boardKey: generateE2eeKey(),
				recipientPublicKey: identity.unlockedIdentity.publicKey,
				boardId: randomUUID(),
				recipientUserId: "user-recipient",
				keyHash: "f".repeat(64),
			}),
		/does not match/u,
	);
});

test("new user E2EE identities pass the account password to the save call", async () => {
	let savedAccountPassword: string | undefined;

	await unlockOrCreateUserE2eeIdentity({
		email: "owner@example.com",
		password: "correct horse battery staple",
		existingIdentity: null,
		saveIdentity: async (identity) => {
			savedAccountPassword = identity.accountPassword;
		},
	});

	assert.equal(savedAccountPassword, "correct horse battery staple");
});

test("password changes re-wrap the existing E2EE identity", async () => {
	const original = await createEncryptedUserE2eeIdentity(
		"owner@example.com",
		"old account password",
	);
	const encryptedPrivateKey = await reencryptUserE2eeIdentity(
		"old account password",
		"new account password",
		original,
	);
	const rewrapped = {
		publicKey: original.publicKey,
		encryptedPrivateKey,
	};

	const unlocked = await unlockUserE2eeIdentity(
		"owner@example.com",
		"new account password",
		rewrapped,
	);
	assert.equal(unlocked.publicKey, original.publicKey);
	await assert.rejects(() =>
		unlockUserE2eeIdentity(
			"owner@example.com",
			"old account password",
			rewrapped,
		),
	);
});
