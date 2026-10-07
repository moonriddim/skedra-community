import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";

test("managed signup shows email verification, skips E2EE and supports resend without repeating signup", async () => {
	const window = new Window({ url: "http://localhost/register" });
	const requests: { path: string; body: Record<string, unknown> }[] = [];
	const queries: string[] = [];
	let signupFails = true;
	let resendFails = true;
	const values = {
		window,
		document: window.document,
		navigator: window.navigator,
		HTMLElement: window.HTMLElement,
		localStorage: window.localStorage,
		IS_REACT_ACT_ENVIRONMENT: true,
		fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
			const path = new URL(String(input)).pathname;
			if (path === "/api/auth/get-session") return Response.json(null);
			if (path.startsWith("/api/trpc/")) {
				queries.push(path);
				return Response.json(
					{ error: { message: "Unexpected protected request" } },
					{ status: 401 },
				);
			}
			const body = JSON.parse(String(init?.body ?? "{}"));
			requests.push({ path, body });
			if (path === "/api/auth/sign-up/email") {
				if (signupFails)
					return Response.json(
						{ message: "Registration unavailable" },
						{ status: 400 },
					);
				return Response.json({
					token: null,
					user: {
						id: "review-user",
						email: body.email,
						name: body.name,
						emailVerified: false,
					},
				});
			}
			if (path === "/api/auth/send-verification-email") {
				if (resendFails)
					return Response.json({ message: "Try again later" }, { status: 429 });
				return Response.json({ status: true });
			}
			throw new Error(`Unexpected network request: ${path}`);
		},
	};
	const previous = new Map(
		Object.keys(values).map((key) => [
			key,
			Object.getOwnPropertyDescriptor(globalThis, key),
		]),
	);
	for (const [key, value] of Object.entries(values))
		Object.defineProperty(globalThis, key, {
			value,
			configurable: true,
			writable: true,
		});
	const { createRoot } = await import("react-dom/client");
	const { QueryClient, QueryClientProvider } = await import(
		"@tanstack/react-query"
	);
	const { getQueryKey } = await import("@trpc/react-query");
	const { httpBatchLink } = await import("@trpc/client");
	const { MemoryRouter } = await import("react-router");
	const { trpc } = await import("../lib/trpc");
	const { RegisterPage } = await import("./register");
	const { I18nProvider, loadI18nMessages } = await import("../lib/i18n");
	const { useLocaleStore } = await import("../stores/locale");
	useLocaleStore.getState().setLocale("de");
	await loadI18nMessages("de");
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY, gcTime: 0 },
		},
	});
	queryClient.setQueryData(
		getQueryKey(trpc.billing.getPublicConfig, undefined, "query"),
		{
			managed: true,
			foundingTrialDays: 30,
			socialSignUpEnabled: false,
		},
	);
	const trpcClient = trpc.createClient({
		links: [httpBatchLink({ url: "http://localhost/api/trpc" })],
	});
	const container = window.document.createElement("div");
	window.document.body.append(container);
	const root = createRoot(container as unknown as HTMLElement);
	const redirectTo =
		"/subscribe?plan=pro_yearly&checkout=start&redirect=%2Flibrary";
	try {
		await act(async () =>
			root.render(
				createElement(
					MemoryRouter,
					{ initialEntries: ["/register?plan=pro_yearly"] },
					createElement(
						QueryClientProvider,
						{ client: queryClient },
						createElement(trpc.Provider, {
							client: trpcClient,
							queryClient,
							// biome-ignore lint/correctness/noChildrenProp: tRPC requires children in the props passed to createElement.
							children: createElement(
								I18nProvider,
								null,
								createElement(RegisterPage),
							),
						}),
					),
				),
			),
		);
		const fill = async (id: string, value: string) =>
			act(async () => {
				const input = container.querySelector(`#${id}`);
				assert.ok(input);
				Object.getOwnPropertyDescriptor(
					window.HTMLInputElement.prototype,
					"value",
				)?.set?.call(input, value);
				input.dispatchEvent(new window.Event("input", { bubbles: true }));
			});
		await fill("name", "Review Test");
		await fill("email", "review@example.test");
		await fill("password", "test-password-only");
		const submit = async () =>
			act(async () => {
				const form = container.querySelector("form");
				assert.ok(form);
				form.dispatchEvent(
					new window.Event("submit", { bubbles: true, cancelable: true }),
				);
			});
		await submit();
		assert.match(container.textContent, /Registration unavailable/);
		assert.ok(container.querySelector('input[type="password"]'));
		assert.deepEqual(queries, []);
		signupFails = false;
		await submit();
		assert.match(container.textContent, /Registrierung erfolgreich/);
		assert.match(
			container.textContent,
			/Bestätigungsmail an review@example.test/,
		);
		assert.equal(container.querySelector('input[type="password"]'), null);
		assert.equal(container.querySelector("form"), null);
		assert.deepEqual(
			queries,
			[],
			"no protected identity reads or writes before verification",
		);
		assert.equal(requests.at(-1)?.body.callbackURL, redirectTo);
		assert.equal(
			container.querySelector('a[href^="/login"]')?.getAttribute("href"),
			`/login?redirect=${encodeURIComponent(redirectTo)}`,
		);
		const resendButton = () => {
			const button = [...container.querySelectorAll("button")].find((button) =>
				button.textContent.includes("Bestätigungsmail"),
			);
			assert.ok(button);
			return button;
		};
		await act(async () => resendButton().click());
		assert.match(
			container.querySelector('[role="alert"]')?.textContent ?? "",
			/konnte nicht angefordert/,
		);
		assert.equal(container.querySelector("output"), null);
		resendFails = false;
		await act(async () => resendButton().click());
		assert.match(
			container.querySelector("output")?.textContent ?? "",
			/Anfrage wurde angenommen/,
		);
		assert.equal(container.querySelector('[role="alert"]'), null);
		assert.equal(container.querySelector("button")?.disabled, true);
		assert.deepEqual(
			requests
				.filter(({ path }) => path.endsWith("send-verification-email"))
				.map(({ body }) => body),
			[
				{ email: "review@example.test", callbackURL: redirectTo },
				{ email: "review@example.test", callbackURL: redirectTo },
			],
		);
		assert.equal(
			requests.filter(({ path }) => path.endsWith("sign-up/email")).length,
			2,
		);
		assert.deepEqual(queries, []);
	} finally {
		await act(async () => root.unmount());
		queryClient.clear();
		// Better Auth's nanostores defer listener cleanup by one second.
		// Keep the browser globals available until that cleanup has completed.
		await new Promise((resolve) => setTimeout(resolve, 1100));
		await window.happyDOM.close();
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
