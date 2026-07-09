import { env } from "../env";

export function getYjsEncryptionOptions() {
	return {
		secret: env.DATA_ENCRYPTION_SECRET ?? env.AUTH_SECRET,
		purpose: "whiteboard-yjs-state",
	};
}
