declare module "node:assert/strict" {
	const assert: {
		equal(actual: unknown, expected: unknown, message?: string): void;
		deepEqual(actual: unknown, expected: unknown, message?: string): void;
		ok(value: unknown, message?: string): void;
		rejects(block: Promise<unknown>): Promise<void>;
	};
	export default assert;
}

declare module "node:test" {
	export function test(name: string, fn: () => void | Promise<void>): void;
}
