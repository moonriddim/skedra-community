export type TranslationParams = Record<
	string,
	string | number | boolean | undefined
>;

export type TranslationValue =
	| string
	| ((params: TranslationParams) => string)
	| TranslationTree;

export interface TranslationTree {
	[key: string]: TranslationValue;
}

export type LocaleMessages = Record<"de" | "en", TranslationTree>;
