import { useLocaleStore } from "@/stores/locale";
import { createContext, useContext, useEffect, useState } from "react";
import type { TranslationParams, TranslationTree } from "./messages";

export type Locale = "de" | "en";

type Messages = Partial<Record<Locale, TranslationTree>>;
const loadedMessages: Messages = {};
const loadingMessages = new Map<Locale, Promise<TranslationTree>>();

const localeLoaders: Record<Locale, () => Promise<TranslationTree>> = {
	de: () => import("./messages.de").then((module) => module.deMessages),
	en: () => import("./messages.en").then((module) => module.enMessages),
};

async function loadLocaleMessages(locale: Locale) {
	if (loadedMessages[locale]) return loadedMessages[locale];
	const existing = loadingMessages.get(locale);
	if (existing) return existing;

	const next = localeLoaders[locale]().then((messages) => {
		loadedMessages[locale] = messages;
		loadingMessages.delete(locale);
		return messages;
	});
	loadingMessages.set(locale, next);
	return next;
}

export async function loadI18nMessages(
	locale: Locale = useLocaleStore.getState().locale,
) {
	if (locale === "de") {
		await loadLocaleMessages("de");
	} else {
		await Promise.all([loadLocaleMessages("de"), loadLocaleMessages(locale)]);
	}
	return loadedMessages;
}

interface I18nContextValue {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: (key: string, params?: TranslationParams) => string;
}

const globalScope = globalThis as typeof globalThis & {
	__skedraI18nContext?: ReturnType<
		typeof createContext<I18nContextValue | null>
	>;
};

const I18nContext =
	globalScope.__skedraI18nContext ??
	createContext<I18nContextValue | null>(null);

if (!globalScope.__skedraI18nContext) {
	globalScope.__skedraI18nContext = I18nContext;
}

I18nContext.displayName = "SkedraI18nContext";

function setDocumentLocale(locale: Locale) {
	document.documentElement.lang = locale;
}

function interpolate(template: string, params: TranslationParams = {}) {
	return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

function resolveValue(
	tree: Record<string, unknown> | null | undefined,
	key: string,
): unknown {
	if (!tree) return undefined;
	return key.split(".").reduce<unknown>((current, part) => {
		if (
			!current ||
			typeof current === "string" ||
			typeof current === "function"
		)
			return undefined;
		return (current as Record<string, unknown>)[part];
	}, tree);
}

export function translate(
	locale: Locale,
	key: string,
	params?: TranslationParams,
) {
	const messages = loadedMessages;
	const localized = resolveValue(messages[locale], key);
	const fallback = resolveValue(messages.de, key);
	const value = localized ?? fallback;

	if (typeof value === "function") return value(params ?? {});
	if (typeof value === "string") return interpolate(value, params);
	return key;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
	const locale = useLocaleStore((state) => state.locale);
	const setLocale = useLocaleStore((state) => state.setLocale);
	const [messagesVersion, setMessagesVersion] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setDocumentLocale(locale);
		void loadI18nMessages(locale).then(() => {
			if (!cancelled) setMessagesVersion((version) => version + 1);
		});
		return () => {
			cancelled = true;
		};
	}, [locale]);

	const contextValue: I18nContextValue = {
		locale,
		setLocale,
		t: (key, params) => {
			void messagesVersion;
			return translate(locale, key, params);
		},
	};

	return (
		<I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
	);
}

export function useI18n() {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useI18n must be used within an I18nProvider");
	}
	return context;
}
